# Memory Search Recovery Runbook

Restores semantic memory recall when the index reports "Vector search: paused".

## Architecture (2026-09-10)

- Embedding server: `llama-server` (from `llama-cpp/llama-server` pod, unsloth image) serving
  `/workspace/embed/nomic-embed-text-v1.5.Q4_K_M.gguf`, alias `nomic-embed-text`, port 36300 in-pod.
- Exposed via NodePort Service `llama-cpp/embeddings-service` → `http://172.16.0.20:31001/v1`.
- OpenClaw config: `memory.search.provider=openai-compatible`,
  `memory.search.model=nomic-embed-text`,
  `memory.search.remote.baseUrl=http://172.16.0.20:31001/v1`.
- **Required server flags:** `--embeddings --ctx-size 8192 -b 8192 -ub 2048`.
  `-ub` (physical ubatch) must exceed the largest chunk OpenClaw embeds (~600 tokens).
  The default 512 causes HTTP 500 "input is too large to process" during reindex.

## Recovery procedure

1. Check status: `openclaw memory status --agent main` (ignore brave plugin config warning).
2. Probe embeddings:
   `curl -s http://172.16.0.20:31001/v1/models` — expect `nomic-embed-text`.
3. If down, relaunch inside the pod (the model file persists on PVC `/workspace/embed/`). Re-download it if lost:
   ```bash
   POD=$(kubectl get pod -n llama-cpp -l app=llama-server -o jsonpath='{.items[0].metadata.name}')
   kubectl exec -n llama-cpp $POD -- sh -c 'setsid nohup /opt/unsloth-studio/llama.cpp/llama-server \
     -m /workspace/embed/nomic-embed-text-v1.5.Q4_K_M.gguf --embeddings \
     --port 36300 --host 0.0.0.0 --alias nomic-embed-text \
     --ctx-size 8192 -b 8192 -ub 2048 > /workspace/embed/server.log 2>&1 < /dev/null &'
   ```
   Re-download model if missing:
   `/opt/unsloth-venv/bin/hf download nomic-ai/nomic-embed-text-v1.5-GGUF nomic-embed-text-v1.5.Q4_K_M.gguf --local-dir /workspace/embed`
4. Long-input proof (must succeed, ~560 tokens):
   ```bash
   python3 -c "import json,urllib.request; t='memory test sentence. '*140; r=urllib.request.Request('http://172.16.0.20:31001/v1/embeddings', data=json.dumps({'model':'nomic-embed-text','input':t}).encode(), headers={'Content-Type':'application/json'}); print(len(json.load(urllib.request.urlopen(r,timeout=30))['data'][0]['embedding']))"
   ```
5. Clear stale reindex lock if present (zero-byte file, no holder process): the lock is
   `~/.openclaw/agents/main/agent/openclaw-agent.sqlite.reindex-lock.sqlite`. `openclaw memory status --fix` may clear it. Else remove the file manually after you confirm no reindex is active.
6. Rebuild: `openclaw memory status --index --agent main`. Expect
   `Semantic vectors: ready`, `Dirty: no`.
7. Verify semantics (query with no keyword overlap must hit the Sep 9 MinIO outage):
   `memory_search "backup storage drive went offline causing failures"` → MEMORY.md#L44 at score ~0.79.

## Gotchas

- The NodePort Service targets pod port 36300, but nothing auto-starts the embedding server.
  A pod restart kills it until the deployment bakes in an auto-launch (TODO: sidecar or command wrapper).
- `--embd-batch-size` does not exist in this llama.cpp build. Use `-ub/--ubatch-size`.
- pkill inside `kubectl exec sh -c` also kills the relaunch started in the same shell — kill and launch in separate execs.
- The old ollama-based index (provider=ollama, nomic-embed-text) was superseded 2026-09-10. The embedding cache is provider-keyed, so the first rebuild re-embedded everything (~7k chunks).
