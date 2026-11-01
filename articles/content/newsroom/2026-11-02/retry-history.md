# 뉴스레터 재시도 기록 - 2026-11-02

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 92/60 | NEEDS_FIX | 4 | 3 | 0 | 0 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 92/60 | PASS | 4 | 4 | 0 | 0 | 6 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 5
- Final input candidates: 5
- Final eligible candidates: 5
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 4
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 1
  - article:https://android-review.googlesource.com/c/platform/frameworks/support/+/4393805
    - b2bb17a2944ca9032823dd9816d1dd9f631284f485f3bdb09c81a9bbbb0631e8: coverage_decision=exclude, reason_code=editorial_plan_exclude
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 2
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 4
- Supporting main articles: 0
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
- republication_history_main_articles: 56
- republication_cooldown_blocked: 0
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- none

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4381410
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-11-02
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회; Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가; CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지; Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한
- Lock된 기사: Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회; Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가; CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가): Article image uses a local fallback visual.; 1pt image-fallback (CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지): Article image uses a local fallback visual.; 1pt image-fallback (Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회; Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가; CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지; Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한
- Lock된 기사: Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회; Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가; CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지; Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: Fix video snapshot hang on Sony xq-dq72 - platform/frameworks/support (duplicate_locked_url); Check if buffer's stream set is contained in request metadata of the Frame - platform/frameworks/support (duplicate_locked_url); Clear Recorder.mActiveSurface on surface release - platform/frameworks/support (duplicate_locked_url); Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 (duplicate_locked_url); Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 (duplicate_locked_url); CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: Fix video snapshot hang on Sony xq-dq72 - platform/frameworks/support (duplicate_locked_url); Check if buffer's stream set is contained in request metadata of the Frame - platform/frameworks/support (duplicate_locked_url); Clear Recorder.mActiveSurface on surface release - platform/frameworks/support (duplicate_locked_url); Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 (duplicate_locked_url); Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 (duplicate_locked_url); CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 (duplicate_locked_url)
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가): Article image uses a local fallback visual.; 1pt image-fallback (CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지): Article image uses a local fallback visual.; 1pt image-fallback (Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한): Article image uses a local fallback visual.
