# Start Open Source

**[start-opensource.dev](https://start-opensource.dev)**

Discover beginner-friendly GitHub issues and make your first open source contribution. We automatically collect "Good First Issue" labeled issues from across GitHub, updated every hour.

## How It Works

```
GH Archive (BigQuery)  →  GitHub Actions (hourly)  →  Supabase DB  →  Next.js (Vercel)
```

- **GH Archive + BigQuery**: Collects `good first issue` labeled issues from all GitHub events every hour
- **Supabase**: Stores issues in PostgreSQL and serves them via REST API
- **Next.js**: SSR frontend with search, filtering, and sorting

## Features

- Browse by Issues, Repositories, or Organizations
- Filter by language (TypeScript, Python, Go, Rust, and 20+ more)
- Trending issues with date range and minimum star filters
- Unified search across issue titles and repository names
- Dark mode support

