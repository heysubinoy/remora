#!/bin/bash

# Test Pagination and Search API

BASE_URL="http://localhost:8080/api/v1"

echo "=== Testing Job List API with Pagination and Search ==="

echo "1. Test basic pagination (page 1, limit 5):"
curl -s "${BASE_URL}/jobs?page=1&limit=5" | jq '.pagination'

echo -e "\n2. Test search functionality:"
curl -s "${BASE_URL}/jobs?search=docker" | jq '.jobs[].command'

echo -e "\n3. Test status filter:"
curl -s "${BASE_URL}/jobs?status=completed" | jq '.jobs[].status'

echo -e "\n4. Test sorting:"
curl -s "${BASE_URL}/jobs?sort_by=created_at&sort_order=asc" | jq '.jobs[0].created_at'

echo -e "\n5. Test combined filters:"
curl -s "${BASE_URL}/jobs?page=1&limit=3&search=system&status=completed&sort_by=created_at&sort_order=desc" | jq '{pagination, filters}'

echo -e "\n=== Test completed ==="
