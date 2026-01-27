-- PoC Step 3: 일별 Good First Issue 발생량 확인
-- 예상 비용: ~500MB
-- 목적: 하루에 얼마나 많은 good first issue가 생기는지 파악

SELECT
  COUNT(*) as total_issues,
  COUNT(DISTINCT repo.name) as unique_repos,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
       OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%') as good_first_issue_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%beginner%') as beginner_count,
  COUNTIF(LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%help wanted%') as help_wanted_count
FROM `githubarchive.day.20250123`  -- 날짜 변경 필요
WHERE type = 'IssuesEvent'
  AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
  AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open';
