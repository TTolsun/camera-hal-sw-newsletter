# Candidate Selection Diagnostics - 2026-05-19

## 후보 선택 진단

- Reporter candidates: unknown
- Reporter-selected candidates: unknown
- Final input candidates: 46
- Final eligible candidates: 3
- Final selected articles: 3
- Deterministic primary articles: 3
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: true
- Reporter-selected but final-excluded: unknown
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 2
- Primary Camera Stack: 1
- Supporting main articles: 2
- Forbidden main articles: 0
- Non-fallback reviewable: 1

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (40)
- main_eligible=false (40)
- source_gap_risk=true (40)
- reference_only=true (38)
- briefing_only=true (30)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: FAIL (main articles: 3-5; review gate primary camera stack articles: 1; Publish-ready gate primary camera stack articles: 2; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: 1; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85)
- selection_publish_ready: false
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 3

