const assert = require('node:assert/strict');
const test = require('node:test');
const registry = require('../../../data/news-sources.json');
const { normalizeEnabledSources } = require('../../../collect/news-source-section-resolver');
const { resolveAiCodingReleaseItems } = require('../../../collect/ai-coding-releases');
const { collectFromSource, normalizeCandidate, parseRss } = require('../../../cli/collect-news-candidates');
const { classifyAospCameraStackCandidate } = require('../../../domain/aosp-camera-scope');

const sources = normalizeEnabledSources(registry).sources;
const source = sources.find(row => row.id === 'codex-releases');
const now = new Date('2026-09-21T00:00:00Z');
function release(overrides = {}) {
  return {
    tag_name: 'rust-v0.155.1',
    html_url: 'https://github.com/openai/codex/releases/tag/rust-v0.155.1',
    published_at: '2026-09-18T12:00:00Z',
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-20T12:00:00Z',
    draft: false,
    prerelease: false,
    body: '## Bug fixes\n- Fixed Codex CLI sessions failing to run build and test tools inside the sandbox.',
    ...overrides
  };
}
function client() {
  return { fetchBounded: async () => { throw new Error('unexpected fetch'); } };
}

test('official release normalization keeps publication date, change evidence and supporting scope', async () => {
  const rows = await resolveAiCodingReleaseItems(JSON.stringify([release()]), source, { now, fetchClient: client() });
  assert.equal(rows.length, 1);
  const candidate = normalizeCandidate(rows[0]);
  assert.equal(candidate.publishedAt, '2026-09-18T12:00:00Z');
  assert.match(candidate.behavior_change, /inside the sandbox/);
  assert.equal(candidate.relevance_bucket, 'cpp_ai_tooling_fallback');
  assert.equal(candidate.source_gap_risk, false);
  assert.equal(candidate.main_eligible, true);
  assert.equal(candidate.source_quality.main_article_source_allowed, true);
});

test('drafts, prereleases, undated, stale, future and empty releases cannot become dated candidates', async () => {
  for (const override of [
    { draft: true }, { prerelease: true }, { published_at: null },
    { published_at: '2026-01-01T00:00:00Z' }, { published_at: '2026-09-22T00:00:00Z' },
    { body: '' }, { body: 'Release 0.155.1' }, { body: '- Bug fixes and reliability improvements' },
    { html_url: 'https://github.com/another-owner/codex/releases/tag/rust-v0.155.1' }
  ]) {
    const rows = await resolveAiCodingReleaseItems(JSON.stringify([release(override)]), source, { now, fetchClient: client() });
    assert.deepEqual(rows, [], JSON.stringify(override));
  }
});

test('Android NDK r-tags become dated release items while rc/beta prereleases and semver-shaped tags do not', async () => {
  const ndkSource = sources.find(row => row.id === 'android-ndk-releases');
  const ndkRelease = (overrides = {}) => release({
    tag_name: 'r30',
    html_url: 'https://github.com/android/ndk/releases/tag/r30',
    published_at: '2026-09-08T19:19:21Z',
    body: '# Changelog\n- [Issue 2215]: Fixed a compiler hang when compiling with `-O3` for ARM.\n- Upgraded the max API to 37 for NDK sysroots.',
    ...overrides
  });
  const rows = await resolveAiCodingReleaseItems(JSON.stringify([ndkRelease()]), ndkSource, { now, fetchClient: client() });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Android NDK r30');
  assert.equal(rows[0].version_or_release, 'r30');
  assert.match(rows[0].behavior_change, /compiler hang/);
  const candidate = normalizeCandidate(rows[0]);
  assert.equal(candidate.publishedAt, '2026-09-08T19:19:21Z');
  assert.equal(candidate.relevance_bucket, 'cpp_ai_tooling_fallback');
  for (const override of [
    { tag_name: 'r30-rc1', html_url: 'https://github.com/android/ndk/releases/tag/r30-rc1', prerelease: true },
    { tag_name: 'r30-rc1', html_url: 'https://github.com/android/ndk/releases/tag/r30-rc1' },
    { tag_name: 'v30.0.1', html_url: 'https://github.com/android/ndk/releases/tag/v30.0.1' }
  ]) {
    const rejected = await resolveAiCodingReleaseItems(JSON.stringify([ndkRelease(override)]), ndkSource, { now, fetchClient: client() });
    assert.deepEqual(rejected, [], JSON.stringify(override));
  }
});

test('collector dispatches release JSON through bounded resolver instead of generic HTML fallback', async () => {
  const urls = [];
  const result = await collectFromSource(source, {
    now,
    createClient: () => ({
      fetchBounded: async url => { urls.push(url); return { ok: true, body: JSON.stringify([release()]) }; },
      consumedBytes: () => 1234
    })
  });
  assert.deepEqual(urls, [source.url]);
  assert.equal(result.receivedBytes, 1234);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].source_kind, 'release_note_item');
});

test('release scan deduplicates pages and reports its cap instead of claiming complete coverage', async () => {
  const events = [];
  const urls = [];
  const body = JSON.stringify([release(), release(), release()]);
  const rows = await resolveAiCodingReleaseItems(body, source, {
    now,
    fetchClient: { fetchBounded: async url => { urls.push(url); return { ok: true, body }; } },
    onDiagnostic: event => events.push(event)
  });
  assert.equal(rows.length, 1);
  assert.equal(urls.length, 7);
  assert.match(urls[0], /page=2$/);
  assert.match(urls[6], /page=8$/);
  assert.equal(events[0].kind, 'release_scan_page_cap');
});

test('release fetch failure preserves collected facts and records incomplete coverage', async () => {
  const events = [];
  const rows = await resolveAiCodingReleaseItems(JSON.stringify([release(), release(), release()]), source, {
    now,
    fetchClient: { fetchBounded: async () => ({ ok: false, error: 'HTTP 403' }) },
    onDiagnostic: event => events.push(event)
  });
  assert.equal(rows.length, 1);
  assert.equal(events[0].kind, 'release_page_fetch_failed');
  assert.equal(events[0].detail, 'HTTP 403');
  await assert.rejects(resolveAiCodingReleaseItems('{}', source, { now, fetchClient: client() }), /Invalid GitHub release list/);
});

test('AI coding workflow evidence is recognized but product names and source hints alone are insufficient', () => {
  for (const title of ['Codex CLI adds sandbox controls for test commands', 'Claude Code improves code review', 'Agentic coding increases CI test volume']) {
    assert.equal(classifyAospCameraStackCandidate({ title }).relevance_bucket, 'cpp_ai_tooling_fallback');
  }
  for (const title of ['Claude Code launches a subscription discount', 'OpenAI announces new funding', 'Projects redesigned: from folder to conversation']) {
    assert.equal(classifyAospCameraStackCandidate({ title, source: 'Codex CLI coding agent', usageHint: 'build test debug' }).relevance_bucket, 'generic_tech_watchlist');
  }
});

test('measured CI changes require extracted article evidence and still need a publication date', () => {
  const behavior = 'CI jobs increase as more agents execute pull requests.';
  const raw = {
    source: sources.find(row => row.id === 'claude-blog'),
    title: 'Agentic coding increases CI test volume',
    summary: 'The engineering team measured build and test growth in its developer workflow.',
    url: 'https://claude.com/blog/example-ci',
    publishedAt: '2026-09-14',
    sourceKind: 'blog_post_item',
    api_or_component: 'Claude Code',
    behavior_change: behavior,
    source_extraction: { workflow: { sections: [{ items: [{ text: behavior }] }] } }
  };
  assert.equal(normalizeCandidate(raw).main_eligible, true);
  assert.equal(normalizeCandidate({ ...raw, source_extraction: undefined }).source_gap_risk, true);
  assert.equal(normalizeCandidate({ ...raw, publishedAt: '' }).main_eligible, false);
});

test('OpenAI registry uses the verified RSS endpoint and keeps undated RSS items out of main', () => {
  const openai = sources.find(row => row.id === 'openai-news');
  assert.equal(openai.rssUrl, 'https://openai.com/news/rss.xml');
  const rows = parseRss('<rss><channel><item><title>Codex CLI build and test update</title><link>https://openai.com/index/example</link><description>Added Codex CLI sandbox controls for build and test tools.</description></item></channel></rss>', openai);
  assert.equal(rows[0].main_eligible, false);
});
