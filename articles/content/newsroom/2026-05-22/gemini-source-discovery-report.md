# Gemini Source Discovery Report - 2026-05-22

status=PASS
status_detail=
disabled_pass_through=false
llm_used=true
merge_mode=gemini_source_discovery
summary=Gemini ran, but found no new unique publishable candidates.
manual_candidate_count=40
manual_unique_url_count=40
gemini_candidate_count=26
gemini_unique_url_count=26
gemini_new_unique_url_count=0
gemini_manual_duplicate_url_count=26
gemini_duplicate_record_count=26
merged_candidate_count=66
merged_unique_url_count=40
gemini_publishable_candidate_count=0

source_candidate_artifact=content/collected-news/2026-05-22/manual-candidates.json
gemini_source_proposals=content/newsroom/2026-05-22/gemini-source-proposals.json
proposal_validation_report=content/newsroom/2026-05-22/gemini-source-proposal-validation-report.json
gemini_candidate_artifact=content/collected-news/2026-05-22/gemini-candidates.json
merged_candidate_artifact=content/collected-news/2026-05-22/merged-candidates.json
merged_candidate_manifest=content/collected-news/2026-05-22/merged-candidate-manifest.json
gemini_usage_report=content/newsroom/2026-05-22/gemini-usage-report.json
source_quality_report=content/newsroom/2026-05-22/source-quality-report.json
source_clusters=content/newsroom/2026-05-22/source-clusters.json
evidence_validation_report=content/newsroom/2026-05-22/evidence-validation-report.json
seed_candidate_artifact=
seed_evidence_pack=
seed_evidence_pack_markdown=
seed_fetch_report=
seed_fetch_report_markdown=
seed_merge_report=
seed_merge_report_markdown=
source_discovery_feedback_report=content/newsroom/2026-05-22/source-discovery-feedback-report.json
source_discovery_feedback_report_markdown=content/newsroom/2026-05-22/source-discovery-feedback-report.md

## Priority Override / Legacy Compatibility

This PR is part of #185 seed evidence workflow migration.
The seed evidence workflow is prioritized over legacy-pattern cleanup, but source/evidence/security/publish safety remains non-negotiable.

### Required checks for this PR
- [ ] Targeted #185 unit tests pass
- [ ] Targeted workflow tests pass
- [ ] `npm.cmd run validate` passes
- [ ] Source/evidence/security gates are not weakened

### Legacy-pattern failures
| Test | Failure reason | Classification | Follow-up |
| --- | --- | --- | --- |
| none | none | none | none |

### Non-negotiable gates
- [ ] No private/internal URL fetch
- [ ] No source_gap_risk bypass
- [ ] No quality threshold lowering
- [ ] No 03 re-crawl
- [ ] No Gemini proposal promoted without deterministic validation

## Parser/source feedback

status=WARNING
parser_gap_count=0
duplicate_discovery_gap_count=0
gemini_parser_failure_count=1
source_discovery_feedback_report_markdown=content/newsroom/2026-05-22/source-discovery-feedback-report.md

- GEMINI_PARSER_EXTRACTION_REQUIRED: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1
  - rejected_reason: discovered_not_extractable
  - discovery_status: discovered
  - extraction_status: discovered_not_extractable
  - adapter_hint: android-developers-jetpack-release
  - suggested_fixture_case: Add or update a CameraX release-note fixture with version/date/component/behavior evidence.

## Rejected proposals

- discovered_not_extractable: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1 (Deterministic parser did not extract release-note evidence for this discovered URL.)
- domain_not_allowed: https://goo.gle/AdaptiveApps_IO26

