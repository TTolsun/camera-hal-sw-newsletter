# 2026 W40 (09.28 ~ 10.04)

This week's newsletter covers important news for Android 17 camera validation and new feature proposals for libcamera. Ensure consistency in your test environment with the recommendation for bundling virtual environment packages for Android 17 Camera Image Test Suite validation. Additionally, explore ways to enhance the precision of sub-image pipeline control with the libcamera automatic white balance control expansion and metadata override proposals.



## 1. This week’s articles

- Recommendations for Bundling Virtual Environment Packages for Android 17 Camera Image Test Suite Validation
- libcamera Automatic White Balance Control Expansion and Metadata Override Proposal

## 2. Recommendations for Bundling Virtual Environment Packages for Android 17 Camera Image Test Suite Validation


![Android Open Source Project](https://www.gstatic.com/devrel-devsite/prod/vfdb441d2e08dbd9d3e48d8cd72b242388a87bcf7626bf5fb9df50c2bdd4a70fd/androidsource/images/lockup.png)

_Image: [Android 17 Camera Image Test Suite release notes | Android Open Source Project](https://source.android.com/docs/compatibility/cts/its-release-notes-17)_


_Android Open Source Project Official Documentation_

Teams preparing for Android 17 camera validation should pay attention to new recommendations for maintaining test environment consistency.

The environment configuration for the Android 17 Camera Image Test Suite has changed. According to the official documentation, it is strongly recommended to use package management software to bundle the correct versions of packages when setting up a virtual environment.

This recommendation covers the standards for Python and related package versions. These are factors that directly affect the development and validation environment configuration of the Camera Image Test Suite.

### Ensuring Test Environment Consistency

Test environments that validate the behavior of the camera hardware abstraction layer are prone to unexpected errors due to Python package version mismatches. The proposed virtual environment bundling method is a measure to prevent such version fragmentation and increase the reliability of validation.

However, this change does not modify the actual behavior or interface of the hardware abstraction layer itself. It is merely a recommended guideline to be applied when configuring the test environment to validate the hardware abstraction layer implementation.

### Camera HAL/Driver perspective: what it means

For validating the camera hardware abstraction layer targeting Android 17 and above, it is necessary to introduce package management software to synchronize Python package versions when setting up the Camera Image Test Suite execution environment. This helps reduce environmental random errors that may occur during test script execution.

**Sources**

- [Android 17 Camera Image Test Suite release notes | Android Open Source Project](https://source.android.com/docs/compatibility/cts/its-release-notes-17)

---

## 3. libcamera Automatic White Balance Control Expansion and Metadata Override Proposal


![libcamera Automatic White Balance Control Expansion and Metadata Override Proposal image](../../../assets/images/fallback/newsletter-default.svg)


_libcamera Patchwork Mailing List_

New design proposals for more precise automatic white balance control in the sub-image pipeline are being discussed.

The first piece of a patch series to expand automatic white balance control functionality in the libcamera project has been submitted. This proposal moves the existing draft-stage automatic white balance state to core controls.

According to the proposal, the AwbLocked metadata item, which indicates the automatic white balance state, will be redefined as a control command that locks the state. Additionally, an AwbTrigger mechanism will be newly added to temporarily force recalculation of white balance gain values even when the state is locked.

### Distance from Sub-Image Pipeline

This change is a proposal for libcamera, a Linux-based sub-camera stack, and will not be immediately reflected in the Android camera hardware abstraction layer. It should be viewed as a design reference showing how automatic white balance behavior is refined at the sub-image pipeline level.

Currently, this patch is in a proposed state and is under review on the mailing list. Also, some of the provided summary information is omitted, so the detailed operating conditions of the gain recalculation enforcement mechanism may change in the future.

### Camera HAL/Driver perspective: what it means

Although not a direct change to the Android camera hardware abstraction layer, it provides a reference for how automatic white balance state locking and forced triggering are implemented at the sub-image pipeline level. It will be useful for reviewing control alignment with lower-level drivers when designing automatic white balance metadata mapping for the Android camera hardware abstraction layer in the future.

**Sources**

- [[1/5] libcamera: controls: Expand AWB controls](https://patchwork.libcamera.org/patch/28387/)


## Further reading

- [\[PATCH 3/3\] media: mali-c55: Keep ISP powered while IRQ wake is armed](<https://lore.kernel.org/linux-media/20260929-mali-c55-irq-supend-resume-v1-3-e3af34afff12@kernel.org/>) — lore.kernel.org linux-media list (2026-09-29) · Mali-C55 ISP Power Management Patch Proposal
- ChromeOS camera changes: [camera: Bounds-check APPn parsing and BLOB output buffer size - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8424692>) (2026-09-30) · [camera: Enforce exclusive buffer IDs - chromiumos/platform2](<https://chromium-review.googlesource.com/c/chromiumos/platform2/+/8411146>) (2026-09-30)

## References


