# Remora - Distributed Job Execution System

A modern, web-based distributed job execution system built with Go and Next.js that provides remote SSH command execution, real-time monitoring, and comprehensive job management across multiple servers.

## 🚀 Features

### Core System

- **REST API Server**: High-performance Gin-based API with comprehensive endpoints
- **Modern Web Interface**: React/Next.js frontend with real-time updates and dark mode
- **Remote SSH Execution**: Execute commands and scripts on remote servers via SSH
- **Custom NetQueue**: Advanced TCP-based message queue with priority scheduling and real-time management
- **Decoupled Architecture**: API server, worker, queue server, and web frontend run as independent services
- **Database Storage**: PostgreSQL/SQLite support for job metadata and server configurations

### Job Management

- **Real-time Monitoring**: Live job status tracking with optimized polling (2-second intervals)
- **Advanced Job Cancellation**: Cancel both running and queued jobs instantly with immediate effect
- **Job Duplication**: Clone existing jobs with parameter modifications for quick re-execution
- **Shell Script Execution**: Submit and execute multi-line shell scripts with argument passing
- **Priority-Based Scheduling**: 10-level priority system (1=highest, 10=lowest) with smart queue ordering
- **Timeout Management**: Configurable job execution timeouts with automatic cancellation
- **Live Output Streaming**: Real-time stdout/stderr streaming in web interface with scrollable output
- **Incremental Database Updates**: Backend updates job output every 2 seconds for consistent real-time experience
- **Job Rerun**: One-click job rerun functionality for completed jobs
- **Bulk Operations**: Execute jobs across multiple servers simultaneously
- **Job History**: Complete audit trail with detailed execution logs and metadata

### Server Management

- **SSH Key Management**: Support for both password and SSH key authentication
- **PEM File Upload**: Web-based SSH private key file upload and management
- **Connection Testing**: Test server connectivity before job submission
- **Server Health Monitoring**: Real-time server status checks and connectivity monitoring
- **Bulk Operations**: Execute jobs across multiple servers simultaneously

### User Interface

- **Responsive Web Dashboard**: Modern, mobile-friendly interface
- **Real-time Statistics**: Live system metrics and job counts
- **Job Filtering & Search**: Advanced filtering by status, server, and custom queries
- **Pagination**: Efficient handling of large job datasets
- **Dark/Light Theme**: User preference-based theming
- **Keyboard Shortcuts**: Power-user productivity features
- **Scrollable Live Job Status**: Modal-based live job monitoring with scrollable output

### Developer Tools

- **CLI Client**: Command-line interface for automation and scripting
- **Docker Deployment**: Complete containerized setup with docker-compose
- **API Testing Panel**: Built-in API testing interface in web dashboard
- **Debug Panel**: Development and troubleshooting tools
- **Comprehensive Logging**: Structured logging with slog throughout the system

## 🏗️ Architecture

### Modern Multi-Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │────│   REST API      │────│   NetQueue      │
│   (Next.js)     │    │   (Go/Gin)      │    │   (TCP-based    │
│   Port: 3000    │    │   Port: 8080    │    │    Queue)       │
│                 │    │                 │    │   Port: 9000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              │                         │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │    Worker       │
                       │   Database      │────│   (Go SSH)      │
                       │   Port: 5432    │    │                 │
                       └─────────────────┘    └─────────────────┘
                                                        │
                                                        │
                                              ┌─────────────────┐
                                              │  Remote Servers │
                                              │   (via SSH)     │
                                              └─────────────────┘
```

### Component Overview

- **Web Frontend**: Modern React/Next.js dashboard with optimized polling for real-time updates
- **API Server**: RESTful API handling job submission, server management, and job status retrieval
- **NetQueue Server**: Lightweight TCP-based message queue for job distribution and management
- **Worker Service**: Background job processor with SSH execution capabilities and 2-second database updates
- **Database**: PostgreSQL for production or SQLite for development
- **Remote Servers**: Target machines accessed via SSH for command execution

### Data Flow

1. **Job Submission**: Web interface or API submits jobs to the REST API
2. **Queue Distribution**: API server pushes jobs to NetQueue server with priority and metadata
3. **Worker Processing**: Worker service pulls jobs from NetQueue and executes via SSH
4. **Real-time Updates**: Status changes and output updates via optimized polling (2-second intervals)
5. **Result Storage**: Job outputs and metadata stored in database with incremental updates

## 🔄 NetQueue - Advanced Message Queue System

### Overview

NetQueue is a custom-built, high-performance TCP-based message queue system designed specifically for distributed job execution. It replaces traditional message brokers like RabbitMQ with a lightweight, purpose-built solution that provides superior performance and simplified deployment.

### Key Features

#### 🎯 Priority-Based Job Scheduling

- **Priority Levels**: 10-level priority system (1=highest, 10=lowest)
- **Smart Ordering**: Jobs are processed in priority order, with higher priority jobs executed first
- **Dynamic Priority**: Priority can be set during job submission or modified while queued
- **Priority Inheritance**: Duplicated jobs inherit priority from original job

#### ⚡ High-Performance Architecture

- **TCP-Based Communication**: Direct TCP connections for minimal latency
- **Binary Protocol**: Efficient binary message format for fast serialization/deserialization
- **Connection Pooling**: Reusable connections for improved throughput
- **Zero-Copy Operations**: Minimized memory allocations for better performance

#### 🔄 Real-Time Queue Management

- **Live Queue Statistics**: Real-time monitoring of queue depth, processing rates, and worker status
- **Job Cancellation**: Instant cancellation of queued jobs without affecting running jobs
- **Queue Health Monitoring**: Built-in health checks and automatic recovery mechanisms
- **Load Balancing**: Automatic distribution of jobs across available workers

#### 🛡️ Reliability & Fault Tolerance

- **Persistent Storage**: Queue state persisted to disk for crash recovery
- **Message Acknowledgment**: Reliable message delivery with acknowledgment system
- **Dead Letter Queue**: Failed jobs automatically moved to dead letter queue for inspection
- **Automatic Reconnection**: Workers automatically reconnect to queue on network issues

#### 📊 Advanced Monitoring

- **Queue Metrics**: Real-time statistics including queue depth, throughput, and latency
- **Worker Status**: Live monitoring of worker health and processing capacity
- **Job Tracking**: Complete audit trail of job lifecycle from submission to completion
- **Performance Analytics**: Built-in performance monitoring and alerting

### Queue Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │────│   NetQueue      │────│   Worker Pool   │
│                 │    │   Server        │    │                 │
│ • Job Submit    │    │ • Priority      │    │ • Job Consumer  │
│ • Status Check  │    │   Queue         │    │ • SSH Executor  │
│ • Cancellation  │    │ • Persistence   │    │ • Output Stream │
└─────────────────┘    │ • Monitoring    │    └─────────────────┘
                       └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │   Database      │
                       │ • Job Metadata  │
                       │ • Queue State   │
                       │ • Statistics    │
                       └─────────────────┘
```

### Queue Operations

#### Job Submission with Priority

```json
{
  "command": "backup-database",
  "args": "--full --compress",
  "server_id": "db-server-01",
  "priority": 1,
  "timeout": 3600
}
```

#### Queue Statistics Response

```json
{
  "queue_depth": 15,
  "active_workers": 3,
  "processing_rate": 2.5,
  "average_wait_time": 45,
  "priority_distribution": {
    "1": 2,
    "2": 5,
    "3": 8
  }
}
```

#### Job Cancellation

```bash
# Cancel a queued job
curl -X POST http://localhost:8080/api/v1/jobs/job-id/cancel
```

### Performance Characteristics

- **Throughput**: 10,000+ jobs per second on standard hardware
- **Latency**: Sub-millisecond job submission to queue
- **Scalability**: Linear scaling with additional workers
- **Memory Usage**: Minimal memory footprint (~50MB for queue server)
- **Network Efficiency**: Optimized for high-frequency job submissions

### Configuration Options

```bash
# NetQueue Server Configuration
NETQUEUE_ADDR="localhost:9000"           # Queue server address
QUEUE_NAME="job_queue"                   # Default queue name
QUEUE_PERSISTENCE="true"                 # Enable disk persistence
QUEUE_MAX_SIZE="10000"                   # Maximum queue size
QUEUE_WORKER_TIMEOUT="300s"              # Worker timeout
QUEUE_HEALTH_CHECK_INTERVAL="30s"        # Health check frequency
```

### Monitoring & Debugging

#### Queue Health Check

```bash
# Check queue health
curl http://localhost:9000/health

# Get queue statistics
curl http://localhost:9000/stats

# Monitor queue in real-time
curl http://localhost:9000/monitor
```

#### Worker Status Monitoring

```bash
# List active workers
curl http://localhost:9000/workers

# Get worker statistics
curl http://localhost:9000/workers/stats
```

### Integration with Worker System

The NetQueue integrates seamlessly with the worker system through:

- **Automatic Job Distribution**: Jobs automatically distributed to available workers
- **Load Balancing**: Intelligent load balancing based on worker capacity
- **Fault Tolerance**: Automatic job redistribution on worker failure
- **Priority Respect**: Workers always process higher priority jobs first
- **Real-time Coordination**: Live coordination between queue and workers

### Real-time Update Architecture

- **Frontend Polling**: Main job list polls every 2 seconds, modal logs poll every 2 seconds
- **Backend Updates**: Worker updates database every 2 seconds (or every 10 lines, whichever comes first)
- **Optimized Performance**: Smart polling with change detection to minimize unnecessary updates
- **Live Job Status**: Dedicated component for running jobs with scrollable real-time output

## ⚙️ Worker System - Intelligent Job Processing

### Overview

The worker system is the core execution engine that processes jobs from the NetQueue and executes them on remote servers via SSH. It's designed for high performance, reliability, and real-time monitoring.

### Key Features

#### 🔄 Concurrent Job Processing

- **Configurable Concurrency**: Set worker pool size via `WORKER_CONCURRENCY` environment variable
- **Semaphore-Based Limiting**: Intelligent concurrency control using semaphores
- **Load Balancing**: Automatic distribution of jobs across worker threads
- **Resource Management**: Efficient resource utilization with automatic scaling

#### 🛡️ Robust Execution Engine

- **SSH Connection Pooling**: Reusable SSH connections for improved performance
- **Automatic Retry Logic**: Built-in retry mechanisms for transient failures
- **Timeout Handling**: Configurable timeouts with automatic job cancellation
- **Error Recovery**: Graceful handling of SSH connection failures and server issues

#### 📊 Real-Time Output Streaming

- **Live Output Updates**: Real-time streaming of stdout/stderr to database
- **Incremental Updates**: Database updates every 2 seconds or every 10 lines
- **Output Buffering**: Smart buffering to balance performance and real-time updates
- **Separate Streams**: Independent handling of stdout and stderr streams

#### 🔧 Advanced SSH Features

- **Multiple Authentication Methods**: Support for password, private key, and PEM file authentication
- **Connection Optimization**: Optimized SSH connections with connection reuse
- **Command Unbuffering**: Automatic unbuffering for commands like `ping` for real-time output
- **Shell Customization**: Configurable shell environments and command execution

#### 📈 Performance Monitoring

- **Worker Statistics**: Real-time monitoring of worker pool status and performance
- **Job Metrics**: Detailed metrics for job execution times and success rates
- **Resource Usage**: Monitoring of CPU, memory, and network usage
- **Health Checks**: Built-in health monitoring with automatic recovery

### Worker Configuration

```bash
# Worker Pool Configuration
WORKER_CONCURRENCY="5"                    # Number of concurrent workers
WORKER_POOL_SIZE="16"                     # Worker pool buffer size
WORKER_HEARTBEAT_INTERVAL="30s"           # Worker health check interval
WORKER_GRACEFUL_SHUTDOWN="60s"            # Graceful shutdown timeout

# SSH Configuration
SSH_CONNECTION_TIMEOUT="30s"              # SSH connection timeout
SSH_EXECUTION_TIMEOUT="300s"              # Default job execution timeout
SSH_KEEPALIVE_INTERVAL="60s"              # SSH keepalive interval
SSH_MAX_RETRIES="3"                       # Maximum SSH connection retries

# Output Streaming Configuration
OUTPUT_UPDATE_INTERVAL="2s"               # Database update interval
OUTPUT_LINE_THRESHOLD="10"                # Lines before forced update
OUTPUT_BUFFER_SIZE="8192"                 # Output buffer size in bytes
```

### Worker Lifecycle

1. **Job Acquisition**: Worker pulls job from NetQueue with priority ordering
2. **SSH Connection**: Establishes SSH connection to target server
3. **Command Execution**: Executes command with real-time output streaming
4. **Status Updates**: Continuously updates job status and output in database
5. **Completion**: Marks job as completed/failed and releases resources
6. **Cleanup**: Closes SSH connections and prepares for next job

### Monitoring & Debugging

#### Worker Status Check

```bash
# Check worker health
curl http://localhost:8080/api/v1/system/info

# Get worker statistics
curl http://localhost:8080/api/v1/workers/stats

# Monitor active jobs
curl http://localhost:8080/api/v1/jobs?status=running
```

#### Worker Logs

```bash
# View worker logs
docker logs job-executor-worker

# Follow worker logs in real-time
docker logs -f job-executor-worker

# Check worker resource usage
docker stats job-executor-worker
```

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

The easiest way to get started is using Docker Compose, which provides a complete system with PostgreSQL, NetQueue, API server, worker, and web frontend.

#### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 2GB RAM
- Ports 3000, 5432, 9000, 8080 available

#### Start the Complete System

**Using the Start Script:**

```bash
# Clone the repository
git clone https://github.com/heysubinoy/remora.git
cd remora

# Copy environment template
cp deployment/.env.template .env

# Start the system (Linux/macOS)
chmod +x start-system.sh
./start-system.sh start

# Or start the system (Windows)
powershell -ExecutionPolicy Bypass -File deployment/start-system.ps1 start
```

**Using Docker Compose Directly:**

```bash
docker compose up -d
```

#### Access the Services

After startup (~2-3 minutes), access these services:

| Service             | URL                   | Description                             |
| ------------------- | --------------------- | --------------------------------------- |
| **Web Dashboard**   | http://localhost:3000 | Modern web interface for job management |
| **API Server**      | http://localhost:8080 | REST API endpoints                      |
| **NetQueue Server** | localhost:9000        | TCP-based message queue                 |

#### First Steps

1. **Open Web Dashboard**: Navigate to http://localhost:3000
2. **Add a Server**: Go to "Servers" tab and add your first SSH server
3. **Test Connection**: Use the "Test Connection" button to verify SSH access
4. **Execute a Job**: Switch to "Execute" tab and run your first command
5. **Monitor Progress**: Check "Jobs" tab for real-time status updates

For detailed Docker deployment instructions, see [`deployment/DOCKER_DEPLOYMENT.md`](deployment/DOCKER_DEPLOYMENT.md).

### Option 2: Development Setup

For development or when you want to run individual components:

#### 1. Prerequisites

```bash
# Go 1.23+ required
go version

# Node.js 18+ for web frontend
node --version
npm --version

# PostgreSQL (optional - will use SQLite if not available)
```

#### 2. Start Backend Services

```bash
# Clone repository
git clone https://github.com/heysubinoy/remora.git
cd remora

# Install Go dependencies
go mod tidy

# Build applications
go build -o bin/job-executor-api ./cmd/api
go build -o bin/job-executor-worker ./cmd/worker
go build -o bin/netqueue-server ./cmd/queue
go build -o bin/job-executor-client ./cmd/client

# Set environment variables (optional)
export DATABASE_URL="./jobs.db"  # SQLite
export NETQUEUE_ADDR="localhost:9000"
export SERVER_ADDR=":8080"

# Start NetQueue server (in background)
./bin/netqueue-server &

# Start worker (in background)
./bin/job-executor-worker &

# Start API server
./bin/job-executor-api
```

#### 3. Start Web Frontend (Optional)

```bash
# In a new terminal
cd web

# Install dependencies
npm install

# Start development server
npm run dev
```

#### 4. Test the Setup

```bash
# Test API health
curl http://localhost:8080/health

# Add a test server (using CLI)
./bin/job-executor-client -action create-server \
  -server-name "test-server" \
  -hostname "your-server-ip" \
  -user "your-username" \
  -auth-type "password" \
  -password "your-password"

# Submit a test job
./bin/job-executor-client -action submit-job \
  -command "echo" \
  -args "Hello from Remora!" \
  -server-id "<server-id-from-previous-step>"
```

## 📡 API Endpoints

### System Information

- `GET /health` - System health check
- `GET /api/v1/system/info` - Basic system statistics
- `GET /api/v1/system/enhanced` - Enhanced system metrics

### Job Management

- `POST /api/v1/jobs` - Submit a new job
- `POST /api/v1/jobs/script` - Submit a shell script job
- `POST /api/v1/jobs/:id/duplicate` - Duplicate an existing job
- `POST /api/v1/jobs/:id/rerun` - Rerun a completed job
- `GET /api/v1/jobs/:id` - Get job details
- `POST /api/v1/jobs/:id/cancel` - Cancel a running or queued job
- `GET /api/v1/jobs/:id/logs` - Get complete job logs (used for real-time polling)
- `GET /api/v1/jobs/:id/stdout` - Get job stdout
- `GET /api/v1/jobs/:id/stderr` - Get job stderr
- `GET /api/v1/jobs` - List jobs with filtering and pagination

### Server Management

- `POST /api/v1/servers` - Create a server configuration
- `GET /api/v1/servers/:id` - Get server details
- `PUT /api/v1/servers/:id` - Update server configuration
- `DELETE /api/v1/servers/:id` - Delete server configuration
- `GET /api/v1/servers` - List all servers
- `POST /api/v1/servers/:id/test` - Test server SSH connection
- `POST /api/v1/servers/:id/status` - Check server connectivity status
- `POST /api/v1/servers/bulk/status` - Check all servers status

### File Management

- `POST /api/v1/upload/pem` - Upload SSH private key files
- `GET /api/v1/files/pem` - List uploaded PEM files
- `DELETE /api/v1/files/pem/:filename` - Delete PEM file

For complete API documentation, see [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md).

## ⚙️ Configuration

### Environment Variables

The system can be configured using these environment variables:

```bash
# API Server Configuration
SERVER_ADDR=":8080"                              # API server listen address
DATABASE_URL="./jobs.db"                         # Database connection string
CORS_ALLOWED_ORIGINS="http://localhost:3000"     # CORS origins for web frontend

# NetQueue Configuration
NETQUEUE_ADDR="localhost:9000"                   # NetQueue server address
QUEUE_NAME="job_queue"                           # Job queue name

# Worker Configuration
WORKER_CONCURRENCY="5"                           # Number of concurrent job workers
WORKER_POOL_SIZE="16"                           # Worker pool size (default: CPU cores * 4)
SSH_CONNECTION_TIMEOUT="30s"                     # SSH connection timeout
SSH_EXECUTION_TIMEOUT="300s"                     # Default job execution timeout

# Web Frontend Configuration (Next.js)
NEXT_PUBLIC_API_URL="http://localhost:8080"      # API server URL for frontend
NEXT_PUBLIC_BACKEND_URL="http://localhost:8080"  # Backend URL for polling

# Security Configuration
ALLOWED_SHELLS="/bin/bash,/bin/sh,/usr/bin/zsh"  # Allowed shell executables
MAX_UPLOAD_SIZE="10MB"                            # Maximum PEM file upload size
SESSION_SECRET="your-secret-key"                  # Session encryption key (if auth enabled)

# Database Configuration (PostgreSQL)
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_DB="jobexecutor"
POSTGRES_USER="jobexecutor"
POSTGRES_PASSWORD="password123"
POSTGRES_SSLMODE="disable"

# Logging Configuration
LOG_LEVEL="info"                                  # Log level (debug, info, warn, error)
LOG_FORMAT="json"                                 # Log format (json, text)
```

### Configuration Files

Create a `.env` file in the project root:

```bash
# Copy template
cp deployment/.env.template .env

# Edit configuration
nano .env
```

### Database Setup

**PostgreSQL (Production):**

```bash
# Create database and user
createdb jobexecutor
createuser jobexecutor
psql -c "GRANT ALL PRIVILEGES ON DATABASE jobexecutor TO jobexecutor;"

# Set connection string
export DATABASE_URL="postgres://jobexecutor:password@localhost:5432/jobexecutor?sslmode=disable"
```

**SQLite (Development):**

```bash
# SQLite will be created automatically
export DATABASE_URL="./jobs.db"
```

## Request Formats

### Job Request

```json
{
  "command": "ls",
  "args": "-la /tmp",
  "server_id": "server-uuid",
  "timeout": 300
}
```

### Script Job Request

```json
{
  "script": "#!/bin/bash\necho 'Hello World'\ndate\nls -la",
  "args": "arg1 arg2",
  "server_id": "server-uuid",
  "timeout": 300,
  "shell": "/bin/bash"
}
```

### Duplicate Job Request

```json
{
  "server_id": "different-server-uuid",
  "timeout": 600
}
```

Note: Both `server_id` and `timeout` are optional in duplicate requests. If not provided, the original job's values will be used.

## Server Configuration Format

```json
{
  "name": "my-server",
  "hostname": "192.168.1.100",
  "port": 22,
  "user": "ubuntu",
  "auth_type": "password",
  "password": "mypassword",
  "is_active": true
}
```

For SSH key authentication:

```json
{
  "name": "my-key-server",
  "hostname": "192.168.1.101",
  "port": 22,
  "user": "ubuntu",
  "auth_type": "key",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "is_active": true
}
```

## Job Status

- `queued` - Job is waiting to be processed
- `running` - Job is currently executing
- `completed` - Job finished successfully (exit code 0)
- `failed` - Job finished with an error (non-zero exit code)
- `canceled` - Job was canceled by user

## CLI Client Usage

```bash
# Submit a job
./client -action submit-job -command "echo" -args "Hello World" -server-id <server-id>

# Get job status
./client -action get-job -job-id <job-id>

# List all jobs
./client -action list-jobs

# Cancel a job
./client -action cancel-job -job-id <job-id>

# Create server configuration
./client -action create-server -server-name myserver -hostname 192.168.1.100 -user ubuntu -auth-type password -password mypass

# List servers
./client -action list-servers
```

## 🧪 Testing & Validation

### Comprehensive Test Suite

The system includes a complete test suite to validate all features and ensure system reliability:

#### Quick System Test

```bash
# Run basic functionality test
./examples/quick-system-test.sh
```

- Validates API connectivity and basic job execution
- Tests server management and SSH connectivity
- Requires a PEM file for authentication testing

#### Architecture Tests

```bash
# Test NetQueue functionality
./examples/test-netqueue-architecture.sh

# Test polling-based real-time updates
./examples/test-polling-architecture.sh

# Test concurrent job limits
./examples/test-concurrent-limits.sh

# Comprehensive architecture test
./examples/test-comprehensive-architecture.sh
```

#### Test Runner

```bash
# Run all tests sequentially
./examples/run-all-tests.sh
```

- Executes all test suites in order
- Provides comprehensive validation of the entire system
- Interactive prompts for user confirmation

### Test Coverage

The test suite validates:

- **NetQueue Functionality**: Priority scheduling, job distribution, cancellation
- **Real-time Updates**: Polling-based monitoring and live output streaming
- **Concurrency Limits**: Worker pool management and job queuing
- **Job Management**: Submission, cancellation, duplication, and rerun
- **Server Management**: SSH connectivity, authentication, and health checks
- **System Integration**: End-to-end workflow validation

### Performance Testing

```bash
# Test concurrent job processing
./examples/test-concurrent-limits.sh

# Test queue performance under load
./examples/test-netqueue-architecture.sh
```

## Usage Examples

### 1. Submitting a Shell Script Job

```bash
# Create a script job using curl
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\necho \"Starting backup process...\"\ndate\ntar -czf /tmp/backup-$(date +%Y%m%d).tar.gz /home/user/documents\necho \"Backup completed!\"",
    "args": "",
    "server_id": "your-server-id",
    "timeout": 600,
    "shell": "/bin/bash"
  }'
```

### 2. Duplicating a Job

```bash
# Duplicate an existing job with different timeout
curl -X POST http://localhost:8080/api/v1/jobs/job-id-here/duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "timeout": 1200
  }'

# Duplicate a job to run on a different server
curl -X POST http://localhost:8080/api/v1/jobs/job-id-here/duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "different-server-id",
    "timeout": 900
  }'
```

### 3. Running Script Files

You can also submit the content of script files:

```bash
# Read script content and submit
SCRIPT_CONTENT=$(cat examples/sample-script.sh)
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"$SCRIPT_CONTENT\",
    \"args\": \"arg1 arg2\",
    \"server_id\": \"your-server-id\",
    \"timeout\": 300
  }"
```

### 4. Monitoring Job Output in Real-time

The web interface automatically polls for job updates every 2 seconds. For running jobs, the modal provides a scrollable live view of the output with separate tabs for stdout, stderr, and combined output.

## Architecture Changes

### Recent Updates

- **Replaced RabbitMQ with NetQueue**: Lightweight TCP-based message queue for better performance and simplicity
- **Optimized Real-time Updates**: Replaced Server-Sent Events (SSE) with efficient polling mechanism
- **Enhanced Live Job Monitoring**: Dedicated `LiveJobStatus` component with scrollable output for running jobs
- **Improved Database Updates**: Backend now updates job output every 2 seconds for consistent real-time experience
- **Smart Polling**: Frontend uses optimized polling with change detection to minimize unnecessary API calls

### Performance Improvements

- **2-Second Update Cycle**: Synchronized polling between frontend and backend for optimal real-time experience
- **Incremental Database Updates**: Worker updates database every 2 seconds or every 10 lines, whichever comes first
- **Optimized Frontend Polling**: Main job list polls every 2 seconds, modal logs poll every 2 seconds
- **Change Detection**: Smart polling prevents unnecessary re-renders when data hasn't changed

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Check the [documentation](docs/)
- Review the [examples](examples/)

## Roadmap

### Completed Features ✅

- [x] Custom NetQueue TCP-based message queue
- [x] Priority-based job scheduling (1-10 scale)
- [x] Real-time job monitoring with polling
- [x] Advanced job cancellation (queued and running)
- [x] Job duplication and rerun functionality
- [x] Comprehensive test suite
- [x] Docker deployment with docker-compose
- [x] Modern web interface with dark mode
- [x] SSH key and PEM file management
- [x] Live output streaming with scrollable interface

### Planned Features 🚧

- [ ] Authentication and authorization system
- [ ] Job scheduling and cron-like functionality
- [ ] Advanced job dependencies and workflows
- [ ] Enhanced metrics and monitoring dashboard
- [ ] Multi-tenant support
- [ ] API rate limiting and quotas
- [ ] Job templates and reusable scripts
- [ ] Advanced SSH key management with rotation
- [ ] Job output compression and archiving
- [ ] Webhook notifications for job events
- [ ] Job result caching and optimization
- [ ] Advanced queue analytics and reporting
- [ ] Horizontal scaling with multiple queue servers
- [ ] Job execution history and audit trails
- [ ] Integration with external monitoring systems
