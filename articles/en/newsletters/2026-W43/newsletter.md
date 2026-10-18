# 2026 W42 (10.12 ~ 10.18)





<a id="issue-briefing"></a>

## 1. This week’s highlights

We start with HeifWriter’s fix for gray-looking blacks in saved images, then examine Gemini 4 Argon’s Android tool integration and access requirements. HM1092 gain limits and the atomisp error-check proposal follow for sensor and driver developers.

- [AndroidX HeifWriter fixes gray-looking blacks in 8-bit HEIF images](#article-androidx-heifwriter-fixes-gray-looking-blacks-in-8-bit-heif-images)

  This matters to developers responsible for saving HEIF images. Focus on 8-bit SDR Surface and Bitmap input. Direct YUV buffer input and 10-bit HDR are outside this change.

- [Gemini 4 Argon supports Android development in Studio and the CLI](#article-gemini-4-argon-supports-android-development-in-studio-and-the-cli)

  This matters to teams evaluating Android development automation. Check subscription and API requirements, then try error-log inspection and build reruns in a small project.

- [Linux HM1092 driver v7 proposal limits gain to avoid black frames](#article-linux-hm1092-driver-v7-proposal-limits-gain-to-avoid-black-frames)

  This matters to developers connecting NIR sensors through V4L2. Review the gain limit change separately from the still-open discussion about reporting image areas.

- [Linux atomisp proposal explains why a dead error check should be removed](#article-linux-atomisp-proposal-explains-why-a-dead-error-check-should-be-removed)

  This matters to atomisp maintainers. Distinguish missing preview information from an error that prevents capture stream creation.




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

<a id="article-gemini-4-argon-supports-android-development-in-studio-and-the-cli"></a>

## 3. Gemini 4 Argon supports Android development in Studio and the CLI

_Android Developers Blog (2026-10-13)_

Support is expanding from asking AI about code to connecting development tools. On October 13, Google announced Gemini 4 Argon support across Android development environments.

### Camera HAL/Driver perspective: what it means

This matters to teams evaluating Android development automation. Check subscription and API requirements, then try error-log inspection and build reruns in a small project.



### What changed?

Gemini 4 Argon is available through Android Studio and Antigravity. The official Android CLI plugin connects agents to local Android tools, enabling workflows that run development commands.

Google describes using Gradle and Kotlin compiler error logs to revise failed builds. This is a vendor example, not a guarantee of automatic fixes for every project.

### What access is required?

Antigravity’s app and CLI, including Antigravity inside Android Studio Canary, require Google AI Ultra. Android Studio also offers access through the paid Gemini API. Check supported regions and your environment.

### Who should check it?

Teams developing Android apps or tools can evaluate it. Our suggested check is to reproduce a build error in a test project, verify that the agent reads the actual error log, and check whether the revised build passes.

The announcement does not establish Camera HAL changes or automatic C++ native build repair. BYOA, covered previously, connects external agents; this announcement concerns a specific model’s access paths and Android tool integration.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Bringing our latest frontier model to Android Developers](https://developer.android.com/blog/posts/bringing-gemini-4-argon-to-android-agentic-engineering-antigravity-cli)

---

<a id="article-linux-hm1092-driver-v7-proposal-limits-gain-to-avoid-black-frames"></a>

## 4. Linux HM1092 driver v7 proposal limits gain to avoid black frames

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

## 5. Linux atomisp proposal explains why a dead error check should be removed

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


## Further reading

- [\[v6,1/4\] libcamera: software_isp: Add support for monochrome formats - Shaders](<https://patchwork.libcamera.org/patch/28492/>) — libcamera Patchwork (patch review) (2026-10-17) · Open-source camera HAL project changes · Technology trends reference
- [\[PATCH v3 0/6\] phy: qcom-mipi-csi2: C-PHY for X1E80100](<https://lore.kernel.org/linux-media/20261016-x1e-cphy-rfc-v3-0-40a346a72153@gmail.com/>) — lore.kernel.org linux-media list (2026-10-16) · Camera driver / Image pipeline reference
- [\[PATCH v4 1/2\] media: dt-bindings: imx908: Add Sony IMX908 sensor](<https://lore.kernel.org/linux-media/20261016075918.19345-2-lachlan.michael@sony.com/>) — lore.kernel.org linux-media list (2026-10-16) · Camera driver / Image pipeline reference
- [v4l2: v4l2_camera_proxy: Handle 64-bit time_t buffer ioctls](<https://patchwork.libcamera.org/patch/28471/>) — libcamera Patchwork (patch review) (2026-10-16) · Open-source camera HAL project changes · Technology trends reference
- [Android Studio BYOA: Connect external AI agents](<https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio>) — Android Developers Blog (2026-09-24) · Earlier announcement: distinguish support for a specific model from connecting external agents.

## References

- [heifwriter: do not force COLOR_RANGE_FULL on 8-bit surface input - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4370387)
- [[PATCH v7 0/3] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20261013-hm1092-driver-v7-0-d81a9b152ffd@gmail.com/T/#t)
- [[PATCH] media: atomisp: remove dead error check in ia_css_stream_create()](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/) — [Full patch series](https://lore.kernel.org/linux-media/20261016105553.346322-1-a.karelin@ideco.ru/T/#t)
- [Bringing our latest frontier model to Android Developers](https://developer.android.com/blog/posts/bringing-gemini-4-argon-to-android-agentic-engineering-antigravity-cli)
