#!/bin/bash

# Job Executor Test Runner
# Automatically detects environment and runs appropriate test script

echo "🚀 Job Executor Comprehensive Test Runner"
echo "========================================="
echo ""

# Check if we're in a Git Bash/WSL environment on Windows or native Linux/macOS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "🪟 Detected Windows Git Bash environment"
    echo "📝 Running bash version of the test..."
    echo ""
    
    if [ -f "examples/comprehensive-job-test.sh" ]; then
        bash examples/comprehensive-job-test.sh
    else
        echo "❌ Test script not found: examples/comprehensive-job-test.sh"
        exit 1
    fi
    
elif [[ "$OS" == "Windows_NT" ]]; then
    echo "🪟 Detected Windows CMD environment"
    echo "📝 Running batch version of the test..."
    echo ""
    
    if [ -f "examples/comprehensive-job-test.bat" ]; then
        cmd.exe /c "examples\\comprehensive-job-test.bat"
    else
        echo "❌ Test script not found: examples/comprehensive-job-test.bat"
        exit 1
    fi
    
else
    echo "🐧 Detected Unix-like environment (Linux/macOS)"
    echo "📝 Running bash version of the test..."
    echo ""
    
    if [ -f "examples/comprehensive-job-test.sh" ]; then
        bash examples/comprehensive-job-test.sh
    else
        echo "❌ Test script not found: examples/comprehensive-job-test.sh"
        exit 1
    fi
fi
