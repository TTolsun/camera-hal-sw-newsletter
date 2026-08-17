# 뉴스레터 재시도 기록 - 2026-08-17

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 94/60 | PASS | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 7
- Reporter-selected candidates: 7
- Final input candidates: 48
- Final eligible candidates: 7
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 1
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 2
- direct_aosp_camera: 1
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 1
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 1
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max

Source/parser recovery hint:
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (33)
- main_eligible=false (33)
- source_gap_risk=true (33)
- reference_only=true (25)
- finalSelectionEligibility=exclude (19)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260815193839.141406-1-devnexen@gmail.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-08-17
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.7.0-alpha03 출시: Camera2Interop API 대대적 개편 및 멀티 카메라 ZSL HAL 충돌 수정
- Lock된 기사: CameraX 1.7.0-alpha03 출시: Camera2Interop API 대대적 개편 및 멀티 카메라 ZSL HAL 충돌 수정
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 2pt linked-evidence-limitation (CameraX 1.7.0-alpha03 출시: Camera2Interop API 대대적 개편 및 멀티 카메라 ZSL HAL 충돌 수정): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (CameraX 1.7.0-alpha03 출시: Camera2Interop API 대대적 개편 및 멀티 카메라 ZSL HAL 충돌 수정): Article image uses a local fallback visual.
