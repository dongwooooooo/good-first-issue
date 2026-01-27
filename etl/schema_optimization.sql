-- ============================================
-- Good First Issue Tracker - Performance Optimization Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. INDEXES for faster queries
-- ============================================

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_issues_repo_full_name_trgm
ON issues USING gin(repo_full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_issues_title_trgm
ON issues USING gin(title gin_trgm_ops);

-- B-tree indexes for filtering
CREATE INDEX IF NOT EXISTS idx_issues_language
ON issues(language) WHERE language IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_is_open
ON issues(is_open) WHERE is_open = true;

CREATE INDEX IF NOT EXISTS idx_issues_repo_owner
ON issues(repo_owner);

CREATE INDEX IF NOT EXISTS idx_issues_stars_desc
ON issues(stars DESC NULLS LAST) WHERE is_open = true;

CREATE INDEX IF NOT EXISTS idx_issues_created_desc
ON issues(created_at DESC) WHERE is_open = true;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_issues_open_lang_stars
ON issues(is_open, language, stars DESC NULLS LAST);


-- 3. REPO_STATS: Materialized View
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS repo_stats CASCADE;

CREATE MATERIALIZED VIEW repo_stats AS
SELECT
    repo_full_name,
    repo_owner,
    repo_name,
    COUNT(*) AS issue_count,
    MAX(language) AS language,
    MAX(stars) AS stars,
    MAX(created_at) AS last_issue_at
FROM issues
WHERE is_open = true
GROUP BY repo_full_name, repo_owner, repo_name;

CREATE UNIQUE INDEX idx_repo_stats_pk ON repo_stats(repo_full_name);
CREATE INDEX idx_repo_stats_owner ON repo_stats(repo_owner);
CREATE INDEX idx_repo_stats_stars ON repo_stats(stars DESC NULLS LAST);
CREATE INDEX idx_repo_stats_issues ON repo_stats(issue_count DESC);
CREATE INDEX idx_repo_stats_lang ON repo_stats(language);
CREATE INDEX idx_repo_stats_search ON repo_stats USING gin(repo_full_name gin_trgm_ops);


-- 4. ORG_STATS: Materialized View
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS org_stats CASCADE;

CREATE MATERIALIZED VIEW org_stats AS
SELECT
    repo_owner AS org_name,
    COUNT(DISTINCT repo_full_name) AS repo_count,
    COUNT(*) AS issue_count,
    MAX(stars) AS max_stars,
    MODE() WITHIN GROUP (ORDER BY language) AS top_language
FROM issues
WHERE is_open = true
GROUP BY repo_owner;

CREATE UNIQUE INDEX idx_org_stats_pk ON org_stats(org_name);
CREATE INDEX idx_org_stats_issues ON org_stats(issue_count DESC);
CREATE INDEX idx_org_stats_repos ON org_stats(repo_count DESC);
CREATE INDEX idx_org_stats_stars ON org_stats(max_stars DESC NULLS LAST);
CREATE INDEX idx_org_stats_search ON org_stats USING gin(org_name gin_trgm_ops);


-- 5. LANGUAGE_STATS: Materialized View
-- ============================================

DROP MATERIALIZED VIEW IF EXISTS language_stats CASCADE;

CREATE MATERIALIZED VIEW language_stats AS
SELECT
    language,
    COUNT(*) AS issue_count,
    COUNT(DISTINCT repo_full_name) AS repo_count
FROM issues
WHERE is_open = true AND language IS NOT NULL
GROUP BY language
ORDER BY issue_count DESC;

CREATE UNIQUE INDEX idx_language_stats_pk ON language_stats(language);


-- 6. Grant permissions
-- ============================================

GRANT SELECT ON repo_stats TO anon, authenticated;
GRANT SELECT ON org_stats TO anon, authenticated;
GRANT SELECT ON language_stats TO anon, authenticated;


-- 7. Refresh function (call after ETL runs)
-- ============================================

CREATE OR REPLACE FUNCTION refresh_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY repo_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY org_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY language_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_stats TO authenticated;


-- 8. Initial refresh
-- ============================================

REFRESH MATERIALIZED VIEW repo_stats;
REFRESH MATERIALIZED VIEW org_stats;
REFRESH MATERIALIZED VIEW language_stats;
