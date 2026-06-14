const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  VALID_MAIN_ARTICLE_POLICIES,
  VALID_SOURCE_ROLES,
  VALID_SOURCE_URL_QUALITY_HINTS,
  validateNewsSourcesConfigText
} = require('../../../tooling/validate/news-sources-config-validator');
const {
  normalizeEnabledSources,
  resolveSection
} = require('../../../collect/news-source-section-resolver');

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
  const docs = fs.readFileSync('docs/config/NEWS_SOURCES_FIELDS.md', 'utf8');
  for (const value of [
    ...VALID_SOURCE_ROLES,
    ...VALID_SOURCE_URL_QUALITY_HINTS,
    ...VALID_MAIN_ARTICLE_POLICIES
  ]) {
    assert.ok(docs.includes(`\`${value}\``), `docs/config/NEWS_SOURCES_FIELDS.md must document ${value}`);
  }
});

function validRedditSource(overrides = {}) {
  return validSource({
    id: 'reddit-androiddev-camera',
    name: 'Reddit r/androiddev',
    sourceUrl: 'https://www.reddit.com/r/androiddev/',
    rssUrl: 'https://www.reddit.com/r/androiddev/search.rss?q=camera%20OR%20CameraX&restrict_sr=1&sort=new',
    collectionModeHint: 'rss-source',
    category: 'android',
    priority: 'low',
    reliability: 'community',
    enabled: true,
    candidateOnly: true,
    requiresCrossCheck: true,
    sourceRole: 'community_lead_source',
    sourceUrlQualityHint: 'community_lead_requires_cross_check',
    mainArticlePolicy: 'conditional',
    requiresCrossCheckDefault: true,
    evidenceGranularityHint: 'article_with_primary_confirmation',
    sourceQualityNotes: ['community signal / candidate discovery source only'],
    usageHint: 'community lead source; requires official/project confirmation',
    keywords: ['camera', 'HAL', 'Android'],
    ...overrides
  });
}

function validateReddit(overrides = {}) {
  return validate(validRegistry({ sources: [validRedditSource(overrides)] }));
}

function hasError(result, pattern) {
  return result.errors.some(error => pattern.test(error));
}

test('valid reddit community source passes', () => {
  const result = validateReddit();

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('reddit source with candidateOnly=false fails', () => {
  const result = validateReddit({ candidateOnly: false });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /candidateOnly must be true for reddit community sources/));
});

test('reddit source with requiresCrossCheck=false fails', () => {
  const result = validateReddit({ requiresCrossCheck: false });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /requiresCrossCheck must be true for reddit community sources/));
});

test('reddit source with priority=medium fails', () => {
  const result = validateReddit({ priority: 'medium' });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /priority must be "low" for reddit community sources/));
});

test('reddit source with a non-search.rss reddit feed fails', () => {
  const result = validateReddit({ rssUrl: 'https://www.reddit.com/r/androiddev/.rss' });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /rssUrl must be a reddit\.com search\.rss URL/));
});

test('reddit source with a non-reddit feed host fails', () => {
  const result = validateReddit({ rssUrl: 'https://example.com/search.rss?q=camera' });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /rssUrl must be a reddit\.com search\.rss URL/));
});

test('reddit source that opts into over-18 content fails', () => {
  const result = validateReddit({
    rssUrl: 'https://www.reddit.com/r/androiddev/search.rss?q=camera&restrict_sr=1&include_over_18=on'
  });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /must not opt into over-18 content/));
});

test('valid reddit feed without an over-18 opt-in passes', () => {
  const result = validateReddit({
    rssUrl: 'https://www.reddit.com/r/androiddev/search.rss?q=camera&restrict_sr=1&sort=new'
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('reddit source with mainArticlePolicy other than conditional fails', () => {
  const result = validateReddit({ mainArticlePolicy: 'watchlist_only' });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /mainArticlePolicy must be "conditional" for reddit community sources/));
});

test('reddit source with wrong evidenceGranularityHint fails', () => {
  const result = validateReddit({ evidenceGranularityHint: 'article_level_concrete_source_fact' });

  assert.equal(result.ok, false);
  assert.ok(hasError(result, /evidenceGranularityHint must be "article_with_primary_confirmation" for reddit community sources/));
});
