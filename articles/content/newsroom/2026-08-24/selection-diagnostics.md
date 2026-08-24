# Candidate Selection Diagnostics - 2026-08-24

## 후보 선택 진단

- Reporter candidates: 7
- Reporter-selected candidates: 7
- Final input candidates: 52
- Final eligible candidates: 7
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 1
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 4
  - lore-series:20260819125647.68910-himanshu.bhavani@siliconsignals.io
    - 29c284c94819836c4fe62bd0da8da0210d005954a8af1208835cd200f7378986: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
  - lore-series:20260820075524.2056029-eagle.alexander923@gmail.com
    - b267cab9cec348cf1e1c46842808420fb1e9f58c0082fa7769a3a9ca1561a057: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
  - lore-series:20260820202544.1256265-devnexen@gmail.com
    - 655b00b9713bf7b7947678c0bb340bc3b8c0e6270c48757ac1f0aef95111a3d8: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
  - lore-series:20260817123941.1701962-natalie.klaus@runtimeverification.com
    - 826ff192ba1e6066668d17d968b80d07ff429d928a341d5990b89622e18bc45d: coverage_decision=short_mention, reason_code=editorial_plan_short_mention
- Reserve candidates: 2
- Demoted candidates: unknown
- Composition mode: NORMAL
- Editor review required: false
- Reporter-selected but final-excluded: 2
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 1
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 0
- Primary Camera Stack: 1
- Supporting main articles: 0
- Forbidden main articles: 0
- Non-fallback reviewable: 1
- release_class_pool_size: 1
- release_class_admitted: 0
- release_class_blocked_reason: lineup_at_max

Source/parser recovery hint:
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (32)
- main_eligible=false (32)
- source_gap_risk=true (32)
- reference_only=true (27)
- briefing_only=true (24)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260820202544.1256265-1-devnexen@gmail.com
- public_render_reconciled: true
- public_rendered_headline_key: url:https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817
- public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-08-24
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: PASS (main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 2

