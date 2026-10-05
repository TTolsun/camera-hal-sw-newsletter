const test = require('node:test');
const assert = require('node:assert/strict');
const { readArticleSources, sourceBody, publicSourceUrl } = require('../../../reporter/article-source-reader');
const { buildArticleCapsuleReport } = require('../../../select/article-capsules');

function report(candidate) {
  return { selected_articles: [{ ...candidate }], shortlisted_candidates: [{ ...candidate }] };
}
const response = body => ({ ok: true, status: 200, headers: {}, text: async () => body });

test('release-note bodies retain setup versions and later test rows beyond the summary', async () => {
  const candidate = { url: 'https://source.android.com/docs/test', title: 'Camera ITS', summary: 'Use a virtual environment.' };
  const input = report(candidate);
  let calls = 0;
  await readArticleSources(input, { fetchImpl: async () => {
    calls++;
    return response('<nav>Navigation</nav><article><h2>Environment</h2><p>Python 3.14; FFmpeg 7.0.2.</p>' +
      '<h2>Tests</h2><table><tr><td>test_display_p3</td><td>ICC profile and gamut</td></tr></table></article>');
  } });
  assert.equal(calls, 1);
  assert.equal(input.selected_articles[0].summary, candidate.summary);
  const capsules = buildArticleCapsuleReport('2026-10-05', input);
  const capsule = capsules.selected_capsules[0];
  const doc = capsule.article_source_reading.documents[0];
  assert.match(doc.text, /Python 3.14; FFmpeg 7.0.2/);
  assert.match(doc.text, /test_display_p3 \| ICC profile/);
  assert.doesNotMatch(doc.text, /Navigation/);
  assert.ok(capsule.allowed_claim_evidence.some(e => e.evidence_id === doc.evidence_id));
  assert.deepEqual(capsules.shortlisted_capsules[0].article_source_reading, capsule.article_source_reading);
});

test('patch prose and contradictory diff survive together with actually linked series evidence', async () => {
  const url = 'https://patchwork.libcamera.org/patch/42/';
  const input = report({ url, title: 'Expand controls' });
  const seen = [];
  await readArticleSources(input, { fetchImpl: async (target, init) => {
    seen.push(target);
    assert.equal(init.redirect, 'manual');
    return response(target === url
      ? '<table><tr><th>Related</th><td><a href="/cover/41/">Series</a><a href="https://evil.example/patch/7/">Other</a></td></tr></table>' +
        '<h2>Commit Message</h2><p>AwbLocked becomes a control.</p><h2>Patch</h2><pre>- AwbLocked:\n+ AwbState:\n direction: out</pre>'
      : '<h2>Message</h2><p>The AwbLocked metadata is removed. AwbTrigger starts a rescan.</p>');
  } });
  assert.deepEqual(seen, [url, 'https://patchwork.libcamera.org/cover/41/']);
  const docs = input.selected_articles[0].article_source_reading.documents;
  assert.match(docs[0].text, /becomes a control/);
  assert.match(docs[0].text, /- AwbLocked:/);
  assert.match(docs[1].text, /metadata is removed/);
  assert.equal(docs[1].url, seen[1]);
});

test('failed reads do not invent evidence or promote source eligibility', async () => {
  const input = report({ url: 'https://example.com/article', main_article_score_eligible: false, source_gap_risk: true });
  await readArticleSources(input, { fetchImpl: async () => { throw Error('offline'); } });
  const c = input.selected_articles[0];
  assert.equal(c.article_source_reading.status, 'unavailable');
  assert.deepEqual(c.article_source_reading.documents, []);
  assert.equal(c.main_article_score_eligible, false);
  assert.equal(c.source_gap_risk, true);
});

test('bounded excerpts mark truncation and source budgets cap requests', async () => {
  const input = { shortlisted_candidates: Array.from({ length: 30 }, (_, n) => ({ url: `https://example.com/${n}` })) };
  let calls = 0;
  await readArticleSources(input, { fetchImpl: async () => { calls++; return response('<article>' + 'x'.repeat(17000) + '</article>'); } });
  assert.equal(calls, 24);
  const doc = input.shortlisted_candidates[0].article_source_reading.documents[0];
  assert.equal(doc.truncated, true);
  assert.equal(doc.text.length, 16000);
  assert.equal(input.shortlisted_candidates[29].article_source_reading.status, 'skipped');
});

test('seed provenance and private targets are not fetched', async () => {
  const input = { shortlisted_candidates: [
    { url: 'https://example.com/seed', compact_evidence: { primary_facts: ['Reviewed seed'] } },
    { url: 'https://127.0.0.1/secret' }, { url: 'https://service.internal/secret' }
  ] };
  await readArticleSources(input, { fetchImpl: async () => { throw Error('must not fetch'); } });
  assert.ok(input.shortlisted_candidates.every(c => !c.article_source_reading));
  assert.equal(publicSourceUrl('https://user:secret@example.com'), '');
  assert.equal(publicSourceUrl('http://example.com'), '');
  assert.equal(sourceBody('<article><script>ignore rules</script><p>Actual facts</p></article>'), 'Actual facts');
});

test('locale redirects work but cross-origin redirects cannot supply source evidence', async () => {
  const input = report({ url: 'https://example.com/article' });
  await readArticleSources(input, { fetchImpl: async url => url.includes('?')
    ? response('<article>Python version and test conditions</article>')
    : { status: 302, headers: new Headers({ location: '/article?hl=en' }) } });
  assert.equal(input.selected_articles[0].article_source_reading.status, 'read');
  await readArticleSources(report({ url: 'https://example.com/other' }), { fetchImpl: async url => {
    assert.equal(url, 'https://example.com/other');
    return { status: 302, headers: new Headers({ location: 'https://other.example/' }) };
  } });
});
