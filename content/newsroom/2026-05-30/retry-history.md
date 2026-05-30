# 뉴스레터 재시도 기록 - 2026-05-30

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 99/85 | PASS | 2 | 2 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 10
- Reporter-selected candidates: 2
- Final input candidates: 51
- Final eligible candidates: 10
- Final selected articles: 2
- Deterministic primary articles: 2
- Selected representative groups: 2
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
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
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (39)
- main_eligible=false (39)
- source_gap_risk=true (39)
- reference_only=true (33)
- briefing_only=true (29)

Homepage Headline:
- decision: retained_current_above_margin
- current_headline_key: url:https://goo.gle/AdaptiveApps_IO26
- replacement_headline_key: unknown
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: 98
- previous_stored_current_score: 100
- last_scored_at: 2026-05-29
- scored_at: 2026-05-30
- included_as_latest: true
- latest_inclusion_mode: selected_normally
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Google I/O 2026: Jetpack Compose 및 CameraX를 통한 다중 폼팩터 카메라 미리보기 최적화; Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 프로토타이핑 워크플로우 개선
- Lock된 기사: Google I/O 2026: Jetpack Compose 및 CameraX를 통한 다중 폼팩터 카메라 미리보기 최적화; Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 프로토타이핑 워크플로우 개선
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: Re: [PATCH v2] media: bcm2835-unicam: Fix log status runtime access - Eugen Hristev (evidence_score=0 < 6); [PATCH 0/6] Add CAMSS support for Qualcomm Glymur - Vikram Sharma (evidence_score=0 < 6); [PATCH 1/6] dt-bindings: media: Add bindings for qcom,glymur-camss - Vikram Sharma (evidence_score=0 < 6); [PATCH 2/6] dt-bindings: i2c: qcom-cci: Document Glymur compatible - Vikram Sharma (evidence_score=0 < 6); [PATCH v7] media: iris: drop struct iris_fmt - Dmitry Baryshkov (evidence_score=0 < 6); Re: [PATCH 3/8] media: qcom: camss: add support for QCM2390 camss - Vikram Sharma (evidence_score=0 < 6); Re: [PATCH v3] media: add virtio-media driver - Brian Daniels (evidence_score=0 < 6); Re: [PATCH v4 0/6] media: qcom: iris: add support for decoding 10bit formats - Neil Armstrong (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.
