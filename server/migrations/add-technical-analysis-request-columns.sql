-- Migration: Add analysis_request_id and project_id columns to technical_analysis_requests table
-- Date: 2025-11-07
-- Description: Adds foreign key columns to link technical_analysis_requests with analysis_requests and analysis_projects

-- Add analysis_request_id column (nullable, can be added later)
ALTER TABLE technical_analysis_requests
ADD COLUMN IF NOT EXISTS analysis_request_id INTEGER;

-- Add project_id column (nullable, can be added later)
ALTER TABLE technical_analysis_requests
ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- Add foreign key constraint for analysis_request_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'technical_analysis_requests_analysis_request_id_fkey'
    ) THEN
        ALTER TABLE technical_analysis_requests
        ADD CONSTRAINT technical_analysis_requests_analysis_request_id_fkey
        FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key constraint for project_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'technical_analysis_requests_project_id_fkey'
    ) THEN
        ALTER TABLE technical_analysis_requests
        ADD CONSTRAINT technical_analysis_requests_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES analysis_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_technical_analysis_requests_analysis_request_id 
ON technical_analysis_requests(analysis_request_id);

CREATE INDEX IF NOT EXISTS idx_technical_analysis_requests_project_id 
ON technical_analysis_requests(project_id);

