# 2026 W33 (08.10 ~ 08.16)

This week covers ‘CameraX 1.7.0-alpha03 released: Camera2Interop API overhaul and multi-camera ZSL HAL crash fix’.



## 1. This week’s articles

- CameraX 1.7.0-alpha03 released: Camera2Interop API overhaul and multi-camera ZSL HAL crash fix

## 2. CameraX 1.7.0-alpha03 released: Camera2Interop API overhaul and multi-camera ZSL HAL crash fix


![CameraX 1.7.0-alpha03 released: Camera2Interop API overhaul and multi-camera ZSL HAL crash fix](https://developer.android.com/static/images/social/android-developers.png?hl=ar)

_Image: [CameraX Release Notes](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03)_


_Analysis of the official Android Jetpack CameraX release notes_

The recently published Android Jetpack CameraX 1.7.0-alpha03 release extensively overhauls the Camera2Interop API, the key path through which app developers interact with the underlying Camera2 and HAL layers. Along with this, a critical HAL crash bug that occurred when zooming across physical camera boundaries with ZSL (Zero-Shutter Lag) enabled on multi-camera devices was fixed, significantly improving system stability.

The biggest change in this CameraX 1.7.0-alpha03 update is the modernization of the Camera2Interop API. The legacy APIs Camera2Interop.Extender, Camera2CameraControl, Camera2CameraInfo, and CaptureRequestOptions have all been deprecated. In their place, Camera2Interop configurator factory methods (forUseCase, forImageCapture, forSessionConfig, forCameraControl) and Kotlin DSL extension functions that support more intuitive and safer configuration were introduced. With these, developers can easily inject underlying Camera2 parameters at the use case builder stage using the setInterop or applyInteropAsync methods.

In addition, the setMirrorMode and getMirrorMode APIs for controlling mirror mode were formally added to Preview and VideoCapture, and the previous ExperimentalMirrorMode annotation was removed. From an image processing pipeline perspective, the return type of ImagePlane.buffer was changed to a non-nullable ByteBuffer, fundamentally eliminating the risk of a NullPointerException during frame analysis (ImageAnalysis). Property getters such as those of SessionConfig.Builder are also restricted to write-only in the Kotlin DSL to prevent configuration misuse.

The part that the lower HAL and driver layers should note most is the improved ZSL (Zero-Shutter Lag) stability on multi-camera devices. Previously, in multi-camera environments, changing zoom across boundaries between physical cameras with ZSL enabled caused a HAL crash due to a stream control mismatch between the framework and the HAL. This release fixes that crash, ensuring stable frame capture even during zoom operations. In addition, HDR video recording failures on Samsung Galaxy S25, S26, and Fold 7 devices, and a bug where one of multiple Preview streams was not delivered when using OverlayEffect, were also fixed.

### Camera HAL/Driver perspective implications

This change is not a direct HAL3 specification change, but it is closely tied to how the upper framework passes requests to the HAL. In particular, the fix for the HAL crash when switching zoom between physical cameras with ZSL enabled (b/527782712) suggests that multi-camera stream configuration and buffer lifecycle control logic should be reviewed. Also, as in the fix for HDR video recording failures on specific vendor devices such as the Samsung Galaxy S25/S26/Fold 7 (b/529618629), you should verify through VTS and your own scenario tests that no exceptions occur in vendor-specific HDR metadata handling and codec integration.

**Sources**

- [CameraX Release Notes - CameraX 1.7.0-alpha03](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03)


## Further reading

- [Camera ITS tests](<https://source.android.com/docs/compatibility/cts/camera-its-tests>) — AOSP Site Updates (2026-07) · Reference on the AOSP Camera framework
- [Camera ITS overview](<https://source.android.com/docs/compatibility/cts/camera-its>) — AOSP Site Updates (2026-07) · Reference on the AOSP Camera framework
- [\[PATCH\] media: v4l2-isp: reject zero-sized parameter blocks](<https://lore.kernel.org/linux-media/20260815193839.141406-1-devnexen@gmail.com/>) — lore.kernel.org linux-media list (2026-08-15) · Reference on camera drivers / image pipelines
- [\[PATCH\] media: uvcvideo: Do not read beyond the uvc_status_control memory](<https://lore.kernel.org/linux-media/20260813-uvc-status-11-v1-1-2cf43e9590b0@chromium.org/>) — lore.kernel.org linux-media list (2026-08-13) · Reference on camera drivers / image pipelines

## References

- [CameraX Release Notes - CameraX 1.7.0-alpha03](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03)
