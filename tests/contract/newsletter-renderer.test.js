const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildHtml,
  buildMarkdown
} = require('../../scripts/newsroom/render/newsletter-renderer');

function issue() {
  return {
    date: '2026-05-03',
    title: 'Camera HAL SW Newsletter - 2026-05-03',
    summary: 'Weekly summary',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    sections: [{
      category: 'Android Camera',
      headline: 'CameraX release gives HAL teams a target',
      confirmed_facts: ['Legacy fact must not render.'],
      background: 'Legacy background must not render.',
      camera_hal_perspective: 'Legacy HAL impact must not render.',
      action_items: ['Legacy action must not render.'],
      team_summary: 'Legacy team share must not render.',
      article_sections: {
        verified_facts: ['Normalized source-backed fact.'],
        background_context: 'Normalized context for camera2 and HAL readers.',
        hal_driver_impact: 'Normalized stream and metadata validation impact.',
        action_items: ['Run Camera ITS preview latency checks.'],
        team_share_points: 'Normalized team review takeaway.'
      },
      hal_signal_capsule: {
        why_now: 'CameraX release gives a dated compatibility validation trigger.',
        reader_owners: ['camera_hal_owner', 'camera_test_owner'],
        check_within_2_weeks: 'Run Camera ITS preview latency and metadata checks within 2 weeks.',
        impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
        do_not_overstate: ['Do not claim direct HAL API changes.']
      },
      sources: [{
        title: 'Source article',
        url: 'https://example.com/source'
      }]
    }],
    action_items: ['Top-level action'],
    references: [{
      title: 'Reference',
      url: 'https://example.com/reference'
    }]
  };
}

test('newsletter renderer uses normalized article_sections and preserves public hooks', () => {
  const markdown = buildMarkdown(issue());
  const html = buildHtml(issue());

  assert.match(markdown, /Normalized source-backed fact/);
  assert.match(markdown, /Normalized stream and metadata validation impact/);
  assert.match(markdown, /HAL Signal Capsule/);
  assert.match(markdown, /check_within_2_weeks/);
  assert.doesNotMatch(markdown, /Legacy fact must not render/);
  assert.doesNotMatch(markdown, /Legacy HAL impact must not render/);

  for (const hook of ['issue-briefing', 'issue-section', 'source-list', 'reference-list']) {
    assert.match(html, new RegExp(hook));
  }
  assert.match(html, /hal-signal-capsule/);
  assert.match(html, /camera_hal_owner/);
  assert.match(html, /Normalized team review takeaway/);
  assert.doesNotMatch(html, /Legacy team share must not render/);
});

test('newsletter renderer does not synthesize missing HAL Signal Capsule content', () => {
  const draft = issue();
  delete draft.sections[0].hal_signal_capsule;

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.doesNotMatch(markdown, /HAL Signal Capsule/);
  assert.doesNotMatch(html, /hal-signal-capsule/);
});
