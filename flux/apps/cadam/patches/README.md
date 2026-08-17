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

## Rebuilding

```bash
# From the repo root:
kubectl create secret generic cadam-patched-files -n toolbox \
  --from-file=src-server-aiChat.ts=flux/apps/cadam/patches/src-server-aiChat.ts \
  --from-file=src-lib-utils.ts=flux/apps/cadam/patches/src-lib-utils.ts \
  --from-file=src-views-PromptView.tsx=flux/apps/cadam/patches/src-views-PromptView.tsx \
  --from-file=src-views-EditorView.tsx=flux/apps/cadam/patches/src-views-EditorView.tsx \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f flux/apps/cadam/build-job.yaml -n toolbox
kubectl wait --for=condition=complete job/build-cadam -n toolbox --timeout=30m
```

## Full patched source

The complete patched source tree also lives in the repo at
`cadam-src/` for review and local dev. It's a shallow clone of upstream
with the four files above replaced.
