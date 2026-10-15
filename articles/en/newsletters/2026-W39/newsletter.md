# 2026 W38 (09.14 ~ 09.20)





<a id="issue-briefing"></a>

## 1. This week’s highlights

This week covers 5 stories, including ‘Claude Code projects feature redesigned, with conversational profiling and parallel PR opening’ and ‘Claude Code v2.1.271 released, with fast mode for remote sessions and improved TUI mouse support’.

- [Claude Code projects feature redesigned, with conversational profiling and parallel PR opening](#article-claude-code-projects-feature-redesigned-with-conversational-profiling-and-parall)

  Teams that review changes across multiple repositories can try out parallel PRs and the test flow with a single small task that can run in the cloud. Because each thread works on a separate branch and repository copy, merge conflicts need to be reviewed when the same code is modified. This does not mean that HAL builds or sensor validation that depend on local equipment or the internal network will run as-is in the cloud.

- [Claude Code v2.1.271 released, with fast mode for remote sessions and improved TUI mouse support](#article-claude-code-v2-1-271-released-with-fast-mode-for-remote-sessions-and-improved-tu)

  There is no direct change to HAL behavior, but it is useful for engineers who analyze and debug C++ camera stack code on large build servers or remote self-hosted runners. Using fast mode in remote sessions can reduce waiting time when analyzing complex build error logs or summarizing static analysis results, which helps maintain the continuity of the debugging workflow.

- [Codex rust-v0.155.1 released, improving API compatibility by disabling reasoning summaries by default in local TUI sessions](#article-codex-rust-v0-155-1-released-improving-api-compatibility-by-disabling-reasoning-)

  If you have run into request rejections while performing code analysis with the Codex CLI connected to a different API provider, you can check the reasoning summaries setting of new local TUI sessions. After updating, check whether the issue reproduces by distinguishing between the default setting and an explicitly enabled setting. This fix concerns whether reasoning summaries are supported; it does not guarantee full API compatibility or offline operation.

- [Intel IPU6 driver: v2 patch series proposed to prepare for multi-stream and metadata support](#article-intel-ipu6-driver-v2-patch-series-proposed-to-prepare-for-multi-stream-and-metad)

  Teams reviewing IPU6 changes will find it useful to first check the dependency relationship between this series and the follow-up metadata patches, and to run regression checks that existing single-stream capture still works before and after a backport. Verification of multi-stream behavior should be done on a configuration that includes the required follow-up patches. The proposal does not guarantee Android HAL3 API changes, complete simultaneous YUV/RAW support, or any buffer latency or performance improvement figures.

- [DMI quirk patch proposed to fix upside-down rear camera output on Microsoft Surface Pro 11](#article-dmi-quirk-patch-proposed-to-fix-upside-down-rear-camera-output-on-microsoft-surf)

  It can serve as an example when investigating sensor orientation errors, comparing the firmware's SSDB and _PLD information against the actual mounting orientation. On the affected Surface Pro 11 (Intel) model, compare the camera_sensor_rotation and libcamera Rotation values before and after the patch, and also check the preview and capture orientation. This patch alone does not guarantee Android SENSOR_ORIENTATION mapping, removal of GPU/CPU rotation cost, or passing CTS/VTS.




<a id="article-claude-code-projects-feature-redesigned-with-conversational-profiling-and-parall"></a>

## 2. Claude Code projects feature redesigned, with conversational profiling and parallel PR opening

_Claude Blog_

The project management feature of the AI coding tool Claude Code has been fully redesigned. Developers can now automate tasks such as code profiling, optimization testing, and parallel PR creation through conversational sessions.

### Camera HAL/Driver perspective: what it means

Teams that review changes across multiple repositories can try out parallel PRs and the test flow with a single small task that can run in the cloud. Because each thread works on a separate branch and repository copy, merge conflicts need to be reviewed when the same code is modified. This does not mean that HAL builds or sensor validation that depend on local equipment or the internal network will run as-is in the cloud.


![Claude projects redesigned interface showing conversation-based workflow](https://cdn.prod.website-files.com/68a44d4040f98a4adf2207b6/6aac1eaf2091cb214f764427_og_projects-redesigned.jpg)

_Image: [Claude Blog](https://claude.com/blog/projects-redesigned)_


On September 17, 2026, Anthropic announced that it had redesigned the project management feature of Claude Code around conversational sessions. Moving away from the previous simple folder-mapping approach, it was improved so that the AI can understand the full context of a project and drive complex development workflows.

In the new project environment, you can ask Claude to profile the performance of a specific endpoint, run code optimization tests, and, based on the results, instruct it to create multiple Pull Requests (PRs) simultaneously in parallel threads. It is also possible to connect multiple repositories such as API, web, and mobile at the same time to set and automate large refactoring goals such as 'remove the v1 endpoints'.

This update is currently offered as a beta to Claude Pro and Max subscribers who use Claude Code cloud sessions and do not have existing web/desktop projects. Anthropic plans to expand access to more users in the future.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Projects redesigned: from folder to conversation](https://claude.com/blog/projects-redesigned)

---

<a id="article-claude-code-v2-1-271-released-with-fast-mode-for-remote-sessions-and-improved-tu"></a>

## 3. Claude Code v2.1.271 released, with fast mode for remote sessions and improved TUI mouse support

_Claude Code Changelog_

Claude Code, an AI terminal coding tool, has been updated to v2.1.271. The main points of this update are a fast mode that speeds up processing in remote development sessions and improved mouse usability in the terminal user interface (TUI).

### Camera HAL/Driver perspective: what it means

There is no direct change to HAL behavior, but it is useful for engineers who analyze and debug C++ camera stack code on large build servers or remote self-hosted runners. Using fast mode in remote sessions can reduce waiting time when analyzing complex build error logs or summarizing static analysis results, which helps maintain the continuity of the debugging workflow.


![Claude Code v2.1.271 release open graph image](https://opengraph.githubassets.com/add00c53a834d0fc9e435e92939b09adb042a29923e9e24bccd2af203a0aa9c7/anthropics/claude-code/releases/tag/v2.1.271)

_Image: [Claude Code Changelog](https://github.com/anthropics/claude-code/releases/tag/v2.1.271)_


Claude Code v2.1.271, released on September 14, 2026, newly introduces a 'Fast Mode' that works in remote sessions, including cloud and self-hosted runners. If the host's fast mode setting is enabled or you enter the `/fast` command within a session, you can get faster AI responses within the scope allowed by your organization's security and usage policies.

In addition, mouse support has been added to the `/config` panel in full-screen mode so that settings can be changed conveniently in the terminal. Developers can now scroll the settings list with the mouse wheel and click a setting value to change it immediately, and the row under the mouse pointer is visually highlighted, allowing intuitive operation.

This minor update focuses on maximizing the productivity of developers who use remote computing resources in terminal-based AI development environments, and on improving the user experience when changing settings interactively.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Claude Code v2.1.271](https://github.com/anthropics/claude-code/releases/tag/v2.1.271)

---

<a id="article-codex-rust-v0-155-1-released-improving-api-compatibility-by-disabling-reasoning-"></a>

## 4. Codex rust-v0.155.1 released, improving API compatibility by disabling reasoning summaries by default in local TUI sessions

_Codex Releases_

The rust-v0.155.1 release of the Codex CLI disables reasoning summaries by default in new local TUI sessions. It fixes request rejections by API providers that do not support reasoning summaries, while preserving explicitly specified settings.

### Camera HAL/Driver perspective: what it means

If you have run into request rejections while performing code analysis with the Codex CLI connected to a different API provider, you can check the reasoning summaries setting of new local TUI sessions. After updating, check whether the issue reproduces by distinguishing between the default setting and an explicitly enabled setting. This fix concerns whether reasoning summaries are supported; it does not guarantee full API compatibility or offline operation.


![Codex rust-v0.155.1 release open graph image](https://opengraph.githubassets.com/60e99469eda788e15e80df021267df18b608398448e68c696b9d49d004c4bd91/openai/codex/releases/tag/rust-v0.155.1)

_Image: [Codex Releases](https://github.com/openai/codex/releases/tag/rust-v0.155.1)_


In Codex rust-v0.155.1, released on September 18, 2026, the Reasoning Summaries feature was changed to be disabled by default when starting a local terminal user interface (TUI) session. Previously, this feature was enabled by default, which caused requests to be abnormally rejected when using some LLM API providers that do not support reasoning summaries.

With this change, developers can communicate reliably with various API backends without additional configuration. However, if a user has explicitly configured the reasoning summaries feature to be enabled, that setting continues to be respected and works normally. (PR #46467)

This release contributes to removing a compatibility bottleneck that can occur when using AI coding tools in local development environments, and to maximizing the stability of integration with various model providers.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [Codex rust-v0.155.1](https://github.com/openai/codex/releases/tag/rust-v0.155.1)

---

<a id="article-intel-ipu6-driver-v2-patch-series-proposed-to-prepare-for-multi-stream-and-metad"></a>

## 5. Intel IPU6 driver: v2 patch series proposed to prepare for multi-stream and metadata support

_lore.kernel.org linux-media list (Intel IPU)_

A v2 series of 21 patches preparing multi-stream and metadata support for the Intel IPU6 driver has been proposed. Together with follow-up patches, it is preparatory work for handling multiple streams from a single source; it is not an announcement that the feature is complete with this series alone.

### Camera HAL/Driver perspective: what it means

Teams reviewing IPU6 changes will find it useful to first check the dependency relationship between this series and the follow-up metadata patches, and to run regression checks that existing single-stream capture still works before and after a backport. Verification of multi-stream behavior should be done on a configuration that includes the required follow-up patches. The proposal does not guarantee Android HAL3 API changes, complete simultaneous YUV/RAW support, or any buffer latency or performance improvement figures.


![](../../../assets/images/fallback/newsletter-default.svg)


On September 17, 2026, Intel's Sakari Ailus proposed a v2 patch series (21 patches in total) that prepares the IPU6 driver to stream multiple streams from a single source and to support metadata. This patch set was formed by splitting off the parts of the existing metadata series that can be merged early.

The author explains that they split off the parts of the metadata series that can be merged first. The goal is to prepare for handling multiple streams from a single source once the remaining required patches are merged, and also mentioned that it may depend on the previously proposed metadata preparation series.

However, this patch series is a proposal currently under review on the mailing list and has not yet been merged into the kernel mainline. Because fully implementing actual multi-stream operation requires additional metadata and stream control patches to be merged, driver integration teams should keep monitoring the progress of the patches.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH v2 00/21] IPU6 multi-stream and metadata support preparation](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/T/#t)

---

<a id="article-dmi-quirk-patch-proposed-to-fix-upside-down-rear-camera-output-on-microsoft-surf"></a>

## 6. DMI quirk patch proposed to fix upside-down rear camera output on Microsoft Surface Pro 11

_lore.kernel.org linux-media list (Intel IPU)_

A patch has been proposed that adds a DMI-based 180-degree rotation per-device quirk to the camera driver, to fix the rear camera image being output upside down on the Microsoft Surface Pro 11 (Intel) model.

### Camera HAL/Driver perspective: what it means

It can serve as an example when investigating sensor orientation errors, comparing the firmware's SSDB and _PLD information against the actual mounting orientation. On the affected Surface Pro 11 (Intel) model, compare the camera_sensor_rotation and libcamera Rotation values before and after the patch, and also check the preview and capture orientation. This patch alone does not guarantee Android SENSOR_ORIENTATION mapping, removal of GPU/CPU rotation cost, or passing CTS/VTS.


![](../../../assets/images/fallback/newsletter-default.svg)


According to a recently proposed Linux kernel media patch, the Microsoft Surface Pro for Business 11th Edition (Intel) model has its OV13858 rear camera sensor physically mounted rotated by 180 degrees. However, the system's SSDB data incorrectly records the rotation angle as 0 degrees, and the ACPI _PLD information that could compensate for this is also missing, so the driver had a defect where it could not correctly recognize the sensor orientation.

As a result, without a separate correction the camera preview and captured images are displayed upside down. To fix this, developer lsa.uz@pm.me proposed a patch on September 17, 2026 that adds a DMI quirk entry identifying this model to the Intel IPU bridge driver, forcing the rotation angle of the OVTID858 sensor to be reported as 180 degrees.

The submitter explains that on the target device they confirmed camera_sensor_rotation reads as 180 and that libcamera's Rotation value is also reported as 180. This is a verification result of the rotation information reported by the Linux driver. When applying the patch, you must separately check the target model and sensor identifiers and whether the change is included in the kernel you are using.

[Back to this week’s highlights](#issue-briefing)

**Sources**

- [[PATCH v2] media: ipu-bridge: Add upside-down quirk for Surface Pro 11](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/T/#t)


## Further reading

- [\[PATCH 11/11\] media: i2c: st-vd55g1: Support VD55G0 global-shutter image sensor](<https://lore.kernel.org/linux-media/20260918221832.323751-2-pm@petermarshall.ca/>) — lore.kernel.org linux-media list (2026-09-18) · Reference for camera drivers / image pipeline
- [\[PATCH 0/3\] Add Vision Components MIPI Camera Module support](<https://lore.kernel.org/linux-media/20260915-vc-mipi-ctrl-v1-0-8a42b693d889@linux.dev/>) — lore.kernel.org linux-media list (2026-09-15) · Reference for camera drivers / image pipeline
- [\[PATCH v2 0/5\] media: qcom: camss: fixes for several cameras behind a CSI-2 bridge](<https://lore.kernel.org/linux-media/20260915121557.20910-1-hitesh@ebytelogic.com/>) — lore.kernel.org linux-media list (2026-09-15) · Reference for camera drivers / image pipeline
- [\[PATCH v7 0/9\] media: qcom: camss: CAMSS Offline Processing Engine support](<https://lore.kernel.org/linux-media/20260915-camss-isp-ope-v7-0-77b13d131d3d@oss.qualcomm.com/>) — lore.kernel.org linux-media list (2026-09-15) · Reference for camera drivers / image pipeline

## References

- [[PATCH v2 00/21] IPU6 multi-stream and metadata support preparation](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/) — [Full patch series](https://lore.kernel.org/linux-media/20260917113923.59004-1-sakari.ailus@linux.intel.com/T/#t)
- [[PATCH v2] media: ipu-bridge: Add upside-down quirk for Surface Pro 11](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/) — [Full patch series](https://lore.kernel.org/linux-media/20260917144527.24804-1-lsa.uz@pm.me/T/#t)
- [Projects redesigned: from folder to conversation](https://claude.com/blog/projects-redesigned)
- [Claude Code v2.1.271](https://github.com/anthropics/claude-code/releases/tag/v2.1.271)
- [Codex rust-v0.155.1](https://github.com/openai/codex/releases/tag/rust-v0.155.1)
