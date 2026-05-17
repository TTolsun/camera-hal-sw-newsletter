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
  assert.doesNotMatch(markdown, /제한 \/ 주의/);
  assert.doesNotMatch(markdown, /추적 항목/);
  assert.doesNotMatch(html, /article-limitations/);
  assert.doesNotMatch(html, /article-watch-items/);
});

test('newsletter renderer does not synthesize missing HAL Signal Capsule content', () => {
  const draft = issue();
  delete draft.sections[0].hal_signal_capsule;

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.doesNotMatch(markdown, /HAL Signal Capsule/);
  assert.doesNotMatch(html, /hal-signal-capsule/);
});

test('newsletter renderer conditionally renders public limitation and watch blocks', () => {
  const draft = issue();
  draft.sections[0].article_sections.known_limitations = ['No direct HAL contract change is stated.'];
  draft.sections[0].article_sections.watch_items = ['Track CameraX SessionConfig regressions.'];
  draft.sections[0].article_sections.do_not_claim = ['Do not claim vendor HAL binary updates.'];

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.match(markdown, /확인한 사실 \/ 릴리스 요약/);
  assert.match(markdown, /배경지식 \/ 왜 AOSP Camera 팀이 볼 만한가/);
  assert.match(markdown, /Camera HAL\/Driver 관점 \/ 적용 가능 지점/);
  assert.match(markdown, /실행 항목 \/ PoC 제안 및 검증 기준/);
  assert.match(markdown, /팀 공유 포인트 \/ 결론/);
  assert.match(markdown, /제한 \/ 주의/);
  assert.match(markdown, /No direct HAL contract change is stated/);
  assert.match(markdown, /추적 항목/);
  assert.match(markdown, /Track CameraX SessionConfig regressions/);
  assert.doesNotMatch(markdown, /Do not claim vendor HAL binary updates/);

  assert.match(html, /article-limitations/);
  assert.match(html, /article-watch-items/);
  assert.match(html, /No direct HAL contract change is stated/);
  assert.match(html, /Track CameraX SessionConfig regressions/);
  assert.doesNotMatch(html, /Do not claim vendor HAL binary updates/);
});

test('newsletter renderer does not render raw do_not_claim when it is the only optional key', () => {
  const draft = issue();
  draft.sections[0].article_sections.do_not_claim = ['Do not claim vendor HAL binary updates.'];

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.doesNotMatch(markdown, /Do not claim vendor HAL binary updates/);
  assert.doesNotMatch(html, /Do not claim vendor HAL binary updates/);
  assert.doesNotMatch(markdown, /제한 \/ 주의/);
  assert.doesNotMatch(markdown, /추적 항목/);
});
