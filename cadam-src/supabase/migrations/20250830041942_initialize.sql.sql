
  create table "public"."conversations" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "user_id" uuid not null,
    "title" text not null,
    "current_message_leaf_id" uuid
      );


alter table "public"."conversations" enable row level security;


  create table "public"."messages" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "conversation_id" uuid not null,
    "role" text not null,
    "content" jsonb not null,
    "parent_message_id" uuid
      );


alter table "public"."messages" enable row level security;

CREATE INDEX conversations_created_at_idx ON public.conversations USING btree (created_at);

CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);

CREATE INDEX conversations_updated_at_idx ON public.conversations USING btree (updated_at);

CREATE INDEX conversations_user_id_idx ON public.conversations USING btree (user_id);

CREATE INDEX messages_conversation_id_idx ON public.messages USING btree (conversation_id);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);

alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY using index "conversations_pkey";

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."conversations" add constraint "conversations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_user_id_fkey";

alter table "public"."messages" add constraint "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_conversation_id_fkey";

alter table "public"."messages" add constraint "messages_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_role_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_conversation_leaf()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update conversations set 
    current_message_leaf_id = new.id,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$function$
;

grant delete on table "public"."conversations" to "anon";

grant insert on table "public"."conversations" to "anon";

grant references on table "public"."conversations" to "anon";

grant select on table "public"."conversations" to "anon";

grant trigger on table "public"."conversations" to "anon";

grant truncate on table "public"."conversations" to "anon";

grant update on table "public"."conversations" to "anon";

grant delete on table "public"."conversations" to "authenticated";

grant insert on table "public"."conversations" to "authenticated";

grant references on table "public"."conversations" to "authenticated";

grant select on table "public"."conversations" to "authenticated";

grant trigger on table "public"."conversations" to "authenticated";

grant truncate on table "public"."conversations" to "authenticated";

grant update on table "public"."conversations" to "authenticated";

grant delete on table "public"."conversations" to "service_role";

grant insert on table "public"."conversations" to "service_role";

grant references on table "public"."conversations" to "service_role";

grant select on table "public"."conversations" to "service_role";

grant trigger on table "public"."conversations" to "service_role";

grant truncate on table "public"."conversations" to "service_role";

grant update on table "public"."conversations" to "service_role";

grant delete on table "public"."messages" to "anon";

grant insert on table "public"."messages" to "anon";

grant references on table "public"."messages" to "anon";

grant select on table "public"."messages" to "anon";

grant trigger on table "public"."messages" to "anon";

grant truncate on table "public"."messages" to "anon";

grant update on table "public"."messages" to "anon";

grant delete on table "public"."messages" to "authenticated";

grant insert on table "public"."messages" to "authenticated";

grant references on table "public"."messages" to "authenticated";

grant select on table "public"."messages" to "authenticated";

grant trigger on table "public"."messages" to "authenticated";

grant truncate on table "public"."messages" to "authenticated";

grant update on table "public"."messages" to "authenticated";

grant delete on table "public"."messages" to "service_role";

grant insert on table "public"."messages" to "service_role";

grant references on table "public"."messages" to "service_role";

grant select on table "public"."messages" to "service_role";

grant trigger on table "public"."messages" to "service_role";

grant truncate on table "public"."messages" to "service_role";

grant update on table "public"."messages" to "service_role";


  create policy "Users can manage their own conversations"
  on "public"."conversations"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can manage messages in their conversations"
  on "public"."messages"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) IN ( SELECT conversations.user_id
   FROM conversations
  WHERE (conversations.id = messages.conversation_id))));


CREATE TRIGGER update_leaf_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION update_conversation_leaf();


  create policy "Give users access to own folder images_delete"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'images'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "Give users access to own folder images_insert"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'images'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "Give users access to own folder images_select"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'images'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



  create policy "Give users access to own folder images_update"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'images'::text) AND (( SELECT (auth.uid())::text AS uid) = (storage.foldername(name))[1])));



