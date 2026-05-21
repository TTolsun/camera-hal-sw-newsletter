# 뉴스레터 재시도 기록 - 2026-05-21

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | repair-fallback | 89/85 | FAILED_REPAIR_REVIEWABLE | 1 | 0 | 0 | 0 | 0 | 1 | 1 |

## 후보 선택 진단

- Reporter candidates: 3
- Reporter-selected candidates: 0
- Final input candidates: 43
- Final eligible candidates: 3
- Final selected articles: 2
- Deterministic primary articles: 2
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 1
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 2
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (38)
- main_eligible=false (38)
- source_gap_risk=true (38)
- reference_only=true (36)
- briefing_only=true (31)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구
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
- Repair action: editor repair attempt 1/2: fallback-to-last-known-valid-editor
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt claim-binding (Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 1pt claim-binding (Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구): Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; 5pt source-integrity: Fact checker returned 1 must_fix item(s).; 3pt source-integrity: Fact checker reported 1 source gap(s).
