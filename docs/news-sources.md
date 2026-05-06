# 뉴스 출처 목록

`data/news-sources.json`은 `scripts/collect-news-candidates.js`가 사용하는 기계 판독용 출처 registry입니다. 이 문서는 같은 출처 목록을 사람이 검토하기 위한 editorial view입니다. 출처를 추가, 제거, 비활성화, 재분류할 때는 두 파일을 함께 맞춥니다.

JSON registry가 없을 때 collector는 이 Markdown의 `- Name: URL` 형식을 fallback으로 읽을 수 있습니다. 정상 운영에서는 `data/news-sources.json`을 우선합니다.

## 동기화 규칙

- 새 출처는 먼저 `data/news-sources.json`에 추가합니다.
- 활성 editorial source는 이 문서의 같은 섹션 아래에 반영합니다.
- 비활성 출처와 candidate-only 출처는 명확히 표시합니다.
- `rssUrl`은 `data/news-sources.json`에서 검증된 경우에만 추가합니다.
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
- AOSP Camera Documentation (`documentation-watch`, `reference_index`): https://source.android.com/docs/core/camera
- AOSP What's New / Release Notes (`release-note-watch`): https://source.android.com/docs/whatsnew
- AOSP Site Updates (`release-note-watch`): https://source.android.com/docs/whatsnew/site-updates
- Android Compatibility Definition Document (`documentation-watch`): https://source.android.com/docs/compatibility/cdd
- Android Security Bulletin (`release-note-watch`): https://source.android.com/docs/security/bulletin
- Samsung Mobile Security Updates (`release-note-watch`): https://security.samsungmobile.com/securityUpdate.smsb
- Qualcomm Security Bulletins (`release-note-watch`): https://docs.qualcomm.com/product/publicresources/securitybulletin
- Android Developer Newsletter (`documentation-watch`): https://developer.android.com/newsletter

### 후보 / 교차 확인 출처

- Android Weekly: https://androidweekly.net/

## Linux Camera / Driver

### 1차 출처

- libcamera Blog: https://libcamera.org/blog/
- libcamera Release Announcements: https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html
- libcamera Documentation (`documentation-watch`): https://libcamera.org/introduction.html
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

## 선택 규칙

- official documentation, official blog, release note, project-official source를 우선합니다.
- media/community/newsletter source는 registry가 다르게 지정하지 않는 한 discovery lead로 사용합니다.
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
