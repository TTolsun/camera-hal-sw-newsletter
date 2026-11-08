# Linked Evidence Diagnostics - 2026-11-09

- schema_version: 1
- linked_evidence_mode: extract_only
- enable_network: false
- candidate_count: 50
- total_linked_evidence: 19
- source_aware_linked_evidence: 419
- warning_count: 47

## Fetch Status Counts

- skipped: 1
- unsupported: 18

## Impact Type Counts

- build_dependency_fix: 9
- camera_api_change: 5
- device_quirk_fix: 2
- image_capture_fix: 2
- security_component_camera_related: 3
- test_only_change: 3
- video_capture_fix: 26

## Candidates

- Add Tecno BF6 to ImageCaptureFailed quirk - platform/frameworks/support: 1 evidence, impact=device_quirk_fix, recommendation=main
- Stop repeating for front zoom capture on d2q - platform/frameworks/support: 1 evidence, impact=image_capture_fix, recommendation=main
- Skip redfin 64-bit-only HAL crash test cases - platform/frameworks/support: 1 evidence, impact=device_quirk_fix, recommendation=main
- CameraX Release Notes - CameraX 1.7.0-rc02: 1 evidence, impact=camera_api_change, recommendation=main
- CameraX Release Notes - CameraX 1.7.0-rc01: 0 evidence, impact=camera_api_change, recommendation=main
- Use per-image metadata when saving DNG files - platform/frameworks/support: 1 evidence, impact=video_capture_fix, recommendation=main
- Map processed audio PTS to capture time - platform/frameworks/support: 1 evidence, impact=video_capture_fix, recommendation=main
- Fix AudioRecord frame count and A/V sync test - platform/frameworks/support: 1 evidence, impact=test_only_change, recommendation=watch
- [PATCH v14 0/9] media: qcom: camss: CAMSS Offline Processing Engine support: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH 0/4] media: qcom: camss: fixes for SoCs without IOMMU, RDI and CSID1 streaming: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH 0/7] Introduce v4l2-isp reset buffers: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH v4 0/6] Add CAMSS support for Qualcomm Hawi and Maili: 1 evidence, impact=test_only_change, recommendation=watch
- [PATCH v3 01/11] media: qcom: camss: Introduce CPU latency QoS during streaming: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH v3 0/7] media: qcom: camss: Add SM8150 CAMSS support: 0 evidence, impact=video_capture_fix, recommendation=main
- [v3,1/7] libcamera: V4L2Subdevice: Add whence argument to [get|set]Selection(): 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH 0/4] media: ov9734: Support the Microsoft Surface Laptop 1 front camera: 0 evidence, impact=video_capture_fix, recommendation=main
- [1/3] libipa: camera_sensor_helper: Add OV9734: 0 evidence, impact=video_capture_fix, recommendation=main
- Raspberry Pi libcamera Releases - v0.8.0+rpt20261104: 0 evidence, impact=video_capture_fix, recommendation=main
- [v3,1/4] ipa: libipa: camera_sensor_helper: Match multiple sensors per helper: 0 evidence, impact=video_capture_fix, recommendation=main
- [v2,1/3] libcamera: pipeline: rkisp1: Detect invalid sensor configurations: 0 evidence, impact=video_capture_fix, recommendation=main
- ipa: libipa: camera_sensor_helper: Add OV2680 support: 0 evidence, impact=video_capture_fix, recommendation=main
- [v6,01/24] libcamera: controls: AeExposureMode: Add ExposureMaximize: 0 evidence, impact=video_capture_fix, recommendation=main
- [v3] ipa: libipa: camera_sensor_helper: add ov02c10: 0 evidence, impact=video_capture_fix, recommendation=main
- [RFC,v1] ipa: rkisp1: imx219: Add `GammaOutCorrection`: 0 evidence, impact=video_capture_fix, recommendation=main
- Raspberry Pi libcamera Releases - libcamera v0.8.0: 0 evidence, impact=video_capture_fix, recommendation=main
- v0.8.0: 0 evidence, impact=video_capture_fix, recommendation=main
- camera: usb: Release V4L2 buffers on StreamOn() failure - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Lazily initialize root_gpu_resources_ when opening a camera device - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: diagnostics: Fix integer overflow and session poisoning - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Migrate mojom files from legacy handle to handle - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Remove obsolete face retouch override file checks - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- camera: Include base/timer/timer.h in mojo_perf_test.cc - chromiumos/platform2: 1 evidence, impact=video_capture_fix, recommendation=main
- Agentic and Flexible: A next era of Android development: 0 evidence, impact=build_dependency_fix, recommendation=watch
- What's new in Android developer tools and performance at Android Dev Summit: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Qodo builds context into AI code review with Codex: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Cult.fit builds operational muscle with Codex: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Security updates for Friday: 0 evidence, impact=build_dependency_fix, recommendation=watch
- GCC 17 Feature Development Ends Next Week: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Real-time AI video analytics on Renesas at electronica 2026: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Download LLVM releases: 0 evidence, impact=build_dependency_fix, recommendation=watch
- MSVC Build Tools Version 14.52 Release Candidate Now Available: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Enforce 5-Gate Deep Root-Cause Protocol in CameraX skills - platform/frameworks/support: 1 evidence, impact=image_capture_fix, recommendation=main
- Skip ROTATION_180 on Redmi 9 and unfreeze rotation - platform/frameworks/support: 1 evidence, impact=test_only_change, recommendation=watch
- 1.4.0-alpha07: 0 evidence, impact=camera_api_change, recommendation=main
- cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av: 1 evidence, impact=camera_api_change, recommendation=main
- heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support: 1 evidence, impact=security_component_camera_related, recommendation=main
- Add API files for heifwriter 1.2.0-rc02 - platform/frameworks/support: 1 evidence, impact=security_component_camera_related, recommendation=main
- I hate CameraX, so I made it a one liner :): 0 evidence, impact=camera_api_change, recommendation=main
- Visited the Zoute Grand Prix in Knokke, found every car/parking app overly monetized, so I built my own free open-source car scanner in Kotlin / Jetpack Compose: 0 evidence, impact=security_component_camera_related, recommendation=main
- The Camera Is Becoming Software: 0 evidence, impact=video_capture_fix, recommendation=main
