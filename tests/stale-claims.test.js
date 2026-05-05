const assert = require('node:assert/strict');
const test = require('node:test');

const {
  pruneResolvedStaleFactCheckItems,
  scrubStaleClaims
} = require('../scripts/lib/stale-claims');

function source(url, title) {
  return { url, title };
}

function section(overrides = {}) {
  return {
    category: 'Android Camera',
    headline: 'CameraX 1.5 release note',
    what_changed: 'CameraX 1.5.0 changed Android Camera compatibility behavior.',
    evidence_summary: 'Version: CameraX 1.5.0; API/component: CameraX.',
    background: 'CameraX affects camera2 compatibility validation.',
    camera_hal_perspective: 'Validate request/result metadata and stream behavior.',
    action_items: ['Run Camera ITS before publishing.', 'Compare capture latency.'],
    team_summary: 'Use CameraX as a compatibility signal.',
    sources: [source('https://example.com/camerax', 'CameraX release note')],
    ...overrides
  };
}

test('stale scrub removes Android 17 Beta 4 claims after the section is removed', () => {
  const removedAndroid = section({
    headline: 'Android 17 Beta 4 reaches platform stability',
    version_or_release: 'Android 17 Beta 4',
    api_or_component: 'Android platform release',
    behavior_change: 'near-final compatibility environment',
    sources: [source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4')]
  });
  const finalSection = section({
    headline: 'CameraX 1.5 release note',
    sources: [source('https://example.com/camerax', 'CameraX release note')]
  });
  const editor = {
    date: '2026-05-05',
    summary: 'Android 17 Beta 4 is the main compatibility signal. CameraX remains selected.',
    briefing: [
      'Android 17 Beta 4 gives HAL teams a near-final platform target.',
      'CameraX 1.5 keeps compatibility validation concrete.',
      'Use final section sources only.'
    ],
    action_items: [
      'Check Android 17 Beta 4 behavior against Camera ITS.',
      'Run CameraX request/result regression tests.'
    ],
    sections: [finalSection],
    references: [
      source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4'),
      source('https://example.com/camerax', 'CameraX release note')
    ]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-05-05',
    removedSections: [removedAndroid]
  });

  const globalText = [
    scrubbed.summary,
    scrubbed.briefing,
    scrubbed.action_items,
    scrubbed.references
  ].flat().join(' ');
  assert.doesNotMatch(globalText, /Android 17 Beta 4/i);
  assert.equal(scrubbed.briefing.length, 3);
  assert.deepEqual(scrubbed.references, [source('https://example.com/camerax', 'CameraX release note')]);
  assert.equal(report.status, 'PASS');
  assert.equal(report.stale_claim_items_removed.length > 0, true);
  assert.equal(report.unused_references_removed.length, 1);
});

test('release claim with final section source evidence is retained', () => {
  const finalSection = section({
    headline: 'Android 17 Beta 4 reaches platform stability',
    version_or_release: 'Android 17 Beta 4',
    evidence_summary: 'Version: Android 17 Beta 4; official Android Developers Blog source.',
    sources: [source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4')]
  });
  const editor = {
    date: '2026-05-05',
    summary: 'Android 17 Beta 4 remains a sourced compatibility item.',
    briefing: [
      'Android 17 Beta 4 remains selected because the final section cites it.',
      'Camera teams should compare metadata regressions.',
      'Keep references aligned to final sections.'
    ],
    action_items: ['Review Android 17 Beta 4 source evidence.'],
    sections: [finalSection],
    references: [source('https://android-developers.googleblog.com/android-17-beta-4.html', 'Android 17 Beta 4')]
  };

  const { editor: scrubbed, report } = scrubStaleClaims(editor, {
    date: '2026-05-05',
    removedSections: []
  });

  assert.match(scrubbed.summary, /Android 17 Beta 4/);
  assert.match(scrubbed.briefing.join(' '), /Android 17 Beta 4/);
  assert.equal(report.stale_claim_items_removed.length, 0);
  assert.equal(report.unsupported_release_claims_removed.length, 0);
  assert.equal(report.retained_release_claims.some(item => item.claim === 'Android 17 Beta 4'), true);
});

test('resolved stale fact-check items are pruned after scrub removes the claim', () => {
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{
      location: 'briefing',
      problem: 'Android 17 Beta 4 is unsupported after demotion.',
      suggestion: 'Remove it.',
      source_url: ''
    }],
    recommended_fixes: ['Remove Android 17 Beta 4 from action items.'],
    source_gaps: ['Android 17 Beta 4 lacks final source evidence.'],
    source_gap_count: 1,
    final_comment: ''
  };
  const staleReport = {
    stale_claim_items_removed: [{
      stale_claims: ['Android 17 Beta 4'],
      unsupported_release_claims: []
    }],
    unsupported_release_claims_removed: []
  };
  const pruned = pruneResolvedStaleFactCheckItems(factCheck, staleReport);
  assert.equal(pruned.status, 'PASS');
  assert.deepEqual(pruned.must_fix, []);
  assert.deepEqual(pruned.recommended_fixes, []);
  assert.deepEqual(pruned.source_gaps, []);
  assert.equal(pruned.source_gap_count, 0);
});
