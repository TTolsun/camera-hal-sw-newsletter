const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertPublicHttpsUrl,
  buildPrimaryEvidence,
  fetchPublicText,
  mergeSeedCandidates,
  runSeedEvidenceExpansion,
  seedCandidateFromEvidence
} = require('../../../discovery/seed-evidence');
const {
  seedCandidatesPath,
  seedEvidencePackPath,
  seedFetchReportPath,
  seedMergeReportPath
} = require('../../common/artifact-paths');
const { readJsonFixture } = require('../helpers/fixture-loader');
const { sourceQualityFieldDrift } = require('../../collect/source-quality-classifier');
const { buildArticleCapsule } = require('../../../generator/select/article-capsules');

function policySeed(sourceOverrides = {}, candidateOverrides = {}) {
  return seedCandidateFromEvidence({
    date: '2026-10-05',
    seed: { seed_id: 'policy-seed', url: 'https://camera.example/releases/1' },
    source: {
      id: 'camera-project', name: 'Camera project', category: 'camera-hal',
      sourceRole: 'project_release_source', sourceUrlQualityHint: 'official_dated_release',
      mainArticlePolicy: 'allowed', ...sourceOverrides
    },
    candidate: { title: 'libcamera ISP buffer fix', ...candidateOverrides },
    primaryEvidence: {
      evidence_id: 'policy-evidence', url: 'https://camera.example/releases/1',
      published_at: '2026-10-01', source_backed_items: [candidateOverrides.title || 'Fixed libcamera ISP buffer handling.']
    },
    packIndex: 0
  });
}

test('seed candidates honor registry source restrictions and retain the direct Android Camera HAL exception', () => {
  for (const [source, blocker] of [
    [{ mainArticleRequiresAndroidCameraHal: true }, 'trend_reference_project'],
    [{ mainArticlePolicy: 'reference_only' }, 'reference_only'],
    [{ mainArticlePolicy: 'watchlist_only' }, 'policy_locked_out_of_main'],
    [{ mainArticlePolicy: 'blocked' }, 'policy_locked_out_of_main'],
    [{ requiresCrossCheck: true }, 'cross_check_required_but_missing']
  ]) {
    const candidate = policySeed(source, { mainArticlePolicy: 'allowed' });
    assert.equal(candidate.main_article_source_allowed, false);
    assert.ok(candidate.main_article_source_blockers.includes(blocker), blocker);
    assert.equal(candidate.main_eligible, false);
    assert.deepEqual(sourceQualityFieldDrift(candidate), []);
  }
  const direct = policySeed({ mainArticleRequiresAndroidCameraHal: true }, { title: 'Android Camera HAL camera3_capture_request buffer contract changed' });
  assert.equal(direct.relevance_bucket, 'direct_aosp_camera');
  assert.equal(direct.main_article_source_allowed, true);
  assert.equal(direct.main_eligible, true);
  const confirmed = policySeed({ requiresCrossCheck: true }, { primary_confirmation: true });
  assert.equal(confirmed.cross_check_status, 'required_satisfied');
  assert.equal(confirmed.main_article_source_allowed, true);
});

test('seed policy enrichment preserves explicit blockers and does not allow unknown sources', () => {
  const blocked = policySeed({}, { main_article_source_allowed: false, main_article_source_blockers: ['linked_evidence_blocked'] });
  assert.equal(blocked.main_article_source_allowed, false);
  assert.ok(blocked.main_article_source_blockers.includes('linked_evidence_blocked'));
  const unknown = policySeed({ sourceRole: '', sourceUrlQualityHint: '', mainArticlePolicy: 'conditional' });
  assert.equal(unknown.main_article_source_allowed, false);
  assert.ok(unknown.main_article_source_blockers.includes('unknown_source_quality'));
  for (const restriction of [{ source_gap_risk: true }, { reference_only: true }, { mainArticlePolicy: 'blocked' },
    { requiresCrossCheck: true }, { requires_cross_check: true }, { candidateOnly: true }, { candidate_only: true },
    { linked_evidence_summary: { by_fetch_status: { blocked: 1 } } },
    { source_aware_linked_evidence_summary: { by_fetch_status: { failed: 1 } } }, { sourceUrlQuality: 'unknown' }]) {
    const [restricted] = mergeSeedCandidates([{ url: blocked.url, ...restriction }], [policySeed()]).mergedCandidates;
    assert.equal(restricted.main_article_source_allowed, false);
    assert.match(restricted.main_article_source_allowed_reason, /Seed source restrictions/);
    assert.deepEqual(sourceQualityFieldDrift(restricted), []);
  }
  const [explicit] = mergeSeedCandidates([{ url: blocked.url, main_article_source_allowed: false }], [policySeed()]).mergedCandidates;
  assert.equal(explicit.main_article_source_allowed, false);
});

test('duplicate seed enrichment preserves manual fields and unions source safety restrictions', () => {
  const seed = policySeed({ mainArticlePolicy: 'reference_only' });
  const manual = {
    url: seed.url, title: 'Manual title', priority: 'urgent', source_id: 'manual-source',
    mainArticlePolicy: 'allowed', main_eligible: true,
    source_quality: { source_role: 'project_release_source', source_url_quality: 'official_dated_release',
      source_quality_status: 'blocked', main_article_source_allowed: false,
      main_article_source_blockers: ['linked_evidence_blocked'] }
  };
  const [merged] = mergeSeedCandidates([manual], [seed]).mergedCandidates;
  assert.equal(merged.title, manual.title);
  assert.equal(merged.priority, manual.priority);
  assert.equal(merged.source_id, manual.source_id);
  assert.equal(merged.main_eligible, false);
  assert.equal(merged.main_article_source_allowed, false);
  assert.ok(merged.main_article_source_blockers.includes('reference_only'));
  assert.ok(merged.main_article_source_blockers.includes('linked_evidence_blocked'));
  assert.deepEqual(sourceQualityFieldDrift(merged), []);
  const [enriched] = mergeSeedCandidates([{ url: seed.url, title: 'Manual source without quality metadata' }], [policySeed()]).mergedCandidates;
  assert.equal(enriched.main_article_source_allowed, true);
  const [unknown] = mergeSeedCandidates([{ url: seed.url, title: 'Unknown manual source' }], [policySeed({ sourceRole: '', sourceUrlQualityHint: '', mainArticlePolicy: 'conditional' })]).mergedCandidates;
  assert.equal(unknown.main_article_source_allowed, false);
  assert.ok(unknown.main_article_source_blockers.includes('unknown_source_quality'));
});

test('duplicate seed enrichment preserves raw restrictions beside canonical quality and completed cross checks', () => {
  const seed = policySeed();
  for (const restriction of [{ requires_cross_check: true }, { candidateOnly: true }, { linked_evidence_summary: { by_fetch_status: { blocked: 1 } } }]) {
    const [merged] = mergeSeedCandidates([{ ...seed, ...restriction }], [seed]).mergedCandidates;
    assert.equal(merged.main_article_source_allowed, false);
    assert.ok(merged.main_article_source_blockers.length > 0);
  }
  const confirmed = { ...seed, mainArticlePolicy: 'conditional', requires_cross_check: true,
    primary_confirmation: true, api_or_component: 'Camera HAL', source_quality: undefined };
  const [merged] = mergeSeedCandidates([confirmed], [policySeed({ requiresCrossCheck: true })]).mergedCandidates;
  assert.equal(merged.main_article_source_allowed, true);
  assert.equal(merged.cross_check_status, 'required_satisfied');
  assert.equal(merged.source_quality_status, 'allowed');
  assert.deepEqual(merged.main_article_source_blockers, []);
  const [locked] = mergeSeedCandidates([confirmed], [policySeed({ requiresCrossCheck: true, mainArticlePolicy: 'reference_only' })]).mergedCandidates;
  assert.equal(locked.main_article_source_allowed, false);
  assert.ok(locked.main_article_source_blockers.includes('reference_only'));
  const [newRequirement] = mergeSeedCandidates([{ url: seed.url, primary_confirmation: true }], [policySeed({ requiresCrossCheck: true })]).mergedCandidates;
  assert.equal(newRequirement.main_article_source_allowed, true);
  assert.equal(newRequirement.cross_check_status, 'required_satisfied');
  const [blockedCheck] = mergeSeedCandidates([{ url: seed.url, primary_confirmation: true, cross_check_status: 'required_blocked' }], [policySeed({ requiresCrossCheck: true })]).mergedCandidates;
  assert.equal(blockedCheck.main_article_source_allowed, false);
  assert.equal(blockedCheck.cross_check_status, 'required_blocked');
});

function tempRoot(sourceOverrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-url-evidence-'));
  fs.mkdirSync(path.join(root, 'src', 'shared', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), JSON.stringify({
    schemaVersion: 2,
    sources: [{
      id: 'android',
      name: 'Android Developers',
      sourceUrl: 'https://developer.android.com/',
      category: 'android',
      priority: 'high',
      reliability: 'official',
      ...sourceOverrides,
      linkedEvidencePolicy: {
        enabled: true,
        allowedDomains: ['developer.android.com']
      }
    }]
  }, null, 2), 'utf8');
  return root;
}

test('seed expansion carries registry policy through duplicate merge and reporter capsule', async () => {
  for (const [sourceOverrides, title, allowed] of [
    [{ mainArticleRequiresAndroidCameraHal: true }, 'libcamera ISP buffer change', false],
    [{ mainArticleRequiresAndroidCameraHal: true }, 'Android Camera HAL camera3_capture_request buffer contract changed', true],
    [{ mainArticlePolicy: 'allowed' }, 'CameraX stream buffer fix', true]
  ]) {
    const root = tempRoot(sourceOverrides);
    const url = 'https://developer.android.com/news/seed-change';
    try {
      const result = await runSeedEvidenceExpansion({
        root, date: '2026-10-05',
        manualPayload: { candidates: [{ url, title, priority: 'urgent', source_id: 'manual-source' }] },
        collectionIntent: { payload: { seed_urls: [{ seed_id: 'registry-seed', url }] } },
        lookupImpl: publicLookup,
        fetchImpl: async () => htmlResponse({ body: `<html><head><title>${title}</title><meta name="datePublished" content="2026-10-01"></head><body>${title}</body></html>` })
      });
      const candidate = result.mergedCandidates[0];
      assert.equal(candidate.source_id, 'manual-source');
      assert.equal(candidate.priority, 'urgent');
      assert.equal(candidate.main_article_source_allowed, allowed);
      assert.equal(buildArticleCapsule(candidate).source_quality.main_article_source_allowed, allowed);
      assert.deepEqual(sourceQualityFieldDrift(candidate), []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function publicLookup() {
  return [{ address: '93.184.216.34', family: 4 }];
}

function htmlResponse({
  status = 200,
  ok = status < 400,
  url = '',
  body = '',
  location = ''
} = {}) {
  return {
    status,
    ok,
    url,
    headers: {
      get: name => String(name || '').toLowerCase() === 'location' ? location : ''
    },
    text: async () => body
  };
}

test('seed URL safety rejects non-public URLs and private DNS resolution', async () => {
  await assert.rejects(
    () => assertPublicHttpsUrl('http://developer.android.com/jetpack/androidx/releases/camera', { lookupImpl: null }),
    /non_https_url/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://user:pass@example.com/news', { lookupImpl: null }),
    /embedded_credentials_url/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://localhost/news', { lookupImpl: null }),
    /blocked_internal_host/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://127.0.0.1/news', { lookupImpl: null }),
    /blocked_internal_host/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://169.254.169.254/latest/meta-data', { lookupImpl: null }),
    /blocked_internal_host/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://example.com/news', {
      lookupImpl: async () => [{ address: '10.0.0.5', family: 4 }]
    }),
    /dns_resolved_private_address/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://example.com/news', {
      lookupImpl: async () => [{ address: '::ffff:169.254.169.254', family: 6 }]
    }),
    /dns_resolved_private_address/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://[::ffff:127.0.0.1]/news', { lookupImpl: null }),
    /blocked_internal_host/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://[fc00::1]/news', { lookupImpl: null }),
    /blocked_internal_host/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://[fe80::1]/news', { lookupImpl: null }),
    /blocked_internal_host/
  );
  await assert.rejects(
    () => assertPublicHttpsUrl('https://[febf::1]/news', { lookupImpl: null }),
    /blocked_internal_host/
  );
});

test('private URL seed intent fixture is blocked before fetch', async () => {
  const fixture = readJsonFixture('seed-evidence/bad/private-url-intent.json');
  const root = tempRoot();
  const date = fixture.collection_intent.newsletter_date;
  const result = await runSeedEvidenceExpansion({
    root,
    date,
    manualPayload: {
      schema_version: 5,
      date,
      newsletter_date: date,
      candidates: []
    },
    collectionIntent: {
      payload: fixture.collection_intent
    },
    lookupImpl: publicLookup,
    fetchImpl: async () => {
      throw new Error('private fixture URL should be blocked before fetch');
    }
  });

  assert.equal(result.stats.seed_used, true);
  assert.equal(result.stats.seed_candidate_count, 0);
  assert.equal(result.stats.seed_blocked_url_count, 1);
  assert.equal(result.seedPayload.failures[0].reason, fixture.expected.reason);
  assert.equal(readJson(seedFetchReportPath(root, date)).blocked_url_count, 1);
});

test('seed fetch follows public manual redirects and relative locations', async () => {
  const calls = [];
  const body = '<html><head><title>OK</title></head><body>done</body></html>';
  const result = await fetchPublicText(
    async (url, options) => {
      calls.push({ url, redirect: options.redirect });
      if (calls.length === 1) {
        return htmlResponse({
          status: 302,
          ok: false,
          url,
          location: 'https://developer.android.com/jetpack/androidx/releases/camera'
        });
      }
      if (calls.length === 2) {
        return htmlResponse({
          status: 302,
          ok: false,
          url,
          location: '/jetpack/androidx/releases/camera#1.6.1'
        });
      }
      return htmlResponse({
        status: 200,
        ok: true,
        url,
        body
      });
    },
    'https://example.com/news',
    { lookupImpl: publicLookup }
  );

  assert.deepEqual(calls.map(call => call.redirect), ['manual', 'manual', 'manual']);
  assert.equal(result.finalUrl, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
  assert.match(result.body, /done/);
});

test('seed fetch blocks private redirect before following it', async () => {
  let callCount = 0;
  await assert.rejects(
    () => fetchPublicText(
      async (url) => {
        callCount += 1;
        return htmlResponse({
          status: 302,
          ok: false,
          url,
          location: 'https://192.168.0.10/private'
        });
      },
      'https://example.com/news',
      { lookupImpl: publicLookup }
    ),
    /blocked_internal_host/
  );
  assert.equal(callCount, 1);
});

test('seed fetch validates redirect target DNS before following it', async () => {
  let callCount = 0;
  await assert.rejects(
    () => fetchPublicText(
      async (url) => {
        callCount += 1;
        return htmlResponse({
          status: 302,
          ok: false,
          url,
          location: 'https://redirect.example.com/private'
        });
      },
      'https://example.com/news',
      {
        lookupImpl: async (hostname) => hostname === 'redirect.example.com'
          ? [{ address: '10.0.0.9', family: 4 }]
          : [{ address: '93.184.216.34', family: 4 }]
      }
    ),
    /dns_resolved_private_address/
  );
  assert.equal(callCount, 1);
});

test('seed fetch rejects malformed redirect responses and redirect loops', async () => {
  await assert.rejects(
    () => fetchPublicText(
      async (url) => htmlResponse({ status: 302, ok: false, url, location: '' }),
      'https://example.com/news',
      { lookupImpl: publicLookup }
    ),
    /redirect_missing_location/
  );

  let callCount = 0;
  await assert.rejects(
    () => fetchPublicText(
      async (url) => {
        callCount += 1;
        return htmlResponse({ status: 302, ok: false, url, location: '/loop' });
      },
      'https://example.com/news',
      { lookupImpl: publicLookup, maxRedirects: 1 }
    ),
    /too_many_redirects/
  );
  assert.equal(callCount, 2);
});

test('seed merge preserves manual editorial fields and records conflicts', () => {
  const manual = [{
    title: 'Manual title',
    headline: 'Manual headline',
    editor_note: 'Manual note',
    priority: 'urgent',
    source_id: 'manual-source',
    tags: ['editor-picked'],
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  }];
  const seed = [{
    title: 'Seed title',
    headline: 'Seed headline',
    priority: 'low',
    source_id: 'seed-source',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera?hl=ko#1.6.1',
    source_extraction: { release: { version: 'CameraX 1.6.1' } },
    compact_evidence: {
      primary_facts: ['Fixed CameraX build issue.'],
      do_not_claim: ['Keyword hints are discovery hints only.']
    },
    seed_ids: ['seed-1'],
    evidence_pack_ids: ['seed-1-pack'],
    primary_evidence_ids: ['seed-1-primary-01'],
    linked_evidence_ids: [],
    source_extraction_ref: 'seed-evidence-pack.json#/packs/0'
  }];

  const { mergedCandidates, report } = mergeSeedCandidates(manual, seed);

  assert.equal(mergedCandidates.length, 1);
  assert.equal(mergedCandidates[0].title, 'Manual title');
  assert.equal(mergedCandidates[0].headline, 'Manual headline');
  assert.equal(mergedCandidates[0].editor_note, 'Manual note');
  assert.equal(mergedCandidates[0].priority, 'urgent');
  assert.equal(mergedCandidates[0].source_id, 'manual-source');
  assert.deepEqual(mergedCandidates[0].tags, ['editor-picked']);
  assert.deepEqual(mergedCandidates[0].seed_ids, ['seed-1']);
  assert.deepEqual(mergedCandidates[0].evidence_pack_ids, ['seed-1-pack']);
  assert.equal(mergedCandidates[0].source_extraction.release.version, 'CameraX 1.6.1');
  assert.equal(report.enriched_duplicate_count, 1);
  assert.equal(report.new_seed_candidate_count, 0);
  assert.equal(report.conflicts.some(item => item.field === 'title'), true);
  assert.equal(report.conflicts.some(item => item.field === 'priority'), true);
});

test('seed merge preserves blocked linked evidence diagnostics for duplicate manual candidates', () => {
  const blockedFact = 'Blocked linked page claimed unsupported implementation details.';
  const blockedUrl = 'https://developer.android.com/blocked-linked';
  const manual = [{
    title: 'Manual title',
    headline: 'Manual headline',
    editor_note: 'Manual note',
    priority: 'urgent',
    source_id: 'manual-source',
    tags: ['editor-picked'],
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    linked_evidence_ids: ['manual-usable-linked'],
    blocked_linked_evidence_ids: ['blocked-overlap'],
    blocked_linked_evidence_urls: ['https://developer.android.com/manual-blocked'],
    compact_evidence: {
      primary_facts: ['Manual source-backed fact.'],
      linked_context: ['Manual usable linked context.'],
      evidence_urls: ['https://developer.android.com/manual-usable']
    }
  }];
  const seed = [{
    title: 'Seed title',
    headline: 'Seed headline',
    priority: 'low',
    source_id: 'seed-source',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera?hl=ko#1.6.1',
    linked_evidence_ids: ['seed-usable-linked'],
    blocked_linked_evidence_ids: ['blocked-overlap', 'blocked-new'],
    blocked_linked_evidence_urls: ['https://developer.android.com/manual-blocked', blockedUrl],
    compact_evidence: {
      primary_facts: ['Seed source-backed fact.'],
      linked_context: ['Seed usable linked context.'],
      evidence_urls: ['https://developer.android.com/seed-usable']
    },
    seed_ids: ['seed-1'],
    evidence_pack_ids: ['seed-1-pack'],
    primary_evidence_ids: ['seed-1-primary-01'],
    source_extraction_ref: 'seed-evidence-pack.json#/packs/0'
  }];

  const { mergedCandidates, report } = mergeSeedCandidates(manual, seed);
  const [merged] = mergedCandidates;

  assert.equal(mergedCandidates.length, 1);
  assert.equal(merged.title, 'Manual title');
  assert.equal(merged.headline, 'Manual headline');
  assert.equal(merged.editor_note, 'Manual note');
  assert.equal(merged.priority, 'urgent');
  assert.equal(merged.source_id, 'manual-source');
  assert.deepEqual(merged.tags, ['editor-picked']);
  assert.deepEqual(merged.blocked_linked_evidence_ids, ['blocked-overlap', 'blocked-new']);
  assert.deepEqual(merged.blocked_linked_evidence_urls, ['https://developer.android.com/manual-blocked', blockedUrl]);
  assert.deepEqual(merged.linked_evidence_ids, ['manual-usable-linked', 'seed-usable-linked']);
  assert.equal(merged.linked_evidence_ids.includes('blocked-overlap'), false);
  assert.equal(merged.linked_evidence_ids.includes('blocked-new'), false);
  assert.equal(merged.compact_evidence.linked_context.includes(blockedFact), false);
  assert.equal(merged.compact_evidence.evidence_urls.includes(blockedUrl), false);
  assert.deepEqual(report.decisions[0].added_evidence_ids, ['seed-1-primary-01']);
});

test('seed workflow-shape fixtures cover seed-only and seed-plus-Gemini merge output', () => {
  for (const fixturePath of [
    'seed-evidence/workflow-shapes/seed-only-merged-candidates.json',
    'seed-evidence/workflow-shapes/seed-plus-gemini-merged-candidates.json'
  ]) {
    const fixture = readJsonFixture(fixturePath);
    const { mergedCandidates, report } = mergeSeedCandidates(
      fixture.manual_candidates,
      fixture.seed_candidates
    );

    assert.equal(mergedCandidates.length, fixture.expected.mergedCount, fixturePath);
    assert.equal(report.new_seed_candidate_count, fixture.expected.newSeedCandidateCount, fixturePath);
    assert.equal(report.enriched_duplicate_count, fixture.expected.enrichedDuplicateCount, fixturePath);

    for (const candidate of mergedCandidates) {
      assert.ok(candidate.evidence_pack_ids.length > 0, `${fixturePath} must preserve seed evidence pack ids`);
      assert.ok(candidate.primary_evidence_ids.length > 0, `${fixturePath} must preserve primary evidence ids`);
      const refs = candidate.seed_evidence_pack_refs || [candidate.source_extraction_ref].filter(Boolean);
      assert.equal(refs.includes('seed-evidence-pack.json#/packs/0'), true);
    }
  }
});

test('seed expansion writes evidence pack, seed candidates, reports, and compact evidence', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const html = '<html><head><title>CameraX 1.6.1 release notes</title><meta name="datePublished" content="2026-05-15"></head><body>2026-05-15 CameraX 1.6.1 fixes Android camera stream validation and build behavior.</body></html>';
  const result = await runSeedEvidenceExpansion({
    root,
    date,
    manualPayload: {
      schema_version: 5,
      date,
      newsletter_date: date,
      candidates: []
    },
    collectionIntent: {
      payload: {
        schema_version: 1,
        newsletter_date: date,
        seed_urls: [
          {
            seed_id: 'seed-camerax',
            url: 'https://developer.android.com/jetpack/androidx/releases/camera',
            expected_topic: 'CameraX release notes',
            priority: 'high'
          },
          {
            seed_id: 'seed-blocked',
            url: 'http://localhost/private',
            expected_topic: 'Blocked seed'
          }
        ],
        keyword_hints: ['CameraX 1.6.1']
      }
    },
    lookupImpl: publicLookup,
    fetchImpl: async (url) => ({
      ok: true,
      url,
      text: async () => html
    })
  });

  assert.equal(result.stats.seed_used, true);
  assert.equal(result.stats.seed_candidate_count, 1);
  assert.equal(result.stats.seed_blocked_url_count, 1);
  assert.equal(result.stats.seed_fetch_failed_count, 0);
  assert.equal(result.stats.seed_primary_evidence_count, 1);
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), true);
  assert.equal(fs.existsSync(seedFetchReportPath(root, date)), true);
  assert.equal(fs.existsSync(seedMergeReportPath(root, date)), true);

  const seedPayload = readJson(seedCandidatesPath(root, date));
  assert.equal(seedPayload.candidates.length, 1);
  assert.equal(seedPayload.candidates[0].origin, 'seed_url_evidence');
  assert.deepEqual(seedPayload.candidates[0].evidence_pack_ids, ['seed-camerax-pack']);
  assert.deepEqual(seedPayload.candidates[0].primary_evidence_ids, ['seed-camerax-primary-01']);
  assert.equal(seedPayload.candidates[0].source_extraction_ref, 'seed-evidence-pack.json#/packs/0');
  assert.equal(seedPayload.candidates[0].compact_evidence.do_not_claim.some(item => item.includes('Keyword hints')), true);
  assert.equal(seedPayload.failures.length, 1);

  const fetchReport = readJson(seedFetchReportPath(root, date));
  assert.equal(fetchReport.keyword_hints_are_facts, false);
  assert.equal(fetchReport.keyword_hints[0], 'CameraX 1.6.1');
  assert.equal(fetchReport.blocked_url_count, 1);

  const evidencePack = readJson(seedEvidencePackPath(root, date));
  assert.equal(evidencePack.packs.length, 1);
  assert.equal(evidencePack.packs[0].do_not_claim.some(item => item.includes('Keyword hints')), true);
  assert.equal(evidencePack.packs[0].extraction_quality.main_article_allowed, true);
});

test('seed expansion source_extraction_ref uses actual pack index after blocked first seed', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const html = '<html><head><title>CameraX 1.6.1 release notes</title><meta name="datePublished" content="2026-05-15"></head><body>2026-05-15 CameraX 1.6.1 fixes Android camera stream validation.</body></html>';

  await runSeedEvidenceExpansion({
    root,
    date,
    manualPayload: {
      schema_version: 5,
      date,
      newsletter_date: date,
      candidates: []
    },
    collectionIntent: {
      payload: {
        schema_version: 1,
        newsletter_date: date,
        seed_urls: [
          {
            seed_id: 'seed-blocked',
            url: 'http://localhost/private',
            expected_topic: 'Blocked seed'
          },
          {
            seed_id: 'seed-camerax',
            url: 'https://developer.android.com/jetpack/androidx/releases/camera',
            expected_topic: 'CameraX release notes'
          }
        ],
        keyword_hints: []
      }
    },
    lookupImpl: publicLookup,
    fetchImpl: async (url) => htmlResponse({ status: 200, ok: true, url, body: html })
  });

  const seedPayload = readJson(seedCandidatesPath(root, date));
  assert.equal(seedPayload.candidates.length, 1);
  assert.equal(seedPayload.candidates[0].source_extraction_ref, 'seed-evidence-pack.json#/packs/0');
  const evidencePack = readJson(seedEvidencePackPath(root, date));
  assert.equal(evidencePack.packs.length, 1);
  assert.equal(evidencePack.packs[0].seed_id, 'seed-camerax');
});

test('failed linked evidence is excluded from usable compact evidence fields', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const linkedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#linked';
  const html = `<html><head><title>CameraX 1.6.1 release notes</title><meta name="datePublished" content="2026-05-15"></head><body>2026-05-15 CameraX 1.6.1 fixes Android camera stream validation. <a href="${linkedUrl}">Release notes</a></body></html>`;

  await runSeedEvidenceExpansion({
    root,
    date,
    manualPayload: {
      schema_version: 5,
      date,
      newsletter_date: date,
      candidates: []
    },
    collectionIntent: {
      payload: {
        schema_version: 1,
        newsletter_date: date,
        seed_urls: [{
          seed_id: 'seed-camerax',
          url: 'https://developer.android.com/jetpack/androidx/releases/camera',
          expected_topic: 'CameraX release notes'
        }],
        keyword_hints: []
      }
    },
    lookupImpl: publicLookup,
    fetchImpl: async (url) => {
      if (url.includes('#linked')) {
        throw new Error('blocked linked page');
      }
      return htmlResponse({ status: 200, ok: true, url, body: html });
    }
  });

  const [candidate] = readJson(seedCandidatesPath(root, date)).candidates;
  assert.deepEqual(candidate.linked_evidence_ids, []);
  assert.deepEqual(candidate.blocked_linked_evidence_ids, ['seed-camerax-linked-01']);
  assert.deepEqual(candidate.blocked_linked_evidence_urls, [linkedUrl]);
  assert.equal(candidate.compact_evidence.linked_context.length, 0);
  assert.equal(candidate.compact_evidence.evidence_urls.includes(linkedUrl), false);

  const evidencePack = readJson(seedEvidencePackPath(root, date));
  assert.equal(evidencePack.packs[0].linked_evidence[0].fetch_status, 'failed_or_blocked');
});

// #1006: seed 레인이 읽는 source_extraction 그룹 목록을 잠근다. release와 minor_line_context는
// 읽고 workflow는 읽지 않는 것이 현재 계약이며, 그렇게 두는 근거는 src/discovery/seed-evidence.js의
// sourceExtractionItems 위 주석에 있다. buildPrimaryEvidence와 seedCandidateFromEvidence는 이
// 계약을 단언하려고 노출한 테스트 전용 진입점이다. 공개 경로(runSeedEvidenceExpansion)로는
// 단언할 수 없는데, 그 경로는 seed 페이지 HTML을 parseSourceSpecificItems에 넣어 후보를 만들고
// 어떤 parser도 workflow 컨테이너를 만들지 않기 때문이다.
const workflowGroupSeed = {
  seed_id: 'seed-workflow',
  url: 'https://developer.android.com/jetpack/androidx/releases/camera'
};
const workflowGroupSource = {
  name: 'Android Developers Blog',
  category: 'android',
  reliability: 'official',
  sourceUrl: 'https://developer.android.com/'
};
const workflowItemText = 'Workflow paragraph describing an Android camera pipeline change.';
const workflowGroup = {
  sections: [{ title: 'What changed', items: [{ text: workflowItemText }] }]
};

function seedCandidateFor(candidate, primaryEvidence) {
  return seedCandidateFromEvidence({
    date: '2026-08-20',
    seed: workflowGroupSeed,
    source: workflowGroupSource,
    candidate,
    primaryEvidence,
    packIndex: 0
  });
}

test('seed primary evidence ignores the source_extraction.workflow group', () => {
  const candidate = {
    title: 'Dated blog article',
    url: 'https://developer.android.com/blog/dated-article',
    publishedAt: '2026-08-20',
    source_extraction: { workflow: workflowGroup }
  };

  const evidence = buildPrimaryEvidence(workflowGroupSeed, candidate, 0, workflowGroupSeed.url);

  assert.deepEqual(evidence.source_backed_items, []);

  const seedCandidate = seedCandidateFor(candidate, evidence);

  assert.deepEqual(seedCandidate.source_backed_items, []);
  assert.equal(seedCandidate.finalSelectionEligibility, 'watchlist');
  assert.equal(seedCandidate.final_selection_eligibility, 'watchlist');
  assert.equal(seedCandidate.source_gap_risk, true);
  assert.equal(seedCandidate.main_eligible, false);
});

test('workflow-only seed candidates fall back to summary and behavior_change', () => {
  const candidate = {
    title: 'Dated blog article',
    url: 'https://developer.android.com/blog/dated-article',
    publishedAt: '2026-08-20',
    summary: 'Page level summary sentence for the dated article.',
    behavior_change: 'Anchor sentence describing the behavior change.',
    source_extraction: { workflow: workflowGroup }
  };

  const evidence = buildPrimaryEvidence(workflowGroupSeed, candidate, 0, workflowGroupSeed.url);

  assert.deepEqual(evidence.source_backed_items, [
    'Page level summary sentence for the dated article.',
    'Anchor sentence describing the behavior change.'
  ]);
  assert.equal(evidence.source_backed_items.includes(workflowItemText), false);
});

test('seed primary evidence still reads release and minor_line_context groups', () => {
  const candidate = {
    title: 'CameraX 1.6.1 release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    publishedAt: '2026-08-20',
    summary: 'Fallback summary that must not win over source_extraction items.',
    source_extraction: {
      release: {
        version: 'CameraX 1.6.1',
        sections: [{ items: [{ text: 'Fixed CameraX stream validation.' }] }]
      },
      minor_line_context: {
        sections: [{ items: [{ source_text: 'Minor line note about buffer handling.' }] }]
      },
      workflow: workflowGroup
    }
  };

  const evidence = buildPrimaryEvidence(workflowGroupSeed, candidate, 0, workflowGroupSeed.url);

  assert.deepEqual(evidence.source_backed_items, [
    'Fixed CameraX stream validation.',
    'Minor line note about buffer handling.'
  ]);
  assert.equal(evidence.source_backed_items.includes(workflowItemText), false);
  assert.equal(evidence.evidence_granularity, 'structured_source_extraction');

  const seedCandidate = seedCandidateFor(candidate, evidence);

  assert.equal(seedCandidate.finalSelectionEligibility, 'short');
  assert.equal(seedCandidate.final_selection_eligibility, 'short');
  assert.equal(seedCandidate.source_gap_risk, false);
  assert.equal(seedCandidate.main_eligible, true);
  assert.equal(seedCandidate.version_or_release, 'CameraX 1.6.1');
  assert.deepEqual(seedCandidate.compact_evidence.primary_facts, [
    'Fixed CameraX stream validation.',
    'Minor line note about buffer handling.'
  ]);
});
