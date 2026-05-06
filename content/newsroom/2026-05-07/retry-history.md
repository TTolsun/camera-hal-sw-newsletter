# 뉴스레터 재시도 기록 - 2026-05-07

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash-lite | 83/85 | NEEDS_FIX | 4 | 0 | 0 | 0 | 1 | 0 | 4 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 83/85 | NEEDS_FIX | 4 | 0 | 1 | 0 | 1 | 0 | 3 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 0
- Final input candidates: 40
- Final eligible candidates: 5
- Final selected articles: 5
- Deterministic primary articles: 5
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 3
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 2
- Non-fallback reviewable: 3

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- main_eligible=false (35)
- source_gap_risk=true (35)
- reference_only=true (33)
- briefing_only=true (25)
- finalSelectionEligibility=watchlist (25)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: libcamera v0.7.1 릴리스: 파이프라인 및 센서 구성 업데이트; Glaze v7.2.0 릴리스: C++26 Reflection 통합 및 다중 형식 지원 강화; GCC 16.1 릴리스: C++26 기능 지원 및 안전성 강화; libcamera v0.7.1 릴리스: SoftISP 디베이어링 및 처리량 개선
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: libcamera Release Announcements - libcamera v0.7.1 (duplicate_locked_url); libcamera v0.7.1 - pipeline handler and sensor configuration (duplicate_locked_url); Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack, TOML and more (duplicate_locked_url); libcamera Release Announcements - libcamera v0.7.1 (duplicate_locked_url); libcamera v0.7.1 - pipeline handler and sensor configuration (duplicate_locked_url); GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! (duplicate_locked_url); Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack, TOML and more (duplicate_locked_url); libcamera v0.7.1 릴리스: SoftISP 디베이어링 및 처리량 개선 (duplicate_locked_url)
- Underfilled reason: 없음
- 실패 section: GCC 16.1 릴리스: C++26 기능 지원 및 안전성 강화
- 재생성 section: GCC 16.1 릴리스: C++26 기능 지원 및 안전성 강화
- 거절된 retry output: 없음
- Repair action: repair-section: GCC 16.1 릴리스: C++26 기능 지원 및 안전성 강화; complete-missing-articles: requested 1, added 1
- Final slot distribution: {"android_camera_platform_api":1,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":3,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: libcamera v0.7.1 릴리스: SoftISP 디베이어링 및 처리량 개선 (duplicate_locked_url)
- 감점: 1pt image-fallback (Glaze v7.2.0 릴리스: C++26 Reflection 통합 및 다중 형식 지원 강화): Article image uses a local fallback visual.; 1pt image-fallback (GCC 16.1 릴리스: C++26 기능 지원 및 안전성 강화): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 4 must_fix item(s).

## 시도 2

- 선택 기사: libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선; libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트; libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선; Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등
- Replaced section: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등
- Reserve candidate used: 없음
- Candidate rejection: libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 (duplicate_locked_url); libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 (duplicate_locked_url); libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 (duplicate_locked_url); GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등 (duplicate_demoted_url); Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원 (duplicate_locked_url); GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등 (duplicate_demoted_url)
- Underfilled reason: 없음
- 실패 section: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등
- 재생성 section: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등
- 거절된 retry output: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등 (duplicate_demoted_url)
- Repair action: replace-or-demote: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":2,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: GCC 16.1 릴리스: C++26 Reflection, Contracts, C++20 기본 설정 등 (duplicate_demoted_url)
- 감점: 1pt image-fallback (libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선): Article image uses a local fallback visual.; 1pt image-fallback (Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 3 must_fix item(s).
