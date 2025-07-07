#!/bin/bash

# Example: Upload PEM file and create server configuration
# This script demonstrates how to use the new PEM file upload feature

BASE_URL="http://localhost:8080/api/v1"

# Check if PEM file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-pem-file>"
    echo "Example: $0 ./my-server.pem"
    exit 1
fi

PEM_FILE="$1"

if [ ! -f "$PEM_FILE" ]; then
    echo "Error: PEM file '$PEM_FILE' not found"
    exit 1
fi

echo "Uploading PEM file: $PEM_FILE"

# Upload PEM file
UPLOAD_RESPONSE=$(curl -s -X POST \
    -F "pem_file=@$PEM_FILE" \
    "$BASE_URL/pem-files/upload")

echo "Upload response: $UPLOAD_RESPONSE"

# Extract PEM file URL from response
PEM_FILE_URL=$(echo "$UPLOAD_RESPONSE" | grep -o '"pem_file_url":"[^"]*' | cut -d'"' -f4)

if [ -z "$PEM_FILE_URL" ]; then
    echo "Error: Failed to upload PEM file"
    exit 1
fi

echo "PEM file uploaded successfully: $PEM_FILE_URL"

# Create server configuration using the uploaded PEM file
echo "Creating server configuration..."

SERVER_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"example-server\",
        \"hostname\": \"example.com\",
        \"port\": 22,
        \"user\": \"ubuntu\",
        \"auth_type\": \"key\",
        \"pem_file_url\": \"$PEM_FILE_URL\"
    }" \
    "$BASE_URL/servers")

echo "Server creation response: $SERVER_RESPONSE"

# Extract server ID
SERVER_ID=$(echo "$SERVER_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$SERVER_ID" ]; then
    echo "Server created successfully with ID: $SERVER_ID"
    
    # Test the connection (optional)
    echo "Testing server connection..."
    curl -s -X POST "$BASE_URL/servers/$SERVER_ID/test" | jq '.' || echo "$?"
else
    echo "Error: Failed to create server"
fi
