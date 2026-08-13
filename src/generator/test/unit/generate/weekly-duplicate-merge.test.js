'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findWeeklyDuplicate,
  resolveWeeklyArticles
} = require('../../../reporter/weekly-duplicate-merge');

function article(headline, url, extra = {}) {
  return { headline, source_candidate_url: url, sources: [{ url }], ...extra };
}

test('findWeeklyDuplicate flags an exact same-URL article and reports exact=true', () => {
  const existing = [article('CameraX 1.7.0', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')];
  const dup = findWeeklyDuplicate(article('CameraX SessionConfig', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0'), existing);
  assert.ok(dup);
  assert.equal(dup.exact, true);
});

test('findWeeklyDuplicate returns null for an unrelated article', () => {
  const existing = [article('CameraX 1.7.0', 'https://example.com/a')];
  assert.equal(findWeeklyDuplicate(article('libcamera v0.7', 'https://example.com/b'), existing), null);
});

test('resolveWeeklyArticles appends a non-duplicate article', async () => {
  const result = await resolveWeeklyArticles({
    existingArticles: [article('A', 'https://example.com/a')],
    incomingArticles: [article('B', 'https://example.com/b')]
  });
  assert.deepEqual(result.existingArticles.map(a => a.headline), ['A']);
  assert.deepEqual(result.appendedArticles.map(a => a.headline), ['B']);
});

test('resolveWeeklyArticles skips an exact duplicate without an LLM', async () => {
  const url = 'https://example.com/same';
  const result = await resolveWeeklyArticles({
    existingArticles: [article('A', url)],
    incomingArticles: [article('A again', url)]
  });
  assert.equal(result.appendedArticles.length, 0);
  assert.equal(result.existingArticles.length, 1);
});

test('resolveWeeklyArticles keeps both near-duplicates when no LLM merge is provided', async () => {
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX 1.6.0 release', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0')],
    incomingArticles: [article('CameraX 1.7.0 release', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')]
  });
  assert.equal(result.appendedArticles.length, 1);
});

test('resolveWeeklyArticles applies an LLM merge decision and validates the merged article', async () => {
  const merged = article('CameraX combined', 'https://example.com/a', {
    public_article: { headline: 'CameraX combined' }
  });
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0')],
    incomingArticles: [article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')],
    mergeDuplicate: async () => ({ decision: 'merge', mergedArticle: merged, reason: 'same topic' }),
    validateMerged: () => ({ ok: true })
  });
  assert.ok(result.existingArticles.some(a => a.public_article && a.public_article.headline === 'CameraX combined'));
  assert.equal(result.appendedArticles.length, 0);
});

// #870 리뷰(MAJOR 2): 채택되는 section을 LLM 출력으로 통째로 갈아끼우면 두 방향으로 깨진다.
// 모델이 검증받지 않은 이미지 URL을 써넣거나(여기서는 selectedImage), 반대로 이미지 필드를
// 그냥 빠뜨려(resolvedImage) 기존 기사가 이미 해석해 둔 이미지를 잃는다. 산문 밖의 필드는
// 모델이 아니라 기존 기사에서 와야 한다.
test('resolveWeeklyArticles takes only the prose from the LLM merge output', async () => {
  const existing = article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0', {
    selectedImage: 'https://images.example/verified.png',
    resolvedImage: { url: 'https://images.example/verified.png' },
    relevance_bucket: 'camera_core'
  });
  const result = await resolveWeeklyArticles({
    existingArticles: [existing],
    incomingArticles: [article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')],
    mergeDuplicate: async () => ({
      decision: 'merge',
      reason: 'same topic',
      mergedArticle: {
        headline: 'CameraX combined',
        selectedImage: 'https://attacker.example/not-validated.png',
        relevance_bucket: 'fabricated',
        public_article: { headline: 'CameraX combined' }
      }
    }),
    validateMerged: () => ({ ok: true })
  });
  const adopted = result.existingArticles[0];
  assert.equal(adopted.public_article.headline, 'CameraX combined');
  assert.equal(adopted.selectedImage, 'https://images.example/verified.png');
  assert.deepEqual(adopted.resolvedImage, { url: 'https://images.example/verified.png' });
  assert.equal(adopted.relevance_bucket, 'camera_core');
});

// sources는 인용 가능 URL의 allow-list다. 모델이 이걸 쓰게 두면 allow-list를 스스로 넓혀
// 지어낸 URL을 인용할 수 있다. 두 원본의 합집합으로 결정론적으로 만든다.
test('resolveWeeklyArticles builds the merged sources from both origins, not from the LLM', async () => {
  const existingUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0';
  const incomingUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0';
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX alpha note', existingUrl)],
    incomingArticles: [article('CameraX alpha note update', incomingUrl)],
    mergeDuplicate: async () => ({
      decision: 'merge',
      reason: 'same topic',
      mergedArticle: {
        sources: [{ url: 'https://example.invalid/fabricated-evidence' }],
        public_article: { headline: 'CameraX combined' }
      }
    }),
    validateMerged: () => ({ ok: true })
  });
  assert.deepEqual(result.existingArticles[0].sources.map(source => source.url), [existingUrl, incomingUrl]);
});

test('resolveWeeklyArticles preserves the existing article when the merged article fails validation', async () => {
  const existing = article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0');
  const result = await resolveWeeklyArticles({
    existingArticles: [existing],
    incomingArticles: [article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')],
    mergeDuplicate: async () => ({ decision: 'merge', mergedArticle: article('bad', 'https://example.com/bad'), reason: 'x' }),
    validateMerged: () => ({ ok: false, reason: 'missing source evidence' })
  });
  assert.equal(result.existingArticles[0], existing);
  assert.equal(result.appendedArticles.length, 0);
  assert.ok(result.warnings.some(w => w.stage === 'validate'));
});

// #870: 검증기가 LLM 출력만 보면 지어낸 출처와 보존된 출처를 구분할 수 없다. 병합 전
// 원본 두 기사를 함께 넘기는 이 배선이 출처 보존 검사의 유일한 입력이다.
test('resolveWeeklyArticles hands the pre-merge originals to the validator', async () => {
  const existing = article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0');
  const incoming = article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0');
  const seenOrigins = [];
  await resolveWeeklyArticles({
    existingArticles: [existing],
    incomingArticles: [incoming],
    mergeDuplicate: async () => ({ decision: 'merge', mergedArticle: article('merged', 'https://example.com/merged'), reason: 'same topic' }),
    validateMerged: (mergedArticle, origins) => {
      seenOrigins.push(origins);
      return { ok: true };
    }
  });
  assert.equal(seenOrigins.length, 1);
  assert.ok(seenOrigins[0], 'validator must receive the pre-merge originals');
  assert.equal(seenOrigins[0].existing, existing);
  assert.equal(seenOrigins[0].incoming, incoming);
});

// 실패 사유가 weekly-merge-report.json에서 원인으로 읽혀야 한다.
test('resolveWeeklyArticles records the structured validation issues in the warning', async () => {
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0')],
    incomingArticles: [article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')],
    mergeDuplicate: async () => ({ decision: 'merge', mergedArticle: article('bad', 'https://example.com/bad'), reason: 'x' }),
    validateMerged: () => ({
      ok: false,
      reason: 'merged_article_source_not_in_origin',
      issues: [{ type: 'merged_article_source_not_in_origin', url: 'https://example.com/bad' }]
    })
  });
  const warning = result.warnings.find(item => item.stage === 'validate');
  assert.deepEqual(warning.issues.map(issue => issue.type), ['merged_article_source_not_in_origin']);
});

test('resolveWeeklyArticles honours an LLM reject decision', async () => {
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0')],
    incomingArticles: [article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')],
    mergeDuplicate: async () => ({ decision: 'reject', reason: 'no new information' })
  });
  assert.equal(result.appendedArticles.length, 0);
  assert.equal(result.existingArticles.length, 1);
});

test('resolveWeeklyArticles is fail-safe: an LLM error preserves existing and records a warning', async () => {
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX alpha note', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0')],
    incomingArticles: [article('CameraX alpha note update', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0')],
    mergeDuplicate: async () => { throw new Error('LLM unavailable'); }
  });
  assert.equal(result.appendedArticles.length, 0);
  assert.ok(result.warnings.some(w => w.stage === 'merge'));
});
