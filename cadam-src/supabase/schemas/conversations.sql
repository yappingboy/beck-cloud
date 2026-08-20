CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "public"."conversation-type" DEFAULT 'parametric'::"public"."conversation-type" NOT NULL,
    "privacy" "public"."privacy_type" DEFAULT 'private'::"public"."privacy_type" NOT NULL,
    "current_message_leaf_id" "uuid",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS conversations_pkey ON "public"."conversations" USING btree (id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_pkey') THEN
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY USING INDEX "conversations_pkey";
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user_id_fkey') THEN
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user_id_fkey') THEN
ALTER TABLE "public"."conversations" VALIDATE CONSTRAINT "conversations_user_id_fkey";
  END IF;
END
$$;


CREATE INDEX IF NOT EXISTS conversations_created_at_idx ON "public"."conversations" USING btree (created_at);

CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON "public"."conversations" USING btree (updated_at);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON "public"."conversations" USING btree (user_id);


CREATE POLICY "Anyone can view a public conversation" ON "public"."conversations" FOR SELECT TO "authenticated", "anon" USING (("privacy" = 'public'::"public"."privacy_type"));

CREATE POLICY "Users can manage their own conversations" ON "public"."conversations" USING ( (SELECT "auth"."uid"()) = "user_id" );

ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;
