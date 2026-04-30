# News Source Registry

`data/news-sources.json` is the structured registry used by `scripts/collect-news-candidates.js`.
The older `docs/sources.md` remains as human-readable editorial guidance and as a fallback only when the JSON registry is absent.

## Schema

Each source entry uses this shape:

```json
{
  "id": "android-developers-blog",
  "name": "Android Developers Blog",
  "sourceUrl": "https://android-developers.googleblog.com/",
  "rssUrl": "https://android-developers.googleblog.com/feeds/posts/default?alt=rss",
  "category": "android",
  "section": "Android / AOSP / Camera",
  "priority": "high",
  "reliability": "official",
  "enabled": true,
  "candidateOnly": false,
  "requiresCrossCheck": false,
  "usageHint": "Android platform, Jetpack, CameraX, developer tooling 관련 공식 업데이트 확인",
  "keywords": ["Android", "Camera", "CameraX", "AOSP", "HAL"]
}
```

- `enabled: false` excludes a source from collection.
- `candidateOnly: true` keeps a source as a lead/reference candidate; it must not be auto-selected as a final article.
- `requiresCrossCheck: true` means the editor or generator should look for official documentation, official blogs, release notes, or direct vendor/project sources before final selection.
- `priority` controls collection and ranking order: `high`, `medium`, then `low`.
- `rssUrl` is included only when the feed URL is known; otherwise the collector watches `sourceUrl`.
- `reliability` values such as `community`, `newsletter`, `tech-media`, `expert-media`, and `community-doc` are treated as candidate-only leads.
- `keywords` contribute to `camera_hal_relevance_score`.

Common `reliability` values:

- `official`: official product, platform, company, or standards source.
- `project-official`: official open source project source.
- `official-community`: standards/community source with official status for the domain.
- `engineering-blog`: engineering organization blog.
- `engineering-media`, `electronics-media`, `tech-media`, `expert-media`: media sources; cross-check if claims affect final newsletter decisions.
- `newsletter`, `community`, `community-doc`: candidate/reference sources; cross-check before final use.
- `conference`: conference/session archive or announcement source.
- `vendor-blog`: vendor-specific engineering or product blog.

`priority` values:

- `high`: official or primary sources that should be processed first.
- `medium`: useful recurring sources for candidate collection and context.
- `low`: optional sources, broad trend sources, or sources that are disabled by default.

## Section Mapping

`sectionMap` maps source categories into these editorial grouping sections:

- `Android / AOSP / Camera`
- `Linux Camera / Driver`
- `C++ / Native / Toolchain`
- `Embedded / Semiconductor`
- `AI / SW Engineering Trends`
- `Korean Tech Trends`

The collector preserves source name, source URL, category, priority, reliability, usage hint, and candidate-only status in `collected-news/YYYY-MM-DD/candidates.json`.
The Gemini newsroom step must keep source links unchanged and prefer official or project-official sources when validating media/community leads.

## Adding Sources

1. Add a stable `id` in lowercase kebab-case.
2. Set `sourceUrl` to the public source or tag page.
3. Set `rssUrl` only when the feed URL is confirmed. Do not invent RSS URLs.
4. Choose `category` and `section` from the mapping above.
5. Set `enabled: false` for optional, noisy, paywalled, or broad trend sources until the editor wants them in regular collection.
6. Use `candidateOnly: true` for community/newsletter/paywall-prone sources that should be leads only.
7. Use `requiresCrossCheck: true` for media/community/vendor-reporting sources.
8. Keep `usageHint` short and focused on why Camera HAL / Android / C++ / AI engineers should care.

Do not copy article bodies into repository artifacts. Do not implement deep scraping for complex sites. The final newsletter should summarize in Korean and preserve source links in `Sources` or `References`.

## Relevance Score

The collector emits `cameraHalRelevanceScore` and `candidateTier`.

- `80+`: main article candidate.
- `50+`: short news candidate.
- `30+`: reference/candidate.
- `<30`: excluded by default unless the source is high priority.

Categories such as `camera-hal`, `camera-api`, `aosp`, `compatibility`, and `security` receive a base boost. Keywords such as Camera, CameraX, Camera2, HAL, AOSP, Android, CDD, CTS, VTS, ITS, libcamera, V4L2, ISP, image sensor, Qualcomm, Samsung, SoC, C++, LLVM, Clang, sanitizer, AI agent, coding agent, Codex, and Claude Code add weight.
