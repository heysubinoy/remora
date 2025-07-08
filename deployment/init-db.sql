-- Initialize database schema for Job Executor
-- This script will be run automatically when PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Let GORM handle table creation with auto-migration
-- This script just ensures extensions are available

-- Create a function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Note: Tables will be created by GORM auto-migration
-- This approach ensures schema consistency between Go models and database

-- Test data setup for development and testing
-- Creates a test server and test job for immediate system verification

-- Create triggers to automatically update updated_at columns
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_servers_updated_at ON servers;
CREATE TRIGGER update_servers_updated_at
    BEFORE UPDATE ON servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert test server if none exists (for testing)
INSERT INTO servers (id, name, hostname, port, "user", auth_type, password, is_active, created_at, updated_at)
VALUES (
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
)
ON CONFLICT (name) DO NOTHING;

-- Insert test job if test server exists (for testing)
INSERT INTO jobs (id, command, args, server_id, status, timeout, log_level, created_at, updated_at)
SELECT 
    'test-job-001',
    'echo',
    'Hello from Job Executor Test System!',
    'test-server-001',
    'queued',
    300,
    'info',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM servers WHERE name = 'Test Server')
ON CONFLICT (id) DO NOTHING;

-- Insert additional test job for system info
INSERT INTO jobs (id, command, args, server_id, status, timeout, log_level, created_at, updated_at)
SELECT 
    'test-job-002',
    'whoami',
    '',
    'test-server-001',
    'queued',
    300,
    'info',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM servers WHERE name = 'Test Server')
ON CONFLICT (id) DO NOTHING;
