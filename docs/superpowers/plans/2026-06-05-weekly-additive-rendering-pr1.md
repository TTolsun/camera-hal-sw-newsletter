# Weekly additive rendering — PR1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public newsletter consumers and a new pure render module able to handle ISO-week (`YYYY-Www`) identity, additively and with zero change to existing daily behavior.

**Architecture:** Three additive pieces — (1) directory-route helpers in the merged `weekly-newsletter.js`; (2) weekly-aware href resolution in `assets/js/newsletter-archive.js` (which `index.html` already delegates to, so the homepage benefits for free); (3) a pure `weekly-newsletter-page.js` builder that renders one publish-ready editor draft as a weekly issue via the existing renderer. Nothing wires these into the daily pipeline (that is PR2).

**Tech Stack:** Node 20, CommonJS, `node --test`. Windows PowerShell → use `npm.cmd` / `node --test`.

---

### Task 1: Directory-route helpers in weekly-newsletter.js

**Files:**
- Modify: `scripts/newsroom/common/weekly-newsletter.js` (add two helpers + exports)
- Test: `tests/unit/common/weekly-newsletter.test.js` (extend)

- [ ] **Step 1: Write the failing test** — append to the test file:

```js
test('weeklyNewsletterIndexRoute and weeklyNewsletterMarkdownRoute build directory routes', () => {
  const { weeklyNewsletterIndexRoute, weeklyNewsletterMarkdownRoute } =
    require('../../../scripts/newsroom/common/weekly-newsletter');
  assert.equal(weeklyNewsletterIndexRoute('2026-W23'), 'newsletters/2026-W23/index.html');
  assert.equal(weeklyNewsletterMarkdownRoute('2026-W23'), 'newsletters/2026-W23/newsletter.md');
  assert.throws(() => weeklyNewsletterIndexRoute('2026-06-04'), /YYYY-Www/);
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test tests/unit/common/weekly-newsletter.test.js` → FAIL (`weeklyNewsletterIndexRoute is not a function`).

- [ ] **Step 3: Implement** — in `weekly-newsletter.js`, after `weeklyNewsletterRoute`, add (and export both):

```js
function weeklyNewsletterIndexRoute(weeklyKey) {
  if (!isValidWeeklyKey(weeklyKey)) throw new Error(`weekly key must be YYYY-Www: ${weeklyKey}`);
  return `newsletters/${weeklyKey}/index.html`;
}

function weeklyNewsletterMarkdownRoute(weeklyKey) {
  if (!isValidWeeklyKey(weeklyKey)) throw new Error(`weekly key must be YYYY-Www: ${weeklyKey}`);
  return `newsletters/${weeklyKey}/newsletter.md`;
}
```

Keep the existing flat `weeklyNewsletterRoute` untouched. Add both names to `module.exports`.

- [ ] **Step 4: Run test to verify it passes** — `node --test tests/unit/common/weekly-newsletter.test.js` → PASS (all weekly-newsletter tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/common/weekly-newsletter.js tests/unit/common/weekly-newsletter.test.js
git commit -m "feat(weekly): add directory-route helpers to the weekly identity model"
```

---

### Task 2: Weekly-aware href resolution in newsletter-archive.js

Current behavior (assets/js/newsletter-archive.js:143-156): `getSafeNewsletterHref` only accepts `entry.html` matching `^newsletters/<entry.date>/(?:index\.html)?$`; `fallbackNewsletterHref` returns `newsletters/<entry.date>/index.html`. A weekly entry (`weeklyKey: '2026-W23'`, `html: 'newsletters/2026-W23/index.html'`, `date: '2026-06-01'` = weekStartDate) is rejected and mis-resolved to `newsletters/2026-06-01/index.html`. Make it tolerant: when `entry.weeklyKey` is a valid `YYYY-Www`, accept/produce the weekly directory route. Daily entries are unchanged.

**Files:**
- Modify: `assets/js/newsletter-archive.js`
- Test: `tests/workflow/homepage-archive.test.js` (extend; it already requires the archive helpers)

- [ ] **Step 1: Write the failing test** — add to `tests/workflow/homepage-archive.test.js`:

```js
test('getSafeNewsletterHref resolves a weekly entry to its weekly directory route', () => {
  const archive = require('../../assets/js/newsletter-archive.js');
  const weekly = { weeklyKey: '2026-W23', date: '2026-06-01', title: 'Camera HAL Weekly 2026-W23',
    html: 'newsletters/2026-W23/index.html', tags: ['Camera HAL'] };
  assert.equal(archive.getSafeNewsletterHref(weekly), 'newsletters/2026-W23/index.html');
  // tampered weekly html falls back to the safe weekly route, not a per-date path
  assert.equal(archive.getSafeNewsletterHref({ ...weekly, html: 'https://evil.example/x' }),
    'newsletters/2026-W23/index.html');
  // daily entries are unchanged
  const daily = { date: '2026-06-03', html: 'newsletters/2026-06-03/index.html' };
  assert.equal(archive.getSafeNewsletterHref(daily), 'newsletters/2026-06-03/index.html');
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test tests/workflow/homepage-archive.test.js` → FAIL (weekly resolves to `newsletters/2026-06-01/index.html`).

- [ ] **Step 3: Implement** — in `newsletter-archive.js`:
  - Add near `DATE_PATTERN`: `const WEEKLY_KEY_PATTERN = /^\d{4}-W\d{2}$/;`
  - Add `function weeklyKeyOf(entry) { const k = String(entry && entry.weeklyKey || '').trim(); return WEEKLY_KEY_PATTERN.test(k) ? k : ''; }`
  - Update `fallbackNewsletterHref`:

```js
function fallbackNewsletterHref(entry) {
  const weeklyKey = weeklyKeyOf(entry);
  if (weeklyKey) return `newsletters/${weeklyKey}/index.html`;
  const date = sortableDate(entry);
  return date ? `newsletters/${date}/index.html` : '';
}
```

  - Update `getSafeNewsletterHref`:

```js
function getSafeNewsletterHref(entry) {
  const raw = String(entry && entry.html || '').trim();
  const weeklyKey = weeklyKeyOf(entry);
  const fallback = fallbackNewsletterHref(entry);
  if (weeklyKey) {
    const allowedWeekly = new RegExp(`^newsletters/${weeklyKey}/(?:index\\.html)?$`);
    return raw && allowedWeekly.test(raw) ? raw : fallback;
  }
  const date = sortableDate(entry);
  if (!raw || !date) return fallback;
  const allowed = new RegExp(`^newsletters/${date}/(?:index\\.html)?$`);
  return allowed.test(raw) ? raw : fallback;
}
```

- [ ] **Step 4: Run test to verify it passes** — `node --test tests/workflow/homepage-archive.test.js` → PASS (and existing daily cases still pass).

- [ ] **Step 5: Commit**

```bash
git add assets/js/newsletter-archive.js tests/workflow/homepage-archive.test.js
git commit -m "feat(weekly): resolve weekly entries to their directory route in the archive helper"
```

---

### Task 3: Pure weekly page builder

A pure module that turns ONE publish-ready editor draft into a weekly issue object and renders it via the existing renderer. Used by nothing in PR1 (PR2 wires it into the orchestrator).

**Files:**
- Create: `scripts/newsroom/render/weekly-newsletter-page.js`
- Test: `tests/unit/render/weekly-newsletter-page.test.js`

- [ ] **Step 1: Write the failing test:**

```js
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { buildWeeklyNewsletterPage } = require('../../../scripts/newsroom/render/weekly-newsletter-page');

const draft = {
  date: '2026-06-04', title: 'Daily 2026-06-04', summary: 'daily summary',
  briefing: ['a', 'b', 'c'],
  sections: [{ category: 'Android Camera', headline: 'CameraX SessionConfig', what_changed: 'x',
    sources: [{ title: 'src', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0' }] }],
  references: []
};

test('buildWeeklyNewsletterPage produces a weekly issue keyed by the ISO week with rendered html+md', () => {
  const page = buildWeeklyNewsletterPage(draft, { date: '2026-06-04' });
  assert.equal(page.weeklyKey, '2026-W23');
  assert.equal(page.indexRoute, 'newsletters/2026-W23/index.html');
  assert.equal(page.markdownRoute, 'newsletters/2026-W23/newsletter.md');
  assert.match(page.issue.title, /Camera HAL Weekly 2026-W23/);
  assert.equal(page.issue.sections.length, 1);
  assert.ok(page.html.includes('issue-section'));
  assert.ok(page.markdown.length > 0);
});

test('buildWeeklyNewsletterPage accepts an explicit weeklyKey', () => {
  const page = buildWeeklyNewsletterPage(draft, { weeklyKey: '2026-W23' });
  assert.equal(page.weeklyKey, '2026-W23');
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --test tests/unit/render/weekly-newsletter-page.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement** `scripts/newsroom/render/weekly-newsletter-page.js`:

```js
'use strict';
const { buildHtml, buildMarkdown } = require('./newsletter-renderer');
const {
  weekBoundsForDate, weekBoundsForKey, weeklyNewsletterIndexRoute, weeklyNewsletterMarkdownRoute
} = require('../common/weekly-newsletter');

// Render exactly ONE publish-ready editor draft as a weekly issue. No cross-run aggregation.
function buildWeeklyNewsletterPage(draft = {}, { date, weeklyKey } = {}) {
  const bounds = date ? weekBoundsForDate(date) : weekBoundsForKey(weeklyKey);
  const issue = {
    ...draft,
    date: bounds.weekStartDate,
    weekly_key: bounds.weeklyKey,
    week_start_date: bounds.weekStartDate,
    week_end_date: bounds.weekEndDate,
    title: `Camera HAL Weekly ${bounds.weeklyKey}`
  };
  return {
    weeklyKey: bounds.weeklyKey,
    weekStartDate: bounds.weekStartDate,
    weekEndDate: bounds.weekEndDate,
    indexRoute: weeklyNewsletterIndexRoute(bounds.weeklyKey),
    markdownRoute: weeklyNewsletterMarkdownRoute(bounds.weeklyKey),
    issue,
    html: buildHtml(issue),
    markdown: buildMarkdown(issue)
  };
}

module.exports = { buildWeeklyNewsletterPage };
```

If `buildHtml`/`buildMarkdown` require fields the draft lacks and throw, adjust the test draft to a minimal valid issue (mirror an existing renderer test's issue shape in `tests/` ) rather than weakening the builder.

- [ ] **Step 4: Run test to verify it passes** — `node --test tests/unit/render/weekly-newsletter-page.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/render/weekly-newsletter-page.js tests/unit/render/weekly-newsletter-page.test.js
git commit -m "feat(weekly): pure weekly-newsletter-page builder (one publish-ready run)"
```

---

### Task 4: Full verification + PR

- [ ] **Step 1:** `npm.cmd run test` → all pass (new tests included), 0 fail.
- [ ] **Step 2:** `npm.cmd run validate` → exit 0 (encoding/site/etc. green; PR1 is additive so no validator behavior changes).
- [ ] **Step 3:** Push branch `feat/weekly-additive-rendering`, open PR with base `main`, body referencing #486 (PR1 of the additive sequence), and note it is additive / behavior-preserving.

## Self-review notes
- Spec coverage: PR1 of the spec (shape-tolerant consumers + pure render module) — Tasks 1-3 cover the three components; Task 4 the invariant (test+validate green, daily output unchanged).
- index.html needs no change: `newsletterHtmlHref` (index.html:157-158) delegates to `getSafeNewsletterHref`, fixed in Task 2.
- No legacy migration, no orchestrator change, no `data/newsletters.json` change — those are PR2/PR3/PR4.
