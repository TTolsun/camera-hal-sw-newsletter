# 소스 품질 진단 리포트

Date: 2026-09-21

## 요약

- 원본 후보 수: 40
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 10
- Android multimedia camera output 후보 수: 0
- 주요 진단: 소스 풀 부족 위험, Source discovery 중복 또는 무효
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 78 / 51
- Gemini 신규 URL: 0
- 링크 파생 신규 URL / 발행 가능 후보: 11 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 4 / 4 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=6. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 27 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 2 | reference_only; outside_main_window; missing_date_evidence | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list (Intel IPU) | 8 | 5 | primary_confirmation_missing; missing_date_evidence; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 0 | primary_confirmation_missing; reference_only; main_eligible=false | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 3 | 0 | outside_main_window; reference_only; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| Claude Code Changelog | 2 | 1 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Android Security Bulletin | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude; hasDatedEvidence=false | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list | 8 | 7 | primary_confirmation_missing; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 유지하고 추적 |
| AOSP Gerrit (camera changes under review) | 1 | 1 | outside_main_window; source_policy_blocked | 유지하고 추적 |
| Claude Blog | 1 | 1 | 기록 없음 | 유지하고 추적 |
| Android Compatibility Definition Document | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Developer Newsletter | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Developers Blog - Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| MediaCodec Reference | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| MediaRecorder Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| MediaStore Reference | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Photo Picker Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Supported Media Formats | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Android Weekly | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Media3 Release Notes | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |
| Anthropic News | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 유지하고 추적 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| android-developers-blog | Android Bench 2.0: Pushing the frontier with challenging long-horizon tasks | Thu, 17 Sep 2026 14:06:00 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Introducing the AndroidX Security State Libraries: A Unified View of Device Security | Thu, 17 Sep 2026 19:00:00 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Tinder cuts app cold starts by 47% with new R8 Configuration Analyzer | Tue, 18 Aug 2026 18:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| aosp-gerrit-camera-changes | Fix camera lazy AIDL provider not started and present cameras removed on unplug - platform/frameworks/av | 2026-08-20 | reference | NEW | outside_main_window, source_policy_blocked | policy_locked_out_of_main |
| android-developers-blog | Preparing your app for broader memory limits | Wed, 19 Aug 2026 19:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-blog | Ensuring Safety in the Generative AI Ecosystem: Protecting Users from Non-Consensual Intimate Content | Tue, 25 Aug 2026 17:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-blog | AAOS SDV - Secure by Design | Mon, 24 Aug 2026 16:00:31 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.6.2 | August 26, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.3.0-beta02 | August 26, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.4.0-alpha07 | August 26, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| lore-linux-media-list | [PATCH 0/2] media: i2c: Samsung S5K3T2 image sensor | 2026-09-20T14:58:26Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v7 0/3] media: i2c: Add OmniVision OG0VA1B camera sensor driver | 2026-09-15T06:54:24Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 0/2] media: i2c: Add Samsung S5KJN5 image sensor | 2026-09-14T11:10:46Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/3] Add Vision Components MIPI Camera Module support | 2026-09-15T20:20:55Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v7 0/9] media: qcom: camss: CAMSS Offline Processing Engine support | 2026-09-15T08:11:09Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 11/11] media: i2c: st-vd55g1: Support VD55G0 global-shutter image sensor | 2026-09-18T22:22:13Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/5] media: qcom: camss: fixes for several cameras behind a CSI-2 bridge | 2026-09-15T12:16:09Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: uvcvideo: add capture quirks for 1e4e:7102 | 2026-09-17T21:29:53Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v2] media: ipu-bridge: Add upside-down quirk for Surface Pro 11 | 2026-09-17T14:45:51Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [RFC,v1,01/20] libcamera: sysfs: Add devicePath() helpers | 2026-09-18 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v2 00/21] IPU6 multi-stream and metadata support preparation | 2026-09-17T11:39:33Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,01/21] ipa: libipa: fixedpoint: Shift unsigned type for scaling | 2026-09-18 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,01/41] libcamera: delayed_controls: Add push() function that accepts a sequence number | 2026-09-14 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,1/2] libcamera: matrix: Add a transpose() function | 2026-09-14 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,1/8] ipa: rpi: Drop unused params argument from platformPrepareIsp() | 2026-09-16 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4,1/4] libcamera: property_ids_core: Drop PixelArrayOpticalBlackRectangles | 2026-09-18 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: dma_buf_allocator: Make provider priority configurable | 2026-09-17 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: camera_sensor_properties: Add OmniVision OV08X40 properties | 2026-09-16 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [bug report] media: ipu6: Move isys fw mapping to pci_probe | 2026-09-15T14:32:39Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH] media: ipu-bridge: Add upside-down quirk for Dell Pro 14 Premium PA14260 | 2026-09-04T06:57:04Z | fallback |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v5 0/7] media: Enable the OV5693 front camera on IPU6 Surface devices | 2026-09-02T14:23:44Z | fallback |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v7 06/16] media: intel: ipu-bridge: Add Yoga Book camera sensors | 2026-09-02T14:54:02Z | fallback |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v2 1/3] media: ipu6: Check the remote pad before dereferencing it | 2026-09-11T19:49:24Z | fallback |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH] media: ipu-bridge: Add upside-down sensor DMI quirk for Samsung Galaxy Book3 Ultra | 2026-09-05T03:04:57Z | fallback |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| claude-code-changelog | Claude Code v2.1.273 | 2026-09-15T20:23:03Z | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Camera HAL changes and updates. |  | unknown |  | missing_date_evidence, reference_only |  |
| android-developers-blog | Release v2.1.273 · anthropics/claude-code · GitHub |  | unknown |  | missing_date_evidence, reference_only |  |
| android-developers-blog | Release v2.1.271 · anthropics/claude-code · GitHub |  | unknown |  | missing_date_evidence, reference_only |  |
| kernel-org-releases | https://lore.kernel.org/r/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260806-sk5jn5-v3-0-0b3ac1eadf8a@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260728092856.GB1494774@killaraus.ideasonboard.com/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/jwrdegoede/libcamera/commits/camss_pipeline_v2.1 |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260907-camss-isp-ope-v6-0-6b915b9c5131@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/STMicroelectronics/vd55g0-linux-driver/blob/a05627b0f6d8775aa54b6fa306e91f425f2cbf9e/vd55g0_patches.h |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260911062213.195007-1-gjorgji.rosikopulos@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260913153526.80287-1-lsa.uz@pm.me/ |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260914114145.574791-1-sakari.ailus@linux.intel.com/T/#t |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260831181858.325109-1-fernandorimoli11@gmail.com/ |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260903202820.8401-1-nicfio@gmail.com/ |  | unknown |  | missing_date_evidence |  |

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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list (Intel IPU) | Excluded from main/short selection because source evidence is incomplete or source-gap risk is present. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Security Bulletin | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| Source discovery 중복 제거/수리 | `REPAIR_SOURCE_DISCOVERY_DUPLICATES` | 전체 | Gemini discovery produced 27 candidate(s) but gemini_new_unique_url_count=0.; Duplicate discovery signal detected: gemini_manual_duplicate_url_count=27, duplicate_discovery_gap_count=0. | medium |

## 경고

_없음_

