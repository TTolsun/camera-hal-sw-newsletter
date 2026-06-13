# Candidate Selection Diagnostics - 2026-05-07

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 0
- Final input candidates: 40
- Final eligible candidates: 6
- Final selected articles: 5
- Deterministic primary articles: 5
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 3
- camera_driver_image_pipeline: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Non-fallback reviewable: 4

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- main_eligible=false (34)
- source_gap_risk=true (34)
- reference_only=true (32)
- briefing_only=true (20)
- finalSelectionEligibility=watchlist (20)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (non-fallback Camera/Android/Driver/SoC >= 2)
- Publish Gate: PASS (non-fallback Camera/Android/Driver/SoC >= 3; final articles >= 4)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 2

