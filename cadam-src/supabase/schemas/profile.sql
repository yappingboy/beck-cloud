CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "notifications_enabled" boolean DEFAULT false NOT NULL,
    "avatar_path" "text" DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON "public"."profiles" USING btree (id);

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY USING INDEX "profiles_pkey";

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

ALTER TABLE "public"."profiles" VALIDATE CONSTRAINT "profiles_user_id_fkey";

CREATE POLICY "Users can manage their own profile" ON "public"."profiles" USING ( (SELECT "auth"."uid"()) = "user_id" );

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;