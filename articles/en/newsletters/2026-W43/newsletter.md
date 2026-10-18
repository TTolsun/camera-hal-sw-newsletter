# 2026 W42 (10.12 ~ 10.18)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week, we start with a HeifWriter fix addressing an issue where black colors appeared elevated in 8-bit HEIF images. This change requires checking the color range of Surface input and encoding results together. Next, we cover the gain limits and remaining crop discussions for v7 of the HM1092 NIR sensor driver, and a proposed patch for RAW capture error handling in atomisp. Finally, we have a brief development tool update on Android Studio's external AI agent integration.

- [AndroidX HeifWriter patch merged to prevent 8-bit Surface input color distortion](#article-androidx-heifwriter-patch-merged-to-prevent-8-bit-surface-input-color-distortion)

  If you save 8-bit SDR HEIF via the Surface path, check the decoding result of black input and the VUI color_range declaration together. YUV buffer input and 10-bit HDR paths are not affected by this change.

- [Linux media subsystem, Himax HM1092 monochrome NIR sensor driver v7 proposed](#article-linux-media-subsystem-himax-hm1092-monochrome-nir-sensor-driver-v7-proposed)

  Developers integrating NIR sensors with V4L2 should distinguish between the gain upper limit fix in v7 and the still-under-discussion active array reporting method.

- [Linux atomisp driver, stream creation error branch cleanup patch proposed](#article-linux-atomisp-driver-stream-creation-error-branch-cleanup-patch-proposed)

  In atomisp's RAW/BAYER path, the return value indicating no viewfinder information must be distinguished from an actual stream creation failure.

- [Brief News: Android Studio supports external AI agent integration](#article-brief-news-android-studio-supports-external-ai-agent-integration)

  Refer to this as a development assistance feature in Canary. You can decide whether to adopt it after checking if it fits your current build and test workflow.




<a id="article-androidx-heifwriter-patch-merged-to-prevent-8-bit-surface-input-color-distortion"></a>

## 2. AndroidX HeifWriter patch merged to prevent 8-bit Surface input color distortion

_AndroidX Gerrit (2026-10-16)_

The AndroidX HEIF image generation library has removed logic that forced a full color range declaration for 8-bit surface input, correcting an issue where rendered black colors appeared elevated.

### Camera HAL/Driver perspective: what it means

If you save 8-bit SDR HEIF via the Surface path, check the decoding result of black input and the VUI color_range declaration together. YUV buffer input and 10-bit HDR paths are not affected by this change.


![](../../../assets/images/fallback/android.svg)


A patch to fix a regression in HeifWriter's 8-bit color range handling was merged into the Google Android Open Source Project's frameworks support repository on October 16, 2026. The target file is EncoderBase.java.

In the previous implementation, when encoding 8-bit SDR images using Surface or Bitmap input modes, EglWindowSurface created a standard RGBA_8888 EGL surface without specified color space attributes. At this time, some vendor hardware HEVC encoders, such as amlogic or qti, quantized RGB(0, 0, 0) to a limited range luma value of Y=16, but still wrote a full range flag in the bitstream VUI header, following the COLOR_RANGE_FULL directive specified in the format. As a result, upon decoding, black was interpreted as 16/255 instead of 0, causing black areas to appear elevated as gray, and CTS and HeifWriterTest surface tests to fail.

This fix branches the 8-bit path using internal surfaces to not set MediaFormat.KEY_COLOR_RANGE, leaving it empty. This delegates to the encoder to consistently match its own hardware conversion range and bitstream VUI header when the surface input lacks dataspace information. In contrast, the buffer input mode, where the client directly passes YUV, maintains the full range setting according to the common JFIF rules for cameras. 10-bit HDR surface input also maintains full range without changes, as BT.2020 dataspace is explicitly passed.

This fix has been merged into the library source, and its reflection in specific Android version releases or commercial device ROMs needs to be confirmed separately. Practicing engineers can verify from a HeifWriterTest perspective that the decoded luma value for RGB(0, 0, 0) input does not appear elevated when saving 8-bit SDR HEIF images by connecting a camera capture surface to HeifWriter.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)

---

<a id="article-linux-media-subsystem-himax-hm1092-monochrome-nir-sensor-driver-v7-proposed"></a>

## 3. Linux media subsystem, Himax HM1092 monochrome NIR sensor driver v7 proposed

_linux-media mailing list (2026-10-13)_

Version 7 of a proposed Linux V4L2 subdevice driver for the Himax HM1092 1-megapixel monochrome near-infrared sensor, used in laptop facial recognition cameras, has been submitted.

### Camera HAL/Driver perspective: what it means

Developers integrating NIR sensors with V4L2 should distinguish between the gain upper limit fix in v7 and the still-under-discussion active array reporting method.


![](../../../assets/images/fallback/newsletter-default.svg)


The HM1092 driver v7, submitted on October 13, 2026, addresses V4L2 integration for a monochrome NIR sensor using a single-lane MIPI CSI-2. It considers Qualcomm device trees and Intel IPU-based ACPI environments, distinguishing operating modes based on 24 MHz and 19.2 MHz external clocks.

A notable change in v7 is the digital gain range. The upper limit is restricted to 0x3ff to match the register's 10-bit 2.8 fixed-point format, preventing issues where values of 1024 or higher would result in a black screen due to ignored upper bits. Changes to get_selection pad operations and runtime PM error handling have also been incorporated.

Unresolved issues include dummy borders and crop areas in the 19.2 MHz environment. Discussions remain on how to report the sensor's active array range, so if integrating similar sensors, it's worth comparing gain control limits and the selection area exposed to libcamera. This is currently a pre-merge patch proposal and does not imply commercial product support completion.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)

---

<a id="article-linux-atomisp-driver-stream-creation-error-branch-cleanup-patch-proposed"></a>

## 4. Linux atomisp driver, stream creation error branch cleanup patch proposed

_linux-media mailing list (2026-10-16)_

A patch has been submitted to remove dead code error checks that remained unnecessarily during stream creation in the atomisp driver within the Linux staging media tree.

### Camera HAL/Driver perspective: what it means

In atomisp's RAW/BAYER path, the return value indicating no viewfinder information must be distinguished from an actual stream creation failure.


![](../../../assets/images/fallback/newsletter-default.svg)


A patch submitted on October 16, 2026, removes a two-line unnecessary error check in ia_css_stream_create() within drivers/staging/media/atomisp/pci/sh_css.c. This was a branch that always evaluated to false because it checked a previous 'err' variable without assigning the return value of sh_css_pipe_get_viewfinder_frame_info().

The key point is that simply adding the return value assignment is not the solution. In RAW/BAYER modes without a viewfinder, this function can return -EINVAL, and propagating this would cause even normal stream creation to fail. When maintaining atomisp, the meaning of return values based on output configuration must be verified. This change is a pre-merge proposal and not a basis for indiscriminately removing error handling in other drivers.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [Full patch series](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)

---

<a id="article-brief-news-android-studio-supports-external-ai-agent-integration"></a>

## 5. Brief News: Android Studio supports external AI agent integration

_Android Developers Blog (2026-10-15)_

The latest Android Studio Canary build has added BYOA (Bring Your Own Agent) support, allowing direct connection of external AI coding agents to the development environment.

### Camera HAL/Driver perspective: what it means

Refer to this as a development assistance feature in Canary. You can decide whether to adopt it after checking if it fits your current build and test workflow.


![Android Studio Canary introduces BYOA support for integrating external coding agents](https://developer.android.com/static/blog/assets/BYOA_Backup_Strapi_1_5c3f94f766_sEPWb.webp)

_Image: [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)_


BYOA in Android Studio Canary, announced on October 15, provides project/build context and IDE tools to external coding agents via ACP. It supports integration with Claude Agent, Codex, and Antigravity.

This is a preview update for teams experimenting with development tools. It does not imply HAL execution behavior or performance improvements, and its usefulness for a team's C++ build and test tasks needs to be verified separately.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)


## Further reading

- [\[v6,1/4\] libcamera: software_isp: Add support for monochrome formats - Shaders](<https://patchwork.libcamera.org/patch/28492/>) — libcamera Patchwork (patch review) (2026-10-17) · Open-source camera HAL project changes · Technology trends reference
- [\[PATCH v3 0/6\] phy: qcom-mipi-csi2: C-PHY for X1E80100](<https://lore.kernel.org/linux-media/20261016-x1e-cphy-rfc-v3-0-40a346a72153@gmail.com/>) — lore.kernel.org linux-media list (2026-10-16) · Camera driver / Image pipeline reference
- [\[PATCH v4 1/2\] media: dt-bindings: imx908: Add Sony IMX908 sensor](<https://lore.kernel.org/linux-media/20261016075918.19345-2-lachlan.michael@sony.com/>) — lore.kernel.org linux-media list (2026-10-16) · Camera driver / Image pipeline reference
- [v4l2: v4l2_camera_proxy: Handle 64-bit time_t buffer ioctls](<https://patchwork.libcamera.org/patch/28471/>) — libcamera Patchwork (patch review) (2026-10-16) · Open-source camera HAL project changes · Technology trends reference

## References

- [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)
- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)
- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)
- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [Full patch series](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)
