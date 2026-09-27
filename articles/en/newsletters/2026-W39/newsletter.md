# 2026 W38 (09.14 ~ 09.20)

This week, we cover 5 news items, including 'Claude Code Project Features Redesigned, Supporting Conversational Profiling and Parallel PR Opening', and 'Claude Code v2.1.271 Release, Improving Remote Session Fast Mode and TUI Mouse Support'.



## 1. This week’s articles

- Claude Code Project Features Redesigned, Supporting Conversational Profiling and Parallel PR Opening
- Claude Code v2.1.271 Release, Improving Remote Session Fast Mode and TUI Mouse Support
- Codex rust-v0.155.1 Release, Improving API Compatibility by Default Disabling Reasoning Summaries in Local TUI Sessions
- Intel IPU6 Driver: Proposed v2 Patch Series for Multi-stream and Metadata Support
- Proposed DMI Quirk Patch to Fix Upside-Down Rear Camera Output on Microsoft Surface Pro 11

## 2. Claude Code Project Features Redesigned, Supporting Conversational Profiling and Parallel PR Opening


![Claude projects redesigned interface showing conversation-based workflow](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6aac1eaf2091cb214f764427_og_projects-redesigned.jpg)

_Image: [Claude Blog](https://claude.com/blog/projects-redesigned)_


_Claude Blog_

Claude Code, an AI coding tool, has undergone a complete redesign of its project management features. Developers can now automate tasks such as code profiling, optimization testing, and parallel PR creation through conversational sessions.

On September 17, 2026, Anthropic announced that Claude Code's project management features have been redesigned around conversational sessions. Moving beyond simple folder mapping, the improvements enable AI to understand the full project context and drive complex development workflows.

The new project environment allows users to ask Claude to profile the performance of a specific endpoint, conduct code optimization tests, and based on the results, instruct it to create multiple Pull Requests (PRs) simultaneously in parallel threads. It's also possible to connect multiple repositories—such as API, web, and mobile—at once to set and automate large refactoring goals like 'remove v1 endpoint'.

This update is currently in beta for Claude Pro and Max subscribers who use Claude Code cloud sessions and do not have existing web/desktop projects. Anthropic plans to expand access to more users in the future.

### Camera HAL/Driver perspective implications

Teams reviewing changes across multiple repositories can test parallel PRs and test flows with a small, cloud-executable task. Each thread operates on a separate branch and repository copy, so merge conflict review is needed for identical code modifications. This does not mean HAL builds or sensor validations that rely on local equipment or internal networks will run directly in the cloud.

**Sources**

- [Projects redesigned: from folder to conversation](https://claude.com/blog/projects-redesigned)

---

## 3. Claude Code v2.1.271 Release, Improving Remote Session Fast Mode and TUI Mouse Support


![Claude Code v2.1.271 release open graph image](https://opengraph.githubassets.com/add00c53a834d0fc9e435e92939b09adb042a29923e9e24bccd2af203a0aa9c7/anthropics/claude-code/releases/tag/v2.1.271)

_Image: [Claude Code Changelog](https://github.com/anthropics/claude-code/releases/tag/v2.1.271)_


_Claude Code Changelog_

Claude Code, an AI terminal coding tool, has been updated to version v2.1.271. This update focuses on Fast Mode, which speeds up processing in remote development sessions, and improved mouse usability in the Terminal User Interface (TUI).

Claude Code v2.1.271, distributed on September 14, 2026, introduces a new 'Fast Mode' that operates in remote sessions, including cloud and self-hosted runners. If the host's Fast Mode setting is enabled or the `/fast` command is entered within a session, users can receive faster AI responses, within the limits permitted by the organization's security and usage policies.

Additionally, mouse support has been added to the `/config` panel in full-screen mode to facilitate convenient setting changes in the terminal environment. Developers can now scroll through the settings list using the mouse wheel, click desired settings to change them instantly, and visually highlight the row where the mouse pointer is located for intuitive operation.

This minor update focuses on maximizing the work efficiency of developers utilizing remote computing resources in a terminal-based AI development environment and improving the user experience during interactive setting changes.

### Camera HAL/Driver perspective implications

While there are no direct HAL behavior changes, this is useful for engineers analyzing and debugging C++ camera stack code in large-scale build servers or remote self-hosted runner environments. Utilizing Fast Mode in remote sessions can reduce waiting times during complex build error log analysis or static analysis result summarization, helping maintain continuity in the debugging workflow.

**Sources**

- [Claude Code v2.1.271](https://github.com/anthropics/claude-code/releases/tag/v2.1.271)

---

## 4. Codex rust-v0.155.1 Release, Improving API Compatibility by Default Disabling Reasoning Summaries in Local TUI Sessions


![Codex rust-v0.155.1 release open graph image](https://opengraph.githubassets.com/60e99469eda788e15e80df021267df18b608398448e68c696b9d49d004c4bd91/openai/codex/releases/tag/rust-v0.155.1)

_Image: [Codex Releases](https://github.com/openai/codex/releases/tag/rust-v0.155.1)_


_Codex Releases_

The Codex CLI's rust-v0.155.1 release disables reasoning summaries by default in new local TUI sessions. This resolves request rejections from API providers that do not support reasoning summaries, while preserving explicitly specified settings.

In Codex rust-v0.155.1, released on September 18, 2026, the Reasoning Summaries feature is now disabled by default when starting new local Terminal User Interface (TUI) sessions. Previously, this feature was enabled by default, leading to abnormal request rejections when using some LLM API providers that do not support reasoning summaries.

This change allows developers to communicate stably with various API backends without additional configuration. However, if a user has explicitly configured reasoning summaries to be enabled, that setting will continue to be respected and function normally. (PR #46467)

This release contributes to eliminating compatibility bottlenecks that can occur when using AI coding tools in local development environments and maximizing the stability of integration with various model providers.

### Camera HAL/Driver perspective implications

If you've experienced request rejections while connecting the Codex CLI with other API providers for code analysis, you can check the reasoning summary settings for new local TUI sessions. After the update, differentiate between default settings and explicitly enabled settings to verify reproducibility. This fix addresses reasoning summary support and does not guarantee all API compatibility or offline behavior.

**Sources**

- [Codex rust-v0.155.1](https://github.com/openai/codex/releases/tag/rust-v0.155.1)

---

## 5. Intel IPU6 Driver: Proposed v2 Patch Series for Multi-stream and Metadata Support


![Intel IPU6 Driver: Proposed v2 Patch Series for Multi-stream and Metadata Support image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (Intel IPU)_

A v2 series of 21 patches has been proposed to prepare the Intel IPU6 driver for multi-stream and metadata support. This is preparatory work for handling multiple streams from a single source, along with subsequent patches, and is not an announcement that the functionality is complete with this series alone.

On September 17, 2026, Sakari Ailus of Intel proposed a v2 patch series (21 patches in total) to prepare the IPU6 driver to stream multiple streams from a single source and support metadata. This patch set was created by separating parts of the existing metadata series that could be merged early.

The author explains that parts of the metadata series that could be merged first were separated. The goal is to prepare for handling multiple streams from a single source once the remaining necessary patches are merged, and the author also mentioned the possibility of dependency on the previously proposed metadata preparation series.

However, this patch series is currently in the proposal stage, under review on the mailing list, and has not yet been merged into the kernel mainline. Full implementation of multi-stream operation will require the merging of additional metadata and stream control patches, so the driver integration team should continuously monitor the patch progress.

### Camera HAL/Driver perspective implications

Teams reviewing IPU6 changes can first check the dependencies between this series and subsequent metadata patches, and it's useful to perform regression testing to ensure existing single-stream capture is maintained before and after backporting. Verification of multi-stream operation should be done with a configuration that includes all necessary subsequent patches. The proposal does not guarantee Android HAL3 API changes, completion of YUV/RAW simultaneous support, or improvements in buffer latency or performance metrics.

**Sources**

- [[PATCH v2 00/21] IPU6 multi-stream and metadata support preparation](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/T/#t)

---

## 6. Proposed DMI Quirk Patch to Fix Upside-Down Rear Camera Output on Microsoft Surface Pro 11


![Proposed DMI Quirk Patch to Fix Upside-Down Rear Camera Output on Microsoft Surface Pro 11 image](../../../assets/images/fallback/newsletter-default.svg)


_lore.kernel.org linux-media list (Intel IPU)_

A patch has been proposed to add a DMI-based 180-degree device-specific quirk to the camera driver to fix the issue of the rear camera image appearing upside down on the Microsoft Surface Pro 11 (Intel) model.

According to a recently proposed Linux kernel media patch, the Microsoft Surface Pro for Business 11th Edition (Intel) model has its OV13858 rear camera sensor physically mounted rotated by 180 degrees. However, the system's SSDB data incorrectly records the rotation angle as 0 degrees, and ACPI _PLD information to compensate for this is missing, leading to a defect where the driver fails to correctly recognize the sensor orientation.

As a result, without separate compensation, camera preview and captured images appear upside down. To resolve this, developer lsa.uz@pm.me proposed a patch on September 17, 2026, to add a DMI quirk entry to the Intel IPU bridge driver that identifies this model and forces the OVTID858 sensor to report a 180-degree rotation angle.

The proposer confirmed that `camera_sensor_rotation` reads 180 and `libcamera`'s Rotation value also reports 180 on the target device. This is a verification result of the rotation information reported by the Linux driver. When applying the patch, it is necessary to separately confirm the target model/sensor identifier and whether the change is included in the kernel being used.

### Camera HAL/Driver perspective implications

This can be used as an example when investigating sensor orientation errors by comparing firmware's SSDB/_PLD information with the actual mounting direction. For the Surface Pro 11 (Intel) model, compare `camera_sensor_rotation` and `libcamera` Rotation values before and after the patch, and check the preview and capture orientation. This patch alone does not guarantee Android SENSOR_ORIENTATION mapping, elimination of GPU/CPU rotation costs, or CTS/VTS pass.

**Sources**

- [[PATCH v2] media: ipu-bridge: Add upside-down quirk for Surface Pro 11](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/T/#t)


## Further reading

- [\[PATCH 11/11\] media: i2c: st-vd55g1: Support VD55G0 global-shutter image sensor](<https://lore.kernel.org/linux-media/20260918221832.323751-2-pm@petermarshall.ca/>) — lore.kernel.org linux-media list (2026-09-18) · Camera Driver / Image Pipeline Reference
- [\[PATCH 0/3\] Add Vision Components MIPI Camera Module support](<https://lore.kernel.org/linux-media/20260915-vc-mipi-ctrl-v1-0-8a42b693d889@linux.dev/>) — lore.kernel.org linux-media list (2026-09-15) · Camera Driver / Image Pipeline Reference
- [\[PATCH v2 0/5\] media: qcom: camss: fixes for several cameras behind a CSI-2 bridge](<https://lore.kernel.org/linux-media/20260915121557.20910-1-hitesh@ebytelogic.com/>) — lore.kernel.org linux-media list (2026-09-15) · Camera Driver / Image Pipeline Reference
- [\[PATCH v7 0/9\] media: qcom: camss: CAMSS Offline Processing Engine support](<https://lore.kernel.org/linux-media/20260915-camss-isp-ope-v7-0-77b13d131d3d@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-15) · Camera Driver / Image Pipeline Reference

## References

- [[PATCH v2 00/21] IPU6 multi-stream and metadata support preparation](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/T/#t)
- [[PATCH v2] media: ipu-bridge: Add upside-down quirk for Surface Pro 11](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/T/#t)
- [Projects redesigned: from folder to conversation](https://claude.com/blog/projects-redesigned)
- [Claude Code v2.1.271](https://github.com/anthropics/claude-code/releases/tag/v2.1.271)
- [Codex rust-v0.155.1](https://github.com/openai/codex/releases/tag/rust-v0.155.1)
