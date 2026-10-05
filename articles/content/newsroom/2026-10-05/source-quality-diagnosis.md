# 소스 품질 진단 리포트

Date: 2026-10-05

## 요약

- 원본 후보 수: 50
- 보고된 사용 가능 후보 수: 12 (선정 단계와 출처 정책의 추가 차단은 아래에서 확인)
- Primary Camera Stack 후보 수: 8
- Android multimedia camera output 후보 수: 0
- 주요 진단: 소스 풀 부족 위험, Fallback 기사만 남음, Source discovery 중복 또는 무효
- 결론: 수집·분류·탐색 단계의 점검 신호가 있습니다. 이 신호만으로 특정 주제의 실제 뉴스 부족 여부를 판단할 수 없습니다.
- 병합 레코드 / 고유 URL: 73 / 54
- Gemini 신규 URL: 1
- 링크 파생 신규 URL / 발행 가능 후보: 3 / 0
- 결정론적 선택 / 본문 반영 / hard-blocked group / 명시적 강등: 4 / 4 / 0 / 0

## 진단 플래그

| 진단 항목 | 내부 키 | 상태 | 근거 |
| --- | --- | --- | --- |
| 실제 뉴스 부족 | `actual_news_shortage` | false | 진단 신호 없음 |
| 파서 추출 실패 | `parser_extraction_failure` | false | 진단 신호 없음 |
| 소스 풀 부족 위험 | `source_gap_risk` | true | android-developers-blog has source coverage risk: source_gap_count=6. |
| 분류 체계 누락 | `taxonomy_missing` | false | 진단 신호 없음 |
| Fallback 기사만 남음 | `fallback_only_composition` | true | composition_mode indicates fallback composition: FALLBACK_COMPOSITION. |
| Source discovery 중복 또는 무효 | `duplicate_or_noop_source_discovery` | true | Duplicate discovery signal detected: gemini_manual_duplicate_url_count=19, duplicate_discovery_gap_count=0. |

## 소스별 진단

| 소스 | 원본 후보 | 원시 자격 후보 | 입력 단계 진단 사유 | 권장 조치 |
| --- | --- | --- | --- | --- |
| Android Developers Blog | 8 | 2 | reference_only; main_eligible=false; reference_only=true | 소스 풀 보강 검토 |
| OpenAI News | 8 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| libcamera Patchwork (patch review) | 8 | 3 | primary_confirmation_missing; reference_only; outside_main_window | 소스 풀 보강 검토 |
| Claude Blog | 3 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Claude Code Changelog | 3 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Anthropic News | 2 | 1 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Codex Releases | 1 | 0 | reference_only; Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.; briefing_only=true | 소스 풀 보강 검토 |
| Android NDK Releases | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| AOSP Site Updates | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ISO C++ Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| libcamera Documentation | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| LLVM Project Blog | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Android | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/artificial | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/Camera | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/cpp | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| Reddit r/linux | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| 요즘IT | 0 | 0 | 입력 후보 없음; 실제 뉴스 유무 미확인 | 소스 풀 보강 검토 |
| ChromeOS Gerrit (platform2 camera merged changes) | 8 | 8 | 기록 없음 | 유지하고 추적 |
| lore.kernel.org linux-media list | 8 | 6 | primary_confirmation_missing; Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.; finalSelectionEligibility=exclude | 유지하고 추적 |

## 후보별 날짜·정책·추출 근거

수집·병합 입력의 기록을 분석한 표이며 최종 탈락 목록이 아닙니다. 후속 근거 검증으로 일부 입력 차단이 해소될 수 있습니다. 같은 후보에 여러 사유가 함께 적용될 수 있으며 기간 초과와 출처 정책 차단은 파서 실패를 뜻하지 않습니다.

| 소스 | 후보 | 날짜 | 선정 기간 | Gerrit 상태 | 입력 진단 사유 | 입력 출처 차단 |
| --- | --- | --- | --- | --- | --- | --- |
| android-developers-blog | How Instagram Direct engineers built AI-native UI architecture with Jetpack Compose and reduced token cost per agent session by 33% | Wed, 30 Sep 2026 19:00:00 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Driving growth on Google Play: The next era of subscriptions | Tue, 29 Sep 2026 16:00:00 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Build intelligent Android apps: In-app agentic workflows | Mon, 28 Sep 2026 16:00:00 +0000 | primary |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Android Bench 2.0: Pushing the frontier with challenging long-horizon tasks | Thu, 17 Sep 2026 14:06:00 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Bring your Android game to the car screen today | Mon, 21 Sep 2026 16:00:48 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| android-developers-blog | Land your apps on Googlebook with adaptive development | Tue, 22 Sep 2026 17:00:00 +0000 | fallback |  | reference_only | source_gap_risk, reference_only |
| lore-linux-media-list | [PATCH v10 00/15] media: Add Lenovo Yoga Book camera support | 2026-10-02T08:57:52Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v8 14/15] media: atomisp: allow raw Bayer capture | 2026-10-02T08:18:56Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v6 0/2] media: i2c: Add Samsung S5KJN5 image sensor | 2026-09-30T08:08:19Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v9 00/15] media: Add Lenovo Yoga Book camera support | 2026-10-02T08:35:10Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v8 00/15] media: Add Lenovo Yoga Book camera support | 2026-10-02T08:16:00Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH] media: i2c: cvs: Register subdev nodes upon binding remote sensor | 2026-09-30T11:28:14Z | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| lore-linux-media-list | [PATCH 3/3] media: mali-c55: Keep ISP powered while IRQ wake is armed | 2026-09-29T12:02:40Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| lore-linux-media-list | [PATCH v2] media: rcar-isp: ispcore: Fix inconsistent step sizes | 2026-10-01T08:51:36Z | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: software_isp: Add R10 and R10_CSI2P monochrome formats | 2026-10-03 | primary |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/5] libcamera: controls: Expand AWB controls | 2026-09-28 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v4] ipa: softisp: adjust: Read default contrast from tuning | 2026-10-03 | primary |  | primary_confirmation_missing, reference_only | source_gap_risk, reference_only, cross_check_required_but_missing |
| patchwork-libcamera-patches | [v1] ipa: {rkisp1,mali-c55}: Expand uncalibrated tuning files | 2026-09-30 | primary |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | libcamera: sensor: Decrease priority for CameraSensorRaw | 2026-09-09 | reference |  | outside_main_window, primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [v2] libcamera: pipeline: simple: Reject multiple processed streams with software ISP | 2026-09-25 | fallback |  | primary_confirmation_missing | cross_check_required_but_missing |
| patchwork-libcamera-patches | [1/5] ipa: libipa: camera_sensor_helper: Add OV02C10 | 2026-09-02 | reference |  | outside_main_window, primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| patchwork-libcamera-patches | [RFC,v1,01/20] libcamera: sysfs: Add devicePath() helpers | 2026-09-18 | fallback |  | primary_confirmation_missing | source_gap_risk, cross_check_required_but_missing |
| codex-releases | Codex rust-v0.160.0 | 2026-10-01T20:19:13Z | primary |  | reference_only | source_gap_risk, reference_only |
| anthropic-news | Anthropic invests $100 million to train 10,000 engineers and tackle the enterprise AI talent gap | 2026-10-02 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.288 | 2026-10-02T20:19:57Z | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Chatham scales its capital markets expertise with OpenAI | Fri, 02 Oct 2026 00:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | How Anthropic's sales team rebuilt inbound with Claude Managed Agents | 2026-09-30 | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Giving companies more control over their AI agents, with NVIDIA | 2026-09-28 | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | A model guide for the GPT-6 family | Fri, 02 Oct 2026 16:15:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Disrupting a coordinated model-distillation campaign | Wed, 30 Sep 2026 10:30:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | DevDay 2026 Recap | Tue, 29 Sep 2026 10:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.287 | 2026-10-01T18:00:22Z | primary |  | reference_only | source_gap_risk, reference_only |
| claude-code-changelog | Claude Code v2.1.285 | 2026-09-29T19:27:30Z | primary |  | reference_only | source_gap_risk, reference_only |
| claude-blog | Agents you can coach: how Asana builds human-agent teams with Claude | 2026-09-29 | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | The eternal complement | Thu, 01 Oct 2026 17:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | How Albertsons Companies is reimagining retail from the inside out | Thu, 01 Oct 2026 16:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | Introducing dots | Tue, 29 Sep 2026 00:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| openai-news | The Lenfest Institute grows landmark program with expanded OpenAI support | Mon, 28 Sep 2026 07:00:00 GMT | primary |  | reference_only | source_gap_risk, reference_only |
| libcamera-upstream-releases | Tags · libcamera / libcamera · GitLab |  | unknown |  | missing_date_evidence, reference_only |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/ |  | unknown |  | missing_date_evidence |  |
| kernel-org-releases | https://lore.kernel.org/r/20260928-sk5jn5-v5-0-19aa0a0a68eb@oss.qualcomm.com |  | unknown |  | missing_date_evidence |  |
| lore-linux-media-ipu | https://lore.kernel.org/linux-media/20260929133020.342677-2-barnabas.pocze+renesas@ideasonboard.com |  | unknown |  | missing_date_evidence |  |

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
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android Developers Blog | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | libcamera Patchwork (patch review) | main_eligible=false | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Blog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Claude Code Changelog | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Anthropic News | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Codex Releases | Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material. | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | Android NDK Releases | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | AOSP Site Updates | REVIEW_SOURCE_OR_PARSER | medium |
| 소스 풀 보강 검토 | `REVIEW_SOURCE_GAP` | ISO C++ Blog | REVIEW_SOURCE_OR_PARSER | medium |

## 경고

| 유형 | 메시지 | Source artifact | 심각도 |
| --- | --- | --- | --- |
| missing_optional_artifact | articles/content/newsroom/2026-10-05/evidence-pack-summary.json not found; partial diagnosis will continue. | articles/content/newsroom/2026-10-05/evidence-pack-summary.json |  |

