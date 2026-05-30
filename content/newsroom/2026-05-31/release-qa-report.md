# 릴리스 QA 보고서 - 2026-05-31

## 생성 파일 목록

- content/newsroom/2026-05-31/repair-failure.json
- content/newsroom/2026-05-31/reporter-candidates.json
- content/newsroom/2026-05-31/editor-draft.json
- content/newsroom/2026-05-31/editor-draft.md
- content/newsroom/2026-05-31/fact-check-report.json
- content/newsroom/2026-05-31/fact-check-report.md
- content/newsroom/2026-05-31/quality-report.json
- content/newsroom/2026-05-31/quality-report.md
- content/newsroom/2026-05-31/retry-history.json
- content/newsroom/2026-05-31/retry-history.md
- content/newsroom/2026-05-31/recovery-prompt.md
- content/newsroom/2026-05-31/generation-status.json
- content/newsroom/2026-05-31/00-review-guide.md
- content/newsroom/2026-05-31/release-qa-report.md
- content/newsroom/2026-05-31/artifact-manifest.json

## 산출물 리뷰 순서

- present: 59/83
- missing_required: 2
- attention_required: 4

### 편집장 브리프

- `content/newsroom/2026-05-31/00-review-guide.md` - changed
- `content/newsroom/2026-05-31/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `data/newsletters.json` - present
- `data/homepage-headline.json` - present
- `data/article-exposure-history.json` - present

### 사실성 / 품질 / HAL 게이트

- `content/newsroom/2026-05-31/fact-check-report.md` - changed
- `content/newsroom/2026-05-31/quality-report.md` - changed
- `content/newsroom/2026-05-31/hal-signal-quality-report.md` - missing required (required_artifact_missing)
- `content/newsroom/2026-05-31/source-quality-report.md` - present

### 후보 선정 진단

- `content/newsroom/2026-05-31/selection-diagnostics.md` - present
- `content/newsroom/2026-05-31/selection-report.md` - present

### 필요 시 확인

- `content/newsroom/2026-05-31/release-qa-report.md` - changed
- `content/newsroom/2026-05-31/retry-history.md` - changed
- `content/newsroom/2026-05-31/linked-evidence-diagnostics.md` - present
- `content/newsroom/2026-05-31/event-bundle-diagnostics.md` - present
- `content/newsroom/2026-05-31/source-discovery-feedback-report.md` - present
- `content/newsroom/2026-05-31/gemini-source-discovery-report.md` - present
- `content/newsroom/2026-05-31/news-candidates.md` - present

### 디버그 근거

- `content/newsroom/2026-05-31/recovery-prompt.md` - changed
- `content/collected-news/2026-05-31/manual-candidates.json` - present
- `content/collected-news/2026-05-31/candidates.json` - present
- `content/collected-news/2026-05-31/raw-candidate-manifest.json` - present
- `content/collected-news/2026-05-31/merged-candidates.json` - present
- `content/collected-news/2026-05-31/merged-candidate-manifest.json` - present
- `content/newsroom/2026-05-31/generation-status.json` - changed
- `content/newsroom/2026-05-31/reporter-candidates.json` - changed
- `content/newsroom/2026-05-31/editor-draft.json` - changed
- `content/newsroom/2026-05-31/editor-draft.md` - changed
- `content/newsroom/2026-05-31/fact-check-report.json` - changed
- `content/newsroom/2026-05-31/quality-report.json` - changed
- `content/newsroom/2026-05-31/retry-history.json` - changed
- `content/newsroom/2026-05-31/shortlisted-candidates.json` - present
- `content/newsroom/2026-05-31/selection-report.json` - present
- `content/newsroom/2026-05-31/article-capsules.json` - present
- `content/newsroom/2026-05-31/background-context.json` - present
- `content/newsroom/2026-05-31/evidence-pack-summary.json` - present
- `content/newsroom/2026-05-31/source-quality-report.json` - present
- `content/newsroom/2026-05-31/source-discovery-feedback-report.json` - present
- `content/newsroom/2026-05-31/source-clusters.json` - present
- `content/newsroom/2026-05-31/gemini-source-proposals.json` - present
- `content/newsroom/2026-05-31/gemini-source-proposal-validation-report.json` - present
- `content/newsroom/2026-05-31/gemini-usage-report.json` - present
- `content/newsroom/2026-05-31/extracted-source-facts.json` - present
- `content/newsroom/2026-05-31/evidence-validation-report.json` - present
- `content/newsroom/2026-05-31/cost-report.md` - present
- `content/newsroom/2026-05-31/summary-cache-report.md` - present
- `content/newsroom/2026-05-31/summary-cache-report.json` - present
- `content/source-events/2026-05-31/source-change-events.md` - present
- `content/source-events/2026-05-31/source-change-events.json` - present
- `content/newsroom/2026-05-31/editor-draft-attempt-1.json` - present
- `content/newsroom/2026-05-31/editor-draft-attempt-1.md` - present
- `content/newsroom/2026-05-31/editor-invalid-attempt-1.json` - present
- `content/newsroom/2026-05-31/editor-public-article-judge-attempt-1.json` - present
- `content/newsroom/2026-05-31/editor-validation-error-attempt-1.json` - present
- `content/newsroom/2026-05-31/fact-check-report-attempt-1.json` - present
- `content/newsroom/2026-05-31/fact-check-report-attempt-1.md` - present
- `content/newsroom/2026-05-31/quality-report-attempt-1.json` - present
- `content/newsroom/2026-05-31/quality-report-attempt-1.md` - present
- `content/newsroom/2026-05-31/reporter-candidates-attempt-1.json` - present
- `content/newsroom/2026-05-31/artifact-manifest.json` - changed

### 미분류 산출물

- `content/newsroom/2026-05-31/repair-failure.json` - changed


## npm run validate 실행 결과

FAILED_REPAIR_REVIEWABLE: skipped public validation because repair failed after a valid editor draft.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 12
- source gap 개수: 0

## 품질 게이트
- 품질 점수: 79/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 4pt actionability (Google AI Studio: 프롬프트 기반 네이티브 Android 앱 신속 빌드 지원); 15pt source-integrity
