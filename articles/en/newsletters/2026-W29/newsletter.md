# 2026 W29 (07.06 ~ 07.13)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week covers 3 stories, including ‘Qualcomm CAMSS: OPE driver v4 patch proposed to accelerate offline image processing’ and ‘libcamera software ISP: introducing an EGL texture filter parameter to strengthen lens shading correction (LSC)’.

- [Qualcomm CAMSS: OPE driver v4 patch proposed to accelerate offline image processing](#article-qualcomm-camss-ope-driver-v4-patch-proposed-to-accelerate-offline-image-processi)

  It does not make direct API changes to the Android Camera HAL, but as the RAW-to-YUV offline conversion path is optimized at the lower driver level, the efficiency and power consumption of concurrent YUV_420_888 and RAW stream processing may improve.

- [libcamera software ISP: introducing an EGL texture filter parameter to strengthen lens shading correction (LSC)](#article-libcamera-software-isp-introducing-an-egl-texture-filter-parameter-to-strengthen)

  There is no direct impact on the Android Camera HAL, but a foundation has been laid for simultaneously improving LSC correction quality and GPU texture processing efficiency on platforms that use the libcamera software ISP.

- [Raspberry Pi ships libcamera v0.7.1+rpt20260609 downstream version](#article-raspberry-pi-ships-libcamera-v0-7-1-rpt20260609-downstream-version)

  It does not bring direct API or contract changes to the Android Camera HAL, but it can be used as a reference for benchmarking V4L2-based driver integration and optimization techniques for embedded Linux camera stacks.




<a id="article-qualcomm-camss-ope-driver-v4-patch-proposed-to-accelerate-offline-image-processi"></a>

## 2. Qualcomm CAMSS: OPE driver v4 patch proposed to accelerate offline image processing

_Analysis of a patch on the lore.kernel.org linux-media mailing list_

A v4 patch was proposed to add an OPE (Offline Processing Engine) driver dedicated to offline image processing to Qualcomm CAMSS (Camera Subsystem).

### Camera HAL/Driver perspective: what it means

It does not make direct API changes to the Android Camera HAL, but as the RAW-to-YUV offline conversion path is optimized at the lower driver level, the efficiency and power consumption of concurrent YUV_420_888 and RAW stream processing may improve.


![](../../../assets/images/fallback/android.svg)


This week, the fourth patch series adding Offline Processing Engine (OPE) support to the Qualcomm CAMSS driver stack was published on the Linux media mailing list. The OPE is a memory-to-memory (M2M) ISP hardware block that takes raw Bayer frames as input and converts them to YUV frames.

The driver performs core ISP pipeline processing in hardware, such as white balance, demosaicing, chroma enhancement, color correction, and downscaling. By taking an offline acceleration approach, unlike conventional real-time streaming processing, it enables flexible buffer handling and efficient resource allocation in the camera system.

However, this patch is at the proposal stage (PATCH v4) and has not been merged into the Linux kernel mainline, so additional vendor integration and validation processes are required before it reaches actual commercial chipsets and Android devices. HAL developers should observe over the long term the changes in buffer lifecycle that come with the lower driver's adoption of an M2M architecture.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Re: [PATCH v4 6/7] media: qcom: camss: Add CAMSS Offline Processing Engine driver](https://lore.kernel.org/linux-media/da70ed94-fd76-4105-8071-1ed8d8e41d84@linaro.org/)

---

<a id="article-libcamera-software-isp-introducing-an-egl-texture-filter-parameter-to-strengthen"></a>

## 3. libcamera software ISP: introducing an EGL texture filter parameter to strengthen lens shading correction (LSC)

_Review of an RFC v7 patch on libcamera Patchwork_

A patch was recently proposed that adds a filter parameter to the createTexture2D() function in libcamera's software ISP EGL module to improve lens shading correction (LSC) performance.

### Camera HAL/Driver perspective: what it means

There is no direct impact on the Android Camera HAL, but a foundation has been laid for simultaneously improving LSC correction quality and GPU texture processing efficiency on platforms that use the libcamera software ISP.


![](../../../assets/images/fallback/android.svg)


According to the RFC v7 patch series proposed on July 8, an important interface change was included in the EGL module of libcamera's software ISP (software_isp). Specifically, a filter parameter was newly added to the createTexture2D() function.

This change is preparatory work for precisely supporting, on the software ISP, the lens shading correction (LSC) feature that corrects light falloff and color distortion at the lens periphery. Directly controlling the filtering method when creating textures makes it possible to improve the interpolation quality of the correction data.

The patch is still at the review stage (RFC v7) and has not been fully integrated into mainline. Android HAL developers working on embedded systems that use libcamera as their underlying stack, or in certain virtualized environments, should track whether image quality improves when running the software ISP.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[RFC,v7,1/6] libcamera: software_isp: egl: Add filter parameter to createTexture2D()](https://patchwork.libcamera.org/patch/27346/)

---

## Catch-up

<a id="article-raspberry-pi-ships-libcamera-v0-7-1-rpt20260609-downstream-version"></a>

## 4. Raspberry Pi ships libcamera v0.7.1+rpt20260609 downstream version (released 5 weeks ago)

_Analysis of the official Raspberry Pi GitHub release_

On June 9, 2026, Raspberry Pi officially released libcamera v0.7.1+rpt20260609, a downstream version optimized for its platform.

### Camera HAL/Driver perspective: what it means

It does not bring direct API or contract changes to the Android Camera HAL, but it can be used as a reference for benchmarking V4L2-based driver integration and optimization techniques for embedded Linux camera stacks.


![Raspberry Pi ships libcamera v0.7.1+rpt20260609 downstream version](https://opengraph.githubassets.com/43745a03e57dd7fd1a373cbe920ccddb1ccaf4ae482bbe9bb87049ef908a045d/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609)

_Image: [Raspberry Pi libcamera Releases](https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609)_


This item is a retrospective on Raspberry Pi's downstream release of the libcamera project, published on June 9. The released v0.7.1+rpt20260609 version contains camera driver and image pipeline optimizations specific to Raspberry Pi hardware.

libcamera is the core framework that abstracts camera devices in Linux environments, and Raspberry Pi's downstream version has served as the channel that reflects the latest changes in embedded Linux and the V4L2 subsystem the fastest. This release likewise focuses on improving camera operating stability on that platform.

However, since this release focuses on Raspberry Pi-specific hardware and software stacks, it has no direct impact on Camera HAL3 implementations on typical Android devices or on AOSP framework contracts. It is suitable as reference material for engineers working with embedded Android environments or responsible for V4L2 driver integration to follow upstream technical trends.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Raspberry Pi libcamera Releases - v0.7.1+rpt20260609](https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609)


## Further reading

- [2. Android skills keep growing (『Top 3 updates for Android developer productivity』)](<https://developer.android.com/tools/agents/android-cli#skills-add>) — Android Developers Blog (Tue, 09 Jun 2026 13:00:00 +0000) · Reference on Android platform and camera-adjacent topics
- [Top 3 updates for Android developer productivity](<https://android-developers.googleblog.com/2026/06/android-developer-productivity-updates.html>) — Android Developers Blog (Tue, 09 Jun 2026 13:00:00 +0000) · Reference on C++ / AI-native tooling

## References

- [Re: [PATCH v4 6/7] media: qcom: camss: Add CAMSS Offline Processing Engine driver](https://lore.kernel.org/linux-media/da70ed94-fd76-4105-8071-1ed8d8e41d84@linaro.org/)
- [[RFC,v7,1/6] libcamera: software_isp: egl: Add filter parameter to createTexture2D()](https://patchwork.libcamera.org/patch/27346/)
- [Raspberry Pi libcamera Releases - v0.7.1+rpt20260609](https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609)
