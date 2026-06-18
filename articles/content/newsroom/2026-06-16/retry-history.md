# 뉴스레터 재시도 기록 - 2026-06-16

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 96/60 | PASS | 3 | 3 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 4
- Final input candidates: 54
- Final eligible candidates: 5
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 1
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (31)
- main_eligible=false (30)
- source_gap_risk=true (30)
- reference_only=true (24)
- briefing_only=true (19)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-16
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: ARM Mali-C55 ISP 드라이버, CCM(Color Correction Matrix) 지원 패치 제안; Android 개발자 생산성 향상: CameraX 마이그레이션 스킬 추가; GCC 16, 개선된 오류 메시지 및 SARIF 출력 기능으로 C++ 개발 효율 향상
- Lock된 기사: ARM Mali-C55 ISP 드라이버, CCM(Color Correction Matrix) 지원 패치 제안; Android 개발자 생산성 향상: CameraX 마이그레이션 스킬 추가; GCC 16, 개선된 오류 메시지 및 SARIF 출력 기능으로 C++ 개발 효율 향상
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":3,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [PATCH v3 0/2] media: atomisp: fix probe memory leaks - Dawei Feng (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (ARM Mali-C55 ISP 드라이버, CCM(Color Correction Matrix) 지원 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (GCC 16, 개선된 오류 메시지 및 SARIF 출력 기능으로 C++ 개발 효율 향상): Article image uses a local fallback visual.
