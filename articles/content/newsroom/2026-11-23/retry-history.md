# 뉴스레터 재시도 기록 - 2026-11-23

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=unknown, editor=unknown, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 85/60 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 55
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 1
  - article:https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276
    - 5314ee226c5b3430a2c1f574efddc692f854845eb87dd1d5d7060561163dfd0c: coverage_decision=main_article, reason_code=diagnostic_comparison
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 4
- android: 0
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 4
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 68
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 2

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (20)
- main_eligible=false (20)
- source_gap_risk=true (20)
- briefing_only=true (15)
- finalSelectionEligibility=watchlist (15)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4439489
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-11-23
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.7.0에서 물리 카메라를 직접 고른다; 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요; SM-F971에서 두 번째 렌즈 전환이 멈춘 이유; OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭; 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점
- Lock된 기사: CameraX 1.7.0에서 물리 카메라를 직접 고른다; 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요; SM-F971에서 두 번째 렌즈 전환이 멈춘 이유; OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭; 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":3,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 2pt linked-evidence-limitation (3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (SM-F971에서 두 번째 렌즈 전환이 멈춘 이유): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (SM-F971에서 두 번째 렌즈 전환이 멈춘 이유): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점): Article image uses a local fallback visual.
