# 소스 품질 진단 리포트

Date: 2026-11-16

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 9
- Android multimedia camera output 후보 수: 0
- 주요 진단: 소스 풀 부족 위험
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 78 / 78
- 링크 파생 신규 URL / 발행 가능 후보: 28 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 5 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=4. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 4 | reference_only; missing_date_evidence; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list | 8 | 6 | primary_confirmation_missing; Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 3 | primary_confirmation_missing; reference_only; main_eligible=false | 소스 풀 보강 검토 |
| OpenAI News | 3 | 0 | reference_only; main_eligible=false; source_gap_risk=true | 소스 풀 보강 검토 |
| CameraX Release Notes | 2 | 1 | outside_main_window; reference_only; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| ChromeOS Gerrit (platform2 camera merged changes) | 2 | 1 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 2 | 1 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 1 | 0 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Media3 Release Notes | 1 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Claude Code Changelog | 1 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Codex Releases | 1 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Anthropic News | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/androiddev | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| camerax-release-notes | CameraX Release Notes - CameraX 1.7.0-rc01 | October 21, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.4.0-alpha07 | November 04, 2026 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Powering Seamless Player Sign-In: Introducing the Open-Source Sign in with Google Plugin for Unity | 2026-11-10 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | What’s new in intelligent apps at the Android Developer Summit | 2026-11-05 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Developing for Today: 50+ New Developer Sessions on Building Apps Today | 2026-11-02 | fallback |  | reference_only | source_gap_risk, reference_only |
| androidx-gerrit-heifwriter-changes | heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support | 2026-10-16 | reference | MERGED | outside_main_window |  |
| android-developers-blog | Build for every screen with the latest Jetpack Compose updates from Android Developer Summit | 2026-11-04 | fallback |  | reference_only | source_gap_risk, reference_only |
| androidx-gerrit-heifwriter-changes | Add API files for heifwriter 1.2.0-rc02 - platform/frameworks/support | 2026-10-23 | reference | MERGED | outside_main_window |  |
| lore-linux-media-list | [PATCH v2 0/3] media: i2c: Add Samsung S5K3L6 and Librem 5 rear camera | 2026-11-12T00:47:12Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/8] Add SM8150 CAMSS and LG G8x ThinQ camera sensors | 2026-11-09T22:38:44Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v25 00/15] media: qcom: camss: Add Kaanapali support | 2026-11-13T05:33:55Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 0/2] media: rcar-isp: fix core IRQ and probe error handling | 2026-11-10T02:05:31Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/4] media: rcar-isp: Add NV12M support and fix stride | 2026-11-14T19:55:33Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v7 00/23] Add CAMSS support for SM8750 and Eliza | 2026-11-14T11:29:45Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v5 0/6] media: Add the ST VD55G0 global shutter sensor | 2026-11-14T09:58:30Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: ipu-bridge: Mark the Surface Pro 8 front sensor as upside down | 2026-11-11T16:03:02Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: rkisp1: Ensure a raw format is found with sensorConfig | 2026-11-12 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [RFC,v2,1/2] libcamera: software_isp: Use shared stats | 2026-11-11 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2,1/3] libipa: camera_sensor_helper: Add OV9734 | 2026-11-12 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4,01/21] ipa: libipa: fixedpoint: Shift unsigned type for scaling | 2026-11-13 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/2] ipa: libipa: camera_sensor_helper: Add IMX363, S5K3M3 and S5KGD1 | 2026-11-09 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: pipeline: simple: Set planesCount for the capture format | 2026-11-09 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2,1/5] ipa: rpi: cam_helper: Add Mira016 cam helper | 2026-11-12 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: controls: Set the ColourTemperature direction to inout | 2026-11-12 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.8.0+rpt20261104 | 2026-11-04 | fallback |  | reference_only | source_gap_risk, reference_only, trend_reference_project |
| chromeos-gerrit-camera-changes | camera: Update capability rules - chromiumos/platform2 | 2026-11-11 | primary | MERGED | reference_only | source_gap_risk, reference_only |
| androidx-media3-release-notes | Media3 Release Notes - Media3 1.12.0-beta01 | November 11, 2026 | primary |  | reference_only | source_gap_risk, reference_only |
| codex-releases | Codex rust-v0.169.0 | 2026-11-13T08:37:05Z | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Cogent and OpenAI build cyber defense factories for enterprises | Tue, 10 Nov 2026 00:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | CodeRabbit scales agentic software development and ships 20x more | Mon, 09 Nov 2026 08:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.321 | 2026-11-09T19:22:30Z | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | b/563673593 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/558819242 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/556807521 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/551348846 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/545866947 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/543937345 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/575161911 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/573671138 |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260626000715.1111803-1-vincent.cloutier@icloud.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/d80cecc3f317e4493207ea3c347dd144390d299f.camel@pengutronix.de/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/gauravsuman007/nura-g8x |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260928-kaanapali-camss-v17-0-dcf3fd37f76c@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260915-kaanapali-camss-v16-0-c9f3f6f4180c@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260720-kaanapali-camss-v15-0-c0b1c1167c5d@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260601-kaanapali-camss-v14-0-e76f26aa6691@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260508-kaanapali-camss-v13-0-2541d8e55651@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260112-kaanapali-camss-v12-0-15b7af73401e@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260112-kaanapali-camss-v11-0-81e4f59a5d08@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20251211-add-support-for-camss-on-kaanapali-v10-0-39e8874dcd27@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20261112-kaanapali-camss-v25-0-1d709f57f370@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260721-add-support-for-camss-on-sm8750-v6-0-a5f841061d18@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/STMicroelectronics/vd55g0-linux-driver |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20261111063351.96951-1-lsa.uz@pm.me/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/179439345249.5.16817789862917866412@debian.org/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20261110195454.48176-1-lsa.uz@pm.me/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20251208035122.2147678-1-hao.yao@intel.com/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3485 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3005 |  | unknown |  | missing_date_evidence |  |

## 수집 요청 실패

후보가 0건이라는 사실만으로 새 소식이 없었다고 판단하지 않습니다. 아래는 수집기가 기록한 요청 실패이며, 기록이 없다고 모든 요청의 성공이 보장되는 것은 아닙니다.

| 소스 | 오류 |
| --- | --- |
| ISO C++ Blog | 403 Forbidden |
| libcamera Documentation | 404 Not Found |
| LLVM Project Blog | 404 Not Found |
| 요즘IT | 405 Not Allowed |
| Reddit r/androiddev | 403 Forbidden |
| Reddit r/Android | 429 Too Many Requests |
| Reddit r/artificial | 429 Too Many Requests |
| Reddit r/cpp | 429 Too Many Requests |
| Reddit r/linux | 429 Too Many Requests |
| Reddit r/Camera | 429 Too Many Requests |

## 권장 조치

| 권장 조치 | 내부 값 | 대상 | 근거 | 심각도 |
| --- | --- | --- | --- | --- |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | OpenAI News | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | CameraX Release Notes | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | ChromeOS Gerrit (platform2 camera merged changes) | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Media3 Release Notes | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-11-16/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-11-16/evidence-pack-summary.json |  |

