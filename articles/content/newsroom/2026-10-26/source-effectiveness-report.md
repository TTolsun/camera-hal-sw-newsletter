# Source Effectiveness Report

Date: 2026-10-26

## Summary

- Sources: 84 (registry=84, synthetic=0)
- Collected candidates: 50
- Unregistered candidates: 0
- Eligible candidates: 32
- Selected candidates: 5
- Rendered main articles: 4
- Source gap candidates: 18
- Generic noise candidates: 3
- Duplicate candidates: 0
- Recommendations: NO_RECENT_SIGNAL: 22, KEEP: 1, REVIEW_SOURCE_OR_PARSER: 24, KEEP_AND_MONITOR: 37
- Selected main source quality coverage: 4/4
- Main-eligible source quality coverage: 12/12
- Conditional source promoted/blocked: 20/18
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Collection stages

발견은 목록 전체 카드 수, 수집은 필터 전 후보 수입니다. 기존 Collected는 유지된 후보 수이며, 알 수 없는 값은 —로 표시합니다. 최종 선정은 Selected, 실제 본문 반영은 Rendered를 확인하세요.

| Source | Status | Discovered | In window | Raw collected | Filtered out | Candidates | Selected | Rendered | Reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-compatibility-definition-document | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-developer-newsletter | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-developers-blog | COLLECTION_INCOMPLETE | — | — | 8 | 2 | 6 | 0 | 0 | skipped_article_cap, triage=2 |
| android-developers-blog-camera | COLLECTION_UNKNOWN | — | — | 17 | 17 | 0 | 0 | 0 | outside_window=17 |
| android-developers-latest-updates | COLLECTION_UNKNOWN | — | — | 3 | 0 | 3 | 0 | 0 |  |
| android-mediacodec-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-mediarecorder-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-mediastore-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-ndk-releases | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | release_scan_page_cap |
| android-photo-picker-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-security-bulletin | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-supported-formats-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-weekly | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| androidx-gerrit-camera-changes | COLLECTION_INCOMPLETE | — | — | 87 | 79 | 8 | 4 | 3 | collection_window_truncated, source_cap, duplicate=8, source_cap=71 |
| androidx-gerrit-heifwriter-changes | COLLECTION_UNKNOWN | — | — | 6 | 3 | 3 | 0 | 0 | duplicate=3 |
| androidx-media3-release-notes | COLLECTION_UNKNOWN | — | — | 12 | 12 | 0 | 0 | 0 | outside_window=11, triage=1 |
| anthropic-news | COLLECTION_INCOMPLETE | 28 | 0 | 0 | 0 | 0 | 0 | 0 | index_collection_failed, unresolved_article_cards |
| aosp-camera-documentation | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-gerrit-camera-changes | COLLECTION_UNKNOWN | — | — | 1 | 0 | 1 | 0 | 0 |  |
| aosp-release-camera-changes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-site-updates | COLLECTION_INCOMPLETE | — | — | 5 | 5 | 0 | 0 | 0 | aosp_site_update_date_outside_row_month, outside_window=5 |
| aosp-whats-new-release-notes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| arm-community-blogs | COLLECTION_CAPPED | — | — | 19 | 18 | 1 | 0 | 0 | source_cap, source_cap=11, triage=7 |
| camerax-release-notes | COLLECTION_UNKNOWN | — | — | 99 | 98 | 1 | 0 | 0 | duplicate=2, outside_window=96 |
| chromeos-gerrit-camera-changes | COLLECTION_INCOMPLETE | — | — | 12 | 4 | 8 | 0 | 0 | collection_window_truncated, source_cap, source_cap=4 |
| claude-blog | COLLECTION_INCOMPLETE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | index_collection_failed |
| claude-code-changelog | COLLECTION_INCOMPLETE | — | — | 22 | 22 | 0 | 0 | 0 | release_scan_page_cap, source_cap, source_cap=14, triage=8 |
| codex-releases | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | skipped_index_budget, source_fetch_failed |
| collabora-blog | COLLECTION_UNKNOWN | — | — | 747 | 747 | 0 | 0 | 0 | outside_window=742, triage=5 |
| cppcon-news | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| edge-ai-vision-alliance | COLLECTION_CAPPED | — | — | 50 | 50 | 0 | 0 | 0 | source_cap, source_cap=42, triage=8 |
| ee-times-embedded | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| ee-times-semiconductors | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| embedded-com | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| google-cloud-ai-ml-blog | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| google-deepmind-blog | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| google-open-source-blog | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| google-research-blog | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| google-security-blog | COLLECTION_UNKNOWN | — | — | 25 | 25 | 0 | 0 | 0 | outside_window=25 |
| hacker-news | COLLECTION_CAPPED | — | — | 30 | 30 | 0 | 0 | 0 | source_cap, duplicate=1, source_cap=21, triage=8 |
| huggingface-blog | COLLECTION_CAPPED | — | — | 890 | 890 | 0 | 0 | 0 | source_cap, outside_window=862, source_cap=20, triage=8 |
| ieee-spectrum-embedded-ai | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| ieee-spectrum-embedded-systems | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| infoq | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| iso-cpp-blog | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| kernel-org-releases | COLLECTION_UNKNOWN | — | — | 9 | 9 | 0 | 0 | 0 | duplicate=8, triage=1 |
| kernelnewbies-linuxchanges | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| libcamera-blog | COLLECTION_UNKNOWN | — | — | 10 | 10 | 0 | 0 | 0 | outside_window=10 |
| libcamera-documentation | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| libcamera-release-announcements | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| libcamera-upstream-releases | COLLECTION_UNKNOWN | — | — | 19 | 19 | 0 | 0 | 0 | outside_window=19 |
| llvm-project-blog | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| llvm-release-notes | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| lore-linux-media-ipu | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| lore-linux-media-list | COLLECTION_CAPPED | — | — | 82 | 74 | 8 | 1 | 1 | source_cap, series_collapsed=56, source_cap=18 |
| lwn-camera-media-articles | COLLECTION_CAPPED | — | — | 15 | 15 | 0 | 0 | 0 | source_cap, source_cap=7, triage=8 |
| mediatek-security-bulletin | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| microisp-neural-isp | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| microsoft-cpp-team-blog | COLLECTION_UNKNOWN | — | — | 10 | 9 | 1 | 0 | 0 | outside_window=6, triage=3 |
| mobile-ai-learned-isp-challenge | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| naver-deview | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| openai-news | COLLECTION_CAPPED | — | — | 1318 | 1317 | 1 | 0 | 0 | source_cap, duplicate=4, outside_window=1236, source_cap=70, triage=7 |
| patchwork-libcamera-patches | COLLECTION_CAPPED | — | — | 250 | 243 | 7 | 0 | 0 | source_cap, duplicate=1, outside_window=38, series_collapsed=149, source_cap=54, triage=1 |
| phoronix-linux-camera-media | COLLECTION_CAPPED | — | — | 32 | 32 | 0 | 0 | 0 | source_cap, source_cap=24, triage=8 |
| pynet-learned-isp | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| qualcomm-security-bulletins | COLLECTION_UNKNOWN | — | — | 5 | 4 | 1 | 0 | 0 | duplicate=4 |
| raspberry-pi-blog | COLLECTION_CAPPED | — | — | 10 | 10 | 0 | 0 | 0 | source_cap, source_cap=2, triage=8 |
| raspberrypi-libcamera-releases | COLLECTION_UNKNOWN | — | — | 7 | 6 | 1 | 0 | 0 | outside_window=6 |
| reddit-android-camera | COLLECTION_CAPPED | — | — | 25 | 25 | 0 | 0 | 0 | source_cap, source_cap=17, triage=8 |
| reddit-androiddev-camera | COLLECTION_UNKNOWN | — | — | 25 | 25 | 0 | 0 | 0 | outside_window=18, triage=7 |
| reddit-artificial-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-camera-community | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-cpp-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-linux-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| samsung-mobile-security-updates | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| samsung-newsroom-korea | COLLECTION_CAPPED | — | — | 20 | 20 | 0 | 0 | 0 | source_cap, source_cap=12, triage=8 |
| software-engineering-daily | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| the-new-stack | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| the-register | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| tldr | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| tomshardware-ai | COLLECTION_CAPPED | — | — | 50 | 50 | 0 | 0 | 0 | source_cap, source_cap=42, triage=8 |
| venturebeat-ai | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| yozm-it | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| zdnet-korea | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |


## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | project_mailing_list_release | 35 |
| source_url_quality | official_dated_release | 7 |
| source_url_quality | official_site_update_row | 3 |
| source_url_quality | engineering_blog_with_camera_evidence | 1 |
| source_url_quality | generic_ai_or_it_trend | 1 |
| source_url_quality | official_release_note_anchor | 1 |
| source_url_quality | project_release | 1 |
| source_url_quality | tech_media_lead_requires_cross_check | 1 |
| source_quality_status | blocked | 28 |
| source_quality_status | allowed | 22 |
| blocker | source_gap_risk | 18 |
| blocker | cross_check_required_but_missing | 17 |
| blocker | reference_only | 8 |
| blocker | trend_reference_project | 8 |
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
| androidx-gerrit-camera-changes | KEEP | 80 | 8 | 8 | 4 | 3 |
| lore-linux-media-list | REVIEW_SOURCE_OR_PARSER | 57.5 | 8 | 5 | 1 | 1 |

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
| android-security-bulletin | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| android-supported-formats-reference | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-camera-documentation | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-release-camera-changes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-whats-new-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-security-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-release-announcements | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-upstream-releases | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lore-linux-media-ipu | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mediatek-security-bulletin | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-mobile-security-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| software-engineering-daily | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| venturebeat-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| androidx-gerrit-camera-changes | KEEP | 80 | 8 | 1 | 0.5 | 0.75 | 0 | 0 | 0 |
| lore-linux-media-list | REVIEW_SOURCE_OR_PARSER | 57.5 | 8 | 0.625 | 0.2 | 1 | 0.375 | 0 | 0 |
| patchwork-libcamera-patches | REVIEW_SOURCE_OR_PARSER | 17.86 | 7 | 0.7143 | 0 | 0 | 0.2857 | 0 | 0 |
| android-developers-blog | REVIEW_SOURCE_OR_PARSER | 0 | 6 | 0.3333 | 0 | 0 | 0.6667 | 0.5 | 0 |
| android-developers-latest-updates | REVIEW_SOURCE_OR_PARSER | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| android-ndk-releases | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| anthropic-news | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-site-updates | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| arm-community-blogs | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| camerax-release-notes | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| claude-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| claude-code-changelog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| codex-releases | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| iso-cpp-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-documentation | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-project-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microsoft-cpp-team-blog | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| openai-news | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| qualcomm-security-bulletins | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| raspberrypi-libcamera-releases | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| reddit-artificial-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-camera-community | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-cpp-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-linux-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yozm-it | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| androidx-gerrit-heifwriter-changes | KEEP_AND_MONITOR | 35 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| aosp-gerrit-camera-changes | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| chromeos-gerrit-camera-changes | KEEP_AND_MONITOR | 35 | 8 | 1 | 0 | 0 | 0 | 0 | 0 |
| android-weekly | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| androidx-media3-release-notes | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| kernel-org-releases | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kernelnewbies-linuxchanges | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-release-notes | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lwn-camera-media-articles | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| microisp-neural-isp | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mobile-ai-learned-isp-challenge | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| phoronix-linux-camera-media | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pynet-learned-isp | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raspberry-pi-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-android-camera | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-androiddev-camera | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-newsroom-korea | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-new-stack | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-register | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tldr | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tomshardware-ai | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zdnet-korea | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Warnings

- Rendered section source URL matched a candidate but not a unique source: https://android-review.googlesource.com/c/platform/frameworks/support/+/4375770
