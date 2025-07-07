# Job Executor - Unified Docker Compose Startup Script (PowerShell)
param(
    [Parameter(Position=0)]
    [string]$Command = "start",
    
    [Parameter(Position=1)]
    [string]$Service = ""
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$White = "White"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

# Function to check if Docker is running
function Test-Docker {
    try {
        docker info | Out-Null
        Write-Success "Docker is running"
        return $true
    }
    catch {
        Write-Error "Docker is not running. Please start Docker Desktop and try again."
        return $false
    }
}

# Function to check if Docker Compose is available
function Test-DockerCompose {
    $composeAvailable = $false
    
    try {
        docker-compose version | Out-Null
        $composeAvailable = $true
        $script:ComposeCmd = "docker-compose"
    }
    catch {
        try {
            docker compose version | Out-Null
            $composeAvailable = $true
            $script:ComposeCmd = "docker compose"
        }
        catch {
            Write-Error "Docker Compose is not available. Please install Docker Compose and try again."
            return $false
        }
    }
    
    Write-Success "Docker Compose is available ($script:ComposeCmd)"
    return $true
}

# Function to create required directories
function New-RequiredDirectories {
    Write-Status "Creating required directories..."
    
    $directories = @("data", "pem-files", "ssl")
    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-Success "Directories created"
}

# Function to start the system
function Start-System {
    Write-Status "Starting Job Executor system..."
    
    # Start core services (without nginx by default)
    Write-Status "Starting core services (PostgreSQL, RabbitMQ, API, Worker, Frontend)..."
    & $script:ComposeCmd up -d postgres rabbitmq job-executor-api job-executor-worker job-executor-frontend
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Waiting for services to be healthy..."
        Start-Sleep -Seconds 10
        
        # Check service health
        Write-Status "Checking service health..."
        & $script:ComposeCmd ps
        
        Write-Success "Job Executor system started successfully!"
        Write-Host ""
        Write-Status "Service URLs:"
        Write-Host "  🌐 Frontend (Next.js):     http://localhost:3000" -ForegroundColor $White
        Write-Host "  🔗 API Server:             http://localhost:8080" -ForegroundColor $White
        Write-Host "  📊 RabbitMQ Management:    http://localhost:15672 (admin/password123)" -ForegroundColor $White
        Write-Host "  🗄️  PostgreSQL:            localhost:5432 (jobexecutor/password123)" -ForegroundColor $White
        Write-Host ""
        Write-Status "To start with Nginx reverse proxy (production mode):"
        Write-Host "  $script:ComposeCmd --profile production up -d" -ForegroundColor $White
        Write-Host ""
        Write-Status "To view logs:"
        Write-Host "  $script:ComposeCmd logs -f [service-name]" -ForegroundColor $White
        Write-Host ""
        Write-Status "To stop the system:"
        Write-Host "  $script:ComposeCmd down" -ForegroundColor $White
    }
    else {
        Write-Error "Failed to start services"
        exit 1
    }
}

# Function to stop the system
function Stop-System {
    Write-Status "Stopping Job Executor system..."
    
    & $script:ComposeCmd down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Job Executor system stopped"
    }
    else {
        Write-Error "Failed to stop system"
    }
}

# Function to show logs
function Show-Logs {
    param([string]$ServiceName)
    
    if ($ServiceName) {
        Write-Status "Showing logs for $ServiceName..."
        & $script:ComposeCmd logs -f $ServiceName
    }
    else {
        Write-Status "Showing logs for all services..."
        & $script:ComposeCmd logs -f
    }
}

# Function to show system status
function Show-Status {
    Write-Status "Job Executor System Status:"
    & $script:ComposeCmd ps
}

# Function to reset the system
function Reset-System {
    Write-Warning "This will stop all services and remove all data (databases, volumes, etc.)"
    $response = Read-Host "Are you sure you want to continue? (y/N)"
    
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Status "Resetting Job Executor system..."
        
        & $script:ComposeCmd down -v --remove-orphans
        
        # Remove local data directories
        if (Test-Path "data") {
            Remove-Item -Path "data\*" -Recurse -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path "pem-files") {
            Remove-Item -Path "pem-files\*" -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        Write-Success "System reset complete"
    }
    else {
        Write-Status "Reset cancelled"
    }
}

# Function to show help
function Show-Help {
    Write-Host "Job Executor - Unified Docker Compose Management" -ForegroundColor $Green
    Write-Host ""
    Write-Host "Usage: .\start-system.ps1 [COMMAND] [OPTIONS]" -ForegroundColor $White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor $Yellow
    Write-Host "  start          Start the Job Executor system (default)" -ForegroundColor $White
    Write-Host "  stop           Stop the Job Executor system" -ForegroundColor $White
    Write-Host "  restart        Restart the Job Executor system" -ForegroundColor $White
    Write-Host "  logs [service] Show logs for all services or specific service" -ForegroundColor $White
    Write-Host "  status         Show system status" -ForegroundColor $White
    Write-Host "  reset          Reset system (removes all data)" -ForegroundColor $White
    Write-Host "  help           Show this help message" -ForegroundColor $White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $Yellow
    Write-Host "  .\start-system.ps1 start                    # Start the system" -ForegroundColor $White
    Write-Host "  .\start-system.ps1 logs job-executor-api    # Show API logs" -ForegroundColor $White
    Write-Host "  .\start-system.ps1 logs                     # Show all logs" -ForegroundColor $White
    Write-Host "  .\start-system.ps1 status                   # Show system status" -ForegroundColor $White
}

# Main script logic
switch ($Command.ToLower()) {
    "start" {
        if ((Test-Docker) -and (Test-DockerCompose)) {
            New-RequiredDirectories
            Start-System
        }
    }
    "stop" {
        if (Test-DockerCompose) {
            Stop-System
        }
    }
    "restart" {
        if ((Test-Docker) -and (Test-DockerCompose)) {
            Stop-System
            Start-Sleep -Seconds 5
            New-RequiredDirectories
            Start-System
        }
    }
    "logs" {
        if (Test-DockerCompose) {
            Show-Logs $Service
        }
    }
    "status" {
        if (Test-DockerCompose) {
            Show-Status
        }
    }
    "reset" {
        if (Test-DockerCompose) {
            Reset-System
        }
    }
    "help" {
        Show-Help
    }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host "Use '.\start-system.ps1 help' for usage information" -ForegroundColor $White
        exit 1
    }
}
