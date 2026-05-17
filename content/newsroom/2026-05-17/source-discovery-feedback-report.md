# Source Discovery Feedback Report - 2026-05-17

status=WARNING
parser_gap_count=3
duplicate_discovery_gap_count=3

| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |
|---|---|---|---|---|---|---|---|
| PARSER_REPAIR_REQUIRED | missing_source_extraction | CameraX 1.6.1 | android-developers-jetpack-release | true | exact_normalized_url | high | https://developer.android.com/jetpack/androidx/releases/camera#1.6.1 |
| PARSER_REPAIR_REQUIRED | missing_source_extraction | 1.3.0-beta02 | android-developers-jetpack-release | true | exact_normalized_url | high | https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02 |
| PARSER_REPAIR_REQUIRED | missing_source_extraction | 1.4.0-alpha07 | android-developers-jetpack-release | true | exact_normalized_url | high | https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07 |

- PARSER_REPAIR_REQUIRED: CameraX 1.6.1
  - url: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: true
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: pass
  - recommendation: Check AndroidX Camera release-note block parser and source_extraction.release.sections extraction.

- PARSER_REPAIR_REQUIRED: 1.3.0-beta02
  - url: https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: true
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: not_checked
  - recommendation: Check AndroidX Camera release-note block parser and source_extraction.release.sections extraction.

- PARSER_REPAIR_REQUIRED: 1.4.0-alpha07
  - url: https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_discovered_by_gemini: true
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - source_gap_risk: false
  - evidence_validation_status: not_checked
  - recommendation: Check AndroidX Camera release-note block parser and source_extraction.release.sections extraction.

