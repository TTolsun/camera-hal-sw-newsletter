# Camera HAL Source / Parser Candidate Quality Plan

## Goal

- Keep `MIN_FINAL_ARTICLES`, `ABSOLUTE_MIN_REVIEWABLE_ARTICLES`, `MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES`, and `QUALITY_THRESHOLD` unchanged.
- Keep `cpp_ai_tooling_fallback` excluded from review-gate non-fallback counts.
- Improve source/parser quality so 2-4 non-fallback Camera/Android/driver/SoC candidates are collected without weakening publication safety.
- Prevent one release event from inflating non-fallback reviewable counts through multiple parser child items.
- Use end-of-day when `NEWSLETTER_DATE=YYYY-MM-DD` defines the lookback window end, so same-day timestamped items remain in scope.
- Preserve deterministic selection diagnostics even when generation fails before LLM calls.

## Scope

- Improve official Android/AOSP source parsing for `Android Developers Latest Updates`, `CameraX Release Notes`, and `AOSP Site Updates`.
- Include `libcamera` / V4L2 dated release item parsing for `camera_driver_image_pipeline` coverage.
- Harden SoC candidate classification so only camera-impact platform evidence counts as `soc_platform_signal`.
- Keep static reference/watch/documentation pages out of `main` / `short` selection unless they provide concrete dated release/API/behavior evidence.
- Treat `AOSP Site Updates` month-level evidence by checking whether the full source month overlaps the lookback window.

## Implementation

- Verify current Android official fixtures:
  - `Android Developers Latest Updates` camera row is dated `March 25, 2026`.
  - `CameraX 1.6.0` release note is dated `March 25, 2026`.
  - These rows remain outside a `NEWSLETTER_DATE=2026-05-06`, `LOOKBACK_DAYS=21` or 28-day collection unless a separate long-tail policy is explicitly added.
- Extend `parseAospSiteUpdates` fixtures for month-level Camera ITS, CDD camera, Automotive Camera Service, and Camera Provider rows.
- Add libcamera v0.7.1 dated release parsing and fixture coverage; it is dated `April 28, 2026` and should remain within the 21-day lookback for `NEWSLETTER_DATE=2026-05-06`.
- Emit one main/short-eligible `libcamera v0.7.1` release candidate only; keep SoftISP, pipeline handler, and sensor configuration evidence inside that release item instead of separate eligible child candidates.
- Update `withinLookback` so month-level candidates include April 2026 and exclude March 2026 for the 2026-05-06 / 21-day run.
- Compute explicit newsletter date lookback windows with `YYYY-MM-DDT23:59:59.999Z`; keep live/scheduled no-date runs on the actual current time.
- Require SoC article-level camera impact terms such as `ISP`, `image pipeline`, `camera performance`, `sensor`, `media pipeline`, `video capture`, `camera thermal`, `camera latency`, or `camera power` before assigning `soc_platform_signal`.

## Validation

- `node --test tests\source-item-parsers.test.js tests\collector-relevance.test.js tests\aosp-camera-scope.test.js tests\newsroom-selection.test.js`
- `npm.cmd run test`
- `npm.cmd run validate`
- `NEWSLETTER_DATE=2026-05-06 npm.cmd run collect`
- `git diff --check`
