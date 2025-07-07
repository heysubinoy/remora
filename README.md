# Job Executor

A Go-based distributed job execution system that accepts job submissions via REST API, queues and executes shell commands remotely over SSH, tracks job status and logs, and supports job cancellation.

## Features

- **REST API Server**: Built with Gin framework
- **Remote SSH Execution**: Execute commands on remote servers via SSH
- **RabbitMQ Integration**: Reliable message queuing with automatic fallback to in-memory queue
- **Decoupled Architecture**: API server and worker run as independent processes
- **Job Queue & Worker**: Background processing with persistent job queue
- **Database Storage**: SQLite/PostgreSQL for job metadata and server configurations
- **Real-time Status Tracking**: Track job status (queued, running, completed, failed, canceled)
- **Job Cancellation**: Cancel running or queued jobs via RabbitMQ messaging
- **Job Duplication**: Duplicate existing jobs with optional parameter overrides
- **Shell Script Execution**: Submit and execute shell scripts directly
- **Server Management**: CRUD operations for SSH server configurations
- **CLI Client**: Command-line interface for interacting with the API
- **Horizontal Scaling**: Multiple worker instances can process jobs from the same queue

## Architecture

### Decoupled Architecture (Recommended)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Client    │────│   API Server    │────│   RabbitMQ      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              │                         │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Database      │    │    Worker       │
                       │   (SQLite)      │────│                 │
                       └─────────────────┘    └─────────────────┘
                                                        │
                                                        │
                                              ┌─────────────────┐
                                              │  Remote Servers │
                                              │   (via SSH)     │
                                              └─────────────────┘
```

### Legacy Monolithic Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Client    │────│   REST API      │────│   Job Queue     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              │                         │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Database      │    │   SSH Worker    │
                       │   (SQLite)      │    │                 │
                       └─────────────────┘    └─────────────────┘
                                                        │
                                                        │
                                              ┌─────────────────┐
                                              │  Remote Servers │
                                              │   (via SSH)     │
                                              └─────────────────┘
```

## Quick Start

### Option 1: Decoupled Architecture (Recommended)

#### 1. Start RabbitMQ

```bash
# Using Docker Compose
docker-compose up rabbitmq

# Or using Docker directly
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=password123 \
  -e RABBITMQ_DEFAULT_VHOST=job-executor \
  rabbitmq:3-management
```

#### 2. Build the applications

```bash
# Build both API server and worker
go build -o bin/job-executor-api ./cmd/api
go build -o bin/job-executor-worker ./cmd/worker

# Or use the build script
chmod +x build.sh
./build.sh
```

#### 3. Start the services

```bash
# Set environment variables (optional)
export RABBITMQ_URL="amqp://admin:password123@localhost:5672/job-executor"
export DATABASE_URL="./jobs.db"
export SERVER_ADDR=":8080"

# Start worker
./bin/job-executor-worker &

# Start API server
./bin/job-executor-api &

# Or use the startup script
chmod +x start-decoupled.sh
./start-decoupled.sh
```

#### 4. Test the decoupled setup

```bash
chmod +x test-decoupled.sh
./test-decoupled.sh
```

### Option 2: Monolithic Architecture (Legacy)

#### 1. Build the application

```bash
# Build the server
go build -o job-executor main.go

# Build the CLI client
go build -o client cmd/client/main.go
```

### 2. Start the server

```bash
./job-executor
```

The server will start on `http://localhost:8080` by default.

### 3. Create a server configuration

```bash
# Using password authentication
./client -action create-server \
  -server-name "my-server" \
  -hostname "192.168.1.100" \
  -user "ubuntu" \
  -auth-type "password" \
  -password "mypassword"

# Using SSH key authentication
./client -action create-server \
  -server-name "my-key-server" \
  -hostname "192.168.1.101" \
  -user "ubuntu" \
  -auth-type "key" \
  -private-key "/path/to/private/key"
```

### 4. Submit a job

```bash
./client -action submit-job \
  -command "ls" \
  -args "-la /tmp" \
  -server-id "<server-id-from-step-3>" \
  -timeout 60
```

### 5. Check job status

```bash
# Get specific job
./client -action get-job -job-id "<job-id>"

# List all jobs
./client -action list-jobs
```

## API Endpoints

### Job Management

- `POST /api/v1/jobs` - Submit a new job
- `POST /api/v1/jobs/script` - Submit a shell script job
- `POST /api/v1/jobs/:id/duplicate` - Duplicate an existing job
- `GET /api/v1/jobs/:id` - Get job details
- `POST /api/v1/jobs/:id/cancel` - Cancel a job
- `GET /api/v1/jobs/:id/logs` - Get job logs
- `GET /api/v1/jobs/:id/stdout` - Get job stdout
- `GET /api/v1/jobs/:id/stderr` - Get job stderr
- `GET /api/v1/jobs/:id/stream` - Stream job output (Server-Sent Events)
- `GET /api/v1/jobs` - List jobs (supports filtering by status and server_id)

### Server Configuration

- `POST /api/v1/servers` - Create a server configuration
- `GET /api/v1/servers/:id` - Get server details
- `PUT /api/v1/servers/:id` - Update server configuration
- `DELETE /api/v1/servers/:id` - Delete server configuration
- `GET /api/v1/servers` - List servers
- `POST /api/v1/servers/:id/test` - Test server connection

### Health Check

- `GET /health` - Health check endpoint

## Configuration

The application can be configured using environment variables:

```bash
export SERVER_ADDR=":8080"                              # Server address
export DATABASE_URL="./jobs.db"                         # Database file path
export RABBITMQ_URL="amqp://guest:guest@localhost:5672/" # RabbitMQ connection URL
export SSH_HOST="localhost"                             # Default SSH host (optional)
export SSH_PORT="22"                                    # Default SSH port (optional)
export SSH_USER=""                                      # Default SSH user (optional)
export SSH_PASSWORD=""                                  # Default SSH password (optional)
export SSH_PRIVATE_KEY=""                               # Default SSH private key path (optional)
```

### RabbitMQ Setup

The system supports RabbitMQ for reliable job queuing with automatic fallback to in-memory queue:

```bash
# Start RabbitMQ with Docker
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management

# Set RabbitMQ URL (optional - defaults to localhost)
export RABBITMQ_URL="amqp://guest:guest@localhost:5672/"

# Start the application
./job-executor
```

If RabbitMQ is unavailable, the system automatically falls back to an in-memory queue. See [RabbitMQ Integration Guide](docs/RABBITMQ_INTEGRATION.md) for detailed setup instructions.

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

````

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
````

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

## Security Considerations

- SSH credentials are stored in the database - consider encryption at rest
- Use SSH key authentication instead of passwords when possible
- Validate and sanitize command inputs
- Consider rate limiting for job submissions
- Use HTTPS in production
- Implement proper authentication and authorization

## Development

### Running Tests

```bash
go test ./...
```

### Adding Dependencies

```bash
go mod tidy
```

### Project Structure

```
.
├── main.go                     # Main application entry point
├── cmd/
│   └── client/
│       └── main.go            # CLI client
├── internal/
│   ├── api/
│   │   ├── handlers.go        # Route setup and API struct
│   │   ├── job_handlers.go    # Job-related handlers
│   │   └── server_handlers.go # Server configuration handlers
│   ├── config/
│   │   └── config.go          # Configuration management
│   ├── database/
│   │   └── database.go        # Database initialization
│   ├── models/
│   │   ├── job.go            # Job data structures
│   │   └── server.go         # Server data structures
│   ├── queue/
│   │   └── queue.go          # Job queue implementation
│   ├── ssh/
│   │   └── client.go         # SSH client for remote execution
│   └── worker/
│       └── worker.go         # Background job processor
├── go.mod                     # Go module definition
├── go.sum                     # Go module checksums
├── .gitignore                 # Git ignore file
└── README.md                  # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
