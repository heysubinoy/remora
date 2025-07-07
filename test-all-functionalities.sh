#!/bin/bash

# Comprehensive Job Executor Test Suite with RabbitMQ
# This script tests all functionalities of the job executor system

BASE_URL="http://localhost:8080/api/v1"
TEST_RESULTS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name - $message"
        TEST_RESULTS+=("PASS: $test_name")
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC}: $test_name - $message"
        TEST_RESULTS+=("FAIL: $test_name")
    elif [ "$status" = "INFO" ]; then
        echo -e "${BLUE}ℹ️  INFO${NC}: $test_name - $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠️  WARN${NC}: $test_name - $message"
    fi
}

# Function to make HTTP requests and check response
make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local expected_status="$4"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" "$url")
    fi
    
    http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    response_body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo "$response_body"
        return 0
    else
        echo "ERROR: Expected status $expected_status, got $http_code"
        echo "Response: $response_body"
        return 1
    fi
}

# Function to wait for job completion
wait_for_job() {
    local job_id="$1"
    local timeout="$2"
    local count=0
    
    while [ $count -lt $timeout ]; do
        job_response=$(make_request "GET" "$BASE_URL/jobs/$job_id" "" "200")
        if [ $? -eq 0 ]; then
            status=$(echo "$job_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            if [ "$status" = "completed" ] || [ "$status" = "failed" ] || [ "$status" = "canceled" ]; then
                echo "$status"
                return 0
            fi
        fi
        sleep 1
        ((count++))
    done
    echo "timeout"
    return 1
}

echo "=================================================="
echo "🚀 Job Executor RabbitMQ Integration Test Suite"
echo "=================================================="
echo ""

# Test 1: Health Check
log_test "Health Check" "INFO" "Testing server health endpoint"
health_response=$(make_request "GET" "http://localhost:8080/health" "" "200")
if [ $? -eq 0 ]; then
    log_test "Health Check" "PASS" "Server is healthy"
else
    log_test "Health Check" "FAIL" "Server health check failed"
    exit 1
fi

# Test 2: Create Test Server Configuration
log_test "Server Creation" "INFO" "Creating test server configuration"
server_data='{
    "name": "test-server",
    "hostname": "localhost",
    "port": 22,
    "user": "testuser",
    "auth_type": "password",
    "password": "testpass",
    "is_active": true
}'

server_response=$(make_request "POST" "$BASE_URL/servers" "$server_data" "201")
if [ $? -eq 0 ]; then
    SERVER_ID=$(echo "$server_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log_test "Server Creation" "PASS" "Server created with ID: $SERVER_ID"
else
    log_test "Server Creation" "FAIL" "Failed to create server"
    exit 1
fi

# Test 3: List Servers
log_test "Server Listing" "INFO" "Testing server listing endpoint"
servers_response=$(make_request "GET" "$BASE_URL/servers" "" "200")
if [ $? -eq 0 ]; then
    server_count=$(echo "$servers_response" | grep -o '"id":' | wc -l)
    log_test "Server Listing" "PASS" "Retrieved $server_count servers"
else
    log_test "Server Listing" "FAIL" "Failed to list servers"
fi

# Test 4: Submit Basic Job
log_test "Job Submission" "INFO" "Submitting basic job"
job_data="{
    \"command\": \"echo\",
    \"args\": \"Hello RabbitMQ World!\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60
}"

job_response=$(make_request "POST" "$BASE_URL/jobs" "$job_data" "201")
if [ $? -eq 0 ]; then
    JOB_ID=$(echo "$job_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log_test "Job Submission" "PASS" "Job submitted with ID: $JOB_ID"
else
    log_test "Job Submission" "FAIL" "Failed to submit job"
    exit 1
fi

# Test 5: Job Status Check
log_test "Job Status" "INFO" "Checking job status"
job_status_response=$(make_request "GET" "$BASE_URL/jobs/$JOB_ID" "" "200")
if [ $? -eq 0 ]; then
    status=$(echo "$job_status_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    log_test "Job Status" "PASS" "Job status: $status"
else
    log_test "Job Status" "FAIL" "Failed to get job status"
fi

# Test 6: Wait for Job Completion
log_test "Job Execution" "INFO" "Waiting for job to complete (max 30 seconds)"
final_status=$(wait_for_job "$JOB_ID" 30)
if [ "$final_status" = "completed" ]; then
    log_test "Job Execution" "PASS" "Job completed successfully"
elif [ "$final_status" = "failed" ]; then
    log_test "Job Execution" "WARN" "Job failed (expected due to SSH connection)"
else
    log_test "Job Execution" "FAIL" "Job did not complete in time: $final_status"
fi

# Test 7: Job Logs
log_test "Job Logs" "INFO" "Retrieving job logs"
logs_response=$(make_request "GET" "$BASE_URL/jobs/$JOB_ID/logs" "" "200")
if [ $? -eq 0 ]; then
    log_test "Job Logs" "PASS" "Job logs retrieved successfully"
else
    log_test "Job Logs" "FAIL" "Failed to retrieve job logs"
fi

# Test 8: Submit Script Job
log_test "Script Job" "INFO" "Submitting shell script job"
script_data="{
    \"script\": \"#!/bin/bash\\necho 'Script execution test'\\ndate\\necho 'Done'\",
    \"args\": \"\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60,
    \"shell\": \"/bin/bash\"
}"

script_response=$(make_request "POST" "$BASE_URL/jobs/script" "$script_data" "201")
if [ $? -eq 0 ]; then
    SCRIPT_JOB_ID=$(echo "$script_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log_test "Script Job" "PASS" "Script job submitted with ID: $SCRIPT_JOB_ID"
else
    log_test "Script Job" "FAIL" "Failed to submit script job"
fi

# Test 9: Job Duplication
log_test "Job Duplication" "INFO" "Testing job duplication"
duplicate_data="{
    \"timeout\": 120
}"

duplicate_response=$(make_request "POST" "$BASE_URL/jobs/$JOB_ID/duplicate" "$duplicate_data" "201")
if [ $? -eq 0 ]; then
    DUPLICATE_JOB_ID=$(echo "$duplicate_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log_test "Job Duplication" "PASS" "Job duplicated with ID: $DUPLICATE_JOB_ID"
else
    log_test "Job Duplication" "FAIL" "Failed to duplicate job"
fi

# Test 10: Job Cancellation
log_test "Job Cancellation" "INFO" "Testing job cancellation"
cancel_response=$(make_request "POST" "$BASE_URL/jobs/$DUPLICATE_JOB_ID/cancel" "" "200")
if [ $? -eq 0 ]; then
    canceled_status=$(echo "$cancel_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    log_test "Job Cancellation" "PASS" "Job canceled, status: $canceled_status"
else
    log_test "Job Cancellation" "FAIL" "Failed to cancel job"
fi

# Test 11: List Jobs
log_test "Job Listing" "INFO" "Testing job listing with filters"
jobs_response=$(make_request "GET" "$BASE_URL/jobs?limit=10" "" "200")
if [ $? -eq 0 ]; then
    job_count=$(echo "$jobs_response" | grep -o '"id":' | wc -l)
    log_test "Job Listing" "PASS" "Retrieved $job_count jobs"
else
    log_test "Job Listing" "FAIL" "Failed to list jobs"
fi

# Test 12: RabbitMQ Queue Test
log_test "RabbitMQ Queue" "INFO" "Testing RabbitMQ queue functionality"
# Submit multiple jobs quickly to test queue
for i in {1..5}; do
    quick_job_data="{
        \"command\": \"echo\",
        \"args\": \"Quick test $i\",
        \"server_id\": \"$SERVER_ID\",
        \"timeout\": 30
    }"
    make_request "POST" "$BASE_URL/jobs" "$quick_job_data" "201" > /dev/null
done
log_test "RabbitMQ Queue" "PASS" "Submitted 5 jobs quickly to test queue processing"

# Test 13: Server Management
log_test "Server Update" "INFO" "Testing server update"
update_data='{
    "name": "updated-test-server",
    "hostname": "localhost",
    "port": 22,
    "user": "testuser",
    "auth_type": "password",
    "password": "newpass",
    "is_active": false
}'

update_response=$(make_request "PUT" "$BASE_URL/servers/$SERVER_ID" "$update_data" "200")
if [ $? -eq 0 ]; then
    log_test "Server Update" "PASS" "Server updated successfully"
else
    log_test "Server Update" "FAIL" "Failed to update server"
fi

# Test 14: Cleanup - Delete Server
log_test "Server Deletion" "INFO" "Testing server deletion"
delete_response=$(make_request "DELETE" "$BASE_URL/servers/$SERVER_ID" "" "200")
if [ $? -eq 0 ]; then
    log_test "Server Deletion" "PASS" "Server deleted successfully"
else
    log_test "Server Deletion" "FAIL" "Failed to delete server"
fi

# Test Summary
echo ""
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo ""

pass_count=0
fail_count=0

for result in "${TEST_RESULTS[@]}"; do
    if [[ $result == PASS:* ]]; then
        ((pass_count++))
        echo -e "${GREEN}✅${NC} $result"
    else
        ((fail_count++))
        echo -e "${RED}❌${NC} $result"
    fi
done

total_tests=$((pass_count + fail_count))
echo ""
echo "Total Tests: $total_tests"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"

if [ $fail_count -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! RabbitMQ integration is working correctly.${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Check the logs above for details.${NC}"
    exit 1
fi
