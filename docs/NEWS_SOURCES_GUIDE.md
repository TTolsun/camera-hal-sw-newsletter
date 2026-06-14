# 뉴스 출처 Registry

이 문서는 뉴스 출처를 어떻게 등록하고 관리하는지 설명합니다.

출처의 정본(source of truth)은 `src/shared/data/news-sources.json`입니다. 이 JSON은 candidate collector(`src/shared/cli/collect-news-candidates.js`)가 읽는 구조화된 registry입니다. 예전 방식인 `docs/news-sources.md`는 사람이 읽는 editorial guidance이며, JSON registry가 없을 때만 fallback으로 쓰입니다.

registry를 수정한 뒤에는 canonical JSON formatting을 유지하고 `npm.cmd run validate:config`를 통과시켜야 합니다.

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

- `enabled: false`: 해당 출처를 수집 대상에서 제외합니다.
- `candidateOnly: true`: lead/reference 후보로만 두며, 자동으로 최종 기사로 선택하면 안 됩니다.
- `requiresCrossCheck: true`: 최종 선택 전에 교차 확인이 필요하다는 뜻입니다. 즉 official documentation, official blog, release note, vendor/project source를 직접 확인해야 합니다.
- `priority`: 수집과 ranking 순서를 조정합니다. 값은 `high`, `medium`, `low`입니다.
- `rssUrl`: 확인된 feed URL이 있을 때만 넣습니다. 없으면 collector가 `sourceUrl`을 대신 감시합니다.
- `reliability`: 값이 `community`, `newsletter`, `tech-media`, `expert-media`, `community-doc`에 가까울수록 후보 lead로만 취급하고 교차 확인합니다.
- Reddit 출처(`reddit-*` id 또는 `reddit.com` host): candidate discovery(후보 발굴)용 community signal로만 씁니다. collector가 후보에 `community_signal: true`, `community_signal_source: "reddit"`, `community_signal_role: "candidate_discovery"`, `reddit_subreddit` marker를 붙입니다. Reddit URL은 교차 확인을 했더라도 main article이나 primary evidence로 승격하지 않습니다.
- `keywords`: 후보 발굴과 하위 호환용 `camera_hal_relevance_score` 계산을 돕습니다. 단, 새 로직은 기사 단위 evidence에서 나온 `relevance_bucket`, `editorial_priority`, `aosp_camera_directness`를 먼저 봅니다.

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

`sectionMap`은 source category를 editorial grouping section(편집용 묶음 섹션)으로 연결합니다. source entry에는 `category`만 적어 두고, collector가 `sectionMap[category]`를 보고 `section`과 `source_section`을 자동으로 파생합니다. 사용 가능한 section은 다음과 같습니다.

- `Android / AOSP / Camera`
- `Android Media / Camera Output`
- `Linux Camera / Driver`
- `C++ / Native / Toolchain`
- `Embedded / Semiconductor`
- `AI / SW Engineering Trends`
- `Korean Tech Trends`

collector는 source name, source URL, category, 파생된 section, priority, reliability, usage hint, candidate-only 상태를 `articles/content/collected-news/YYYY-MM-DD/candidates.json`에 보존합니다. Gemini newsroom 단계는 source link를 바꾸지 않으며, media/community lead를 검증할 때는 official 또는 project-official source를 우선합니다.

## 기사 대표 이미지

collector는 source feed나 article page에서 쓸 만한 image metadata가 보이면 `imageCandidates`를 붙일 수 있습니다. 단, 가벼운 content-type·size 검사를 통과한 normalized HTTPS image URL만 보존하고, favicon, icon, logo, sprite, tracker, pixel, spacer, placeholder URL은 제외합니다.

이미지 처리 규칙은 다음과 같습니다.

- newsroom generator는 이미지를 직접 browse하거나 image URL을 만들어내면 안 됩니다.
- editor는 해당 article의 `imageCandidates` 중 하나만 `selectedImage`로 고를 수 있습니다.
- 고를 후보가 없으면 비워 둡니다. 그러면 HTML renderer가 local CSS fallback visual을 대신 보여 줍니다.
- 외부 이미지는 HTTPS URL과 source attribution(출처 표기)을 붙여 article card에서 참조만 합니다. 자동화 과정에서 repository로 다운로드하거나 영구 복사하지 않습니다.

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

collector는 각 후보에 `cameraHalRelevanceScore`(관련성 점수)와 `candidateTier`(후보 등급)를 매깁니다. 점수에 따른 등급은 다음과 같습니다.

- `80+`: main article candidate (주요 기사 후보)
- `50+`: short news candidate (짧은 소식 후보)
- `30+`: reference/candidate (참고/후보)
- `<30`: source priority가 높지 않으면 기본 제외

점수에는 다음이 반영됩니다.

- category가 `camera-hal`, `camera-api`, `aosp`, `compatibility`, `security`이면 기본 boost(가산점)를 받습니다.
- Camera, CameraX, Camera2, HAL, AOSP, Android, CDD, CTS, VTS, ITS, libcamera, V4L2, ISP, image sensor, Qualcomm, Samsung, SoC, C++, LLVM, Clang, sanitizer, AI agent, coding agent, Codex, Claude Code 같은 keyword가 들어 있으면 점수에 반영됩니다.
