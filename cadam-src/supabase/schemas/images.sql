CREATE TABLE IF NOT EXISTS "public"."images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."generation-status" DEFAULT 'pending'::"public"."generation-status" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "image_generation_call_id" "text",
    "prompt" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS images_pkey ON "public"."images" USING btree (id);

ALTER TABLE "public"."images" ADD CONSTRAINT "images_pkey" PRIMARY KEY USING INDEX "images_pkey";

ALTER TABLE "public"."images" ADD CONSTRAINT "images_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

ALTER TABLE "public"."images" VALIDATE CONSTRAINT "images_conversation_id_fkey";

ALTER TABLE "public"."images" ADD CONSTRAINT "images_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

ALTER TABLE "public"."images" VALIDATE CONSTRAINT "images_user_id_fkey";


CREATE INDEX IF NOT EXISTS idx_images_image_generation_call_id ON "public"."images" USING "btree" ("image_generation_call_id");


CREATE POLICY "Public conversations images" ON "public"."images" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "images"."conversation_id") AND ("conversations"."privacy" = 'public'::"public"."privacy_type")))));

CREATE POLICY "User can manage their data" ON "public"."images" TO "authenticated" USING ((( SELECT "auth"."uid"()) = "user_id")) WITH CHECK ((( SELECT "auth"."uid"()) = "user_id"));

ALTER TABLE "public"."images" ENABLE ROW LEVEL SECURITY;
