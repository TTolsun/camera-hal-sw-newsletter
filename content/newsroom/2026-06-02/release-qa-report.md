# 릴리스 QA 보고서 - 2026-06-02

## 생성 파일 목록

- content/newsroom/2026-06-02/repair-failure.json
- content/newsroom/2026-06-02/reporter-candidates.json
- content/newsroom/2026-06-02/editor-draft.json
- content/newsroom/2026-06-02/editor-draft.md
- content/newsroom/2026-06-02/fact-check-report.json
- content/newsroom/2026-06-02/fact-check-report.md
- content/newsroom/2026-06-02/quality-report.json
- content/newsroom/2026-06-02/quality-report.md
- content/newsroom/2026-06-02/retry-history.json
- content/newsroom/2026-06-02/retry-history.md
- content/newsroom/2026-06-02/recovery-prompt.md
- content/newsroom/2026-06-02/generation-status.json
- content/newsroom/2026-06-02/00-review-guide.md
- content/newsroom/2026-06-02/release-qa-report.md
- content/newsroom/2026-06-02/artifact-manifest.json

## 산출물 리뷰 순서

- present: 59/81
- missing_required: 2
- attention_required: 4

### 편집장 브리프

- `content/newsroom/2026-06-02/00-review-guide.md` - changed
- `content/newsroom/2026-06-02/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `data/newsletters.json` - present
- `data/homepage-headline.json` - present
- `data/article-exposure-history.json` - present

### 사실성 / 품질 / HAL 게이트

- `content/newsroom/2026-06-02/fact-check-report.md` - changed
- `content/newsroom/2026-06-02/quality-report.md` - changed
- `content/newsroom/2026-06-02/hal-signal-quality-report.md` - missing required (required_artifact_missing)
- `content/newsroom/2026-06-02/source-quality-report.md` - present

### 후보 선정 진단

- `content/newsroom/2026-06-02/selection-diagnostics.md` - present
- `content/newsroom/2026-06-02/selection-report.md` - present

### 필요 시 확인

- `content/newsroom/2026-06-02/release-qa-report.md` - changed
- `content/newsroom/2026-06-02/retry-history.md` - changed
- `content/newsroom/2026-06-02/linked-evidence-diagnostics.md` - present
- `content/newsroom/2026-06-02/event-bundle-diagnostics.md` - present
- `content/newsroom/2026-06-02/source-discovery-feedback-report.md` - present
- `content/newsroom/2026-06-02/gemini-source-discovery-report.md` - present
- `content/newsroom/2026-06-02/news-candidates.md` - present

### 디버그 근거

- `content/newsroom/2026-06-02/recovery-prompt.md` - changed
- `content/collected-news/2026-06-02/manual-candidates.json` - present
- `content/collected-news/2026-06-02/candidates.json` - present
- `content/collected-news/2026-06-02/raw-candidate-manifest.json` - present
- `content/collected-news/2026-06-02/merged-candidates.json` - present
- `content/collected-news/2026-06-02/merged-candidate-manifest.json` - present
- `content/collected-news/2026-06-02/gemini-candidates.json` - present
- `content/newsroom/2026-06-02/generation-status.json` - changed
- `content/newsroom/2026-06-02/reporter-candidates.json` - changed
- `content/newsroom/2026-06-02/editor-draft.json` - changed
- `content/newsroom/2026-06-02/editor-draft.md` - changed
- `content/newsroom/2026-06-02/fact-check-report.json` - changed
- `content/newsroom/2026-06-02/quality-report.json` - changed
- `content/newsroom/2026-06-02/retry-history.json` - changed
- `content/newsroom/2026-06-02/shortlisted-candidates.json` - present
- `content/newsroom/2026-06-02/selection-report.json` - present
- `content/newsroom/2026-06-02/linked-evidence-report.json` - present
- `content/newsroom/2026-06-02/event-bundles.json` - present
- `content/newsroom/2026-06-02/article-capsules.json` - present
- `content/newsroom/2026-06-02/background-context.json` - present
- `content/newsroom/2026-06-02/source-quality-report.json` - present
- `content/newsroom/2026-06-02/source-discovery-feedback-report.json` - present
- `content/newsroom/2026-06-02/source-clusters.json` - present
- `content/newsroom/2026-06-02/gemini-source-proposals.json` - present
- `content/newsroom/2026-06-02/gemini-source-proposal-validation-report.json` - present
- `content/newsroom/2026-06-02/gemini-usage-report.json` - present
- `content/newsroom/2026-06-02/extracted-source-facts.json` - present
- `content/newsroom/2026-06-02/evidence-validation-report.json` - present
- `content/newsroom/2026-06-02/cost-report.md` - present
- `content/newsroom/2026-06-02/summary-cache-report.md` - present
- `content/newsroom/2026-06-02/summary-cache-report.json` - present
- `content/source-events/2026-06-02/source-change-events.md` - present
- `content/source-events/2026-06-02/source-change-events.json` - present
- `content/newsroom/2026-06-02/editor-draft-attempt-1.json` - present
- `content/newsroom/2026-06-02/editor-draft-attempt-1.md` - present
- `content/newsroom/2026-06-02/editor-public-article-judge-attempt-1.json` - present
- `content/newsroom/2026-06-02/fact-check-report-attempt-1.json` - present
- `content/newsroom/2026-06-02/fact-check-report-attempt-1.md` - present
- `content/newsroom/2026-06-02/quality-report-attempt-1.json` - present
- `content/newsroom/2026-06-02/quality-report-attempt-1.md` - present
- `content/newsroom/2026-06-02/reporter-candidates-attempt-1.json` - present
- `content/newsroom/2026-06-02/artifact-manifest.json` - changed

### 미분류 산출물

- `content/newsroom/2026-06-02/repair-failure.json` - changed


## npm run validate 실행 결과

FAILED_REPAIR_REVIEWABLE: skipped public validation because repair failed after a valid editor draft.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: PASS
- must_fix 개수: 0
- source gap 개수: 0

## 품질 게이트
- 품질 점수: 65/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 8pt source-integrity (Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화); 8pt claim-evidence (Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화); 8pt claim-evidence (Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화)
