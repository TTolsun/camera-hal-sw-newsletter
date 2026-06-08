# 뉴스 후보 - 2026-06-08

이 파일은 구조화된 newsletter source registry에서 생성됩니다. Gemini는 candidate JSON과 source metadata만 입력으로 사용하며 웹을 직접 browse하지 않습니다.

- Lookback: 90일
- 후보 수: 40
- Source registry: data/news-sources.json
- Candidate-only media/community source는 final article selection 전에 official-source verification이 필요합니다.
- 날짜가 있는 release/API/behavior evidence가 없는 static HTML page는 main article candidate가 아니라 watchlist/reference material입니다.

## Gemini Newsroom 입력 요약

```text
뉴스레터 날짜: 2026-06-08
대상 독자: AOSP Camera / Camera Driver / SoC Platform / C++ engineer
Inputs: content/collected-news/YYYY-MM-DD/manual-candidates.json, content/collected-news/YYYY-MM-DD/candidates.json, data/news-sources.json, docs/news-sources.md
Outputs: reporter-candidates.json, editor-draft.json, fact-check-report.json, newsletter.md, index.html, editor-in-chief-brief.md, release-qa-report.md
```

## Main 후보

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| main | primary | direct_aosp_camera | Supercharge your media pipeline with a complete, production-ready toolkit - Building Premium Android Experiences at Google I/O ‘26 | Android Developers Blog | Tue, 02 Jun 2026 17:00:00 +0000 | Official dated release row with concrete change. | [link](https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY) |
| main | primary | android_platform_camera_adjacent | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | Android Developers Blog | Tue, 19 May 2026 13:00:00 +0000 | Official dated release row with concrete change. | [link](https://goo.gle/AdaptiveApps_IO26) |
| main | primary | direct_aosp_camera | CameraX Release Notes - CameraX 1.6.0 | CameraX Release Notes | March 25, 2026 | Official dated release row with concrete change. | [link](https://developer.android.com/jetpack/androidx/releases/camera#1.6.0) |
| main | primary | direct_aosp_camera | CameraX Release Notes - CameraX 1.7.0-alpha01 | CameraX Release Notes | March 11, 2026 | Official dated release row with concrete change. | [link](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha01) |
| main | primary | direct_aosp_camera | Test camera images using automation | AOSP Site Updates | 2026-05-01 | Official dated release row with concrete change. | [link](https://source.android.com/docs/compatibility/cts/camera-its-box) |

## Short 후보

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| short | primary | direct_aosp_camera | CameraX Release Notes - CameraX 1.6.1 | Android Developers Latest Updates | May 06, 2026 | Official dated source with supporting evidence. | [link](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1) |
| short | primary | direct_aosp_camera | Compatibility | AOSP Site Updates | 2026-03-01 | Official dated source with supporting evidence. | [link](https://source.android.com/docs/compatibility) |
| short | primary | cpp_ai_tooling_fallback | GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | ISO C++ Blog | Thu, 30 Apr 2026 22:36:23 +0000 | Official dated source with supporting evidence. | [link](https://isocpp.org//blog/2026/04/gcc-16.1) |
| short | primary | cpp_ai_tooling_fallback | Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | ISO C++ Blog | Tue, 28 Apr 2026 22:25:57 +0000 | Official dated source with supporting evidence. | [link](https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more) |

## Watchlist

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| watch | watch | cpp_ai_tooling_fallback | Android CLI Now Stable 1.0: Accelerate developing for Android using any agent | Android Developers Blog | Tue, 19 May 2026 11:45:00 +0000 | Source has gap risk; keep as watch material. | [link](https://android-developers.googleblog.com/2026/05/android-cli-stable-1-0-agent-development.html) |
| watch | watch | generic_tech_watchlist | June | Android Security Bulletin | 2026-06-01 | Generic tech item without article-level camera/driver/SoC/native-tooling evidence. | [link](https://source.android.com/docs/security/bulletin/2026/2026-06-01) |
| watch | watch | generic_tech_watchlist | May | Android Security Bulletin | 2026-05-01 | Generic tech item without article-level camera/driver/SoC/native-tooling evidence. | [link](https://source.android.com/docs/security/bulletin/2026/2026-05-01) |
| watch | watch | generic_tech_watchlist | April | Android Security Bulletin | 2026-04-01 | Generic tech item without article-level camera/driver/SoC/native-tooling evidence. | [link](https://source.android.com/docs/security/bulletin/2026/2026-04-01) |
| watch | watch | cpp_ai_tooling_fallback | C++26: A User-Friendly assert() macro -- Sandor Dargo | ISO C++ Blog | Mon, 04 May 2026 22:31:55 +0000 | Source has gap risk; keep as watch material. | [link](https://isocpp.org//blog/2026/05/cpp26-a-user-friendly-assert-macro-sandor-dargo) |
| watch | watch | camera_driver_image_pipeline | Re: [PATCH v5 08/10] media: v4l2-subdev: Move subdev client capabilities into a new struct | lore.kernel.org linux-media list | 2026-06-08T09:34:40Z | Mailing-list/community lead requires primary confirmation. | [link](https://lore.kernel.org/linux-media/20260608093436.GD772117@killaraus.ideasonboard.com/) |
| watch | watch | camera_driver_image_pipeline | Re: [PATCH] media: atomisp: Fix resource leak in atomisp_pci_probe() | lore.kernel.org linux-media list | 2026-06-08T08:57:10Z | Mailing-list/community lead requires primary confirmation. | [link](https://lore.kernel.org/linux-media/20260608085710.04EB81F00893@smtp.kernel.org/) |
| watch | watch | cpp_ai_tooling_fallback | How ref qualifiers led to deducing this | ISO C++ Blog | Fri, 29 May 2026 14:23:44 +0000 | Source has gap risk; keep as watch material. | [link](https://isocpp.org//blog/2026/05/how-ref-qualifiers-led-to-deducing-this) |
| watch | watch | camera_driver_image_pipeline | Re: [PATCH v7 5/8] media: qcom: camss: csiphy-3ph: Add Gen2 v1.1 MIPI CSI-2 C-PHY init | lore.kernel.org linux-media list | 2026-06-08T10:38:13Z | Mailing-list/community lead requires primary confirmation. | [link](https://lore.kernel.org/linux-media/c69d7795-36dd-46d5-a7cc-97ef4fcb09ea@ixit.cz/) |
| watch | watch | camera_driver_image_pipeline | Re: [PATCH v5 10/10] media: v4l2-subdev: Add struct v4l2_subdev_client_info pointer to pad ops | lore.kernel.org linux-media list | 2026-06-08T10:16:57Z | Mailing-list/community lead requires primary confirmation. | [link](https://lore.kernel.org/linux-media/20260608101652.GE772117@killaraus.ideasonboard.com/) |
| watch | watch | camera_driver_image_pipeline | Re: [PATCH v5 07/10] media: Improve enable_streams and disable_streams documentation | lore.kernel.org linux-media list | 2026-06-08T09:29:20Z | Mailing-list/community lead requires primary confirmation. | [link](https://lore.kernel.org/linux-media/20260608092916.GC772117@killaraus.ideasonboard.com/) |
| watch | watch | generic_tech_watchlist | Media3 Release Notes - Media3 1.9.4 | Media3 Release Notes | May 16, 2026 | Generic tech item without article-level camera/driver/SoC/native-tooling evidence. | [link](https://developer.android.com/jetpack/androidx/releases/media3#1.9.4) |

## Reference / snapshot 페이지

| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |
|---|---|---|---|---|---|---|---|
| reference | reference | generic_tech_watchlist | 17 Things to know for Android developers at Google I/O | Android Developers Blog | Tue, 19 May 2026 13:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/17-things-android-developers-google-io.html) |
| reference | reference | generic_tech_watchlist | Android UI Development is Compose First | Android Developers Blog | Tue, 19 May 2026 09:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-ui-development-is-compose-first.html) |
| reference | reference | generic_tech_watchlist | Top AI on Android updates for building intelligent experiences from Google I/O ‘26 | Android Developers Blog | Tue, 26 May 2026 17:30:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/android-ai-intelligence-system.html) |
| reference | reference | generic_tech_watchlist | Android Studio I/O Edition: What’s new in Android Developer tools | Android Developers Blog | Tue, 19 May 2026 09:30:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/whats-new-android-developer-tools.html) |
| reference | reference | generic_tech_watchlist | How FotMob leveraged cross-device discovery to score record Wear OS adoption | Android Developers Blog | Fri, 15 May 2026 16:00:00 +0000 | Background reference page; not an article candidate. | [link](https://android-developers.googleblog.com/2026/05/fotmob-wear-os-adoption-cross-device-discovery.html) |
| reference | reference | generic_tech_watchlist | Camera &nbsp;\|&nbsp; Android Open Source Project | AOSP Camera Documentation | 검토 필요 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/core/camera) |
| reference | reference | direct_aosp_camera | 1.4.0-alpha07 | Android Developers Latest Updates | May 06, 2026 | Background reference page; not an article candidate. | [link](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07) |
| reference | reference | generic_tech_watchlist | What&apos;s new &nbsp;\|&nbsp; Android Open Source Project | AOSP What's New / Release Notes | 검토 필요 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/whatsnew) |
| reference | reference | generic_tech_watchlist | Android Compatibility Definition Document &nbsp;\|&nbsp; Android Open Source Project | Android Compatibility Definition Document | 검토 필요 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/compatibility/cdd) |
| reference | reference | generic_tech_watchlist | Overview | Android Security Bulletin | 2026-06-01 | Background reference page; not an article candidate. | [link](https://source.android.com/docs/security/bulletin/asb-overview) |
| reference | reference | generic_tech_watchlist | Re: [PATCH v7 0/8] media: camss: Add support for C-PHY configuration on Qualcomm platforms | lore.kernel.org linux-media list | 2026-06-08T08:56:29Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/1715df23-044a-4ebe-bf24-e0299b32e4ae@kernel.org/) |
| reference | reference | generic_tech_watchlist | 2026 Annual C++ Developer Survey "Lite" | ISO C++ Blog | Wed, 22 Apr 2026 00:59:01 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/04/2026-annual-cpp-developer-survey-lite1) |
| reference | reference | cpp_ai_tooling_fallback | Power of C++26 Reflection: Strong (opaque) type definitions -- r/cpp | ISO C++ Blog | Thu, 09 Apr 2026 21:36:20 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/04/power-of-cpp26-reflection-strong-opaque-type-definitions-r-cpp) |
| reference | reference | camera_driver_image_pipeline | Re: [PATCH] ACPI: scan: Honor _DEP for Intel CVS devices | lore.kernel.org linux-media list | 2026-06-08T12:21:41Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/CAJZ5v0h-wOi7atHzTpFmCgC-P3qRzG9d-941MCzXd=kzTbkQeg@mail.gmail.com/) |
| reference | reference | camera_driver_image_pipeline | The libcamera-devel Archives | libcamera Release Announcements | 검토 필요 | Background reference page; not an article candidate. | [link](https://lists.libcamera.org/pipermail/libcamera-devel/) |
| reference | reference | generic_tech_watchlist | C++: The Documentary trailer | ISO C++ Blog | Thu, 14 May 2026 15:01:46 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/05/cpp-the-documentary-trailer) |
| reference | reference | generic_tech_watchlist | CppCon 2025 Can Standard C++ Replace CUDA for GPU Acceleration? -- Elmar Westphal | ISO C++ Blog | Thu, 23 Apr 2026 21:23:33 +0000 | Background reference page; not an article candidate. | [link](https://isocpp.org//blog/2026/04/cppcon-2025-can-standard-cpp-replace-cuda-for-gpu-acceleration-elmar-westph) |
| reference | reference | generic_tech_watchlist | Re: [PATCH v5 06/10] media: imx219: Fix vertical blanking and exposure for analogue binning | lore.kernel.org linux-media list | 2026-06-08T11:19:47Z | Background reference page; not an article candidate. | [link](https://lore.kernel.org/linux-media/178091757893.16054.4583389270412251379@freya/) |
| reference | reference | generic_tech_watchlist | Media3 Release Notes - Media3 1.10.1 | Media3 Release Notes | May 12, 2026 | Background reference page; not an article candidate. | [link](https://developer.android.com/jetpack/androidx/releases/media3#1.10.1) |

## 원본 후보

### 1. Supercharge your media pipeline with a complete, production-ready toolkit - Building Premium Android Experiences at Google I/O ‘26

- 출처: Android Developers Blog
- 출처 URL: https://android-developers.googleblog.com/
- 발행일: Tue, 02 Jun 2026 17:00:00 +0000
- Link: https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY
- Section: Android / AOSP / Camera
- Selection: main
- Evidence level: primary
- Topic: direct_aosp_camera
- Reason: Official dated release row with concrete change.
- 날짜 근거 있음: yes
- 요약: By leveraging Jetpack CameraX and Media3, you can build professional-grade experiences that feel native across the entire ecosystem.&nbsp; It starts with high-fidelity capture using the CameraXViewfinder Composable, which ensures your preview remains perfectly scaled and responsive on any form factor, including foldables and tablets.

### 2. 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O

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

### 3. CameraX Release Notes - CameraX 1.6.0

- 출처: CameraX Release Notes
- 출처 URL: https://developer.android.com/jetpack/androidx/releases/camera
- 발행일: March 25, 2026
- Link: https://developer.android.com/jetpack/androidx/releases/camera#1.6.0
- Section: Android / AOSP / Camera
- Selection: main
- Evidence level: primary
- Topic: direct_aosp_camera
- Reason: Official dated release row with concrete change.
- 날짜 근거 있음: yes
- 요약: CameraX now uses API is introduced, allowing developers to query whether a specific combination of use cases and features (such as HDR, stabilization, specific resolutions, CameraX Extensions or slow motion) is supported by the device before binding to the lifecycle.

### 4. CameraX Release Notes - CameraX 1.7.0-alpha01

- 출처: CameraX Release Notes
- 출처 URL: https://developer.android.com/jetpack/androidx/releases/camera
- 발행일: March 11, 2026
- Link: https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha01
- Section: Android / AOSP / Camera
- Selection: main
- Evidence level: primary
- Topic: direct_aosp_camera
- Reason: Official dated release row with concrete change.
- 날짜 근거 있음: yes
- 요약: Exposed the CameraController.setSessionConfig() API. This allows providing a custom SessionConfig for advanced UseCase configurations not directly exposed by CameraController . When a SessionConfig is active, other configuration methods on CameraController are disabled.( I35cf1 , b/448525636 )

### 5. Test camera images using automation

- 출처: AOSP Site Updates
- 출처 URL: https://source.android.com/docs/whatsnew/site-updates
- 발행일: 2026-05-01
- Link: https://source.android.com/docs/compatibility/cts/camera-its-box
- Section: Android / AOSP / Camera
- Selection: main
- Evidence level: primary
- Topic: direct_aosp_camera
- Reason: Official dated release row with concrete change.
- 날짜 근거 있음: yes
- 요약: May 2026 Test camera images using automation Updated Test camera images using automation to add Honor Pad 20 to the tablet allowlist, and to reorder and update instructions for running individual ITS scenes.

### 6. 17 Things to know for Android developers at Google I/O

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

### 7. Android UI Development is Compose First

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

### 8. Top AI on Android updates for building intelligent experiences from Google I/O ‘26

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

### 9. Android CLI Now Stable 1.0: Accelerate developing for Android using any agent

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

### 10. Android Studio I/O Edition: What’s new in Android Developer tools

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

### 11. How FotMob leveraged cross-device discovery to score record Wear OS adoption

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

### 12. CameraX Release Notes - CameraX 1.6.1

- 출처: Android Developers Latest Updates
- 출처 URL: https://developer.android.com/latest-updates
- 발행일: May 06, 2026
- Link: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1
- Section: Android / AOSP / Camera
- Selection: short
- Evidence level: primary
- Topic: direct_aosp_camera
- Reason: Official dated source with supporting evidence.
- 날짜 근거 있음: yes
- 요약: Fixed a compilation error "Cannot access class ListenableFuture " when using CameraX 1.6.0. ( Ic8cba , b/497571473 )

### 13. Compatibility

- 출처: AOSP Site Updates
- 출처 URL: https://source.android.com/docs/whatsnew/site-updates
- 발행일: 2026-03-01
- Link: https://source.android.com/docs/compatibility
- Section: Android / AOSP / Camera
- Selection: short
- Evidence level: primary
- Topic: direct_aosp_camera
- Reason: Official dated source with supporting evidence.
- 날짜 근거 있음: yes
- 요약: March 2026 Compatibility Compatibility Updated Buy and set up a Gen2 box with a revised chart and an updated manufacturing vendor contact number.

### 14. Camera &nbsp;|&nbsp; Android Open Source Project

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

### 15. 1.4.0-alpha07

- 출처: Android Developers Latest Updates
- 출처 URL: https://developer.android.com/latest-updates
- 발행일: May 06, 2026
- Link: https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: direct_aosp_camera
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: no
- 요약: 요약 없음

### 16. What&apos;s new &nbsp;|&nbsp; Android Open Source Project

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

### 17. Android Compatibility Definition Document &nbsp;|&nbsp; Android Open Source Project

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

### 18. Overview

- 출처: Android Security Bulletin
- 출처 URL: https://source.android.com/docs/security/bulletin
- 발행일: 2026-06-01
- Link: https://source.android.com/docs/security/bulletin/asb-overview
- Section: Android / AOSP / Camera
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: ss="devsite-expandable-nav"> Android Security Bulletins Bulletins home Overview 2026 bulletins June May <li class="devsite-nav-i

### 19. June

- 출처: Android Security Bulletin
- 출처 URL: https://source.android.com/docs/security/bulletin
- 발행일: 2026-06-01
- Link: https://source.android.com/docs/security/bulletin/2026/2026-06-01
- Section: Android / AOSP / Camera
- Selection: watch
- Evidence level: watch
- Topic: generic_tech_watchlist
- Reason: Generic tech item without article-level camera/driver/SoC/native-tooling evidence.
- 날짜 근거 있음: no
- 요약: vsite-nav-title" > Overview 2026 bulletins June May April March February January <

### 20. May

- 출처: Android Security Bulletin
- 출처 URL: https://source.android.com/docs/security/bulletin
- 발행일: 2026-05-01
- Link: https://source.android.com/docs/security/bulletin/2026/2026-05-01
- Section: Android / AOSP / Camera
- Selection: watch
- Evidence level: watch
- Topic: generic_tech_watchlist
- Reason: Generic tech item without article-level camera/driver/SoC/native-tooling evidence.
- 날짜 근거 있음: no
- 요약: ex="0" role="button"> 2026 bulletins June May April March February January <a class="devsite-nav-toggle" aria-hidden="true"

### 21. April

- 출처: Android Security Bulletin
- 출처 URL: https://source.android.com/docs/security/bulletin
- 발행일: 2026-04-01
- Link: https://source.android.com/docs/security/bulletin/2026/2026-04-01
- Section: Android / AOSP / Camera
- Selection: watch
- Evidence level: watch
- Topic: generic_tech_watchlist
- Reason: Generic tech item without article-level camera/driver/SoC/native-tooling evidence.
- 날짜 근거 있음: no
- 요약: ite-nav-new"> June May April March February January 2025 bulletins <ul class

### 22. Re: [PATCH v7 0/8] media: camss: Add support for C-PHY configuration on Qualcomm platforms

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T08:56:29Z
- Link: https://lore.kernel.org/linux-media/1715df23-044a-4ebe-bf24-e0299b32e4ae@kernel.org/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On 05/06/2026 14:14, David Heidelberg via B4 Relay wrote: > Note: WIP tag added, as not everything from the previous review round has > been addressed. > > # Short summary > > This patch series extends the Qualcomm CAMSS (Camera Subsystem), > including CSID and CSIPHY components, to support C-PHY mode configuration. > > # Background and motivation > > Modern smartphone cameras increasingly rely on MIPI C-PHY rather than > D-PHY, thanks to its higher data throughput and signal efficiency. > As a

### 23. C++26: A User-Friendly assert() macro -- Sandor Dargo

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Mon, 04 May 2026 22:31:55 +0000
- Link: https://isocpp.org//blog/2026/05/cpp26-a-user-friendly-assert-macro-sandor-dargo
- Section: C++ / Native / Toolchain
- Selection: watch
- Evidence level: watch
- Topic: cpp_ai_tooling_fallback
- Reason: Source has gap risk; keep as watch material.
- 날짜 근거 있음: yes
- 요약: C++26 is bringing some long-overdue changes to&nbsp; assert() . But why are those changes needed? And when do we actually use&nbsp; assert , anyway? At its core,&nbsp; assert() &nbsp;exists to validate runtime conditions. If the given expression evaluates to&nbsp; false , the program aborts. I&rsquo;m almost certain you&rsquo;ve used it before &mdash; at work, in personal projects, or at the very least in examples and code snippets. So what&rsquo;s the problem? C++26: A User-Friendly assert() ma

### 24. 2026 Annual C++ Developer Survey "Lite"

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Wed, 22 Apr 2026 00:59:01 +0000
- Link: https://isocpp.org//blog/2026/04/2026-annual-cpp-developer-survey-lite1
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: The annual global C++ developer survey is now open: 2026 Annual C++ Developer Survey "Lite" Please share your feedback in this annual 10-minute survey to help inform C++ standardization and C++ tool vendors. This is the biggest opportunity we all have each year to make our voices heard and help improve our industry and community! A summary of the results, including aggregated highlights of common answers in the write-in responses, will be posted publicly here on isocpp.org and shared with the C+

### 25. Power of C++26 Reflection: Strong (opaque) type definitions -- r/cpp

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Thu, 09 Apr 2026 21:36:20 +0000
- Link: https://isocpp.org//blog/2026/04/power-of-cpp26-reflection-strong-opaque-type-definitions-r-cpp
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: cpp_ai_tooling_fallback
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Inspired by a similar previous thread showcasing cool uses for C++26 reflection. Power of C++26 Reflection: Strong (opaque) type definitions&nbsp; From the article: With reflection, you can easily create "opaque" type definitions, i.e "strong types". It works by having an inner value stored, and wrapping over all public member functions. Note: I am using queue_injection { ... } with the EDG experimental reflection, which afaik wasn't actually integrated into the C++26 standard, but without it yo

### 26. Re: [PATCH] ACPI: scan: Honor _DEP for Intel CVS devices

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T12:21:41Z
- Link: https://lore.kernel.org/linux-media/CAJZ5v0h-wOi7atHzTpFmCgC-P3qRzG9d-941MCzXd=kzTbkQeg@mail.gmail.com/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: camera_driver_image_pipeline
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: On Wed, Jun 3, 2026 at 9:43 AM Sakari Ailus wrote: > > Hi Miguel, Rafael, > > Thanks for the patch. > > On Mon, Jun 01, 2026 at 12:40:40PM -0700, Miguel Vadillo wrote: > > CVS (Computer Vision Sensing) is an ACPI-enumerated device that sits > > inline in the CSI-2 path between the camera sensor and Intel IPU. > > On platforms where CVS is present, the camera sensor's ACPI node > > declares a _DEP dependency on the CVS device. > > > > The CVS driver must be fully initialized before camera sensor

### 27. Re: [PATCH v5 08/10] media: v4l2-subdev: Move subdev client capabilities into a new struct

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T09:34:40Z
- Link: https://lore.kernel.org/linux-media/20260608093436.GD772117@killaraus.ideasonboard.com/
- Section: Linux Camera / Driver
- Selection: watch
- Evidence level: watch
- Topic: camera_driver_image_pipeline
- Reason: Mailing-list/community lead requires primary confirmation.
- 날짜 근거 있음: yes
- 요약: Hi Sakari, Thank you for the patch. On Mon, Jun 08, 2026 at 12:53:54AM +0300, Sakari Ailus wrote: > Add struct v4l2_subdev_client_info to hold sub-device client capability > bits that used to be stored in the client_caps field of struct > v4l2_subdev_fh. The intent is to enable passing this struct to sub-device > pad operation callbacks for capability information. The main reason why > this is a new struct instead of a u64 field is that modifying the callback > arguments requires touching almost

### 28. Re: [PATCH] media: atomisp: Fix resource leak in atomisp_pci_probe()

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T08:57:10Z
- Link: https://lore.kernel.org/linux-media/20260608085710.04EB81F00893@smtp.kernel.org/
- Section: Linux Camera / Driver
- Selection: watch
- Evidence level: watch
- Topic: camera_driver_image_pipeline
- Reason: Mailing-list/community lead requires primary confirmation.
- 날짜 근거 있음: yes
- 요약: Thank you for your contribution! Sashiko AI review found 1 potential issue(s) to consider: Pre-existing issues: - [High] The v4l2 async notifier is never unregistered or cleaned up, leading to a memory leak of async subdevice connection objects and dangling notifiers resulting in a Use-After-Free. -- commit b7444e6b542badbafff9a7d15d5037c35782ba7c Author: Dawei Feng media: atomisp: Fix resource leak in atomisp_pci_probe() This commit fixes a resource leak by unregistering subdev entities if atom

### 29. The libcamera-devel Archives

- 출처: libcamera Release Announcements
- 출처 URL: https://lists.libcamera.org/pipermail/libcamera-devel/
- 발행일: 검토 필요
- Link: https://lists.libcamera.org/pipermail/libcamera-devel/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: camera_driver_image_pipeline
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: no
- 요약: No RSS feed is configured. Use this source page as a change/release-note watch target.

### 30. How ref qualifiers led to deducing this

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

### 31. C++: The Documentary trailer

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

### 32. GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Thu, 30 Apr 2026 22:36:23 +0000
- Link: https://isocpp.org//blog/2026/04/gcc-16.1
- Section: C++ / Native / Toolchain
- Selection: short
- Evidence level: primary
- Topic: cpp_ai_tooling_fallback
- Reason: Official dated source with supporting evidence.
- 날짜 근거 있음: yes
- 요약: GCC 16.1 has been released! Lots of good C++26 material including reflection and contracts. GCC 16 Release Series: Changes, New Features, and Fixes From the announcement: C++20 by default: [...]&nbsp; N.B. C++20 modules support is still experimental and must be enabled by&nbsp; -fmodules . Several C++26 features have been implemented: P2996R13 , Reflection ( PR120775 , enabled by&nbsp; -std=c++26 -freflection ) P3394R4 , Annotations for Reflection P3293R3 , Splicing a base class subobject P3096R

### 33. CppCon 2025 Can Standard C++ Replace CUDA for GPU Acceleration? -- Elmar Westphal

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Thu, 23 Apr 2026 21:23:33 +0000
- Link: https://isocpp.org//blog/2026/04/cppcon-2025-can-standard-cpp-replace-cuda-for-gpu-acceleration-elmar-westph
- Section: C++ / Native / Toolchain
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Registration is now open for CppCon 2026!&nbsp;The conference starts on September 12 and will be held&nbsp; in person in Aurora, CO . To whet your appetite for this year&rsquo;s conference, we&rsquo;re posting videos of some of the top-rated talks from last year's conference. Here&rsquo;s another CppCon talk video we hope you will enjoy &ndash; and why not&nbsp; register today &nbsp;for CppCon 2026! Can Standard C++ Replace CUDA for GPU Acceleration? by Elmar Westphal Summary of the talk: On top

### 34. Re: [PATCH v7 5/8] media: qcom: camss: csiphy-3ph: Add Gen2 v1.1 MIPI CSI-2 C-PHY init

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T10:38:13Z
- Link: https://lore.kernel.org/linux-media/c69d7795-36dd-46d5-a7cc-97ef4fcb09ea@ixit.cz/
- Section: Linux Camera / Driver
- Selection: watch
- Evidence level: watch
- Topic: camera_driver_image_pipeline
- Reason: Mailing-list/community lead requires primary confirmation.
- 날짜 근거 있음: yes
- 요약: On 08/06/2026 11:00, Bryan O'Donoghue wrote: > On 05/06/2026 14:14, David Heidelberg via B4 Relay wrote: >> case CAMSS_845: >> if (c->phy_cfg == V4L2_MBUS_CSI2_CPHY) { >> - regs->lane_regs = NULL; >> - regs->lane_array_size = 0; >> + regs->lane_regs = &lane_regs_sdm845_3ph[0]; >> + regs->lane_array_size = ARRAY_SIZE(lane_regs_sdm845_3ph); >> } else { >> regs->lane_regs = &lane_regs_sdm845[0]; >> regs->lane_array_size = ARRAY_SIZE(lane_regs_sdm845); >> } > > The nittiest nit pick I can make sorry

### 35. Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack, TOML and more

- 출처: ISO C++ Blog
- 출처 URL: https://isocpp.org/blog
- 발행일: Tue, 28 Apr 2026 22:25:57 +0000
- Link: https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more
- Section: C++ / Native / Toolchain
- Selection: short
- Evidence level: primary
- Topic: cpp_ai_tooling_fallback
- Reason: Official dated source with supporting evidence.
- 날짜 근거 있음: yes
- 요약: Glaze is a high-performance C++23 serialization library with compile-time reflection. It has grown to support many more formats and features, and in v7.2.0 C++26 Reflection support has been merged! Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more From the article: Glaze now supports C++26 reflection with experimental GCC and Clang compilers. GCC 16 will soon be released with this support. When enabled, Glaze replaces the traditional&nbsp; __PRETTY_FUNCTION__ &nbsp;parsing an

### 36. Re: [PATCH v5 06/10] media: imx219: Fix vertical blanking and exposure for analogue binning

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T11:19:47Z
- Link: https://lore.kernel.org/linux-media/178091757893.16054.4583389270412251379@freya/
- Section: Linux Camera / Driver
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: Quoting Jai Luthra (2026-06-08 16:01:06) > Hi Jacopo, Sakari, > ++ Dave, Hans and Laurent, > > Quoting Jacopo Mondi (2026-06-08 12:28:46) > > Hi Sakari > > > > On Mon, Jun 08, 2026 at 12:53:52AM +0300, Sakari Ailus wrote: > > > When vertical analogue binning is in use, the minimum frame length in > > > lines decreases to around half of the normal. In relation to the sensor's > > > output size this means vertical blanking can be negative but that's not an > > > issue as control values are signed.

### 37. Re: [PATCH v5 10/10] media: v4l2-subdev: Add struct v4l2_subdev_client_info pointer to pad ops

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T10:16:57Z
- Link: https://lore.kernel.org/linux-media/20260608101652.GE772117@killaraus.ideasonboard.com/
- Section: Linux Camera / Driver
- Selection: watch
- Evidence level: watch
- Topic: camera_driver_image_pipeline
- Reason: Mailing-list/community lead requires primary confirmation.
- 날짜 근거 있음: yes
- 요약: Hi Sakari, Thank you for the patch. CC'ing Bryan, Vladimir and Loic for the camss driver (please see below for a dedicated comment). On Mon, Jun 08, 2026 at 12:53:56AM +0300, Sakari Ailus wrote: > Add a pointer to const struct v4l2_subdev_client_info to the set_fmt, > get_selection and set_selection sub-device pad ops. The client info struct > will soon be used to differentiate UAPI based on client capabilities. > > Signed-off-by: Sakari Ailus > --- > drivers/media/i2c/adv7170.c \| 1 + [snip] > i

### 38. Re: [PATCH v5 07/10] media: Improve enable_streams and disable_streams documentation

- 출처: lore.kernel.org linux-media list
- 출처 URL: https://lore.kernel.org/linux-media/
- 발행일: 2026-06-08T09:29:20Z
- Link: https://lore.kernel.org/linux-media/20260608092916.GC772117@killaraus.ideasonboard.com/
- Section: Linux Camera / Driver
- Selection: watch
- Evidence level: watch
- Topic: camera_driver_image_pipeline
- Reason: Mailing-list/community lead requires primary confirmation.
- 날짜 근거 있음: yes
- 요약: Hi Sakari, Thank you for the patch. On Mon, Jun 08, 2026 at 12:53:53AM +0300, Sakari Ailus wrote: > Document that enable_streams may start additional streams and > disable_streams may not disable requested streams if other related streams > are still enabled. > > Signed-off-by: Sakari Ailus > Reviewed-by: Jacopo Mondi > Reviewed-by: Mirela Rabulea > --- > include/media/v4l2-subdev.h \| 8 ++++++++ > 1 file changed, 8 insertions(+) > > diff --git a/include/media/v4l2-subdev.h b/include/media/v4l2-s

### 39. Media3 Release Notes - Media3 1.9.4

- 출처: Media3 Release Notes
- 출처 URL: https://developer.android.com/jetpack/androidx/releases/media3
- 발행일: May 16, 2026
- Link: https://developer.android.com/jetpack/androidx/releases/media3#1.9.4
- Section: Android Media / Camera Output
- Selection: watch
- Evidence level: watch
- Topic: generic_tech_watchlist
- Reason: Generic tech item without article-level camera/driver/SoC/native-tooling evidence.
- 날짜 근거 있음: no
- 요약: May 16, 2026 Version 1.9.4 contains the following commits .

### 40. Media3 Release Notes - Media3 1.10.1

- 출처: Media3 Release Notes
- 출처 URL: https://developer.android.com/jetpack/androidx/releases/media3
- 발행일: May 12, 2026
- Link: https://developer.android.com/jetpack/androidx/releases/media3#1.10.1
- Section: Android Media / Camera Output
- Selection: reference
- Evidence level: reference
- Topic: generic_tech_watchlist
- Reason: Background reference page; not an article candidate.
- 날짜 근거 있음: yes
- 요약: May 12, 2026 Common library: Fix handling of onAudioSessionIdChanged in SimpleBasePlayer and ForwardingSimpleBasePlayer .

## Collector 실패

- libcamera Documentation: 404 Not Found
- KernelNewbies LinuxChanges: 502 Bad Gateway
- LLVM Project Blog: 404 Not Found
- OpenAI News: 403 Forbidden
- 요즘IT: 403 Forbidden

## 편집장 체크리스트

- [ ] High-priority official source를 먼저 검토했다.
- [ ] Candidate-only source는 가능하면 official documentation 또는 blog로 교차 확인했다.
- [ ] 각 final section이 source name과 source URL을 보존한다.
- [ ] Final Markdown/HTML에 출처와 참고자료가 포함되어 있다.
- [ ] Camera HAL relevance가 capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, implementation impact와 연결된다.
