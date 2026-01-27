-- PoC Step 1: IssuesEvent 구조 확인
-- 예상 비용: ~10MB (거의 무료)
-- BigQuery Console: https://console.cloud.google.com/bigquery

-- 최근 1시간의 IssuesEvent 샘플 1개 확인
SELECT
  type,
  repo.id as repo_id,
  repo.name as repo_name,
  actor.login as actor,
  payload,
  created_at
FROM `githubarchive.hour.2025012400`  -- 최근 날짜로 변경 필요
WHERE type = 'IssuesEvent'
LIMIT 1;
