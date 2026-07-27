# 뉴스레터 재시도 기록 - 2026-07-27

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 93/60 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 8
- Reporter-selected candidates: 6
- Final input candidates: 59
- Final eligible candidates: 8
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 3
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 5
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 5
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 5

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (37)
- main_eligible=false (37)
- source_gap_risk=true (37)
- reference_only=true (34)
- briefing_only=true (27)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://patchwork.libcamera.org/patch/27362
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260726214401.19042-1-j@metarealtyinc.ca
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-07-27
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Qualcomm CAMSS, raw Bayer를 YUV로 변환하는 OPE(Offline Processing Engine) 드라이버 추가 패치 제안; Himax HM1092 단색 적외선(IR) 센서 지원을 위한 신규 V4L2 드라이버 패치 공개; libcamera, 제어 직렬화기(Control Serializer) 크기 및 입력 유효성 검사 강화 패치 제안; libcamera, 불필요한 초기화 방지를 위한 EGLDisplay 캐싱 최적화 패치 제안; Samsung S5KJN5 50MP 이미지 센서 지원을 위한 독립형 V4L2 드라이버 패치 제안
- Lock된 기사: Qualcomm CAMSS, raw Bayer를 YUV로 변환하는 OPE(Offline Processing Engine) 드라이버 추가 패치 제안; Himax HM1092 단색 적외선(IR) 센서 지원을 위한 신규 V4L2 드라이버 패치 공개; libcamera, 제어 직렬화기(Control Serializer) 크기 및 입력 유효성 검사 강화 패치 제안; libcamera, 불필요한 초기화 방지를 위한 EGLDisplay 캐싱 최적화 패치 제안; Samsung S5KJN5 50MP 이미지 센서 지원을 위한 독립형 V4L2 드라이버 패치 제안
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: Qualcomm CAMSS, raw Bayer를 YUV로 변환하는 OPE(Offline Processing Engine) 드라이버 추가 패치 제안
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): Qualcomm CAMSS, raw Bayer를 YUV로 변환하는 OPE(Offline Processing Engine) 드라이버 추가 패치 제안
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":2,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: Re: [PATCH v2 1/2] dt-bindings: media: i2c: Add Samsung S5KJN5 image sensor - Vladimir Zapolskiy (evidence_score=0 < 6); Re: [PATCH v2 2/2] media: i2c: Add Samsung S5KJN5 image sensor driver - Vladimir Zapolskiy (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt image-fallback (Qualcomm CAMSS, raw Bayer를 YUV로 변환하는 OPE(Offline Processing Engine) 드라이버 추가 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (Himax HM1092 단색 적외선(IR) 센서 지원을 위한 신규 V4L2 드라이버 패치 공개): Article image uses a local fallback visual.; 1pt image-fallback (libcamera, 제어 직렬화기(Control Serializer) 크기 및 입력 유효성 검사 강화 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (libcamera, 불필요한 초기화 방지를 위한 EGLDisplay 캐싱 최적화 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (Samsung S5KJN5 50MP 이미지 센서 지원을 위한 독립형 V4L2 드라이버 패치 제안): Article image uses a local fallback visual.
