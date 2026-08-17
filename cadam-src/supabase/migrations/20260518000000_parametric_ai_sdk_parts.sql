-- Add the new AI-SDK-shaped columns to messages. `parts` is a discriminated
-- union of AI SDK UI parts (`{type:'text',...}`, `{type:'tool-...'}`, etc.);
-- `metadata` carries per-message bookkeeping like the `model` that generated
-- the response.
--
-- The migration uses a CREATE-TABLE-and-swap pattern instead of an in-place
-- UPDATE. Bench on 745k rows of prod data: the compute (CASE + jsonb_build)
-- takes 1.3s but rewriting every row in place takes 80s+ because of MVCC,
-- per-row WAL, and TOAST writes on the 968 MB of artifact code being copied
-- into `parts.input`. A bulk INSERT into a fresh table writes page-level
-- WAL, has no dead tuples to clean up, and builds the indexes once at the
-- end — total runtime drops well under a minute.

-- Tune for bulk work. Plain SET (not SET LOCAL) so this file works whether
-- run inside a transaction (supabase db push wraps it implicitly) or in
-- autocommit mode (psql on the direct connection); both forms scope to the
-- current session and don't leak.
SET statement_timeout = 0;
SET maintenance_work_mem = '512MB';
SET max_parallel_maintenance_workers = 4;

-- ============================================================================
-- 1. Build a new messages table with the parts/metadata columns pre-populated.
--    No indexes, constraints, or policies yet — those slow down bulk INSERT.
-- ============================================================================
CREATE TABLE public.messages_new AS
SELECT
  m.id,
  m.created_at,
  m.conversation_id,
  m.role,
  m.content,
  m.parent_message_id,
  m.rating,
  CASE
    WHEN m.content IS NULL OR jsonb_typeof(m.content) <> 'object' THEN '[]'::jsonb
    WHEN m.role = 'user' THEN
      -- text part
      (CASE WHEN COALESCE(m.content->>'text','') <> ''
        THEN jsonb_build_array(jsonb_build_object('type','text','text', m.content->>'text'))
        ELSE '[]'::jsonb END)
      -- file parts from images. Storage path is `${user}/${conv}/${imageId}`
      -- with no extension; .png suffix is just a display label.
      || (CASE WHEN jsonb_typeof(m.content->'images') = 'array'
        THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'type','file',
            'mediaType','image/png',
            'filename', img || '.png',
            'url', '/storage/v1/object/public/images/' || c.user_id::text || '/' || c.id::text || '/' || img
          ))
          FROM jsonb_array_elements_text(m.content->'images') AS img
        ), '[]'::jsonb)
        ELSE '[]'::jsonb END)
      -- data-mesh-context
      || (CASE WHEN jsonb_typeof(m.content->'mesh') = 'object'
              AND (m.content->'mesh'->>'id') IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object(
          'type','data-mesh-context',
          'data', jsonb_strip_nulls(jsonb_build_object(
            'meshId', m.content->'mesh'->>'id',
            'fileType', COALESCE(m.content->'mesh'->>'fileType','glb'),
            'filename', m.content->>'meshFilename',
            'boundingBox', m.content->'meshBoundingBox'
          ))
        ))
        ELSE '[]'::jsonb END)
      -- data-mesh-preferences
      || (CASE WHEN (m.content ? 'meshTopology') OR (m.content ? 'polygonCount')
        THEN jsonb_build_array(jsonb_build_object(
          'type','data-mesh-preferences',
          'data', jsonb_build_object(
            'topology', COALESCE(m.content->>'meshTopology','polys'),
            'polygonCount', COALESCE(NULLIF(m.content->>'polygonCount','')::int, 100000)
          )
        ))
        ELSE '[]'::jsonb END)
    WHEN m.role = 'assistant' THEN
      -- text part (assistant text lands with state:'done')
      (CASE WHEN COALESCE(m.content->>'text','') <> ''
        THEN jsonb_build_array(jsonb_build_object(
          'type','text','text', m.content->>'text','state','done'))
        ELSE '[]'::jsonb END)
      -- tool-build_parametric_model. The legacy toolCalls array was the
      -- source of the original tool call id, but ~98% of assistant rows have
      -- toolCalls=[], so we synthesize a deterministic id keyed on the
      -- message uuid instead. Re-runs are byte-identical for the same row.
      -- The artifact object is referenced directly rather than rebuilt
      -- field-by-field — same data, no re-serialization cost.
      || (CASE WHEN jsonb_typeof(m.content->'artifact') = 'object'
        THEN jsonb_build_array(jsonb_build_object(
          'type','tool-build_parametric_model',
          'toolCallId', 'tool_legacy_bp_' || m.id::text,
          'state','output-available',
          'input', m.content->'artifact',
          'output', jsonb_build_object('status','success','message','')
        ))
        ELSE '[]'::jsonb END)
      -- tool-create_mesh
      || (CASE WHEN jsonb_typeof(m.content->'mesh') = 'object'
              AND (m.content->'mesh'->>'id') IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object(
          'type','tool-create_mesh',
          'toolCallId', m.content->'mesh'->>'id',
          'state','output-available',
          'input', '{}'::jsonb,
          'output', jsonb_build_object(
            'id', m.content->'mesh'->>'id',
            'fileType', COALESCE(m.content->'mesh'->>'fileType','glb')
          )
        ))
        ELSE '[]'::jsonb END)
      -- assistant-side file parts (legacy create_image tool outputs)
      || (CASE WHEN jsonb_typeof(m.content->'images') = 'array'
        THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'type','file',
            'mediaType','image/png',
            'filename', img || '.png',
            'url', '/storage/v1/object/public/images/' || c.user_id::text || '/' || c.id::text || '/' || img
          ))
          FROM jsonb_array_elements_text(m.content->'images') AS img
        ), '[]'::jsonb)
        ELSE '[]'::jsonb END)
    ELSE '[]'::jsonb
  END AS parts,
  jsonb_strip_nulls(jsonb_build_object('model', m.content->>'model')) AS metadata
FROM public.messages m
LEFT JOIN public.conversations c ON c.id = m.conversation_id;

-- ============================================================================
-- 2. Restore the column constraints CTAS strips out. `content` becomes
--    nullable (new code writes parts only); `parts` and `metadata` get the
--    same defaults as the original ADD COLUMN form.
-- ============================================================================
ALTER TABLE public.messages_new
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN conversation_id SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN rating SET DEFAULT 0::smallint,
  ALTER COLUMN rating SET NOT NULL,
  ALTER COLUMN parts SET DEFAULT '[]'::jsonb,
  ALTER COLUMN parts SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL;

-- ============================================================================
-- 3. Indexes. Built once at the end of the bulk load — far faster than
--    maintaining them per-row during INSERT.
-- ============================================================================
ALTER TABLE public.messages_new
  ADD CONSTRAINT messages_new_pkey PRIMARY KEY (id);

CREATE INDEX messages_new_conversation_id_idx
  ON public.messages_new USING btree (conversation_id);

-- ============================================================================
-- 4. Constraints. The role check matches the original schema. The
--    payload-present check is new and added NOT VALID to skip the full
--    table scan — every row trivially satisfies it (content was NOT NULL
--    in the legacy schema and every row carries either parts or content).
-- ============================================================================
ALTER TABLE public.messages_new
  ADD CONSTRAINT messages_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text])) NOT VALID;

ALTER TABLE public.messages_new
  ADD CONSTRAINT messages_payload_present
  CHECK (jsonb_array_length(parts) > 0 OR content IS NOT NULL) NOT VALID;

ALTER TABLE public.messages_new
  ADD CONSTRAINT messages_new_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
  ON DELETE CASCADE NOT VALID;

-- ============================================================================
-- 5. RLS — same policies as the legacy table.
-- ============================================================================
ALTER TABLE public.messages_new ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public conversations messages"
  ON public.messages_new
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages_new.conversation_id
      AND conversations.privacy = 'public'::privacy_type
  ));

CREATE POLICY "Users can manage messages in their conversations"
  ON public.messages_new
  USING ((SELECT auth.uid() AS uid) IN (
    SELECT conversations.user_id FROM public.conversations
    WHERE conversations.id = messages_new.conversation_id
  ));

-- ============================================================================
-- 6. Grants — mirror the legacy table's permissions for anon/authenticated/
--    service_role/postgres.
-- ============================================================================
GRANT ALL ON TABLE public.messages_new TO anon;
GRANT ALL ON TABLE public.messages_new TO authenticated;
GRANT ALL ON TABLE public.messages_new TO service_role;
GRANT ALL ON TABLE public.messages_new TO postgres;

-- ============================================================================
-- 7. Trigger — keep conversations.current_message_leaf_id pointed at the
--    latest inserted message (function is unchanged, defined in the initial
--    schema migration).
-- ============================================================================
CREATE TRIGGER update_leaf_trigger
  AFTER INSERT ON public.messages_new
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_leaf();

-- ============================================================================
-- 8. Atomic swap. Drop the old table, rename the new one into its place,
--    rename the indexes/constraints so future migrations and ORMs see the
--    canonical names. This whole step holds an ACCESS EXCLUSIVE lock on
--    `messages` for milliseconds.
-- ============================================================================
DROP TABLE public.messages;

ALTER TABLE public.messages_new RENAME TO messages;
ALTER INDEX public.messages_new_pkey RENAME TO messages_pkey;
ALTER INDEX public.messages_new_conversation_id_idx RENAME TO messages_conversation_id_idx;
ALTER TABLE public.messages RENAME CONSTRAINT messages_new_conversation_id_fkey TO messages_conversation_id_fkey;

-- ============================================================================
-- 9. The legacy `conversations.legacy` column is no longer needed.
-- ============================================================================
ALTER TABLE public.conversations DROP COLUMN IF EXISTS legacy;

-- ============================================================================
-- 10. Atomic write for `conversations.settings.suggestions`. The chat server
--     previously read settings, merged the new suggestions array client-side,
--     and wrote the whole object back — which under concurrent assistant
--     turns could silently drop the other update. `jsonb_set` runs in one
--     statement so only the `suggestions` key is touched.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_conversation_suggestions(
  p_conversation_id uuid,
  p_suggestions jsonb
) RETURNS void LANGUAGE sql VOLATILE SECURITY INVOKER AS $$
  UPDATE public.conversations
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{suggestions}',
    p_suggestions,
    true
  )
  WHERE id = p_conversation_id;
$$;
