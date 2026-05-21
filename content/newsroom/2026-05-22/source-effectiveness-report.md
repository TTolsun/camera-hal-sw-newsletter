# Source Effectiveness Report

Date: 2026-05-22

## Summary

- Sources: 47 (registry=47, synthetic=0)
- Collected candidates: 39
- Unregistered candidates: 0
- Eligible candidates: 4
- Selected candidates: 2
- Rendered main articles: 1
- Source gap candidates: 35
- Generic noise candidates: 26
- Duplicate candidates: 1
- Recommendations: NO_RECENT_SIGNAL: 39, OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: 2, KEEP_AND_FIX_PARSER: 6
- Selected main source quality coverage: 3/3
- Main-eligible source quality coverage: 1/1
- Conditional source promoted/blocked: 1/9
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | official_dated_release | 24 |
| source_url_quality | engineering_blog_with_camera_evidence | 10 |
| source_url_quality | official_site_update_row | 3 |
| source_url_quality | official_documentation_reference | 2 |
| source_url_quality | undated_reference_page | 1 |
| source_quality_status | blocked | 35 |
| source_quality_status | allowed | 5 |
| blocker | source_gap_risk | 33 |
| blocker | reference_only | 28 |
| blocker | fallback_without_concrete_source_fact | 2 |
| blocker | undated_reference_page | 1 |


## Top Effective Sources

| Source | Recommendation | Score | Collected | Eligible | Selected | Rendered |
| --- | --- | --- | --- | --- | --- | --- |
| android-developers-blog | KEEP_AND_FIX_PARSER | 13.09 | 21 | 2 | 2 | 1 |

## Sources Needing Parser Repair

| Source | Recommendation | Collected | Eligible | Source Gap | Top Reason |
| --- | --- | --- | --- | --- | --- |
| aosp-camera-documentation | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 1 | 0 | 1 | Review source-change-events artifacts before using this candidate. |
| camerax-release-notes | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 1 | 0 | 1 | Review source-change-events artifacts before using this candidate. |
| android-developers-blog | KEEP_AND_FIX_PARSER | 21 | 2 | 19 | main_eligible=false |
| android-developers-latest-updates | KEEP_AND_FIX_PARSER | 2 | 1 | 1 | No RSS item, no published date, no concrete release/API/behavior change detected. |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 2 | 0 | 2 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 10 | 1 | 9 | main_eligible=false |

## Generic Noise / Downgrade Candidates

_없음_

## Source Details

| Source | Recommendation | Score | Collected | Eligible Rate | Selection Rate | Rendered Rate | Gap Rate | Noise Rate | Duplicates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-developer-newsletter | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-developers-blog-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-weekly | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| anthropic-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-site-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| claude-code-changelog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| collabora-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| cppcon-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ee-times-embedded | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ee-times-semiconductors | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| embedded-com | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-cloud-ai-ml-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-deepmind-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-open-source-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-research-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hacker-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ieee-spectrum-embedded-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ieee-spectrum-embedded-systems | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| infoq | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernelnewbies-linuxchanges | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-documentation | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-release-announcements | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-project-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lwn-camera-media-articles | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microsoft-cpp-team-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| openai-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| phoronix-linux-camera-media | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| qualcomm-security-bulletins | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-mobile-security-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| software-engineering-daily | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-new-stack | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-register | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tldr | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| venturebeat-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yozm-it | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zdnet-korea | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-camera-documentation | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| camerax-release-notes | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| android-developers-blog | KEEP_AND_FIX_PARSER | 13.09 | 21 | 0.0952 | 1 | 0.5 | 0.9048 | 0.8571 | 1 |
| android-developers-latest-updates | KEEP_AND_FIX_PARSER | 5 | 2 | 0.5 | 0 | 0 | 0.5 | 0 | 0 |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 0 | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 0 | 10 | 0.1 | 0 | 0 | 0.9 | 0.4 | 0 |

## Warnings

- Missing optional artifact content/newsroom/2026-05-22/reporter-candidates.json; related metrics remain zero or artifact-limited.
