const test = require('node:test');
const assert = require('node:assert/strict');
const { readArticleSources } = require('../../../reporter/article-source-reader');
const { buildArticleCapsuleReport } = require('../../../select/article-capsules');
const { sourceReviewInput, reviewArticleSources } = require('../../../quality/article-source-review');

const revision = 'a'.repeat(40);
const otherRevision = 'b'.repeat(40);
const shell = '<noscript>To use PolyGerrit, please enable JavaScript in your browser settings, and then refresh this page.</noscript>';
const patch = `From ${revision} Mon Sep 17 00:00:00 2001\nSubject: [PATCH] Type platform handles\n\nKeep the ownership condition.\n\ndiff --git a/camera/test.cc b/camera/test.cc\n--- a/camera/test.cc\n+++ b/camera/test.cc\n@@ -1 +1 @@\n-handle fence;\n+handle<platform> fence;\n`;
const response = (body, status = 200) => ({ status, headers: {}, text: async () => body });

function setup(host = 'android-review.googlesource.com', project = 'platform/frameworks/av') {
  const url = `https://${host}/c/${project}/+/42`;
  const candidate = { url, title: 'Camera handles', gerrit_commit_sha: revision,
    main_article_score_eligible: false, source_gap_risk: true };
  const input = { selected_articles: [{ ...candidate }], shortlisted_candidates: [{ ...candidate }] };
  const detail = { _number: 42, project, branch: 'main', status: 'NEW',
    created: '2026-10-07 12:00:00.000000000', current_revision: revision,
    revisions: { [revision]: { files: { 'camera/test.cc': {} } } } };
  const seen = [];
  const fetchImpl = async (target, init) => {
    seen.push(target);
    assert.equal(init.redirect, 'manual');
    if (target.includes('/detail?')) return response(")]}'\n" + JSON.stringify(detail));
    if (target.endsWith(`/revisions/${revision}/patch`)) return response(Buffer.from(patch).toString('base64'));
    return response(shell);
  };
  return { input, detail, seen, fetchImpl, url };
}

for (const [host, project] of [['android-review.googlesource.com', 'platform/frameworks/av'],
  ['chromium-review.googlesource.com', 'chromiumos/platform2']]) {
  test(`${host} supplies revision-bound patch evidence to capsules and source review, without promoting eligibility`, async () => {
    const { input, seen, fetchImpl, url } = setup(host, project);
    await readArticleSources(input, { fetchImpl });
    assert.equal(seen.length, 2); // selected/shortlist copies share one read
    assert.ok(seen.every(u => u.startsWith(`https://${host}/changes/42/`)));
    const c = input.selected_articles[0];
    assert.equal(c.main_article_score_eligible, false);
    assert.equal(c.source_gap_risk, true);
    assert.equal(c.article_source_reading.status, 'read');
    const capsules = buildArticleCapsuleReport('2026-10-12', input);
    const doc = capsules.selected_capsules[0].article_source_reading.documents[0];
    assert.equal(doc.url, url);
    assert.equal(doc.revision, revision);
    assert.equal(doc.truncated, false);
    assert.match(doc.text, /-handle fence;\n\+handle<platform> fence;/);
    assert.match(doc.text, /"status": "NEW"/);
    assert.doesNotMatch(doc.text, /PolyGerrit/);
    assert.ok(capsules.selected_capsules[0].allowed_claim_evidence.some(e => e.evidence_id === doc.evidence_id));
    assert.deepEqual(capsules.shortlisted_capsules[0].article_source_reading, c.article_source_reading);
    const editor = { sections: [{ source_candidate_url: url, public_article: { headline: 'Handles' } }] };
    assert.deepEqual(sourceReviewInput(editor, capsules)[0].source_documents, [doc]);
    const fact = await reviewArticleSources(editor, capsules, { article_quality: [{ section_index: 0, publishable: false }] },
      async () => ({ article_quality: [{ section_index: 0, publishable: true, reason: 'Read patch',
        briefing_checks: Object.fromEntries(['scope_and_behavior', 'public_verification', 'release_limitations', 'effect_boundaries']
          .map(key => [key, { applicable: false, satisfied: false, evidence: '', reason: 'Synthetic design review' }])),
        source_review: { core_change: 'Typed handles', article_explanation: 'Typed handles', material_omissions: [], unaddressed_source_conflicts: [] } }] }));
    assert.equal(fact.article_quality[0].publishable, false); // fetching never overrides a failed primary verdict
  });
}

test('a patch beyond the HTML excerpt limit retains its final condition in bounded documents', async () => {
  const { input, fetchImpl } = setup();
  const longPatch = patch + ' context\n'.repeat(3000) + '+if (visible && supportsMute) mute(); else block();\n';
  await readArticleSources(input, { fetchImpl: (url, init) => url.endsWith('/patch')
    ? response(Buffer.from(longPatch).toString('base64')) : fetchImpl(url, init) });
  const docs = input.selected_articles[0].article_source_reading.documents;
  assert.ok(docs.length > 1);
  assert.ok(docs.every(d => d.text.length <= 16000 && !d.truncated && d.parts === docs.length));
  assert.ok(docs.map(d => d.text).join('').endsWith(longPatch));
  assert.equal(new Set(docs.map(d => d.evidence_id)).size, docs.length);
  const capsules = buildArticleCapsuleReport('2026-10-12', input);
  assert.deepEqual(sourceReviewInput({ sections: [{ source_candidate_url: input.selected_articles[0].url }] }, capsules)[0].source_documents, docs);
});

for (const [name, mutate, error] of [
  ['wrong change', d => { d._number = 43; }, 'gerrit_change_identity_mismatch'],
  ['wrong project', d => { d.project = 'other/project'; }, 'gerrit_change_identity_mismatch'],
  ['revision drift', d => { d.current_revision = otherRevision; }, 'gerrit_revision_mismatch']
]) {
  test(`${name} cannot bind another patch to the collected candidate`, async () => {
    const { input, detail, fetchImpl, seen } = setup();
    mutate(detail);
    await readArticleSources(input, { fetchImpl });
    assert.equal(seen.length, 1);
    assert.deepEqual(input.selected_articles[0].article_source_reading, { status: 'unavailable', error, documents: [] });
  });
}

for (const [name, body, status, error] of [
  ['HTTP failure', '', 404, 'gerrit_patch:http_404'],
  ['HTML shell', shell, 200, 'invalid_gerrit_patch_encoding'],
  ['base64 shell', Buffer.from(shell).toString('base64'), 200, 'invalid_gerrit_patch_content'],
  ['wrong patch revision', Buffer.from(patch.replace(revision, otherRevision)).toString('base64'), 200, 'invalid_gerrit_patch_content'],
  ['document budget', Buffer.from(patch + 'x'.repeat(64000)).toString('base64'), 200, 'gerrit_source_exceeds_document_budget'],
  ['network byte budget', 'x'.repeat(800 * 1024), 200, 'gerrit_patch:truncated_at_byte_limit']
]) {
  test(`${name} stays unavailable without an HTML or summary fallback`, async () => {
    const { input, fetchImpl } = setup();
    await readArticleSources(input, { fetchImpl: (url, init) => url.endsWith('/patch') ? response(body, status) : fetchImpl(url, init) });
    const c = input.selected_articles[0];
    assert.deepEqual(c.article_source_reading, { status: 'unavailable', error, documents: [] });
    assert.deepEqual(c.source_extraction.evidence_blocks, []);
    assert.equal(c.source_gap_risk, true);
  });
}

test('cache does not attach a successful revision read to a conflicting shortlist revision', async () => {
  const { input, fetchImpl } = setup();
  input.shortlisted_candidates[0].gerrit_commit_sha = otherRevision;
  await readArticleSources(input, { fetchImpl });
  assert.equal(input.selected_articles[0].article_source_reading.status, 'read');
  assert.equal(input.shortlisted_candidates[0].article_source_reading.error, 'gerrit_revision_mismatch');
});

test('PolyGerrit shell at an unsupported host is not source evidence', async () => {
  const input = { selected_articles: [{ url: 'https://review.example.com/c/project/+/42' }] };
  await readArticleSources(input, { fetchImpl: async () => response(shell) });
  assert.deepEqual(input.selected_articles[0].article_source_reading, { status: 'unavailable', error: 'polygerrit_shell', documents: [] });
});

test('Gerrit API redirects remain restricted to the original origin', async () => {
  const { input } = setup();
  let calls = 0;
  await readArticleSources(input, { fetchImpl: async () => {
    calls++;
    return { status: 302, headers: new Headers({ location: 'https://other.example/patch' }) };
  } });
  assert.equal(calls, 1);
  assert.match(input.selected_articles[0].article_source_reading.error, /unsupported_source_redirect/);
});

test('a failed reread removes stale patch evidence but preserves independent extraction evidence', async () => {
  const { input, fetchImpl } = setup();
  input.selected_articles[0].source_extraction = { evidence_blocks: [{ evidence_id: 'independent', text: 'Collected metadata' }] };
  await readArticleSources(input, { fetchImpl });
  const first = input.selected_articles[0].article_source_reading.documents;
  await readArticleSources(input, { fetchImpl });
  assert.deepEqual(input.selected_articles[0].article_source_reading.documents, first);
  assert.equal(input.selected_articles[0].source_extraction.evidence_blocks.length, 2);
  await readArticleSources(input, { fetchImpl: async () => response(shell) });
  assert.equal(input.selected_articles[0].article_source_reading.status, 'unavailable');
  assert.deepEqual(input.selected_articles[0].source_extraction.evidence_blocks.map(b => b.evidence_id), ['independent']);
});

test('unsupported Gerrit paths and malformed project escapes do not fetch HTML', async () => {
  const input = { selected_articles: ['/q/camera', '/c/%ZZ/+/42', '/c/project/+/42/2'].map(p => ({ url: 'https://android-review.googlesource.com' + p })) };
  await readArticleSources(input, { fetchImpl: async () => { throw Error('must not fetch'); } });
  assert.ok(input.selected_articles.every(c => c.article_source_reading.error === 'unsupported_gerrit_change_url'));
});
