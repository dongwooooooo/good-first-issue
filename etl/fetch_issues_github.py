"""
GitHub API로 Good First Issues 수집 (BigQuery 대체)
"""

import os
import time
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
} if GITHUB_TOKEN else {}

# 주요 언어 목록 (검색 분할용)
LANGUAGES = [
    "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java",
    "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
    "Shell", "HTML", "CSS", "Vue", "Dart", "Elixir", "Haskell"
]


def search_issues(query: str, per_page: int = 100, max_results: int = 1000) -> list:
    """GitHub Search API로 이슈 검색"""
    url = "https://api.github.com/search/issues"
    all_issues = []
    page = 1

    while len(all_issues) < max_results:
        params = {
            "q": query,
            "sort": "created",
            "order": "desc",
            "per_page": per_page,
            "page": page
        }

        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)

        if resp.status_code == 403:
            # Rate limit
            reset_time = int(resp.headers.get("X-RateLimit-Reset", 0))
            wait = max(reset_time - time.time(), 60)
            print(f"Rate limited. Waiting {wait:.0f}s...")
            time.sleep(wait)
            continue

        if resp.status_code != 200:
            print(f"Error {resp.status_code}: {resp.text[:200]}")
            break

        data = resp.json()
        items = data.get("items", [])

        if not items:
            break

        all_issues.extend(items)
        print(f"  Fetched {len(all_issues)}/{data.get('total_count', '?')} issues")

        if len(items) < per_page:
            break

        page += 1
        time.sleep(2)  # Rate limit 방지

    return all_issues[:max_results]


def fetch_good_first_issues() -> list:
    """모든 good first issues 수집"""
    all_issues = []

    # 1. 언어별로 검색 (검색 결과 1000개 제한 우회)
    for lang in LANGUAGES:
        print(f"Searching {lang}...")
        query = f'label:"good first issue" is:open is:issue language:{lang}'
        issues = search_issues(query, max_results=500)
        all_issues.extend(issues)
        print(f"  Found {len(issues)} issues for {lang}")
        time.sleep(1)

    # 2. 언어 없는 이슈도 검색 (최근 것만)
    print("Searching recent issues without language filter...")
    query = 'label:"good first issue" is:open is:issue created:>=' + \
            (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    issues = search_issues(query, max_results=500)
    all_issues.extend(issues)

    # 중복 제거
    seen = set()
    unique_issues = []
    for issue in all_issues:
        if issue["id"] not in seen:
            seen.add(issue["id"])
            unique_issues.append(issue)

    print(f"Total unique issues: {len(unique_issues)}")
    return unique_issues


def transform_issue(issue: dict) -> dict:
    """GitHub API 응답을 DB 스키마에 맞게 변환"""
    repo_url = issue.get("repository_url", "")
    repo_full_name = repo_url.replace("https://api.github.com/repos/", "") if repo_url else ""
    parts = repo_full_name.split("/") if repo_full_name else ["", ""]

    return {
        "github_id": issue["id"],
        "issue_number": issue["number"],
        "title": issue["title"][:500] if issue.get("title") else "",
        "url": issue["html_url"],
        "repo_full_name": repo_full_name,
        "repo_owner": parts[0] if len(parts) > 0 else "",
        "repo_name": parts[1] if len(parts) > 1 else "",
        "labels": [l["name"] for l in issue.get("labels", [])],
        "created_at": issue["created_at"],
        "updated_at": issue["updated_at"],
        "is_open": issue["state"] == "open",
        "comment_count": issue.get("comments", 0),
    }


def upsert_issues(issues: list):
    """이슈를 DB에 upsert"""
    if not issues:
        return

    # 배치로 upsert
    batch_size = 100
    for i in range(0, len(issues), batch_size):
        batch = issues[i:i + batch_size]
        transformed = [transform_issue(issue) for issue in batch]

        try:
            supabase.from_("issues").upsert(
                transformed,
                on_conflict="url"
            ).execute()
            print(f"Upserted batch {i // batch_size + 1}/{(len(issues) - 1) // batch_size + 1}")
        except Exception as e:
            print(f"Error upserting batch: {e}")

        time.sleep(0.5)


def mark_closed_issues():
    """DB에 있지만 더 이상 열려있지 않은 이슈 처리"""
    # 최근 업데이트된 이슈 중 닫힌 것 확인
    print("Checking for closed issues...")

    result = supabase.from_("issues") \
        .select("github_id") \
        .eq("is_open", True) \
        .order("updated_at", desc=True) \
        .limit(500) \
        .execute()

    if not result.data:
        return

    github_ids = [row["github_id"] for row in result.data]

    # GitHub API로 상태 확인 (배치로)
    closed_ids = []
    for gid in github_ids[:100]:  # Rate limit 고려해서 100개만
        # 이슈 상태 확인은 개별 API 호출 필요
        # 여기서는 스킵하고 다음 ETL에서 자연스럽게 업데이트되도록 함
        pass

    print(f"Closed issues check skipped (will be updated naturally)")


def main():
    print("=" * 50)
    print("GitHub Good First Issues ETL")
    print("=" * 50)

    # Rate limit 확인
    resp = requests.get("https://api.github.com/rate_limit", headers=HEADERS)
    if resp.status_code == 200:
        limits = resp.json()["resources"]
        search = limits["search"]
        core = limits["core"]
        print(f"Search API: {search['remaining']}/{search['limit']}")
        print(f"Core API: {core['remaining']}/{core['limit']}")

    # 이슈 수집
    issues = fetch_good_first_issues()

    # DB에 저장
    print("Saving to database...")
    upsert_issues(issues)

    print("=" * 50)
    print(f"Done! Processed {len(issues)} issues")


if __name__ == "__main__":
    main()
