# 뉴스레터 재시도 기록 - 2026-10-05

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 83/60 | NEEDS_FIX | 1 | 0 | 1 | 0 | 0 | 0 | 4 |
| 2 | repair-fallback | 83/60 | FAILED_REPAIR_REVIEWABLE | 1 | 0 | 0 | 0 | 0 | 0 | 4 |
| 3 | manual editorial revision; gemini-3.5-flash review | 98/60 | PASS | 2 | 0 | 0 | 0 | 0 | 0 | 0 |



## 시도 1

- 선택 기사: Android 17 Camera ITS 업데이트 분석: 테스트 병렬화와 신규 검증 항목 도입
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: libcamera 자동 화이트 밸런스 제어 확장: 상태 세분화와 수동 게인 고정 메커니즘 도입
- Replaced section: libcamera 자동 화이트 밸런스 제어 확장: 상태 세분화와 수동 게인 고정 메커니즘 도입
- Reserve candidate used: 없음
- Candidate rejection: Android 17 Camera Image Test Suite release notes | Android Open Source Project (duplicate_locked_url); [1/5] libcamera: controls: Expand AWB controls (duplicate_demoted_url)
- Underfilled reason: missing 1 article(s); no eligible non-duplicate primary/reserve completion candidate remains
- 실패 section: libcamera 자동 화이트 밸런스 제어 확장: 상태 세분화와 수동 게인 고정 메커니즘 도입
- 재생성 section: 없음
- 거절된 retry output: 없음
- Repair action: replace-or-demote(deterministic-demote): libcamera 자동 화이트 밸런스 제어 확장: 상태 세분화와 수동 게인 고정 메커니즘 도입
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 15pt source-integrity: Fact checker returned 4 must_fix item(s).

## 시도 2

- 선택 기사: Android 17 Camera ITS 업데이트 분석: 테스트 병렬화와 신규 검증 항목 도입
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
- Repair action: editor attempt 2/2: fallback-to-last-known-valid-editor
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 15pt source-integrity: Fact checker returned 4 must_fix item(s).

## 시도 3

- 선택 기사: Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목; libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기
- Lock된 기사: 없음
- Source gap section: 없음
- Demoted section: 없음
- Replaced section: 없음
- Reserve candidate used: 없음
- Candidate rejection: 없음
- Underfilled reason: 없음
- 실패 section: 없음
- 재생성 section: Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목; libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기
- 거절된 retry output: 없음
- Repair action: 원문 대조에 따라 두 기사를 직접 교정하고 새 팩트체크와 독립 원문 검토를 통과했습니다.
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":0,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: 없음
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt image-fallback (libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기): Article image uses a local fallback visual.
