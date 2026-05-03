const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateNewsSourcesConfigText
} = require('../scripts/lib/news-sources-config-validator');

function validSource(overrides = {}) {
  return {
    id: 'android-developers-blog',
    name: 'Android Developers Blog',
    sourceUrl: 'https://android-developers.googleblog.com/',
    rssUrl: 'https://android-developers.googleblog.com/feeds/posts/default?alt=rss',
    collectionModeHint: 'rss-source',
    category: 'android',
    section: 'Android / AOSP / Camera',
    priority: 'high',
    reliability: 'official',
    enabled: true,
    candidateOnly: false,
    requiresCrossCheck: false,
    usageHint: 'Android platform and CameraX official updates',
    keywords: ['Android', 'Camera', 'CameraX'],
    ...overrides
  };
}

function validRegistry(overrides = {}) {
  return {
    schemaVersion: 1,
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

test('valid source registry config passes', () => {
  const result = validate(validRegistry());

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
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

test('unknown categories and section mismatches fail', () => {
  const result = validate(validRegistry({
    sources: [
      validSource({
        id: 'unknown-category',
        category: 'camera-hal',
        section: 'Android / AOSP / Camera'
      }),
      validSource({
        id: 'wrong-section',
        category: 'ai',
        section: 'Android / AOSP / Camera'
      })
    ]
  }));

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unknown-category.*category must exist in sectionMap/);
  assert.match(result.errors.join('\n'), /wrong-section.*section must match sectionMap\.ai/);
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
