# API Documentation

Complete API documentation for NewRemora distributed job execution system.

## Table of Contents

- [Overview](#overview)
- [Base URL and Authentication](#base-url-and-authentication)
- [Response Format](#response-format)
- [Health Check](#health-check)
- [System Information](#system-information)
- [Job Management](#job-management)
- [Server Management](#server-management)
- [File Management](#file-management)
- [Status Codes](#status-codes)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)

## Overview

The NewRemora API is a RESTful API built with Go and Gin that provides comprehensive job execution and server management capabilities. It serves as the central interface for submitting jobs, managing servers, and monitoring system status.

### Key Features

- **RESTful Design**: Standard HTTP methods and status codes
- **JSON Communication**: All requests and responses use JSON format
- **Real-time Updates**: Optimized polling endpoints for live monitoring
- **Comprehensive Error Handling**: Detailed error messages and status codes
- **Rate Limiting**: Built-in protection against abuse
- **CORS Support**: Cross-origin resource sharing for web frontend

## Base URL and Authentication

### Base URL

```
http://localhost:8080
```

### Authentication

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
  "timeout": 300,
  "priority": 5
}
```

**Parameters:**

- `command` (required): Command to execute
- `args` (optional): Command arguments
- `server_id` (required): Target server UUID
- `timeout` (optional): Timeout in seconds (default: 300)
- `priority` (optional): Job priority 1-10 (1=highest, 10=lowest)

**Response:**

```json
{
  "id": "job-uuid",
  "command": "ls",
  "args": "-la /var/log",
  "status": "queued",
  "server_id": "server-uuid",
  "priority": 5,
  "created_at": "2024-12-09T10:30:00Z",
  "timeout": 300
}
```

### POST /api/v1/jobs/script

Submit a shell script job.

**Request Body:**

```json
{
  "script": "#!/bin/bash\necho 'Hello World'\ndate\nls -la",
  "args": "arg1 arg2",
  "server_id": "uuid-here",
  "timeout": 300,
  "shell": "/bin/bash",
  "priority": 3
}
```

**Parameters:**

- `script` (required): Shell script content
- `args` (optional): Script arguments
- `server_id` (required): Target server UUID
- `timeout` (optional): Timeout in seconds (default: 300)
- `shell` (optional): Shell to use (default: /bin/bash)
- `priority` (optional): Job priority 1-10

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
  "timeout": 600,
  "priority": 2
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
    "status": "queued",
    "priority": 2
  }
}
```

### POST /api/v1/jobs/:id/rerun

Rerun a completed job (creates a new job with same parameters).

**Response:**

```json
{
  "original_job": {
    "id": "original-job-uuid",
    "status": "completed"
  },
  "new_job": {
    "id": "new-job-uuid",
    "command": "ls",
    "args": "-la",
    "server_id": "server-uuid",
    "status": "queued"
  }
}
```

### GET /api/v1/jobs/:id

Get job details.

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
  "priority": 5,
  "output": "total 48\ndrwxr-xr-x 8 root root 4096 Dec  9 10:25 .\n...",
  "stdout": "total 48\ndrwxr-xr-x 8 root root 4096 Dec  9 10:25 .\n...",
  "stderr": ""
}
```

### GET /api/v1/jobs/:id/logs

Get complete job logs (stdout + stderr combined).

### GET /api/v1/jobs/:id/stdout

Get job stdout output only.

### GET /api/v1/jobs/:id/stderr

Get job stderr output only.

### GET /api/v1/jobs

List jobs with filtering and pagination.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status (queued, running, completed, failed, canceled)
- `server_id` (optional): Filter by server ID
- `search` (optional): Search in command, args, or output
- `sort_by` (optional): Sort field (created_at, started_at, finished_at, priority)
- `sort_order` (optional): Sort order (asc, desc)

**Response:**

```json
{
  "jobs": [
    {
      "id": "job-uuid",
      "command": "ls",
      "status": "completed",
      "server_id": "server-uuid",
      "created_at": "2024-12-09T10:30:00Z",
      "priority": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1250,
    "pages": 63
  }
}
```

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

**For PEM File Authentication:**

```json
{
  "name": "cloud-server",
  "hostname": "cloud.example.com",
  "port": 2222,
  "user": "clouduser",
  "auth_type": "key",
  "pem_file_url": "/pem-files/your-key.pem",
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

### POST /api/v1/servers/:id/status

Check server connectivity status.

**Response:**

```json
{
  "server_id": "server-uuid",
  "status": "connected",
  "response_time_ms": 145,
  "message": "Connection successful",
  "checked_at": "2024-12-09T10:30:00Z"
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

## File Management

### POST /api/v1/pem-files/upload

Upload a PEM file for SSH key authentication.

**Request:**
Multipart form data with file field named `pem_file`.

**Response:**

```json
{
  "filename": "uploaded-key.pem",
  "pem_file_url": "/pem-files/uploaded-key.pem",
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

## Error Handling

All errors include:

- HTTP status code
- Error message
- Request ID for tracking
- Timestamp

**Example error response:**

```json
{
  "success": false,
  "error": "Server not found",
  "request_id": "req-12345",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

## Request Examples

### Submitting a Shell Script Job

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\necho \"Starting backup process...\"\ndate\ntar -czf /tmp/backup-$(date +%Y%m%d).tar.gz /home/user/documents\necho \"Backup completed!\"",
    "args": "",
    "server_id": "your-server-id",
    "timeout": 600,
    "shell": "/bin/bash",
    "priority": 1
  }'
```

### Duplicating a Job

```bash
curl -X POST http://localhost:8080/api/v1/jobs/job-id-here/duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "timeout": 1200,
    "priority": 2
  }'
```

### Running Script Files

```bash
# Read script content and submit
SCRIPT_CONTENT=$(cat examples/sample-script.sh)
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d "{
    \"script\": \"$SCRIPT_CONTENT\",
    \"args\": \"arg1 arg2\",
    \"server_id\": \"your-server-id\",
    \"timeout\": 300,
    \"priority\": 5
  }"
```

## Job Status Values

- `queued` - Job is waiting to be processed
- `running` - Job is currently executing
- `completed` - Job finished successfully (exit code 0)
- `failed` - Job finished with an error (non-zero exit code)
- `canceled` - Job was canceled by user

## Real-time Monitoring

The API supports real-time job monitoring through optimized polling:

- **Polling Interval**: 2 seconds for optimal real-time experience
- **Change Detection**: Smart polling prevents unnecessary updates
- **Live Output**: Real-time stdout/stderr streaming via `/jobs/:id/logs`
- **Status Updates**: Continuous job status monitoring
- **Incremental Updates**: Backend updates database every 2 seconds

For more information about the queue system, see [Queue Documentation](QUEUE_DOCUMENTATION.md).

For more information about the worker system, see [Worker Documentation](WORKER_DOCUMENTATION.md).
