# Source Effectiveness Report

Date: 2026-09-28

## Summary

- Sources: 82 (registry=82, synthetic=0)
- Collected candidates: 50
- Unregistered candidates: 0
- Eligible candidates: 15
- Selected candidates: 5
- Rendered main articles: 4
- Source gap candidates: 35
- Generic noise candidates: 30
- Duplicate candidates: 0
- Recommendations: NO_RECENT_SIGNAL: 22, KEEP: 1, REVIEW_SOURCE_OR_PARSER: 22, KEEP_AND_MONITOR: 37
- Selected main source quality coverage: 5/5
- Main-eligible source quality coverage: 4/4
- Conditional source promoted/blocked: 1/37
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Collection stages

발견은 목록 전체 카드 수, 수집은 필터 전 후보 수입니다. 기존 Collected는 유지된 후보 수이며, 알 수 없는 값은 —로 표시합니다. 최종 선정은 Selected, 실제 본문 반영은 Rendered를 확인하세요.

| Source | Status | Discovered | In window | Raw collected | Filtered out | Candidates | Selected | Rendered | Reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-compatibility-definition-document | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-developer-newsletter | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-developers-blog | COLLECTION_CAPPED | — | — | 25 | 17 | 8 | 1 | 1 | source_cap, deferred_coverage=1, outside_window=13, source_cap=3 |
| android-developers-blog-camera | COLLECTION_UNKNOWN | — | — | 17 | 17 | 0 | 0 | 0 | outside_window=17 |
| android-developers-latest-updates | COLLECTION_UNKNOWN | — | — | 3 | 1 | 2 | 0 | 0 | outside_window=1 |
| android-mediacodec-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-mediarecorder-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-mediastore-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-ndk-releases | COLLECTION_INCOMPLETE | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, release_scan_page_cap, global_cap=1 |
| android-photo-picker-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-security-bulletin | COLLECTION_UNKNOWN | — | — | 10 | 9 | 1 | 0 | 0 | duplicate=1, outside_window=8 |
| android-supported-formats-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-weekly | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| androidx-media3-release-notes | COLLECTION_UNKNOWN | — | — | 12 | 11 | 1 | 0 | 0 | outside_window=11 |
| anthropic-news | COLLECTION_INCOMPLETE | 15 | 13 | 7 | 4 | 3 | 1 | 1 | article_cap, global_cap, skipped_article_budget, deferred_coverage=1, global_cap=3 |
| aosp-camera-documentation | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-gerrit-camera-changes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-release-camera-changes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-site-updates | COLLECTION_INCOMPLETE | — | — | 5 | 5 | 0 | 0 | 0 | aosp_site_update_date_outside_row_month, outside_window=5 |
| aosp-whats-new-release-notes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| arm-community-blogs | COLLECTION_CAPPED | — | — | 19 | 19 | 0 | 0 | 0 | global_cap, outside_window=12, relevance=1, global_cap=6 |
| camerax-release-notes | COLLECTION_UNKNOWN | — | — | 98 | 98 | 0 | 0 | 0 | duplicate=2, outside_window=96 |
| chromeos-gerrit-camera-changes | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| claude-blog | COLLECTION_CAPPED | 23 | 17 | 8 | 2 | 6 | 0 | 0 | article_cap, global_cap, deferred_coverage=1, global_cap=1 |
| claude-code-changelog | COLLECTION_INCOMPLETE | — | — | 22 | 18 | 4 | 0 | 0 | global_cap, release_scan_page_cap, source_cap, deferred_coverage=1, relevance=3, source_cap=10, global_cap=4 |
| codex-releases | COLLECTION_INCOMPLETE | — | — | 1 | 1 | 0 | 0 | 0 | release_page_fetch_failed, deferred_coverage=1 |
| collabora-blog | COLLECTION_CAPPED | — | — | 743 | 743 | 0 | 0 | 0 | global_cap, outside_window=735, relevance=2, global_cap=6 |
| cppcon-news | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| edge-ai-vision-alliance | COLLECTION_CAPPED | — | — | 50 | 50 | 0 | 0 | 0 | global_cap, source_cap, deferred_coverage=2, outside_window=2, relevance=18, source_cap=20, global_cap=8 |
| ee-times-embedded | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| ee-times-semiconductors | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| embedded-com | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| google-cloud-ai-ml-blog | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| google-deepmind-blog | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| google-open-source-blog | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| google-research-blog | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| google-security-blog | COLLECTION_UNKNOWN | — | — | 25 | 25 | 0 | 0 | 0 | outside_window=25 |
| hacker-news | COLLECTION_UNKNOWN | — | — | 32 | 32 | 0 | 0 | 0 | duplicate=1, deferred_coverage=17, outside_window=5, relevance=9 |
| huggingface-blog | COLLECTION_UNKNOWN | — | — | 869 | 869 | 0 | 0 | 0 | deferred_coverage=1, outside_window=847, relevance=21 |
| ieee-spectrum-embedded-ai | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| ieee-spectrum-embedded-systems | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| infoq | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| iso-cpp-blog | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| kernel-org-releases | COLLECTION_UNKNOWN | — | — | 10 | 9 | 1 | 0 | 0 | duplicate=9 |
| kernelnewbies-linuxchanges | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| libcamera-blog | COLLECTION_UNKNOWN | — | — | 10 | 10 | 0 | 0 | 0 | outside_window=10 |
| libcamera-documentation | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| libcamera-release-announcements | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| libcamera-upstream-releases | COLLECTION_UNKNOWN | — | — | 19 | 19 | 0 | 0 | 0 | outside_window=19 |
| llvm-project-blog | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| llvm-release-notes | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| lore-linux-media-ipu | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| lore-linux-media-list | COLLECTION_CAPPED | — | — | 101 | 93 | 8 | 3 | 2 | source_cap, duplicate=1, deferred_coverage=42, outside_window=12, series_collapsed=35, source_cap=3 |
| lwn-camera-media-articles | COLLECTION_CAPPED | — | — | 15 | 15 | 0 | 0 | 0 | global_cap, deferred_coverage=3, relevance=8, global_cap=4 |
| mediatek-security-bulletin | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| microisp-neural-isp | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| microsoft-cpp-team-blog | COLLECTION_CAPPED | — | — | 10 | 10 | 0 | 0 | 0 | global_cap, outside_window=2, relevance=1, global_cap=7 |
| mobile-ai-learned-isp-challenge | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| naver-deview | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| openai-news | COLLECTION_CAPPED | — | — | 1235 | 1227 | 8 | 0 | 0 | source_cap, duplicate=4, deferred_coverage=5, outside_window=1149, relevance=34, source_cap=35 |
| patchwork-libcamera-patches | COLLECTION_CAPPED | — | — | 500 | 492 | 8 | 0 | 0 | source_cap, deferred_coverage=5, outside_window=223, series_collapsed=216, source_cap=48 |
| phoronix-linux-camera-media | COLLECTION_CAPPED | — | — | 32 | 32 | 0 | 0 | 0 | global_cap, deferred_coverage=10, outside_window=1, relevance=14, global_cap=7 |
| pynet-learned-isp | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| qualcomm-security-bulletins | COLLECTION_CAPPED | — | — | 1 | 1 | 0 | 0 | 0 | global_cap, global_cap=1 |
| raspberry-pi-blog | COLLECTION_CAPPED | — | — | 10 | 10 | 0 | 0 | 0 | global_cap, deferred_coverage=1, outside_window=1, relevance=7, global_cap=1 |
| raspberrypi-libcamera-releases | COLLECTION_UNKNOWN | — | — | 7 | 7 | 0 | 0 | 0 | outside_window=7 |
| reddit-android-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-androiddev-camera | COLLECTION_CAPPED | — | — | 25 | 25 | 0 | 0 | 0 | global_cap, outside_window=21, relevance=2, global_cap=2 |
| reddit-artificial-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-camera-community | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-cpp-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-linux-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| samsung-mobile-security-updates | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| samsung-newsroom-korea | COLLECTION_UNKNOWN | — | — | 20 | 20 | 0 | 0 | 0 | deferred_coverage=2, outside_window=2, relevance=16 |
| software-engineering-daily | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| the-new-stack | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| the-register | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| tldr | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |
| tomshardware-ai | COLLECTION_CAPPED | — | — | 50 | 50 | 0 | 0 | 0 | global_cap, source_cap, deferred_coverage=6, relevance=29, source_cap=7, global_cap=8 |
| venturebeat-ai | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| yozm-it | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| zdnet-korea | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | relevance=1 |


## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | generic_ai_or_it_trend | 17 |
| source_url_quality | project_mailing_list_release | 16 |
| source_url_quality | official_dated_release | 10 |
| source_url_quality | project_release | 4 |
| source_url_quality | official_site_update_row | 2 |
| source_url_quality | official_release_note_anchor | 1 |
| source_quality_status | blocked | 45 |
| source_quality_status | allowed | 5 |
| blocker | source_gap_risk | 35 |
| blocker | reference_only | 30 |
| blocker | cross_check_required_but_missing | 17 |
| blocker | candidate_only_without_primary_confirmation | 1 |


## Community signals

- Community-signal candidates: 0
- Reddit candidates: 0
- Reddit cross-checked: 0
- Reddit-only blocked (no primary confirmation): 0

_없음_


## Top Effective Sources

| Source | Recommendation | Score | Collected | Eligible | Selected | Rendered |
| --- | --- | --- | --- | --- | --- | --- |
| lore-linux-media-list | KEEP | 68.22 | 8 | 7 | 3 | 2 |
| anthropic-news | REVIEW_SOURCE_OR_PARSER | 46.66 | 3 | 1 | 1 | 1 |
| android-developers-blog | REVIEW_SOURCE_OR_PARSER | 33.33 | 8 | 3 | 1 | 1 |

## Sources Needing Parser Repair

_없음_

## Generic Noise / Downgrade Candidates

_없음_

## Source Details

| Source | Recommendation | Score | Collected | Eligible Rate | Selection Rate | Rendered Rate | Gap Rate | Noise Rate | Duplicates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-compatibility-definition-document | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-developer-newsletter | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-developers-blog-camera | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-mediacodec-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-mediarecorder-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-mediastore-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-photo-picker-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-supported-formats-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-camera-documentation | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-gerrit-camera-changes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-release-camera-changes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-whats-new-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-security-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-release-announcements | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-upstream-releases | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lore-linux-media-ipu | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raspberrypi-libcamera-releases | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-mobile-security-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| software-engineering-daily | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| venturebeat-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lore-linux-media-list | KEEP | 68.22 | 8 | 0.875 | 0.4286 | 0.6667 | 0.125 | 0 | 0 |
| anthropic-news | REVIEW_SOURCE_OR_PARSER | 46.66 | 3 | 0.3333 | 1 | 1 | 0.6667 | 0.6667 | 0 |
| android-developers-blog | REVIEW_SOURCE_OR_PARSER | 33.33 | 8 | 0.375 | 0.3333 | 1 | 0.625 | 0.625 | 0 |
| android-developers-latest-updates | REVIEW_SOURCE_OR_PARSER | 5 | 2 | 0.5 | 0 | 0 | 0.5 | 0 | 0 |
| android-ndk-releases | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-security-bulletin | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| androidx-media3-release-notes | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| aosp-site-updates | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| claude-blog | REVIEW_SOURCE_OR_PARSER | 0 | 6 | 0 | 0 | 0 | 1 | 1 | 0 |
| claude-code-changelog | REVIEW_SOURCE_OR_PARSER | 0 | 4 | 0 | 0 | 0 | 1 | 1 | 0 |
| codex-releases | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| iso-cpp-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernel-org-releases | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| libcamera-documentation | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-project-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| openai-news | REVIEW_SOURCE_OR_PARSER | 0 | 8 | 0 | 0 | 0 | 1 | 1 | 0 |
| patchwork-libcamera-patches | REVIEW_SOURCE_OR_PARSER | 0 | 8 | 0.375 | 0 | 0 | 0.625 | 0.25 | 0 |
| reddit-android-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-artificial-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-camera-community | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-cpp-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-linux-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yozm-it | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-weekly | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| arm-community-blogs | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| camerax-release-notes | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| chromeos-gerrit-camera-changes | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| collabora-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| cppcon-news | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| edge-ai-vision-alliance | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ee-times-embedded | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ee-times-semiconductors | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| embedded-com | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-cloud-ai-ml-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-deepmind-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-open-source-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-research-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| hacker-news | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| huggingface-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ieee-spectrum-embedded-ai | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ieee-spectrum-embedded-systems | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| infoq | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernelnewbies-linuxchanges | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-release-notes | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lwn-camera-media-articles | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mediatek-security-bulletin | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microisp-neural-isp | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microsoft-cpp-team-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mobile-ai-learned-isp-challenge | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| phoronix-linux-camera-media | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pynet-learned-isp | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| qualcomm-security-bulletins | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raspberry-pi-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-androiddev-camera | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-newsroom-korea | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-new-stack | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-register | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tldr | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tomshardware-ai | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zdnet-korea | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Warnings

_없음_
