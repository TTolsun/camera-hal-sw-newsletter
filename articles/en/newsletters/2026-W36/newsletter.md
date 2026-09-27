# 2026 W35 (08.24 ~ 08.30)

This week covers 5 stories, including ‘AtomISP driver adds Lenovo Yoga Book OV2740 sensor link and D-PHY timing derivation support’ and ‘libcamera reviews patch adding Quad-Bayer CFA layout support for high-resolution sensor handling’.



## 1. This week’s articles

- AtomISP driver adds Lenovo Yoga Book OV2740 sensor link and D-PHY timing derivation support
- libcamera reviews patch adding Quad-Bayer CFA layout support for high-resolution sensor handling
- Linux kernel: Lenovo Yoga Book YB1-X91 camera driver and sensor integration patch series posted
- Sony IMX908 image sensor: Linux Device Tree binding added, laying the groundwork for official support
- libcamera adds filter parameter to createTexture2D() in the software ISP EGL module

## 2. AtomISP driver adds Lenovo Yoga Book OV2740 sensor link and D-PHY timing derivation support


![AtomISP driver adds Lenovo Yoga Book OV2740 sensor link and D-PHY timing derivation support image](../../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list - PATCH v3_

A PATCH v3 patch series improving the integration of the AtomISP bridge driver and the OV2740 image sensor has been submitted to the Linux kernel media subsystem. This change compensates at the driver level for incomplete camera link information in the hardware firmware, and supports dynamically deriving D-PHY timing from the sensor link frequency.

The newly posted PATCH v3 patch series targets integration of the front OV2740 camera sensor of the Lenovo Yoga Book YB1-X91L device. The existing firmware does not provide complete camera link information, which made it difficult for the driver to configure the image pipeline. To solve this, the driver level was changed to explicitly specify that the front OV2740 sensor uses 2 CSI-2 lanes and operates at a 288 MHz link frequency.

In addition, the transmitted frame format is defined as 1932x1092 BGGR, configured to add 12 pixels of padding horizontally and vertically around the actual 1920x1080 image area. This padding information is managed by the AtomISP bridge together with the per-sensor link frequency, and is used as base data for the control logic that derives the ISP2401 D-PHY timing.

These driver-level changes improve the stability of the lower image pipeline and help the Android Camera HAL receive accurate data when it queries sensor modes and frame timing through the V4L2 interface. Although it is not a direct HAL API change, it is an important reference when validating RAW Bayer capture and stream configurations.

### Camera HAL/Driver perspective implications

Driver-level D-PHY timing derivation and padding handling pass through the V4L2 subsystem and affect stream configuration validation in the Android Camera HAL. In particular, during RAW Bayer capture, if the padding pixels (12 pixels) are not correctly reflected in metadata (such as the active array size), image distortion or CTS test failures can occur, so this should be checked carefully.

**Sources**

- [[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link](https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/T/#t)

---

## 3. libcamera reviews patch adding Quad-Bayer CFA layout support for high-resolution sensor handling


![libcamera reviews patch adding Quad-Bayer CFA layout support for high-resolution sensor handling image](../../../assets/images/fallback/android.svg)


_libcamera Patchwork - Patch ID 28095_

A patch has been proposed that adds support to the libcamera framework for the Quad-Bayer CFA (Color Filter Array) layout, which is widely used in recent high-resolution image sensors. This change is expected to contribute to improving the accuracy of RAW data processing in the lower image processing pipeline.

High-resolution image sensors in recent mobile devices often adopt a Quad-Bayer structure to improve sensitivity and reduce noise. However, the existing libcamera framework had limitations in handling such special CFA layouts differently from the standard Bayer pattern. This patch adds support so that libcamera can directly recognize and handle the Quad-Bayer layout.

This patch, submitted by Frederic Laing, includes Quad-Bayer CFA layout support along with improvements to how the stride of unpacked Bayer data is handled. Because incorrect stride alignment can cause memory overruns or image distortion, this change is very important for ensuring the stability of the image pipeline.

Because the Android Camera HAL often uses libcamera as a lower layer, these changes directly affect improving buffer alignment and debayering quality when the HAL processes RAW_SENSOR or RAW10/RAW12 streams. It will be an important technical foundation for teams preparing to adopt high-resolution sensors in the future.

### Camera HAL/Driver perspective implications

With the libcamera layer directly recognizing and handling the Quad-Bayer CFA layout, the debayering quality and the accuracy of stride calculation for the RAW data that the Android Camera HAL receives from the lower stack are improved. This helps prevent buffer overflows or memory alignment errors when the HAL processes RAW_SENSOR or RAW10/RAW12 streams.

**Sources**

- [libcamera: Add quad-Bayer CFA layout support](https://patchwork.libcamera.org/patch/28095/)

---

## 4. Linux kernel: Lenovo Yoga Book YB1-X91 camera driver and sensor integration patch series posted


![Linux kernel: Lenovo Yoga Book YB1-X91 camera driver and sensor integration patch series posted image](../../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list - PATCH v2_

A Linux kernel driver patch series (PATCH v2) to fully support the camera hardware of the Lenovo Yoga Book YB1-X91 device has been posted. This patch focuses on compensating at the driver level for missing ACPI firmware information and integrating control of the front/rear sensors and the lens actuator.

The Lenovo Yoga Book YB1-X91L device is based on the Cherry Trail AtomISP and carries a front OV2740 sensor and a rear OV8858 sensor. However, the existing system firmware did not provide enough information for the driver to configure complete camera links. This patch series overcomes this limitation by adding ACPI IDs and bridge data.

The main changes in the patch series include adding descriptions for both camera links, sensor clock and mode support, and exposing RAW Bayer capture. In addition, per-channel white balance control and a WV517S lens actuator driver for the rear camera were added, greatly expanding the scope of hardware control.

This functional expansion of the lower-level drivers becomes the foundation for the Android Camera HAL to accurately recognize the physical characteristics of the hardware and smoothly implement 3A (auto exposure, auto white balance, auto focus) control. It will be an important reference model for engineers responsible for hardware integration.

### Camera HAL/Driver perspective implications

With RAW Bayer capture exposure, per-channel white balance control, and a lens actuator (WV517S) added at the driver level, the Camera HAL can directly map the 3A (Auto Exposure, Auto White Balance, Auto Focus) controls of this hardware through V4L2 controls. This is essential for meeting the HAL's `android.control` metadata contract and passing CTS/VTS verification.

**Sources**

- [[PATCH v2 00/11] media: Add Lenovo Yoga Book YB1-X91 camera support](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/T/#t)

---

## 5. Sony IMX908 image sensor: Linux Device Tree binding added, laying the groundwork for official support


![Sony IMX908 image sensor: Linux Device Tree binding added, laying the groundwork for official support image](../../../assets/images/fallback/android.svg)


_lore.kernel.org linux-media list - PATCH v3_

A Device Tree binding patch (PATCH v3) for official Linux kernel support of the Sony IMX908 image sensor has been posted. This binding definition provides a standard hardware interface configuration guide for developers of SoC platforms that carry the new sensor.

The Sony IMX908 is a high-performance CMOS image sensor that supports 8.39-megapixel (3856x2176) resolution. It supports RAW10 and RAW12 output over a MIPI CSI-2 interface, and features flexible configuration of 2 or 4 data lanes depending on system requirements.

In this PATCH v3, reflecting the actual hardware design specification, the binding description was adjusted so that the I2C slave target address is selected dynamically by the hardware SLAVE pin setting. This is an essential element for preventing address conflicts depending on the board design.

Once the Device Tree binding is integrated into the kernel, the sensor node can be declared in the standard way in dts files when developing Android devices. This becomes the starting point for the Android Camera HAL to accurately recognize the sensor's physical resolution and data formats through the driver and to configure RAW streams.

### Camera HAL/Driver perspective implications

When the sensor's MIPI CSI-2 lane count (2 or 4 lanes) and RAW formats (RAW10/RAW12) are correctly defined in the kernel through the Device Tree binding, the Camera HAL can query accurate sensor resolution (3856x2176) and format information from the driver. This contributes to building the HAL's `SensorCharacteristics` metadata and securing the stability of high-resolution RAW stream combinations.

**Sources**

- [[PATCH v3 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/T/#t)

---

## 6. libcamera adds filter parameter to createTexture2D() in the software ISP EGL module


![libcamera adds filter parameter to createTexture2D() in the software ISP EGL module image](../../../assets/images/fallback/android.svg)


_libcamera Patchwork - v15_

A v15 patch has been posted that allows fine-tuning of image processing quality in the software ISP EGL module of the libcamera framework. This change adds a parameter so that filtering options can be controlled directly when creating textures, increasing the flexibility of the GPU-accelerated rendering pipeline.

On low-cost SoC platforms where a hardware ISP is limited or absent, the role of a software ISP that uses the CPU and GPU is very important. libcamera provides the software_isp module for such environments and uses GPU acceleration through EGL. The v15 patch submitted this time adds a filter parameter to `createTexture2D()`, one of the core functions of the EGL module.

This patch, proposed by Milan Zamazal, lets developers directly specify options such as Linear or Nearest filtering when creating textures. Filtering options directly affect the visual sharpness and aliasing quality of the result in image scaling or debayering post-processing stages.

When implementing an Android Camera HAL that uses libcamera's software ISP as the lower image processing pipeline, this added filter parameter makes it possible to fine-tune preview image quality even further. It will be a useful tool for balancing performance and image quality.

### Camera HAL/Driver perspective implications

Because filtering options can now be controlled when the software ISP creates EGL textures, visual quality (e.g., reduced aliasing, sharpness adjustment) can be fine-tuned in GPU-accelerated image scaling or debayering post-processing stages. This directly affects improving preview image quality when implementing a libcamera-based Android Camera HAL on entry-level SoC platforms without a hardware ISP.

**Sources**

- [[v15,1/6] libcamera: software_isp: egl: Add filter parameter to createTexture2D()](https://patchwork.libcamera.org/patch/28105/)


## Further reading

- [\[PATCH v4 14/15\] media: atomisp: allow raw Bayer capture - Maurizio Casciano](<https://lore.kernel.org/linux-media/749f33adb08c4b311aec241c0bdcc455fcdc0a3c.1787933456.git.mauriziocasciano7@gmail.com/>) — lore.kernel.org linux-media list (2026-08-28) · Reference for camera drivers / image pipeline
- [Camera ITS tests](<https://source.android.com/docs/compatibility/cts/camera-its-tests>) — AOSP Site Updates (2026-07) · Reference related to the AOSP Camera framework

## References

- [[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link](https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com/T/#t)
- [libcamera: Add quad-Bayer CFA layout support](https://patchwork.libcamera.org/patch/28095/)
- [[PATCH v2 00/11] media: Add Lenovo Yoga Book YB1-X91 camera support](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com/T/#t)
- [[PATCH v3 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/T/#t)
- [[v15,1/6] libcamera: software_isp: egl: Add filter parameter to createTexture2D()](https://patchwork.libcamera.org/patch/28105/)
