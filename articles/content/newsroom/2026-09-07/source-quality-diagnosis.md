# 소스 품질 진단 리포트

Date: 2026-09-07

## 요약

- 원본 후보 수: 40
- 최종 사용 가능 후보 수: 17
- Primary Camera Stack 후보 수: 9
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험, 분류 체계 누락, Source discovery 중복 또는 무효
- 결론: 실제 뉴스 부족보다는 후보 추출/분류/source discovery 단계 손실 가능성이 큽니다.

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | android-developers-latest-updates has OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR recommendation. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=6. |
| 분류 체계 누락 | `taxonomy_missing` | true | 26 camera-relevant candidate(s) were not mapped to a known camera bucket. |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 13 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 최종 후보 | 주요 차단 원인 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Latest Updates | 3 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 유지, 파서 수정 |
| Claude Blog | 2 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| Anthropic News | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| kernel.org Linux Releases | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 유지, 파서 수정 |
| Android Developers Blog | 8 | 2 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list | 8 | 5 | main_eligible=false; source_gap_risk=true | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 3 | main_eligible=false; source_gap_risk=true | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 2 | 1 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Unregistered source: aosp-camera-its-release-notes | 2 | 1 | Review source-change-events artifacts before using this candidate.; Source snapshot event is review/watchlist only because date evidence is weak or diagnostic. | 소스 풀 보강 검토 |
| Android Compatibility Definition Document | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Developer Newsletter | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Developers Blog - Camera | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaCodec Reference | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaRecorder Documentation | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| MediaStore Reference | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Photo Picker Documentation | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Security Bulletin | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Supported Media Formats | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Android Weekly | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |
| Media3 Release Notes | 0 | 0 | 없음 | 기사 부족 주간으로 판단, 조치 없음 |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Android Developers Latest Updates | Official or high-priority source produced camera-relevant candidates, but parser/source-extraction-like rejection reasons blocked eligibility. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Claude Blog | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | Anthropic News | Generic noise candidates were detected from artifact exclusion metadata. | high |
| 소스 유지, 파서 수정 | `KEEP_AND_FIX_PARSER` | kernel.org Linux Releases | Generic noise candidates were detected from artifact exclusion metadata. | high |
| Multimedia bucket 추가 | `ADD_MULTIMEDIA_BUCKET` | 전체 | 26 camera-relevant candidate(s) were not mapped to a known camera bucket. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic noise candidates were detected from artifact exclusion metadata. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | Generic noise candidates were detected from artifact exclusion metadata. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list | Generic noise candidates were detected from artifact exclusion metadata. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | Source gap candidates may indicate source URL, dated evidence, or parser repair work. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Unregistered source: aosp-camera-its-release-notes | Source gap candidates may indicate source URL, dated evidence, or parser repair work. | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-09-07/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-09-07/evidence-pack-summary.json |  |

