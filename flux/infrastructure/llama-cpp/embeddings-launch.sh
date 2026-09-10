#!/bin/sh
# Auto-start the memory-search embedding server alongside unsloth studio.
# OpenClaw memory.search points at NodePort 31001 -> pod :36300 (see
# docs/runbooks/memory-search-recovery.md for flags/gotchas).
MODEL=/workspace/embed/nomic-embed-text-v1.5.Q4_K_M.gguf
LOG=/workspace/embed/server.log

# One-time model fetch if missing (~840MB, Q4_K_M).
if [ ! -f "$MODEL" ]; then
  /opt/unsloth-venv/bin/hf download nomic-ai/nomic-embed-text-v1.5-GGUF \
    nomic-embed-text-v1.5.Q4_K_M.gguf --local-dir /workspace/embed >>"$LOG" 2>&1
fi

# Keep it up; restart every 5s if it dies.
while true; do
  /opt/unsloth-studio/llama.cpp/llama-server \
    -m "$MODEL" --embeddings \
    --port 36300 --host 0.0.0.0 --alias nomic-embed-text \
    --ctx-size 8192 -b 8192 -ub 2048 >>"$LOG" 2>&1
  sleep 5
done
