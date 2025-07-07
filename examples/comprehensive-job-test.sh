#!/bin/bash

# Comprehensive Job Executor Test Script
# Tests the complete workflow: PEM upload, server creation, job execution, monitoring, and cancellation
# Author: GitHub Copilot
# Date: 2025-07-08

BASE_URL="http://localhost:8080/api/v1"
TEST_LOG="test_results.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$TEST_LOG"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$TEST_LOG"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$TEST_LOG"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$TEST_LOG"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$TEST_LOG"
}

# Function to wait for job completion or timeout
wait_for_job() {
    local job_id=$1
    local max_wait=${2:-30} # Default 30 seconds
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        local response=$(curl -s "$BASE_URL/jobs/$job_id")
        local status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        echo "Job $job_id status: $status (waited ${waited}s)"
        
        if [[ "$status" == "completed" || "$status" == "failed" || "$status" == "canceled" ]]; then
            echo "$status"
            return 0
        fi
        
        sleep 2
        waited=$((waited + 2))
    done
    
    echo "timeout"
    return 1
}

# Function to extract value from JSON response
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

# Initialize test
clear
log "🚀 Starting Comprehensive Job Executor Test"
log "=============================================="

# Remove old test log
rm -f "$TEST_LOG"

# Test variables
PEM_FILE_URL=""
SERVER_ID=""
JOBS=()

echo ""
info "Test Configuration:"
info "Base URL: $BASE_URL"
info "Test Log: $TEST_LOG"
info "PEM File: Using billa.pem"

# =============================================================================
# STEP 1: Upload PEM Key
# =============================================================================
echo ""
log "STEP 1: Uploading PEM Key"
log "========================="

if [ ! -f "billa.pem" ]; then
    error "billa.pem file not found! Please ensure the PEM file exists."
    exit 1
fi

info "Uploading billa.pem file..."
UPLOAD_RESPONSE=$(curl -s -X POST -F "pem_file=@billa.pem" "$BASE_URL/pem-files/upload")

if [ $? -ne 0 ]; then
    error "Failed to upload PEM file - curl command failed"
    exit 1
fi

log "Upload response: $UPLOAD_RESPONSE"

PEM_FILE_URL=$(extract_json_value "$UPLOAD_RESPONSE" "pem_file_url")

if [ -z "$PEM_FILE_URL" ]; then
    error "Failed to extract PEM file URL from upload response"
    error "Response: $UPLOAD_RESPONSE"
    exit 1
fi

success "PEM file uploaded successfully!"
info "PEM File URL: $PEM_FILE_URL"

# =============================================================================
# STEP 2: Create Servers With Different Authentication Methods
# =============================================================================
echo ""
log "STEP 2: Creating Servers With Different Authentication Methods"
log "============================================================="

# Method 1: Server with PEM file URL
SERVER_NAME_1="test-server-pem-$(date +%s)"
SERVER_PAYLOAD_1=$(cat << EOF
{
    "name": "$SERVER_NAME_1",
    "hostname": "20.193.249.175",
    "port": 22,
    "user": "billa",
    "auth_type": "key",
    "pem_file_url": "$PEM_FILE_URL",
    "is_active": true
}
EOF
)

info "Creating server with PEM URL: $SERVER_NAME_1"
CREATE_RESPONSE_1=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$SERVER_PAYLOAD_1" \
  "$BASE_URL/servers")

log "Server creation response (PEM URL): $CREATE_RESPONSE_1"

SERVER_ID_1=$(extract_json_value "$CREATE_RESPONSE_1" "id")

if [ -z "$SERVER_ID_1" ]; then
    error "Failed to extract server ID from PEM URL server creation response"
    error "Response: $CREATE_RESPONSE_1"
    exit 1
fi

success "Server with PEM URL created successfully!"
info "Server ID: $SERVER_ID_1"
info "Server Name: $SERVER_NAME_1"

# Method 2: Server with direct private key
info "Creating server with direct private key..."

# Read the private key content and escape it for JSON
PRIVATE_KEY_CONTENT=$(cat billa.pem | sed ':a;N;$!ba;s/\n/\\n/g')

SERVER_NAME_2="test-server-key-$(date +%s)"
SERVER_PAYLOAD_2=$(cat << EOF
{
    "name": "$SERVER_NAME_2",
    "hostname": "20.193.249.175",
    "port": 22,
    "user": "billa",
    "auth_type": "key",
    "private_key": "$PRIVATE_KEY_CONTENT",
    "is_active": true
}
EOF
)

info "Creating server with direct private key: $SERVER_NAME_2"
CREATE_RESPONSE_2=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$SERVER_PAYLOAD_2" \
  "$BASE_URL/servers")

log "Server creation response (Direct Key): $CREATE_RESPONSE_2"

SERVER_ID_2=$(extract_json_value "$CREATE_RESPONSE_2" "id")

if [ -z "$SERVER_ID_2" ]; then
    error "Failed to extract server ID from direct key server creation response"
    error "Response: $CREATE_RESPONSE_2"
    exit 1
fi

success "Server with direct private key created successfully!"
info "Server ID: $SERVER_ID_2"
info "Server Name: $SERVER_NAME_2"

# Test both server connections
info "Testing both server connections..."

info "Testing PEM URL server connection..."
TEST_RESPONSE_1=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID_1/test")
log "Connection test response (PEM URL): $TEST_RESPONSE_1"

CONNECTION_STATUS_1=$(extract_json_value "$TEST_RESPONSE_1" "status")
if [ "$CONNECTION_STATUS_1" = "success" ]; then
    success "PEM URL server connection test passed!"
else
    warning "PEM URL server connection test may have issues, but continuing..."
fi

info "Testing direct private key server connection..."
TEST_RESPONSE_2=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID_2/test")
log "Connection test response (Direct Key): $TEST_RESPONSE_2"

CONNECTION_STATUS_2=$(extract_json_value "$TEST_RESPONSE_2" "status")
if [ "$CONNECTION_STATUS_2" = "success" ]; then
    success "Direct private key server connection test passed!"
else
    warning "Direct private key server connection test may have issues, but continuing..."
fi

# Use the first server for job testing (we'll test jobs on both servers)
SERVER_ID="$SERVER_ID_1"

# =============================================================================
# STEP 3: Create Multiple Jobs
# =============================================================================
echo ""
log "STEP 3: Creating Multiple Test Jobs"
log "==================================="

# Job 1: Simple job that will pass
info "Creating Job 1: Simple success job"
JOB1_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"echo\",
    \"args\": \"Hello from successful job!\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60
  }")

JOB1_ID=$(extract_json_value "$JOB1_RESPONSE" "id")
if [ -n "$JOB1_ID" ]; then
    JOBS+=("$JOB1_ID:success_job")
    success "Job 1 created: $JOB1_ID (Success Job)"
else
    error "Failed to create Job 1"
    log "Response: $JOB1_RESPONSE"
fi

# Job 2: Job that will fail
info "Creating Job 2: Job that will fail"
JOB2_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"nonexistent-command\",
    \"args\": \"this will fail\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60
  }")

JOB2_ID=$(extract_json_value "$JOB2_RESPONSE" "id")
if [ -n "$JOB2_ID" ]; then
    JOBS+=("$JOB2_ID:failure_job")
    success "Job 2 created: $JOB2_ID (Failure Job)"
else
    error "Failed to create Job 2"
fi

# Job 3: Long running job with timeout (will timeout)
info "Creating Job 3: Long running job that will timeout"
JOB3_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'Starting long job that will timeout...'\\nfor i in {1..100}; do\\n  echo \\\"Step \$i of 100\\\"\\n  sleep 3\\ndone\\necho 'This should not complete due to timeout'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 10,
    \"shell\": \"/bin/bash\"
  }")

JOB3_ID=$(extract_json_value "$JOB3_RESPONSE" "id")
if [ -n "$JOB3_ID" ]; then
    JOBS+=("$JOB3_ID:timeout_job")
    success "Job 3 created: $JOB3_ID (Timeout Job - 15s timeout)"
else
    error "Failed to create Job 3"
fi

# Job 4: Long running job within timeout
info "Creating Job 4: Long running job within timeout"
JOB4_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'Starting long job that will complete...'\\nfor i in {1..8}; do\\n  echo \\\"Step \$i of 8\\\"\\n  sleep 1\\ndone\\necho 'Job completed successfully within timeout'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 30,
    \"shell\": \"/bin/bash\"
  }")

JOB4_ID=$(extract_json_value "$JOB4_RESPONSE" "id")
if [ -n "$JOB4_ID" ]; then
    JOBS+=("$JOB4_ID:long_success_job")
    success "Job 4 created: $JOB4_ID (Long Success Job - 30s timeout)"
else
    error "Failed to create Job 4"
fi

# Job 5: Job we will manually cancel
info "Creating Job 5: Job we will manually cancel"
JOB5_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"#!/bin/bash\\necho 'Starting job that will be canceled...'\\nfor i in {1..60}; do\\n  echo \\\"Processing step \$i...\\\"\\n  sleep 2\\ndone\\necho 'This should be canceled before completion'\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 300,
    \"shell\": \"/bin/bash\"
  }")

JOB5_ID=$(extract_json_value "$JOB5_RESPONSE" "id")
if [ -n "$JOB5_ID" ]; then
    JOBS+=("$JOB5_ID:cancel_job")
    success "Job 5 created: $JOB5_ID (Manual Cancel Job)"
else
    error "Failed to create Job 5"
fi

# Job 6: Test direct private key authentication server
info "Creating Job 6: Test direct private key authentication"
JOB6_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"echo\",
    \"args\": \"Hello from direct private key server!\",
    \"server_id\": \"$SERVER_ID_2\",
    \"timeout\": 60
  }")

JOB6_ID=$(extract_json_value "$JOB6_RESPONSE" "id")
if [ -n "$JOB6_ID" ]; then
    JOBS+=("$JOB6_ID:direct_key_job")
    success "Job 6 created: $JOB6_ID (Direct Private Key Test Job)"
else
    error "Failed to create Job 6"
fi

info "Created ${#JOBS[@]} jobs total"
for job in "${JOBS[@]}"; do
    job_id=$(echo "$job" | cut -d':' -f1)
    job_type=$(echo "$job" | cut -d':' -f2)
    info "  - $job_id ($job_type)"
done

# =============================================================================
# STEP 4: Monitor Job Status and Logs
# =============================================================================
echo ""
log "STEP 4: Monitoring Job Status and Logs"
log "======================================="

# Wait a moment for jobs to start
sleep 3

info "Initial job status check..."
for job in "${JOBS[@]}"; do
    job_id=$(echo "$job" | cut -d':' -f1)
    job_type=$(echo "$job" | cut -d':' -f2)
    
    response=$(curl -s "$BASE_URL/jobs/$job_id")
    status=$(extract_json_value "$response" "status")
    
    info "Job $job_id ($job_type): $status"
done

# =============================================================================
# STEP 5: Cancel the Manual Cancel Job
# =============================================================================
echo ""
log "STEP 5: Manually Canceling Job"
log "==============================="

# Wait for the cancel job to start running
info "Waiting for cancel job ($JOB5_ID) to start running..."
sleep 8

# Cancel the job
info "Attempting to cancel job $JOB5_ID..."
CANCEL_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/$JOB5_ID/cancel")
log "Cancel response: $CANCEL_RESPONSE"

cancel_status=$(extract_json_value "$CANCEL_RESPONSE" "message")
if [[ "$cancel_status" == *"cancel"* ]]; then
    success "Cancel request sent successfully"
else
    warning "Cancel request may have failed: $CANCEL_RESPONSE"
fi

# =============================================================================
# STEP 6: Final Validation - Wait for All Jobs to Complete
# =============================================================================
echo ""
log "STEP 6: Final Validation - Waiting for All Jobs to Complete"
log "==========================================================="

info "Waiting for all jobs to complete (max 2 minutes)..."

# Track job completion
COMPLETED_JOBS=()
MAX_WAIT=120
WAITED=0

while [ ${#COMPLETED_JOBS[@]} -lt ${#JOBS[@]} ] && [ $WAITED -lt $MAX_WAIT ]; do
    for job in "${JOBS[@]}"; do
        job_id=$(echo "$job" | cut -d':' -f1)
        job_type=$(echo "$job" | cut -d':' -f2)
        
        # Skip if already completed
        if [[ " ${COMPLETED_JOBS[@]} " =~ " ${job_id} " ]]; then
            continue
        fi
        
        response=$(curl -s "$BASE_URL/jobs/$job_id")
        status=$(extract_json_value "$response" "status")
        
        if [[ "$status" == "completed" || "$status" == "failed" || "$status" == "canceled" ]]; then
            COMPLETED_JOBS+=("$job_id")
            info "Job $job_id ($job_type) finished with status: $status"
        fi
    done
    
    if [ ${#COMPLETED_JOBS[@]} -lt ${#JOBS[@]} ]; then
        sleep 5
        WAITED=$((WAITED + 5))
        info "Waiting... (${#COMPLETED_JOBS[@]}/${#JOBS[@]} completed, ${WAITED}s elapsed)"
    fi
done

# =============================================================================
# FINAL REPORT
# =============================================================================
echo ""
log "FINAL REPORT"
log "============"

success "Test execution completed!"
info "Detailed results for each job:"

PASS_COUNT=0
EXPECTED_RESULTS=6

for job in "${JOBS[@]}"; do
    job_id=$(echo "$job" | cut -d':' -f1)
    job_type=$(echo "$job" | cut -d':' -f2)
    
    response=$(curl -s "$BASE_URL/jobs/$job_id")
    status=$(extract_json_value "$response" "status")
    
    # Get detailed logs
    logs_response=$(curl -s "$BASE_URL/jobs/$job_id/logs")
    
    echo ""
    echo "----------------------------------------"
    info "Job: $job_id ($job_type)"
    info "Status: $status"
    
    # Validate expected outcomes
    case "$job_type" in
        "success_job")
            if [ "$status" = "completed" ]; then
                success "✅ Success job completed as expected"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                error "❌ Success job failed - expected 'completed', got '$status'"
            fi
            ;;
        "failure_job")
            if [ "$status" = "failed" ]; then
                success "✅ Failure job failed as expected"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                error "❌ Failure job didn't fail - expected 'failed', got '$status'"
            fi
            ;;
        "timeout_job")
            if [ "$status" = "canceled" ] || [ "$status" = "failed" ]; then
                success "✅ Timeout job timed out as expected (status: $status)"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                error "❌ Timeout job didn't timeout - expected 'failed' or 'canceled', got '$status'"
            fi
            ;;
        "long_success_job")
            if [ "$status" = "completed" ]; then
                success "✅ Long success job completed as expected"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                error "❌ Long success job failed - expected 'completed', got '$status'"
            fi
            ;;
        "cancel_job")
            if [ "$status" = "canceled" ]; then
                success "✅ Cancel job was canceled as expected"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                error "❌ Cancel job wasn't canceled - expected 'canceled', got '$status'"
            fi
            ;;
        "direct_key_job")
            if [ "$status" = "completed" ]; then
                success "✅ Direct private key job completed as expected"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                error "❌ Direct private key job failed - expected 'completed', got '$status'"
            fi
            ;;
    esac
    
    # Show last few lines of output/error for context
    stdout=$(echo "$logs_response" | grep -o '"stdout":"[^"]*"' | cut -d'"' -f4 | tail -c 200)
    stderr=$(echo "$logs_response" | grep -o '"stderr":"[^"]*"' | cut -d'"' -f4 | tail -c 200)
    
    if [ -n "$stdout" ]; then
        info "Last stdout: ...${stdout}"
    fi
    if [ -n "$stderr" ]; then
        info "Last stderr: ...${stderr}"
    fi
done

echo ""
echo "========================================"
if [ $PASS_COUNT -eq $EXPECTED_RESULTS ]; then
    success "🎉 ALL TESTS PASSED! ($PASS_COUNT/$EXPECTED_RESULTS)"
    success "The job executor system is working correctly!"
    success "Both authentication methods (PEM URL and direct private key) work perfectly!"
else
    error "❌ SOME TESTS FAILED! ($PASS_COUNT/$EXPECTED_RESULTS passed)"
    error "Please check the detailed results above."
fi

echo ""
info "Test Summary:"
info "- PEM file uploaded: ✅"
info "- PEM URL server created: ✅"
info "- Direct private key server created: ✅"
info "- Jobs created: ${#JOBS[@]}"
info "- Jobs validated: $PASS_COUNT/$EXPECTED_RESULTS"
info "- Test log saved to: $TEST_LOG"

# Cleanup automatically
echo ""
info "Cleaning up test servers..."

# Cleanup PEM URL server
DELETE_RESPONSE_1=$(curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID_1")
if [ $? -eq 0 ]; then
    success "PEM URL test server deleted successfully"
else
    warning "Failed to delete PEM URL test server: $SERVER_ID_1"
fi

# Cleanup direct key server
DELETE_RESPONSE_2=$(curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID_2")
if [ $? -eq 0 ]; then
    success "Direct key test server deleted successfully"
else
    warning "Failed to delete direct key test server: $SERVER_ID_2"
fi

log "Test completed at $(date)"
echo ""
echo "Full test log available in: $TEST_LOG"
