# 소스 품질 진단 리포트

Date: 2026-10-12

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 11
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 61 / 61
- 링크 파생 신규 URL / 발행 가능 후보: 11 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 3 / 1 / 2 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | source-discovery feedback reports parser_gap_count=1. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=3. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | false | 진단 신호 없음 |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 5 | 2 | outside_main_window; reference_only; missing_date_evidence | 소스 풀 보강 검토 |
| LWN Camera / Media Articles | 3 | 1 | primary_confirmation_missing; reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 소스 풀 보강 검토 |
| Raspberry Pi Blog | 2 | 0 | primary_confirmation_missing; reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 소스 풀 보강 검토 |
| Media3 Release Notes | 1 | 0 | outside_main_window; reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | 소스 풀 보강 검토 |
| Qualcomm Security Bulletins | 1 | 0 | Excluded or low-confidence item below the main/short candidate tier.; finalSelectionEligibility=exclude; main_eligible=false | 소스 풀 보강 검토 |
| Raspberry Pi libcamera Releases | 1 | 0 | reference_only; No RSS item, no published date, no concrete release/API/behavior change detected.; briefing_only=true | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Claude Code Changelog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Codex Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/cpp | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/linux | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| 요즘IT | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Microsoft C++ Team Blog | 6 | 0 | outside_main_window; primary_confirmation_missing; reference_only | 일반 소스로 강등 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| lore-linux-media-list | [PATCH v4 0/2] media: i2c: Samsung S5K3T2 image sensor | 2026-10-11T09:13:29Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/3] media: Add GalaxyCore GC5035 and GC8034 sensor drivers | 2026-10-09T07:27:53Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v20 00/13] media: qcom: camss: Add Kaanapali support | 2026-10-10T16:01:24Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation | 2026-10-06T08:19:09Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH RESEND 00/45] media: qcom: camss: add IFE pixel path support | 2026-10-07T09:00:51Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 0/2] media: i2c: Add OmniVision OV3660 image sensor driver | 2026-10-08T16:07:17Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v1 0/2] media: support upside-down camera mounting | 2026-10-07T03:49:57Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v3 0/2] media: rkisp1: Add YUV bypass support for rkisp1 | 2026-10-06T10:28:49Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| raspberrypi-libcamera-releases | Raspberry Pi libcamera Releases - v0.7.2+rpt20261009 | 2026-10-09 | primary |  | reference_only | source_gap_risk, reference_only, trend_reference_project |
| androidx-media3-release-notes | Media3 Release Notes - Media3 1.11.1 | September 10, 2026 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-ndk-releases | Android NDK r30 | 2026-09-08T19:19:21Z | reference |  | outside_main_window |  |
| phoronix-linux-camera-media | HDR Support Coming For Qualcomm MSM Driver To Benefit Snapdragon X Laptops On Linux | Fri, 09 Oct 2026 05:37:05 -0400 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| arm-community-blogs | Blog Post: Diagnosing VK_ERROR_DEVICE_LOST on Arm GPUs with VK_EXT_device_fault | Mon, 05 Oct 2026 14:30:00 GMT | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| arm-community-blogs | Blog Post: How Arm and Google are improving ML Drift performance on Arm GPUs | Thu, 08 Oct 2026 17:45:00 GMT | primary |  | primary_confirmation_missing | source_gap_risk, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| lwn-camera-media-articles | [$] Adding kernel control-flow-integrity checking to GCC | Fri, 09 Oct 2026 17:06:12 +0000 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| phoronix-linux-camera-media | New AI Agent Resources Proposed For The Linux Kernel, AI Skills To Help Developers | Thu, 08 Oct 2026 20:41:17 -0400 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| phoronix-linux-camera-media | Google's Sashiko AI Has Completed 191k Patch Reviews, Cited On Nearly 500 Kernel CVEs | Thu, 08 Oct 2026 07:18:03 -0400 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| phoronix-linux-camera-media | Ubuntu 26.10 Sticks To Using GCC 15 By Default | Fri, 09 Oct 2026 09:38:58 -0400 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| raspberry-pi-blog | Seeing, understanding, and responding: low-power CNN, VLM and SLM workloads on Raspberry Pi 5 | Mon, 05 Oct 2026 11:59:42 +0000 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| arm-community-blogs | Blog Post: Arm A-Profile Architecture Developments 2026 | Mon, 05 Oct 2026 12:43:00 GMT | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| lwn-camera-media-articles | Stable kernels 7.2.10 and 6.18.56 | Sun, 11 Oct 2026 14:35:57 +0000 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| collabora-blog | USB-C DisplayPort Alt Mode on Rockchip RK3588 and RK3576, starting with the Flipper One | Tue, 06 Oct 2026 20:32:03 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| lwn-camera-media-articles | Python 3.15 released | Fri, 09 Oct 2026 17:15:44 +0000 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| arm-community-blogs | Blog Post: What is new in LLVM 23? | Fri, 02 Oct 2026 12:00:00 GMT | fallback |  | primary_confirmation_missing | source_gap_risk, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| collabora-blog | Mesa on Android: How we brought Turnip, SkiaVK, and Cuttlefish to CI | Thu, 10 Sep 2026 12:53:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| collabora-blog | Building GPU Drivers in Rust: Tyr at RustConf 2026 | Tue, 08 Sep 2026 17:56:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| raspberry-pi-blog | Turn text input into actions with Needle, a 14MB function-calling LLM | Tue, 22 Sep 2026 13:44:08 +0000 | fallback |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| collabora-blog | Decoding with Rockchip at Kernel Recipes 2026 | Thu, 17 Sep 2026 17:30:07 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| microsoft-cpp-team-blog | C++ in the Age of AI: Visual Studio at CppCon 2026 | Mon, 14 Sep 2026 19:34:43 +0000 | reference |  | outside_main_window, primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| microsoft-cpp-team-blog | What’s New for C++ Developers in Visual Studio 2026 (18.7 – 18.10) | Mon, 14 Sep 2026 06:38:16 +0000 | reference |  | outside_main_window, primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| microsoft-cpp-team-blog | MSVC C++23: constexpr cmath with LLVM Libc | Thu, 10 Sep 2026 21:19:59 +0000 | reference |  | outside_main_window, primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| microsoft-cpp-team-blog | MSVC Build Tools Preview updates – September 2026 | Wed, 09 Sep 2026 21:26:30 +0000 | reference |  | outside_main_window, primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| microsoft-cpp-team-blog | Faster C++ code intelligence for Copilot CLI with Whole Codebase Indexing | Tue, 22 Sep 2026 22:27:22 +0000 | fallback |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| microsoft-cpp-team-blog | Bringing Correctly Rounded Math to Production with LLVM-libc | Wed, 16 Sep 2026 22:09:50 +0000 | reference |  | outside_main_window, primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| android-developers-blog | Android Bench 2.0: Pushing the frontier with challenging long-horizon tasks | Thu, 17 Sep 2026 14:06:00 +0000 | reference |  | outside_main_window, reference_only | source_gap_risk, reference_only |
| android-developers-blog | How Instagram Direct engineers built AI-native UI architecture with Jetpack Compose and reduced token cost per agent session by 33% | Wed, 30 Sep 2026 19:00:00 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Bring your Android game to the car screen today | Mon, 21 Sep 2026 16:00:48 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | https://github.com/nic-fio/chuwi-hi10x1-cameras |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | What’s New for C++ Developers in Visual Studio 2026 (18.1-18.6) |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | Rethinking C++ Performance: Faster Code Navigation and GitHub Copilot Tools with Whole Codebase Indexing |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | Project-Specific Build Optimizations with GitHub Copilot |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | Faster C++ iterative builds with GitHub Copilot |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | The Visual Studio Debugger Agentic Workflow Gets a Test-Driven Upgrade |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | MSVC Build Tools version 14.51 Available |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | C++ Performance Improvements in MSVC Build Tools v14.51 |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | NuGet PackageReference for C++ Projects in Visual Studio |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | Visual Studio July update |  | unknown |  | missing_date_evidence |  |
| microsoft-cpp-team-blog | July 2026 |  | unknown |  | missing_date_evidence |  |

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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Media3 Release Notes | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Qualcomm Security Bulletins | Excluded or low-confidence item below the main/short candidate tier. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Raspberry Pi libcamera Releases | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | AOSP Site Updates | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Codex Releases | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | ISO C++ Blog | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Documentation | REVIEW_SOURCE_OR_PARSER | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-10-12/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-10-12/evidence-pack-summary.json |  |

