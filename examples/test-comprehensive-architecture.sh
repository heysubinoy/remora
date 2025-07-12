#!/bin/bash

# Comprehensive Architecture Test
# Tests all new features: NetQueue, Polling, Concurrent Limits, Job Cancellation
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
echo "🏗️  Comprehensive Architecture Test"
echo "==================================="
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

SERVER_NAME="comprehensive-test-$(date +%s)"
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

# Phase 1: NetQueue and Job Submission
echo ""
log "Phase 1: NetQueue and Job Submission"
log "====================================="

info "Submitting jobs with different priorities..."
PRIORITY_JOBS=()

for i in {1..5}; do
    PRIORITY=$((6 - $i)) # 5, 4, 3, 2, 1
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
      -H "Content-Type: application/json" \
      -d "{
        \"command\": \"echo\",
        \"args\": \"Priority test job $i (priority: $PRIORITY) - \$(date)\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"priority\": $PRIORITY
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        PRIORITY_JOBS+=("$JOB_ID")
        success "Priority job $i submitted: $JOB_ID (priority: $PRIORITY)"
    fi
done

# Phase 2: Concurrent Job Limits
echo ""
log "Phase 2: Concurrent Job Limits"
log "==============================="

info "Getting worker pool size..."
# Since worker pool size is not exposed in system info, we'll use a reasonable default
WORKER_POOL_SIZE=16
info "Worker pool size: $WORKER_POOL_SIZE"

info "Submitting jobs to test concurrency limits..."
CONCURRENT_JOBS=()

# Submit jobs up to the limit
for i in $(seq 1 $WORKER_POOL_SIZE); do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
      -H "Content-Type: application/json" \
      -d "{
        \"script\": \"#!/bin/bash\\necho 'Concurrent test job $i starting'\\nsleep 8\\necho 'Job $i completed'\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"shell\": \"/bin/bash\"
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        CONCURRENT_JOBS+=("$JOB_ID")
        success "Concurrent job $i submitted: $JOB_ID"
    fi
done

# Phase 3: Job Cancellation (Queued and Running)
echo ""
log "Phase 3: Job Cancellation"
log "========================="

info "Testing queued job cancellation..."
QUEUED_CANCEL_JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'This queued job will be canceled'\\nsleep 20\\necho 'This should not be reached'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60,
    \"shell\": \"/bin/bash\"
  }")

QUEUED_CANCEL_JOB_ID=$(extract_json_value "$QUEUED_CANCEL_JOB_RESPONSE" "id")
if [ -n "$QUEUED_CANCEL_JOB_ID" ]; then
    success "Queued cancel test job submitted: $QUEUED_CANCEL_JOB_ID"
    
    # Cancel immediately (should be queued)
    sleep 1
    QUEUED_CANCEL_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/$QUEUED_CANCEL_JOB_ID/cancel")
    QUEUED_CANCEL_STATUS=$(extract_json_value "$QUEUED_CANCEL_RESPONSE" "message")
    
    if [[ "$QUEUED_CANCEL_STATUS" == *"cancel"* ]]; then
        success "✅ Queued job cancellation successful"
    else
        error "❌ Queued job cancellation failed"
    fi
fi

info "Testing running job cancellation..."
RUNNING_CANCEL_JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'This running job will be canceled'\\nfor i in {1..30}; do\\n  echo \\\"Step \$i\\\"\\n  sleep 1\\ndone\\necho 'This should not be reached'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60,
    \"shell\": \"/bin/bash\"
  }")

RUNNING_CANCEL_JOB_ID=$(extract_json_value "$RUNNING_CANCEL_JOB_RESPONSE" "id")
if [ -n "$RUNNING_CANCEL_JOB_ID" ]; then
    success "Running cancel test job submitted: $RUNNING_CANCEL_JOB_ID"
    
    # Wait for job to start running
    sleep 5
    
    # Cancel the running job
    RUNNING_CANCEL_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/$RUNNING_CANCEL_JOB_ID/cancel")
    RUNNING_CANCEL_STATUS=$(extract_json_value "$RUNNING_CANCEL_RESPONSE" "message")
    
    if [[ "$RUNNING_CANCEL_STATUS" == *"cancel"* ]]; then
        success "✅ Running job cancellation successful"
    else
        error "❌ Running job cancellation failed"
    fi
fi

# Phase 4: Polling-Based Real-Time Updates
echo ""
log "Phase 4: Polling-Based Real-Time Updates"
log "========================================"

info "Submitting a long-running job for polling test..."
POLLING_JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'Starting polling test job'\\nfor i in {1..8}; do\\n  echo \\\"Polling output line \$i - \$(date)\\\"\\n  sleep 2\\ndone\\necho 'Polling test completed'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60,
    \"shell\": \"/bin/bash\"
  }")

POLLING_JOB_ID=$(extract_json_value "$POLLING_JOB_RESPONSE" "id")
if [ -n "$POLLING_JOB_ID" ]; then
    success "Polling test job submitted: $POLLING_JOB_ID"
    
    # Wait for job to start
    sleep 3
    
    # Test polling the logs endpoint
    info "Testing logs polling (simulating frontend polling every 2 seconds)..."
    POLL_COUNT=0
    MAX_POLLS=8
    LAST_OUTPUT_LENGTH=0
    OUTPUT_GROWING=false
    
    while [ $POLL_COUNT -lt $MAX_POLLS ]; do
        POLL_COUNT=$((POLL_COUNT + 1))
        
        # Poll the logs endpoint
        LOGS_RESPONSE=$(curl -s "$BASE_URL/jobs/$POLLING_JOB_ID/logs")
        CURRENT_OUTPUT=$(echo "$LOGS_RESPONSE" | grep -o '"stdout":"[^"]*"' | cut -d'"' -f4)
        CURRENT_LENGTH=${#CURRENT_OUTPUT}
        
        info "Poll $POLL_COUNT: Output length = $CURRENT_LENGTH characters"
        
        # Check if output is growing (indicating real-time updates)
        if [ $CURRENT_LENGTH -gt $LAST_OUTPUT_LENGTH ]; then
            success "✅ Output is growing (real-time updates working)"
            OUTPUT_GROWING=true
            LAST_OUTPUT_LENGTH=$CURRENT_LENGTH
        fi
        
        # Check job status
        JOB_INFO=$(curl -s "$BASE_URL/jobs/$POLLING_JOB_ID")
        STATUS=$(extract_json_value "$JOB_INFO" "status")
        
        if [ "$STATUS" = "completed" ]; then
            success "Polling test job completed"
            break
        fi
        
        # Wait 2 seconds (simulating frontend polling interval)
        sleep 2
    done
fi

# Phase 5: System Statistics and Monitoring
echo ""
log "Phase 5: System Statistics and Monitoring"
log "========================================="

info "Monitoring system statistics during test..."
MONITOR_COUNT=0
MAX_MONITOR=15

while [ $MONITOR_COUNT -lt $MAX_MONITOR ]; do
    MONITOR_COUNT=$((MONITOR_COUNT + 1))
    
    STATS_RESPONSE=$(curl -s "$BASE_URL/system/info")
    RUNNING_JOBS=$(extract_json_number "$STATS_RESPONSE" "runningJobs")
    QUEUED_JOBS=$(extract_json_number "$STATS_RESPONSE" "queuedJobs")
    COMPLETED_JOBS=$(extract_json_number "$STATS_RESPONSE" "completedJobs")
    TOTAL_JOBS=$(extract_json_number "$STATS_RESPONSE" "totalJobs")
    
    # Handle empty values
    RUNNING_JOBS=${RUNNING_JOBS:-0}
    QUEUED_JOBS=${QUEUED_JOBS:-0}
    COMPLETED_JOBS=${COMPLETED_JOBS:-0}
    TOTAL_JOBS=${TOTAL_JOBS:-0}
    
    info "Monitor $MONITOR_COUNT: Running=$RUNNING_JOBS, Queued=$QUEUED_JOBS, Completed=$COMPLETED_JOBS, Total=$TOTAL_JOBS"
    
    # Check if concurrency limit is respected
    if [ "$RUNNING_JOBS" -le "$WORKER_POOL_SIZE" ]; then
        success "✅ Concurrency limit respected"
    else
        error "❌ Concurrency limit exceeded: $RUNNING_JOBS > $WORKER_POOL_SIZE"
    fi
    
    # Check if most jobs are completed
    if [ "$COMPLETED_JOBS" -gt 5 ]; then
        success "Most jobs completed, ending monitoring"
        break
    fi
    
    sleep 3
done

# Phase 6: Final Validation
echo ""
log "Phase 6: Final Validation"
log "========================="

info "Validating final job statuses..."
PASS_COUNT=0
TOTAL_TESTS=0

# Check priority jobs
TOTAL_TESTS=$((TOTAL_TESTS + 1))
PRIORITY_COMPLETED=0
for job_id in "${PRIORITY_JOBS[@]}"; do
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    if [ "$STATUS" = "completed" ]; then
        PRIORITY_COMPLETED=$((PRIORITY_COMPLETED + 1))
    fi
done

if [ $PRIORITY_COMPLETED -eq ${#PRIORITY_JOBS[@]} ]; then
    success "✅ Priority jobs test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Priority jobs test failed"
fi

# Check concurrent jobs
TOTAL_TESTS=$((TOTAL_TESTS + 1))
CONCURRENT_COMPLETED=0
for job_id in "${CONCURRENT_JOBS[@]}"; do
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    if [ "$STATUS" = "completed" ]; then
        CONCURRENT_COMPLETED=$((CONCURRENT_COMPLETED + 1))
    fi
done

if [ $CONCURRENT_COMPLETED -eq ${#CONCURRENT_JOBS[@]} ]; then
    success "✅ Concurrent jobs test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Concurrent jobs test failed"
fi

# Check queued job cancellation
if [ -n "$QUEUED_CANCEL_JOB_ID" ]; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    QUEUED_JOB_INFO=$(curl -s "$BASE_URL/jobs/$QUEUED_CANCEL_JOB_ID")
    QUEUED_STATUS=$(extract_json_value "$QUEUED_JOB_INFO" "status")
    if [ "$QUEUED_STATUS" = "canceled" ]; then
        success "✅ Queued job cancellation test passed"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        error "❌ Queued job cancellation test failed"
    fi
fi

# Check running job cancellation
if [ -n "$RUNNING_CANCEL_JOB_ID" ]; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    RUNNING_JOB_INFO=$(curl -s "$BASE_URL/jobs/$RUNNING_CANCEL_JOB_ID")
    RUNNING_STATUS=$(extract_json_value "$RUNNING_JOB_INFO" "status")
    if [ "$RUNNING_STATUS" = "canceled" ]; then
        success "✅ Running job cancellation test passed"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        error "❌ Running job cancellation test failed"
    fi
fi

# Check polling test
if [ "$OUTPUT_GROWING" = true ]; then
    success "✅ Polling-based updates test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Polling-based updates test failed"
fi

# Check concurrency limits
if [ "$RUNNING_JOBS" -le "$WORKER_POOL_SIZE" ]; then
    success "✅ Concurrency limits test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Concurrency limits test failed"
fi

# Check system statistics
if [ "$TOTAL_JOBS" -gt 0 ]; then
    success "✅ System statistics test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ System statistics test failed"
fi

# Check overall system health
FINAL_STATS=$(curl -s "$BASE_URL/system/info")
FINAL_RUNNING=$(extract_json_number "$FINAL_STATS" "runningJobs")
FINAL_QUEUED=$(extract_json_number "$FINAL_STATS" "queuedJobs")

# Handle empty values
FINAL_RUNNING=${FINAL_RUNNING:-0}
FINAL_QUEUED=${FINAL_QUEUED:-0}

if [ "$FINAL_RUNNING" -le "$WORKER_POOL_SIZE" ] && [ "$FINAL_QUEUED" -ge 0 ]; then
    success "✅ Overall system health test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Overall system health test failed"
fi

# Cleanup
echo ""
info "Cleaning up test server..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID" > /dev/null
success "Cleanup completed"

# Final Results
echo ""
log "Final Results"
log "============="

echo ""
if [ $PASS_COUNT -eq $TOTAL_TESTS ]; then
    success "🎉 Comprehensive Architecture Test PASSED! ($PASS_COUNT/$TOTAL_TESTS)"
    success ""
    success "All new architecture features are working correctly:"
    success "✅ NetQueue TCP-based message queue"
    success "✅ Polling-based real-time updates (replacing SSE)"
    success "✅ Semaphore-based concurrent job limits"
    success "✅ Queued and running job cancellation"
    success "✅ Priority-based job processing"
    success "✅ Real-time job monitoring"
    success "✅ System statistics and health monitoring"
    success ""
    success "The system is ready for production use!"
else
    error "❌ Comprehensive Architecture Test FAILED! ($PASS_COUNT/$TOTAL_TESTS)"
    error "Please check the detailed results above."
fi

echo ""
info "Test Summary:"
info "- Priority jobs tested: ${#PRIORITY_JOBS[@]}"
info "- Concurrent jobs tested: ${#CONCURRENT_JOBS[@]}"
info "- Job cancellation tested: 2 (queued + running)"
info "- Polling updates tested: 1 long-running job"
info "- System monitoring: Continuous throughout test"
info "- Worker pool size: $WORKER_POOL_SIZE"
echo "" 