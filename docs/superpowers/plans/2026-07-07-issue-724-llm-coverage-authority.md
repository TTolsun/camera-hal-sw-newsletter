# #724 LLM Coverage Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** editorial-plan LLM의 `coverage_decision`을 결정론 재조정 스테이지를 거쳐 실제 main-set composition에 반영하되, 모든 발행안전 불변식을 보존하고 default-OFF A/B 플래그 뒤에 둔다.

**Architecture:** 선정(결정론) → capsules → editorial-plan LLM → **신규 결정론 reconciler** → editor. LLM은 coverage 등급을 *제안*만 하고, 순수 함수 reconciler가 승급 자격 가드·cap clamp·발행 floor backfill을 강제한다. 플래그 OFF에서는 현행과 완전히 동일(reconciler passthrough + editorial-plan 입력도 `'selected'` 유지).

**Tech Stack:** Node 20 CommonJS, `node --test`, 기존 `src/generator/select` / `src/generator/publish` 계층, `src/shared/common/newsletter-policy`.

**정본 스펙:** [docs/superpowers/specs/2026-07-07-issue-724-llm-coverage-authority-design.md](../specs/2026-07-07-issue-724-llm-coverage-authority-design.md)

**슬라이스 경계:** 이 계획은 **main 집합 권한만** 배선한다. LLM 4등급 중 `main_article`만 main으로 매핑하고 `short_mention`/`reference_only`/`exclude`는 전부 "main 아님"으로 collapse한다(상호 구분은 diff에만 기록). 참고자료(reference) 섹션은 기존 결정론 로직을 건드리지 않는다(Phase 2 follow-up).

---

## File Structure

- **Create** `src/generator/select/coverage-reconciliation.js` — 순수 결정론 재조정 함수. 책임: LLM coverage 제안을 받아 승급 가드·cap clamp·floor backfill을 적용해 재조정된 main 집합과 diff를 반환. LLM 호출·파일 I/O 없음.
- **Create** `src/generator/select/test/coverage-reconciliation.test.js` — 위 모듈 단위 테스트.
- **Modify** `src/shared/common/runtime-config.js` — `newsroomLlmCoverageAuthority` 플래그(default `false`) 추가.
- **Modify** `src/shared/common/test/runtime-config.test.js`(또는 해당 위치의 기존 runtime-config 테스트 파일) — 플래그 파싱/기본값 테스트.
- **Modify** `src/generator/publish/orchestrator-editorial-plan-stage.js` — `buildEditorialPlanReport`가 flag ON일 때 `'shortlisted'` capsule view를 쓰도록(OFF는 `'selected'` 유지).
- **Modify** `src/generator/publish/gemini-newsroom-newsletter.js` — editorial-plan과 editor stage 사이에 reconciler를 배선하고 `coverage-reconciliation.json`을 기록.
- **Create** `src/generator/publish/test/coverage-authority-integration.test.js` — 배선 통합 테스트 + OFF-parity golden.
- **Modify** `AGENTS.md`, `src/AGENTS.md`, 그리고 로컬 `CLAUDE.md`(gitignored — 로컬만) — 핵심 원칙 경계 재정의.

> 실제 실행 전, 실제 `shortlisted-candidates.json`(예: `articles/content/newsroom/2026-07-06/`)에서 `selected_articles`/`reserve_candidates` 항목의 정확한 필드명(`source_candidate_hash`·`url`·`relevance_bucket`·`deterministic_score`·`main_article_source_allowed`·`main_article_score_eligible`)을 1회 확인해 아래 코드의 필드 접근이 실제와 일치하는지 검증한다. 불일치 시 매칭 키/가드 필드만 실제 이름으로 교정(로직 불변).

---

## Task 1: A/B 플래그 추가 (`newsroomLlmCoverageAuthority`)

**Files:**
- Modify: `src/shared/common/runtime-config.js` (DEFAULT_RUNTIME_CONFIG 블록 + readRuntimeConfig 반환 블록)
- Test: `src/shared/common/test/runtime-config.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`runtime-config.test.js`에 추가:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readRuntimeConfig } = require('../runtime-config');

test('newsroomLlmCoverageAuthority defaults to false', () => {
  const config = readRuntimeConfig({});
  assert.equal(config.newsroomLlmCoverageAuthority, false);
});

test('newsroomLlmCoverageAuthority parses NEWSROOM_LLM_COVERAGE_AUTHORITY=true', () => {
  const config = readRuntimeConfig({ NEWSROOM_LLM_COVERAGE_AUTHORITY: 'true' });
  assert.equal(config.newsroomLlmCoverageAuthority, true);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test src/shared/common/test/runtime-config.test.js`
Expected: FAIL (`config.newsroomLlmCoverageAuthority` is `undefined`)

- [ ] **Step 3: 최소 구현**

`DEFAULT_RUNTIME_CONFIG`(라인 53~ 블록, `newsroomEnableLinkedEvidenceDiscovery: true,` 근처)에 추가:

```js
  newsroomLlmCoverageAuthority: false,
```

`readRuntimeConfig`의 config 객체(라인 445 `newsroomEnableLinkedEvidenceDiscovery: parseBoolean(...)` 바로 뒤)에 추가:

```js
    newsroomLlmCoverageAuthority: parseBoolean(
      envValue(
        env,
        'NEWSROOM_LLM_COVERAGE_AUTHORITY',
        DEFAULT_RUNTIME_CONFIG.newsroomLlmCoverageAuthority
      ),
      'NEWSROOM_LLM_COVERAGE_AUTHORITY',
      { defaultValue: DEFAULT_RUNTIME_CONFIG.newsroomLlmCoverageAuthority }
    ),
```

- [ ] **Step 4: 통과 확인**

Run: `node --test src/shared/common/test/runtime-config.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/shared/common/runtime-config.js src/shared/common/test/runtime-config.test.js
git commit -m "Add default-off NEWSROOM_LLM_COVERAGE_AUTHORITY runtime flag"
```

---

## Task 2: reconciler 코어 — 승급 가드 + 제안 매핑

**Files:**
- Create: `src/generator/select/coverage-reconciliation.js`
- Test: `src/generator/select/test/coverage-reconciliation.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reconcileCoverage } = require('../coverage-reconciliation');

function mainEligible(overrides = {}) {
  return {
    url: 'u', title: 't', relevance_bucket: 'direct_aosp_camera',
    deterministic_score: 60, main_article_source_allowed: true,
    main_article_score_eligible: true, ...overrides
  };
}

test('OFF flag returns deterministic selected unchanged', () => {
  const shortlistReport = { selected_articles: [mainEligible({ url: 'a' })], reserve_candidates: [] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport: { editorial_plans: [] }, enabled: false });
  assert.deepEqual(out.selected.map(a => a.url), ['a']);
  assert.equal(out.diff.enabled, false);
});

test('LLM cannot promote a reserve candidate that is not deterministically main-eligible', () => {
  const shortlistReport = {
    selected_articles: [mainEligible({ url: 'a' })],
    reserve_candidates: [mainEligible({ url: 'b', main_article_source_allowed: false })]
  };
  const editorialPlanReport = { editorial_plans: [
    { url: 'b', coverage_decision: 'main_article', impact_level: 'high' }
  ] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(!out.selected.map(a => a.url).includes('b'), 'ineligible reserve must not become main');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test src/generator/select/test/coverage-reconciliation.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: 최소 구현**

```js
'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const { articlePolicy } = require('../../shared/common/newsletter-policy');

const COVERAGE_MAIN = 'main_article';
const FORBIDDEN_BUCKETS = new Set(ensureArray(articlePolicy.forbiddenMainBuckets));
const IMPACT_RANK = { high: 3, medium: 2, low: 1 };

function candidateKey(item) {
  return String(item?.source_candidate_hash || item?.url || item?.title || '').trim();
}

function isDeterministicallyMainEligible(candidate) {
  if (!candidate) return false;
  if (candidate.main_article_source_allowed !== true) return false;
  if (candidate.main_article_score_eligible === false) return false;
  if (FORBIDDEN_BUCKETS.has(String(candidate.relevance_bucket || ''))) return false;
  return true;
}

function coverageByKey(editorialPlanReport) {
  const map = new Map();
  for (const plan of ensureArray(editorialPlanReport?.editorial_plans)) {
    const key = candidateKey(plan);
    if (!key) continue;
    map.set(key, {
      coverage_decision: String(plan.coverage_decision || ''),
      impact_level: String(plan.impact_level || '')
    });
  }
  return map;
}

function reconcileCoverage({ shortlistReport, editorialPlanReport, enabled }) {
  const deterministicSelected = ensureArray(shortlistReport?.selected_articles);
  if (!enabled) {
    return { selected: deterministicSelected, diff: { enabled: false, changes: [] } };
  }
  const reserve = ensureArray(shortlistReport?.reserve_candidates);
  const coverage = coverageByKey(editorialPlanReport);
  const deterministicKeys = new Set(deterministicSelected.map(candidateKey));
  const changes = [];

  const proposedMain = [];
  for (const candidate of [...deterministicSelected, ...reserve]) {
    const key = candidateKey(candidate);
    const grade = coverage.get(key)?.coverage_decision || '';
    const wasMain = deterministicKeys.has(key);
    const proposesMain = grade ? grade === COVERAGE_MAIN : wasMain;
    if (!proposesMain) continue;
    if (isDeterministicallyMainEligible(candidate) || wasMain) {
      proposedMain.push(candidate);
    } else {
      changes.push({ key, action: 'promotion_blocked_ineligible' });
    }
  }

  return {
    selected: proposedMain,
    diff: {
      enabled: true,
      deterministic_selected: [...deterministicKeys],
      reconciled_selected: proposedMain.map(candidateKey),
      changes
    }
  };
}

module.exports = { reconcileCoverage, isDeterministicallyMainEligible, candidateKey };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test src/generator/select/test/coverage-reconciliation.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/generator/select/coverage-reconciliation.js src/generator/select/test/coverage-reconciliation.test.js
git commit -m "Add coverage reconciliation core with deterministic promotion guard"
```

---

## Task 3: reconciler — cap clamp (max + supporting-main + tie-break)

**Files:**
- Modify: `src/generator/select/coverage-reconciliation.js`
- Test: `src/generator/select/test/coverage-reconciliation.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
test('cap clamp keeps at most mainArticleCount.max, ordered by impact then score', () => {
  const many = Array.from({ length: 7 }, (_, i) => mainEligible({ url: `u${i}`, deterministic_score: 50 + i }));
  const shortlistReport = { selected_articles: many, reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: many.map((c, i) => ({
    url: c.url, coverage_decision: 'main_article', impact_level: i === 0 ? 'high' : 'low'
  })) };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.equal(out.selected.length, 5); // articlePolicy.mainArticleCount.max
  assert.equal(out.selected[0].url, 'u0'); // high impact first
});

test('supporting-main bucket count is clamped to supportingMainMaxAllowed', () => {
  const primary = mainEligible({ url: 'p', relevance_bucket: 'direct_aosp_camera' });
  const s1 = mainEligible({ url: 's1', relevance_bucket: 'soc_platform_signal' });
  const s2 = mainEligible({ url: 's2', relevance_bucket: 'soc_platform_signal' });
  const shortlistReport = { selected_articles: [primary, s1, s2], reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: [primary, s1, s2].map(c => ({ url: c.url, coverage_decision: 'main_article', impact_level: 'medium' })) };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  const supporting = out.selected.filter(a => ['android_multimedia_camera_output','soc_platform_signal','cpp_ai_tooling_fallback'].includes(a.relevance_bucket));
  assert.ok(supporting.length <= 1); // articlePolicy.publishReadyComposition.supportingMainMaxAllowed
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test src/generator/select/test/coverage-reconciliation.test.js`
Expected: FAIL (현재는 7개 전부 반환, supporting 2개 유지)

- [ ] **Step 3: 최소 구현**

`coverage-reconciliation.js` 상단 import 아래에 추가:

```js
const { getPublishReadyCompositionPolicy } = require('../../shared/common/newsletter-policy');
const SUPPORTING_BUCKETS = new Set(ensureArray(articlePolicy.supportingMainBuckets));

function impactRank(coverage, key) {
  return IMPACT_RANK[String(coverage.get(key)?.impact_level || '').toLowerCase()] || 0;
}

function orderForClamp(items, coverage) {
  return [...items].sort((a, b) => {
    const ir = impactRank(coverage, candidateKey(b)) - impactRank(coverage, candidateKey(a));
    if (ir !== 0) return ir;
    return Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0);
  });
}

function applyCaps(proposedMain, coverage) {
  const ordered = orderForClamp(proposedMain, coverage);
  const supportingMax = Number(
    (getPublishReadyCompositionPolicy()?.articlePolicy?.publishReadyComposition
      || {}).supportingMainMaxAllowed ?? articlePolicy.publishReadyComposition.supportingMainMaxAllowed
  );
  const kept = [];
  let supportingCount = 0;
  for (const candidate of ordered) {
    if (kept.length >= articlePolicy.mainArticleCount.max) break;
    const isSupporting = SUPPORTING_BUCKETS.has(String(candidate.relevance_bucket || ''));
    if (isSupporting && supportingCount >= supportingMax) continue;
    if (isSupporting) supportingCount += 1;
    kept.push(candidate);
  }
  return kept;
}
```

`reconcileCoverage`의 `const proposedMain = [];` 루프 뒤, `return` 앞에 삽입:

```js
  const clamped = applyCaps(proposedMain, coverage);
```

그리고 `return`의 `selected`/`reconciled_selected`를 `proposedMain` → `clamped`로 교체.

- [ ] **Step 4: 통과 확인**

Run: `node --test src/generator/select/test/coverage-reconciliation.test.js`
Expected: PASS (전 테스트)

- [ ] **Step 5: 커밋**

```bash
git add src/generator/select/coverage-reconciliation.js src/generator/select/test/coverage-reconciliation.test.js
git commit -m "Clamp reconciled main set to policy caps with impact/score tie-break"
```

---

## Task 4: reconciler — 발행가능 floor backfill + change 로그

**Files:**
- Modify: `src/generator/select/coverage-reconciliation.js`
- Test: `src/generator/select/test/coverage-reconciliation.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
test('floor backfill restores min main count when LLM excludes everything', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const b = mainEligible({ url: 'b', deterministic_score: 65 });
  const shortlistReport = { selected_articles: [a, b], reserve_candidates: [] };
  const editorialPlanReport = { editorial_plans: [
    { url: 'a', coverage_decision: 'exclude', impact_level: 'low' },
    { url: 'b', coverage_decision: 'exclude', impact_level: 'low' }
  ] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(out.selected.length >= 1); // articlePolicy.mainArticleCount.min
  assert.equal(out.selected[0].url, 'a'); // highest deterministic score backfilled first
  assert.ok(out.diff.changes.some(c => c.action === 'floor_backfill'));
});

test('diff records demotions and promotions vs deterministic', () => {
  const a = mainEligible({ url: 'a', deterministic_score: 70 });
  const r = mainEligible({ url: 'r', deterministic_score: 40 });
  const shortlistReport = { selected_articles: [a], reserve_candidates: [r] };
  const editorialPlanReport = { editorial_plans: [
    { url: 'a', coverage_decision: 'reference_only', impact_level: 'low' },
    { url: 'r', coverage_decision: 'main_article', impact_level: 'high' }
  ] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport, enabled: true });
  assert.ok(out.selected.map(x => x.url).includes('r')); // promoted
  assert.ok(out.diff.changes.some(c => c.action === 'promoted'));
  assert.ok(out.diff.changes.some(c => c.action === 'demoted'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test src/generator/select/test/coverage-reconciliation.test.js`
Expected: FAIL (floor backfill / change 로그 없음)

- [ ] **Step 3: 최소 구현**

`applyCaps` 호출 뒤(`const clamped = applyCaps(...)` 다음)에 삽입:

```js
  const clampedKeys = new Set(clamped.map(candidateKey));
  if (clamped.length < articlePolicy.mainArticleCount.min) {
    const backfill = deterministicSelected
      .filter(c => !clampedKeys.has(candidateKey(c)))
      .sort((a, b) => Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0));
    for (const c of backfill) {
      if (clamped.length >= articlePolicy.mainArticleCount.min) break;
      clamped.push(c);
      clampedKeys.add(candidateKey(c));
      changes.push({ key: candidateKey(c), action: 'floor_backfill' });
    }
  }
  for (const c of deterministicSelected) {
    if (!clampedKeys.has(candidateKey(c))) changes.push({ key: candidateKey(c), action: 'demoted' });
  }
  for (const c of clamped) {
    if (!deterministicKeys.has(candidateKey(c))) changes.push({ key: candidateKey(c), action: 'promoted' });
  }
```

(주의: `changes.push({ key, action: 'floor_backfill' })`가 demoted 루프보다 먼저 와야 clampedKeys가 최신이다. 위 순서 유지.)

- [ ] **Step 4: 통과 확인**

Run: `node --test src/generator/select/test/coverage-reconciliation.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/generator/select/coverage-reconciliation.js src/generator/select/test/coverage-reconciliation.test.js
git commit -m "Add publishable-floor backfill and change log to coverage reconciliation"
```

---

## Task 5: editorial-plan 입력을 flag ON일 때 `'shortlisted'`로 확장

**Files:**
- Modify: `src/generator/publish/orchestrator-editorial-plan-stage.js:41-53` (`buildEditorialPlanReport`)
- Test: `src/generator/publish/test/coverage-authority-integration.test.js`

- [ ] **Step 1: 실패 테스트 작성**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('buildEditorialPlanReport selects shortlisted capsule view when coverage authority is on', () => {
  // capsuleInputFromReport를 spy로 감싸 어떤 view가 요청됐는지 확인
  const stage = require('../orchestrator-editorial-plan-stage');
  const capsules = require('../../select/article-capsules');
  const calls = [];
  const original = capsules.capsuleInputFromReport;
  capsules.capsuleInputFromReport = (report, view) => { calls.push(view); return original(report, view); };
  // callLlmJson을 최소 stub로 대체할 수 없다면, 이 테스트는 selector 인자만 확인하는
  // 얇은 헬퍼(editorialPlanCapsuleView(enabled))를 별도 export해 직접 검증한다(아래 구현 참고).
  capsules.capsuleInputFromReport = original;
  assert.equal(stage.editorialPlanCapsuleView(true), 'shortlisted');
  assert.equal(stage.editorialPlanCapsuleView(false), 'selected');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test src/generator/publish/test/coverage-authority-integration.test.js`
Expected: FAIL (`editorialPlanCapsuleView` 미정의)

- [ ] **Step 3: 최소 구현**

`orchestrator-editorial-plan-stage.js`에 순수 헬퍼를 추가하고 `buildEditorialPlanReport`가 이를 쓰게 한다. 함수 시그니처에 `coverageAuthority` 옵션을 추가:

```js
function editorialPlanCapsuleView(coverageAuthority) {
  return coverageAuthority === true ? 'shortlisted' : 'selected';
}

async function buildEditorialPlanReport({ date, articleCapsuleReport, commonContext, stage, coverageAuthority = false }) {
  const result = await callLlmJson(
    stage,
    editorialPlanSystemPrompt(),
    `${commonContext}\n\nSelected article capsule JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, editorialPlanCapsuleView(coverageAuthority)), null, 2)}`,
    editorialPlanSchema
  );
  const normalized = normalizeEditorialPlanReport(result, date);
  if (normalized.editorial_plans.length === 0) {
    throw new Error('Editorial plan stage produced no usable editorial_plans');
  }
  return normalized;
}
```

`module.exports`에 `editorialPlanCapsuleView` 추가.

- [ ] **Step 4: 통과 확인**

Run: `node --test src/generator/publish/test/coverage-authority-integration.test.js`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/generator/publish/orchestrator-editorial-plan-stage.js src/generator/publish/test/coverage-authority-integration.test.js
git commit -m "Feed shortlisted capsules to editorial-plan when coverage authority is on"
```

---

## Task 6: reconciler를 파이프라인에 배선 + `coverage-reconciliation.json` 기록

**Files:**
- Modify: `src/generator/publish/gemini-newsroom-newsletter.js` (라인 477~483 editorial-plan 직후, 505 editor stage 직전)
- Test: `src/generator/publish/test/coverage-authority-integration.test.js`

**배선 규칙(정확히 준수):**
1. `readRuntimeConfig()`(이 파일이 이미 사용하는 config 접근 경로)에서 `newsroomLlmCoverageAuthority`를 읽어 `coverageAuthority` 지역 변수에 담는다.
2. `buildEditorialPlanReport({ ..., coverageAuthority })`로 전달(Task 5).
3. editorial-plan 기록 뒤:

```js
const { reconcileCoverage } = require('../select/coverage-reconciliation'); // 파일 상단 require 블록에 추가
...
const coverageReconciliation = reconcileCoverage({
  shortlistReport,
  editorialPlanReport,
  enabled: coverageAuthority
});
writeJson(path.join(newsroomDir, 'coverage-reconciliation.json'), coverageReconciliation.diff);
if (coverageAuthority) {
  shortlistReport.selected_articles = coverageReconciliation.selected;
  generationRunState.selectedInputs = shortlistReport.selected_articles;
  articleCapsuleReport = buildArticleCapsuleReport(date, shortlistReport, { date, candidates: reporter.candidates }, { seedEvidencePack });
  writeJson(path.join(newsroomDir, 'article-capsules.json'), articleCapsuleReport);
}
```

> OFF에서는 `shortlistReport`/`articleCapsuleReport`를 재작성하지 않으므로 현행과 완전히 동일하다. `coverage-reconciliation.json`은 OFF에서도 기록(diff.enabled=false, changes=[]).

- [ ] **Step 1: 실패 테스트 작성 (OFF-parity golden)**

```js
test('coverage authority OFF leaves selected_articles byte-identical', () => {
  const { reconcileCoverage } = require('../../select/coverage-reconciliation');
  const selected = [{ url: 'a', deterministic_score: 60 }, { url: 'b', deterministic_score: 55 }];
  const shortlistReport = { selected_articles: selected, reserve_candidates: [{ url: 'c' }] };
  const out = reconcileCoverage({ shortlistReport, editorialPlanReport: { editorial_plans: [] }, enabled: false });
  assert.equal(out.selected, selected); // same reference, no rebuild
  assert.deepEqual(out.diff, { enabled: false, changes: [] });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test src/generator/publish/test/coverage-authority-integration.test.js`
Expected: 이 golden은 Task 2에서 이미 통과할 수 있으므로, 배선 자체는 아래 Step 4의 전체 test/validate로 검증한다. golden이 PASS면 OK.

- [ ] **Step 3: 배선 구현**

위 "배선 규칙" 1~3을 `gemini-newsroom-newsletter.js`에 적용한다. `readRuntimeConfig` import가 이미 있는지 확인하고 없으면 추가. `require('../select/coverage-reconciliation')`를 파일 상단 require 그룹에 추가.

- [ ] **Step 4: 통과 확인**

Run:
```
node src/shared/tooling/cli/run-node-tests.js src
```
Expected: 전 테스트 PASS(신규 포함). 특히 기존 selection/publish 계약 테스트가 OFF 기본값에서 회귀 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/generator/publish/gemini-newsroom-newsletter.js src/generator/publish/test/coverage-authority-integration.test.js
git commit -m "Wire coverage reconciliation between editorial-plan and editor stages"
```

---

## Task 7: 원칙/계약 문서 경계 재정의

**Files:**
- Modify: `AGENTS.md`, `src/AGENTS.md` (tracked), 로컬 `CLAUDE.md`(gitignored — 로컬만 반영, 커밋 대상 아님)

- [ ] **Step 1: `src/AGENTS.md`의 review-publication guardrail 절 갱신**

"main article은 deterministic code가 결정" 문장을 스펙의 새 경계 문구로 교체한다:

> 발행가능 main *자격*(source-binding/evidence/freshness/cap/floor/forbidden)은 deterministic code가 결정한다. 그 결정론적으로 허용된 봉투 *안에서* coverage 등급 재배치만 LLM editorial-plan이 제안하고 deterministic reconciler(`src/generator/select/coverage-reconciliation.js`)가 불변식을 강제한다. 이 권한은 `NEWSROOM_LLM_COVERAGE_AUTHORITY`(default OFF) 뒤에 있으며 프로덕션 A/B 검증 전에는 OFF다.

- [ ] **Step 2: 루트 `AGENTS.md`의 동일 원칙 문장에 같은 경계 반영**(간결히).

- [ ] **Step 3: 로컬 `CLAUDE.md:65`도 동일하게 갱신**(UTF-8 patch 편집; gitignored라 커밋되지 않지만 로컬 에이전트 일관성 유지).

- [ ] **Step 4: 인코딩 확인**

Run: `npm.cmd run check:encoding`
Expected: `Text encoding validation passed.`

- [ ] **Step 5: 커밋**

```bash
git add AGENTS.md src/AGENTS.md
git commit -m "Redefine deterministic-selection boundary for gated LLM coverage authority"
```

---

## Task 8: 전체 게이트 + OFF 기본값 무회귀 실증

**Files:** (없음 — 검증만)

- [ ] **Step 1: 단위/스크립트 테스트**

Run: `npm.cmd run test`
Expected: 전 테스트 PASS.

- [ ] **Step 2: 전체 validate 게이트**

Run: `npm.cmd run validate`
Expected: exit 0. (로컬 `validate:quality` stale는 `.tmp/newsletter-*` 잔재 거짓양성일 수 있음 — 스펙/메모리 참조, 방어패치 금지.)

- [ ] **Step 3: OFF 기본값 확인**

Run: `node -e "console.log(require('./src/shared/common/runtime-config').readRuntimeConfig({}).newsroomLlmCoverageAuthority)"`
Expected: `false`

- [ ] **Step 4: 최종 커밋(문서 있으면)**

```bash
git add -A
git commit -m "Finalize #724 coverage authority slice (default OFF)"
```

---

## 롤아웃 (구현 후, 코드 밖)

1. 이 브랜치를 그대로 두고 **프로덕션 A/B**(`NEWSROOM_LLM_COVERAGE_AUTHORITY` ON vs OFF)를 ≥2 주기 실행.
2. 각 run의 `coverage-reconciliation.json` diff를 사람 리뷰어가 "방어가능"으로 판정 + 안전 불변식 무회귀 확인.
3. 사용자 승인 후에만 `DEFAULT_RUNTIME_CONFIG.newsroomLlmCoverageAuthority`를 `true`로 승격(별도 커밋). **자율 머지 안 함.**

## Self-Review 체크 결과

- **Spec coverage:** 파이프라인 변경(Task 5,6), reconciler 3불변식(Task 2 가드 / Task 3 cap / Task 4 floor), A/B 플래그+아티팩트(Task 1,6), 원칙 문서(Task 7), OFF-parity(Task 6 golden + Task 8) — 스펙 각 절 커버. 참고 섹션/reference_only-vs-exclude 구분은 스펙에서 Phase 2로 명시 제외.
- **Placeholder scan:** 실제 코드/명령/예상출력 포함. "실제 필드명 1회 확인" 노트는 방어적 검증 지시이지 placeholder 아님.
- **Type consistency:** `reconcileCoverage`/`candidateKey`/`isDeterministicallyMainEligible`/`editorialPlanCapsuleView` 시그니처가 Task 간 일치. `newsroomLlmCoverageAuthority`(config)↔`NEWSROOM_LLM_COVERAGE_AUTHORITY`(env)↔`coverageAuthority`/`enabled`(인자) 매핑 일관.
