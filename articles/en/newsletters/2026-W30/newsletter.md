# 2026 W29 (07.13 ~ 07.19)

This week covers ‘libcamera: patch proposed to add IMX335 image sensor test pattern properties’.



## 1. This week’s articles

- libcamera: patch proposed to add IMX335 image sensor test pattern properties

## 2. libcamera: patch proposed to add IMX335 image sensor test pattern properties


![libcamera: patch proposed to add IMX335 image sensor test pattern properties image](../../../assets/images/fallback/newsletter-default.svg)


_IMX335 sensor properties under review on the libcamera patchwork_

A patch adding test pattern properties for the Sony IMX335 image sensor was recently proposed on the libcamera patchwork and is under review. The patch aims to define standardized test patterns at the driver level to make image pipeline validation and debugging easier.

On July 14, 2026, a new patch to add test pattern sensor properties for the Sony IMX335 image sensor was published through the libcamera project's patchwork. The patch is currently under community review, and its core is to let the libcamera framework correctly recognize and use the test pattern metadata provided by the sensor driver.

libcamera is the core abstraction layer of the Linux camera stack and controls the complex interaction between the sensor and the ISP on top of the V4L2 API. The proposed addition of IMX335 test pattern properties can be very useful for hardware validation and image pipeline debugging, because enabling standardized test patterns makes it possible to validate the sensor's own data output separately from the subsequent ISP processing stages.

However, the patch is still at the proposal and review stage (RFC/Patch review), so whether it will eventually be merged into mainline and when it would apply remain uncertain. Also, since this change does not directly modify the behavior of the Android Camera HAL API or framework, upper-layer developers should watch this trend from the perspective of preparing for compatibility of the lower drivers and media stack.

### Camera HAL/Driver perspective: what it means

This patch does not directly change the Android Camera HAL, but it provides a basis for using test pattern properties when validating the IMX335 sensor in the lower driver and libcamera stack. When integrating this sensor in the future, developers should check the validation path to confirm that driver-level test pattern metadata is correctly propagated through V4L2 and libcamera up to the HAL layer.

**Sources**

- [libcamera: camera_sensor: Add IMX335 test pattern sensor properties](https://patchwork.libcamera.org/patch/27362/)


## References

- [libcamera: camera_sensor: Add IMX335 test pattern sensor properties](https://patchwork.libcamera.org/patch/27362/)
