# 뉴스레터 재시도 기록 - 2026-05-05

| 시도 | 모델 | 점수 | 상태 | Locked | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 75/85 | NEEDS_FIX | 1 | 0 | 2 | 2 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 72/85 | NEEDS_FIX | 1 | 6 | 0 | 2 |

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 0
- Final input candidates: 40
- Final eligible candidates: 9
- Final selected articles: 5
- Reporter-selected but final-excluded: 0

주요 final exclusion reason:
- main_eligible=false (31)
- source_gap_risk=true (31)
- finalSelectionEligibility=exclude (25)
- reference_only=true (9)
- briefing_only=true (6)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선; Linux 커널 7.1-rc2 출시: 카메라 드라이버 안정성 관련 잠재적 영향; GCC 16.1 컴파일러 출시: C++ 네이티브 코드 성능 최적화 인사이트; Android용 하이브리드 추론 및 새로운 Gemini 모델 지원
- Lock된 기사: Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선
- Source gap section: Linux 커널 7.1-rc2 출시: 카메라 드라이버 안정성 관련 잠재적 영향
- Demoted section: Linux 커널 7.1-rc2 출시: 카메라 드라이버 안정성 관련 잠재적 영향
- Replaced section: 없음
- 실패 section: Android용 하이브리드 추론 및 새로운 Gemini 모델 지원
- 재생성 section: Android용 하이브리드 추론 및 새로운 Gemini 모델 지원
- 거절된 retry output: 없음
- Repair action: repair-section: Android용 하이브리드 추론 및 새로운 Gemini 모델 지원
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 5pt evidence-specificity (Android용 하이브리드 추론 및 새로운 Gemini 모델 지원): Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; 4pt evidence-specificity (Android용 하이브리드 추론 및 새로운 Gemini 모델 지원): Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.; 10pt source-integrity: Fact checker returned 2 must_fix item(s).; 6pt source-integrity: Fact checker reported 2 source gap(s).

## 시도 2

- 선택 기사: Android용 하이브리드 추론 및 새로운 Gemini 모델 지원; GCC 16.1 컴파일러 출시: 성능 향상 및 C++ 네이티브 코드에 대한 시사점; FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향
- Lock된 기사: Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선
- Source gap section: 없음
- Demoted section: Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선
- Replaced section: 없음
- 실패 section: Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선
- 재생성 section: Android용 하이브리드 추론 및 새로운 Gemini 모델 지원; FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향; GCC 16 Compiler Delivering Some Decent Performance Gains Over GCC 15
- 거절된 retry output: Android용 하이브리드 추론 및 새로운 Gemini 모델 지원 (duplicate locked article); FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향 (duplicate locked article); GCC 16 Compiler Delivering Some Decent Performance Gains Over GCC 15 (duplicate locked article)
- Repair action: replace-or-demote: Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: composition: Expected 4-5 main articles, found 3.; hal-relevance: Expected at least 2 Camera HAL / Android Camera articles, found 0.
- 거절된 중복 기사: Linux 7.1-rc2 Released With Audio Fix For Steam Deck OLED, Other Fixes (excluded source-gap or demoted article); The Fourth Beta of Android 17 (duplicate locked article); Android 17 Beta 4 출시: 플랫폼 안정성 및 호환성 개선 (duplicate locked article); Android용 하이브리드 추론 및 새로운 Gemini 모델 지원 (duplicate locked article); FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향 (duplicate locked article); GCC 16 Compiler Delivering Some Decent Performance Gains Over GCC 15 (duplicate locked article)
- 감점: 4pt composition: Expected 4-5 main articles, found 3.; 8pt hal-relevance: Expected at least 2 Camera HAL / Android Camera articles, found 0.; 1pt image-fallback (Android용 하이브리드 추론 및 새로운 Gemini 모델 지원): Article image uses a local fallback visual.; 4pt actionability (FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향): Article action item is not concrete enough for a HAL engineering team.; 1pt image-fallback (FreeBSD 15.1 Beta 1 출시: Linux 카메라/미디어 생태계 동향): Article image uses a local fallback visual.; 10pt source-integrity: Fact checker returned 2 must_fix item(s).
