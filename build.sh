#!/bin/bash

# Build API server
echo "Building API server..."
go build -o bin/job-executor-api ./cmd/api

# Build Worker
echo "Building Worker..."
go build -o bin/job-executor-worker ./cmd/worker

echo "Build complete!"
echo "API server: bin/job-executor-api"
echo "Worker: bin/job-executor-worker"
