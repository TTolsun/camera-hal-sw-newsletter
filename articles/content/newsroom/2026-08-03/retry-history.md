# 뉴스레터 재시도 기록 - 2026-08-03

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 94/60 | PASS | 4 | 4 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 64
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 4
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 4
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 4

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (31)
- main_eligible=false (31)
- source_gap_risk=true (31)
- reference_only=true (27)
- missing dated evidence (25)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260726214401.19042-1-j@metarealtyinc.ca
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-08-03
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개; onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출; OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출; Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개
- Lock된 기사: Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개; onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출; OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출; Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt image-fallback (Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개): Article image uses a local fallback visual.; 1pt image-fallback (onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출): Article image uses a local fallback visual.; 1pt image-fallback (OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개): Article image uses a local fallback visual.
