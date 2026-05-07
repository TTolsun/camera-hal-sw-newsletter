# Camera HAL SW Newsletter 비용 절감 리팩토링 Workflow

## 1. 목적

현재 `camera-hal-sw-newsletter`는 뉴스레터 1회 생성 시 약 800~900원 수준의 비용이 발생한다.
이 비용은 현재 구조에서는 발생 가능하지만, 지속 운영 관점에서는 높은 편이다.

이 문서의 목적은 다음과 같다.

- 뉴스 품질은 유지하거나 높인다.
- Camera HAL 관련성을 최우선으로 유지한다.
- AI 또는 C++ 기사는 필수는 아니지만, 가능하면 둘 중 하나는 포함한다.
- 최신성은 중요하지만, 3~4주 이내 기사까지 허용한다.
- Gemini API 호출 비용을 줄인다.
- 실패/재시도 시 전체 재생성이 아니라 필요한 부분만 고치도록 한다.

인간이 만든 자동화가 비용을 자동으로 태우는 건 꽤 전통적인 비극이므로, 이번에는 돈이 어디서 새는지 먼저 보이게 만든다.

---

## 2. 현재 문제 요약

### 2.1 비용이 커지는 주요 원인

현재 구조에서 비용이 커질 수 있는 원인은 다음과 같다.

1. Gemini 호출 stage가 많다.
   - reporter
   - editor
   - fact-check
   - quality repair
   - retry

2. Quality retry가 전체 재생성에 가깝게 동작할 가능성이 있다.

3. fallback model에 `gemini-2.5-pro`가 포함되어 있다.
   - Pro는 품질은 좋지만 자동 scheduled run의 기본 fallback으로 쓰기에는 비싸다.

4. 후보 기사 전체 또는 큰 context가 반복적으로 LLM에 전달될 가능성이 있다.

5. 기사 선정까지 LLM이 많이 관여하면 입력 token이 커진다.

6. token/cost report가 부족하면 어느 stage가 비용을 태우는지 알기 어렵다.

---

## 3. 목표 상태

### 3.1 비용 목표

| 구분 | 목표 비용 |
|---|---:|
| 현재 | 800~900원 / 회 |
| 1차 개선 후 | 300~500원 / 회 |
| 2차 개선 후 | 150~300원 / 회 |
| Pro 수동 사용 시 | 700원 이상 허용 가능 |

### 3.2 품질 목표

| 항목 | 목표 |
|---|---|
| Camera HAL 관련성 | 최우선 |
| AI/C++ 기사 | 가능하면 둘 중 하나 포함 |
| 최신성 | 3~4주 이내 허용 |
| Main article 수 | `config/newsletter-policy.json`의 Article Composition Policy 기준 |
| Source gap | main article 금지 |
| Watch page | 날짜/릴리스 근거 없으면 main article 금지 |
| 비용 추적 | stage별 token/cost report 생성 |

---

## 4. 리팩토링 원칙

### 4.1 LLM은 편집자, 코드는 선정자

기사를 고르는 일은 최대한 코드가 한다.

LLM에게 후보 30~80개를 던지고 “좋은 거 골라줘”라고 하는 방식은 비용이 크다.
후보 필터링과 scoring은 deterministic code로 처리하고, LLM에는 최종 후보 8~12개만 넘긴다.

### 4.2 Camera HAL 우선순위

우선순위는 다음과 같다.

```text
1순위: Camera HAL / Android Camera 직접 관련 기사
2순위: CameraX, Camera2, AOSP Camera, libcamera, sensor/HAL 주변 기술
3순위: AI 또는 C++ 기사
4순위: 일반 Android / 개발 생산성 / 기타 IT
```

AI 또는 C++ 기사는 다음 조건에서만 main article로 승격한다.

```text
- Camera HAL 업무와 연결할 수 있는 실무적 의미가 있음
- Android camera pipeline, device-side AI, native performance, C++ tooling과 연결 가능
- HAL 관련 기사가 부족할 때 보완 기사로 사용 가능
```

### 4.3 전체 retry 금지

Quality check에서 일부 article만 실패했다면 전체 뉴스레터를 다시 생성하지 않는다.

```text
PASS article  -> lock
FAIL article  -> section-level repair 또는 replace
source gap    -> demote 또는 remove
```

---

## 5. 최종 목표 Workflow

```text
1. Collect sources
2. Normalize candidates
3. Deterministic eligibility filter
4. HAL-first deterministic scoring
5. Keep top 8~12 candidates
6. Build compact article capsules
7. Generate draft newsletter with Gemini Flash
8. Deterministic quality validation
9. Repair only failed sections once
10. Render HTML / Markdown
11. Generate cost report
12. Publish
```

---

## 6. PR 단위 실행 계획

---

# PR1. Stage별 Token / Cost Report 추가

## 목적

비용을 줄이기 전에 어디서 비용이 발생하는지 확인한다.
계측 없이 최적화하는 것은 로그 없이 Camera HAL deadlock 잡겠다는 말과 비슷하다. 매우 용감하지만 대체로 멍청하다.

## 작업 내용

### 1. Gemini 응답 usage metadata 수집

`gemini-client.js`에서 Gemini response의 usage metadata를 수집한다.

수집 필드 예시:

```json
{
  "stage": "editor",
  "model": "gemini-2.5-flash",
  "attempt": 1,
  "prompt_tokens": 12000,
  "output_tokens": 1800,
  "thinking_tokens": 0,
  "cached_tokens": 0,
  "total_tokens": 13800,
  "estimated_cost_usd": 0.015
}
```

### 2. Cost report 파일 생성

생성 위치:

```text
.tmp/newsroom-cost-report.json
content/newsroom/YYYY-MM-DD/cost-report.md
```

### 3. 환경변수 추가

```yaml
NEWSROOM_WARN_COST_USD: "0.15"
NEWSROOM_MAX_COST_USD: "0.25"
```

초기에는 `NEWSROOM_MAX_COST_USD` 초과 시 fail하지 말고 warning만 출력한다.

## Acceptance Criteria

- 각 Gemini 호출 stage별 token 사용량이 기록된다.
- retry가 발생하면 attempt별 비용이 분리되어 기록된다.
- 최종 total estimated cost가 출력된다.
- cost report가 GitHub Actions artifact로 남는다.
- 기존 newsletter 생성 결과는 바뀌지 않는다.

---

# PR2. Pro Fallback 제거 및 Manual Escalation 구조 추가

## 목적

자동 scheduled run에서 `gemini-2.5-pro`가 fallback으로 호출되는 것을 막는다.
Pro는 비상용으로만 사용한다. 매번 비상벨 누르는 회사는 보통 비상이 아니라 운영 방식이 문제다.

## 작업 내용

### 1. 기본 fallback 변경

기존:

```yaml
GEMINI_FALLBACK_MODELS: gemini-2.5-flash-lite,gemini-2.5-pro
```

변경:

```yaml
GEMINI_FALLBACK_MODELS: gemini-2.5-flash-lite
```

### 2. Pro 사용 정책 추가

```yaml
NEWSROOM_ALLOW_PRO_ON_SCHEDULE: "false"
NEWSROOM_PRO_ESCALATION: "manual"
```

정책:

```text
- schedule trigger에서는 Pro 사용 금지
- workflow_dispatch 수동 실행에서만 Pro 허용
- Pro 사용 시 cost report에 명시
- Pro 사용 stage는 editor final polish 또는 emergency repair 1회로 제한
```

### 3. Workflow 입력 추가

`workflow_dispatch`에 다음 input 추가:

```yaml
allow_pro:
  description: "Allow Gemini Pro for this manual run"
  required: false
  default: "false"
```

## Acceptance Criteria

- scheduled run에서 Pro가 호출되지 않는다.
- manual run에서만 Pro 사용 가능하다.
- Pro 호출 시 log와 cost report에 명확히 남는다.
- Pro 미사용 상태에서도 quality gate가 정상 동작한다.

---

# PR3. HAL-first Deterministic Scoring 추가

## 목적

LLM이 기사 후보를 고르지 않게 하고, 코드가 먼저 후보를 줄인다.
LLM은 비싼 편집자이지, RSS 쓰레기통 뒤지는 알바가 아니다.

## 작업 내용

### 1. Scoring 공식 추가

```text
total_score =
  camera_hal_directness * 45
+ evidence_specificity * 20
+ freshness_score * 15
+ practical_actionability * 10
+ source_reliability * 5
+ optional_ai_cpp_bonus * 5
- generic_ai_penalty
- watch_page_penalty
- no_date_penalty
- no_api_component_penalty
```

### 2. Field 정의

| 필드 | 설명 |
|---|---|
| `camera_hal_directness` | Camera HAL / Android Camera 직접 관련성 |
| `evidence_specificity` | 날짜, 버전, API, component, behavior change 근거 |
| `freshness_score` | 3~4주 이내 여부 |
| `practical_actionability` | HAL 개발자가 바로 참고할 실무 가치 |
| `source_reliability` | 공식 문서, release note, credible source 여부 |
| `optional_ai_cpp_bonus` | AI/C++ 보완 가치 |
| `generic_ai_penalty` | 일반 AI 홍보 기사 패널티 |
| `watch_page_penalty` | watch page인데 날짜 근거 부족 |
| `no_date_penalty` | 게시일/릴리스일 없음 |
| `no_api_component_penalty` | 구체 component/API 없음 |

### 3. Main article eligibility rule

Main article 후보 조건:

```text
- total_score >= threshold
- camera_hal_directness >= minimum_hal_score
- source_gap_risk != true
- finalSelectionEligibility in ["main", "short"]
- dated evidence 존재
```

### 4. AI/C++ 정책

```text
- AI/C++은 mandatory가 아니라 bonus
- 단, HAL 후보가 부족할 경우 보완 기사로 사용 가능
- AI/C++ 중 하나가 좋은 후보로 있으면 briefing 또는 main article에 포함
```

## Acceptance Criteria

- LLM 호출 전에 후보가 8~12개 수준으로 줄어든다.
- HAL 관련성이 낮은 AI/C++ 기사는 main article로 선정되지 않는다.
- source gap candidate는 main article에서 제외된다.
- scoring breakdown이 debug artifact로 남는다.

---

# PR4. Article Capsule 도입

## 목적

LLM에 넘기는 입력 token을 줄인다.
원문 전체, source registry 전체, 긴 후보 목록을 반복 투입하지 않는다.

## 작업 내용

### 1. Article capsule schema 추가

```json
{
  "title": "",
  "url": "",
  "source": "",
  "published_date": "",
  "topic_type": "camera-hal | android-camera | ai | cpp | general",
  "component": "",
  "what_changed": "",
  "why_hal_engineer_cares": "",
  "evidence_quotes": [],
  "risk": {
    "source_gap": false,
    "watch_page": false,
    "no_dated_evidence": false
  },
  "score": {
    "total": 0,
    "camera_hal_directness": 0,
    "freshness": 0,
    "practical_actionability": 0
  }
}
```

### 2. Capsule 크기 제한

```text
- candidate 1개당 500~800 tokens 이하
- editor stage에는 최대 8~12개 candidate만 전달
- 최종 article generation에는 Article Composition Policy를 만족하는 selected article input만 전달
```

### 3. Retry 입력 최소화

Retry 시 전체 context를 다시 넣지 않는다.

```text
- locked articles summary
- failed section
- relevant candidate capsule
- quality deduction
```

만 전달한다.

## Acceptance Criteria

- editor prompt의 입력 token 수가 감소한다.
- retry prompt가 전체 newsletter context를 반복하지 않는다.
- 생성 품질이 기존 quality threshold를 만족한다.
- capsule artifact가 debug 파일로 남는다.

---

# PR5. Section-level Repair Workflow 추가

## 목적

Quality retry 시 전체 뉴스레터 재생성을 막는다.
통과한 기사는 잠그고, 실패한 기사만 고친다.

## 작업 내용

### 1. Article lock 구조 추가

Quality check 결과 article별 상태를 기록한다.

```json
{
  "headline": "",
  "status": "PASS | FAIL | DEMOTE",
  "reason": "",
  "locked": true
}
```

### 2. Repair 정책

```text
PASS:
  - section lock
  - 다음 retry에서 내용 변경 금지

FAIL: weak HAL relevance:
  - 다음 candidate로 replace

FAIL: source gap:
  - main article에서 demote
  - watchlist 또는 briefing으로 이동 가능

FAIL: missing actionability:
  - same source로 section repair 1회 허용

FAIL: duplicate:
  - replace
```

### 3. Repair 횟수 제한

```yaml
NEWSROOM_MAX_QUALITY_RETRIES: "1"
NEWSROOM_MAX_SECTION_REPAIRS: "1"
```

### 4. Repair prompt 입력

Repair prompt에는 다음만 전달한다.

```text
- failed section
- quality deduction
- source URLs
- candidate capsule
- locked article headlines
- editor rules
```

## Acceptance Criteria

- quality retry 시 PASS article은 변경되지 않는다.
- 실패 section만 재생성된다.
- source gap은 rewrite가 아니라 demote/replace된다.
- retry 비용이 기존 대비 감소한다.

---

# PR6. Gemini Thinking Budget 제어

## 목적

불필요한 thinking token 비용을 줄인다.
뉴스레터 작성은 고난도 증명이 아니다. 물론 인간 조직에서는 회의록도 고난도처럼 굴러가긴 한다.

## 작업 내용

### 1. Stage별 thinking budget 설정

```yaml
GEMINI_THINKING_BUDGET_REPORTER: "0"
GEMINI_THINKING_BUDGET_EDITOR: "512"
GEMINI_THINKING_BUDGET_REPAIR: "0"
GEMINI_THINKING_BUDGET_FACTCHECK: "0"
```

### 2. Gemini request config에 반영

예시:

```js
config: {
  responseMimeType: 'application/json',
  responseSchema,
  temperature: 0.25,
  thinkingConfig: {
    thinkingBudget: stageThinkingBudget
  }
}
```

### 3. Stage별 기본값

| Stage | Thinking Budget |
|---|---:|
| reporter | 0 |
| candidate scoring | 0 |
| editor | 512 |
| repair | 0 |
| fact-check | 0 |

## Acceptance Criteria

- stage별 thinking budget이 적용된다.
- cost report에 thinking token이 별도 기록된다.
- editor 품질 저하가 있으면 editor만 1024까지 올릴 수 있다.
- Pro 사용 시 thinking disable 불가 정책을 문서화한다.

---

# PR7. Cache Key 개선

## 목적

동일 URL 또는 동일 content를 반복 요약하지 않는다.

## 작업 내용

### 1. Cache key 변경

기존 후보 파일 hash 중심 cache에서 다음 구조로 개선한다.

```text
cache_key = normalized_url + published_date + content_hash
```

### 2. Cache 저장 구조

```text
cache/news-summary/
  by-url/
    sha256(normalized_url).json
  by-content/
    sha256(content_text).json
```

### 3. Cache hit 정책

```text
- 같은 URL이면 cache 사용
- URL은 다르지만 content hash가 같으면 cache 사용
- published_date가 바뀌면 freshness만 재계산
- source metadata만 바뀌면 summary 재생성 금지
```

## Acceptance Criteria

- 반복 실행 시 summary stage 비용이 감소한다.
- cache hit/miss가 cost report에 기록된다.
- cache miss 사유가 debug artifact에 기록된다.
- PR에 noisy generated cache file이 포함되지 않는다.

---

# PR8. Quality Gate 정책 정리

## 목적

품질 기준을 유지하되 비용이 폭증하지 않게 한다.

## 추천 정책

```text
Quality threshold:
  - `config/newsletter-policy.json`의 `qualityGatePolicy.threshold`를 source of truth로 운영
  - 단, source gap / duplicate / no source는 hard fail

Hard fail:
  - source 없는 section
  - broken URL
  - duplicate main article
  - HAL relevance 없는 generic AI 기사만 포함
  - main article 최소 개수 미달

Soft deduction:
  - 최신성 약함
  - action item 부족
  - 설명이 약간 일반적
  - 이미지 fallback 사용
```

### Article gate 예시

```text
PASS article:
  - source 있음
  - 날짜 근거 있음
  - HAL 관점 있음
  - action item 있음
  - duplicate 아님

DEMOTE article:
  - 흥미는 있지만 HAL 직접성 낮음
  - AI/C++ 보완 기사로는 가능
  - watchlist 또는 briefing으로 이동

FAIL article:
  - source gap
  - 날짜 근거 없음
  - 광고/홍보성 기사
  - HAL 관점 억지 연결
```

## Acceptance Criteria

- hard fail과 soft deduction이 분리된다.
- source gap은 점수 보정으로 통과하지 못한다.
- generic AI 기사는 HAL 기사 부족 시에도 main article로 쉽게 올라오지 않는다.
- quality report가 article별로 PASS/DEMOTE/FAIL을 표시한다.

---

## 7. 추천 환경변수 세트

### 기본 Scheduled Run

```yaml
LOOKBACK_DAYS: "21"

GEMINI_MODEL: "gemini-2.5-flash"
GEMINI_FALLBACK_MODELS: "gemini-2.5-flash-lite"
GEMINI_MAX_RETRIES: "2"
GEMINI_RETRY_DELAYS_MS: "20000,10000"
GEMINI_RETRY_MAX_DELAY_MS: "300000"

GEMINI_THINKING_BUDGET_REPORTER: "0"
GEMINI_THINKING_BUDGET_EDITOR: "512"
GEMINI_THINKING_BUDGET_REPAIR: "0"
GEMINI_THINKING_BUDGET_FACTCHECK: "0"
GEMINI_THINKING_BUDGET_SCORING: "0"

NEWSROOM_MAX_QUALITY_RETRIES: "1"
NEWSROOM_MAX_SECTION_REPAIRS: "1"

NEWSROOM_WARN_COST_USD: "0.15"
NEWSROOM_MAX_COST_USD: "0.25"

NEWSROOM_ALLOW_PRO_ON_SCHEDULE: "false"
NEWSROOM_ALLOW_PRO_ON_MANUAL: "false"
NEWSROOM_PRO_ESCALATION: "manual"
```

### Manual High Quality Run

```yaml
GEMINI_MODEL: "gemini-2.5-flash"
GEMINI_FALLBACK_MODELS: "gemini-2.5-flash-lite,gemini-2.5-pro"

NEWSROOM_ALLOW_PRO_ON_SCHEDULE: "false"
NEWSROOM_ALLOW_PRO_ON_MANUAL: "true"
NEWSROOM_PRO_ESCALATION: "manual"

NEWSROOM_MAX_QUALITY_RETRIES: "1"
NEWSROOM_MAX_SECTION_REPAIRS: "1"
```

최종 통합 기준 실제 workflow에서는 manual `workflow_dispatch`의 `allow_pro=true` 입력이 `GEMINI_FALLBACK_MODELS`에 `gemini-2.5-pro`를 추가한다. scheduled run은 `NEWSROOM_ALLOW_PRO_ON_SCHEDULE=false`와 Flash-Lite fallback 기본값으로 Pro 자동 호출을 막는다.

---

## 8. 권장 구현 순서

```text
Step 1. Cost report 추가
Step 2. Pro fallback 제거
Step 3. Quality retry 3 -> 1로 제한
Step 4. HAL-first deterministic scoring 추가
Step 5. Article capsule 도입
Step 6. Section-level repair 적용
Step 7. Thinking budget 제어
Step 8. Cache key 개선
Step 9. Quality gate hard/soft rule 분리
```

---

## 9. 검증 방법

### 9.1 비용 검증

비교 대상:

```text
Before:
  - 최근 3회 생성 비용
  - retry 횟수
  - model usage
  - token usage 추정

After:
  - 동일 source 기간 기준 재생성
  - stage별 cost report 비교
  - cache hit 이후 비용 비교
```

### 9.2 품질 검증

확인 항목:

```text
- Camera HAL 관련 main article 수
- AI/C++ 보완 기사 포함 여부
- source gap 여부
- duplicate 여부
- 날짜/버전/API/component 명시 여부
- action item 실무성
- quality score
```

### 9.3 Regression Check

```text
npm run generate
npm run validate:site
npm run validate:images
npm run validate:quality
```

추가로 다음 artifact를 확인한다.

```text
.tmp/newsletter-generation-status.json
.tmp/newsroom-cost-report.json
content/newsroom/YYYY-MM-DD/selection-report.md
content/newsroom/YYYY-MM-DD/cost-report.md
```

---

## 10. 성공 기준

최종 성공 기준은 다음과 같다.

```text
- Scheduled run 기준 1회 비용 300원 이하
- Retry 발생 시에도 500원 이하
- Pro 자동 호출 0회
- Camera HAL / Primary Camera Stack main article 필수 조건은 Article Composition Policy 기준
- AI 또는 C++ 보완 기사 가능 시 1개 포함
- Source gap main article 0개
- Duplicate main article 0개
- Quality score threshold 통과
- Cost report 자동 생성
```

---

## 11. Codex 작업용 통합 프롬프트

아래 프롬프트를 Codex CLI 또는 Claude Code plan mode에 그대로 넣어도 된다.

```text
너는 GitHub 저장소 `TTolsun/camera-hal-sw-newsletter`의 리팩토링을 담당한다.

목표:
- 뉴스레터 1회 생성 비용을 현재 약 800~900원에서 150~300원 수준으로 낮춘다.
- 뉴스 품질은 유지하거나 높인다.
- Camera HAL / Android Camera 관련성을 최우선으로 한다.
- AI 또는 C++ 기사는 필수는 아니지만, 가능하면 둘 중 하나는 포함한다.
- 최신성은 3~4주 이내 기사까지 허용한다.
- scheduled run에서 Gemini Pro가 자동 호출되지 않도록 한다.
- 품질 retry는 전체 재생성이 아니라 실패 section만 repair 또는 replace하도록 한다.

우선순위:
1. 비용 계측
2. Pro fallback 제거
3. HAL-first deterministic scoring
4. Article capsule로 prompt 입력 축소
5. Section-level repair
6. Thinking budget 제어
7. Cache key 개선
8. Quality gate hard/soft rule 분리

구현 요구사항:

PR1:
- `gemini-client.js`에서 Gemini response usage metadata를 수집한다.
- stage/model/attempt별 prompt tokens, output tokens, thinking tokens, total tokens, estimated cost를 기록한다.
- `.tmp/newsroom-cost-report.json`과 `content/newsroom/YYYY-MM-DD/cost-report.md`를 생성한다.
- `NEWSROOM_WARN_COST_USD`, `NEWSROOM_MAX_COST_USD` 환경변수를 추가한다.
- 초기에는 budget 초과 시 fail하지 말고 warning만 출력한다.

PR2:
- scheduled run에서 `gemini-2.5-pro` fallback을 제거한다.
- 기본 fallback은 `gemini-2.5-flash-lite`만 사용한다.
- Pro는 manual workflow_dispatch에서 명시적으로 허용한 경우에만 사용 가능하게 한다.
- Pro 사용 시 cost report에 명확히 기록한다.

PR3:
- LLM 호출 전에 deterministic HAL-first scoring을 수행한다.
- scoring 공식:
  total_score =
    camera_hal_directness * 45
  + evidence_specificity * 20
  + freshness_score * 15
  + practical_actionability * 10
  + source_reliability * 5
  + optional_ai_cpp_bonus * 5
  - generic_ai_penalty
  - watch_page_penalty
  - no_date_penalty
  - no_api_component_penalty
- source_gap_risk=true, 날짜 근거 없음, watch page without dated evidence는 main article에서 제외한다.
- LLM에 넘기는 후보를 8~12개로 제한한다.

PR4:
- Article capsule schema를 추가한다.
- LLM에는 원문 전체 대신 compact capsule만 전달한다.
- candidate 1개당 500~800 tokens 이하가 되도록 한다.
- retry 시 전체 context를 반복 전달하지 않는다.

PR5:
- Quality retry를 section-level repair로 변경한다.
- PASS article은 lock하고 retry에서 변경하지 않는다.
- FAIL article만 repair 또는 replace한다.
- source gap article은 rewrite하지 말고 demote 또는 replace한다.
- `NEWSROOM_MAX_QUALITY_RETRIES=1`, `NEWSROOM_MAX_SECTION_REPAIRS=1`을 기본값으로 한다.

PR6:
- Gemini thinking budget을 stage별로 설정 가능하게 한다.
- reporter/scoring/repair/fact-check는 thinkingBudget=0을 기본값으로 한다.
- editor만 512 또는 1024로 제한한다.
- thinking token을 cost report에 기록한다.

PR7:
- summary cache key를 normalized_url + published_date + content_hash 기반으로 개선한다.
- 같은 URL 또는 같은 content hash는 재요약하지 않는다.
- cache hit/miss와 miss reason을 cost report에 기록한다.
- cache file은 PR에 noisy하게 포함되지 않도록 한다.

PR8:
- quality gate에서 hard fail과 soft deduction을 분리한다.
- source gap, duplicate, missing source, broken URL은 hard fail로 유지한다.
- 최신성 약함, 설명 부족, fallback image 사용은 soft deduction으로 처리한다.
- article별 PASS/DEMOTE/FAIL 결과를 quality report에 남긴다.

제약:
- 기존 HTML/Markdown 렌더링 결과는 가능한 유지한다.
- 기존 GitHub Pages 배포 구조를 깨지 않는다.
- 기존 validation script와 호환되게 한다.
- 변경마다 테스트 또는 검증 방법을 README 또는 docs에 기록한다.
- 비용 절감 때문에 Camera HAL 관련성이 낮아지면 안 된다.

완료 조건:
- scheduled run에서 Pro 자동 호출이 발생하지 않는다.
- cost report가 생성된다.
- LLM 입력 후보 수가 8~12개로 제한된다.
- quality retry가 전체 재생성이 아니라 section repair로 동작한다.
- Camera HAL 관련 main article이 우선 선정된다.
- AI/C++ 기사는 가능한 경우 보완 기사로 포함된다.
- 1회 생성 예상 비용이 기존 대비 유의미하게 감소한다.
```

---

## 12. 최종 판단

가장 먼저 할 일은 비용을 줄이는 코드 변경이 아니라 비용을 보이게 만드는 것이다.
그 다음 Pro fallback을 막고, LLM이 하기 전에 코드가 후보를 줄이게 만들면 된다.

핵심은 단순하다.

```text
비싼 LLM에게 많이 읽히지 말고,
코드가 먼저 고르고,
LLM은 적게 읽고 잘 쓰게 만든다.
```

이 구조로 바꾸면 품질을 낮추지 않고도 비용을 줄일 수 있다.
