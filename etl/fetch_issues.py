"""
GoodFirst ETL: BigQuery -> Supabase
하루에 한 번 실행하여 새로운 good first issue를 가져옴
"""

import os
import json
from datetime import datetime, timedelta
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


def fetch_good_first_issues(date_str: str = None) -> list[dict]:
    """
    특정 날짜의 good first issue를 BigQuery에서 가져옴

    Args:
        date_str: YYYYMMDD 형식 (없으면 어제 날짜)
    """
    if not date_str:
        yesterday = datetime.now() - timedelta(days=1)
        date_str = yesterday.strftime("%Y%m%d")

    query = f"""
    SELECT
        repo.name as repo_name,
        JSON_EXTRACT_SCALAR(payload, '$.issue.number') as issue_number,
        JSON_EXTRACT_SCALAR(payload, '$.issue.title') as title,
        JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
        JSON_EXTRACT_SCALAR(payload, '$.issue.user.login') as author,
        JSON_EXTRACT(payload, '$.issue.labels') as labels_json,
        JSON_EXTRACT_SCALAR(payload, '$.issue.created_at') as created_at,
        created_at as event_at
    FROM `githubarchive.day.{date_str}`
    WHERE type = 'IssuesEvent'
      AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('opened', 'labeled')
      AND JSON_EXTRACT_SCALAR(payload, '$.issue.state') = 'open'
      AND (
        LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good first issue%'
        OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%good-first-issue%'
        OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%beginner%'
        OR LOWER(JSON_EXTRACT(payload, '$.issue.labels')) LIKE '%help wanted%'
      )
    """

    print(f"Fetching issues for {date_str}...")
    query_job = bq_client.query(query)
    results = query_job.result()

    issues = []
    for row in results:
        # labels 파싱
        labels = []
        if row.labels_json:
            try:
                labels_data = json.loads(row.labels_json)
                labels = [l.get("name", "") for l in labels_data if isinstance(l, dict)]
            except json.JSONDecodeError:
                pass

        # repo에서 언어 추출 시도 (별도 API 필요할 수 있음)
        repo_parts = row.repo_name.split("/")
        owner = repo_parts[0] if len(repo_parts) > 0 else ""
        repo = repo_parts[1] if len(repo_parts) > 1 else row.repo_name

        issues.append({
            "repo_full_name": row.repo_name,
            "repo_owner": owner,
            "repo_name": repo,
            "issue_number": int(row.issue_number) if row.issue_number else 0,
            "title": row.title,
            "url": row.url,
            "author": row.author,
            "labels": labels,
            "created_at": row.created_at,
            "fetched_at": datetime.now().isoformat(),
            "is_open": True
        })

    # 중복 제거 (같은 이슈가 opened/labeled로 여러 번 나올 수 있음)
    seen = set()
    unique_issues = []
    for issue in issues:
        if issue["url"] not in seen:
            seen.add(issue["url"])
            unique_issues.append(issue)

    print(f"Found {len(unique_issues)} unique issues (from {len(issues)} events)")
    return unique_issues


def upsert_to_supabase(issues: list[dict]) -> int:
    """
    Supabase에 이슈 저장 (중복 방지를 위해 upsert)

    Returns:
        저장된 이슈 수
    """
    if not issues:
        return 0

    # url을 unique key로 사용하여 upsert
    result = supabase.table("issues").upsert(
        issues,
        on_conflict="url"
    ).execute()

    return len(result.data) if result.data else 0


def fetch_issue_state_changes(date_str: str = None) -> dict:
    """
    이슈 상태 변경 이벤트 가져오기 (closed, reopened, unlabeled)
    """
    if not date_str:
        yesterday = datetime.now() - timedelta(days=1)
        date_str = yesterday.strftime("%Y%m%d")

    query = f"""
    SELECT
        JSON_EXTRACT_SCALAR(payload, '$.issue.html_url') as url,
        JSON_EXTRACT_SCALAR(payload, '$.action') as action,
        JSON_EXTRACT_SCALAR(payload, '$.label.name') as label_name
    FROM `githubarchive.day.{date_str}`
    WHERE type = 'IssuesEvent'
      AND JSON_EXTRACT_SCALAR(payload, '$.action') IN ('closed', 'reopened', 'unlabeled')
    """

    print(f"Fetching state changes for {date_str}...")
    query_job = bq_client.query(query)
    results = query_job.result()

    changes = {"closed": [], "reopened": [], "unlabeled": []}

    for row in results:
        if not row.url:
            continue
        if row.action == 'closed':
            changes["closed"].append(row.url)
        elif row.action == 'reopened':
            changes["reopened"].append(row.url)
        elif row.action == 'unlabeled':
            # good first issue 관련 라벨이 제거된 경우만
            label = (row.label_name or "").lower()
            if any(x in label for x in ['good first issue', 'good-first-issue', 'beginner', 'help wanted']):
                changes["unlabeled"].append(row.url)

    # 중복 제거
    for key in changes:
        changes[key] = list(set(changes[key]))

    print(f"  closed: {len(changes['closed'])}, reopened: {len(changes['reopened'])}, unlabeled: {len(changes['unlabeled'])}")
    return changes


def apply_state_changes(changes: dict) -> dict:
    """
    상태 변경 적용
    - closed → is_open = false
    - reopened → is_open = true
    - unlabeled → 삭제 (더 이상 good first issue 아님)
    """
    results = {"closed": 0, "reopened": 0, "deleted": 0}

    # closed 처리
    for i in range(0, len(changes["closed"]), 100):
        batch = changes["closed"][i:i+100]
        result = supabase.table("issues").update({"is_open": False}).in_("url", batch).execute()
        results["closed"] += len(result.data) if result.data else 0

    # reopened 처리
    for i in range(0, len(changes["reopened"]), 100):
        batch = changes["reopened"][i:i+100]
        result = supabase.table("issues").update({"is_open": True}).in_("url", batch).execute()
        results["reopened"] += len(result.data) if result.data else 0

    # unlabeled 처리 (삭제)
    for i in range(0, len(changes["unlabeled"]), 100):
        batch = changes["unlabeled"][i:i+100]
        result = supabase.table("issues").delete().in_("url", batch).execute()
        results["deleted"] += len(result.data) if result.data else 0

    return results


def cleanup_old_closed_issues(days: int = 365):
    """
    1년 이상 된 closed 이슈만 삭제 (open은 유지)
    """
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()

    result = supabase.table("issues") \
        .delete() \
        .lt("created_at", cutoff) \
        .eq("is_open", False) \
        .execute()

    deleted = len(result.data) if result.data else 0
    print(f"Cleaned up {deleted} closed issues older than {days} days")


def main():
    """메인 ETL 실행"""
    print("=" * 50)
    print(f"GoodFirst ETL - {datetime.now().isoformat()}")
    print("=" * 50)

    # 1. 새 이슈 가져오기
    issues = fetch_good_first_issues()
    saved = upsert_to_supabase(issues)
    print(f"Saved {saved} new issues")

    # 2. 상태 변경 동기화
    changes = fetch_issue_state_changes()
    results = apply_state_changes(changes)
    print(f"State updates - closed: {results['closed']}, reopened: {results['reopened']}, deleted: {results['deleted']}")

    # 3. 1년 이상 된 closed 이슈만 삭제
    cleanup_old_closed_issues(365)

    print("ETL complete!")


if __name__ == "__main__":
    main()