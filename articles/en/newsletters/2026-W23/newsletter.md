# 2026 W23 (06.01 ~ 06.07)

This week covers ‘CameraX 1.6.0 Stable Release: Use-Case Pre-Query API Introduced and Numerous Device-Specific Stream Compatibility Patches Applied’ and ‘Google I/O '26: CameraXViewfinder Composable Announced, Built on Jetpack CameraX and Media3’.



## 1. This week’s articles

- CameraX 1.6.0 Stable Release: Use-Case Pre-Query API Introduced and Numerous Device-Specific Stream Compatibility Patches Applied
- Google I/O '26: CameraXViewfinder Composable Announced, Built on Jetpack CameraX and Media3

## 2. Google I/O '26: CameraXViewfinder Composable Announced, Built on Jetpack CameraX and Media3


![Google I/O '26 Android Developers session thumbnail](https://i.ytimg.com/vi/Wh3LWb_Phfk/hqdefault.jpg?sqp=-oaymwEXCOADEI4CSFryq4qpAwkIARUAAIhCGAE=&rs=AOn4CLA4wZOV-TY1ydEqFUXpCAG3sm5sQA&days_since_epoch=20609)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/)_


_Building High-Quality Android Media Experiences with Jetpack CameraX and Media3_

At Google I/O '26, the CameraXViewfinder Composable was announced, using Jetpack CameraX and Media3 to provide a camera preview that responds flexibly across diverse form factors such as foldables and tablets.

As the Android ecosystem evolves into a platform that supports a high-quality media lifecycle, Google presented a toolkit to simplify the development journey from first capture to final playback. The core of this Google I/O '26 announcement is the tight integration of Jetpack CameraX and Media3.

The newly introduced CameraXViewfinder Composable helps implement camera preview easily in Jetpack Compose, a declarative UI framework. In particular, it provides a viewfinder that scales and responds seamlessly to layout changes on foldable devices whose screen size changes dynamically and on large-screen tablets.

This toolkit is designed so that application developers can build native-level, high-quality camera and playback experiences without complex Surface lifecycle management or aspect ratio calculations. This is expected to significantly shorten the app development process.

### Camera HAL/Driver perspective implications

This change does not involve a direct interface change to the Camera HAL, but it shows how the framework and app layers consume and render the streams (Preview, ImageCapture) that the HAL provides. It suggests that the HAL must supply buffers reliably, without frame drops, in response to Surface reconfiguration and stream reconfiguration requests that may occur when a foldable device's screen changes.

**Sources**

- [Supercharge your media pipeline with a complete, production-ready toolkit (『Building Premium Android Experiences at Google I/O ‘26』)](https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY)

---

## 3. CameraX 1.6.0 Stable Release: Use-Case Pre-Query API Introduced and Numerous Device-Specific Stream Compatibility Patches Applied


![CameraX 1.6.0 Stable Release: Use-Case Pre-Query API Introduced and Numerous Device-Specific Stream Compatibility Patches Applied image](https://developer.android.com/static/images/social/android-developers.png?hl=bn)

_Image: [CameraX Release Notes](https://developer.android.com/jetpack/androidx/releases/camera)_


CameraX 1.6.0 Release Notes (March 25, 2026)

The CameraX 1.6.0 release, officially announced on March 25, 2026, introduces a powerful feature combination query API that lets apps check in advance whether the device hardware supports a configuration before binding to the camera lifecycle. Alongside it, a crash fix for the upcoming Android 17 and numerous compatibility patches were applied that work around YUV stream distortion and flash-linked capture failures reported on specific devices such as the Samsung Z Fold 4 and A53.

The most central change in the CameraX 1.6.0 release is the introduction of an API that lets developers query in advance whether complex use-case combinations, such as HDR, stabilization (PREVIEW_STABILIZATION), specific resolution settings, CameraX Extensions, or slow motion, work correctly on the target device. This makes it possible to prevent, ahead of time, the runtime exceptions and malfunctions that used to occur when the app layer forcibly requested unsupported hardware stream combinations.

It also resolves a critical compatibility issue in which existing CameraX-based apps crashed because of unknown dynamic range modes newly added on upcoming Android 17 devices. This crash fix was also cherry-picked into the lower version 1.5.2, and Google strongly recommends that all developers immediately update CameraX to 1.5.2 or 1.6.0 or later to prevent app crashes that may occur when Android 17 rolls out.

Numerous compatibility patches addressing device-specific hardware characteristics are also included. Notably, specific YUV format output sizes that caused image distortion on the Samsung Z Fold 4 were excluded from the supported set. A timing issue was also fixed on the Samsung A53 in which capture intermittently failed when taking a photo with the torch on while the video recording (VideoCapture) use case was active.

In addition, numerous detailed fixes were made to improve the stability of the downstream image processing pipeline, such as fixing images coming out dark due to underexposure when using the flash on the ultra-wide camera, and updating the ExifInterface library dependency to fix image parsing failures caused by some devices' JPEG encoders adding 0xFF padding bytes before markers.

### Camera HAL/Driver perspective implications

This release carries significant implications for Camera HAL development teams. With an API now introduced at the upper framework layer to query use-case combination support in advance, the accuracy of the CameraCharacteristics and isStreamCombinationSupported interfaces declared at the HAL level is held to a stricter standard. Also, since instability at the HAL/driver layer, such as the Z Fold 4 YUV distortion and the A53 torch-linked capture failure, is being forcibly worked around (Exclude/Filter) in upper libraries, vendors should re-verify the stream combination reliability and buffer handling logic of their own devices.

**Sources**

- [CameraX Release Notes - CameraX 1.6.0](https://developer.android.com/jetpack/androidx/releases/camera#1.6.0)


## References

- [Supercharge your media pipeline with a complete, production-ready toolkit (『Building Premium Android Experiences at Google I/O ‘26』)](https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY)
