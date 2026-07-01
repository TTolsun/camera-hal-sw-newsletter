# llm-wiki 소스 커버리지 설계

- 작성일: 2026-06-28
- 상태: 승인됨, 구현 예정
- 관련: `llm-wiki/`(LLM Wiki vault), `llm-wiki-lint` 스킬

## 목표

llm-wiki가 이 repo를 이해·작업하는 데 실제로 쓸모 있는 지식 베이스가 되도록 한다. 구체적 활용:

- LLM 에이전트가 작업 전 repo 구조·맥락을 참조
- 코드 탐색 및 변경 영향 파악
- 코드 ↔ 위키 드리프트 관리(최신성)

옵시디언 그래프의 시각적 연결·색상은 부산물이며 목표가 아니다.

## 불변식 (설계의 핵심)

> 모든 `src/**/*.js`(prod + test)는 어떤 모듈 위키 노트의 `derived_from`에 (파일 경로 또는 상위 디렉토리 경로로) 포함된다.

이 하나가 "모든 코드가 위키에 매핑됨"(커버리지)과 "새 코드 추가 시 누락 감지"(드리프트 관리)를 동시에 보장한다.

## 범위

- 대상: `src/**/*.js` 전체 461개 (prod 252 + test 209)
- 제외: 주요 json(`newsletter-policy.json`, `news-sources.json`)은 이미 `sources/`에 문서화됨. 생성물(cache 등) 제외.

## 구성

### 1. 모듈 노트 정비

- 누락 모듈에 entity 노트 신규/보강
  - 신규: `shared-common`, `shared-tooling`, `shared-evidence`, `shared-collect`, `shared-llm`, `shared-domain`, `generator-diagnostics`
  - 보강: `generator-quality`, `generator-render`, `generator-repair`, `discovery`, `collector`
  - 작은 하위(`shared/adapters`, `sources`, `render`, `cli`, `validate`)는 `shared.md`에 묶음
- test: layer별 노트 3개 — `generator-test`, `shared-test`, `discovery-test` (`derived_from: src/<layer>/test/`)
- frontmatter: 필수 5필드(type/title/tags/updated/derived_from), `derived_from`은 **디렉토리 단위** 우선
- 본문: 간결하게 — 역할 1~2줄 + 관련 모듈 `[[wikilink]]`. **파일별 한 줄 설명·링크는 하지 않는다**(그래프 미관용이라 불필요).

### 2. 커버리지 lint (드리프트 관리의 핵심)

- `llm-wiki-lint` 스킬의 검사 로직(lint/verify)에 커버리지 체크를 추가: `src`의 모든 `.js`가 어떤 노트의 `derived_from`(파일 또는 디렉토리 prefix)에 포함되는지 검사. 미커버 파일이 하나라도 있으면 fail.
- 효과: 새 코드가 추가되면 자동으로 누락이 감지됨 → 최신성/드리프트 관리.

### 3. 그래프 연결 (부산물)

- 모듈 노트 간 `[[wikilink]]`로 자연 형성. 별도 작업 없음.

## lint / 발행 무결성

- 새 노트는 모두 `index.md`에 `[[slug]]` 등록(orphan·index-coverage 충족)
- 노트끼리/기존 노트와 `[[wikilink]]` 연결
- `derived_from` 경로 실존 검증 통과
- UTF-8 without BOM (Node `fs`로만 작성, PowerShell redirection 금지)
- 작업 후 wiki lint + verify 실행
- GitHub Wiki에 약 10개 신규 페이지 발행됨(수용)

## 비목표 (non-goals)

- 옵시디언 그래프 미관(파일별 링크, 색상 튜닝)
- 파일별 개별 위키 페이지
- 사람 onboarding용 산문 문서

## 작업 원칙

- 분석(현황·갭)은 철저히: 측정 완료 — prod 252 / test 209, 현재 커버리지 47%, 누락 133.
- 구현은 꼼꼼히: 모듈 단위로 노트 작성 → lint → 다음.
- 설계는 단순히: 위 불변식 하나를 중심으로 구조 최소 유지.
