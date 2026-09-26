# 소스 품질 진단 리포트

Date: 2026-09-28

## 요약

- 원본 후보 수: 40
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 9
- Android multimedia camera output 후보 수: 0
- 주요 진단: 소스 풀 부족 위험, Fallback 기사만 남음, Source discovery 중복 또는 무효
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 81 / 65
- Gemini 신규 URL: 0
- 링크 파생 신규 URL / 발행 가능 후보: 25 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 5 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=5. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | true | composition_mode indicates fallback composition: FALLBACK_COMPOSITION. |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 16 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 3 | reference_only; outside_main_window; missing_date_evidence | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list (Intel IPU) | 8 | 5 | primary_confirmation_missing; missing_date_evidence; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 3 | primary_confirmation_missing; outside_main_window; reference_only | 소스 풀 보강 검토 |
| Claude Blog | 3 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 2 | 1 | outside_main_window; reference_only; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| Android Security Bulletin | 1 | 0 | outside_main_window; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Claude Code Changelog | 1 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list | 8 | 7 | primary_confirmation_missing; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 유지하고 추적 |
| Unregistered source: aosp-camera-its-release-notes | 1 | 1 | 기록 없음 | 유지하고 추적 |
| Android Compatibility Definition Document | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Developer Newsletter | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Developers Blog - Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| MediaCodec Reference | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| MediaRecorder Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| MediaStore Reference | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Photo Picker Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Supported Media Formats | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Weekly | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Media3 Release Notes | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| android-developers-blog | Bring your Android game to the car screen today | Mon, 21 Sep 2026 16:00:48 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Land your apps on Googlebook with adaptive development | Tue, 22 Sep 2026 17:00:00 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Android Bench 2.0: Pushing the frontier with challenging long-horizon tasks | Thu, 17 Sep 2026 14:06:00 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Ensuring Safety in the Generative AI Ecosystem: Protecting Users from Non-Consensual Intimate Content | Tue, 25 Aug 2026 17:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | CameraX Release Notes - CameraX 1.6.2 | August 26, 2026 | reference |  | outside_main_window |  |
| android-developers-blog | Leverage Android skills and Gemma 4 in Android Studio Quail 4 | Tue, 01 Sep 2026 15:00:00 +0000 | reference |  | outside_main_window |  |
| android-developers-blog | Emulator control for adaptive app development | Mon, 31 Aug 2026 16:00:00 +0000 | reference |  | outside_main_window |  |
| android-developers-latest-updates | 1.4.0-alpha07 | August 26, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-blog | Introducing the AndroidX Security State Libraries: A Unified View of Device Security | Thu, 17 Sep 2026 19:00:00 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-security-bulletin | September | 2026-09-01 | reference |  | outside_main_window | source_gap_risk |
| lore-linux-media-list | Test for [PATCH v7 0/3] Add support for the Sony IMX681 camera sensor | 2026-09-26T09:28:31Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [RFC PATCH 0/8] Add OmniVision OV2312 RGB-IR sensor driver | 2026-09-25T13:31:02Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v3 0/2] media: i2c: Samsung S5K3T2 image sensor | 2026-09-24T05:46:52Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH RFC 00/15] Add CAMSS and S5KJN5 sensor support for Qualcomm Hawi and Maili | 2026-09-23T11:02:51Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v10 0/9] media: qcom: camss: CAMSS Offline Processing Engine support | 2026-09-25T09:09:54Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK | 2026-09-25T12:56:37Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: ipu-bridge: Add upside-down sensor DMI quirk for Samsung Galaxy Book3 Pro | 2026-09-23T14:52:50Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH 2/4] media: ipu-bridge: Add the ST VD55G1 (TBE20A1) | 2026-09-24T17:19:25Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 0/3] Add CAMSS support for Qualcomm Glymur | 2026-09-25T05:49:01Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: pipeline: simple: Reject multiple processed streams with software ISP | 2026-09-25 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v7 3/3] media: ipu-bridge: Add Sony IMX681 | 2026-09-23T21:18:52Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v3 00/21] IPU6 multi-stream and metadata support preparation | 2026-09-22T12:05:46Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/4] libcamera: v4l2_event: Add V4L2Event class and functionality | 2026-09-25 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata | 2026-09-24 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH] media: staging/ipu7: release ISYS firmware resources on remove | 2026-09-24T11:03:17Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v3 4/5] media: ipu-bridge: Add the OV02C10 26 MHz link frequency | 2026-09-23T23:42:08Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2,1/9] ipa: libipa: agc: Keep frame duration limits ordered | 2026-09-25 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4] libcamera: controls: Remove common enum prefix | 2026-09-21 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH] media: ipu6: Fix bus device use-after-free | 2026-09-24T12:07:03Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/5] ipa: libipa: camera_sensor_helper: Add OV02C10 | 2026-09-02 | reference |  | outside_main_window, primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v1] ipa: Move camera sensor helper types into anon namespace | 2026-09-21 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [RFC] ipu-bridge: supplying a vendor-prefixed property | 2026-09-24T21:59:07Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH 6.1.y] media: ipu-bridge: Fix null pointer deref on SSDB/PLD parsing warnings | 2026-09-24T17:33:20Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | pipeline: rpi: Fix crashes due to scoring unknown formats | 2026-09-23 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| claude-blog | How to prepare for AI-driven code modernization projects | 2026-09-23 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Build plugins for Claude | 2026-09-25 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.281 | 2026-09-23T19:19:15Z | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Coding sessions are longer and use more context. Claude Opus 5.5 is built with that in mind. | 2026-09-24 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | https://gist.github.com/RISHI27-dot/1876791cba10798412050e1142fa7899 |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20250818155809.469479-1-mirela.rabulea@nxp.com/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/RISHI27-dot/linux/commits/lpc/ov2312/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/RISHI27-dot/edgeai-gst-plugins/blob/lpc/ov2312/ext/tiovx/gsttiovxisp.c |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260917-x1e-csi2-phy-v18-0-6515b5255fa9@linaro.org/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260915-kaanapali-camss-v16-0-c9f3f6f4180c@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260914-sk5jn5-v4-0-386e84cfb2b3@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260916-maili_camcc-v2-0-f30b394bfd50@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260915-camcc-hawi-v3-0-5b57f45477f1@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260923-hawi-dt-post-v1-0-e41473b6298b@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260922-maili-dts-v1-0-ac2b1b76bfd9@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260917-b4-linux-next-25-03-13-dtsi-x1e80100-camss-v18-0-f85c9103177e@linaro.org/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/jwrdegoede/libcamera/commits/camss_pipeline_v2.1 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/loicpoulain/camss-isp-m2m-test |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260923-camss-isp-ope-v9-0-86a75dc18b83@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260921-camss-isp-ope-v8-0-dd1c86a3c8a0@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260915-camss-isp-ope-v7-0-77b13d131d3d@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260907-camss-isp-ope-v6-0-6b915b9c5131@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260710-camss-isp-ope-v4-0-51207a0319d8@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260922063507.690-1-tmorolias@gmail.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260917-glymur_camss-v3-0-1d0e2d47ad2e@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260907-glymur_camss-v2-0-75f7982dc983@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260914114145.574791-1-sakari.ailus@linux.intel.com/T/#t |  | unknown |  | missing_date_evidence |  |

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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list (Intel IPU) | finalSelectionEligibility=exclude | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Security Bulletin | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| Source discovery 중복 제거/수리 | `REPAIR_SOURCE_DISCOVERY_DUPLICATES` | 전체 | Gemini discovery produced 16 candidate(s) but gemini_new_unique_url_count=0.; Duplicate discovery signal detected: gemini_manual_duplicate_url_count=16, duplicate_discovery_gap_count=0. | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-09-28/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-09-28/evidence-pack-summary.json |  |

