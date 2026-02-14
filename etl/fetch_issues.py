"""
GoodFirst ETL: BigQuery (GitHub Archive) -> Supabase
매 2시간마다 실행하여 good first issue 동기화
- 프로젝트 폴백 지원: 쿼터 초과 시 자동 전환
"""

import os
import json
import base64
import tempfile
import re
from datetime import datetime, timedelta, timezone
from google.cloud import bigquery
from google.oauth2 import service_account
from google.api_core.exceptions import Forbidden
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase 연결
supabase: Client = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)

# GCP 프로젝트 설정 (다중 fallback 지원)
GCP_PROJECT_PRIMARY = os.environ.get("GCP_PROJECT_PRIMARY", "silver-pen-391310")

# Fallback 프로젝트들 (순서대로 시도)
FALLBACK_CONFIGS = []

# Fallback 1
if os.environ.get("GCP_FALLBACK_CREDENTIALS"):
    FALLBACK_CONFIGS.append({
        "project": os.environ.get("GCP_PROJECT_FALLBACK", "dogwood-dryad-485405-k8"),
        "credentials_b64": os.environ.get("GCP_FALLBACK_CREDENTIALS")
    })

# Fallback 2
if os.environ.get("GCP_FALLBACK_CREDENTIALS_2"):
    FALLBACK_CONFIGS.append({
        "project": os.environ.get("GCP_PROJECT_FALLBACK_2", ""),
        "credentials_b64": os.environ.get("GCP_FALLBACK_CREDENTIALS_2")
    })

# Fallback 3
if os.environ.get("GCP_FALLBACK_CREDENTIALS_3"):
    FALLBACK_CONFIGS.append({
        "project": os.environ.get("GCP_PROJECT_FALLBACK_3", ""),
        "credentials_b64": os.environ.get("GCP_FALLBACK_CREDENTIALS_3")
    })

# 현재 사용 중인 BigQuery 클라이언트
bq_client = None
current_fallback_index = -1  # -1 = primary, 0+ = fallback index


def get_bq_client(fallback_index: int = -1) -> bigquery.Client:
    """BigQuery 클라이언트 반환 (다중 폴백 지원)"""
    global bq_client, current_fallback_index

    current_fallback_index = fallback_index

    if fallback_index >= 0 and fallback_index < len(FALLBACK_CONFIGS):
        config = FALLBACK_CONFIGS[fallback_index]
        print(f"Using GCP fallback project #{fallback_index + 1}: {config['project']}")

        # Base64 디코딩하여 credentials 생성
        creds_json = base64.b64decode(config["credentials_b64"]).decode('utf-8')
        creds_dict = json.loads(creds_json)
        credentials = service_account.Credentials.from_service_account_info(creds_dict)
        bq_client = bigquery.Client(project=config["project"], credentials=credentials)
    else:
        print(f"Using GCP primary project: {GCP_PROJECT_PRIMARY}")
        bq_client = bigquery.Client(project=GCP_PROJECT_PRIMARY)

    return bq_client


# 초기 클라이언트 생성
bq_client = get_bq_client()

# 설정
RETENTION_DAYS = 365  # 데이터 보관 기간
INITIAL_LOAD_DAYS = 30  # 초기 로드 시 가져올 기간 (BigQuery 쿼터 제한)
MIN_SYNC_HOURS = 3  # 최소 동기화 범위 (여유분)

def normalize_label(label: str) -> str:
    """라벨명을 비교 가능한 canonical key로 정규화."""
    normalized = (label or "").strip().lower()
    normalized = normalized.replace("_", " ").replace("-", " ").replace("/", " ").replace(":", " ")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    return " ".join(normalized.split())


def is_good_first_label(label: str) -> bool:
    """라벨명이 good-first 계열인지 판정."""
    normalized = normalize_label(label)
    if not normalized:
        return False

    if "good first issue" in normalized or "goodfirstissue" in normalized:
        return True
    if "first timers only" in normalized:
        return True
    if "up for grabs" in normalized:
        return True
    if "low hanging fruit" in normalized:
        return True

    tokens = normalized.split()
    token_set = set(tokens)

    # beginner/newcomer/starter 계열
    if "beginner" in token_set:
        return True
    if "beginners" in token_set and "only" in token_set:
        return True
    if "newcomer" in token_set or "newcomers" in token_set:
        return True
    if "starter" in token_set or "starters" in token_set:
        return True

    # first-issue / first-contributor / first-time-contributor
    if "first" in token_set and ("issue" in token_set or "contributor" in token_set or "contributors" in token_set):
        return True

    # easy 계열 (입문 난이도 표현)
    if "easy" in token_set:
        return True

    return False


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
    """쿼리 실행 (쿼터 초과 시 다음 폴백 프로젝트로 재시도)"""
    global bq_client, current_fallback_index

    # Primary부터 시작하여 모든 fallback 순차 시도
    start_index = current_fallback_index
    max_index = len(FALLBACK_CONFIGS) - 1

    for attempt_index in range(start_index, max_index + 1):
        try:
            query_job = bq_client.query(query)
            return query_job.result()
        except Forbidden as e:
            if "quota" in str(e).lower():
                next_index = current_fallback_index + 1
                if next_index <= max_index:
                    print(f"Quota exceeded, switching to fallback project #{next_index + 1}...")
                    bq_client = get_bq_client(fallback_index=next_index)
                    continue
                else:
                    print(f"All {len(FALLBACK_CONFIGS) + 1} projects quota exceeded!")
                    raise e
            else:
                raise e

    # 마지막 fallback으로 최종 시도
    try:
        query_job = bq_client.query(query)
        return query_job.result()
    except Exception as e:
        raise e


def get_tables_for_range(start: datetime, end: datetime) -> list[str]:
    """시간 범위에 해당하는 BigQuery 테이블 목록"""
    tables = []
    current = start.date()
    end_date = end.date()

    while current <= end_date:
        tables.append(f"githubarchive.day.{current.strftime('%Y%m%d')}")
        current += timedelta(days=1)

    return tables


def fetch_all_issue_events(cutoff: datetime) -> tuple[list[dict], list[str], list[str]]:
    """
    단일 쿼리로 모든 이슈 이벤트 가져오기 (쿼터 최적화)
    - 새로 생성/라벨링된 good first issues
    - 닫힌 이슈 URL
    - 라벨 제거된 이슈 URL

    Returns: (new_issues, closed_urls, unlabeled_urls)
    """
    now = datetime.now(timezone.utc)
    tables = get_tables_for_range(cutoff, now)
    print(f"  Querying {len(tables)} tables: {tables[0]} ~ {tables[-1]}")

    # 최적화: SELECT * 대신 필요한 컬럼만, 각 테이블에서 IssuesEvent만 먼저 필터링
    table_union = " UNION ALL ".join([
        f"""SELECT repo.name as repo_name, payload, created_at
            FROM `{t}`
            WHERE type = 'IssuesEvent'
              AND created_at >= TIMESTAMP('{cutoff.isoformat()}')"""
        for t in tables
    ])

    query = f"""
    WITH events AS ({table_union})
    SELECT
        repo_name,
        JSON_EXTRACT_SCALAR(payload, '$.action') as action,
        JSON_EXTRACT_SCALAR(payload, '$.issue.id') as github_id,
        JSON_EXTRACT_SCALAR(payload, '$.issue.number') as issue_number,
        JSON_EXTRACT_SCALAR(payload, '$.issue.title') as title,
        JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
        JSON_EXTRACT_SCALAR(payload, '$.issue.user.login') as author,
        JSON_EXTRACT(payload, '$.issue.labels') as labels_json,
        JSON_EXTRACT_SCALAR(payload, '$.issue.state') as state,
        JSON_EXTRACT_SCALAR(payload, '$.issue.created_at') as issue_created_at,
        JSON_EXTRACT_SCALAR(payload, '$.issue.comments') as comment_count,
        JSON_EXTRACT_SCALAR(payload, '$.label.name') as removed_label
    FROM events
    WHERE JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled', 'reopened', 'closed', 'unlabeled')
    """

    print(f"Fetching all issue events since {cutoff.isoformat()}...")

    try:
        results = run_query_with_fallback(query)
        if results is None:
            return [], [], []
    except Exception as e:
        print(f"BigQuery error: {e}")
        return [], [], []

    new_issues = []
    closed_urls = set()
    unlabeled_urls = set()

    for row in results:
        action = row.action
        url = row.url

        if not url:
            continue

        # 닫힌 이슈
        if action == 'closed':
            closed_urls.add(url)
            continue

        # 라벨 제거된 이슈 (good first issue 관련 라벨만)
        if action == 'unlabeled':
            removed_label = row.removed_label or ""
            if is_good_first_label(removed_label):
                unlabeled_urls.add(url)
            continue

        # 새 이슈 / 라벨 추가 / 재오픈 (opened, labeled, reopened)
        if action in ('opened', 'labeled', 'reopened') and row.state == 'open':
            labels = []
            if row.labels_json:
                try:
                    labels_data = json.loads(row.labels_json)
                    labels = [l.get("name", "") for l in labels_data if isinstance(l, dict)]
                except json.JSONDecodeError:
                    labels = []

            has_good_first_label = any(is_good_first_label(label) for label in labels)

            if has_good_first_label:

                repo_parts = row.repo_name.split("/")
                owner = repo_parts[0] if len(repo_parts) > 0 else ""
                repo = repo_parts[1] if len(repo_parts) > 1 else row.repo_name

                new_issues.append({
                    "github_id": int(row.github_id) if row.github_id else None,
                    "issue_number": int(row.issue_number) if row.issue_number else 0,
                    "repo_full_name": row.repo_name,
                    "repo_owner": owner,
                    "repo_name": repo,
                    "title": row.title[:500] if row.title else "",
                    "url": url,
                    "labels": labels,
                    "created_at": row.issue_created_at,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "comment_count": int(row.comment_count) if row.comment_count else 0,
                    "is_open": True
                })

    # 중복 제거
    seen = set()
    unique_issues = []
    for issue in new_issues:
        key = issue["url"]
        if key not in seen:
            seen.add(key)
            unique_issues.append(issue)

    print(f"  Found {len(unique_issues)} new/updated issues, {len(closed_urls)} closed, {len(unlabeled_urls)} unlabeled")
    return unique_issues, list(closed_urls), list(unlabeled_urls)


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

    # 단일 쿼리로 모든 이벤트 가져오기 (쿼터 최적화: 3쿼리 → 1쿼리)
    issues, closed_urls, unlabeled_urls = fetch_all_issue_events(cutoff)

    # 1. 새 이슈 / 재오픈된 이슈 저장
    saved = upsert_issues(issues)
    print(f"✓ Upserted {saved} issues")

    # 2. 닫힌 이슈 삭제
    deleted_closed = delete_issues(closed_urls)
    print(f"✓ Deleted {deleted_closed} closed issues")

    # 3. 라벨 제거된 이슈 삭제
    deleted_unlabeled = delete_issues(unlabeled_urls)
    print(f"✓ Deleted {deleted_unlabeled} unlabeled issues")

    # 4. 1년 이상 된 이슈 정리
    cleanup_old_issues()

    print("=" * 50)
    print("ETL complete!")


if __name__ == "__main__":
    main()
