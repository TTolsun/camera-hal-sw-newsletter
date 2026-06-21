'use strict';

// #659: 축약된 evidence_id(#629)의 충돌 예산을 회귀로 고정한다.
// id 구조: sx:<후보16hex>:<섹션12hex>:<텍스트16hex> / le:<후보16hex>:<status>:<url16hex>:<텍스트16hex>.
// 바인딩 index와 capsule이 같은 구성 함수를 쓰므로, 서로 다른 입력은 서로 다른 id로,
// 같은 입력은 항상 같은 id로 나와야 한다(exact-string 일치가 바인딩의 전제). 이 속성이
// 깨지면 unknown_evidence_id 미바인딩이나 조용한 오바인딩이 생긴다.

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  stableSourceExtractionItemId,
  stableLinkedEvidenceItemId
} = require('../../../quality/claim-source-binding');

function candidateWithUrl(index) {
  return { url: `https://example.test/source-${index}/release-notes` };
}

test('stableSourceExtractionItemId is deterministic for identical inputs', () => {
  const candidate = candidateWithUrl(1);
  const first = stableSourceExtractionItemId(candidate, 'evidence_blocks', 'Camera HAL adds AF region metadata');
  const second = stableSourceExtractionItemId(candidate, 'evidence_blocks', 'Camera HAL adds AF region metadata');
  assert.equal(first, second);
});

test('stableSourceExtractionItemId: distinct section/text pairs do not collide for one candidate', () => {
  // 한 후보의 byId Map 안에서만 키가 되므로, 한 후보 내 (섹션 x 텍스트) 조합이 핵심 충돌면이다.
  const candidate = candidateWithUrl(7);
  const ids = new Set();
  let combos = 0;
  for (let s = 0; s < 60; s += 1) {
    for (let t = 0; t < 60; t += 1) {
      ids.add(stableSourceExtractionItemId(candidate, `section-key-${s}`, `evidence item text number ${t}`));
      combos += 1;
    }
  }
  assert.equal(combos, 3600);
  assert.equal(ids.size, combos, 'expected every distinct section/text pair to produce a distinct id');
});

test('stableSourceExtractionItemId: candidate hash distinguishes different candidates', () => {
  const ids = new Set();
  for (let c = 0; c < 200; c += 1) {
    ids.add(stableSourceExtractionItemId(candidateWithUrl(c), 'evidence_blocks', 'same section, same text'));
  }
  assert.equal(ids.size, 200, 'distinct source candidates must produce distinct id prefixes');
});

test('stableLinkedEvidenceItemId is deterministic and distinct across url/title/status', () => {
  const candidate = candidateWithUrl(3);
  const repeat = stableLinkedEvidenceItemId(candidate, { url: 'https://a.test/x', title: 'T', fetch_status: 'ok' });
  const repeatAgain = stableLinkedEvidenceItemId(candidate, { url: 'https://a.test/x', title: 'T', fetch_status: 'ok' });
  assert.equal(repeat, repeatAgain);

  const ids = new Set();
  let combos = 0;
  for (let u = 0; u < 40; u += 1) {
    for (let s = 0; s < 3; s += 1) {
      const status = ['ok', 'failed', 'unknown'][s];
      ids.add(stableLinkedEvidenceItemId(candidate, {
        url: `https://link.test/${u}`,
        title: `linked title ${u}`,
        fetch_status: status
      }));
      combos += 1;
    }
  }
  assert.equal(ids.size, combos, 'distinct linked-evidence (url, status) inputs must not collide');
});

test('source-extraction and linked-evidence ids never share the same namespace', () => {
  // 두 계열은 prefix(sx: vs le:)로 분리되므로 한 후보 안에서도 절대 충돌하지 않는다.
  const candidate = candidateWithUrl(9);
  const sx = stableSourceExtractionItemId(candidate, 'evidence_blocks', 'shared text');
  const le = stableLinkedEvidenceItemId(candidate, { url: 'https://link.test/shared', title: 'shared text' });
  assert.notEqual(sx, le);
  assert.match(sx, /^sx:/);
  assert.match(le, /^le:/);
});
