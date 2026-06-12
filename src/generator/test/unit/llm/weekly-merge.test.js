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
  const merged = { headline: 'CameraX combined', source_candidate_url: 'https://example.com/merged', sources: [{ url: 'https://example.com/merged' }] };
  const callLlmJson = async () => ({ decision: 'merge', mergedArticle: merged, reason: 'same topic' });
  const resolver = buildWeeklyMergeResolver({ callLlmJson, validateMergedArticle: () => ({ ok: true }) });
  const result = await resolveWeeklyArticles({
    existingArticles: [article('CameraX 1.6.0', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0')],
    incomingArticles: [article('CameraX 1.6.0 patch', 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1')],
    ...resolver
  });
  assert.ok(result.existingArticles.some(a => a.headline === 'CameraX combined'));
});
