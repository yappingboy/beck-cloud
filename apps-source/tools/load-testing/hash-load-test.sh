#!/bin/bash
# Hash Service Load Test — 1000 req/sec
# Usage: ./hash-load-test.sh [base_url]
# Requires: curl, pv (for rate control)

BASE_URL="${1:-https://hash.tools.becklab.cloud}"
DURATION="${2:-30}"  # seconds

echo "=== Hash Service Load Test ==="
echo "Target: $BASE_URL/api/v1/hash"
echo "Rate: 1000 req/sec for ${DURATION}s"
echo "Total requests: $((1000 * DURATION))"
echo ""

# Test payload
PAYLOAD='{"algo":"sha256","input":"loadtest"}'

# Run with curl in parallel batches
BATCH_SIZE=100
BATCHES_PER_SEC=10

SUCCESS=0
FAILURES=0
TOTAL=0
START=$(date +%s%N)

for sec in $(seq 1 $DURATION); do
    PIDS=()
    for batch in $(seq 1 $BATCHES_PER_SEC); do
        (
            for i in $(seq 1 $BATCH_SIZE); do
                HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                    -X POST "$BASE_URL/api/v1/hash" \
                    -H "Content-Type: application/json" \
                    -d "$PAYLOAD" 2>/dev/null)
                if [ "$HTTP_CODE" = "200" ]; then
                    echo "OK"
                else
                    echo "FAIL:$HTTP_CODE"
                fi
            done
        ) >> /tmp/hash-load-test-results.txt &
        PIDS+=($!)
    done
    # Wait for all batches in this second
    for pid in "${PIDS[@]}"; do
        wait $pid
    done
    echo "Second $sec/$DURATION complete"
done

END=$(date +%s%N)
ELAPSED=$(( (END - START) / 1000000 ))

if [ -f /tmp/hash-load-test-results.txt ]; then
    SUCCESS=$(grep -c "^OK$" /tmp/hash-load-test-results.txt || echo 0)
    FAILURES=$(grep -c "^FAIL" /tmp/hash-load-test-results.txt || echo 0)
    TOTAL=$((SUCCESS + FAILURES))
    rm /tmp/hash-load-test-results.txt
fi

echo ""
echo "=== Results ==="
echo "Duration: ${ELAPSED}ms"
echo "Total requests: $TOTAL"
echo "Successful: $SUCCESS"
echo "Failed: $FAILURES"
if [ "$TOTAL" -gt 0 ]; then
    echo "Success rate: $((SUCCESS * 100 / TOTAL))%"
    echo "Throughput: $((TOTAL * 1000 / ELAPSED)) req/sec"
fi
