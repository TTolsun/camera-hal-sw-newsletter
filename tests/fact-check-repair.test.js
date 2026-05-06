const assert = require('node:assert/strict');
const test = require('node:test');

const {
  pruneResolvedFallbackImageFactCheckItems
} = require('../scripts/newsroom/common/fact-check-repair');

function fallbackSection(overrides = {}) {
  return {
    headline: 'Mailing list article',
    selectedImage: '',
    imageUsageDecisionReason: 'The source is a mailing list archive with no suitable image; the GitLab card candidate belongs to another issue URL.',
    resolvedImage: {
      url: '../../assets/images/fallback/newsletter-default.svg',
      src: '../../assets/images/fallback/newsletter-default.svg',
      usedFallback: true,
      reason: 'no selected image; local fallback visual used'
    },
    ...overrides
  };
}

test('prunes safe resolved fallback image fact-check false positive', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{
      location: 'sections[0].selectedImage',
      problem: 'selectedImage still contains the broken external image URL or the fallback path is missing.',
      suggestion: 'The selectedImage is a fallback image and should explain why the source has no image.'
    }],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    final_comment: ''
  };

  const { factCheck: next, removed } = pruneResolvedFallbackImageFactCheckItems(factCheck, {
    sections: [fallbackSection()]
  }, { root: process.cwd() });

  assert.equal(removed.length, 1);
  assert.equal(next.must_fix.length, 0);
  assert.equal(next.status, 'PASS');
});

test('does not prune non-image source or scope must-fix items', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{
      location: 'sections[0].headline',
      problem: 'Main article is missing expanded editorial-scope relevance.',
      suggestion: 'Tie the C++ fallback article to Android native toolchain constraints.'
    }],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    final_comment: ''
  };

  const { factCheck: next, removed } = pruneResolvedFallbackImageFactCheckItems(factCheck, {
    sections: [fallbackSection()]
  }, { root: process.cwd() });

  assert.equal(removed.length, 0);
  assert.equal(next.must_fix.length, 1);
  assert.equal(next.status, 'NEEDS_FIX');
});

test('does not prune unresolved external selectedImage failures', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{
      location: 'sections[0].selectedImage',
      problem: 'selectedImage still contains the broken external image URL or the fallback path is missing.',
      suggestion: 'Use a local fallback path.'
    }],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    final_comment: ''
  };

  const { factCheck: next, removed } = pruneResolvedFallbackImageFactCheckItems(factCheck, {
    sections: [fallbackSection({
      selectedImage: 'https://example.com/broken.png'
    })]
  }, { root: process.cwd() });

  assert.equal(removed.length, 0);
  assert.equal(next.must_fix.length, 1);
  assert.equal(next.status, 'NEEDS_FIX');
});
