const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  VALID_MAIN_ARTICLE_POLICIES,
  VALID_SOURCE_ROLES,
  VALID_SOURCE_URL_QUALITY_HINTS,
  validateNewsSourcesConfigText
} = require('../../../scripts/lib/news-sources-config-validator');
const {
  normalizeEnabledSources,
  resolveSection
} = require('../../../scripts/lib/news-source-section-resolver');

function validSource(overrides = {}) {
  return {
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    sourceUrl: 'https://android-developers.googleblog.com/',
    rssUrl: 'https://android-developers.googleblog.com/feeds/posts/default?alt=rss',
    collectionModeHint: 'rss-source',
    category: 'android',
    priority: 'high',
    reliability: 'official',
    enabled: true,
    candidateOnly: false,
    requiresCrossCheck: false,
    sourceRole: 'official_release_source',
    sourceUrlQualityHint: 'official_dated_release',
    mainArticlePolicy: 'allowed',
    requiresCrossCheckDefault: false,
    evidenceGranularityHint: 'article_level_concrete_source_fact',
    sourceQualityNotes: ['official source'],
    usageHint: 'Android platform and CameraX official updates',
    keywords: ['Android', 'Camera', 'CameraX'],
    ...overrides
  };
}

function validRegistry(overrides = {}) {
  return {
    schemaVersion: 2,
    sectionMap: {
      android: 'Android / AOSP / Camera',
      ai: 'AI / SW Engineering Trends'
    },
    sources: [validSource()],
    ...overrides
  };
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validate(value) {
  return validateNewsSourcesConfigText(
    typeof value === 'string' ? value : canonical(value),
    { filePath: 'data/news-sources.json' }
  );
}

test('valid v2 source registry config without per-source section passes', () => {
  const result = validate(validRegistry());

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('explicit per-source section fails as duplicate registry data', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        section: 'Android / AOSP / Camera'
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /section duplicates sectionMap-derived data and is not allowed/);
});

test('non-canonical JSON formatting fails', () => {
  const result = validate(JSON.stringify(validRegistry()));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /JSON\.stringify\(value, null, 2\).*trailing newline/);
});

test('duplicate source IDs fail', () => {
  const result = validate(validRegistry({
    sources: [
      validSource(),
      validSource({ name: 'Duplicate Android Developers Blog' })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicates an earlier source id/);
});

test('missing required source fields fail with source context', () => {
  const source = validSource({ id: 'missing-usage-hint' });
  delete source.usageHint;

  const result = validate(validRegistry({ sources: [source] }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sources\[0\] \(missing-usage-hint\)\.usageHint is required/);
});

test('invalid source URLs fail', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        sourceUrl: 'ftp://example.com/source',
        rssUrl: 'not-a-url'
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sourceUrl must be an http or https URL/);
  assert.match(result.errors.join('\n'), /rssUrl must be null or an http or https URL/);
});

test('unknown categories fail', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        id: 'unknown-category',
        category: 'camera-hal'
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unknown-category.*category must exist in sectionMap/);
});

test('invalid collectionModeHint fails when present', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        collectionModeHint: 'deep-scrape'
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /collectionModeHint must be one of/);
});

test('source quality registry contract validates required enum fields', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        sourceRole: 'official',
        sourceUrlQualityHint: 'blog',
        mainArticlePolicy: 'maybe'
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sourceRole must be one of/);
  assert.match(result.errors.join('\n'), /sourceUrlQualityHint must be one of/);
  assert.match(result.errors.join('\n'), /mainArticlePolicy must be one of/);
});

test('conditional source policy requires cross-check default or explicit evidence rule', () => {
  const missingRule = validate(validRegistry({
    sources: [
      validSource({
        mainArticlePolicy: 'conditional',
        sourceUrlQualityHint: 'official_dated_release',
        requiresCrossCheckDefault: false
      })
    ]
  }));
  assert.equal(missingRule.ok, false);
  assert.match(missingRule.errors.join('\n'), /mainArticlePolicy=conditional requires/);

  const explicitRule = validate(validRegistry({
    sources: [
      validSource({
        mainArticlePolicy: 'conditional',
        sourceUrlQualityHint: 'generic_ai_or_it_trend',
        requiresCrossCheckDefault: false
      })
    ]
  }));
  assert.equal(explicitRule.ok, true);
});

test('linkedEvidencePolicy validates optional source-aware link classification policy', () => {
  const policy = {
    enabled: true,
    allowedDomains: ['developer.android.com', 'android-review.googlesource.com'],
    importantAnchorKeywords: ['release notes', 'gerrit'],
    ignoreAnchorKeywords: ['privacy', 'rss']
  };
  const result = validate(validRegistry({
    sources: [
      validSource({
        linkedEvidencePolicy: policy
      })
    ]
  }));
  const normalized = normalizeEnabledSources(result.registry);

  assert.equal(result.ok, true);
  assert.deepEqual(normalized.sources[0].linkedEvidencePolicy, policy);
});

test('linkedEvidencePolicy rejects enabled policies without allowed domains', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        linkedEvidencePolicy: {
          enabled: true,
          allowedDomains: [],
          importantAnchorKeywords: ['release notes'],
          ignoreAnchorKeywords: ['privacy']
        }
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /linkedEvidencePolicy\.allowedDomains must be a non-empty array/);
});

test('section resolver derives source section from category', () => {
  const registry = validRegistry({
    sources: [
      validSource({
        id: 'ai-source',
        category: 'ai'
      })
    ]
  });
  const normalized = normalizeEnabledSources(registry);

  assert.equal(resolveSection(registry.sectionMap, 'ai', 'sources[0]'), 'AI / SW Engineering Trends');
  assert.equal(normalized.sources[0].section, 'AI / SW Engineering Trends');
});

test('source quality enum docs stay in sync with config validator', () => {
  const docs = fs.readFileSync('docs/config/news-sources-fields.ko.md', 'utf8');
  for (const value of [
    ...VALID_SOURCE_ROLES,
    ...VALID_SOURCE_URL_QUALITY_HINTS,
    ...VALID_MAIN_ARTICLE_POLICIES
  ]) {
    assert.ok(docs.includes(`\`${value}\``), `docs/config/news-sources-fields.ko.md must document ${value}`);
  }
});
