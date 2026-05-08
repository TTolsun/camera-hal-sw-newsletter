# 뉴스레터 재시도 기록 - 2026-05-08

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | repair-fallback | 59/85 | FAILED_REPAIR_REVIEWABLE | 3 | 0 | 0 | 0 | 0 | 0 | 12 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 0
- Final input candidates: 40
- Final eligible candidates: 6
- Final selected articles: 5
- Deterministic primary articles: 5
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 3
- camera_driver_image_pipeline: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 4
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 4

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- main_eligible=false (34)
- source_gap_risk=true (34)
- reference_only=true (32)
- briefing_only=true (20)
- finalSelectionEligibility=watchlist (20)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.4.0-alpha07 업데이트: 뷰파인더 및 비디오 모듈 변경; libcamera v0.7.1 출시: SoftISP 및 이미지 파이프라인 개선; GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":3,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt image-fallback (libcamera v0.7.1 출시: SoftISP 및 이미지 파이프라인 개선): Article image uses a local fallback visual.; 8pt source-integrity (GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정): Shared watch/release-note URL requires matching version_or_release or published_date evidence.; 8pt scope-relevance (GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정): Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.; 8pt hal-relevance (GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정): Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.; 1pt image-fallback (GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 12 must_fix item(s).
