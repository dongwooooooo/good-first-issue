-- PoC Step 6: 월별 Good First Issue 발생량 (신뢰도 높은 추정)
-- 예상 비용: ~10GB (여러 달 조회)
-- 목적: 연간 평균 발생량 정확히 추정

-- 최근 6개월 월별 통계
SELECT
  SUBSTR(_TABLE_SUFFIX, 1, 6) as month,
  COUNT(*) as total_issues,
  COUNT(DISTINCT repo.name) as unique_repos,
  COUNTIF(
    LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
  ) as good_first_issue_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%beginner%') as beginner_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%help wanted%') as help_wanted_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%easy%') as easy_count
FROM `githubarchive.day.2024*`
WHERE type = 'IssuesEvent'
  AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
  AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
  AND _TABLE_SUFFIX >= '0701'  -- 2024년 7월부터
GROUP BY month
ORDER BY month;
