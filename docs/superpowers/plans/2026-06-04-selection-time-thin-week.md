# Selection-time Thin-Week Handling — Implementation Handoff

> **For the next session.** Goal: when a thin week yields only a few *clean, publishable*
> articles, publish that small lineup (≥ `mainArticleCount.min`, currently 1) as a normal
> newsletter — instead of padding with weak filler articles that fail the gate and drag the
> whole issue to NEEDS_FIX / diagnostics-only. The decision must happen at **selection /
> composition time**, before the editor drafts and before headline/coverage machinery runs.

## Background — what already shipped (on `main`)

This is the continuation of a larger change that already landed:
- Deterministic quality/depth scoring was removed; editorial quality is now the fact-checker
  LLM's per-article usefulness verdict (`factCheck.article_quality[] {section_index, publishable, reason}`),
  criterion = "useful to a Camera HAL SW engineer" (topic-agnostic: C++/AI/Linux qualify).
- Publish gate = `PASS = no source gaps AND no fact-check must_fix AND no blocking deductions
  AND every article publishable`. No numeric threshold.
- PR #475 root cause fixed: the CameraX 1.7.0-alpha01 article now generates and passes
  individually (the old deterministic CameraX HAL-boundary / scope heuristics that blocked it
  were removed).
- `dateFramingGuardrail()` added to editor/repair/completion prompts (no "recently"/"최근" for
  old releases — use the actual date).

**Still unsolved (this doc):** thin weeks where only 1 strong article (e.g. CameraX 1.7.0) is
clean and the other 2 main slots are weak fillers (a Google I/O roundup reusing a release-note
URL; a stale catch-up the LLM marks `publishable=false`). The full lineup goes NEEDS_FIX →
diagnostics-only → not auto-published.

## Why the post-hoc "salvage" approach failed (do NOT repeat it)

A helper `salvagePublishableSubset(date, editor, reporter, factCheck, qualityReport, options)`
exists in [scripts/newsroom/validate/newsletter-quality.js](../../../scripts/newsroom/validate/newsletter-quality.js)
(exported, with 6 unit tests in
[tests/contract/quality-thin-week-salvage.test.js](../../../tests/contract/quality-thin-week-salvage.test.js)).
It correctly computes a clean publishable subset (drops failed/unpublishable sections, prunes
fact-check items to surviving sections, records dropped groups as hard-blocked, re-runs the
gate). **The logic works.** It is currently NOT wired into the orchestration.

Wiring it post-hoc (mutating `editor.sections` after the editor drafts) was attempted and
reverted because it violated, one after another, four publish invariants:
1. **Disposition markers** — `writeReviewableRepairFailureArtifacts` had already written
   `FAILED_REPAIR_REVIEWABLE` (via `recordEditorSemanticStatus({repairSucceeded:false})` +
   `editor_semantic_validation`), so the rendered subset disagreed with the status flag.
2. **Attempt-loop control flow** — the repair/completion catches `break`/`return`; threading the
   salvaged editor to the normal finalization is brittle.
3. **selected-group-coverage** — `validateSelectedGroupCoverage` in
   [scripts/newsroom/validate/editor-output-contract.js](../../../scripts/newsroom/validate/editor-output-contract.js)
   requires every *selected* candidate group to be rendered, demoted, or hard-blocked; dropping
   sections left "missing" groups.
4. **homepage-headline ↔ index anchor** — `persistHeadlineStateArtifacts` +
   `validate-site` require `data/homepage-headline.json current_headline.newsletter_article_url`
   anchor to exist in the rendered `index.html`; changing the lineup broke it.

**Lesson:** the lineup must be decided BEFORE the editor/headline/coverage machinery, not after.

## The correct approach — reduce the lineup at selection/composition time

The deterministic selector already chooses the main lineup and passes compact
`article-capsules.json` to the LLM (the LLM only enriches/drafts the chosen lineup; it does not
choose). So if selection itself does not pad thin weeks with weak fillers, the editor drafts
only the strong article(s), and all four invariants above are satisfied naturally.

The padding today comes from the catch-up lane + fill-open-slots composition
(`config/newsletter-policy.json` → `catchUpPolicy.activationMode: "fill_open_slots"`,
`targetMainArticles: 3`) and from promoting weak adjacent candidates (Google I/O roundup,
generic AI) into open main slots.

### Design questions to resolve first (brainstorm with the user)
1. **What signals at selection time predict "won't be publishable"?** Candidates with a shared
   rolling release-note URL but no per-item version/date evidence (the Google I/O roundup reused
   `/releases/camera#1.6.0`); generic adjacency with no concrete HAL value; stale catch-ups.
   These are *already* visible in selection metadata (scope, bucket, evidence_notes,
   `hasDatedEvidence`, source-quality). Note: `urlKeys` strips the `#anchor`, so multiple CameraX
   versions on `/releases/camera` collapse to one dedup key — relevant to the duplicate-URL trap.
2. **Thin-week composition policy:** when fewer than `targetMainArticles` *strong* candidates
   exist, should composition publish the strong subset (≥ min) and route weak candidates to
   reference/watch, instead of force-filling main slots? This is the core change.
3. Where exactly: `scripts/newsroom/generate/` (selection, shortlist, capsule, composition). Find
   where open main slots get filled and where catch-up/reserve promotion happens; gate that on a
   "strong candidate" predicate.

## Verification — build a LOCAL end-to-end harness FIRST

Do NOT iterate via the GitHub Actions `03-newsletters-editor-pr.yml` workflow — each run is
LLM-variable (the editor produced a different failure mode almost every run) and slow. Instead:
- Build a deterministic fixture/mocked-LLM harness that runs selection → composition →
  (mock reporter/editor/fact-check) → quality gate → disposition, asserting that a pool with
  1 strong + N weak candidates yields a publishable single-article newsletter that passes
  `validate` (group coverage, headline anchor, data/newsletters.json consistency).
- Existing fixtures live under `tests/fixtures/`. The quality builders are in
  `tests/helpers/quality-builders.js`. There is a selection-diagnostics harness at
  `scripts/newsroom/cli/test-selection-diagnostics.js`.
- Only after the local harness is green, do ONE confirming workflow run.

## Key files
- `scripts/newsroom/generate/**` — deterministic selection, shortlist, capsules, composition (the place to change).
- `config/newsletter-policy.json` — `catchUpPolicy`, `mainArticleCount {min:1,max:5}`, composition policy.
- `scripts/newsroom/cli/gemini-newsroom-newsletter.js` — orchestration; disposition ~line 4281 (`generationStatus`), headline persistence (`persistHeadlineStateArtifacts`), `writeReviewableRepairFailureArtifacts` (~1597), attempt loop (~3540).
- `scripts/newsroom/validate/editor-output-contract.js` — `validateSelectedGroupCoverage`.
- `scripts/newsroom/validate/newsletter-quality.js` — gate + `salvagePublishableSubset` (reuse its subset/fact-check-pruning logic as reference for what "clean subset" means).

## Guardrails (unchanged)
- Never weaken the safety gate (source binding, fact-check must_fix, claim evidence_id, required
  fields, composition counts, stale, duplicate URL). Editorial quality stays the fact-checker's call.
- Keep changes narrow; commits end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Baseline: `npm.cmd run test` + `npm.cmd run validate` both EXIT 0.
