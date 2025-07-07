#!/bin/bash

# Job Cancellation Test Script
# This script tests the job cancellation functionality specifically

BASE_URL="http://localhost:8080/api/v1"

echo "🧪 Testing Job Cancellation Functionality"
echo "=========================================="

# Create a test server with a very long timeout to simulate a slow connection
echo "1. Creating test server with very slow response..."
SERVER_RESPONSE=$(curl -s -X POST "$BASE_URL/servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "slow-server-test",
    "hostname": "192.168.254.254",
    "port": 22,
    "user": "testuser",
    "auth_type": "password",
    "password": "test",
    "is_active": true
  }')

SERVER_ID=$(echo "$SERVER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Test server created with ID: $SERVER_ID"

# Submit a job that will take time to fail
echo ""
echo "2. Submitting job that should take time to process..."
JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"sleep\",
    \"args\": \"60\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 120
  }")

JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Job submitted with ID: $JOB_ID"

# Check initial status
echo ""
echo "3. Checking initial job status..."
INITIAL_STATUS=$(curl -s "$BASE_URL/jobs/$JOB_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "Initial status: $INITIAL_STATUS"

# Wait a moment then try to cancel
echo ""
echo "4. Waiting 2 seconds then attempting cancellation..."
sleep 2

CURRENT_STATUS=$(curl -s "$BASE_URL/jobs/$JOB_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "Current status before cancellation: $CURRENT_STATUS"

if [ "$CURRENT_STATUS" = "queued" ] || [ "$CURRENT_STATUS" = "running" ]; then
    echo "✅ Job is in cancelable state, attempting cancellation..."
    CANCEL_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/$JOB_ID/cancel")
    echo "Cancel response: $CANCEL_RESPONSE"
    
    # Check final status
    sleep 1
    FINAL_STATUS=$(curl -s "$BASE_URL/jobs/$JOB_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "Final status: $FINAL_STATUS"
    
    if [ "$FINAL_STATUS" = "canceled" ]; then
        echo "✅ SUCCESS: Job was successfully canceled!"
    else
        echo "❌ FAILED: Job was not canceled (status: $FINAL_STATUS)"
    fi
else
    echo "❌ ISSUE: Job completed too quickly to test cancellation (status: $CURRENT_STATUS)"
    echo "This suggests the SSH connection timeout is very short"
fi

# Show job details
echo ""
echo "5. Final job details:"
curl -s "$BASE_URL/jobs/$JOB_ID" | head -200

# Cleanup
echo ""
echo "6. Cleaning up test server..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID" > /dev/null
echo "✅ Test server deleted"

echo ""
echo "🔍 Analysis:"
echo "- If jobs are failing immediately, the SSH connection timeout is very short"
echo "- If cancellation works, the feature is functional"
echo "- The 'Job cannot be canceled' error means the job is already in a terminal state"
