CREATE TYPE IF NOT EXISTS "public"."conversation-type" AS ENUM (
    'parametric',
    'creative'
);

CREATE TYPE IF NOT EXISTS "public"."generation-status" AS ENUM (
    'pending',
    'success',
    'failure'
);

CREATE TYPE IF NOT EXISTS "public"."mesh_model_type" AS ENUM (
    'quality',
    'fast'
);

CREATE TYPE IF NOT EXISTS "public"."mesh_file_type" AS ENUM (
    'glb',
    'stl',
    'obj',
    'fbx'
);

CREATE TYPE IF NOT EXISTS "public"."privacy_type" AS ENUM (
    'public',
    'private'
);

CREATE TYPE IF NOT EXISTS "public"."prompt_type" AS ENUM (
    'mesh',
    'image',
    'chat'
);

