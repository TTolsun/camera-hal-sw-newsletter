# 뉴스레터 재시도 기록 - 2026-06-15

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 82/60 | NEEDS_FIX | 1 | 1 | 0 | 0 | 0 | 0 | 3 |
| 2 | repair-fallback | 82/60 | FAILED_REPAIR_REVIEWABLE | 1 | 0 | 0 | 0 | 0 | 0 | 3 |

## 후보 선택 진단

- Reporter candidates: 6
- Reporter-selected candidates: 4
- Final input candidates: 63
- Final eligible candidates: 6
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: 1
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 3
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 3

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (33)
- main_eligible=false (32)
- source_gap_risk=true (32)
- missing dated evidence (26)
- reference_only=true (25)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://developer.android.com/tools/agents/android-cli
- replacement_headline_key: url:https://developer.android.com/tools/agents/android-cli
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-15
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android CLI 및 GitHub에 CameraX 마이그레이션 등 17개 이상의 신규 'Android 스킬' 추가
- Lock된 기사: Android CLI 및 GitHub에 CameraX 마이그레이션 등 17개 이상의 신규 'Android 스킬' 추가
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [BUG] Input: rmi4: KASAN slab-use-after-free in v4l2_release - Shuangpeng Bai (evidence_score=0 < 6); [PATCH v3 7/22] media: platform: sun4i_csi: Add missing media_entity_cleanup() + fix UAF - Biren Pandya (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 15pt source-integrity: Fact checker returned 3 must_fix item(s).

## 시도 2

- 선택 기사: Android CLI 및 GitHub에 CameraX 마이그레이션 등 17개 이상의 신규 'Android 스킬' 추가
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: editor attempt 2/2: fallback-to-last-known-valid-editor
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 15pt source-integrity: Fact checker returned 3 must_fix item(s).
