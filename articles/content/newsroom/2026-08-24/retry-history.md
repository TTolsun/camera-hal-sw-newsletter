# 뉴스레터 재시도 기록 - 2026-08-24

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 97/60 | PASS | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 7
- Reporter-selected candidates: 7
- Final input candidates: 52
- Final eligible candidates: 7
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 1
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 4
  - lore-series:20260819125647.68910-himanshu.bhavani@siliconsignals.io
    - 29c284c94819836c4fe62bd0da8da0210d005954a8af1208835cd200f7378986: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
  - lore-series:20260820075524.2056029-eagle.alexander923@gmail.com
    - b267cab9cec348cf1e1c46842808420fb1e9f58c0082fa7769a3a9ca1561a057: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
  - lore-series:20260820202544.1256265-devnexen@gmail.com
    - 655b00b9713bf7b7947678c0bb340bc3b8c0e6270c48757ac1f0aef95111a3d8: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
  - lore-series:20260817123941.1701962-natalie.klaus@runtimeverification.com
    - 826ff192ba1e6066668d17d968b80d07ff429d928a341d5990b89622e18bc45d: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 2
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
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max

Source/parser recovery hint:
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (32)
- main_eligible=false (32)
- source_gap_risk=true (32)
- reference_only=true (27)
- briefing_only=true (24)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260820202544.1256265-1-devnexen@gmail.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-08-24
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Raspberry Pi libcamera v0.7.2+rpt20260817 릴리스: Linux 카메라 파이프라인의 안정성 강화 및 HAL 엔지니어를 위한 시사점
- Lock된 기사: Raspberry Pi libcamera v0.7.2+rpt20260817 릴리스: Linux 카메라 파이프라인의 안정성 강화 및 HAL 엔지니어를 위한 시사점
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
- 감점: 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 1pt image-fallback (Raspberry Pi libcamera v0.7.2+rpt20260817 릴리스: Linux 카메라 파이프라인의 안정성 강화 및 HAL 엔지니어를 위한 시사점): Article image uses a local fallback visual.
