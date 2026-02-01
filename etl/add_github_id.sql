-- Add github_id column to issues table
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add github_id column
ALTER TABLE issues ADD COLUMN IF NOT EXISTS github_id BIGINT;

-- 2. Add unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_github_id ON issues(github_id) WHERE github_id IS NOT NULL;

-- 3. Add other missing columns that ETL uses
ALTER TABLE issues ADD COLUMN IF NOT EXISTS number INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 4. Reload schema cache (important for PostgREST)
NOTIFY pgrst, 'reload schema';

-- 5. Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'issues'
ORDER BY ordinal_position;