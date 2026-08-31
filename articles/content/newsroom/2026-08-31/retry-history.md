# 뉴스레터 재시도 기록 - 2026-08-31

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 92/60 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 8
- Reporter-selected candidates: 6
- Final input candidates: 52
- Final eligible candidates: 8
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 1
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
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 13
- republication_cooldown_blocked: 2

Source/parser recovery hint:
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (33)
- main_eligible=false (33)
- source_gap_risk=true (33)
- reference_only=true (26)
- briefing_only=true (23)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-08-31
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: AtomISP 드라이버, Lenovo Yoga Book OV2740 센서 링크 및 D-PHY 타이밍 파생 지원 추가; libcamera, 고해상도 센서 처리를 위한 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치 검토; Linux 커널, Lenovo Yoga Book YB1-X91 카메라 드라이버 및 센서 통합 패치 시리즈 공개; Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련; libcamera, 소프트웨어 ISP EGL 모듈의 createTexture2D()에 필터 파라미터 추가
- Lock된 기사: AtomISP 드라이버, Lenovo Yoga Book OV2740 센서 링크 및 D-PHY 타이밍 파생 지원 추가; libcamera, 고해상도 센서 처리를 위한 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치 검토; Linux 커널, Lenovo Yoga Book YB1-X91 카메라 드라이버 및 센서 통합 패치 시리즈 공개; Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련; libcamera, 소프트웨어 ISP EGL 모듈의 createTexture2D()에 필터 파라미터 추가
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
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":3,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [PATCH v4 14/15] media: atomisp: allow raw Bayer capture - Maurizio Casciano (evidence_score=0 < 6); [PATCH v4 00/15] media: Add Lenovo Yoga Book YB1-X91 camera support - Maurizio Casciano (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt image-fallback (AtomISP 드라이버, Lenovo Yoga Book OV2740 센서 링크 및 D-PHY 타이밍 파생 지원 추가): Article image uses a local fallback visual.; 1pt image-fallback (libcamera, 고해상도 센서 처리를 위한 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치 검토): Article image uses a local fallback visual.; 1pt image-fallback (Linux 커널, Lenovo Yoga Book YB1-X91 카메라 드라이버 및 센서 통합 패치 시리즈 공개): Article image uses a local fallback visual.; 1pt image-fallback (Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련): Article image uses a local fallback visual.; 1pt image-fallback (libcamera, 소프트웨어 ISP EGL 모듈의 createTexture2D()에 필터 파라미터 추가): Article image uses a local fallback visual.
