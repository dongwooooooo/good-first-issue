-- ============================================
-- Security Fixes Migration
-- Run this in Supabase SQL Editor to resolve database linter warnings
-- Date: 2026-02-26
-- ============================================

-- 1. Fix: security_definer_view (ERROR)
-- issue_stats 뷰에 security_invoker 설정하여 RLS 우회 방지
-- ============================================
CREATE OR REPLACE VIEW public.issue_stats
WITH (security_invoker = true)
AS
SELECT
    COUNT(*) as total_issues,
    COUNT(DISTINCT repo_full_name) as unique_repos,
    COUNT(*) FILTER (WHERE 'good first issue' = ANY(labels)) as good_first_count,
    COUNT(*) FILTER (WHERE 'help wanted' = ANY(labels)) as help_wanted_count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
FROM issues
WHERE is_open = true;


-- 2. Fix: function_search_path_mutable (WARN)
-- refresh_stats 함수에 search_path 고정하여 search_path injection 방지
-- ============================================
CREATE OR REPLACE FUNCTION public.refresh_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY repo_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY org_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY language_stats;
END;
$func$;


-- 3. Fix: search_autocomplete search_path (preventive)
-- search_autocomplete 함수에도 search_path 고정
-- ============================================
CREATE OR REPLACE FUNCTION public.search_autocomplete(search_term text, max_results int DEFAULT 10)
RETURNS TABLE (
    type text,
    value text,
    display text,
    count bigint
)
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
    RETURN QUERY
    (
        SELECT
            'repo'::text as type,
            r.repo_full_name as value,
            r.repo_full_name || ' (' || r.issue_count || ' issues)' as display,
            r.issue_count::bigint as count
        FROM repo_stats r
        WHERE r.repo_full_name ILIKE '%' || search_term || '%'
           OR similarity(r.repo_full_name, search_term) > 0.3
        ORDER BY r.issue_count DESC
        LIMIT max_results / 2
    )
    UNION ALL
    (
        SELECT
            'org'::text as type,
            o.org_name as value,
            o.org_name || ' (' || o.repo_count || ' repos)' as display,
            o.issue_count::bigint as count
        FROM org_stats o
        WHERE o.org_name ILIKE '%' || search_term || '%'
           OR similarity(o.org_name, search_term) > 0.3
        ORDER BY o.issue_count DESC
        LIMIT max_results / 2
    );
END;
$func$;


-- 4. Fix: extension_in_public (WARN)
-- pg_trgm을 extensions 스키마로 이동
-- 주의: 기존 인덱스가 pg_trgm에 의존하므로 순서 중요
-- ============================================

-- 4a. extensions 스키마 생성
CREATE SCHEMA IF NOT EXISTS extensions;

-- 4b. pg_trgm을 extensions 스키마로 이동
-- Supabase에서는 ALTER EXTENSION SET SCHEMA 사용
ALTER EXTENSION pg_trgm SET SCHEMA extensions;


-- 5. Note: materialized_view_in_api (WARN)
-- language_stats, repo_stats, org_stats는 의도적으로 anon/authenticated에 공개
-- 이 프로젝트는 오픈소스 이슈 통계를 제공하는 공개 서비스이므로 보안 위험 없음
-- ============================================
-- No action needed - intentionally public data


-- ============================================
-- Verification: 적용 후 확인 쿼리
-- ============================================

-- 뷰 security_invoker 확인
SELECT viewname, viewowner
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'issue_stats';

-- 함수 search_path 확인
SELECT proname, proconfig
FROM pg_proc
WHERE proname IN ('refresh_stats', 'search_autocomplete');

-- extension 스키마 확인
SELECT extname, nspname
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE extname = 'pg_trgm';
