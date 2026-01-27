"""
6개월치 과거 데이터 백필
예상 BigQuery 비용: ~3GB (무료 범위 내)
"""

import os
from datetime import datetime, timedelta
from fetch_issues import fetch_good_first_issues, upsert_to_supabase
from dotenv import load_dotenv

load_dotenv()

# GCP 프로젝트 설정
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "silver-pen-391310")


def backfill_months(months: int = 6):
    """
    과거 N개월치 데이터 백필
    """
    total_saved = 0
    end_date = datetime.now() - timedelta(days=1)  # 어제부터
    start_date = end_date - timedelta(days=months * 30)

    print(f"Backfilling from {start_date.date()} to {end_date.date()}")
    print(f"Total days: {(end_date - start_date).days}")
    print("=" * 50)

    current = start_date
    day_count = 0

    while current <= end_date:
        date_str = current.strftime("%Y%m%d")
        day_count += 1

        try:
            issues = fetch_good_first_issues(date_str)
            if issues:
                saved = upsert_to_supabase(issues)
                total_saved += saved
                print(f"[{day_count}] {date_str}: {saved} issues saved")
            else:
                print(f"[{day_count}] {date_str}: no issues")
        except Exception as e:
            print(f"[{day_count}] {date_str}: ERROR - {e}")

        current += timedelta(days=1)

    print("=" * 50)
    print(f"Backfill complete! Total: {total_saved} issues")


if __name__ == "__main__":
    backfill_months(6)