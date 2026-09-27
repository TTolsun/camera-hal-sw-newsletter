# 2026 W25 (06.15 ~ 06.21)

This week covers 6 stories, including ‘ARM Mali C55 ISP: patches for CCM and RGB Gamma support published’ and ‘Android developer productivity: CameraX migration skill added’.



## 1. This week’s articles

- ARM Mali C55 ISP: patches for CCM and RGB Gamma support published
- Android developer productivity: CameraX migration skill added
- GCC 16 released: major improvements to error messages and SARIF output
- Himax HM1246 image sensor driver v10 patches proposed for the Linux kernel
- V4L2 sub-device driver patch v10 for the Himax HM1246 image sensor published
- V4L2 driver patch v2 for the Sony IMX576 image sensor published

## 2. ARM Mali C55 ISP: patches for CCM and RGB Gamma support published


![ARM Mali C55 ISP: patches for CCM and RGB Gamma support published image](../../../assets/images/fallback/newsletter-default.svg)


_Image processing pipeline improvements proposed on the Linux media mailing list_

Patches adding CCM (Color Correction Matrix) and RGB Gamma support to the ARM Mali C55 ISP driver were recently published on the Linux media mailing list. The patches appear set to strengthen core functions of the image processing pipeline and enable more accurate color reproduction.

On June 16, 2026, two important patches for the ARM Mali C55 ISP driver were posted to the Linux media mailing list. The first patch adds CCM (Color Correction Matrix) support, and the second includes RGB Gamma support. These two functions are essential for optimizing color accuracy and tone mapping as raw data coming from the image sensor is converted into the image shown to the end user.

CCM is used to correct the color response characteristics of the camera sensor so that colors are reproduced close to the actual colors, while RGB Gamma adjusts the brightness distribution of the image to produce a visually natural result. These functions are among the core roles of an ISP (Image Signal Processor) and are important for high-quality image output.

Once these patches are merged into the Linux kernel, SoC platforms using the Mali C55 ISP will be able to support more sophisticated image processing at the hardware level. This may directly affect driver interaction and image processing pipeline optimization in Android Camera HAL implementations.

### Camera HAL/Driver perspective: what it means

These patches strengthen the low-level image processing capabilities of the Mali C55 ISP, giving Camera HAL implementations an opportunity to optimize color correction and gamma processing logic through integration with the driver. The HAL should review whether it can use these ISP functions to improve final image quality and get better results in specific color profile or HDR scenarios.

**Sources**

- [[PATCH 1/2] media: arm: mali-c55: Add support for CCM](https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com/T/#t)

---

## 3. Android developer productivity: CameraX migration skill added


![Android Developers Blog logo](https://developer.android.com/static/images/social/android-developers.png?hl=tr)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/)_


_Expanding LLM-based development support through the Android CLI and GitHub_

On June 9, 2026, a new batch of Android skills for improving Android developer productivity included a skill related to CameraX migration. This update uses LLMs (Large Language Models) to help developers handle CameraX-related work more efficiently.

The Android developer tools team continues to expand the Android skills repository to improve developer productivity, and a recent update added a skill related to CameraX migration. The skill is provided through the Android CLI and GitHub, and helps LLMs gain expertise in specific development patterns and best practices.

CameraX is a Jetpack library built on the Android Camera2 API that aims to simplify camera app development. The CameraX migration skill should therefore be useful for moving apps that use the existing Camera1 or Camera2 API to CameraX, or for supporting maintenance and optimization work on CameraX apps.

This tooling improvement directly affects the development workflow for apps that use CameraX, helping developers adopt and use the CameraX API more easily. This may in turn contribute to better quality and shorter development time for CameraX-based apps.

### Camera HAL/Driver perspective: what it means

This update is not a change to the Camera HAL itself, but because it affects the CameraX app development workflow, it may indirectly affect compatibility and performance validation of CameraX-based apps. When debugging specific camera behavior issues in CameraX apps (e.g., preview, capture, video recording), HAL teams should be aware of new patterns or potential issues arising from the use of these developer tools.

**Sources**

- [2. Android skills keep growing (『Top 3 updates for Android developer productivity』)](https://developer.android.com/tools/agents/android-cli#skills-add)

---

## 4. GCC 16 released: major improvements to error messages and SARIF output


![Red Hat graphic on ISO C++ Blog representing GCC 16 compiler updates](../../../assets/images/fallback/newsletter-default.svg)


_Expected improvements to code quality analysis and debugging efficiency in C++ development workflows_

On June 15, 2026, GCC 16 was released, bringing welcome news for developers. This version adds improved error messages and SARIF (Static Analysis Results Interchange Format) output, which are expected to greatly improve code quality analysis and debugging efficiency in C++ development workflows.

One of the most notable changes in GCC 16 is clearer, easier-to-understand error messages. Compiler errors are a problem commonly encountered during development, and more readable error messages directly help shorten troubleshooting time and raise development productivity. This can be especially helpful in HAL and driver code that uses complex C++ template metaprogramming or complex inheritance structures.

In addition, SARIF output provides static analysis tool results in a standardized format, making it possible to integrate with various analysis tools and easily visualize and manage the results. Because SARIF is widely used in CI/CD pipelines such as GitHub Code Scanning, this GCC 16 feature will make automated code quality checks and security analysis workflows for C++-based projects more efficient.

Android HAL and driver development mainly uses the Clang/LLVM toolchain, but these GCC improvements signal progress in code quality tools across the C++ ecosystem. In the long run, this may also have a positive effect on the Android native development environment, and in particular offers considerations for cross-compiler compatibility and the choice of static analysis tools.

### Camera HAL/Driver perspective: what it means

GCC 16's improved error messages and SARIF output do not directly change the Android HAL toolchain (Clang/LLVM), but they offer insight into build, debug, and static analysis workflows for C++-based HAL and driver code. HAL engineers can consider using similar features in a Clang/LLVM environment, or managing code quality analysis results in an integrated way through standardized output formats such as SARIF.

**Sources**

- [New features in GCC 16: Improved error messages and SARIF output -- David Malcolm](https://isocpp.org//blog/2026/06/new-features-in-gcc-16-improved-error-messages-and-sarif-output-david-malco)

---

## 5. Himax HM1246 image sensor driver v10 patches proposed for the Linux kernel


![Himax HM1246 image sensor driver v10 patches proposed for the Linux kernel image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (2026-06-19)_

A v10 patch series to support the Himax HM1246 image sensor was recently proposed to the Linux kernel media subsystem. The driver initially supports only Native RAW mode and is under review with the sensor's internal ISP pipeline not enabled.

On June 19, 2026, the tenth patch series for adding a Himax HM1246 image sensor driver was published on the Linux kernel media mailing list. The driver provides hardware control and a V4L2 frame capture interface.

The key limitation of the currently proposed driver is that it supports only Native RAW mode. The sensor's internal ISP pipeline and other processed output modes are excluded from support, so the pure RAW data output by the sensor must be processed at the level of an external ISP or the AP.

With review having progressed to v10, the driver's structural maturity is expected to be high, but it is still a patch under review. Actual product development should therefore take the Native RAW mode-only limitation into account when designing the pipeline.

### Camera HAL/Driver perspective: what it means

Because the Himax HM1246 driver supports only Native RAW mode, generating YUV or JPEG streams at the Android Camera HAL level requires integration with the AP's hardware ISP or a software image processing pipeline. Architecture design must reflect the fact that simple YUV output using the sensor's internal ISP is not possible.

**Sources**

- [[PATCH v10 0/2] media: add Himax HM1246 image sensor](https://lore.kernel.org/linux-media/20260619-hm1246-v10-0-d88e431a6c11@emfend.at/) — [Full patch series](https://lore.kernel.org/linux-media/20260619-hm1246-v10-0-d88e431a6c11@emfend.at/T/#t)

---

## 6. V4L2 sub-device driver patch v10 for the Himax HM1246 image sensor published


![V4L2 sub-device driver patch v10 for the Himax HM1246 image sensor published image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

A v10 patch series for adding a Himax HM1246 image sensor driver was recently submitted to the Linux media mailing list. The sensor supports an I2C interface and a parallel bus and has a built-in internal ISP, and is expected to contribute to future integration into the lower image pipeline of embedded and Android devices.

The v10 patch series published this time aims to add a V4L2 sub-device driver for controlling the Himax HM1246 image sensor to the Linux kernel. The sensor allows register configuration and control through an I2C interface, and is physically connected to the host processor through a parallel bus interface.

In particular, the sensor contains its own internal ISP (Image Signal Processor), which lets it perform basic image processing and format conversion at the sensor. The driver is written to V4L2 framework standards and provides compatibility with the Linux media controller architecture.

However, the patch is currently a proposal under review on the mailing list, and whether it is finally merged into the kernel mainline, as well as its detailed specifications, may change depending on further feedback. If it is shipped in Android devices, it will follow a path of being integrated with the Camera HAL's image input pipeline through the V4L2 driver layer.

### Camera HAL/Driver perspective: what it means

Because this patch is still at the proposal stage, it has no direct impact on Android Camera HAL APIs or metadata contracts. However, since it is a parallel-bus sensor with a built-in internal ISP, future HAL integration may require compatibility validation in frame timing and V4L2 sub-device format negotiation.

**Sources**

- [Re: [PATCH v10 2/2] media: i2c: add Himax HM1246 image sensor driver](https://lore.kernel.org/linux-media/ajZcTs5MoTmFbmmz@kekkonen.localdomain/)

---

## 7. V4L2 driver patch v2 for the Sony IMX576 image sensor published


![V4L2 driver patch v2 for the Sony IMX576 image sensor published image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

A v2 patch series for supporting the Sony IMX576 image sensor was recently submitted to the Linux media mailing list. The driver includes support for a high-resolution active array along with manual exposure, gain, and blanking controls, and will serve as a foundation for future integration into high-performance camera pipelines.

The v2 patch series submitted this time adds a new V4L2 sub-device driver for the Sony IMX576 image sensor. The IMX576 sensor features a large 5760 x 4312 active pixel array and is hardware suited to high-resolution image capture.

To make use of the sensor's capabilities, the proposed driver implements manual exposure control, analog/digital gain control, and vertical/horizontal blanking (vblank/hblank) control. It is also designed to support 2880 x 2156 output in addition to full resolution, so that it can handle various stream combinations.

This driver is also currently in upstream review, and before it can be applied to actual commercial devices, control reliability must be validated through the standard V4L2 framework interfaces and precise timing tuning with the host ISP pipeline must be done first.

### Camera HAL/Driver perspective: what it means

The Sony IMX576 sensor's high resolution (5760 x 4312) and manual controls (exposure, gain, blanking) map directly to the manual control features (Manual Camera capabilities) of Android Camera HAL3. Once the driver stabilizes, it will help secure the reliability of the 3A engine and manual metadata control at the HAL level.

**Sources**

- [Re: [PATCH v2 2/3] media: i2c: add imx576 image sensor driver](https://lore.kernel.org/linux-media/20260620132749.GE3552167@killaraus.ideasonboard.com/)


## Further reading

- [8: Building seamless Android experiences across devices with Jetpack Compose (『17 Things to know for Android developers at Google I/O』)](<https://goo.gle/AdaptiveApps_IO26>) — Android Developers Blog (Tue, 19 May 2026 13:00:00 +0000) · Reference on Android platform and camera-adjacent topics

## References

- [[PATCH 1/2] media: arm: mali-c55: Add support for CCM](https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com/T/#t)
- [2. Android skills keep growing (『Top 3 updates for Android developer productivity』)](https://developer.android.com/tools/agents/android-cli#skills-add)
- [New features in GCC 16: Improved error messages and SARIF output -- David Malcolm](https://isocpp.org//blog/2026/06/new-features-in-gcc-16-improved-error-messages-and-sarif-output-david-malco)
- [[PATCH v10 0/2] media: add Himax HM1246 image sensor](https://lore.kernel.org/linux-media/20260619-hm1246-v10-0-d88e431a6c11@emfend.at/) — [Full patch series](https://lore.kernel.org/linux-media/20260619-hm1246-v10-0-d88e431a6c11@emfend.at/T/#t)
- [Re: [PATCH v10 2/2] media: i2c: add Himax HM1246 image sensor driver](https://lore.kernel.org/linux-media/ajZcTs5MoTmFbmmz@kekkonen.localdomain/)
- [Re: [PATCH v2 2/3] media: i2c: add imx576 image sensor driver](https://lore.kernel.org/linux-media/20260620132749.GE3552167@killaraus.ideasonboard.com/)
