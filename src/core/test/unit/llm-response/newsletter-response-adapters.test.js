const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseGeminiNewsletterResponse
} = require('../../../adapters/llm/gemini-newsletter-response-adapter');
const {
  parseOpenApiNewsletterResponse
} = require('../../../adapters/llm/openapi-newsletter-response-adapter');

function legacyEditor() {
  return {
    date: '2026-05-03',
    title: 'Camera HAL / SW Newsletter - 2026-05-03',
    summary: 'Weekly summary for Camera HAL readers.',
    briefing: ['Brief one', 'Brief two', 'Brief three'],
    sections: [{
      source_candidate_hash: 'camerax-release',
      category: 'Android Camera',
      headline: 'CameraX release gives HAL teams a target',
      evidence_summary: 'CameraX release note gives a dated compatibility validation target.',
      specificity_checks: ['Version: CameraX 1.5.0'],
      source_verification_notes: ['Official source, dated release evidence.'],
      action_items: ['Run Camera ITS preview latency checks within 2 weeks.'],
      article_sections: {
        verified_facts: ['CameraX release note gives a dated compatibility validation target.'],
        background_context: 'CameraX sits above camera2 and exposes compatibility regressions.',
        hal_driver_impact: 'Validate stream, buffer, metadata, and Camera ITS behavior.',
        action_items: ['Run Camera ITS preview latency checks within 2 weeks.'],
        team_share_points: 'Use CameraX as a compatibility validation trigger.'
      },
      do_not_overstate: ['Do not claim a direct HAL API change.'],
      sources: [{
        title: 'CameraX release note',
        url: 'https://example.com/camerax'
      }],
      public_article: {
        headline: 'CameraX release gives HAL teams a target',
        lead: 'CameraX release gives HAL teams a dated compatibility validation signal.',
        body_paragraphs: ['The release can be read as framework-adjacent validation context.'],
        camera_hal_takeaway: 'Keep interpretation limited to source-backed compatibility validation.',
        reader_checkpoints: ['Run Camera ITS preview latency checks within 2 weeks.'],
        source_links: [{
          title: 'CameraX release note',
          url: 'https://example.com/camerax',
          source_role: 'primary'
        }]
      }
    }]
  };
}

test('Gemini newsletter response adapter converts raw model text to a domain issue', () => {
  const rawResponse = {
    text: () => JSON.stringify(legacyEditor())
  };

  const output = parseGeminiNewsletterResponse(rawResponse, {
    newsletterDate: '2026-05-03',
    model: 'gemini-3.5-flash',
    rawShapeVersion: 'test'
  });

  assert.equal(output.provider, 'gemini');
  assert.equal(output.providerModel, 'gemini-3.5-flash');
  assert.equal(output.issue.newsletterDate, '2026-05-03');
  assert.equal(output.issue.articles.length, 1);
  assert.equal(output.issue.articles[0].sourceRefs[0].url, 'https://example.com/camerax');
  assert.equal(output.adapterDiagnostics.rawResponseStored, false);
});

test('openapi newsletter response adapter is a reserved fail-fast stub', () => {
  assert.throws(
    () => parseOpenApiNewsletterResponse({}),
    error => error.code === 'provider_not_implemented'
  );
});
