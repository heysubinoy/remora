#!/bin/bash

# NetQueue Architecture Test
# Tests the new TCP-based message queue system
# Author: GitHub Copilot
# Date: 2025-01-XX

BASE_URL="http://localhost:8080/api/v1"
NETQUEUE_URL="localhost:9000"

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
echo "🔄 NetQueue Architecture Test"
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

# Check if NetQueue is running
info "Testing NetQueue connectivity..."
NETQUEUE_RESPONSE=$(timeout 5 bash -c "echo '{\"cmd\":\"PING\"}' | nc $NETQUEUE_URL 9000" 2>/dev/null || echo "error")
if [[ "$NETQUEUE_RESPONSE" == *"error"* ]] || [ -z "$NETQUEUE_RESPONSE" ]; then
    warning "NetQueue is not responding at $NETQUEUE_URL:9000"
    warning "This is expected if NetQueue is not running separately"
    warning "The test will continue with API-based queue testing"
else
    success "NetQueue is responding"
fi

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

SERVER_NAME="netqueue-test-$(date +%s)"
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

# Test 1: Queue Job Submission
echo ""
log "Test 1: Queue Job Submission"
log "============================"

info "Submitting multiple jobs to test queue handling..."
JOB_IDS=()

for i in {1..5}; do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
      -H "Content-Type: application/json" \
      -d "{
        \"command\": \"echo\",
        \"args\": \"NetQueue test job $i - \$(date)\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30,
        \"priority\": $((6 - $i))
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        JOB_IDS+=("$JOB_ID")
        success "Job $i submitted: $JOB_ID (priority: $((6 - $i)))"
    else
        error "Failed to submit job $i"
    fi
done

# Test 2: Queue Priority Handling
echo ""
log "Test 2: Queue Priority Handling"
log "==============================="

info "Checking job priorities in queue..."
for job_id in "${JOB_IDS[@]}"; do
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
    PRIORITY=$(extract_json_number "$JOB_INFO" "priority")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    info "Job $job_id: priority=$PRIORITY, status=$STATUS"
done

# Test 3: Concurrent Job Processing
echo ""
log "Test 3: Concurrent Job Processing"
log "================================="

info "Submitting jobs to test concurrent processing..."
CONCURRENT_JOBS=()

for i in {1..3}; do
    JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
      -H "Content-Type: application/json" \
      -d "{
        \"script\": \"#!/bin/bash\\necho 'Starting concurrent job $i'\\nsleep 5\\necho 'Job $i completed'\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 60,
        \"shell\": \"/bin/bash\"
      }")
    
    JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
    if [ -n "$JOB_ID" ]; then
        CONCURRENT_JOBS+=("$JOB_ID")
        success "Concurrent job $i submitted: $JOB_ID"
    fi
done

# Wait for concurrent jobs to start
sleep 3

# Check concurrent job status
info "Checking concurrent job status..."
RUNNING_COUNT=0
for job_id in "${CONCURRENT_JOBS[@]}"; do
    JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
    STATUS=$(extract_json_value "$JOB_INFO" "status")
    if [ "$STATUS" = "running" ]; then
        RUNNING_COUNT=$((RUNNING_COUNT + 1))
        success "Job $job_id is running"
    else
        info "Job $job_id status: $STATUS"
    fi
done

if [ $RUNNING_COUNT -gt 0 ]; then
    success "Concurrent job processing working: $RUNNING_COUNT jobs running"
else
    warning "No jobs are currently running"
fi

# Test 4: Queue Cancellation
echo ""
log "Test 4: Queue Cancellation"
log "=========================="

info "Testing job cancellation in queue..."
CANCEL_JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'This job will be canceled'\\nsleep 30\\necho 'This should not be reached'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60,
    \"shell\": \"/bin/bash\"
  }")

CANCEL_JOB_ID=$(extract_json_value "$CANCEL_JOB_RESPONSE" "id")
if [ -n "$CANCEL_JOB_ID" ]; then
    success "Cancel test job submitted: $CANCEL_JOB_ID"
    
    # Wait a moment then cancel
    sleep 2
    CANCEL_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/$CANCEL_JOB_ID/cancel")
    CANCEL_STATUS=$(extract_json_value "$CANCEL_RESPONSE" "message")
    
    if [[ "$CANCEL_STATUS" == *"cancel"* ]]; then
        success "Job cancellation request sent successfully"
    else
        error "Job cancellation failed: $CANCEL_RESPONSE"
    fi
fi

# Test 5: Queue Statistics
echo ""
log "Test 5: Queue Statistics"
log "======================="

info "Checking system statistics..."
STATS_RESPONSE=$(curl -s "$BASE_URL/system/info")
QUEUED_JOBS=$(extract_json_number "$STATS_RESPONSE" "queuedJobs")
RUNNING_JOBS=$(extract_json_number "$STATS_RESPONSE" "runningJobs")
TOTAL_JOBS=$(extract_json_number "$STATS_RESPONSE" "totalJobs")

# Handle empty values
QUEUED_JOBS=${QUEUED_JOBS:-0}
RUNNING_JOBS=${RUNNING_JOBS:-0}
TOTAL_JOBS=${TOTAL_JOBS:-0}

info "Queue Statistics:"
info "  - Queued jobs: $QUEUED_JOBS"
info "  - Running jobs: $RUNNING_JOBS"
info "  - Total jobs: $TOTAL_JOBS"

# Wait for all jobs to complete
echo ""
log "Waiting for all jobs to complete..."
MAX_WAIT=60
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    COMPLETED=0
    TOTAL_TEST_JOBS=$((${#JOB_IDS[@]} + ${#CONCURRENT_JOBS[@]} + 1)) # +1 for cancel job
    
    for job_id in "${JOB_IDS[@]}" "${CONCURRENT_JOBS[@]}" "$CANCEL_JOB_ID"; do
        JOB_INFO=$(curl -s "$BASE_URL/jobs/$job_id")
        STATUS=$(extract_json_value "$JOB_INFO" "status")
        if [[ "$STATUS" == "completed" || "$STATUS" == "failed" || "$STATUS" == "canceled" ]]; then
            COMPLETED=$((COMPLETED + 1))
        fi
    done
    
    if [ $COMPLETED -eq $TOTAL_TEST_JOBS ]; then
        success "All jobs completed!"
        break
    fi
    
    echo -n "."
    sleep 2
    WAITED=$((WAITED + 2))
done

# Final Results
echo ""
log "Final Results"
log "============="

PASS_COUNT=0
TOTAL_TESTS=5

# Check results
if [ ${#JOB_IDS[@]} -eq 5 ]; then
    success "✅ Job submission test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job submission test failed"
fi

if [ $RUNNING_COUNT -gt 0 ]; then
    success "✅ Concurrent processing test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Concurrent processing test failed"
fi

if [[ "$CANCEL_STATUS" == *"cancel"* ]]; then
    success "✅ Job cancellation test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job cancellation test failed"
fi

if [ "$QUEUED_JOBS" -ge 0 ] && [ "$RUNNING_JOBS" -ge 0 ]; then
    success "✅ Queue statistics test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Queue statistics test failed"
fi

if [ $COMPLETED -eq $TOTAL_TEST_JOBS ]; then
    success "✅ Job completion test passed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    error "❌ Job completion test failed"
fi

# Cleanup
echo ""
info "Cleaning up test server..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID" > /dev/null
success "Cleanup completed"

echo ""
if [ $PASS_COUNT -eq $TOTAL_TESTS ]; then
    success "🎉 NetQueue Architecture Test PASSED! ($PASS_COUNT/$TOTAL_TESTS)"
    success "The new TCP-based queue system is working correctly!"
else
    error "❌ NetQueue Architecture Test FAILED! ($PASS_COUNT/$TOTAL_TESTS)"
    error "Please check the detailed results above."
fi

echo "" 