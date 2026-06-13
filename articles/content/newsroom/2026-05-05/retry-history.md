# 뉴스레터 재시도 기록 - 2026-05-05

| 시도 | 모델 | 점수 | 상태 | Locked | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 89/85 | NEEDS_FIX | 4 | 0 | 0 | 0 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 74/85 | NEEDS_FIX | 4 | 8 | 0 | 6 |

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
- finalSelectionEligibility=exclude (22)
- reference_only=true (12)
- briefing_only=true (9)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android용 하이브리드 추론 및 새로운 Gemini 모델: 카메라 프레임 처리 영향; C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대; Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향; FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점; 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수
- Lock된 기사: C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대; Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향; FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점; 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- 실패 section: 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수
- 재생성 section: 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수
- 거절된 retry output: 없음
- Repair action: repair-section: 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":4,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 5pt evidence-specificity (Android용 하이브리드 추론 및 새로운 Gemini 모델: 카메라 프레임 처리 영향): Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; 4pt evidence-specificity (Android용 하이브리드 추론 및 새로운 Gemini 모델: 카메라 프레임 처리 영향): Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.; 1pt image-fallback (C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대): Article image uses a local fallback visual.; 1pt image-fallback (FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점): Article image uses a local fallback visual.

## 시도 2

- 선택 기사: Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향; FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점; 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수; Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원; C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대
- Lock된 기사: C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대; Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향; FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점; 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- 실패 section: C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대
- 재생성 section: C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대
- 거절된 retry output: 없음
- Repair action: repair-section: C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":4,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대 (duplicate locked article); 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수 (duplicate locked article); Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향 (duplicate locked article); FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점 (duplicate locked article); 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수 (duplicate locked article); C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대 (duplicate locked article); Claude Code 2.1.128 출시: AI 코딩 에이전트의 HAL 개발 워크플로우 영향 (duplicate locked article); FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점 (duplicate locked article)
- 감점: 1pt image-fallback (FreeBSD 15.1 Beta 출시: Android Linux 커널 카메라 스택에 대한 간접적 시사점): Article image uses a local fallback visual.; 5pt evidence-specificity (Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원): Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; 4pt evidence-specificity (Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델 지원): Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.; 1pt image-fallback (C++26: assert() 매크로 개선으로 HAL 디버깅 효율성 향상 기대): Article image uses a local fallback visual.; 15pt source-integrity: Fact checker returned 6 must_fix item(s).
