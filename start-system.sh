 #!/bin/bash
# Job Executor - Unified Docker Compose Startup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Function to create required directories
create_directories() {
    print_status "Creating required directories..."
    mkdir -p data
    mkdir -p pem-files
    mkdir -p ssl
    print_success "Directories created"
}

# Function to start the system
start_system() {
    print_status "Starting Job Executor system..."
    
    # Use docker-compose if available, otherwise use docker compose
    if command -v docker-compose > /dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Start core services (without nginx by default)
    print_status "Starting core services (PostgreSQL, RabbitMQ, API, Worker, Frontend)..."
    $COMPOSE_CMD up -d postgres rabbitmq job-executor-api job-executor-worker job-executor-frontend
    
    print_status "Waiting for services to be healthy..."
    sleep 10
    
    # Check service health
    print_status "Checking service health..."
    $COMPOSE_CMD ps
    
    print_success "Job Executor system started successfully!"
    echo
    print_status "Service URLs:"
    echo "  🌐 Frontend (Next.js):     http://localhost:3000"
    echo "  🔗 API Server:             http://localhost:8080"
    echo "  📊 RabbitMQ Management:    http://localhost:15672 (admin/password123)"
    echo "  🗄️  PostgreSQL:            localhost:5432 (jobexecutor/password123)"
    echo
    print_status "To start with Nginx reverse proxy (production mode):"
    echo "  $COMPOSE_CMD --profile production up -d"
    echo
    print_status "To view logs:"
    echo "  $COMPOSE_CMD logs -f [service-name]"
    echo
    print_status "To stop the system:"
    echo "  $COMPOSE_CMD down"
}

# Function to stop the system
stop_system() {
    print_status "Stopping Job Executor system..."
    
    if command -v docker-compose > /dev/null 2>&1; then
        docker-compose down
    else
        docker compose down
    fi
    
    print_success "Job Executor system stopped"
}

# Function to show logs
show_logs() {
    local service=${1:-""}
    
    if command -v docker-compose > /dev/null 2>&1; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    if [ -n "$service" ]; then
        print_status "Showing logs for $service..."
        $COMPOSE_CMD logs -f "$service"
    else
        print_status "Showing logs for all services..."
        $COMPOSE_CMD logs -f
    fi
}

# Function to show system status
show_status() {
    print_status "Job Executor System Status:"
    
    if command -v docker-compose > /dev/null 2>&1; then
        docker-compose ps
    else
        docker compose ps
    fi
}

# Function to reset the system (removes all data)
reset_system() {
    print_warning "This will stop all services and remove all data (databases, volumes, etc.)"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Resetting Job Executor system..."
        
        if command -v docker-compose > /dev/null 2>&1; then
            docker-compose down -v --remove-orphans
        else
            docker compose down -v --remove-orphans
        fi
        
        # Remove local data directories
        rm -rf data/*
        rm -rf pem-files/*
        
        print_success "System reset complete"
    else
        print_status "Reset cancelled"
    fi
}

# Main script logic
case "${1:-start}" in
    "start")
        check_docker
        check_docker_compose
        create_directories
        start_system
        ;;
    "stop")
        stop_system
        ;;
    "restart")
        stop_system
        sleep 5
        check_docker
        check_docker_compose
        create_directories
        start_system
        ;;
    "logs")
        show_logs "$2"
        ;;
    "status")
        show_status
        ;;
    "reset")
        reset_system
        ;;
    "help"|"-h"|"--help")
        echo "Job Executor - Unified Docker Compose Management"
        echo
        echo "Usage: $0 [COMMAND] [OPTIONS]"
        echo
        echo "Commands:"
        echo "  start          Start the Job Executor system (default)"
        echo "  stop           Stop the Job Executor system"
        echo "  restart        Restart the Job Executor system"
        echo "  logs [service] Show logs for all services or specific service"
        echo "  status         Show system status"
        echo "  reset          Reset system (removes all data)"
        echo "  help           Show this help message"
        echo
        echo "Examples:"
        echo "  $0 start                    # Start the system"
        echo "  $0 logs job-executor-api    # Show API logs"
        echo "  $0 logs                     # Show all logs"
        echo "  $0 status                   # Show system status"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
