const assert = require('node:assert/strict');
const test = require('node:test');

const {
  publicUrlError
} = require('../../../reporter/public-article-contract');

test('public URL contract blocks source monitor internal artifacts', () => {
  assert.equal(
    publicUrlError('https://example.com/content/source-events/2026-05-22/source-change-events.json'),
    'internal_artifact_url'
  );
  assert.equal(
    publicUrlError('https://example.com/state/source-snapshots/aosp-camera-docs.json'),
    'internal_artifact_url'
  );
});
