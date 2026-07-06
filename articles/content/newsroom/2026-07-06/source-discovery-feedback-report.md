# Source Discovery Feedback Report - 2026-07-06

status=WARNING
parser_gap_count=1
duplicate_discovery_gap_count=0
gemini_parser_failure_count=3

| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |
|---|---|---|---|---|---|---|---|
| PARSER_REPAIR_REQUIRED | missing_source_extraction | 1.7.0-alpha02 | android-developers-jetpack-release | false |  | high | https://developer.android.com/jetpack/androidx/releases/camera |

## Gemini parser extraction failures

| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |
|---|---|---|---|---|---|---|
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-jetpack-release | camerax-release-notes | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02 |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-jetpack-release | camerax-release-notes | https://developer.android.com/jetpack/androidx/releases/camera |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | raspberrypi-libcamera-releases | raspberrypi-libcamera-releases | https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609 |

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: raspberrypi-libcamera-releases
  - suggested_fixture_case: Add a parser regression fixture for the discovered release-note source.

- PARSER_REPAIR_REQUIRED: 1.7.0-alpha02
  - url: https://developer.android.com/jetpack/androidx/releases/camera
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: false
  - duplicate_match_type: 
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: not_checked
  - recommendation: Check AndroidX Camera release-note block parser and source_extraction.release.sections extraction.

