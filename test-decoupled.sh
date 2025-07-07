#!/bin/bash

# Test script for decoupled API server and worker

set -e

echo "=== Testing Decoupled Job Executor ==="

API_BASE_URL="http://localhost:8080/api/v1"

echo "1. Testing API server health..."
curl -s "$API_BASE_URL/../health" | jq '.'

echo -e "\n2. Listing servers..."
curl -s "$API_BASE_URL/servers" | jq '.'

echo -e "\n3. Submitting a test job..."
JOB_RESPONSE=$(curl -s -X POST "$API_BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "echo",
    "args": ["Hello from decoupled worker!"],
    "server_id": 1,
    "timeout": 60
  }')

echo "$JOB_RESPONSE" | jq '.'

# Extract job ID
JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job.id')

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
    echo "Failed to create job"
    exit 1
fi

echo -e "\n4. Checking job status (ID: $JOB_ID)..."
sleep 2
curl -s "$API_BASE_URL/jobs/$JOB_ID" | jq '.'

echo -e "\n5. Getting job logs..."
sleep 1
curl -s "$API_BASE_URL/jobs/$JOB_ID/logs" | jq '.'

echo -e "\n6. Testing job cancellation with a long-running job..."
CANCEL_JOB_RESPONSE=$(curl -s -X POST "$API_BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "sleep",
    "args": ["30"],
    "server_id": 1,
    "timeout": 60
  }')

CANCEL_JOB_ID=$(echo "$CANCEL_JOB_RESPONSE" | jq -r '.job.id')
echo "Created long-running job: $CANCEL_JOB_ID"

# Wait a moment then cancel
sleep 2
echo "Canceling job..."
curl -s -X POST "$API_BASE_URL/jobs/$CANCEL_JOB_ID/cancel" | jq '.'

echo -e "\n7. Verifying cancellation..."
sleep 1
curl -s "$API_BASE_URL/jobs/$CANCEL_JOB_ID" | jq '.'

echo -e "\n=== Test Complete ==="
