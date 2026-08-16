const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateSourceMonitorRegistryText
} = require('../../../validate/source-monitor-registry-validator');

const REGISTRY_PATH = path.join(__dirname, '..', '..', '..', '..', '..', 'state', 'source-monitor-registry.json');

function validRegistry(overrides = {}) {
  return {
    schemaVersion: 1,
    sources: [{
      source_id: 'aosp-camera-docs',
      root_url: 'https://source.android.com/docs/core/camera',
      url_patterns: ['https://source.android.com/docs/core/camera/**'],
      source_priority: 'high',
      selection_lane: 'primary_camera_stack',
      expected_categories: ['aosp', 'camera-hal'],
      date_extractors: ['visible_last_updated', 'structured_date_modified'],
      content_hash_enabled: true,
      main_article_allowed: true,
      fallback_only: false,
      max_pages_per_run: 5,
      fetch_timeout_ms: 8000
    }],
    ...overrides
  };
}

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

test('valid source monitor registry passes', () => {
  const result = validateSourceMonitorRegistryText(canonical(validRegistry()));
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('schemaVersion is fail-fast for unknown versions', () => {
  const result = validateSourceMonitorRegistryText(canonical(validRegistry({ schemaVersion: 2 })));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /schemaVersion must be 1/);
});

// 감시 대상 URL 집합은 seed_urls + root_url이다(targetUrlsForSource). root_url이 버전 목차
// 페이지면 추출기가 없는 그 페이지가 매번 함께 fetch되어 내용 없는 "Camera source snapshot
// change" 후보만 만들고, 심층 큐에도 "목차가 바뀌었다"는 주제로 쌓인다.
test('android-version-features는 버전 목차가 아니라 feature 페이지만 감시한다', () => {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const source = registry.sources.find(item => item.source_id === 'android-version-features');

  assert.ok(source, 'android-version-features 소스가 레지스트리에 있어야 한다');
  const featurePagePattern = /^https:\/\/developer\.android\.com\/about\/versions\/\d+\/features$/;
  assert.match(source.root_url, featurePagePattern);
  for (const seedUrl of source.seed_urls) {
    assert.match(seedUrl, featurePagePattern);
  }
});

test('registry validates bounded fetch and incompatible flags', () => {
  const registry = validRegistry({
    sources: [{
      ...validRegistry().sources[0],
      main_article_allowed: true,
      fallback_only: true,
      max_pages_per_run: 50,
      fetch_timeout_ms: 500
    }]
  });
  const result = validateSourceMonitorRegistryText(canonical(registry));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /main_article_allowed=true cannot be combined/);
  assert.match(result.errors.join('\n'), /max_pages_per_run must be an integer between 1 and 25/);
  assert.match(result.errors.join('\n'), /fetch_timeout_ms must be an integer between 1000 and 20000/);
});
