# GoodFirst - Open Source Good First Issue Tracker

## Project Overview
BigQuery에서 GitHub 오픈소스 이슈를 수집하여 Supabase에 저장하고, Next.js 프론트엔드로 제공하는 서비스.

## Architecture
- `etl/` — Python ETL pipeline (BigQuery → Supabase, GitHub API enrichment)
- `web/` — Next.js 15 frontend (App Router, Tailwind CSS, shadcn/ui)
- Database: Supabase (PostgreSQL) with materialized views for stats
- CI/CD: GitHub Actions (2-hour cron ETL)

See @ARCHITECTURE.md for detailed system design.

## Key Commands

### ETL
```bash
cd etl && source .venv/bin/activate
python3 fetch_issues.py       # BigQuery → Supabase sync
python3 enrich_repos.py       # GitHub API metadata enrichment
python3 refresh_stats.py      # Refresh materialized views
```

### Web
```bash
cd web
npm run dev                    # Local dev server (port 3000)
npm run build                  # Production build
npm run lint                   # ESLint
```

### Database
```bash
# SQL files are in etl/ - run in Supabase SQL Editor
# schema.sql              — Base table + RLS
# schema_optimization.sql — Views, functions, indexes
# migration_*.sql         — Incremental fixes
```

## Database Schema

### Tables
- `issues` — GitHub issues (RLS enabled, public read)

### Materialized Views (public stats, refreshed by ETL)
- `repo_stats` — Per-repo aggregated stats
- `org_stats` — Per-org aggregated stats
- `language_stats` — Per-language aggregated stats

### Views
- `issue_stats` — Real-time issue counts (security_invoker = true)

### Functions
- `refresh_stats()` — Refresh all materialized views (SECURITY DEFINER, fixed search_path)
- `search_autocomplete()` — Fuzzy search for repos/orgs

## Database Rules
- SQL 파일 수정 시 반드시 migration 파일도 함께 생성
- SECURITY DEFINER 함수에는 반드시 `SET search_path = public` 포함
- 새 뷰 생성 시 `WITH (security_invoker = true)` 사용
- Extensions는 `extensions` 스키마에 설치 (public 스키마 노출 방지)
- Materialized view 권한 부여 시 의도적 공개 여부 주석으로 명시

## Environment Variables
- `etl/.env` — Supabase credentials, GitHub token, GCP config (gitignored)
- `web/.env.local` — Public Supabase URL and anon key (gitignored)
- See `.env.example` files for required variables

## Conventions
- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Branch: `<type>/<description>` (e.g., `fix/security-linter-issues`)
- All data is public (open source issue stats) — no PII handling needed
- Free tier constraints: see @COST_MONITORING.md
