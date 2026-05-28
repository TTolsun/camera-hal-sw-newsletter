# 뉴스레터 품질 리포트 - 2026-05-28

## Gate Result

- Quality score: 81
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 81, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 81
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 1
- Legacy regex camera article count: 2
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 1
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 1
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 2
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":1,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":1,"multimedia":0,"platform":0,"fallback":1,"watchlist":0}
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
- actionability_level_counts: {"measurable_test":2}
- effective_actionability_level_counts: {"measurable_test":2}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | complete | none |
| 2 | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원 | strong_signal | measurable_test | measurable_test | native_tooling_workflow | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 16
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 1
- Blocking deduction categories: source-integrity
- Hard fail count: 1
- Soft deduction count: 4

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=4; total_claims=6
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화 | claim:adaptive_apps_compose_tools: Jetpack Compose는 최신 Jetpack Navigation 3, 새로운 실험적인 Grid 및 FlexBox 레이아웃, 향상된 비터치 입력 지원을 제공합니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화 | claim:adaptive_apps_camerax_preview: 모든 창 크기에서 올바른 카메라 미리보기를 보장하기 위해 CameraX가 핵심 도구로 활용됩니다. | fact | bound | camera_framework_behavior | low | none | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화 | claim:adaptive_apps_hal_stream_reconfig: 대화면 및 폴더블 기기에서 앱이 동적으로 창 크기를 변경할 때 CameraX가 프레임워크를 통해 HAL에 요청하는 스트림 재구성 빈도가 증가할 수 있습니다. | inference | bound | stream_buffer_metadata | medium | none | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원 | claim:ai_studio_prompt_build: Google AI Studio가 프롬프트만으로 몇 분 안에 전체 Android 앱을 빌드할 수 있게 되었습니다. | fact | bound | native_tooling_workflow | low | none | candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary | https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html |
| Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원 | claim:ai_studio_no_setup: 소프트웨어 설치나 라이브러리 구성이 필요 없어 개발 장벽이 크게 낮아집니다. | fact | bound | native_tooling_workflow | low | none | candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary | https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html |
| Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원 | claim:ai_studio_hal_indirect_impact: 카메라 프레임을 입력으로 사용하는 온디바이스 AI 모델의 프로토타이핑이 단순화되어 상위 레이어의 카메라-AI 결합 워크로드 검증에 활용될 수 있습니다. | inference | bound | no_hal_runtime_impact | medium | none | candidate:fac75a8d436dc70ff2ea5e1c85a57ff555fd85f388670aaf754dc255a22a7bfc:source-summary | https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화 | pass | present+guarded | camerax_app_compatibility | present | public-limitation |
| 2 | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원 | pass | present+guarded | native_tooling_workflow | present | public-limitation |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | repair-section | Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 2 | FAIL | repair-section | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원 | cpp_ai_tooling_fallback | 6 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 15 pt [source-integrity] Fact checker returned 16 must_fix item(s).

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화: Article image uses a local fallback visual.
- 1 pt [image-fallback] Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원: Article image uses a local fallback visual.

## Top Deduction Categories

- editorial-story (2)
- image-fallback (2)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Google I/O 2026: Jetpack Compose 기반 Adaptive UI 생태계 확장과 CameraX 미리보기 호환성 강화: Article image uses a local fallback visual.
- 1 pt [image-fallback] Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 및 AI 카메라 워크로드 프로토타이핑 지원: Article image uses a local fallback visual.
- 15 pt [source-integrity] Fact checker returned 16 must_fix item(s).
