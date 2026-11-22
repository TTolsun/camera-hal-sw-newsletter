# 뉴스레터 재시도 기록 - 2026-11-23

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.8-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-3.8-flash | 48/60 | NEEDS_FIX | 5 | 1 | 0 | 0 | 0 | 0 | 1 |
| 2 | repair-fallback | 48/60 | FAILED_REPAIR_REVIEWABLE | 5 | 0 | 0 | 0 | 0 | 0 | 1 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 55
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: 4
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 1
  - article:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0
    - 0d96eee1501c272d55c621920bc7b2e33a6e997c644b1a89b7844ed2db28512a: coverage_decision=main_article, reason_code=cap_clamp
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
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
- republication_history_main_articles: 68
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 2

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (20)
- main_eligible=false (20)
- source_gap_risk=true (20)
- briefing_only=true (16)
- finalSelectionEligibility=watchlist (16)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4439489
- replacement_headline_key: url:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-11-23
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원; Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응; OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정; Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지; HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결
- Lock된 기사: CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: repair-section(patch): Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응
- Final slot distribution: {"android_camera_platform_api":2,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 8pt linked-evidence-overclaim (Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결): Article image uses a local fallback visual.; 5pt source-integrity: Fact checker returned 1 must_fix item(s).

## 시도 2

- 선택 기사: CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원; Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응; OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정; Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지; HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결
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
- Repair action: generation: fallback-to-last-known-valid-editor
- Final slot distribution: {"android_camera_platform_api":2,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: what_happened.; 8pt linked-evidence-overclaim (Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지): Article image uses a local fallback visual.; 8pt linked-evidence-overclaim (HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결): Article describes unresolved linked evidence as confirmed detail.; 2pt linked-evidence-limitation (HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결): Article image uses a local fallback visual.; 5pt source-integrity: Fact checker returned 1 must_fix item(s).
