# 2026 W36 (08.31 ~ 09.06)

This week covers 5 stories, including ‘Linux kernel patch v6 posted to support the OmniVision OG0VA1B monochrome VGA sensor driver’ and ‘Qualcomm x1e/Hamoa platform camera DTS support patch v6 posted’.



## 1. This week’s articles

- Linux kernel patch v6 posted to support the OmniVision OG0VA1B monochrome VGA sensor driver
- Qualcomm x1e/Hamoa platform camera DTS support patch v6 posted
- Linux kernel patch v7 posted for Lenovo Yoga Book YB1-X91 camera support
- libcamera control storage union naming patch v3 accepted
- libcamera patch posted to skip unnecessary stop call before the software ISP worker starts

## 2. Linux kernel patch v6 posted to support the OmniVision OG0VA1B monochrome VGA sensor driver


![Linux kernel patch v6 posted to support the OmniVision OG0VA1B monochrome VGA sensor driver image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list patch analysis_

A v6 patch series has been posted to add a driver to the Linux media subsystem for the OG0VA1B, OmniVision's 1/10-inch low-power monochrome VGA sensor. With support for a single-lane MIPI CSI-2 interface and Y10 RAW format output, it appears set to lay the groundwork for building embedded and mobile monochrome camera pipelines.

On September 1, 2026, Qualcomm's Wenmeng Liu submitted a v6 patch set adding the OmniVision OG0VA1B image sensor driver via the Linux media mailing list. The OG0VA1B is an ultra-small 1/10-inch monochrome CMOS VGA sensor, designed to be suitable mainly for low-power sensing or auxiliary camera systems.

According to this driver patch, the sensor can output 10-bit RAW (Y10) frames at up to 640x480 resolution over a single-lane MIPI CSI-2 interface. Sensor control is performed over a standard I2C-compatible SCCB bus, and the driver implementation was verified on the Purwa EVK board, including test pattern generator (TPG) operation.

The patch is currently in review for merging into the kernel mainline, and because it includes handling of the Y10 pixel format specific to monochrome sensors and single-lane MIPI CSI-2 timing configuration, it will be an important reference for lower-level driver developers.

### Camera HAL/Driver perspective: what it means

There is no direct Android Camera HAL change, but because a 10-bit monochrome RAW (Y10) format is added at the lower V4L2 driver level, when implementing HAL3 you should check that the Y10 format is correctly defined in the RAW stream configuration and the ISP pixel format mapping table.

**Sources**

- [[PATCH v6 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/T/#t)

---

## 3. Qualcomm x1e/Hamoa platform camera DTS support patch v6 posted


![Qualcomm x1e/Hamoa platform camera DTS support patch v6 posted image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list patch analysis_

A v6 patch adding Device Tree Source (DTS) support that defines the camera hardware configuration of the Qualcomm x1e/Hamoa platform has been posted. This update focuses on improving hardware initialization stability, for example by aligning the data lane ordering of the CAMSS node with the PHY layer and making the power supply schema consistent.

On September 6, 2026, a v6 patch series improving the camera subsystem (CAMSS) DTS configuration of the Qualcomm x1e/Hamoa platform was submitted via the Linaro mailing list. DTS is the core specification that describes hardware resources to the kernel, and it defines the physical connections between camera sensors and the SoC.

The one change in v6 is adjusting the data lane start index in the CAMSS node from the previous 0 to 1 to align it with the physical layer (PHY). The change that moved the power supply node definition from vdda-0p8-supply to vdda-0p9-supply to meet the schema requirements was made earlier, in v5.

These changes are essential for preventing camera hardware initialization failures or image corruption at the lower level, and they provide an important hardware configuration guide for camera driver and SoC integration engineers working on the x1e platform.

### Camera HAL/Driver perspective: what it means

There is no direct HAL change, but the data lane alignment and power supply changes directly affect the physical connection stability of the camera subsystem. Lower-stack verification should be done first so that MIPI CSI-2 receiver initialization errors or power-on failures do not occur at the driver level.

**Sources**

- [[PATCH v6 00/13] arm64: dts: qcom: Add x1e/Hamoa camera DTSI](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/T/#t)

---

## 4. Linux kernel patch v7 posted for Lenovo Yoga Book YB1-X91 camera support


![Linux kernel patch v7 posted for Lenovo Yoga Book YB1-X91 camera support image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list patch analysis_

A v7 patch series has been posted to fully support the front and rear camera system of the Lenovo Yoga Book YB1-X91. This patch contains comprehensive hardware control logic covering not only the OV8858 and OV2740 image sensor drivers but also AtomISP, the IPU bridge, and the WV517S lens actuator.

On September 2, 2026, Maurizio Casciano submitted a v7 patch series to enable the camera hardware stack of the Lenovo Yoga Book YB1-X91 tablet. This patch fleshes out driver support for the front and rear camera modules that work with AtomISP on the Intel Cherry Trail platform.

According to the patch details, the rear OV8858 sensor gets a 19.2 MHz clock setting and Cherry Trail-specific gain programming, while the front OV2740 sensor implements a 288 MHz link frequency setting and manual white balance control. In addition, a WV517S lens actuator driver was added, enabling hardware control for autofocus (AF).

It also includes optimization of AtomISP's RAW frame capture logic and CSI-2 timing adjustments, as well as IPU bridge data and firmware ID mapping, and is expected to greatly improve the stability of the lower-level image pipeline.

### Camera HAL/Driver perspective: what it means

There is no direct HAL change, but because the OV2740's manual white balance and the OV8858's gain control are exposed as V4L2 controls, you should verify that Camera HAL3 3A metadata control requests are accurately mapped to the kernel driver's V4L2 controls and work correctly.

**Sources**

- [[PATCH v7 00/16] media: Add Yoga Book camera support](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/T/#t)

---

## 5. libcamera control storage union naming patch v3 accepted


![libcamera control storage union naming patch v3 accepted image](../../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork analysis_

A v3 patch giving a clear name to the control storage union structure inside libcamera was submitted and moved to accepted state. The stated purpose in the commit message is to make it possible to copy the storage as a single unit regardless of which member is active, and this patch is the first of a 5-patch series that introduces a move constructor and a swap() operation.

On September 3, 2026, the v3 libcamera control storage union naming patch submitted by Barnabás Pőcze was confirmed as accepted in the project patch tracker. The main point of this patch is to give a clear name to the control storage structure that was previously declared as an anonymous union.

The reason for naming the union members is to copy the storage as a single block regardless of the active member. The same patch renames the members to internal and external to distinguish in-place storage from dynamically allocated storage, and also removes some reinterpret_cast uses that became unnecessary. This patch is the first part of the Move constructor/assignment + swap series (v3, 5 patches); the remaining four patches remove a bit field, implement the move constructor and assignment operator, implement swap(), and add an rvalue overload of ControlList::set().

Engineers who build and use libcamera directly, or who develop driver stacks by adding custom controls, should take note of this change to prevent minor compile compatibility issues that may arise when updating sources in the future.

### Camera HAL/Driver perspective: what it means

This part by itself is a step that tidies up the storage representation, so it does not change HAL runtime behavior. However, projects that customize the libcamera source and integrate it into the lower layers of an Android HAL should check build compatibility to make sure the union naming change does not cause compile errors in existing custom control code.

**Sources**

- [[v3,1/5] libcamera: controls: Give name to the union containing storage](https://patchwork.libcamera.org/patch/28179/)

---

## 6. libcamera patch posted to skip unnecessary stop call before the software ISP worker starts


![libcamera patch posted to skip unnecessary stop call before the software ISP worker starts image](../../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork analysis_

A patch has been submitted that fixes a problem in libcamera's software image signal processing (software_isp) component where a call would hang indefinitely when starting the camera failed. It changes the code to return early instead of waiting for a worker thread that has not yet started, so that the original capture error is passed on to the caller as-is.

On September 6, 2026, Birk Skyum submitted a patch via the libcamera patch tracker that fixes the stop path of software_isp. software_isp is a core module that performs image processing using CPU resources on systems without a hardware ISP.

According to the patch description, the simple pipeline calls stop() before SoftwareIsp::start() runs if the capture device fails to start streaming. At that point, Debayer::stop(), called in a blocking manner, waits indefinitely for a worker thread that has not yet started, so the call itself never returns. This patch removes this wait by changing it to return early if the worker has not been started.

Thanks to this, Camera::start() can report the original capture error to the caller. The patch links libcamera issue 349 on freedesktop GitLab as its basis, and its current state in the patch tracker is superseded, with a follow-up revision posted.

### Camera HAL/Driver perspective: what it means

There is no direct HAL change, but if you have seen a symptom where opening the camera fails and the call hangs without returning in a pipeline that goes through the software ISP, you can suspect this path. Please check, with a scenario that deliberately injects a capture start failure, that the error is propagated up to the upper layers.

**Sources**

- [libcamera: software_isp: Skip stop before worker start](https://patchwork.libcamera.org/patch/28194/)


## Further reading

- [Leverage Android skills and Gemma 4 in Android Studio Quail 4](<https://android-developers.googleblog.com/2026/09/leverage-gemma-4-android-studio-quail.html>) — Android Developers Blog (2026-09-01) · Reference for C++ / AI-native tooling
- [Emulator control for adaptive app development](<https://android-developers.googleblog.com/2026/08/emulator-adaptive.html>) — Android Developers Blog (2026-08-31) · Reference for C++ / AI-native tooling
- [\[PATCH RESEND v3 0/2\] media: i2c: Add Samsung S5KJN5 image sensor](<https://lore.kernel.org/linux-media/20260901-sk5jn5-v3-0-17e728917bd4@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-01) · Reference for camera drivers / image pipeline
- [\[v1\] libcamera: pipeline: simple: Rework software-isp/converter selection](<https://patchwork.libcamera.org/patch/28156/>) — libcamera Patchwork (patch review) (2026-08-31) · Reference for camera drivers / image pipeline

## References

- [[PATCH v6 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/T/#t)
- [[PATCH v6 00/13] arm64: dts: qcom: Add x1e/Hamoa camera DTSI](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/T/#t)
- [[PATCH v7 00/16] media: Add Yoga Book camera support](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/T/#t)
- [[v3,1/5] libcamera: controls: Give name to the union containing storage](https://patchwork.libcamera.org/patch/28179/)
- [libcamera: software_isp: Skip stop before worker start](https://patchwork.libcamera.org/patch/28194/)
