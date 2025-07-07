#!/bin/bash

# Test script for PEM file upload functionality
BASE_URL="http://localhost:8080/api/v1"

echo "Testing PEM File Upload and Server Creation..."
echo "=============================================="

# First, let's create a sample PEM file for testing
echo "Creating sample PEM file..."
cat > sample.pem << 'EOF'
-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----

EOF

echo "Sample PEM file created: sample.pem"

# Step 1: Upload PEM file
echo ""
echo "Step 1: Uploading PEM file..."
UPLOAD_RESPONSE=$(curl -s -X POST \
  -F "pem_file=@sample.pem" \
  "$BASE_URL/pem-files/upload")

echo "Upload response: $UPLOAD_RESPONSE"

# Extract the pem_file_url from the response
PEM_FILE_URL=$(echo $UPLOAD_RESPONSE | grep -o '"pem_file_url":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PEM_FILE_URL" ]; then
    echo "❌ Failed to upload PEM file or extract URL"
    exit 1
fi

echo "✅ PEM file uploaded successfully!"
echo "PEM File URL: $PEM_FILE_URL"

# Step 2: Create server using the uploaded PEM file
echo ""
echo "Step 2: Creating server with uploaded PEM file..."

SERVER_PAYLOAD=$(cat << EOF
{
    "name": "billa-server-2",
    "hostname": "20.193.249.175",
    "port": 22,
    "user": "billa",
    "auth_type": "key",
    "pem_file_url": "$PEM_FILE_URL",
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
    exit 1
fi

echo "✅ Server created successfully!"
echo "Server ID: $SERVER_ID"

# Step 3: Test server connection (this will test PEM file download)
echo ""
echo "Step 3: Testing server connection (this will test PEM file download)..."

TEST_RESPONSE=$(curl -s -X POST "$BASE_URL/servers/$SERVER_ID/test")
echo "Connection test response: $TEST_RESPONSE"

# Step 4: List servers to verify
echo ""
echo "Step 4: Listing all servers..."
LIST_RESPONSE=$(curl -s "$BASE_URL/servers")
echo "Servers list: $LIST_RESPONSE"

# Cleanup
echo ""
echo "Cleaning up..."
rm -f sample.pem

echo ""
echo "✅ Test completed! Check the responses above for success/failure status."
echo ""
echo "Key features tested:"
echo "1. ✅ PEM file upload to object storage"
echo "2. ✅ Server creation with PEM file URL"
echo "3. ✅ Connection test (downloads PEM from storage)"
echo "4. ✅ Server listing with PEM file URL"
echo ""
echo "Note: The connection test may fail if AWS S3 is not configured or"
echo "      if the sample PEM file is not a valid SSH key."
