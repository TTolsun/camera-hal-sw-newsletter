# Linked Evidence Diagnostics - 2026-10-07

- schema_version: 1
- linked_evidence_mode: extract_only
- enable_network: false
- candidate_count: 50
- total_linked_evidence: 10
- source_aware_linked_evidence: 183
- warning_count: 52

## Fetch Status Counts

- skipped: 1
- unsupported: 9

## Impact Type Counts

- build_dependency_fix: 9
- device_quirk_fix: 5
- documentation_only: 1
- generic_tooling_change: 2
- runtime_behavior_change: 2
- security_component_camera_related: 3
- test_only_change: 2
- unknown: 11
- video_capture_fix: 15

## Candidates

- 7.3-rc6: mainline: 0 evidence, impact=unknown, recommendation=unknown
- Linux 7.3-rc6 Released: Normal For The New "AI Normal": 0 evidence, impact=unknown, recommendation=unknown
- Seven stable kernels for Saturday: 0 evidence, impact=unknown, recommendation=unknown
- [1/5] libcamera: controls: Expand AWB controls: 0 evidence, impact=video_capture_fix, recommendation=main
- [v2] libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata: 1 evidence, impact=video_capture_fix, recommendation=main
- [v2] libcamera: software_isp: Add R10 and R10_CSI2P monochrome formats: 0 evidence, impact=video_capture_fix, recommendation=main
- [v4] libcamera: controls: Remove common enum prefix: 0 evidence, impact=video_capture_fix, recommendation=main
- [v4] ipa: softisp: adjust: Read default contrast from tuning: 0 evidence, impact=runtime_behavior_change, recommendation=main
- [v1] ipa: {rkisp1,mali-c55}: Expand uncalibrated tuning files: 0 evidence, impact=video_capture_fix, recommendation=main
- [v3,01/41] libcamera: delayed_controls: Add push() function that accepts a sequence number: 0 evidence, impact=video_capture_fix, recommendation=main
- [v3,1/8] ipa: rpi: Drop unused params argument from platformPrepareIsp(): 0 evidence, impact=runtime_behavior_change, recommendation=main
- camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Validate plane offsets in RegisterBuffer - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Validate plane sizes against dmabuf bounds in RegisterBuffer - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Prevent buffer UAF on PortraitModeEffect timeout - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Prevent UAF on watcher callback in ReloadableConfigFile - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- cros_camera_service: Fix UAF in StreamManipulatorHelper - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Fix cross-thread UAF in HdrNetStreamManipulator options reload - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Enforce exclusive buffer IDs - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- September 2026 Security Bulletin: CVE-2026-25261 — Camera: 1 evidence, impact=security_component_camera_related, recommendation=main
- Android NDK r30: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Blog Post: What is new in LLVM 23?: 0 evidence, impact=build_dependency_fix, recommendation=watch
- MSVC C++23: constexpr cmath with LLVM Libc: 0 evidence, impact=build_dependency_fix, recommendation=watch
- MSVC Build Tools Preview updates – September 2026: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Bringing Correctly Rounded Math to Production with LLVM-libc: 0 evidence, impact=build_dependency_fix, recommendation=watch
- What’s New for C++ Developers in Visual Studio 2026 (18.7 – 18.10): 0 evidence, impact=generic_tooling_change, recommendation=watch
- Faster C++ code intelligence for Copilot CLI with Whole Codebase Indexing: 0 evidence, impact=generic_tooling_change, recommendation=watch
- Building GPU Drivers in Rust: Tyr at RustConf 2026: 0 evidence, impact=unknown, recommendation=unknown
- Mesa on Android: How we brought Turnip, SkiaVK, and Cuttlefish to CI: 0 evidence, impact=test_only_change, recommendation=watch
- Decoding with Rockchip at Kernel Recipes 2026: 0 evidence, impact=unknown, recommendation=unknown
- Open Source in Prague: A week of talks, hands-on demos, and community!: 0 evidence, impact=unknown, recommendation=unknown
- Blog Post: AMBA C2C: Moving forward with a converged AMBA foundation for C2C connectivity: 0 evidence, impact=device_quirk_fix, recommendation=watch
- Blog Post: Profile neural graphics workloads with Arm Streamline: 0 evidence, impact=device_quirk_fix, recommendation=watch
- Blog Post: Scaling On-Device AI Across different Arm backends with ExecuTorch: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Blog Post: Introducing Neural Frame Rate Upscaling in Arm Neural Graphics SDK for Game Engines and UE plugins: 0 evidence, impact=device_quirk_fix, recommendation=watch
- Blog Post: Meet Arm AI Portal: The launchpad for your next AI application: 0 evidence, impact=device_quirk_fix, recommendation=watch
- Blog Post: On-device toxic speech detection with ML and SME2: 0 evidence, impact=device_quirk_fix, recommendation=watch
- Turn text input into actions with Needle, a 14MB function-calling LLM: 0 evidence, impact=unknown, recommendation=unknown
- Media3 Release Notes - Media3 1.11.1: 0 evidence, impact=unknown, recommendation=unknown
- Device Streaming and Android skills - available in Android CLI: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Build intelligent Android apps: In-app agentic workflows: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Build your way: Use any AI agent of your choice in Android Studio: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Android Bench 2.0: Pushing the frontier with challenging long-horizon tasks: 0 evidence, impact=unknown, recommendation=unknown
- A model guide for the GPT-6 family: 0 evidence, impact=documentation_only, recommendation=watch
- DevDay 2026 Recap: 0 evidence, impact=security_component_camera_related, recommendation=watch
- Disrupting a coordinated model-distillation campaign: 0 evidence, impact=unknown, recommendation=unknown
- Claude Sonnet 5.5: 0 evidence, impact=test_only_change, recommendation=watch
- Made an app that records video when you double press volume down even with screen off. Play Store won't allow it. Now what?: 0 evidence, impact=video_capture_fix, recommendation=watch
- How Instagram Direct engineers built AI-native UI architecture with Jetpack Compose and reduced token cost per agent session by 33%: 0 evidence, impact=security_component_camera_related, recommendation=main
- Driving growth on Google Play: The next era of subscriptions: 0 evidence, impact=unknown, recommendation=unknown
