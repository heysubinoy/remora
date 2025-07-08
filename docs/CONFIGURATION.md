# Configuration Guide

Complete configuration reference for NewRemora.

## Environment Variables

### Core Application Settings

| Variable      | Default       | Description                                    |
| ------------- | ------------- | ---------------------------------------------- |
| `SERVER_ADDR` | `:8080`       | API server bind address                        |
| `LOG_LEVEL`   | `info`        | Logging level (debug, info, warn, error)       |
| `ENV`         | `development` | Environment (development, staging, production) |
| `DEBUG`       | `false`       | Enable debug mode                              |

### Database Configuration

| Variable                  | Default     | Description                  |
| ------------------------- | ----------- | ---------------------------- |
| `DATABASE_URL`            | `./jobs.db` | Database connection string   |
| `DB_MAX_CONNECTIONS`      | `25`        | Maximum database connections |
| `DB_MAX_IDLE_CONNECTIONS` | `5`         | Maximum idle connections     |
| `DB_CONNECTION_LIFETIME`  | `5m`        | Connection lifetime          |

#### Database URL Examples

```bash
# SQLite (development)
DATABASE_URL="./jobs.db"

# PostgreSQL (production)
DATABASE_URL="postgres://username:password@localhost:5432/dbname"
DATABASE_URL="postgres://user:pass@localhost/dbname?sslmode=disable"
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"
```

### RabbitMQ Configuration

| Variable                   | Default                              | Description                       |
| -------------------------- | ------------------------------------ | --------------------------------- |
| `RABBITMQ_URL`             | `amqp://guest:guest@localhost:5672/` | RabbitMQ connection URL           |
| `RABBITMQ_QUEUE_NAME`      | `job-executor-jobs`                  | Job queue name                    |
| `RABBITMQ_EXCHANGE`        | `job-executor`                       | Exchange name                     |
| `RABBITMQ_ROUTING_KEY`     | `jobs`                               | Routing key                       |
| `RABBITMQ_PREFETCH_COUNT`  | `10`                                 | Number of unacknowledged messages |
| `RABBITMQ_RECONNECT_DELAY` | `5s`                                 | Reconnection delay                |
| `RABBITMQ_MAX_RETRIES`     | `5`                                  | Maximum retry attempts            |

#### RabbitMQ URL Examples

```bash
# Local development
RABBITMQ_URL="amqp://guest:guest@localhost:5672/"

# With custom user and vhost
RABBITMQ_URL="amqp://admin:password123@localhost:5672/job-executor"

# With TLS
RABBITMQ_URL="amqps://user:pass@rabbitmq.example.com:5671/vhost"

# With connection parameters
RABBITMQ_URL="amqp://user:pass@host:5672/vhost?heartbeat=30&connection_timeout=10"
```

### Worker Configuration

| Variable                    | Default | Description                          |
| --------------------------- | ------- | ------------------------------------ |
| `WORKER_CONCURRENCY`        | `10`    | Number of concurrent jobs per worker |
| `WORKER_POLL_INTERVAL`      | `1s`    | Queue polling interval               |
| `WORKER_HEARTBEAT_INTERVAL` | `30s`   | Worker heartbeat interval            |
| `WORKER_MAX_RETRIES`        | `3`     | Maximum job retry attempts           |
| `WORKER_RETRY_DELAY`        | `30s`   | Delay between retries                |

### SSH Configuration

| Variable                 | Default | Description                     |
| ------------------------ | ------- | ------------------------------- |
| `SSH_TIMEOUT`            | `30s`   | SSH connection timeout          |
| `SSH_KEEPALIVE_INTERVAL` | `30s`   | SSH keepalive interval          |
| `SSH_MAX_SESSIONS`       | `100`   | Maximum concurrent SSH sessions |
| `SSH_RETRY_ATTEMPTS`     | `3`     | SSH connection retry attempts   |
| `SSH_RETRY_DELAY`        | `5s`    | Delay between SSH retries       |

### Security Configuration

| Variable              | Default | Description                         |
| --------------------- | ------- | ----------------------------------- |
| `ENABLE_CORS`         | `true`  | Enable CORS middleware              |
| `ALLOWED_ORIGINS`     | `*`     | Comma-separated allowed origins     |
| `API_KEY`             | ``      | Optional API key for authentication |
| `JWT_SECRET`          | ``      | JWT secret for token authentication |
| `RATE_LIMIT_ENABLED`  | `true`  | Enable rate limiting                |
| `RATE_LIMIT_REQUESTS` | `100`   | Requests per minute per IP          |
| `RATE_LIMIT_BURST`    | `200`   | Burst limit                         |

### File Storage Configuration

| Variable                     | Default          | Description              |
| ---------------------------- | ---------------- | ------------------------ |
| `STORAGE_TYPE`               | `local`          | Storage type (local, s3) |
| `STORAGE_PATH`               | `./pem-files`    | Local storage path       |
| `STORAGE_MAX_FILE_SIZE`      | `10MB`           | Maximum file upload size |
| `STORAGE_ALLOWED_EXTENSIONS` | `.pem,.key,.pub` | Allowed file extensions  |

#### S3 Storage Configuration

| Variable                | Default      | Description      |
| ----------------------- | ------------ | ---------------- |
| `AWS_REGION`            | `us-east-1`  | AWS region       |
| `AWS_ACCESS_KEY_ID`     | ``           | AWS access key   |
| `AWS_SECRET_ACCESS_KEY` | ``           | AWS secret key   |
| `S3_BUCKET`             | ``           | S3 bucket name   |
| `S3_PREFIX`             | `pem-files/` | S3 object prefix |

### Monitoring and Observability

| Variable                | Default          | Description               |
| ----------------------- | ---------------- | ------------------------- |
| `METRICS_ENABLED`       | `false`          | Enable metrics collection |
| `METRICS_PORT`          | `9090`           | Metrics server port       |
| `HEALTH_CHECK_INTERVAL` | `30s`            | Health check interval     |
| `LOG_FORMAT`            | `json`           | Log format (json, text)   |
| `LOG_OUTPUT`            | `stdout`         | Log output (stdout, file) |
| `LOG_FILE_PATH`         | `./logs/app.log` | Log file path             |

### Frontend Configuration (Web)

| Variable                  | Default                 | Description         |
| ------------------------- | ----------------------- | ------------------- |
| `NEXT_PUBLIC_API_URL`     | `http://localhost:8080` | API base URL        |
| `NEXT_PUBLIC_WS_URL`      | `ws://localhost:8080`   | WebSocket URL       |
| `NEXT_PUBLIC_APP_NAME`    | `NewRemora`             | Application name    |
| `NEXT_PUBLIC_APP_VERSION` | ``                      | Application version |

## Configuration Files

### Environment File (.env)

```bash
# Core Settings
ENV=development
LOG_LEVEL=debug
SERVER_ADDR=:8080

# Database
DATABASE_URL=postgres://job_executor:job_password@localhost:5432/job_executor_db

# RabbitMQ
RABBITMQ_URL=amqp://admin:password123@localhost:5672/job-executor

# Worker
WORKER_CONCURRENCY=5

# SSH
SSH_TIMEOUT=30s
SSH_KEEPALIVE_INTERVAL=30s

# Security
ENABLE_CORS=true
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Storage
STORAGE_TYPE=local
STORAGE_PATH=./pem-files
STORAGE_MAX_FILE_SIZE=10MB

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30s
```

### Docker Environment (.env.docker)

```bash
# Production settings for Docker
ENV=production
LOG_LEVEL=info
SERVER_ADDR=:8080

# Use Docker service names
DATABASE_URL=postgres://job_executor:job_password@postgres:5432/job_executor_db
RABBITMQ_URL=amqp://admin:password123@rabbitmq:5672/job-executor

# Production worker settings
WORKER_CONCURRENCY=20

# Security
ENABLE_CORS=true
ALLOWED_ORIGINS=https://yourdomain.com

# Storage
STORAGE_TYPE=s3
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
```

## Configuration Validation

The application validates configuration on startup and will fail fast if required settings are missing or invalid.

### Required Settings

- `DATABASE_URL` (must be valid connection string)
- `RABBITMQ_URL` (if queue is enabled)

### Optional Settings

All other settings have sensible defaults and are optional.

## Runtime Configuration

Some settings can be updated at runtime without restart:

### Hot-Reloadable Settings

- `LOG_LEVEL` (via API or signal)
- `WORKER_CONCURRENCY` (via API)
- `RATE_LIMIT_REQUESTS` (via API)

### API Endpoints for Configuration

```bash
# Get current configuration
GET /api/v1/config

# Update log level
PUT /api/v1/config/log-level
{
  "level": "debug"
}

# Update worker concurrency
PUT /api/v1/config/worker-concurrency
{
  "concurrency": 15
}
```

## Environment-Specific Configurations

### Development

```bash
ENV=development
LOG_LEVEL=debug
DATABASE_URL=./jobs.db
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
WORKER_CONCURRENCY=3
METRICS_ENABLED=true
```

### Staging

```bash
ENV=staging
LOG_LEVEL=info
DATABASE_URL=postgres://staging_user:pass@staging-db:5432/staging_db
RABBITMQ_URL=amqp://staging:pass@staging-rabbitmq:5672/staging
WORKER_CONCURRENCY=10
METRICS_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### Production

```bash
ENV=production
LOG_LEVEL=warn
DATABASE_URL=postgres://prod_user:secure_pass@prod-db:5432/prod_db
RABBITMQ_URL=amqp://prod:secure_pass@prod-rabbitmq:5672/production
WORKER_CONCURRENCY=50
METRICS_ENABLED=true
RATE_LIMIT_ENABLED=true
API_KEY=your-secure-api-key
JWT_SECRET=your-jwt-secret
```

## Configuration Best Practices

### Security

1. **Never commit secrets** to version control
2. **Use environment variables** for sensitive data
3. **Rotate secrets regularly**
4. **Use different secrets** for each environment
5. **Implement proper access controls**

### Performance

1. **Tune worker concurrency** based on available resources
2. **Optimize database connections** for your workload
3. **Configure proper timeouts** to prevent hanging operations
4. **Monitor resource usage** and adjust accordingly

### Reliability

1. **Set appropriate retry limits** to prevent infinite loops
2. **Configure health checks** for monitoring
3. **Use connection pooling** for database and RabbitMQ
4. **Implement graceful shutdown** handling

### Monitoring

1. **Enable metrics collection** in production
2. **Configure proper logging levels** for each environment
3. **Set up alerting** for critical errors
4. **Monitor resource usage** and performance metrics

## Troubleshooting Configuration

### Common Issues

#### Database Connection Errors

```bash
# Check connection string format
DATABASE_URL="postgres://user:pass@host:port/dbname"

# Test connection
psql "$DATABASE_URL" -c "SELECT 1;"
```

#### RabbitMQ Connection Errors

```bash
# Check URL format
RABBITMQ_URL="amqp://user:pass@host:port/vhost"

# Test connection
curl -u admin:password123 http://localhost:15672/api/overview
```

#### Permission Errors

```bash
# Check file permissions
chmod 600 ./pem-files/*.pem

# Check directory permissions
chmod 755 ./pem-files/
```

### Debugging Configuration

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Check loaded configuration
curl http://localhost:8080/api/v1/config

# Validate configuration
./bin/job-executor-api --validate-config
```

## Configuration Schema

The application supports JSON schema validation for configuration files:

```json
{
  "type": "object",
  "properties": {
    "server": {
      "type": "object",
      "properties": {
        "addr": { "type": "string" },
        "log_level": { "enum": ["debug", "info", "warn", "error"] }
      }
    },
    "database": {
      "type": "object",
      "properties": {
        "url": { "type": "string" },
        "max_connections": { "type": "integer", "minimum": 1 }
      }
    }
  }
}
```

## Migration Between Configurations

When upgrading between versions, configuration may need to be migrated:

### Version Migration

```bash
# Check for configuration changes
./bin/job-executor-api --check-config-migration

# Migrate configuration
./bin/job-executor-api --migrate-config
```

### Backup Configuration

```bash
# Backup current configuration
cp .env .env.backup.$(date +%Y%m%d)

# Restore configuration
cp .env.backup.20241209 .env
```
