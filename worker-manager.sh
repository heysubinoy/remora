#!/bin/bash

# Worker Startup and Monitoring Script
# This script helps start the system and monitor worker status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

COMPOSE_CMD="docker-compose"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local url=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 3 "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Function to check worker health
check_worker_health() {
    print_status "Checking worker health..."
    
    # Check if worker container is running
    if docker ps | grep -q job-executor-worker; then
        print_success "Worker container is running"
        
        # Check worker processes inside container
        if docker exec job-executor-worker pgrep -f job-executor-worker > /dev/null 2>&1; then
            print_success "Worker process is active"
        else
            print_error "Worker process is not running inside container"
            return 1
        fi
        
        # Check network connectivity
        if docker exec job-executor-worker nc -z netqueue 9000 2>/dev/null; then
print_success "Worker can reach NetQueue"
else
print_error "Worker cannot reach NetQueue"
return 1
fi
        
        if docker exec job-executor-worker nc -z postgres 5432 2>/dev/null; then
            print_success "Worker can reach PostgreSQL"
        else
            print_error "Worker cannot reach PostgreSQL"
            return 1
        fi
        
        return 0
    else
        print_error "Worker container is not running"
        return 1
    fi
}

# Function to show worker logs
show_worker_logs() {
    print_status "Recent worker logs:"
    echo "----------------------------------------"
    docker logs --tail 50 job-executor-worker 2>/dev/null || print_error "Could not retrieve worker logs"
    echo "----------------------------------------"
}

# Function to run diagnostics
run_diagnostics() {
    print_status "Running comprehensive diagnostics..."
    
    if [ -f "./diagnose-worker.sh" ]; then
        chmod +x ./diagnose-worker.sh
        ./diagnose-worker.sh
    else
        print_warning "diagnose-worker.sh not found, running basic checks..."
        
        # Basic API health check
        if curl -s http://localhost:8080/health > /dev/null; then
            print_success "API is responding"
        else
            print_error "API is not responding"
        fi
        
        # Basic NetQueue check
if curl -s http://localhost:9000/health > /dev/null; then
print_success "NetQueue health endpoint is accessible"
else
print_error "NetQueue health endpoint is not accessible"
fi
    fi
}

# Function to restart worker only
restart_worker() {
    print_status "Restarting worker container..."
    
    $COMPOSE_CMD stop job-executor-worker
    $COMPOSE_CMD rm -f job-executor-worker
    $COMPOSE_CMD up -d job-executor-worker
    
    # Wait for worker to be ready
    sleep 5
    check_worker_health
}

# Function to show worker debug info
worker_debug() {
    print_status "Worker debug information:"
    
    echo ""
    print_status "Container status:"
    docker ps --filter "name=job-executor"
    
    echo ""
    print_status "Worker container details:"
    docker inspect job-executor-worker --format='{{json .State}}' 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "Could not get container details"
    
    echo ""
    print_status "Running debug script inside worker container:"
    docker exec job-executor-worker /debug.sh 2>/dev/null || echo "Debug script not available"
    
    echo ""
    show_worker_logs
}

# Main function
main() {
    case "${1:-status}" in
        "start")
            print_status "Starting Job Executor system..."
            $COMPOSE_CMD up -d
            
            # Wait for services
            wait_for_service "API" "http://localhost:8080/health"
            wait_for_service "NetQueue" "http://localhost:9000/health"
            
            # Check worker health
            sleep 10
            check_worker_health
            ;;
            
        "stop")
            print_status "Stopping Job Executor system..."
            $COMPOSE_CMD down
            ;;
            
        "restart")
            print_status "Restarting Job Executor system..."
            $COMPOSE_CMD down
            $COMPOSE_CMD up -d
            wait_for_service "API" "http://localhost:8080/health"
            check_worker_health
            ;;
            
        "restart-worker")
            restart_worker
            ;;
            
        "status")
            print_status "Checking system status..."
            check_worker_health
            ;;
            
        "logs")
            show_worker_logs
            ;;
            
        "debug")
            worker_debug
            ;;
            
        "diagnose")
            run_diagnostics
            ;;
            
        "monitor")
            print_status "Monitoring worker logs (Ctrl+C to stop)..."
            docker logs -f job-executor-worker
            ;;
            
        *)
            echo "Usage: $0 {start|stop|restart|restart-worker|status|logs|debug|diagnose|monitor}"
            echo ""
            echo "Commands:"
            echo "  start         - Start the entire system"
            echo "  stop          - Stop the entire system"
            echo "  restart       - Restart the entire system"
            echo "  restart-worker- Restart only the worker container"
            echo "  status        - Check worker health status"
            echo "  logs          - Show recent worker logs"
            echo "  debug         - Show detailed worker debug information"
            echo "  diagnose      - Run comprehensive diagnostics"
            echo "  monitor       - Monitor worker logs in real-time"
            exit 1
            ;;
    esac
}

main "$@"
