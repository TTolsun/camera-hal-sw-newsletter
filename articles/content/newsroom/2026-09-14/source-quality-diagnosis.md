# 소스 품질 진단 리포트

Date: 2026-09-14

## 요약

- 원본 후보 수: 40
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 11
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험, Source discovery 중복 또는 무효
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 71 / 55
- Gemini 신규 URL: 0
- 링크 파생 신규 URL / 발행 가능 후보: 15 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 4 / 1 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | Gemini discovery parser extraction failures=2. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=5. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 16 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 3 | outside_main_window; reference_only; missing_date_evidence | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list (Intel IPU) | 8 | 4 | primary_confirmation_missing; outside_main_window; missing_date_evidence | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 5 | primary_confirmation_missing; Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 2 | 1 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| Android Security Bulletin | 1 | 0 | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude; hasDatedEvidence=false | 소스 풀 보강 검토 |
| lore.kernel.org linux-media list | 8 | 7 | primary_confirmation_missing; reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 유지하고 추적 |
| AOSP Gerrit (camera changes under review) | 3 | 3 | outside_main_window; source_policy_blocked | 유지하고 추적 |
| CameraX Release Notes | 1 | 1 | outside_main_window | 유지하고 추적 |
| Raspberry Pi libcamera Releases | 1 | 1 | outside_main_window | 유지하고 추적 |
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
| camerax-release-notes | CameraX Release Notes - CameraX 1.7.0-alpha03 | August 12, 2026 | reference |  | outside_main_window |  |
| aosp-gerrit-camera-changes | VirtualCamera: prevent integer underflow in outBufferSize - platform/frameworks/av | 2026-08-13 | reference | NEW | outside_main_window, source_policy_blocked | policy_locked_out_of_main |
| aosp-gerrit-camera-changes | VirtualCamera: validate blobSizeBytes against buffer size - platform/frameworks/av | 2026-08-13 | reference | NEW | outside_main_window, source_policy_blocked | policy_locked_out_of_main |
| android-developers-blog | Tinder cuts app cold starts by 47% with new R8 Configuration Analyzer | Tue, 18 Aug 2026 18:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| aosp-gerrit-camera-changes | Fix camera lazy AIDL provider not started and present cameras removed on unplug - platform/frameworks/av | 2026-08-20 | reference | NEW | outside_main_window, source_policy_blocked | policy_locked_out_of_main |
| android-developers-blog | Preparing your app for broader memory limits | Wed, 19 Aug 2026 19:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-blog | Ensuring Safety in the Generative AI Ecosystem: Protecting Users from Non-Consensual Intimate Content | Tue, 25 Aug 2026 17:00:00 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Media3 1.11 - What's new? | Tue, 11 Aug 2026 16:00:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-blog | AAOS SDV - Secure by Design | Mon, 24 Aug 2026 16:00:31 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-latest-updates | 1.4.0-alpha07 | August 26, 2026 | fallback |  | reference_only | source_gap_risk, reference_only |
| lore-linux-media-list | [PATCH v6 0/8] media: qcom: camss: CAMSS Offline Processing Engine support | 2026-09-07T10:51:18Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [sailus-media-tree:metadata 163/169] drivers/media/pci/intel/ipu6/ipu7-fw-isys.c:599:3: error: cannot jump from this goto statement to its label | 2026-09-13T22:16:07Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-ipu | [sailus-media-tree:metadata 161/169] drivers/media/pci/intel/ipu6/ipu6-fw-isys.c:664:6: warning: variable 'source' set but not used | 2026-09-13T08:07:35Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: rkisp1: Fix Bayer demosaicing bypass | 2026-09-11T13:56:36Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | Acer Swift SFG14-01 Camera Support not working on Linux | 2026-09-09T07:42:11Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [RESEND PATCH v5 0/2] media: i2c: Add os02g10 camera sensor driver | 2026-09-08T11:43:05Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/6] Add CAMSS support for Qualcomm Glymur | 2026-09-07T08:13:56Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: sensor: Decrease priority for CameraSensorRaw | 2026-09-09 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [sailus-media-tree:ipu6] BUILD SUCCESS 6f6d9729301fbf8fadff3c1822cdd730ef6cd213 | 2026-09-07T07:55:25Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v2 1/3] media: ipu6: Check the remote pad before dereferencing it | 2026-09-11T19:49:24Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/3] media: Two oopses and a hang when unbinding a streaming sensor | 2026-09-11T19:49:16Z | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/8] media: qcom: camss: add V4L2 subdev streams API support | 2026-09-11T06:22:19Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 1/2] dt-bindings: media: i2c: Add Mira016 image sensor | 2026-09-08T07:57:50Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v3 3/3] media: ipu-bridge: Add Sony IMX681 | 2026-09-09T20:38:03Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [sailus-media-tree:ipu6] BUILD SUCCESS 83345575c7f971891082b76b75e3d67a36ce5283 | 2026-09-09T02:13:37Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/2] libcamera: matrix: Add a transpose() function | 2026-09-13 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2,1/5] libcamera: v4l2_videodevice: V4L2DeviceFormat: Expand formatting | 2026-09-10 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata | 2026-09-10 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [RESEND] libcamera: software_isp: Skip stop when the worker has not started | 2026-09-07 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH] media: ipu-bridge: Add DMI quirk for Dell 14 Premium DA14250 | 2026-09-12T10:34:35Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/2] libcamera: camera_sensor: Fix IMX355 test pattern mode mapping | 2026-09-08 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-ipu | [PATCH v4 00/45] media: ipu6: Add support for ipu7 hardware | 2026-09-07T11:30:09Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3,1/3] libcamera: Clarify meaning of PixelArraySize and other rectangles | 2026-09-08 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4,1/2] ipa: libipa: camera_sensor_helper: Add OV5670 black level | 2026-09-11 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.7.2+rpt20260817 | 2026-08-17 | reference |  | outside_main_window |  |
| android-developers-blog | Recent AOSP Gerrit commits related to VirtualCamera and camera HAL changes indicate ongoing development and potential bug fixes impacting camera pipeline stability and performance. |  | unknown |  | missing_date_evidence, reference_only |  |
| android-developers-blog | Recent AOSP Gerrit commits related to VirtualCamera and camera HAL changes indicate ongoing development and potential bug fixes impacting camera pipeline stability and performance. |  | unknown |  | missing_date_evidence, reference_only |  |
| android-developers-blog | A Gerrit commit addressing an issue with the camera lazy AIDL provider and camera removal on unplug suggests improvements in camera service stability and device hot-plugging behavior. |  | unknown |  | missing_date_evidence, reference_only |  |
| lore-linux-media-ipu | [RESEND PATCH v5 0/2] media: i2c: Add os02g10 camera sensor driver - Elgin Perumbilly | 2025-08-25 | stale |  | outside_main_window |  |
| android-developers-blog | https://github.com/jwrdegoede/libcamera/commits/camss_pipeline_v2.1 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/loicpoulain/camss-isp-m2m-test |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260710-camss-isp-ope-v4-0-51207a0319d8@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260508-camss-isp-ope-v3-0-bb1055274603@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260427-camss-isp-ope-v2-0-f430e7485009@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/llvm/llvm-project |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/oe-kbuild-all/202609140614.KMCttn8e-lkp@intel.com/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/intel/lkp-tests/wiki |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/oe-kbuild-all/202609131638.i4iLw29I-lkp@intel.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260903-x1e-csi2-phy-v17-0-26606fa9a039@linaro.org |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260906-b4-linux-next-25-03-13-dtsi-x1e80100-camss-v17-0-e2197a3e2551@linaro.org |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260903202820.8401-1-nicfio@gmail.com/ |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260812105305.32447-1-nicfio@gmail.com/ |  | unknown |  | missing_date_evidence |  |

## 수집 요청 실패

후보가 0건이라는 사실만으로 새 소식이 없었다고 판단하지 않습니다. 아래는 수집기가 기록한 요청 실패이며, 기록이 없다고 모든 요청의 성공이 보장되는 것은 아닙니다.

| 소스 | 오류 |
| --- | --- |
| ISO C++ Blog | 403 Forbidden |
| libcamera Documentation | 404 Not Found |
| LLVM Project Blog | 404 Not Found |
| OpenAI News | 403 Forbidden |
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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | lore.kernel.org linux-media list (Intel IPU) | finalSelectionEligibility=exclude | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Security Bulletin | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| Source discovery 중복 제거/수리 | `REPAIR_SOURCE_DISCOVERY_DUPLICATES` | 전체 | Gemini discovery produced 16 candidate(s) but gemini_new_unique_url_count=0.; Duplicate discovery signal detected: gemini_manual_duplicate_url_count=16, duplicate_discovery_gap_count=0. | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_preferred_artifact | articles/content/newsroom/2026-09-14/shortlisted-candidates.json not found; eligible candidate count may be unavailable. | articles/content/newsroom/2026-09-14/shortlisted-candidates.json | warning |
| partial_diagnosis | Source quality diagnosis was generated with missing preferred input artifacts. | articles/content/collected-news/2026-09-14/merged-candidates.json | warning |

