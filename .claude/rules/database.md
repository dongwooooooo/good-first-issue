---
paths: etl/**/*.sql, etl/**/*.py
---

# Database Security Rules

## SQL 작성 규칙

### Views
- 모든 뷰에 `WITH (security_invoker = true)` 필수
- SECURITY DEFINER 뷰 사용 금지 (RLS 우회 위험)

### Functions
- SECURITY DEFINER 함수에는 반드시 `SET search_path = <schema>` 포함
- SECURITY DEFINER는 materialized view refresh 등 필수적인 경우에만 사용
- 가능하면 SECURITY INVOKER 사용

### Extensions
- public 스키마에 extension 설치 금지
- `CREATE EXTENSION ... SCHEMA extensions;` 패턴 사용

### Materialized Views
- anon/authenticated에 GRANT SELECT 시 의도적 공개 여부 주석 필수
- 민감 데이터 포함 materialized view는 authenticated only

### Migrations
- 스키마 변경 시 `etl/migration_<name>.sql` 파일 생성
- migration 파일에 변경 이유, 날짜, 롤백 방법 포함
- 기존 인덱스에 영향 주는 변경은 의존성 확인 후 진행

### RLS (Row Level Security)
- 새 테이블에는 반드시 RLS 활성화
- 정책 이름은 용도를 명확히 (`"Public read access"`, `"Owner write access"`)

## ETL Python 규칙

### Supabase 연결
- 환경 변수로 credentials 관리 (하드코딩 금지)
- service_role key는 ETL에서만 사용, 프론트엔드에 노출 금지

### 에러 처리
- BigQuery/GitHub API 호출 실패 시 graceful fallback
- rate limit 처리 포함
