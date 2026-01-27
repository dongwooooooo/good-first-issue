-- PoC Step 5: Repository Language 정보와 JOIN
-- 예상 비용: ~1GB
-- GitHub public repos 테이블과 조인하여 언어 정보 추가

WITH good_first_issues AS (
  SELECT
    repo.name as repo_name,
    JSON_EXTRACT_SCALAR(payload, '$.issue.number') as issue_number,
    JSON_EXTRACT_SCALAR(payload, '$.issue.title') as title,
    JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
    JSON_EXTRACT(payload, '$.issue.labels') as labels,
    created_at
  FROM `githubarchive.day.20250123`
  WHERE type = 'IssuesEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
    AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
    AND (
      LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
      OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
      OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%beginner%'
    )
)
SELECT
  gfi.repo_name,
  repos.language,
  repos.stargazer_count as stars,
  gfi.title,
  gfi.url,
  gfi.labels,
  gfi.created_at
FROM good_first_issues gfi
LEFT JOIN `bigquery-public-data.github_repos.languages` langs
  ON gfi.repo_name = langs.repo_name
LEFT JOIN `bigquery-public-data.github_repos.repos` repos
  ON gfi.repo_name = repos.repo_name
ORDER BY gfi.created_at DESC
LIMIT 100;

-- 주의: github_repos 테이블은 스냅샷이라 최신 repo가 없을 수 있음
-- 실제 서비스에서는 GitHub API로 repo 메타데이터 보완 필요
