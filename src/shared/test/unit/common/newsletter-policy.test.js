const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
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

test('generated policy docs include headline policy summary', () => {
  const block = renderNewsletterPolicyBlock();

  assert.match(block, /홈페이지 헤드라인 정책\(homepage headline policy\): linear decay/);
  assert.match(block, /최소 헤드라인 점수\(minimum headline score\) 40/);
  assert.match(block, /이력 최대\(history max\) 50/);
});
