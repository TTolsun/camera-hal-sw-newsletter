'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collectFromSource } = require('../../../cli/collect-news-candidates');
const { parseAndroidDeveloperArticle, resolveAndroidDeveloperArticles } = require('../../../collect/android-developer-articles');
const { createBoundedFetchClient } = require('../../../collect/bounded-fetch-client');

const url = 'https://developer.android.com/blog/posts/model-for-developers';
const source = { id: 'android-developers-blog', name: 'Android Developers Blog',
  url: 'https://android-developers.googleblog.com/', rssUrl: 'https://android-developers.googleblog.com/feed',
  category: 'android', reliability: 'official', priority: 'high', keywords: [],
  candidateOnly: false, requiresCrossCheck: false };
const feed = `<rss><channel><item><title>A model for developers</title><link>${url}</link>
  <pubDate>2026-10-16</pubDate><description>A new model for developers.</description></item></channel></rss>`;
function page({ date = '2026-10-13', body = 'Android Studio now supports an agent workflow to build and test Android apps.', canonical = url } = {}) {
  return `<link rel="canonical" href="${canonical}"><h1>A model for developers</h1>
    <time datetime="${date}">13 Oct</time><p>${'An introduction. '.repeat(40)}</p><p>${body}</p>
    <span class="adb--post-continue-reading-heading">Continue reading</span>
    <p>Android Studio now supports an agent workflow to build and test Android apps.</p>`;
}
async function collect(html, status = 200) {
  const requests = [];
  const diagnostics = [];
  const result = await collectFromSource(source, { now: new Date('2026-10-19T00:00:00Z'), lookbackDays: 7,
    onDiagnostic: event => diagnostics.push(event),
    createClient: options => createBoundedFetchClient({ ...options, fetchImpl: async target => {
      requests.push(String(target));
      return new Response(String(target) === source.rssUrl ? feed : html,
        { status: String(target) === source.rssUrl ? 200 : status });
    } }) });
  return { ...result, requests, diagnostics };
}

test('official article body rescues a generic AI teaser without a model-name allowlist', async () => {
  const result = await collect(page());
  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];
  assert.equal(candidate.relevance_bucket, 'cpp_ai_tooling_fallback');
  assert.equal(candidate.finalSelectionEligibility, 'short');
  assert.equal(candidate.effective_date, '2026-10-13');
  assert.equal(candidate.date_evidence_url, url);
  assert.deepEqual(result.requests, [source.rssUrl, `${url}?hl=en`]);
  assert.ok(result.receivedBytes > 0);
});

test('related article tooling text cannot promote a generic model announcement', async () => {
  const result = await collect(page({ body: 'The model answers questions about everyday life.' }));
  assert.equal(result.candidates[0].relevance_bucket, 'generic_tech_watchlist');
});

test('visible publication date prevents an old article becoming fresh through its feed date', async () => {
  assert.equal((await collect(page({ date: '2026-09-24' }))).candidates.length, 0);
});

test('failed article fetch cannot fall back to a publishable RSS teaser', async () => {
  const result = await collect('', 503);
  assert.equal(result.candidates.length, 0);
  assert.ok(result.diagnostics.some(d => d.kind === 'fail_closed'));
});

test('missing date, mismatched canonical and missing article boundary fail closed', () => {
  assert.equal(parseAndroidDeveloperArticle(page({ date: '' }), url), null);
  assert.equal(parseAndroidDeveloperArticle(page({ canonical: 'https://example.com/post' }), url), null);
  assert.equal(parseAndroidDeveloperArticle(page().replace('adb--post-continue-reading-heading', 'other'), url), null);
});

test('article fetch cap is bounded and skipped articles are diagnosed', async () => {
  let calls = 0;
  const events = [];
  const items = Array.from({ length: 10 }, (_, n) => ({ url: `${url}-${n}`, publishedAt: '2026-10-13' }));
  const result = await resolveAndroidDeveloperArticles(items, {
    now: new Date('2026-10-19T00:00:00Z'), lookbackDays: 7, onDiagnostic: e => events.push(e),
    fetchClient: { fetchBounded: async target => {
      calls++;
      return { ok: true, body: page({ canonical: target.split('?')[0] }) };
    } }
  });
  assert.equal(calls, 8);
  assert.equal(result.length, 8);
  assert.equal(events.filter(e => e.kind === 'skipped_article_cap').length, 2);
});

test('truncated article responses never become source evidence', async () => {
  const result = await resolveAndroidDeveloperArticles([{ url, publishedAt: '2026-10-13' }], {
    now: new Date('2026-10-19T00:00:00Z'), lookbackDays: 7,
    fetchClient: { fetchBounded: async () => ({ ok: true, body: page(), truncated: true }) }
  });
  assert.deepEqual(result, []);
});
