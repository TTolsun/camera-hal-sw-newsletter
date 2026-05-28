# 뉴스레터 재시도 기록 - 2026-05-28

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | repair-fallback | 81/85 | FAILED_REPAIR_REVIEWABLE | 2 | 0 | 0 | 0 | 0 | 0 | 16 |

## 후보 선택 진단

- Reporter candidates: 2
- Reporter-selected candidates: 2
- Final input candidates: 42
- Final eligible candidates: 2
- Final selected articles: 2
- Deterministic primary articles: 2
- Selected representative groups: 2
- Rendered groups: 2
- Explicitly demoted groups: 0
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 1
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 1

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (39)
- main_eligible=false (39)
- source_gap_risk=true (39)
- reference_only=true (35)
- briefing_only=true (29)

Homepage Headline:
- decision: retained_current_above_margin
- current_headline_key: url:https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- replacement_headline_key: unknown
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: 96
- previous_stored_current_score: 98
- last_scored_at: 2026-05-27
- scored_at: 2026-05-28
- included_as_latest: true
- latest_inclusion_mode: selected_normally
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화; Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: editor repair attempt 1/2: fallback-to-last-known-valid-editor
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화): Article image uses a local fallback visual.; 1pt image-fallback (Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 16 must_fix item(s).
