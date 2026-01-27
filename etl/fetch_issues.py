"""
GoodFirst ETL: BigQuery (GitHub Archive) -> Supabase
매 2시간마다 실행하여 good first issue 동기화
"""

import os
import json
from datetime import datetime, timedelta, timezone
from google.cloud import bigquery
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase 연결
supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)

# BigQuery 클라이언트
bq_client = bigquery.Client()

# 설정
SYNC_HOURS = 3  # 최근 N시간 이벤트 조회 (2시간 주기 + 여유분)
RETENTION_DAYS = 365  # 데이터 보관 기간


def get_table_name(dt: datetime) -> str:
    """BigQuery 테이블 이름 생성 (githubarchive.day.YYYYMMDD)"""
    return f"githubarchive.day.{dt.strftime('%Y%m%d')}"


def fetch_recent_issues(hours: int = SYNC_HOURS) -> list[dict]:
    """
    최근 N시간 내 생성/라벨링된 good first issue 가져오기
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    # 오늘과 어제 테이블 모두 조회 (자정 전후 이벤트 커버)
    tables = []
    for days_ago in range(2):  # 오늘, 어제
        dt = now - timedelta(days=days_ago)
        tables.append(get_table_name(dt))

    table_union = " UNION ALL ".join([
        f"SELECT * FROM `{t}`" for t in tables
    ])

    query = f"""
    WITH events AS ({table_union})
    SELECT
        repo.name as repo_name,
        JSON_EXTRACT_SCALAR(payload, '$.issue.id') as github_id,
        JSON_EXTRACT_SCALAR(payload, '$.issue.number') as issue_number,
        JSON_EXTRACT_SCALAR(payload, '$.issue.title') as title,
        JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
        JSON_EXTRACT_SCALAR(payload, '$.issue.user.login') as author,
        JSON_EXTRACT(payload, '$.issue.labels') as labels_json,
        JSON_EXTRACT_SCALAR(payload, '$.issue.created_at') as created_at,
        JSON_EXTRACT_SCALAR(payload, '$.issue.comments') as comment_count,
        created_at as event_at
    FROM events
    WHERE type = 'IssuesEvent'
      AND created_at >= TIMESTAMP('{cutoff.isoformat()}')
      AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled', 'reopened')
      AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
      AND (
        LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
        OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
        OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%beginner%'
        OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%first-timers-only%'
      )
    """

    print(f"Fetching issues from last {hours} hours...")
    print(f"  Tables: {tables}")
    print(f"  Cutoff: {cutoff.isoformat()}")

    try:
        query_job = bq_client.query(query)
        results = query_job.result()
    except Exception as e:
        print(f"BigQuery error: {e}")
        return []

    issues = []
    for row in results:
        labels = []
        if row.labels_json:
            try:
                labels_data = json.loads(row.labels_json)
                labels = [l.get("name", "") for l in labels_data if isinstance(l, dict)]
            except json.JSONDecodeError:
                pass

        repo_parts = row.repo_name.split("/")
        owner = repo_parts[0] if len(repo_parts) > 0 else ""
        repo = repo_parts[1] if len(repo_parts) > 1 else row.repo_name

        issues.append({
            "github_id": int(row.github_id) if row.github_id else None,
            "number": int(row.issue_number) if row.issue_number else 0,
            "repo_full_name": row.repo_name,
            "repo_owner": owner,
            "repo_name": repo,
            "title": row.title[:500] if row.title else "",
            "url": row.url,
            "labels": ",".join(labels),
            "created_at": row.created_at,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "comment_count": int(row.comment_count) if row.comment_count else 0,
            "is_open": True
        })

    # 중복 제거
    seen = set()
    unique_issues = []
    for issue in issues:
        key = issue["url"] or issue["github_id"]
        if key and key not in seen:
            seen.add(key)
            unique_issues.append(issue)

    print(f"  Found {len(unique_issues)} unique issues")
    return unique_issues


def fetch_closed_issues(hours: int = SYNC_HOURS) -> list[str]:
    """
    최근 N시간 내 닫힌 이슈 URL 가져오기
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    tables = []
    for days_ago in range(2):
        dt = now - timedelta(days=days_ago)
        tables.append(get_table_name(dt))

    table_union = " UNION ALL ".join([
        f"SELECT * FROM `{t}`" for t in tables
    ])

    query = f"""
    WITH events AS ({table_union})
    SELECT DISTINCT
        JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url
    FROM events
    WHERE type = 'IssuesEvent'
      AND created_at >= TIMESTAMP('{cutoff.isoformat()}')
      AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'closed'
    """

    print(f"Fetching closed issues from last {hours} hours...")

    try:
        query_job = bq_client.query(query)
        results = query_job.result()
        urls = [row.url for row in results if row.url]
        print(f"  Found {len(urls)} closed issues")
        return urls
    except Exception as e:
        print(f"BigQuery error: {e}")
        return []


def fetch_unlabeled_issues(hours: int = SYNC_HOURS) -> list[str]:
    """
    최근 N시간 내 good first issue 라벨이 제거된 이슈 URL 가져오기
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    tables = []
    for days_ago in range(2):
        dt = now - timedelta(days=days_ago)
        tables.append(get_table_name(dt))

    table_union = " UNION ALL ".join([
        f"SELECT * FROM `{t}`" for t in tables
    ])

    query = f"""
    WITH events AS ({table_union})
    SELECT DISTINCT
        JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url
    FROM events
    WHERE type = 'IssuesEvent'
      AND created_at >= TIMESTAMP('{cutoff.isoformat()}')
      AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'unlabeled'
      AND (
        LOWER(JSON_EXTRACT_SCALAR(payload, '$.label.name')) LIKE '%good first issue%'
        OR LOWER(JSON_EXTRACT_SCALAR(payload, '$.label.name')) LIKE '%good-first-issue%'
        OR LOWER(JSON_EXTRACT_SCALAR(payload, '$.label.name')) LIKE '%beginner%'
        OR LOWER(JSON_EXTRACT_SCALAR(payload, '$.label.name')) LIKE '%first-timers-only%'
      )
    """

    print(f"Fetching unlabeled issues from last {hours} hours...")

    try:
        query_job = bq_client.query(query)
        results = query_job.result()
        urls = [row.url for row in results if row.url]
        print(f"  Found {len(urls)} unlabeled issues")
        return urls
    except Exception as e:
        print(f"BigQuery error: {e}")
        return []


def upsert_issues(issues: list[dict]) -> int:
    """이슈를 DB에 upsert"""
    if not issues:
        return 0

    batch_size = 100
    total = 0

    for i in range(0, len(issues), batch_size):
        batch = issues[i:i + batch_size]
        try:
            result = supabase.table("issues").upsert(
                batch,
                on_conflict="github_id"
            ).execute()
            total += len(result.data) if result.data else 0
        except Exception as e:
            print(f"  Upsert error: {e}")

    return total


def delete_issues(urls: list[str]) -> int:
    """이슈 삭제"""
    if not urls:
        return 0

    batch_size = 100
    total = 0

    for i in range(0, len(urls), batch_size):
        batch = urls[i:i + batch_size]
        try:
            result = supabase.table("issues").delete().in_("url", batch).execute()
            total += len(result.data) if result.data else 0
        except Exception as e:
            print(f"  Delete error: {e}")

    return total


def cleanup_old_issues(days: int = RETENTION_DAYS):
    """
    N일 이상 된 이슈 삭제 (open/closed 무관)
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        result = supabase.table("issues") \
            .delete() \
            .lt("created_at", cutoff) \
            .execute()

        deleted = len(result.data) if result.data else 0
        print(f"Cleaned up {deleted} issues older than {days} days")
        return deleted
    except Exception as e:
        print(f"Cleanup error: {e}")
        return 0


def main():
    """메인 ETL 실행"""
    print("=" * 50)
    print(f"GoodFirst ETL - {datetime.now(timezone.utc).isoformat()}")
    print(f"Sync: last {SYNC_HOURS} hours | Retention: {RETENTION_DAYS} days")
    print("=" * 50)

    # 1. 새 이슈 / 재오픈된 이슈 가져오기
    issues = fetch_recent_issues()
    saved = upsert_issues(issues)
    print(f"✓ Upserted {saved} issues")

    # 2. 닫힌 이슈 삭제
    closed_urls = fetch_closed_issues()
    deleted_closed = delete_issues(closed_urls)
    print(f"✓ Deleted {deleted_closed} closed issues")

    # 3. 라벨 제거된 이슈 삭제
    unlabeled_urls = fetch_unlabeled_issues()
    deleted_unlabeled = delete_issues(unlabeled_urls)
    print(f"✓ Deleted {deleted_unlabeled} unlabeled issues")

    # 4. 1년 이상 된 이슈 정리
    cleanup_old_issues()

    print("=" * 50)
    print("ETL complete!")


if __name__ == "__main__":
    main()
