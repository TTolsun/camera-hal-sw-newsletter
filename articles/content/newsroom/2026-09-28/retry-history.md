# 뉴스레터 재시도 기록 - 2026-09-28

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 93/60 | PASS | 4 | 4 | 1 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 86
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
- republication_history_main_articles: 32
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.

주요 final exclusion reason:
- final_selection_blocked=true (42)
- main_eligible=false (42)
- source_gap_risk=true (42)
- briefing_only=true (37)
- finalSelectionEligibility=watchlist (37)

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

- 선택 기사: Android Studio, 개발자 맞춤형 AI 에이전트 연동 지원으로 네이티브 개발 유연성 확장; 앤트로픽, 정렬 테스트를 통과한 고성능 AI 모델 Claude Opus 5.5 공개; 르네사스 RZ/V2H EVK, 리눅스 커널 패치로 Mali-C55 ISP 및 IVC 하드웨어 활성화 추진; 소니 IMX681 카메라 센서 지원 패치 및 최신 libcamera 기반 통합 테스트 보고
- Lock된 기사: Android Studio, 개발자 맞춤형 AI 에이전트 연동 지원으로 네이티브 개발 유연성 확장; 앤트로픽, 정렬 테스트를 통과한 고성능 AI 모델 Claude Opus 5.5 공개; 르네사스 RZ/V2H EVK, 리눅스 커널 패치로 Mali-C55 ISP 및 IVC 하드웨어 활성화 추진; 소니 IMX681 카메라 센서 지원 패치 및 최신 libcamera 기반 통합 테스트 보고
- Source gap section: 없음
- Demoted section: 삼성 S5K3T2 이미지 센서, 리눅스 커널 드라이버 및 바인딩 패치 제안
- Replaced section: 삼성 S5K3T2 이미지 센서, 리눅스 커널 드라이버 및 바인딩 패치 제안
- Reserve candidate used: 없음
- Candidate rejection: Build your way: Use any AI agent of your choice in Android Studio (duplicate_locked_url); Claude Opus 5.5 (duplicate_locked_url); [PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK (duplicate_locked_url); [PATCH v3 0/2] media: i2c: Samsung S5K3T2 image sensor (duplicate_demoted_url); Test for [PATCH v7 0/3] Add support for the Sony IMX681 camera sensor (duplicate_locked_url)
- Underfilled reason: completion top-up failed; published 4 passing article(s) below target 5
- 실패 section: 삼성 S5K3T2 이미지 센서, 리눅스 커널 드라이버 및 바인딩 패치 제안
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: replace-or-demote(deterministic-demote): 삼성 S5K3T2 이미지 센서, 리눅스 커널 드라이버 및 바인딩 패치 제안
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective.; 1pt image-fallback (Android Studio, 개발자 맞춤형 AI 에이전트 연동 지원으로 네이티브 개발 유연성 확장): Article image uses a local fallback visual.; 1pt image-fallback (앤트로픽, 정렬 테스트를 통과한 고성능 AI 모델 Claude Opus 5.5 공개): Article image uses a local fallback visual.; 1pt image-fallback (르네사스 RZ/V2H EVK, 리눅스 커널 패치로 Mali-C55 ISP 및 IVC 하드웨어 활성화 추진): Article image uses a local fallback visual.; 1pt image-fallback (소니 IMX681 카메라 센서 지원 패치 및 최신 libcamera 기반 통합 테스트 보고): Article image uses a local fallback visual.
