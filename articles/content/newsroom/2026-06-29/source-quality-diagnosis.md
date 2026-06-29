# 소스 품질 진단 리포트

Date: 2026-06-29

## 요약

- 원본 후보 수: 40
- 최종 사용 가능 후보 수: 6
- Primary Camera Stack 후보 수: 3
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험, 분류 체계 누락, Source discovery 중복 또는 무효
- 결론: 실제 뉴스 부족보다는 후보 추출/분류/source discovery 단계 손실 가능성이 큽니다.

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | android-compatibility-definition-document has KEEP_AND_FIX_PARSER recommendation. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | lwn-camera-media-articles has source coverage risk: source_gap_count=1. |
| 분류 체계 누락 | `taxonomy_missing` | true | 19 camera-relevant candidate(s) were not mapped to a known camera bucket. |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 15 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 최종 후보 | 주요 차단 원인 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 3 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| lore.kernel.org linux-media list | 8 | 2 | main_eligible=false; source_gap_risk=true | 소스 유지, 파서 수정 |
| Android Security Bulletin | 2 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; main_eligible=false | 소스 유지, 파서 수정 |
| Android Compatibility Definition Document | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Android Developer Newsletter | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| MediaRecorder Documentation | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Photo Picker Documentation | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Android Supported Media Formats | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Anthropic News | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| AOSP Camera Documentation | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| AOSP What's New / Release Notes | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Claude Code Changelog | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Google Cloud AI & Machine Learning Blog | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Google DeepMind Blog | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Google Research Blog | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| kernel.org Linux Releases | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| libcamera Release Announcements | 1 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 유지, 파서 수정 |
| LLVM Release Notes | 1 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 유지, 파서 수정 |
| Qualcomm Security Bulletins | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Samsung Mobile Security Updates | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | lore.kernel.org linux-media list | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Developers Blog | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Security Bulletin | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Compatibility Definition Document | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Developer Newsletter | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | MediaRecorder Documentation | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Photo Picker Documentation | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Supported Media Formats | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Anthropic News | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | AOSP Camera Documentation | Generic noise candidates were detected from artifact exclusion metadata. | high |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-06-29/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-06-29/evidence-pack-summary.json |  |

