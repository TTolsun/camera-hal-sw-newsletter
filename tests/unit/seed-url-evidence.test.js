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
});

test('seed fetch validates redirect target as public https', async () => {
  await assert.rejects(
    () => fetchPublicText(
      async () => ({
        ok: true,
        url: 'https://192.168.0.10/private',
        text: async () => 'private target'
      }),
      'https://example.com/news',
      { lookupImpl: publicLookup }
    ),
    /blocked_internal_host/
  );
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
