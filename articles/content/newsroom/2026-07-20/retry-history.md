# 뉴스레터 재시도 기록 - 2026-07-20

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 97/60 | PASS | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 8
- Reporter-selected candidates: 8
- Final input candidates: 66
- Final eligible candidates: 8
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 5
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 5
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 1
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 1
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 1

Source/parser recovery hint:
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (31)
- main_eligible=false (31)
- source_gap_risk=true (31)
- missing dated evidence (30)
- selection_window=unknown_not_main (28)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/da70ed94-fd76-4105-8071-1ed8d8e41d84@linaro.org
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260717-sk5jn5-v1-0-da610d7fd494@oss.qualcomm.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-07-20
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안
- Lock된 기사: libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened.; 1pt image-fallback (libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안): Article image uses a local fallback visual.
