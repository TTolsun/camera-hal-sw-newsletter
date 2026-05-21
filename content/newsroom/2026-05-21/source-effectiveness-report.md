# Source Effectiveness Report

Date: 2026-05-21

## Summary

- Sources: 47 (registry=47, synthetic=0)
- Collected candidates: 39
- Unregistered candidates: 0
- Eligible candidates: 5
- Selected candidates: 2
- Rendered main articles: 1
- Source gap candidates: 35
- Generic noise candidates: 29
- Duplicate candidates: 1
- Recommendations: NO_RECENT_SIGNAL: 39, OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: 1, KEEP_AND_FIX_PARSER: 6, KEEP_AND_MONITOR: 1
- Selected main source quality coverage: 3/3
- Main-eligible source quality coverage: 2/2
- Conditional source promoted/blocked: 2/4
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | official_dated_release | 27 |
| source_url_quality | engineering_blog_with_camera_evidence | 6 |
| source_url_quality | official_site_update_row | 4 |
| source_url_quality | undated_reference_page | 2 |
| source_url_quality | project_mailing_list_release | 1 |
| source_quality_status | blocked | 35 |
| source_quality_status | allowed | 5 |
| blocker | source_gap_risk | 35 |
| blocker | reference_only | 33 |
| blocker | undated_reference_page | 2 |


## Top Effective Sources

| Source | Recommendation | Score | Collected | Eligible | Selected | Rendered |
| --- | --- | --- | --- | --- | --- | --- |
| android-developers-blog | KEEP_AND_FIX_PARSER | 11.04 | 24 | 2 | 2 | 1 |

## Sources Needing Parser Repair

| Source | Recommendation | Collected | Eligible | Source Gap | Top Reason |
| --- | --- | --- | --- | --- | --- |
| android-developers-latest-updates | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 3 | 0 | 3 | No RSS item, no published date, no concrete release/API/behavior change detected. |
| android-developers-blog | KEEP_AND_FIX_PARSER | 24 | 2 | 23 | main_eligible=false |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 2 | 0 | 2 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 6 | 2 | 4 | main_eligible=false |

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
| camerax-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| android-developers-latest-updates | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| android-developers-blog | KEEP_AND_FIX_PARSER | 11.04 | 24 | 0.0833 | 1 | 0.5 | 0.9583 | 0.875 | 1 |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 0 | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 0 | 6 | 0.3333 | 0 | 0 | 0.6667 | 0.5 | 0 |
| libcamera-release-announcements | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

## Warnings

- Unattributed fact-check source gap could not be mapped to a source: The source article is a high-level blog post from Google I/O. It does not specify the exact CameraX library version, concrete API changes, or direct HAL implementation requirements related to supporting adaptive UIs. The newsletter article correctly infers the impact, but the source itself lacks technical depth.
