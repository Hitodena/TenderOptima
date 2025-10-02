-- Migration: Add user_id field to staging_suppliers table
-- This allows linking search queries to specific users

-- Add user_id column to staging_suppliers table
ALTER TABLE staging_suppliers ADD COLUMN user_id integer;

-- Add foreign key constraint
ALTER TABLE staging_suppliers 
ADD CONSTRAINT staging_suppliers_user_id_fk 
FOREIGN KEY (user_id) REFERENCES users(id);

-- Add index for better performance
CREATE INDEX idx_staging_suppliers_user_id ON staging_suppliers(user_id);

-- Add index for user_id + search_query combination
CREATE INDEX idx_staging_suppliers_user_search ON staging_suppliers(user_id, search_query);
