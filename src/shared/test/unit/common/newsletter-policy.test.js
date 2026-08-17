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

  assert.match(block, /심층\(deep-dive\) 발동 임계값: 위클리 최종 기사 중 `direct_aosp_camera` 버킷이 1건 이하/);
});

test('generated policy docs include headline policy summary', () => {
  const block = renderNewsletterPolicyBlock();

  assert.match(block, /홈페이지 헤드라인 정책\(homepage headline policy\): linear decay/);
  assert.match(block, /최소 헤드라인 점수\(minimum headline score\) 40/);
  assert.match(block, /이력 최대\(history max\) 50/);
});
