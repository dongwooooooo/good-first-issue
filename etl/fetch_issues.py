"""
GoodFirst ETL: BigQuery (GitHub Archive) -> Supabase
매 2시간마다 실행하여 good first issue 동기화
- 프로젝트 폴백 지원: 쿼터 초과 시 자동 전환
"""

import os
import json
from datetime import datetime, timedelta, timezone
from google.cloud import bigquery
from google.api_core.exceptions import Forbidden
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase 연결
supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)

# GCP 프로젝트 목록 (폴백 지원)
GCP_PROJECTS = [
    os.environ.get("GCP_PROJECT_PRIMARY", "silver-pen-391310"),
    os.environ.get("GCP_PROJECT_FALLBACK", "dogwood-dryad-485405-k8"),
]

# 현재 사용 중인 BigQuery 클라이언트
bq_client = None
current_project_idx = 0


def get_bq_client(force_next: bool = False) -> bigquery.Client:
    """BigQuery 클라이언트 반환 (폴백 지원)"""
    global bq_client, current_project_idx

    if force_next:
        current_project_idx = (current_project_idx + 1) % len(GCP_PROJECTS)

    project = GCP_PROJECTS[current_project_idx]
    print(f"Using GCP project: {project}")
    bq_client = bigquery.Client(project=project)
    return bq_client


# 초기 클라이언트 생성
bq_client = get_bq_client()

# 설정
RETENTION_DAYS = 365  # 데이터 보관 기간
INITIAL_LOAD_DAYS = 30  # 초기 로드 시 가져올 기간 (BigQuery 쿼터 제한)
MIN_SYNC_HOURS = 3  # 최소 동기화 범위 (여유분)


def get_table_name(dt: datetime) -> str:
    """BigQuery 테이블 이름 생성 (githubarchive.day.YYYYMMDD)"""
    return f"githubarchive.day.{dt.strftime('%Y%m%d')}"


def get_last_sync_time() -> datetime:
    """DB에서 마지막 이슈 생성 시점 조회"""
    try:
        result = supabase.table("issues") \
            .select("created_at") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()

        if result.data and result.data[0].get("created_at"):
            last_sync = datetime.fromisoformat(result.data[0]["created_at"].replace("Z", "+00:00"))
            print(f"Last issue time from DB: {last_sync.isoformat()}")
            return last_sync
    except Exception as e:
        print(f"Error getting last sync time: {e}")

    # 데이터 없으면 30일 전부터 (초기 로드 - BigQuery 쿼터 제한)
    initial = datetime.now(timezone.utc) - timedelta(days=INITIAL_LOAD_DAYS)
    print(f"No previous data, initial load from: {initial.isoformat()} ({INITIAL_LOAD_DAYS} days)")
    return initial


def run_query_with_fallback(query: str):
    """쿼리 실행 (쿼터 초과 시 폴백 프로젝트로 재시도)"""
    global bq_client

    for attempt in range(len(GCP_PROJECTS)):
        try:
            query_job = bq_client.query(query)
            return query_job.result()
        except Forbidden as e:
            if "quota" in str(e).lower() and attempt < len(GCP_PROJECTS) - 1:
                print(f"Quota exceeded, switching to fallback project...")
                bq_client = get_bq_client(force_next=True)
            else:
                raise e
        except Exception as e:
            raise e

    return None


def get_tables_for_range(start: datetime, end: datetime) -> list[str]:
    """시간 범위에 해당하는 BigQuery 테이블 목록"""
    tables = []
    current = start.date()
    end_date = end.date()

    while current <= end_date:
        tables.append(f"githubarchive.day.{current.strftime('%Y%m%d')}")
        current += timedelta(days=1)

    return tables


def fetch_recent_issues(cutoff: datetime) -> list[dict]:
    """
    cutoff 시점 이후 생성/라벨링된 good first issue 가져오기
    """
    now = datetime.now(timezone.utc)

    # cutoff부터 현재까지의 테이블 목록
    tables = get_tables_for_range(cutoff, now)
    print(f"  Querying {len(tables)} tables: {tables[0]} ~ {tables[-1]}")

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

    print(f"Fetching issues since {cutoff.isoformat()}...")

    try:
        results = run_query_with_fallback(query)
        if results is None:
            return []
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
            "issue_number": int(row.issue_number) if row.issue_number else 0,
            "repo_full_name": row.repo_name,
            "repo_owner": owner,
            "repo_name": repo,
            "title": row.title[:500] if row.title else "",
            "url": row.url,
            "labels": labels,  # PostgreSQL TEXT[] array
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


def fetch_closed_issues(cutoff: datetime) -> list[str]:
    """
    cutoff 시점 이후 닫힌 이슈 URL 가져오기
    """
    now = datetime.now(timezone.utc)
    tables = get_tables_for_range(cutoff, now)

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

    print(f"Fetching closed issues since {cutoff.isoformat()}...")

    try:
        results = run_query_with_fallback(query)
        if results is None:
            return []
        urls = [row.url for row in results if row.url]
        print(f"  Found {len(urls)} closed issues")
        return urls
    except Exception as e:
        print(f"BigQuery error: {e}")
        return []


def fetch_unlabeled_issues(cutoff: datetime) -> list[str]:
    """
    cutoff 시점 이후 good first issue 라벨이 제거된 이슈 URL 가져오기
    """
    now = datetime.now(timezone.utc)
    tables = get_tables_for_range(cutoff, now)

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

    print(f"Fetching unlabeled issues since {cutoff.isoformat()}...")

    try:
        results = run_query_with_fallback(query)
        if results is None:
            return []
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
                on_conflict="url"
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
    print("=" * 50)

    # DB에서 마지막 동기화 시점 조회
    last_sync = get_last_sync_time()
    now = datetime.now(timezone.utc)

    # 최소 3시간 여유분 확보 (이벤트 지연 대비)
    min_cutoff = now - timedelta(hours=MIN_SYNC_HOURS)
    cutoff = min(last_sync, min_cutoff)

    days_to_sync = (now - cutoff).days
    print(f"Syncing from: {cutoff.isoformat()} ({days_to_sync} days)")

    # 1. 새 이슈 / 재오픈된 이슈 가져오기
    issues = fetch_recent_issues(cutoff)
    saved = upsert_issues(issues)
    print(f"✓ Upserted {saved} issues")

    # 2. 닫힌 이슈 삭제
    closed_urls = fetch_closed_issues(cutoff)
    deleted_closed = delete_issues(closed_urls)
    print(f"✓ Deleted {deleted_closed} closed issues")

    # 3. 라벨 제거된 이슈 삭제
    unlabeled_urls = fetch_unlabeled_issues(cutoff)
    deleted_unlabeled = delete_issues(unlabeled_urls)
    print(f"✓ Deleted {deleted_unlabeled} unlabeled issues")

    # 4. 1년 이상 된 이슈 정리
    cleanup_old_issues()

    print("=" * 50)
    print("ETL complete!")


if __name__ == "__main__":
    main()
