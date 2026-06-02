# 뉴스레터 재시도 기록 - 2026-06-02

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | repair-fallback | 36/85 | FAILED_REPAIR_REVIEWABLE | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 4
- Reporter-selected candidates: 2
- Final input candidates: 45
- Final eligible candidates: 4
- Final selected articles: 2
- Deterministic primary articles: 2
- Selected representative groups: 2
- Rendered groups: 2
- Explicitly demoted groups: 0
- Reserve candidates: 0
- Demoted candidates: unknown
- Composition mode: NEEDS_FIX
- Editor review required: true
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 1
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 1

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (39)
- main_eligible=false (39)
- source_gap_risk=true (39)
- reference_only=true (31)
- briefing_only=true (27)

Homepage Headline:
- decision: retained_current_above_margin
- current_headline_key: url:https://goo.gle/AdaptiveApps_IO26
- replacement_headline_key: unknown
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: 100
- previous_stored_current_score: 100
- last_scored_at: 2026-06-02
- scored_at: 2026-06-02
- included_as_latest: true
- latest_inclusion_mode: selected_normally
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Jetpack Compose와 CameraX 통합을 통한 대화면 및 폴더블 기기 적응형 카메라 미리보기 지원; Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 8pt source-integrity (Jetpack Compose와 CameraX 통합을 통한 대화면 및 폴더블 기기 적응형 카메라 미리보기 지원): Shared watch/release-note URL requires matching version_or_release or published_date evidence.; 8pt claim-evidence (Jetpack Compose와 CameraX 통합을 통한 대화면 및 폴더블 기기 적응형 카메라 미리보기 지원): Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.; 8pt scope-relevance (Jetpack Compose와 CameraX 통합을 통한 대화면 및 폴더블 기기 적응형 카메라 미리보기 지원): Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.; 1pt image-fallback (Jetpack Compose와 CameraX 통합을 통한 대화면 및 폴더블 기기 적응형 카메라 미리보기 지원): Article image uses a local fallback visual.; 8pt source-integrity (Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화): Shared watch/release-note URL requires matching version_or_release or published_date evidence.; 8pt claim-evidence (Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화): Claim references unresolved evidence_id: candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary.; 8pt scope-relevance (Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화): Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.; 6pt hal-signal (Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화): Fallback article lacks fallback_promotion_allowed=true or fallback_promotion_reason before main promotion.; 8pt hal-relevance (Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화): Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.; 1pt image-fallback (Google AI Studio의 프롬프트 기반 Android 앱 빌드 기능을 통한 개발 워크플로우 가속화): Article image uses a local fallback visual.
