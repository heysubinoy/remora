# API Reference

Complete API documentation for NewRemora distributed job execution system.

## Base URL

```
http://localhost:8080
```

## Authentication

Currently, the API uses no authentication by default. For production deployments, consider implementing:

- API Key authentication
- JWT tokens
- OAuth 2.0

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2024-12-09T10:30:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": "Error message here",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

## Health Check

### GET /health

Check system health and availability.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-12-09T10:30:00Z",
  "database": "connected",
  "queue": "connected"
}
```

## System Information

### GET /api/v1/system/info

Get basic system statistics.

**Response:**

```json
{
  "total_servers": 5,
  "total_jobs": 1250,
  "running_jobs": 3,
  "completed_jobs": 1200,
  "failed_jobs": 47,
  "queued_jobs": 15,
  "success_rate": 96.2,
  "timestamp": "2024-12-09T10:30:00Z"
}
```

### GET /api/v1/system/enhanced

Get enhanced system metrics including server connectivity.

**Response:**

```json
{
  "connected_servers": 4,
  "disconnected_servers": 1,
  "average_job_duration": 45.7,
  "jobs_per_hour": 28,
  "worker_status": {
    "active_workers": 3,
    "total_capacity": 30
  }
}
```

## Job Management

### POST /api/v1/jobs

Submit a new job for execution.

**Request Body:**

```json
{
  "command": "ls",
  "args": "-la /var/log",
  "server_id": "uuid-here",
  "timeout": 300
}
```

**Parameters:**

- `command` (required): Command to execute
- `args` (optional): Command arguments
- `server_id` (required): Target server UUID
- `timeout` (optional): Timeout in seconds (default: 300)

**Response:**

```json
{
  "id": "job-uuid-here",
  "status": "queued",
  "command": "ls",
  "args": "-la /var/log",
  "server_id": "server-uuid",
  "created_at": "2024-12-09T10:30:00Z",
  "timeout": 300
}
```

### POST /api/v1/jobs/script

Submit a shell script for execution.

**Request Body:**

```json
{
  "script": "#!/bin/bash\necho 'Starting backup...'\ntar -czf /tmp/backup.tar.gz /home/user/documents\necho 'Backup completed!'",
  "server_id": "uuid-here",
  "timeout": 1800,
  "shell": "/bin/bash"
}
```

**Parameters:**

- `script` (required): Shell script content
- `server_id` (required): Target server UUID
- `timeout` (optional): Timeout in seconds
- `shell` (optional): Shell interpreter (default: /bin/bash)

### GET /api/v1/jobs

List jobs with optional filtering and pagination.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status (queued, running, completed, failed, canceled)
- `server_id` (optional): Filter by server ID
- `search` (optional): Search in command/args
- `sort_by` (optional): Sort field (created_at, started_at, finished_at)
- `sort_order` (optional): Sort order (asc, desc)

**Example:**

```
GET /api/v1/jobs?status=running&limit=10&sort_by=created_at&sort_order=desc
```

**Response:**

```json
{
  "jobs": [
    {
      "id": "job-uuid",
      "command": "ls",
      "args": "-la",
      "status": "running",
      "server_id": "server-uuid",
      "server": {
        "id": "server-uuid",
        "name": "web-server-01",
        "hostname": "192.168.1.100"
      },
      "created_at": "2024-12-09T10:30:00Z",
      "started_at": "2024-12-09T10:30:05Z",
      "finished_at": null,
      "exit_code": null,
      "timeout": 300
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

### GET /api/v1/jobs/:id

Get details of a specific job.

**Response:**

```json
{
  "id": "job-uuid",
  "command": "ls",
  "args": "-la /var/log",
  "status": "completed",
  "server_id": "server-uuid",
  "server": {
    "id": "server-uuid",
    "name": "web-server-01",
    "hostname": "192.168.1.100"
  },
  "created_at": "2024-12-09T10:30:00Z",
  "started_at": "2024-12-09T10:30:05Z",
  "finished_at": "2024-12-09T10:30:07Z",
  "exit_code": 0,
  "timeout": 300,
  "output": "total 48\ndrwxr-xr-x 8 root root 4096 Dec  9 10:25 .\n...",
  "stdout": "total 48\ndrwxr-xr-x 8 root root 4096 Dec  9 10:25 .\n...",
  "stderr": ""
}
```

### POST /api/v1/jobs/:id/cancel

Cancel a running or queued job.

**Response:**

```json
{
  "id": "job-uuid",
  "status": "canceled",
  "canceled_at": "2024-12-09T10:35:00Z"
}
```

### POST /api/v1/jobs/:id/duplicate

Create a duplicate of an existing job with optional parameter overrides.

**Request Body (optional):**

```json
{
  "server_id": "different-server-uuid",
  "timeout": 600
}
```

**Response:**

```json
{
  "original_job": {
    "id": "original-job-uuid",
    "command": "ls"
  },
  "new_job": {
    "id": "new-job-uuid",
    "command": "ls",
    "args": "-la",
    "server_id": "different-server-uuid",
    "timeout": 600,
    "status": "queued"
  }
}
```

### GET /api/v1/jobs/:id/stream

Stream job output in real-time using Server-Sent Events.

**Response Headers:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event Types:**

- `status`: Job status changes
- `output`: Real-time output from stdout/stderr
- `complete`: Job completion notification

**Example Events:**

```
event: status
data: {"status": "running", "started_at": "2024-12-09T10:30:05Z"}

event: output
data: {"type": "stdout", "content": "Starting process...\n"}

event: complete
data: {"status": "completed", "exit_code": 0}
```

### GET /api/v1/jobs/:id/logs

Get complete job logs (stdout + stderr combined).

### GET /api/v1/jobs/:id/stdout

Get job stdout output only.

### GET /api/v1/jobs/:id/stderr

Get job stderr output only.

## Server Management

### POST /api/v1/servers

Create a new server configuration.

**Request Body:**

```json
{
  "name": "production-web-01",
  "hostname": "192.168.1.100",
  "port": 22,
  "user": "ubuntu",
  "auth_type": "password",
  "password": "secure-password",
  "is_active": true
}
```

**For SSH Key Authentication:**

```json
{
  "name": "database-server",
  "hostname": "db.example.com",
  "port": 22,
  "user": "admin",
  "auth_type": "key",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
  "is_active": true
}
```

**Parameters:**

- `name` (required): Server display name
- `hostname` (required): Server hostname or IP
- `port` (optional): SSH port (default: 22)
- `user` (required): SSH username
- `auth_type` (required): "password" or "key"
- `password` (required if auth_type=password): SSH password
- `private_key` (required if auth_type=key): SSH private key content
- `pem_file_url` (optional): URL to uploaded PEM file
- `is_active` (optional): Whether server is active (default: true)

### GET /api/v1/servers

List all servers.

**Query Parameters:**

- `active_only` (optional): Return only active servers

**Response:**

```json
{
  "servers": [
    {
      "id": "server-uuid",
      "name": "production-web-01",
      "hostname": "192.168.1.100",
      "port": 22,
      "user": "ubuntu",
      "auth_type": "password",
      "is_active": true,
      "created_at": "2024-12-09T09:00:00Z",
      "updated_at": "2024-12-09T09:00:00Z"
    }
  ]
}
```

### GET /api/v1/servers/:id

Get details of a specific server.

### PUT /api/v1/servers/:id

Update server configuration.

**Request Body:**

```json
{
  "name": "updated-server-name",
  "hostname": "new.hostname.com",
  "port": 2222,
  "is_active": false
}
```

### DELETE /api/v1/servers/:id

Delete a server configuration.

**Query Parameters:**

- `force` (optional): Force deletion even if server has associated jobs

### POST /api/v1/servers/:id/test

Test connectivity to a server.

**Response:**

```json
{
  "server_id": "server-uuid",
  "status": "connected",
  "response_time_ms": 234,
  "test_command": "echo 'test'",
  "test_output": "test",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

### POST /api/v1/servers/check-status

Check connectivity status of all servers.

**Query Parameters:**

- `active_only` (optional): Check only active servers

**Response:**

```json
{
  "servers": [
    {
      "server_id": "server-uuid-1",
      "status": "connected",
      "response_time_ms": 145,
      "message": "Connection successful"
    },
    {
      "server_id": "server-uuid-2",
      "status": "disconnected",
      "response_time_ms": null,
      "message": "Connection timeout"
    }
  ],
  "summary": {
    "total_checked": 2,
    "connected": 1,
    "disconnected": 1,
    "check_duration_ms": 5234
  }
}
```

### POST /api/v1/servers/upload-pem

Upload a PEM file for SSH key authentication.

**Request:**
Multipart form data with file field named `pem_file`.

**Response:**

```json
{
  "filename": "uploaded-key.pem",
  "url": "/pem-files/uploaded-key.pem",
  "size": 1679,
  "uploaded_at": "2024-12-09T10:30:00Z"
}
```

## Status Codes

| Code | Description           |
| ---- | --------------------- |
| 200  | Success               |
| 201  | Created               |
| 400  | Bad Request           |
| 404  | Not Found             |
| 409  | Conflict              |
| 500  | Internal Server Error |
| 503  | Service Unavailable   |

## Rate Limiting

Default rate limits:

- 100 requests per minute per IP
- 1000 job submissions per hour per IP

## WebSocket Support

Real-time updates are available via Server-Sent Events (SSE) on the `/api/v1/jobs/:id/stream` endpoint.

## Error Handling

All errors include:

- HTTP status code
- Error message
- Request ID for tracking
- Timestamp

Example error response:

```json
{
  "success": false,
  "error": "Server not found",
  "request_id": "req-12345",
  "timestamp": "2024-12-09T10:30:00Z"
}
```
