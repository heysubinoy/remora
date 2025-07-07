#!/bin/bash

# Startup script for decoupled job executor services
# Requires RabbitMQ to be running (use docker-compose up rabbitmq)

set -e

# Export environment variables
export RABBITMQ_URL=${RABBITMQ_URL:-"amqp://admin:password123@localhost:5672/job-executor"}
export DATABASE_URL=${DATABASE_URL:-"./jobs.db"}
export SERVER_ADDR=${SERVER_ADDR:-":8080"}

echo "=== Starting Decoupled Job Executor Services ==="
echo "RabbitMQ URL: $RABBITMQ_URL"
echo "Database URL: $DATABASE_URL"
echo "Server Address: $SERVER_ADDR"

# Check if RabbitMQ is running
echo "Checking RabbitMQ connection..."
if ! curl -s -u admin:password123 http://localhost:15672/api/whoami > /dev/null; then
    echo "Error: RabbitMQ is not running. Please start it with: docker-compose up rabbitmq"
    exit 1
fi

echo "RabbitMQ is running!"

# Build binaries if they don't exist
if [ ! -f "bin/job-executor-api" ] || [ ! -f "bin/job-executor-worker" ]; then
    echo "Building binaries..."
    go build -o bin/job-executor-api ./cmd/api
    go build -o bin/job-executor-worker ./cmd/worker
fi

# Start worker in background
echo "Starting worker..."
./bin/job-executor-worker &
WORKER_PID=$!

# Start API server in background
echo "Starting API server..."
./bin/job-executor-api &
API_PID=$!

echo "Services started!"
echo "Worker PID: $WORKER_PID"
echo "API PID: $API_PID"
echo "API available at: http://localhost:8080"
echo "RabbitMQ Management UI: http://localhost:15672 (admin/password123)"

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    kill $WORKER_PID $API_PID 2>/dev/null || true
    wait
    echo "Services stopped."
}

trap cleanup EXIT

echo "Press Ctrl+C to stop all services..."
wait
