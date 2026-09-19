# 뉴스레터 재시도 기록 - 2026-09-21

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 91/60 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 65
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 6
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 3
- Primary Camera Stack: 2
- Supporting main articles: 0
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
- republication_history_main_articles: 27
- republication_cooldown_blocked: 2
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (24)
- main_eligible=false (24)
- source_gap_risk=true (24)
- missing dated evidence (15)
- selection_window=unknown_not_main (13)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com
- replacement_headline_key: url:https://github.com/openai/codex/releases/tag/rust-v0.155.1
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-21
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안; Microsoft Surface Pro 11 (Intel) 카메라 거꾸로 출력되는 문제 해결을 위한 퀵 패치 제안; Claude Code 프로젝트 기능 재설계: 대화형 프로파일링 및 병렬 PR 지원; Claude Code v2.1.271 출시: 원격 세션 빠른 모드 및 설정 패널 마우스 지원 추가; Codex rust-v0.155.1 출시: 로컬 TUI 세션 추론 요약 기본 비활성화로 요청 거부 해결
- Lock된 기사: Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안; Microsoft Surface Pro 11 (Intel) 카메라 거꾸로 출력되는 문제 해결을 위한 퀵 패치 제안; Claude Code 프로젝트 기능 재설계: 대화형 프로파일링 및 병렬 PR 지원; Claude Code v2.1.271 출시: 원격 세션 빠른 모드 및 설정 패널 마우스 지원 추가; Codex rust-v0.155.1 출시: 로컬 TUI 세션 추론 요약 기본 비활성화로 요청 거부 해결
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":5,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 2pt linked-evidence-limitation (Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안): Article image uses a local fallback visual.; 1pt image-fallback (Microsoft Surface Pro 11 (Intel) 카메라 거꾸로 출력되는 문제 해결을 위한 퀵 패치 제안): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (Codex rust-v0.155.1 출시: 로컬 TUI 세션 추론 요약 기본 비활성화로 요청 거부 해결): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
