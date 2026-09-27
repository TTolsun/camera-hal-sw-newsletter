# 2026 W39 (09.21 ~ 09.27)

This week's newsletter brings news of new hardware support and driver stability improvements. The proposed patch to enable Arm Mali-C55 ISP and IVC hardware acceleration for the Renesas RZ/V2H EVK board promises performance enhancements for the new platform. Additionally, a proposed Linux kernel driver patch for the Samsung S5K3T2 20-megapixel image sensor lays the groundwork for integrating new sensors. The proposed patch to prevent ISYS firmware resource leaks when removing Intel IPU7 drivers will further enhance driver stability. Finally, don't miss the announcement of support for integrating various AI agents based on developer choice in Android Studio.



## 1. This week’s articles

- Android Studio Announces Support for Integrating Various AI Agents Based on Developer Choice
- Proposed Patch to Enable Arm Mali-C55 ISP and IVC Hardware Acceleration for Renesas RZ/V2H EVK Board
- Proposed Linux Kernel Driver Patch for Samsung S5K3T2 20-Megapixel Image Sensor
- Proposed Patch to Prevent ISYS Firmware Resource Leaks on Intel IPU7 Driver Device Removal

## 2. Android Studio Announces Support for Integrating Various AI Agents Based on Developer Choice


![Android Studio AI agent integration interface](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgVijlUmODt3ow1Idsd8Ym6PooGBLRhyphenhyphen-iQZDu4HdVmBqD2pXpoToSAS95n2KGmCOPZffaac-lFhs11rbr49ooB6HyzI6ePNGzhQ83xx-5qTwPUOnwlKbWLP5bIPi1CmDy-vU0UVVW_dh-T2jLK33nbI1gBwHxmIBoXV748JStkCSUONOoH5zBBHX0jlLE/s2049/BYOA-Backup-Metadata_1.png)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html)_


_Android Developers Blog_

The trend of integrating AI agents into development tools to maximize productivity is rapidly expanding into native development environments.

Android Studio recently announced open and flexible features that allow developers to integrate various AI coding agents, custom enterprise harnesses, and autonomous tools of their choice. This change focuses on helping developers build Android apps using the AI tools that best suit them.

According to Matthew Warner, Product Manager for Android Developer Experience, AI-powered development tools have become an essential component for increasing engineering productivity. Accordingly, Android Studio now provides an environment that allows development teams to utilize various AI agents tailored to their needs, rather than being limited to specific tools.

### Utilization in Native Development Workflows

This feature does not directly change the runtime behavior of the Android Camera HAL or drivers. However, it can indirectly contribute to the build, test, and debugging workflows of camera development teams working with native C++ code. For example, AI agents can be used to draft complex camera metadata processing logic or V4L2 control code, and to generate unit test scripts, thereby reducing the time spent on repetitive tasks.

However, general AI product news should not be misinterpreted as direct data path changes or runtime contract changes in the Camera HAL. This feature should be treated purely as a signal for workflow improvement that enhances the flexibility of development tools, and it is safer to review security policies and code leakage prevention guidelines before adopting it within a team.

### Camera HAL/Driver perspective: what it means

While there is no direct impact on Camera HAL runtime, AI agents can be utilized to enhance development productivity when developing native C++ camera modules and writing test scripts. This is particularly useful for generating complex HAL3 metadata mapping code or unit test boilerplate code.

**Sources**

- [Build your way: Use any AI agent of your choice in Android Studio](https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html)

---

## 3. Proposed Patch to Enable Arm Mali-C55 ISP and IVC Hardware Acceleration for Renesas RZ/V2H EVK Board


![Proposed Patch to Enable Arm Mali-C55 ISP and IVC Hardware Acceleration for Renesas RZ/V2H EVK Board image](../../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list_

Enabling camera hardware acceleration on a new SoC platform is the first step in determining the performance and power efficiency of the lower image pipeline.

A v2 series of Linux kernel device tree patches was recently proposed to add and enable Arm Mali-C55 ISP and IVC hardware acceleration nodes for the Renesas RZ/V2H EVK board. This change involves declaring hardware resources for the Mali-C55 ISP and the IVC (Input Video Control) block, which feeds frames from memory to the ISP, at the sub-driver level, and connecting video endpoints.

According to the patch details, this proposal includes descriptions for optional ISP DMA line tick interrupts and IVC frame start and end interrupts. When the hardware acceleration block is properly enabled and the appropriate Linux driver is loaded, a message indicating that Mali-C55 ISP version 9000043.31032022.0 has been detected can be seen in the system console.

### Technical Significance of Lower Stack Activation

While this patch series is still in the proposed stage and has not yet been merged into the Linux kernel mainline, it represents an essential lower-layer change for the Android Camera HAL to utilize hardware features on new SoC platforms. For the higher-level media framework and camera services to access physical sensor data, the ISP and IVC nodes must be correctly defined at the device tree level.

However, since this change focuses on the RZ/V2H EVK board, it cannot be assumed to apply immediately to other RZ/V2H variant platforms. Furthermore, it does not bring direct changes to the Android HAL or Camera2 API, and it should be noted that this is foundational work at the Linux kernel driver level.

### Camera HAL/Driver perspective: what it means

While not a direct Android HAL change, with Arm Mali-C55 ISP and IVC hardware acceleration enabled on new SoC platforms, the frame timing and format negotiation behavior of the lower image pipeline must be verified. In particular, it is necessary to monitor at the driver level whether ISP DMA line tick interrupts and IVC frame start and end interrupts operate correctly to avoid causing frame drops or delays.

**Sources**

- [[PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/T/#t)

---

## 4. Proposed Linux Kernel Driver Patch for Samsung S5K3T2 20-Megapixel Image Sensor


![Proposed Linux Kernel Driver Patch for Samsung S5K3T2 20-Megapixel Image Sensor image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

Integrating a new image sensor into a mobile platform requires accurately defining its hardware characteristics at the lower driver level as a prerequisite.

A v3 series of patches was recently proposed to add device tree binding and a driver for the Samsung S5K3T2 20-megapixel CMOS image sensor to the Linux kernel. This sensor is characterized by its use of four MIPI D-PHY lanes to transmit high-resolution image data.

The proposed driver was written based on the front camera hardware of the Xiaomi POCO F3 device and has been verified to work correctly with the Qualcomm CAMSS driver. However, since a mainline device tree for this device does not yet exist, the binding user was not directly included in this patch series.

### Significance of Adding an Image Sensor Driver

Adding a new image sensor driver to the kernel media subsystem is the first step towards utilizing the unique features of that sensor in Android devices. Only when sensor register settings, clock control, and MIPI lane configuration are completed at the driver level can the higher-level Camera HAL control sensor modes and ensure optimal image quality.

This patch is currently in the proposed stage, undergoing review as v3 revision, and has not yet been merged into the mainline kernel. Furthermore, since it was tested in a specific Qualcomm CAMSS environment, additional verification of driver compatibility and MIPI timing settings will be required when integrating it into other SoC platforms or media controller pipelines.

### Camera HAL/Driver perspective: what it means

While not a direct Android HAL change, when developing devices equipped with the Samsung S5K3T2 sensor, the initialization sequence of the lower V4L2 subdevice driver and MIPI D-PHY lane settings must be verified. In particular, it is necessary to confirm that data transmission stability in the 4-lane configuration and sensor exposure/gain register control are correctly mapped to the Camera HAL via V4L2 controls.

**Sources**

- [[PATCH v3 0/2] media: i2c: Samsung S5K3T2 image sensor](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/T/#t)

---

## 5. Proposed Patch to Prevent ISYS Firmware Resource Leaks on Intel IPU7 Driver Device Removal


![Proposed Patch to Prevent ISYS Firmware Resource Leaks on Intel IPU7 Driver Device Removal image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (Intel IPU)_

The stability of a camera driver depends not only on its ability to capture frames well but also on how perfectly it manages resources throughout the device's lifecycle.

A patch was recently proposed to address a resource leak issue in the Intel IPU7 image processing unit driver, where ISYS firmware resources were not being released upon device removal. In the existing driver implementation, the resource release helper function was only called when an error occurred during the probe stage, and was omitted during normal device unload.

This patch fixes the issue by adding a call to ipu7_fw_isys_release() within the isys_remove() function, which is the normal device removal path, ensuring that initialized ISYS firmware resources are properly returned to the kernel. This prevents potential memory leaks and resource exhaustion that can occur during repeated loading and unloading of the device driver.

### Improved Resource Management and System Stability

Preventing resource leaks at the camera driver level is crucial for the long-term operational stability of mobile and embedded systems. Accumulated resource loss, especially when drivers are repeatedly initialized and released during camera module power management or hot-plug scenarios, can lead to system downtime.

The proposed patch is currently under review and has not yet been merged into the mainline kernel. Platform development teams using Intel IPU7 hardware should verify that the driver's resource release logic functions correctly and monitor for memory leaks through long-term camera operation and repeated device re-initialization tests.

### Camera HAL/Driver perspective: what it means

While not a direct Android HAL change, this is an essential driver patch for ensuring camera service lifecycle management and system stability on platforms using the Intel IPU7 driver. It is necessary to confirm that ISYS firmware resources are fully released during driver unload and reload, and to monitor the trend of memory usage in the camera subsystem.

**Sources**

- [[PATCH] media: staging/ipu7: release ISYS firmware resources on remove](https://lore.kernel.org/linux-media/20260924110310.1555150-1-lgs201920130244@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260924110310.1555150-1-lgs201920130244@gmail.com/T/#t)


## Further reading

- [Test for \[PATCH v7 0/3\] Add support for the Sony IMX681 camera sensor](<https://lore.kernel.org/linux-media/20260926092828.11675-1-germanpapulindez@gmail.com/>) — lore.kernel.org linux-media list (2026-09-26) · Camera Driver / Image Pipeline Reference
- [\[PATCH v10 0/9\] media: qcom: camss: CAMSS Offline Processing Engine support](<https://lore.kernel.org/linux-media/20260925-camss-isp-ope-v10-0-2622411034cb@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-25) · Camera Driver / Image Pipeline Reference
- [\[PATCH v4 0/3\] Add CAMSS support for Qualcomm Glymur](<https://lore.kernel.org/linux-media/20260925-glymur_camss-v4-0-d7c2983d6d7b@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-25) · Camera Driver / Image Pipeline Reference
- [\[1/4\] libcamera: v4l2_event: Add V4L2Event class and functionality](<https://patchwork.libcamera.org/patch/28380/>) — libcamera Patchwork (patch review) (2026-09-25) · Camera Driver / Image Pipeline Reference

## References

- [[PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/T/#t)
- [[PATCH v3 0/2] media: i2c: Samsung S5K3T2 image sensor](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/T/#t)
- [[PATCH] media: staging/ipu7: release ISYS firmware resources on remove](https://lore.kernel.org/linux-media/20260924110310.1555150-1-lgs201920130244@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260924110310.1555150-1-lgs201920130244@gmail.com/T/#t)
- [Build your way: Use any AI agent of your choice in Android Studio](https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html)
