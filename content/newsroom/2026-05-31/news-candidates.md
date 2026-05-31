# 뉴스 후보 - 2026-05-31

이 파일은 구조화된 newsletter source registry에서 생성됩니다. Gemini는 candidate JSON과 source metadata만 입력으로 사용하며 웹을 직접 browse하지 않습니다.

- Lookback: 21일
- 후보 수: 40
- Source registry: data/news-sources.json
- Candidate-only media/community source는 final article selection 전에 official-source verification이 필요합니다.
- 날짜가 있는 release/API/behavior evidence가 없는 static HTML page는 main article candidate가 아니라 watchlist/reference material입니다.

## Gemini Newsroom 입력 요약

```text
뉴스레터 날짜: 2026-05-31
대상 독자: AOSP Camera / Camera Driver / SoC Platform / C++ engineer
Inputs: content/collected-news/YYYY-MM-DD/manual-candidates.json, content/collected-news/YYYY-MM-DD/candidates.json, data/news-sources.json, docs/news-sources.md
Outputs: reporter-candidates.json, editor-draft.json, fact-check-report.json, newsletter.md, index.html, editor-in-chief-brief.md, release-qa-report.md
```

## Main 후보

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| main | primary | android_platform_camera_adjacent | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | Android Developers Blog | Tue, 19 May 2026 13:00:00 +0000 | Official dated release row with concrete change. | [link](https://goo.gle/AdaptiveApps_IO26) |

## Short 후보

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| short | primary | cpp_ai_tooling_fallback | Build native Android apps in Google AI Studio | Android Developers Blog | Tue, 19 May 2026 12:45:00 +0000 | Official dated source with supporting evidence. | [link](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html) |
| short | primary | android_multimedia_camera_output | Start building today - Build native Android apps in Google AI Studio | Android Developers Blog | Tue, 19 May 2026 12:45:00 +0000 | Official dated source with supporting evidence. | [link](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today) |

## Watchlist

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| watch | watch | cpp_ai_tooling_fallback | Android CLI Now Stable 1.0: Accelerate developing for Android using any agent | Android Developers Blog | Tue, 19 May 2026 11:45:00 +0000 | Source has gap risk; keep as watch material. | [link](https://android-developers.googleblog.com/2026/05/android-cli-stable-1-0-agent-development.html) |
| watch | watch | cpp_ai_tooling_fallback | How ref qualifiers led to deducing this | ISO C++ Blog | Fri, 29 May 2026 14:23:44 +0000 | Source has gap risk; keep as watch material. | [link](https://isocpp.org//blog/2026/05/how-ref-qualifiers-led-to-deducing-this) |
| watch | watch | cpp_ai_tooling_fallback | The road to &apos;import boost&apos;: a library developer&apos;s journey into C++20 modules -- Rubén Pérez Hidalgo | ISO C++ Blog | Wed, 20 May 2026 22:51:47 +0000 | Source has gap risk; keep as watch material. | [link](https://isocpp.org//blog/2026/05/the-road-to-import-boost-a-library-developers-journey-into-cpp20-modules-ru) |
| watch | watch | cpp_ai_tooling_fallback | C++26: Structured Bindings in Conditions -- Sandor Dargo | ISO C++ Blog | Tue, 26 May 2026 22:57:06 +0000 | Source has gap risk; keep as watch material. | [link](https://isocpp.org//blog/2026/05/cpp26-structured-bindings-in-conditions-sandor-dargo) |

## Reference / snapshot 페이지

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| reference | reference | generic_tech_watchlist | 17 Things to know for Android developers at Google I/O | Android Developers Blog | Tue, 19 May 2026 13:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/17-things-android-developers-google-io.html) |
| reference | reference | generic_tech_watchlist | Android UI Development is Compose First | Android Developers Blog | Tue, 19 May 2026 09:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-ui-development-is-compose-first.html) |
| reference | reference | generic_tech_watchlist | Top AI on Android updates for building intelligent experiences from Google I/O ‘26 | Android Developers Blog | Tue, 26 May 2026 17:30:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-ai-intelligence-system.html) |
| reference | reference | generic_tech_watchlist | Android Studio I/O Edition: What’s new in Android Developer tools | Android Developers Blog | Tue, 19 May 2026 09:30:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/whats-new-android-developer-tools.html) |
| reference | reference | generic_tech_watchlist | How FotMob leveraged cross-device discovery to score record Wear OS adoption | Android Developers Blog | Fri, 15 May 2026 16:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/fotmob-wear-os-adoption-cross-device-discovery.html) |
| reference | reference | generic_tech_watchlist | Increasing app discovery and engagement on Google TV | Android Developers Blog | Tue, 19 May 2026 12:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/increase-google-tv-app-discovery.html) |
| reference | reference | generic_tech_watchlist | I/O 2026: What's new in Google Play | Android Developers Blog | Tue, 19 May 2026 08:15:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/io-2026-whats-new-in-google-play.html) |
| reference | reference | generic_tech_watchlist | Camera &nbsp;\|&nbsp; Android Open Source Project | AOSP Camera Documentation | 검토 필요 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/core/camera) |
| reference | reference | generic_tech_watchlist | Build for the future with the Android XR Developer Catalyst Program — Apply now! | Android Developers Blog | Tue, 19 May 2026 11:15:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/apply-android-xr-developer-catalyst.html) |
| reference | reference | generic_tech_watchlist | Adaptive development for the expanding Android ecosystem | Android Developers Blog | Tue, 19 May 2026 11:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-adaptive-development-ecosystem.html) |
| reference | reference | generic_tech_watchlist | Updates to the Android XR SDK: Introducing Developer Preview 4 | Android Developers Blog | Tue, 19 May 2026 10:45:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-xr-sdk-developer-preview-4-updates.html) |
| reference | reference | generic_tech_watchlist | Introducing Android Performance Analyzer : The Next Evolution in Profiling for Android | Android Developers Blog | Tue, 19 May 2026 10:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/introducing-android-performance-analyzer.html) |
| reference | reference | generic_tech_watchlist | Bring Native Visibility to Your VoIP App Experience with Telecom's Latest Alpha | Android Developers Blog | Thu, 14 May 2026 20:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/voip-native-visibility-telecom-alpha.html) |
| reference | reference | generic_tech_watchlist | What&apos;s new &nbsp;\|&nbsp; Android Open Source Project | AOSP What's New / Release Notes | 검토 필요 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/whatsnew) |
| reference | reference | generic_tech_watchlist | Android Compatibility Definition Document &nbsp;\|&nbsp; Android Open Source Project | Android Compatibility Definition Document | 검토 필요 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/compatibility/cdd) |
| reference | reference | generic_tech_watchlist | Android XR Updates for Unity, Unreal, and Godot | Android Developers Blog | Tue, 19 May 2026 10:30:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-xr-updates-unity-unreal-godot.html) |
| reference | reference | generic_tech_watchlist | Building for the Intelligence System on Android | Android Developers Blog | Tue, 12 May 2026 14:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/the-android-show-developers-cut-2026.html) |
| reference | reference | generic_tech_watchlist | What's new in Android for Cars: Unifying platforms and unlocking premium experiences | Android Developers Blog | Tue, 19 May 2026 08:30:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-for-cars-unifying-platforms-premium-experiences.html) |
| reference | reference | generic_tech_watchlist | What's New in Wear OS 7 | Android Developers Blog | Tue, 19 May 2026 08:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/whats-new-wear-os-7.html) |
| reference | reference | generic_tech_watchlist | C++: The Documentary trailer | ISO C++ Blog | Thu, 14 May 2026 15:01:46 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/cpp-the-documentary-trailer) |
| reference | reference | generic_tech_watchlist | Re: [PATCH v2 1/7] media: qcom: iris: Centralize internal buffer table selection | lore.kernel.org linux-media list | 2026-05-30T23:56:31Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/178018538483.10222.11193748558944377408.b4-reply@b4/) |
| reference | reference | generic_tech_watchlist | Re: [PATCH] [TEST] add a broken patch | lore.kernel.org linux-media list | 2026-05-30T23:43:07Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/202605310729.zrGRsEVN-lkp@intel.com/) |
| reference | reference | generic_tech_watchlist | Re: [PATCH v4] media: iris: optimize COMV buffer allocation for VPU3x and VPU4x | lore.kernel.org linux-media list | 2026-05-30T16:21:53Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/9665bf18-57fd-404c-b0fa-df13f2847606@kernel.org/) |
| reference | reference | generic_tech_watchlist | Re: [PATCH 4/4] MAINTAINERS: Add entry for Rust dma-buf | lore.kernel.org linux-media list | 2026-05-30T15:20:34Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/DIW42TO5HY6H.2RLL8V8H48A5A@kernel.org/) |
| reference | reference | generic_tech_watchlist | [PATCH 4/4] MAINTAINERS: Add entry for Rust dma-buf | lore.kernel.org linux-media list | 2026-05-30T14:37:38Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/20260530143541.229628-7-phasta@kernel.org/) |
| reference | reference | generic_tech_watchlist | Let the Compiler Check Your Units -- Wu Yongwei | ISO C++ Blog | Fri, 22 May 2026 22:54:40 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/let-the-compiler-check-your-units-wu-yongwei) |
| reference | reference | cpp_ai_tooling_fallback | What reinterpret_cast doesn&apos;t do -- Andreas Fertig | ISO C++ Blog | Mon, 18 May 2026 22:46:29 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/what-reinterpret-cast-doesnt-do-andreas-fertig) |
| reference | reference | cpp_ai_tooling_fallback | Annotations for C++26 Hashing -- Krystian Piękoś | ISO C++ Blog | Fri, 29 May 2026 23:33:18 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/annotations-for-cpp26-hashing-krystian-piko) |
| reference | reference | generic_tech_watchlist | CppCon 2025 Could C++ Developers Handle an ABI Break Today? -- Luis Caro Campos | ISO C++ Blog | Mon, 25 May 2026 21:47:37 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/cppcon-2025-could-cpp-developers-handle-an-abi-break-today-luis-caro-campos) |
| reference | reference | generic_tech_watchlist | CppCon 2025 How To Build Robust C++ Inter-Process Queues -- Jody Hagins | ISO C++ Blog | Thu, 21 May 2026 21:43:57 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/cppcon-2025-how-to-build-robust-cpp-inter-process-queues-jody-hagins) |
| reference | reference | generic_tech_watchlist | Re: [PATCH v2] media: ec168: fix slab-out-of-bounds in ec168_i2c_xfer | lore.kernel.org linux-media list | 2026-05-31T01:47:15Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/CADhLXY4SKRFnkDhR31U9pU_4CQ9WC+2AOfYL1KXnLoedTDoWbA@mail.gmail.com/) |
| reference | reference | generic_tech_watchlist | Re: [PATCH v4 3/3] media: iris: Add Gen2 firmware autodetect and fallback | lore.kernel.org linux-media list | 2026-05-30T23:43:24Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/178018459824.10222.12026103622148092471.b4-reply@b4/) |
| reference | reference | generic_tech_watchlist | Re: [PATCH 4/7] drivers: staging: media: sunxi: cedrus: add H616 variant | lore.kernel.org linux-media list | 2026-05-30T16:43:18Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/CAGb2v64wDvLMFn9DYs-kH1S2PpHJat-imxR5eJSQAUYjOp=Xdg@mail.gmail.com/) |

## 원본 후보

### 1. 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 13:00:00 +0000
- Link: https://goo.gle/AdaptiveApps_IO26
- Section: Android / AOSP / Camera
- Selection: main
- Evidence level: primary
- Topic: android_platform_camera_adjacent
- Reason: Official dated release row with concrete change.
- 날짜 근거 있음: yes
- 요약: Jetpack Compose is the definitive engine for this transition, offering core tools like our latest Jetpack Navigation 3 release, new experimental Grid and FlexBox layouts, enhanced non-touch input support, and CameraX for correct camera previews across any window size.

### 2. 17 Things to know for Android developers at Google I/O

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 13:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/17-things-android-developers-google-io.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Matthew McCullough, VP, Product Management, Android Developer Today at Google I/O, we announced the many ways we’re powering agentic workflows to increase your productivity and ensure your apps shine across the expanding Android ecosystem. Here’s a recap of 17 of our favorite announcements for Android developers; you can also see what was announced last week in The Android Show: I/O Edition . Stay tuned over the next two days as we dive into all of the topics in more detail! Build High

### 3. Android UI Development is Compose First

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 09:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-ui-development-is-compose-first.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Nick Butcher, Product Manager In the almost-5-years since Jetpack Compose launched, we've invested in bringing you all the features, performance and tools that you need to build amazing UIs across the variety of Android devices.&nbsp;Compose helps you to build beautiful, adaptive UIs that meet the demands of modern UI design. Rich feature set:&nbsp; With a powerful library of layouts, input, graphics, animation APIs, and the latest Material Design components, Compose empowers you to bu

### 4. Top AI on Android updates for building intelligent experiences from Google I/O ‘26

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 26 May 2026 17:30:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-ai-intelligence-system.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Jingyu Shi, Staff Developer Relations Engineer At Google I/O 2026, we introduced Android’s shift from an operating system to an intelligence system. We also demonstrated how you can build intelligent experiences natively with the system and bring the power of Google’s AI into your apps. If you missed these updates, check out our quick recap video here:&nbsp; 1. Putting your apps at the center of the intelligence system The Android OS already enables agents like Gemini to complete task

### 5. Android CLI Now Stable 1.0: Accelerate developing for Android using any agent

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 11:45:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-cli-stable-1-0-agent-development.html
- Section: Android / AOSP / Camera
- Selection: watch
- Evidence level: watch
- Topic: cpp_ai_tooling_fallback
- Reason: Source has gap risk; keep as watch material.
- 날짜 근거 있음: yes
- 요약: Posted by Simona Milanovic and Ben Trengrove, Developer Relations Engineers As Android developers, you have many choices when it comes to the agents, tools, command-line interfaces (CLI), and LLMs you use for app development. Whether you use Gemini in Android Studio, Antigravity 2.0, Antigravity CLI, or third-party agents like Anthropic's Claude Code or OpenAI'sCodex, our mission remains the same: to ensure that high-quality Android development is possible everywhere. At Google I/O ‘26 , we shar

### 6. Android Studio I/O Edition: What’s new in Android Developer tools

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 09:30:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/whats-new-android-developer-tools.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Matthew Warner, Google Product Manager This year at Google I/O we are going beyond iterative changes, towards a fundamental shift in how apps are built. Our newest tools are built for the agentic era with features that boost productivity for you as an Android developer AND supercharge the AI agents you deploy in your codebase. So, whether you are building exclusively with AI or you prefer being the architect of every line of code, our tools will keep you ahead of the curve. As we move

### 7. How FotMob leveraged cross-device discovery to score record Wear OS adoption

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Fri, 15 May 2026 16:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/fotmob-wear-os-adoption-cross-device-discovery.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Garan Jenkin, Wear OS Developer Relations Engineer FotMob recently experienced its largest single-day increase on Wear OS among its installed audience in 5 years, at 2-3x the daily average. The secret? A simple cross-device installation flow that helps users discover their Wear OS app directly from their phone. FotMob is one of the world’s most popular football (some call it soccer!) platforms, known for its mobile app that provides real-time scores, statistical analysis, and news. Fot

### 8. Build native Android apps in Google AI Studio

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 12:45:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- Section: Android / AOSP / Camera
- Selection: short
- Evidence level: primary
- Topic: cpp_ai_tooling_fallback
- Reason: Official dated source with supporting evidence.
- 날짜 근거 있음: yes
- 요약: Posted by Emma-Louise Leavey, Group Product Manager and Mike Taylor-Cai, Product Manager Starting today Google AI Studio can build entire Android apps for you in minutes from just a prompt. You don't need to install any software or configure any libraries, which significantly lowers the barrier to development. Whether you’re a seasoned developer looking to prototype at lightning speed or a creator building your first-ever mobile experience, you can now go from a single prompt to a high-quality,

### 9. Increasing app discovery and engagement on Google TV

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 12:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/increase-google-tv-app-discovery.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Paul Lammertsma, Developer Relations Engineer With over 300 million monthly active devices across Google TV and Android TV, it’s clear that the living room is a massive, distinct platform for apps to accelerate growth. Today, we’re excited to share Google TV features and developer tools designed to increase the discoverability of your content and prepare your app for future TV experiences. Drive discovery and engagement with Gemini Last year, we brought our AI voice assistant, Gemini ,

### 10. I/O 2026: What's new in Google Play

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 08:15:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/io-2026-whats-new-in-google-play.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Paul Feng, VP, Google Play Eng, Product, UX At Google Play, we’re passionate about helping people connect with the experiences they’ll love, while empowering developers like you to turn great ideas into lasting business success. At this year’s Google I/O, we talked about our evolving business model that offers more choice and new ways for your apps and content to be discovered on and off the store. We also unveiled advanced tools and insights that will help scale your business with les

### 11. Camera &nbsp;|&nbsp; Android Open Source Project

- 출처: AOSP Camera Documentation
- 출처 URL: https://source.android.com/docs/core/camera
- 발행일: 검토 필요
- Link: https://source.android.com/docs/core/camera
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: no
- 요약: No RSS feed is configured. Use this source page as a change/release-note watch target.

### 12. Start building today - Build native Android apps in Google AI Studio

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 12:45:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today
- Section: Android / AOSP / Camera
- Selection: short
- Evidence level: primary
- Topic: android_multimedia_camera_output
- Reason: Official dated source with supporting evidence.
- 날짜 근거 있음: yes
- 요약: Hardware-enabled experiences: Because you are building native apps, you can leverage device features like the Camera, GPS/Location, Accelerometer and Bluetooth using the native Android APIs, letting you optimize hardware-level performance.

### 13. Build for the future with the Android XR Developer Catalyst Program — Apply now!

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 11:15:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/apply-android-xr-developer-catalyst.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Android XR Team The Android XR ecosystem is expanding, and we’re committed to supporting developers who will build its next great experiences. Today, we’re opening applications for the Android XR Developer Catalyst Program , a dedicated initiative to accelerate the development of Android XR apps ready to launch within the next year. This program is designed to provide the resources, hardware, and grants to help you build and scale innovative experiences across wired XR glasses , like X

### 14. Adaptive development for the expanding Android ecosystem

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 11:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-adaptive-development-ecosystem.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted Fahd Imtiaz, Senior Product Manager, Adaptive Apps With the release of Android 17, we are transitioning into an adaptive first development standard. Your users no longer rely on a single form factor; they transition between phones, foldables, tablets, laptops, automotive displays, and immersive XR environments throughout their day. Now, with over 580 million large screen devices in the hands of users, adaptive is no longer just a technical goal. It’s a massive opportunity to reach highly

### 15. Updates to the Android XR SDK: Introducing Developer Preview 4

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 10:45:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-xr-sdk-developer-preview-4-updates.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Stevan Silva, Group Product Manager and Amy Zeppenfeld, Developer Relations Engineer Today we're excited to launch Developer Preview 4 of the Android XR SDK, continuing our focus on unifying cross-device development for headsets, wired XR glasses, and intelligent eyewear . To keep our platform intuitive, we are adopting more descriptive naming for our form factors, where AI glasses are now audio glasses and display AI glasses are now display glasses, with these changes appearing in our

### 16. Introducing Android Performance Analyzer : The Next Evolution in Profiling for Android

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 10:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/introducing-android-performance-analyzer.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: By Simon Cooke, Developer Relations Engineer ( X ) and Mayank Jain, Product Manager ( X ) What is Android Performance Analyzer? Android Performance Analyzer (APA) &nbsp;is Android’s new profiler and performance analysis tool for the Android mobile ecosystem.&nbsp; APA is intended as a profiling tool for any developer building for Android who needs to make their app or game run better and faster. It is helpful for all performance-minded engineers, especially those using Vulkan in their game engin

### 17. Bring Native Visibility to Your VoIP App Experience with Telecom's Latest Alpha

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Thu, 14 May 2026 20:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/voip-native-visibility-telecom-alpha.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Nataraj KR, Android Developer Relations Engineer The initial launch of the Jetpack Telecom library introduced CallsManager , replacing the legacy ConnectionService API to simplify VoIP integration. CallsManager streamlines call lifecycle management and audio routing while enabling interactions with remote surfaces like smartwatches, Bluetooth devices, and Android Auto. Additionally, it supports call extensions for richer features—such as participant handling, custom icons, call silenci

### 18. What&apos;s new &nbsp;|&nbsp; Android Open Source Project

- 출처: AOSP What's New / Release Notes
- 출처 URL: https://source.android.com/docs/whatsnew
- 발행일: 검토 필요
- Link: https://source.android.com/docs/whatsnew
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: no
- 요약: No RSS feed is configured. Use this source page as a change/release-note watch target.

### 19. Android Compatibility Definition Document &nbsp;|&nbsp; Android Open Source Project

- 출처: Android Compatibility Definition Document
- 출처 URL: https://source.android.com/docs/compatibility/cdd
- 발행일: 검토 필요
- Link: https://source.android.com/docs/compatibility/cdd
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: no
- 요약: No RSS feed is configured. Use this source page as a change/release-note watch target.

### 20. Android XR Updates for Unity, Unreal, and Godot

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 10:30:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-xr-updates-unity-unreal-godot.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Luke Hopkins, Android Developer Relations Engineer for OpenXR & Ryan Bartley, Android XR Product Manager Today, we are excited to announce that official support for Unreal Engine and Godot has arrived for Android XR. Alongside these engine expansions, we are also launching new tools designed to boost your productivity and enable new XR capabilities: the Android XR Engine Hub and&nbsp;the Android XR Interaction Framework . Android XR Engine Hub The Android XR Engine Hub is currently ava

### 21. Building for the Intelligence System on Android

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 12 May 2026 14:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/the-android-show-developers-cut-2026.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Matthew McCullough, VP, Product Management, Android Developer Announced today during The Android Show , Android is transitioning from an operating system to an intelligence system, creating more opportunities for engagement with your apps. Through deep integration between hardware and software, Android devices will be able to handle the heavy lifting of anticipating user needs, so your app can focus on delivering that experience at the right moment. As part of this, we are announcing G

### 22. What's new in Android for Cars: Unifying platforms and unlocking premium experiences

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 08:30:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/android-for-cars-unifying-platforms-premium-experiences.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by Jan Kleinert, Developer Relations Engineer, Android for Cars, Noam Gefen, Senior Product Manager, and Thomas Weathers, Developer Relations Engineer, Android for Cars We're thrilled to see developers continuing to bring their apps and experiences to Android for Cars! Over the past year, we've continued to see strong growth and momentum in the app ecosystem on Android Auto and cars with Google built-in. This year at Google I/O, we're introducing updates that benefit both drivers and deve

### 23. What's New in Wear OS 7

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 19 May 2026 08:00:00 +0000
- Link: https://android-developers.googleblog.com/2026/05/whats-new-wear-os-7.html
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Posted by John Zoeller, Developer Relations Engineer Today, we are excited to introduce Wear OS 7, a major update that brings a new era of power efficiency and intelligence to users and developers alike. We recognize that watches are essential, all-day companions to your users. That’s why we're continuing to invest in power optimizations so your users can do more with their favorite apps. For watches upgrading from Wear OS 6 to Wear OS 7, average users can expect up to 10% improvement in battery

### 24. How ref qualifiers led to deducing this

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Fri, 29 May 2026 14:23:44 +0000
- Link: https://isocpp.org//blog/2026/05/how-ref-qualifiers-led-to-deducing-this
- Section: C++ / Native / Toolchain
- Selection: watch
- Evidence level: watch
- Topic: cpp_ai_tooling_fallback
- Reason: Source has gap risk; keep as watch material.
- 날짜 근거 있음: yes
- 요약: A follow up on last weeks post on ref qualifiers: How ref qualifiers led to deducing this by Jens Weller From the article: Last week I shared an overview on ref qualifiers with you, this is a follow up on this post. Featuring deducing this, a C++23 feature that should be available in your compiler if its been released in 2025 or later. Lets start with two more things you may want to know about ref qualifiers. First, const is also supported for the rvalue version: m::f()const && exists, though th

### 25. C++: The Documentary trailer

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Thu, 14 May 2026 15:01:46 +0000
- Link: https://isocpp.org//blog/2026/05/cpp-the-documentary-trailer
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Sponsored by HRT and produced by CultRepo , we're pleased to share the official trailer for C++: The Documentary . The trailer premieres today at 19:00 UTC. Click Notify me on the YouTube Premiere page to get a reminder when it goes live. The film will have its world premiere on May 28 at a special live event in New York City&rsquo;s Financial District, followed by a panel discussion that will be recorded for later release. C++: The Documentary will be released worldwide on YouTube on June 4, wi

### 26. Re: [PATCH v2 1/7] media: qcom: iris: Centralize internal buffer table selection

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T23:56:31Z
- Link: https://lore.kernel.org/linux-media/178018538483.10222.11193748558944377408.b4-reply@b4/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On 2026-04-23 17:30 +0530, Dikshita Agarwal wrote: > Internal buffer table dispatch is duplicated across multiple Iris code > paths, which is error‑prone and makes future changes harder to reason > about. > > Consolidate the buffer dispatch logic into a single helper so that table > selection is defined in exactly one place and keep call sites minimal. > No functional change intended. > > Signed-off-by: Dikshita Agarwal Reviewed-by: Bryan O'Donoghue --- bod

### 27. Re: [PATCH] [TEST] add a broken patch

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T23:43:07Z
- Link: https://lore.kernel.org/linux-media/202605310729.zrGRsEVN-lkp@intel.com/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Hi Mauro, kernel test robot noticed the following build errors: [auto build test ERROR on staging/staging-testing] [also build test ERROR on staging/staging-next staging/staging-linus sailus-media-tree/master sailus-media-tree/streams linus/master v7.1-rc5 next-20260529] [If your patch is applied to the wrong git tree, kindly drop us a note. And when submitting patch, we suggest to use '--base' as documented in https://git-scm.com/docs/git-format-patch#_base_tree_information ] url: https://githu

### 28. Re: [PATCH v4] media: iris: optimize COMV buffer allocation for VPU3x and VPU4x

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T16:21:53Z
- Link: https://lore.kernel.org/linux-media/9665bf18-57fd-404c-b0fa-df13f2847606@kernel.org/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On 30/05/2026 10:24, Vishnu Reddy wrote: > Hi Bryan, > > I checked that the patch is already present in linux-media/users/bodonoghue → > venus-iris-next. > It also applies cleanly on the following branches: > linux-next → master > media tree → next > linux-media/users/bodonoghue → next > linux-media/users/bodonoghue → next+fixes > linux-media/users/bodonoghue → next-smoketest > > Could you please let me know on which branch the patch is not applying > cleanly and where exactly you'd like me to r

### 29. Re: [PATCH 4/4] MAINTAINERS: Add entry for Rust dma-buf

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T15:20:34Z
- Link: https://lore.kernel.org/linux-media/DIW42TO5HY6H.2RLL8V8H48A5A@kernel.org/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On Sat May 30, 2026 at 4:35 PM CEST, Philipp Stanner wrote: > @@ -7529,6 +7530,7 @@ T: git https://gitlab.freedesktop.org/drm/misc/kernel.git > F: Documentation/driver-api/dma-buf.rst > F: Documentation/userspace-api/dma-buf-alloc-exchange.rst > F: drivers/dma-buf/ > +F: rust/kernel/dma_buf/ Please also add rust/helpers/dma_fence.c. Given that dma-buf goes through drm-misc, we should probably also add those file to the drm-rust entry.

### 30. [PATCH 4/4] MAINTAINERS: Add entry for Rust dma-buf

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T14:37:38Z
- Link: https://lore.kernel.org/linux-media/20260530143541.229628-7-phasta@kernel.org/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Rust does now have abstractions for dma_fence. These abstractions are quite complicated and require expertise with both the C and the Rust side. Therefore, using the existing entry also for maintenance of the Rust code appears reasonable. Philipp volunteers to help maintain the dma_fence abstractions. Add a corresponding MAINTAINERS entry. Signed-off-by: Philipp Stanner --- Just as a suggestion, I don't want to force myself in here. Would also be perfectly happy with other approaches; there are

### 31. Let the Compiler Check Your Units -- Wu Yongwei

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Fri, 22 May 2026 22:54:40 +0000
- Link: https://isocpp.org//blog/2026/05/let-the-compiler-check-your-units-wu-yongwei
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Mixing your units can be disastrous. Wu Yongwei takes a quick look at C++ unit libraries that can help keep everything in order. Let the Compiler Check Your Units by Wu Yongwei From the article: I recently came across a C++ standard proposal P3045 [ P3045R7 ], which aims to add physical units to C++. Curious, I looked into the existing unit libraries and went down quite a rabbit hole. Type safety and user-defined literals Before exploring these libraries, I was already somewhat familiar with the

### 32. The road to &apos;import boost&apos;: a library developer&apos;s journey into C++20 modules -- Rubén Pérez Hidalgo

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Wed, 20 May 2026 22:51:47 +0000
- Link: https://isocpp.org//blog/2026/05/the-road-to-import-boost-a-library-developers-journey-into-cpp20-modules-ru
- Section: C++ / Native / Toolchain
- Selection: watch
- Evidence level: watch
- Topic: cpp_ai_tooling_fallback
- Reason: Source has gap risk; keep as watch material.
- 날짜 근거 있음: yes
- 요약: C++20 modules have been in the standard for more than 5 years already. They promise to deliver a big change to how we write C++, but their adoption hasn't been as widespread as one would have expected. This talk is a deep dive into the practical aspects of C++20 modules, exploring the reality of the ecosystem as it is today. The road to 'import boost': a library developer's journey into C++20 modules Rub&eacute;n P&eacute;rez Hidalgo Watch now:

### 33. What reinterpret_cast doesn&apos;t do -- Andreas Fertig

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Mon, 18 May 2026 22:46:29 +0000
- Link: https://isocpp.org//blog/2026/05/what-reinterpret-cast-doesnt-do-andreas-fertig
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: cpp_ai_tooling_fallback
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: In today's post, I will explain one of C++'s biggest pitfalls:&nbsp; reinterpret_cast . Another title for this post could be:&nbsp; This is&nbsp;not&nbsp;the cast you're looking for! What reinterpret_cast doesn't do Andreas Fertig From the article: My motivation for this blog post comes from multiple training classes I thought over the past several months and a couple of talks I gave. Since C++23, you have a new facility in the Standard Library:&nbsp; std::start_lifetime_as . When teaching class

### 34. Annotations for C++26 Hashing -- Krystian Piękoś

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Fri, 29 May 2026 23:33:18 +0000
- Link: https://isocpp.org//blog/2026/05/annotations-for-cpp26-hashing-krystian-piko
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: cpp_ai_tooling_fallback
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Static reflection already makes generic hashing in C++26 far more expressive, but annotations push it into genuinely ergonomic territory. By letting types explicitly opt-in to hashing and allowing individual members or base classes to be cleanly excluded, we get a solution that is both powerful and readable. Annotations for C++26 Hashing by Krystian Piękoś From the article: In my&nbsp; recent post , I demonstrated how to use static reflection from C++26 to implement generic hash computation for

### 35. C++26: Structured Bindings in Conditions -- Sandor Dargo

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Tue, 26 May 2026 22:57:06 +0000
- Link: https://isocpp.org//blog/2026/05/cpp26-structured-bindings-in-conditions-sandor-dargo
- Section: C++ / Native / Toolchain
- Selection: watch
- Evidence level: watch
- Topic: cpp_ai_tooling_fallback
- Reason: Source has gap risk; keep as watch material.
- 날짜 근거 있음: yes
- 요약: Structured bindings in conditions may look like a small syntax sugar, but they let us write much more expressive conditional logic. By allowing decomposition and condition checking to live side by side, C++26 reduces boilerplate, improves locality, and better supports modern result types that bundle status and data together. This is a pragmatic, well-integrated evolution of a feature that has already proven its value since C++17. C++26: Structured Bindings in Conditions by Sandor Dargo From the

### 36. CppCon 2025 Could C++ Developers Handle an ABI Break Today? -- Luis Caro Campos

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Mon, 25 May 2026 21:47:37 +0000
- Link: https://isocpp.org//blog/2026/05/cppcon-2025-could-cpp-developers-handle-an-abi-break-today-luis-caro-campos
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Registration is now open for CppCon 2026!&nbsp;The conference starts on September 12 and will be held&nbsp; in person in Aurora, CO . To whet your appetite for this year&rsquo;s conference, we&rsquo;re posting videos of some of the top-rated talks from last year's conference. Here&rsquo;s another CppCon talk video we hope you will enjoy &ndash; and why not&nbsp; register today &nbsp;for CppCon 2026! Could C++ Developers Handle an ABI Break Today? by Luis Caro Campos Summary of the talk: The C++

### 37. CppCon 2025 How To Build Robust C++ Inter-Process Queues -- Jody Hagins

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Thu, 21 May 2026 21:43:57 +0000
- Link: https://isocpp.org//blog/2026/05/cppcon-2025-how-to-build-robust-cpp-inter-process-queues-jody-hagins
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Registration is now open for CppCon 2026!&nbsp;The conference starts on September 12 and will be held&nbsp; in person in Aurora, CO . To whet your appetite for this year&rsquo;s conference, we&rsquo;re posting videos of some of the top-rated talks from last year's conference. Here&rsquo;s another CppCon talk video we hope you will enjoy &ndash; and why not&nbsp; register today &nbsp;for CppCon 2026! How To Build Robust C++ Inter-Process Queues by Jody Hagins Summary of the talk: This talk will o

### 38. Re: [PATCH v2] media: ec168: fix slab-out-of-bounds in ec168_i2c_xfer

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-31T01:47:15Z
- Link: https://lore.kernel.org/linux-media/CADhLXY4SKRFnkDhR31U9pU_4CQ9WC+2AOfYL1KXnLoedTDoWbA@mail.gmail.com/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On Tue, Mar 24, 2026 at 7:25 AM Deepanshu Kartikey wrote: > > The WRITE_DEMOD path in ec168_i2c_xfer() checks msg[i].len before accessing the buffer, but then reads both buf[0] (register) > and buf[1] (value). If userspace supplies a 1-byte I2C message, > the read of buf[1] goes out of bounds, triggering a KASAN > slab-out-of-bounds error. > > Fix by checking msg[i].len buffer is too short to contain both register and value bytes. > > Fixes: a6dcefcc08ec ("media: dvb-usb-v2: ec168: fix null-ptr-

### 39. Re: [PATCH v4 3/3] media: iris: Add Gen2 firmware autodetect and fallback

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T23:43:24Z
- Link: https://lore.kernel.org/linux-media/178018459824.10222.12026103622148092471.b4-reply@b4/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On 2026-04-29 17:39 +0530, Dikshita Agarwal wrote: > Some Iris platforms support both Gen1 and Gen2 HFI firmware images. > Update the firmware loading logic to handle this generically by > preferring Gen2 when available, while safely falling back to Gen1 > when required. > > The firmware loading logic is updated with the following priority: > 1. Device Tree (`firmware-name`): If specified, load unconditionally. > 2. Gen2 default : If no DT override exists, select the Gen2 firmware > descriptor w

### 40. Re: [PATCH 4/7] drivers: staging: media: sunxi: cedrus: add H616 variant

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-05-30T16:43:18Z
- Link: https://lore.kernel.org/linux-media/CAGb2v64wDvLMFn9DYs-kH1S2PpHJat-imxR5eJSQAUYjOp=Xdg@mail.gmail.com/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On Tue, May 5, 2026 at 7:18 PM Jernej Škrabec wrote: > > Dne torek, 5. maj 2026 ob 15:48:08 Srednjeevropski poletni čas je Chen-Yu Tsai napisal(a): > > The Allwinner H616 SoC has a video engine hardware block like the one > > found on previous generations such as the H6. In addition to the > > currently supported features of the H6, it is also supposed to include > > Remove "supposed". I can't actually verify that, so "supposed" is accurate from my point of view. ChenYu > > a VP9 decoder. Howeve

## Collector 실패

- LLVM Project Blog: 404 Not Found
- OpenAI News: 403 Forbidden
- 요즘IT: 403 Forbidden

## 편집장 체크리스트

- [ ] High-priority official source를 먼저 검토했다.
- [ ] Candidate-only source는 가능하면 official documentation 또는 blog로 교차 확인했다.
- [ ] 각 final section이 source name과 source URL을 보존한다.
- [ ] Final Markdown/HTML에 출처와 참고자료가 포함되어 있다.
- [ ] Camera HAL relevance가 capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, implementation impact와 연결된다.
