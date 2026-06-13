'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { pruneCatchUpFramingFactCheckItems } = require('../../../publish/fact-check-postprocess');

function editor() {
  return {
    sections: [
      { headline: 'Fresh item', coverage_type: 'fresh' },
      { headline: '지난 소식: CameraX 1.6.1', coverage_type: 'catch_up' }
    ]
  };
}

test('removes catch-up retrospective-framing must_fix on the catch_up section headline/lead', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      { location: 'sections[1].public_article.headline', problem: "The headline uses '지난 소식' which is editorial framing, not factual." },
      { location: 'sections[1].public_article.lead', problem: 'The lead uses retrospective editorial framing.' }
    ],
    recommended_fixes: []
  };
  const result = pruneCatchUpFramingFactCheckItems(factCheck, editor());
  assert.equal(result.must_fix.length, 0);
  assert.equal(result.status, 'PASS');
});

test('keeps genuine factual must_fix on a catch_up section', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      { location: 'sections[1].public_article.body_paragraphs', problem: 'Claims CameraX 1.6.1 removed an API, but the source says it was deprecated.' }
    ],
    recommended_fixes: []
  };
  const result = pruneCatchUpFramingFactCheckItems(factCheck, editor());
  assert.equal(result.must_fix.length, 1);
  assert.equal(result.status, 'NEEDS_FIX');
});

test('does not touch must_fix on fresh sections', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      { location: 'sections[0].public_article.headline', problem: 'editorial framing 지난 소식' }
    ],
    recommended_fixes: []
  };
  const result = pruneCatchUpFramingFactCheckItems(factCheck, editor());
  assert.equal(result.must_fix.length, 1);
});

test('no-op when there are no catch_up sections', () => {
  const factCheck = { status: 'NEEDS_FIX', must_fix: [{ location: 'sections[0].public_article.headline', problem: '지난 소식 editorial framing' }], recommended_fixes: [] };
  const result = pruneCatchUpFramingFactCheckItems(factCheck, { sections: [{ headline: 'x', coverage_type: 'fresh' }] });
  assert.equal(result.must_fix.length, 1);
});
