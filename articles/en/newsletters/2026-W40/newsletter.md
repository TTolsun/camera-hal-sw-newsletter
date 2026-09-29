# 2026 W39 (09.21 ~ 09.27)

This week, we cover 5 news items, including 'Android Studio's integrated support for developer-customized AI coding agents' and 'Anthropic Claude Opus 5.5 released: Fable 5.1-level performance with 40% cost reduction compared to Opus 5'.



## 1. This week’s articles

- Android Studio to support integrated developer-customized AI coding agents
- Anthropic Claude Opus 5.5 released: Fable 5.1-level performance with 40% cost reduction compared to Opus 5
- Proposed Renesas RZ/V2H EVK Device Tree Patch to Enable Arm Mali-C55 ISP and IVC
- Proposed Linux Kernel Driver Patch v3 for Samsung S5K3T2 Image Sensor Support
- Sharing Latest Kernel and libcamera Test Results for Sony IMX681 Camera Sensor Support Patch v7

## 2. Android Studio to support integrated developer-customized AI coding agents


![Announcement of support for selecting and integrating third-party AI agents in Android Studio](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgVijlUmODt3ow1Idsd8Ym6PooGBLRhyphenhyphen-iQZDu4HdVmBqD2pXpoToSAS95n2KGmCOPZffaac-lFhs11rbr49ooB6HyzI6ePNGzhQ83xx-5qTwPUOnwlKbWLP5bIPi1CmDy-vU0UVVW_dh-T2jLK33nbI1gBwHxmIBoXV748JStkCSUONOoH5zBBHX0jlLE/s2049/BYOA-Backup-Metadata_1.png)

_Image: [Build your way: Use any AI agent of your choice in Android Studio](https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html)_


_Android Developers Blog (2026-09-24)_

Android Studio now provides an environment where various AI agents can be freely selected and integrated, enabling development teams to build customized workflows.

Google announced that Android Studio will support open and flexible AI agent integration, allowing development teams to build Android apps in the most optimal way. Development teams can now freely adopt specialized AI coding agents, custom enterprise harnesses, and autonomous tools.

This update focuses on improving the productivity of developer tools and helps developers integrate and utilize their preferred AI tools directly within Android Studio.

### Changes in Native Development Workflow

This update concerns Android Studio development tools and does not directly modify Android camera HAL APIs or runtime behavior. Native C++ and HAL development teams can evaluate whether this integration can improve workflow productivity in code generation, debugging, and test case creation, and consider adopting AI tools suitable for their team's development environment.

### Camera HAL/Driver perspective: what it means

Although there are no direct HAL changes, C++ native development teams can consider integrating AI agents within Android Studio to improve code writing and debugging productivity.

**Sources**

- [Build your way: Use any AI agent of your choice in Android Studio](https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html)

---

## 3. Anthropic Claude Opus 5.5 released: Fable 5.1-level performance with 40% cost reduction compared to Opus 5


![Anthropic Claude Opus 5.5 released: Fable 5.1-level performance with 40% cost reduction compared to Opus 5](https://www-cdn.anthropic.com/images/4zrzovbb/website/f4d37a1d1f582f53f4e89440062b649b6273a093-1200x630.jpg)

_Image: [Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5)_


_Anthropic News (2026-09-22)_

Anthropic has unveiled Claude Opus 5.5, the first model in the Claude 5.5 family. It is stated to deliver Claude Fable 5.1-level performance in most tasks, with execution costs 40% lower than Opus 5.

Anthropic has unveiled Claude Opus 5.5, the first model in the new Claude 5.5 family. Before its release, it underwent testing by external evaluation organizations such as Frontier Design and METR. Anthropic stated that its most comprehensive alignment evaluation (automated behavioral audit), which checks if the AI behaves contrary to its intentions, yielded the best results among all models tested to date.

Claude Opus 5.5 is designed to deliver Claude Fable 5.1-level performance in most tasks, while its execution cost is approximately 40% lower than the previous Opus 5 model. It also comes with advanced safety features developed for the most capable models.

### Utilization in Native Development

This news concerns the performance improvement of general large language models and does not directly modify the Android camera HAL or driver stack. However, native C++ and camera driver development teams can consider Claude Opus 5.5 as a tool to enhance development productivity in implementing complex algorithms, writing test scripts, and debugging processes.

### Camera HAL/Driver perspective: what it means

Although there are no direct HAL changes, productivity can be improved by utilizing the Claude Opus 5.5 model for generating native C++ code snippets and writing unit test scripts.

**Sources**

- [Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5)

---

## 4. Proposed Renesas RZ/V2H EVK Device Tree Patch to Enable Arm Mali-C55 ISP and IVC


![Proposed Renesas RZ/V2H EVK Device Tree Patch to Enable Arm Mali-C55 ISP and IVC image](../../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list (2026-09-25)_

A device tree patch has been proposed to support hardware-accelerated image processing on the Renesas RZ/V2H EVK platform, which is expected to bring changes to the lower image pipeline.

This proposed patch series aims to activate hardware blocks by adding RZ/V2H(P) IVC nodes and Arm Mali-C55 ISP nodes and connecting their video endpoints. These changes improve frame timing control by defining optional ISP DMA line ticks and IVC frame start and frame stop interrupts.

After applying the patch and activating the driver, the Mali-C55 ISP version 9000043.31032022.0 detection message can be confirmed in the system console. This indicates that the image signal processor is correctly recognized and ready to operate at the hardware level.

### Laying the Foundation for Hardware-Accelerated Image Processing

This patch series is a proposed change that has not yet been merged into the mainline kernel. While it does not directly alter the actual higher-level Android camera HAL or framework contracts, it provides the essential foundation for leveraging hardware acceleration capabilities in the lower driver layers. Development teams should continuously track the merge status of this patch and any changes in controls exposed via the V4L2 interface.

### Camera HAL/Driver perspective: what it means

Although there are no direct Android HAL changes, the ISP and IVC control interfaces exposed via the V4L2 uAPI in the lower driver layer, as well as frame start and stop interrupt timings, need to be reviewed.

**Sources**

- [[PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/T/#t)

---

## 5. Proposed Linux Kernel Driver Patch v3 for Samsung S5K3T2 Image Sensor Support


![Proposed Linux Kernel Driver Patch v3 for Samsung S5K3T2 Image Sensor Support image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (2026-09-24)_

A Linux kernel driver patch has been proposed to support Samsung's 20-megapixel CMOS image sensor, the S5K3T2, which is expected to contribute to future new device integration.

This proposed patch series adds a driver and device tree binding for the Samsung S5K3T2, a 20-megapixel CMOS image sensor supporting four MIPI D-PHY lanes. This sensor is installed in the front camera of the Xiaomi POCO F3 device.

The driver was written and tested in an environment where the Qualcomm CAMSS driver was enabled. However, since the mainline kernel currently does not include the device tree for the Xiaomi POCO F3, this patch series itself does not add a device tree node that directly uses the binding.

### Considerations for Android HAL Integration

This change is still in the proposed stage and has not yet been merged into the mainline kernel. The addition of a new sensor driver extends the scope of support for the lower driver layer and does not directly affect the actual Android HAL. If there is a future project using the S5K3T2 sensor, development teams can review the V4L2 subdevice controls and sensor mode settings of this driver to formulate an integration plan.

### Camera HAL/Driver perspective: what it means

Although there are no direct HAL changes, when introducing the S5K3T2 sensor, the sensor mode settings via the V4L2 subdevice and MIPI D-PHY lane configuration should be reviewed in advance.

**Sources**

- [[PATCH v3 0/2] media: i2c: Samsung S5K3T2 image sensor](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/T/#t)

---

## 6. Sharing Latest Kernel and libcamera Test Results for Sony IMX681 Camera Sensor Support Patch v7


![Sharing Latest Kernel and libcamera Test Results for Sony IMX681 Camera Sensor Support Patch v7 image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (2026-09-26)_

A report on testing Sony IMX681 camera sensor support patch series v7 in the latest kernel and libcamera environment has been released. The tester built the kernel after additional modifications but reported finding several issues during camera inspection.

This test report covers patch series v7, which adds support for the Sony IMX681 camera sensor. The test environment used the latest stable channel versions of Mesa version 3:26.2.3-1 and libcamera version 0.7.2-4.1, with kernel version 7.3-rc4 applied.

The kernel compiled correctly only after applying an additional patch that removed one line: `const struct v4l2_subdev_client_info *ci`. The tester then reported finding several issues affecting the camera when driving it using the CPU or GPU. Detailed information on each issue should be checked in the original email.

### Changes in libcamera and V4L2 Stack

This test is a validation result for proposed changes that have not yet been merged. New camera sensor support for libcamera and V4L2 drivers directly impacts the Linux image pipeline and provides the lower-layer support necessary for the Android HAL to process and expose image data through that sensor in the future. This report is not a verification that the driver operates without issues, but rather a signal that problems still remain to be solved. Therefore, development teams should monitor the author's responses to the reported issues and whether subsequent versions incorporate fixes.

### Camera HAL/Driver perspective: what it means

Although there are no direct HAL changes, if considering the adoption of IMX681, it is advisable to confirm how the reported CPU/GPU path issues and build modifications are resolved in subsequent versions before scheduling integration, rather than using v7 as is.

**Sources**

- [Test for [PATCH v7 0/3] Add support for the Sony IMX681 camera sensor](https://lore.kernel.org/linux-media/20260926092828.11675-1-germanpapulindez@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260926092828.11675-1-germanpapulindez@gmail.com/T/#t)


## References

- [[PATCH v2 0/4] arm64: dts: renesas: Enable ISP and IVC on RZ/V2H EVK](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260925-mali-c55-renesas-dts-v2-0-69f728a474a2@kernel.org/T/#t)
- [[PATCH v3 0/2] media: i2c: Samsung S5K3T2 image sensor](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260924-upstream-s5k3t2-v3-0-a5c58dfcec29@proton.me/T/#t)
- [Test for [PATCH v7 0/3] Add support for the Sony IMX681 camera sensor](https://lore.kernel.org/linux-media/20260926092828.11675-1-germanpapulindez@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260926092828.11675-1-germanpapulindez@gmail.com/T/#t)
- [Build your way: Use any AI agent of your choice in Android Studio](https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html)
- [Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5)
