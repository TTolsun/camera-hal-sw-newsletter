# 산출물 리뷰 가이드 - 2026-06-14

## 요약

- seed_used: false
- public_output_expected: false
- status: NEEDS_FIX
- present: 63/89
- missing_required: 1
- attention_required: 3

## 읽는 순서

1. 편집장 브리프
2. Seed 근거 요약
3. 최종 기사 / 공개 출력
4. 사실성 / 품질 / HAL 게이트
5. 후보 선정 진단
6. 필요 시 확인
7. 디버그 근거
8. 미분류 산출물

## 편집장 브리프

- `articles/content/newsroom/2026-06-14/00-review-guide.md` - changed
- `articles/content/newsroom/2026-06-14/editor-in-chief-brief.md` - changed

## 최종 기사 / 공개 출력

- `articles/data/newsletters.json` - present
- `articles/data/homepage-headline.json` - present
- `articles/newsletters/2026-W24/index.html` - present
- `articles/newsletters/2026-W24/newsletter.md` - present
- `state/article-exposure-history.json` - present
- `articles/newsletters/2026-W24/issue.json` - present
- `articles/data/newsletters-weekly.json` - present
- `articles/sitemap.xml` - present

## 사실성 / 품질 / HAL 게이트

- `articles/content/newsroom/2026-06-14/fact-check-report.md` - changed
- `articles/content/newsroom/2026-06-14/quality-report.md` - changed
- `articles/content/newsroom/2026-06-14/hal-signal-quality-report.md` - missing required (required_artifact_missing)
- `articles/content/newsroom/2026-06-14/stale-claim-report.md` - changed
- `articles/content/newsroom/2026-06-14/source-quality-report.md` - present

## 후보 선정 진단

- `articles/content/newsroom/2026-06-14/selection-diagnostics.md` - present
- `articles/content/newsroom/2026-06-14/selection-report.md` - present

## 필요 시 확인

- `articles/content/newsroom/2026-06-14/release-qa-report.md` - changed
- `articles/content/newsroom/2026-06-14/retry-history.md` - changed
- `articles/content/newsroom/2026-06-14/source-discovery-feedback-report.md` - present
- `articles/content/newsroom/2026-06-14/gemini-source-discovery-report.md` - present

## 디버그 근거

- `articles/content/newsroom/2026-06-14/recovery-prompt.md` - changed
- `articles/content/collected-news/2026-06-14/manual-candidates.json` - present
- `articles/content/collected-news/2026-06-14/candidates.json` - present
- `articles/content/collected-news/2026-06-14/raw-candidate-manifest.json` - present
- `articles/content/collected-news/2026-06-14/merged-candidates.json` - changed
- `articles/content/collected-news/2026-06-14/merged-candidate-manifest.json` - changed
- `articles/content/newsroom/2026-06-14/generation-status.json` - present
- `articles/content/newsroom/2026-06-14/reporter-candidates.json` - changed
- `articles/content/newsroom/2026-06-14/editor-draft.json` - changed
- `articles/content/newsroom/2026-06-14/editor-draft.md` - changed
- `articles/content/newsroom/2026-06-14/fact-check-report.json` - changed
- `articles/content/newsroom/2026-06-14/quality-report.json` - changed
- `articles/content/newsroom/2026-06-14/stale-claim-report.json` - changed
- `articles/content/newsroom/2026-06-14/retry-history.json` - changed
- `articles/content/newsroom/2026-06-14/shortlisted-candidates.json` - changed
- `articles/content/newsroom/2026-06-14/selection-report.json` - present
- `articles/content/newsroom/2026-06-14/article-capsules.json` - changed
- `articles/content/newsroom/2026-06-14/background-context.json` - changed
- `articles/content/newsroom/2026-06-14/source-quality-report.json` - present
- `articles/content/newsroom/2026-06-14/source-discovery-feedback-report.json` - present
- `articles/content/newsroom/2026-06-14/source-clusters.json` - present
- `articles/content/newsroom/2026-06-14/gemini-source-proposals.json` - present
- `articles/content/newsroom/2026-06-14/gemini-source-proposal-validation-report.json` - present
- `articles/content/newsroom/2026-06-14/gemini-usage-report.json` - present
- `articles/content/newsroom/2026-06-14/extracted-source-facts.json` - present
- `articles/content/newsroom/2026-06-14/evidence-validation-report.json` - present
- `articles/content/newsroom/2026-06-14/cost-report.md` - changed
- `articles/content/newsroom/2026-06-14/summary-cache-report.md` - present
- `articles/content/newsroom/2026-06-14/summary-cache-report.json` - present
- `articles/content/source-events/2026-06-14/source-change-events.md` - present
- `articles/content/source-events/2026-06-14/source-change-events.json` - present
- `articles/content/newsroom/2026-06-14/editor-draft-attempt-1.json` - present
- `articles/content/newsroom/2026-06-14/editor-draft-attempt-1.md` - present
- `articles/content/newsroom/2026-06-14/editor-invalid-attempt-1.json` - present
- `articles/content/newsroom/2026-06-14/editor-public-article-judge-attempt-1.json` - changed
- `articles/content/newsroom/2026-06-14/editor-validation-error-attempt-1.json` - present
- `articles/content/newsroom/2026-06-14/fact-check-report-attempt-1.json` - present
- `articles/content/newsroom/2026-06-14/fact-check-report-attempt-1.md` - present
- `articles/content/newsroom/2026-06-14/quality-report-attempt-1.json` - present
- `articles/content/newsroom/2026-06-14/quality-report-attempt-1.md` - present
- `articles/content/newsroom/2026-06-14/reporter-candidates-attempt-1.json` - present
- `articles/content/newsroom/2026-06-14/artifact-manifest.json` - changed

## 미분류 산출물

- `articles/content/newsroom/2026-06-14/repair-failure.json` - present

## 누락된 필수 확인 산출물

- `articles/content/newsroom/2026-06-14/hal-signal-quality-report.md` - missing required (required_artifact_missing)

## 주의 필요

- `articles/content/newsroom/2026-06-14/hal-signal-quality-report.md`: required_artifact_missing - Required review artifact is missing for this run context.
