# GoodFirst Architecture

## Overview
GitHub Good First Issue 트래커 - 무료 인프라 기반

## Tech Stack

### Data Pipeline
- **Source**: GH Archive (BigQuery)
- **ETL**: Python + google-cloud-bigquery
- **Scheduler**: GitHub Actions (1시간 cron)

### Database
- **Supabase** (PostgreSQL)
- 무료 티어: 500MB, 50K rows
- REST API 내장

### Application
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Hosting**: Vercel (무료)

## Data Flow

```
GH Archive (BigQuery)
       │
       │ GitHub Actions (1시간 cron)
       │ Python ETL Script
       ▼
   Supabase DB
       │
       │ Supabase REST API / Next.js API Routes
       ▼
   Next.js Frontend (Vercel)
       │
       ▼
    사용자
```

## Database Schema

### issues 테이블
```sql
CREATE TABLE issues (
  id BIGSERIAL PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  repo_owner VARCHAR(255) NOT NULL,
  issue_number INT NOT NULL,
  title TEXT NOT NULL,
  url VARCHAR(500) NOT NULL,
  labels JSONB,
  language VARCHAR(50),
  stars INT DEFAULT 0,
  state VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(repo_owner, repo_name, issue_number)
);

CREATE INDEX idx_issues_language ON issues(language);
CREATE INDEX idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX idx_issues_stars ON issues(stars DESC);
CREATE INDEX idx_issues_labels ON issues USING GIN(labels);
```

## API Endpoints (Next.js API Routes)

### GET /api/issues
이슈 목록 조회
- Query params: language, label, sort, page, limit

### GET /api/stats
통계 조회
- 언어별 이슈 수, 총 이슈 수 등

## Data Retention Policy
- 1년 이내 이슈만 유지
- closed 이슈는 다음 ETL 사이클에서 삭제
- 예상 용량: ~50MB

## Cost
- BigQuery: 무료 (1TB/월 이내)
- Supabase: 무료 (500MB 이내)
- Vercel: 무료 (100GB bandwidth)
- GitHub Actions: 무료 (2000분/월)

**Total: $0/월**
