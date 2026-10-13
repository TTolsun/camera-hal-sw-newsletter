# 2026 W41 (10.05 ~ 10.11)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This issue covers a proposed change to camera privacy controls, a review of the Qualcomm CAMSS control format, and the Claude Haiku 5.5 announcement. Both camera changes are still under review. Test Haiku on your own tasks before deciding whether to adopt it.

- [AOSP cameraserver proposes patch to maintain conditional mute when privacy toggle is enabled](#article-aosp-cameraserver-proposes-patch-to-maintain-conditional-mute-when-privacy-toggl)

  On supported devices, check that an app visible on screen stays connected while its video is blocked. For other apps and unsupported devices, check that the camera connection still closes as before.

- [Claude Haiku 5.5: A low-cost auxiliary model for repetitive coding tasks](#article-claude-haiku-5-5-a-low-cost-auxiliary-model-for-repetitive-coding-tasks)

  Teams responsible for development tools can compare Haiku 5.5 with their current model on build-log summaries and classification. Check whether it reduces cost and response time without reducing accuracy or missing more errors.

- [Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch](#article-discussion-on-qualcomm-camss-isp-parameter-uapi-format-documentation-v10-patch)

  When integrating Qualcomm kernel drivers, check the proposed changes to the qcom-camss-config.h uAPI structures and the shared v4l2_isp headers.




<a id="article-aosp-cameraserver-proposes-patch-to-maintain-conditional-mute-when-privacy-toggl"></a>

## 2. AOSP cameraserver proposes patch to maintain conditional mute when privacy toggle is enabled

_AOSP Gerrit (camera changes under review)_

An Android patch proposes blocking camera video without disconnecting an app that is visible on screen. The device must support camera mute. The change is still a proposal.

### Camera HAL/Driver perspective: what it means

On supported devices, check that an app visible on screen stays connected while its video is blocked. For other apps and unsupported devices, check that the camera connection still closes as before.


![](../../../assets/images/fallback/newsletter-default.svg)


The proposal separates two actions: blocking camera video and closing an app's camera connection. For example, if camera access is turned off during a video call, an app visible on screen would stay connected if the device supports camera mute. Otherwise, its connection would close as before. Here, "mute" means blocking camera video, not muting the microphone. The aim is to avoid unnecessary disconnections while preserving privacy. The feature has not yet been merged.

Gerrit change 4348947 was submitted to the android17-release branch on October 7. It proposes changes to privacy handling in CameraService.cpp. The revision reviewed for this issue was still marked NEW, so it was not yet part of Android.

The commit message describes two callbacks for the same privacy toggle: SensorPrivacyManager callbacks and AppOpsManager's opChanged(). They run through different binder paths. opChanged() checks UID visibility and camera mute support. According to the patch author, an unconditional block() in the other path can run first, returning ERROR_CAMERA_DISABLED and disconnecting the client.

### When camera mute applies, and when connections still close

The diff adds the same condition check to blockAllClients() and blockPrivacyEnabledClients(). It calls setCameraMute(true) only when the UID's process state is PROCESS_STATE_BOUND_TOP or lower and supportsCameraMute() is true. Otherwise, it keeps the existing block() behavior. The commit message links the mute support check to ANDROID_SENSOR_AVAILABLE_TEST_PATTERN_MODES.

The patch leaves blockClientsForUid(), which handles inactive UIDs, unchanged. It therefore does not keep camera sessions open for every app. No device measurements are provided to show that the race is resolved or performance improves. Treat those as outcomes to verify, not established results.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [cameraserver: Mute camera on sensor privacy enable instead of unconditional block - platform/frameworks/av](https://android-review.googlesource.com/c/platform/frameworks/av/+/4348947)

---

<a id="article-claude-haiku-5-5-a-low-cost-auxiliary-model-for-repetitive-coding-tasks"></a>

## 3. Claude Haiku 5.5: A low-cost auxiliary model for repetitive coding tasks

_Anthropic official announcement_

Anthropic has announced Haiku 5.5 for repetitive tasks and coding support. It offers an alternative to using larger models for tasks such as summarizing build errors or simple classification.

### Camera HAL/Driver perspective: what it means

Teams responsible for development tools can compare Haiku 5.5 with their current model on build-log summaries and classification. Check whether it reduces cost and response time without reducing accuracy or missing more errors.


![Claude Haiku 5.5 announcement graphic](https://www-cdn.anthropic.com/images/4zrzovbb/website/89e9b0fbfe0181f6ca565d913686ce8e49b5e9c2-1200x630.jpg)

_Image: [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)_


Claude Haiku 5.5, announced on October 7, is a small language model designed to handle many requests quickly at a lower cost. The announcement lists summarization, conversation compression, database queries, and classification as typical tasks.

For coding, Anthropic suggests using Haiku as a supporting agent alongside Opus 5.5 or Sonnet 5.5. A larger model can manage the overall task and assign smaller pieces to Haiku. Decide which tasks to delegate by testing the quality of its results on your team's actual inputs.

### Balancing cost and accuracy

Anthropic reports that Haiku 5.5 costs about 75% less to run on average than Haiku 4.5. This is the vendor's average comparison, not a guarantee of the same saving on every request or your team's monthly bill. The effort setting, new to the Haiku series, lets users adjust the balance between cost and answer quality.

Camera HAL teams could try it on build-log summaries and classification. This is an editorial suggestion; the source does not report tests on Camera HAL logs. Give Haiku and your current model the same samples, then compare answer accuracy, missed critical errors, cost per request, and response time before deciding whether to adopt it.

The practical benefit is another option for handling repetitive work. Start with tasks where testing shows adequate performance. These results would not justify moving all complex root cause analysis to Haiku.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)

---

<a id="article-discussion-on-qualcomm-camss-isp-parameter-uapi-format-documentation-v10-patch"></a>

## 4. Discussion on Qualcomm CAMSS ISP parameter uAPI format documentation v10 patch

_lore.kernel.org linux-media list_

A patch series proposes a V4L2 metadata format for controlling Qualcomm CAMSS ISP parameters. Its documentation is under review in revision v10.

### Camera HAL/Driver perspective: what it means

When integrating Qualcomm kernel drivers, check the proposed changes to the qcom-camss-config.h uAPI structures and the shared v4l2_isp headers.


![](../../../assets/images/fallback/newsletter-default.svg)


On October 6, reviewers commented on the linux-media mailing list about the PATCH v10 documentation submitted on September 25. The patch proposes V4L2_META_FMT_QCOM_ISP_PARAMS, a metadata format for Qualcomm CAMSS ISP parameters. It builds on the shared V4L2 extensible ISP parameter structure.

The Offline Processing Engine (OPE) node ope_params is the first to use this format. It places parameter blocks in a metadata buffer to configure hardware modules for white balance gain, the color correction matrix, and the gamma curve.

### Reviewing shared uAPI structures and header compatibility

Reviewers discussed using the shared ISP structures v4l2_isp_buffer and v4l2_isp_block_header. The ongoing kernel work aims to use these common structures instead of structures kept for compatibility with older drivers.

[Back to this week’s highlights](#issue-briefing)

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
