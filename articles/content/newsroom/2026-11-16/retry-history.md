# 뉴스레터 재시도 기록 - 2026-11-16

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 61/60 | NEEDS_FIX | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 94/60 | PASS | 5 | 5 | 0 | 0 | 2 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 78
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 5
- android: 0
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 5
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 1
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 63
- republication_cooldown_blocked: 0
- evidence_unchecked_main_blocked: 3

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- No eligible camera driver candidate is available in this pool. Check dated Linux camera, V4L2, libcamera, sensor and ISP signals and their exclusion reasons.

주요 final exclusion reason:
- missing dated evidence (31)
- finalSelectionEligibility=unknown (28)
- selection_window=unknown_not_main (28)
- final_selection_blocked=true (21)
- main_eligible=false (21)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4423978
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4439489
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-11-16
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합; CameraX SessionConfig 빠른 세션 전환 1단계 병합: 세션 재구성 없는 UseCase 서브셋 동적 전환; Camera2-pipe FrameGraph 버퍼 프레임 필터링 로직 개편: TagBundle 기반 정밀 라우팅 지원; PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백; Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 확인 유틸리티 함수 확장
- Lock된 기사: Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: CameraX SessionConfig 빠른 세션 전환 1단계 병합: 세션 재구성 없는 UseCase 서브셋 동적 전환
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): CameraX SessionConfig 빠른 세션 전환 1단계 병합: 세션 재구성 없는 UseCase 서브셋 동적 전환
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":5,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (CameraX SessionConfig 빠른 세션 전환 1단계 병합: 세션 재구성 없는 UseCase 서브셋 동적 전환): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (CameraX SessionConfig 빠른 세션 전환 1단계 병합: 세션 재구성 없는 UseCase 서브셋 동적 전환): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (Camera2-pipe FrameGraph 버퍼 프레임 필터링 로직 개편: TagBundle 기반 정밀 라우팅 지원): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (Camera2-pipe FrameGraph 버퍼 프레임 필터링 로직 개편: TagBundle 기반 정밀 라우팅 지원): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 확인 유틸리티 함수 확장): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 확인 유틸리티 함수 확장): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합; Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 여부 조회 확장 함수 추가; CameraX SessionConfig 빠른 세션 전환 1단계: 세션 재구성 없는 UseCase 서브셋 동적 전환 병합; Camera2-pipe FrameGraph 버퍼 프레임 필터링 개편: TagBundle 기반 정밀 라우팅 지원; PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백
- Lock된 기사: Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합; Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 여부 조회 확장 함수 추가; CameraX SessionConfig 빠른 세션 전환 1단계: 세션 재구성 없는 UseCase 서브셋 동적 전환 병합; Camera2-pipe FrameGraph 버퍼 프레임 필터링 개편: TagBundle 기반 정밀 라우팅 지원; PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: Disable abortCaptures on stop for Galaxy A54 5G - platform/frameworks/support (duplicate_locked_url); Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":2,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: Disable abortCaptures on stop for Galaxy A54 5G - platform/frameworks/support (duplicate_locked_url); Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합 (duplicate_locked_url)
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt image-fallback (Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합): Article image uses a local fallback visual.; 1pt image-fallback (Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 여부 조회 확장 함수 추가): Article image uses a local fallback visual.; 1pt image-fallback (CameraX SessionConfig 빠른 세션 전환 1단계: 세션 재구성 없는 UseCase 서브셋 동적 전환 병합): Article image uses a local fallback visual.; 1pt image-fallback (Camera2-pipe FrameGraph 버퍼 프레임 필터링 개편: TagBundle 기반 정밀 라우팅 지원): Article image uses a local fallback visual.; 1pt image-fallback (PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백): Article image uses a local fallback visual.
