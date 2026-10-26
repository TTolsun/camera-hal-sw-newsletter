# 소스 품질 진단 리포트

Date: 2026-10-26

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 5 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 4
- Android multimedia camera output 후보 수: 1
- 주요 진단: 소스 풀 부족 위험, Fallback 기사만 남음
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 5 / 5
- 링크 파생 신규 URL / 발행 가능 후보: 18 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 5 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=4. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | true | composition_mode indicates fallback composition: FALLBACK_COMPOSITION. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| lore.kernel.org linux-media list | 8 | 5 | primary_confirmation_missing; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 7 | 5 | Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| Android Developers Blog | 6 | 2 | main_eligible=false; source_gap_risk=true; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 3 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true; finalSelectionEligibility=watchlist | 소스 풀 보강 검토 |
| Arm Community Blogs | 1 | 0 | Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| CameraX Release Notes | 1 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true; finalSelectionEligibility=watchlist | 소스 풀 보강 검토 |
| Microsoft C++ Team Blog | 1 | 0 | Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| OpenAI News | 1 | 0 | Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| Qualcomm Security Bulletins | 1 | 0 | Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 1 | 0 | No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true; finalSelectionEligibility=watchlist | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Anthropic News | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Code Changelog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Codex Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| lore-linux-media-list | [PATCH 0/7] media: qcom: camss: Add Waipio CAMSS support | 2026-10-23T16:31:22Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |

## 수집 요청 실패

후보가 0건이라는 사실만으로 새 소식이 없었다고 판단하지 않습니다. 아래는 수집기가 기록한 요청 실패이며, 기록이 없다고 모든 요청의 성공이 보장되는 것은 아닙니다.

| 소스 | 오류 |
| --- | --- |
| ISO C++ Blog | 403 Forbidden |
| libcamera Documentation | 404 Not Found |
| LLVM Project Blog | 404 Not Found |
| Codex Releases | skipped_index_budget: https://api.github.com/repos/openai/codex/releases?per_page=3&page=1, status 200 |
| 요즘IT | 405 Not Allowed |
| Reddit r/artificial | 429 Too Many Requests |
| Reddit r/cpp | 429 Too Many Requests |
| Reddit r/linux | 429 Too Many Requests |
| Reddit r/Camera | 429 Too Many Requests |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list | finalSelectionEligibility=exclude | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | CameraX Release Notes | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | OpenAI News | Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Qualcomm Security Bulletins | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android NDK Releases | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Anthropic News | REVIEW_SOURCE_OR_PARSER | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-10-26/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-10-26/evidence-pack-summary.json |  |

