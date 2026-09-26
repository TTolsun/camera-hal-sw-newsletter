# 뉴스레터 재시도 기록 - 2026-09-28

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 58/60 | NEEDS_FIX | 5 | 2 | 0 | 0 | 0 | 0 | 0 |
| 2 | repair-fallback | 58/60 | FAILED_REPAIR_REVIEWABLE | 5 | 0 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 81
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: 5
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 1
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 1
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 3
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 1
- release_class_admitted: 1
- release_class_blocked_reason: none
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 32
- republication_cooldown_blocked: 2
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- missing dated evidence (30)
- selection_window=unknown_not_main (28)
- finalSelectionEligibility=unknown (25)
- final_selection_blocked=true (23)
- main_eligible=false (23)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://github.com/openai/codex/releases/tag/rust-v0.155.1
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

- 선택 기사: CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결; Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안; Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안; Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안; Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표
- Lock된 기사: CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결; Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, action_hint.; 2pt linked-evidence-limitation (CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결): Article image uses a local fallback visual.; 8pt story-body (Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안): Article image uses a local fallback visual.; 8pt story-body (Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안): Article image uses a local fallback visual.; 8pt story-body (Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안): Article image uses a local fallback visual.; 8pt story-body (Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결; Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안; Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안; Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안; Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표
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
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, action_hint.; 2pt linked-evidence-limitation (CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결): Article image uses a local fallback visual.; 8pt story-body (Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안): Article image uses a local fallback visual.; 8pt story-body (Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안): Article image uses a local fallback visual.; 8pt story-body (Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안): Article image uses a local fallback visual.; 8pt story-body (Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표): Story Contract v2 body check failed: insufficient_public_body_paragraphs.; 1pt image-fallback (Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표): Article image uses a local fallback visual.
