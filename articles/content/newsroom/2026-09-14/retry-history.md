# 뉴스레터 재시도 기록 - 2026-09-14

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 94/60 | PASS | 4 | 4 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 71
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 5
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 5
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max
- release_class_after_reconciliation_pool_size: 1
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: not_in_reporter_input
- republication_history_loaded: true
- republication_history_main_articles: 23
- republication_cooldown_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- missing dated evidence (24)
- final_selection_blocked=true (23)
- main_eligible=false (22)
- selection_window=unknown_not_main (22)
- source_gap_risk=true (22)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-14
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안; OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안; libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안; libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안
- Lock된 기사: Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안; OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안; libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안; libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안
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
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":2,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안): Article image uses a local fallback visual.; 1pt image-fallback (libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안): Article image uses a local fallback visual.
