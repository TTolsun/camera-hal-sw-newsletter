const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildHtml,
  buildMarkdown
} = require('../../scripts/newsroom/render/newsletter-renderer');
const {
  toEditorDraftArtifact
} = require('../../src/core/domain/newsletter-domain-normalize');
const {
  buildNewsletterQualityReport
} = require('../../scripts/newsroom/validate/newsletter-quality');

function legacyIssue() {
  return {
    date: '2026-05-03',
    title: 'Camera HAL / SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    sections: [{
      source_candidate_hash: 'camerax-release',
      category: 'Android Camera',
      headline: 'CameraX release gives HAL teams a target',
      confirmed_facts: ['CameraX release note is the source event.'],
      evidence_summary: 'CameraX release note gives a dated compatibility validation target.',
      specificity_checks: ['Version: CameraX 1.5.0'],
      source_verification_notes: ['Official source, dated release evidence.'],
      action_items: ['Run Camera ITS preview latency checks within 2 weeks.'],
      do_not_overstate: ['Do not claim a direct HAL API change.'],
      sources: [{
        title: 'CameraX release note',
        url: 'https://example.com/camerax'
      }],
      public_article: {
        headline: 'CameraX release gives HAL teams a target',
        lead: 'CameraX release gives HAL teams a dated compatibility validation signal.',
        body_paragraphs: [
          'The release can be read as framework-adjacent validation context.',
          'The interpretation stays limited to source-backed compatibility checks.'
        ],
        camera_hal_takeaway: 'Keep interpretation limited to stream, buffer, metadata, and Camera ITS validation.',
        reader_checkpoints: ['Run Camera ITS preview latency checks within 2 weeks.'],
        source_links: [{
          title: 'CameraX release note',
          url: 'https://example.com/camerax',
          source_role: 'primary'
        }]
      },
      article_sections: {
        verified_facts: ['CameraX release note is the source event.'],
        background_context: 'CameraX sits above camera2.',
        hal_driver_impact: 'Validate stream, buffer, metadata, and Camera ITS behavior.',
        action_items: ['Run Camera ITS preview latency checks within 2 weeks.'],
        team_share_points: 'Use CameraX as a compatibility validation trigger.'
      }
    }]
  };
}

function countSourceLinks(markdown) {
  return (markdown.match(/https:\/\/example\.com\/camerax/g) || []).length;
}

test('domain-centered draft preserves essential public Markdown and HTML output', () => {
  const legacy = legacyIssue();
  const draft = toEditorDraftArtifact(legacy, {
    date: '2026-05-03',
    provider: 'gemini',
    providerModel: 'gemini-3.5-flash'
  });
  const legacyMarkdown = buildMarkdown(legacy);
  const domainMarkdown = buildMarkdown(draft);
  const legacyHtml = buildHtml(legacy);
  const domainHtml = buildHtml(draft);

  assert.equal(domainMarkdown, legacyMarkdown);
  assert.equal(countSourceLinks(domainMarkdown), countSourceLinks(legacyMarkdown));
  assert.match(domainHtml, /id="article-camerax-release-gives-hal-teams-a-target"/);
  assert.equal((domainHtml.match(/\bissue-story\b/g) || []).length, (legacyHtml.match(/\bissue-story\b/g) || []).length);
  assert.equal((domainHtml.match(/\barticle-card\b/g) || []).length, (legacyHtml.match(/\barticle-card\b/g) || []).length);
});

test('domain-centered draft keeps quality score equivalent to the legacy issue', () => {
  const legacy = legacyIssue();
  const draft = toEditorDraftArtifact(legacy, {
    date: '2026-05-03',
    provider: 'gemini',
    providerModel: 'gemini-3.5-flash'
  });
  const factCheck = { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 };
  const legacyReport = buildNewsletterQualityReport('2026-05-03', legacy, { candidates: [] }, factCheck);
  const domainReport = buildNewsletterQualityReport('2026-05-03', draft, { candidates: [] }, factCheck);

  assert.equal(domainReport.status, legacyReport.status);
  assert.equal(domainReport.score, legacyReport.score);
});
