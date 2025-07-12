-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create servers table
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    hostname TEXT NOT NULL,
    port INTEGER NOT NULL,
    "user" TEXT NOT NULL,
    auth_type TEXT NOT NULL,
    password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id),
    command TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    output TEXT,
    error TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add duration column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'duration'
    ) THEN
        ALTER TABLE jobs ADD COLUMN duration INTERVAL;
    END IF;
END $$;

-- Add exit_code column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'exit_code'
    ) THEN
        ALTER TABLE jobs ADD COLUMN exit_code INTEGER;
    END IF;
END $$;

-- Add pid column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'jobs'
        AND column_name = 'pid'
    ) THEN
        ALTER TABLE jobs ADD COLUMN pid INTEGER;
    END IF;
END $$;

-- Remove the update_jobs_updated_at trigger and function if they exist
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Insert a test server if not exists
INSERT INTO servers (id, name, hostname, port, "user", auth_type, password, is_active, created_at, updated_at)
    SELECT
        '00000000-0000-0000-0000-000000000001',
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
