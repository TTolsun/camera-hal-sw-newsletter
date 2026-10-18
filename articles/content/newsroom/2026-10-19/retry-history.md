# 뉴스레터 재시도 기록 - 2026-10-19

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 94/60 | PASS | 4 | 4 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 54
- Final eligible candidates: 12
- Final selected articles: 4
- Deterministic primary articles: 4
- Selected representative groups: 4
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 8
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 4
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 47
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (22)
- main_eligible=false (22)
- source_gap_risk=true (22)
- reference_only=true (14)
- briefing_only=true (13)

Homepage Headline:
- decision: retained_current_newer
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-19
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android Studio Canary, 외부 코딩 에이전트 연동 위한 BYOA 지원 도입; AndroidX HeifWriter, 8비트 서피스 입력의 색상 범위 강제 설정 해제; Linux media 서브시스템, Himax HM1092 흑백 NIR 센서 드라이버 패치 시리즈 v7 제출; Linux atomisp 드라이버, 스트림 생성 내부의 무효 오류 검사 제거 제안
- Lock된 기사: Android Studio Canary, 외부 코딩 에이전트 연동 위한 BYOA 지원 도입; AndroidX HeifWriter, 8비트 서피스 입력의 색상 범위 강제 설정 해제; Linux media 서브시스템, Himax HM1092 흑백 NIR 센서 드라이버 패치 시리즈 v7 제출; Linux atomisp 드라이버, 스트림 생성 내부의 무효 오류 검사 제거 제안
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
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (AndroidX HeifWriter, 8비트 서피스 입력의 색상 범위 강제 설정 해제): Article image uses a local fallback visual.; 1pt image-fallback (Linux media 서브시스템, Himax HM1092 흑백 NIR 센서 드라이버 패치 시리즈 v7 제출): Article image uses a local fallback visual.; 1pt image-fallback (Linux atomisp 드라이버, 스트림 생성 내부의 무효 오류 검사 제거 제안): Article image uses a local fallback visual.
