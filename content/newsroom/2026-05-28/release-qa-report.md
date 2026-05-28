# 릴리스 QA 보고서 - 2026-05-28

## 생성 파일 목록

- content/newsroom/2026-05-28/repair-failure.json
- content/newsroom/2026-05-28/reporter-candidates.json
- content/newsroom/2026-05-28/editor-draft.json
- content/newsroom/2026-05-28/editor-draft.md
- content/newsroom/2026-05-28/fact-check-report.json
- content/newsroom/2026-05-28/fact-check-report.md
- content/newsroom/2026-05-28/quality-report.json
- content/newsroom/2026-05-28/quality-report.md
- content/newsroom/2026-05-28/retry-history.json
- content/newsroom/2026-05-28/retry-history.md
- content/newsroom/2026-05-28/recovery-prompt.md
- content/newsroom/2026-05-28/generation-status.json
- content/newsroom/2026-05-28/00-review-guide.md
- content/newsroom/2026-05-28/release-qa-report.md
- content/newsroom/2026-05-28/artifact-manifest.json

## 산출물 리뷰 순서

- present: 70/83
- missing_required: 1
- attention_required: 5

### 편집장 브리프

- `content/newsroom/2026-05-28/00-review-guide.md` - changed
- `content/newsroom/2026-05-28/editor-in-chief-brief.md` - missing required (required_artifact_missing)

### 최종 기사 / 공개 출력

- `data/newsletters.json` - present
- `data/homepage-headline.json` - present
- `data/article-exposure-history.json` - present

### 사실성 / 품질 / HAL 게이트

- `content/newsroom/2026-05-28/fact-check-report.md` - changed
- `content/newsroom/2026-05-28/quality-report.md` - changed
- `content/newsroom/2026-05-28/hal-signal-quality-report.md` - present
- `content/newsroom/2026-05-28/image-audit-report.md` - present
- `content/newsroom/2026-05-28/source-quality-report.md` - present

### 후보 선정 진단

- `content/newsroom/2026-05-28/selection-diagnostics.md` - present
- `content/newsroom/2026-05-28/selection-report.md` - present
- `content/newsroom/2026-05-28/source-quality-diagnosis.md` - present

### 필요 시 확인

- `content/newsroom/2026-05-28/recovery-prompt.md` - changed
- `content/newsroom/2026-05-28/release-qa-report.md` - changed
- `content/newsroom/2026-05-28/retry-history.md` - changed
- `content/newsroom/2026-05-28/linked-evidence-diagnostics.md` - present
- `content/newsroom/2026-05-28/event-bundle-diagnostics.md` - present
- `content/newsroom/2026-05-28/source-effectiveness-report.md` - present
- `content/newsroom/2026-05-28/source-discovery-feedback-report.md` - present
- `content/newsroom/2026-05-28/gemini-source-discovery-report.md` - present

### 디버그 근거

- `content/collected-news/2026-05-28/manual-candidates.json` - present
- `content/collected-news/2026-05-28/candidates.json` - present
- `content/collected-news/2026-05-28/raw-candidate-manifest.json` - present
- `content/collected-news/2026-05-28/merged-candidates.json` - present
- `content/collected-news/2026-05-28/merged-candidate-manifest.json` - present
- `content/collected-news/2026-05-28/gemini-candidates.json` - present
- `content/newsroom/2026-05-28/generation-status.json` - changed
- `content/newsroom/2026-05-28/reporter-candidates.json` - changed
- `content/newsroom/2026-05-28/editor-draft.json` - changed
- `content/newsroom/2026-05-28/editor-draft.md` - changed
- `content/newsroom/2026-05-28/fact-check-report.json` - changed
- `content/newsroom/2026-05-28/quality-report.json` - changed
- `content/newsroom/2026-05-28/hal-signal-quality-report.json` - present
- `content/newsroom/2026-05-28/retry-history.json` - changed
- `content/newsroom/2026-05-28/shortlisted-candidates.json` - present
- `content/newsroom/2026-05-28/selection-report.json` - present
- `content/newsroom/2026-05-28/linked-evidence-report.json` - present
- `content/newsroom/2026-05-28/event-bundles.json` - present
- `content/newsroom/2026-05-28/article-capsules.json` - present
- `content/newsroom/2026-05-28/background-context.json` - present
- `content/newsroom/2026-05-28/evidence-pack-summary.json` - present
- `content/newsroom/2026-05-28/image-audit-report.json` - present
- `content/newsroom/2026-05-28/source-quality-report.json` - present
- `content/newsroom/2026-05-28/source-quality-diagnosis.json` - present
- `content/newsroom/2026-05-28/source-effectiveness-report.json` - present
- `content/newsroom/2026-05-28/source-discovery-feedback-report.json` - present
- `content/newsroom/2026-05-28/source-clusters.json` - present
- `content/newsroom/2026-05-28/gemini-source-proposals.json` - present
- `content/newsroom/2026-05-28/gemini-source-proposal-validation-report.json` - present
- `content/newsroom/2026-05-28/gemini-usage-report.json` - present
- `content/newsroom/2026-05-28/extracted-source-facts.json` - present
- `content/newsroom/2026-05-28/evidence-validation-report.json` - present
- `content/newsroom/2026-05-28/cost-report.md` - present
- `content/newsroom/2026-05-28/summary-cache-report.md` - present
- `content/newsroom/2026-05-28/summary-cache-report.json` - present
- `content/source-events/2026-05-28/source-change-events.md` - present
- `content/source-events/2026-05-28/source-change-events.json` - present
- `content/newsroom/2026-05-28/editor-draft-attempt-1.json` - present
- `content/newsroom/2026-05-28/editor-draft-attempt-1.md` - present
- `content/newsroom/2026-05-28/editor-invalid-attempt-1.json` - present
- `content/newsroom/2026-05-28/editor-validation-error-attempt-1.json` - present
- `content/newsroom/2026-05-28/fact-check-report-attempt-1.json` - present
- `content/newsroom/2026-05-28/fact-check-report-attempt-1.md` - present
- `content/newsroom/2026-05-28/quality-report-attempt-1.json` - present
- `content/newsroom/2026-05-28/quality-report-attempt-1.md` - present
- `content/newsroom/2026-05-28/reporter-candidates-attempt-1.json` - present
- `content/newsroom/2026-05-28/artifact-manifest.json` - changed

### 미분류 산출물

- `content/newsroom/2026-05-28/editor-public-article-judge-attempt-1.json` - present
- `content/newsroom/2026-05-28/news-candidates.md` - present
- `content/newsroom/2026-05-28/repair-failure.json` - changed


## npm run validate 실행 결과

FAILED_REPAIR_REVIEWABLE: skipped public validation because repair failed after a valid editor draft.

## 잔여 TODO 여부

없음

## 출처 누락 여부

없음

## Gemini 검증 결과

- 상태: NEEDS_FIX
- must_fix 개수: 16
- source gap 개수: 0

## 품질 게이트
- 품질 점수: 81/100
- 품질 기준: 85
- 품질 상태: NEEDS_FIX
- 주요 감점: 1pt editorial-story (briefing 1); 1pt editorial-story (briefing 2); 1pt image-fallback (Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화); 1pt image-fallback (Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원); 15pt source-integrity
