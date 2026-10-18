# 2026 W42 (10.12 ~ 10.18)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This issue explains three camera topics: gray-looking blacks in HeifWriter, black frames caused by out-of-range HM1092 gain, and why atomisp should remove an unnecessary error check. Each article walks through the cause, the change, and who should check it. We close with a brief reference to the earlier Android Studio BYOA announcement.

- [AndroidX HeifWriter fixes gray-looking blacks in 8-bit HEIF images](#article-androidx-heifwriter-fixes-gray-looking-blacks-in-8-bit-heif-images)

  This matters to developers responsible for saving HEIF images. Focus on 8-bit SDR Surface and Bitmap input. Direct YUV buffer input and 10-bit HDR are outside this change.

- [Linux HM1092 driver v7 proposal limits gain to avoid black frames](#article-linux-hm1092-driver-v7-proposal-limits-gain-to-avoid-black-frames)

  This matters to developers connecting NIR sensors through V4L2. Review the gain limit change separately from the still-open discussion about reporting image areas.

- [Linux atomisp proposal explains why a dead error check should be removed](#article-linux-atomisp-proposal-explains-why-a-dead-error-check-should-be-removed)

  This matters to atomisp maintainers. Distinguish missing preview information from an error that prevents capture stream creation.

- [Brief reference: Connect your AI agent to Android Studio with BYOA](#article-brief-reference-connect-your-ai-agent-to-android-studio-with-byoa)

  This earlier announcement is a reference for teams trying development tools. Check how it fits your build and test workflow before adopting it.




<a id="article-androidx-heifwriter-fixes-gray-looking-blacks-in-8-bit-heif-images"></a>

## 2. AndroidX HeifWriter fixes gray-looking blacks in 8-bit HEIF images

_AndroidX Gerrit (2026-10-16)_

If a saved black area looks gray, the pixel values and the file’s color range label may disagree. HeifWriter has merged a fix for this mismatch in some 8-bit input paths.

### Camera HAL/Driver perspective: what it means

This matters to developers responsible for saving HEIF images. Focus on 8-bit SDR Surface and Bitmap input. Direct YUV buffer input and 10-bit HDR are outside this change.


![](../../../assets/images/fallback/android.svg)


### Why did black look gray?

An image file stores both pixel values and information about how to interpret them. Here, the values and the color range label did not match.

Some amlogic and qti HEVC encoders converted black RGB(0, 0, 0) to luma Y=16. That value represents black in limited range. But the file was labeled COLOR_RANGE_FULL, so decoding interpreted black as 16/255 instead of 0.

### What changed?

The affected path takes 8-bit SDR images through Surface or Bitmap input. Its internal RGBA_8888 EGL Surface did not specify dataspace, which describes how to interpret the colors.

The updated EncoderBase.java leaves MediaFormat.KEY_COLOR_RANGE unset for this path. The encoder can then match its actual conversion range with the color range label in the file’s VUI metadata.

Direct YUV buffer input keeps full range under the existing JFIF convention. The 10-bit HDR path, which supplies BT.2020 dataspace, also stays unchanged.

### Who should check, and how?

If you maintain HEIF saving, save a black test image and read it back. Check the decoded black level together with the VUI color range label.

### Is this already in products?

The fix was merged into the library source on October 16, 2026. Check separately whether your library version or product build includes it.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)

---

<a id="article-linux-hm1092-driver-v7-proposal-limits-gain-to-avoid-black-frames"></a>

## 3. Linux HM1092 driver v7 proposal limits gain to avoid black frames

_linux-media mailing list (2026-10-13)_

A value intended to brighten an image can instead produce a black frame if it exceeds the sensor’s range. The proposed HM1092 driver v7 limits the digital gain value to prevent this.

### Camera HAL/Driver perspective: what it means

This matters to developers connecting NIR sensors through V4L2. Review the gain limit change separately from the still-open discussion about reporting image areas.


![](../../../assets/images/fallback/newsletter-default.svg)


### Which sensor is this for?

HM1092 is a 1-megapixel monochrome near-infrared (NIR) sensor used in applications such as laptop face recognition cameras. The proposed driver connects it to V4L2, Linux’s camera control framework. Video travels over a single-lane MIPI CSI-2 link.

### Why can increasing brightness produce a black frame?

Digital gain controls how much the image signal is amplified. The sensor’s gain register uses a 10-bit 2.8 fixed-point format: 2 bits for the integer part and 8 for the fractional part.

Version 7 limits the register value to 0x3ff. With values of 1024 or higher, upper bits are ignored, which can produce a black frame. The proposal also incorporates get_selection interface changes and error handling for runtime power management (runtime PM).

### What is still unresolved?

The external clock supplied to the sensor varies by platform. The proposal distinguishes Qualcomm’s 24 MHz setup from Intel’s 19.2 MHz setup.

For the 19.2 MHz setup, discussion remains about how to report dummy borders and the active image area. A crop area describes the position and size of the part of the image to use.

### Who should check, and how?

Developers integrating NIR sensors should check gain limits alongside actual images. Comparing the active area and crop information passed to libcamera is another suggested check from the editors.

Submitted on October 13, 2026, driver v7 is a patch proposal. It does not mean kernel integration or commercial product support is complete.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)

---

<a id="article-linux-atomisp-proposal-explains-why-a-dead-error-check-should-be-removed"></a>

## 4. Linux atomisp proposal explains why a dead error check should be removed

_linux-media mailing list (2026-10-16)_

An error check in atomisp never actually triggered. The proposed patch removes it. Changing it to check the function’s return value could instead break valid RAW capture.

### Camera HAL/Driver perspective: what it means

This matters to atomisp maintainers. Distinguish missing preview information from an error that prevents capture stream creation.


![](../../../assets/images/fallback/newsletter-default.svg)


### What was wrong with the code?

ia_css_stream_create() creates a capture stream. After calling sh_css_pipe_get_viewfinder_frame_info(), it checked err from an earlier operation rather than this function’s return value.

The earlier error had already been checked, so this branch always evaluated to false. Submitted on October 16, 2026, the patch removes the two-line check in drivers/staging/media/atomisp/pci/sh_css.c.

### Why not check the return value?

RAW and BAYER modes may have no viewfinder output. Here, viewfinder means a preview output. In that case, the query function can return -EINVAL without the capture stream itself being invalid.

Treating that return value as a fatal error could block valid stream creation. The proposal therefore removes the unnecessary check instead of adding a return value assignment.

### Who should check, and how?

Atomisp maintainers should check what the return value means for RAW and BAYER configurations without a preview. This is not a reason to remove similar error checks from other drivers.

This article describes a pre-merge patch proposal. It does not mean behavior has already changed in a released kernel.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [Full patch series](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)

---

## Catch-up

<a id="article-brief-reference-connect-your-ai-agent-to-android-studio-with-byoa"></a>

## 5. Brief reference: Connect your AI agent to Android Studio with BYOA

_Android Developers Blog (2026-09-24; earlier announcement)_

BYOA in Android Studio Canary is a preview feature for using external AI coding agents inside the IDE. We revisit the September 24 announcement as a development tool reference.

### Camera HAL/Driver perspective: what it means

This earlier announcement is a reference for teams trying development tools. Check how it fits your build and test workflow before adopting it.


![Android Studio Canary introduces BYOA support for integrating external coding agents](https://developer.android.com/static/blog/assets/BYOA_Backup_Strapi_1_5c3f94f766_sEPWb.webp)

_Image: [Build your way: Use any AI agent of your choice in Android Studio](https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio)_


### What can it do?

BYOA (Bring Your Own Agent) connects agents such as Claude Agent, Codex, and Antigravity. ACP (Agent Client Protocol), the communication protocol between the IDE and agents, provides project and build information along with IDE tools.

### Who should look at it?

Teams trying development assistants may find it useful. Test whether it helps your own C++ build and test tasks. It does not change Camera HAL execution behavior or performance.

The official publication date is September 24, 2026. This is an earlier announcement, not a new feature announcement this week, and it remains a Canary preview.

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
