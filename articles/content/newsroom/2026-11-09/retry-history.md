# 뉴스레터 재시도 기록 - 2026-11-09

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 62/60 | NEEDS_FIX | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 94/60 | PASS | 5 | 5 | 0 | 0 | 2 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 71
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
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 60
- republication_cooldown_blocked: 0
- evidence_unchecked_main_blocked: 2

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- missing dated evidence (25)
- final_selection_blocked=true (21)
- finalSelectionEligibility=unknown (21)
- main_eligible=false (21)
- selection_window=unknown_not_main (21)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4411322
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-11-09
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정; Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가; CameraX 엔지니어링 에이전트에 5-Gate 심층 근본 원인 분석 프로토콜 적용; redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리; 갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합
- Lock된 기사: CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":3,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":1,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 8pt linked-evidence-overclaim (Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (CameraX 엔지니어링 에이전트에 5-Gate 심층 근본 원인 분석 프로토콜 적용): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (CameraX 엔지니어링 에이전트에 5-Gate 심층 근본 원인 분석 프로토콜 적용): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합): Article describes unresolved linked evidence as confirmed detail.; 1pt image-fallback (갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정; Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가; CameraX 개발 환경에 5-Gate 심층 근본 원인 분석 프로토콜 적용; redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리; 갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합
- Lock된 기사: CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정; Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가; CameraX 개발 환경에 5-Gate 심층 근본 원인 분석 프로토콜 적용; redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리; 갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: CameraX Release Notes - CameraX 1.7.0-rc02 (duplicate_locked_url); CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":3,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: CameraX Release Notes - CameraX 1.7.0-rc02 (duplicate_locked_url); CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정 (duplicate_locked_url)
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt image-fallback (Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가): Article image uses a local fallback visual.; 1pt image-fallback (CameraX 개발 환경에 5-Gate 심층 근본 원인 분석 프로토콜 적용): Article image uses a local fallback visual.; 1pt image-fallback (redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리): Article image uses a local fallback visual.; 1pt image-fallback (갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합): Article image uses a local fallback visual.
