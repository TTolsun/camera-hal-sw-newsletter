const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildHtml,
  buildMarkdown
} = require('../scripts/newsroom/render/newsletter-renderer');

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
  assert.doesNotMatch(markdown, /Legacy fact must not render/);
  assert.doesNotMatch(markdown, /Legacy HAL impact must not render/);

  for (const hook of ['issue-briefing', 'issue-section', 'source-list', 'reference-list']) {
    assert.match(html, new RegExp(hook));
  }
  assert.match(html, /Normalized team review takeaway/);
  assert.doesNotMatch(html, /Legacy team share must not render/);
});
