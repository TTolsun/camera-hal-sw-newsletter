# 2026 W31 (07.27 ~ 08.02)

This week covers 4 stories, including ‘V4L2 driver patch v6 published for the Himax HM1092 mono near-infrared sensor’ and ‘New V4L2 driver patch submitted for the onsemi AR0234 global shutter CMOS sensor’.



## 1. This week’s articles

- V4L2 driver patch v6 published for the Himax HM1092 mono near-infrared sensor
- New V4L2 driver patch submitted for the onsemi AR0234 global shutter CMOS sensor
- V4L2 driver patch v5 submitted for the OmniVision OG0VA1B mono VGA sensor
- Patch v9 published to support MIPI C-PHY configuration in the Qualcomm CAMSS camera subsystem

## 2. V4L2 driver patch v6 published for the Himax HM1092 mono near-infrared sensor


![V4L2 driver patch v6 published for the Himax HM1092 mono near-infrared sensor image](../../../assets/images/fallback/newsletter-default.svg)


_Himax HM1092 mono NIR sensor driver v6 patch_

V4L2 subdev driver patch v6 supporting the Himax HM1092 mono near-infrared (NIR) image sensor was submitted to the Linux kernel media subsystem.

The proposed patch v6 centers on adding a V4L2 subdev driver and Device Tree bindings for the Himax HM1092, a 1-megapixel mono near-infrared sensor commonly found in IR cameras used for face unlock on laptops and similar devices.

The sensor communicates over a single MIPI CSI-2 data lane and supports 10-bit RAW format output at 560x360 resolution. Along with this fixed mode, the driver exposes test pattern control, exposure control, and analog and digital gain controls through the V4L2 subdevice interface.

The patch is currently at the kernel mainline review stage, and applying it to actual Android devices or embedded platforms requires kernel integration by SoC vendors and OEMs. Because it is a driver-level change, it does not cause direct changes to the Android Camera HAL API or framework.

### Camera HAL/Driver perspective implications

There is no direct HAL API change, but in face recognition (Face Unlock) scenarios using IR cameras, you should confirm that the lower V4L2 subdev exposure and gain controls are correctly mapped to the Android Camera HAL's biometric metadata requirements.

**Sources**

- [[PATCH v6 0/2] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/T/#t)

---

## 3. New V4L2 driver patch submitted for the onsemi AR0234 global shutter CMOS sensor


![New V4L2 driver patch submitted for the onsemi AR0234 global shutter CMOS sensor image](../../../assets/images/fallback/newsletter-default.svg)


_onsemi AR0234 CMOS image sensor driver patch_

A new V4L2 driver patch for the onsemi AR0234 global shutter CMOS image sensor, which supports high-speed capture, was submitted to the Linux kernel media subsystem.

Submitted on July 31, 2026, this patch adds a driver for the onsemi AR0234, a 1/2.6-inch global shutter sensor. The sensor has a 1940x1220 pixel array and supports 1920x1200 resolution output at high frame rates of up to 120fps, preventing rolling shutter distortion of moving subjects.

As its physical interface, it supports MIPI CSI-2 output with 1 to 4 data lanes, and it is notable for supporting raw Bayer (8/10-bit) and monochrome formats as well as a DPCM 10->8 compression mode. The driver was tested and validated on the Purwa EVK board.

Global shutter sensors play an important role in special-purpose devices such as high-speed motion capture, machine vision, and SLAM cameras in AR/VR headsets. The addition of this driver lays the lower-level groundwork for implementing high-performance global shutter camera solutions on Android embedded platforms.

### Camera HAL/Driver perspective implications

When adopting a global shutter sensor, you should verify at the driver and HAL layers whether YUV/RAW frames are dropped in high frame rate (120fps) stream configurations and whether bandwidth bottlenecks arise depending on the MIPI CSI-2 lane configuration.

**Sources**

- [[PATCH 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/T/#t)

---

## 4. V4L2 driver patch v5 submitted for the OmniVision OG0VA1B mono VGA sensor


![V4L2 driver patch v5 submitted for the OmniVision OG0VA1B mono VGA sensor image](../../../assets/images/fallback/newsletter-default.svg)


_OmniVision OG0VA1B CMOS VGA image sensor driver patch_

V4L2 driver patch v5 for the OmniVision OG0VA1B mono VGA image sensor, suited for low-power auxiliary cameras and sensing, was submitted to the Linux kernel media subsystem.

Submitted on July 31, 2026, patch v5 adds driver support for the OmniVision OG0VA1B, an ultra-compact 1/10-inch mono CMOS VGA image sensor. The sensor outputs 10-bit RAW (Y10) frames at up to 640x480 resolution over a single-lane MIPI CSI-2 interface.

It uses an I2C-compatible SCCB bus as its control interface, and this driver patch has completed functional validation on the Purwa EVK board, including test pattern generator (TPG) operation.

Low-resolution mono sensors such as the OG0VA1B are mainly used in low-power embedded devices, security cameras, and as auxiliary sensors for gesture recognition or depth sensing. This driver addition is expected to broaden hardware choices when developing embedded Android systems.

### Camera HAL/Driver perspective implications

When receiving a VGA-class low-resolution Y10 RAW format stream, you should confirm that the ISP pipeline and Camera HAL correctly handle the 10-bit monochrome format (Y10) and allocate frame buffers properly.

**Sources**

- [[PATCH v5 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/T/#t)

---

## 5. Patch v9 published to support MIPI C-PHY configuration in the Qualcomm CAMSS camera subsystem


![Patch v9 published to support MIPI C-PHY configuration in the Qualcomm CAMSS camera subsystem image](../../../assets/images/fallback/newsletter-default.svg)


_Qualcomm CAMSS MIPI C-PHY support patch v9_

Patch series v9 was proposed to support high-bandwidth MIPI C-PHY physical layer configuration in the open-source camera subsystem (CAMSS) driver for Qualcomm platforms.

Submitted on July 29, 2026, patch series v9 extends the CSID (CSI Decoder) and CSIPHY (CSI PHY) components of Qualcomm CAMSS to support MIPI C-PHY mode configuration. MIPI C-PHY offers higher data throughput and better signal efficiency than the existing D-PHY, making it an essential technology for integrating the latest high-resolution, high-frame-rate smartphone camera sensors.

However, because this patch does not fully address all the feedback raised in previous review rounds, it was submitted with a 'WIP' (Work In Progress) tag added. Additional revisions and review are therefore expected before it is merged into mainline.

Changes at the physical layer and driver level do not require direct modifications to the Android Camera HAL API. However, once the lower driver supports C-PHY mode stably, the HAL layer can gain the performance benefit of reliably handling higher-bandwidth stream configurations (for example, high-resolution RAW capture or high-frame-rate video).

### Camera HAL/Driver perspective implications

As the physical layer switches to C-PHY, you should closely verify through driver and ISP integration tests that no frame drops or transfer delays caused by signal integrity occur when configuring high-bandwidth streams.

**Sources**

- [[PATCH RESEND v9 0/9] media: camss: Add support for C-PHY configuration on Qualcomm platforms](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/) — [Full patch series](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/T/#t)


## Further reading

- [CameraX Release Notes - CameraX 1.7.0-alpha02](<https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha02>) — CameraX Release Notes (July 01, 2026) · Reference on the AOSP Camera framework
- [v0.7.2](<https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2>) — libcamera Upstream Releases (2026-07-10T11:12:38+01:00) · Reference on camera drivers / image pipelines

## References

- [[PATCH v6 0/2] media: Add Himax HM1092 mono NIR sensor driver](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/T/#t)
- [[PATCH 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/T/#t)
- [[PATCH v5 0/4] media: i2c: Add OmniVision OG0VA1B camera sensor driver](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/T/#t)
- [[PATCH RESEND v9 0/9] media: camss: Add support for C-PHY configuration on Qualcomm platforms](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/) — [Full patch series](https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/T/#t)
