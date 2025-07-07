@echo off
setlocal enabledelayedexpansion

:: Comprehensive Job Executor Test Script (Windows Version)
:: Tests the complete workflow: PEM upload, server creation, job execution, monitoring, and cancellation

set BASE_URL=http://localhost:8080/api/v1
set TEST_LOG=test_results.log

echo [%date% %time%] Starting Comprehensive Job Executor Test
echo ==============================================

:: Check if billa.pem exists
if not exist "billa.pem" (
    echo ERROR: billa.pem file not found! Please ensure the PEM file exists.
    pause
    exit /b 1
)

echo.
echo STEP 1: Uploading PEM Key
echo =========================

echo Uploading billa.pem file...
curl -s -X POST -F "pem_file=@billa.pem" "%BASE_URL%/pem-files/upload" > upload_response.json

:: Extract PEM file URL (simplified for batch)
echo Extracting PEM file URL...
for /f "tokens=2 delims=:," %%a in ('findstr "pem_file_url" upload_response.json') do (
    set PEM_URL=%%a
    set PEM_URL=!PEM_URL:"=!
    set PEM_URL=!PEM_URL: =!
)

if "!PEM_URL!"=="" (
    echo ERROR: Failed to extract PEM file URL
    type upload_response.json
    pause
    exit /b 1
)

echo SUCCESS: PEM file uploaded successfully!
echo PEM File URL: !PEM_URL!

echo.
echo STEP 2: Creating Server With PEM Key
echo ====================================

set SERVER_NAME=test-server-%random%

:: Create server JSON payload
echo { > server_payload.json
echo   "name": "%SERVER_NAME%", >> server_payload.json
echo   "hostname": "20.193.249.175", >> server_payload.json
echo   "port": 22, >> server_payload.json
echo   "user": "billa", >> server_payload.json
echo   "auth_type": "key", >> server_payload.json
echo   "pem_file_url": "!PEM_URL!", >> server_payload.json
echo   "is_active": true >> server_payload.json
echo } >> server_payload.json

echo Creating server: %SERVER_NAME%
curl -s -X POST -H "Content-Type: application/json" -d @server_payload.json "%BASE_URL%/servers" > server_response.json

:: Extract server ID (simplified)
for /f "tokens=2 delims=:," %%a in ('findstr "\"id\"" server_response.json') do (
    set SERVER_ID=%%a
    set SERVER_ID=!SERVER_ID:"=!
    set SERVER_ID=!SERVER_ID: =!
)

if "!SERVER_ID!"=="" (
    echo ERROR: Failed to extract server ID
    type server_response.json
    pause
    exit /b 1
)

echo SUCCESS: Server created successfully!
echo Server ID: !SERVER_ID!

echo.
echo STEP 3: Creating Test Jobs
echo ==========================

:: Job 1: Success job
echo Creating Job 1: Simple success job
echo { > job1.json
echo   "command": "echo", >> job1.json
echo   "args": "Hello from successful job!", >> job1.json
echo   "server_id": "!SERVER_ID!", >> job1.json
echo   "timeout": 60 >> job1.json
echo } >> job1.json

curl -s -X POST -H "Content-Type: application/json" -d @job1.json "%BASE_URL%/jobs" > job1_response.json

:: Job 2: Failure job
echo Creating Job 2: Job that will fail
echo { > job2.json
echo   "command": "nonexistent-command", >> job2.json
echo   "args": "this will fail", >> job2.json
echo   "server_id": "!SERVER_ID!", >> job2.json
echo   "timeout": 60 >> job2.json
echo } >> job2.json

curl -s -X POST -H "Content-Type: application/json" -d @job2.json "%BASE_URL%/jobs" > job2_response.json

:: Job 3: Timeout job (script job)
echo Creating Job 3: Long running job that will timeout
echo { > job3.json
echo   "script": "#!/bin/bash\necho 'Starting long job that will timeout...'\nfor i in {1..100}; do\n  echo \"Step $i of 100\"\n  sleep 2\ndone", >> job3.json
echo   "server_id": "!SERVER_ID!", >> job3.json
echo   "timeout": 15, >> job3.json
echo   "shell": "/bin/bash" >> job3.json
echo } >> job3.json

curl -s -X POST -H "Content-Type: application/json" -d @job3.json "%BASE_URL%/jobs/script" > job3_response.json

:: Job 4: Long success job
echo Creating Job 4: Long running job within timeout
echo { > job4.json
echo   "script": "#!/bin/bash\necho 'Starting long job...'\nfor i in {1..8}; do\n  echo \"Step $i of 8\"\n  sleep 1\ndone\necho 'Completed!'", >> job4.json
echo   "server_id": "!SERVER_ID!", >> job4.json
echo   "timeout": 30, >> job4.json
echo   "shell": "/bin/bash" >> job4.json
echo } >> job4.json

curl -s -X POST -H "Content-Type: application/json" -d @job4.json "%BASE_URL%/jobs/script" > job4_response.json

:: Job 5: Cancel job
echo Creating Job 5: Job we will manually cancel
echo { > job5.json
echo   "script": "#!/bin/bash\necho 'Starting job that will be canceled...'\nfor i in {1..60}; do\n  echo \"Processing step $i...\"\n  sleep 2\ndone", >> job5.json
echo   "server_id": "!SERVER_ID!", >> job5.json
echo   "timeout": 300, >> job5.json
echo   "shell": "/bin/bash" >> job5.json
echo } >> job5.json

curl -s -X POST -H "Content-Type: application/json" -d @job5.json "%BASE_URL%/jobs/script" > job5_response.json

echo SUCCESS: All 5 jobs created!

echo.
echo STEP 4: Monitoring Jobs
echo ======================

echo Waiting for jobs to start...
timeout /t 8 /nobreak > nul

echo Current job statuses:
for %%f in (job1_response.json job2_response.json job3_response.json job4_response.json job5_response.json) do (
    for /f "tokens=2 delims=:," %%a in ('findstr "\"id\"" %%f') do (
        set JOB_ID=%%a
        set JOB_ID=!JOB_ID:"=!
        set JOB_ID=!JOB_ID: =!
        curl -s "%BASE_URL%/jobs/!JOB_ID!" > current_status.json
        for /f "tokens=2 delims=:," %%b in ('findstr "\"status\"" current_status.json') do (
            set STATUS=%%b
            set STATUS=!STATUS:"=!
            set STATUS=!STATUS: =!
            echo Job !JOB_ID!: !STATUS!
        )
    )
)

echo.
echo STEP 5: Canceling Job 5
echo =======================

:: Extract Job 5 ID and cancel it
for /f "tokens=2 delims=:," %%a in ('findstr "\"id\"" job5_response.json') do (
    set JOB5_ID=%%a
    set JOB5_ID=!JOB5_ID:"=!
    set JOB5_ID=!JOB5_ID: =!
)

echo Canceling job !JOB5_ID!...
curl -s -X POST "%BASE_URL%/jobs/!JOB5_ID!/cancel" > cancel_response.json
echo Cancel response:
type cancel_response.json

echo.
echo STEP 6: Final Status Check
echo =========================

echo Waiting for all jobs to complete...
timeout /t 30 /nobreak > nul

echo Final job statuses:
for %%f in (job1_response.json job2_response.json job3_response.json job4_response.json job5_response.json) do (
    for /f "tokens=2 delims=:," %%a in ('findstr "\"id\"" %%f') do (
        set JOB_ID=%%a
        set JOB_ID=!JOB_ID:"=!
        set JOB_ID=!JOB_ID: =!
        echo.
        echo ----------------------------------------
        echo Job !JOB_ID!:
        curl -s "%BASE_URL%/jobs/!JOB_ID!" > final_status.json
        curl -s "%BASE_URL%/jobs/!JOB_ID!/logs" > final_logs.json
        
        for /f "tokens=2 delims=:," %%b in ('findstr "\"status\"" final_status.json') do (
            set STATUS=%%b
            set STATUS=!STATUS:"=!
            set STATUS=!STATUS: =!
            echo Status: !STATUS!
        )
        
        echo Last output:
        findstr "stdout" final_logs.json
    )
)

echo.
echo ======================================
echo TEST COMPLETED!
echo ======================================
echo.
echo Server ID: !SERVER_ID!
echo All responses saved in *_response.json files
echo.
echo Check the job statuses above to validate:
echo 1. Job 1 should be: completed
echo 2. Job 2 should be: failed
echo 3. Job 3 should be: failed (timeout)
echo 4. Job 4 should be: completed
echo 5. Job 5 should be: canceled
echo.

:: Cleanup temp files
del /q *.json 2>nul

set /p cleanup="Do you want to delete the test server? (y/N): "
if /i "!cleanup!"=="y" (
    echo Deleting test server...
    curl -s -X DELETE "%BASE_URL%/servers/!SERVER_ID!"
    echo Test server deleted.
) else (
    echo Test server preserved: !SERVER_ID!
)

echo.
echo Test completed! Press any key to exit...
pause > nul
