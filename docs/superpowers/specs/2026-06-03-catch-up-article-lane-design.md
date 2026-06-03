# "지난 소식 (Catch-up)" Article Lane — Design Spec

**Date:** 2026-06-03
**Status:** Approved, ready for implementation plan

## Context / Problem

The newsletter is architected as a **weekly freshness-driven digest**: main-article candidates must fall within the selection windows defined in `config/newsletter-policy.json` → `selectionWindowPolicy` (`primarySelectionDays: 7`, `fallbackSelectionDays: 21`, `referenceContextDays: 90`). Selection only draws main articles from the `primary` + `fallback` windows ([newsroom-selection.js:881](../../../scripts/newsroom/generate/newsroom-selection.js#L881)); candidates aged 22–90 days land in the `reference` window and can only be used as reference context, never as a main article.

But Camera HAL / CameraX content does **not** arrive weekly. Verified from `data/source-snapshots/androidx-camerax-release-notes.json`, CameraX stable releases ship every **~28–57 days (avg ~48)**:

```
1.5.0 2025-09-10 / 1.5.1 +28d / 1.5.2 +57d / 1.5.3 +55d / 1.6.0 +56d / 1.6.1 +42d
```

So roughly half the weeks have **no fresh (≤21 day) HAL-specific release in window**. In those "thin weeks" the pipeline correctly finds nothing to make a main article from, and falls back to generic conference content (e.g. Google I/O 2026 YouTube playlists) that fails the evidence-specificity and scope-relevance gates. This is what produced PR #475 (2026-06-03, quality 63/70, diagnostics-only).

Concrete current gap: CameraX **1.6.0** (2026-03-25, 70 days old) and **1.7.0-alpha01** (2026-03-11, 84 days old) are significant, HAL-relevant releases (CameraPipe migration, Media3 Muxer, SessionConfig stabilization) that have **never been covered** and cannot become main articles under the current window policy.

**This is not a parser bug — it is a cadence/window mismatch.** Falsifying source dates to make old releases look fresh is forbidden (source-integrity contract). The honest fix is a labeled retrospective lane.

## Goal

In **thin weeks only**, fill remaining main-article slots with significant Camera-stack releases from the last 90 days that have **never been covered**, honestly labeled as retrospective "지난 소식 / Catch-up", deterministically selected, passing the **same** quality gate (no threshold lowering).

## Design Decisions (confirmed)

- **Activation:** fill-open-slots. When the fresh primary+fallback selection is below `targetMainArticles` (default 3), catch-up fills the remaining open main-article slots with strong uncovered releases — never displacing fresh, capped at `maxCatchUpArticles`. Self-limiting via once-only exposure dedup (a release is covered at most once), so it does not pad every issue indefinitely.
- **Cap / age:** max **2** catch-up articles per issue; releases up to **90 days** old (reuses `referenceContextDays`).
- **Labeling:** dedicated "## 지난 소식 (Catch-up)" section + per-article "○주 전 릴리스" badge.

## Architecture

Two independent gates currently block these releases; both must be addressed coherently:

| Gate | Current | Change | Why |
| --- | --- | --- | --- |
| Collection lookback (`lookback_days`) | 21 | **90** | Reference-age (22–90d) candidates must be *collected* to feed the catch-up pool. |
| Selection window (`selectionWindowPolicy`) | primary 7 / fallback 21 | unchanged | The new catch-up lane is the explicit, labeled exception to the window gate — windows keep their meaning. |

### Selected approach

**Approach A — catch-up pool inside `buildEligibleShortlist`.** Build the pool from the already-computed `reference` window partition, then activate only when thin. Keeps window/selection logic in one place, consistent with the existing partition architecture. (Rejected: B = separate post-selection backfill step adds a parallel path; C = reference→fallback promotion flag blurs window semantics.)

## Components & Data Flow

```
collect (lookback_days = 90)
  → content/collected-news/<date>/manual-candidates.json now includes 22–90d camera-stack releases
buildEligibleShortlist (newsroom-selection.js)
  → decorateCandidate tags freshness_window + relevance_bucket + days_since_published + article_identity_key
  → partitionSelectionWindows → { primary, fallback, reference, windowExcluded }
  → buildCatchUpPool(reference, exposureHistory, policy):
       keep candidate iff
         relevance_bucket ∈ catchUpPolicy.eligibleBuckets
         AND days_since_published ≤ catchUpPolicy.maxAgeDays
         AND NOT everCoveredAsNewsletterArticle(article_identity_key, exposureHistory)
         AND hasSpecificEvidence(candidate)   // version/date/API present
  → if (primary+fallback selected count < mainArticleCount.min)  // thin week
       take deterministicCandidateSort top-N from catchUpPool, N ≤ maxCatchUpArticles
       mark coverage_type='catch_up', catch_up_age_days=days_since_published
editor draft (gemini-newsroom-newsletter.js)
  → catch_up sections get retrospective-framing prompt instruction
quality gate (newsletter-quality.js)
  → SAME evidence/scope/claim gates, NO threshold change
render (render/)
  → group coverage_type='catch_up' under "## 지난 소식 (Catch-up)" + "○주 전 릴리스" badge
exposure history (article-exposure-history.js, from #480)
  → catch_up recorded as newsletter_article → once-only retrospective coverage
```

## Detailed Changes

### 1. `config/newsletter-policy.json`
Add a `catchUpPolicy` block and bump collection lookback default. The policy validator in [newsletter-policy.js](../../../scripts/newsroom/common/newsletter-policy.js) gains a `validateCatchUpPolicy` (mirrors `validateSelectionWindowPolicy`).

```json
"catchUpPolicy": {
  "enabled": true,
  "maxCatchUpArticles": 2,
  "maxAgeDays": 90,
  "eligibleBuckets": ["direct_aosp_camera", "camera_driver_image_pipeline", "android_platform_camera_adjacent"],
  "activationMode": "thin_week_only"
}
```
Validation rules: `enabled` boolean; `maxCatchUpArticles` integer ≥ 1 and ≤ `articlePolicy.mainArticleCount.max`; `maxAgeDays` integer ≥ `selectionWindowPolicy.fallbackSelectionDays` and ≤ `selectionWindowPolicy.referenceContextDays`; `eligibleBuckets` non-empty subset of known BUCKETS; `activationMode` ∈ {`thin_week_only`}.

`lookback_days` default change: the workflow input default in [00-newsletters-auto-daily-pr.yml](../../../.github/workflows/00-newsletters-auto-daily-pr.yml) (and 01) is raised from `21` to `90`. (Runtime default `runtimeConfig.lookbackDays` likewise.)

### 2. `scripts/newsroom/generate/newsroom-selection.js`
- Import `everCoveredAsNewsletterArticle` helper (new, in `article-exposure-history.js`) and `getCatchUpPolicy` (new, from `newsletter-policy.js`).
- Add `buildCatchUpPool(referenceCandidates, exposureHistory, catchUpPolicy)` — pure function, returns the filtered+sorted eligible list.
- In `buildShortlistReport`, after `selectFinalArticlesWithDiagnostics`, if `selected.length < articlePolicy.mainArticleCount.min` and `catchUpPolicy.enabled`, append up to `maxCatchUpArticles` from the catch-up pool (deduped against already-selected), each decorated `coverage_type='catch_up'`, `catch_up_age_days`. Record `catch_up_used_count` and reasons in the shortlist report.
- `everCoveredAsNewsletterArticle` differs from `published_within_cooldown` (#480): it returns true if the identity key has **any** `newsletter_article` exposure record, regardless of cooldown — catch-up coverage is once-only forever.

### 3. `scripts/newsroom/common/article-exposure-history.js`
Add `everCoveredAsNewsletterArticle(identityKey, history)` returning boolean. (`recordNewsletterArticles` from #480 already records catch-up sections — no change needed there.)

### 4. Schema / contract
- `scripts/newsroom/render/newsletter-schema.js` + `scripts/newsroom/common/public-article-contract.js`: add optional `coverage_type` (`'fresh' | 'catch_up'`, default `'fresh'`) to the section / public_article schema. Default-fresh keeps all legacy artifacts valid.

### 5. Editor prompt (`scripts/newsroom/cli/gemini-newsroom-newsletter.js`)
For sections flagged `coverage_type='catch_up'`, add an instruction: the article is a retrospective of a release from N weeks ago — write in catch-up tone ("N주 전 릴리스된 …를 놓쳤다면"), do not present it as breaking news, and do not hide the release date.

### 6. Rendering (`scripts/newsroom/render/`)
Markdown + HTML renderers group `coverage_type='catch_up'` sections under a "## 지난 소식 (Catch-up)" heading after the fresh main articles, each with a "○주 전 릴리스" badge derived from `catch_up_age_days`. Legacy issues (no catch_up sections) render unchanged.

### 7. PR body (`scripts/newsroom/cli/build-newsroom-pr-body.js`)
Surface `catch_up_used_count` and the catch-up article list so the editor sees the lane activated.

## Quality Gate

No threshold change, no new exemption from evidence/scope/claim checks. Catch-up candidates pass because CameraX/AOSP release notes carry real version/date/API evidence. The **only** thing previously excluding them was the freshness window; the catch-up lane is the explicit, labeled exception to that one check. The quality gate must treat a `coverage_type='catch_up'` section identically to a fresh section for all evidence/scope/claim deductions.

## Testing

Unit (`tests/unit/generate/` and `tests/unit/common/`):
- `buildCatchUpPool` keeps only eligible-bucket + ≤maxAgeDays + uncovered + has-evidence candidates.
- `buildCatchUpPool` excludes a candidate already covered as `newsletter_article`.
- Thin-week activation fills the gap up to `maxCatchUpArticles`; never exceeds it.
- Non-thin week (primary/fallback meet `mainArticleCount.min`) → zero catch-up articles.
- `everCoveredAsNewsletterArticle` true for any newsletter_article record, ignoring cooldown.
- `coverage_type` defaults to `'fresh'` and round-trips through schema validation.

Contract (`tests/contract/`):
- A `coverage_type='catch_up'` section with real version/date/API evidence passes the quality gate at the unchanged threshold.
- `validateCatchUpPolicy` rejects out-of-range config (maxAgeDays < fallback, maxCatchUpArticles > main max, empty buckets, unknown activationMode).

End-to-end verification: re-run the 00 workflow for 2026-06-03 with `lookback_days=90`; expect CameraX 1.6.0 / 1.7.0-alpha01 to surface in the catch-up pool and appear as "지난 소식" main articles, with the issue reaching a publishable (or at minimum non-diagnostics) state driven by real evidence rather than I/O videos.

## Scope Boundaries (YAGNI)

- No new "deep dive" original analysis — catch-up reuses normal article generation, only labeled.
- No cross-issue scheduling/queue — purely per-run, thin-week-triggered.
- No UI beyond the section heading + badge.
- `activationMode` enum currently has a single value (`thin_week_only`); the field exists so a future "always" mode is a config change, not a code change, but only `thin_week_only` is implemented now.
