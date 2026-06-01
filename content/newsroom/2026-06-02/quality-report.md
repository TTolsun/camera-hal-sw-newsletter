# 뉴스레터 품질 리포트 - 2026-06-02

## Gate Result

- Quality score: 65
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 65, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 65
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
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":0,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 0
- usable_signal_count: 1
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 1
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"camerax_app_compatibility":1}
- actionability_level_counts: {"concrete_check":1}
- effective_actionability_level_counts: {"concrete_check":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화 | usable_signal | concrete_check | concrete_check | camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 1
- Blocking deduction count: 4
- Blocking deduction categories: source-integrity, claim-evidence, scope-relevance
- Hard fail count: 4
- Soft deduction count: 3

## Claim Binding

- Claim validation status: needs_fix
- Claim coverage: bound_claims=0; total_claims=2
- Derived evidence mapping count: 0
- Overclaim risk: medium
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화 | cl:adaptive_compose_nav3: Jetpack Compose는 최신 Jetpack Navigation 3 릴리스, 새로운 실험적인 Grid 및 FlexBox 레이아웃, 향상된 비터치 입력 지원을 제공합니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화 | cl:adaptive_camerax_preview: 모든 창 크기에서 올바른 카메라 미리보기를 보장하기 위해 CameraX가 핵심 도구 중 하나로 활용됩니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화 | pass | present | camerax_app_compatibility | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.; Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance. | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [source-integrity] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15. (unknown_evidence_id)
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15. (unknown_evidence_id)
- 8 pt [scope-relevance] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Article image uses a local fallback visual.

## Top Deduction Categories

- claim-evidence (2)
- editorial-story (2)
- image-fallback (1)
- scope-relevance (1)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 8 pt [source-integrity] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.
- 8 pt [scope-relevance] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.
- 1 pt [image-fallback] Google I/O 2026: Jetpack Compose 적응형 UI 전환과 CameraX 미리보기 호환성 강화: Article image uses a local fallback visual.
