# 뉴스레터 재시도 기록 - 2026-06-17

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | repair-fallback | 71/60 | FAILED_REPAIR_REVIEWABLE | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 8
- Reporter-selected candidates: 5
- Final input candidates: 68
- Final eligible candidates: 6
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: 2
- Explicitly demoted groups: 0
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 2
- direct_aosp_camera: 2
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (34)
- main_eligible=false (32)
- source_gap_risk=true (32)
- missing dated evidence (28)
- reference_only=true (25)

Homepage Headline:
- decision: retained_no_eligible_candidate
- current_headline_key: url:https://developer.android.com/tools/agents/android-cli
- replacement_headline_key: url:https://developer.android.com/tools/agents/android-cli
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-17
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.6.1 릴리스: ListenableFuture 컴파일 에러 수정 및 기기별 카메라 오동작 해결; Camera_ITS_문서_업데이트:_Honor_Pad_20_태블릿_허용_목록_추가_및_장면_실행_지침_재정렬
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
- Repair action: editor completion attempt 1/2: fallback-to-last-known-valid-editor
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":2,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 2pt linked-evidence-limitation (CameraX 1.6.1 릴리스: ListenableFuture 컴파일 에러 수정 및 기기별 카메라 오동작 해결): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (CameraX 1.6.1 릴리스: ListenableFuture 컴파일 에러 수정 및 기기별 카메라 오동작 해결): Article image uses a local fallback visual.; 8pt source-integrity (Camera_ITS_문서_업데이트:_Honor_Pad_20_태블릿_허용_목록_추가_및_장면_실행_지침_재정렬): Shared watch/release-note URL requires matching version_or_release or published_date evidence.; 8pt claim-evidence (Camera_ITS_문서_업데이트:_Honor_Pad_20_태블릿_허용_목록_추가_및_장면_실행_지침_재정렬): Claim references unresolved evidence_id: candidate:bb0e15b6742fce01:source-summary.; 8pt claim-evidence (Camera_ITS_문서_업데이트:_Honor_Pad_20_태블릿_허용_목록_추가_및_장면_실행_지침_재정렬): Claim references unresolved evidence_id: candidate:bb0e15b6742fce01:source-summary.
