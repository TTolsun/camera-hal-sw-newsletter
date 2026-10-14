# 2026 W41 (10.05 ~ 10.11)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week, we cover 8 news items, including 'AOSP cameraserver proposes a patch to maintain conditional mute during privacy toggle' and 'Fixing NullPointerException and session timeouts that occurred during early completion callbacks for Camera Extensions'.

- [AOSP cameraserver proposes patch to maintain conditional mute during privacy toggle](#article-aosp-cameraserver-proposes-patch-to-maintain-conditional-mute-during-privacy-tog)

  This is a matter to check whether only video is blocked while the connection is maintained for apps displayed on screen on supported devices. It is also necessary to check whether devices that do not support the feature and other apps are disconnected as before.

- [Fixes NullPointerException and session timeouts that occurred during early completion callbacks for Camera Extensions](#article-fixes-nullpointerexception-and-session-timeouts-that-occurred-during-early-compl)

  When integrating Camera Extensions, check for exceptions in the CXCP-Camera-H thread under early completion callback conditions and track the reflection status in library and product builds.

- [Introduction of Camera2CaptureSequenceProcessor's partial Surface capture request rejection and retry mechanism](#article-introduction-of-camera2capturesequenceprocessor-s-partial-surface-capture-reques)

  Check the partial Surface request rejection and retry behavior based on the GraphLoop invalidate signal in an asynchronous Surface binding time lag environment.

- [CameraDevice forced termination quirk to bypass session reconfiguration delays on specific Android 16 devices](#article-cameradevice-forced-termination-quirk-to-bypass-session-reconfiguration-delays-o)

  This patch bypasses stream flush failures by forcing the device to be completely closed and reopened at the higher CameraX level, instead of directly modifying the camera3_device_t handle or flush logic within the HAL or framework.

- [Restricting dynamic range profiles to SDR on devices missing 10-bit capability declaration](#article-restricting-dynamic-range-profiles-to-sdr-on-devices-missing-10-bit-capability-d)

  When implementing HAL, exposing only 10-bit HDR profile keys and omitting the DYNAMIC_RANGE_TEN_BIT capability results in a breach of contract with the higher framework, making metadata consistency verification essential.

- [CameraPipe CaptureSessionState refactoring prevents loss of delayed surface requests](#article-camerapipe-capturesessionstate-refactoring-prevents-loss-of-delayed-surface-requ)

  Although it is not a change to the HAL driver interface contract, it is useful for verifying the reliability of initial stream request ingress because pending capture requests are fully received immediately after session configuration in delayed surface patterns.

- [Claude Haiku 5.5: Low-cost auxiliary model for repetitive coding tasks](#article-claude-haiku-5-5-low-cost-auxiliary-model-for-repetitive-coding-tasks)

  Development tool managers can compare the current model and Haiku 5.5 using build error log summarization and classification samples. The criterion for adoption is to measure whether cost and response time improvements can be achieved while maintaining accuracy and omission rates.

- [Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch](#article-discussion-on-qualcomm-camss-isp-parameter-uapi-format-documentation-v10-patch)

  When integrating Qualcomm platform kernel drivers, it is necessary to pre-check changes to the qcom-camss-config.h uAPI structure and v4l2_isp common header.




<a id="article-aosp-cameraserver-proposes-patch-to-maintain-conditional-mute-during-privacy-tog"></a>

## 2. AOSP cameraserver proposes patch to maintain conditional mute during privacy toggle

_AOSP Gerrit (camera changes under review)_

An Android patch has been proposed to maintain the connection and only block video for on-screen apps when camera access is turned off. This applies only to devices that support this behavior and is not yet a confirmed change.

### Camera HAL/Driver perspective: what it means

This is a matter to check whether only video is blocked while the connection is maintained for apps displayed on screen on supported devices. It is also necessary to check whether devices that do not support the feature and other apps are disconnected as before.


![](../../../assets/images/fallback/newsletter-default.svg)


This proposal aims to distinguish between obscuring camera video and disconnecting an app's camera connection. For example, during a video conference where camera access is blocked, if the app is visible on screen and the device supports camera mute, the video is blocked while the connection is maintained. Otherwise, the connection is disconnected as before. Here, "mute" refers to blocking camera video, not microphone muting. This proposal aims to reduce unnecessary connection terminations while maintaining privacy protection and is not yet a fully implemented feature.

Gerrit change 4348947, submitted to the android17-release branch on October 7, proposes modifying the privacy handling path in CameraService.cpp. The reviewed revision is still in a NEW state and is not yet a change fully reflected in Android.

The commit message explains that SensorPrivacyManager callbacks and AppOpsManager's opChanged() are executed via different binder paths for the same privacy toggle. The patch author points out that opChanged() checks for UID visibility and camera mute support, but if an unconditional block() in another path is executed first, it sends ERROR_CAMERA_DISABLED and disconnects the client.

### Mute application conditions and maintained blocking path

The diff adds the same condition check to blockAllClients() and blockPrivacyEnabledClients(). setCameraMute(true) is called only when the UID's process state is PROCESS_STATE_BOUND_TOP or lower and supportsCameraMute() is true; otherwise, the existing block() is maintained. The commit message explains that the mute support determination is related to ANDROID_SENSOR_AVAILABLE_TEST_PATTERN_MODES.

blockClientsForUid(), used when a UID becomes inactive, is not changed in this patch. Therefore, it should not be interpreted as a change that maintains camera sessions for all apps. No measured results for race resolution or performance improvement on devices have been provided, so the patch's intent and actual verification results should be distinguished.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)

---

<a id="article-fixes-nullpointerexception-and-session-timeouts-that-occurred-during-early-compl"></a>

## 3. Fixes NullPointerException and session timeouts that occurred during early completion callbacks for Camera Extensions

_AndroidX Gerrit Camera_

An exception that caused abnormal termination of the handler thread when a capture completion callback arrived early while using the CameraX Extension API has been resolved by improving the synchronization structure.

### Camera HAL/Driver perspective: what it means

When integrating Camera Extensions, check for exceptions in the CXCP-Camera-H thread under early completion callback conditions and track the reflection status in library and product builds.


![](../../../assets/images/fallback/android.svg)


In environments using camera extension features, a NullPointerException was reported due to a timing race where the onCaptureSequenceCompleted callback was sent before onCaptureStarted when rapidly opening and closing sessions. This exception also caused session timeouts.

According to the root cause analysis, the completion callback of ExtensionCaptureCallback does not provide a frame number, while Camera2CaptureCallback requires a frame number. To link these, a composite frame number per session was tracked in the internal extensionSessionMap. However, if the session was interrupted immediately after starting and before capturing a frame, the map would not contain a value, leading to a null pointer exception. This exception terminated the looper of the single-threaded CXCP-Camera-H handler, causing all subsequent capture session configurations to time out.

### Map synchronization and safe allocation of composite frame numbers

The development team modified the code to wrap extensionSessionMap with Collections.synchronizedMap and apply the computeIfAbsent method when onCaptureSequenceCompleted is called. This safely allocates and delivers a valid composite frame number even if onCaptureStarted is not called beforehand.

Additionally, the getOrPut method was applied to the onCaptureFailed path of the Android S-specific callback handler to prevent null pointer risks during early failure dispatch. To verify the fix, one should simulate a timing where a session is immediately terminated or closed after creation and before frame capture, and observe whether no exception logs are printed to the CXCP-Camera-H thread and capture completion notifications are processed normally. This source's Gerrit merge status has been confirmed, but its inclusion in actual release packages and device builds is unconfirmed.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [AndroidX Gerrit Change 4334156](https://android-review.googlesource.com/c/platform/frameworks/support/+/4334156)

---

<a id="article-introduction-of-camera2capturesequenceprocessor-s-partial-surface-capture-reques"></a>

## 4. Introduction of Camera2CaptureSequenceProcessor's partial Surface capture request rejection and retry mechanism

_AndroidX Gerrit Camera_

Logic has been added to the CameraPipe pipeline to preserve capture requests submitted with some Surfaces not ready in the command queue and retry them, preventing loss.

### Camera HAL/Driver perspective: what it means

Check the partial Surface request rejection and retry behavior based on the GraphLoop invalidate signal in an asynchronous Surface binding time lag environment.


![](../../../assets/images/fallback/newsletter-default.svg)


During camera session initialization and stream setup, it is possible for Surface bindings of all output streams not to complete simultaneously, leading to a time lag.

In the previous Camera2CaptureSequenceProcessor implementation, when an incomplete request with only some stream Surfaces ready was received, the command was immediately removed from the command queue even though it could not be processed correctly. This led to a problem where streaming resumption was lost because no previous request remained in the queue even if Surface binding was completed later.

### Queue preservation of incomplete requests and Invalidate retry

This patch revamps the internal submission validation of the pipeline, modifying it to reject requests where valid Surfaces corresponding to all streams are not bound in the build and submit stages, and to preserve them in the command queue.

Subsequently, when GraphLoop receives an Invalidate command, it retrieves the requests remaining in the queue and retries them. To directly verify this behavior, one should simulate an incomplete Surface binding state to induce request rejection, then send an invalidate signal, and observe whether the requests in the queue are retried and submitted normally in the logs. This change has been confirmed as merged in Gerrit source, but its official library distribution and inclusion in device builds are unconfirmed.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [AndroidX Gerrit Change 4352209](https://android-review.googlesource.com/c/platform/frameworks/support/+/4352209)

---

<a id="article-cameradevice-forced-termination-quirk-to-bypass-session-reconfiguration-delays-o"></a>

## 5. CameraDevice forced termination quirk to bypass session reconfiguration delays on specific Android 16 devices

_AndroidX Gerrit Camera (Gerrit Change 4341473)_

To prevent frames from stopping when rebinding use cases or switching between front and rear cameras, a quirk rule has been extended for specific Android 16 devices to completely close and reopen the CameraDevice itself during session transitions.

### Camera HAL/Driver perspective: what it means

This patch bypasses stream flush failures by forcing the device to be completely closed and reopened at the higher CameraX level, instead of directly modifying the camera3_device_t handle or flush logic within the HAL or framework.


![](../../../assets/images/fallback/android.svg)


When camera apps switch between front and rear lenses or unbind and rebind multiple use cases, a stagnation phenomenon has been reported where no frames are received in the next session. This symptom has been observed particularly on certain Samsung Galaxy series Snapdragon devices running Android 16 (API 36) or higher.

The root cause was a state mismatch between the framework and the underlying native layer. A delayed binder onDeviceIdle callback during initial session setup prematurely overwrote CameraDeviceImpl's mIdle flag to true while repetitive requests were already running. This caused the framework's flush logic to incorrectly assume an idle state when abortCaptures was called to stop a subsequent session, returning without calling the native HAL's flush. Additionally, an old native camera3_device_t handle closed in a previous instance was maintained, leading to failures in the SignalStreamFlush stage of the HAL stream flush mediator.

The Google AndroidX team has added Galaxy S22 to S24 series models (sm-s901, sm-s906, sm-s908, sm-s911, sm-s916, sm-s918, sm-s921, sm-s926, sm-s928) running Android 16 or higher and based on Qualcomm hardware to the target of CloseCameraDeviceOnCameraGraphCloseQuirk. When this rule is activated, instead of just reconfiguring the session on the same device instance, CameraDevice is explicitly closed each time CameraGraph is closed, safely reinitializing native handles and idle flag states from scratch.

This patch has been merged into the AndroidX open-source main branch, but the timing of its official library distribution or inclusion in commercial device firmware needs separate verification. Practical engineers can configure a scenario that unbinds ImageAnalysis or Preview and repeatedly switches camera directions on the target devices, then check whether new frame proxies are delivered normally within 3 seconds without residual requests or flush delays from the previous session.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Close camera device on graph close to prevent session reconfiguration stalls - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4341473)

---

<a id="article-restricting-dynamic-range-profiles-to-sdr-on-devices-missing-10-bit-capability-d"></a>

## 6. Restricting dynamic range profiles to SDR on devices missing 10-bit capability declaration

_AndroidX Gerrit Camera (Gerrit Change 4350587)_

Even if 10-bit dynamic range profiles are listed in camera metadata, if the device does not declare 10-bit capability, CameraX will not interpret the profiles and will only report SDR support.

### Camera HAL/Driver perspective: what it means

When implementing HAL, exposing only 10-bit HDR profile keys and omitting the DYNAMIC_RANGE_TEN_BIT capability results in a breach of contract with the higher framework, making metadata consistency verification essential.


![](../../../assets/images/fallback/newsletter-default.svg)


An abnormal configuration has been found on some Android devices where the CameraCharacteristics' dynamic range profile list is populated with 10-bit profiles like HLG10, but the device's supported capabilities array, REQUEST_AVAILABLE_CAPABILITIES, is missing REQUEST_AVAILABLE_CAPABILITIES_DYNAMIC_RANGE_TEN_BIT. The Lenovo TB520FU model was identified as an example.

According to the Camera2 specification, 10-bit output stream configurations are only valid on devices where this capability is officially declared. Without this capability, the underlying cameraserver rejects 10-bit configurations that fall outside the standard range. However, the existing CameraX's DynamicRangeProfilesCompat did not compare the capabilities array and only read the profile list, concluding that HLG10 was supported. As a result, when an app set a 10-bit DynamicRange and bound a use case, it failed to find a matching surface combination during SupportedSurfaceCombination validation, causing an exception and the binding itself to fail.

This patch strengthens the condition for parsing dynamic range profiles in DynamicRangeProfilesCompat.fromCameraMetaData, requiring the system version to be API 33 or higher AND cameraMetadata.supportsDynamicRangeTenBit to be true. If the capability is not declared, only SDR support is reported, regardless of what is written in the profile list. Additionally, DynamicRangeResolver skips querying recommended 10-bit profiles if 10-bit capability is disabled. Consequently, unspecified dynamic range requests are resolved to SDR normally, but if an app explicitly requests a 10-bit dynamic range, it is not automatically converted to SDR, and the request is rejected with an IllegalArgumentException during supported surface combination validation.

During inspection, one can observe whether a use case configured with an unspecified dynamic range on a device without 10-bit capability declared binds to SDR normally, and conversely, whether an IllegalArgumentException occurs as intended when an explicit 10-bit configuration is requested. This is a verification suggestion derived from the patch's test code and not actual device measurement results. The current confirmed status is up to the merge into the androidx-main branch of platform/frameworks/support, and whether it has been reflected in official CameraX library releases and commercial device product builds is unconfirmed. HAL implementation teams should check the consistency of 10-bit profile keys and capability declarations with internal dumps.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Gate dynamic range profiles on DYNAMIC_RANGE_TEN_BIT capability - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4350587)

---

<a id="article-camerapipe-capturesessionstate-refactoring-prevents-loss-of-delayed-surface-requ"></a>

## 7. CameraPipe CaptureSessionState refactoring prevents loss of delayed surface requests

_AndroidX Gerrit Camera (Gerrit Change 4337073)_

A synchronization defect in CameraPipe, CameraX's next-generation backend, has been resolved, where initial capture requests were not retransmitted and stalled when delayed surfaces were registered immediately after session creation.

### Camera HAL/Driver perspective: what it means

Although it is not a change to the HAL driver interface contract, it is useful for verifying the reliability of initial stream request ingress because pending capture requests are fully received immediately after session configuration in delayed surface patterns.


![](../../../assets/images/fallback/newsletter-default.svg)


In CameraPipe-based pipelines, when using a delayed surface structure where a session is initialized before the surface is ready, a concurrency defect existed that caused requests to be lost due to a timing issue between the session start callback and the output configuration completion.

In the existing synchronization structure, a race condition was triggered in environments where createCaptureSession returned immediately or the underlying onConfigured callback arrived extremely quickly. onGraphStarted callbacks were unintentionally called multiple times or in reverse order, being called belatedly after output finalization. Additionally, if a second onGraphStarted was received by the same GraphRequestProcessor instance, the GraphLoop queue could not be updated, and the internal retry allowance flag was turned off during output configuration finalization, preventing pending capture requests from being delivered to the camera driver even after delayed surfaces were placed.

This change redesigns the transition model by introducing a new state called STARTED in CaptureSessionState. When session creation is complete, onGraphStarted is called before output finalization, and the state transitions to STARTED. Furthermore, the condition that restricted retries within finalizeOutputsIfAvailable was removed, correcting the synchronization flow so that pending capture requests in the queue are retransmitted without loss via onGraphModified as soon as delayed surfaces are received.

When conducting inspections, one can configure a scenario where a delayed surface is bound belatedly immediately after session creation, and observe whether onGraphStarted is called exactly once and onGraphModified is received when the delayed surface is registered, causing pending requests to be transmitted to the underlying pipeline. This is an editing suggestion based on the patch's unit test structure and is not a report of actual device measurements.

Currently, this fix has been merged into the androidx-main branch of platform/frameworks/support. However, its official CameraX library release distribution or reflection in commercial device firmware builds has not been confirmed, and it does not change the Camera HAL3 interface or the system-level Camera2 API specification itself.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Rework CaptureSessionState state model and synchronization - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073)

---

<a id="article-claude-haiku-5-5-low-cost-auxiliary-model-for-repetitive-coding-tasks"></a>

## 8. Claude Haiku 5.5: Low-cost auxiliary model for repetitive coding tasks

_Anthropic News Official Announcement_

The need to rely on large models for repetitive tasks like build error summarization or simple classification is reduced. Anthropic has announced Haiku 5.5, targeting these tasks and coding auxiliary agents.

### Camera HAL/Driver perspective: what it means

Development tool managers can compare the current model and Haiku 5.5 using build error log summarization and classification samples. The criterion for adoption is to measure whether cost and response time improvements can be achieved while maintaining accuracy and omission rates.


![Anthropic small AI model Claude Haiku 5.5 announcement and utilization in native development workflow](https://www-cdn.anthropic.com/images/4zrzovbb/website/89e9b0fbfe0181f6ca565d913686ce8e49b5e9c2-1200x630.jpg)

_Image: [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)_


Claude Haiku 5.5, announced on October 7, is a small language model focused on quickly processing many requests while reducing costs. The official announcement lists summarization, conversation compression, database querying, and classification as representative repetitive tasks.

For coding, it suggests using it as an auxiliary agent alongside Opus 5.5 or Sonnet 5.5. This can be understood as a larger model managing the overall task, and delegating smaller, divisible tasks to Haiku. Which tasks to separate should be determined by the team's actual input and result quality.

### An option to adjust both cost and accuracy

Anthropic explains that Haiku 5.5 has an average execution cost approximately 75% lower than Haiku 4.5. This is an average comparison provided by the vendor, and there is no guarantee that all requests or our team's monthly costs will decrease by the same amount. The "effort" setting, introduced for the first time in the Haiku series, is a means to adjust the trade-off between cost and response performance.

Camera HAL development teams can use build error log summarization and classification as a test case. This is an editorial suggestion and does not mean that the original text verified performance on Camera HAL logs. By providing the same samples to the current model and Haiku, and comparing the accuracy rate, the rate of missing critical errors, cost per request, and response time, a decision can be made on whether to adopt it.

The practical value of this news is the availability of an option to delegate repetitive tasks to a separate model. Tasks with sufficient performance should be separated first, but this should not be used as a basis for wholesale conversion of complex root cause analysis.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)

---

<a id="article-discussion-on-qualcomm-camss-isp-parameter-uapi-format-documentation-v10-patch"></a>

## 9. Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch

_lore.kernel.org linux-media list_

A patch series documenting the V4L2 metadata format for controlling Qualcomm CAMSS subsystem's ISP parameters is being reviewed at v10 revision.

### Camera HAL/Driver perspective: what it means

When integrating Qualcomm platform kernel drivers, it is necessary to pre-check changes to the qcom-camss-config.h uAPI structure and v4l2_isp common header.


![](../../../assets/images/fallback/newsletter-default.svg)


On October 6, review comments were posted on the linux-media mailing list regarding the PATCH v10 documentation patch submitted on September 25. This patch includes a proposal for the V4L2_META_FMT_QCOM_ISP_PARAMS metadata format for Qualcomm CAMSS ISP parameters. This format is designed based on the common V4L2 extensible ISP parameter structure.

The ope_params node of the Offline Processing Engine (OPE), a key component, is the first to utilize this metadata format. It configures hardware modules such as white balance gain, color correction matrix, and gamma curve by placing block-unit structures inside the metadata buffer.

### Discussion on uAPI structure and header compatibility

During the review process, opinions were exchanged regarding the application of the common ISP structures, v4l2_isp_buffer and v4l2_isp_block_header. Standardization efforts within the kernel are ongoing towards using common structures instead of structures for compatibility with older legacy drivers.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)


## References

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)
- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)
- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)
- [AndroidX Gerrit Change 4334156](https://android-review.googlesource.com/c/platform/frameworks/support/+/4334156)
- [AndroidX Gerrit Change 4352209](https://android-review.googlesource.com/c/platform/frameworks/support/+/4352209)
- [Close camera device on graph close to prevent session reconfiguration stalls - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4341473)
- [Gate dynamic range profiles on DYNAMIC_RANGE_TEN_BIT capability - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4350587)
- [Rework CaptureSessionState state model and synchronization - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073)
