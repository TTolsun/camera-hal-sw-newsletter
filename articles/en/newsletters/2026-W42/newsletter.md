# 2026 W41 (10.05 ~ 10.11)

This week, we look at AOSP's proposed conditional camera mute, a review of Qualcomm CAMSS ISP parameter uAPI documentation, and the announcement of Claude Haiku 5.5. The two camera-related articles are still in the proposal/review stage, so we have distinguished between the conditions for application and the points to check. Haiku is introduced as an auxiliary model for repetitive coding tasks, and we propose methods for comparing quality, cost, and response time in actual work.



## 1. This week’s articles

- AOSP cameraserver proposes patch to maintain conditional mute when privacy toggle is enabled
- Claude Haiku 5.5: A low-cost auxiliary model for repetitive coding tasks
- Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch

## 2. AOSP cameraserver proposes patch to maintain conditional mute when privacy toggle is enabled


![AOSP cameraserver proposes patch to maintain conditional mute when privacy toggle is enabled image](../../../assets/images/fallback/newsletter-default.svg)


_AOSP Gerrit (camera changes under review)_

A patch has been proposed to AOSP to fix an issue where clients of a visible UID that supports camera mute are forcibly terminated immediately after a privacy toggle.

Simply put, this proposal aims to distinguish between obscuring camera video and disconnecting the app's camera connection. Taking the example of blocking camera access during a video conference, if the app is visible on screen and the device supports camera mute, the video is blocked while maintaining the connection; otherwise, the connection is severed as before. Here, "mute" refers to blocking camera video, not muting the microphone. This proposal aims to reduce unnecessary connection terminations while maintaining privacy protection, and it is not yet a fully implemented feature.

The Gerrit change 4348947, submitted to the android17-release branch on October 7, proposes modifying the privacy handling path in CameraService.cpp. The reviewed revision is still in the NEW state and is not yet a change fully reflected in Android.

The commit message explains that for the same privacy toggle, SensorPrivacyManager callbacks and AppOpsManager's opChanged() are executed via different binder paths. opChanged() checks UID visibility and camera mute support, but the patch author points out that if an unconditional block() in another path executes first, it severs the client connection by returning ERROR_CAMERA_DISABLED.

### Conditions for mute application and maintained blocking paths

The diff adds the same condition check to blockAllClients() and blockPrivacyEnabledClients(). It calls setCameraMute(true) only when the UID's process state is PROCESS_STATE_BOUND_TOP or lower and supportsCameraMute() is true; otherwise, it maintains the existing block(). The commit message explains that the mute support determination is related to ANDROID_SENSOR_AVAILABLE_TEST_PATTERN_MODES.

blockClientsForUid(), used when a UID becomes inactive, is not changed by this patch. Therefore, this should not be interpreted as a change that maintains camera sessions for all apps. Since no results from actual measurements of race resolution or performance improvement on devices are provided, the intent of the patch and the actual verification results should be distinguished.

### Camera HAL/Driver perspective: what it means

When testing privacy toggles, it is necessary to differentiate based on UID visibility and camera mute support, and verify that the connection is maintained only when conditions are met. Blocking of other clients and the UID inactive path also need to be verified.

**Sources**

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)

---

## 3. Claude Haiku 5.5: A low-cost auxiliary model for repetitive coding tasks


![Anthropic's small AI model Claude Haiku 5.5 announced and its utilization in native development workflows](https://www-cdn.anthropic.com/images/4zrzovbb/website/89e9b0fbfe0181f6ca565d913686ce8e49b5e9c2-1200x630.jpg)

_Image: [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)_


_Anthropic News Official Announcement_

The need to assign all repetitive tasks, such as build error summarization or simple classification, to large models is reduced. Anthropic has announced Haiku 5.5, targeting these tasks and coding auxiliary agents.

Claude Haiku 5.5, announced on October 7, is a small language model focused on quickly processing many requests while reducing costs. The official announcement lists summarization, conversation content compression, database querying, and classification as typical repetitive tasks.

In coding, it suggests a configuration where it is used as an auxiliary agent alongside Opus 5.5 or Sonnet 5.5. This can be understood as a larger model managing the overall task, while smaller, divisible tasks are assigned to Haiku. Which tasks to separate should be determined by the team's actual input and output quality.

### An option to adjust both cost and accuracy

Anthropic explains that Haiku 4.5 has an average execution cost approximately 75% lower. This is an average comparison provided by the vendor, and there is no guarantee that all requests or our team's monthly costs will decrease by the same amount. The 'effort' setting, newly introduced to the Haiku series, is a means to adjust the trade-off between cost and response performance.

The Camera HAL development team could use build error log summarization and classification as test subjects. This is an editorial suggestion and does not mean that the original text verified performance on Camera HAL logs. By providing the same sample to the current model and Haiku, and comparing the accuracy rate, the omission rate of critical errors, cost per request, and response time, a decision can be made on whether to adopt it.

The practical value of this news is that there is now an option to assign repetitive tasks to a separate model. Tasks that have sufficient performance should be separated first, but this should not be used as a basis for a wholesale transition of complex root cause analysis.

### Camera HAL/Driver perspective: what it means

Development tool managers can compare the current model with Haiku 5.5 using samples of build error log summarization and classification. The criterion for adoption is to measure whether cost and response time can be improved while maintaining accuracy and omission rates.

**Sources**

- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)

---

## 4. Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch


![Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list_

A patch series documenting the V4L2 metadata format for controlling ISP parameters of the Qualcomm CAMSS subsystem is being reviewed at v10 revision.

On October 6, review comments were posted on the linux-media mailing list regarding the PATCH v10 documentation patch submitted on September 25. This patch includes a proposal for the V4L2_META_FMT_QCOM_ISP_PARAMS metadata format for Qualcomm CAMSS ISP parameters. This format is designed based on the common V4L2 extensible ISP parameter structure.

The ope_params node of the Offline Processing Engine (OPE), a key component, is the first to utilize this metadata format. It configures hardware modules such as white balance gain, color correction matrix, and gamma curve by placing block-unit structures within the metadata buffer.

### Discussion on uAPI structure and header compatibility

During the review process, opinions were exchanged regarding the application of common ISP structures, v4l2_isp_buffer and v4l2_isp_block_header. Standardization efforts within the kernel are ongoing, moving towards using common structures instead of legacy driver compatibility structures.

### Camera HAL/Driver perspective: what it means

When integrating Qualcomm platform kernel drivers, it is necessary to pre-check changes to the qcom-camss-config.h uAPI structure and v4l2_isp common headers.

**Sources**

- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)


## Further reading

- [\[PATCH 0/3\] media: Add GalaxyCore GC5035 and GC8034 sensor drivers](<https://lore.kernel.org/linux-media/20261009072733.39877-1-nicfio@gmail.com/>) — lore.kernel.org linux-media list (2026-10-09) · Camera driver / Image pipeline reference
- [\[PATCH 0/2\] media: i2c: Add OmniVision OV3660 image sensor driver](<https://lore.kernel.org/linux-media/20261008160650.73927-1-tien.nguyenminh@embeddedlinux.blog/>) — lore.kernel.org linux-media list (2026-10-08) · Camera driver / Image pipeline reference
- [\[PATCH v1 0/2\] media: support upside-down camera mounting](<https://lore.kernel.org/linux-media/20261007034914.1654831-1-jimmy.su@intel.com/>) — lore.kernel.org linux-media list (2026-10-07) · Camera driver / Image pipeline reference
- [\[PATCH v3 0/2\] media: rkisp1: Add YUV bypass support for rkisp1](<https://lore.kernel.org/linux-media/20261006-media-rkisp1-add-yuv-bypass-support-for-rkisp1-v3-0-93d3d43991a0@ideasonboard.com/>) — lore.kernel.org linux-media list (2026-10-06) · Camera driver / Image pipeline reference

## References

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)
- [[PATCH v10 5/9] media: Documentation: uapi: Add qcom-camss ISP params documentation](https://lore.kernel.org/linux-media/7fde4308-f177-4031-bca0-de576ce69a7e@nxp.com/)
- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)
