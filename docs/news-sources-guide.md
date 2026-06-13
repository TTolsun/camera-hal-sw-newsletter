# 뉴스 출처 Registry

`src/shared/data/news-sources.json`은 `src/shared/cli/collect-news-candidates.js`가 사용하는 구조화된 registry입니다. 예전 방식의 `docs/news-sources.md`는 사람이 읽는 editorial guidance이며, JSON registry가 없을 때만 fallback으로 사용합니다.

registry를 수정할 때는 canonical JSON formatting을 유지하고 `npm.cmd run validate:config`를 통과해야 합니다.

## Schema 구조

각 source entry는 아래 구조를 사용합니다.

```json
{
  "id": "android-developers-blog",
  "name": "Android Developers Blog",
  "sourceUrl": "https://android-developers.googleblog.com/",
  "rssUrl": "https://android-developers.googleblog.com/feeds/posts/default?alt=rss",
  "category": "android",
  "priority": "high",
  "reliability": "official",
  "enabled": true,
  "candidateOnly": false,
  "requiresCrossCheck": false,
  "usageHint": "Android platform, Jetpack, CameraX, developer tooling 관련 공식 업데이트 확인",
  "keywords": ["Android", "Camera", "CameraX", "AOSP", "HAL"]
}
```

- `enabled: false`는 해당 출처를 수집 대상에서 제외합니다.
- `candidateOnly: true`는 lead/reference 후보로만 유지한다는 뜻이며, 자동으로 최종 기사로 선택하면 안 됩니다.
- `requiresCrossCheck: true`는 최종 선택 전 official documentation, official blog, release note, 직접 vendor/project source 확인이 필요하다는 뜻입니다.
- `priority`는 수집과 ranking 순서를 조정하며 `high`, `medium`, `low`를 사용합니다.
- `rssUrl`은 확인된 feed URL이 있을 때만 넣습니다. 없으면 collector가 `sourceUrl`을 감시합니다.
- `reliability`가 `community`, `newsletter`, `tech-media`, `expert-media`, `community-doc`에 가까울수록 후보 lead로 취급하고 교차 확인합니다.
- Reddit 출처(`reddit-*` id 또는 `reddit.com` host)는 candidate discovery용 community signal로만 사용합니다. collector가 후보에 `community_signal: true`, `community_signal_source: "reddit"`, `community_signal_role: "candidate_discovery"`, `reddit_subreddit` marker를 붙이며, Reddit URL은 교차 확인이 있어도 main article/primary evidence로 승격하지 않습니다.
- `keywords`는 후보 발굴과 하위 호환 `camera_hal_relevance_score` 계산에 도움을 줍니다. 새 로직은 기사 단위 evidence에서 나온 `relevance_bucket`, `editorial_priority`, `aosp_camera_directness`를 우선합니다.

자주 쓰는 `reliability` 값:

- `official`: 공식 제품, platform, company, standards source
- `project-official`: 공식 open source project source
- `official-community`: 해당 domain에서 공식 지위를 가진 standards/community source
- `engineering-blog`: engineering organization blog
- `engineering-media`, `electronics-media`, `tech-media`, `expert-media`: media source이며 최종 판단에 쓰기 전 교차 확인합니다.
- `newsletter`, `community`, `community-doc`: candidate/reference source이며 최종 사용 전 교차 확인합니다.
- `conference`: conference/session archive 또는 announcement source
- `vendor-blog`: vendor-specific engineering 또는 product blog

`priority` 값:

- `high`: 먼저 처리해야 하는 official 또는 primary source
- `medium`: 후보 수집과 context에 유용한 반복 출처
- `low`: optional source, 넓은 trend source, 기본 비활성 출처

## Section mapping

`sectionMap`은 source category를 editorial grouping section으로 매핑합니다. source entry는 `category`만 보관하고, collector가 `sectionMap[category]`에서 `section`과 `source_section`을 파생합니다.

- `Android / AOSP / Camera`
- `Android Media / Camera Output`
- `Linux Camera / Driver`
- `C++ / Native / Toolchain`
- `Embedded / Semiconductor`
- `AI / SW Engineering Trends`
- `Korean Tech Trends`

collector는 source name, source URL, category, 파생된 section, priority, reliability, usage hint, candidate-only 상태를 `articles/content/collected-news/YYYY-MM-DD/candidates.json`에 보존합니다. Gemini newsroom 단계는 source link를 변경하지 않고, media/community lead를 검증할 때 official 또는 project-official source를 우선합니다.

## 기사 대표 이미지

collector는 source feed나 article page에서 사용할 수 있는 image metadata가 보이면 `imageCandidates`를 붙일 수 있습니다. 가벼운 content-type과 size 검사를 통과한 normalized HTTPS image URL만 보존하고, favicon, icon, logo, sprite, tracker, pixel, spacer, placeholder URL은 제외합니다.

newsroom generator는 이미지를 browse하거나 image URL을 만들어내면 안 됩니다. editor는 해당 article의 `imageCandidates` 중 하나만 `selectedImage`로 설정할 수 있습니다. 없으면 비워 두고 HTML renderer가 local CSS fallback visual을 보여줍니다. 외부 이미지는 HTTPS URL과 source attribution으로 article card에 참조하며, 자동화 과정에서 repository에 다운로드하거나 영구 복사하지 않습니다.

## 출처 추가 방법

1. 안정적인 `id`를 lowercase kebab-case로 추가합니다.
2. `sourceUrl`은 public source 또는 tag page로 설정합니다.
3. `rssUrl`은 feed URL이 확인된 경우에만 설정합니다. RSS URL을 추측하지 않습니다.
4. 위 mapping에서 `category`를 선택합니다. source entry에 `section`을 직접 추가하지 않습니다.
   - `android-media`는 official Android media reference/release-note discovery grouping입니다. article relevance 판단은 source category가 아니라 기사 단위 `relevance_bucket`과 scope score가 담당합니다.
5. optional, noisy, paywalled, broad trend source는 editor가 regular collection에 포함하기 전까지 `enabled: false`로 둡니다.
6. community/newsletter/paywall-prone source는 `candidateOnly: true`를 사용합니다.
7. media/community/vendor-reporting source는 `requiresCrossCheck: true`를 사용합니다.
8. `usageHint`는 AOSP Camera / Camera Driver / SoC Platform / C++ / AI engineer가 왜 관심을 가져야 하는지 짧게 적습니다.

article body를 repository artifact에 복사하지 않습니다. 복잡한 site에 deep scraping을 구현하지 않습니다. 최종 newsletter는 한국어로 요약하고 source link를 `Sources` 또는 `References`에 보존합니다.

## 관련성 점수

collector는 `cameraHalRelevanceScore`와 `candidateTier`를 생성합니다.

- `80+`: main article candidate
- `50+`: short news candidate
- `30+`: reference/candidate
- `<30`: source priority가 높지 않으면 기본 제외

`camera-hal`, `camera-api`, `aosp`, `compatibility`, `security` category는 기본 boost를 받습니다. Camera, CameraX, Camera2, HAL, AOSP, Android, CDD, CTS, VTS, ITS, libcamera, V4L2, ISP, image sensor, Qualcomm, Samsung, SoC, C++, LLVM, Clang, sanitizer, AI agent, coding agent, Codex, Claude Code 같은 keyword도 점수에 반영됩니다.
