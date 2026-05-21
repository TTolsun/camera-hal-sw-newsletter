const assert = require('node:assert/strict');
const test = require('node:test');

const {
  validateSourceMonitorRegistryText
} = require('../../../scripts/newsroom/validate/source-monitor-registry-validator');

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
