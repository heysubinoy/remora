# Usage Examples

Practical examples and use cases for NewRemora distributed job execution system.

## Table of Contents

- [Quick Start Examples](#quick-start-examples)
- [Server Management](#server-management)
- [Job Execution](#job-execution)
- [Script Automation](#script-automation)
- [Monitoring and Debugging](#monitoring-and-debugging)
- [Advanced Use Cases](#advanced-use-cases)
- [Integration Examples](#integration-examples)

## Quick Start Examples

### 1. Basic System Test

```bash
# Test system health
curl http://localhost:8080/health

# Get system information
curl http://localhost:8080/api/v1/system/info
```

### 2. First Server Setup

```bash
# Add a server with password authentication
curl -X POST http://localhost:8080/api/v1/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-server",
    "hostname": "192.168.1.100",
    "port": 22,
    "user": "ubuntu",
    "auth_type": "password",
    "password": "your-password"
  }'
```

### 3. First Job Execution

```bash
# Simple command execution
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "echo",
    "args": "Hello, NewRemora!",
    "server_id": "your-server-id",
    "timeout": 60
  }'
```

## Server Management

### Adding Different Server Types

#### Password Authentication

```bash
curl -X POST http://localhost:8080/api/v1/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-server-01",
    "hostname": "web01.example.com",
    "port": 22,
    "user": "webuser",
    "auth_type": "password",
    "password": "secure-password",
    "is_active": true
  }'
```

#### SSH Key Authentication

```bash
# First, upload PEM file
curl -X POST http://localhost:8080/api/v1/servers/upload-pem \
  -F "pem_file=@/path/to/your-key.pem"

# Then create server with key
curl -X POST http://localhost:8080/api/v1/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "database-server",
    "hostname": "db.example.com",
    "port": 22,
    "user": "dbadmin",
    "auth_type": "key",
    "pem_file_url": "/pem-files/your-key.pem",
    "is_active": true
  }'
```

#### Private Key Content

```bash
curl -X POST http://localhost:8080/api/v1/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cloud-server",
    "hostname": "cloud.example.com",
    "port": 2222,
    "user": "clouduser",
    "auth_type": "key",
    "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
  }'
```

### Server Management Operations

```bash
# List all servers
curl http://localhost:8080/api/v1/servers

# Get specific server
curl http://localhost:8080/api/v1/servers/server-id

# Test server connection
curl -X POST http://localhost:8080/api/v1/servers/server-id/test

# Update server
curl -X PUT http://localhost:8080/api/v1/servers/server-id \
  -H "Content-Type: application/json" \
  -d '{
    "name": "updated-server-name",
    "hostname": "new.hostname.com"
  }'

# Check all server statuses
curl -X POST http://localhost:8080/api/v1/servers/check-status

# Delete server
curl -X DELETE http://localhost:8080/api/v1/servers/server-id
```

## Job Execution

### Simple Commands

```bash
# System information
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "uname",
    "args": "-a",
    "server_id": "server-id",
    "timeout": 30
  }'

# Disk usage
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "df",
    "args": "-h",
    "server_id": "server-id",
    "timeout": 60
  }'

# Process listing
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ps",
    "args": "aux",
    "server_id": "server-id",
    "timeout": 30
  }'
```

### File Operations

```bash
# List directory contents
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ls",
    "args": "-la /var/log",
    "server_id": "server-id",
    "timeout": 30
  }'

# Find files
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "find",
    "args": "/home -name \"*.log\" -type f",
    "server_id": "server-id",
    "timeout": 120
  }'

# Check file permissions
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "stat",
    "args": "/etc/passwd",
    "server_id": "server-id",
    "timeout": 30
  }'
```

### Network Operations

```bash
# Ping test
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ping",
    "args": "-c 5 google.com",
    "server_id": "server-id",
    "timeout": 60
  }'

# Port scan
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "nmap",
    "args": "-p 22,80,443 localhost",
    "server_id": "server-id",
    "timeout": 120
  }'

# Network configuration
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ip",
    "args": "addr show",
    "server_id": "server-id",
    "timeout": 30
  }'
```

## Script Automation

### System Maintenance Scripts

#### System Update Script

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\nset -e\necho \"Starting system update...\"\nsudo apt update\nsudo apt upgrade -y\nsudo apt autoremove -y\necho \"System update completed successfully!\"",
    "server_id": "server-id",
    "timeout": 1800,
    "shell": "/bin/bash"
  }'
```

#### Log Rotation Script

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\nset -e\nLOG_DIR=\"/var/log/myapp\"\necho \"Rotating logs in $LOG_DIR\"\nfor log in $LOG_DIR/*.log; do\n  if [ -f \"$log\" ]; then\n    gzip \"$log\"\n    mv \"$log.gz\" \"$LOG_DIR/archive/\"\n    echo \"Rotated: $(basename \"$log\")\"\n  fi\ndone\necho \"Log rotation completed\"",
    "server_id": "server-id",
    "timeout": 300,
    "shell": "/bin/bash"
  }'
```

#### Backup Script

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\nset -e\nBACKUP_DIR=\"/backups\"\nSOURCE_DIR=\"/var/www\"\nDATE=$(date +%Y%m%d_%H%M%S)\nBACKUP_FILE=\"$BACKUP_DIR/backup_$DATE.tar.gz\"\n\necho \"Starting backup process...\"\nmkdir -p $BACKUP_DIR\ntar -czf $BACKUP_FILE $SOURCE_DIR\necho \"Backup created: $BACKUP_FILE\"\necho \"Backup size: $(du -h $BACKUP_FILE | cut -f1)\"\n\n# Keep only last 5 backups\ncd $BACKUP_DIR\nls -t backup_*.tar.gz | tail -n +6 | xargs -r rm\necho \"Cleanup completed\"",
    "server_id": "server-id",
    "timeout": 3600,
    "shell": "/bin/bash"
  }'
```

### Monitoring Scripts

#### Health Check Script

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\necho \"=== System Health Check ===\"\necho \"Date: $(date)\"\necho \"\"\necho \"=== CPU Usage ===\"\ntop -bn1 | grep \"Cpu(s)\" | sed \"s/.*, *\\([0-9.]*\\)%* id.*/\\1/\" | awk \"{print 100 - \\$1}\" | head -1\necho \"\"\necho \"=== Memory Usage ===\"\nfree -h\necho \"\"\necho \"=== Disk Usage ===\"\ndf -h\necho \"\"\necho \"=== Load Average ===\"\nuptime\necho \"\"\necho \"=== Network Connections ===\"\nnetstat -tuln | wc -l\necho \"Health check completed\"",
    "server_id": "server-id",
    "timeout": 120,
    "shell": "/bin/bash"
  }'
```

#### Service Status Script

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\nSERVICES=(\"nginx\" \"postgresql\" \"redis-server\")\necho \"=== Service Status Check ===\"\nfor service in \"${SERVICES[@]}\"; do\n  echo \"Checking $service...\"\n  if systemctl is-active --quiet $service; then\n    echo \"✓ $service is running\"\n  else\n    echo \"✗ $service is not running\"\n  fi\ndone\necho \"Service check completed\"",
    "server_id": "server-id",
    "timeout": 60,
    "shell": "/bin/bash"
  }'
```

### Deployment Scripts

#### Application Deployment

```bash
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\nset -e\nAPP_DIR=\"/opt/myapp\"\nREPO_URL=\"https://github.com/user/repo.git\"\nBRANCH=\"main\"\n\necho \"Starting deployment...\"\ncd $APP_DIR\n\n# Backup current version\ncp -r current current.backup.$(date +%Y%m%d_%H%M%S)\n\n# Pull latest code\ngit fetch origin\ngit checkout $BRANCH\ngit pull origin $BRANCH\n\n# Install dependencies\nnpm install --production\n\n# Run tests\nnpm test\n\n# Restart service\nsudo systemctl restart myapp\n\necho \"Deployment completed successfully!\"",
    "server_id": "server-id",
    "timeout": 1800,
    "shell": "/bin/bash"
  }'
```

## Monitoring and Debugging

### Job Management

```bash
# List all jobs
curl "http://localhost:8080/api/v1/jobs"

# List running jobs only
curl "http://localhost:8080/api/v1/jobs?status=running"

# List jobs for specific server
curl "http://localhost:8080/api/v1/jobs?server_id=server-id"

# Search jobs
curl "http://localhost:8080/api/v1/jobs?search=backup"

# Get job details
curl "http://localhost:8080/api/v1/jobs/job-id"

# Get job output
curl "http://localhost:8080/api/v1/jobs/job-id/logs"
curl "http://localhost:8080/api/v1/jobs/job-id/stdout"
curl "http://localhost:8080/api/v1/jobs/job-id/stderr"
```

### Real-time Monitoring

```bash
# Stream job output in real-time
curl -N "http://localhost:8080/api/v1/jobs/job-id/stream"

# Monitor system stats
watch -n 5 'curl -s http://localhost:8080/api/v1/system/info | jq'

# Monitor running jobs
watch -n 2 'curl -s "http://localhost:8080/api/v1/jobs?status=running" | jq ".jobs | length"'
```

### Job Control

```bash
# Cancel a running job
curl -X POST "http://localhost:8080/api/v1/jobs/job-id/cancel"

# Duplicate a job
curl -X POST "http://localhost:8080/api/v1/jobs/job-id/duplicate" \
  -H "Content-Type: application/json" \
  -d '{
    "timeout": 600
  }'

# Duplicate job to different server
curl -X POST "http://localhost:8080/api/v1/jobs/job-id/duplicate" \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "different-server-id",
    "timeout": 900
  }'
```

## Advanced Use Cases

### Multi-Server Operations

#### Execute on Multiple Servers

```bash
# Get list of server IDs
SERVER_IDS=$(curl -s http://localhost:8080/api/v1/servers | jq -r '.servers[].id')

# Execute command on all servers
for server_id in $SERVER_IDS; do
  echo "Executing on server: $server_id"
  curl -X POST http://localhost:8080/api/v1/jobs \
    -H "Content-Type: application/json" \
    -d "{
      \"command\": \"df\",
      \"args\": \"-h\",
      \"server_id\": \"$server_id\",
      \"timeout\": 60
    }"
done
```

#### Parallel Execution with Wait

```bash
#!/bin/bash
# Submit jobs to multiple servers and wait for completion

SERVERS=("server-1" "server-2" "server-3")
JOB_IDS=()

# Submit jobs
for server in "${SERVERS[@]}"; do
  echo "Submitting job to $server"
  response=$(curl -s -X POST http://localhost:8080/api/v1/jobs \
    -H "Content-Type: application/json" \
    -d "{
      \"command\": \"uptime\",
      \"server_id\": \"$server\",
      \"timeout\": 60
    }")

  job_id=$(echo $response | jq -r '.id')
  JOB_IDS+=($job_id)
  echo "Job submitted: $job_id"
done

# Wait for completion
echo "Waiting for jobs to complete..."
for job_id in "${JOB_IDS[@]}"; do
  while true; do
    status=$(curl -s "http://localhost:8080/api/v1/jobs/$job_id" | jq -r '.status')
    if [[ "$status" == "completed" || "$status" == "failed" || "$status" == "canceled" ]]; then
      echo "Job $job_id completed with status: $status"
      break
    fi
    sleep 2
  done
done

echo "All jobs completed!"
```

### Conditional Execution

```bash
# Execute script with conditional logic
curl -X POST http://localhost:8080/api/v1/jobs/script \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\nset -e\n\n# Check if service is running\nif systemctl is-active --quiet nginx; then\n  echo \"Nginx is running, reloading configuration...\"\n  sudo nginx -t && sudo nginx -s reload\n  echo \"Configuration reloaded successfully\"\nelse\n  echo \"Nginx is not running, starting service...\"\n  sudo systemctl start nginx\n  echo \"Nginx started successfully\"\nfi\n\n# Verify status\nsudo systemctl status nginx --no-pager",
    "server_id": "server-id",
    "timeout": 120,
    "shell": "/bin/bash"
  }'
```

### Scheduled Operations

```bash
# Create a monitoring job that runs every 5 minutes
# (This would typically be done via a cron job or scheduler)

while true; do
  echo "Running health check at $(date)"
  curl -X POST http://localhost:8080/api/v1/jobs/script \
    -H "Content-Type: application/json" \
    -d '{
      "script": "#!/bin/bash\necho \"Health check: $(date)\"\ndf -h | grep -E \"(Filesystem|/dev/)\"\nfree -h\nuptime",
      "server_id": "server-id",
      "timeout": 60,
      "shell": "/bin/bash"
    }'

  sleep 300  # Wait 5 minutes
done
```

## Integration Examples

### Shell Script Integration

```bash
#!/bin/bash
# deploy-to-servers.sh - Deploy application to multiple servers

API_BASE="http://localhost:8080/api/v1"
SERVERS=("web-01" "web-02" "web-03")
DEPLOY_SCRIPT="#!/bin/bash
set -e
cd /opt/myapp
git pull origin main
npm install --production
npm run build
sudo systemctl restart myapp
echo 'Deployment completed on \$(hostname)'"

echo "Starting deployment to ${#SERVERS[@]} servers..."

# Submit deployment jobs
for server_name in "${SERVERS[@]}"; do
  echo "Deploying to $server_name..."

  # Get server ID by name
  server_id=$(curl -s "$API_BASE/servers" | jq -r ".servers[] | select(.name == \"$server_name\") | .id")

  if [ "$server_id" == "null" ] || [ -z "$server_id" ]; then
    echo "Error: Server $server_name not found"
    continue
  fi

  # Submit deployment job
  job_response=$(curl -s -X POST "$API_BASE/jobs/script" \
    -H "Content-Type: application/json" \
    -d "{
      \"script\": \"$DEPLOY_SCRIPT\",
      \"server_id\": \"$server_id\",
      \"timeout\": 1800,
      \"shell\": \"/bin/bash\"
    }")

  job_id=$(echo $job_response | jq -r '.id')
  echo "Deployment job submitted for $server_name: $job_id"
done

echo "All deployment jobs submitted!"
```

### Python Integration

```python
#!/usr/bin/env python3
# newremora_client.py - Python client for NewRemora API

import requests
import json
import time
from typing import Dict, List, Optional

class NewRemoraClient:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url.rstrip('/')
        self.api_base = f"{self.base_url}/api/v1"

    def get_servers(self) -> List[Dict]:
        """Get list of all servers"""
        response = requests.get(f"{self.api_base}/servers")
        response.raise_for_status()
        return response.json().get('servers', [])

    def submit_job(self, command: str, server_id: str, args: str = "", timeout: int = 300) -> Dict:
        """Submit a job for execution"""
        payload = {
            "command": command,
            "args": args,
            "server_id": server_id,
            "timeout": timeout
        }
        response = requests.post(f"{self.api_base}/jobs", json=payload)
        response.raise_for_status()
        return response.json()

    def submit_script(self, script: str, server_id: str, timeout: int = 300, shell: str = "/bin/bash") -> Dict:
        """Submit a script for execution"""
        payload = {
            "script": script,
            "server_id": server_id,
            "timeout": timeout,
            "shell": shell
        }
        response = requests.post(f"{self.api_base}/jobs/script", json=payload)
        response.raise_for_status()
        return response.json()

    def get_job(self, job_id: str) -> Dict:
        """Get job details"""
        response = requests.get(f"{self.api_base}/jobs/{job_id}")
        response.raise_for_status()
        return response.json()

    def wait_for_job(self, job_id: str, poll_interval: int = 2) -> Dict:
        """Wait for job completion and return final status"""
        while True:
            job = self.get_job(job_id)
            status = job.get('status')

            if status in ['completed', 'failed', 'canceled']:
                return job

            time.sleep(poll_interval)

# Example usage
if __name__ == "__main__":
    client = NewRemoraClient()

    # Get servers
    servers = client.get_servers()
    if not servers:
        print("No servers configured")
        exit(1)

    server_id = servers[0]['id']
    print(f"Using server: {servers[0]['name']} ({server_id})")

    # Submit a simple job
    job = client.submit_job("uname", server_id, "-a")
    job_id = job['id']
    print(f"Job submitted: {job_id}")

    # Wait for completion
    final_job = client.wait_for_job(job_id)
    print(f"Job completed with status: {final_job['status']}")
    print(f"Output: {final_job.get('output', 'No output')}")
```

### Node.js Integration

```javascript
// newremora-client.js - Node.js client for NewRemora API

const axios = require("axios");

class NewRemoraClient {
  constructor(baseUrl = "http://localhost:8080") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiBase = `${this.baseUrl}/api/v1`;
  }

  async getServers() {
    const response = await axios.get(`${this.apiBase}/servers`);
    return response.data.servers || [];
  }

  async submitJob(command, serverId, args = "", timeout = 300) {
    const payload = {
      command,
      args,
      server_id: serverId,
      timeout,
    };
    const response = await axios.post(`${this.apiBase}/jobs`, payload);
    return response.data;
  }

  async submitScript(script, serverId, timeout = 300, shell = "/bin/bash") {
    const payload = {
      script,
      server_id: serverId,
      timeout,
      shell,
    };
    const response = await axios.post(`${this.apiBase}/jobs/script`, payload);
    return response.data;
  }

  async getJob(jobId) {
    const response = await axios.get(`${this.apiBase}/jobs/${jobId}`);
    return response.data;
  }

  async waitForJob(jobId, pollInterval = 2000) {
    while (true) {
      const job = await this.getJob(jobId);
      const status = job.status;

      if (["completed", "failed", "canceled"].includes(status)) {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  async executeScript(script, serverId, timeout = 300) {
    const job = await this.submitScript(script, serverId, timeout);
    console.log(`Job submitted: ${job.id}`);

    const finalJob = await this.waitForJob(job.id);
    console.log(`Job completed with status: ${finalJob.status}`);

    return finalJob;
  }
}

// Example usage
async function main() {
  const client = new NewRemoraClient();

  try {
    // Get servers
    const servers = await client.getServers();
    if (servers.length === 0) {
      console.log("No servers configured");
      return;
    }

    const serverId = servers[0].id;
    console.log(`Using server: ${servers[0].name} (${serverId})`);

    // Execute a health check script
    const healthCheckScript = `#!/bin/bash
echo "=== System Health Check ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Disk Usage:"
df -h | head -5
echo "Memory Usage:"
free -h
echo "Health check completed"`;

    const result = await client.executeScript(healthCheckScript, serverId, 120);
    console.log("Script output:", result.output);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = NewRemoraClient;
```

These examples demonstrate the full range of capabilities available in NewRemora, from simple command execution to complex automation workflows and integration with external systems.
