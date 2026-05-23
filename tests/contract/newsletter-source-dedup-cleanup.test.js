const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  applyCleanupPlan,
  buildCleanupPlan,
  buildPostCleanupReport,
  mergeDonorIntoSection,
  normalizeNewsSourceKey
} = require('../../scripts/newsroom/common/newsletter-source-dedup-cleanup');
const {
  normalizeNewsSourceKey: normalizePureNewsSourceKey
} = require('../../scripts/newsroom/common/source-url-key');
const {
  readJson,
  tempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');

function source(url) {
  return { title: 'Source article', url };
}

function section(headline, url, overrides = {}) {
  return {
    category: headline,
    headline,
    confirmed_facts: [`${headline} fact`],
    what_changed: `${headline} changed camera-relevant behavior.`,
    background: `${headline} background for Camera HAL readers.`,
    camera_hal_perspective: `${headline} should be checked inside source-backed HAL boundaries.`,
    camera_hal_checks: [`Check ${headline} source-bound behavior.`],
    action_items: [`Review ${headline} within 2 weeks with the owning team.`],
    article_sections: {
      verified_facts: [`${headline} verified fact`],
      background_context: `${headline} background context`,
      hal_driver_impact: `${headline} HAL impact boundary`,
      action_items: [`Review ${headline} source-bound behavior.`],
      team_share_points: `${headline} team share point`
    },
    relevance_bucket: 'direct_aosp_camera',
    counts_as_primary_camera_topic: true,
    sources: [source(url)],
    public_article: {
      headline,
      lead: `${headline} lead`,
      body_paragraphs: [`${headline} paragraph one`, `${headline} paragraph two`],
      camera_hal_takeaway: `${headline} takeaway`,
      reader_checkpoints: [`${headline} checkpoint`],
      source_links: [source(url)]
    },
    ...overrides
  };
}

function issue(date, sections) {
  return {
    date,
    title: `Newsletter ${date}`,
    summary: `Summary ${date}`,
    briefing: ['one', 'two', 'three'],
    sections,
    references: sections.flatMap(item => item.sources).map(item => ({ title: item.title, url: item.url })),
    publication_mode: 'review_only',
    homepage_visibility: 'normal'
  };
}

function writeIssue(root, date, sections) {
  const value = issue(date, sections);
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), value);
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), `# ${date}\n`);
  writeText(path.join(root, 'newsletters', date, 'index.html'), '<!doctype html><html></html>');
}

function writeIndex(root, dates) {
  writeJson(path.join(root, 'data', 'newsletters.json'), dates.map(date => ({
    date,
    title: `Newsletter ${date}`,
    summary: `Summary ${date}`,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL']
  })));
}

function assertNoPublicCleanupTerms(value, label) {
  const forbidden = [
    /survivor article/i,
    /\bdonor\b/i,
    /중복 issue/i,
    /\bcleanup\b/i,
    /source-backed/i,
    /구조화 필드/i,
    /cpp_ai_tooling_fallback/i,
    /source_dedup/i,
    /중복 News Source/i,
    /중복 source/i,
    /deterministic reconstruction/i,
    /normal publishable coverage/i,
    /section repair/i
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(value), false, `${label} exposes internal cleanup term: ${pattern}`);
  }
}

test('normalizeNewsSourceKey applies the cleanup source identity contract', () => {
  assert.equal(
    normalizeNewsSourceKey(' HTTPS://Example.COM:443/CameraX/?utm_source=x&b=2&a=1#section ').key,
    'https://example.com/CameraX?a=1&b=2'
  );
  assert.equal(
    normalizeNewsSourceKey('https://example.com/releases#1.6.1').key,
    'https://example.com/releases#1.6.1'
  );
  assert.equal(
    normalizeNewsSourceKey('https://example.com/releases#1.4.0-alpha07').key,
    'https://example.com/releases#1.4.0-alpha07'
  );
  assert.equal(
    normalizeNewsSourceKey('https://developer.android.com/jetpack/androidx/releases/camera#1.6.1').key,
    'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  );
  assert.equal(
    normalizeNewsSourceKey('https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07').key,
    'https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07'
  );
  assert.equal(
    normalizeNewsSourceKey('https://example.com/blog#overview').key,
    'https://example.com/blog'
  );
  assert.equal(
    normalizeNewsSourceKey('https://example.com/CameraX').key === normalizeNewsSourceKey('https://example.com/camerax').key,
    false
  );
  const duplicateQuery = normalizeNewsSourceKey('https://example.com/a?id=2&id=1&utm_campaign=x');
  assert.equal(duplicateQuery.key, 'https://example.com/a?id=2&id=1');
  assert.equal(duplicateQuery.warnings.some(item => item.type === 'duplicate_query_key'), true);
  assert.equal(
    normalizePureNewsSourceKey('https://example.com/a?a=1&b=2&a=3&c=4&utm_source=x').key,
    'https://example.com/a?a=1&a=3&b=2&c=4'
  );
  assert.equal(
    normalizePureNewsSourceKey(normalizePureNewsSourceKey('https://example.com/a?b=2&a=1').key).key,
    'https://example.com/a?a=1&b=2'
  );
  assert.equal(
    normalizePureNewsSourceKey('https://example.com/a?A=1&a=2').key,
    'https://example.com/a?A=1&a=2'
  );
  assert.equal(
    normalizePureNewsSourceKey('https://example.com/a?a=2&A=1').key,
    'https://example.com/a?A=1&a=2'
  );
});

test('cleanup plan blocks duplicate groups with parse-failed URLs', () => {
  const root = tempRoot('source-dedup-parse-fail-');
  writeIndex(root, ['2026-05-01', '2026-05-02']);
  writeIssue(root, '2026-05-01', [section('Old invalid', 'not a url')]);
  writeIssue(root, '2026-05-02', [section('New invalid', 'not a url')]);

  const plan = buildCleanupPlan({
    root,
    expectedExposedDates: ['2026-05-02']
  });
  assert.equal(plan.ok, false);
  assert.match(plan.errors.join('\n'), /Parse-failed URL/);
});

test('cleanup plan chooses the newest indexed survivor and removes zero-article issue', () => {
  const root = tempRoot('source-dedup-survivor-');
  writeIndex(root, ['2026-05-01', '2026-05-02']);
  writeIssue(root, '2026-05-01', [section('Old CameraX', 'https://example.com/releases#1.6.1')]);
  writeIssue(root, '2026-05-02', [section('New CameraX', 'https://example.com/releases#1.6.1')]);

  const plan = buildCleanupPlan({
    root,
    expectedExposedDates: ['2026-05-02']
  });
  assert.equal(plan.ok, true, plan.errors.join('\n'));
  assert.deepEqual(plan.zero_article_issues, ['2026-05-01']);
  assert.equal(plan.duplicate_groups[0].survivor.date, '2026-05-02');
});

test('merge keeps donor public prose out and preserves structured provenance', () => {
  const survivor = section('Survivor', 'https://example.com/source');
  const donorRecord = {
    date: '2026-05-01',
    section_index: 1,
    headline: 'Donor',
    section: section('Donor', 'https://example.com/source', {
      sources: [
        source('https://example.com/other'),
        source('https://example.com/source')
      ],
      action_items: ['MERGE MATCHED SOURCE ACTION'],
      public_article: {
        headline: 'Donor',
        lead: 'DO NOT APPEND DONOR PUBLIC PROSE',
        body_paragraphs: ['DO NOT APPEND DONOR PUBLIC PROSE', 'second'],
        camera_hal_takeaway: 'DO NOT APPEND DONOR PUBLIC PROSE',
        reader_checkpoints: ['DO NOT APPEND DONOR PUBLIC PROSE'],
        source_links: [source('https://example.com/source')]
      }
    })
  };
  mergeDonorIntoSection(survivor, donorRecord, 'https://example.com/source');
  assert.equal(JSON.stringify(survivor.public_article).includes('DO NOT APPEND'), false);
  assert.equal(survivor.confirmed_facts.some(item => /Donor fact/.test(item)), true);
  assert.equal(survivor.source_dedup_merge_provenance[0].merged_from_date, '2026-05-01');
  assert.equal(survivor.source_dedup_merge_provenance[0].merged_from_source_url, 'https://example.com/source');
  assert.equal(survivor.action_items.includes('MERGE MATCHED SOURCE ACTION'), true);
});

test('interpretation fields without source binding are not merged', () => {
  const survivor = section('Survivor', 'https://example.com/source');
  const donorRecord = {
    date: '2026-05-01',
    section_index: 1,
    headline: 'Donor without source',
    section: {
      headline: 'Donor without source',
      confirmed_facts: ['source-less fact'],
      action_items: ['UNBOUND ACTION MUST NOT MERGE'],
      camera_hal_checks: ['UNBOUND CHECK MUST NOT MERGE'],
      camera_hal_perspective: 'UNBOUND PERSPECTIVE MUST NOT MERGE',
      sources: []
    }
  };
  mergeDonorIntoSection(survivor, donorRecord, 'source-less');
  assert.equal(JSON.stringify(survivor.action_items).includes('UNBOUND ACTION'), false);
  assert.equal(JSON.stringify(survivor.camera_hal_checks).includes('UNBOUND CHECK'), false);
  assert.equal(survivor.camera_hal_perspective.includes('UNBOUND PERSPECTIVE'), false);
  assert.equal(survivor.confirmed_facts.includes('source-less fact'), true);
});

test('apply cleanup removes orphan artifacts and post invariants catch drift', () => {
  const root = tempRoot('source-dedup-apply-');
  writeIndex(root, ['2026-05-01', '2026-05-02']);
  writeIssue(root, '2026-05-01', [section('Old source', 'https://example.com/a')]);
  writeIssue(root, '2026-05-02', [
    section('New source', 'https://example.com/a', {
      public_article: {
        headline: 'New source',
        lead: 'Curated New source lead for public readers.',
        body_paragraphs: [
          'Curated New source paragraph one.',
          'Curated New source paragraph two.'
        ],
        camera_hal_takeaway: 'Curated New source takeaway.',
        reader_checkpoints: [
          'Curated New source checkpoint.',
          'Curated New source second checkpoint.'
        ],
        source_links: [source('https://example.com/a')]
      }
    }),
    section('Sidecar source', 'https://example.com/b', {
      public_article: {
        headline: 'Sidecar source',
        lead: 'Curated Sidecar source lead for public readers.',
        body_paragraphs: [
          'Curated Sidecar source paragraph one.',
          'Curated Sidecar source paragraph two.'
        ],
        camera_hal_takeaway: 'Curated Sidecar source takeaway.',
        reader_checkpoints: [
          'Curated Sidecar source checkpoint.',
          'Curated Sidecar source second checkpoint.'
        ],
        source_links: [source('https://example.com/b')]
      }
    })
  ]);
  writeText(path.join(root, 'content', 'collected-news', '2026-05-01', 'candidates.json'), '[]\n');
  writeText(path.join(root, 'index.html'), '<div id="archive-list"></div>');

  const result = applyCleanupPlan({
    root,
    expectedExposedDates: ['2026-05-02']
  });
  assert.deepEqual(readJson(path.join(root, 'data', 'newsletters.json')).map(item => item.date), ['2026-05-02']);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', '2026-05-01')), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', '2026-05-01')), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'collected-news', '2026-05-01')), false);
  assert.equal(result.postRunReport.ok, true, result.postRunReport.errors.join('\n'));
  const issue = readJson(path.join(root, 'content', 'newsroom', '2026-05-02', 'editor-draft.json'));
  assert.equal(issue.sections[0].public_article.lead, 'Curated New source lead for public readers.');
  assert.equal(issue.sections[1].public_article.lead, 'Curated Sidecar source lead for public readers.');
  assert.equal(issue.briefing[0], 'Curated New source lead for public readers.');
  assert.equal(issue.briefing[1], 'Curated Sidecar source lead for public readers.');
  assert.equal(issue.briefing[2].includes('공통 확인'), false);
  assert.match(issue.briefing[2], /Curated New source checkpoint/);
  assert.match(issue.briefing[2], /Curated Sidecar source checkpoint/);

  const publicSurfaces = {
    'data/newsletters.json': JSON.stringify(readJson(path.join(root, 'data', 'newsletters.json'))),
    'editor-draft.md': fs.readFileSync(path.join(root, 'content', 'newsroom', '2026-05-02', 'editor-draft.md'), 'utf8'),
    'newsletter.md': fs.readFileSync(path.join(root, 'newsletters', '2026-05-02', 'newsletter.md'), 'utf8'),
    'index.html': fs.readFileSync(path.join(root, 'newsletters', '2026-05-02', 'index.html'), 'utf8')
  };
  for (const [label, value] of Object.entries(publicSurfaces)) {
    assertNoPublicCleanupTerms(value, label);
  }
  const editorJson = JSON.stringify(readJson(path.join(root, 'content', 'newsroom', '2026-05-02', 'editor-draft.json')));
  assert.match(editorJson, /source_dedup_merge_provenance/);

  writeText(path.join(root, 'newsletters', '2026-05-01', 'newsletter.md'), '# drift\n');
  writeText(path.join(root, 'newsletters', '2026-05-01', 'index.html'), '<!doctype html>');
  const post = buildPostCleanupReport({
    root,
    dryRunReport: result.dryRunReport,
    expectedExposedDates: ['2026-05-02']
  });
  assert.equal(post.ok, false);
  assert.match(post.errors.join('\n'), /Removed date still has public artifact/);
});

test('apply cleanup marks fallback-only survivor issues with fallback publication metadata', () => {
  const root = tempRoot('source-dedup-fallback-mode-');
  writeIndex(root, ['2026-05-01']);
  writeIssue(root, '2026-05-01', [
    section('Tooling Watch', 'https://example.com/tooling', {
      relevance_bucket: 'cpp_ai_tooling_fallback',
      counts_as_primary_camera_topic: false,
      counts_as_fallback_topic: true
    })
  ]);
  const editorPath = path.join(root, 'content', 'newsroom', '2026-05-01', 'editor-draft.json');
  const staleIssue = readJson(editorPath);
  staleIssue.publication_notice = ['편집자 검토 후 발행 가능한 Review-only 발행본입니다.'];
  writeJson(editorPath, staleIssue);

  applyCleanupPlan({
    root,
    expectedExposedDates: ['2026-05-01']
  });

  const issue = readJson(path.join(root, 'content', 'newsroom', '2026-05-01', 'editor-draft.json'));
  assert.equal(issue.publication_mode, 'fallback_public');
  assert.equal(issue.homepage_visibility, 'visible_with_fallback_badge');
  assert.equal(issue.fallback_only, true);
  assert.equal(issue.fallback_public_ready, true);
  assert.equal(issue.homepage_badge, 'Tooling Watch Edition');
  assert.match(
    fs.readFileSync(path.join(root, 'newsletters', '2026-05-01', 'newsletter.md'), 'utf8'),
    /Tooling Watch Edition/
  );
});
