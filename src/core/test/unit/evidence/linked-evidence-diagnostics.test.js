const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  FETCH_STATUSES,
  IMPACT_TYPES,
  RAW_EXCERPT_MAX_LENGTH,
  analyzeLinkedEvidenceForCandidates,
  writeLinkedEvidenceDiagnosticsArtifacts
} = require('../../../../../scripts/newsroom/evidence');
const { buildShortlistReport } = require('../../../../../scripts/newsroom/generate/newsroom-selection');
const { candidate } = require('../../helpers/newsroom-builders');
const { readTextFixture } = require('../../helpers/fixture-loader');

function linkedCandidate(overrides = {}) {
  return candidate({
    title: 'Camera HAL metadata update',
    url: 'https://example.com/camera-hal-metadata',
    summary: [
      'Camera HAL capture result metadata behavior changes for stream buffers.',
      'Linked change: https://github.com/androidx/androidx/pull/1234.',
      'Extra context '.repeat(80)
    ].join(' '),
    api_or_component: 'Camera HAL metadata',
    behavior_change: 'Fixes capture result metadata behavior for stream buffers.',
    ...overrides
  });
}

function neutralLinkedCandidate(overrides = {}) {
  return candidate({
    title: 'Generic linked release note',
    url: 'https://example.com/generic-linked-release',
    summary: 'Release note with secondary context: https://example.com/secondary-evidence.',
    api_or_component: '',
    behavior_change: '',
    ...overrides
  });
}

function sourceAwareCandidate(overrides = {}) {
  return candidate({
    title: 'CameraX release source-aware links',
    url: 'https://android-developers.googleblog.com/2026/05/camerax-update.html',
    summary: 'CameraX release note row with preserved outgoing anchors.',
    source_linked_evidence_policy: {
      enabled: true,
      allowedDomains: ['developer.android.com', 'github.com'],
      importantAnchorKeywords: ['release notes', 'pull request'],
      ignoreAnchorKeywords: ['privacy', 'rss', 'share']
    },
    outgoing_links: [
      {
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
        text: 'CameraX release notes',
        source_field: 'rss.description',
        extraction_method: 'html_anchor',
        evidence_role: 'unclassified'
      },
      {
        url: 'https://developer.android.com/privacy',
        text: 'Privacy',
        source_field: 'html.body',
        extraction_method: 'html_anchor',
        evidence_role: 'unclassified'
      }
    ],
    ...overrides
  });
}

function fakeFetch(sequence) {
  const calls = [];
  const fetchClient = async (url, request = {}) => {
    calls.push({ url, request });
    const next = sequence.shift() || {};
    const status = next.status || 200;
    const headers = next.headers || {};
    return {
      ok: next.ok ?? (status >= 200 && status < 300),
      status,
      url: next.url || url,
      headers: {
        get(name) {
          const key = String(name || '').toLowerCase();
          if (key === 'location' && next.location) return next.location;
          const match = Object.entries(headers).find(([header]) => header.toLowerCase() === key);
          return match ? match[1] : null;
        }
      },
      text: async () => next.body || ''
    };
  };
  fetchClient.calls = calls;
  return fetchClient;
}

test('linked evidence diagnostics produce candidate-safe summary and report-only payload', async () => {
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [linkedCandidate()]);
  const [safeCandidate] = diagnostics.candidates;
  const [reportCandidate] = diagnostics.report.candidates;

  assert.equal(diagnostics.report.schema_version, 1);
  assert.equal(diagnostics.report.enable_network, false);
  assert.deepEqual(diagnostics.report.warnings, []);
  assert.equal(diagnostics.report.candidate_count, 1);
  assert.equal(safeCandidate.linked_evidence_summary.schema_version, 1);
  assert.equal(safeCandidate.impact_classification.impact_type, IMPACT_TYPES.RUNTIME_BEHAVIOR_CHANGE);
  assert.equal(safeCandidate.impact_classification.recommended_article_type, 'main');
  assert.equal(safeCandidate.linked_evidence, undefined);
  assert.equal(safeCandidate.resolved, undefined);
  assert.equal(safeCandidate.raw_excerpt, undefined);
  assert.equal(Array.isArray(reportCandidate.linked_evidence), true);
  assert.equal(reportCandidate.linked_evidence[0].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.ok(reportCandidate.linked_evidence[0].raw_excerpt.length <= RAW_EXCERPT_MAX_LENGTH);
  assert.equal(reportCandidate.linked_evidence_summary.by_fetch_status[FETCH_STATUSES.SKIPPED], 1);
  assert.ok(diagnostics.report.totals.top_identifiers.length > 0);
  assert.equal(Array.isArray(diagnostics.eventBundleArtifact.event_bundles), true);
  assert.equal(safeCandidate.event_bundles, undefined);
});

test('linked evidence diagnostics failures are isolated per candidate', async () => {
  const cases = [
    {
      label: 'extract',
      options: {
        extractLinkedEvidenceFromCandidate() {
          throw new Error('forced extract failure');
        }
      }
    },
    {
      label: 'resolve',
      options: {
        async resolveLinkedEvidence() {
          throw new Error('forced resolve failure');
        }
      }
    },
    {
      label: 'classify',
      options: {
        classifyLinkedEvidenceImpact() {
          throw new Error('forced classify failure');
        }
      }
    }
  ];

  for (const { label, options } of cases) {
    const diagnostics = await analyzeLinkedEvidenceForCandidates(
      '2026-05-10',
      [linkedCandidate({ title: `Camera HAL ${label}`, url: `https://example.com/${label}` })],
      options
    );
    const [safeCandidate] = diagnostics.candidates;
    const [reportCandidate] = diagnostics.report.candidates;

    assert.equal(safeCandidate.linked_evidence_summary.total_count, 0);
    assert.equal(safeCandidate.impact_classification.impact_type, IMPACT_TYPES.UNKNOWN);
    assert.match(safeCandidate.impact_classification.warnings[0], /linked_evidence_diagnostics_failed/);
    assert.deepEqual(reportCandidate.linked_evidence, []);
    assert.match(diagnostics.report.warnings[0], /linked_evidence_diagnostics_failed/);
  }
});

test('linked evidence diagnostics create empty artifacts for zero candidates', async () => {
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', []);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linked-evidence-diagnostics-'));

  writeLinkedEvidenceDiagnosticsArtifacts(tempDir, diagnostics);

  const reportPath = path.join(tempDir, 'linked-evidence-report.json');
  const markdownPath = path.join(tempDir, 'linked-evidence-diagnostics.md');
  const eventBundlesPath = path.join(tempDir, 'event-bundles.json');
  const eventBundleMarkdownPath = path.join(tempDir, 'event-bundle-diagnostics.md');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const eventBundleArtifact = JSON.parse(fs.readFileSync(eventBundlesPath, 'utf8'));
  const eventBundleMarkdown = fs.readFileSync(eventBundleMarkdownPath, 'utf8');

  assert.equal(report.candidate_count, 0);
  assert.equal(report.totals.total_count, 0);
  assert.deepEqual(report.candidates, []);
  assert.match(markdown, /- candidate_count: 0/);
  assert.match(markdown, /- none/);
  assert.deepEqual(eventBundleArtifact.event_bundles, []);
  assert.match(eventBundleMarkdown, /# Event Bundle Diagnostics/);
});

test('linked evidence diagnostics creates Event Bundle artifact without changing safe candidates', async () => {
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate({
    source_id: 'camerax-release-notes',
    version_or_release: 'CameraX 1.6.1',
    published_date: '2026-05-06',
    api_or_component: 'CameraX / androidx.camera',
    source_extraction: {
      release: {
        version: 'CameraX 1.6.1',
        date: '2026-05-06',
        component: 'CameraX / androidx.camera'
      }
    }
  })]);
  const [safeCandidate] = diagnostics.candidates;
  const [bundle] = diagnostics.eventBundleArtifact.event_bundles;

  assert.equal(safeCandidate.event_bundles, undefined);
  assert.equal(diagnostics.report.event_bundle_summary.total_count, 1);
  assert.equal(diagnostics.eventBundleArtifact.summary.total_count, 1);
  assert.equal(bundle.dedupe_reason, 'source_id + release.version');
  assert.equal(bundle.release.version, 'CameraX 1.6.1');
  assert.deepEqual(bundle.evidence_urls, []);
  assert.match(diagnostics.eventBundleMarkdown, /source_id \+ release\.version/);
});

test('source-aware outgoing link diagnostics default to extract_only without fetching', async () => {
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate()]);
  const [safeCandidate] = diagnostics.candidates;
  const [reportCandidate] = diagnostics.report.candidates;

  assert.equal(diagnostics.report.linked_evidence_mode, 'extract_only');
  assert.equal(diagnostics.report.enable_network, false);
  assert.equal(safeCandidate.linked_evidence_summary.total_count, 0);
  assert.equal(reportCandidate.classified_outgoing_links[0].evidence_role, 'primary_evidence');
  assert.equal(reportCandidate.classified_outgoing_links[0].skipped_reason, 'mode_extract_only');
  assert.equal(reportCandidate.classified_outgoing_links[1].evidence_role, 'noise');
  assert.equal(reportCandidate.classified_outgoing_links[1].skipped_reason, 'ignored_by_policy');
  assert.equal(reportCandidate.source_aware_linked_evidence_summary.total_count, 2);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].skipped_reason, 'mode_extract_only');
  assert.equal(diagnostics.report.source_aware_totals.by_fetch_status[FETCH_STATUSES.SKIPPED], 2);
});

test('source-aware outgoing link diagnostics resolve only allowed official https links in resolve mode', async () => {
  const fetchClient = fakeFetch([{ body: readTextFixture('linked-evidence/github-pr-resolved.html') }]);
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate()], {
    linkedEvidenceMode: 'resolve_allowed_official_links',
    fetchClient,
    maxLinksPerCandidate: 8,
    maxLinksPerRun: 8,
    timeoutMs: 5000,
    maxBytes: 200000
  });
  const [reportCandidate] = diagnostics.report.candidates;

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1');
  assert.equal(diagnostics.report.enable_network, true);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].fetch_status, FETCH_STATUSES.RESOLVED);
  assert.equal(reportCandidate.source_aware_linked_evidence[1].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(reportCandidate.source_aware_linked_evidence[1].skipped_reason, 'ignored_by_policy');
  assert.equal(reportCandidate.source_aware_linked_evidence_summary.by_fetch_status[FETCH_STATUSES.RESOLVED], 1);
  assert.equal(reportCandidate.source_aware_linked_evidence_summary.by_fetch_status[FETCH_STATUSES.SKIPPED], 1);
});

test('source-aware outgoing link diagnostics reject redirects that are no longer primary evidence', async () => {
  const fetchClient = fakeFetch([{
    status: 302,
    location: 'https://developer.android.com/about'
  }]);
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate()], {
    linkedEvidenceMode: 'resolve_allowed_official_links',
    fetchClient,
    maxLinksPerCandidate: 8,
    maxLinksPerRun: 8,
    timeoutMs: 5000,
    maxBytes: 200000
  });
  const [reportCandidate] = diagnostics.report.candidates;

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].skipped_reason, 'redirect_not_primary_evidence');
  assert.equal(reportCandidate.source_aware_linked_evidence[1].skipped_reason, 'ignored_by_policy');
});

test('source-aware offline fixture mode requires an injected fetch client', async () => {
  const skipped = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate()], {
    linkedEvidenceMode: 'offline_fixture_test'
  });
  const [skippedCandidate] = skipped.report.candidates;
  assert.equal(skipped.report.enable_network, false);
  assert.equal(
    skippedCandidate.source_aware_linked_evidence[0].skipped_reason,
    'offline_fixture_fetch_client_missing'
  );

  const fetchClient = fakeFetch([{ body: readTextFixture('linked-evidence/github-pr-resolved.html') }]);
  const resolved = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate()], {
    linkedEvidenceMode: 'offline_fixture_test',
    fetchClient
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(resolved.report.enable_network, true);
  assert.equal(
    resolved.report.candidates[0].source_aware_linked_evidence[0].fetch_status,
    FETCH_STATUSES.RESOLVED
  );
});

test('source-aware outgoing link diagnostics never fetch http links', async () => {
  const fetchClient = fakeFetch([{ body: '<title>Should not fetch http</title>' }]);
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [sourceAwareCandidate({
    outgoing_links: [{
      url: 'http://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      text: 'CameraX release notes',
      source_field: 'rss.description',
      extraction_method: 'html_anchor',
      evidence_role: 'unclassified'
    }]
  })], {
    linkedEvidenceMode: 'resolve_allowed_official_links',
    fetchClient
  });
  const [reportCandidate] = diagnostics.report.candidates;

  assert.equal(fetchClient.calls.length, 0);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(reportCandidate.source_aware_linked_evidence[0].skipped_reason, 'non_https_url');
});

test('source-aware outgoing link diagnostics enforce max total links per run', async () => {
  const fetchClient = fakeFetch([
    { body: readTextFixture('linked-evidence/github-pr-resolved.html') },
    { body: '<title>Should not fetch over run limit</title>' }
  ]);
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', [
    sourceAwareCandidate({
      title: 'CameraX source-aware first',
      url: 'https://android-developers.googleblog.com/2026/05/camerax-first.html',
      outgoing_links: [{
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
        text: 'CameraX release notes',
        source_field: 'rss.description',
        extraction_method: 'html_anchor',
        evidence_role: 'unclassified'
      }]
    }),
    sourceAwareCandidate({
      title: 'CameraX source-aware second',
      url: 'https://android-developers.googleblog.com/2026/05/camerax-second.html',
      outgoing_links: [{
        url: 'https://github.com/androidx/androidx/pull/1234',
        text: 'pull request',
        source_field: 'html.body',
        extraction_method: 'html_anchor',
        evidence_role: 'unclassified'
      }]
    })
  ], {
    linkedEvidenceMode: 'resolve_allowed_official_links',
    fetchClient,
    maxLinksPerCandidate: 8,
    maxLinksPerRun: 1
  });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(diagnostics.report.candidates[0].source_aware_linked_evidence[0].fetch_status, FETCH_STATUSES.RESOLVED);
  assert.equal(diagnostics.report.candidates[1].source_aware_linked_evidence[0].fetch_status, FETCH_STATUSES.SKIPPED);
  assert.equal(
    diagnostics.report.candidates[1].source_aware_linked_evidence[0].skipped_reason,
    'max_links_per_run_exceeded'
  );
});

test('neutral linked evidence summary does not change deterministic selection scores or order', async () => {
  const baseCandidates = [
    neutralLinkedCandidate({ title: 'Generic linked release A', url: 'https://example.com/a' }),
    neutralLinkedCandidate({ title: 'Generic linked release B', url: 'https://example.com/b', camera_hal_relevance_score: 80 })
  ];
  const diagnostics = await analyzeLinkedEvidenceForCandidates('2026-05-10', baseCandidates);
  const baseReport = buildShortlistReport('2026-05-10', baseCandidates, { minArticles: 1 });
  const enrichedReport = buildShortlistReport('2026-05-10', diagnostics.candidates, { minArticles: 1 });

  assert.deepEqual(
    enrichedReport.shortlisted_candidates.map(item => item.url),
    baseReport.shortlisted_candidates.map(item => item.url)
  );
  assert.deepEqual(
    enrichedReport.shortlisted_candidates.map(item => item.deterministic_score),
    baseReport.shortlisted_candidates.map(item => item.deterministic_score)
  );
  assert.deepEqual(enrichedReport.selection_errors, baseReport.selection_errors);
});
