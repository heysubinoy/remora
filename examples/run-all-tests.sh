#!/bin/bash

# Test Runner for New Remora Architecture
# Runs all tests in sequence
# Author: GitHub Copilot
# Date: 2025-01-XX

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

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log() {
    echo -e "${BLUE}📋 $1${NC}"
}

clear
echo ""
echo "🚀 New Remora Architecture Test Suite"
echo "====================================="
echo ""

# Check if PEM file exists
if [ ! -f "test-server.pem" ]; then
    error "test-server.pem file not found!"
    echo ""
    echo "Please create the PEM file:"
    echo "1. Copy your SSH private key to this directory"
    echo "2. Rename it to 'test-server.pem'"
    echo "3. Set permissions: chmod 400 test-server.pem"
    echo ""
    echo "Example:"
    echo "  cp ~/.ssh/my-key.pem ./test-server.pem"
    echo "  chmod 400 test-server.pem"
    echo ""
    exit 1
fi

# Check PEM file permissions
if [ "$(stat -c %a test-server.pem 2>/dev/null || stat -f %Lp test-server.pem 2>/dev/null)" != "400" ]; then
    warning "PEM file permissions should be 400 for security"
    echo "Setting permissions: chmod 400 test-server.pem"
    chmod 400 test-server.pem
fi

success "PEM file found and permissions set correctly"

# Check if API is running
info "Checking API connectivity..."
API_RESPONSE=$(curl -s "http://localhost:8080/api/v1/health" 2>/dev/null || echo "error")
if [[ "$API_RESPONSE" == *"error"* ]] || [ -z "$API_RESPONSE" ]; then
    error "API is not responding at http://localhost:8080"
    error "Please ensure the API server is running"
    exit 1
fi
success "API is responding"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_file="$2"
    
    echo ""
    log "Running: $test_name"
    log "=========================================="
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$test_file" ]; then
        if bash "$test_file"; then
            success "✅ $test_name PASSED"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            error "❌ $test_name FAILED"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        error "❌ Test file not found: $test_file"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
    echo "Press Enter to continue to next test..."
    read -r
}

# Run tests in order
echo ""
info "Starting test suite..."
echo ""

# 1. Quick System Test (basic functionality)
run_test "Quick System Test" "quick-system-test.sh"

# 2. NetQueue Architecture Test
run_test "NetQueue Architecture Test" "test-netqueue-architecture.sh"

# 3. Polling Architecture Test
run_test "Polling Architecture Test" "test-polling-architecture.sh"

# 4. Concurrent Job Limits Test
run_test "Concurrent Job Limits Test" "test-concurrent-limits.sh"

# 5. Comprehensive Architecture Test
run_test "Comprehensive Architecture Test" "test-comprehensive-architecture.sh"

# Final Results
echo ""
log "Test Suite Results"
log "=================="

echo ""
info "Test Summary:"
info "  - Total tests run: $TOTAL_TESTS"
info "  - Tests passed: $PASSED_TESTS"
info "  - Tests failed: $FAILED_TESTS"

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    success "🎉 ALL TESTS PASSED! ($PASSED_TESTS/$TOTAL_TESTS)"
    success ""
    success "The New Remora architecture is working perfectly!"
    success "✅ NetQueue TCP-based message queue"
    success "✅ Polling-based real-time updates"
    success "✅ Semaphore-based concurrent job limits"
    success "✅ Queued and running job cancellation"
    success "✅ Priority-based job processing"
    success "✅ Real-time job monitoring"
    success ""
    success "System is ready for production deployment!"
else
    error "❌ SOME TESTS FAILED! ($PASSED_TESTS/$TOTAL_TESTS passed, $FAILED_TESTS failed)"
    error ""
    error "Please review the failed tests above and check:"
    error "1. API server is running on port 8080"
    error "2. Worker is running and connected"
    error "3. NetQueue server is running (if applicable)"
    error "4. PEM file is correctly configured"
    error "5. Test server is accessible"
fi

echo ""
info "Test files created:"
info "  - quick-system-test.sh (basic functionality)"
info "  - test-netqueue-architecture.sh (queue system)"
info "  - test-polling-architecture.sh (real-time updates)"
info "  - test-concurrent-limits.sh (job limits)"
info "  - test-comprehensive-architecture.sh (all features)"
info "  - run-all-tests.sh (this test runner)"
echo "" 