"""
Refresh Materialized Views in Supabase
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"]
)


def main():
    print("Refreshing materialized views...")

    # Call the refresh_stats function created in schema_optimization.sql
    result = supabase.rpc("refresh_stats").execute()

    print("Done!")
    return result


if __name__ == "__main__":
    main()
