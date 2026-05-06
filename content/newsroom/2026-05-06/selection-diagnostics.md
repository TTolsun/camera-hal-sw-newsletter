# Candidate Selection Diagnostics - 2026-05-06

## ?꾨낫 ?좏깮 吏꾨떒

- Reporter candidates: unknown
- Reporter-selected candidates: unknown
- Final input candidates: 40
- Final eligible candidates: 2
- Final selected articles: 2
- Deterministic primary articles: 2
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: unknown
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 2
- Non-fallback reviewable: 0

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- C++/AI tooling fallback is support material only; collect at least 2 non-fallback Camera/Android/driver/SoC candidates before LLM generation.

二쇱슂 final exclusion reason:
- main_eligible=false (38)
- source_gap_risk=true (38)
- reference_only=true (33)
- briefing_only=true (26)
- finalSelectionEligibility=watchlist (26)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: FAIL (non-fallback Camera/Android/Driver/SoC >= 2)
- Publish Gate: FAIL (non-fallback Camera/Android/Driver/SoC >= 3; final articles >= 4)
- selection_publish_ready: false
- final_publish_ready: null
- selection_errors: 1
- selection_shortage_hints: 5
