CREATE TYPE "public"."conversation-type" AS ENUM (
    'parametric',
    'creative'
);

CREATE TYPE "public"."generation-status" AS ENUM (
    'pending',
    'success',
    'failure'
);

CREATE TYPE "public"."mesh_model_type" AS ENUM (
    'quality',
    'fast'
);

CREATE TYPE "public"."mesh_file_type" AS ENUM (
    'glb',
    'stl',
    'obj',
    'fbx'
);

CREATE TYPE "public"."privacy_type" AS ENUM (
    'public',
    'private'
);

CREATE TYPE "public"."prompt_type" AS ENUM (
    'mesh',
    'image',
    'chat'
);

