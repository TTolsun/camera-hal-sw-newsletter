# 2026 W47 (11.16 ~ 11.22)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week's newsletter covers significant updates to higher-level frameworks, including the CameraX 1.7.0 release and Camera2 Pipe 3A control changes. Notably, CameraX 1.7.0 stabilizes Camera2Interop V2, supporting direct physical camera binding. Cases like ZSL disabling on the Samsung SM-F971 device and the exclusion of physical cameras on the Oppo Find N3 Flip illustrate HAL and driver-level issues on specific devices. We also report on the temporary suspension of the encoder input surface to prevent frame collisions before video recording starts.

- [CameraX 1.7.0 Release: Camera2Interop V2 Stabilized and Direct Physical Camera Binding](#article-camerax-1-7-0-release-camera2interop-v2-stabilized-and-direct-physical-camera-bi)

  Although not a direct HAL change, the higher-level framework now directly connects UseCase objects to physical streams under logical cameras. Prior checks are needed to ensure that vendor pipelines do not omit OutputConfiguration configurations per physical camera or fail to return metadata during physical lens switching.

- [Camera2 Pipe 3A Control Change: Unsupported Modes Return SUBMIT_FAILED Immediately](#article-camera2-pipe-3a-control-change-unsupported-modes-return-submit-failed-immediatel)

  Although not a contract change to the HAL or driver itself, the higher-level framework now strictly compares requested 3A capabilities against those declared in CameraMetadata. If supported modes are incorrectly declared in CameraCharacteristics, 3A control will immediately fail in higher-level apps, requiring validation of vendor tags and static metadata consistency.

- [Samsung SM-F971 ZSL Disabled: Prevents Stalling During Physical Lens Zoom Transitions](#article-samsung-sm-f971-zsl-disabled-prevents-stalling-during-physical-lens-zoom-transit)

  This is an example of a conflict between the reprocessing stream within the vendor HAL and the multi-camera SAT transition logic. Vendor HAL driver buffer management should be checked to ensure that the vendor HAL does not miss frame result callbacks or stall during flush when switching physical lenses in a reprocessing session.

- [Oppo Find N3 Flip Physical Camera Exclusion: Resolves Stalling When Targeting Specific Lenses](#article-oppo-find-n3-flip-physical-camera-exclusion-resolves-stalling-when-targeting-spe)

  This demonstrates that the vendor HAL's streaming node and session flush logic can deadlock when configuring specific physical sensor streams under a logical camera. Vendor HAL development teams should carefully review the session termination sequence and watchdog timeout points when branching physical streams.

- [Preventing Frame Collisions Before Video Recording: Suspending Encoder Input Surface](#article-preventing-frame-collisions-before-video-recording-suspending-encoder-input-surf)

  Although not an interface change to the Camera HAL itself, this is a significant synchronization improvement for the downstream path where camera frame buffers are delivered to the video encoder via a Surface. It is useful for understanding the impact of drop behavior before codec start when the camera pipeline pushes frames to the encoder surface.




<a id="article-camerax-1-7-0-release-camera2interop-v2-stabilized-and-direct-physical-camera-bi"></a>

## 2. CameraX 1.7.0 Release: Camera2Interop V2 Stabilized and Direct Physical Camera Binding

_Android Developers Latest Updates_

CameraX 1.7.0 has been officially released, and Camera2Interop V2 has transitioned to a stable state by default. Developers can now directly select and bind physical cameras from the higher-level app interface without additional opt-in.

### Camera HAL/Driver perspective: what it means

Although not a direct HAL change, the higher-level framework now directly connects UseCase objects to physical streams under logical cameras. Prior checks are needed to ensure that vendor pipelines do not omit OutputConfiguration configurations per physical camera or fail to return metadata during physical lens switching.


![CameraX 1.7.0 Release: Camera2Interop V2 Stabilization and Physical Camera Binding Support](https://developer.android.com/static/images/social/android-developers.png)

_Image: [CameraX Release Notes - CameraX 1.7.0](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0)_


Google's CameraX 1.7.0 release, distributed on November 18, 2026, significantly refines interoperability between the higher-level framework and the lower-level Camera2. In this version, Camera2Interop V2, previously an experimental stage, has been stabilized and is now provided by default without a separate opt-in.

The redesigned interface introduces ImageWrapper and ImagePlane with non-nullable ByteBuffer. ImageProxy and ImageProxy.PlaneProxy implement this wrapper specification, and test objects such as FakeImage and FakeCameraCharacteristics are also provided.

Major changes have also been applied to the multi-camera control path. Developers can obtain a CameraSelector dedicated to physical cameras by calling CameraInfo.getPhysicalCameraInfos, and bind individual UseCase objects directly to specific physical sensors. Querying getCameraInfo with the corresponding Selector returns actual physical camera information instead of logical camera information.

In terms of 3A control, a lock mode has been added to FocusMeteringAction. Developers can specify FLAG_AE and FLAG_AWB to lock them, or FLAG_AF behavior to update only the metering region while maintaining continuous autofocus mode. Additionally, NightModeIndicator for low-light environment detection and logic to prevent conflicts between torch and low-light boost are officially included.

This change is a framework layer operation of the Jetpack CameraX library. The underlying Camera HAL3 interface specification itself has not changed, but since the physical stream branching and 3A metadata combinations requested by the app are directly linked to the actual vendor HAL, interactions should be carefully observed.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [CameraX Release Notes - CameraX 1.7.0](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0)

---

<a id="article-camera2-pipe-3a-control-change-unsupported-modes-return-submit-failed-immediatel"></a>

## 3. Camera2 Pipe 3A Control Change: Unsupported Modes Return SUBMIT_FAILED Immediately

_AndroidX Gerrit Camera_

If a camera app requests auto-exposure or focus modes not supported by the device, the request will immediately fail instead of lingering in an internal queue. The AndroidX Camera2 Pipe library has merged a validation branch that blocks unnecessary requests from reaching the lower stack.

### Camera HAL/Driver perspective: what it means

Although not a contract change to the HAL or driver itself, the higher-level framework now strictly compares requested 3A capabilities against those declared in CameraMetadata. If supported modes are incorrectly declared in CameraCharacteristics, 3A control will immediately fail in higher-level apps, requiring validation of vendor tags and static metadata consistency.


![](../../../assets/images/fallback/newsletter-default.svg)


When a camera app requests 3A modes not supported by the vendor hardware, delays or unpredictable behavior can occur within the pipeline. A change (Change 4439488) merged into the AndroidX androidx-main branch on November 19, 2026, filters out such invalid requests at the entry stage.

Before the fix, unsupported modes risked being passed to the repeating request queue or lower frameworks. This patch adds areModesSupported checks at the beginning of the Controller3A's lock3A, submit3A, and update3A methods. If the requested AE, AF, AWB, Flash, or Control modes are not in CameraMetadata's supported list, the methods immediately return a SUBMIT_FAILED result.

In this case, the existing 3A state remains unchanged. Additionally, the check function logs a warning for each unsupported item, allowing immediate identification of which modes conflict with device specifications during debugging.

### On-site Diagnosis and Verification Methods

If 3A locking or parameter updates fail on a specific device, it is recommended to first check logcat for warning messages by filtering with Log.TAG. If Unsupported aeMode or Unsupported afMode logs appear, the app has sent a request outside the supported list in CameraCharacteristics.

This change is currently merged into the AndroidX source tree. The actual distribution of official library release artifacts or inclusion in individual product device builds requires separate distribution processes for verification.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Check if 3A modes are supported in Controller3A - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488)

---

<a id="article-samsung-sm-f971-zsl-disabled-prevents-stalling-during-physical-lens-zoom-transit"></a>

## 4. Samsung SM-F971 ZSL Disabled: Prevents Stalling During Physical Lens Zoom Transitions

_AndroidX Gerrit Camera_

To prevent the screen from freezing when zooming on Samsung SM-F971 devices, the Zero Shutter Lag feature has been disabled. This is a workaround for an issue where vendor pipeline callbacks were interrupted during reprocessing sessions.

### Camera HAL/Driver perspective: what it means

This is an example of a conflict between the reprocessing stream within the vendor HAL and the multi-camera SAT transition logic. Vendor HAL driver buffer management should be checked to ensure that the vendor HAL does not miss frame result callbacks or stall during flush when switching physical lenses in a reprocessing session.


![](../../../assets/images/fallback/newsletter-default.svg)


When switching between multiple physical lenses to take photos, if reprocessing buffer management is misaligned, the entire pipeline can stall. An AndroidX change (Change 4441195) merged on November 17, 2026, addresses a zoom transition stall observed on Samsung SM-F971U1 devices.

When the device was configured with a PRIVATE reprocessing ZSL session and the zoom ratio was switched between physical lenses, the CamX SAT pipeline stalled. For example, when transitioning from 0.6 wide-angle to 2.0 telephoto, TotalCaptureResult for new repeating requests was not delivered, causing the setZoomRatio asynchronous operation to time out.

According to the original commit, all zoom transitions and captures operated normally without delay in a regular non-ZSL session. Consequently, the development team added the SM-F971 model prefix to the ZslDisablerQuirk target list. Now, ImageCapture on the affected device will switch to standard still capture instead of ZSL.

### Field Diagnosis and Limitations of Application

If the screen update freezes and a timeout occurs during zoom adjustment on a specific device, developers can check existing logs for TotalCaptureResult delivery and ZSL activation status to identify the cause. If the stall disappears when forced into general capture mode, a ZSL reprocessing pipeline conflict is likely. The application of the workaround can be verified by querying if CameraInfo.isZslSupported returns false.

This patch is a source code modification merged into AndroidX Gerrit. Its formal release in the library and inclusion in commercial firmware builds for actual devices must be verified separately.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Disable ZSL on Samsung SM-F971 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195)

---

<a id="article-oppo-find-n3-flip-physical-camera-exclusion-resolves-stalling-when-targeting-spe"></a>

## 5. Oppo Find N3 Flip Physical Camera Exclusion: Resolves Stalling When Targeting Specific Lenses

_AndroidX Gerrit Camera_

A problem where the camera service would forcibly terminate on Oppo Find N3 Flip devices when directly specifying a particular physical camera to open a stream has been resolved. A patch has been merged at the library level to exclude these physical lens IDs from the exposure list.

### Camera HAL/Driver perspective: what it means

This demonstrates that the vendor HAL's streaming node and session flush logic can deadlock when configuring specific physical sensor streams under a logical camera. Vendor HAL development teams should carefully review the session termination sequence and watchdog timeout points when branching physical streams.


![](../../../assets/images/fallback/android.svg)


On multi-camera devices, when an app directly configures a stream with a specific auxiliary lens, the vendor driver can enter an unexpected deadlock. An AndroidX change (Change 4440995) merged on November 17, 2026, is a measure to ensure stability for the Oppo Find N3 Flip device.

On the Oppo PHT110 model, which uses the MediaTek mt6985 platform, problems occurred when physical camera IDs 2 or 3, subordinate to the rear logical camera (ID 0), were specified as targets for OutputConfiguration. Stalling occurred during the P2StreamingNode frame capture and BasicSession flush cleanup steps within the vendor HAL. This led to camerahalserver and cameraserver watchdogs triggering, resulting in a critical failure where the camera connection was forcibly terminated.

The development team added PHT110 and the excluded IDs 2 and 3 to the ExcludePhysicalCameraIdQuirk's problematic model list. After applying the patch, calling CameraInfo.getPhysicalCameraInfos will completely hide information about these physical cameras from the list.

### On-site Diagnosis and Verification Methods

If ERROR_CAMERA_DEVICE or CAMERA_DISCONNECTED occurs when opening a physical camera stream on a device, you can identify the cause by comparing logcat's camerahalserver watchdog logs with BasicSession flush timeout records. To verify that the workaround has been correctly applied, check if physical IDs 2 and 3 are missing from the list returned by CameraInfo.getPhysicalCameraInfos.

This fix is a source code change merged into AndroidX Gerrit. The related bug content mentioned in the commit has not been directly verified, and the inclusion in actual distributed libraries and final device commercial build reflection also requires separate verification.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Exclude OPPO PHT110 physical camera IDs 2 and 3 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995)

---

<a id="article-preventing-frame-collisions-before-video-recording-suspending-encoder-input-surf"></a>

## 6. Preventing Frame Collisions Before Video Recording: Suspending Encoder Input Surface

_AndroidX Gerrit Camera_

If camera buffers are delivered to the encoder just before the record button is pressed, errors can occur at the start of video. The AndroidX Video library has changed its behavior to safely discard incoming frames before the encoder starts.

### Camera HAL/Driver perspective: what it means

Although not an interface change to the Camera HAL itself, this is a significant synchronization improvement for the downstream path where camera frame buffers are delivered to the video encoder via a Surface. It is useful for understanding the impact of drop behavior before codec start when the camera pipeline pushes frames to the encoder surface.


![](../../../assets/images/fallback/android.svg)


When camera preview and recording pipelines operate simultaneously, if the encoder start and frame transmission timings are misaligned, problems can arise during the codec initialization phase. An AndroidX change (Change 4400407) merged on November 20, 2026, corrects this synchronization flaw.

The existing EncoderImpl would pre-configure MediaCodec and connect a persistent input surface, then wait. However, the higher-level Recorder would mark the video stream as active before initializing the audio device and calling start. As a result, rendered frames from the camera accumulated in GraphicBufferSource while the codec was still in a configuring state.

These frames were immediately submitted inside MediaCodec.start, and processed before CCodecBufferChannel could finish initializing its output buffer pool, leading to an unstable state.

To resolve this, the MediaFormat.KEY_CREATE_INPUT_SURFACE_SUSPENDED flag was set to 1 for API 29 and above. While the codec is preparing, the persistent input surface automatically discards incoming camera frames. Immediately after the mMediaCodec.start call completes, the suspended state is released, and normal encoding begins.

### On-site Diagnosis and Verification Methods

If encoder errors or first-frame collisions are suspected immediately after entering video recording, checking the presentationTimeUs of the first encoded output is an effective method. You can observe whether frames with timestamps preceding the recording start time are not ingested into the encoder, and normal keyframes are generated only from after the start time.

This fix is a code change merged into AndroidX Gerrit. The related bug content mentioned in the commit has not been directly verified, and the inclusion in actual distributed libraries and final device commercial build reflection also requires separate verification.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Suspend video encoder input surface until start - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407)


## References

- [CameraX Release Notes - CameraX 1.7.0](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0)
- [Check if 3A modes are supported in Controller3A - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488)
- [Disable ZSL on Samsung SM-F971 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195)
- [Exclude OPPO PHT110 physical camera IDs 2 and 3 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995)
- [Suspend video encoder input surface until start - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407)
