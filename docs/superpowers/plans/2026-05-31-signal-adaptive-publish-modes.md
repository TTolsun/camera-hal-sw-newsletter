# 신호 적응형 발행 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그날 수집된 카메라 신호량에 따라 발행 형식을 DEEP / CONTEXT / QUIET 모드로 결정론적으로 전환하여, 코어 뉴스 부족 시 fallback 억지 승격으로 인한 CI 실패를 제거하고 PR #467 승격 로직을 대체·제거한다.

**Architecture:** selection 직후 `compositionSummary` 카운트로 발행 모드를 1회 확정(순수 함수). 모드는 `buildShortlistReport`가 반환하는 report 객체와 `generation-status.json`에 기록된다. editor 검증 게이트(`validateSelectedGroupCoverage`)와 CLI 프롬프트·렌더링이 모드를 인식하여 분기한다. CONTEXT/QUIET 모드는 "메인 기사 ≥1" 요구를 면제하되 기존 근거·출처 게이트는 유지한다.

**Tech Stack:** Node.js 20 (CommonJS, 2-space indent, semicolons), `node --test` / `scripts/run-node-tests.js`, 기존 newsroom 파이프라인.

---

## 작업 순서 개요

- **Phase 0**: temperature hotfix (설계와 독립, 선행 가능)
- **Phase 1**: 발행 모드 정책 config + 검증 (`publishModePolicy`)
- **Phase 2**: 모드 판정 순수 함수 (`publish-mode.js`)
- **Phase 3**: selection report에 모드 배선
- **Phase 4**: 모드별 게이트 분기 (group coverage)
- **Phase 5**: CLI 프롬프트 분기 + 상태 기록 + 렌더링
- **Phase 6**: PR #467 승격 로직 제거 (CONTEXT 검증 후)
- **Phase 7**: DEEP 모드 보강 (repair group coverage 보존 + editor claim 프롬프트)

각 Phase는 독립적으로 `npm.cmd run test`가 green이어야 한다. Windows PowerShell에서는 `npm.cmd`, 그 외 `npm` 사용. 아래 명령은 `npm` 표기.

---

## Phase 0: temperature hotfix (독립 선행)

이 Phase는 별도 브랜치/PR로 분리해도 된다. 설계 작업과 의존성 없음.

### Task 0.1: editor temperature 기본값 완화

**Files:**
- Modify: `scripts/newsroom/common/runtime-config.js` (geminiTemperatureEditor 기본값)

- [ ] **Step 1: 현재 기본값 확인**

Run: `grep -n "geminiTemperatureEditor" scripts/newsroom/common/runtime-config.js`
Expected: `geminiTemperatureEditor: 0.55` 출력

- [ ] **Step 2: 0.55 → 0.4로 조정**

`geminiTemperatureEditor: 0.55` 를 `geminiTemperatureEditor: 0.4` 로 변경. (0.35는 prose 다양성을 과하게 죽일 수 있어 중간값 0.4 채택; editor claim 구조 일관성 회복이 목적)

- [ ] **Step 3: doctor로 런타임 설정 확인**

Run: `node scripts/newsroom/cli/doctor-runtime-config.js 2>/dev/null || node scripts/doctor-runtime-config.js`
Expected: `geminiTemperatureEditor` 가 0.4로 출력 (정확한 진입점은 `grep -rn "doctor" package.json` 로 확인)

- [ ] **Step 4: 테스트**

Run: `npm run test`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/common/runtime-config.js
git commit -m "fix(llm): lower editor temperature default 0.55 to 0.4 for claim consistency"
```

---

## Phase 1: 발행 모드 정책 config + 검증

### Task 1.1: `publishModePolicy` 검증/정규화 테스트 작성

**Files:**
- Test: `tests/unit/common/publish-mode-policy.test.js` (Create)

- [ ] **Step 1: 실패 테스트 작성**

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getPublishModePolicy,
  getDefaultNewsletterPolicy,
  validateNewsletterPolicyConfig
} = require('../../../scripts/newsroom/common/newsletter-policy');

test('default policy exposes publishModePolicy with contextMinSignals', () => {
  const policy = getDefaultNewsletterPolicy();
  const mode = getPublishModePolicy(policy);
  assert.equal(typeof mode.contextMinSignals, 'number');
  assert.ok(mode.contextMinSignals >= 1);
});

test('validateNewsletterPolicyConfig rejects non-integer contextMinSignals', () => {
  const base = JSON.parse(JSON.stringify(require('../../../config/newsletter-policy.json')));
  base.publishModePolicy = { contextMinSignals: 'two' };
  const errors = validateNewsletterPolicyConfig(base);
  assert.ok(errors.some(e => e.includes('contextMinSignals')));
});

test('validateNewsletterPolicyConfig accepts valid publishModePolicy', () => {
  const base = JSON.parse(JSON.stringify(require('../../../config/newsletter-policy.json')));
  base.publishModePolicy = { contextMinSignals: 2 };
  const errors = validateNewsletterPolicyConfig(base);
  assert.equal(errors.filter(e => e.includes('publishModePolicy') || e.includes('contextMinSignals')).length, 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/common/publish-mode-policy.test.js`
Expected: FAIL — `getPublishModePolicy is not a function`

- [ ] **Step 3: 커밋 (실패 테스트)**

```bash
git add tests/unit/common/publish-mode-policy.test.js
git commit -m "test: add failing tests for publishModePolicy validation"
```

### Task 1.2: `newsletter-policy.json`에 `publishModePolicy` 추가, `cppFallbackMainPromotion` 제거

**Files:**
- Modify: `config/newsletter-policy.json`

- [ ] **Step 1: config 편집**

`cppFallbackMainPromotion` 블록 (라인 50–53 부근) 전체를 삭제하고, 그 자리에 아래를 넣는다:

```json
  "publishModePolicy": {
    "contextMinSignals": 1,
    "description": "발행 모드 판정 임계값. coreCount>=1이면 DEEP, core 0건이고 (adjacent+context) 신호가 contextMinSignals 이상이면 CONTEXT, 그 외 QUIET."
  },
```

- [ ] **Step 2: JSON 유효성 확인**

Run: `node -e "JSON.parse(require('fs').readFileSync('config/newsletter-policy.json','utf8')); console.log('ok')"`
Expected: `ok`

### Task 1.3: `newsletter-policy.js`에 검증/정규화/getter 구현

**Files:**
- Modify: `scripts/newsroom/common/newsletter-policy.js`

- [ ] **Step 1: `validatePublishModePolicy` 추가**

`validateCppFallbackMainPromotion` 함수(라인 264 부근)를 **삭제**하고 아래 함수를 추가한다:

```javascript
function validatePublishModePolicy(value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('publishModePolicy must be an object.');
    return;
  }
  if (!Number.isInteger(value.contextMinSignals) || value.contextMinSignals < 1) {
    errors.push('publishModePolicy.contextMinSignals must be an integer >= 1.');
  }
}
```

- [ ] **Step 2: `validateNewsletterPolicyConfig`에서 호출 교체**

라인 203–205의 `cppFallbackMainPromotion` 검증 블록을 아래로 교체:

```javascript
  if (config.publishModePolicy !== undefined) {
    validatePublishModePolicy(config.publishModePolicy, errors);
  }
```

- [ ] **Step 3: `normalizeCppFallbackMainPromotion` 삭제, `normalizePublishModePolicy` 추가**

`normalizeCppFallbackMainPromotion` 함수(라인 254 부근)를 삭제하고 추가:

```javascript
function normalizePublishModePolicy(raw) {
  if (!raw || typeof raw !== 'object') {
    return { contextMinSignals: 1 };
  }
  return {
    contextMinSignals: Number.isInteger(raw.contextMinSignals) && raw.contextMinSignals >= 1
      ? raw.contextMinSignals
      : 1
  };
}
```

- [ ] **Step 4: `normalizeNewsletterPolicyConfig`에서 필드 교체**

라인 283의 `cppFallbackMainPromotion: normalizeCppFallbackMainPromotion(config.cppFallbackMainPromotion),` 를 아래로 교체:

```javascript
    publishModePolicy: normalizePublishModePolicy(config.publishModePolicy),
```

- [ ] **Step 5: getter 교체**

`getCppFallbackMainPromotionPolicy` 함수(라인 370 부근)를 삭제하고 추가:

```javascript
function getPublishModePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.publishModePolicy;
}
```

- [ ] **Step 6: `isSupportingMainBucket`에서 cppFallback 분기 제거**

`isSupportingMainBucket` 함수(라인 380 부근)에서 `cppFallbackMainPromotion` / `cameraDevWorkflowRelevance` 관련 분기를 제거하고 원래 단순 형태로 되돌린다:

```javascript
function isSupportingMainBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).supportingMainBuckets.includes(bucketValue(bucket));
}
```

`isMainArticleAllowedBucket`도 options 인자를 제거하고 원형 복원:

```javascript
function isMainArticleAllowedBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return isPrimaryCameraStackBucket(bucket, policy) || isSupportingMainBucket(bucket, policy);
}
```

- [ ] **Step 7: exports 교체**

`module.exports`에서 `getCppFallbackMainPromotionPolicy,` 를 `getPublishModePolicy,` 로 교체.

- [ ] **Step 8: 테스트 통과 확인**

Run: `node --test tests/unit/common/publish-mode-policy.test.js`
Expected: PASS (3 tests)

> 주의: 이 시점에서 `getCppFallbackMainPromotionPolicy`를 import하던 다른 파일들(`newsroom-selection.js`, `newsletter-quality.js`, `public-article-contract.js`)이 깨진다. 이는 Phase 6에서 정리하지만, 빌드 무결성을 위해 다음 Step에서 임시로 import만 제거한다.

- [ ] **Step 9: 깨진 import 임시 제거**

Run: `grep -rln "getCppFallbackMainPromotionPolicy\|isSupportingMainBucket.*options\|cameraDevWorkflowRelevance" scripts/newsroom/`
각 파일에서 `getCppFallbackMainPromotionPolicy` import 라인을 제거한다. 사용처는 Phase 6에서 완전 제거하므로, 컴파일만 통과하도록 사용처를 일시적으로 `false`로 대체:
- `newsroom-selection.js`: `getCppFallbackMainPromotionPolicy` import 제거 + `compositionSummary`의 cpp_fallback_camera_dev_relevant_count 계산을 `0`으로 임시 고정 (Phase 6에서 완전 제거)
- `newsletter-quality.js`, `public-article-contract.js`: 동일하게 import 제거 + 사용처 `false`/`0` 임시화

- [ ] **Step 10: 전체 테스트 (일부 #467 테스트는 아직 실패 허용 안 됨 → skip 표시)**

Run: `npm run test 2>&1 | tail -20`
Expected: #467 관련 3개 테스트 파일만 실패. 그 외 PASS. (#467 테스트는 Phase 6에서 삭제)

> 만약 #467 테스트 실패가 전체 run을 막으면, Phase 6의 테스트 삭제(Task 6.1)를 여기서 먼저 수행한 뒤 진행한다.

- [ ] **Step 11: Commit**

```bash
git add config/newsletter-policy.json scripts/newsroom/common/newsletter-policy.js scripts/newsroom/generate/newsroom-selection.js scripts/newsroom/validate/newsletter-quality.js scripts/newsroom/common/public-article-contract.js
git commit -m "feat(policy): replace cppFallbackMainPromotion with publishModePolicy"
```

---

## Phase 2: 모드 판정 순수 함수

### Task 2.1: `publish-mode.js` 판정 함수 테스트

**Files:**
- Test: `tests/unit/generate/publish-mode.test.js` (Create)

- [ ] **Step 1: 실패 테스트 작성**

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { PUBLISH_MODES, resolvePublishMode } = require('../../../scripts/newsroom/generate/publish-mode');

function summary(overrides = {}) {
  return {
    direct_aosp_camera_count: 0,
    camera_driver_image_pipeline_count: 0,
    android_platform_camera_adjacent_count: 0,
    android_multimedia_camera_output_count: 0,
    soc_platform_signal_count: 0,
    cpp_ai_tooling_fallback_count: 0,
    ...overrides
  };
}

test('core >= 1 yields DEEP', () => {
  const r = resolvePublishMode(summary({ direct_aosp_camera_count: 1 }), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.DEEP);
  assert.equal(r.core_count, 1);
});

test('driver core counts toward DEEP', () => {
  const r = resolvePublishMode(summary({ camera_driver_image_pipeline_count: 2 }), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.DEEP);
});

test('core 0 with adjacent/context >= threshold yields CONTEXT', () => {
  const r = resolvePublishMode(summary({ soc_platform_signal_count: 1 }), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.CONTEXT);
});

test('core 0 and below threshold yields QUIET', () => {
  const r = resolvePublishMode(summary(), { contextMinSignals: 1 });
  assert.equal(r.mode, PUBLISH_MODES.QUIET);
});

test('core 0 with adjacent below higher threshold yields QUIET', () => {
  const r = resolvePublishMode(summary({ soc_platform_signal_count: 1 }), { contextMinSignals: 2 });
  assert.equal(r.mode, PUBLISH_MODES.QUIET);
});

test('result records counts for traceability', () => {
  const r = resolvePublishMode(summary({ android_platform_camera_adjacent_count: 1, cpp_ai_tooling_fallback_count: 1 }), { contextMinSignals: 1 });
  assert.equal(r.core_count, 0);
  assert.equal(r.adjacent_count, 1);
  assert.equal(r.context_count, 1);
  assert.equal(r.mode, PUBLISH_MODES.CONTEXT);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/generate/publish-mode.test.js`
Expected: FAIL — Cannot find module `publish-mode`

### Task 2.2: `publish-mode.js` 구현

**Files:**
- Create: `scripts/newsroom/generate/publish-mode.js`

- [ ] **Step 1: 구현 작성**

```javascript
'use strict';

const PUBLISH_MODES = {
  DEEP: 'DEEP',
  CONTEXT: 'CONTEXT',
  QUIET: 'QUIET'
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// 결정론적 발행 모드 판정. compositionSummary 카운트만 입력으로 사용한다.
// CLAUDE.md 원칙: LLM이 아니라 코드가 모드를 고른다.
function resolvePublishMode(compositionSummary = {}, publishModePolicy = {}) {
  const contextMinSignals = Number.isInteger(publishModePolicy.contextMinSignals)
    ? publishModePolicy.contextMinSignals
    : 1;

  const coreCount =
    num(compositionSummary.direct_aosp_camera_count) +
    num(compositionSummary.camera_driver_image_pipeline_count);
  const adjacentCount =
    num(compositionSummary.android_platform_camera_adjacent_count) +
    num(compositionSummary.android_multimedia_camera_output_count);
  const contextCount =
    num(compositionSummary.soc_platform_signal_count) +
    num(compositionSummary.cpp_ai_tooling_fallback_count);

  let mode;
  if (coreCount >= 1) {
    mode = PUBLISH_MODES.DEEP;
  } else if (adjacentCount + contextCount >= contextMinSignals) {
    mode = PUBLISH_MODES.CONTEXT;
  } else {
    mode = PUBLISH_MODES.QUIET;
  }

  return {
    mode,
    core_count: coreCount,
    adjacent_count: adjacentCount,
    context_count: contextCount,
    context_min_signals: contextMinSignals
  };
}

module.exports = {
  PUBLISH_MODES,
  resolvePublishMode
};
```

- [ ] **Step 2: 테스트 통과**

Run: `node --test tests/unit/generate/publish-mode.test.js`
Expected: PASS (6 tests)

- [ ] **Step 3: Commit**

```bash
git add scripts/newsroom/generate/publish-mode.js tests/unit/generate/publish-mode.test.js
git commit -m "feat(generate): add deterministic publish mode resolver"
```

---

## Phase 3: selection report에 모드 배선

### Task 3.1: `buildShortlistReport`가 `publish_mode`를 산출하는 테스트

**Files:**
- Test: `tests/contract/publish-mode-selection.test.js` (Create)

- [ ] **Step 1: 실패 테스트 작성**

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport } = require('../../scripts/newsroom/generate/newsroom-selection');
const { PUBLISH_MODES } = require('../../scripts/newsroom/generate/publish-mode');

// 빈 후보 풀 → 발행 신호 없음 → QUIET
test('empty candidate pool resolves to QUIET publish mode', () => {
  const report = buildShortlistReport('2026-05-31', { candidates: [] });
  assert.equal(report.publish_mode, PUBLISH_MODES.QUIET);
  assert.ok(report.publish_mode_detail);
  assert.equal(report.publish_mode_detail.core_count, 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/contract/publish-mode-selection.test.js`
Expected: FAIL — `report.publish_mode` is undefined

### Task 3.2: `buildShortlistReport`에 모드 배선

**Files:**
- Modify: `scripts/newsroom/generate/newsroom-selection.js`

- [ ] **Step 1: import 추가**

파일 상단 require 블록에 추가:

```javascript
const { PUBLISH_MODES, resolvePublishMode } = require('./publish-mode');
const { getPublishModePolicy } = require('../common/newsletter-policy');
```

(`getPublishModePolicy`가 이미 다른 라인에서 import되면 중복 추가하지 말 것.)

- [ ] **Step 2: report 객체에 모드 필드 추가**

`buildShortlistReport` 내부에서 `composition`/`mode`가 이미 계산되어 있다 (`const composition = compositionSummary(selected);` 라인 1484, `const mode = compositionMode(selected, errors);` 라인 1493). 라인 1497 `const publishGatePassed = ...` 다음 줄에 추가:

```javascript
  const publishModeResult = resolvePublishMode(composition, getPublishModePolicy());
```

그리고 report return 객체의 `composition_reason: compositionReason(mode, composition),` (라인 1540) 다음 줄에 추가:

```javascript
    publish_mode: publishModeResult.mode,
    publish_mode_detail: publishModeResult,
```

> 참고: 이 report 객체가 CLI에서 `report`(=`shortlistReport`)로 그대로 쓰이므로 별도 diagnostics 동기화는 불필요하다. CLI의 `selectionStatusExtra`(라인 478 부근)가 `report.publish_mode`를 읽을 수 있으면 충분하다. 단, `selectionStatusExtra`가 반환하는 진단 객체에도 `publish_mode: report.publish_mode ?? diagnostics.publish_mode ?? null` 한 줄을 추가해 generation-status까지 전파되게 한다.

- [ ] **Step 3: 테스트 통과**

Run: `node --test tests/contract/publish-mode-selection.test.js`
Expected: PASS

- [ ] **Step 4: 전체 selection 테스트 회귀 확인**

Run: `node --test tests/contract/selection-publish-ready-composition.test.js tests/contract/selection-fixture-regression.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/generate/newsroom-selection.js tests/contract/publish-mode-selection.test.js
git commit -m "feat(generate): wire publish_mode into shortlist report"
```

---

## Phase 4: 모드별 게이트 분기

### Task 4.1: CONTEXT/QUIET 모드에서 group coverage 면제 테스트

**Files:**
- Test: `tests/contract/publish-mode-group-coverage.test.js` (Create)

- [ ] **Step 1: 실패 테스트 작성**

이 테스트는 run 26710089998 시나리오(선택 그룹 2개 중 1개만 렌더)를 재현한다. DEEP에서는 실패, CONTEXT에서는 통과해야 한다.

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateEditorOutputContract
} = require('../../scripts/newsroom/validate/editor-output-contract');

// 헬퍼: 선택 그룹 2개, 렌더 1개인 최소 editor/reporter 쌍을 만든다.
// 기존 editor-semantic-repair.test.js의 픽스처 패턴을 따른다.
const { buildGroupCoverageFixture } = require('../helpers/editor-builders');

test('DEEP mode rejects missing selected group (current behavior)', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  assert.throws(
    () => validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'DEEP' }),
    /selected group coverage/
  );
});

test('CONTEXT mode does not require every selected group to render', () => {
  const { editor, reporter } = buildGroupCoverageFixture();
  assert.doesNotThrow(
    () => validateEditorOutputContract(editor, '2026-05-31', { reporter, publishMode: 'CONTEXT' })
  );
});
```

- [ ] **Step 2: 헬퍼 확인/작성**

Run: `ls tests/helpers/ | grep -i editor`
기존 헬퍼가 있으면 `buildGroupCoverageFixture`를 거기 추가. 없으면 `tests/helpers/editor-builders.js`를 만들어 최소 픽스처를 export한다. 픽스처는: reporter에 selected 후보 2개(서로 다른 `article_group_key`), editor.sections에는 그중 1개만 포함하고, claim/source 등 다른 게이트는 통과하도록 구성한다. (기존 `editor-semantic-repair.test.js`에서 통과하는 단일 섹션 픽스처를 복사해 group_key만 부여)

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/contract/publish-mode-group-coverage.test.js`
Expected: FAIL — CONTEXT 케이스가 throw (아직 모드 미인식)

### Task 4.2: `validateSelectedGroupCoverage` 모드 인식

**Files:**
- Modify: `scripts/newsroom/validate/editor-output-contract.js`

- [ ] **Step 1: `validateEditorOutputContract`가 publishMode를 전달**

라인 1053의 호출을 변경:

```javascript
  validateSelectedGroupCoverage(value, reporter, options.publishMode);
```

- [ ] **Step 2: `validateSelectedGroupCoverage` 시그니처 + 면제 로직**

라인 888 함수 시그니처를 변경:

```javascript
function validateSelectedGroupCoverage(value, reporter = {}, publishMode = 'DEEP') {
```

함수 본문에서 `selectedGroupKeys.length === 0` early-return 직후에 모드 면제 분기를 추가한다:

```javascript
  // CONTEXT/QUIET 모드는 "선택된 모든 그룹이 메인 섹션으로 렌더링되어야 한다"를 요구하지 않는다.
  // 코어 기사가 없는 날의 정직한 발행을 허용하기 위함. 근거/출처 게이트는 별도로 유지된다.
  if (publishMode === 'CONTEXT' || publishMode === 'QUIET') {
    return null;
  }
```

(이 분기는 `selectedGroupKeys`를 계산한 이후, coverage 검증 throw 이전 어디든 가능하나, 불필요한 연산을 줄이려면 early-return 위치 직후가 적절하다.)

- [ ] **Step 3: 테스트 통과**

Run: `node --test tests/contract/publish-mode-group-coverage.test.js`
Expected: PASS (2 tests)

- [ ] **Step 4: 기존 editor 계약 테스트 회귀 확인**

Run: `node --test tests/contract/editor-semantic-repair.test.js tests/contract/editor-claim-binding.test.js tests/contract/editor-public-article-contract.test.js`
Expected: PASS (publishMode 미지정 시 기본 'DEEP'이라 기존 동작 보존)

- [ ] **Step 5: Commit**

```bash
git add scripts/newsroom/validate/editor-output-contract.js tests/contract/publish-mode-group-coverage.test.js tests/helpers/editor-builders.js
git commit -m "feat(validate): exempt CONTEXT/QUIET modes from selected-group coverage"
```

---

## Phase 5: CLI 프롬프트 분기 + 상태 기록 + 렌더링

### Task 5.1: CLI가 publishMode를 editor 검증에 전달

**Files:**
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

- [ ] **Step 1: 모드 추출**

`buildShortlistReport` 결과(`generationRunState.shortlistReport` 또는 동등 변수)에서 모드를 읽는 헬퍼를 main 흐름에 추가:

```javascript
  const publishMode = (generationRunState.shortlistReport &&
    generationRunState.shortlistReport.publish_mode) || 'QUIET';
```

(정확한 변수명은 `grep -n "shortlistReport\|buildShortlistReport" scripts/newsroom/cli/gemini-newsroom-newsletter.js`로 확인)

- [ ] **Step 2: `validateOrRepairEditor` / `validateEditorOutputContract` 호출에 publishMode 주입**

`grep -n "validateEditorOutputContract\|validateOrRepairEditor\|requireStoryContract\|strictClaims" scripts/newsroom/cli/gemini-newsroom-newsletter.js` 로 모든 호출부를 찾아 options에 `publishMode` 를 추가한다. (validateOrRepairEditor 내부의 `validate` 클로저가 options를 전달하므로, 그 options에도 publishMode 포함)

- [ ] **Step 3: 회귀 테스트**

Run: `npm run test 2>&1 | tail -10`
Expected: PASS (#467 테스트 제외, Phase 6에서 정리)

- [ ] **Step 4: Commit**

```bash
git add scripts/newsroom/cli/gemini-newsroom-newsletter.js
git commit -m "feat(cli): pass publish mode into editor validation"
```

### Task 5.2: `generation-status.json`에 모드 기록

**Files:**
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

- [ ] **Step 1: 상태 객체에 필드 추가**

`generation-status.json`을 쓰는 지점(`grep -n "generation-status\|status.*=.*{\|writeJson.*generation" scripts/newsroom/cli/gemini-newsroom-newsletter.js`로 확인)에서, 상태 객체에 추가:

```javascript
    publish_mode: publishMode,
    publish_mode_detail: (generationRunState.shortlistReport &&
      generationRunState.shortlistReport.publish_mode_detail) || null,
```

- [ ] **Step 2: 수동 스모크 — 코어 0건 입력으로 모드 확인**

Run: 기존 픽스처나 최근 `content/collected-news/<date>/merged-candidates.json`을 입력으로 generate를 dry하게 돌릴 수 있으면 실행. 어려우면 selection 단위로 확인:

```bash
node -e "const {buildShortlistReport}=require('./scripts/newsroom/generate/newsroom-selection'); const r=buildShortlistReport('2026-05-31',{candidates:[]}); console.log(r.publish_mode, JSON.stringify(r.publish_mode_detail));"
```
Expected: `QUIET {...core_count:0...}`

- [ ] **Step 3: Commit**

```bash
git add scripts/newsroom/cli/gemini-newsroom-newsletter.js
git commit -m "feat(cli): record publish mode in generation status"
```

### Task 5.3: CONTEXT/QUIET 모드 프롬프트 분기

**Files:**
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

- [ ] **Step 1: editor system 프롬프트에 모드별 지시 주입**

editor 프롬프트를 구성하는 배열(라인 3672 부근, `'schema와 일치하는 JSON만 반환하세요.'` 가 있는 곳)에서, publishMode에 따라 다른 지시를 조건부로 추가한다:

```javascript
        publishMode === 'CONTEXT' ? [
          '이번 발행은 CONTEXT 모드입니다. 카메라 코어 직접 변경 기사가 없으므로, 메인 기사를 억지로 만들지 마세요.',
          '"이번 기간 카메라 코어는 조용했습니다"를 명시하고, SoC/도구/표준 변화가 Camera HAL/driver/검증 워크플로우에 왜·어떻게 닿는지 실무 레이더 관점으로 정리하세요.',
          '근거 없는 단정을 금지합니다. "~한 검증 포인트를 점검할 만하다"처럼 검증 가능한 행동으로 연결하세요.',
          'editorial-policy.md의 해석 기준(stream/buffer/metadata/request/result, CTS/VTS/Camera ITS, thermal/latency/frame drop/memory/contention)으로 relevance를 설명하세요.'
        ].join('\n') : '',
        publishMode === 'QUIET' ? [
          '이번 발행은 QUIET 모드입니다. 발행할 만한 신호가 빈약합니다.',
          '3줄 브리핑과 "다음 관전 포인트"만 간결하게 작성하고, 메인 기사를 만들지 마세요.'
        ].join('\n') : '',
```

(배열 마지막 `.filter(Boolean).join('\n')` 가 이미 빈 문자열을 거르므로 조건부 빈 문자열은 안전하다.)

- [ ] **Step 2: 회귀 테스트 + 프롬프트 가드레일 테스트**

Run: `node --test tests/contract/editor-prompt-guardrails.test.js tests/contract/prompt-contract.test.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/newsroom/cli/gemini-newsroom-newsletter.js
git commit -m "feat(cli): branch editor prompt by publish mode"
```

### Task 5.4: 렌더링 — CONTEXT/QUIET 형식

**Files:**
- Modify: `scripts/newsroom/render/` (정확한 파일은 Step 1에서 확인)

- [ ] **Step 1: 렌더러 진입점 확인**

Run: `grep -rn "이번 주 3줄 브리핑\|## 참고자료\|function render" scripts/newsroom/render/ | head`
브리핑/섹션/참고자료를 조립하는 함수를 찾는다.

- [ ] **Step 2: QUIET 모드 렌더 분기 테스트**

**Test:** `tests/unit/render/publish-mode-render.test.js` (Create)

```javascript
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

// 렌더러 export 이름은 Step 1에서 확인한 실제 이름으로 교체
const { renderNewsletterMarkdown } = require('../../../scripts/newsroom/render/newsletter-markdown');

test('QUIET mode renders briefing and watch points without main sections', () => {
  const issue = {
    date: '2026-05-31',
    publish_mode: 'QUIET',
    briefing: ['신호 1', '신호 2', '신호 3'],
    watch_points: ['다음 CameraX 릴리스 주목'],
    sections: []
  };
  const md = renderNewsletterMarkdown(issue);
  assert.match(md, /3줄 브리핑/);
  assert.match(md, /관전 포인트|주목/);
  assert.doesNotMatch(md, /## 2\./); // 메인 기사 섹션 없음
});
```

> 정확한 렌더 함수명/입력 schema는 Step 1 결과로 교체할 것. 이름이 다르면 테스트의 require/필드명을 실제에 맞춘다.

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/unit/render/publish-mode-render.test.js`
Expected: FAIL

- [ ] **Step 4: 렌더러에 모드 분기 구현**

렌더 함수에서 `issue.publish_mode === 'QUIET'`이면 브리핑 + 관전 포인트만, `'CONTEXT'`이면 "코어 조용" 한 줄 + 맥락 섹션 + 관전 포인트를 렌더하도록 분기한다. DEEP/미지정은 기존 경로 유지.

- [ ] **Step 5: 테스트 통과 + 렌더 회귀**

Run: `node --test tests/unit/render/publish-mode-render.test.js tests/contract/newsletter-renderer.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/newsroom/render/ tests/unit/render/publish-mode-render.test.js
git commit -m "feat(render): add CONTEXT/QUIET publish mode layouts"
```

---

## Phase 6: PR #467 승격 로직 제거

CONTEXT 모드가 동작 검증된 뒤 잔재를 제거한다. 각 Task 후 `npm run test`로 회귀 확인.

### Task 6.1: #467 전용 테스트 삭제

**Files:**
- Delete: `tests/contract/cpp-fallback-camera-dev-promotion-flow.test.js`
- Delete: `tests/unit/common/camera-dev-workflow-relevance.test.js`
- Delete: `tests/unit/llm-response/source-discovery-camera-dev-relevance.test.js`

- [ ] **Step 1: 삭제**

```bash
git rm tests/contract/cpp-fallback-camera-dev-promotion-flow.test.js tests/unit/common/camera-dev-workflow-relevance.test.js tests/unit/llm-response/source-discovery-camera-dev-relevance.test.js
```

- [ ] **Step 2: Commit**

```bash
git commit -m "test: remove cpp_fallback camera-dev promotion tests"
```

### Task 6.2: `camera_dev_workflow_relevance` 배선 제거

**Files:**
- Modify: `scripts/newsroom/collect/gemini-source-discovery.js`
- Modify: `scripts/newsroom/generate/article-capsules.js`
- Modify: `scripts/newsroom/render/newsletter-schema.js`
- Modify: `scripts/newsroom/domain/aosp-camera-scope.js`
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
- Modify: `scripts/newsroom/cli/collect-news-candidates.js`
- Modify: `scripts/newsroom/validate/newsletter-quality.js`
- Modify: `scripts/newsroom/generate/newsroom-selection.js`

- [ ] **Step 1: 전 배선 위치 확인**

Run: `grep -rn "camera_dev_workflow_relevance\|cpp_fallback_camera_dev_relevant_count\|detectCameraDevWorkflowRelevanceDeterministic\|cameraDevWorkflowRelevance" scripts/`

- [ ] **Step 2: 파일별 제거**

각 파일에서 위 grep이 가리키는 라인을 제거한다. 기준:
- `gemini-source-discovery.js`: `proposalResponseSchema`의 `camera_dev_workflow_relevance*` 필드, `normalizeProposalPayload`·`parserBackedCandidate`의 해당 필드 제거.
- `aosp-camera-scope.js`: `detectCameraDevWorkflowRelevanceDeterministic` 함수, 패턴 상수, `classifyAospCameraStackCandidate`의 부착부, exports 제거.
- `article-capsules.js`: 캡슐의 `camera_dev_workflow_relevance*` 조건부 스프레드 제거.
- `newsletter-schema.js`: `reporterCandidate`의 두 필드 제거.
- `gemini-newsroom-newsletter.js`: `validateReporter`의 relevance 병합 블록, reporter 프롬프트의 relevance 지시문, `selectionStatusExtra`의 `cppFallbackCameraDevRelevantCount` 참조 제거.
- `collect-news-candidates.js`: `normalizeCandidate`의 `hasCameraDevWorkflowRelevance` 분기를 원래의 무조건 supporting 강등으로 복원.
- `newsletter-quality.js`: `candidateMetadataForBinding`·`sectionCountDetail`·`buildNewsletterQualityReport`의 relevance 분기 제거, supporting 카운트를 원형 복원.
- `newsroom-selection.js`: Phase 1에서 `0`으로 임시화한 `cpp_fallback_camera_dev_relevant_count`를 완전 제거, `compositionSummary`/`reviewCompositionGatePasses`/`publishReadyGateReasonSummary`/`hasSelectableScope`를 #467 이전 형태로 복원.

- [ ] **Step 3: 잔존 참조 0 확인**

Run: `grep -rn "camera_dev_workflow_relevance\|cpp_fallback_camera_dev_relevant_count\|detectCameraDevWorkflowRelevanceDeterministic" scripts/`
Expected: 출력 없음

- [ ] **Step 4: 전체 테스트**

Run: `npm run test`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "refactor(newsroom): remove camera_dev_workflow_relevance wiring"
```

### Task 6.3: `dropDecisionMetadataMustFix` 제거

**Files:**
- Modify: `scripts/newsroom/common/fact-check-repair.js`
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

- [ ] **Step 1: 호출부 제거**

`gemini-newsroom-newsletter.js`에서 `({ factCheck } = dropDecisionMetadataMustFix(factCheck));` 두 곳(첫 시도/재시도)과 import를 제거.

- [ ] **Step 2: 함수 제거**

`fact-check-repair.js`에서 `dropDecisionMetadataMustFix`, `itemIsDecisionMetadataMustFix`, `DECISION_METADATA_FIELD_PATTERN` 및 exports 항목 제거.

- [ ] **Step 3: 잔존 참조 확인**

Run: `grep -rn "dropDecisionMetadataMustFix\|DECISION_METADATA_FIELD_PATTERN" scripts/ tests/`
Expected: 출력 없음

- [ ] **Step 4: 테스트**

Run: `npm run test`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "refactor(newsroom): remove dropDecisionMetadataMustFix safety filter"
```

### Task 6.4: 정책 문서에서 #467 섹션 제거 + 발행 모드 문서화

**Files:**
- Modify: `docs/editorial-policy.md`

- [ ] **Step 1: #467 섹션 제거**

라인 75·85 부근의 `### cpp_ai_tooling_fallback 메인 기사 자격 — camera_dev_workflow_relevance` 및 `### cpp_ai_tooling_fallback 메인 기사 자격 — 활성화 절차` 두 섹션 전체를 삭제.

- [ ] **Step 2: 발행 모드 섹션 추가**

"기사 구성" 섹션 부근에 발행 모드 설명을 추가:

```markdown
## 발행 모드 (DEEP / CONTEXT / QUIET)

발행 형식은 그날 수집된 카메라 신호량에 따라 결정론적으로 결정됩니다. 판정 임계값은 `config/newsletter-policy.json`의 `publishModePolicy`를 따릅니다.

- DEEP: 카메라 코어(direct_aosp_camera / camera_driver_image_pipeline) 후보가 1건 이상이면 메인 기사 중심으로 깊게 다룹니다.
- CONTEXT: 코어가 없지만 인접/SoC/도구 신호가 임계 이상이면, 메인 기사를 강요하지 않고 "실무 레이더" 관점의 맥락 브리핑으로 발행합니다.
- QUIET: 신호가 임계 미만이면 3줄 브리핑과 다음 관전 포인트만 간결하게 발행합니다.

CONTEXT/QUIET 모드에서도 근거·출처 규칙은 동일하게 적용됩니다. 모드는 발행 형식을 바꿀 뿐 품질 게이트를 낮추지 않습니다.
```

- [ ] **Step 3: 정책 문서 동기화 검사**

Run: `npm run sync:policy-docs && npm run check:policy-docs`
Expected: 통과 (또는 변경 사항 반영 후 통과)

- [ ] **Step 4: Commit**

```bash
git add docs/editorial-policy.md README.md
git commit -m "docs: replace cpp_fallback promotion section with publish mode policy"
```

---

## Phase 7: DEEP 모드 보강

### Task 7.1: editor 프롬프트에 claim 규칙 명시

**Files:**
- Modify: `scripts/newsroom/cli/gemini-newsroom-newsletter.js`

- [ ] **Step 1: DEEP 프롬프트에 규칙 추가**

editor 프롬프트 배열에 추가 (DEEP일 때만 또는 공통):

```javascript
        '각 기사의 article_sections.verified_facts 모든 항목은 대응하는 claim_type=fact claim으로 binding되어야 합니다. fact 항목 수보다 적은 수의 fact claim을 만들지 마세요.',
```

- [ ] **Step 2: 가드레일 테스트 회귀**

Run: `node --test tests/contract/editor-prompt-guardrails.test.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/newsroom/cli/gemini-newsroom-newsletter.js
git commit -m "feat(cli): require fact claims to cover verified_facts in editor prompt"
```

### Task 7.2: repair 패스가 selected group을 보존하는지 검증

**Files:**
- Test: `tests/contract/editor-semantic-repair.test.js` (Modify — 케이스 추가)
- Modify: `scripts/newsroom/validate/editor-output-contract.js` (필요 시)

- [ ] **Step 1: repair가 섹션을 누락하면 실패하는 테스트 추가**

`editor-semantic-repair.test.js`에 케이스 추가: claim binding 실패를 repair할 때, repair 결과가 selected group 중 하나를 누락하면(섹션 삭제) DEEP 모드에서 repair가 실패로 처리되어야 한다. (현재는 group_coverage 재검증에서 잡히지만, repair 함수가 섹션 보존을 명시적으로 강제하는지 확인)

```javascript
test('DEEP repair must not drop a selected group while fixing claims', async () => {
  // claim binding 실패 + repairFn이 섹션을 1개로 줄이는 시나리오
  // 기대: 최종적으로 selected group coverage 실패로 repairSucceeded=false
  // (정확한 픽스처는 기존 repair 테스트 패턴을 따른다)
});
```

- [ ] **Step 2: 실패/통과 확인 후 필요 시 보강**

Run: `node --test tests/contract/editor-semantic-repair.test.js`
현재 동작으로 이미 잡히면(Phase 4 게이트가 DEEP에서 유지) 테스트는 PASS. 만약 repair가 group coverage 재검증을 우회하면, `repairEditorOutputContract`의 재검증 경로(라인 1370 `validate(repairedForValidation)`)가 publishMode='DEEP'로 group coverage를 다시 검사하도록 보강한다.

- [ ] **Step 3: 전체 테스트**

Run: `npm run test && npm run validate`
Expected: 전체 PASS

- [ ] **Step 4: Commit**

```bash
git add tests/contract/editor-semantic-repair.test.js scripts/newsroom/validate/editor-output-contract.js
git commit -m "test(validate): guard DEEP repair against dropping selected groups"
```

---

## 최종 검증

- [ ] **전체 게이트**

Run: `npm run test && npm run validate`
Expected: 전체 PASS

- [ ] **코어 0건 시나리오 — CONTEXT/QUIET 발행 확인**

run 26710089998의 입력(`content/collected-news/2026-05-31/merged-candidates.json`)을 재현 입력으로 generate를 돌릴 수 있으면 실행하여 exit 0과 모드를 확인. 어려우면 selection 단위 스모크로 모드만 확인.

- [ ] **#467 잔재 0 확인**

Run: `grep -rn "camera_dev_workflow_relevance\|cppFallbackMainPromotion\|dropDecisionMetadataMustFix" scripts/ tests/ config/ docs/`
Expected: 출력 없음

---

## Self-Review 결과 (작성자 기록)

- 스펙 컴포넌트 1(모드 판정)→Phase 2/3, 2(정책 config)→Phase 1, 3(게이트 분기)→Phase 4, 4(CONTEXT 콘텐츠)→Phase 5.3/5.4, 5(#467 제거)→Phase 6, 단기 fail 흡수(①②③)→Phase 0/7. 모든 컴포넌트가 Task로 매핑됨.
- 타입 일관성: `resolvePublishMode`는 `{mode, core_count, adjacent_count, context_count, context_min_signals}` 반환, report 필드명 `publish_mode`/`publish_mode_detail`, validate 옵션 `publishMode`로 전 Phase 일관.
- 알려진 의존성 위험: Phase 1 Step 9~10에서 #467 import 임시 처리 → Phase 6에서 완전 제거. 실행 시 Phase 1 전체 테스트가 #467 테스트 때문에 막히면 Task 6.1을 Phase 1 직후로 당겨 수행한다(플랜 내 명시됨).
- 렌더러 함수명/입력 schema는 Phase 5.4 Step 1에서 실제 확인 후 테스트의 require/필드명을 맞추도록 명시(코드베이스 미확인 영역의 유일한 변수).
