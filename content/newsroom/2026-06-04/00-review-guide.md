# 산출물 리뷰 가이드 - 2026-06-04

## 요약

- seed_used: false
- public_output_expected: false
- status: QUALITY_NEEDS_FIX
- present: 56/81
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

- `content/newsroom/2026-06-04/00-review-guide.md` - changed
- `content/newsroom/2026-06-04/editor-in-chief-brief.md` - changed

## 최종 기사 / 공개 출력

- `data/newsletters.json` - present
- `data/homepage-headline.json` - present
- `data/article-exposure-history.json` - present

## 사실성 / 품질 / HAL 게이트

- `content/newsroom/2026-06-04/fact-check-report.md` - changed
- `content/newsroom/2026-06-04/quality-report.md` - changed
- `content/newsroom/2026-06-04/hal-signal-quality-report.md` - missing required (required_artifact_missing)
- `content/newsroom/2026-06-04/stale-claim-report.md` - changed
- `content/newsroom/2026-06-04/source-quality-report.md` - present

## 후보 선정 진단

- `content/newsroom/2026-06-04/selection-diagnostics.md` - present
- `content/newsroom/2026-06-04/selection-report.md` - present

## 필요 시 확인

- `content/newsroom/2026-06-04/release-qa-report.md` - changed
- `content/newsroom/2026-06-04/retry-history.md` - changed
- `content/newsroom/2026-06-04/source-discovery-feedback-report.md` - present
- `content/newsroom/2026-06-04/gemini-source-discovery-report.md` - present

## 디버그 근거

- `content/newsroom/2026-06-04/recovery-prompt.md` - changed
- `content/collected-news/2026-06-04/manual-candidates.json` - present
- `content/collected-news/2026-06-04/candidates.json` - present
- `content/collected-news/2026-06-04/raw-candidate-manifest.json` - present
- `content/collected-news/2026-06-04/merged-candidates.json` - changed
- `content/collected-news/2026-06-04/merged-candidate-manifest.json` - changed
- `content/newsroom/2026-06-04/generation-status.json` - present
- `content/newsroom/2026-06-04/reporter-candidates.json` - changed
- `content/newsroom/2026-06-04/editor-draft.json` - changed
- `content/newsroom/2026-06-04/editor-draft.md` - changed
- `content/newsroom/2026-06-04/fact-check-report.json` - changed
- `content/newsroom/2026-06-04/quality-report.json` - changed
- `content/newsroom/2026-06-04/stale-claim-report.json` - changed
- `content/newsroom/2026-06-04/retry-history.json` - changed
- `content/newsroom/2026-06-04/shortlisted-candidates.json` - changed
- `content/newsroom/2026-06-04/selection-report.json` - present
- `content/newsroom/2026-06-04/article-capsules.json` - changed
- `content/newsroom/2026-06-04/background-context.json` - changed
- `content/newsroom/2026-06-04/source-quality-report.json` - present
- `content/newsroom/2026-06-04/source-discovery-feedback-report.json` - present
- `content/newsroom/2026-06-04/source-clusters.json` - present
- `content/newsroom/2026-06-04/gemini-source-proposals.json` - present
- `content/newsroom/2026-06-04/gemini-source-proposal-validation-report.json` - present
- `content/newsroom/2026-06-04/gemini-usage-report.json` - present
- `content/newsroom/2026-06-04/extracted-source-facts.json` - present
- `content/newsroom/2026-06-04/evidence-validation-report.json` - present
- `content/newsroom/2026-06-04/cost-report.md` - changed
- `content/newsroom/2026-06-04/summary-cache-report.md` - present
- `content/newsroom/2026-06-04/summary-cache-report.json` - present
- `content/source-events/2026-06-04/source-change-events.md` - present
- `content/source-events/2026-06-04/source-change-events.json` - present
- `content/newsroom/2026-06-04/editor-draft-attempt-1.json` - present
- `content/newsroom/2026-06-04/editor-draft-attempt-1.md` - present
- `content/newsroom/2026-06-04/editor-public-article-judge-attempt-1.json` - changed
- `content/newsroom/2026-06-04/fact-check-report-attempt-1.json` - present
- `content/newsroom/2026-06-04/fact-check-report-attempt-1.md` - present
- `content/newsroom/2026-06-04/quality-report-attempt-1.json` - present
- `content/newsroom/2026-06-04/quality-report-attempt-1.md` - present
- `content/newsroom/2026-06-04/reporter-candidates-attempt-1.json` - present
- `content/newsroom/2026-06-04/artifact-manifest.json` - changed

## 미분류 산출물

- `content/newsroom/2026-06-04/repair-failure.json` - present

## 누락된 필수 확인 산출물

- `content/newsroom/2026-06-04/hal-signal-quality-report.md` - missing required (required_artifact_missing)

## 주의 필요

- `content/newsroom/2026-06-04/hal-signal-quality-report.md`: required_artifact_missing - Required review artifact is missing for this run context.
