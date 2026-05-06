# 2026-05-06 Review Gate / Publish Gate 분리 계획

## 목적

- `ABSOLUTE_MIN_REVIEWABLE_ARTICLES`를 `2`로 낮춰 후보가 부족한 주에도 LLM 생성과 PR review artifact 생성을 허용한다.
- 최종 발행 가능 상태는 별도 Publish Gate로 유지해 `final_publish_ready=true`가 너무 쉽게 켜지지 않게 한다.
- deterministic selection 실패 또는 review-only 상태에서도 후보/선별 진단 artifact를 보존한다.

## 영향 범위

- `scripts/newsroom/generate/newsroom-selection.js`
  - Review Gate 기준을 `non-fallback Camera/Android/Driver/SoC >= 2`로 변경한다.
  - Publish Gate 기준 `non-fallback Camera/Android/Driver/SoC >= 3`을 별도 상수로 추가한다.
  - non-fallback 2개 조합은 LLM 생성 가능하지만 `publish_ready=false`, `selection_publish_ready=false`, `editor_review_required=true`가 되게 한다.
- `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
  - `finalPublishReady`가 Publish Gate, final article count, quality, fact-check, site/image validation을 모두 만족할 때만 `true`가 되게 한다.
  - selection 실패와 review-only 상태에서도 `shortlisted-candidates.json`, `recovery-prompt.md`, `.tmp/newsletter-generation-status.json`, cost report를 남긴다.
- `scripts/newsroom/cli/write-generation-status-output.js`, `scripts/newsroom/cli/build-newsroom-pr-body.js`
  - PR body와 workflow output에 Review Gate와 Publish Gate 상태를 분리해 보여준다.
  - non-fallback 2개 review-only 상태는 생성 실패가 아니라 publish-not-ready 상태로 설명한다.
- `scripts/newsroom/collect/source-item-parsers.js`
  - `Android Developers Latest Updates` / `CameraX` parser가 generic page link보다 version row/card를 우선하도록 보강한다.
  - CameraX 후보는 `publishedAt`, `version_or_release`, `api_or_component`, `behavior_change`, `relevanceBucketHint`가 모두 있을 때만 article candidate로 둔다.
- `data/news-sources.json`
  - 기존 CameraX/AOSP/libcamera/V4L2/SoC 관련 source의 사람용 `usageHint`와 `keywords`를 보강한다.
  - `id`, `category`, `priority`, `reliability`, `collectionModeHint`, `schemaVersion` 같은 계약-bearing 값은 유지한다.

## 검증 방법

- Targeted:
  - `node --test tests/newsroom-selection.test.js`
  - `node --test tests/source-item-parsers.test.js`
  - `node --test tests/workflow-scripts.test.js`
- Repo:
  - `npm.cmd run validate:config`
  - `npm.cmd run test`
  - `npm.cmd run collect`
  - `npm.cmd run validate`

## 위험 요소

- Review Gate 완화가 publish-ready 완화로 이어지면 발행 안전성이 낮아질 수 있다. Publish Gate 상수와 `finalPublishReady` 계산을 분리해 방지한다.
- CameraX parser 보강이 generic latest-updates page를 main article로 승격하면 source-gap 위험이 커진다. version row/card evidence가 완성된 항목만 후보화한다.
- source registry 보강은 후보 수를 늘릴 수 있지만 media/community source를 과신하면 source binding/quality gate가 약해질 수 있다. 계약 값과 cross-check 정책은 유지한다.
