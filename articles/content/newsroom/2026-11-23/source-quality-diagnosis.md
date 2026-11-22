# 소스 품질 진단 리포트

Date: 2026-11-23

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 10
- Android multimedia camera output 후보 수: 1
- 주요 진단: 소스 풀 부족 위험
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 50 / 50
- 링크 파생 신규 URL / 발행 가능 후보: 5 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 5 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=7. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 1 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 4 | primary_confirmation_missing; reference_only; main_eligible=false | 소스 풀 보강 검토 |
| ISO C++ Blog | 4 | 0 | reference_only; main_eligible=false; source_gap_risk=true | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 2 | 1 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| CameraX Release Notes | 2 | 1 | outside_main_window; reference_only; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 2 | 1 | outside_main_window; reference_only; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| Unregistered source: samsung-global-camera | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true; finalSelectionEligibility=watchlist | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Anthropic News | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Codex Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/androiddev | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/cpp | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/linux | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| camerax-release-notes | CameraX Release Notes - CameraX 1.7.0-rc01 | October 21, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.4.0-alpha07 | November 18, 2026 | primary |  | reference_only | source_gap_risk, reference_only |
| lore-linux-media-list | [PATCH v3 0/2] media: i2c: Add Samsung S5K5E8 camera sensor driver | 2026-11-22T03:47:01Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/2] media: i2c: Add Samsung S5K5E8YX camera sensor driver | 2026-11-21T12:07:36Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 1/2] dt-bindings: media: i2c: Add Samsung S5K5E8YX image sensor | 2026-11-21T09:19:13Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v6 0/2] media: i2c: Samsung S5K3T2 image sensor | 2026-11-20T18:04:29Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/3] media: Add Sony IMX175 sensor driver (Lenovo ThinkPad 10 rear camera) | 2026-11-16T17:52:03Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v11 00/14] media: Add Lenovo Yoga Book camera support | 2026-11-21T13:32:48Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH RESEND] media: atomisp: remove dead error check in ia_css_stream_create() | 2026-11-18T11:44:46Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,1/8] libcamera: software_isp: Let a single point decide about computing stats | 2026-11-19 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [RFC,v2,01/26] libcamera: software_isp: Rename Bayer classes to SoftwareIspInstance | 2026-11-18 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | pipeline: rkisp1: Forward controls passed to start() to the IPA | 2026-11-20 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [RFC,1/3] libcamera: v4l2_subdevice: Add whence parameter to set/getSelection() | 2026-11-18 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v6,01/23] ipa: libipa: fixedpoint: Shift unsigned type for scaling | 2026-11-18 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4,1/4] ipa: libipa: camera_sensor_helper: Match multiple sensors per helper | 2026-11-18 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - libcamera v0.8.0 | 2026-11-01 | reference |  | outside_main_window | trend_reference_project |
| libcamera-upstream-releases | v0.8.0 | 2026-11-01T07:25:30+00:00 | reference |  | outside_main_window | trend_reference_project |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.8.0+rpt20261104 | 2026-11-04 | fallback |  | reference_only | source_gap_risk, reference_only, trend_reference_project |
| android-developers-blog | What's new in the Jetpack Compose November '26 release | 2026-11-18 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Elevating games: New large screens and foldables quality standards on Google Play | 2026-11-18 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Elevating apps: New adaptive quality standards on Google Play | 2026-11-18 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Ship smarter keep rules: How library providers can unblock app-level DEX code optimization | 2026-11-17 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Expanding Android developer verification in 2027 | 2026-11-19 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Beyond the app: Expanding buyer reach across new surfaces with Google Play | 2026-11-16 | primary |  | reference_only | source_gap_risk, reference_only |
| androidx-gerrit-heifwriter-changes | Add API files for heifwriter 1.2.0-rc02 - platform/frameworks/support | 2026-10-23 | reference | MERGED | outside_main_window |  |
| android-developers-blog | Powering Seamless Player Sign-In: Introducing the Open-Source Sign in with Google Plugin for Unity | 2026-11-10 | fallback |  | reference_only | source_gap_risk, reference_only |
| lore-linux-media-list | [PATCH v13 12/73] media: Documentation: Document raw mbus codes and CFA for cameras | 2026-11-18T13:28:58Z | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4,1/8] ipa: rpi: Drop unused params argument from platformPrepareIsp() | 2026-11-18 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v1,1/3] pipeline: rpi: Pass the raw buffer pixel format to the IPA | 2026-11-18 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, trend_reference_project, cross_check_required_but_missing |
| iso-cpp-blog | On forcing all derived classes to implement a specific non-virtual method, part 1 -- Raymond Chen | Thu, 19 Nov 2026 21:45:38 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| samsung-global-camera | Samsung Begins One UI 9.5 Beta Program | Wed, 18 Nov 2026 18:00:00 +0000 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |

## 수집 요청 실패

후보가 0건이라는 사실만으로 새 소식이 없었다고 판단하지 않습니다. 아래는 수집기가 기록한 요청 실패이며, 기록이 없다고 모든 요청의 성공이 보장되는 것은 아닙니다.

| 소스 | 오류 |
| --- | --- |
| libcamera Documentation | 404 Not Found |
| LLVM Project Blog | 404 Not Found |
| Codex Releases | http_403 |
| Reddit r/androiddev | 404 Not Found |
| Reddit r/Android | 429 Too Many Requests |
| Reddit r/artificial | 429 Too Many Requests |
| Reddit r/cpp | 429 Too Many Requests |
| Reddit r/linux | 429 Too Many Requests |
| Reddit r/Camera | 429 Too Many Requests |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | ISO C++ Blog | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | CameraX Release Notes | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android NDK Releases | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Anthropic News | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | AOSP Site Updates | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | REVIEW_SOURCE_OR_PARSER | medium |

## 경고

_없음_

