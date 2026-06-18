# 뉴스레터 재시도 기록 - 2026-06-18

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 95/60 | PASS | 3 | 3 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 7
- Reporter-selected candidates: 5
- Final input candidates: 51
- Final eligible candidates: 6
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
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (31)
- main_eligible=false (30)
- source_gap_risk=true (30)
- reference_only=true (23)
- briefing_only=true (19)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260617-imx8qxp_pcam-v5-6-7fa6c8e7fba7@nxp.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-18
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: 지난 3월 출시된 CameraX 1.6.0: 사전 유스케이스 조합 쿼리 API 도입 및 삼성 기기 호환성 패치 대거 반영; 최근 공개된 NXP i.MX8/i.MX9 SoC용 CPI 병렬 카메라 인터페이스 V4L2 서브디바이스 드라이버 v5 패치; 최근 공개된 GCC 16: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원으로 네이티브 개발 생산성 향상
- Lock된 기사: 지난 3월 출시된 CameraX 1.6.0: 사전 유스케이스 조합 쿼리 API 도입 및 삼성 기기 호환성 패치 대거 반영; 최근 공개된 NXP i.MX8/i.MX9 SoC용 CPI 병렬 카메라 인터페이스 V4L2 서브디바이스 드라이버 v5 패치; 최근 공개된 GCC 16: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원으로 네이티브 개발 생산성 향상
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
- Rejected main-ineligible candidate: Android Compatibility Definition Document &nbsp;|&nbsp; Android Open Source Project (evidence_score=0 < 6); [PATCH v3 3/3] media: uvcvideo: skip streaming restart after hibernation snapshot - Haowen Tu (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (지난 3월 출시된 CameraX 1.6.0: 사전 유스케이스 조합 쿼리 API 도입 및 삼성 기기 호환성 패치 대거 반영): Article image uses a local fallback visual.; 1pt image-fallback (최근 공개된 NXP i.MX8/i.MX9 SoC용 CPI 병렬 카메라 인터페이스 V4L2 서브디바이스 드라이버 v5 패치): Article image uses a local fallback visual.; 1pt image-fallback (최근 공개된 GCC 16: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원으로 네이티브 개발 생산성 향상): Article image uses a local fallback visual.
