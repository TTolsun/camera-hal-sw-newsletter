'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildWeeklyMergeResolver, WEEKLY_MERGE_RESPONSE_SCHEMA } = require('../../../editor/weekly-merge');
const { resolveWeeklyArticles } = require('../../../reporter/weekly-duplicate-merge');

function article(headline, url) {
  return { headline, source_candidate_url: url, sources: [{ url }] };
}

test('buildWeeklyMergeResolver returns an empty resolver when no LLM client is supplied', () => {
  assert.deepEqual(buildWeeklyMergeResolver({}), {});
});

test('buildWeeklyMergeResolver calls the LLM with both articles and the decision schema', async () => {
  const calls = [];
  const callLlmJson = async (stage, system, prompt, schema) => {
    calls.push({ stage, system, prompt, schema });
    return { decision: 'append', reason: 'distinct versions' };
  };
  const { mergeDuplicate } = buildWeeklyMergeResolver({ callLlmJson });
  const outcome = await mergeDuplicate({
    existing: article('CameraX 1.6.0', 'https://example.com/a'),
    incoming: article('CameraX 1.7.0', 'https://example.com/b'),
    reason: 'same_source_page'
  });
  assert.equal(outcome.decision, 'append');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].stage, 'weekly-merge');
  assert.equal(calls[0].schema, WEEKLY_MERGE_RESPONSE_SCHEMA);
  assert.match(calls[0].prompt, /existing_article/);
  assert.match(calls[0].prompt, /new_article/);
});

test('the resolver drives resolveWeeklyArticles end to end (merge + validate pass)', async () => {
  const merged = {
    headline: 'CameraX combined',
    source_candidate_url: 'https://example.com/merged',
    sources: [{ url: 'https://example.com/merged' }],
    public_article: { headline: 'CameraX combined' }
  };
  const callLlmJson = async () => ({ decision: 'merge', mergedArticle: merged, reason: 'same topic' });
  // #870: 검증기는 실제로 발행될 section과 병합 전 원본 두 기사를 함께 받아야 한다.
  // buildWeeklyMergeResolver가 검증기를 그대로 전달하는지까지 여기서 함께 확인한다 — 이 통로가
  // 끊기면 지어낸 출처를 가려낼 입력 자체가 사라진다.
  const seenArguments = [];
  const existing = article('CameraX 1.6.0', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0');
  const incoming = article('CameraX 1.6.0 patch', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
  const resolver = buildWeeklyMergeResolver({
    callLlmJson,
    validateMergedArticle: (mergedArticle, origins) => {
      seenArguments.push({ mergedArticle, origins });
      return { ok: true };
    }
  });
  const result = await resolveWeeklyArticles({
    existingArticles: [existing],
    incomingArticles: [incoming],
    ...resolver
  });
  const adopted = result.existingArticles[0];
  assert.equal(adopted.public_article.headline, 'CameraX combined');
  assert.equal(seenArguments.length, 1);
  // 검증기가 본 것과 실제로 채택된 것이 같은 객체여야 한다. 다르면 검증을 통과한 기사와
  // 발행되는 기사가 갈라진다.
  assert.equal(seenArguments[0].mergedArticle, adopted);
  assert.ok(seenArguments[0].origins, 'the validator must receive the pre-merge originals');
  assert.equal(seenArguments[0].origins.existing, existing);
  assert.equal(seenArguments[0].origins.incoming, incoming);
});
