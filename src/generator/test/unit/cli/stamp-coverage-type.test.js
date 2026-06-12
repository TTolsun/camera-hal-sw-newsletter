'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { stampCoverageType } = require('../../../scripts/newsroom/cli/gemini-newsroom-newsletter');

function editor() {
  return {
    sections: [
      { headline: 'Fresh item', sources: [{ url: 'https://example.com/fresh' }] },
      { headline: 'CameraX 1.6.0', sources: [{ url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0' }] }
    ]
  };
}

const SHORTLIST = {
  catch_up_articles: [
    { title: 'CameraX 1.6.0', url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0', catch_up_age_days: 70 }
  ]
};

test('stampCoverageType marks matching section catch_up and others fresh', () => {
  const result = stampCoverageType(editor(), SHORTLIST);
  assert.equal(result.sections[0].coverage_type, 'fresh');
  assert.equal(result.sections[1].coverage_type, 'catch_up');
  assert.equal(result.sections[1].catch_up_age_days, 70);
});

test('stampCoverageType defaults all sections to fresh when no catch-up articles', () => {
  const result = stampCoverageType(editor(), { catch_up_articles: [] });
  assert.ok(result.sections.every(s => s.coverage_type === 'fresh'));
});
