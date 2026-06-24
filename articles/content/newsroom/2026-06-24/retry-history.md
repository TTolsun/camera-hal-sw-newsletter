# 뉴스레터 재시도 기록 - 2026-06-24

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 97/60 | PASS | 2 | 2 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 3
- Reporter-selected candidates: 3
- Final input candidates: 52
- Final eligible candidates: 3
- Final selected articles: 2
- Deterministic primary articles: 2
- Selected representative groups: 2
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 1
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

주요 final exclusion reason:
- final_selection_blocked=true (37)
- main_eligible=false (37)
- source_gap_risk=true (37)
- reference_only=true (33)
- missing dated evidence (24)

Homepage Headline:
- decision: retained_current_newer
- current_headline_key: url:https://lore.kernel.org/linux-media/20260620132749.GE3552167@killaraus.ideasonboard.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260620132749.GE3552167@killaraus.ideasonboard.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-24
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android CLI에 CameraX 마이그레이션 스킬 추가, 앱 호환성 검증 지원; GCC 16 컴파일러 릴리스 임박, 개선된 오류 메시지 및 SARIF 정적 분석 도입
- Lock된 기사: Android CLI에 CameraX 마이그레이션 스킬 추가, 앱 호환성 검증 지원; GCC 16 컴파일러 릴리스 임박, 개선된 오류 메시지 및 SARIF 정적 분석 도입
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective.; 1pt image-fallback (Android CLI에 CameraX 마이그레이션 스킬 추가, 앱 호환성 검증 지원): Article image uses a local fallback visual.; 1pt image-fallback (GCC 16 컴파일러 릴리스 임박, 개선된 오류 메시지 및 SARIF 정적 분석 도입): Article image uses a local fallback visual.
