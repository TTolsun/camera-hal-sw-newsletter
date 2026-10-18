# 소스 품질 진단 리포트

Date: 2026-10-19

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 10
- Android multimedia camera output 후보 수: 1
- 주요 진단: 소스 풀 부족 위험, Fallback 기사만 남음
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 54 / 54
- 링크 파생 신규 URL / 발행 가능 후보: 4 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 4 / 4 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=6. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | true | composition_mode indicates fallback composition: FALLBACK_COMPOSITION. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 2 | reference_only; outside_main_window; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 소스 풀 보강 검토 |
| OpenAI News | 5 | 0 | reference_only; main_eligible=false; source_gap_risk=true | 소스 풀 보강 검토 |
| Claude Code Changelog | 2 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Microsoft C++ Team Blog | 2 | 0 | primary_confirmation_missing; outside_main_window; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | 소스 풀 보강 검토 |
| Arm Community Blogs | 1 | 0 | primary_confirmation_missing; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Edge AI and Vision Alliance | 1 | 0 | primary_confirmation_missing; reference_only; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | 소스 풀 보강 검토 |
| Qualcomm Security Bulletins | 1 | 0 | Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 1 | 0 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Reddit r/androiddev | 1 | 0 | primary_confirmation_missing; Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AndroidX Gerrit Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Codex Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| androidx-gerrit-heifwriter-changes | Bump heifwriter version to 1.2.0-beta01 - platform/frameworks/support | 2026-09-15 | reference | MERGED | outside_main_window |  |
| reddit-androiddev-camera | I hate CameraX, so I made it a one liner :) | 2026-10-18T02:55:26+00:00 | primary |  | primary_confirmation_missing | source_gap_risk, candidate_only_without_primary_confirmation, cross_check_required_but_missing, community_signal_primary_source_disallowed |
| microsoft-cpp-team-blog | MSVC Build Tools Version 14.52 Release Candidate Now Available | Thu, 15 Oct 2026 20:07:03 +0000 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| edge-ai-vision-alliance | Upcoming Webinar on Runninge Generative AI with OpenVINO | Thu, 15 Oct 2026 13:00:00 +0000 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| microsoft-cpp-team-blog | Bringing Correctly Rounded Math to Production with LLVM-libc | Wed, 16 Sep 2026 22:09:50 +0000 | reference |  | outside_main_window, primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| arm-community-blogs | Blog Post: Python 3.15 advances the native developer experience on Windows on Arm | Wed, 14 Oct 2026 17:00:00 GMT | primary |  | primary_confirmation_missing | source_gap_risk, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor | 2026-10-16T07:59:52Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver | 2026-10-13T03:28:31Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/8] Add CAMSS support for Qualcomm Hawi and Maili | 2026-10-13T11:03:16Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v3 0/6] phy: qcom-mipi-csi2: C-PHY for X1E80100 | 2026-10-16T14:56:12Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH RFC 2/6] media: qcom: camss: Add C-PHY timing fields and get config from sensor | 2026-10-17T17:13:36Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/3] arm64: dts: qcom: Add CSI2 PHY common-phy providers for SA8775P, QCS8300 and SC7280 | 2026-10-17T00:11:21Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v5 0/4] media: qcom: camss: rebase fixes and SC7280 enablement for the streams API | 2026-10-13T08:33:24Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.7.2+rpt20261009 | 2026-10-09 | fallback |  | reference_only | source_gap_risk, reference_only, trend_reference_project |
| patchwork-libcamera-patches | [v6,1/4] libcamera: software_isp: Add support for monochrome formats - Shaders | 2026-10-17 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: software_isp: Exclude saturated pixels from AWB sums | 2026-10-18 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | v4l2: v4l2_camera_proxy: Handle 64-bit time_t buffer ioctls | 2026-10-16 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [libcamera-ci,RFC,v1] Run clang-tidy | 2026-10-15 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/2] libcamera: camera_sensor: Add Sony IMX676 sensor properties and helper | 2026-10-14 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [libcamera-ci,v1] Enable `_LIBCPP_REMOVE_TRANSITIVE_INCLUDES` | 2026-10-12 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: camera_sensor: Add Hynix Hi556 sensor properties and helper | 2026-10-18 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| android-developers-blog | Bringing our latest frontier model to Android Developers | 2026-10-16T16:17:27.504Z | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | New ways to drive smarter discovery, deeper engagement, and business growth on Google Play | 2026-10-15T00:46:40.417Z | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Introducing the Googlebook Linux Terminal Preview: A VM-Backed Environment for AI and Development | 2026-10-13T19:13:34.597Z | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Android Bench 2.0: Pushing the frontier with challenging long-horizon tasks | 2026-10-01T17:31:49.727Z | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | How Instagram Direct engineers built AI-native UI architecture with Jetpack Compose and reduced token cost per agent session by 33% | 2026-10-01T16:11:45.457Z | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Bring your Android game to the car screen today | 2026-09-24T17:48:17.529Z | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| patchwork-libcamera-patches | [v3,01/11] software-isp: Center the GPU image crop | 2026-10-16 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: atomisp: remove dead error check in ia_css_stream_create() | 2026-10-16T10:56:22Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| openai-news | How Block is building AI-powered security with OpenAI technology | Wed, 14 Oct 2026 07:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.301 | 2026-10-15T19:22:06Z | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.300 | 2026-10-14T18:24:25Z | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | How Itaú is building generative AI for its entire customer base | Fri, 16 Oct 2026 19:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Stack Overflow for Agents triples signups with ChatGPT plugin | Fri, 16 Oct 2026 00:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Amp puts AI agents to work beyond code with OpenAI models | Wed, 14 Oct 2026 12:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| kernel-org-releases | https://lore.kernel.org/all/20261011-kaanapali-camss-v21-0-04fd28d815c6@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260917-x1e-camss-csi2-phy-dtsi-v7-0-1a63eb35838b@linaro.org/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260911062213.195007-1-gjorgji.rosikopulos@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |

## 수집 요청 실패

후보가 0건이라는 사실만으로 새 소식이 없었다고 판단하지 않습니다. 아래는 수집기가 기록한 요청 실패이며, 기록이 없다고 모든 요청의 성공이 보장되는 것은 아닙니다.

| 소스 | 오류 |
| --- | --- |
| AndroidX Gerrit Camera | 429 Too Many Requests |
| ISO C++ Blog | 403 Forbidden |
| libcamera Documentation | 404 Not Found |
| LLVM Project Blog | 404 Not Found |
| 요즘IT | 405 Not Allowed |
| Reddit r/Android | 429 Too Many Requests |
| Reddit r/artificial | 429 Too Many Requests |
| Reddit r/cpp | 429 Too Many Requests |
| Reddit r/linux | 429 Too Many Requests |
| Reddit r/Camera | 429 Too Many Requests |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | OpenAI News | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Qualcomm Security Bulletins | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android NDK Releases | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | AndroidX Gerrit Camera | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | AOSP Site Updates | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Codex Releases | REVIEW_SOURCE_OR_PARSER | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-10-19/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-10-19/evidence-pack-summary.json |  |

