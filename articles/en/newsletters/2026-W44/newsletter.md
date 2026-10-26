# 2026 W43 (10.19 ~ 10.25)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week's newsletter covers several CameraX improvements. "CameraX SessionConfigAdapter" fixes a race condition that caused incorrect session resets when replacing surfaces. "CameraX ZslControl" resolves a graphics memory leak that occurred during flash transitions and request cancellations. "CameraX UseCaseCameraState" corrects an error where state update signals failed prematurely during temporary frame drops. "CameraX VideoCapture" fixes a native thread leak that happened when the video encoder was released too early. Additionally, we report on the proposed patches for upstream CAMSS driver and independent CSI2 PHY support for the Qualcomm SM8450 platform.

- [CameraX SessionConfigAdapter fixes race condition causing incorrect session resets during surface replacement](#article-camerax-sessionconfigadapter-fixes-race-condition-causing-incorrect-session-rese)

  This reduces a higher-level race condition where the upstream framework unnecessarily restarted configureStreams and the request loop due to incorrect error callbacks, without changing the downstream Camera HAL interface specification itself.

- [CameraX ZslControl fixes graphics memory leak during flash transitions and request cancellations](#article-camerax-zslcontrol-fixes-graphics-memory-leak-during-flash-transitions-and-reque)

  This fixes a higher-level buffer return path, preventing memory pressure and out-of-memory kills that can occur when buffers are fixed in the lower graphics memory allocation layer.

- [CameraX UseCaseCameraState fixes premature failure of state update signals during temporary frame drops](#article-camerax-usecasecamerastate-fixes-premature-failure-of-state-update-signals-durin)

  This provides a buffer to prevent temporary frame drops occurring at the driver or ISP level from propagating as full pipeline errors in the higher-level framework.

- [CameraX VideoCapture fixes native thread leak when video encoder is released too early](#article-camerax-videocapture-fixes-native-thread-leak-when-video-encoder-is-released-too)

  This is not a direct change to the Camera HAL contract, but it improves the long-term stability of the app by preventing thread resource leaks in the downstream video encoder layer where camera frames are delivered.

- [Qualcomm SM8450 platform: Proposed patches for upstream CAMSS driver and independent CSI2 PHY support](#article-qualcomm-sm8450-platform-proposed-patches-for-upstream-camss-driver-and-independ)

  This is an early stage in establishing kernel-level V4L2 device nodes and the CSI2 reception pipeline, making it useful as a reference for downstream media topology when porting AOSP CameraProvider in the future.




<a id="article-camerax-sessionconfigadapter-fixes-race-condition-causing-incorrect-session-rese"></a>

## 2. CameraX SessionConfigAdapter fixes race condition causing incorrect session resets during surface replacement

_AndroidX Gerrit Camera (Change 4372671)_

A timing error that rarely caused session reset errors when replacing surfaces during camera preview, such as during screen rotation or transitions, has been resolved.

### Camera HAL/Driver perspective: what it means

This reduces a higher-level race condition where the upstream framework unnecessarily restarted configureStreams and the request loop due to incorrect error callbacks, without changing the downstream Camera HAL interface specification itself.


![](../../../assets/images/fallback/android.svg)


When a camera application replaced the preview surface provider, a race condition could cause an unexpected reconfiguration error if the downstream stream surface closed at the same time.

Previously, when a SurfaceClosedException was detected in a background coroutine, the session configuration information was read twice in a row without synchronization. If the first read found an existing configuration, but the main thread replaced it with a new session configuration almost simultaneously, the second read referenced the newly connected active configuration. This led to an unnecessary SESSION_ERROR_SURFACE_NEEDS_RESET error being delivered to a correctly connected new configuration, which tangled the session pipeline.

This commit patch changes the logic to query the target configuration with a single call on the main thread dispatcher. It also adds a check for auxiliary session configuration and post-view surface matching, which was previously missing.

In environments requiring inspection, you can observe whether reset error callbacks are delivered to the active pipeline when the preview surface is repeatedly updated and session reconfiguration is in progress. However, this verification is based on the source tree merge stage, and its inclusion in distributed libraries and final product builds requires separate confirmation.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Fix SessionConfigAdapter.reportSurfaceInvalid race - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4372671)

---

<a id="article-camerax-zslcontrol-fixes-graphics-memory-leak-during-flash-transitions-and-reque"></a>

## 3. CameraX ZslControl fixes graphics memory leak during flash transitions and request cancellations

_AndroidX Gerrit Camera (Change 4365734)_

A memory leak that prevented tens of megabytes of graphic buffers from being returned when the Zero Shutter Lag (ZSL) feature was enabled and the flash was used or capture was canceled has been resolved.

### Camera HAL/Driver perspective: what it means

This fixes a higher-level buffer return path, preventing memory pressure and out-of-memory kills that can occur when buffers are fixed in the lower graphics memory allocation layer.


![](../../../assets/images/fallback/android.svg)


The Zero Shutter Lag (ZSL) feature stores frames in a ring buffer before the shutter is pressed, making buffer lifecycle management critical.

In the previous implementation, frames already in the ring buffer were not cleared even when ZSL was disabled due to flash photography being activated. This caused 3 to 6 full-resolution PRIV or YUV graphics hardware buffers (approximately 54MB to 108MB) to remain unreleased and fixed in memory. Additionally, there was a leak path where ImageProxy objects retrieved from the queue were not closed and were lost if the result object conversion failed during the capture request mapping process or if the request sequence was aborted.

This patch improves the system by explicitly draining the internal buffers of ZslRingBuffer when flash mode is set or a use case is deactivated. It also ensures that retrieved image proxies are always closed through an exception block if capture request conversion fails or an onRequestSequenceAborted callback is received.

In a practical environment, you can verify the improvement by profiling GraphicBuffer allocation trends while ZSL is active, turning flash mode on and off, or restarting the session during high-resolution continuous capture. This verification method is based on source analysis, and its inclusion in the final distributed binary requires confirmation.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Fix ZslControl ring buffer and ImageProxy leaks - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4365734)

---

<a id="article-camerax-usecasecamerastate-fixes-premature-failure-of-state-update-signals-durin"></a>

## 4. CameraX UseCaseCameraState fixes premature failure of state update signals during temporary frame drops

_AndroidX Gerrit Camera (Change 4381409)_

The system has been improved so that use case settings or focus control operations do not terminate abnormally even if a momentary frame drop occurs during continuous camera capture.

### Camera HAL/Driver perspective: what it means

This provides a buffer to prevent temporary frame drops occurring at the driver or ISP level from propagating as full pipeline errors in the higher-level framework.


![](../../../assets/images/fallback/android.svg)


In environments that continuously request streams, such as previews, single frame drops can occur due to sensor or buffer timing.

Previously, when a CaptureCallback.onCaptureFailed callback was received from the lower Camera2 framework, UseCaseCameraState immediately completed all pending state update signals with an error, even if it was only a temporary frame loss. This caused control logic for use case activation or 3A control to unnecessarily throw exceptions and fail during normal surface transitions.

The revised logic does not immediately cancel signals upon a single frame failure but keeps them in the queue. It defers signal completion until the next frame with the same or a larger request number is successfully returned via onTotalCaptureResult, or until repeating requests are completely stopped. Additionally, to avoid lock contention, the enqueue and drain operations of signals have been safely separated within the lock.

In a test environment, you can set up a scenario to observe whether 3A or use case transition Futures are prematurely interrupted immediately after a single frame drop log occurs when changing sensor modes or updating surfaces under high load. This verification method is based on the merged source code, and its inclusion in the final library release and product requires separate confirmation.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Keep UseCaseCameraState signals pending on repeating frame failure - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4381410)

---

<a id="article-camerax-videocapture-fixes-native-thread-leak-when-video-encoder-is-released-too"></a>

## 5. CameraX VideoCapture fixes native thread leak when video encoder is released too early

_AndroidX Gerrit Camera (Change 4375770)_

A leak issue has been resolved where media framework threads remained in the system every time the video capture use case was bound to the screen and then released without recording.

### Camera HAL/Driver perspective: what it means

This is not a direct change to the Camera HAL contract, but it improves the long-term stability of the app by preventing thread resource leaks in the downstream video encoder layer where camera frames are delivered.


![](../../../assets/images/fallback/android.svg)


The video capture use case pre-configures the encoder for quick recording startup. However, if the screen is closed without pressing the record button, the encoder is released without ever being started.

In the Codec2 framework introduced in Android 10 (API 29), if a media codec configured with surface input was released directly without being started, the C2NodeImpl native thread would remain until the process terminated. This caused native threads to continuously accumulate within the process each time the app entered and exited the video capture screen.

This patch adds the VideoEncoderLeaksThreadOnReleaseWithoutStartQuirk, which intentionally starts the codec just before release if the encoder has been configured but not started. By starting the codec, the media framework can properly clean up the input surface connection and terminate the native thread. This additional startup process is performed on the encoder's background thread and may introduce an additional delay of approximately 9 to 24 milliseconds at the time of release.

In a test environment, you can verify whether the number of C2NodeImpl or C2OMXNode threads increases by repeatedly binding and unbinding the video capture use case and then checking the /proc/self/task path. This verification is a proposal based on the source tree merge, and its inclusion in the official library distribution requires further investigation.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Fix native thread leak when releasing an unstarted video encoder - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4375770)

---

<a id="article-qualcomm-sm8450-platform-proposed-patches-for-upstream-camss-driver-and-independ"></a>

## 6. Qualcomm SM8450 platform: Proposed patches for upstream CAMSS driver and independent CSI2 PHY support

_lore.kernel.org linux-media list_

A series of patches has been proposed to add driver support and independent CSI2 PHY configuration for the Qualcomm SM8450 platform's camera subsystem in the upstream Linux kernel.

### Camera HAL/Driver perspective: what it means

This is an early stage in establishing kernel-level V4L2 device nodes and the CSI2 reception pipeline, making it useful as a reference for downstream media topology when porting AOSP CameraProvider in the future.


![](../../../assets/images/fallback/newsletter-default.svg)


Supporting the camera reception pipeline is a crucial prerequisite when running Qualcomm hardware on open-source Linux kernels in mobile and embedded devices.

This submitted series of 7 patches adds CAMSS driver support for the Qualcomm SM8450 (Waipio) SoC. The physical layer, CSIPHY, is defined in the device tree as an independent device compatible with the X1E80100 platform, instead of the existing legacy resource structure. According to the submitter, this CSIPHY IP has the same structure as applied to the Hamoa platform and has been verified for image streaming from a test pattern generator (TPG) to CSID in a private test board environment.

However, this content is a patch proposal submitted to the mailing list on October 23, 2026, based on the linux-next-20261023 tree. Subsequent mainline kernel merge status or actual release inclusion history is not confirmed in the original text. Additionally, this change involves kernel driver configuration at the Linux V4L2 and media controller level, so it does not directly alter the Android Camera HAL interface contract itself.

Engineers planning to port an AOSP board based on SM8450 or build a mainline kernel in the future can review the CAMSS device tree node configuration and MCLK pin description specifications in sm8450.dtsi in advance.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH 0/7] media: qcom: camss: Add Waipio CAMSS support](https://lore.kernel.org/linux-media/20261023163057.775917-1-vz@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20261023163057.775917-1-vz@kernel.org/T/#t)


## References

- [Fix SessionConfigAdapter.reportSurfaceInvalid race - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4372671)
- [Fix ZslControl ring buffer and ImageProxy leaks - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4365734)
- [Keep UseCaseCameraState signals pending on repeating frame failure - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4381410)
- [Fix native thread leak when releasing an unstarted video encoder - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4375770)
- [[PATCH 0/7] media: qcom: camss: Add Waipio CAMSS support](https://lore.kernel.org/linux-media/20261023163057.775917-1-vz@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20261023163057.775917-1-vz@kernel.org/T/#t)
