# Start Open Source

**[start-opensource.dev](https://start-opensource.dev)**

GitHub "Good First Issue"를 자동으로 수집하여 보여주는 오픈소스 기여 탐색 서비스입니다.

언어, 레포지토리, 조직별로 필터링하고, 트렌딩 이슈를 빠르게 찾아 첫 오픈소스 기여를 시작하세요.

## How It Works

```
GH Archive (BigQuery)  →  GitHub Actions (hourly)  →  Supabase DB  →  Next.js (Vercel)
```

- **GH Archive + BigQuery**: GitHub 전체 이벤트에서 `good first issue` 라벨이 붙은 이슈를 매시간 수집
- **Supabase**: 수집된 이슈를 PostgreSQL에 저장하고 REST API로 제공
- **Next.js**: SSR 기반 프론트엔드에서 검색, 필터, 정렬 기능 제공

## Features

- Issues / Repos / Orgs 3가지 뷰
- 언어별 필터링 (TypeScript, Python, Go, Rust 등 20개+)
- Trending 이슈 (기간, 최소 스타 수 조건)
- 통합 검색 (이슈 제목, 레포지토리명)
- 다크 모드 지원

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Database | Supabase (PostgreSQL) |
| ETL | Python, google-cloud-bigquery |
| Scheduler | GitHub Actions (cron) |
| Hosting | Vercel |

## Getting Started

```bash
# web
cd web
npm install
npm run dev
```

환경변수는 `.env.local`에 설정합니다:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=https://start-opensource.dev
```

## License

MIT
