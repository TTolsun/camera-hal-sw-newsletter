# Source Effectiveness Report

Date: 2026-08-31

## Summary

- Sources: 72 (registry=71, synthetic=1)
- Collected candidates: 40
- Unregistered candidates: 1
- Eligible candidates: 12
- Selected candidates: 5
- Rendered main articles: 5
- Source gap candidates: 28
- Generic noise candidates: 18
- Duplicate candidates: 0
- Recommendations: NO_RECENT_SIGNAL: 59, OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: 2, KEEP_AND_FIX_PARSER: 8, KEEP_AND_MONITOR: 3
- Selected main source quality coverage: 5/5
- Main-eligible source quality coverage: 9/9
- Conditional source promoted/blocked: 0/19
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | project_mailing_list_release | 16 |
| source_url_quality | official_dated_release | 9 |
| source_url_quality | official_site_update_row | 6 |
| source_url_quality | generic_ai_or_it_trend | 3 |
| source_url_quality | project_release | 2 |
| source_url_quality | undated_reference_page | 2 |
| source_url_quality | official_documentation_reference | 1 |
| source_url_quality | official_release_note_anchor | 1 |
| source_quality_status | blocked | 35 |
| source_quality_status | allowed | 5 |
| blocker | source_gap_risk | 28 |
| blocker | reference_only | 20 |
| blocker | cross_check_required_but_missing | 16 |
| blocker | undated_reference_page | 2 |


## Community signals

- Community-signal candidates: 0
- Reddit candidates: 0
- Reddit cross-checked: 0
- Reddit-only blocked (no primary confirmation): 0

_없음_


## Top Effective Sources

| Source | Recommendation | Score | Collected | Eligible | Selected | Rendered |
| --- | --- | --- | --- | --- | --- | --- |
| lore-linux-media-list | KEEP_AND_FIX_PARSER | 65 | 8 | 5 | 3 | 3 |
| patchwork-libcamera-patches | KEEP_AND_FIX_PARSER | 50 | 8 | 2 | 2 | 2 |

## Sources Needing Parser Repair

| Source | Recommendation | Collected | Eligible | Source Gap | Top Reason |
| --- | --- | --- | --- | --- | --- |
| android-developers-latest-updates | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 3 | 0 | 3 | No RSS item, no published date, no concrete release/API/behavior change detected. |
| synthetic-aosp-camera-its-release-notes | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 1 | 0 | 1 | Review source-change-events artifacts before using this candidate. |
| lore-linux-media-list | KEEP_AND_FIX_PARSER | 8 | 5 | 3 | main_eligible=false |
| patchwork-libcamera-patches | KEEP_AND_FIX_PARSER | 8 | 2 | 6 | main_eligible=false |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-developers-blog | KEEP_AND_FIX_PARSER | 8 | 0 | 8 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| anthropic-news | KEEP_AND_FIX_PARSER | 3 | 0 | 3 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |

## Generic Noise / Downgrade Candidates

_없음_

## Source Details

| Source | Recommendation | Score | Collected | Eligible Rate | Selection Rate | Rendered Rate | Gap Rate | Noise Rate | Duplicates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-developer-newsletter | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-developers-blog-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-mediacodec-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-mediarecorder-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-mediastore-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-photo-picker-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-supported-formats-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-weekly | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| androidx-media3-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-release-camera-changes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| claude-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| iso-cpp-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernel-org-releases | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernelnewbies-linuxchanges | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-documentation | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-release-announcements | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-upstream-releases | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-project-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lwn-camera-media-articles | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mediatek-security-bulletin | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microisp-neural-isp | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microsoft-cpp-team-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mobile-ai-learned-isp-challenge | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| openai-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| phoronix-linux-camera-media | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pynet-learned-isp | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| qualcomm-security-bulletins | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raspberry-pi-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-android-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-androiddev-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-artificial-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-camera-community | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-cpp-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-linux-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-mobile-security-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| software-engineering-daily | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-new-stack | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-register | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tldr | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| venturebeat-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yozm-it | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zdnet-korea | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-developers-latest-updates | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| synthetic-aosp-camera-its-release-notes | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| lore-linux-media-list | KEEP_AND_FIX_PARSER | 65 | 8 | 0.625 | 0.6 | 1 | 0.375 | 0.125 | 0 |
| patchwork-libcamera-patches | KEEP_AND_FIX_PARSER | 50 | 8 | 0.25 | 1 | 1 | 0.75 | 0.25 | 0 |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-developers-blog | KEEP_AND_FIX_PARSER | 0 | 8 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| anthropic-news | KEEP_AND_FIX_PARSER | 0 | 3 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-site-updates | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| camerax-release-notes | KEEP_AND_MONITOR | 35 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| raspberrypi-libcamera-releases | KEEP_AND_MONITOR | 35 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |

## Warnings

- Ambiguous source domain source.android.com matched registry sources android-compatibility-definition-document, android-security-bulletin, aosp-camera-documentation, aosp-release-camera-changes, aosp-site-updates, aosp-whats-new-release-notes.
- Unregistered candidate source grouped as synthetic-aosp-camera-its-release-notes.
