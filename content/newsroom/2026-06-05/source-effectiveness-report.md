# Source Effectiveness Report

Date: 2026-06-05

## Summary

- Sources: 62 (registry=62, synthetic=0)
- Collected candidates: 39
- Unregistered candidates: 0
- Eligible candidates: 8
- Selected candidates: 3
- Rendered main articles: 3
- Source gap candidates: 31
- Generic noise candidates: 29
- Duplicate candidates: 1
- Recommendations: NO_RECENT_SIGNAL: 54, KEEP: 2, KEEP_AND_FIX_PARSER: 6
- Selected main source quality coverage: 3/3
- Main-eligible source quality coverage: 5/5
- Conditional source promoted/blocked: 0/0
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | official_dated_release | 31 |
| source_url_quality | official_site_update_row | 5 |
| source_url_quality | official_release_note_anchor | 2 |
| source_url_quality | undated_reference_page | 2 |
| source_quality_status | blocked | 31 |
| source_quality_status | allowed | 9 |
| blocker | source_gap_risk | 31 |
| blocker | reference_only | 28 |
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
| aosp-site-updates | KEEP | 87.5 | 2 | 2 | 1 | 1 |
| camerax-release-notes | KEEP | 87.5 | 2 | 2 | 1 | 1 |
| android-developers-blog | KEEP_AND_FIX_PARSER | 12.59 | 27 | 3 | 1 | 1 |

## Sources Needing Parser Repair

| Source | Recommendation | Collected | Eligible | Source Gap | Top Reason |
| --- | --- | --- | --- | --- | --- |
| android-developers-blog | KEEP_AND_FIX_PARSER | 27 | 3 | 24 | main_eligible=false |
| android-developers-latest-updates | KEEP_AND_FIX_PARSER | 2 | 1 | 1 | No RSS item, no published date, no concrete release/API/behavior change detected. |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 3 | 0 | 3 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
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
| anthropic-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| llvm-project-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lore-linux-media-list | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lwn-camera-media-articles | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microsoft-cpp-team-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| openai-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| phoronix-linux-camera-media | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| aosp-site-updates | KEEP | 87.5 | 2 | 1 | 0.5 | 1 | 0 | 0 | 0 |
| camerax-release-notes | KEEP | 87.5 | 2 | 1 | 0.5 | 1 | 0 | 0 | 0 |
| android-developers-blog | KEEP_AND_FIX_PARSER | 12.59 | 27 | 0.1111 | 0.3333 | 1 | 0.8889 | 0.8519 | 1 |
| android-developers-latest-updates | KEEP_AND_FIX_PARSER | 5 | 2 | 0.5 | 0 | 0 | 0.5 | 0 | 0 |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 0 | 3 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |

## Warnings

- Fact-check source gap URL did not match a collected candidate: https://developer.android.com/jetpack/androidx/releases/camera#1.6.0;
