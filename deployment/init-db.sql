-- Initialize database schema for Job Executor
-- This script will be run automatically when PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add priority column to jobs table if it exists and column is missing
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'jobs'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'priority'
    ) THEN
        EXECUTE 'ALTER TABLE jobs ADD COLUMN priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10)';
    END IF;
END $$;

-- Add original_script column to jobs table if it exists and column is missing
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'jobs'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'original_script'
    ) THEN
        EXECUTE 'ALTER TABLE jobs ADD COLUMN original_script TEXT';
    END IF;
END $$;

-- Create triggers only if tables exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jobs') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs';
        EXECUTE '
            CREATE TRIGGER update_jobs_updated_at
            BEFORE UPDATE ON jobs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'servers') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS update_servers_updated_at ON servers';
        EXECUTE '
            CREATE TRIGGER update_servers_updated_at
            BEFORE UPDATE ON servers
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ';
    END IF;
END $$;

-- Insert test server if not already present
INSERT INTO servers (id, name, hostname, port, "user", auth_type, password, is_active, created_at, updated_at)
SELECT 
    'test-server-001',
    'Test Server',
    'host.docker.internal',
    22,
    'testuser',
    'password',
    'testpass',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM servers WHERE name = 'Test Server'
);

-- Insert test jobs only if jobs and servers exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jobs')
    AND EXISTS (SELECT FROM servers WHERE name = 'Test Server') THEN
        INSERT INTO jobs (id, command, args, server_id, status, priority, timeout, log_level, created_at, updated_at)
        VALUES (
            'test-job-001',
            'echo',
            'Hello from Job Executor Test System!',
            'test-server-001',
            'queued',
            8,
            300,
            'info',
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO jobs (id, command, args, server_id, status, priority, timeout, log_level, created_at, updated_at)
        VALUES (
            'test-job-002',
            'whoami',
            '',
            'test-server-001',
            'queued',
            3,
            300,
            'info',
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;

        INSERT INTO jobs (id, command, args, server_id, status, priority, timeout, log_level, original_script, created_at, updated_at)
        VALUES (
            'test-script-job-001',
            '/bin/bash -c "echo ''IyEvYmluL2Jhc2gKZWNobyAiSGVsbG8gZnJvbSB0ZXN0IHNjcmlwdCEi'' | base64 -d > /tmp/test_script.sh && chmod +x /tmp/test_script.sh && /tmp/test_script.sh && rm -f /tmp/test_script.sh"',
            '',
            'test-server-001',
            'queued',
            6,
            300,
            'info',
            E'#!/bin/bash\necho "Hello from test script!"',
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;
