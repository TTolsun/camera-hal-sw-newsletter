# 뉴스레터 품질 리포트 - 2026-06-06

## Gate Result

- Quality score: 55
- Quality threshold: 60
- Max score: 100
- Result: NEEDS_FIX
- Summary: Resolve source gaps, fact-check must-fix items, composition blockers, and any article the fact-checker marked not useful to a Camera HAL SW engineer before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 55
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 1
- Briefing count: 3
- Structured camera article count: 0
- Legacy regex camera article count: 1
- Expanded-scope article count: 0
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 0
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 0
- composition_mode: NEEDS_FIX
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":0,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 1
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 1
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"camerax_app_compatibility":1}
- actionability_level_counts: {"measurable_test":1}
- effective_actionability_level_counts: {"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 3
- Source-gap count: 1
- Stale claim status: PASS
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 1
- Blocking deduction count: 5
- Blocking deduction categories: source-integrity, claim-evidence
- Hard fail count: 5
- Soft deduction count: 3

## Claim Binding

- Claim validation status: needs_fix
- Claim coverage: bound_claims=0; total_claims=2
- Derived evidence mapping count: 0
- Overclaim risk: medium
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표 | claim:io26-camerax-viewfinder-announcement: Google I/O '26에서 Jetpack CameraX 및 Media3 기반의 CameraXViewfinder Composable이 발표되었습니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407 | https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY |
| Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표 | claim:io26-camerax-viewfinder-purpose: 이 컴포넌트는 폴더블 및 태블릿 등 다양한 폼 팩터에서 유연하게 반응하는 카메라 미리보기를 제공하는 데 중점을 둡니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407 | https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표 | pass | present | camerax_app_compatibility | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407.; Fact-check must_fix item mentions this section.; Source gap or ineligible source evidence mentions this section. | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [source-integrity] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407. (unknown_evidence_id)
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407. (unknown_evidence_id)
- 15 pt [source-integrity] Fact checker returned 3 must_fix item(s).
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Article image uses a local fallback visual.

## Top Deduction Categories

- source-integrity (3)
- claim-evidence (2)
- editorial-story (2)
- image-fallback (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 8 pt [source-integrity] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407.
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407.
- 1 pt [image-fallback] Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표: Article image uses a local fallback visual.
- 15 pt [source-integrity] Fact checker returned 3 must_fix item(s).
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).
