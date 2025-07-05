# Job Executor

A Go-based distributed job execution system that accepts job submissions via REST API, queues and executes shell commands remotely over SSH, tracks job status and logs, and supports job cancellation.

## Features

- **REST API Server**: Built with Gin framework
- **Remote SSH Execution**: Execute commands on remote servers via SSH
- **Job Queue & Worker**: Background processing with job queue
- **Database Storage**: SQLite/PostgreSQL for job metadata and server configurations
- **Real-time Status Tracking**: Track job status (queued, running, completed, failed, canceled)
- **Job Cancellation**: Cancel running or queued jobs
- **Server Management**: CRUD operations for SSH server configurations
- **CLI Client**: Command-line interface for interacting with the API

## Architecture

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

### 1. Build the application

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
- `GET /api/v1/jobs/:id` - Get job details
- `POST /api/v1/jobs/:id/cancel` - Cancel a job
- `GET /api/v1/jobs/:id/logs` - Get job logs
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
export SERVER_ADDR=":8080"           # Server address
export DATABASE_URL="./jobs.db"      # Database file path
export SSH_HOST="localhost"          # Default SSH host (optional)
export SSH_PORT="22"                 # Default SSH port (optional)
export SSH_USER=""                   # Default SSH user (optional)
export SSH_PASSWORD=""               # Default SSH password (optional)
export SSH_PRIVATE_KEY=""            # Default SSH private key path (optional)
```

## Job Request Format

```json
{
  "command": "ls",
  "args": "-la /tmp",
  "server_id": "server-uuid",
  "timeout": 300
}
```

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
