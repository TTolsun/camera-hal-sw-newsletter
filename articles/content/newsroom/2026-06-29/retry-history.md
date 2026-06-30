# 뉴스레터 재시도 기록 - 2026-06-29

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 94/60 | PASS | 2 | 2 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 7
- Reporter-selected candidates: 4
- Final input candidates: 66
- Final eligible candidates: 7
- Final selected articles: 2
- Deterministic primary articles: 2
- Selected representative groups: 2
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 2
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 2
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (43)
- main_eligible=false (43)
- source_gap_risk=true (43)
- reference_only=true (40)
- missing dated evidence (37)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://developer.android.com/tools/agents/android-cli
- replacement_headline_key: url:https://lore.kernel.org/linux-media/202606291022.4ZXe8Dz4-lkp@intel.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-29
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안; sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생
- Lock된 기사: Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안; sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":0,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":0}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: Re: [PATCH] fix: dma-buf: fence_chains_init: error unwind path leaks enable_sw_signaling reference - WenTao Liang (evidence_score=0 < 6); [PATCH] dma-fence: Make dma_fence_dedup_array() robust against 0-count input - Baineng Shou (evidence_score=0 < 6); The Linux Kernel Archives (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened, action_hint.; 1pt image-fallback (Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생): Article image uses a local fallback visual.
