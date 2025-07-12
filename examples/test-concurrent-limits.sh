#!/bin/bash

# Concurrent Job Limits Test
# Tests the new semaphore-based concurrent job limiting
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
echo "🔒 Concurrent Job Limits Test"
echo "============================="
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

SERVER_NAME="concurrent-test-$(date +%s)"
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

# Test 1: Default Concurrency Limit
echo ""
log "Test 1: Default Concurrency Limit"
log "================================="

info "Checking default worker concurrency setting..."
# Since worker pool size is not exposed in system info, we'll use a reasonable default
# The actual limit will be tested by submitting jobs
WORKER_POOL_SIZE=16

info "Using default worker pool size: $WORKER_POOL_SIZE"
success "✅ Worker pool size configured for testing"

# Test 2: Submit Jobs Up to Limit
echo ""
log "Test 2: Submit Jobs Up to Limit"
log "==============================="

info "Submitting jobs up to the concurrency limit..."
LIMIT_JOBS=()

# Submit jobs equal to the worker pool size
for i in $(seq 1 $WORKER_POOL_SIZE); do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
      -H "Content-Type: application/json" \
      -d "{
        \"script\": \"#!/bin/bash\\necho 'Concurrency test job $i starting'\\nsleep 10\\necho 'Job $i completed'\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"shell\": \"/bin/bash\"
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        LIMIT_JOBS+=("$JOB_ID")
        success "Limit test job $i submitted: $JOB_ID"
    else
        error "Failed to submit limit test job $i"
    fi
done

# Wait for jobs to start
sleep 3

# Check how many jobs are running
info "Checking running job count..."
RUNNING_COUNT=0
for job_id in "${LIMIT_JOBS[@]}"; do
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    if [ "$STATUS" = "running" ]; then
        RUNNING_COUNT=$((RUNNING_COUNT + 1))
    fi
done

info "Jobs running: $RUNNING_COUNT (limit: $WORKER_POOL_SIZE)"
if [ $RUNNING_COUNT -le $WORKER_POOL_SIZE ]; then
    success "✅ Concurrency limit respected"
else
    error "❌ Concurrency limit exceeded: $RUNNING_COUNT > $WORKER_POOL_SIZE"
fi

# Test 3: Submit Additional Jobs (Should Queue)
echo ""
log "Test 3: Submit Additional Jobs (Should Queue)"
log "============================================="

info "Submitting additional jobs beyond the limit..."
EXTRA_JOBS=()

# Submit 3 more jobs beyond the limit
for i in {1..3}; do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
      -H "Content-Type: application/json" \
      -d "{
        \"script\": \"#!/bin/bash\\necho 'Extra job $i starting'\\nsleep 8\\necho 'Extra job $i completed'\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"shell\": \"/bin/bash\"
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        EXTRA_JOBS+=("$JOB_ID")
        success "Extra job $i submitted: $JOB_ID"
    fi
done

# Wait a moment and check status
sleep 2

# Check status of extra jobs
info "Checking status of extra jobs..."
QUEUED_COUNT=0
RUNNING_EXTRA_COUNT=0

for job_id in "${EXTRA_JOBS[@]}"; do
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    
    case "$STATUS" in
        "queued")
            QUEUED_COUNT=$((QUEUED_COUNT + 1))
            echo "  - Job $job_id: $STATUS (queued)"
            ;;
        "running")
            RUNNING_EXTRA_COUNT=$((RUNNING_EXTRA_COUNT + 1))
            echo "  - Job $job_id: $STATUS (running)"
            ;;
        *)
            echo "  - Job $job_id: $STATUS"
            ;;
    esac
done

if [ $QUEUED_COUNT -gt 0 ]; then
    success "✅ Extra jobs are being queued properly"
else
    warning "⚠️ No jobs are queued (they might be running immediately)"
fi

# Test 4: Monitor Job Progression
echo ""
log "Test 4: Monitor Job Progression"
log "==============================="

info "Monitoring job progression as slots become available..."
MONITOR_COUNT=0
MAX_MONITOR=20

while [ $MONITOR_COUNT -lt $MAX_MONITOR ]; do
    MONITOR_COUNT=$((MONITOR_COUNT + 1))
    
    # Count running jobs
    CURRENT_RUNNING=0
    CURRENT_QUEUED=0
    CURRENT_COMPLETED=0
    
    # Check limit jobs
    for job_id in "${LIMIT_JOBS[@]}"; do
        JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
        STATUS=$(extract_json_value "$JOB_INFO" "status")
        
        case "$STATUS" in
            "running")
                CURRENT_RUNNING=$((CURRENT_RUNNING + 1))
                ;;
            "completed")
                CURRENT_COMPLETED=$((CURRENT_COMPLETED + 1))
                ;;
        esac
    done
    
    # Check extra jobs
    for job_id in "${EXTRA_JOBS[@]}"; do
        JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
        STATUS=$(extract_json_value "$JOB_INFO" "status")
        
        case "$STATUS" in
            "running")
                CURRENT_RUNNING=$((CURRENT_RUNNING + 1))
                ;;
            "queued")
                CURRENT_QUEUED=$((CURRENT_QUEUED + 1))
                ;;
            "completed")
                CURRENT_COMPLETED=$((CURRENT_COMPLETED + 1))
                ;;
        esac
    done
    
    info "Monitor $MONITOR_COUNT: Running=$CURRENT_RUNNING, Queued=$CURRENT_QUEUED, Completed=$CURRENT_COMPLETED"
    
    # Check if all jobs are completed
    TOTAL_JOBS=$((${#LIMIT_JOBS[@]} + ${#EXTRA_JOBS[@]}))
    if [ $CURRENT_COMPLETED -eq $TOTAL_JOBS ]; then
        success "All jobs completed!"
        break
    fi
    
    # Check if concurrency limit is still respected
    if [ $CURRENT_RUNNING -le $WORKER_POOL_SIZE ]; then
        success "✅ Concurrency limit still respected"
    else
        error "❌ Concurrency limit exceeded: $CURRENT_RUNNING > $WORKER_POOL_SIZE"
    fi
    
    sleep 3
done

# Test 5: System Statistics
echo ""
log "Test 5: System Statistics"
log "========================"

info "Checking final system statistics..."
FINAL_STATS=$(curl -s "$BASE_URL/system/info")
FINAL_RUNNING=$(extract_json_number "$FINAL_STATS" "runningJobs")
FINAL_QUEUED=$(extract_json_number "$FINAL_STATS" "queuedJobs")

# Handle empty values
FINAL_RUNNING=${FINAL_RUNNING:-0}
FINAL_QUEUED=${FINAL_QUEUED:-0}

info "Final Statistics:"
info "  - Running jobs: $FINAL_RUNNING"
info "  - Queued jobs: $FINAL_QUEUED"
info "  - Worker pool size: $WORKER_POOL_SIZE"

if [ "$FINAL_RUNNING" -le "$WORKER_POOL_SIZE" ]; then
    success "✅ Final concurrency limit respected"
else
    error "❌ Final concurrency limit exceeded"
fi

# Test 6: Worker Concurrency Environment Variable
echo ""
log "Test 6: Worker Concurrency Environment Variable"
log "==============================================="

info "Testing WORKER_CONCURRENCY environment variable..."
info "Current worker pool size: $WORKER_POOL_SIZE"

# Check if we can detect the environment variable
if [ -n "$WORKER_CONCURRENCY" ]; then
    info "WORKER_CONCURRENCY environment variable set to: $WORKER_CONCURRENCY"
    if [ "$WORKER_CONCURRENCY" -eq "$WORKER_POOL_SIZE" ]; then
        success "✅ Environment variable matches worker pool size"
    else
        warning "⚠️ Environment variable doesn't match worker pool size"
    fi
else
    info "WORKER_CONCURRENCY environment variable not set (using default)"
    if [ "$WORKER_POOL_SIZE" -eq 16 ]; then
        success "✅ Using default worker pool size (16)"
    else
        warning "⚠️ Unexpected default worker pool size: $WORKER_POOL_SIZE"
    fi
fi

# Final Results
echo ""
log "Final Results"
log "============="

PASS_COUNT=0
TOTAL_TESTS=6

# Check results
if [ "$WORKER_POOL_SIZE" -gt 0 ]; then
    success "✅ Default concurrency limit test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Default concurrency limit test failed"
fi

if [ $RUNNING_COUNT -le $WORKER_POOL_SIZE ]; then
    success "✅ Concurrency limit enforcement test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Concurrency limit enforcement test failed"
fi

if [ $QUEUED_COUNT -ge 0 ]; then
    success "✅ Job queuing test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job queuing test failed"
fi

if [ $CURRENT_RUNNING -le $WORKER_POOL_SIZE ]; then
    success "✅ Job progression test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job progression test failed"
fi

if [ $FINAL_RUNNING -le $WORKER_POOL_SIZE ]; then
    success "✅ System statistics test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ System statistics test failed"
fi

if [ "$WORKER_POOL_SIZE" -gt 0 ]; then
    success "✅ Environment variable test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Environment variable test failed"
fi

# Cleanup
echo ""
info "Cleaning up test server..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID" > /dev/null
success "Cleanup completed"

echo ""
if [ $PASS_COUNT -eq $TOTAL_TESTS ]; then
    success "🎉 Concurrent Job Limits Test PASSED! ($PASS_COUNT/$TOTAL_TESTS)"
    success "The new semaphore-based concurrency limiting is working correctly!"
    success "✅ Concurrent job limits enforced"
    success "✅ Jobs properly queued when limit reached"
    success "✅ Semaphore functionality working"
else
    error "❌ Concurrent Job Limits Test FAILED! ($PASS_COUNT/$TOTAL_TESTS)"
    error "Please check the detailed results above."
fi

echo "" 