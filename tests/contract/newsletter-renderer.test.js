const assert = require('node:assert/strict');
const test = require('node:test');

const {
  articleSectionContractMarkdown,
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

function textFromHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function siteNavLabels(html) {
  const siteNavMatch = html.match(/<nav\b[^>]*class=["'][^"']*\bsite-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/i);
  assert.ok(siteNavMatch, 'generated issue HTML must include .site-nav');
  return [...siteNavMatch[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => textFromHtml(match[1]))
    .filter(label => label && label !== 'Camera HAL SW Newsletter');
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
    /Do not claim vendor HAL binary updates/,
    /Top-level internal action must not render/,
    /Publication 전에 source URL/
  ]) {
    assert.doesNotMatch(markdown, leaked);
    assert.doesNotMatch(html, leaked);
  }
});

test('newsletter renderer keeps generated issue nav labels in English', () => {
  const html = buildHtml(issue());
  const labels = siteNavLabels(html);

  assert.deepEqual(labels.slice(0, 4), ['Latest', 'Archive', 'Sources', 'GitHub']);
  assert.equal(labels.includes('\ucd5c\uc2e0\ud638'), false);
  assert.equal(labels.includes('\uc544\uce74\uc774\ube0c'), false);
  assert.equal(labels.includes('\ucd9c\ucc98'), false);
});

test('newsletter renderer renders a single main article without empty sections', () => {
  const markdown = buildMarkdown(issue());
  const html = buildHtml(issue());

  assert.match(markdown, /^## 2\. CameraX release gives HAL teams a target/m);
  assert.doesNotMatch(markdown, /^## 3\./m);
  assert.equal((html.match(/\barticle-card\b/g) || []).length, 1);
  for (const rendered of [markdown, html]) {
    assert.doesNotMatch(rendered, /\bundefined\b|\bnull\b|\bNaN\b/);
  }
});

test('newsletter renderer article structure table uses shared row semantics', () => {
  const markdown = articleSectionContractMarkdown(issue());

  assert.match(markdown, /\| # \| Article \| 5-section \| Fact boundary \| HAL impact axis \| Actionability \| Limitations \|/);
  assert.match(markdown, /\| 1 \| Internal fallback headline must not render \| pass \| present\+guarded \| framework_hal_contract, stream_buffer_metadata \| present \| guardrail-only \|/);
  assert.doesNotMatch(markdown, /source-backed guarded/);
  assert.doesNotMatch(markdown, /source-backed/);
  assert.doesNotMatch(markdown, /Do not claim vendor HAL binary updates/);
});

test('newsletter renderer sanitizes legacy sections through compatibility projection', () => {
  const draft = issue();
  draft.sections[0].what_changed = 'Review-only Fallback candidate passed a quality gate for review.';
  draft.sections[0].sources[0].title = 'Fallback candidate source';
  delete draft.sections[0].public_article;

  const markdown = buildMarkdown(draft);
  const html = buildHtml(draft);

  assert.match(markdown, /Internal Watch headline must not render/);
  assert.match(markdown, /공개 출처가 확인한 범위 안에서 Camera HAL 독자가 참고할 만한 동향으로 정리했습니다/);
  assert.match(markdown, /Camera HAL \/ Driver 관점/);
  assert.match(markdown, /즉시 조치할 항목은 없습니다|Run Camera ITS preview latency checks/);
  assert.match(html, /공개 출처가 확인한 범위 안에서 Camera HAL 독자가 참고할 만한 동향으로 정리했습니다/);
  assert.match(html, /reader-checkpoints/);
  assert.doesNotMatch(markdown, /HAL Signal Capsule/);
  assert.doesNotMatch(html, /hal-signal-capsule/);
  assert.doesNotMatch(markdown, /Review-only/);
  assert.doesNotMatch(markdown, /Editor review/i);
  assert.doesNotMatch(markdown, /source item passed a quality review/i);
  assert.doesNotMatch(html, /Review-only/);
  assert.doesNotMatch(html, /Editor review/i);
  assert.doesNotMatch(html, /source item passed a quality review/i);
  assert.doesNotMatch(markdown, /Fallback/);
  assert.doesNotMatch(markdown, /quality gate/);
  assert.doesNotMatch(markdown, /candidate/);
  assert.doesNotMatch(markdown, /Publication 전에 source URL/);
});
