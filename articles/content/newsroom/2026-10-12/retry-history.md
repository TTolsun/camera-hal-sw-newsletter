# 뉴스레터 재시도 기록 - 2026-10-12

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 90/60 | NEEDS_FIX | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 90/60 | NEEDS_FIX | 3 | 3 | 0 | 0 | 6 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 61
- Final eligible candidates: 12
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 4
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 9
- direct_aosp_camera: 1
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 3
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 3
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 39
- republication_cooldown_blocked: 2
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (32)
- main_eligible=false (30)
- source_gap_risk=true (30)
- reference_only=true (22)
- briefing_only=true (21)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://source.android.com/docs/compatibility/cts/its-release-notes-17
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

- 선택 기사: cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토; ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지
- Lock된 기사: cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토; ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":2,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, action_hint.; 2pt linked-evidence-limitation (cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토; ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지
- Lock된 기사: cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안; Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토; ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av (duplicate_locked_url); [PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation (duplicate_locked_url); camera: Migrate mojom files from legacy handle to handle - chromiumos/platform2 (duplicate_locked_url); cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안 (duplicate_locked_url); Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토 (duplicate_locked_url); ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":2,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av (duplicate_locked_url); [PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation (duplicate_locked_url); camera: Migrate mojom files from legacy handle to handle - chromiumos/platform2 (duplicate_locked_url); cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안 (duplicate_locked_url); Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토 (duplicate_locked_url); ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지 (duplicate_locked_url)
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, action_hint.; 2pt linked-evidence-limitation (cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지): Article image uses a local fallback visual.
