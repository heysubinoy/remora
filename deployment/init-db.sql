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

-- Insert default server if none exists (for testing)
INSERT INTO servers (name, hostname, port, "user", auth_type, password)
VALUES ('localhost', 'host.docker.internal', 22, 'testuser', 'password', 'testpass')
ON CONFLICT (name) DO NOTHING;
