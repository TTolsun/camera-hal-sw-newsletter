# 릴리스 QA 보고서 - 2026-05-29

## 생성 파일 목록

- content/newsroom/2026-05-29/repair-failure.json
- content/newsroom/2026-05-29/reporter-candidates.json
- content/newsroom/2026-05-29/editor-draft.json
- content/newsroom/2026-05-29/editor-draft.md
- content/newsroom/2026-05-29/fact-check-report.json
- content/newsroom/2026-05-29/fact-check-report.md
- content/newsroom/2026-05-29/quality-report.json
- content/newsroom/2026-05-29/quality-report.md
- content/newsroom/2026-05-29/retry-history.json
- content/newsroom/2026-05-29/retry-history.md
- content/newsroom/2026-05-29/recovery-prompt.md
- content/newsroom/2026-05-29/generation-status.json
- content/newsroom/2026-05-29/00-review-guide.md
- content/newsroom/2026-05-29/release-qa-report.md
- content/newsroom/2026-05-29/artifact-manifest.json

## 산출물 리뷰 순서

- present: 48/83
- missing_required: 2
- attention_required: 6

### 편집장 브리프

- `content/newsroom/2026-05-29/00-review-guide.md` - changed
- `content/newsroom/2026-05-29/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `data/newsletters.json` - present
- `data/homepage-headline.json` - present
- `data/article-exposure-history.json` - present

### 사실성 / 품질 / HAL 게이트

- `content/newsroom/2026-05-29/fact-check-report.md` - changed
- `content/newsroom/2026-05-29/quality-report.md` - changed
- `content/newsroom/2026-05-29/hal-signal-quality-report.md` - missing required (required_artifact_missing)

### 후보 선정 진단

- `content/newsroom/2026-05-29/selection-diagnostics.md` - present
- `content/newsroom/2026-05-29/selection-report.md` - present

### 필요 시 확인

- `content/newsroom/2026-05-29/recovery-prompt.md` - changed
- `content/newsroom/2026-05-29/release-qa-report.md` - changed
- `content/newsroom/2026-05-29/retry-history.md` - changed
- `content/newsroom/2026-05-29/linked-evidence-diagnostics.md` - present
- `content/newsroom/2026-05-29/event-bundle-diagnostics.md` - present

### 디버그 근거

- `content/collected-news/2026-05-29/manual-candidates.json` - present
- `content/collected-news/2026-05-29/candidates.json` - present
- `content/collected-news/2026-05-29/raw-candidate-manifest.json` - present
- `content/newsroom/2026-05-29/generation-status.json` - changed
- `content/newsroom/2026-05-29/reporter-candidates.json` - changed
- `content/newsroom/2026-05-29/editor-draft.json` - changed
- `content/newsroom/2026-05-29/editor-draft.md` - changed
- `content/newsroom/2026-05-29/fact-check-report.json` - changed
- `content/newsroom/2026-05-29/quality-report.json` - changed
- `content/newsroom/2026-05-29/retry-history.json` - changed
- `content/newsroom/2026-05-29/shortlisted-candidates.json` - present
- `content/newsroom/2026-05-29/selection-report.json` - present
- `content/newsroom/2026-05-29/linked-evidence-report.json` - present
- `content/newsroom/2026-05-29/event-bundles.json` - present
- `content/newsroom/2026-05-29/article-capsules.json` - present
- `content/newsroom/2026-05-29/background-context.json` - present
- `content/newsroom/2026-05-29/evidence-pack-summary.json` - present
- `content/newsroom/2026-05-29/cost-report.md` - present
- `content/newsroom/2026-05-29/summary-cache-report.md` - present
- `content/newsroom/2026-05-29/summary-cache-report.json` - present
- `content/source-events/2026-05-29/source-change-events.md` - present
- `content/source-events/2026-05-29/source-change-events.json` - present
- `content/newsroom/2026-05-29/editor-draft-attempt-1.json` - present
- `content/newsroom/2026-05-29/editor-draft-attempt-1.md` - present
- `content/newsroom/2026-05-29/editor-invalid-attempt-1.json` - present
- `content/newsroom/2026-05-29/editor-validation-error-attempt-1.json` - present
- `content/newsroom/2026-05-29/fact-check-report-attempt-1.json` - present
- `content/newsroom/2026-05-29/fact-check-report-attempt-1.md` - present
- `content/newsroom/2026-05-29/quality-report-attempt-1.json` - present
- `content/newsroom/2026-05-29/quality-report-attempt-1.md` - present
- `content/newsroom/2026-05-29/reporter-candidates-attempt-1.json` - present
- `content/newsroom/2026-05-29/artifact-manifest.json` - changed

### 미분류 산출물

- `content/newsroom/2026-05-29/editor-public-article-judge-attempt-1.json` - present
- `content/newsroom/2026-05-29/news-candidates.md` - present
- `content/newsroom/2026-05-29/repair-failure.json` - changed


## npm run validate 실행 결과

FAILED_REPAIR_REVIEWABLE: skipped public validation because repair failed after a valid editor draft.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 8
- source gap 개수: 0

## 품질 게이트
- 품질 점수: 33/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 8pt source-integrity (Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화); 8pt claim-evidence (Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화); 8pt claim-evidence (Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화)
