# Catch-up Article Lane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin-week-only "지난 소식 (Catch-up)" article lane that fills unfilled main-article slots with uncovered Camera-stack releases ≤90 days old, honestly labeled, passing the unchanged quality gate.

**Architecture:** Two gates are addressed: collection lookback is raised to 90 days so reference-age candidates are collected; the new catch-up lane in `newsroom-selection.js` deterministically pulls from the reference window only when primary+fallback can't reach `mainArticleCount.min`. Catch-up sections carry `coverage_type='catch_up'`, are recorded once-only via exposure history, and render under a dedicated section with a "○주 전 릴리스" badge.

**Tech Stack:** Node 20, CommonJS, `node --test`, `npm.cmd run test` / `npm.cmd run validate`.

**Spec:** [docs/superpowers/specs/2026-06-03-catch-up-article-lane-design.md](../specs/2026-06-03-catch-up-article-lane-design.md)

---

## File Structure

- `config/newsletter-policy.json` — add `catchUpPolicy` block.
- `scripts/newsroom/common/newsletter-policy.js` — validate + normalize + expose `catchUpPolicy`; add `getCatchUpPolicy`.
- `scripts/newsroom/common/article-exposure-history.js` — add `everCoveredAsNewsletterArticle`.
- `scripts/newsroom/generate/newsroom-selection.js` — add `buildCatchUpPool` + thin-week activation in `buildShortlistReport`.
- `scripts/newsroom/render/newsletter-schema.js` + `scripts/newsroom/common/public-article-contract.js` — add optional `coverage_type`.
- `scripts/newsroom/render/newsletter-renderer.js` — catch-up divider + badge.
- `scripts/newsroom/cli/gemini-newsroom-newsletter.js` — retrospective framing prompt for catch_up sections.
- `scripts/newsroom/cli/build-newsroom-pr-body.js` — surface `catch_up_used_count`.
- `.github/workflows/00-newsletters-auto-daily-pr.yml` + `01-newsletters-source-collect-pr.yml` — lookback default 21→90.
- Tests under `tests/unit/common/`, `tests/unit/generate/`, `tests/contract/`.

---

## Task 1: catchUpPolicy config + validation + accessor

**Files:**
- Modify: `config/newsletter-policy.json`
- Modify: `scripts/newsroom/common/newsletter-policy.js`
- Test: `tests/unit/config/catch-up-policy.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/config/catch-up-policy.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateNewsletterPolicyConfig,
  normalizeNewsletterPolicyConfig,
  getCatchUpPolicy,
  readPolicyConfig
} = require('../../../scripts/newsroom/common/newsletter-policy');

function baseConfig() {
  return readPolicyConfig();
}

test('default policy exposes a normalized catchUpPolicy', () => {
  const policy = getCatchUpPolicy();
  assert.equal(policy.enabled, true);
  assert.equal(policy.maxCatchUpArticles, 2);
  assert.equal(policy.maxAgeDays, 90);
  assert.equal(policy.activationMode, 'thin_week_only');
  assert.ok(Array.isArray(policy.eligibleBuckets) && policy.eligibleBuckets.length > 0);
});

test('validation rejects maxAgeDays below fallbackSelectionDays', () => {
  const config = baseConfig();
  config.catchUpPolicy = { enabled: true, maxCatchUpArticles: 2, maxAgeDays: 5,
    eligibleBuckets: ['direct_aosp_camera'], activationMode: 'thin_week_only' };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.maxAgeDays')));
});

test('validation rejects maxCatchUpArticles above mainArticleCount.max', () => {
  const config = baseConfig();
  config.catchUpPolicy = { enabled: true, maxCatchUpArticles: 99, maxAgeDays: 90,
    eligibleBuckets: ['direct_aosp_camera'], activationMode: 'thin_week_only' };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.maxCatchUpArticles')));
});

test('validation rejects unknown activationMode and empty buckets', () => {
  const config = baseConfig();
  config.catchUpPolicy = { enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90,
    eligibleBuckets: [], activationMode: 'always' };
  const result = validateNewsletterPolicyConfig(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.eligibleBuckets')));
  assert.ok(result.errors.some(e => e.includes('catchUpPolicy.activationMode')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/config/catch-up-policy.test.js`
Expected: FAIL — `getCatchUpPolicy is not a function`.

- [ ] **Step 3: Add catchUpPolicy to config**

In `config/newsletter-policy.json`, add a top-level key after `selectionWindowPolicy`:

```json
"catchUpPolicy": {
  "enabled": true,
  "maxCatchUpArticles": 2,
  "maxAgeDays": 90,
  "eligibleBuckets": ["direct_aosp_camera", "camera_driver_image_pipeline", "android_platform_camera_adjacent"],
  "activationMode": "thin_week_only"
}
```

- [ ] **Step 4: Add validator**

In `scripts/newsroom/common/newsletter-policy.js`, add after `validateSelectionWindowPolicy` (around line 96):

```javascript
const KNOWN_CATCH_UP_ACTIVATION_MODES = Object.freeze(['thin_week_only']);

function validateCatchUpPolicy(value, config, errors) {
  if (value === undefined) return; // optional; normalized to a default when absent
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('catchUpPolicy must be an object.');
    return;
  }
  if (typeof value.enabled !== 'boolean') {
    errors.push('catchUpPolicy.enabled must be a boolean.');
  }
  const mainMax = config?.articlePolicy?.mainArticleCount?.max;
  validateInteger(value.maxCatchUpArticles, 'catchUpPolicy.maxCatchUpArticles', errors, { min: 1 });
  if (Number.isInteger(value.maxCatchUpArticles) && Number.isInteger(mainMax) && value.maxCatchUpArticles > mainMax) {
    errors.push('catchUpPolicy.maxCatchUpArticles cannot exceed articlePolicy.mainArticleCount.max.');
  }
  const fallbackDays = config?.selectionWindowPolicy?.fallbackSelectionDays;
  const referenceDays = config?.selectionWindowPolicy?.referenceContextDays;
  validateInteger(value.maxAgeDays, 'catchUpPolicy.maxAgeDays', errors, { min: 1 });
  if (Number.isInteger(value.maxAgeDays) && Number.isInteger(fallbackDays) && value.maxAgeDays < fallbackDays) {
    errors.push('catchUpPolicy.maxAgeDays must be >= selectionWindowPolicy.fallbackSelectionDays.');
  }
  if (Number.isInteger(value.maxAgeDays) && Number.isInteger(referenceDays) && value.maxAgeDays > referenceDays) {
    errors.push('catchUpPolicy.maxAgeDays must be <= selectionWindowPolicy.referenceContextDays.');
  }
  validateBucketList(value.eligibleBuckets, 'catchUpPolicy.eligibleBuckets', errors);
  if (!KNOWN_CATCH_UP_ACTIVATION_MODES.includes(value.activationMode)) {
    errors.push(`catchUpPolicy.activationMode must be one of: ${KNOWN_CATCH_UP_ACTIVATION_MODES.join(', ')}.`);
  }
}
```

Call it inside `validateNewsletterPolicyConfig` right after `validateSelectionWindowPolicy(config.selectionWindowPolicy, errors);` (line 201):

```javascript
  validateCatchUpPolicy(config.catchUpPolicy, config, errors);
```

- [ ] **Step 5: Normalize + expose**

In `normalizeNewsletterPolicyConfig` (line 275), add a `catchUpPolicy` to the returned frozen object after the `selectionWindowPolicy` block (after line 312):

```javascript
    catchUpPolicy: normalizeCatchUpPolicy(config.catchUpPolicy),
```

Add the normalizer near `normalizePublishModePolicy` (line 254):

```javascript
function normalizeCatchUpPolicy(raw) {
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, maxCatchUpArticles: 2, maxAgeDays: 90, eligibleBuckets: [], activationMode: 'thin_week_only' };
  }
  return {
    enabled: raw.enabled === true,
    maxCatchUpArticles: Number.isInteger(raw.maxCatchUpArticles) ? raw.maxCatchUpArticles : 2,
    maxAgeDays: Number.isInteger(raw.maxAgeDays) ? raw.maxAgeDays : 90,
    eligibleBuckets: unique(ensureArray(raw.eligibleBuckets)),
    activationMode: raw.activationMode === 'thin_week_only' ? 'thin_week_only' : 'thin_week_only'
  };
}
```

Add the accessor near `getSelectionWindowPolicy` (line 363):

```javascript
function getCatchUpPolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.catchUpPolicy;
}
```

Add to `module.exports` (line 533): a getter and the function:

```javascript
  get catchUpPolicy() {
    return getCatchUpPolicy();
  },
```
and in the function list: `getCatchUpPolicy,`.

- [ ] **Step 6: Run tests + policy validation**

Run: `node --test tests/unit/config/catch-up-policy.test.js && npm.cmd run validate:policy`
Expected: PASS; "Newsletter Policy validation passed".

- [ ] **Step 7: Commit**

```bash
git add config/newsletter-policy.json scripts/newsroom/common/newsletter-policy.js tests/unit/config/catch-up-policy.test.js
git commit -m "feat(policy): add catchUpPolicy config, validation, and accessor"
```

---

## Task 2: everCoveredAsNewsletterArticle helper

**Files:**
- Modify: `scripts/newsroom/common/article-exposure-history.js`
- Test: `tests/unit/common/article-exposure-history.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/common/article-exposure-history.test.js`:

```javascript
test('everCoveredAsNewsletterArticle is true for any newsletter_article record ignoring cooldown', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/camerax-1.6.0',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-01-01',
      cooldown_until: '2026-01-22'  // long expired
    }]
  };
  assert.strictEqual(everCoveredAsNewsletterArticle('url:https://example.com/camerax-1.6.0', history), true);
});

test('everCoveredAsNewsletterArticle is false when only homepage_headline exposure exists', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/headline-only',
      exposure_type: 'homepage_headline',
      newsletter_date: '2026-05-27'
    }]
  };
  assert.strictEqual(everCoveredAsNewsletterArticle('url:https://example.com/headline-only', history), false);
});

test('everCoveredAsNewsletterArticle is false for an unknown key', () => {
  assert.strictEqual(everCoveredAsNewsletterArticle('url:https://example.com/never', { articles: [] }), false);
});
```

Add `everCoveredAsNewsletterArticle` to the require destructure at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/common/article-exposure-history.test.js`
Expected: FAIL — `everCoveredAsNewsletterArticle is not a function`.

- [ ] **Step 3: Implement helper**

In `scripts/newsroom/common/article-exposure-history.js`, add before `module.exports`:

```javascript
function everCoveredAsNewsletterArticle(identityKey, history = {}) {
  const key = text(identityKey);
  if (!key) return false;
  return ensureArray(history.articles).some(item =>
    text(item.article_identity_key) === key &&
    (text(item.exposure_type) === 'newsletter_article' ||
      ensureArray(item.exposure_types).includes('newsletter_article'))
  );
}
```

Export it in `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/common/article-exposure-history.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/common/article-exposure-history.js tests/unit/common/article-exposure-history.test.js
git commit -m "feat(dedupe): add everCoveredAsNewsletterArticle for once-only catch-up dedup"
```

---

## Task 3: buildCatchUpPool pure function

**Files:**
- Modify: `scripts/newsroom/generate/newsroom-selection.js`
- Test: `tests/unit/generate/catch-up-pool.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/generate/catch-up-pool.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildCatchUpPool } = require('../../../scripts/newsroom/generate/newsroom-selection');

const POLICY = {
  enabled: true,
  maxCatchUpArticles: 2,
  maxAgeDays: 90,
  eligibleBuckets: ['direct_aosp_camera', 'android_platform_camera_adjacent'],
  activationMode: 'thin_week_only'
};

function refCandidate(overrides = {}) {
  return {
    title: 'CameraX 1.6.0',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
    relevance_bucket: 'direct_aosp_camera',
    freshness_window: 'reference',
    days_since_published: 70,
    version_or_release: '1.6.0',
    published_date: '2026-03-25',
    api_or_component: 'CameraX',
    behavior_change: 'CameraPipe migration',
    ...overrides
  };
}

const EMPTY_HISTORY = { articles: [] };

test('keeps eligible-bucket, in-age, uncovered, evidence-bearing reference candidate', () => {
  const pool = buildCatchUpPool([refCandidate()], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 1);
});

test('drops candidate outside eligible buckets', () => {
  const pool = buildCatchUpPool([refCandidate({ relevance_bucket: 'cpp_ai_tooling_fallback' })], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 0);
});

test('drops candidate older than maxAgeDays', () => {
  const pool = buildCatchUpPool([refCandidate({ days_since_published: 120 })], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 0);
});

test('drops candidate already covered as newsletter_article', () => {
  const history = { articles: [{ article_identity_key: refCandidate().article_identity_key, exposure_type: 'newsletter_article', newsletter_date: '2026-04-01' }] };
  const pool = buildCatchUpPool([refCandidate()], history, POLICY);
  assert.equal(pool.length, 0);
});

test('drops candidate lacking concrete evidence', () => {
  const pool = buildCatchUpPool([refCandidate({ version_or_release: '', api_or_component: '', behavior_change: '', evidence_summary: '' })], EMPTY_HISTORY, POLICY);
  assert.equal(pool.length, 0);
});

test('returns empty when policy disabled', () => {
  const pool = buildCatchUpPool([refCandidate()], EMPTY_HISTORY, { ...POLICY, enabled: false });
  assert.equal(pool.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/generate/catch-up-pool.test.js`
Expected: FAIL — `buildCatchUpPool is not a function`.

- [ ] **Step 3: Implement buildCatchUpPool**

In `scripts/newsroom/generate/newsroom-selection.js`, add the import near the existing exposure-history import (the one added in #480):

```javascript
const {
  annotateArticleExposure,
  everCoveredAsNewsletterArticle,
  readExposureHistory
} = require('../common/article-exposure-history');
```

Add `getCatchUpPolicy` to the `newsletter-policy` require destructure.

Add the function (place it just before `buildShortlistReport`, around line 1425):

```javascript
function buildCatchUpPool(referenceCandidates, exposureHistory, catchUpPolicy = getCatchUpPolicy()) {
  if (!catchUpPolicy || catchUpPolicy.enabled !== true) return [];
  const eligibleBuckets = new Set(ensureArray(catchUpPolicy.eligibleBuckets));
  const maxAge = Number(catchUpPolicy.maxAgeDays) || 0;
  const history = exposureHistory || { articles: [] };
  return ensureArray(referenceCandidates).filter(candidate => {
    const bucket = text(candidate.relevance_bucket || candidateScope(candidate).relevance_bucket);
    if (!eligibleBuckets.has(bucket)) return false;
    const age = Number(candidate.days_since_published);
    if (!Number.isFinite(age) || age > maxAge) return false;
    if (everCoveredAsNewsletterArticle(articleIdentityKey(candidate), history)) return false;
    if (!hasSpecificEvidence(candidate)) return false;
    return true;
  });
}
```

`hasSpecificEvidence` already exists in this file (used by selection scoring). If it is not in scope at this location, reuse the existing evidence check helper used by `decorateCandidate`; confirm by grep `function hasSpecificEvidence` and import/move as needed. If only the quality module has it, add a local minimal check:

```javascript
function catchUpCandidateHasEvidence(candidate) {
  return Boolean(
    text(candidate.version_or_release) ||
    text(candidate.api_or_component) ||
    text(candidate.behavior_change) ||
    text(candidate.evidence_summary)
  );
}
```
and call `catchUpCandidateHasEvidence(candidate)` instead of `hasSpecificEvidence(candidate)`.

Export `buildCatchUpPool` in this file's `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/generate/catch-up-pool.test.js`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/generate/newsroom-selection.js tests/unit/generate/catch-up-pool.test.js
git commit -m "feat(selection): add buildCatchUpPool eligibility filter"
```

---

## Task 4: thin-week activation in buildShortlistReport

**Files:**
- Modify: `scripts/newsroom/generate/newsroom-selection.js`
- Test: `tests/unit/generate/catch-up-activation.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/generate/catch-up-activation.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../../scripts/newsroom/generate/newsroom-selection');

// A thin-week collection: one fresh non-camera item + two reference-window CameraX releases.
function collected(date) {
  return { candidates: [
    {
      title: 'Fresh generic note', url: 'https://example.com/fresh',
      published_date: date, relevance_bucket: 'direct_aosp_camera',
      version_or_release: 'v1', api_or_component: 'Camera', behavior_change: 'x'
    },
    {
      title: 'CameraX 1.6.0', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
      published_date: '2026-03-25', relevance_bucket: 'direct_aosp_camera',
      version_or_release: '1.6.0', api_or_component: 'CameraX', behavior_change: 'CameraPipe migration'
    },
    {
      title: 'CameraX 1.7.0-alpha01', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha01',
      published_date: '2026-03-11', relevance_bucket: 'direct_aosp_camera',
      version_or_release: '1.7.0-alpha01', api_or_component: 'CameraX', behavior_change: 'SessionConfig API'
    }
  ] };
}

test('thin week pulls catch-up articles from reference window, capped at maxCatchUpArticles', () => {
  const report = buildShortlistReport('2026-06-03', collected('2026-06-03'), {
    exposureHistory: { articles: [] },
    catchUpPolicy: { enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90,
      eligibleBuckets: ['direct_aosp_camera'], activationMode: 'thin_week_only' }
  });
  const catchUp = report.selected_articles.filter(a => a.coverage_type === 'catch_up');
  assert.ok(catchUp.length >= 1 && catchUp.length <= 2, `expected 1-2 catch-up, got ${catchUp.length}`);
  assert.ok(catchUp.every(a => Number.isFinite(a.catch_up_age_days)));
  assert.equal(report.catch_up_used_count, catchUp.length);
});
```

Note: `buildShortlistReport` must accept `options.catchUpPolicy` and `options.exposureHistory` (the latter already supported from #480).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/generate/catch-up-activation.test.js`
Expected: FAIL — `coverage_type` undefined / `catch_up_used_count` undefined.

- [ ] **Step 3: Implement activation**

In `buildShortlistReport`, after `selected = headlineSelection.selected_articles;` (line 1476) and after `exposureHistory` is read (line 1479-1480), insert catch-up activation BEFORE `warnings`/`errors` are computed:

```javascript
  const catchUpPolicy = options.catchUpPolicy || getCatchUpPolicy();
  let catchUpSelected = [];
  if (catchUpPolicy.enabled === true && selected.length < articlePolicy.mainArticleCount.min) {
    const selectedKeys = new Set(selected.map(item => articleIdentityKey(item)));
    const pool = buildCatchUpPool(referenceContextCandidates, exposureHistory, catchUpPolicy)
      .filter(candidate => !selectedKeys.has(articleIdentityKey(candidate)));
    pool.sort(deterministicCandidateSort);
    const room = articlePolicy.mainArticleCount.max - selected.length;
    const take = Math.max(0, Math.min(catchUpPolicy.maxCatchUpArticles, room));
    catchUpSelected = pool.slice(0, take).map(candidate => ({
      ...candidate,
      coverage_type: 'catch_up',
      catch_up_age_days: Number(candidate.days_since_published),
      selected: true,
      selected_for_editor: true
    }));
    selected = [...selected, ...catchUpSelected];
  }
```

In the returned `normalizeShortlistReport({...})` object (the big return near line 1600), add:

```javascript
    catch_up_used_count: catchUpSelected.length,
    catch_up_articles: catchUpSelected.map(item => ({
      title: item.title, url: item.url, catch_up_age_days: item.catch_up_age_days
    })),
```

Also ensure `selected` continues to flow into `primary_selected_articles`, `selected_articles`, and `compositionSummary(selected)` as before (it already does because we reassigned `selected`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/generate/catch-up-activation.test.js`
Expected: PASS.

- [ ] **Step 5: Verify non-thin week does NOT activate**

Add to the same test file:

```javascript
test('non-thin week (min already met) selects zero catch-up articles', () => {
  const fresh = { candidates: [
    { title: 'Fresh A', url: 'https://example.com/a', published_date: '2026-06-03',
      relevance_bucket: 'direct_aosp_camera', version_or_release: 'a1', api_or_component: 'Camera', behavior_change: 'x' }
  ] };
  const report = buildShortlistReport('2026-06-03', fresh, {
    exposureHistory: { articles: [] },
    catchUpPolicy: { enabled: true, maxCatchUpArticles: 2, maxAgeDays: 90,
      eligibleBuckets: ['direct_aosp_camera'], activationMode: 'thin_week_only' }
  });
  assert.equal(report.catch_up_used_count, 0);
});
```

Run: `node --test tests/unit/generate/catch-up-activation.test.js`
Expected: PASS (both tests). (`mainArticleCount.min` is 1, so a single fresh article satisfies it and catch-up stays off.)

- [ ] **Step 6: Commit**

```bash
git add scripts/newsroom/generate/newsroom-selection.js tests/unit/generate/catch-up-activation.test.js
git commit -m "feat(selection): activate catch-up lane in thin weeks only"
```

---

## Task 5: coverage_type schema field

**Files:**
- Modify: `scripts/newsroom/render/newsletter-schema.js`
- Modify: `scripts/newsroom/common/public-article-contract.js`
- Test: `tests/contract/editor-article-policy.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/contract/editor-article-policy.test.js`:

```javascript
test('section schema accepts optional coverage_type with catch_up value', () => {
  const { editorSchema } = require('../../scripts/newsroom/render/newsletter-schema');
  const sectionSchema = editorSchema.properties.sections.items;
  assert.ok(sectionSchema.properties.coverage_type, 'coverage_type must be defined on section schema');
  assert.deepEqual(sectionSchema.properties.coverage_type.enum, ['fresh', 'catch_up']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contract/editor-article-policy.test.js`
Expected: FAIL — `coverage_type must be defined`.

- [ ] **Step 3: Add coverage_type to schema**

In `scripts/newsroom/render/newsletter-schema.js`, find the `section` schema `properties` object and add (not in `required`):

```javascript
    coverage_type: { type: 'string', enum: ['fresh', 'catch_up'] },
    catch_up_age_days: { type: 'number' },
```

In `scripts/newsroom/common/public-article-contract.js`, if section normalization strips unknown keys, add `coverage_type` and `catch_up_age_days` to the preserved/allowed section keys so they survive validation (grep for the section allowed-keys list and append both names). Default behavior: absent → treated as `'fresh'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/contract/editor-article-policy.test.js`
Expected: PASS.

- [ ] **Step 5: Run broader schema tests**

Run: `npm.cmd run test`
Expected: no regressions (legacy sections without `coverage_type` still validate).

- [ ] **Step 6: Commit**

```bash
git add scripts/newsroom/render/newsletter-schema.js scripts/newsroom/common/public-article-contract.js tests/contract/editor-article-policy.test.js
git commit -m "feat(schema): add optional coverage_type and catch_up_age_days to sections"
```

---

## Task 6: retrospective framing prompt for catch_up sections

**Files:**
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
- Test: manual (prompt text); covered indirectly by e2e in Task 10.

- [ ] **Step 1: Add the catch-up instruction line**

In the editor prompt instruction array (the `.filter(Boolean).join('\n')` block near line 3770, where the `editorial_story` instruction was added), add a conditional line. First compute a flag near where `selected` capsules are prepared:

```javascript
const hasCatchUpSection = ensureArray(shortlistReport?.selected_articles)
  .some(item => item.coverage_type === 'catch_up');
```

Then add to the instruction array:

```javascript
        hasCatchUpSection ? '일부 기사는 coverage_type=catch_up인 "지난 소식"입니다. 이 기사는 수 주 전 릴리스를 다시 정리하는 회고이므로 속보처럼 쓰지 말고 "N주 전 릴리스된 ~를 아직 확인하지 않았다면" 같은 회고 톤으로 작성하세요. 릴리스 날짜를 숨기지 말고 본문에 명시하세요. coverage_type 값은 입력 그대로 유지하세요.' : '',
```

- [ ] **Step 2: Verify the file still loads**

Run: `node -e "require('./scripts/newsroom/cli/gemini-newsroom-newsletter.js'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Run tests**

Run: `npm.cmd run test`
Expected: no regressions.

- [ ] **Step 4: Commit**

```bash
git add scripts/newsroom/cli/gemini-newsroom-newsletter.js
git commit -m "feat(editor): add retrospective framing prompt for catch-up sections"
```

---

## Task 7: render catch-up divider + badge

**Files:**
- Modify: `scripts/newsroom/render/newsletter-renderer.js`
- Test: `tests/unit/render/catch-up-render.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/render/catch-up-render.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildMarkdown } = require('../../../scripts/newsroom/render/newsletter-renderer');

function issueWithCatchUp() {
  return {
    date: '2026-06-03',
    title: 'Test',
    summary: 'Test summary',
    briefing: ['a', 'b', 'c'],
    sections: [
      { headline: 'Fresh Camera item', coverage_type: 'fresh', public_article: { headline: 'Fresh Camera item' }, sources: [{ title: 's', url: 'https://example.com/fresh' }] },
      { headline: 'CameraX 1.6.0', coverage_type: 'catch_up', catch_up_age_days: 70, public_article: { headline: 'CameraX 1.6.0' }, sources: [{ title: 's', url: 'https://example.com/160' }] }
    ],
    references: []
  };
}

test('markdown groups catch_up sections under a 지난 소식 heading with a 주 전 badge', () => {
  const md = buildMarkdown(issueWithCatchUp());
  assert.match(md, /## 지난 소식/);
  assert.match(md, /주 전 릴리스/);
});

test('markdown without catch_up sections has no 지난 소식 heading', () => {
  const issue = issueWithCatchUp();
  issue.sections = [issue.sections[0]];
  const md = buildMarkdown(issue);
  assert.doesNotMatch(md, /## 지난 소식/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/render/catch-up-render.test.js`
Expected: FAIL — no 지난 소식 heading.

- [ ] **Step 3: Implement render grouping**

In `scripts/newsroom/render/newsletter-renderer.js`:

1. In `normalizedSections` (line 265), sort so `coverage_type === 'catch_up'` sections come after fresh ones, preserving relative order:

```javascript
function normalizedSections(issue) {
  const usedAnchors = new Set();
  const ordered = ensureArray(issue.sections)
    .map((section, originalIndex) => ({ section, originalIndex }))
    .sort((a, b) => {
      const aCatch = a.section.coverage_type === 'catch_up' ? 1 : 0;
      const bCatch = b.section.coverage_type === 'catch_up' ? 1 : 0;
      return aCatch - bCatch || a.originalIndex - b.originalIndex;
    });
  return ordered.map(({ section }, index) => {
    const publicArticle = publicArticleForSection(section, { issue });
    const category = publicArticle.headline || `Main Article ${index + 1}`;
    const isCatchUp = section.coverage_type === 'catch_up';
    const weeks = isCatchUp && Number.isFinite(Number(section.catch_up_age_days))
      ? Math.max(1, Math.round(Number(section.catch_up_age_days) / 7))
      : null;
    const badge = weeks ? ` (${weeks}주 전 릴리스)` : '';
    return {
      heading: `## ${index + 2}. ${category}${badge}`,
      htmlHeading: `${index + 2}. ${category}${badge}`,
      headingCategory: category,
      className: section.article_type || (section.is_ai_related ? 'ai' : 'article'),
      anchorId: uniqueArticleAnchorId(category, index, usedAnchors),
      articleNumber: index + 1,
      isCatchUp,
      section
    };
  });
}
```

2. In the markdown assembly (the function that joins section headings into the body, near line 454 where `## 1. 이번 주 3줄 브리핑` is built), insert a divider before the first `isCatchUp` section: when iterating normalized sections, if the current section `isCatchUp` and the previous was not, emit `\n## 지난 소식 (Catch-up)\n` before it. Implement by tracking a boolean across the map/reduce that builds the article markdown.

Concretely, locate where sections are turned into markdown blocks and wrap:

```javascript
  let catchUpDividerEmitted = false;
  const sectionBlocks = normalizedSections(issue).map(entry => {
    let prefix = '';
    if (entry.isCatchUp && !catchUpDividerEmitted) {
      prefix = '## 지난 소식 (Catch-up)\n\n';
      catchUpDividerEmitted = true;
    }
    return prefix + renderSectionMarkdown(entry, issue); // use the existing per-section renderer
  });
```

Use the existing per-section markdown rendering call already in the file (match its current name/shape; do not invent a new renderer — wire the prefix into the existing map).

3. For HTML (`buildHtml`), apply the same divider: emit an `<h2 class="catch-up-divider">지난 소식 (Catch-up)</h2>` before the first catch-up article block, mirroring the markdown logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/render/catch-up-render.test.js`
Expected: PASS (both).

- [ ] **Step 5: Run render + site validation**

Run: `npm.cmd run test && npm.cmd run validate:site`
Expected: no regressions; existing newsletters (no catch_up) render identically.

- [ ] **Step 6: Commit**

```bash
git add scripts/newsroom/render/newsletter-renderer.js tests/unit/render/catch-up-render.test.js
git commit -m "feat(render): group catch-up sections under 지난 소식 heading with age badge"
```

---

## Task 8: raise collection lookback default to 90

**Files:**
- Modify: `.github/workflows/00-newsletters-auto-daily-pr.yml`
- Modify: `.github/workflows/01-newsletters-source-collect-pr.yml`
- Modify: runtime default (`scripts/newsroom/common/runtime-config.js` — `DEFAULT_RUNTIME_CONFIG.lookbackDays` or equivalent)
- Test: `tests/workflow/` lookback assertion if one exists; else manual.

- [ ] **Step 1: Find the current lookback default**

Run: `grep -rn "lookback" .github/workflows/01-newsletters-source-collect-pr.yml scripts/newsroom/common/runtime-config.js`
Expected: shows `default: "21"` in the workflow and a `lookbackDays` default in runtime-config.

- [ ] **Step 2: Change defaults 21 → 90**

In `01-newsletters-source-collect-pr.yml`, change the `lookback_days` input `default: "21"` to `default: "90"` (both `workflow_dispatch` and `workflow_call` inputs).

In `00-newsletters-auto-daily-pr.yml`, if it passes `lookback_days` explicitly, set it to `'90'`; if it relies on the called workflow default, no change needed (document this in the commit).

In `scripts/newsroom/common/runtime-config.js`, change the `lookbackDays` default from `21` to `90`.

- [ ] **Step 3: Validate config + run tests**

Run: `npm.cmd run test && npm.cmd run doctor:config -- --no-llm-credentials`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/00-newsletters-auto-daily-pr.yml .github/workflows/01-newsletters-source-collect-pr.yml scripts/newsroom/common/runtime-config.js
git commit -m "feat(collect): raise lookback default to 90 days to feed catch-up pool"
```

---

## Task 9: surface catch_up_used_count in PR body

**Files:**
- Modify: `scripts/newsroom/cli/build-newsroom-pr-body.js`
- Test: `tests/workflow/pr-body-rendering.test.js` (append) if applicable.

- [ ] **Step 1: Add catch-up line to PR body**

In `build-newsroom-pr-body.js`, where the shortlist/selection summary rows are assembled, add a line when `shortlistReport.catch_up_used_count > 0`:

```javascript
    catchUpUsedCount > 0
      ? `- 지난 소식(catch-up) 기사: ${catchUpUsedCount}건 — ${catchUpTitles.join('; ')}`
      : '',
```

where `catchUpUsedCount = Number(shortlistReport?.catch_up_used_count || 0)` and `catchUpTitles = ensureArray(shortlistReport?.catch_up_articles).map(a => a.title)`.

- [ ] **Step 2: Verify file loads + run tests**

Run: `node -e "require('./scripts/newsroom/cli/build-newsroom-pr-body.js'); console.log('ok')" && npm.cmd run test`
Expected: `ok`; no regressions.

- [ ] **Step 3: Commit**

```bash
git add scripts/newsroom/cli/build-newsroom-pr-body.js
git commit -m "feat(pr-body): surface catch-up article count and titles"
```

---

## Task 10: end-to-end verification + docs sync

**Files:**
- Modify: docs if policy docs are generated (`npm.cmd run sync:policy-docs`).

- [ ] **Step 1: Full gate**

Run: `npm.cmd run test && npm.cmd run validate`
Expected: PASS (EXIT 0). If `check:policy-docs` fails, run `npm.cmd run sync:policy-docs` and commit the regenerated docs.

- [ ] **Step 2: Push and trigger the 00 workflow**

```bash
git push origin main
gh workflow run 00-newsletters-auto-daily-pr.yml --field newsletter_date=2026-06-03
```

- [ ] **Step 3: Inspect the result**

After completion, download debug artifacts and confirm:
- `shortlisted-candidates.json` has `catch_up_used_count >= 1`
- `editor-draft.json` sections include `coverage_type: 'catch_up'` for CameraX 1.6.0 and/or 1.7.0-alpha01
- `quality-report.json` score improved (real version/date/API evidence binds, no YouTube-playlist evidence failures)
- rendered `newsletters/2026-06-03/newsletter.md` contains a "## 지난 소식 (Catch-up)" section

```bash
gh run download <run-id> --name "newsroom-final-debug-<run-id>" --dir .tmp/verify
node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('.tmp/verify/content/newsroom/2026-06-03/shortlisted-candidates.json','utf8'));console.log('catch_up_used_count:',s.catch_up_used_count)"
```

- [ ] **Step 4: Commit any doc sync**

```bash
git add README.md docs/
git commit -m "docs: sync policy docs for catchUpPolicy"
```

---

## Verification

```bash
npm.cmd run test        # all unit + contract tests pass
npm.cmd run validate    # full safety gate, EXIT 0
gh workflow run 00-newsletters-auto-daily-pr.yml --field newsletter_date=2026-06-03
```

Success criteria: 2026-06-03 issue surfaces CameraX 1.6.0 / 1.7.0-alpha01 as catch-up main articles backed by real release-note evidence, rendered under "지난 소식 (Catch-up)", with quality driven by real evidence instead of I/O videos — and the thin-week-only guard keeps catch-up off in weeks with enough fresh content.
