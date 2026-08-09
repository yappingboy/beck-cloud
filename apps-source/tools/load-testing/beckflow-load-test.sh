#!/bin/bash
# BeckFlow Load Test — 50 concurrent connections
# Usage: ./beckflow-load-test.sh [base_url]

BASE_URL="${1:-https://dashboard.tools.becklab.cloud}"
TOTAL_REQUESTS="${2:-200}"
CONCURRENCY=50

echo "=== BeckFlow Load Test ==="
echo "Target: $BASE_URL/api/v1/status"
echo "Concurrent connections: $CONCURRENCY"
echo "Total requests: $TOTAL_REQUESTS"
echo ""

RESULTS_FILE="/tmp/beckflow-load-test-results.txt"
> "$RESULTS_FILE"

run_request() {
    START_T=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        "$BASE_URL/api/v1/status" 2>/dev/null)
    END_T=$(date +%s%N)
    LATENCY=$(( (END_T - START_T) / 1000 ))
    echo "${HTTP_CODE} ${LATENCY}" >> "$RESULTS_FILE"
}

START=$(date +%s%N)

for batch in $(seq 1 $((TOTAL_REQUESTS / CONCURRENCY + 1))); do
    PIDS=()
    for c in $(seq 1 $CONCURRENCY); do
        run_request &
        PIDS+=($!)
    done
    for pid in "${PIDS[@]}"; do
        wait $pid
    done
    if [ $batch -ge $((TOTAL_REQUESTS / CONCURRENCY + 1)) ]; then
        break
    fi
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
echo "Throughput: $((SUCCESS * 1000 / ELAPSED)) req/sec"

rm "$RESULTS_FILE"
