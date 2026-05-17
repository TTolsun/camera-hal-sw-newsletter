# Source Effectiveness Report

Date: 2026-05-17

## Summary

- Sources: 47 (registry=47, synthetic=0)
- Collected candidates: 40
- Unregistered candidates: 0
- Eligible candidates: 6
- Selected candidates: 3
- Rendered main articles: 3
- Source gap candidates: 34
- Generic noise candidates: 29
- Duplicate candidates: 0
- Recommendations: NO_RECENT_SIGNAL: 28, KEEP: 1, KEEP_AND_FIX_PARSER: 16, REVIEW_SOURCE_OR_PARSER: 1, KEEP_AND_MONITOR: 1
- Selected main source quality coverage: 3/3
- Main-eligible source quality coverage: 2/2
- Conditional source promoted/blocked: 2/18
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | engineering_blog_with_camera_evidence | 14 |
| source_url_quality | official_dated_release | 12 |
| source_url_quality | generic_ai_or_it_trend | 5 |
| source_url_quality | official_site_update_row | 4 |
| source_url_quality | undated_reference_page | 3 |
| source_url_quality | project_mailing_list_release | 1 |
| source_url_quality | tech_media_lead_requires_cross_check | 1 |
| source_quality_status | blocked | 34 |
| source_quality_status | allowed | 6 |
| blocker | source_gap_risk | 34 |
| blocker | reference_only | 32 |
| blocker | undated_reference_page | 3 |
| blocker | cross_check_required_but_missing | 1 |


## Top Effective Sources

| Source | Recommendation | Score | Collected | Eligible | Selected | Rendered |
| --- | --- | --- | --- | --- | --- | --- |
| libcamera-release-announcements | KEEP | 100 | 1 | 1 | 1 | 1 |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 35.72 | 14 | 2 | 2 | 2 |

## Sources Needing Parser Repair

| Source | Recommendation | Collected | Eligible | Source Gap | Top Reason |
| --- | --- | --- | --- | --- | --- |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 14 | 2 | 12 | main_eligible=false |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-developer-newsletter | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-developers-blog | KEEP_AND_FIX_PARSER | 6 | 0 | 6 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 2 | 0 | 2 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| anthropic-news | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| claude-code-changelog | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| google-cloud-ai-ml-blog | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| google-deepmind-blog | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| google-research-blog | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| libcamera-documentation | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Reference index source; use only as context/background and exclude from final article inputs. |
| llvm-release-notes | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | No RSS item, no published date, no concrete release/API/behavior change detected. |
| qualcomm-security-bulletins | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |
| samsung-mobile-security-updates | KEEP_AND_FIX_PARSER | 1 | 0 | 1 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. |

## Generic Noise / Downgrade Candidates

_없음_

## Source Details

| Source | Recommendation | Score | Collected | Eligible Rate | Selection Rate | Rendered Rate | Gap Rate | Noise Rate | Duplicates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-developers-blog-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-weekly | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-site-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| camerax-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| collabora-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| cppcon-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ee-times-embedded | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ee-times-semiconductors | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| embedded-com | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-open-source-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hacker-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ieee-spectrum-embedded-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ieee-spectrum-embedded-systems | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| infoq | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernelnewbies-linuxchanges | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-project-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lwn-camera-media-articles | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microsoft-cpp-team-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| openai-news | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| software-engineering-daily | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-new-stack | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-register | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tldr | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| venturebeat-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yozm-it | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zdnet-korea | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-release-announcements | KEEP | 100 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| iso-cpp-blog | KEEP_AND_FIX_PARSER | 35.72 | 14 | 0.1429 | 1 | 1 | 0.8571 | 0.6429 | 0 |
| android-compatibility-definition-document | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-developer-newsletter | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-developers-blog | KEEP_AND_FIX_PARSER | 0 | 6 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-security-bulletin | KEEP_AND_FIX_PARSER | 0 | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| anthropic-news | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-camera-documentation | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-whats-new-release-notes | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| claude-code-changelog | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| google-cloud-ai-ml-blog | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| google-deepmind-blog | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| google-research-blog | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| libcamera-documentation | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| llvm-release-notes | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| qualcomm-security-bulletins | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| samsung-mobile-security-updates | KEEP_AND_FIX_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| phoronix-linux-camera-media | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| android-developers-latest-updates | KEEP_AND_MONITOR | 35 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |

## Warnings

- Missing optional artifact content/newsroom/2026-05-17/reporter-candidates.json; related metrics remain zero or artifact-limited.
