#!/bin/bash

# Sample shell script for job executor
# This script demonstrates various shell operations

echo "=== Sample Script Execution ==="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Working directory: $(pwd)"

# Check if arguments were provided
if [ $# -gt 0 ]; then
    echo "Arguments provided: $@"
    for arg in "$@"; do
        echo "  - $arg"
    done
else
    echo "No arguments provided"
fi

# Perform some basic operations
echo ""
echo "=== System Information ==="
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime)"
echo "Disk usage:"
df -h | head -5

# Create a temporary file and write to it
temp_file="/tmp/job-executor-test-$(date +%s).txt"
echo "Creating temporary file: $temp_file"
echo "This is a test file created by job executor" > "$temp_file"
echo "File content:"
cat "$temp_file"

# Clean up
rm -f "$temp_file"
echo "Temporary file cleaned up"

echo "=== Script execution completed ==="
exit 0
