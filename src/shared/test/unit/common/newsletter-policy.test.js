const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  getDeepDivePolicy,
  getDefaultNewsletterPolicy,
  getHeadlinePolicy,
  loadNewsletterPolicy,
  readPolicyConfig,
  renderNewsletterPolicyBlock,
  validateNewsletterPolicyConfig
} = require('../../../common/newsletter-policy');

function policyClone() {
  return JSON.parse(JSON.stringify(readPolicyConfig()));
}

function tempPolicyFile(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-policy-'));
  const filePath = path.join(dir, 'newsletter-policy.json');
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

test('headlinePolicy is required and validates enum, range, integer, and boolean fields', () => {
  const missing = policyClone();
  delete missing.headlinePolicy;
  const invalid = policyClone();
  invalid.headlinePolicy = {
    decayModel: 'exponential',
    decayRatePerDay: -1,
    replacementMargin: 1.5,
    minimumHeadlineScore: -1,
    latestInclusionRequired: 'yes',
    historyMaxEntries: 0
  };

  assert.equal(validateNewsletterPolicyConfig(missing).ok, false);
  const result = validateNewsletterPolicyConfig(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.includes('headlinePolicy.decayModel')));
  assert.ok(result.errors.some(error => error.includes('headlinePolicy.decayRatePerDay')));
  assert.ok(result.errors.some(error => error.includes('headlinePolicy.replacementMargin')));
  assert.ok(result.errors.some(error => error.includes('headlinePolicy.minimumHeadlineScore')));
  assert.ok(result.errors.some(error => error.includes('headlinePolicy.latestInclusionRequired')));
  assert.ok(result.errors.some(error => error.includes('headlinePolicy.historyMaxEntries')));
});

test('getHeadlinePolicy returns normalized immutable policy', () => {
  const policy = getDefaultNewsletterPolicy();
  const headlinePolicy = getHeadlinePolicy(policy);

  assert.deepEqual(headlinePolicy, {
    decayModel: 'linear',
    decayRatePerDay: 2,
    replacementMargin: 5,
    minimumHeadlineScore: 40,
    latestInclusionRequired: true,
    historyMaxEntries: 50
  });
  assert.equal(Object.isFrozen(headlinePolicy), true);
});

test('loaded headlinePolicy is normalized from config file', () => {
  const config = policyClone();
  config.headlinePolicy.replacementMargin = 7;
  const loaded = loadNewsletterPolicy(tempPolicyFile(config));

  assert.equal(loaded.headlinePolicy.replacementMargin, 7);
  assert.equal(Object.isFrozen(loaded.headlinePolicy), true);
});

// 2026-08-03 회귀: 이 블록은 EDITORIAL_POLICY.md로 생성돼 editor prompt에 정본으로 들어간다.
// "주요 기사 하나만 담을 수 있습니다"라는 표현이 상한으로 읽혀 editor가 선정된 5개 그룹 중 4개를
// reason_code=one_article_policy로 강등했고(계약에 없는 코드) semantic validation이 발행을 막았다.
test('one-article policy reads as a minimum, never as an article-count ceiling', () => {
  const block = renderNewsletterPolicyBlock();

  assert.match(block, /단일 기사 정책\(one-article policy\): 완전히 발행 가능한 주요 기사가 하나뿐이어도 공개 발행할 수 있습니다/);
  assert.equal(/주요 기사 하나만 담을 수 있습니다/.test(block), false);
  assert.match(block, /기사 수 상한은 위의 주요 기사 수\(1-5\)를 그대로 따릅니다/);
});

// validateNewsletterPolicyConfig는 key별 whitelist라 검증을 붙이지 않은 key는 조용히 통과한다.
// 검증이 없으면 오타나 범위를 벗어난 값이 validate:policy를 지나가고, 발동 판정이 소리 없이 바뀐다.
test('deepDivePolicy activation threshold is validated, not silently accepted', () => {
  const missing = policyClone();
  delete missing.deepDivePolicy;
  const negative = policyClone();
  negative.deepDivePolicy = { directAospCameraMaxForActivation: -1 };
  const fractional = policyClone();
  fractional.deepDivePolicy = { directAospCameraMaxForActivation: 1.5 };
  const notAnObject = policyClone();
  notAnObject.deepDivePolicy = [];

  assert.equal(validateNewsletterPolicyConfig(missing).ok, true);

  for (const config of [negative, fractional]) {
    const result = validateNewsletterPolicyConfig(config);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.includes('deepDivePolicy.directAospCameraMaxForActivation')));
  }

  const shape = validateNewsletterPolicyConfig(notAnObject);
  assert.equal(shape.ok, false);
  assert.ok(shape.errors.some(error => error.includes('deepDivePolicy must be an object.')));
});

test('getDeepDivePolicy returns normalized immutable policy', () => {
  const deepDivePolicy = getDeepDivePolicy(getDefaultNewsletterPolicy());

  assert.deepEqual(deepDivePolicy, { directAospCameraMaxForActivation: 1 });
  assert.equal(Object.isFrozen(deepDivePolicy), true);
});

// 생성 블록이 이 값을 내보내지 않으면 check:policy-docs가 값의 변화를 아예 알지 못한다
// (문서 drift 게이트는 블록 안의 텍스트만 비교한다).
test('generated policy docs carry the deep-dive activation threshold', () => {
  const block = renderNewsletterPolicyBlock();

  assert.match(block, /`direct_aosp_camera` 버킷 수가 1 이하이면 심층 주제 큐에서 주제 하나를 고릅니다/);
});

// 79행과 같은 계열의 회귀 방지: 이 블록은 EDITORIAL_POLICY.md로 생성되고, 생성기가 그 문서 전문을
// 읽어 commonContext에 붙여 editorial-plan·editor·background-context·fact-check·judge·repair prompt로
// 보낸다(gemini-newsroom-newsletter.js -> buildPromptContexts). 심층 발동 조건은 발행이 끝난 뒤 도는
// 사후 판정인데, 렌더된 블록에서 이 줄은 direct_aosp_camera 버킷 수에 붙은 유일한 숫자다 — 실제
// 구성 하한 세 줄은 전부 "단일 기사 정책으로 비활성화됨"으로 렌더되기 때문이다. 그래서 이 문장이
// 상한처럼 읽히면 editor가 그 버킷 기사를 스스로 강등한다(2026-08-03에는 그렇게 4개가 강등돼
// 발행이 막혔다). 값은 정책에서 오되 문장은 상한으로 읽히면 안 된다.
test('deep-dive activation reads as a pipeline-internal condition, never as a bucket cap', () => {
  const deepDiveLine = renderNewsletterPolicyBlock()
    .split('\n')
    .find(line => line.includes('심층(deep-dive)'));

  assert.ok(deepDiveLine, '생성 블록에 심층 발동 조건 줄이 있어야 합니다.');
  assert.match(deepDiveLine, /파이프라인 내부 판정 — 편집 지시가 아닙니다/);
  assert.match(deepDiveLine, /이 숫자는 기사 수 상한도, 버킷 구성 제한도 아닙니다/);
  assert.match(deepDiveLine, /편집 단계에서는 이 항목을 고려하지 마세요/);
  // 상한으로 읽히는 표현이 이 줄에 다시 들어오면 실패한다.
  assert.equal(/버킷이 \d+건 이하인 주에만/.test(deepDiveLine), false);
  assert.equal(/최대 \d+개/.test(deepDiveLine), false);
  assert.equal(/이하로 유지/.test(deepDiveLine), false);
});

test('generated policy docs include headline policy summary', () => {
  const block = renderNewsletterPolicyBlock();

  assert.match(block, /홈페이지 헤드라인 정책\(homepage headline policy\): linear decay/);
  assert.match(block, /최소 헤드라인 점수\(minimum headline score\) 40/);
  assert.match(block, /이력 최대\(history max\) 50/);
});
