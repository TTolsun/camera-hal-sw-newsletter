# 뉴스레터 품질 리포트 - 2026-06-29

## Gate Result

- Quality score: 94
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 94
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 2
- Legacy regex camera article count: 2
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 2
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 2
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 2
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":2,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":2,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 1
- usable_signal_count: 1
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":1,"native_tooling_workflow":1}
- actionability_level_counts: {"concrete_check":1,"measurable_test":1}
- effective_actionability_level_counts: {"concrete_check":1,"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | complete | none |
| 2 | sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생 | strong_signal | measurable_test | measurable_test | native_tooling_workflow | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: PASS
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 5

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=6; total_claims=6
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안 | claim:v4l2_subdev_client_info_patch_proposal: v4l2-subdev pad ops에 const struct v4l2_subdev_client_info 포인터 추가가 제안되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:dd37e4f8525ca7da:source-summary | https://lore.kernel.org/linux-media/akEtov7zdEDaPe15@kekkonen.localdomain/ |
| Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안 | claim:v4l2_subdev_client_info_affected_functions: 이 변경은 set_fmt, get_selection, set_selection 함수에 영향을 줍니다. | fact | bound | driver_image_pipeline | low | none | candidate:dd37e4f8525ca7da:source-summary | https://lore.kernel.org/linux-media/akEtov7zdEDaPe15@kekkonen.localdomain/ |
| Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안 | claim:v4l2_subdev_client_info_patch_date: 해당 제안은 v5 10/10 패치 시리즈 형식으로 lore.kernel.org linux-media 메일링 리스트에 2026년 6월 28일 공개되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:dd37e4f8525ca7da:source-summary | https://lore.kernel.org/linux-media/akEtov7zdEDaPe15@kekkonen.localdomain/ |
| sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생 | claim:sailus_media_tree_compiler_warning: sailus-media-tree의 metadata-pre 브랜치(head: 66c090febbc3c412ced4e71cb69f47b05eea0331)에서 컴파일러 경고가 발생... | fact | bound | native_tooling_workflow | low | none | candidate:fd5092f5d5cca47f:source-summary | https://lore.kernel.org/linux-media/202606291022.4ZXe8Dz4-lkp@intel.com/ |
| sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생 | claim:compiler_warning_location_and_details: 경고 위치는 drivers/media/i2c/cvs/v4l2.c:203 이며, cvs_csi_set_fmt 함수의 파라미터 'ci'가 설명되지 않았다는 내용입니다. | fact | bound | native_tooling_workflow | low | none | candidate:fd5092f5d5cca47f:source-summary | https://lore.kernel.org/linux-media/202606291022.4ZXe8Dz4-lkp@intel.com/ |
| sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생 | claim:sailus_media_tree_compiler_warning_date: 해당 경고는 Clang 22.1.3 환경에서 빌드 시 감지되어 2026년 6월 29일 메일링 리스트에 보고되었습니다. | fact | bound | native_tooling_workflow | low | none | candidate:fd5092f5d5cca47f:source-summary | https://lore.kernel.org/linux-media/202606291022.4ZXe8Dz4-lkp@intel.com/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안 | pass | present+guarded | driver_image_pipeline | present | guardrail-only |
| 2 | sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생 | pass | present+guarded | native_tooling_workflow | present | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, action_hint.
- 1 pt [image-fallback] Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- editorial-story (2)
- image-fallback (2)
- linked-evidence-limitation (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, action_hint.
- 1 pt [image-fallback] Linux V4L2 서브디바이스 패드 작업에 v4l2_subdev_client_info 포인터 추가 제안: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] sailus-media-tree 개발 브랜치에서 cvs_csi_set_fmt 함수 파라미터 설명 누락 경고 발생: Article image uses a local fallback visual.
