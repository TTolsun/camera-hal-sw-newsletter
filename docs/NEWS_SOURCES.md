# 뉴스 출처 목록

`src/shared/data/news-sources.json`은 `src/shared/cli/collect-news-candidates.js`가 사용하는 기계 판독용 출처 registry입니다. 이 문서는 같은 출처 목록을 사람이 검토하기 위한 editorial view입니다. 출처를 추가, 제거, 비활성화, 재분류할 때는 두 파일을 함께 맞춥니다.

JSON registry가 없을 때 collector는 이 Markdown의 `- Name: URL` 형식을 fallback으로 읽을 수 있습니다. 정상 운영에서는 `src/shared/data/news-sources.json`을 우선합니다.

## 동기화 규칙

- 새 출처는 먼저 `src/shared/data/news-sources.json`에 추가합니다.
- 활성 editorial source는 이 문서의 같은 섹션 아래에 반영합니다.
- 비활성 출처와 candidate-only 출처는 명확히 표시합니다.
- `rssUrl`은 `src/shared/data/news-sources.json`에서 검증된 경우에만 추가합니다.
- media, community, newsletter, paywall 가능성이 있는 출처는 lead로 취급하고 최종 발행 전 official/project source로 교차 확인합니다.

## Collector 분류

collector는 schema v5 후보 metadata를 기록해 reporter/editor 단계가 날짜가 있는 기사 근거와 watch/reference page를 구분할 수 있게 합니다.

- `collectionModeHint`는 `rss-source`, `release-note-watch`, `documentation-watch`, `homepage-watch`, `media-lead` 중 하나입니다.
- 후보 record는 `collectionMode`, `isArticleCandidate`, `isWatchPage`, `hasDatedEvidence`, `evidenceLevel`, `finalSelectionEligibility`를 포함합니다.
- `finalSelectionEligibility`는 `main`, `short`, `watchlist`, `exclude` 중 하나입니다. main newsletter article에는 `main` 또는 `short` 후보만 사용할 수 있습니다.
- 정적 문서, release-note index page, homepage는 모니터링 대상으로 유지하지만, collector가 날짜, version/release, API/component, behavior change를 포함한 구체 근거를 추출하지 못하면 `watchlist`에 머뭅니다.
- `source_kind`, `main_eligible`, `reference_only`, `evidence_score`는 호환성을 위해 유지하며 같은 분류 규칙에서 파생합니다.

## Android / AOSP / Camera

### 1차 출처

- Android Developers Blog (`rss-source`): https://android-developers.googleblog.com/
- Android Developers Blog - Camera (`rss-source`): https://android-developers.googleblog.com/search?q=CameraX
- Android Developers Latest Updates (`release-note-watch`): https://developer.android.com/latest-updates
- CameraX Release Notes (`release-note-watch`): https://developer.android.com/jetpack/androidx/releases/camera
- Media3 Release Notes (`release-note-watch`, `android-media`): https://developer.android.com/jetpack/androidx/releases/media3
- MediaRecorder Documentation (`documentation-watch`, `reference_only`): https://developer.android.com/media/platform/mediarecorder
- Android Supported Media Formats (`documentation-watch`, `reference_only`): https://developer.android.com/media/platform/supported-formats
- Photo Picker Documentation (`documentation-watch`, `reference_only`): https://developer.android.com/training/data-storage/shared/photo-picker
- MediaStore Reference (`documentation-watch`, `reference_only`): https://developer.android.com/reference/android/provider/MediaStore
- MediaCodec Reference (`documentation-watch`, `reference_only`): https://developer.android.com/reference/android/media/MediaCodec
- AOSP Camera Documentation (`documentation-watch`, `reference_only`): https://source.android.com/docs/core/camera
- AOSP Release Source Drop - camera changes (`release-note-watch`): https://source.android.com/docs/setup/reference/build-numbers
- AOSP Gerrit - camera changes under review (`rss-source`): https://android-review.googlesource.com/q/((project:platform/frameworks/av+OR+project:platform/hardware/interfaces)+AND+directory:camera)+OR+project:platform/hardware/google/camera
- AOSP What's New / Release Notes (`release-note-watch`, `reference_only`): https://source.android.com/docs/whatsnew
- AOSP Site Updates (`release-note-watch`): https://source.android.com/docs/whatsnew/site-updates
- Android Compatibility Definition Document (`documentation-watch`, `reference_only`): https://source.android.com/docs/compatibility/cdd
- Android Security Bulletin (`release-note-watch`): https://source.android.com/docs/security/bulletin
- Samsung Mobile Security Updates (`release-note-watch`): https://security.samsungmobile.com/securityUpdate.smsb
- Qualcomm Security Bulletins (`release-note-watch`): https://docs.qualcomm.com/product/publicresources/securitybulletin
- MediaTek Security Bulletin (`release-note-watch`): https://www.mediatek.com/product-security-bulletin
- Android Developer Newsletter (`documentation-watch`, `reference_only`): https://developer.android.com/newsletter

공개 AOSP는 2025년 3월 이후 `main` 브랜치로 개발이 흘러들지 않고 릴리스 태그(`android-N.M.P_rK`)로 몇 달에 한 번 통째로 공개됩니다. AOSP Release Source Drop 출처는 build-numbers 표에서 릴리스 쌍을 고르고, 그 차이(`이전태그..새태그`)에서 camera 경로를 건드린 커밋만 모아 저장소별로 후보 1건을 만듭니다. 감시 저장소는 `platform/hardware/interfaces`(Camera HAL AIDL), `platform/frameworks/av`(camera framework/cameraserver), `platform/hardware/google/camera`(Google Camera HAL)입니다.

릴리스 쌍은 이렇게 고릅니다. 새 릴리스는 **보안 패치 레벨이 가장 늦은 것**입니다. 버전 태그 내림차순으로 고르면 상위 major가 나온 뒤 도착하는 하위 major 보안 드롭(예: `android-17.0.0_r1` 뒤의 `android-16.0.0_r5`)을 영영 놓칩니다. 직전 릴리스는 새 릴리스보다 **버전이 낮은 것 중 가장 높은 태그**입니다. 같은 라인의 직전 `_r`을 자연히 고르고, 라인의 첫 릴리스에서는 직전 major의 마지막 태그를 고릅니다.

후보 날짜는 표의 보안 패치 레벨만 사용합니다. 같은 릴리스라도 저장소별 태그 커밋 시각이 흩어져 있고(`android-17.0.0_r1` 기준 `frameworks/av` 2026-05-14, `hardware/google/camera` 2026-03-28) 어느 쪽도 공개 시점이 아니기 때문입니다. 표에 ISO 날짜가 없는 행은 날짜를 추정하지 않고 건너뜁니다.

수집 창은 파이프라인이 넘겨준 `now`/`lookbackDays`에서 파생합니다. 릴리스가 창 밖이면 gitiles 조회를 아예 하지 않아, 드롭이 없는 대부분의 주에는 요청 한 번으로 끝납니다. 델타가 페이지 상한(6 × 100 커밋)을 넘어 다 읽지 못하면 후보 제목과 요약이 건수를 `at least N` 하한으로 말합니다.

### Gerrit 변경의 proposal / review / landed lifecycle

AOSP Gerrit과 ChromeOS Gerrit 출처는 릴리스 드롭보다 앞선 단계를 봅니다. 릴리스 드롭이 "공개된 확정 변경"을 몇 달에 한 번 통째로 보여 준다면, Gerrit은 아직 리뷰 중인 제안까지 날짜와 상태가 붙은 채로 보여 줍니다. 둘은 대체 관계가 아니라 proposal → landed 관계이므로 함께 유지합니다.

기사 승격 정책은 상태로 정합니다.

- `MERGED`: `submitted`을 기사 날짜로 쓰고 main article 후보로 둡니다. 병합된 변경은 그 자체가 확정된 1차 사실입니다.
- `NEW` + 긍정 `Code-Review` 표: `created`를 기사 날짜로 쓰고 main article 후보로 둡니다. 단 `Code-Review`, `Verified`, `Presubmit-Verified` 중 하나라도 부정 표(`rejected`/`disliked`)가 있으면 긍정 근거로 보지 않습니다 — 리뷰어 +1이 있어도 검증이 실패한 변경은 승격하지 않습니다.
- `NEW` + 긍정 `Code-Review` 표 없음: 후보로 수집하되 `mainArticlePolicy=watchlist_only`로 내려 briefing 재료로만 씁니다. `Verified`/`Presubmit-Verified` 긍정 표만 있는 변경도 여기에 들어갑니다 — 검증 통과는 사람이 코드를 봤다는 뜻이 아닙니다. AOSP Gerrit에는 누구나 변경을 올릴 수 있으므로, 아무도 검토하지 않은 제안은 뉴스가 아닙니다.
- `WIP`, `ABANDONED`: 수집하지 않습니다.

`updated`는 기사 날짜로 쓰지 않습니다. 댓글 한 줄에도 갱신되기 때문에, 그걸 날짜로 쓰면 오래된 변경이 매주 "이번 주 소식"으로 되살아나고 patchset 갱신마다 같은 변경이 다시 기사가 됩니다. `created`/`submitted`를 쓰면 같은 변경은 수집 창 안에서 한 번만 후보가 되고 그 뒤로는 창 밖으로 빠집니다.

다음은 후보에서 제외합니다. `OWNERS`, `TEST_MAPPING`, 빌드·메타데이터 파일만 바뀐 변경. 제목이 `DO NOT SUBMIT`이거나 `test`/`fake`로 시작하는 시험용 변경. 그리고 실질 변경 파일의 절반 미만이 카메라 경로인 변경 — 트리 전역 리팩터링이 camera 디렉터리를 스쳐 간 경우입니다(실측: ChromeOS 변경 하나가 23개 파일 중 4개만 `camera/` 아래였습니다).

Gerrit 변경 페이지는 클라이언트 렌더링(PolyGerrit)이라 URL을 받아도 본문이 없습니다. 그래서 후보 요약은 REST 응답에서 읽은 사실(상태, 브랜치, 변경 파일 전체 경로, 삽입·삭제 줄 수, 리뷰 표, Change-Id, 리비전 SHA)만으로 스스로 완결됩니다.

같은 변경이 나중에 릴리스 드롭에도 들어오면 새 기사를 만들지 않습니다. 드롭 후보가 자기가 센 camera 커밋의 `Change-Id`와 commit SHA를 함께 싣고, 선정 단계가 그 목록으로 Gerrit 후보와 겹치는지 봅니다. 겹치면 나머지 커밋까지 담은 드롭 쪽을 대표로 남깁니다. 다만 공개 드롭에는 내부 Gerrit에서 cherry-pick된 merge 커밋이 섞여 있어 Change-Id가 달라질 수 있습니다 — 이 연결은 겹쳤을 때 중복을 막는 안전망이지, 항상 성사되는 보증이 아닙니다.

ChromeOS `chromiumos/platform2`는 `camera/` 아래의 `MERGED` 변경만 봅니다. ChromeOS camera 서비스가 Android Camera HAL v3 인터페이스를 구현하므로 capture request/result, stream·buffer 수명주기, 3A, ISP, JPEG/RAW/YUV, 외부 카메라 변경이 Camera HAL 독자에게 직접 읽힙니다. `chromiumos/platform/camera`의 vendor HAL 변경은 초기 범위 밖입니다.

Media3 release note는 날짜가 있는 item-level 변경, 구체 component/API/behavior, camera output path 연결이 모두 있을 때만 `android` 후보(camera output/multimedia 근거)로 봅니다. MediaCodec, MediaRecorder, MediaStore, Photo Picker, supported formats 문서는 reference/background source이며 단독 기사 후보가 아닙니다.

reference source(`sourceRole=official_documentation_reference` 또는 `mainArticlePolicy=reference_only`)는 제너릭 페이지 스크레이프 폴백을 쓰지 않습니다. 이런 페이지는 날짜가 없어 후보가 늘 `finalSelectionEligibility=exclude`로 끝나면서 소스 진단만 상시로 켰습니다. `sourceRole=official_documentation_reference`인 소스는 소스 전용 파서를 따로 두더라도 후보가 살아나지 않습니다 — collector가 파서 결과와 무관하게 `finalSelectionEligibility=exclude`로 닫습니다. 그 소스를 다시 기사 후보로 쓰려면 registry의 `sourceRole`부터 되돌려야 합니다.

AOSP What's New(`https://source.android.com/docs/whatsnew`)는 릴리스 노트로 가는 랜딩 페이지라 자체 dated 행이 없습니다. 날짜가 붙은 What's New 변경(예: "Published initial release notes on Android 17 release notes")은 AOSP Site Updates 표에서 들어옵니다. Android Developer Newsletter(`https://developer.android.com/newsletter`)도 같은 이유로 reference source입니다.

### 후보 / 교차 확인 출처

- Android Weekly: https://androidweekly.net/

## Linux Camera / Driver

### 1차 출처

- libcamera Blog: https://libcamera.org/blog/
- libcamera Release Announcements: https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html
- libcamera Documentation (`documentation-watch`, `reference_only`): https://libcamera.org/introduction.html
- ChromeOS Gerrit - platform2 camera merged changes (`rss-source`): https://chromium-review.googlesource.com/q/project:chromiumos/platform2+status:merged+directory:camera
- Collabora Blog: https://www.collabora.com/news-and-blog/

### 후보 / 교차 확인 출처

- LWN Camera / Media Articles: https://lwn.net/
- Phoronix Linux Camera / Media: https://www.phoronix.com/
- KernelNewbies LinuxChanges: https://kernelnewbies.org/LinuxChanges

## C++ / Native / Toolchain

### 1차 출처

- ISO C++ Blog: https://isocpp.org/blog
- CppCon News: https://cppcon.org/category/news/
- LLVM Project Blog: https://blog.llvm.org/
- LLVM Release Notes (`release-note-watch`): https://releases.llvm.org/
- Microsoft C++ Team Blog: https://devblogs.microsoft.com/cppblog/

## Embedded / Semiconductor

### 1차 출처

- IEEE Spectrum - Embedded Systems: https://spectrum.ieee.org/tag/embedded-systems
- IEEE Spectrum - Embedded AI: https://spectrum.ieee.org/tag/embedded-ai

### 후보 / 교차 확인 출처

- EE Times - Embedded: https://www.eetimes.com/tag/embedded/
- EE Times - Semiconductors: https://www.eetimes.com/tag/semiconductors/
- Embedded.com: https://www.embedded.com/

## AI / SW Engineering Trends

### 1차 출처

- Google Open Source Blog: https://opensource.google/
- Google Research Blog: https://research.google/blog/
- Google DeepMind Blog: https://deepmind.google/blog/
- OpenAI News: https://openai.com/news/
- Anthropic News: https://www.anthropic.com/news
- Claude Blog: https://claude.com/blog
- Claude Code Changelog (`release-note-watch`): https://code.claude.com/docs/en/changelog
- Google Cloud AI & Machine Learning Blog: https://cloud.google.com/blog/products/ai-machine-learning

### 후보 / 교차 확인 출처

- TLDR: https://tldr.tech/
- InfoQ: https://www.infoq.com/
- Hacker News: https://news.ycombinator.com/
- The Register: https://www.theregister.com/
- The New Stack: https://thenewstack.io/
- VentureBeat AI: https://venturebeat.com/ (registry에서 비활성)
- Software Engineering Daily: https://softwareengineeringdaily.com/ (registry에서 비활성)

## 한국 기술 동향

### 후보 / 교차 확인 출처

- ZDNet Korea: https://zdnet.co.kr/
- 요즘IT: https://yozm.wishket.com/
- NAVER DEVIEW: https://developers.naver.com/d2/deview/ (registry에서 비활성)

## Reddit 커뮤니티 신호 (community signal)

Reddit 출처는 candidate discovery용 **커뮤니티 신호(sensor)**입니다. Reddit URL 자체는 primary evidence가 아니며, 단독으로 main article이 되거나 source gap을 해소하거나 주요 factual claim의 근거가 될 수 없습니다. Reddit lead는 항상 독립적인 official/project source로 교차 확인한 뒤에만 기사화합니다.

- 모든 Reddit 출처는 `candidateOnly: true`, `requiresCrossCheck: true`, `priority: low`, `reliability: community`, `mainArticlePolicy: conditional`로 고정합니다. 교차 확인이 있어도 Reddit URL은 main article의 primary source로 승격하지 않습니다.
- 수집은 subreddit `search.rss`(camera/Android Camera 관련 query)만 사용하며 본문·댓글 전문은 저장하지 않습니다.
- `linkedEvidencePolicy`는 official/project domain link만 교차 확인 후보로 분류합니다.

### 후보 / 교차 확인 출처 (community signal)

- Reddit r/androiddev (`rss-source`, community signal): https://www.reddit.com/r/androiddev/
- Reddit r/Android (`rss-source`, community signal): https://www.reddit.com/r/Android/
- Reddit r/artificial (`rss-source`, community signal): https://www.reddit.com/r/artificial/
- Reddit r/cpp (`rss-source`, community signal): https://www.reddit.com/r/cpp/
- Reddit r/linux (`rss-source`, community signal): https://www.reddit.com/r/linux/
- Reddit r/Camera (`rss-source`, community signal): https://www.reddit.com/r/Camera/

## 선택 규칙

- official documentation, official blog, release note, project-official source를 우선합니다.
- media/community/newsletter source는 registry가 다르게 지정하지 않는 한 discovery lead로 사용합니다.
- Reddit 등 community signal source는 sensor로만 사용하며 Reddit URL을 main article의 primary source로 승격하지 않습니다.
- `requiresCrossCheck: true` 출처의 중요한 주장은 final publication 전에 official documentation, vendor/project source, release note로 확인합니다.
- 모든 최종 newsletter section은 `Sources` 또는 `출처`에 source link를 보존해야 하며, 이슈 끝에는 `References` 또는 `참고자료`가 있어야 합니다.
- 최종 newsletter 요약은 한국어로 작성하고 article body를 복사하지 않습니다.

## 제외 규칙

다음 항목은 발행하지 않습니다.

- AOSP Camera, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC platform, C++, embedded systems, AI tooling, software engineering practice와 관련이 없는 항목
- 기술 세부 내용 없이 제품 홍보에 가까운 항목
- 추적 가능한 출처가 없는 항목
- AOSP Camera / driver / SoC / native engineering check, action item, implementation context로 연결할 수 없는 항목
- 더 강한 official source와 중복되거나 거의 같은 항목

## Source quality policy contract

`src/shared/data/news-sources.json`은 source quality policy의 실행 가능한 registry입니다. 이 문서의 사람이 읽는 출처 목록은 정책을 설명하는 역할이며, 두 번째 source of truth가 되어서는 안 됩니다.

- 활성화된 모든 source는 `sourceRole`, `sourceUrlQualityHint`, `mainArticlePolicy`, `requiresCrossCheckDefault`, `evidenceGranularityHint`, `sourceQualityNotes`를 정의합니다.
- `main_article_source_allowed`는 source/evidence 정책 전용 값입니다. `finalSelectionEligibility`, score, 최종 선정 결과, HAL signal 출력을 포함하지 않습니다.
- 조건부 source는 source evidence와 필요한 primary 확인/교차 확인 상태를 갖출 때만 source-ready가 될 수 있습니다.
- HAL/native workflow evidence는 source classifier가 평가하지 않으며, HAL signal layer가 소비하고 `main_article_readiness`에 합산합니다.
- `source_url_quality=unknown` 상태의 source는 main 기사 자격이 없습니다. classifier가 Stage 3 전에 해소하지 못하면 해당 main 기사는 실패합니다.
- `generic_ai_or_it_trend`, `tech_media_lead_requires_cross_check`, `community_lead_requires_cross_check`는 조건부 정책이며 무조건적인 승인이 아닙니다.
- Stage 3은 canonical `source_quality`를 소비하며 `main_article_source_blockers[]`를 추론, 수정, 재정의해서는 안 됩니다.
