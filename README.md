# Remora - Distributed Job Execution System

A modern, web-based distributed job execution system built with Go and Next.js that provides remote SSH command execution, real-time monitoring, and comprehensive job management across multiple servers.

## 🚀 Features

### Core System

- **REST API Server**: High-performance Gin-based API with comprehensive endpoints
- **Modern Web Interface**: React/Next.js frontend with real-time updates and dark mode
- **Remote SSH Execution**: Execute commands and scripts on remote servers via SSH
- **RabbitMQ Integration**: Reliable message queuing with automatic fallback to in-memory queue
- **Decoupled Architecture**: API server, worker, and web frontend run as independent services
- **Database Storage**: PostgreSQL/SQLite support for job metadata and server configurations

### Job Management

- **Real-time Monitoring**: Live job status tracking with Server-Sent Events (SSE)
- **Job Cancellation**: Cancel running or queued jobs instantly
- **Job Duplication**: Clone existing jobs with parameter modifications
- **Shell Script Execution**: Submit and execute multi-line shell scripts
- **Job Priorities**: Priority-based job scheduling (1-10 scale)
- **Timeout Management**: Configurable job execution timeouts
- **Live Output Streaming**: Real-time stdout/stderr streaming in web interface

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
│   Web Frontend  │────│   REST API      │────│   RabbitMQ      │
│   (Next.js)     │    │   (Go/Gin)      │    │   (Message      │
│   Port: 3000    │    │   Port: 8080    │    │    Queue)       │
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

- **Web Frontend**: Modern React/Next.js dashboard with real-time updates
- **API Server**: RESTful API handling job submission, server management, and real-time events
- **Worker Service**: Background job processor with SSH execution capabilities
- **Message Queue**: RabbitMQ for reliable job distribution and real-time notifications
- **Database**: PostgreSQL for production or SQLite for development
- **Remote Servers**: Target machines accessed via SSH for command execution

### Data Flow

1. **Job Submission**: Web interface or API submits jobs to the REST API
2. **Queue Distribution**: API server pushes jobs to RabbitMQ queue
3. **Worker Processing**: Worker service pulls jobs and executes via SSH
4. **Real-time Updates**: Status changes broadcast via SSE to web interface
5. **Result Storage**: Job outputs and metadata stored in database

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

The easiest way to get started is using Docker Compose, which provides a complete system with PostgreSQL, RabbitMQ, API server, worker, and web frontend.

#### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 2GB RAM
- Ports 3000, 5432, 5672, 8080, 15672 available

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

| Service                 | URL                    | Description                             |
| ----------------------- | ---------------------- | --------------------------------------- |
| **Web Dashboard**       | http://localhost:3000  | Modern web interface for job management |
| **API Server**          | http://localhost:8080  | REST API endpoints                      |
| **RabbitMQ Management** | http://localhost:15672 | Message queue admin (admin/password123) |

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
# RabbitMQ (optional - will use in-memory queue if not available)
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
go build -o bin/job-executor-client ./cmd/client

# Set environment variables (optional)
export DATABASE_URL="./jobs.db"  # SQLite
export RABBITMQ_URL="amqp://guest:guest@localhost:5672/"
export SERVER_ADDR=":8080"

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
- `POST /api/v1/jobs/:id/cancel` - Cancel a running job
- `GET /api/v1/jobs/:id/logs` - Get complete job logs
- `GET /api/v1/jobs/:id/stdout` - Get job stdout
- `GET /api/v1/jobs/:id/stderr` - Get job stderr
- `GET /api/v1/jobs/:id/stream` - Stream job output (Server-Sent Events)
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

For complete API documentation, see [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md).

## ⚙️ Configuration

### Environment Variables

The system can be configured using these environment variables:

```bash
# API Server Configuration
SERVER_ADDR=":8080"                              # API server listen address
DATABASE_URL="./jobs.db"                         # Database connection string
CORS_ALLOWED_ORIGINS="http://localhost:3000"     # CORS origins for web frontend

# Message Queue Configuration
RABBITMQ_URL="amqp://guest:guest@localhost:5672/" # RabbitMQ connection URL
QUEUE_NAME="job_queue"                            # Job queue name
QUEUE_DURABLE="true"                              # Queue persistence

# Worker Configuration
WORKER_CONCURRENCY="5"                            # Number of concurrent job workers
WORKER_POLL_INTERVAL="5s"                        # Job polling interval
SSH_CONNECTION_TIMEOUT="30s"                     # SSH connection timeout
SSH_EXECUTION_TIMEOUT="300s"                     # Default job execution timeout

# Web Frontend Configuration (Next.js)
NEXT_PUBLIC_API_URL="http://localhost:8080"      # API server URL for frontend
NEXT_PUBLIC_WS_URL="http://localhost:8080"       # WebSocket/SSE URL for real-time updates

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

`````markdown
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

```bash
# Use Server-Sent Events to monitor job output
curl -N http://localhost:8080/api/v1/jobs/job-id-here/stream
```

This will provide real-time updates including:

- Job status changes
- Live output from stdout/stderr
- Completion notifications

```

```
`````
