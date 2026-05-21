# 뉴스레터 품질 리포트 - 2026-05-21

## Gate Result

- Quality score: 89
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 89, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 89
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 1
- Briefing count: 3
- Structured camera article count: 1
- Legacy regex camera article count: 1
- Expanded-scope article count: 1
- direct_aosp_camera count: 1
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 1
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 1
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":1,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
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
- hal_impact_axis_counts: {"framework_hal_contract":1,"camerax_app_compatibility":1}
- actionability_level_counts: {"measurable_test":1}
- effective_actionability_level_counts: {"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | strong_signal | measurable_test | measurable_test | framework_hal_contract, camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 1
- Source-gap count: 1
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 2
- Blocking deduction categories: source-integrity
- Hard fail count: 2
- Soft deduction count: 3

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=3; total_claims=5
- Derived evidence mapping count: 3
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | bdcf8a4c-fact-1: 2026년 5월 19일자 Android Developers Blog 게시물에 따르면, Jetpack Compose로 빌드된 적응형 UI에서 다양한 윈도우 크기에 걸쳐 올바른 ... | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |
| Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | bdcf8a4c-inference-1: Jetpack Compose 기반 적응형 UI의 확산은 HAL이 더 다양한 프리뷰 스트림 크기와 종횡비 전환을 빠르고 안정적으로 처리해야 함을 의미합니다. | inference | bound | camera_framework_behavior | low | none | none | https://goo.gle/AdaptiveApps_IO26 |
| Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | bdcf8a4c-recommendation-1: 폴더블 및 태블릿 기기에서 화면 분할, 창 크기 조절, 화면 회전 시 CameraX 프리뷰가 안정적으로 갱신되는지 테스트해야 합니다. | recommendation | bound | cts_vts_its_cdd | low | none | none | https://goo.gle/AdaptiveApps_IO26 |
| Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | bdcf8a4c-fact-2: 2026년 5월 19일자 Android Developers Blog 게시물은 Google I/O의 주요 내용 중 하나로 Jetpack Compose를 사용한 적응형 UI 구축... | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |
| Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | bdcf8a4c-fact-3: 이 기사는 2026년 5월 19일자 Android Developers Blog 게시물에 근거합니다. 해당 게시물은 Jetpack Compose를 사용한 적응형 UI(Adapt... | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | pass | present | framework_hal_contract, camerax_app_compatibility | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | repair-section | Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구 | direct_aosp_camera | 1 | true | false | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | Fact-check must_fix item mentions this section. | claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. |

## Hard Fails

- 5 pt [source-integrity] Fact checker returned 1 must_fix item(s).
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).

## Soft Deductions

- 1 pt [claim-binding] Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)
- 1 pt [claim-binding] Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)
- 1 pt [claim-binding] Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)

## Top Deduction Categories

- claim-binding (3)
- source-integrity (2)

## Candidate Exclusion Summary

- briefing_only=true (1)
- final_selection_blocked=true (1)
- finalSelectionEligibility=watchlist (1)
- main_eligible=false (1)
- missing dated evidence (1)

## Deductions

- 1 pt [claim-binding] Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 1 pt [claim-binding] Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 1 pt [claim-binding] Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 5 pt [source-integrity] Fact checker returned 1 must_fix item(s).
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).
