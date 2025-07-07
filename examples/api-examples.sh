#!/bin/bash

# Example usage of the new job executor features
# Make sure the job executor server is running before using these examples

BASE_URL="http://localhost:8080/api/v1"
SERVER_ID="e711c1b9-758c-47f9-8e33-454003c28c95"  # Using billa-server

echo "Job Executor API Examples"
echo "========================="

# 1. Submit a regular job
echo "1. Submitting a regular job..."
JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"echo\",
    \"args\": \"Hello from regular job!\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 60
  }")

JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Job submitted with ID: $JOB_ID"

# 2. Submit a shell script job
echo ""
echo "2. Submitting a shell script job..."
SCRIPT_CONTENT='#!/bin/bash
echo "=== Shell Script Job ==="
echo "Current date: $(date)"
echo "Arguments: $@"
ls -la /tmp | head -5
echo "Script completed successfully"'

SCRIPT_JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/script" \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"$SCRIPT_CONTENT\",
    \"args\": \"arg1 arg2 arg3\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 120,
    \"shell\": \"/bin/bash\"
  }")

SCRIPT_JOB_ID=$(echo "$SCRIPT_JOB_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Script job submitted with ID: $SCRIPT_JOB_ID"

# Wait a moment for jobs to potentially complete
sleep 3

# 3. Duplicate the first job
echo ""
echo "3. Duplicating the first job..."
if [ ! -z "$JOB_ID" ]; then
  DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs/$JOB_ID/duplicate" \
    -H "Content-Type: application/json" \
    -d "{
      \"timeout\": 90
    }")
  
  DUPLICATE_JOB_ID=$(echo "$DUPLICATE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo "Job duplicated with new ID: $DUPLICATE_JOB_ID"
else
  echo "Could not duplicate job - no job ID available"
fi

# 4. Check job status
echo ""
echo "4. Checking job statuses..."
if [ ! -z "$JOB_ID" ]; then
  echo "Original job status:"
  curl -s "$BASE_URL/jobs/$JOB_ID" | grep -o '"status":"[^"]*"'
fi

if [ ! -z "$SCRIPT_JOB_ID" ]; then
  echo "Script job status:"
  curl -s "$BASE_URL/jobs/$SCRIPT_JOB_ID" | grep -o '"status":"[^"]*"'
fi

if [ ! -z "$DUPLICATE_JOB_ID" ]; then
  echo "Duplicate job status:"
  curl -s "$BASE_URL/jobs/$DUPLICATE_JOB_ID" | grep -o '"status":"[^"]*"'
fi

echo ""
echo "Examples completed!"
echo "You can check job logs using: curl $BASE_URL/jobs/{job_id}/logs"
echo "You can get job output using: curl $BASE_URL/jobs/{job_id}/stdout"
