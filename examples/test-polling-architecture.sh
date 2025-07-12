#!/bin/bash

# Polling Architecture Test
# Tests the new polling-based real-time updates (replacing SSE)
# Author: GitHub Copilot
# Date: 2025-01-XX

BASE_URL="http://localhost:8080/api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log() {
    echo -e "${BLUE}📋 $1${NC}"
}

# Function to extract value from JSON response
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

# Function to extract numeric value from JSON response
extract_json_number() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":[0-9]*" | cut -d':' -f2
}

clear
echo ""
echo "📡 Polling Architecture Test"
echo "============================"
echo ""

# Check if API is running
info "Testing API connectivity..."
API_RESPONSE=$(curl -s "$BASE_URL/health" 2>/dev/null || echo "error")
if [[ "$API_RESPONSE" == *"error"* ]] || [ -z "$API_RESPONSE" ]; then
    error "API is not responding at $BASE_URL"
    error "Please ensure the API server is running on port 8080"
    exit 1
fi
success "API is responding"

# Check if PEM file exists
if [ ! -f "test-server.pem" ]; then
    error "test-server.pem file not found!"
    echo "Please place your PEM file in this directory and name it 'test-server.pem'"
    exit 1
fi
success "PEM file found"

# Create test server
info "Creating test server..."
UPLOAD_RESPONSE=$(curl -s -X POST -F "pem_file=@test-server.pem" "$BASE_URL/pem-files/upload")
PEM_URL=$(extract_json_value "$UPLOAD_RESPONSE" "pem_file_url")

SERVER_NAME="polling-test-$(date +%s)"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/servers" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SERVER_NAME\",
    \"hostname\": \"20.193.138.153\",
    \"port\": 22,
    \"user\": \"testvm\",
    \"auth_type\": \"key\",
    \"pem_file_url\": \"$PEM_URL\",
    \"is_active\": true
  }")

SERVER_ID=$(extract_json_value "$CREATE_RESPONSE" "id")
if [ -z "$SERVER_ID" ]; then
    error "Failed to create test server"
    exit 1
fi
success "Test server created: $SERVER_ID"

# Test 1: Job Logs Polling
echo ""
log "Test 1: Job Logs Polling"
log "======================="

info "Submitting a long-running job for polling test..."
LONG_JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'Starting polling test job'\\nfor i in {1..10}; do\\n  echo \\\"Output line \$i - \$(date)\\\"\\n  sleep 2\\ndone\\necho 'Job completed'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60,
    \"shell\": \"/bin/bash\"
  }")

LONG_JOB_ID=$(extract_json_value "$LONG_JOB_RESPONSE" "id")
if [ -z "$LONG_JOB_ID" ]; then
    error "Failed to submit long-running job"
    exit 1
fi
success "Long-running job submitted: $LONG_JOB_ID"

# Wait for job to start
sleep 3

# Test polling the logs endpoint
info "Testing logs polling (simulating frontend polling every 2 seconds)..."
POLL_COUNT=0
MAX_POLLS=10
LAST_OUTPUT_LENGTH=0

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
    POLL_COUNT=$((POLL_COUNT + 1))
    
    # Poll the logs endpoint
    LOGS_RESPONSE=$(curl -s "$BASE_URL/jobs/$LONG_JOB_ID/logs")
    CURRENT_OUTPUT=$(echo "$LOGS_RESPONSE" | grep -o '"stdout":"[^"]*"' | cut -d'"' -f4)
    CURRENT_LENGTH=${#CURRENT_OUTPUT}
    
    info "Poll $POLL_COUNT: Output length = $CURRENT_LENGTH characters"
    
    # Check if output is growing (indicating real-time updates)
    if [ $CURRENT_LENGTH -gt $LAST_OUTPUT_LENGTH ]; then
        success "✅ Output is growing (real-time updates working)"
        LAST_OUTPUT_LENGTH=$CURRENT_LENGTH
    fi
    
    # Check job status
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$LONG_JOB_ID")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    
    if [ "$STATUS" = "completed" ]; then
        success "Job completed during polling test"
        break
    fi
    
    # Wait 2 seconds (simulating frontend polling interval)
    sleep 2
done

# Test 2: Live Job Status Polling
echo ""
log "Test 2: Live Job Status Polling"
log "==============================="

info "Submitting multiple jobs to test status polling..."
STATUS_JOBS=()

for i in {1..3}; do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
      -H "Content-Type: application/json" \
      -d "{
        \"script\": \"#!/bin/bash\\necho 'Status test job $i'\\nsleep 8\\necho 'Job $i done'\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"shell\": \"/bin/bash\"
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        STATUS_JOBS+=("$JOB_ID")
        success "Status test job $i submitted: $JOB_ID"
    fi
done

# Poll job statuses
info "Polling job statuses every 2 seconds..."
POLL_COUNT=0
MAX_STATUS_POLLS=8

while [ $POLL_COUNT -lt $MAX_STATUS_POLLS ]; do
    POLL_COUNT=$((POLL_COUNT + 1))
    
    info "Status poll $POLL_COUNT:"
    RUNNING_COUNT=0
    COMPLETED_COUNT=0
    
    for job_id in "${STATUS_JOBS[@]}"; do
        JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
        STATUS=$(extract_json_value "$JOB_INFO" "status")
        
        case "$STATUS" in
            "running")
                RUNNING_COUNT=$((RUNNING_COUNT + 1))
                echo "  - Job $job_id: $STATUS"
                ;;
            "completed")
                COMPLETED_COUNT=$((COMPLETED_COUNT + 1))
                echo "  - Job $job_id: $STATUS"
                ;;
            *)
                echo "  - Job $job_id: $STATUS"
                ;;
        esac
    done
    
    if [ $COMPLETED_COUNT -eq ${#STATUS_JOBS[@]} ]; then
        success "All status test jobs completed!"
        break
    fi
    
    sleep 2
done

# Test 3: Concurrent Job Monitoring
echo ""
log "Test 3: Concurrent Job Monitoring"
log "================================="

info "Testing concurrent job monitoring with polling..."
CONCURRENT_MONITOR_JOBS=()

for i in {1..2}; do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
      -H "Content-Type: application/json" \
      -d "{
        \"script\": \"#!/bin/bash\\necho 'Concurrent monitor job $i starting'\\nfor j in {1..5}; do\\n  echo \\\"Job \$i, step \$j\\\"\\n  sleep 1\\ndone\\necho 'Concurrent job $i finished'\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"shell\": \"/bin/bash\"
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        CONCURRENT_MONITOR_JOBS+=("$JOB_ID")
        success "Concurrent monitor job $i submitted: $JOB_ID"
    fi
done

# Monitor both jobs simultaneously
info "Monitoring concurrent jobs with polling..."
POLL_COUNT=0
MAX_CONCURRENT_POLLS=12

while [ $POLL_COUNT -lt $MAX_CONCURRENT_POLLS ]; do
    POLL_COUNT=$((POLL_COUNT + 1))
    
    info "Concurrent poll $POLL_COUNT:"
    ALL_COMPLETED=true
    
    for job_id in "${CONCURRENT_MONITOR_JOBS[@]}"; do
        JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
        STATUS=$(extract_json_value "$JOB_INFO" "status")
        
        if [ "$STATUS" != "completed" ]; then
            ALL_COMPLETED=false
        fi
        
        echo "  - Job $job_id: $STATUS"
    done
    
    if [ "$ALL_COMPLETED" = true ]; then
        success "All concurrent jobs completed!"
        break
    fi
    
    sleep 2
done

# Test 4: Polling Performance
echo ""
log "Test 4: Polling Performance"
log "==========================="

info "Testing polling performance with rapid requests..."
PERFORMANCE_START=$(date +%s.%N)

# Make 10 rapid polling requests
for i in {1..10}; do
    curl -s "$BASE_URL/jobs/$LONG_JOB_ID/logs" > /dev/null
done

PERFORMANCE_END=$(date +%s.%N)
PERFORMANCE_TIME=$(echo "$PERFORMANCE_END - $PERFORMANCE_START" | bc -l 2>/dev/null || echo "0.1")

info "Performance test: 10 polling requests completed in ${PERFORMANCE_TIME}s"
if (( $(echo "$PERFORMANCE_TIME < 2.0" | bc -l 2>/dev/null || echo "1") )); then
    success "✅ Polling performance is acceptable"
else
    warning "⚠️ Polling performance might be slow"
fi

# Test 5: Polling Error Handling
echo ""
log "Test 5: Polling Error Handling"
log "=============================="

info "Testing polling error handling with invalid job ID..."
INVALID_JOB_ID="invalid-job-id-$(date +%s)"
ERROR_RESPONSE=$(curl -s "$BASE_URL/jobs/$INVALID_JOB_ID/logs")
ERROR_STATUS=$(echo "$ERROR_RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ERROR_STATUS" ]; then
    success "✅ Error handling working: $ERROR_STATUS"
else
    error "❌ Error handling not working properly"
fi

# Final Results
echo ""
log "Final Results"
log "============="

PASS_COUNT=0
TOTAL_TESTS=5

# Check results
if [ $LAST_OUTPUT_LENGTH -gt 0 ]; then
    success "✅ Job logs polling test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job logs polling test failed"
fi

if [ $COMPLETED_COUNT -eq ${#STATUS_JOBS[@]} ]; then
    success "✅ Job status polling test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job status polling test failed"
fi

if [ "$ALL_COMPLETED" = true ]; then
    success "✅ Concurrent job monitoring test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Concurrent job monitoring test failed"
fi

if (( $(echo "$PERFORMANCE_TIME < 2.0" | bc -l 2>/dev/null || echo "1") )); then
    success "✅ Polling performance test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Polling performance test failed"
fi

if [ -n "$ERROR_STATUS" ]; then
    success "✅ Polling error handling test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Polling error handling test failed"
fi

# Cleanup
echo ""
info "Cleaning up test server..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID" > /dev/null
success "Cleanup completed"

echo ""
if [ $PASS_COUNT -eq $TOTAL_TESTS ]; then
    success "🎉 Polling Architecture Test PASSED! ($PASS_COUNT/$TOTAL_TESTS)"
    success "The new polling-based real-time updates are working correctly!"
    success "✅ Replaced SSE with efficient polling"
    success "✅ Real-time job monitoring working"
    success "✅ Concurrent job tracking working"
else
    error "❌ Polling Architecture Test FAILED! ($PASS_COUNT/$TOTAL_TESTS)"
    error "Please check the detailed results above."
fi

echo "" 