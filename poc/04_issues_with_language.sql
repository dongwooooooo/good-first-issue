-- PoC Step 4: 언어 정보 포함 조회
-- 문제: GH Archive IssuesEvent에는 repo의 language 정보가 없음
-- 해결: repo 정보를 별도로 가져오거나, GitHub API로 보완 필요
--
-- 일단 repo.name에서 추출 가능한 정보 확인

SELECT
  repo.name as repo_name,
  JSON_EXTRACT_SCALAR(payload, '$.issue.title') as title,
  JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
  JSON_EXTRACT(payload, '$.issue.labels') as labels,
  -- repo 정보는 별도 테이블 필요
  created_at
FROM `githubarchive.day.20250123`
WHERE type = 'IssuesEvent'
  AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
  AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
  AND (
    LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
    OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
  )
ORDER BY created_at DESC
LIMIT 50;

-- 참고: GitHub의 public repos 메타데이터는 별도 데이터셋에 있음
-- `bigquery-public-data.github_repos.repos` 테이블에서 language 정보 JOIN 가능
-- 단, 이 테이블은 실시간이 아니라 주기적 스냅샷
