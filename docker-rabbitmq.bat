@echo off
REM Docker Compose Management Script for Job Executor RabbitMQ

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="status" goto status
if "%1"=="logs" goto logs
if "%1"=="clean" goto clean
goto help

:help
echo Docker Compose Management for Job Executor RabbitMQ
echo ===================================================
echo.
echo Usage: %~nx0 [command]
echo.
echo Commands:
echo   start     - Start RabbitMQ service
echo   stop      - Stop RabbitMQ service  
echo   restart   - Restart RabbitMQ service
echo   status    - Show service status
echo   logs      - Show RabbitMQ logs
echo   clean     - Stop and remove all containers and volumes
echo   help      - Show this help
echo.
echo RabbitMQ Management UI: http://localhost:15672
echo Default credentials: admin / password123
goto end

:start
echo Starting RabbitMQ service...
docker-compose up -d rabbitmq
if errorlevel 1 (
    echo Failed to start RabbitMQ service
    goto end
)
echo RabbitMQ service started successfully
echo.
echo Waiting for RabbitMQ to be ready...
timeout /t 10 /nobreak >nul
echo.
echo RabbitMQ Management UI: http://localhost:15672
echo Username: admin
echo Password: password123
echo.
echo To connect from Job Executor, use:
echo set RABBITMQ_URL=amqp://admin:password123@localhost:5672/job-executor
goto end

:stop
echo Stopping RabbitMQ service...
docker-compose stop rabbitmq
echo RabbitMQ service stopped
goto end

:restart
echo Restarting RabbitMQ service...
docker-compose restart rabbitmq
echo RabbitMQ service restarted
goto end

:status
echo Service Status:
echo ===============
docker-compose ps
goto end

:logs
echo RabbitMQ Logs:
echo ==============
docker-compose logs -f rabbitmq
goto end

:clean
echo WARNING: This will remove all RabbitMQ data!
set /p confirm="Are you sure? (y/N): "
if /i not "%confirm%"=="y" (
    echo Cancelled
    goto end
)
echo Stopping and removing containers and volumes...
docker-compose down -v
echo Cleanup complete
goto end

:end
