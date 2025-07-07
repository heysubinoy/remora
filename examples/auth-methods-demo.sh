#!/bin/bash

# Authentication Methods Demo for Job Executor
# This script demonstrates both PEM file upload and direct private key authentication
# Author: GitHub Copilot
# Date: 2025-07-08

BASE_URL="http://localhost:8080/api/v1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

success() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
demo() { echo -e "${YELLOW}🔧 $1${NC}"; }

extract_json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

clear
echo ""
echo "🔐 Job Executor Authentication Methods Demo"
echo "==========================================="
echo ""

if [ ! -f "billa.pem" ]; then
    echo "❌ billa.pem file not found! Please ensure the PEM file exists."
    exit 1
fi

echo "This demo shows two ways to authenticate SSH connections:"
echo "1. 📤 Upload PEM file to object storage (recommended for production)"
echo "2. 🔑 Include private key directly in server creation payload"
echo ""

# =============================================================================
# METHOD 1: PEM File Upload
# =============================================================================
demo "METHOD 1: PEM File Upload Authentication"
echo "=========================================="
echo ""

info "Step 1: Upload PEM file to object storage"
echo "curl -X POST -F \"pem_file=@billa.pem\" \"$BASE_URL/pem-files/upload\""
echo ""

UPLOAD_RESPONSE=$(curl -s -X POST -F "pem_file=@billa.pem" "$BASE_URL/pem-files/upload")
PEM_URL=$(extract_json_value "$UPLOAD_RESPONSE" "pem_file_url")

if [ -n "$PEM_URL" ]; then
    success "PEM file uploaded successfully"
    info "PEM File URL: $PEM_URL"
else
    echo "❌ Failed to upload PEM file"
    exit 1
fi

echo ""
info "Step 2: Create server using PEM file URL"
echo "JSON Payload:"
cat << EOF
{
    "name": "demo-server-pem",
    "hostname": "20.193.249.175",
    "port": 22,
    "user": "billa",
    "auth_type": "key",
    "pem_file_url": "$PEM_URL",
    "is_active": true
}
EOF
echo ""

SERVER_RESPONSE_1=$(curl -s -X POST "$BASE_URL/servers" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo-server-pem-$(date +%s)\",
    \"hostname\": \"20.193.249.175\",
    \"port\": 22,
    \"user\": \"billa\",
    \"auth_type\": \"key\",
    \"pem_file_url\": \"$PEM_URL\",
    \"is_active\": true
  }")

SERVER_ID_1=$(extract_json_value "$SERVER_RESPONSE_1" "id")

if [ -n "$SERVER_ID_1" ]; then
    success "Server created with PEM URL authentication"
    info "Server ID: $SERVER_ID_1"
else
    echo "❌ Failed to create server with PEM URL"
    exit 1
fi

# =============================================================================
# METHOD 2: Direct Private Key
# =============================================================================
echo ""
demo "METHOD 2: Direct Private Key Authentication"
echo "============================================"
echo ""

info "Step 1: Read private key content"
PRIVATE_KEY_CONTENT=$(cat billa.pem | sed ':a;N;$!ba;s/\n/\\n/g')
info "Private key loaded (content escaped for JSON)"

echo ""
info "Step 2: Create server with private key in payload"
echo "JSON Payload (private key content shown as [PRIVATE_KEY_CONTENT]):"
cat << EOF
{
    "name": "demo-server-key",
    "hostname": "20.193.249.175",
    "port": 22,
    "user": "billa",
    "auth_type": "key",
    "private_key": "[PRIVATE_KEY_CONTENT]",
    "is_active": true
}
EOF
echo ""

SERVER_RESPONSE_2=$(curl -s -X POST "$BASE_URL/servers" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo-server-key-$(date +%s)\",
    \"hostname\": \"20.193.249.175\",
    \"port\": 22,
    \"user\": \"billa\",
    \"auth_type\": \"key\",
    \"private_key\": \"$PRIVATE_KEY_CONTENT\",
    \"is_active\": true
  }")

SERVER_ID_2=$(extract_json_value "$SERVER_RESPONSE_2" "id")

if [ -n "$SERVER_ID_2" ]; then
    success "Server created with direct private key authentication"
    info "Server ID: $SERVER_ID_2"
else
    echo "❌ Failed to create server with direct private key"
    exit 1
fi

# =============================================================================
# COMPARISON AND TESTING
# =============================================================================
echo ""
demo "TESTING BOTH AUTHENTICATION METHODS"
echo "==================================="
echo ""

info "Testing connection to PEM URL server..."
TEST_1=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID_1/test")
STATUS_1=$(extract_json_value "$TEST_1" "status")

info "Testing connection to direct key server..."
TEST_2=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID_2/test")
STATUS_2=$(extract_json_value "$TEST_2" "status")

echo ""
if [ "$STATUS_1" = "connection_successful" ]; then
    success "PEM URL server connection: PASSED"
else
    echo "❌ PEM URL server connection: FAILED"
fi

if [ "$STATUS_2" = "connection_successful" ]; then
    success "Direct key server connection: PASSED"
else
    echo "❌ Direct key server connection: FAILED"
fi

echo ""
demo "RUNNING TEST JOBS"
echo "================="
echo ""

# Test job on PEM URL server
info "Submitting job to PEM URL server..."
JOB_1=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"echo\",
    \"args\": \"Hello from PEM URL server!\",
    \"server_id\": \"$SERVER_ID_1\",
    \"timeout\": 30
  }")
JOB_ID_1=$(extract_json_value "$JOB_1" "id")

# Test job on direct key server
info "Submitting job to direct key server..."
JOB_2=$(curl -s -X POST "$BASE_URL/jobs" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"echo\",
    \"args\": \"Hello from direct key server!\",
    \"server_id\": \"$SERVER_ID_2\",
    \"timeout\": 30
  }")
JOB_ID_2=$(extract_json_value "$JOB_2" "id")

# Wait for jobs to complete
info "Waiting for jobs to complete..."
sleep 5

# Check results
echo ""
JOB_RESULT_1=$(curl -s "$BASE_URL/jobs/$JOB_ID_1")
JOB_STATUS_1=$(extract_json_value "$JOB_RESULT_1" "status")

JOB_RESULT_2=$(curl -s "$BASE_URL/jobs/$JOB_ID_2")
JOB_STATUS_2=$(extract_json_value "$JOB_RESULT_2" "status")

if [ "$JOB_STATUS_1" = "completed" ]; then
    success "PEM URL server job: COMPLETED"
else
    echo "❌ PEM URL server job: $JOB_STATUS_1"
fi

if [ "$JOB_STATUS_2" = "completed" ]; then
    success "Direct key server job: COMPLETED"
else
    echo "❌ Direct key server job: $JOB_STATUS_2"
fi

# =============================================================================
# SUMMARY AND CLEANUP
# =============================================================================
echo ""
demo "SUMMARY: WHEN TO USE EACH METHOD"
echo "================================="
echo ""
echo "📤 PEM File Upload Method:"
echo "   ✅ Recommended for production environments"
echo "   ✅ Better security (keys stored in object storage)"
echo "   ✅ Supports key rotation and management"
echo "   ✅ Reduces payload size in API calls"
echo "   ✅ Centralized key storage"
echo ""
echo "🔑 Direct Private Key Method:"
echo "   ✅ Good for development and testing"
echo "   ✅ Simpler setup (no object storage required)"
echo "   ✅ Self-contained (everything in one payload)"
echo "   ⚠️  Keys visible in API logs and payloads"
echo "   ⚠️  Less secure for production use"
echo ""

# Cleanup
info "Cleaning up demo servers..."
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID_1" > /dev/null
curl -s -X DELETE "$BASE_URL/servers/$SERVER_ID_2" > /dev/null
success "Demo completed and cleaned up!"

echo ""
echo "🎯 Both authentication methods work correctly!"
echo "   Choose the method that best fits your security requirements."
echo ""
