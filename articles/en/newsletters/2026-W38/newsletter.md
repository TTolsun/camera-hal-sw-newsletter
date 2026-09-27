# 2026 W37 (09.07 ~ 09.13)

This week covers 4 stories, including ‘Rockchip RKISP1 ISP driver: patch posted to fix Bayer demosaicing bypass logic error’ and ‘New Linux driver patch posted for the OmniVision os02g10 image sensor’.



## 1. This week’s articles

- Rockchip RKISP1 ISP driver: patch posted to fix Bayer demosaicing bypass logic error
- New Linux driver patch posted for the OmniVision os02g10 image sensor
- libcamera: patch proposed to fix Sony IMX355 sensor test pattern mode mapping
- libcamera: proposal to add LensShadingCorrection and ToneCurve to controls metadata

## 2. Rockchip RKISP1 ISP driver: patch posted to fix Bayer demosaicing bypass logic error


![Rockchip RKISP1 ISP driver: patch posted to fix Bayer demosaicing bypass logic error image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media mailing list patch proposal (2026-09-11)_

A patch has been proposed that fixes a logic error in the Rockchip RKISP1 ISP driver where the Bayer demosaicing bypass bit was handled inversely.

On September 11, 2026, a patch fixing the Bayer demosaicing bypass control logic of the Rockchip RKISP1 ISP was proposed on the lore.kernel.org linux-media mailing list. In the existing driver implementation, the control logic worked completely in reverse: it cleared the bypass bit (RKISP1_CIF_ISP_DEMOSAIC_BYPASS) when the demosaicing block should be bypassed, and set the bit when demosaicing should be enabled.

This patch changes it so that the bypass bit is set when the demosaicing block is disabled, and cleared when demosaicing is performed. The author stated that this problem has never actually surfaced because libcamera does not yet have an algorithm that controls the demosaicing bypass.

The patch is currently under review at the proposal stage (v1), and whether it is actually merged into the mainline kernel needs continued monitoring. Development teams on platforms that use the rkisp1 driver, such as Rockchip ISP and NXP i.MX8MP, can use this patch to proactively verify the behavioral integrity of the image pipeline.

### Camera HAL/Driver perspective implications

There is no direct Android Camera HAL change, but because the demosaicing bypass logic of the underlying ISP driver is being fixed, color distortion or noise control behavior may change when outputting RAW streams and applying ISP tuning parameters. Quality verification of RAW and YUV streams should be performed at the HAL layer.

**Sources**

- [[PATCH] media: rkisp1: Fix Bayer demosaicing bypass](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/T/#t)

---

## 3. New Linux driver patch posted for the OmniVision os02g10 image sensor


![New Linux driver patch posted for the OmniVision os02g10 image sensor image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media mailing list patch proposal (2026-09-08)_

A new V4L2 driver patch series (v5) has been proposed to officially support the OmniVision os02g10 image sensor.

On September 8, 2026, a patch series (v5) adding a new i2c driver for the OmniVision os02g10 camera sensor was posted on the lore.kernel.org linux-media mailing list. This patch is part of a contribution to integrate a new hardware sensor into the Linux media subsystem.

The proposed driver includes a variety of controls essential for practical camera work, such as manual exposure and gain control, vblank/hblank control, vflip/hflip control, and test pattern control. It also officially supports an SBGGR10 (10-bit Bayer) mode that outputs 30 frames per second at 1920x1080 resolution.

The driver was verified for correct operation and compliance on the IMX8MP Debix Model A development board using the mainline v7.0-rc2 kernel and the v4l2-compliance 1.31.0-5387 tool. Hardware and driver development teams planning to ship the new sensor can carry out early validation based on this patch.

### Camera HAL/Driver perspective implications

With the addition of the new sensor driver, a lower-level path has been secured for implementing manual exposure and gain control (SENSOR_EXPOSURE_TIME, SENSOR_SENSITIVITY), flip control, and more in the Android Camera HAL. The 1080p30 SBGGR10 stream configuration should be mapped into the HAL's stream map, and its integration with the V4L2 controls should be verified.

**Sources**

- [[RESEND PATCH v5 0/2] media: i2c: Add os02g10 camera sensor driver](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/) — [Full patch series](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/T/#t)

---

## 4. libcamera: patch proposed to fix Sony IMX355 sensor test pattern mode mapping


![libcamera: patch proposed to fix Sony IMX355 sensor test pattern mode mapping image](../../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork patch proposal (2026-09-08)_

A patch has been proposed in the libcamera project that corrects a test pattern mode mapping error for the Sony IMX355 sensor, improving the verification reliability of the lower camera stack.

On September 8, 2026, a patch was proposed via libcamera Patchwork to fix a test pattern mode mapping problem in the Sony IMX355 camera sensor driver. This patch is the first part ([1/2]) of a two-patch series submitted by Samuel LEGROS.

The existing libcamera IMX355 sensor properties mapped color bars (TestPatternModeColorBars) to menu index 1 and solid color (TestPatternModeSolidColor) to index 2, but the kernel driver imx355.c defines index 1 as Solid Colour and index 2 as Eight Vertical Colour Bars. As a result, requesting the solid color test pattern output color bars, and vice versa. This patch swaps the two entries to match the order of IMX258 and IMX471, which use the same menu. The author stated that they confirmed this behavior on the Google Pixel 3a front camera. The second patch in the series ([2/2]) adds Sony IMX363 sensor properties and a helper.

The patch is currently in 'new' state and under review in the project patch tracker, and it is a proposal that has not yet been merged into mainline. Development teams that ship the IMX355 sensor and use a libcamera-based hardware abstraction layer can apply this patch to proactively verify the reliability of test pattern output.

### Camera HAL/Driver perspective implications

There is no direct HAL change, but because the IMX355 sensor's test pattern mapping is fixed in the lower libcamera layer, it can ensure that the correct hardware test pattern is output when the Camera HAL sets SENSOR_TEST_PATTERN_MODE. This is useful for CTS test pattern verification and for debugging the data path between the sensor and the HAL.

**Sources**

- [[1/2] libcamera: camera_sensor: Fix IMX355 test pattern mode mapping](https://patchwork.libcamera.org/patch/28200/)

---

## 5. libcamera: proposal to add LensShadingCorrection and ToneCurve to controls metadata


![libcamera: proposal to add LensShadingCorrection and ToneCurve to controls metadata image](../../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork patch proposal (2026-09-10)_

A patch has been proposed for libcamera that provides lens shading correction maps and tone curves as frame result metadata, aiming to match the color reproduction of DNG files to JPEG.

On September 10, 2026, a patch was submitted to libcamera Patchwork that provides lens shading correction maps (LensShadingCorrectionMaps) and tone curves (ToneCurve) as frame result metadata. It was written by Michael Kunz and submitted on the author's behalf by Kieran Bingham due to a mail server problem.

The patch extends the frame metadata reporting path of the Raspberry Pi pipeline to also export lens shading correction maps and tone curves. The goal is for DNG saving programs to use this information to match color reproduction with JPEG and reduce tonal differences. It also adds a control to select whether the lens shading correction maps are output.

This patch is at the proposal stage. Development teams that save RAW/DNG based on Raspberry Pi and libcamera can check, after applying the patch, whether the correction maps and tone curves are included in the result metadata and whether the DNG saving program actually reflects them in the file.

### Camera HAL/Driver perspective implications

The key is to check the frame results of the Raspberry Pi pipeline together with the DNG saving path. You can compare DNG and JPEG of the same scene and verify that the channel layout and size of the lens shading correction maps, and the tone curve data, are correctly reflected in the file. Android Camera HAL integration is an area that requires separate implementation and verification, and this patch does not include changes that connect HAL requests to ISP control.

**Sources**

- [libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata](https://patchwork.libcamera.org/patch/28219/)


## Further reading

- [Introducing Fast and Reliable Wireless Debugging with Android Debug Bridge (ADB) Wi-Fi 2.0](<https://android-developers.googleblog.com/2026/09/wireless-debugging-adb-wifi-2.html>) — Android Developers Blog (2026-09-09) · Reference for C++ / AI-native tooling
- [\[PATCH\] media: ipu-bridge: Add DMI quirk for Dell 14 Premium DA14250](<https://lore.kernel.org/linux-media/20260912103431.15388-1-kthhrv@gmail.com/>) — lore.kernel.org linux-media list (Intel IPU) (2026-09-12) · Reference for camera drivers / image pipeline
- [\[PATCH 0/8\] media: qcom: camss: add V4L2 subdev streams API support](<https://lore.kernel.org/linux-media/20260911062213.195007-1-gjorgji.rosikopulos@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-11) · Reference for camera drivers / image pipeline
- [Acer Swift SFG14-01 Camera Support not working on Linux](<https://lore.kernel.org/linux-media/CAFJ6yro2PRQAsNwDMRmU8sve6nrXXWVruStgyYVRMcYeksdufQ@mail.gmail.com/>) — lore.kernel.org linux-media list (2026-09-09) · Reference for camera drivers / image pipeline

## References

- [[PATCH] media: rkisp1: Fix Bayer demosaicing bypass](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/T/#t)
- [[RESEND PATCH v5 0/2] media: i2c: Add os02g10 camera sensor driver](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/) — [Full patch series](https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/T/#t)
- [[1/2] libcamera: camera_sensor: Fix IMX355 test pattern mode mapping](https://patchwork.libcamera.org/patch/28200/)
- [libcamera: Adding LensShadingCorrection maps and ToneCurve to controls metadata](https://patchwork.libcamera.org/patch/28219/)
