const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildHtml,
  buildMarkdown
} = require('../../scripts/newsroom/render/newsletter-renderer');

function issue(overrides = {}) {
  return {
    date: '2026-05-03',
    title: 'Camera HAL SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    sections: [{
      category: 'Tooling Watch / Fallback',
      headline: 'Internal fallback headline must not render',
      confirmed_facts: ['Legacy fact must not render.'],
      background: 'Legacy background must not render.',
      camera_hal_perspective: 'Legacy HAL impact must not render.',
      action_items: ['Publication 전에 source URL과 published date가 article text와 맞는지 확인합니다.'],
      team_summary: 'Legacy team share must not render.',
      public_article: {
        headline: 'CameraX release gives HAL teams a target',
        lead: 'CameraX release gives HAL teams a dated compatibility validation signal.',
        body_paragraphs: [
          'The release can be read as a framework-adjacent compatibility signal for Camera HAL owners.',
          'The article does not claim a direct HAL API change without source evidence.'
        ],
        camera_hal_takeaway: 'Check stream, buffer, metadata, and Camera ITS compatibility only where source evidence supports it.',
        reader_checkpoints: [
          'Run Camera ITS preview latency checks on one representative device.',
          'Compare stream and metadata behavior for the CameraX-backed capture path.'
        ],
        source_links: [{
          title: 'Source article',
          url: 'https://example.com/source',
          source_role: 'primary'
        }]
      },
      article_sections: {
        verified_facts: ['Normalized source-backed fact must not render as a checklist.'],
        background_context: 'Normalized context must not render directly.',
        hal_driver_impact: 'Normalized impact must not render directly.',
        action_items: ['Run Camera ITS preview latency checks.'],
        team_share_points: 'Normalized team review takeaway must not render directly.',
        do_not_claim: ['Do not claim vendor HAL binary updates.']
      },
      hal_signal_capsule: {
        why_now: 'Internal dated validation trigger.',
        reader_owners: ['camera_hal_owner', 'camera_test_owner'],
        check_within_2_weeks: 'Run Camera ITS preview latency and metadata checks within 2 weeks.',
        impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
        do_not_overstate: ['Do not claim direct HAL API changes.']
      },
      sources: [{
        title: 'Legacy source',
        url: 'https://example.com/legacy-source'
      }]
    }],
    action_items: ['Top-level internal action must not render.'],
    references: [{
      title: 'Reference',
      url: 'https://example.com/reference'
    }],
    ...overrides
  };
}

test('newsletter renderer uses public_article for public markdown and HTML', () => {
  const markdown = buildMarkdown(issue());
  const html = buildHtml(issue());

  assert.match(markdown, /CameraX release gives HAL teams a target/);
  assert.match(markdown, /Camera HAL \/ Driver 관점/);
  assert.match(markdown, /Run Camera ITS preview latency checks/);
  assert.match(markdown, /\[Source article\]\(https:\/\/example\.com\/source\)/);
  assert.match(html, /CameraX release gives HAL teams a target/);
  assert.match(html, /reader-checkpoints/);

  for (const leaked of [
    /HAL Signal Capsule/,
    /why_now/,
    /impact_axes/,
    /do_not_overstate/,
    /Internal fallback headline must not render/,
    /Legacy fact must not render/,
    /Normalized source-backed fact must not render/,
    /Top-level internal action must not render/,
    /Publication 전에 source URL/
  ]) {
    assert.doesNotMatch(markdown, leaked);
    assert.doesNotMatch(html, leaked);
  }
});

test('newsletter renderer sanitizes legacy sections through compatibility projection', () => {
  const draft = issue();
  draft.sections[0].what_changed = 'Fallback candidate passed a quality gate for review.';
  draft.sections[0].sources[0].title = 'Fallback candidate source';
  delete draft.sections[0].public_article;

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.match(markdown, /Internal Watch headline must not render/);
  assert.match(markdown, /Camera HAL \/ Driver 관점/);
  assert.match(markdown, /즉시 조치할 항목은 없습니다|Run Camera ITS preview latency checks/);
  assert.match(html, /reader-checkpoints/);
  assert.doesNotMatch(markdown, /HAL Signal Capsule/);
  assert.doesNotMatch(html, /hal-signal-capsule/);
  assert.doesNotMatch(markdown, /Fallback/);
  assert.doesNotMatch(markdown, /quality gate/);
  assert.doesNotMatch(markdown, /candidate/);
  assert.doesNotMatch(markdown, /Publication 전에 source URL/);
});
