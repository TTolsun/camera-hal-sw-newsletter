# 소스 품질 진단 리포트

Date: 2026-07-27

## 요약

- 원본 후보 수: 40
- 최종 사용 가능 후보 수: 13
- Primary Camera Stack 후보 수: 8
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 분류 체계 누락, Source discovery 중복 또는 무효
- 결론: 실제 뉴스 부족보다는 후보 추출/분류/source discovery 단계 손실 가능성이 큽니다.

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | android-compatibility-definition-document has KEEP_AND_FIX_PARSER recommendation. |
| 소스 풀 부족 위험 | `source_gap_risk` | false | 진단 신호 없음 |
| 분류 체계 누락 | `taxonomy_missing` | true | 12 camera-relevant candidate(s) were not mapped to a known camera bucket. |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 18 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 최종 후보 | 주요 차단 원인 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| libcamera Patchwork (patch review) | 8 | 3 | main_eligible=false; source_gap_risk=true | 소스 유지, 파서 수정 |
| Android Developers Latest Updates | 3 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 유지, 파서 수정 |
| Android Security Bulletin | 2 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; main_eligible=false | 소스 유지, 파서 수정 |
| Media3 Release Notes | 2 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| Android Compatibility Definition Document | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| MediaRecorder Documentation | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Photo Picker Documentation | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Android Supported Media Formats | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| AOSP Camera Documentation | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| AOSP What's New / Release Notes | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Samsung Mobile Security Updates | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 유지, 파서 수정 |
| Android Developer Newsletter | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Developers Blog - Camera | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaCodec Reference | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaStore Reference | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Weekly | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Anthropic News | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| AOSP Site Updates | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Claude Code Changelog | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Developers Blog | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | libcamera Patchwork (patch review) | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Developers Latest Updates | Official or high-priority source produced camera-relevant candidates, but parser/source-extraction-like rejection reasons blocked eligibility. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Security Bulletin | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Media3 Release Notes | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Compatibility Definition Document | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | MediaRecorder Documentation | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Photo Picker Documentation | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Supported Media Formats | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | AOSP Camera Documentation | Generic noise candidates were detected from artifact exclusion metadata. | high |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-07-27/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-07-27/evidence-pack-summary.json |  |

