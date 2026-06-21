# 뉴스레터 재시도 기록 - 2026-06-21

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 96/60 | PASS | 3 | 3 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 7
- Reporter-selected candidates: 5
- Final input candidates: 51
- Final eligible candidates: 7
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 2
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (35)
- main_eligible=false (35)
- source_gap_risk=true (35)
- reference_only=true (32)
- missing dated evidence (21)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260619-hm1246-v10-0-d88e431a6c11@emfend.at
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260620132749.GE3552167@killaraus.ideasonboard.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-21
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Linux 커널 미디어 메일링 리스트에 Himax HM1246 이미지 센서 드라이버 추가 패치 v10 제출; Sony IMX576 이미지 센서용 V4L2 드라이버 추가 패치 v2 제출; GCC 16 신규 기능 공개: 템플릿 오류 메시지 개선 및 SARIF 표준 출력 지원
- Lock된 기사: Linux 커널 미디어 메일링 리스트에 Himax HM1246 이미지 센서 드라이버 추가 패치 v10 제출; Sony IMX576 이미지 센서용 V4L2 드라이버 추가 패치 v2 제출; GCC 16 신규 기능 공개: 템플릿 오류 메시지 개선 및 SARIF 표준 출력 지원
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":3,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: The Linux Kernel Archives (evidence_score=0 < 6); linux-media.vger.kernel.org archive mirror (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (Linux 커널 미디어 메일링 리스트에 Himax HM1246 이미지 센서 드라이버 추가 패치 v10 제출): Article image uses a local fallback visual.; 1pt image-fallback (Sony IMX576 이미지 센서용 V4L2 드라이버 추가 패치 v2 제출): Article image uses a local fallback visual.
