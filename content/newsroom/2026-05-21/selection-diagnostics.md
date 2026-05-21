# Candidate Selection Diagnostics - 2026-05-21

## 후보 선택 진단

- Reporter candidates: 3
- Reporter-selected candidates: 0
- Final input candidates: 43
- Final eligible candidates: 3
- Final selected articles: 2
- Deterministic primary articles: 2
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 1
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 2
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (38)
- main_eligible=false (38)
- source_gap_risk=true (38)
- reference_only=true (36)
- briefing_only=true (31)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: PASS (main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 2

