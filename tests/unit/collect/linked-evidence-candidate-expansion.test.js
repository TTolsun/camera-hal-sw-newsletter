const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectExpansionLinks,
  selectNewsworthyLinks,
  buildDerivedCandidates,
  expandLinkedEvidenceCandidates
} = require('../../../scripts/newsroom/collect/linked-evidence-candidate-expansion');

function sourceRegistry() {
  return {
    sources: [
      {
        id: 'android-developers-blog',
        name: 'Android Developers Blog',
        sourceUrl: 'https://android-developers.googleblog.com/',
        reliability: 'official',
        category: 'android'
      },
      {
        id: 'androidx-camerax-release',
        name: 'CameraX Release Notes',
        sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
        reliability: 'official',
        category: 'android'
      }
    ]
  };
}

function manualCandidates() {
  return [
    {
      id: 'manual-1',
      title: 'Google I/O recap for Android developers',
      url: 'https://android-developers.googleblog.com/2026/05/io-recap.html',
      source: 'Android Developers Blog',
      sourceUrl: 'https://android-developers.googleblog.com/',
      outgoing_links: [
        {
          url: 'https://developer.android.com/jetpack/androidx/releases/camera',
          text: 'CameraX release notes',
          source_field: 'rss.body',
          extraction_method: 'html_anchor'
        },
        {
          url: 'https://github.com/androidx/androidx/releases/tag/camera-1.5.0',
          text: 'GitHub release',
          source_field: 'rss.body',
          extraction_method: 'html_anchor'
        },
        {
          url: 'https://example.com/privacy',
          text: 'Privacy policy',
          source_field: 'rss.body',
          extraction_method: 'html_anchor'
        },
        {
          url: 'https://random-blog.example.net/some-post',
          text: 'Unrelated blog post',
          source_field: 'rss.body',
          extraction_method: 'html_anchor'
        },
        {
          url: 'https://android-developers.googleblog.com/2026/05/existing.html',
          text: 'An already collected article',
          source_field: 'rss.body',
          extraction_method: 'html_anchor'
        }
      ]
    },
    {
      id: 'manual-2',
      title: 'An already collected article',
      url: 'https://android-developers.googleblog.com/2026/05/existing.html',
      source: 'Android Developers Blog',
      sourceUrl: 'https://android-developers.googleblog.com/',
      outgoing_links: [
        {
          url: 'https://developer.android.com/jetpack/androidx/releases/camera',
          text: 'CameraX release notes (again)',
          source_field: 'rss.body',
          extraction_method: 'html_anchor'
        }
      ]
    }
  ];
}

test('collectExpansionLinks keeps allowed evidence links and drops noise/unsupported/known links', () => {
  const { links, manualUrlSet } = collectExpansionLinks(manualCandidates(), sourceRegistry());

  const urls = links.map(link => link.url);
  assert.ok(urls.includes('https://developer.android.com/jetpack/androidx/releases/camera'));
  assert.ok(urls.includes('https://github.com/androidx/androidx/releases/tag/camera-1.5.0'));

  // privacy link is NOISE, random domain is UNSUPPORTED, both dropped
  assert.ok(!urls.some(url => url.includes('example.com/privacy')));
  assert.ok(!urls.some(url => url.includes('random-blog.example.net')));

  // link that is already a manual candidate URL is dropped
  assert.ok(!urls.some(url => url.includes('2026/05/existing.html')));

  // the CameraX link appears in both candidates but is deduped to one entry
  assert.equal(urls.filter(url => url.includes('releases/camera')).length, 1);

  assert.ok(manualUrlSet.has('https://android-developers.googleblog.com/2026/05/existing.html'));
});

function releaseLinks(prefix, count) {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://github.com/androidx/androidx/releases/tag/${prefix}-${i}`,
    text: `${prefix} release ${i}`,
    source_field: 'rss.body',
    extraction_method: 'html_anchor'
  }));
}

test('collectExpansionLinks caps links per candidate', () => {
  const perCandidate = collectExpansionLinks(
    [{ id: 'c1', title: 'one', url: 'https://android-developers.googleblog.com/2026/05/one.html', outgoing_links: releaseLinks('camera', 12) }],
    sourceRegistry(),
    { maxLinksPerCandidate: 5, maxLinksPerRun: 100 }
  );
  assert.equal(perCandidate.links.length, 5);
});

test('collectExpansionLinks caps total links per run across candidates', () => {
  const perRun = collectExpansionLinks(
    [
      { id: 'c1', title: 'one', url: 'https://android-developers.googleblog.com/2026/05/one.html', outgoing_links: releaseLinks('a', 6) },
      { id: 'c2', title: 'two', url: 'https://android-developers.googleblog.com/2026/05/two.html', outgoing_links: releaseLinks('b', 6) }
    ],
    sourceRegistry(),
    { maxLinksPerCandidate: 50, maxLinksPerRun: 3 }
  );
  assert.equal(perRun.links.length, 3);
});

test('collectExpansionLinks attaches parent lineage and link context', () => {
  const { links } = collectExpansionLinks(manualCandidates(), sourceRegistry());
  const cameraLink = links.find(link => link.url.includes('releases/camera'));

  assert.equal(cameraLink.parent_candidate_id, 'manual-1');
  assert.equal(cameraLink.parent_url, 'https://android-developers.googleblog.com/2026/05/io-recap.html');
  assert.equal(cameraLink.link_context, 'CameraX release notes');
  assert.ok(['primary_evidence', 'secondary_context'].includes(cameraLink.evidence_role));
});

test('selectNewsworthyLinks returns only links the model marks newsworthy', async () => {
  const { links } = collectExpansionLinks(manualCandidates(), sourceRegistry());
  const calls = [];
  const callLlmJsonBudgetedImpl = async (stage, system, prompt, schema, options) => {
    calls.push({ stage, options });
    return {
      selections: [
        {
          url: 'https://developer.android.com/jetpack/androidx/releases/camera',
          is_newsworthy: true,
          reason: 'New CameraX behavior relevant to Camera HAL.',
          suggested_article_type: 'release'
        },
        {
          url: 'https://github.com/androidx/androidx/releases/tag/camera-1.5.0',
          is_newsworthy: false,
          reason: 'Duplicate of release notes.'
        }
      ]
    };
  };

  const selected = await selectNewsworthyLinks({ date: '2026-06-08', links, callLlmJsonBudgetedImpl, budget: {} });

  assert.equal(calls[0].stage, 'sourceDiscovery');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].url, 'https://developer.android.com/jetpack/androidx/releases/camera');
  assert.equal(selected[0].selection_reason, 'New CameraX behavior relevant to Camera HAL.');
});

test('selectNewsworthyLinks is non-failing on empty input and on model error', async () => {
  const empty = await selectNewsworthyLinks({ date: '2026-06-08', links: [], callLlmJsonBudgetedImpl: async () => ({}) });
  assert.deepEqual(empty, []);

  const { links } = collectExpansionLinks(manualCandidates(), sourceRegistry());
  const throwing = await selectNewsworthyLinks({
    date: '2026-06-08',
    links,
    callLlmJsonBudgetedImpl: async () => { throw new Error('llm down'); }
  });
  assert.deepEqual(throwing, []);
});

test('buildDerivedCandidates produces gemini_linked_discovery candidates bound to the registry source', () => {
  const selected = [
    {
      url: 'https://developer.android.com/jetpack/androidx/releases/camera',
      link_context: 'CameraX release notes',
      parent_candidate_id: 'manual-1',
      parent_url: 'https://android-developers.googleblog.com/2026/05/io-recap.html',
      parent_title: 'Google I/O recap for Android developers',
      evidence_role: 'primary_evidence',
      extraction_method: 'html_anchor',
      selection_reason: 'New CameraX behavior relevant to Camera HAL.'
    }
  ];

  const derived = buildDerivedCandidates(selected, sourceRegistry());

  assert.equal(derived.length, 1);
  const candidate = derived[0];
  assert.equal(candidate.origin, 'gemini_linked_discovery');
  assert.equal(candidate.url, 'https://developer.android.com/jetpack/androidx/releases/camera');
  assert.equal(candidate.derived_from_url, 'https://android-developers.googleblog.com/2026/05/io-recap.html');
  assert.equal(candidate.parent_candidate_id, 'manual-1');
  assert.equal(candidate.anchorText, 'CameraX release notes');
  assert.equal(candidate.source_id, 'androidx-camerax-release');
  assert.equal(candidate.source, 'CameraX Release Notes');
  assert.equal(candidate.source_extraction.mode, 'gemini_linked_discovery');
});

test('buildDerivedCandidates dedupes by canonical url', () => {
  const selected = [
    { url: 'https://developer.android.com/jetpack/androidx/releases/camera', link_context: 'a', parent_candidate_id: 'm1', parent_url: 'https://x/1' },
    { url: 'https://developer.android.com/jetpack/androidx/releases/camera/', link_context: 'b', parent_candidate_id: 'm2', parent_url: 'https://x/2' }
  ];
  const derived = buildDerivedCandidates(selected, sourceRegistry());
  assert.equal(derived.length, 1);
});

test('expandLinkedEvidenceCandidates reports FOUND status and returns derived candidates', async () => {
  const callLlmJsonBudgetedImpl = async () => ({
    selections: [
      {
        url: 'https://developer.android.com/jetpack/androidx/releases/camera',
        is_newsworthy: true,
        reason: 'relevant'
      }
    ]
  });

  const result = await expandLinkedEvidenceCandidates({
    date: '2026-06-08',
    manualCandidates: manualCandidates(),
    sourceRegistry: sourceRegistry(),
    callLlmJsonBudgetedImpl,
    budget: {},
    enabled: true
  });

  assert.equal(result.stats.linked_discovery_status, 'FOUND_DERIVED_CANDIDATES');
  assert.equal(result.derivedCandidates.length, 1);
  assert.ok(result.stats.derived_candidate_count >= 1);
});

test('expandLinkedEvidenceCandidates is non-failing and reports NO_NEW when nothing newsworthy', async () => {
  const callLlmJsonBudgetedImpl = async () => ({ selections: [] });

  const result = await expandLinkedEvidenceCandidates({
    date: '2026-06-08',
    manualCandidates: manualCandidates(),
    sourceRegistry: sourceRegistry(),
    callLlmJsonBudgetedImpl,
    budget: {},
    enabled: true
  });

  assert.equal(result.derivedCandidates.length, 0);
  assert.equal(result.stats.linked_discovery_status, 'NO_NEW_DERIVED_CANDIDATES');
});

test('expandLinkedEvidenceCandidates short-circuits when disabled', async () => {
  let called = false;
  const result = await expandLinkedEvidenceCandidates({
    date: '2026-06-08',
    manualCandidates: manualCandidates(),
    sourceRegistry: sourceRegistry(),
    callLlmJsonBudgetedImpl: async () => { called = true; return {}; },
    enabled: false
  });

  assert.equal(called, false);
  assert.equal(result.derivedCandidates.length, 0);
  assert.equal(result.stats.linked_discovery_status, 'DISABLED');
});
