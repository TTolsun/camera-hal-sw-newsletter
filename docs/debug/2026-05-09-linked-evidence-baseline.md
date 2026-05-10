# 2026-05-09 linked evidence baseline

This document records the #63 PR 1 baseline for the Generic Linked Evidence Resolver work.
The source artifacts below were read-only inputs and were not edited:

- `content/newsroom/2026-05-09/generation-status.json`
- `content/newsroom/2026-05-09/selection-report.json`
- `content/newsroom/2026-05-09/quality-report.json`
- `content/newsroom/2026-05-09/shortlisted-candidates.json`
- `content/newsroom/2026-05-09/reporter-candidates.json`

If earlier workflow notes disagree with these files, the current artifact values in this document take precedence.

## Current generation status

- `date`: `2026-05-09`
- `status`: `NEEDS_FIX`
- `failure_stage`: `editor repair attempt 1/2`
- `failure_reason`: `Targeted repair changed main article count outside completion/replacement mode.`
- `validate_ok`: `true`
- `review_gate_passed`: `true`
- `publish_gate_passed`: `false`
- `final_publish_ready`: `false`
- `selection_publish_ready`: `false`
- `publish_ready`: `false`
- `composition_mode`: `FALLBACK_COMPOSITION`
- `selection_composition_mode`: `FALLBACK_COMPOSITION`

The editor semantic validation failed because targeted repair changed the section count:

- `reason`: `section_count_drift`
- expected sections: `3`
- actual sections after repair: `2`
- fallback editor section count: `3`
- repair attempted: `true`
- repair succeeded: `false`

## Quality and fact-check status

- `fact_check_status`: `PASS`
- `must_fix_count`: `0`
- `source_gap_count`: `0`
- `quality_status`: `PASS`
- `quality_score`: `99`
- `quality_threshold`: `85`
- `quality_deduction_count`: `1`

The only quality deduction in `quality-report.json` is a non-blocking `image-fallback` soft deduction:

- reason: `Article image uses a local fallback visual.`
- location: `libcamera v0.7.1 출시: SoftISP 및 파이프라인 처리량 개선`

This baseline does not change `quality threshold`, hard fail conditions, source candidate binding, dated evidence checks, `source_gap_risk`, `finalSelectionEligibility`, or `source_verification_notes`.

## Candidate and selection status

`generation-status.json` reports:

- `input_candidate_count`: `40`
- `eligible_candidate_count`: `6`
- `deterministic_selected_count`: `5`
- `selected_article_count`: `3`
- `rendered_main_article_count`: `3`
- `final_selected_article_count`: `3`
- `reserve_candidate_count`: `1`

`selection-report.json` and `shortlisted-candidates.json` report deterministic selection before the editor repair failure:

- input candidates: `40`
- eligible candidates: `6`
- selected articles: `5`
- deterministic selected articles: `5`
- reserve candidates: `1`
- review gate: `true`
- publish gate at selection stage: `true`

The deterministic selected candidates in `shortlisted-candidates.json` are:

| Candidate | URL | Bucket | Eligibility | `source_gap_risk` |
| --- | --- | --- | --- | --- |
| `libcamera Release Announcements - libcamera v0.7.1` | `https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html` | `camera_driver_image_pipeline` | `main` | `false` |
| `1.6.1` | `https://developer.android.com/jetpack/androidx/releases/camera#1.6.1` | `android_platform_camera_adjacent` | `main` | `false` |
| `1.3.0-beta02` | `https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02` | `android_platform_camera_adjacent` | `short` | `false` |
| `1.4.0-alpha07` | `https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07` | `android_platform_camera_adjacent` | `short` | `false` |
| `GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!` | `https://isocpp.org//blog/2026/04/gcc-16.1` | `cpp_ai_tooling_fallback` | `short` | `false` |

The reserve candidate is:

| Candidate | URL | Bucket | Eligibility | `source_gap_risk` |
| --- | --- | --- | --- | --- |
| `Glaze 7.2 &#45; C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more` | `https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more` | `cpp_ai_tooling_fallback` | `short` | `false` |

`quality-report.json` covers the rendered 3-article output:

| Rendered article | Source candidate URL | Bucket | Binding |
| --- | --- | --- | --- |
| `libcamera v0.7.1 출시: SoftISP 및 파이프라인 처리량 개선` | `https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html` | `camera_driver_image_pipeline` | `bound` |
| `CameraX 1.4.0-alpha07 출시: viewfinder 및 video 모듈 업데이트` | `https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07` | `android_platform_camera_adjacent` | `bound` |
| `Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more` | `https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more` | `cpp_ai_tooling_fallback` | `bound` |

## Exclusion and shortage signals

The selection reports have no `selection_errors` and no `selection_warnings`, but they include shortage hints:

- `Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.`
- `Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.`

Composition counts from the deterministic selection stage:

- `direct_aosp_camera_count`: `0`
- `camera_driver_image_pipeline_count`: `1`
- `android_platform_camera_adjacent_count`: `3`
- `soc_platform_signal_count`: `0`
- `cpp_ai_tooling_fallback_count`: `1`
- `generic_tech_watchlist_count`: `0`
- `primary_camera_stack_topic_count`: `4`
- `supporting_main_article_count`: `1`
- `forbidden_main_article_count`: `0`

Top exclusion reasons:

| Reason | Count |
| --- | ---: |
| `main_eligible=false` | 34 |
| `source_gap_risk=true` | 34 |
| `reference_only=true` | 32 |
| `briefing_only=true` | 27 |
| `finalSelectionEligibility=watchlist` | 27 |
| `finalSelectionEligibility=exclude` | 7 |
| `missing dated evidence` | 4 |
| `watch page without dated evidence` | 4 |

These counts show why linked evidence must remain supplemental. It cannot be used to bypass `source_gap_risk=true`, missing dated evidence, or `finalSelectionEligibility=watchlist/exclude`.

## CameraX 1.6.1 linked evidence gap

The deterministic shortlist includes `CameraX 1.6.1` as an official, dated, `android_platform_camera_adjacent` candidate:

- URL: `https://developer.android.com/jetpack/androidx/releases/camera#1.6.1`
- `finalSelectionEligibility`: `main`
- `source_gap_risk`: `false`
- `final_selected`: `true`

The release-note row records module version updates such as `camera-camera2`, `camera-core`, `camera-compose`, `camera-effects`, `camera-extensions`, `camera-lifecycle`, `camera-mlkit-vision`, `camera-view`, and `camera-video`.

That release-note-level evidence is useful but not enough for #63's target quality:

- It says a CameraX version changed, but not whether the underlying linked changes affect build dependencies, app compatibility, Camera2 interop, stream setup, buffers, metadata, runtime capture behavior, or tests only.
- It can support dated release existence, but it cannot safely classify HAL runtime impact without linked Gerrit CLs, IssueTracker bugs, GitHub PRs/issues/commits, mailing-list patches, or CVE details.
- If linked evidence later proves the change is build/test/docs only, the article should not be written as a HAL runtime behavior change.

## Why linked evidence is needed

The linked evidence pipeline is needed to preserve source-backed interpretation:

- Android Gerrit can expose CL subject, changed files, test notes, and bug IDs.
- Google IssueTracker can identify the bug, or record `blocked` when access is not available.
- GitHub PRs, issues, commits, and releases can expose implementation context and changed files.
- Mailing lists can expose patch subjects, subsystem scope, reviewed/tested tags, and affected driver/media paths.
- CVE references can help distinguish camera/media/vendor/image-processing security scope from generic security items.

This PR slice only creates the schema and deterministic extractor foundation. It does not resolve those links yet.

## Non-regression rule

Linked evidence is supplemental diagnostics only.

Linked evidence absence, extractor misses, blocked evidence, unsupported evidence, malformed evidence, or future resolver failure must not become newsletter generation failure. Later PRs may add diagnostics, conservative scoring, or overclaim detection, but they must not weaken:

- `quality threshold`
- `qualityGatePolicy.hardFailConditions`
- source candidate binding
- dated evidence requirements
- `source_gap_risk`
- `finalSelectionEligibility`
- `source_verification_notes`
