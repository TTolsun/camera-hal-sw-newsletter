# 뉴스레터 재시도 기록 - 2026-09-28

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 94/60 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 85
- Final eligible candidates: 11
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 6
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 1
- cpp_ai_tooling_fallback: 2
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 1
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: lineup_at_max
- republication_history_loaded: true
- republication_history_main_articles: 36
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.

주요 final exclusion reason:
- final_selection_blocked=true (41)
- main_eligible=false (41)
- source_gap_risk=true (41)
- briefing_only=true (36)
- finalSelectionEligibility=watchlist (36)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html
- replacement_headline_key: url:https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-28
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: 르네사스 RZ V2H EVK 플랫폼을 위한 ISP 및 IVC 활성화 패치 제안; 삼성 S5K3T2 이미지 센서를 위한 Linux 커널 드라이버 패치 제안; 소니 IMX681 카메라 센서 지원 패치에 대한 테스트 보고서 공개; Android Studio에서 서드파티 AI 에이전트 선택 및 통합 지원 발표; 앤트로픽, 성능과 안전성을 개선한 Claude Opus 5.5 모델 발표
- Lock된 기사: 르네사스 RZ V2H EVK 플랫폼을 위한 ISP 및 IVC 활성화 패치 제안; 삼성 S5K3T2 이미지 센서를 위한 Linux 커널 드라이버 패치 제안; 소니 IMX681 카메라 센서 지원 패치에 대한 테스트 보고서 공개; Android Studio에서 서드파티 AI 에이전트 선택 및 통합 지원 발표; 앤트로픽, 성능과 안전성을 개선한 Claude Opus 5.5 모델 발표
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
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (르네사스 RZ V2H EVK 플랫폼을 위한 ISP 및 IVC 활성화 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (삼성 S5K3T2 이미지 센서를 위한 Linux 커널 드라이버 패치 제안): Article image uses a local fallback visual.; 1pt image-fallback (소니 IMX681 카메라 센서 지원 패치에 대한 테스트 보고서 공개): Article image uses a local fallback visual.
