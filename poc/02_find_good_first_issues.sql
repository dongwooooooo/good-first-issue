-- PoC Step 2: Good First Issue 찾기
-- 예상 비용: ~500MB (최근 1일 기준)
--
-- IssuesEvent payload 구조:
-- {
--   "action": "opened" | "labeled" | "closed" | ...,
--   "issue": {
--     "number": 123,
--     "title": "...",
--     "html_url": "...",
--     "state": "open" | "closed",
--     "labels": [{"name": "good first issue"}, ...]
--   }
-- }

SELECT
  repo.name as repo_name,
  JSON_EXTRACT_SCALAR(payload, '$.action') as action,
  JSON_EXTRACT_SCALAR(payload, '$.issue.number') as issue_number,
  JSON_EXTRACT_SCALAR(payload, '$.issue.title') as title,
  JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
  JSON_EXTRACT_SCALAR(payload, '$.issue.state') as state,
  JSON_EXTRACT(payload, '$.issue.labels') as labels,
  created_at
FROM `githubarchive.day.20250123`  -- 어제 날짜로 변경
WHERE type = 'IssuesEvent'
  AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
  AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
  -- labels 배열에서 good first issue 관련 라벨 찾기
  AND (
    LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%beginner%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%help wanted%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%easy%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%starter%'
  )
ORDER BY created_at DESC
LIMIT 100;
