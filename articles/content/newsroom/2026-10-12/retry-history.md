# 뉴스레터 재시도 기록 - 2026-10-12

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 78/60 | NEEDS_FIX | 2 | 1 | 1 | 0 | 0 | 0 | 5 |
| 2 | repair-fallback | 78/60 | FAILED_REPAIR_REVIEWABLE | 2 | 0 | 0 | 0 | 0 | 0 | 5 |
| 3 | default | undefined/undefined |  | 3 | 0 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: unknown
- Reporter-selected candidates: unknown
- Final input candidates: 3
- Final eligible candidates: 3
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: unknown
- Reserve candidates: 0
- Demoted candidates: 0
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: unknown
- direct_aosp_camera: 1
- android: 0
- camera_driver_image_pipeline: 1
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 3
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: unknown
- release_class_after_reconciliation_admitted: unknown
- release_class_after_reconciliation_blocked_reason: unknown
- republication_history_loaded: true
- republication_history_main_articles: 42
- republication_cooldown_blocked: 0
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- none

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-12
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 포맷 uAPI 문서 제안
- Lock된 기사: AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안
- Source gap section: 없음
- Demoted section: Anthropic 소형 AI 모델 Claude Haiku 5.5 발표 및 네이티브 개발 워크플로 활용
- Replaced section: Anthropic 소형 AI 모델 Claude Haiku 5.5 발표 및 네이티브 개발 워크플로 활용
- Reserve candidate used: 없음
- Candidate rejection: cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av (duplicate_locked_url); Claude Haiku 5.5 (duplicate_demoted_url); [PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation (duplicate_locked_url)
- Underfilled reason: missing 1 article(s); no eligible non-duplicate primary/reserve completion candidate remains
- 실패 section: Anthropic 소형 AI 모델 Claude Haiku 5.5 발표 및 네이티브 개발 워크플로 활용
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: replace-or-demote(deterministic-demote): Anthropic 소형 AI 모델 Claude Haiku 5.5 발표 및 네이티브 개발 워크플로 활용
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 2pt linked-evidence-limitation (AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 포맷 uAPI 문서 제안): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 5 must_fix item(s).

## 시도 2

- 선택 기사: AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 포맷 uAPI 문서 제안
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 2pt linked-evidence-limitation (AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (AOSP cameraserver, 센서 프라이버시 토글 시 강제 해제 대신 카메라 음소거 전환 제안): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 포맷 uAPI 문서 제안): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 5 must_fix item(s).

## 시도 3

- 선택 기사: cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토; Claude Haiku 5.5: 반복 코딩 작업을 위한 저비용 보조 모델
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토; Claude Haiku 5.5: 반복 코딩 작업을 위한 저비용 보조 모델
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토): Article image uses a local fallback visual.
