# GoodFirst 비용 모니터링 가이드

## 무료 티어 한도

### 1. BigQuery (Google Cloud)
| 항목 | 무료 한도 | 현재 사용량 (예상) |
|------|-----------|-------------------|
| 쿼리 | **1TB/월** | ~500MB/일 = ~15GB/월 |
| 저장소 | 10GB | 사용 안함 (쿼리만) |

**체크 방법:**
```
https://console.cloud.google.com/bigquery → 관리 → 리소스 사용량
```

**주의사항:**
- 하루 1회 ETL 실행 시 ~500MB 쿼리
- 월 ~15GB로 무료 범위 내 (1TB의 1.5%)
- 과거 데이터 백필 시 일시적으로 증가

---

### 2. Supabase (PostgreSQL)
| 항목 | 무료 한도 | 현재 사용량 (예상) |
|------|-----------|-------------------|
| Database | **500MB** | ~50MB (6개월 기준) |
| API 요청 | 무제한 | - |
| Bandwidth | 5GB/월 | ~1GB/월 |
| Auth Users | 50,000 MAU | 사용 안함 |

**체크 방법:**
```
https://supabase.com/dashboard → Project → Settings → Usage
```

**용량 계산:**
- 이슈 1개 ≈ 500 bytes
- 하루 ~300개 = ~150KB/일
- 6개월 ≈ 27MB
- 안전 마진 포함 ~50MB

**주의사항:**
- 90일 이상 오래된 데이터 자동 삭제 (cleanup_old_issues)
- 현재 설정: 90일 보관 → 변경 가능

---

### 3. Vercel (Frontend Hosting)
| 항목 | 무료 한도 | 현재 사용량 (예상) |
|------|-----------|-------------------|
| Bandwidth | **100GB/월** | ~5GB/월 |
| Serverless 실행 | 100GB-Hours | ~1GB-Hours |
| 빌드 시간 | 6000분/월 | ~50분/월 |

**체크 방법:**
```
https://vercel.com/dashboard → Usage
```

---

### 4. GitHub Actions (ETL Scheduler)
| 항목 | 무료 한도 | 현재 사용량 (예상) |
|------|-----------|-------------------|
| 실행 시간 | **2000분/월** | ~450분/월 |

**계산:**
- ETL 1회 ≈ 1분
- 시간당 1회 = 24회/일 = 720회/월
- 720분/월 (36% 사용)

**체크 방법:**
```
https://github.com/settings/billing → Actions
```

---

## 월간 체크리스트

### 매주 확인
- [ ] Supabase Usage 페이지에서 DB 용량 확인
- [ ] GitHub Actions 실행 로그 확인 (실패 여부)

### 매월 확인
- [ ] BigQuery 쿼리 사용량 확인
- [ ] Vercel bandwidth 확인
- [ ] GitHub Actions 누적 시간 확인

---

## 비용 알림 설정

### Google Cloud
```
https://console.cloud.google.com/billing/budgets
```
- 예산 생성: $1 (알림용)
- 50%, 90%, 100% 도달 시 이메일 알림

### Supabase
- 무료 티어 초과 시 자동 이메일 발송
- 추가 설정 불필요

### Vercel
- Usage 탭에서 알림 설정 가능

---

## 비용 초과 시 대응

### BigQuery 한도 초과 예상 시
1. ETL 빈도 줄이기 (1시간 → 6시간)
2. 쿼리 최적화 (날짜 범위 축소)

### Supabase 용량 초과 예상 시
1. `cleanup_old_issues` 보관 기간 단축 (90일 → 60일)
2. 불필요한 라벨 필터 추가

### GitHub Actions 한도 초과 예상 시
1. ETL 빈도 줄이기 (1시간 → 3시간)
2. 조건부 실행 추가 (변경 있을 때만)

---

## 예상 월간 비용

| 서비스 | 예상 비용 |
|--------|----------|
| BigQuery | $0 |
| Supabase | $0 |
| Vercel | $0 |
| GitHub Actions | $0 |
| **총합** | **$0/월** |

*무료 티어 범위 내에서 운영 가능*

---

## Secret 키 관리

### 저장 위치
| 키 | 위치 | 용도 |
|----|------|------|
| GCP Service Account | GitHub Secrets | ETL BigQuery 접근 |
| SUPABASE_URL | GitHub Secrets, .env.local | DB 연결 |
| SUPABASE_KEY (secret) | GitHub Secrets, etl/.env | ETL 쓰기 권한 |
| SUPABASE_KEY (publishable) | .env.local | Frontend 읽기 |

### 주의사항
- `.env`, `.env.local` 파일은 절대 git에 커밋하지 않기
- GitHub Secrets는 Settings → Secrets and variables → Actions