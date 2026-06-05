# Plan: Per-article publish resilience (#3)

## Goal

When the editor draft contains a mix of binding-valid and binding-failed main
articles, publish the valid subset instead of failing the whole newsletter,
**provided** the surviving set still satisfies Newsletter Policy
(`articlePolicy.mainArticleCount.min` = 1) and all publish-safety gates.

This is the last lever blocking actual publication. Diagnosis on PR #522
(2026-06-06): quality score 64 (≥60), fact-check PASS, but `quality_status =
NEEDS_FIX` because 2 of 3 main articles have source-binding hard fails:

| # | Article | Result | Why it fails |
| - | --- | --- | --- |
| 1 | CameraX 1.6.0 | PASS (bound) | publishable, only soft image-fallback deduction |
| 2 | Google I/O CameraXViewfinder | FAIL | bound to a YouTube playlist URL; unresolved evidence_id |
| 3 | AOSP Camera ITS Honor Pad 20 | FAIL | fact claim tokens missing from resolved evidence text |

Dropping #2 and #3 leaves a fully publishable single-article newsletter
(policy min = 1). Publishing only the bound subset is *more* conservative than
today, so it does not weaken the publish-safety contract in AGENTS.md
("never publish source-less main articles").

## Non-goals / safety boundaries

- Do NOT lower `qualityGatePolicy.threshold` or any hard-fail condition.
- Do NOT relax source-binding / claim-evidence / HAL Signal Capsule validation.
- Do NOT publish an article that itself fails binding — only drop it.
- If dropping failed articles leaves fewer than `mainArticleCount.min`, keep the
  current diagnostics-only behavior (no publish).

## Key files

- `scripts/newsroom/cli/gemini-newsroom-newsletter.js` — editor draft → quality
  gate → targeted repair → final composition + publish decision orchestration.
- `scripts/newsroom/validate/editor-output-contract.js` — HAL Signal Capsule
  semantic validation (the `EditorSemanticValidationError` source).
- `scripts/newsroom/generate/newsroom-selection.js` — `mainArticleCount` min/max
  enforcement; composition gates.
- `scripts/newsroom/common/publish-status.js` — `artifact_final_publish_ready`
  conditions (quality_status_pass etc.).

## Approach (incremental, test-driven)

1. **Characterize the current repair/demote path.** Trace, in
   `gemini-newsroom-newsletter.js`, where article gate results (PASS / FAIL with
   `repair_action: replace-or-demote`) are produced and what currently happens
   when targeted repair cannot fix an article. Confirm whether a "demote = drop
   from main" outcome already exists and why it ends in NEEDS_FIX instead of a
   reduced publishable set.

2. **Add a post-repair "drop unrepairable failed articles" step.** After targeted
   repair has run and some articles still carry blocking binding/source-integrity
   hard fails:
   - Remove those articles from the editor draft (and their briefings/claims).
   - Re-run the deterministic composition check on the survivors.
   - If survivors ≥ `mainArticleCount.min` and survivors are all PASS and all
     publish-safety gates pass → recompute the quality gate on the survivor set
     so `quality_status` can become PASS.
   - Else → keep diagnostics-only.
   - Record dropped articles in `generation-status.json` /
     `selection-diagnostics` and the PR body (transparency: do not silently drop).

3. **Guard the HAL Signal Capsule failure path too.** If the editor throws
   `EditorSemanticValidationError` for a *subset* of articles, the same drop-and-
   retry logic should apply rather than failing the whole run. (If it throws for
   the entire draft, diagnostics-only remains correct.)

4. **Tests (required by scripts/newsroom/AGENTS.md):**
   - editor draft with 1 PASS + 2 binding-FAIL main articles → resolves to a
     publishable 1-article newsletter; dropped articles are reported.
   - editor draft where dropping failures would fall below min → stays
     diagnostics-only.
   - editor draft all-PASS → unchanged (no drops, publishes all).
   - dropped-article transparency fields present in status + PR body.

## Deploy / verify

- Branch + PR; merge to `main` (collect/generate run from `main`).
- `gh workflow run 00-newsletters-auto-daily-pr.yml --ref main`, then confirm the
  resulting newsroom-final PR has `public_newsletter_ready=true`,
  `newsletters/<date>/{newsletter.md,index.html}` present, and `data/newsletters.json`
  updated — with the dropped articles disclosed in the PR body.

## Status context (already merged on main)

- #519: unlock camera-driver sources (`candidateOnly` removal on lore, LWN feed, etc.).
- #520: per-source candidate cap so roundup noise can't evict driver leads (CI-verified).
- #521: `null` `final_publish_ready` is not a consistency error → editor failures
  degrade to a diagnostics PR instead of hard-failing the workflow.

These moved the gate from quality 6 (12 hard fails) to quality 64 with one fully
bound, publishable CameraX article. This plan is the final step to publication.
