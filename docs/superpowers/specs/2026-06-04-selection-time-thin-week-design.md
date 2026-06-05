# Selection-time Thin-Week Strong-Fill Gate — Design

> Design record for task B from
> [../plans/2026-06-04-selection-time-thin-week.md](../plans/2026-06-04-selection-time-thin-week.md).
> Local scratch (kept alongside the untracked plan); not part of the PR.

## Problem

A thin week with one strong, publishable article (e.g. CameraX 1.7.0-alpha01) gets padded to
`catchUpPolicy.targetMainArticles` (3) with weak fillers. The fillers fail the fact-checker, so the
whole issue goes NEEDS_FIX → diagnostics-only → not auto-published. The lineup must be decided at
selection/composition time (deterministic code), before the editor drafts.

## Root cause (verified in code + probe)

In `scripts/newsroom/generate/newsroom-selection.js`, **`selectFinalArticlesFromPool` is already
safe**: every pool (strong / native-tooling / optional / adjacent) is built from `mainEligible`
(`main_article_score_eligible !== false`, ~L981) and every addition goes through `pushUnique`
(~L907-919), which dedups on `selectedHasSameCameraReleasePage` + `candidatesAreDuplicate`. So the
normal path only selects strong, de-duplicated candidates.

The **catch-up lane is the sole bypass** (`buildShortlistReport`, ~L1511-1540). Catch-up candidates
are appended directly (`selected = [...selected, ...catchUpSelected]`), *not* through `pushUnique`,
and `buildCatchUpPool` (~L1451-1465) only filters eligibleBuckets / maxAge / exposure /
`catchUpCandidateHasEvidence`. It never applies the `main_article_score_eligible` floor or the
`candidatesAreDuplicate` guard. So a low-scope catch-up (a Google I/O roundup reusing `/releases/camera`
with no per-item evidence; a score-failing stale catch-up) reaches main and then fails the fact-checker.

Probe confirmation: the existing `catch-up-activation.test.js` fixtures (`relevance_bucket` set but no
`aosp_camera_directness`) score `scope_relevance = 0` → `main_article_score_eligible = false`, yet are
promoted today. A realistic CameraX release (with `aosp_camera_directness: 4`) scores `scope_relevance = 4`,
`base_total = 94` → `main_article_score_eligible = true`. So the floor cleanly separates strong from weak.

`mainArticleCount.min` = 1, so a single strong article already satisfies the publish minimum; the
catch-up padding is what breaks the issue.

## Approach (chosen) — gate catch-up only

Add one predicate and apply it to the catch-up promotion. Do **not** mutate the lineup post-hoc
(that was tried and reverted — it broke disposition markers, attempt-loop control flow,
selected-group-coverage, and the headline↔index anchor). Deciding at selection time satisfies all
four invariants naturally. No change to `selectFinalArticlesFromPool` (already gated).

### Predicate — a single existing deterministic signal (no new numeric knob)

The catch-up filter keeps only candidates that clear the same selection floor as fresh main articles:

```js
.filter(candidate => candidate.main_article_score_eligible !== false)
```

- `main_article_score_eligible` already requires dated evidence (`no_date_penalty`) and rejects
  source-gap / generic-watchlist / missing-api / sub-threshold scope — so it is the whole "strong" test.
  No explicit `hasDatedEvidence` clause is needed.
- **No duplicate clause is needed.** `buildEligibleShortlist` (~L862) already applies
  `candidatesAreDuplicate` globally across all decorated candidates *before* window partitioning, so
  `referenceContextCandidates` and the selected pool both come from a de-duplicated `eligible` set —
  a catch-up candidate cannot be a `candidatesAreDuplicate` match of a selected article. An explicit
  clause would be dead code (confirmed by test: a near-duplicate reference candidate is already
  excluded upstream without the gate).
- Deliberately **not** `selectedHasSameCameraReleasePage` (anchor-stripping) — that would wrongly drop
  a legitimate second version from the same rolling release page (and would contradict the existing
  catch-up cap test, which promotes two distinct CameraX versions from `/releases/camera`).
- `main_article_score_eligible` is an existing deterministic safety/evidence signal — consistent with
  "editorial quality is the fact-checker's call; only safety checks stay deterministic."

### Insertion point (one)

`buildShortlistReport` catch-up block: after `buildCatchUpPool(...)` and the existing `selectedKeys`
dedup, add `.filter(candidate => candidate.main_article_score_eligible !== false)`. Candidates from
`referenceContextCandidates` are already decorated (carry `main_article_score_eligible`), and the
filter rejects only on an explicit `false`, mirroring the existing `mainEligible` filter (~L981).

### Test fixture update (required, not a weakening)

`tests/unit/generate/catch-up-activation.test.js`'s `refRelease` helper sets only `relevance_bucket`
→ candidates fail the floor and would no longer promote. Add `aosp_camera_directness: 4` +
`counts_as_primary_camera_topic: true` so the fixtures represent fully-classified strong releases.
This preserves each test's intent (cap / exposure / marker behavior on *promotable* candidates).

### Behavior

- **1 strong + N weak** → main = the 1 strong article; weak candidates stay in
  `reserve` / `reference_context_candidates` (already passed to the editor as context for
  briefing / watch-points / 참고자료). No new rendered section needed.
- **0 strong** → main empty → existing candidate-shortage / QUIET / diagnostics-only path. We do
  **not** force min=1 from weak fillers.
- **Genuinely strong supporting/catch-up candidate** → still promoted (predicate passes). No
  over-blocking.

## Verification (local-first, per plan)

No GitHub Actions iteration (LLM-variable, slow). Deterministic unit tests in
`tests/unit/generate/catch-up-strong-fill.test.js`:

- **Weak catch-up rejected:** 1 fresh strong primary article + 1 low-scope reference candidate
  (passes `buildCatchUpPool`, fails the floor) → `selected.length === 1`, `catch_up_used_count === 0`.
- **Strong catch-up still promoted (over-block guard):** 1 fresh strong primary article + 1
  realistic strong reference release → catch-up promotes the strong reference (`catch_up_used_count === 1`).
- Regression: existing `catch-up-activation.test.js` (fixtures updated to realistic strong candidates)
  and the rest of the selection suite stay green.

Baseline gate: `npm.cmd run test` and `npm.cmd run validate` both EXIT 0.

## Guardrails

The gate only makes the lineup **more conservative** (smaller, all-strong). It never lowers the
safety gate or any threshold. Commit titles imperative English; end with
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
