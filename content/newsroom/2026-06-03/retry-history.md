# 뉴스레터 재시도 기록 - 2026-06-03

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 88/60 | PASS | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 4
- Reporter-selected candidates: 3
- Final input candidates: 41
- Final eligible candidates: 3
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 2
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 3
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 3

Source/parser recovery hint:
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (33)
- main_eligible=false (32)
- source_gap_risk=true (32)
- reference_only=true (30)
- briefing_only=true (27)

Homepage Headline:
- decision: retained_current_above_margin
- current_headline_key: url:https://goo.gle/AdaptiveApps_IO26
- replacement_headline_key: unknown
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: 98
- previous_stored_current_score: 100
- last_scored_at: 2026-06-02
- scored_at: 2026-06-03
- included_as_latest: true
- latest_inclusion_mode: injected_from_headline_snapshot
- injected_from_snapshot: true
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영
- Lock된 기사: CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: Google I/O 2026: Jetpack Compose와 CameraX가 이끄는 다중 기기 적응형 카메라 미리보기 혁신 (finalSelectionEligibility=unknown)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt source-integrity (CameraX 1.6.0 정식 릴리스: 유스케이스 조합 지원 사전 쿼리 API 도입 및 기기별 스트림/버퍼 호환성 패치 대거 반영): CameraX source extraction failure: CameraX HAL boundary is missing from the article. (adjacent-content publishing: soft note, not a publish blocker); 1pt scope-relevance: 1 final-selected candidate(s) have weak HAL/actionability scores under the expanded AOSP Camera / driver / SoC / native relevance model. (adjacent-content publishing: soft note, not a publish blocker)
