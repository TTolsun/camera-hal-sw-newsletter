# 릴리스 QA 보고서 - 2026-06-15

## 생성 파일 목록

- articles/content/newsroom/2026-06-15/repair-failure.json
- articles/content/newsroom/2026-06-15/reporter-candidates.json
- articles/content/newsroom/2026-06-15/editor-draft.json
- articles/content/newsroom/2026-06-15/editor-draft.md
- articles/content/newsroom/2026-06-15/fact-check-report.json
- articles/content/newsroom/2026-06-15/fact-check-report.md
- articles/content/newsroom/2026-06-15/quality-report.json
- articles/content/newsroom/2026-06-15/quality-report.md
- articles/content/newsroom/2026-06-15/retry-history.json
- articles/content/newsroom/2026-06-15/retry-history.md
- articles/content/newsroom/2026-06-15/recovery-prompt.md
- articles/content/newsroom/2026-06-15/generation-status.json
- articles/content/newsroom/2026-06-15/00-review-guide.md
- articles/content/newsroom/2026-06-15/release-qa-report.md
- articles/content/newsroom/2026-06-15/artifact-manifest.json

## 산출물 리뷰 순서

- present: 62/94
- missing_required: 2
- attention_required: 4

### 편집장 브리프

- `articles/content/newsroom/2026-06-15/00-review-guide.md` - changed
- `articles/content/newsroom/2026-06-15/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `articles/data/newsletters.json` - present
- `articles/data/homepage-headline.json` - present
- `state/article-exposure-history.json` - present
- `articles/data/newsletters-weekly.json` - present
- `articles/sitemap.xml` - present

### 사실성 / 품질 / HAL 게이트

- `articles/content/newsroom/2026-06-15/fact-check-report.md` - changed
- `articles/content/newsroom/2026-06-15/quality-report.md` - changed
- `articles/content/newsroom/2026-06-15/hal-signal-quality-report.md` - missing required (required_artifact_missing)
- `articles/content/newsroom/2026-06-15/source-quality-report.md` - present

### 후보 선정 진단

- `articles/content/newsroom/2026-06-15/selection-diagnostics.md` - present
- `articles/content/newsroom/2026-06-15/selection-report.md` - present

### 필요 시 확인

- `articles/content/newsroom/2026-06-15/release-qa-report.md` - changed
- `articles/content/newsroom/2026-06-15/retry-history.md` - changed
- `articles/content/newsroom/2026-06-15/source-discovery-feedback-report.md` - present
- `articles/content/newsroom/2026-06-15/gemini-source-discovery-report.md` - present

### 디버그 근거

- `articles/content/newsroom/2026-06-15/recovery-prompt.md` - changed
- `articles/content/collected-news/2026-06-15/manual-candidates.json` - present
- `articles/content/collected-news/2026-06-15/candidates.json` - present
- `articles/content/collected-news/2026-06-15/raw-candidate-manifest.json` - present
- `articles/content/collected-news/2026-06-15/merged-candidates.json` - present
- `articles/content/collected-news/2026-06-15/merged-candidate-manifest.json` - present
- `articles/content/newsroom/2026-06-15/generation-status.json` - changed
- `articles/content/newsroom/2026-06-15/reporter-candidates.json` - changed
- `articles/content/newsroom/2026-06-15/editor-draft.json` - changed
- `articles/content/newsroom/2026-06-15/editor-draft.md` - changed
- `articles/content/newsroom/2026-06-15/fact-check-report.json` - changed
- `articles/content/newsroom/2026-06-15/quality-report.json` - changed
- `articles/content/newsroom/2026-06-15/retry-history.json` - changed
- `articles/content/newsroom/2026-06-15/shortlisted-candidates.json` - present
- `articles/content/newsroom/2026-06-15/selection-report.json` - present
- `articles/content/newsroom/2026-06-15/article-capsules.json` - present
- `articles/content/newsroom/2026-06-15/background-context.json` - present
- `articles/content/newsroom/2026-06-15/source-quality-report.json` - present
- `articles/content/newsroom/2026-06-15/source-discovery-feedback-report.json` - present
- `articles/content/newsroom/2026-06-15/source-clusters.json` - present
- `articles/content/newsroom/2026-06-15/gemini-source-proposals.json` - present
- `articles/content/newsroom/2026-06-15/gemini-source-proposal-validation-report.json` - present
- `articles/content/newsroom/2026-06-15/gemini-usage-report.json` - present
- `articles/content/newsroom/2026-06-15/extracted-source-facts.json` - present
- `articles/content/newsroom/2026-06-15/evidence-validation-report.json` - present
- `articles/content/newsroom/2026-06-15/cost-report.md` - present
- `articles/content/newsroom/2026-06-15/summary-cache-report.md` - present
- `articles/content/newsroom/2026-06-15/summary-cache-report.json` - present
- `articles/content/source-events/2026-06-15/source-change-events.md` - present
- `articles/content/source-events/2026-06-15/source-change-events.json` - present
- `articles/content/newsroom/2026-06-15/editor-draft-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/editor-draft-attempt-1.md` - present
- `articles/content/newsroom/2026-06-15/editor-invalid-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/editor-invalid-attempt-2.json` - present
- `articles/content/newsroom/2026-06-15/editor-invalid-repair-attempt-2.json` - present
- `articles/content/newsroom/2026-06-15/editor-public-article-judge-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/editor-validation-error-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/editor-validation-error-attempt-2.json` - present
- `articles/content/newsroom/2026-06-15/editor-validation-error-repair-attempt-2.json` - present
- `articles/content/newsroom/2026-06-15/fact-check-report-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/fact-check-report-attempt-1.md` - present
- `articles/content/newsroom/2026-06-15/quality-report-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/quality-report-attempt-1.md` - present
- `articles/content/newsroom/2026-06-15/reporter-candidates-attempt-1.json` - present
- `articles/content/newsroom/2026-06-15/reporter-candidates-attempt-2.json` - present
- `articles/content/newsroom/2026-06-15/artifact-manifest.json` - changed

### 미분류 산출물

- `articles/content/newsroom/2026-06-15/repair-failure.json` - changed


## npm run validate 실행 결과

FAILED_REPAIR_REVIEWABLE: skipped public validation because repair failed after a valid editor draft.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 3
- source gap 개수: 0

## 품질 게이트
- 품질 점수: 82/100
- 품질 기준: 60
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 1pt editorial-story (briefing 3); 15pt source-integrity
