# 뉴스레터 재시도 기록 - 2026-06-19

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 96/60 | PASS | 3 | 3 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 5
- Final input candidates: 80
- Final eligible candidates: 12
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
- final_selection_blocked=true (47)
- main_eligible=false (45)
- source_gap_risk=true (45)
- missing dated evidence (39)
- reference_only=true (38)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260618233827.582d50a8@foz.lan
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-19
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: CameraX 1.6.0 릴리스: 기능 조합 사전 쿼리 API 도입 및 기기별 호환성 이슈 해결; Linux v7.2 미디어 서브시스템 업데이트 제안: V4L2 Core 및 subdev 센서 소유권 수정 포함; GCC 16 신규 기능 공개: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원
- Lock된 기사: CameraX 1.6.0 릴리스: 기능 조합 사전 쿼리 API 도입 및 기기별 호환성 이슈 해결; Linux v7.2 미디어 서브시스템 업데이트 제안: V4L2 Core 및 subdev 센서 소유권 수정 포함; GCC 16 신규 기능 공개: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":1,"linux_camera_libcamera_v4l2":1,"ai_camera_path_hal_workflow":1,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: Re: [PATCH 2/2] media: i2c: og0va1b: Add OmniVision OG0VA1B camera sensor - Uwe Kleine-K&#246;nig (evidence_score=0 < 6); Re: [PATCH v3 4/4] MAINTAINERS: Add entry for Rust dma-buf - Sumit Semwal (evidence_score=0 < 6); KASAN: slab-use-after-free Read in v4l2_fh_open - sanan.hasanou (evidence_score=0 < 6); Android Compatibility Definition Document &nbsp;|&nbsp; Android Open Source Project (evidence_score=0 < 6); [PATCH v2] media: mali-c55: Fix scaler factor overflow for large crop sizes - David Carlier (evidence_score=0 < 6); [PATCH v2 3/3] staging: media: atomisp: remove dead platform_support.h header file - Igor Putko (evidence_score=0 < 6); Re: [PATCH v10 3/4] dt-bindings: clock: imx95-blk-ctl: Define formatter child node schema - Frank Li (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt image-fallback (CameraX 1.6.0 릴리스: 기능 조합 사전 쿼리 API 도입 및 기기별 호환성 이슈 해결): Article image uses a local fallback visual.; 1pt image-fallback (Linux v7.2 미디어 서브시스템 업데이트 제안: V4L2 Core 및 subdev 센서 소유권 수정 포함): Article image uses a local fallback visual.; 1pt image-fallback (GCC 16 신규 기능 공개: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원): Article image uses a local fallback visual.
