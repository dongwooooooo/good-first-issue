-- PoC Step 7: 연간 Good First Issue 총량 추정
-- 예상 비용: ~20GB
-- 목적: 1년치 데이터 보관 시 예상 row 수 계산

-- 2024년 전체 통계 (간소화된 버전 - 비용 절약)
-- 분기별로 샘플링하여 추정

WITH quarterly_samples AS (
  -- Q1 샘플 (1월 15일)
  SELECT '2024-Q1' as quarter, *
  FROM `githubarchive.day.20240115`
  WHERE type = 'IssuesEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
    AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'

  UNION ALL

  -- Q2 샘플 (4월 15일)
  SELECT '2024-Q2' as quarter, *
  FROM `githubarchive.day.20240415`
  WHERE type = 'IssuesEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
    AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'

  UNION ALL

  -- Q3 샘플 (7월 15일)
  SELECT '2024-Q3' as quarter, *
  FROM `githubarchive.day.20240715`
  WHERE type = 'IssuesEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
    AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'

  UNION ALL

  -- Q4 샘플 (10월 15일)
  SELECT '2024-Q4' as quarter, *
  FROM `githubarchive.day.20241015`
  WHERE type = 'IssuesEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
    AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
)

SELECT
  quarter,
  COUNT(*) as total_issues,
  COUNT(DISTINCT repo.name) as unique_repos,
  COUNTIF(
    LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
  ) as good_first_issue_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%help wanted%') as help_wanted_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%easy%') as easy_count
FROM quarterly_samples
GROUP BY quarter
ORDER BY quarter;
