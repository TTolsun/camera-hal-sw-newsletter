# 뉴스레터 재시도 기록 - 2026-08-10

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 95/60 | PASS | 2 | 2 | 1 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 11
- Reporter-selected candidates: 10
- Final input candidates: 69
- Final eligible candidates: 11
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 5
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 3
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 3
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 3
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (32)
- main_eligible=false (32)
- source_gap_risk=true (32)
- missing dated evidence (31)
- selection_window=unknown_not_main (30)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-08-10
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2); Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2)
- Lock된 기사: 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2); Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2)
- Source gap section: 없음
- Demoted section: Linux 미디어 서브시스템에 IMX576 카메라 센서 드라이버 추가 제안 (PATCH v3)
- Replaced section: Linux 미디어 서브시스템에 IMX576 카메라 센서 드라이버 추가 제안 (PATCH v3)
- Reserve candidate used: 없음
- Candidate rejection: [PATCH v3 0/3] media: i2c: Add imx576 camera sensor driver (duplicate_demoted_url); [PATCH v2 0/2] media: i2c: Add onsemi AR0234 camera sensor driver (duplicate_locked_url); [PATCH v2 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor (duplicate_locked_url)
- Underfilled reason: completion top-up failed; published 2 passing article(s) below target 3
- 실패 section: Linux 미디어 서브시스템에 IMX576 카메라 센서 드라이버 추가 제안 (PATCH v3)
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: replace-or-demote(deterministic-demote): Linux 미디어 서브시스템에 IMX576 카메라 센서 드라이버 추가 제안 (PATCH v3)
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [v2,1/2] ipa: rpi: Rename mistrustFrames* to mistrustMetadata* - Patchwork (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2)): Article image uses a local fallback visual.; 1pt image-fallback (Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2)): Article image uses a local fallback visual.
