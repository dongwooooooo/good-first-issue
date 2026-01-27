-- Supabase에서 실행할 테이블 스키마
-- Supabase Dashboard > SQL Editor에서 실행

-- Issues 테이블
CREATE TABLE IF NOT EXISTS issues (
    id BIGSERIAL PRIMARY KEY,
    repo_full_name TEXT NOT NULL,
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    issue_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    author TEXT,
    labels TEXT[] DEFAULT '{}',
    language TEXT,  -- repo 언어 (추후 업데이트)
    created_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    is_open BOOLEAN DEFAULT TRUE,

    -- 검색 최적화를 위한 인덱스
    CONSTRAINT unique_issue UNIQUE (repo_full_name, issue_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_labels ON issues USING GIN(labels);
CREATE INDEX IF NOT EXISTS idx_issues_language ON issues(language);
CREATE INDEX IF NOT EXISTS idx_issues_is_open ON issues(is_open);

-- Row Level Security (Public read access)
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON issues
    FOR SELECT USING (true);

-- 통계용 뷰 (대시보드에서 사용)
CREATE OR REPLACE VIEW issue_stats AS
SELECT
    COUNT(*) as total_issues,
    COUNT(DISTINCT repo_full_name) as unique_repos,
    COUNT(*) FILTER (WHERE 'good first issue' = ANY(labels)) as good_first_count,
    COUNT(*) FILTER (WHERE 'help wanted' = ANY(labels)) as help_wanted_count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
FROM issues
WHERE is_open = true;