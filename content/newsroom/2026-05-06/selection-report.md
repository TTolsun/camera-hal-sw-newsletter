# Selection Report - 2026-05-06

- status: FAILED
- failure_stage: deterministic selection
- failure_reason: Only 0 non-fallback Camera/Android/driver/SoC final article input(s) remain after deterministic filtering. C++/AI tooling fallback does not count toward ABSOLUTE_MIN_REVIEWABLE_ARTICLES.
- review_gate_passed: false
- publish_gate_passed: false

## Selection Errors

- Only 0 non-fallback Camera/Android/driver/SoC final article input(s) remain after deterministic filtering. C++/AI tooling fallback does not count toward ABSOLUTE_MIN_REVIEWABLE_ARTICLES.

## Shortage Hints

- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- C++/AI tooling fallback is support material only; collect at least 2 non-fallback Camera/Android/driver/SoC candidates before LLM generation.

## Gate Summary

- non_fallback_reviewable_article_count: 0
- absolute_min_reviewable_articles: 2
- min_non_fallback_publish_ready_articles: 3
- min_final_articles: 4
