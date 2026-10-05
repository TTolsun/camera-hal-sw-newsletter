# 뉴스레터 재시도 기록 - 2026-10-05

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 90/60 | PASS | 4 | 4 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 73
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
- android_multimedia_camera_output: 0
- soc_platform_signal: 1
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
- republication_history_main_articles: 37
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (41)
- main_eligible=false (40)
- source_gap_risk=true (40)
- reference_only=true (34)
- briefing_only=true (33)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html
- replacement_headline_key: url:https://www.anthropic.com/news/barclays-scales-claude
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-05
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Mali-C55 ISP 드라이버의 전원 관리 개선: IRQ Wake 활성화 중 ISP 전원 유지 패치 제안; ChromeOS 플랫폼의 카메라 스택 안정성 강화: APPn 파싱 및 BLOB 출력 버퍼 크기 경계 검사 추가; ChromeOS 카메라 어댑터의 버퍼 관리 강화: 독점적인 버퍼 ID 강제 적용; 개발 워크플로우에 AI 에이전트 통합: Barclays의 Claude Code 대규모 도입 사례
- Lock된 기사: Mali-C55 ISP 드라이버의 전원 관리 개선: IRQ Wake 활성화 중 ISP 전원 유지 패치 제안; ChromeOS 플랫폼의 카메라 스택 안정성 강화: APPn 파싱 및 BLOB 출력 버퍼 크기 경계 검사 추가; ChromeOS 카메라 어댑터의 버퍼 관리 강화: 독점적인 버퍼 ID 강제 적용; 개발 워크플로우에 AI 에이전트 통합: Barclays의 Claude Code 대규모 도입 사례
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
- Final slot distribution: {"android_camera_platform_api":2,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 1pt image-fallback (Mali-C55 ISP 드라이버의 전원 관리 개선: IRQ Wake 활성화 중 ISP 전원 유지 패치 제안): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (ChromeOS 플랫폼의 카메라 스택 안정성 강화: APPn 파싱 및 BLOB 출력 버퍼 크기 경계 검사 추가): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (ChromeOS 플랫폼의 카메라 스택 안정성 강화: APPn 파싱 및 BLOB 출력 버퍼 크기 경계 검사 추가): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (ChromeOS 카메라 어댑터의 버퍼 관리 강화: 독점적인 버퍼 ID 강제 적용): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (ChromeOS 카메라 어댑터의 버퍼 관리 강화: 독점적인 버퍼 ID 강제 적용): Article image uses a local fallback visual.
