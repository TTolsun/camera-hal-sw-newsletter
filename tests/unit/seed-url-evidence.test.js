const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertPublicHttpsUrl,
  fetchPublicText,
  mergeSeedCandidates,
  runSeedEvidenceExpansion
} = require('../../scripts/newsroom/collect/seed-evidence');
const {
  seedCandidatesPath,
  seedEvidencePackPath,
  seedFetchReportPath,
  seedMergeReportPath
} = require('../../scripts/newsroom/common/artifact-paths');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-url-evidence-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'news-sources.json'), JSON.stringify({
    schemaVersion: 2,
    sources: [{
      id: 'android',
      name: 'Android Developers',
      sourceUrl: 'https://developer.android.com/',
      category: 'android',
      priority: 'high',
      reliability: 'official',
      linkedEvidencePolicy: {
        enabled: true,
        allowedDomains: ['developer.android.com']
      }
    }]
  }, null, 2), 'utf8');
  return root;
}

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
