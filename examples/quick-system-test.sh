#!/bin/bash

# Quick System Test for Job Executor
# This is a simplified version that quickly validates core functionality
# Author: GitHub Copilot
# Date: 2025-07-08

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

# Function to extract value from JSON response
extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

clear
echo ""
echo "🚀 Job Executor - Quick System Test"
echo "===================================="
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
if [ ! -f "billa.pem" ]; then
    error "billa.pem file not found!"
    error "Please ensure the PEM file exists in the current directory"
    exit 1
fi
success "PEM file found"

# Test both authentication methods
echo ""
info "Testing authentication methods..."

# Method 1: Upload PEM file and use URL
info "Method 1: Testing PEM file upload authentication..."
UPLOAD_RESPONSE=$(curl -s -X POST -F "pem_file=@billa.pem" "$BASE_URL/pem-files/upload")
PEM_URL=$(extract_json_value "$UPLOAD_RESPONSE" "pem_file_url")

if [ -z "$PEM_URL" ]; then
    error "Failed to upload PEM file"
    exit 1
fi
success "PEM file uploaded successfully"

# Create test server with PEM URL
SERVER_NAME_1="quick-test-pem-$(date +%s)"
CREATE_RESPONSE_1=$(curl -s -X POST "$BASE_URL/servers" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SERVER_NAME_1\",
    \"hostname\": \"20.193.138.153\",
    \"port\": 22,
    \"user\": \"testvm\",
    \"auth_type\": \"key\",
    \"pem_file_url\": \"$PEM_URL\",
    \"is_active\": true
  }")

SERVER_ID_1=$(extract_json_value "$CREATE_RESPONSE_1" "id")
if [ -z "$SERVER_ID_1" ]; then
    error "Failed to create test server with PEM URL"
    exit 1
fi
success "Test server created with PEM URL method"

# Method 2: Direct private key in payload
info "Method 2: Testing direct private key authentication..."

# Read the private key content
PRIVATE_KEY_CONTENT=$(cat billa.pem | sed ':a;N;$!ba;s/\n/\\n/g')

# Create test server with direct private key
SERVER_NAME_2="quick-test-key-$(date +%s)"
CREATE_RESPONSE_2=$(curl -s -X POST "$BASE_URL/servers" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$SERVER_NAME_2\",
    \"hostname\": \"20.193.249.175\",
    \"port\": 22,
    \"user\": \"billa\",
    \"auth_type\": \"key\",
    \"private_key\": \"$PRIVATE_KEY_CONTENT\",
    \"is_active\": true
  }")

SERVER_ID_2=$(extract_json_value "$CREATE_RESPONSE_2" "id")
if [ -z "$SERVER_ID_2" ]; then
    error "Failed to create test server with direct private key"
    exit 1
fi
success "Test server created with direct private key method"

# Test both servers
info "Testing connections to both servers..."

# Test PEM URL server
TEST_RESPONSE_1=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID_1/test")
CONNECTION_STATUS_1=$(extract_json_value "$TEST_RESPONSE_1" "status")

# Test direct key server  
TEST_RESPONSE_2=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID_2/test")
CONNECTION_STATUS_2=$(extract_json_value "$TEST_RESPONSE_2" "status")

if [ "$CONNECTION_STATUS_1" = "connection_successful" ]; then
    success "PEM URL server connection test passed"
else
    error "PEM URL server connection test failed"
fi

if [ "$CONNECTION_STATUS_2" = "connection_successful" ]; then
    success "Direct private key server connection test passed"
else
    error "Direct private key server connection test failed"
fi

# Use the first server for job testing (both should work the same)
SERVER_ID="$SERVER_ID_1"
SERVER_NAME="$SERVER_NAME_1"

# Submit a simple test job
info "Submitting test job..."
JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"echo\",
    \"args\": \"Quick test successful!\",
    \"server_id\": \"$SERVER_ID\",
    \"timeout\": 30
  }")

JOB_ID=$(extract_json_value "$JOB_RESPONSE" "id")
if [ -z "$JOB_ID" ]; then
    error "Failed to submit test job"
    exit 1
fi
success "Test job submitted"

# Wait for job completion
info "Waiting for job completion..."
for i in {1..15}; do
    RESULT=$(curl -s "$BASE_URL/jobs/$JOB_ID")
    STATUS=$(extract_json_value "$RESULT" "status")
    
    if [ "$STATUS" = "completed" ]; then
        success "Test job completed successfully!"
        break
    elif [ "$STATUS" = "failed" ]; then
        error "Test job failed"
        break
    fi
    
    echo -n "."
    sleep 1
done

# Cleanup both test servers
info "Cleaning up test servers..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID_1" > /dev/null
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID_2" > /dev/null
success "Cleanup completed"

echo ""
if [ "$STATUS" = "completed" ]; then
    success "🎉 System test PASSED! Both authentication methods work correctly."
    success "   ✅ PEM file upload method"
    success "   ✅ Direct private key method"
else
    error "❌ System test FAILED! Please check your configuration."
    exit 1
fi

echo ""
echo "To run comprehensive tests, use: ./run-comprehensive-test.sh"
echo ""
