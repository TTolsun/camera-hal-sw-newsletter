# 뉴스레터 재시도 기록 - 2026-10-15

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 94/60 | NEEDS_FIX | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 94/60 | PASS | 3 | 3 | 0 | 0 | 4 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 3
- Reporter-selected candidates: 3
- Final input candidates: 3
- Final eligible candidates: 3
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 3
- android: 0
- camera_driver_image_pipeline: 0
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
- republication_history_main_articles: 45
- republication_cooldown_blocked: 0
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- No eligible camera driver candidate is available in this pool. Check dated Linux camera, V4L2, libcamera, sensor and ISP signals and their exclusion reasons.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- none

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-15
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화; 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한; CameraPipe의 CaptureSessionState 상태 모델 및 출력 동기화 재작업
- Lock된 기사: Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화; 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한
- Final slot distribution: {"android_camera_platform_api":2,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화): Article image uses a local fallback visual.; 1pt image-fallback (10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한): Article image uses a local fallback visual.; 1pt image-fallback (CameraPipe의 CaptureSessionState 상태 모델 및 출력 동기화 재작업): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화; 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한; CameraPipe CaptureSessionState 개편으로 지연 서피스 요청 누락 방지
- Lock된 기사: Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화; 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한; CameraPipe CaptureSessionState 개편으로 지연 서피스 요청 누락 방지
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: Close camera device on graph close to prevent session reconfiguration stalls - platform/frameworks/support (duplicate_locked_url); Gate dynamic range profiles on DYNAMIC_RANGE_TEN_BIT capability - platform/frameworks/support (duplicate_locked_url); Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화 (duplicate_locked_url); 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":2,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: Close camera device on graph close to prevent session reconfiguration stalls - platform/frameworks/support (duplicate_locked_url); Gate dynamic range profiles on DYNAMIC_RANGE_TEN_BIT capability - platform/frameworks/support (duplicate_locked_url); Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화 (duplicate_locked_url); 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한 (duplicate_locked_url)
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화): Article image uses a local fallback visual.; 1pt image-fallback (10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한): Article image uses a local fallback visual.; 1pt image-fallback (CameraPipe CaptureSessionState 개편으로 지연 서피스 요청 누락 방지): Article image uses a local fallback visual.
