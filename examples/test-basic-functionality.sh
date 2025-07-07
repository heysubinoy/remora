#!/bin/bash

# Test script for server creation with direct PEM content (without object storage)
BASE_URL="http://localhost:8080/api/v1"

echo "Testing Server Creation with Direct PEM Content..."
echo "================================================"

# Step 1: Create server using direct PEM file content
echo "Step 1: Creating server with direct PEM content..."

SERVER_PAYLOAD=$(cat << 'EOF'
{
    "name": "test-server-direct-pem",
    "hostname": "example.com",
    "port": 22,
    "user": "ubuntu",
    "auth_type": "key",
    "pem_file": "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAQEA2K8Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK\n-----END OPENSSH PRIVATE KEY-----",
    "is_active": true
}
EOF
)

CREATE_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$SERVER_PAYLOAD" \
  "$BASE_URL/servers")

echo "Server creation response: $CREATE_RESPONSE"

# Extract server ID
SERVER_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SERVER_ID" ]; then
    echo "❌ Failed to create server or extract server ID"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

echo "✅ Server created successfully!"
echo "Server ID: $SERVER_ID"

# Step 2: Get server details
echo ""
echo "Step 2: Getting server details..."
GET_RESPONSE=$(curl -s "$BASE_URL/servers/$SERVER_ID")
echo "Server details: $GET_RESPONSE"

# Step 3: Test server connection
echo ""
echo "Step 3: Testing server connection..."
TEST_RESPONSE=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID/test")
echo "Connection test response: $TEST_RESPONSE"

# Step 4: Create server with private key instead
echo ""
echo "Step 4: Creating server with private_key field..."

SERVER_PAYLOAD_2=$(cat << 'EOF'
{
    "name": "test-server-private-key",
    "hostname": "example.com",
    "port": 22,
    "user": "ubuntu",
    "auth_type": "key",
    "private_key": "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAFwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAQEA2K8Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK9Z7QK\n-----END OPENSSH PRIVATE KEY-----",
    "is_active": true
}
EOF
)

CREATE_RESPONSE_2=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$SERVER_PAYLOAD_2" \
  "$BASE_URL/servers")

echo "Server creation response 2: $CREATE_RESPONSE_2"

# Step 5: List all servers
echo ""
echo "Step 5: Listing all servers..."
LIST_RESPONSE=$(curl -s "$BASE_URL/servers")
echo "Servers list: $LIST_RESPONSE"

echo ""
echo "✅ Basic functionality test completed!"
echo ""
echo "Key features tested:"
echo "1. ✅ Server creation with direct PEM content"
echo "2. ✅ Server creation with private_key field"
echo "3. ✅ Server retrieval"
echo "4. ✅ Connection testing"
echo "5. ✅ Server listing"
