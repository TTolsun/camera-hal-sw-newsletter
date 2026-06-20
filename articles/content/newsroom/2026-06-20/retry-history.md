# 뉴스레터 재시도 기록 - 2026-06-20

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 96/60 | PASS | 2 | 2 | 1 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 5
- Final input candidates: 49
- Final eligible candidates: 5
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 2
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (30)
- main_eligible=false (30)
- source_gap_risk=true (30)
- reference_only=true (27)
- missing dated evidence (17)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260619125439.55311-1-himanshu.bhavani@siliconsignals.io
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-20
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Linux 커널에 Himax HM1246 이미지 센서 드라이버 추가를 위한 v10 패치 제안; GCC 16 컴파일러 릴리스 예정: 개선된 오류 메시지 및 SARIF 출력 기능 추가
- Lock된 기사: Linux 커널에 Himax HM1246 이미지 센서 드라이버 추가를 위한 v10 패치 제안; GCC 16 컴파일러 릴리스 예정: 개선된 오류 메시지 및 SARIF 출력 기능 추가
- Source gap section: 없음
- Demoted section: Linux 커널에 imx576 카메라 센서 드라이버 추가를 위한 v2 패치 시리즈 제안
- Replaced section: Linux 커널에 imx576 카메라 센서 드라이버 추가를 위한 v2 패치 시리즈 제안
- Reserve candidate used: 없음
- Candidate rejection: [PATCH v2 0/3] media: i2c: Add imx576 camera sensor driver (duplicate_demoted_url); [PATCH v10 0/2] media: add Himax HM1246 image sensor (duplicate_locked_url); New features in GCC 16: Improved error messages and SARIF output -- David Malcolm (duplicate_locked_url)
- Underfilled reason: completion top-up failed; published 2 passing article(s) below target 3
- 실패 section: Linux 커널에 imx576 카메라 센서 드라이버 추가를 위한 v2 패치 시리즈 제안
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: replace-or-demote(deterministic-demote): Linux 커널에 imx576 카메라 센서 드라이버 추가를 위한 v2 패치 시리즈 제안
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (Linux 커널에 Himax HM1246 이미지 센서 드라이버 추가를 위한 v10 패치 제안): Article image uses a local fallback visual.
