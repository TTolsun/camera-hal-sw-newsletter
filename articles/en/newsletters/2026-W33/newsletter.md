# 2026 W32 (08.03 ~ 08.09)

This week covers ‘Driver proposed for the onsemi AR0234 CMOS image sensor with global shutter (PATCH v2)’ and ‘Adding device tree bindings for Sony IMX908 8.39MP sensor support (PATCH v2)’.



## 1. This week’s articles

- Driver proposed for the onsemi AR0234 CMOS image sensor with global shutter (PATCH v2)
- Adding device tree bindings for Sony IMX908 8.39MP sensor support (PATCH v2)

## 2. Driver proposed for the onsemi AR0234 CMOS image sensor with global shutter (PATCH v2)


![Driver proposed for the onsemi AR0234 CMOS image sensor with global shutter (PATCH v2) image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

This week, a v2 patch series adding a driver for the onsemi AR0234 CMOS image sensor with a global shutter was submitted to the Linux media subsystem. It can be useful in machine vision and AR/VR scenarios that require high-speed capture and precise frame synchronization.

Adding the onsemi AR0234 CMOS image sensor driver to the Linux kernel has important implications for Android Camera HAL and driver development. The sensor supports a global shutter and delivers up to 120fps at 1920x1200 resolution. This can be useful for high-speed image capture and certain machine vision applications.

Support for MIPI CSI-2 output, RAW Bayer formats (8/10-bit), and DPCM 10->8 compression directly affects how the HAL efficiently receives and processes data from the sensor. The HAL can pass this RAW data to the ISP (Image Signal Processor) for final image processing, or provide RAW output to apps through the Camera2 API.

A global shutter can improve image quality by preventing rolling shutter distortion when capturing moving objects, which becomes an important validation point for certain use cases. Development teams should closely review transfer stability when running at high frame rates and the decoding performance of the compressed format.

### Camera HAL/Driver perspective implications

The characteristics of a global shutter can be used for high-speed capture and machine vision scenarios in the Android Camera HAL. When configuring a 120fps high-speed stream, the HAL's buffer cycling period and the ISP's processing latency must be minimized, and you should verify that DPCM 10->8 decompression or the RAW Bayer 8/10-bit formats are correctly decoded in the ISP pipeline.

**Sources**

- [[PATCH v2 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/T/#t)

---

## 3. Adding device tree bindings for Sony IMX908 8.39MP sensor support (PATCH v2)


![Adding device tree bindings for Sony IMX908 8.39MP sensor support (PATCH v2) image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

This week, a v2 patch series adding Linux device tree bindings for the Sony IMX908 8.39MP CMOS image sensor was submitted. A hardware interface definition was added for a sensor that supports high-resolution RAW output, laying the groundwork for platform integration.

Adding device tree bindings for the Sony IMX908 sensor means providing the hardware information the Linux kernel needs to recognize and initialize the sensor. The device tree is the mechanism for passing hardware configuration information to the kernel on Linux systems; for camera sensors, it defines important parameters such as MIPI CSI-2 lane configuration, clocks, power management, and I2C addresses.

The fact that the IMX908 is an 8.39-megapixel (3856x2176) CMOS image sensor supporting RAW10 and RAW12 output suggests that the Android Camera HAL must be able to handle high-resolution RAW data from this sensor. The HAL passes this RAW data to the ISP or exposes it directly to apps through the Camera2 API, enabling advanced image processing features.

Because the correctness of the device tree bindings directly affects the correct operation of the sensor and the stability of the camera pipeline, HAL and driver developers should review this change closely. In particular, it is important to confirm whether sufficient bandwidth is secured for the configured number of MIPI CSI-2 lanes.

### Camera HAL/Driver perspective implications

The correctness of the device tree bindings determines whether sensor probing and initialization succeed. A high-resolution RAW12 (3856x2176) stream requires more buffer memory and bandwidth than RAW10, so DMA-BUF allocation and ISP input buffer size settings must be matched exactly in the HAL and driver layers.

**Sources**

- [[PATCH v2 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/T/#t)


## Further reading

- [v0.7.2](<https://gitlab.com/libcamera/libcamera/-/tags/v0.7.2>) — libcamera Upstream Releases (2026-07-10T11:12:38+01:00) · Reference on camera drivers / image pipelines

## References

- [[PATCH v2 0/2] media: i2c: Add onsemi AR0234 camera sensor driver](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/T/#t)
- [[PATCH v2 1/2] media: dt-bindings: imx908: Add Sony IMX908 sensor](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/T/#t)
