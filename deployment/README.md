# Deployment Files

This folder contains all the deployment-related files for the Job Executor system.

## Files

- **`DOCKER_DEPLOYMENT.md`** - Comprehensive deployment documentation
- **`init-db.sql`** - PostgreSQL database initialization script
- **`nginx.conf`** - Nginx reverse proxy configuration for production
- **`start-system.sh`** - Bash startup script for Linux/macOS
- **`start-system.ps1`** - PowerShell startup script for Windows
- **`.env.template`** - Environment variable template

## Quick Start

### Windows

```powershell
# From the project root directory
.\deployment\start-system.ps1 start
```

### Linux/macOS

```bash
# From the project root directory
chmod +x deployment/start-system.sh
./deployment/start-system.sh start
```

### Direct Docker Compose

```bash
# From the project root directory
docker compose up -d
```

## Documentation

For detailed deployment instructions, see [`DOCKER_DEPLOYMENT.md`](./DOCKER_DEPLOYMENT.md).

## Configuration

1. Copy the environment template:

   ```bash
   cp deployment/.env.template .env
   ```

2. Edit `.env` with your specific configuration values

3. Start the system using one of the startup scripts or Docker Compose directly
