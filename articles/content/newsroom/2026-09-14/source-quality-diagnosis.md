# 소스 품질 진단 리포트

Date: 2026-09-14

## 요약

- 원본 후보 수: 40
- 최종 사용 가능 후보 수: 25
- Primary Camera Stack 후보 수: 11
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험, 분류 체계 누락, Source discovery 중복 또는 무효
- 결론: 실제 뉴스 부족보다는 후보 추출/분류/source discovery 단계 손실 가능성이 큽니다.

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | android-developers-latest-updates has REVIEW_SOURCE_OR_PARSER recommendation. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=5. |
| 분류 체계 누락 | `taxonomy_missing` | true | 31 camera-relevant candidate(s) were not mapped to a known camera bucket. |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 16 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 최종 후보 | 주요 차단 원인 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Security Bulletin | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Android Developers Blog | 8 | 3 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list (Intel IPU) | 8 | 4 | finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 5 | Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 2 | 1 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Android Compatibility Definition Document | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Developer Newsletter | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Developers Blog - Camera | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaCodec Reference | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaRecorder Documentation | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaStore Reference | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Photo Picker Documentation | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Supported Media Formats | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Weekly | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Media3 Release Notes | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Anthropic News | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| AOSP Camera Documentation | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| AOSP Release Source Drop (camera changes) | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| AOSP Site Updates | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| AOSP What's New / Release Notes | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Security Bulletin | Generic noise candidates were detected from artifact exclusion metadata. | high |
| Multimedia bucket 추가 | `ADD_MULTIMEDIA_BUCKET` | 전체 | 31 camera-relevant candidate(s) were not mapped to a known camera bucket. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic noise candidates were detected from artifact exclusion metadata. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list (Intel IPU) | Source gap candidates may indicate source URL, dated evidence, or parser repair work. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | Source gap candidates may indicate source URL, dated evidence, or parser repair work. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | Source gap candidates may indicate source URL, dated evidence, or parser repair work. | medium |
| Source discovery 중복 제거/수리 | `REPAIR_SOURCE_DISCOVERY_DUPLICATES` | 전체 | Gemini discovery produced 16 candidate(s) but gemini_new_unique_url_count=0.; Duplicate discovery signal detected: gemini_manual_duplicate_url_count=16, duplicate_discovery_gap_count=0. | medium |
| 기사 부족 주간으로 판단, 조치 없음 | `NO_ACTION_THIN_WEEK` | Android Compatibility Definition Document | No recent candidates were collected for this source. | medium |
| 기사 부족 주간으로 판단, 조치 없음 | `NO_ACTION_THIN_WEEK` | Android Developer Newsletter | No recent candidates were collected for this source. | medium |
| 기사 부족 주간으로 판단, 조치 없음 | `NO_ACTION_THIN_WEEK` | Android Developers Blog - Camera | No recent candidates were collected for this source. | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-09-14/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-09-14/evidence-pack-summary.json |  |

