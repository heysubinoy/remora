# Job Executor - Unified Docker Deployment

This document describes how to deploy the complete Job Executor system using Docker Compose.

## System Overview

The unified Docker Compose setup includes:

- **PostgreSQL Database**: Persistent data storage for jobs and server configurations
- **RabbitMQ**: Message queue for job distribution and real-time updates
- **API Service**: REST API server with job management endpoints
- **Worker Service**: Background job processor that executes commands via SSH
- **Next.js Frontend**: Modern web interface for job management
- **Nginx Reverse Proxy**: Production-ready load balancer and SSL termination (optional)

## Quick Start

### Prerequisites

- Docker 20.10+ 
- Docker Compose 2.0+
- At least 2GB RAM available
- Ports 3000, 5432, 5672, 8080, 15672 available

### Start the System

```bash
# Clone and navigate to the project
cd /path/to/job-executor

# Make the startup script executable (Linux/macOS)
chmod +x start-system.sh

# Start the complete system
./start-system.sh start

# Or use Docker Compose directly
docker compose up -d
```

### Access the Services

After startup, the following services will be available:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Web Interface** | http://localhost:3000 | N/A |
| **API Server** | http://localhost:8080 | N/A |
| **RabbitMQ Management** | http://localhost:15672 | admin / password123 |
| **PostgreSQL** | localhost:5432 | jobexecutor / password123 |

## Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   Nginx         │    │   API Server    │
│   Frontend      │◄──►│   Reverse Proxy │◄──►│   (Go/Gin)      │
│   (Port 3000)   │    │   (Port 80)     │    │   (Port 8080)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │◄──►│   RabbitMQ      │◄──►│   Worker        │
│   Database      │    │   Message Queue │    │   Service       │
│   (Port 5432)   │    │   (Port 5672)   │    │   (SSH Exec)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuration

### Environment Variables

Copy the template and customize:

```bash
cp .env.template .env
# Edit .env with your preferred settings
```

Key configuration options:

- **AWS**: AWS credentials for cloud service integration
- **Database**: PostgreSQL connection settings
- **RabbitMQ**: Message queue authentication
- **Security**: JWT secrets and encryption keys
- **Performance**: Connection limits and timeouts
- **File Uploads**: Size limits and allowed types

### Volumes and Persistence

The system uses persistent volumes for:

- **postgres_data**: Database files
- **rabbitmq_data**: Message queue data
- **./data**: Application data and logs
- **./pem-files**: SSH private key storage

## Production Deployment

### Enable Nginx Reverse Proxy

For production deployments with SSL and load balancing:

```bash
# Start with Nginx reverse proxy
docker compose --profile production up -d

# Or using the startup script
./start-system.sh start
# Then manually start nginx
docker compose up -d nginx
```

### SSL Configuration

1. Place SSL certificates in the `ssl/` directory:
   ```
   ssl/
   ├── cert.pem
   └── key.pem
   ```

2. Uncomment and configure the HTTPS server block in `nginx.conf`

3. Update the frontend environment to use HTTPS:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-domain.com
   ```

### Security Hardening

For production use:

1. **Change default passwords** in `.env`:
   ```bash
   POSTGRES_PASSWORD=your-secure-db-password
   RABBITMQ_DEFAULT_PASS=your-secure-rabbitmq-password
   JWT_SECRET=your-super-secure-jwt-secret
   ```

2. **Configure AWS credentials** in `.env`:
   ```bash
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_DEFAULT_REGION=your-preferred-region
   ```

3. **Configure firewall** to restrict access:
   - Only expose port 80/443 (Nginx) externally
   - Keep other ports (5432, 5672, 8080) internal

3. **Enable database SSL** in production

4. **Set up monitoring** and log aggregation

## Management Commands

### Using the Startup Script

```bash
# Start the system
./start-system.sh start

# Stop the system
./start-system.sh stop

# Restart the system
./start-system.sh restart

# Show system status
./start-system.sh status

# View logs (all services)
./start-system.sh logs

# View logs (specific service)
./start-system.sh logs job-executor-api

# Reset system (removes all data!)
./start-system.sh reset
```

### Using Docker Compose Directly

```bash
# Start all services
docker compose up -d

# Start specific services
docker compose up -d postgres rabbitmq job-executor-api

# View logs
docker compose logs -f job-executor-api

# Stop services
docker compose down

# Remove volumes (data loss!)
docker compose down -v
```

### Service Management

```bash
# Scale worker instances
docker compose up -d --scale job-executor-worker=3

# Update a service
docker compose build job-executor-api
docker compose up -d job-executor-api

# Execute commands in containers
docker compose exec job-executor-api sh
docker compose exec postgres psql -U jobexecutor -d jobexecutor
```

## Monitoring and Troubleshooting

### Health Checks

All services include health checks accessible via:

```bash
# Check service health
docker compose ps

# Detailed health status
docker inspect job-executor-api | grep Health -A 20
```

### Log Aggregation

View logs from all services:

```bash
# Real-time logs
docker compose logs -f

# Recent logs
docker compose logs --tail=100

# Service-specific logs
docker compose logs job-executor-worker
```

### Database Access

Connect to PostgreSQL:

```bash
# Using Docker Compose
docker compose exec postgres psql -U jobexecutor -d jobexecutor

# Using external client
psql -h localhost -p 5432 -U jobexecutor -d jobexecutor
```

### RabbitMQ Management

Access RabbitMQ Management UI:
- URL: http://localhost:15672
- Username: admin
- Password: password123

## Backup and Recovery

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U jobexecutor jobexecutor > backup.sql

# Restore backup
docker compose exec -T postgres psql -U jobexecutor -d jobexecutor < backup.sql
```

### Complete System Backup

```bash
# Stop services
docker compose down

# Backup data directories
tar -czf job-executor-backup-$(date +%Y%m%d).tar.gz data/ pem-files/

# Backup database volume
docker run --rm -v job-executor_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz -C /data .
```

## Performance Tuning

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  job-executor-api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### Database Optimization

Tune PostgreSQL settings in `docker-compose.yml`:

```yaml
postgres:
  command: postgres -c max_connections=200 -c shared_buffers=256MB -c effective_cache_size=1GB
```

### Scaling Workers

Scale worker instances based on load:

```bash
# Scale to 5 worker instances
docker compose up -d --scale job-executor-worker=5
```

## Development Mode

For development with hot reloading:

```bash
# Start only infrastructure services
docker compose up -d postgres rabbitmq

# Run API and worker locally
go run cmd/api/main.go &
go run cmd/worker/main.go &

# Run frontend in development mode
cd web/src
pnpm dev
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 5432, 5672, 8080, 15672 are available
2. **Permission issues**: Check file permissions for `./data` and `./pem-files`
3. **Memory issues**: Ensure at least 2GB RAM is available
4. **Network issues**: Verify Docker network configuration

### Reset System

If you encounter persistent issues:

```bash
# Complete system reset (destroys all data!)
./start-system.sh reset

# Or manually
docker compose down -v --remove-orphans
docker system prune -f
rm -rf data/* pem-files/*
```

## Contributing

When contributing to the Docker setup:

1. Test changes with both `docker-compose` and `docker compose`
2. Ensure all services start cleanly and pass health checks
3. Update this documentation for any configuration changes
4. Test both development and production profiles
