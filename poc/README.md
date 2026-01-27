# GoodFirst PoC - BigQuery + GH Archive 검증

## 목표
GH Archive에서 "Good First Issue"를 실제로 추출할 수 있는지 검증

## 사전 준비

1. **Google Cloud 계정** (없으면 생성)
   - https://console.cloud.google.com
   - 신용카드 등록 필요하지만 무료 티어 내에서는 과금 안 됨

2. **BigQuery 콘솔 접속**
   - https://console.cloud.google.com/bigquery

3. **프로젝트 생성** (처음이면)
   - 콘솔 상단에서 프로젝트 선택 → 새 프로젝트

## PoC 쿼리 순서

### Step 1: IssuesEvent 구조 확인
```
파일: 01_check_issues_event_structure.sql
목적: IssuesEvent의 payload 구조 파악
비용: ~10MB (거의 무료)
```

### Step 2: Good First Issue 찾기
```
파일: 02_find_good_first_issues.sql
목적: 실제 good-first-issue 라벨이 붙은 이슈 추출
비용: ~500MB
```

### Step 3: 일별 발생량 확인
```
파일: 03_count_daily_good_first_issues.sql
목적: 하루에 몇 개의 good first issue가 생기는지 파악
비용: ~500MB
```

### Step 4-5: 언어 정보 추가
```
파일: 04_issues_with_language.sql, 05_with_repo_language.sql
목적: repo의 프로그래밍 언어 정보 JOIN
비용: ~1GB
```

## 쿼리 실행 방법

1. BigQuery 콘솔에서 "새 쿼리" 클릭
2. SQL 파일 내용 복사 & 붙여넣기
3. **날짜 수정** (파일 내 `20250123` → 실제 최근 날짜)
4. "실행" 클릭
5. 결과 확인

## 검증 포인트

- [ ] IssuesEvent에서 labels 정보가 제대로 들어있는가?
- [ ] "good first issue" 라벨 필터링이 동작하는가?
- [ ] 하루에 의미있는 양의 이슈가 발생하는가? (100개 이상?)
- [ ] 언어 정보를 추가로 얻을 수 있는가?

## 예상 결과

잘 되면:
- 하루 수백~수천 개의 good first issue 이벤트 발생
- repo, title, url, labels 정보 모두 추출 가능

문제가 될 수 있는 것:
- labels 정보가 일부 누락될 수 있음
- 언어 정보는 별도 API 호출 필요할 수 있음
- closed된 이슈 추적을 위해 추가 로직 필요

## 비용 참고

- BigQuery 무료: 1TB/월
- 하루치 GH Archive: ~20GB
- 위 쿼리들 전체 실행: ~2-3GB (충분히 무료 범위)
