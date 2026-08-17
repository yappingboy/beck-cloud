# CADAM local fork patches

Patched source files for the CADAM self-host build. These four files
overlay the upstream https://github.com/Adam-CAD/CADAM checkout at
build time (see `../build-job.yaml`).

## What changed

| File | Change |
|---|---|
| `src-server-aiChat.ts` | Added `ollama-ai-provider` import, `ollama` provider in `providerFor()`, `buildChatModel()`, and `createChatProviders()`. Reads `OLLAMA_BASE_URL` env (defaults to `http://172.16.0.7:11434`). |
| `src-lib-utils.ts` | Prepended two Ollama entries to `PARAMETRIC_MODELS`: `ollama/hf.co/unsloth/Qwen3.8-27B-GGUF:Q4_K_M` and `ollama/Qwen3.6-26B-Fable:latest`. |
| `src-views-PromptView.tsx` | Default model → `ollama/hf.co/unsloth/Qwen3.8-27B-GGUF:Q4_K_M`. |
| `src-views-EditorView.tsx` | Default model → `ollama/hf.co/unsloth/Qwen3.8-27B-GGUF:Q4_K_M`; token counter pinned to 0 (billing bypassed). |

## Build flow

The Kaniko job in `../build-job.yaml` clones upstream, then:

```
cp /patches/src-server-aiChat.ts     /workspace/src/server/aiChat.ts
cp /patches/src-lib-utils.ts         /workspace/src/lib/utils.ts
cp /patches/src-views-PromptView.tsx /workspace/src/views/PromptView.tsx
cp /patches/src-views-EditorView.tsx /workspace/src/views/EditorView.tsx
cp /dockerfile/Dockerfile            /workspace/Dockerfile
cp /nginx/nginx.conf                 /workspace/deploy/nginx.conf
```

The patched `aiChat.ts` imports `ollama-ai-provider`, which upstream
does **not** have in `package.json`. The Dockerfile runs
`npm install ollama-ai-provider@latest --save --ignore-scripts` after
`npm ci` to add it before the build.

## Rebuilding

```bash
cd flux/apps/cadam

# 1. (Re)create the patches secret from this directory
kubectl create secret generic cadam-patched-files -n toolbox \
  --from-file=src-server-aiChat.ts=patches/src-server-aiChat.ts \
  --from-file=src-lib-utils.ts=patches/src-lib-utils.ts \
  --from-file=src-views-PromptView.tsx=patches/src-views-PromptView.tsx \
  --from-file=src-views-EditorView.tsx=patches/src-views-EditorView.tsx \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Re-apply the build job (idempotent on first run; delete+apply to rebuild)
kubectl apply -f build-job.yaml -n toolbox
# or:
kubectl delete job build-cadam -n toolbox --ignore-not-found
kubectl apply -f build-job.yaml -n toolbox

# 3. Wait
kubectl wait --for=condition=complete job/build-cadam -n toolbox --timeout=30m

# 4. Bump the deployment image (tag is :latest, so force a rollout)
kubectl rollout restart deployment/cadam -n cadam
```

## Full patched source

The complete patched source tree lives in the repo at `cadam-src/`
(repo root, not under flux/) for review and local dev. It's a shallow
clone of upstream with the four files above replaced, plus the
`Dockerfile` and `deploy/nginx.conf` used by the Kaniko build.

## Follow-ups (not in this commit)

- **Supabase** — the app uses Supabase Auth + Postgres for user
  accounts and conversation/message persistence. First build runs
  with placeholder VITE_SUPABASE_URL/ANON_KEY so the SPA compiles;
  sign-in will not work until a Supabase instance is deployed (or
  the auth layer is replaced with something else — e.g. an
  oauth2-proxy-backed single-user mode).
- **Ollama network policy** — cadam ns has no NetworkPolicy; the
  pod needs egress to 172.16.0.7:11434 (Ollama VM). Cluster-wide
  egress is currently open, so this works, but a per-ns policy
  should be added if the cluster tightens egress later.
