# Linked Evidence Diagnostics - 2026-11-23

- schema_version: 1
- linked_evidence_mode: extract_only
- enable_network: false
- candidate_count: 50
- total_linked_evidence: 17
- source_aware_linked_evidence: 51
- warning_count: 46

## Fetch Status Counts

- unsupported: 17

## Impact Type Counts

- build_dependency_fix: 5
- camera_api_change: 9
- device_quirk_fix: 3
- documentation_only: 1
- generic_tooling_change: 1
- image_capture_fix: 2
- runtime_behavior_change: 1
- security_component_camera_related: 4
- test_only_change: 8
- unknown: 4
- video_capture_fix: 12

## Candidates

- CameraX Release Notes - CameraX 1.7.0: 0 evidence, impact=camera_api_change, recommendation=main
- Disable ZSL on Samsung SM-F971 - platform/frameworks/support: 1 evidence, impact=device_quirk_fix, recommendation=main
- Exclude OPPO PHT110 physical camera IDs 2 and 3 - platform/frameworks/support: 1 evidence, impact=device_quirk_fix, recommendation=main
- Use HLG10 camera stream for Dolby Vision on Xiaomi 17 Pro Max - platform/frameworks/support: 1 evidence, impact=camera_api_change, recommendation=main
- Honor abort cancellation in still capture control - platform/frameworks/support: 1 evidence, impact=image_capture_fix, recommendation=main
- Coalesce FrameGraphBuffers updates using a dirty flag - platform/frameworks/support: 1 evidence, impact=camera_api_change, recommendation=main
- Harden extension switch stress test teardown - platform/frameworks/support: 1 evidence, impact=device_quirk_fix, recommendation=main
- Stabilize CaptureConfigAdapterDeviceTest fixture - platform/frameworks/support: 1 evidence, impact=camera_api_change, recommendation=main
- Bound torch enable wait in torchApplyCapture - platform/frameworks/support: 1 evidence, impact=camera_api_change, recommendation=main
- 1.4.0-alpha07: 0 evidence, impact=camera_api_change, recommendation=main
- CameraX Release Notes - CameraX 1.7.0-rc01: 0 evidence, impact=camera_api_change, recommendation=main
- How SmileID Scaled Identity Verification to 18,000+ Android Device Types with CameraX: 0 evidence, impact=camera_api_change, recommendation=main
- CameraX Release Notes - CameraX 1.7.0-rc02: 1 evidence, impact=camera_api_change, recommendation=main
- [PATCH v3 0/2] media: i2c: Add Samsung S5K5E8 camera sensor driver: 0 evidence, impact=test_only_change, recommendation=watch
- [PATCH v2 0/2] media: i2c: Add Samsung S5K5E8YX camera sensor driver: 0 evidence, impact=generic_tooling_change, recommendation=watch
- [PATCH 1/2] dt-bindings: media: i2c: Add Samsung S5K5E8YX image sensor: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH v6 0/2] media: i2c: Samsung S5K3T2 image sensor: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH 0/3] media: Add Sony IMX175 sensor driver (Lenovo ThinkPad 10 rear camera): 0 evidence, impact=test_only_change, recommendation=watch
- [PATCH v11 00/14] media: Add Lenovo Yoga Book camera support: 0 evidence, impact=video_capture_fix, recommendation=main
- [PATCH RESEND] media: atomisp: remove dead error check in ia_css_stream_create(): 0 evidence, impact=test_only_change, recommendation=watch
- [v3,1/8] libcamera: software_isp: Let a single point decide about computing stats: 0 evidence, impact=video_capture_fix, recommendation=main
- [RFC,v2,01/26] libcamera: software_isp: Rename Bayer classes to SoftwareIspInstance: 0 evidence, impact=video_capture_fix, recommendation=main
- pipeline: rkisp1: Forward controls passed to start() to the IPA: 0 evidence, impact=video_capture_fix, recommendation=main
- [RFC,1/3] libcamera: v4l2_subdevice: Add whence parameter to set/getSelection(): 0 evidence, impact=video_capture_fix, recommendation=main
- [v6,01/23] ipa: libipa: fixedpoint: Shift unsigned type for scaling: 0 evidence, impact=video_capture_fix, recommendation=main
- What's new in the Jetpack Compose November '26 release: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Elevating games: New large screens and foldables quality standards on Google Play: 0 evidence, impact=test_only_change, recommendation=watch
- Elevating apps: New adaptive quality standards on Google Play: 0 evidence, impact=test_only_change, recommendation=watch
- Ship smarter keep rules: How library providers can unblock app-level DEX code optimization: 0 evidence, impact=test_only_change, recommendation=watch
- Expanding Android developer verification in 2027: 0 evidence, impact=security_component_camera_related, recommendation=watch
- Beyond the app: Expanding buyer reach across new surfaces with Google Play: 0 evidence, impact=test_only_change, recommendation=watch
- Add testHeicFallbackAvailable to HeifWriterTest - platform/frameworks/support: 1 evidence, impact=security_component_camera_related, recommendation=main
- Add testAvifEncoderAvailable to AvifWriterTest - platform/frameworks/support: 1 evidence, impact=security_component_camera_related, recommendation=main
- Add API files for heifwriter 1.2.0-rc02 - platform/frameworks/support: 1 evidence, impact=security_component_camera_related, recommendation=main
- Powering Seamless Player Sign-In: Introducing the Open-Source Sign in with Google Plugin for Unity: 0 evidence, impact=build_dependency_fix, recommendation=watch
- [PATCH v13 12/73] media: Documentation: Document raw mbus codes and CFA for cameras: 0 evidence, impact=documentation_only, recommendation=watch
- [v4,1/8] ipa: rpi: Drop unused params argument from platformPrepareIsp(): 0 evidence, impact=runtime_behavior_change, recommendation=main
- [v1,1/3] pipeline: rpi: Pass the raw buffer pixel format to the IPA: 0 evidence, impact=image_capture_fix, recommendation=main
- [v4,1/4] ipa: libipa: camera_sensor_helper: Match multiple sensors per helper: 0 evidence, impact=video_capture_fix, recommendation=main
- Raspberry Pi libcamera Releases - libcamera v0.8.0: 0 evidence, impact=video_capture_fix, recommendation=main
- v0.8.0: 0 evidence, impact=video_capture_fix, recommendation=main
- Raspberry Pi libcamera Releases - v0.8.0+rpt20261104: 0 evidence, impact=video_capture_fix, recommendation=main
- Claude Code v2.1.328: 0 evidence, impact=unknown, recommendation=unknown
- Claude Code v2.1.327: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Claude Code v2.1.326: 0 evidence, impact=unknown, recommendation=unknown
- camera: Migrate SharedMemoryMapping::memory() to data() - chromiumos/platform2: 1 evidence, impact=test_only_change, recommendation=watch
- Codex rust-v0.171.0: 4 evidence, impact=build_dependency_fix, recommendation=watch
- Research acceleration: The jagged frontier: 0 evidence, impact=unknown, recommendation=unknown
- How Revolut raises ambition without lowering the bar: 0 evidence, impact=build_dependency_fix, recommendation=watch
- Claude Code v2.1.329: 0 evidence, impact=unknown, recommendation=unknown
