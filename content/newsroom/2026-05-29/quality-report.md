# 뉴스레터 품질 리포트 - 2026-05-29

## Gate Result

- Quality score: 33
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 33, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 33
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 0
- Legacy regex camera article count: 1
- Expanded-scope article count: 1
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 0
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 1
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":0,"multimedia":0,"platform":0,"fallback":1,"watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 2
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"camerax_app_compatibility":1,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":1,"owner_metric_log":1}
- effective_actionability_level_counts: {"measurable_test":1,"owner_metric_log":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | complete | none |
| 2 | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화 | strong_signal | owner_metric_log | owner_metric_log | native_tooling_workflow | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 8
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 1
- Blocking deduction count: 7
- Blocking deduction categories: source-integrity, claim-evidence, scope-relevance
- Hard fail count: 7
- Soft deduction count: 4

## Claim Binding

- Claim validation status: needs_fix
- Claim coverage: bound_claims=2; total_claims=7
- Derived evidence mapping count: 0
- Overclaim risk: medium
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | cl:compose_adaptive:1: Jetpack Compose는 최신 Jetpack Navigation 3, 새로운 실험적인 Grid 및 FlexBox 레이아웃을 제공합니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | cl:compose_adaptive:2: 모든 창 크기에서 올바른 카메라 미리보기를 구현하기 위해 CameraX가 핵심 도구로 연계됩니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | cl:compose_adaptive:3: Android 생태계는 폴더블, 태블릿, 차량, XR 등 다양한 폼팩터로 확장되고 있습니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | cl:compose_adaptive:4: 상위 UI의 동적 크기 변경은 하위 Camera HAL의 빈번한 Stream Reconfiguration 및 Surface 버퍼 재할당을 유발할 수 있습니다. | inference | needs_fix | stream_buffer_metadata | medium | unknown_evidence_id | candidate:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:source-summary | https://goo.gle/AdaptiveApps_IO26 |
| Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화 | cl:ai_studio:1: Google AI Studio는 프롬프트 입력을 통해 몇 분 만에 전체 Android 앱을 빌드할 수 있는 기능을 제공합니다. | fact | bound | native_tooling_workflow | low | none | candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary | https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html |
| Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화 | cl:ai_studio:2: 로컬 소프트웨어 설치나 복잡한 라이브러리 구성 단계를 생략할 수 있습니다. | fact | bound | native_tooling_workflow | low | none | candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary | https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html |
| Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화 | cl:ai_studio:3: 생성된 AI 카메라 앱 구동 시 NPU/GPU 가속으로 인한 리소스 경합이 카메라 프레임 레이트에 영향을 줄 수 있습니다. | inference | bound | performance_latency_thermal | medium | none | candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary | https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | pass | present | camerax_app_compatibility | present | none |
| 2 | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화 | pass | present | native_tooling_workflow | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.; Claim references unresolved evidence_id: candidate:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:source-summary.; Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.; Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 2 | FAIL | repair-section | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화 | cpp_ai_tooling_fallback | 6 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [source-integrity] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15. (unknown_evidence_id)
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15. (unknown_evidence_id)
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15. (unknown_evidence_id)
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: candidate:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:source-summary. (unknown_evidence_id)
- 8 pt [scope-relevance] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.
- 15 pt [source-integrity] Fact checker returned 8 must_fix item(s).

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Article image uses a local fallback visual.
- 1 pt [image-fallback] Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화: Article image uses a local fallback visual.

## Top Deduction Categories

- claim-evidence (4)
- editorial-story (2)
- image-fallback (2)
- source-integrity (2)
- scope-relevance (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 8 pt [source-integrity] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15.
- 8 pt [claim-evidence] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Claim references unresolved evidence_id: candidate:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:source-summary.
- 8 pt [scope-relevance] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.
- 1 pt [image-fallback] Google I/O 2026: Jetpack Compose와 CameraX 기반의 다중 기기 Adaptive 카메라 미리보기 최적화: Article image uses a local fallback visual.
- 1 pt [image-fallback] Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 및 온디바이스 AI 프로토타이핑 워크플로우 변화: Article image uses a local fallback visual.
- 15 pt [source-integrity] Fact checker returned 8 must_fix item(s).
