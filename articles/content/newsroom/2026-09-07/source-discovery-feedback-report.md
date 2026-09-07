# Source Discovery Feedback Report - 2026-09-07

status=WARNING
parser_gap_count=1
duplicate_discovery_gap_count=0
gemini_parser_failure_count=2

| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |
|---|---|---|---|---|---|---|---|
| PARSER_REPAIR_REQUIRED | missing_source_extraction | Camera \| Android Open Source Project | aosp-camera-docs | false |  | high | https://source.android.com/docs/core/camera |

## Gemini parser extraction failures

| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |
|---|---|---|---|---|---|---|
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-jetpack-release | camerax-release-notes | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03 |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | raspberrypi-libcamera-releases | raspberrypi-libcamera-releases | https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817 |

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: raspberrypi-libcamera-releases
  - suggested_fixture_case: Add a parser regression fixture for the discovered release-note source.

- PARSER_REPAIR_REQUIRED: Camera | Android Open Source Project
  - url: https://source.android.com/docs/core/camera
  - adapter_hint: aosp-camera-docs
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: false
  - duplicate_match_type: 
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: pass
  - recommendation: Check AOSP camera update row extraction.

