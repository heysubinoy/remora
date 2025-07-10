#!/bin/bash

# Remote Worker Diagnostic Script
# This script helps diagnose worker issues in Docker remote environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
RABBITMQ_URL="${RABBITMQ_URL:-http://localhost:15672}"
RABBITMQ_USER="${RABBITMQ_USER:-admin}"
RABBITMQ_PASS="${RABBITMQ_PASS:-password123}"

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if a service is responding
check_service() {
    local url=$1
    local name=$2
    
    if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
        print_success "$name is responding"
        return 0
    else
        print_error "$name is not responding"
        return 1
    fi
}

# Function to check Docker container status
check_container() {
    local container_name=$1
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "$container_name"; then
        local status=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep "$container_name" | awk '{print $2,$3,$4}')
        print_success "$container_name: $status"
        return 0
    else
        print_error "$container_name is not running"
        return 1
    fi
}

# Main diagnostic function
main() {
    print_header "Remote Worker Environment Diagnostic"
    echo "Base URL: $BASE_URL"
    echo "RabbitMQ URL: $RABBITMQ_URL"
    echo ""

    # 1. Check Docker containers
    print_header "Container Status Check"
    check_container "job-executor-api" || true
    check_container "job-executor-worker" || true
    check_container "job-executor-rabbitmq" || true
    check_container "job-executor-postgres" || true

    # 2. Check service connectivity
    print_header "Service Connectivity Check"
    check_service "$BASE_URL/health" "API Health Endpoint" || true
    check_service "$RABBITMQ_URL/api/overview" "RabbitMQ Management" || true

    # 3. Check API debug endpoints
    print_header "API Debug Information"
    
    print_info "Checking API health..."
    if curl -s "$BASE_URL/debug/health" > /tmp/api_health.json 2>/dev/null; then
        echo "Database Status: $(cat /tmp/api_health.json | python3 -c "import sys, json; print(json.load(sys.stdin)['database'])" 2>/dev/null || echo "unknown")"
        echo "Queue Status: $(cat /tmp/api_health.json | python3 -c "import sys, json; print(json.load(sys.stdin)['queue'])" 2>/dev/null || echo "unknown")"
        echo "Queue Type: $(cat /tmp/api_health.json | python3 -c "import sys, json; print(json.load(sys.stdin)['queue_type'])" 2>/dev/null || echo "unknown")"
    else
        print_error "Could not retrieve API health information"
    fi

    print_info "Checking queue status..."
    if curl -s "$BASE_URL/debug/queue" > /tmp/queue_status.json 2>/dev/null; then
        echo "Pending Jobs: $(cat /tmp/queue_status.json | python3 -c "import sys, json; print(json.load(sys.stdin)['pending_jobs'])" 2>/dev/null || echo "unknown")"
        echo "Running Jobs: $(cat /tmp/queue_status.json | python3 -c "import sys, json; print(json.load(sys.stdin)['running_jobs'])" 2>/dev/null || echo "unknown")"
        echo "Total Jobs: $(cat /tmp/queue_status.json | python3 -c "import sys, json; print(json.load(sys.stdin)['total_jobs'])" 2>/dev/null || echo "unknown")"
    else
        print_error "Could not retrieve queue status"
    fi

    # 4. Check RabbitMQ status
    print_header "RabbitMQ Status Check"
    
    print_info "Checking RabbitMQ overview..."
    if curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASS" "$RABBITMQ_URL/api/overview" > /tmp/rabbitmq_overview.json 2>/dev/null; then
        echo "RabbitMQ Version: $(cat /tmp/rabbitmq_overview.json | python3 -c "import sys, json; print(json.load(sys.stdin)['rabbitmq_version'])" 2>/dev/null || echo "unknown")"
        echo "Message Stats: $(cat /tmp/rabbitmq_overview.json | python3 -c "import sys, json; print(json.load(sys.stdin).get('message_stats', {}))" 2>/dev/null || echo "unknown")"
    else
        print_error "Could not retrieve RabbitMQ overview"
    fi

    print_info "Checking RabbitMQ queues..."
    if curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASS" "$RABBITMQ_URL/api/queues" > /tmp/rabbitmq_queues.json 2>/dev/null; then
        echo "Available Queues:"
        python3 -c "
import sys, json
try:
    queues = json.load(open('/tmp/rabbitmq_queues.json'))
    for queue in queues:
        print(f\"  - {queue['name']}: {queue.get('messages', 0)} messages, {queue.get('consumers', 0)} consumers\")
except:
    print('  Could not parse queue information')
" 2>/dev/null || echo "  Could not retrieve queue details"
    else
        print_error "Could not retrieve RabbitMQ queue information"
    fi

    # 5. Check worker logs
    print_header "Worker Container Logs"
    
    print_info "Recent worker logs (last 20 lines):"
    if docker logs --tail 20 job-executor-worker 2>/dev/null; then
        print_success "Worker logs retrieved"
    else
        print_error "Could not retrieve worker logs"
    fi

    # 6. Check container network connectivity
    print_header "Container Network Connectivity"
    
    print_info "Testing worker -> RabbitMQ connectivity..."
    if docker exec job-executor-worker sh -c "nc -z rabbitmq 5672" 2>/dev/null; then
        print_success "Worker can reach RabbitMQ"
    else
        print_error "Worker cannot reach RabbitMQ"
    fi

    print_info "Testing worker -> PostgreSQL connectivity..."
    if docker exec job-executor-worker sh -c "nc -z postgres 5432" 2>/dev/null; then
        print_success "Worker can reach PostgreSQL"
    else
        print_error "Worker cannot reach PostgreSQL"
    fi

    # 7. Submit test job
    print_header "Test Job Submission"
    
    print_info "Submitting test job..."
    
    # First, check if we have any servers configured
    if curl -s "$BASE_URL/api/v1/servers" > /tmp/servers.json 2>/dev/null; then
        server_count=$(cat /tmp/servers.json | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('servers', [])))" 2>/dev/null || echo "0")
        
        if [ "$server_count" -gt 0 ]; then
            server_id=$(cat /tmp/servers.json | python3 -c "import sys, json; servers = json.load(sys.stdin).get('servers', []); print(servers[0]['id'] if servers else '')" 2>/dev/null || echo "")
            
            if [ -n "$server_id" ]; then
                print_info "Found server with ID: $server_id"
                
                # Submit a simple test job
                test_job_response=$(curl -s -X POST "$BASE_URL/api/v1/jobs" \
                    -H "Content-Type: application/json" \
                    -d "{
                        \"command\": \"echo\",
                        \"args\": \"Worker test at $(date)\",
                        \"server_id\": \"$server_id\",
                        \"timeout\": 30,
                        \"priority\": 5
                    }" 2>/dev/null || echo "")
                
                if [ -n "$test_job_response" ]; then
                    job_id=$(echo "$test_job_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['job']['id'])" 2>/dev/null || echo "")
                    if [ -n "$job_id" ]; then
                        print_success "Test job submitted with ID: $job_id"
                        
                        # Wait a bit and check job status
                        sleep 3
                        job_status=$(curl -s "$BASE_URL/api/v1/jobs/$job_id" | python3 -c "import sys, json; print(json.load(sys.stdin)['job']['status'])" 2>/dev/null || echo "unknown")
                        print_info "Test job status: $job_status"
                        
                        if [ "$job_status" = "completed" ]; then
                            print_success "Test job completed successfully!"
                        elif [ "$job_status" = "running" ] || [ "$job_status" = "queued" ]; then
                            print_warning "Test job is still $job_status - worker may be slow"
                        else
                            print_error "Test job failed with status: $job_status"
                        fi
                    else
                        print_error "Could not extract job ID from response"
                    fi
                else
                    print_error "Failed to submit test job"
                fi
            else
                print_error "Could not extract server ID"
            fi
        else
            print_warning "No servers configured - cannot submit test job"
            print_info "Please configure a server first using the API or web interface"
        fi
    else
        print_error "Could not retrieve server list"
    fi

    # 8. Summary
    print_header "Diagnostic Summary"
    
    print_info "If worker is not processing jobs, check:"
    echo "  1. Container logs: docker logs job-executor-worker"
    echo "  2. RabbitMQ connectivity from worker container"
    echo "  3. Database connectivity from worker container"
    echo "  4. Environment variables in worker container"
    echo "  5. Worker binary is running inside container"
    
    print_info "Common issues in remote environments:"
    echo "  - Network connectivity between containers"
    echo "  - Environment variables not set correctly"
    echo "  - RabbitMQ authentication problems"
    echo "  - Database connection string issues"
    echo "  - Firewall blocking container communication"
    
    # Cleanup
    rm -f /tmp/api_health.json /tmp/queue_status.json /tmp/rabbitmq_overview.json /tmp/rabbitmq_queues.json /tmp/servers.json
    
    print_header "Diagnostic Complete"
}

# Run the diagnostic
main "$@"
