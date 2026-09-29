# 소스 품질 진단 리포트

Date: 2026-09-28

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 11 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 8
- Android multimedia camera output 후보 수: 0
- 주요 진단: 파서 추출 실패, 소스 풀 부족 위험, Fallback 기사만 남음, Source discovery 중복 또는 무효
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 86 / 73
- Gemini 신규 URL: 0
- 링크 파생 신규 URL / 발행 가능 후보: 23 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 5 / 4 / 1 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | true | Gemini discovery parser extraction failures=2. |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=5. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | true | composition_mode indicates fallback composition: FALLBACK_COMPOSITION. |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Gemini discovery produced 13 candidate(s) but gemini_new_unique_url_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 3 | reference_only; outside_main_window; missing_date_evidence | 소스 풀 보강 검토 |
| OpenAI News | 8 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 3 | primary_confirmation_missing; reference_only; main_eligible=false | 소스 풀 보강 검토 |
| Claude Blog | 6 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Claude Code Changelog | 4 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Anthropic News | 3 | 1 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Android Developers Latest Updates | 2 | 1 | outside_main_window; reference_only; No RSS item, no published date, no concrete release/API/behavior change detected. | 소스 풀 보강 검토 |
| Android Security Bulletin | 1 | 0 | outside_main_window; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; finalSelectionEligibility=exclude | 소스 풀 보강 검토 |
| Media3 Release Notes | 1 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| kernel.org Linux Releases | 1 | 0 | primary_confirmation_missing; reference_only; missing_date_evidence | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Codex Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/cpp | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |

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
| lore-linux-media-list | [PATCH v10 0/9] media: qcom: camss: CAMSS Offline Processing Engine support | 2026-09-25T09:09:54Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH RFC 06/15] media: qcom: camss: vfe: Add support for VFE 1190 | 2026-09-23T11:04:13Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK | 2026-09-25T12:56:37Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: ipu-bridge: Add upside-down sensor DMI quirk for Samsung Galaxy Book3 Pro | 2026-09-23T14:52:50Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v4 0/3] Add CAMSS support for Qualcomm Glymur | 2026-09-25T05:49:01Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: pipeline: simple: Reject multiple processed streams with software ISP | 2026-09-25 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/4] libcamera: v4l2_event: Add V4L2Event class and functionality | 2026-09-25 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata | 2026-09-24 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3] libcamera: camera_sensor_properties: Add OmniVision OV08X40 properties | 2026-09-26 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2,1/9] ipa: libipa: agc: Keep frame duration limits ordered | 2026-09-25 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4] libcamera: controls: Remove common enum prefix | 2026-09-21 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v3] ipa: softisp: adjust: Read default contrast from tuning | 2026-09-26 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] debayer: Further demote 'Unsupported input format' log | 2026-09-26 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| claude-blog | How to prepare for AI-driven code modernization projects | 2026-09-23 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Build plugins for Claude | 2026-09-25 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.281 | 2026-09-23T19:19:15Z | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Coding sessions are longer and use more context. Claude Opus 5.5 is built with that in mind. | 2026-09-24 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | How CodeRabbit, Power Digital, and ThoughtSpot scale with Snowflake and Vercel on Claude Marketplace | 2026-09-23 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.283 | 2026-09-25T21:50:12Z | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Ringg’s AI agents resolve up to 65% of customer calls with OpenAI | Wed, 23 Sep 2026 12:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| anthropic-news | Claude discovers a novel enzyme system with CRISPR-like repeats | 2026-09-23 | primary |  | reference_only | source_gap_risk, reference_only |
| anthropic-news | The situation report |  | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.280 | 2026-09-22T16:38:14Z | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | How invideo improves color grading 3x with GPT‑6 Astra | Wed, 23 Sep 2026 12:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Grab and OpenAI bring practical AI skills to Southeast Asia | Wed, 23 Sep 2026 00:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Parallel cut research time and cost in half with GPT‑6 Astra | Tue, 22 Sep 2026 12:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Higgsfield AI ships new video features in a day with GPT-6 Astra | Mon, 21 Sep 2026 12:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Claude Tag now supports personal connectors in channels | 2026-09-24 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Claude Marketplace: one place to discover plugins, agents, and services from our partners | 2026-09-23 | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | OpenAI extends cyber access to Ukraine for civilian defense | Wed, 23 Sep 2026 13:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | ChatGPT Ads expands to Southeast Asia and Taiwan | Wed, 23 Sep 2026 02:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Expanding OpenAI Academy with new learning paths | Mon, 21 Sep 2026 07:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| kernel-org-releases | 7.3-rc5: mainline | Sun, 27 Sep 2026 20:55:01 -0000 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, candidate_only_without_primary_confirmation, cross_check_required_but_missing |
| androidx-media3-release-notes | Media3 Release Notes - Media3 1.11.1 | September 10, 2026 | fallback |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.265 | 2026-09-08T20:37:31Z | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | https://gist.github.com/RISHI27-dot/1876791cba10798412050e1142fa7899 |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20250818155809.469479-1-mirela.rabulea@nxp.com/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/RISHI27-dot/linux/commits/lpc/ov2312/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/RISHI27-dot/edgeai-gst-plugins/blob/lpc/ov2312/ext/tiovx/gsttiovxisp.c |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/jwrdegoede/libcamera/commits/camss_pipeline_v2.1 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | https://github.com/loicpoulain/camss-isp-m2m-test |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260923-camss-isp-ope-v9-0-86a75dc18b83@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260921-camss-isp-ope-v8-0-dd1c86a3c8a0@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260915-camss-isp-ope-v7-0-77b13d131d3d@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260724-camss-isp-ope-v5-0-e70ad4fa39ce@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260710-camss-isp-ope-v4-0-51207a0319d8@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260922063507.690-1-tmorolias@gmail.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260917-glymur_camss-v3-0-1d0e2d47ad2e@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260907-glymur_camss-v2-0-75f7982dc983@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/all/20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com/ |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3348 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3377 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3271 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3338 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3375 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3393 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3322 |  | unknown |  | missing_date_evidence |  |
| android-developers-blog | #3350 |  | unknown |  | missing_date_evidence |  |

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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | OpenAI News | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Anthropic News | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Latest Updates | No RSS item, no published date, no concrete release/API/behavior change detected. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Security Bulletin | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Media3 Release Notes | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | kernel.org Linux Releases | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-09-28/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-09-28/evidence-pack-summary.json |  |

