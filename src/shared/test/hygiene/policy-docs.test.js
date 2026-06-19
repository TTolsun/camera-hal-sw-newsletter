const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  POLICY_BLOCK_BEGIN,
  POLICY_BLOCK_END,
  analyzeNewsletterPolicyBlock,
  articleCountRangeText,
  getDefaultNewsletterPolicy,
  renderNewsletterPolicyBlock,
  replaceNewsletterPolicyBlock
} = require('../../common/newsletter-policy');
const {
  policyDocPaths,
  syncPolicyDocs
} = require('../../tooling/cli/sync-policy-docs');
const {
  tempRoot,
  writeText
} = require('../helpers/fs');

test('policy docs check reports missing markers', () => {
  const analysis = analyzeNewsletterPolicyBlock('No generated policy block here.');

  assert.equal(analysis.ok, false);
  assert.ok(analysis.errors.some(error => error.includes('missing BEGIN marker')));
  assert.ok(analysis.errors.some(error => error.includes('missing END marker')));
});

test('policy docs check reports duplicate and reversed markers', () => {
  const duplicate = analyzeNewsletterPolicyBlock([
    POLICY_BLOCK_BEGIN,
    POLICY_BLOCK_BEGIN,
    POLICY_BLOCK_END
  ].join('\n'));
  const reversed = analyzeNewsletterPolicyBlock([
    POLICY_BLOCK_END,
    POLICY_BLOCK_BEGIN
  ].join('\n'));

  assert.ok(duplicate.errors.some(error => error.includes('duplicate BEGIN marker')));
  assert.ok(reversed.errors.some(error => error.includes('marker order error')));
});

test('policy docs check reports generated block drift', () => {
  const drifted = renderNewsletterPolicyBlock().replace('뉴스레터 정책', '기사 구성 정책');
  const analysis = analyzeNewsletterPolicyBlock(drifted);

  assert.equal(analysis.ok, false);
  assert.ok(analysis.errors.some(error => error.includes('generated Newsletter Policy block drift')));
});

test('policy block rendering uses the injected policy article count range', () => {
  const defaultPolicy = getDefaultNewsletterPolicy();
  const customPolicy = {
    ...defaultPolicy,
    articlePolicy: {
      ...defaultPolicy.articlePolicy,
      mainArticleCount: { min: 11, max: 13 },
      primaryCameraStack: {
        ...defaultPolicy.articlePolicy.primaryCameraStack,
        minRequired: 1,
        buckets: [...defaultPolicy.articlePolicy.primaryCameraStack.buckets]
      },
      publishReadyComposition: {
        ...defaultPolicy.articlePolicy.publishReadyComposition,
        primaryCameraStackMinRequired: 2,
        directAospCameraOrDriverMinRequired: 1
      },
      supportingMainBuckets: [...defaultPolicy.articlePolicy.supportingMainBuckets],
      forbiddenMainBuckets: [...defaultPolicy.articlePolicy.forbiddenMainBuckets]
    },
    selectionWindowPolicy: {
      ...defaultPolicy.selectionWindowPolicy
    },
    qualityGatePolicy: {
      ...defaultPolicy.qualityGatePolicy,
      hardFailConditions: [...defaultPolicy.qualityGatePolicy.hardFailConditions]
    }
  };
  const rendered = renderNewsletterPolicyBlock(customPolicy);

  assert.match(rendered, /주요 기사 수: 11-13/);
  assert.match(rendered, /검토 게이트\(review gate\) Primary Camera Stack 기사: 최소 1개/);
  assert.match(rendered, /발행 가능\(publish-ready\) Primary Camera Stack 기사: 최소 2개/);
  assert.match(rendered, /선정 기간\(selection windows\): primary 7일; fallback 21일; reference 35일/);
  assert.match(rendered, /주요 선정은 강제 적용/);
  assert.doesNotMatch(rendered, /단일 기사 정책/);
  assert.doesNotMatch(rendered, new RegExp(`주요 기사 수: ${articleCountRangeText(defaultPolicy)}`));
});

test('policy docs sync inserts missing block and rejects malformed markers', () => {
  const inserted = replaceNewsletterPolicyBlock('Operator docs.');

  assert.ok(inserted.includes(POLICY_BLOCK_BEGIN));
  assert.ok(inserted.includes(POLICY_BLOCK_END));
  assert.throws(
    () => replaceNewsletterPolicyBlock([
      POLICY_BLOCK_BEGIN,
      POLICY_BLOCK_BEGIN,
      POLICY_BLOCK_END
    ].join('\n')),
    /duplicate BEGIN marker/
  );
});

test('policy docs check mode fails when representative docs are missing markers', () => {
  const root = tempRoot('policy-docs-check-');
  for (const relPath of policyDocPaths) {
    writeText(path.join(root, relPath), 'Current operating guidance.');
  }

  const result = syncPolicyDocs({ check: true, root });

  assert.equal(result.changed.length, 0);
  assert.equal(result.failures.length, policyDocPaths.length);
  assert.ok(result.failures.every(failure =>
    failure.errors.some(error => error.includes('missing BEGIN marker')) &&
    failure.errors.some(error => error.includes('missing END marker'))
  ));
});
