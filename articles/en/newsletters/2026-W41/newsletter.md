# 2026 W40 (09.28 ~ 10.04)

This week's newsletter brings important information about preparing for Android 17 Camera ITS. Learn more about what to check beyond the Python package list, including the execution environment version and changed verification items. Also, there's news about a libcamera AWB proposal. See how a new approach of fixing automatic gain and reconverging when needed can improve color changes.



## 1. This week’s articles

- Android 17 Camera ITS: Runtime Versions and Updated Tests
- libcamera AWB Proposal: Freeze Automatic Gains and Trigger Reconvergence

## 2. Android 17 Camera ITS: Runtime Versions and Updated Tests


![Android Open Source Project](https://www.gstatic.com/devrel-devsite/prod/vfdb441d2e08dbd9d3e48d8cd72b242388a87bcf7626bf5fb9df50c2bdd4a70fd/androidsource/images/lockup.png)

_Image: [Android 17 Camera Image Test Suite release notes | Android Open Source Project](https://source.android.com/docs/compatibility/cts/its-release-notes-17)_


_Official Android Open Source Project Documentation_

When preparing for Android 17 Camera ITS, it's not just the Python package list that needs to be aligned. The versions of Python and FFmpeg executables, test charts, and CTS Verifier activity configurations must be checked together.

The Android 17 Camera ITS release notes guide you through the environment configuration procedure using Python 3.14 and FFmpeg 7.0.2. It is strongly recommended to create a virtual environment for each Android release and install the Python packages of the versions specified in the document. Python itself and FFmpeg executables are not prepared by simply installing Python packages, so they must be installed separately.

The target to check is the environment where the tests are actually run. After activating a virtual environment created with Python 3.14, check the Python version and compare the pip freeze results with the official package list. In the same environment, you should also check if ffmpeg -version points to 7.0.2. If a different version is running, you can check the execution path and the binary link of the virtual environment as guided by the document. Creating a virtual environment alone does not solve the problem of other FFmpeg installed on the system being called.

### Charts and Inspection Items Also Change

The new gen2_chart scene uses a paper chart instead of a tablet. scene3 has been changed to detect charts with ArUco markers, covering various angles of view and distance conditions for telephoto cameras. If you use existing charts as is, they may not match the new inspection conditions, so it is necessary to check the chart configuration separately from the execution environment version.

Among the new inspections, test_tonemap_sequence checks the application of android.tonemap.mode, and test_jca_jpegr_ip checks the white balance difference between JPEG_R JCA preview snapshots and captured images. test_display_p3 checks that P3 JPEG output has an appropriate ICC profile and that more than 1% of its colors fall outside the sRGB gamut. The existing test_yuv_jpeg_capture_sameness has been changed to lower the RMS difference threshold to catch visible color differences as failures. The document does not provide the new value for this threshold.

Tests are separated into Camera ITS Test and Camera ITS Sensor Fusion Rig Test activities in CTS Verifier. The latter includes feature_combination and sensor_fusion scenes, a configuration that allows parallel testing on separate devices. Additionally, a PASS asterisk status is introduced to indicate boundary-level passes. sensor_fusion/test_video_stabilization is deprecated and guides to use test_video_stabilization_jca. The procedure for collecting ITS results obtained from multiple devices and sessions using the same build fingerprint and submitting them for build approval is also described.

Multi-camera switching, flash, and sensor fusion tests moved to the Gen2 rig require new charts. chart_scaling in config.yml addresses chart scaling issues for telephoto cameras, and the Samsung Galaxy Tab S10 FE has been added to the wide-gamut test tablet allowlist.

This does not mean that the HAL API has changed, but rather that the test execution environment and verification scope have changed. The update date of the release notes alone cannot determine the initial introduction date of each change.

### Camera HAL/Driver perspective: what it means

When analyzing verification failures, it is necessary to distinguish between differences in the execution environment version/path, chart configuration, and HAL output. In particular, YUV/JPEG color differences and white balance between JPEG_R preview/capture are items to compare results against new inspection conditions.

**Sources**

- [Android 17 Camera Image Test Suite release notes](https://source.android.com/docs/compatibility/cts/its-release-notes-17)

---

## 3. libcamera AWB Proposal: Freeze Automatic Gains and Trigger Reconvergence


![libcamera AWB Proposal: Freeze Automatic Gains and Trigger Reconvergence image](../../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork Mailing List_

This proposal aims to improve the behavior where colors suddenly change when turning off automatic white balance by reverting to the old manual gain. It adds a flow that maintains the last automatic gain and updates to a new gain only when requested.

A libcamera AWB patch series submitted on September 28, 2026, addresses gain transitions when switching from automatic to manual mode. Previously, automatic and manual gains were separate, so switching to AwbEnable=false would revert to the previous manual values. The proposal continuously updates manual gain with the gain calculated during automatic operation, so that the last automatic gain is maintained the moment AWB is turned off.

If the lighting changes in the locked state and you want to readjust, you can request AwbTrigger=true. This control works when AwbEnable=false. The algorithm determines reconvergence in the Searching state, reflects the converged gain in the manual gain, and then returns to Locked. If AwbEnable=true, the trigger has no effect. Therefore, it is possible to distinguish between continuous automatic AWB operation and a single re-search operation in manual mode.

### Removal of AwbLocked and AwbState Status Reporting

The actual diff removes the existing AwbLocked output metadata. It is not a change to convert it to an input control. Status reporting is handled by AwbState, which has been moved from draft to core, and provides three states: Searching, Converged, and Locked. A separate inactive state is removed. The explanation of the input control transition in the commit message of patch #1 (28387) of the series does not match this diff, so here we explain based on the actual code's removal/addition.

The convergence criteria also do not yet match. The AwbState description in control_ids_core.yaml of patch #1 uses a 5% criterion compared to the previous frame, but implementation patch #3 (28389) uses a method of accumulating 5 frames within a 10% range. According to the implementation comments, the range between 10% and 15% pauses accumulation, and a difference exceeding 15% resets the counter, so simply summarizing it as '5 consecutive frames' is also not accurate. After convergence, the stored converged gain is used as the comparison criterion instead of the immediately preceding frame.

The series also includes an extension of the Vector comparison operator to support gain vector comparison. This is an internal implementation change that supports AWB's convergence determination.

This article compares the design and code of the submitted series. Differences between the explanation and implementation remain, so it should not be taken as a finalized API contract or already deployed feature. It is also not a change to the Android Camera HAL specification itself. For teams dealing with libcamera-based camera stacks, this is a proposal that can be referenced for how to express the gain to maintain during manual switching and the re-search completion status.

### Camera HAL/Driver perspective: what it means

The core is the gain to maintain when turning off AWB and the re-search operation in manual mode. In libcamera-based implementations, this behavior and the expression of the AWB state in the upper layer should be reviewed together, but the current patch's convergence criteria should not be applied as a finalized contract.

**Sources**

- [libcamera AWB series patch 28387](https://patchwork.libcamera.org/patch/28387/)
- [Add AwbState metadata and AwbTrigger control](https://patchwork.libcamera.org/cover/28386/)
- [libcamera AWB series patch 28388](https://patchwork.libcamera.org/patch/28388/)
- [libcamera AWB series patch 28389](https://patchwork.libcamera.org/patch/28389/)
- [libcamera AWB series patch 28390](https://patchwork.libcamera.org/patch/28390/)
- [libcamera AWB series patch 28391](https://patchwork.libcamera.org/patch/28391/)


## Further reading

- [\[PATCH 3/3\] media: mali-c55: Keep ISP powered while IRQ wake is armed](<https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/>) — lore.kernel.org linux-media list (2026-09-29) · Mali-C55 ISP power management patch proposal
- ChromeOS camera changes: [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692>) (2026-09-30) · [camera: Enforce exclusive buffer IDs - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146>) (2026-09-30)

## References

- [Android 17 Camera Image Test Suite release notes](https://source.android.com/docs/compatibility/cts/its-release-notes-17)
- [libcamera AWB series patch 28387](https://patchwork.libcamera.org/patch/28387/)
- [Add AwbState metadata and AwbTrigger control](https://patchwork.libcamera.org/cover/28386/)
- [libcamera AWB series patch 28388](https://patchwork.libcamera.org/patch/28388/)
- [libcamera AWB series patch 28389](https://patchwork.libcamera.org/patch/28389/)
- [libcamera AWB series patch 28390](https://patchwork.libcamera.org/patch/28390/)
- [libcamera AWB series patch 28391](https://patchwork.libcamera.org/patch/28391/)
