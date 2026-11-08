# 소스 품질 진단 리포트

Date: 2026-11-09

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 10
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 71 / 71
- 링크 파생 신규 URL / 발행 가능 후보: 21 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 5 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | source-discovery feedback reports parser_gap_count=1. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-latest-updates has source coverage risk: source_gap_count=1. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| libcamera Patchwork (patch review) | 8 | 1 | primary_confirmation_missing; Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list | 7 | 5 | primary_confirmation_missing; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| ChromeOS Gerrit (platform2 camera merged changes) | 6 | 4 | outside_main_window; Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 3 | 1 | reference_only; outside_main_window; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| OpenAI News | 2 | 0 | reference_only; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 1 | 0 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Collabora Blog | 1 | 0 | reference_only; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| LWN Camera / Media Articles | 1 | 0 | primary_confirmation_missing; Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Microsoft C++ Team Blog | 1 | 0 | outside_main_window; primary_confirmation_missing; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | 소스 풀 보강 검토 |
| Phoronix Linux Camera / Media | 1 | 0 | primary_confirmation_missing; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Anthropic News | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Codex Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| camerax-release-notes | CameraX Release Notes - CameraX 1.7.0-rc01 | October 21, 2026 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.4.0-alpha07 | November 04, 2026 | primary |  | reference_only | source_gap_risk, reference_only |
| aosp-gerrit-camera-changes | cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av | 2026-10-07 | reference | NEW | outside_main_window |  |
| androidx-gerrit-heifwriter-changes | heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support | 2026-10-16 | reference | MERGED | outside_main_window |  |
| lore-linux-media-list | [PATCH v14 0/9] media: qcom: camss: CAMSS Offline Processing Engine support | 2026-11-06T13:55:26Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/4] media: qcom: camss: fixes for SoCs without IOMMU, RDI and CSID1 streaming | 2026-11-04T20:23:20Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/7] Introduce v4l2-isp reset buffers | 2026-11-04T12:28:35Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 0/6] Add CAMSS support for Qualcomm Hawi and Maili | 2026-11-06T06:50:53Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v3 01/11] media: qcom: camss: Introduce CPU latency QoS during streaming | 2026-11-07T01:01:56Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v3 0/7] media: qcom: camss: Add SM8150 CAMSS support | 2026-11-06T18:36:38Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,1/7] libcamera: V4L2Subdevice: Add whence argument to [get\|set]Selection() | 2026-11-06 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/4] media: ov9734: Support the Microsoft Surface Laptop 1 front camera | 2026-11-05T23:03:38Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/3] libipa: camera_sensor_helper: Add OV9734 | 2026-11-03 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.8.0+rpt20261104 | 2026-11-04 | primary |  | reference_only | source_gap_risk, reference_only, trend_reference_project |
| patchwork-libcamera-patches | [v3,1/4] ipa: libipa: camera_sensor_helper: Match multiple sensors per helper | 2026-11-05 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2,1/3] libcamera: pipeline: rkisp1: Detect invalid sensor configurations | 2026-11-02 | primary |  | primary_confirmation_missing | trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | ipa: libipa: camera_sensor_helper: Add OV2680 support | 2026-11-05 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v6,01/24] libcamera: controls: AeExposureMode: Add ExposureMaximize | 2026-11-02 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3] ipa: libipa: camera_sensor_helper: add ov02c10 | 2026-11-02 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| patchwork-libcamera-patches | [RFC,v1] ipa: rkisp1: imx219: Add `GammaOutCorrection` | 2026-11-06 | primary |  | primary_confirmation_missing | source_gap_risk, trend_reference_project, cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.7.2+rpt20261009 | 2026-10-09 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only, trend_reference_project |
| chromeos-gerrit-camera-changes | camera: Migrate mojom files from legacy handle to handle - chromiumos/platform2 | 2026-10-07 | reference | MERGED | outside_main_window |  |
| openai-news | Qodo builds context into AI code review with Codex | Mon, 02 Nov 2026 00:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| lwn-camera-media-articles | Security updates for Friday | Fri, 06 Nov 2026 14:04:54 +0000 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| phoronix-linux-camera-media | GCC 17 Feature Development Ends Next Week | Sun, 08 Nov 2026 06:12:21 -0500 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| collabora-blog | Real-time AI video analytics on Renesas at electronica 2026 | Thu, 05 Nov 2026 20:28:17 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| microsoft-cpp-team-blog | MSVC Build Tools Version 14.52 Release Candidate Now Available | Thu, 15 Oct 2026 20:07:03 +0000 | reference |  | outside_main_window, primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| android-developers-blog | I3235c |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/575161911 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/573671138 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/563673593 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/558819242 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/556807521 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/551348846 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/545866947 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | b/543937345 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/jwrdegoede/libcamera/commits/camss_pipeline_v2.2 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/loicpoulain/camss-isp-m2m-test |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/sashiko-outbox-196002@kernel.org/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20261103-camss-isp-ope-v13-0-c2cbf15a39b1@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/sashiko-outbox-193768@kernel.org/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20261102-camss-isp-ope-v12-0-702254689feb@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20261023-camss-isp-ope-v11-0-0c2937195298@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260925-camss-isp-ope-v10-0-2622411034cb@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20261102-kaanapali-camss-v24-0-d6b8f3f6f66f@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20261030-hawi-maili-camss-v3-0-9742bca8cef2@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20261013-hawi-maili-camss-v2-0-fc93222da89c@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260923-hawi-maili-camss-v1-0-cbbb42e534ef@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |

## 수집 요청 실패

후보가 0건이라는 사실만으로 새 소식이 없었다고 판단하지 않습니다. 아래는 수집기가 기록한 요청 실패이며, 기록이 없다고 모든 요청의 성공이 보장되는 것은 아닙니다.

| 소스 | 오류 |
| --- | --- |
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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list | finalSelectionEligibility=exclude | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | ChromeOS Gerrit (platform2 camera merged changes) | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | OpenAI News | Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android NDK Releases | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Anthropic News | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | AOSP Site Updates | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | REVIEW_SOURCE_OR_PARSER | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-11-09/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-11-09/evidence-pack-summary.json |  |

