# 뉴스레터 재시도 기록 - 2026-06-26

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 93/60 | PASS | 4 | 4 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 9
- Reporter-selected candidates: 7
- Final input candidates: 67
- Final eligible candidates: 9
- Final selected articles: 4
- Deterministic primary articles: 4
- Selected representative groups: 4
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 3
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 3
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
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (35)
- main_eligible=false (35)
- source_gap_risk=true (35)
- reference_only=true (32)
- missing dated evidence (31)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://developer.android.com/tools/agents/android-cli
- replacement_headline_key: url:https://lore.kernel.org/linux-media/178240963924.1799417.13645477490024464265@freya
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-26
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안; Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가; Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안; V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가
- Lock된 기사: IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안; Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가; Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안; V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":4,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [PATCH 0/2] Support RAW12 bayer formats - Yemike Abhilash Chandra (evidence_score=0 < 6); [PATCH v3 0/4] media: add and use fwnode_graph_for_each_endpoint_scoped() - Frank.Li (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 1pt image-fallback (IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가): Article image uses a local fallback visual.
