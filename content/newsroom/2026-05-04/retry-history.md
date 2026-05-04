# 뉴스레터 재시도 기록 - 2026-05-04

| 시도 | 모델 | 점수 | 상태 | Locked | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 77/85 | NEEDS_FIX | 0 | 0 | 0 | 6 |
| 2 | reporter=gemini-2.5-flash, editor=gemini-2.5-flash, fact-checker=gemini-2.5-flash | 77/85 | NEEDS_FIX | 2 | 0 | 0 | 1 |

## 후보 선택 진단

- Reporter candidates: 9
- Reporter-selected candidates: 0
- Final input candidates: 40
- Final eligible candidates: 10
- Final selected articles: 5
- Reporter-selected but final-excluded: 0

주요 final exclusion reason:
- main_eligible=false (30)
- source_gap_risk=true (30)
- finalSelectionEligibility=exclude (22)
- reference_only=true (10)
- briefing_only=true (8)

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Android 하이브리드 추론 및 새로운 Gemini 모델 지원; Android 17 베타 4 출시: 앱 호환성 및 플랫폼 안정성 강화; Linux 7.1, Steam Deck OLED 오디오 문제 해결; Linux 7.1-rc2, 오래된 AMD GPU 드라이버 개선 및 수정 포함
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- 실패 section: 없음
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: 없음
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: hal-relevance: Expected at least 2 Camera HAL / Android Camera articles, found 1.
- 거절된 중복 기사: 없음
- 감점: 8pt hal-relevance: Expected at least 2 Camera HAL / Android Camera articles, found 1.; 15pt source-integrity: Fact checker returned 6 must_fix item(s).

## 시도 2

- 선택 기사: Android 17 베타 4 출시: 플랫폼 안정성 최종 점검; Linux 7.1-rc2, 구형 AMD GPU 드라이버 개선 및 수정; 2026년 4월 17일: Android 하이브리드 추론 및 Gemini 모델 지원 (Firebase AI Logic API); 2026년 5월 2일: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개
- Lock된 기사: Android 17 베타 4 출시: 플랫폼 안정성 최종 점검; Linux 7.1-rc2, 구형 AMD GPU 드라이버 개선 및 수정
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- 실패 section: Android 하이브리드 추론 및 새로운 Gemini 모델 지원; VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개
- 재생성 section: 2026년 4월 17일: Android 하이브리드 추론 및 Gemini 모델 지원 (Firebase AI Logic API); 2026년 5월 2일: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개
- 거절된 retry output: 없음
- Repair action: repair-section: Android 하이브리드 추론 및 새로운 Gemini 모델 지원; repair-section: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 5pt evidence-specificity (2026년 4월 17일: Android 하이브리드 추론 및 Gemini 모델 지원 (Firebase AI Logic API)): Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; 4pt evidence-specificity (2026년 4월 17일: Android 하이브리드 추론 및 Gemini 모델 지원 (Firebase AI Logic API)): Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.; 5pt evidence-specificity (2026년 5월 2일: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개): Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.; 4pt evidence-specificity (2026년 5월 2일: VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개): Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.; 5pt source-integrity: Fact checker returned 1 must_fix item(s).
