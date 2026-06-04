# Weekly newsletter — additive rendering & index (design)

Date: 2026-06-05
Issue: #486 (parent epic #485). Foundation model `scripts/newsroom/common/weekly-newsletter.js` already merged (PR #506).

## Goal

Move the public newsletter toward ISO-week (`YYYY-Www`) identity **additively**, in small reversible
steps that keep `00-newsletters-auto-daily-pr.yml` green at every step and never change the live
GitHub Pages surface until a deliberate, human-reviewed cutover. This design covers **PR1 + PR2**
only. The identity cutover (PR3) and legacy backfill (PR4 = #491) are out of scope here.

This design is the rescoped result of an adversarial review that rejected a single "full weekly
replacement" PR (10 verified blockers: it breaks the daily workflow's per-date publish gates every
run, can't commit the weekly artifact via the daily PR allowlist, breaks the live homepage/archive
href resolver, violates #486 non-goals, and leaks review-only days' content into public output).

## Decisions (approved)

- **Route shape: directory** — `newsletters/YYYY-Www/index.html` + `newsletters/YYYY-Www/newsletter.md`.
  Preserves the `<id>/index.html` + `.md` sibling contract that validators, the archive href
  allow-list, and the commit allowlist assume; validators need only a token widening (`date` →
  `date|weeklyKey`) rather than a structural rewrite. (Note: this overrides the issue's cosmetic
  flat `newsletters/2026-W23.html` example.) PR1 adds directory-route helpers to
  `weekly-newsletter.js` (`weeklyNewsletterIndexRoute` → `newsletters/<weeklyKey>/index.html`,
  `weeklyNewsletterMarkdownRoute` → `newsletters/<weeklyKey>/newsletter.md`) and keeps the already-merged
  flat `weeklyNewsletterRoute` untouched (unused by the directory wiring) to preserve its merged test.
- **One run per weekly page** — a weekly page renders exactly ONE publish-ready run's articles. No
  cross-run union, no dedup, no merge-from-prior. Cross-day aggregation is deferred to #488 (after
  #492 sets weekly limits); dedup/merge to #489.
- **Daily output unchanged** — the daily orchestrator keeps writing `newsletters/<date>/{index.html,
  newsletter.md}` and daily `data/newsletters.json` entries. Weekly output is purely added.
- **Homepage/archive view unchanged through PR1+PR2** — the live homepage "latest" and archive keep
  reading the daily index. The weekly index is built additively as `data/newsletters-weekly.json` and
  is NOT yet the primary view; the cutover (PR3) flips the view and is a separate human-reviewed PR.
- **Widen, never flip** — public validators accept weekly entries/paths *alongside* daily.
- **Publish-ready gating** — weekly output is produced only when `shouldWritePublicArtifacts` is true
  (publish-ready). Review-only / diagnostics-only / NEEDS_FIX days (e.g. 2026-06-05) produce NO weekly
  page, so unsafe content never enters public weekly output. This is a tested invariant.
- **No auto-merge for identity/URL-surface changes.** PR1 (pure shape-tolerance, no surface change)
  and PR2 (additive, live view unchanged) are mergeable after local `npm run test` + `npm run validate`
  are green and human review. The cutover (PR3) and legacy backfill (PR4) are never carried by the
  scheduled daily auto-PR.

## Corpus (observed, not assumed)

17 entries in `data/newsletters.json`, 18 `newsletters/<date>/` directories. (The earlier "100+"
figure was wrong.)

## PR1 — shape-tolerant consumers + pure weekly render module (additive, zero behavior change)

**Intent:** make every public consumer able to *resolve and display* a weekly entry from an explicit
`html` field, while existing daily entries render identically. Add a pure weekly render module used by
nothing yet. No daily output, no `data/newsletters.json`, no validator behavior changes.

Components:
- `assets/js/newsletter-archive.js`: `getSafeNewsletterHref` resolves from `entry.html` and accepts
  BOTH `newsletters/<date>/index.html` and `newsletters/<weeklyKey>/index.html`; `sortableDate` /
  `compareEntries` accept a weekly entry (sort by `weekStartDate` when present, else `date`). Existing
  daily entries unchanged.
- `index.html` latest-card href: same tolerant resolution (no change to which entry is "latest").
- New `scripts/newsroom/render/weekly-newsletter-page.js`: pure builder that takes a single editor
  draft (one publish-ready run) + its weekly key/bounds and returns `{ html, markdown }` via the
  existing `newsletter-renderer`. Used by nothing in PR1.

Tests: tolerant href resolution (daily + weekly), `compareEntries` with mixed entries, the weekly
page builder output shape. No fixture migration.

Invariant: `npm run test` + `npm run validate` green; the live site output for existing daily entries
is byte-identical.

## PR2 — additive weekly output wiring (the genuine #486 increment)

**Intent:** on a publish-ready run, ALSO emit a weekly directory page and an additive weekly index,
and WIDEN validators to accept weekly — without touching the daily committed output or the live view.

Components:
- Orchestrator (`gemini-newsroom-newsletter.js`): when `shouldWritePublicArtifacts` is true, after
  writing the daily artifacts, also write `newsletters/<weeklyKey>/{index.html,newsletter.md}` (one
  run's content) and upsert a weekly entry into `data/newsletters-weekly.json`. Gated strictly on the
  publish-ready flag, never on calendar membership.
- `data/newsletters-weekly.json` (new, additive): weekly entries `{ weeklyKey, weekStartDate,
  weekEndDate, date: weekStartDate, title, summary, html: "newsletters/<weeklyKey>/index.html",
  md: "newsletters/<weeklyKey>/newsletter.md", tags }`.
- `review-artifact-inventory.js`: add the weekly artifacts + `data/newsletters-weekly.json` to the
  commit allow-list so they actually land in the daily PR.
- WIDEN (token-level, not flip): `public-structure.js`, `rendered-issue-structure.js`,
  `validate-site.js`, `validate-public-newsletter.js`, `historical-archive.js`,
  `public-state-reconciliation.js` to accept a `<weeklyKey>` id alongside `<date>` and a weekly entry
  alongside daily. The daily readiness gate (`resolve-reviewable-artifacts` → `review_pr_ready`) is
  UNCHANGED (still satisfied by the daily artifacts), so the daily job stays green.
- Homepage/archive still read the daily index — UNCHANGED.

Tests: orchestrator emits the weekly page only on publish-ready runs (and NOT on a NEEDS_FIX run);
weekly entry shape; widened validators accept both daily and weekly; commit allow-list includes the
weekly artifacts. Additive fixtures only — existing daily fixtures are not migrated.

Invariant: daily artifacts/entries byte-identical; `review_pr_ready` unchanged; `npm run test` +
`npm run validate` (incl. `validate:site/public/archive`) green; live homepage/archive visually
unchanged.

## Explicitly deferred (NOT in this design)

- PR3 cutover: flip homepage-latest/archive/validators to weekly-primary; re-point the homepage
  headline `newsletter_article_url` anchor + exposure cooldown in lockstep; stop writing daily public
  pages. Human-reviewed, single-revert, never auto-merged.
- PR4 = #491: one-time manual backfill of weekly pages for the 17 historical entries.
- Cross-run weekly aggregation → #488 (after #492 weekly limits). Dedup/LLM merge → #489.
- Source collection window change → #487.

## Testing & rollback

Every PR is independently green (`npm run test` + `npm run validate`) before opening and single-commit
revertible. Because PR1+PR2 are additive and do not change the live view or the daily readiness gate,
a revert of either restores the prior public surface exactly.
