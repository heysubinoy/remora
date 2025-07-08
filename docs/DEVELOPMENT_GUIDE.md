# Development Guide

Complete guide for developing and contributing to NewRemora.

## Prerequisites

- **Go 1.23+**: Latest stable version
- **Node.js 18+**: For frontend development
- **pnpm**: Package manager for frontend
- **Docker & Docker Compose**: For dependencies and testing
- **Git**: Version control
- **Make**: Build automation (optional)

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url> newremora
cd newremora
```

### 2. Start Development Dependencies

```bash
# Start PostgreSQL and RabbitMQ
docker compose up -d postgres rabbitmq

# Wait for services to be ready
docker compose logs -f postgres rabbitmq
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
vim .env
```

**Key environment variables for development:**

```bash
# Database
DATABASE_URL=postgres://job_executor:job_password@localhost:5432/job_executor_db

# RabbitMQ
RABBITMQ_URL=amqp://admin:password123@localhost:5672/job-executor

# API Server
SERVER_ADDR=:8080
LOG_LEVEL=debug

# Worker
WORKER_CONCURRENCY=5
```

### 4. Backend Development

```bash
# Install Go dependencies
go mod download

# Run database migrations (if needed)
# go run migrations/migrate.go

# Start API server in development mode
go run cmd/api/main.go

# In another terminal, start worker
go run cmd/worker/main.go
```

### 5. Frontend Development

```bash
cd web

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The web interface will be available at http://localhost:3000

## Project Structure

```
NewRemora/
├── 📁 cmd/                    # Application entry points
│   ├── api/                   # API server
│   │   └── main.go           # API server entry point
│   ├── client/               # CLI client
│   │   └── main.go           # CLI entry point
│   └── worker/               # Background worker
│       └── main.go           # Worker entry point
│
├── 📁 internal/              # Private application code
│   ├── api/                  # HTTP API implementation
│   │   ├── handlers.go       # Route setup
│   │   ├── job_handlers.go   # Job-related endpoints
│   │   └── server_handlers.go# Server management endpoints
│   ├── broadcast/            # Real-time output broadcasting
│   ├── config/               # Configuration management
│   ├── database/             # Database initialization
│   ├── models/               # Data structures and ORM models
│   ├── queue/                # Job queue implementation
│   ├── ssh/                  # SSH client functionality
│   ├── storage/              # File storage management
│   └── worker/               # Job processing logic
│
├── 📁 web/                   # Next.js frontend
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   ├── hooks/                # Custom React hooks
│   ├── services/             # API client services
│   └── types/                # TypeScript definitions
│
├── 📁 docs/                  # Documentation
├── 📁 examples/              # Usage examples and scripts
├── 📁 deployment/            # Docker and deployment configs
├── 📁 bin/                   # Compiled binaries
└── 📁 pem-files/             # Uploaded SSH keys
```

## Development Workflow

### Backend Development

#### 1. Code Organization

- **Models**: Define data structures in `internal/models/`
- **Handlers**: Implement HTTP endpoints in `internal/api/`
- **Services**: Business logic in respective packages
- **Tests**: Co-locate tests with code (`*_test.go`)

#### 2. Adding New Features

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Implement feature
# - Add models if needed
# - Implement handlers
# - Add tests
# - Update documentation

# 3. Test locally
go test ./...
go run cmd/api/main.go

# 4. Submit PR
```

#### 3. Database Changes

```bash
# Add migration files to migrations/
# Update models in internal/models/
# Test migrations locally
```

### Frontend Development

#### 1. Component Development

```bash
cd web

# Create new component
mkdir components/new-component
touch components/new-component/index.tsx

# Use existing patterns
# - TypeScript for type safety
# - Tailwind CSS for styling
# - shadcn/ui components when possible
```

#### 2. State Management

- Use React hooks for local state
- API calls via custom hooks in `hooks/`
- Real-time updates with Server-Sent Events

#### 3. Testing

```bash
# Run tests
pnpm test

# Run linting
pnpm lint

# Type checking
pnpm type-check
```

## Testing

### Backend Testing

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific package tests
go test ./internal/api/

# Run integration tests
go test -tags=integration ./...
```

### Frontend Testing

```bash
cd web

# Unit tests
pnpm test

# E2E tests (if configured)
pnpm test:e2e

# Component testing
pnpm test:components
```

### Integration Testing

```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run comprehensive tests
./examples/comprehensive-job-test.sh

# Load testing
./examples/load-test.sh
```

## Building and Deployment

### Development Build

```bash
# Backend
go build -o bin/job-executor-api ./cmd/api
go build -o bin/job-executor-worker ./cmd/worker
go build -o bin/client ./cmd/client

# Frontend
cd web && pnpm build
```

### Production Build

```bash
# Using Makefile
make build-all

# Manual build with optimizations
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o bin/job-executor-api ./cmd/api
CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o bin/job-executor-worker ./cmd/worker

# Docker images
docker compose build
```

## Code Style and Standards

### Go Code Style

- Follow standard Go formatting: `gofmt -s`
- Use `golangci-lint` for linting
- Follow effective Go practices
- Use structured logging with `slog`
- Implement proper error handling

```bash
# Format code
gofmt -s -w .

# Run linter
golangci-lint run

# Vet code
go vet ./...
```

### TypeScript/React Style

- Use TypeScript for type safety
- Follow React hooks patterns
- Use functional components
- Implement proper error boundaries

```bash
cd web

# Format code
pnpm format

# Lint code
pnpm lint

# Type check
pnpm type-check
```

### Documentation Standards

- Document all public APIs
- Include code examples
- Update README for user-facing changes
- Add inline comments for complex logic

## Debugging

### Backend Debugging

```bash
# Enable debug logging
export LOG_LEVEL=debug
go run cmd/api/main.go

# Use delve debugger
dlv debug cmd/api/main.go

# Attach to running process
dlv attach <pid>
```

### Frontend Debugging

```bash
cd web

# Start with debugging
pnpm dev

# Use browser dev tools
# React DevTools extension
# Network tab for API calls
```

### Database Debugging

```bash
# Connect to development database
psql postgres://job_executor:job_password@localhost:5432/job_executor_db

# View logs
docker compose logs postgres

# Backup/restore
pg_dump -h localhost -U job_executor job_executor_db > backup.sql
```

### RabbitMQ Debugging

```bash
# Access management interface
# http://localhost:15672 (admin/password123)

# View logs
docker compose logs rabbitmq

# CLI tools
docker exec -it rabbitmq rabbitmqctl list_queues
```

## Performance Optimization

### Backend Performance

- Use connection pooling for database
- Implement proper caching
- Optimize database queries
- Use context for cancellation
- Monitor goroutine leaks

### Frontend Performance

- Optimize re-renders with useMemo/useCallback
- Implement proper pagination
- Use proper image optimization
- Minimize bundle size

## Security Considerations

### Development Security

- Never commit secrets to version control
- Use environment variables for configuration
- Implement input validation
- Use HTTPS in production
- Regular dependency updates

### Testing Security

```bash
# Scan for vulnerabilities
go mod verify
govulncheck ./...

# Frontend security
cd web && pnpm audit
```

## Common Issues and Solutions

### Database Connection Issues

```bash
# Check PostgreSQL status
docker compose ps postgres

# View logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### RabbitMQ Connection Issues

```bash
# Check RabbitMQ status
docker compose ps rabbitmq

# View management interface
open http://localhost:15672

# Reset RabbitMQ
docker compose restart rabbitmq
```

### Build Issues

```bash
# Clear Go module cache
go clean -modcache

# Reinstall dependencies
go mod download

# Clear frontend cache
cd web && pnpm install --frozen-lockfile
```

## Contribution Guidelines

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests for new functionality**
5. **Update documentation**
6. **Submit a pull request**

### PR Requirements

- All tests must pass
- Code must be formatted properly
- Documentation must be updated
- No breaking changes without discussion
- Follow semantic versioning

### Code Review Process

1. Automated checks (CI/CD)
2. Peer review
3. Maintainer approval
4. Merge to main branch

## Release Process

1. **Version bump** following semantic versioning
2. **Update CHANGELOG.md**
3. **Create release tag**
4. **Build and test release artifacts**
5. **Deploy to staging**
6. **Deploy to production**

## Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and discussions
- **Documentation**: Check docs/ folder
- **Examples**: See examples/ folder

## Resources

- [Go Documentation](https://golang.org/doc/)
- [Next.js Documentation](https://nextjs.org/docs)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
