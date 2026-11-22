# Source Effectiveness Report

Date: 2026-11-23

## Summary

- Sources: 86 (registry=84, synthetic=2)
- Collected candidates: 50
- Unregistered candidates: 2
- Eligible candidates: 30
- Selected candidates: 5
- Rendered main articles: 5
- Source gap candidates: 20
- Generic noise candidates: 12
- Duplicate candidates: 0
- Recommendations: NO_RECENT_SIGNAL: 23, KEEP: 1, REVIEW_SOURCE_OR_PARSER: 20, KEEP_AND_MONITOR: 42
- Selected main source quality coverage: 5/5
- Main-eligible source quality coverage: 14/14
- Conditional source promoted/blocked: 14/21
- Unknown source quality: 0
- Source quality field drift: 0
- Legacy source quality warnings: 0

## Collection stages

발견은 목록 전체 카드 수, 수집은 필터 전 후보 수입니다. 기존 Collected는 유지된 후보 수이며, 알 수 없는 값은 —로 표시합니다. 최종 선정은 Selected, 실제 본문 반영은 Rendered를 확인하세요.

| Source | Status | Discovered | In window | Raw collected | Filtered out | Candidates | Selected | Rendered | Reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| android-compatibility-definition-document | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-developer-newsletter | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-developers-blog | COLLECTION_INCOMPLETE | — | — | 8 | 0 | 8 | 0 | 0 | skipped_article_cap |
| android-developers-blog-camera | COLLECTION_UNKNOWN | — | — | 17 | 17 | 0 | 0 | 0 | outside_window=17 |
| android-developers-latest-updates | COLLECTION_UNKNOWN | — | — | 3 | 1 | 2 | 1 | 1 | outside_window=1 |
| android-mediacodec-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-mediarecorder-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-mediastore-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-ndk-releases | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | release_scan_page_cap |
| android-photo-picker-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-security-bulletin | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-supported-formats-reference | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| android-weekly | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| androidx-gerrit-camera-changes | COLLECTION_INCOMPLETE | — | — | 90 | 82 | 8 | 4 | 4 | collection_window_truncated, source_cap, source_cap=47, triage=35 |
| androidx-gerrit-heifwriter-changes | COLLECTION_UNKNOWN | — | — | 4 | 1 | 3 | 0 | 0 | duplicate=1 |
| androidx-media3-release-notes | COLLECTION_UNKNOWN | — | — | 12 | 12 | 0 | 0 | 0 | outside_window=9, triage=3 |
| anthropic-news | COLLECTION_INCOMPLETE | 30 | 0 | 0 | 0 | 0 | 0 | 0 | index_collection_failed, unresolved_article_cards |
| aosp-camera-documentation | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-gerrit-camera-changes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-release-camera-changes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| aosp-site-updates | COLLECTION_INCOMPLETE | — | — | 5 | 5 | 0 | 0 | 0 | aosp_site_update_date_outside_row_month, outside_window=5 |
| aosp-whats-new-release-notes | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| arm-community-blogs | COLLECTION_CAPPED | — | — | 19 | 19 | 0 | 0 | 0 | source_cap, source_cap=11, triage=8 |
| camerax-release-notes | COLLECTION_UNKNOWN | — | — | 101 | 99 | 2 | 0 | 0 | duplicate=2, outside_window=97 |
| chromeos-gerrit-camera-changes | COLLECTION_UNKNOWN | — | — | 9 | 8 | 1 | 0 | 0 | duplicate=1, triage=7 |
| claude-blog | COLLECTION_INCOMPLETE | 0 | 0 | 0 | 0 | 0 | 0 | 0 | index_collection_failed |
| claude-code-changelog | COLLECTION_INCOMPLETE | — | — | 18 | 17 | 1 | 0 | 0 | release_page_fetch_failed, source_cap, source_cap=10, triage=7 |
| codex-releases | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| collabora-blog | COLLECTION_UNKNOWN | — | — | 752 | 752 | 0 | 0 | 0 | outside_window=746, triage=6 |
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
| huggingface-blog | COLLECTION_CAPPED | — | — | 915 | 915 | 0 | 0 | 0 | source_cap, outside_window=879, source_cap=28, triage=8 |
| ieee-spectrum-embedded-ai | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| ieee-spectrum-embedded-systems | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| infoq | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| iso-cpp-blog | COLLECTION_CAPPED | — | — | 50 | 46 | 4 | 0 | 0 | source_cap, duplicate=1, outside_window=26, source_cap=15, triage=4 |
| kernel-org-releases | COLLECTION_UNKNOWN | — | — | 10 | 10 | 0 | 0 | 0 | duplicate=9, triage=1 |
| kernelnewbies-linuxchanges | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| libcamera-blog | COLLECTION_UNKNOWN | — | — | 10 | 10 | 0 | 0 | 0 | outside_window=10 |
| libcamera-documentation | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| libcamera-release-announcements | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| libcamera-upstream-releases | COLLECTION_UNKNOWN | — | — | 20 | 19 | 1 | 0 | 0 | outside_window=19 |
| llvm-project-blog | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| llvm-release-notes | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| lore-linux-media-ipu | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| lore-linux-media-list | COLLECTION_CAPPED | — | — | 103 | 95 | 8 | 0 | 0 | source_cap, series_collapsed=65, source_cap=30 |
| lwn-camera-media-articles | COLLECTION_CAPPED | — | — | 15 | 15 | 0 | 0 | 0 | source_cap, source_cap=7, triage=8 |
| mediatek-security-bulletin | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| microisp-neural-isp | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| microsoft-cpp-team-blog | COLLECTION_UNKNOWN | — | — | 10 | 10 | 0 | 0 | 0 | outside_window=3, triage=7 |
| mobile-ai-learned-isp-challenge | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| naver-deview | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| openai-news | COLLECTION_CAPPED | — | — | 1421 | 1421 | 0 | 0 | 0 | source_cap, duplicate=6, outside_window=1297, source_cap=110, triage=8 |
| patchwork-libcamera-patches | COLLECTION_CAPPED | — | — | 500 | 492 | 8 | 0 | 0 | source_cap, duplicate=1, outside_window=17, series_collapsed=399, source_cap=75 |
| phoronix-linux-camera-media | COLLECTION_CAPPED | — | — | 32 | 32 | 0 | 0 | 0 | source_cap, source_cap=24, triage=8 |
| pynet-learned-isp | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| qualcomm-security-bulletins | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| raspberry-pi-blog | COLLECTION_CAPPED | — | — | 10 | 10 | 0 | 0 | 0 | source_cap, source_cap=2, triage=8 |
| raspberrypi-libcamera-releases | COLLECTION_UNKNOWN | — | — | 6 | 4 | 2 | 0 | 0 | outside_window=4 |
| reddit-android-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-androiddev-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-artificial-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-camera-community | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-cpp-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| reddit-linux-camera | COLLECTION_INCOMPLETE | — | — | 0 | 0 | 0 | 0 | 0 | source_fetch_failed |
| samsung-mobile-security-updates | COLLECTION_UNKNOWN | — | — | 0 | 0 | 0 | 0 | 0 |  |
| samsung-newsroom-korea | COLLECTION_CAPPED | — | — | 20 | 20 | 0 | 0 | 0 | source_cap, source_cap=12, triage=8 |
| software-engineering-daily | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| synthetic-android-kernel-exynos-camera | COLLECTION_UNKNOWN | — | — | — | — | 1 | 0 | 0 |  |
| synthetic-samsung-global-camera | COLLECTION_UNKNOWN | — | — | — | — | 1 | 0 | 0 |  |
| the-new-stack | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| the-register | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| tldr | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| tomshardware-ai | COLLECTION_CAPPED | — | — | 50 | 50 | 0 | 0 | 0 | source_cap, source_cap=42, triage=8 |
| venturebeat-ai | COLLECTION_UNKNOWN | — | — | — | — | 0 | 0 | 0 |  |
| yozm-it | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |
| zdnet-korea | COLLECTION_UNKNOWN | — | — | 1 | 1 | 0 | 0 | 0 | triage=1 |


## Source Quality Summary

| Metric | Key | Count |
| --- | --- | --- |
| source_url_quality | project_mailing_list_release | 29 |
| source_url_quality | official_dated_release | 8 |
| source_url_quality | engineering_blog_with_camera_evidence | 4 |
| source_url_quality | project_release | 4 |
| source_url_quality | official_release_note_anchor | 2 |
| source_url_quality | official_site_update_row | 2 |
| source_url_quality | tech_media_lead_requires_cross_check | 1 |
| source_quality_status | blocked | 33 |
| source_quality_status | allowed | 17 |
| blocker | source_gap_risk | 20 |
| blocker | cross_check_required_but_missing | 17 |
| blocker | reference_only | 15 |
| blocker | trend_reference_project | 11 |
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
| androidx-gerrit-camera-changes | KEEP | 87.5 | 8 | 8 | 4 | 4 |
| android-developers-latest-updates | REVIEW_SOURCE_OR_PARSER | 70 | 2 | 1 | 1 | 1 |

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
| aosp-gerrit-camera-changes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-release-camera-changes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-whats-new-release-notes | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| google-security-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-blog | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| libcamera-release-announcements | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| lore-linux-media-ipu | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mediatek-security-bulletin | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| naver-deview | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| qualcomm-security-bulletins | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-mobile-security-updates | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| software-engineering-daily | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| venturebeat-ai | NO_RECENT_SIGNAL | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| androidx-gerrit-camera-changes | KEEP | 87.5 | 8 | 1 | 0.5 | 1 | 0 | 0 | 0 |
| android-developers-latest-updates | REVIEW_SOURCE_OR_PARSER | 70 | 2 | 0.5 | 1 | 1 | 0.5 | 0 | 0 |
| camerax-release-notes | REVIEW_SOURCE_OR_PARSER | 5 | 2 | 0.5 | 0 | 0 | 0.5 | 0 | 0 |
| raspberrypi-libcamera-releases | REVIEW_SOURCE_OR_PARSER | 5 | 2 | 0.5 | 0 | 0 | 0.5 | 0 | 0 |
| android-developers-blog | REVIEW_SOURCE_OR_PARSER | 0 | 8 | 0.125 | 0 | 0 | 0.875 | 0.875 | 0 |
| android-ndk-releases | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| anthropic-news | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| aosp-site-updates | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| claude-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| codex-releases | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| iso-cpp-blog | REVIEW_SOURCE_OR_PARSER | 0 | 4 | 0 | 0 | 0 | 1 | 0.25 | 0 |
| libcamera-documentation | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| llvm-project-blog | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| patchwork-libcamera-patches | REVIEW_SOURCE_OR_PARSER | 0 | 8 | 0.5 | 0 | 0 | 0.5 | 0.25 | 0 |
| reddit-android-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-androiddev-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-artificial-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-camera-community | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-cpp-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| reddit-linux-camera | REVIEW_SOURCE_OR_PARSER | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| synthetic-samsung-global-camera | REVIEW_SOURCE_OR_PARSER | 0 | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| androidx-gerrit-heifwriter-changes | KEEP_AND_MONITOR | 35 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| chromeos-gerrit-camera-changes | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| claude-code-changelog | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| libcamera-upstream-releases | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| synthetic-android-kernel-exynos-camera | KEEP_AND_MONITOR | 35 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| lore-linux-media-list | KEEP_AND_MONITOR | 25 | 8 | 0.875 | 0 | 0 | 0.125 | 0.125 | 0 |
| android-weekly | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| androidx-media3-release-notes | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| arm-community-blogs | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
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
| microsoft-cpp-team-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mobile-ai-learned-isp-challenge | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| openai-news | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| phoronix-linux-camera-media | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pynet-learned-isp | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| raspberry-pi-blog | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| samsung-newsroom-korea | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-new-stack | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| the-register | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tldr | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tomshardware-ai | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yozm-it | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| zdnet-korea | KEEP_AND_MONITOR | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Warnings

- Ambiguous source domain android-review.googlesource.com matched registry sources androidx-gerrit-camera-changes, androidx-gerrit-heifwriter-changes, aosp-gerrit-camera-changes.
- Ambiguous source domain news.samsung.com matched registry sources samsung-newsroom-korea, samsung-newsroom-korea.
- Unregistered candidate source grouped as synthetic-android-kernel-exynos-camera.
- Unregistered candidate source grouped as synthetic-samsung-global-camera.
