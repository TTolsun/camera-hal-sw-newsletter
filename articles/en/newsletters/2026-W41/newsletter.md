# 2026 W40 (09.28 ~ 10.04)

This week's newsletter covers various improvements that enhance the stability and efficiency of camera systems. First, we report on power management improvements for the Mali-C55 ISP driver, which prevent frame interrupt loss upon system resume. You will also find important updates on the ChromeOS camera stack, which strengthens image processing stability by introducing APPn parsing and BLOB buffer boundary checks, and the ChromeOS camera adapter, which prevents buffer management conflicts by enforcing exclusive buffer IDs.



## 1. This week’s articles

- Mali-C55 ISP Driver Power Management Improvement Prevents Frame Interrupt Loss on System Resume
- ChromeOS Camera Stack Enhances Image Processing Stability by Introducing APPn Parsing and BLOB Buffer Boundary Checks
- ChromeOS Camera Adapter Prevents Buffer Management Conflicts by Enforcing Exclusive Buffer IDs

## 2. Mali-C55 ISP Driver Power Management Improvement Prevents Frame Interrupt Loss on System Resume


![Mali-C55 ISP Driver Power Management Improvement Prevents Frame Interrupt Loss on System Resume image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (2026-09-29)_

If you've experienced the camera screen freezing or frames being lost when your system enters and wakes from standby, you might need to suspect the power management timing of the underlying driver.

A patch has been proposed to the Linux media subsystem mailing list to improve the power management behavior of the mali-c55 ISP driver. The patch focuses on resolving ISP interrupt loss issues that can occur during system suspend and resume.

In the existing structure, system suspend operated by calling pm_runtime_force_suspend() immediately after enabling IRQ wake. During this process, the active ISP's reset signal was asserted and its clock disabled, leading to a problem where the ISP could no longer generate frame interrupts. ISPs that were already in runtime suspend also remained powered off.

### Securing Power by Maintaining Runtime PM Reference

The proposed changes explicitly acquire a runtime PM reference before enabling IRQ wake and maintain it until the system fully resumes. This ensures that the idle ISP remains powered on and IRQ wake can be enabled normally. If IRQ wake setup fails, the acquired reference is immediately released to prevent unnecessary power consumption.

This patch is part of a proposed patch series that has not yet been merged into the Linux kernel mainline. Before applying it to actual hardware platforms, power consumption changes and camera pipeline stability during suspend/resume cycles must be thoroughly verified.

### Camera HAL/Driver perspective: what it means

This change contributes to improving the stability of the underlying ISP driver, providing a stable image stream to the HAL layer. SoC platform developers using the Mali-C55 ISP should check for frame drops or timeout logs in the HAL upon system suspend/resume, and monitor power consumption metrics to ensure that PM references are correctly released at the driver layer.

**Sources**

- [PATCH 3/3 media: mali-c55: Keep ISP powered while IRQ wake is armed](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/T/#t)

---

## 3. ChromeOS Camera Stack Enhances Image Processing Stability by Introducing APPn Parsing and BLOB Buffer Boundary Checks


![ChromeOS Camera Stack Enhances Image Processing Stability by Introducing APPn Parsing and BLOB Buffer Boundary Checks image](../../../assets/images/fallback/newsletter-default.svg)


_ChromeOS Gerrit (2026-09-30)_

If boundary checks are omitted when parsing image metadata during camera capture, it can lead to memory overflow or system crashes.

A security patch has been merged into the ChromeOS camera common library stack to improve image capture processing stability. This change focuses on preventing buffer overrun risks that can occur in the still image capture processor.

According to the Gerrit change, developers modified the source code of the still capture processor module to perform strict boundary checks when parsing APPn markers in JPEG images and when determining BLOB output buffer sizes. Specifically, the logic within the still capture processor source file was enhanced to compare the remaining buffer space with the size of the data to be parsed.

### Ensuring Safety of Image Metadata Parsing

APPn markers are areas within a JPEG file that contain application-specific metadata (e.g., Exif data). If the size of the input data is not properly validated when parsing this area, problems such as accessing incorrect memory addresses or writing data beyond the buffer size can occur. By adding these boundary checks, the camera service can safely handle exceptions without crashing, even when image frames containing abnormal metadata are input.

While this change has been applied to the ChromeOS platform's camera stack, it is an important stability improvement case that can also be referenced by Android Camera HAL and common image processor implementations that use the same JPEG parsing and BLOB buffer management mechanisms.

### Camera HAL/Driver perspective: what it means

The same vulnerability can occur when processing JPEG/BLOB streams in the Android Camera HAL. HAL developers should use static analysis tools and fuzzing tests to check for missing boundary checks on input buffer size and output BLOB buffer size during JPEG encoding and Exif/APPn metadata parsing.

**Sources**

- [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692)

---

## 4. ChromeOS Camera Adapter Prevents Buffer Management Conflicts by Enforcing Exclusive Buffer IDs


![ChromeOS Camera Adapter Prevents Buffer Management Conflicts by Enforcing Exclusive Buffer IDs image](../../../assets/images/fallback/newsletter-default.svg)


_ChromeOS Gerrit (2026-09-30)_

If the same ID is redundantly allocated or misused when managing camera buffers, it can lead to severe memory corruption or frame distortion.

A significant patch has been merged into the ChromeOS camera HAL adapter stack to improve buffer management consistency and prevent buffer ID conflicts. This change is designed to strictly enforce the exclusivity of buffer IDs at the camera device adapter layer.

According to the Gerrit change history, developers modified the source code of the camera device adapter to add logic that ensures each active camera buffer within the system has a unique and exclusive ID. This change contributes to maintaining buffer ID consistency throughout the buffer allocation and usage lifecycle.

### Preventing Buffer ID Conflicts and Misuse

When multiple streams are simultaneously active in the camera pipeline, if buffer IDs are not uniquely managed, a buffer from one stream can be incorrectly overwritten by another stream, or buffer ownership can become entangled at runtime. This patch prevents such concurrency bugs and memory management errors by enforcing exclusivity checks during buffer ID registration and de-registration.

While this change has been applied to the ChromeOS camera adapter, it also provides a good design standard for Android Camera HAL developers who need to manage complex buffer lifecycles in multi-stream environments, improving the stability of buffer management.

### Camera HAL/Driver perspective: what it means

Buffer ID exclusivity management is also very important in Android Camera HAL3 implementations. Since HAL3 manages buffer IDs by mapping them during frame requests, HAL developers must check buffer map registration logic to prevent buffer ID conflicts in multi-stream configurations, and implement defensive logic to immediately return an error if duplicate buffer IDs are input.

**Sources**

- [camera: Enforce exclusive buffer IDs - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146)


## Further reading

- [\[PATCH v2\] media: rcar-isp: ispcore: Fix inconsistent step sizes](<https://lore.kernel.org/linux-media/20261001085130.84565-1-barnabas.pocze+renesas@ideasonboard.com/>) — lore.kernel.org linux-media list (2026-10-01) · Android Platform · Media Output · SoC Signal Reference
- [camera: Prevent buffer UAF on PortraitModeEffect timeout - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424689>) — ChromeOS Gerrit (platform2 camera merged changes) (2026-09-30) · Camera Driver / Image Pipeline Reference
- [camera: Validate plane offsets in RegisterBuffer - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424691>) — ChromeOS Gerrit (platform2 camera merged changes) (2026-09-30) · Camera Driver / Image Pipeline Reference
- [camera: Validate plane sizes against dmabuf bounds in RegisterBuffer - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424690>) — ChromeOS Gerrit (platform2 camera merged changes) (2026-09-30) · Camera Driver / Image Pipeline Reference

## References

- [PATCH 3/3 media: mali-c55: Keep ISP powered while IRQ wake is armed](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/) — [Full patch series](https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/T/#t)
- [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692)
- [camera: Enforce exclusive buffer IDs - chromiumos/platform2](https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146)
