# Source Discovery Feedback Report - 2026-06-13

status=WARNING
parser_gap_count=2
duplicate_discovery_gap_count=2
gemini_parser_failure_count=3

| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |
|---|---|---|---|---|---|---|---|
| PARSER_REPAIR_REQUIRED | missing_source_extraction | AOSP Site Updates - May 2026 | aosp-site-updates | true | exact_normalized_url | high | https://source.android.com/docs/compatibility/cts/camera-its-box |
| PARSER_REPAIR_REQUIRED | missing_source_extraction | AOSP Site Updates - March 2026 |  | true | exact_normalized_url | high | https://source.android.com/docs/compatibility |

## Gemini parser extraction failures

| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |
|---|---|---|---|---|---|---|
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-jetpack-release | camerax-release-notes | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-jetpack-release | camerax-release-notes | https://developer.android.com/jetpack/androidx/releases/camera#1.6.1 |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-media3-release | androidx-media3-release-notes | https://developer.android.com/jetpack/androidx/releases/media3#1.10.1 |

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera#1.6.0
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/media3#1.10.1
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-media3-release
  - suggested_fixture_case: Add or update a Media3 release-note fixture with version/date/component/behavior evidence and camera-output relevance.

- PARSER_REPAIR_REQUIRED: AOSP Site Updates - May 2026
  - url: https://source.android.com/docs/compatibility/cts/camera-its-box
  - adapter_hint: aosp-site-updates
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: true
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: pass
  - recommendation: Check AOSP camera update row extraction.

- PARSER_REPAIR_REQUIRED: AOSP Site Updates - March 2026
  - url: https://source.android.com/docs/compatibility
  - adapter_hint: 
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: true
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: blocked
  - recommendation: Repair the source parser so the matching official source block preserves concrete source_extraction bullets.

