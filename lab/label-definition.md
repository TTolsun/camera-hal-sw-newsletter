# MAIN_USABLE — Week 01 label definition

One binary label per candidate: `yes` or `no`.

Judge each candidate from four fields only: `title`, `url`, `source_name`, `summary`.
Do not open the URL. The LLM judge sees exactly these four fields, so reading more
than it can see would measure the wrong thing.

A candidate is `yes` when all three conditions hold. If any one fails, it is `no`.

**1. Subject.** The document the URL points at directly covers at least one part of
the Android or Linux camera stack: camera HAL (HIDL or AIDL), camera2 or CameraX,
libcamera, V4L2 and the media subsystem, ISP or sensor drivers, CTS or ITS, or
camera-related SoC and vendor code. A general Android or developer article that
merely mentions camera once as an example does not qualify.

**2. Specificity.** At least one of a version or release number, an API or component
name, or a described behaviour change is present, so that "what changed" can be
written in one sentence. "Coming soon" or "various improvements" does not qualify.

**3. Self-containment.** That single URL is enough to check the claim. Playlists,
landing pages, and roundup hubs whose actual content lives in child links do not
qualify.

When the three conditions do not clearly settle it, label `no`. The tie-break is
deliberately conservative: this label asks whether one URL can carry the factual
basis of a main article, not whether the topic is interesting.

## Freezing

The definition freezes the moment the sixth calibration item is labelled. Changing
it after that invalidates every label already recorded, so a change means relabelling
all twenty from scratch.

Record the reason for any label that felt uncertain in `human_note`. Those notes are
the input to the disagreement analysis, and they are the only place where "the
definition was unclear here" can be distinguished from "the judge was wrong here".
