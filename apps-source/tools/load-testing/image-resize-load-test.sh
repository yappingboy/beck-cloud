#!/bin/bash
# Image Resize Load Test — 10 concurrent connections
# Usage: ./image-resize-load-test.sh [base_url]

BASE_URL="${1:-https://editor.tools.becklab.cloud}"
TOTAL_REQUESTS="${2:-100}"
CONCURRENCY=10

echo "=== Image Editor Load Test ==="
echo "Target: $BASE_URL/api/v1/editor/save"
echo "Concurrent connections: $CONCURRENCY"
echo "Total requests: $TOTAL_REQUESTS"
echo ""

# Small 1x1 PNG base64
SAMPLE_IMG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

RESULTS_FILE="/tmp/image-load-test-results.txt"
> "$RESULTS_FILE"

run_batch() {
    for i in $(seq 1 $1); do
        START_T=$(date +%s%N)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$BASE_URL/api/v1/editor/save" \
            -H "Content-Type: application/json" \
            -d "{\"data\":\"$SAMPLE_IMG\",\"filename\":\"test_$i.png\"}" 2>/dev/null)
        END_T=$(date +%s%N)
        LATENCY=$(( (END_T - START_T) / 1000 ))
        echo "${HTTP_CODE} ${LATENCY}" >> "$RESULTS_FILE"
    done
}

START=$(date +%s%N)

for batch in $(seq 1 $((TOTAL_REQUESTS / CONCURRENCY))); do
    PIDS=()
    for c in $(seq 1 $CONCURRENCY); do
        run_batch 1 &
        PIDS+=($!)
    done
    for pid in "${PIDS[@]}"; do
        wait $pid
    done
done

END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))

echo ""
echo "=== Results ==="
echo "Duration: ${ELAPSED}ms"
SUCCESS=$(awk '$1==200' "$RESULTS_FILE" | wc -l)
FAILURES=$(awk '$1!=200' "$RESULTS_FILE" | wc -l)
AVG_LATENCY=$(awk '{sum+=$2} END {print int(sum/NR)}' "$RESULTS_FILE")
P99_LATENCY=$(awk '{print $2}' "$RESULTS_FILE" | sort -n | awk -v n="$(wc -l < "$RESULTS_FILE")" 'NR==int(n*0.99){print}')

echo "Successful: $SUCCESS"
echo "Failed: $FAILURES"
echo "Avg latency: ${AVG_LATENCY}μs"
echo "P99 latency: ${P99_LATENCY}μs"
echo "Throughput: $((TOTAL_REQUESTS * 1000 / ELAPSED)) req/sec"

rm "$RESULTS_FILE"
