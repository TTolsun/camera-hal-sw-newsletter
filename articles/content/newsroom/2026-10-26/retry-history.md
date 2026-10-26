# 뉴스레터 재시도 기록 - 2026-10-26

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 92/60 | NEEDS_FIX | 5 | 4 | 0 | 0 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 92/60 | PASS | 5 | 5 | 0 | 0 | 8 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 5
- Final input candidates: 5
- Final eligible candidates: 5
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 3
- android: 0
- camera_driver_image_pipeline: 1
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
- republication_history_main_articles: 51
- republication_cooldown_blocked: 0
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- none

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4381410
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-26
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결; CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지; 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지; 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용; Qualcomm SM8450(Waipio) 플랫폼의 CAMSS 및 독립 CSI2 PHY 리눅스 드라이버 지원 제안
- Lock된 기사: CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결; CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지; 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지; 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용
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
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":2,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결): Article image uses a local fallback visual.; 1pt image-fallback (CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지): Article image uses a local fallback visual.; 1pt image-fallback (단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지): Article image uses a local fallback visual.; 1pt image-fallback (미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm SM8450(Waipio) 플랫폼의 CAMSS 및 독립 CSI2 PHY 리눅스 드라이버 지원 제안): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결; CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지; 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지; 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용; Qualcomm SM8450 플랫폼, 업스트림 CAMSS 드라이버 및 독립 CSI2 PHY 지원 패치 제안
- Lock된 기사: CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결; CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지; 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지; 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용; Qualcomm SM8450 플랫폼, 업스트림 CAMSS 드라이버 및 독립 CSI2 PHY 지원 패치 제안
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: Fix SessionConfigAdapter.reportSurfaceInvalid race - platform/frameworks/support (duplicate_locked_url); Fix ZslControl ring buffer and ImageProxy leaks - platform/frameworks/support (duplicate_locked_url); Keep UseCaseCameraState signals pending on repeating frame failure - platform/frameworks/support (duplicate_locked_url); Fix native thread leak when releasing an unstarted video encoder - platform/frameworks/support (duplicate_locked_url); CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결 (duplicate_locked_url); CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지 (duplicate_locked_url); 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지 (duplicate_locked_url); 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":2,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: Fix SessionConfigAdapter.reportSurfaceInvalid race - platform/frameworks/support (duplicate_locked_url); Fix ZslControl ring buffer and ImageProxy leaks - platform/frameworks/support (duplicate_locked_url); Keep UseCaseCameraState signals pending on repeating frame failure - platform/frameworks/support (duplicate_locked_url); Fix native thread leak when releasing an unstarted video encoder - platform/frameworks/support (duplicate_locked_url); CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결 (duplicate_locked_url); CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지 (duplicate_locked_url); 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지 (duplicate_locked_url); 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용 (duplicate_locked_url)
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결): Article image uses a local fallback visual.; 1pt image-fallback (CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지): Article image uses a local fallback visual.; 1pt image-fallback (단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지): Article image uses a local fallback visual.; 1pt image-fallback (미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용): Article image uses a local fallback visual.; 1pt image-fallback (Qualcomm SM8450 플랫폼, 업스트림 CAMSS 드라이버 및 독립 CSI2 PHY 지원 패치 제안): Article image uses a local fallback visual.
