# Newsletter Sources

`data/news-sources.json` is the machine-readable source registry used by `scripts/collect-news-candidates.js`.
This document is the human-readable editorial view of the same source list. Keep the two files in sync when adding, removing, disabling, or reclassifying sources.

If the JSON registry is missing, the collector can fall back to this Markdown by reading `- Name: URL` lines, but normal operation should use `data/news-sources.json`.

## Sync Rules

- Add new sources to `data/news-sources.json` first.
- Mirror enabled editorial sources in this document under the same section.
- Mark disabled or candidate-only sources clearly.
- Do not add an `rssUrl` unless it is verified in `data/news-sources.json`.
- Media, community, newsletter, and paywall-prone sources should be treated as leads and cross-checked against official/project sources before final publication.

## Collector Classification

The collector writes schema v5 candidate metadata so reporter/editor stages can distinguish dated article evidence from watch/reference pages.

- `collectionModeHint` in `data/news-sources.json` may be `rss-source`, `release-note-watch`, `documentation-watch`, `homepage-watch`, or `media-lead`.
- Candidate records include `collectionMode`, `isArticleCandidate`, `isWatchPage`, `hasDatedEvidence`, `evidenceLevel`, and `finalSelectionEligibility`.
- `finalSelectionEligibility` is `main`, `short`, `watchlist`, or `exclude`. Only `main` and `short` candidates may become main newsletter articles.
- Static documentation, release-note index pages, and homepages stay in the JSON and Markdown as monitoring targets, but they remain `watchlist` unless the collector extracts concrete dated evidence naming a date, version/release, API/component, and behavior change.
- `source_kind`, `main_eligible`, `reference_only`, and `evidence_score` remain for compatibility and are derived from the same classification rules.

## Android / AOSP / Camera

### Primary Sources

- Android Developers Blog (`rss-source`): https://android-developers.googleblog.com/
- Android Developers Latest Updates (`release-note-watch`): https://developer.android.com/latest-updates
- CameraX Release Notes (`release-note-watch`): https://developer.android.com/jetpack/androidx/releases/camera
- AOSP Camera Documentation (`documentation-watch`): https://source.android.com/docs/core/camera
- AOSP What's New / Release Notes (`release-note-watch`): https://source.android.com/docs/whatsnew
- Android Compatibility Definition Document (`documentation-watch`): https://source.android.com/docs/compatibility/cdd
- Android Security Bulletin (`release-note-watch`): https://source.android.com/docs/security/bulletin
- Samsung Mobile Security Updates (`release-note-watch`): https://security.samsungmobile.com/securityUpdate.smsb
- Qualcomm Security Bulletins (`release-note-watch`): https://docs.qualcomm.com/product/publicresources/securitybulletin
- Android Developer Newsletter (`documentation-watch`): https://developer.android.com/newsletter

### Candidate / Cross-check Sources

- Android Weekly: https://androidweekly.net/

## Linux Camera / Driver

### Primary Sources

- libcamera Blog: https://libcamera.org/blog/
- libcamera Documentation (`documentation-watch`): https://libcamera.org/introduction.html
- Collabora Blog: https://www.collabora.com/news-and-blog/

### Candidate / Cross-check Sources

- LWN Camera / Media Articles: https://lwn.net/
- Phoronix Linux Camera / Media: https://www.phoronix.com/
- KernelNewbies LinuxChanges: https://kernelnewbies.org/LinuxChanges

## C++ / Native / Toolchain

### Primary Sources

- ISO C++ Blog: https://isocpp.org/blog
- CppCon News: https://cppcon.org/category/news/
- LLVM Project Blog: https://blog.llvm.org/
- LLVM Release Notes (`release-note-watch`): https://releases.llvm.org/
- Microsoft C++ Team Blog: https://devblogs.microsoft.com/cppblog/

## Embedded / Semiconductor

### Primary Sources

- IEEE Spectrum - Embedded Systems: https://spectrum.ieee.org/tag/embedded-systems
- IEEE Spectrum - Embedded AI: https://spectrum.ieee.org/tag/embedded-ai

### Candidate / Cross-check Sources

- EE Times - Embedded: https://www.eetimes.com/tag/embedded/
- EE Times - Semiconductors: https://www.eetimes.com/tag/semiconductors/
- Embedded.com: https://www.embedded.com/

## AI / SW Engineering Trends

### Primary Sources

- Google Open Source Blog: https://opensource.google/
- Google Research Blog: https://research.google/blog/
- Google DeepMind Blog: https://deepmind.google/blog/
- OpenAI News: https://openai.com/news/
- Anthropic News: https://www.anthropic.com/news
- Claude Code Changelog (`release-note-watch`): https://code.claude.com/docs/en/changelog
- Google Cloud AI & Machine Learning Blog: https://cloud.google.com/blog/products/ai-machine-learning

### Candidate / Cross-check Sources

- TLDR: https://tldr.tech/
- InfoQ: https://www.infoq.com/
- Hacker News: https://news.ycombinator.com/
- The Register: https://www.theregister.com/
- The New Stack: https://thenewstack.io/
- VentureBeat AI: https://venturebeat.com/ (disabled in registry)
- Software Engineering Daily: https://softwareengineeringdaily.com/ (disabled in registry)

## Korean Tech Trends

### Candidate / Cross-check Sources

- ZDNet Korea: https://zdnet.co.kr/
- 요즘IT: https://yozm.wishket.com/
- NAVER DEVIEW: https://developers.naver.com/d2/deview/ (disabled in registry)

## Selection Rules

- Prefer official documentation, official blogs, release notes, and project-official sources.
- Use media/community/newsletter sources as discovery leads unless the registry marks them otherwise.
- For `requiresCrossCheck: true` sources, confirm important claims with official documentation, vendor/project sources, or release notes before final publication.
- Every final newsletter section must preserve source links in `Sources`; the issue must also include `References`.
- Final newsletter summaries should be written in Korean and should not copy article bodies.

## Drop Rules

Do not publish items that are:

- unrelated to Camera HAL, Android Camera, Linux camera, C++, embedded systems, AI tooling, or software engineering practice;
- mostly product promotion without technical details;
- unsupported by a traceable source;
- impossible to connect to Camera HAL engineering checks, action items, or implementation context;
- duplicate or near-duplicate of a stronger official source.
