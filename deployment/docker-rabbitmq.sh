#!/bin/bash

# Docker Compose Management Script for Job Executor RabbitMQ

show_help() {
    cat << EOF
Docker Compose Management for Job Executor RabbitMQ
===================================================

Usage: $0 [command]

Commands:
  start     - Start RabbitMQ service
  stop      - Stop RabbitMQ service  
  restart   - Restart RabbitMQ service
  status    - Show service status
  logs      - Show RabbitMQ logs
  clean     - Stop and remove all containers and volumes
  help      - Show this help

RabbitMQ Management UI: http://localhost:15672
Default credentials: admin / password123
EOF
}

start_rabbitmq() {
    echo "Starting RabbitMQ service..."
    if docker-compose up -d rabbitmq; then
        echo "✅ RabbitMQ service started successfully"
        echo ""
        echo "Waiting for RabbitMQ to be ready..."
        sleep 10
        echo ""
        echo "🎯 RabbitMQ Management UI: http://localhost:15672"
        echo "👤 Username: admin"
        echo "🔑 Password: password123"
        echo ""
        echo "To connect from Job Executor, use:"
        echo "export RABBITMQ_URL=amqp://admin:password123@localhost:5672/job-executor"
    else
        echo "❌ Failed to start RabbitMQ service"
        exit 1
    fi
}

stop_rabbitmq() {
    echo "Stopping RabbitMQ service..."
    docker-compose stop rabbitmq
    echo "✅ RabbitMQ service stopped"
}

restart_rabbitmq() {
    echo "Restarting RabbitMQ service..."
    docker-compose restart rabbitmq
    echo "✅ RabbitMQ service restarted"
}

show_status() {
    echo "Service Status:"
    echo "==============="
    docker-compose ps
}

show_logs() {
    echo "RabbitMQ Logs:"
    echo "=============="
    docker-compose logs -f rabbitmq
}

clean_all() {
    echo "⚠️  WARNING: This will remove all RabbitMQ data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping and removing containers and volumes..."
        docker-compose down -v
        echo "✅ Cleanup complete"
    else
        echo "Cancelled"
    fi
}

# Main script logic
case "${1:-help}" in
    start)
        start_rabbitmq
        ;;
    stop)
        stop_rabbitmq
        ;;
    restart)
        restart_rabbitmq
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    clean)
        clean_all
        ;;
    help|*)
        show_help
        ;;
esac
