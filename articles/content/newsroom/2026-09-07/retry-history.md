# 뉴스레터 재시도 기록 - 2026-09-07

| 시도 | 모델 | 점수 | 상태 | Rendered | Locked | Demoted | Reserve used | 중복 거절 | Source gap | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | reporter=gemini-2.5-flash, editor=gemini-3.5-flash, public-article-judge=gemini-2.5-flash-lite, fact-checker=gemini-2.5-flash | 90/60 | PASS | 5 | 5 | 0 | 0 | 0 | 0 | 0 |

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 11
- Final input candidates: 69
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 4
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 6
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 5
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 5
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 18
- republication_cooldown_blocked: 2

Source/parser recovery hint:
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (30)
- main_eligible=false (30)
- source_gap_risk=true (30)
- missing dated evidence (28)
- briefing_only=true (25)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-07
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## 시도 1

- 선택 기사: OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개; Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개; Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개; libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인; libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개
- Lock된 기사: OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개; Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개; Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개; libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인; libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개
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
- Final slot distribution: {"android_camera_platform_api":0,"camerax_aosp_camera_compatibility":0,"linux_camera_libcamera_v4l2":2,"ai_camera_path_hal_workflow":2,"cpp_toolchain_fallback":0,"other":1}
- Reporter eligibility blocked section: 없음
- Rejected main-ineligible candidate: [PATCH v5 0/7] media: Enable the OV5693 front camera on IPU6 Surface devices - Fernando Rimoli (evidence_score=0 < 6)
- Lock blocker: 없음
- 거절된 중복 기사: 없음
- 감점: 1pt editorial-story (briefing 1): Briefing bullet misses story structure elements: reader_perspective, action_hint.; 1pt editorial-story (briefing 2): Briefing bullet misses story structure elements: what_happened.; 1pt editorial-story (briefing 3): Briefing bullet misses story structure elements: action_hint.; 1pt image-fallback (OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개): Article image uses a local fallback visual.; 2pt linked-evidence-limitation (Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개): Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; 1pt image-fallback (Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개): Article image uses a local fallback visual.; 1pt image-fallback (Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개): Article image uses a local fallback visual.; 1pt image-fallback (libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인): Article image uses a local fallback visual.; 1pt image-fallback (libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개): Article image uses a local fallback visual.
