-- Idempotent enum types. PostgreSQL has no CREATE TYPE IF NOT EXISTS,
-- so each type is created via a DO block guarded by pg_type.

BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation-type') THEN
    CREATE TYPE "public"."conversation-type" AS ENUM ('parametric', 'creative');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation-status') THEN
    CREATE TYPE "public"."generation-status" AS ENUM ('pending', 'success', 'failure');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mesh_model_type') THEN
    CREATE TYPE "public"."mesh_model_type" AS ENUM ('quality', 'fast');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mesh_file_type') THEN
    CREATE TYPE "public"."mesh_file_type" AS ENUM ('glb', 'stl', 'obj', 'fbx');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_type') THEN
    CREATE TYPE "public"."privacy_type" AS ENUM ('public', 'private');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_type') THEN
    CREATE TYPE "public"."prompt_type" AS ENUM ('mesh', 'image', 'chat');
  END IF;
END
$$;
COMMIT;
