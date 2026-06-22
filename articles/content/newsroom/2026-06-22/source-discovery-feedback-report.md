# Source Discovery Feedback Report - 2026-06-22

status=WARNING
parser_gap_count=1
duplicate_discovery_gap_count=1
gemini_parser_failure_count=0

| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |
|---|---|---|---|---|---|---|---|
| PARSER_REPAIR_REQUIRED | missing_source_extraction | AOSP Site Updates - May 2026 | aosp-site-updates | true | exact_normalized_url | high | https://source.android.com/docs/compatibility/cts/camera-its-box |

## Gemini parser extraction failures

| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |
|---|---|---|---|---|---|---|
| none | none | none | none | none | none |  |

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

