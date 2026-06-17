# 릴리스 QA 보고서 - 2026-06-17

## 생성 파일 목록

- articles/content/newsroom/2026-06-17/repair-failure.json
- articles/content/newsroom/2026-06-17/reporter-candidates.json
- articles/content/newsroom/2026-06-17/editor-draft.json
- articles/content/newsroom/2026-06-17/editor-draft.md
- articles/content/newsroom/2026-06-17/fact-check-report.json
- articles/content/newsroom/2026-06-17/fact-check-report.md
- articles/content/newsroom/2026-06-17/quality-report.json
- articles/content/newsroom/2026-06-17/quality-report.md
- articles/content/newsroom/2026-06-17/retry-history.json
- articles/content/newsroom/2026-06-17/retry-history.md
- articles/content/newsroom/2026-06-17/recovery-prompt.md
- articles/content/newsroom/2026-06-17/generation-status.json
- articles/content/newsroom/2026-06-17/00-review-guide.md
- articles/content/newsroom/2026-06-17/release-qa-report.md
- articles/content/newsroom/2026-06-17/artifact-manifest.json

## 산출물 리뷰 순서

- present: 63/95
- missing_required: 2
- attention_required: 5

### 편집장 브리프

- `articles/content/newsroom/2026-06-17/00-review-guide.md` - changed
- `articles/content/newsroom/2026-06-17/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `articles/data/newsletters.json` - present
- `articles/data/homepage-headline.json` - present
- `state/article-exposure-history.json` - present
- `articles/data/newsletters-weekly.json` - present
- `articles/sitemap.xml` - present

### 사실성 / 품질 / HAL 게이트

- `articles/content/newsroom/2026-06-17/fact-check-report.md` - changed
- `articles/content/newsroom/2026-06-17/quality-report.md` - changed
- `articles/content/newsroom/2026-06-17/hal-signal-quality-report.md` - missing required (required_artifact_missing)
- `articles/content/newsroom/2026-06-17/source-quality-report.md` - present

### 후보 선정 진단

- `articles/content/newsroom/2026-06-17/selection-diagnostics.md` - present
- `articles/content/newsroom/2026-06-17/selection-report.md` - present

### 필요 시 확인

- `articles/content/newsroom/2026-06-17/release-qa-report.md` - changed
- `articles/content/newsroom/2026-06-17/retry-history.md` - changed
- `articles/content/newsroom/2026-06-17/source-discovery-feedback-report.md` - present
- `articles/content/newsroom/2026-06-17/gemini-source-discovery-report.md` - present

### 디버그 근거

- `articles/content/newsroom/2026-06-17/recovery-prompt.md` - changed
- `articles/content/collected-news/2026-06-17/manual-candidates.json` - present
- `articles/content/collected-news/2026-06-17/candidates.json` - present
- `articles/content/collected-news/2026-06-17/raw-candidate-manifest.json` - present
- `articles/content/collected-news/2026-06-17/merged-candidates.json` - present
- `articles/content/collected-news/2026-06-17/merged-candidate-manifest.json` - present
- `articles/content/newsroom/2026-06-17/generation-status.json` - changed
- `articles/content/newsroom/2026-06-17/reporter-candidates.json` - changed
- `articles/content/newsroom/2026-06-17/editor-draft.json` - changed
- `articles/content/newsroom/2026-06-17/editor-draft.md` - changed
- `articles/content/newsroom/2026-06-17/fact-check-report.json` - changed
- `articles/content/newsroom/2026-06-17/quality-report.json` - changed
- `articles/content/newsroom/2026-06-17/retry-history.json` - changed
- `articles/content/newsroom/2026-06-17/shortlisted-candidates.json` - present
- `articles/content/newsroom/2026-06-17/selection-report.json` - present
- `articles/content/newsroom/2026-06-17/article-capsules.json` - present
- `articles/content/newsroom/2026-06-17/background-context.json` - present
- `articles/content/newsroom/2026-06-17/source-quality-report.json` - present
- `articles/content/newsroom/2026-06-17/source-discovery-feedback-report.json` - present
- `articles/content/newsroom/2026-06-17/source-clusters.json` - present
- `articles/content/newsroom/2026-06-17/gemini-source-proposals.json` - present
- `articles/content/newsroom/2026-06-17/gemini-source-proposal-validation-report.json` - present
- `articles/content/newsroom/2026-06-17/gemini-usage-report.json` - present
- `articles/content/newsroom/2026-06-17/extracted-source-facts.json` - present
- `articles/content/newsroom/2026-06-17/evidence-validation-report.json` - present
- `articles/content/newsroom/2026-06-17/cost-report.md` - present
- `articles/content/newsroom/2026-06-17/summary-cache-report.md` - present
- `articles/content/newsroom/2026-06-17/summary-cache-report.json` - present
- `articles/content/source-events/2026-06-17/source-change-events.md` - present
- `articles/content/source-events/2026-06-17/source-change-events.json` - present
- `articles/content/newsroom/2026-06-17/editor-draft-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/editor-draft-attempt-1.md` - present
- `articles/content/newsroom/2026-06-17/editor-public-article-judge-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/editor-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/editor-repair-attempt-1.md` - present
- `articles/content/newsroom/2026-06-17/editor-repair-sections-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/fact-check-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/fact-check-repair-attempt-1.md` - present
- `articles/content/newsroom/2026-06-17/fact-check-report-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/fact-check-report-attempt-1.md` - present
- `articles/content/newsroom/2026-06-17/quality-report-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/quality-report-attempt-1.md` - present
- `articles/content/newsroom/2026-06-17/quality-report-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/quality-report-repair-attempt-1.md` - present
- `articles/content/newsroom/2026-06-17/reporter-candidates-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/artifact-manifest.json` - changed

### 미분류 산출물

- `articles/content/newsroom/2026-06-17/editor-public-article-judge-targeted-repair-attempt-1.json` - present
- `articles/content/newsroom/2026-06-17/repair-failure.json` - changed


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
- 품질 점수: 71/100
- 품질 기준: 60
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 2pt linked-evidence-limitation (CameraX 1.6.1 릴리스: ListenableFuture 컴파일 에러 수정 및 기기별 카메라 오동작 해결); 1pt image-fallback (CameraX 1.6.1 릴리스: ListenableFuture 컴파일 에러 수정 및 기기별 카메라 오동작 해결); 8pt source-integrity (Camera_ITS_문서_업데이트:_Honor_Pad_20_태블릿_허용_목록_추가_및_장면_실행_지침_재정렬)
