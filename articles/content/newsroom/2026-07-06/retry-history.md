# 뉴스레터 재시도 기록 - 2026-07-06

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash-lite, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 94/60 | PASS | 3 | 3 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 4
- Final input candidates: 44
- Final eligible candidates: 5
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 1
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 1
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (33)
- main_eligible=false (33)
- source_gap_risk=true (33)
- reference_only=true (27)
- finalSelectionEligibility=exclude (17)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/202606291022.4ZXe8Dz4-lkp@intel.com
- replacement_headline_key: url:https://patchwork.libcamera.org/patch/27198
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-07-06
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.7.0-alpha02 공개: GPU 기반 이미지 분석 및 야간 모드 상태 모니터링 API 도입; libcamera 패치 제안: 센서 시퀀스 제어를 위한 SensorSequence 메타데이터 컨트롤 추가; LLVM/Clang 빌드 환경에서 발생하는 dw2102 미디어 드라이버 버퍼 오버플로우 수정 패치
- Lock된 기사: CameraX 1.7.0-alpha02 공개: GPU 기반 이미지 분석 및 야간 모드 상태 모니터링 API 도입; libcamera 패치 제안: 센서 시퀀스 제어를 위한 SensorSequence 메타데이터 컨트롤 추가; LLVM/Clang 빌드 환경에서 발생하는 dw2102 미디어 드라이버 버퍼 오버플로우 수정 패치
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [PATCH] media: dw2102: Fix a buffer overflow - Maksim Pinigin (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 2pt linked-evidence-limitation (CameraX 1.7.0-alpha02 공개: GPU 기반 이미지 분석 및 야간 모드 상태 모니터링 API 도입): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (CameraX 1.7.0-alpha02 공개: GPU 기반 이미지 분석 및 야간 모드 상태 모니터링 API 도입): Article image uses a local fallback visual.; 1pt image-fallback (libcamera 패치 제안: 센서 시퀀스 제어를 위한 SensorSequence 메타데이터 컨트롤 추가): Article image uses a local fallback visual.; 1pt image-fallback (LLVM/Clang 빌드 환경에서 발생하는 dw2102 미디어 드라이버 버퍼 오버플로우 수정 패치): Article image uses a local fallback visual.
