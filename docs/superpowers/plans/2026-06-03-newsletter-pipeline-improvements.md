# Newsletter Pipeline Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issues #478 (zero-new-URL discovery warning), #480 (published event memory dedup), #476 (story-driven article enforcement), and make 00-newsletters-auto-daily-pr.yml reliably produce reviewable newsletters.

**Architecture:** Each issue is an independent improvement; implement in order #478 → #480 → #476 → 00-workflow. After each issue: run `npm.cmd run test` + `npm.cmd run validate`, commit, create PR, then move to next.

**Tech Stack:** Node.js 20, CommonJS require, 2-space indent, semicolons. Tests via `node --test`. Validation via `npm.cmd run validate`.

---

## Task 1: Issue #478 — Zero-new-URL Gemini Discovery Warning

### Files
- Modify: `scripts/newsroom/cli/gemini-source-discovery-boundary.js` (lines 171-260, 299-375)
- Modify: `scripts/newsroom/common/candidate-artifacts.js` (lines 512-581)
- Test: `tests/unit/collect/gemini-source-discovery-boundary.test.js` (create if missing)

### Context
`sourceDiscoveryHandoff()` at line 202 already checks `newUniqueCount === 0` but groups it with `sourceDiscoveryFeedbackReport?.status === 'WARNING'`. Issue #478 wants a specific, distinct warning when `llmUsed === true` AND `gemini_new_unique_url_count === 0`. The `gemini_new_unique_url_count` field already exists in `merged-candidate-manifest.json` via `sourceDiscoveryCandidateStats()`.

- [ ] **Step 1: Find or create the test file**

```bash
ls tests/unit/collect/ 2>/dev/null || mkdir -p tests/unit/collect
ls tests/unit/collect/ | grep discovery-boundary
```

- [ ] **Step 2: Write failing tests**

In `tests/unit/collect/gemini-source-discovery-boundary.test.js` (or the existing test), add:

```javascript
const { sourceDiscoveryHandoff, sourceDiscoveryVerdict } = require('../../../scripts/newsroom/cli/gemini-source-discovery-boundary.js');

test('sourceDiscoveryHandoff warns on zero-new-URL when LLM was used', (t) => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: {
      merged_candidate_count: 10,
      gemini_candidate_count: 5,
      gemini_new_unique_url_count: 0,
      gemini_publishable_candidate_count: 3,
      seed_new_unique_url_count: 0,
      seed_publishable_candidate_count: 0,
      llm_used: true
    },
    mergedCandidateRelPath: 'content/collected-news/2026-06-03/merged-candidates.json'
  });
  assert.strictEqual(result.nextStep, 'run_03');
  assert.ok(result.gemini_discovery_no_new_unique_url === true);
  assert.ok(result.label.includes('Gemini 신규 URL 없음'));
});

test('sourceDiscoveryHandoff does NOT warn when LLM was not used', (t) => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: {
      merged_candidate_count: 10,
      gemini_new_unique_url_count: 0,
      llm_used: false,
      gemini_publishable_candidate_count: 0,
      seed_new_unique_url_count: 5,
      seed_publishable_candidate_count: 3
    },
    mergedCandidateRelPath: 'content/collected-news/2026-06-03/merged-candidates.json'
  });
  assert.ok(!result.gemini_discovery_no_new_unique_url);
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
node --test tests/unit/collect/gemini-source-discovery-boundary.test.js
```
Expected: FAIL — `gemini_discovery_no_new_unique_url` doesn't exist yet.

- [ ] **Step 4: Implement the warning in sourceDiscoveryHandoff**

In `scripts/newsroom/cli/gemini-source-discovery-boundary.js`, modify `sourceDiscoveryHandoff()`:

After the `hasMergedArtifact` check (around line 193), update the `publishableCount > 0` branch to also attach the no-new-URL flag:

```javascript
function sourceDiscoveryHandoff({ status, stats = null, mergedCandidateRelPath = '', sourceDiscoveryFeedbackReport = null } = {}) {
  const mergedCount = numberStat(stats, 'merged_candidate_count');
  const geminiPublishableCount = numberStat(stats, 'gemini_publishable_candidate_count');
  const seedPublishableCount = numberStat(stats, 'seed_publishable_candidate_count');
  const publishableCount = geminiPublishableCount + seedPublishableCount;
  const geminiNewUniqueCount = numberStat(stats, 'gemini_new_unique_url_count');
  const newUniqueCount = geminiNewUniqueCount + numberStat(stats, 'seed_new_unique_url_count');
  const llmUsed = Boolean(stats?.llm_used);
  const hasMergedArtifact = Boolean(mergedCandidateRelPath);
  const geminiDiscoveryNoNewUniqueUrl = llmUsed && geminiNewUniqueCount === 0;

  if (status === FAILED_LLM_CREDENTIALS || !hasMergedArtifact || mergedCount === 0) {
    return { nextStep: 'blocked', label: '진행 불가', reason: ... };
  }
  if (publishableCount > 0) {
    return {
      nextStep: 'run_03',
      label: geminiDiscoveryNoNewUniqueUrl ? '03 진행 가능 — Gemini 신규 URL 없음' : '03 진행 가능',
      reason: ...,
      gemini_discovery_no_new_unique_url: geminiDiscoveryNoNewUniqueUrl
    };
  }
  if (newUniqueCount === 0 || sourceDiscoveryFeedbackReport?.status === 'WARNING') {
    return {
      nextStep: 'strengthen_candidates',
      label: geminiDiscoveryNoNewUniqueUrl ? '03 진행 가능하나 후보 보강 권장 — Gemini 신규 URL 없음' : '03 진행 가능하나 후보 보강 권장',
      reason: ...,
      gemini_discovery_no_new_unique_url: geminiDiscoveryNoNewUniqueUrl
    };
  }
  return { nextStep: 'run_03', label: '03 진행 가능', reason: ... };
}
```

- [ ] **Step 5: Add warning block to renderReport()**

In `renderReport()` (around line 299), after the stats table, add:

```javascript
if (handoff.gemini_discovery_no_new_unique_url) {
  lines.push('');
  lines.push('### ⚠️ Gemini 신규 URL 없음');
  lines.push('');
  lines.push(`Gemini discovery가 실행됐지만 신규 unique URL이 0개입니다.`);
  lines.push(`manual 후보와 전부 중복: gemini_new_unique_url_count=${stats?.gemini_new_unique_url_count ?? 0}`);
  lines.push('');
  lines.push('**권장 조치:** source family 확장, discovery prompt 재검토, 또는 seed URL 추가를 고려하세요.');
}
```

- [ ] **Step 6: Run tests and validate**

```bash
node --test tests/unit/collect/gemini-source-discovery-boundary.test.js
npm.cmd run test
npm.cmd run validate
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/newsroom/cli/gemini-source-discovery-boundary.js tests/unit/collect/
git commit -m "feat(discovery): warn when Gemini discovery adds zero new unique URLs"
```

---

## Task 2: Issue #480 — Published Event Memory

### Files
- Modify: `scripts/newsroom/common/article-exposure-history.js`
- Modify: `scripts/newsroom/generate/newsroom-selection.js` (add published-memory annotation)
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js` (record publication)
- Test: `tests/unit/newsroom/article-exposure-history.test.js` (or existing)

### Context
`article-exposure-history.js` already tracks `exposure_type: 'homepage_headline'` in `data/article-exposure-history.json`. The same structure can track `'newsletter_article'`. The `recordArticleExposure()` function is the write path. The `annotateArticleExposure()` function is the read path for selection.

Currently, dedup only works within a single newsletter date. Cross-date repeated articles (same URL, same event) are not warned about.

- [ ] **Step 1: Write failing tests**

```javascript
// In tests/unit/newsroom/article-exposure-history.test.js
test('recordArticleExposure records newsletter_article type', (t) => {
  const history = { schemaVersion: 1, articles: [] };
  const article = {
    article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    title: 'CameraX 1.6.1 fix',
    source_url: 'https://developer.android.com/...'
  };
  const result = recordArticleExposure(history, article, {
    newsletterDate: '2026-06-03',
    exposureType: 'newsletter_article'
  });
  assert.strictEqual(result.articles[0].exposure_type, 'newsletter_article');
  assert.strictEqual(result.articles[0].newsletter_date, '2026-06-03');
});

test('annotateArticleExposure marks recently published articles', (t) => {
  const history = {
    schemaVersion: 1,
    articles: [{
      article_identity_key: 'url:https://example.com/article',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-05-27',
      cooldown_until: '2026-06-17'
    }]
  };
  const candidate = { url: 'https://example.com/article' };
  const annotated = annotateArticleExposure(candidate, history);
  assert.ok(annotated.published_within_cooldown === true);
  assert.strictEqual(annotated.last_newsletter_date, '2026-05-27');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/unit/newsroom/article-exposure-history.test.js
```

- [ ] **Step 3: Implement newsletter_article recording in article-exposure-history.js**

In `recordArticleExposure()`, accept `exposureType` option (default `'homepage_headline'` for backward compat):

```javascript
function recordArticleExposure(history, article, options = {}) {
  const {
    newsletterDate,
    exposureType = 'homepage_headline',  // NEW: allow 'newsletter_article'
    cooldownDays = 21
  } = options;
  // ... existing logic, but use exposureType instead of hardcoded 'homepage_headline'
  // Add cooldown_until when exposureType === 'newsletter_article':
  if (exposureType === 'newsletter_article') {
    entry.cooldown_until = addDays(newsletterDate, cooldownDays);
  }
}
```

In `annotateArticleExposure()`, add `published_within_cooldown` and `last_newsletter_date`:

```javascript
function annotateArticleExposure(article, history) {
  const key = articleIdentityKey(article);
  const record = history?.articles?.find(a => a.article_identity_key === key && a.exposure_type === 'newsletter_article');
  if (!record) return article;
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...article,
    already_exposed: true,
    published_within_cooldown: record.cooldown_until ? today <= record.cooldown_until : false,
    last_newsletter_date: record.newsletter_date,
    exposure_history_record: record
  };
}
```

- [ ] **Step 4: Record newsletter articles after generation in gemini-newsroom-newsletter.js**

After the newsletter is written (find where `issueIndexEntry` is called or where editor-draft is finalized), add:

```javascript
const history = readExposureHistory(root, date);
for (const section of editor.sections) {
  history = recordArticleExposure(history, {
    article_identity_key: articleIdentityKey(section),
    title: section.headline || section.title,
    source_url: candidateUrl(section)
  }, {
    newsletterDate: date,
    exposureType: 'newsletter_article',
    cooldownDays: 21
  });
}
writeJson(exposureHistoryPath(root), history);
```

- [ ] **Step 5: Add cooldown warning in selection**

In `newsroom-selection.js`, in `buildEligibleShortlist()` or similar, after reading history:

```javascript
if (candidate.published_within_cooldown) {
  candidate.selection_warnings = (candidate.selection_warnings || []).concat([
    `repeated_event_within_cooldown: last published ${candidate.last_newsletter_date}`
  ]);
}
```

- [ ] **Step 6: Run tests and validate**

```bash
npm.cmd run test
npm.cmd run validate
```

- [ ] **Step 7: Commit**

```bash
git add scripts/newsroom/common/article-exposure-history.js scripts/newsroom/generate/newsroom-selection.js scripts/newsroom/cli/gemini-newsroom-newsletter.js tests/
git commit -m "feat(dedupe): track newsletter article publications and warn on cooldown repeats"
```

---

## Task 3: Issue #476 — Story-Driven Article Schema Enforcement

### Files
- Read: `scripts/newsroom/common/public-article-contract.js` (EDITORIAL_STORY_KEYS already defined)
- Modify: `scripts/newsroom/validate/newsletter-quality.js` (add editorial_story completeness check)
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js` (strengthen editor prompt)
- Test: existing `tests/unit/validate/` tests

### Context
`public-article-contract.js` already defines `EDITORIAL_STORY_KEYS = ['reader_scenario', 'what_happened', 'why_it_matters', 'field_scenario', 'not_to_overclaim', 'editor_take']` and `STORY_CONTRACT_VERSION = 1`. The `publicArticle` schema in `newsletter-schema.js` already has `editorial_story` field. But the validator may not enforce completeness. Issue #476 Phase 1 = prompt + schema only (no hard gate).

- [ ] **Step 1: Check current validator for editorial_story**

```bash
grep -n "editorial_story\|EDITORIAL_STORY_KEYS\|story_hook\|reader_scenario" scripts/newsroom/validate/newsletter-quality.js | head -20
```

- [ ] **Step 2: Write failing tests for editorial_story validator**

```javascript
// In tests/unit/validate/quality-gate.test.js or similar
test('quality gate warns when editorial_story fields are empty', (t) => {
  const section = buildMinimalSection({
    public_article: {
      story_contract_version: 1,
      editorial_story: {
        reader_scenario: '',
        what_happened: '',
        why_it_matters: '',
        field_scenario: '',
        not_to_overclaim: '',
        editor_take: ''
      }
    }
  });
  const result = getEditorialStoryWarnings(section);
  assert.ok(result.length > 0);
  assert.ok(result.some(w => w.includes('editorial_story')));
});

test('quality gate does not warn when editorial_story is populated', (t) => {
  const section = buildMinimalSection({
    public_article: {
      story_contract_version: 1,
      editorial_story: {
        reader_scenario: 'HAL 엔지니어가 SessionConfig 조합 버그를 디버깅하는 상황',
        what_happened: 'CameraX 1.6.1이 SessionConfig 조합 검증을 강화했다',
        why_it_matters: 'HAL 레이어에서 조합 실패가 더 명확히 노출된다',
        field_scenario: 'capture session 설정 중 feature combination 오류 발생 시 확인',
        not_to_overclaim: 'HAL 내부 구현 변경은 source가 명시하지 않음',
        editor_take: 'SessionConfig 조합 버그를 추적하는 팀에게 유용'
      }
    }
  });
  const result = getEditorialStoryWarnings(section);
  assert.strictEqual(result.length, 0);
});
```

- [ ] **Step 3: Add getEditorialStoryWarnings to newsletter-quality.js**

```javascript
function getEditorialStoryWarnings(section) {
  const story = section?.public_article?.editorial_story;
  if (!story) return ['editorial_story missing'];
  const KEYS = ['reader_scenario', 'what_happened', 'why_it_matters', 'field_scenario', 'not_to_overclaim', 'editor_take'];
  return KEYS.filter(k => !story[k] || story[k].trim() === '').map(k => `editorial_story.${k} is empty`);
}
```

Export it and use it in the main quality check to add soft deductions (not hard blockers for PR 1):

```javascript
const editorialWarnings = getEditorialStoryWarnings(section);
if (editorialWarnings.length > 0) {
  deductions.push({
    category: 'editorial-story',
    severity: 'soft',
    reason: 'editorial_story fields incomplete',
    details: editorialWarnings
  });
}
```

- [ ] **Step 4: Strengthen editor prompt**

In `gemini-newsroom-newsletter.js`, find the editor prompt (search for `editorSchema` usage near the main LLM call). Add to the instructions array:

```javascript
'각 기사의 public_article.editorial_story를 반드시 채우세요: reader_scenario(현업 HAL 엔지니어가 겪는 상황), what_happened(source에서 확인된 사실), why_it_matters(Camera HAL 관점 의미), field_scenario(실제 디버깅/CI 상황 연결), not_to_overclaim(과장하면 안 되는 선), editor_take(한 줄 판단). 모두 1-3문장으로 작성하세요.',
```

- [ ] **Step 5: Run tests and validate**

```bash
npm.cmd run test
npm.cmd run validate
```

- [ ] **Step 6: Commit**

```bash
git add scripts/newsroom/validate/newsletter-quality.js scripts/newsroom/cli/gemini-newsroom-newsletter.js tests/
git commit -m "feat(editorial): add editorial_story completeness check and strengthen editor prompt"
```

---

## Task 4: 00-newsletters-auto-daily-pr.yml — Pipeline Resilience

### Context
The 00 workflow runs successfully but the generated newsletter (PR #475, 2026-06-03) is `diagnostics_only` with:
- quality_score: 38 (threshold was 85 before ca39918, now 70)
- 5 fact-check must_fix hard blockers
- failure_reason: "Targeted repair changed main article count outside completion/replacement mode."
- failure_stage: "editor repair attempt 1/2"

The `ca39918` commit fixed `allowCountChange` propagation but was NOT on main when PR #475 was generated (the threshold in PR #475 still shows 85, not 70).

### Files
- Verify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js` (repair flow, allowCountChange)
- Verify: `config/newsletter-policy.json` (threshold is now 70)
- Check: `.github/workflows/03-newsletters-editor-pr.yml` for any remaining fragile steps

- [ ] **Step 1: Verify ca39918 fixes are on main and correct**

```bash
grep "threshold" config/newsletter-policy.json
grep -n "allowCountChange" scripts/newsroom/cli/gemini-newsroom-newsletter.js | head -10
```
Expected: threshold=70, two call sites with allowCountChange: true.

- [ ] **Step 2: Trigger a fresh run of 00 workflow**

```bash
gh workflow run 00-newsletters-auto-daily-pr.yml
```
Watch the run and check if it succeeds.

- [ ] **Step 3: If the newsletter is still diagnostics_only, investigate quality deductions**

Download the quality report from the GitHub Actions debug artifacts:
```bash
gh run list --workflow=00-newsletters-auto-daily-pr.yml --limit=1 --json databaseId
gh run download <run-id> --name "newsroom-final-debug-*" --dir .tmp/debug
cat ".tmp/debug/content/newsroom/*/quality-report.json" | python -c "import sys,json; q=json.load(sys.stdin); print(json.dumps(q.get('deductions',[]), indent=2))"
```

- [ ] **Step 4: If repair is still failing with section_count_drift, find the uncovered code path**

There may be a third call to `validateTargetedRepairResult` or a different validation layer. Check:
```bash
grep -n "section_count_drift\|changed main article count" scripts/newsroom/cli/gemini-newsroom-newsletter.js
```

- [ ] **Step 5: Fix the uncovered path if found**

Add `allowCountChange: true` to any call site that's missing it.

- [ ] **Step 6: If quality_score is too low (< 70) due to fact-check, investigate**

Check fact-check report:
```bash
cat ".tmp/debug/content/newsroom/*/fact-check-report.json" | python -c "import sys,json; f=json.load(sys.stdin); [print(i) for i in f.get('must_fix',[])]"
```

If fact-check is rejecting valid claims from video/conference sources, consider:
- Adding a `source_type: 'conference_talk'` soft-gate exception
- Or adjusting fact-check prompt to be less strict on first-party Google source claims

- [ ] **Step 7: Commit any fixes**

```bash
git add <changed files>
git commit -m "fix(pipeline): fix remaining repair failure in 00 auto daily workflow"
```

- [ ] **Step 8: Verify the next run produces a reviewable PR (not diagnostics_only)**

```bash
gh workflow run 00-newsletters-auto-daily-pr.yml
# wait for completion
gh run list --workflow=00-newsletters-auto-daily-pr.yml --limit=1 --json conclusion,status
```

---

## Verification

After all tasks:

```bash
npm.cmd run test        # unit + regression tests
npm.cmd run validate    # full safety gate
gh workflow run 00-newsletters-auto-daily-pr.yml  # end-to-end
```

Expected: all tests pass, validate passes, 00 workflow produces a non-diagnostics-only PR.
