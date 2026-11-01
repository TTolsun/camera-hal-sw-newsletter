# 2026 W44 (10.26 ~ 11.01)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week's newsletter brings news of improved stability and compatibility in the camera pipeline. First, CameraX Recorder prevents recording freezes by clearing residual pointers when releasing a Surface. Camera2 Pipe FrameBuffer now includes validation logic to check if a stream set is included, preventing buffering errors. Additionally, a workaround was implemented for the Sony Xperia 1 V device to prevent video snapshots from stopping when sharing four use case streams. Camera2 Extensions' Ultra HDR (JPEG_R) resolution query is now limited to API 35 and above to enhance stability. We hope this helps with your development.

- [Workaround for Sony Xperia 1 V video snapshot hang when sharing four use case streams](#article-workaround-for-sony-xperia-1-v-video-snapshot-hang-when-sharing-four-use-case-st)

  This shows that if a HAL refuses to process a specific request template based on the session configuration stream type, it can be resolved by adjusting the capture intent at the framework level. When dealing with similar stream sharing sessions in your environment, you need to check template compatibility and the buffer generation flow.

- [Added validation logic for Camera2 Pipe FrameBuffer to check if stream set is included](#article-added-validation-logic-for-camera2-pipe-framebuffer-to-check-if-stream-set-is-in)

  The framework's internal buffer management layer enforces precise matching with stream request metadata, preventing memory leaks and incorrect output reception. From a HAL development perspective, it is important to be aware that the framework strictly filters stream targets on a per-frame basis.

- [Prevent recording freezes by clearing residual pointers when CameraX Recorder's Surface is released](#article-prevent-recording-freezes-by-clearing-residual-pointers-when-camerax-recorder-s-)

  This is an example of resolving an asynchronous race condition between the completion of a lower-level encoder Surface release and the framework state machine. It also provides a method for HAL/driver pipeline developers to ensure stability in video stream stopping and Surface re-binding timing.

- [Camera2 Extensions' Ultra HDR (JPEG_R) resolution query limited to API 35 and above](#article-camera2-extensions-ultra-hdr-jpeg-r-resolution-query-limited-to-api-35-and-above)

  This patch defends against runtime crashes caused by version-specific format support differences between the platform framework and lower-level vendor extension implementations. HAL and vendor library development teams must adhere to the enumerated format specifications for each target Android version and maintain consistency to prevent unnecessary exceptions.




<a id="article-workaround-for-sony-xperia-1-v-video-snapshot-hang-when-sharing-four-use-case-st"></a>

## 2. Workaround for Sony Xperia 1 V video snapshot hang when sharing four use case streams

_AndroidX Gerrit Camera patch 4399967_

A problem where snapshot capture would hang during video recording when four use cases were bound simultaneously on the Sony Xperia 1 V device has been bypassed with a CameraX quirk.

### Camera HAL/Driver perspective: what it means

This shows that if a HAL refuses to process a specific request template based on the session configuration stream type, it can be resolved by adjusting the capture intent at the framework level. When dealing with similar stream sharing sessions in your environment, you need to check template compatibility and the buffer generation flow.


![](../../../assets/images/fallback/android.svg)


On the Sony Xperia 1 V (model xq-dq72) device, video snapshot capture would hang and not complete when Preview, VideoCapture, ImageCapture, and ImageAnalysis use cases were run simultaneously. CameraX's StreamSharing feature merges preview and video capture into a single OpenGL SurfaceTexture stream and passes TEMPLATE_RECORD as the session template to overcome hardware stream limitations.

During this process, the session does not include a GraphicBufferSource surface dedicated to the media encoder. The Sony HAL implementation interpreted this as preview and still streaming mode (mode 0 0). It then ignored TEMPLATE_VIDEO_SNAPSHOT requests, regardless of the session template, and did not produce output JPEG buffers.

### Capture intent override and verification conditions

Google has registered xq-dq72 in the ImageCaptureFailedForVideoSnapshotQuirk target device list. This change causes the capture intent to be redefined as CONTROL_CAPTURE_INTENT_STILL_CAPTURE instead of CONTROL_CAPTURE_INTENT_VIDEO_SNAPSHOT in this environment, prompting the HAL to perform JPEG processing.

This change is currently merged into the AndroidX main branch. It has not yet been distributed as an official library version or reflected in commercial product firmware. To verify similar symptoms, you can bind four use cases and then check if snapshot capture callbacks are received normally during video recording, and if there is no frame delay or pipeline congestion.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Fix video snapshot hang on Sony xq-dq72 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967)

---

<a id="article-added-validation-logic-for-camera2-pipe-framebuffer-to-check-if-stream-set-is-in"></a>

## 3. Added validation logic for Camera2 Pipe FrameBuffer to check if stream set is included

_AndroidX Gerrit Camera patch 4395726_

Validation logic has been added to the Camera2 Pipe pipeline to prevent frames that do not fully contain the streams required by a buffer from being incorrectly buffered.

### Camera HAL/Driver perspective: what it means

The framework's internal buffer management layer enforces precise matching with stream request metadata, preventing memory leaks and incorrect output reception. From a HAL development perspective, it is important to be aware that the framework strictly filters stream targets on a per-frame basis.


![](../../../assets/images/fallback/android.svg)


Inside Camera2 Pipe's FrameGraph, frame references are distributed to each FrameBuffer when frames are generated. In the previous structure, the system could not fully verify whether the streams included in the frame request metadata matched the list of streams required by the FrameBuffer. This created a risk of inappropriate frames entering the queue.

With this change, a conditional statement has been added within the FrameBufferImpl's onFrameStarted callback. It checks if the set of stream keys defined in the incoming FrameReference's requestMetadata fully contains the set of streams configured for the FrameBuffer. If the frame does not contain all required streams, processing is immediately terminated.

### Frame isolation for partial stream requests

This change ensures that when a capture request targets only a subset of specific streams, other FrameBuffers that do not include those streams will ignore the frame and preserve their existing buffer state.

This patch was merged into the source tree on 2026-10-28 and is in the pre-library release stage. When testing dynamic stream configurations or partial capture pipelines, you can refer to unit verification to ensure that incorrect frame references are not mixed into the buffer flow.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Check if buffer's stream set is contained in request metadata of the Frame - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726)

---

<a id="article-prevent-recording-freezes-by-clearing-residual-pointers-when-camerax-recorder-s-"></a>

## 4. Prevent recording freezes by clearing residual pointers when CameraX Recorder's Surface is released

_AndroidX Gerrit Camera patch 4399846_

By clearing residual pointers when a video encoder session's Surface is released, a problem where the next recording would remain in a permanent pending state after a quick screen transition has been resolved.

### Camera HAL/Driver perspective: what it means

This is an example of resolving an asynchronous race condition between the completion of a lower-level encoder Surface release and the framework state machine. It also provides a method for HAL/driver pipeline developers to ensure stability in video stream stopping and Surface re-binding timing.


![](../../../assets/images/fallback/android.svg)


A deadlock was reported in the CameraX Recorder module where video recording would not start when the app's lifecycle transitioned quickly. Previously, when the VideoEncoderSession's Surface was terminated and getReadyToReleaseFuture completed, the encoder would reset before onSourceStateChangedInternal(INACTIVE) executed on the sequential executor. This left mActiveSurface pointing to an already released Surface.

In this state, when the source deactivation (INACTIVE) signal arrived, the Recorder detected a non-null mActiveSurface. It then set the reset flag (mNeedsResetBeforeNextStart) to true before the next start, while in the CONFIGURING state. This caused the next recording request to permanently wait in the PENDING_RECORDING state.

### In-callback cleanup and audio retention

The fix explicitly initializes mActiveSurface to null in the success (onSuccess) and failure (onFailure) callbacks of getReadyToReleaseFuture. Additionally, when mActiveSurface is null during source deactivation, the change allows the audio source to be retained for persistent recording.

This change was merged into the main branch on 2026-10-30. However, its inclusion in an official library distribution or device product build has not yet been confirmed. A useful check is to confirm that the next recording starts normally without getting stuck in the PENDING_RECORDING state after quick recording start and stop, screen rotation, or reconnecting a new Surface request after a lifecycle transition.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Clear Recorder.mActiveSurface on surface release - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846)

---

<a id="article-camera2-extensions-ultra-hdr-jpeg-r-resolution-query-limited-to-api-35-and-above"></a>

## 5. Camera2 Extensions' Ultra HDR (JPEG_R) resolution query limited to API 35 and above

_AndroidX Gerrit Camera patch 4402197_

To prevent abnormal termination when querying Ultra HDR (JPEG_R) supported resolutions in camera extension features, the target API level for queries has been raised to 35 or higher.

### Camera HAL/Driver perspective: what it means

This patch defends against runtime crashes caused by version-specific format support differences between the platform framework and lower-level vendor extension implementations. HAL and vendor library development teams must adhere to the enumerated format specifications for each target Android version and maintain consistency to prevent unnecessary exceptions.


![](../../../assets/images/fallback/android.svg)


A defect that caused an exception when querying device-supported resolutions in the Camera2 Extensions vendor extension layer has been fixed. The ImageFormat.JPEG_R constant (integer value 4101) was first introduced in Android 14 (API 34). Therefore, the existing query logic was configured to query the extended supported resolutions for this format if the API was 34 or higher.

However, the getExtensionSupportedSizes and getPostviewSupportedSizes methods, which are internal implementations of CameraExtensionCharacteristics on the API 34 platform, were hardcoded to only allow two formats: JPEG and YUV_420_888. Consequently, querying JPEG_R on an API 34 device resulted in an IllegalArgumentException, indicating an unsupported format.

### Elevated extension query guard and verification

JPEG_R support in camera extensions was officially added in Android 15 (API 35). Accordingly, the still capture and postview format query guard in Camera2ExtensionsVendorExtender has been raised to Build.VERSION_CODES.VANILLA_ICE_CREAM (API 35) or higher. Now, in an API 34 environment, only JPEG and YUV_420_888 are queried.

This fix is a source code change merged into the Gerrit androidx-main branch on October 30, 2026. The confirmed scope is the commit merge in the main development branch. It has not yet been confirmed whether it is included in an actual distributed library, a formal CameraX release version, or a commercial device product build from a specific manufacturer. You can pre-check for conflicts in the 4101 format query stage during camera extension initialization in an Android 14 device environment.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Only query JPEG_R extension sizes on API 35+ in Camera2ExtensionsVendorExtender - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197)


## Further reading

- [Add default implementation for CameraMetadata#isExtensionSupported - platform/frameworks/support](<https://android-review.googlesource.com/c/platform/frameworks/support/+/4393805>) — AndroidX Gerrit Camera (2026-10-30) · Reference for AOSP Camera framework

## References

- [Fix video snapshot hang on Sony xq-dq72 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967)
- [Check if buffer's stream set is contained in request metadata of the Frame - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726)
- [Clear Recorder.mActiveSurface on surface release - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846)
- [Only query JPEG_R extension sizes on API 35+ in Camera2ExtensionsVendorExtender - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197)
