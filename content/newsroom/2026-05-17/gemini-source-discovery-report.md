# Gemini Source Discovery Report - 2026-05-17

status=PASS
disabled_pass_through=false
llm_used=true
merge_mode=gemini_source_discovery
summary=Gemini ran, but found no new unique publishable candidates.
manual_candidate_count=40
manual_unique_url_count=40
gemini_candidate_count=6
gemini_unique_url_count=6
gemini_new_unique_url_count=0
gemini_manual_duplicate_url_count=6
gemini_duplicate_record_count=6
merged_candidate_count=46
merged_unique_url_count=40
gemini_publishable_candidate_count=0

source_candidate_artifact=content/collected-news/2026-05-17/manual-candidates.json
gemini_source_proposals=content/newsroom/2026-05-17/gemini-source-proposals.json
proposal_validation_report=content/newsroom/2026-05-17/gemini-source-proposal-validation-report.json
gemini_candidate_artifact=content/collected-news/2026-05-17/gemini-candidates.json
merged_candidate_artifact=content/collected-news/2026-05-17/merged-candidates.json
merged_candidate_manifest=content/collected-news/2026-05-17/merged-candidate-manifest.json
gemini_usage_report=content/newsroom/2026-05-17/gemini-usage-report.json
source_quality_report=content/newsroom/2026-05-17/source-quality-report.json
source_clusters=content/newsroom/2026-05-17/source-clusters.json
evidence_validation_report=content/newsroom/2026-05-17/evidence-validation-report.json
source_discovery_feedback_report=content/newsroom/2026-05-17/source-discovery-feedback-report.json
source_discovery_feedback_report_markdown=content/newsroom/2026-05-17/source-discovery-feedback-report.md

## Parser/source feedback

status=WARNING
parser_gap_count=3
duplicate_discovery_gap_count=3
source_discovery_feedback_report_markdown=content/newsroom/2026-05-17/source-discovery-feedback-report.md

- PARSER_REPAIR_REQUIRED: CameraX 1.6.1
  - url: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - Gemini rediscovered this URL (exact_normalized_url), but the manual candidate lacks concrete source_extraction bullets.
- PARSER_REPAIR_REQUIRED: 1.3.0-beta02
  - url: https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - Gemini rediscovered this URL (exact_normalized_url), but the manual candidate lacks concrete source_extraction bullets.
- PARSER_REPAIR_REQUIRED: 1.4.0-alpha07
  - url: https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07
  - adapter_hint: android-developers-jetpack-release
  - reason: missing_source_extraction
  - duplicate_match_type: exact_normalized_url
  - confidence: high
  - Gemini rediscovered this URL (exact_normalized_url), but the manual candidate lacks concrete source_extraction bullets.

