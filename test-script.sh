#!/bin/bash

# Test Shell Script for Job Executor
# This script demonstrates various shell commands and features

echo "=== System Information Test Script ==="
echo "Timestamp: $(date)"
echo

# Check system information
echo "1. System Information:"
echo "   Hostname: $(hostname)"
echo "   Uptime: $(uptime)"
echo "   Kernel: $(uname -r)"
echo

# Check disk usage
echo "2. Disk Usage:"
df -h | head -5
echo

# Check memory usage
echo "3. Memory Usage:"
free -h
echo

# List running processes (top 10)
echo "4. Top 10 Running Processes:"
ps aux --sort=-%cpu | head -11
echo

# Check network interfaces
echo "5. Network Interfaces:"
ip addr show | grep -E '^[0-9]+:|inet ' | head -10
echo

# Test file operations
echo "6. Creating test files:"
TEST_DIR="/tmp/job-executor-test-$$"
mkdir -p "$TEST_DIR"
echo "Created directory: $TEST_DIR"

for i in {1..3}; do
    echo "Test file content $i" > "$TEST_DIR/test$i.txt"
    echo "Created: $TEST_DIR/test$i.txt"
done

echo
echo "7. Listing test files:"
ls -la "$TEST_DIR"
echo

# Cleanup
echo "8. Cleaning up test files:"
rm -rf "$TEST_DIR"
echo "Removed directory: $TEST_DIR"
echo

# Test with arguments if provided
if [ $# -gt 0 ]; then
    echo "9. Script arguments provided:"
    for i in "$@"; do
        echo "   Argument: $i"
    done
    echo
fi

# Test environment variables
echo "10. Environment Variables:"
echo "    USER: $USER"
echo "    HOME: $HOME"
echo "    PATH: ${PATH:0:100}..."
echo

echo "=== Test Script Completed Successfully ==="
echo "Exit code: 0"
