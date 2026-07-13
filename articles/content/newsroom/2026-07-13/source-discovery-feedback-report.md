# Source Discovery Feedback Report - 2026-07-13

status=WARNING
parser_gap_count=0
duplicate_discovery_gap_count=0
gemini_parser_failure_count=3

| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |
|---|---|---|---|---|---|---|---|
| none | none | none | none | false |  |  |  |

## Gemini parser extraction failures

| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |
|---|---|---|---|---|---|---|
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-jetpack-release | camerax-release-notes | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02 |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | android-developers-media3-release | androidx-media3-release-notes | https://developer.android.com/jetpack/androidx/releases/media3#1.11.0-beta01 |
| GEMINI_PARSER_EXTRACTION_REQUIRED | discovered_not_extractable | discovered | discovered_not_extractable | raspberrypi-libcamera-releases | raspberrypi-libcamera-releases | https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609 |

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/media3#1.11.0-beta01
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-media3-release
  - suggested_fixture_case: Add or update a Media3 release-note fixture with version/date/component/behavior evidence and camera-output relevance.

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: raspberrypi-libcamera-releases
  - suggested_fixture_case: Add a parser regression fixture for the discovered release-note source.

