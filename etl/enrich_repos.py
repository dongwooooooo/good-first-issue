"""
GitHub API로 레포 메타데이터(stars, language) 보강
"""

import os
import time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}


def get_unique_repos() -> list[str]:
    """DB에서 stars나 language가 없는 unique repo 목록 가져오기 (pagination 적용)"""
    all_repos = set()
    page_size = 1000
    offset = 0

    while True:
        result = supabase.from_("issues") \
            .select("repo_full_name") \
            .or_("stars.is.null,language.is.null") \
            .range(offset, offset + page_size - 1) \
            .execute()

        if not result.data:
            break

        for row in result.data:
            all_repos.add(row["repo_full_name"])

        if len(result.data) < page_size:
            break

        offset += page_size
        print(f"Fetched {len(all_repos)} unique repos so far...")

    return list(all_repos)


def fetch_repo_metadata(repo_full_name: str) -> dict | None:
    """GitHub API로 레포 메타데이터 가져오기"""
    url = f"https://api.github.com/repos/{repo_full_name}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)

        if resp.status_code == 200:
            data = resp.json()
            return {
                "stars": data.get("stargazers_count", 0),
                "language": data.get("language"),
            }
        elif resp.status_code == 404:
            return None  # 삭제된 레포
        elif resp.status_code == 403:
            # Rate limit
            reset_time = int(resp.headers.get("X-RateLimit-Reset", 0))
            wait = max(reset_time - time.time(), 60)
            print(f"Rate limited. Waiting {wait:.0f}s...")
            time.sleep(wait)
            return fetch_repo_metadata(repo_full_name)  # 재시도
        else:
            print(f"Error {resp.status_code} for {repo_full_name}")
            return None
    except Exception as e:
        print(f"Exception for {repo_full_name}: {e}")
        return None


def update_repo_metadata(repo_full_name: str, metadata: dict) -> bool:
    """DB에서 해당 레포의 모든 이슈 업데이트 (에러 핸들링 포함)"""
    for attempt in range(3):
        try:
            supabase.from_("issues") \
                .update(metadata) \
                .eq("repo_full_name", repo_full_name) \
                .execute()
            return True
        except Exception as e:
            if attempt < 2:
                print(f"Retry {attempt + 1} for {repo_full_name}: {e}")
                time.sleep(5 * (attempt + 1))
            else:
                print(f"Failed to update {repo_full_name}: {e}")
                return False
    return False


def check_rate_limit():
    """현재 rate limit 상태 확인"""
    resp = requests.get("https://api.github.com/rate_limit", headers=HEADERS)
    if resp.status_code == 200:
        data = resp.json()
        core = data["resources"]["core"]
        print(f"Rate limit: {core['remaining']}/{core['limit']} (resets in {core['reset'] - time.time():.0f}s)")
        return core["remaining"]
    return 0


def main():
    print("=" * 50)
    print("GitHub Repo Metadata Enrichment")
    print("=" * 50)

    remaining = check_rate_limit()
    if remaining < 100:
        print("Rate limit too low. Try again later.")
        return

    repos = get_unique_repos()
    print(f"Found {len(repos)} repos to enrich")

    enriched = 0
    skipped = 0

    for i, repo in enumerate(repos):
        if i % 100 == 0 and i > 0:
            check_rate_limit()

        metadata = fetch_repo_metadata(repo)

        if metadata:
            if update_repo_metadata(repo, metadata):
                enriched += 1
                if enriched % 50 == 0:
                    print(f"Progress: {enriched}/{len(repos)} enriched")
            else:
                skipped += 1
        else:
            skipped += 1

        # Rate limit 방지 (토큰 있으면 5000/시간 = ~1.4/초)
        time.sleep(0.5)

    print("=" * 50)
    print(f"Done! Enriched: {enriched}, Skipped: {skipped}")
    check_rate_limit()


if __name__ == "__main__":
    main()
