# 릴리스 QA 보고서 - 2026-09-28

## 생성 파일 목록

- articles/content/newsroom/2026-09-28/repair-failure.json
- articles/content/newsroom/2026-09-28/reporter-candidates.json
- articles/content/newsroom/2026-09-28/editor-draft.json
- articles/content/newsroom/2026-09-28/editor-draft.md
- articles/content/newsroom/2026-09-28/fact-check-report.json
- articles/content/newsroom/2026-09-28/fact-check-report.md
- articles/content/newsroom/2026-09-28/quality-report.json
- articles/content/newsroom/2026-09-28/quality-report.md
- articles/content/newsroom/2026-09-28/retry-history.json
- articles/content/newsroom/2026-09-28/retry-history.md
- articles/content/newsroom/2026-09-28/recovery-prompt.md
- articles/content/newsroom/2026-09-28/generation-status.json
- articles/content/newsroom/2026-09-28/00-review-guide.md
- articles/content/newsroom/2026-09-28/release-qa-report.md
- articles/content/newsroom/2026-09-28/artifact-manifest.json

## 산출물 리뷰 순서

- present: 75/108
- missing_required: 1
- attention_required: 7

### 편집장 브리프

- `articles/content/newsroom/2026-09-28/00-review-guide.md` - changed
- `articles/content/newsroom/2026-09-28/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `articles/data/newsletters.json` - present
- `articles/data/homepage-headline.json` - present
- `state/article-exposure-history.json` - present
- `articles/content/audit/historical-archive-status.json` - present
- `articles/content/audit/newsletter-provenance-ledger.md` - present
- `articles/data/newsletters-weekly.json` - present
- `articles/sitemap.xml` - present

### 사실성 / 품질 / HAL 게이트

- `articles/content/newsroom/2026-09-28/fact-check-report.md` - changed
- `articles/content/newsroom/2026-09-28/quality-report.md` - changed
- `articles/content/newsroom/2026-09-28/hal-signal-quality-report.md` - changed
- `articles/content/newsroom/2026-09-28/source-quality-report.md` - present

### 후보 선정 진단

- `articles/content/newsroom/2026-09-28/selection-diagnostics.md` - present
- `articles/content/newsroom/2026-09-28/selection-report.md` - present

### 필요 시 확인

- `articles/content/newsroom/2026-09-28/release-qa-report.md` - changed
- `articles/content/newsroom/2026-09-28/retry-history.md` - changed
- `articles/content/newsroom/2026-09-28/source-discovery-feedback-report.md` - present
- `articles/content/newsroom/2026-09-28/gemini-source-discovery-report.md` - present

### 디버그 근거

- `articles/content/newsroom/2026-09-28/recovery-prompt.md` - changed
- `articles/content/collected-news/2026-09-28/manual-candidates.json` - present
- `articles/content/collected-news/2026-09-28/candidates.json` - present
- `articles/content/collected-news/2026-09-28/raw-candidate-manifest.json` - present
- `articles/content/collected-news/2026-09-28/merged-candidates.json` - present
- `articles/content/collected-news/2026-09-28/merged-candidate-manifest.json` - present
- `articles/content/newsroom/2026-09-28/generation-status.json` - changed
- `articles/content/newsroom/2026-09-28/reporter-candidates.json` - changed
- `articles/content/newsroom/2026-09-28/editor-draft.json` - changed
- `articles/content/newsroom/2026-09-28/editor-draft.md` - changed
- `articles/content/newsroom/2026-09-28/fact-check-report.json` - changed
- `articles/content/newsroom/2026-09-28/quality-report.json` - changed
- `articles/content/newsroom/2026-09-28/hal-signal-quality-report.json` - changed
- `articles/content/newsroom/2026-09-28/retry-history.json` - changed
- `articles/content/newsroom/2026-09-28/shortlisted-candidates.json` - present
- `articles/content/newsroom/2026-09-28/selection-report.json` - present
- `articles/content/newsroom/2026-09-28/article-capsules.json` - present
- `articles/content/newsroom/2026-09-28/background-context.json` - present
- `articles/content/newsroom/2026-09-28/source-quality-report.json` - present
- `articles/content/newsroom/2026-09-28/source-discovery-feedback-report.json` - present
- `articles/content/newsroom/2026-09-28/source-clusters.json` - present
- `articles/content/newsroom/2026-09-28/gemini-source-proposals.json` - present
- `articles/content/newsroom/2026-09-28/gemini-source-proposal-validation-report.json` - present
- `articles/content/newsroom/2026-09-28/gemini-usage-report.json` - present
- `articles/content/newsroom/2026-09-28/extracted-source-facts.json` - present
- `articles/content/newsroom/2026-09-28/evidence-validation-report.json` - present
- `articles/content/newsroom/2026-09-28/cost-report.md` - present
- `articles/content/newsroom/2026-09-28/summary-cache-report.md` - present
- `articles/content/newsroom/2026-09-28/summary-cache-report.json` - present
- `articles/content/source-events/2026-09-28/source-change-events.md` - present
- `articles/content/source-events/2026-09-28/source-change-events.json` - present
- `articles/content/newsroom/2026-09-28/editor-draft-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/editor-draft-attempt-1.md` - present
- `articles/content/newsroom/2026-09-28/editor-invalid-attempt-2.json` - present
- `articles/content/newsroom/2026-09-28/editor-invalid-repair-attempt-2.json` - present
- `articles/content/newsroom/2026-09-28/editor-public-article-judge-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/editor-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/editor-repair-attempt-1.md` - present
- `articles/content/newsroom/2026-09-28/editor-repair-sections-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/editor-validation-error-attempt-2.json` - present
- `articles/content/newsroom/2026-09-28/editor-validation-error-repair-attempt-2.json` - present
- `articles/content/newsroom/2026-09-28/fact-check-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/fact-check-repair-attempt-1.md` - present
- `articles/content/newsroom/2026-09-28/fact-check-report-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/fact-check-report-attempt-1.md` - present
- `articles/content/newsroom/2026-09-28/quality-report-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/quality-report-attempt-1.md` - present
- `articles/content/newsroom/2026-09-28/quality-report-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/quality-report-repair-attempt-1.md` - present
- `articles/content/newsroom/2026-09-28/reporter-candidates-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/reporter-candidates-attempt-2.json` - present
- `articles/content/newsroom/2026-09-28/artifact-manifest.json` - changed

### 미분류 산출물

- `articles/content/newsroom/2026-09-28/coverage-reconciliation.json` - present
- `articles/content/newsroom/2026-09-28/editor-public-article-judge-targeted-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/editor-repair-patches-attempt-1.json` - present
- `articles/content/newsroom/2026-09-28/editorial-plan.json` - present
- `articles/content/newsroom/2026-09-28/repair-failure.json` - changed


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
- 품질 점수: 58/100
- 품질 기준: 60
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 1pt editorial-story (briefing 3); 2pt linked-evidence-limitation (CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결); 1pt image-fallback (CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결)
