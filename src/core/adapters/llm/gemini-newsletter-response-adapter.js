const {
  extractJson
} = require('../../../generator/reporter/llm-errors');
const {
  normalizeNewsletterIssue
} = require('../../domain/newsletter-domain-normalize');
const {
  validateNewsletterIssueModel
} = require('../../domain/newsletter-domain-validate');
const {
  adapterOutput
} = require('./llm-response-adapter-contract');

function rawTextFromGeminiResponse(rawResponse) {
  if (typeof rawResponse === 'string') return rawResponse;
  if (typeof rawResponse?.text === 'function') return rawResponse.text();
  if (typeof rawResponse?.text === 'string') return rawResponse.text;
  if (rawResponse && typeof rawResponse === 'object') return JSON.stringify(rawResponse);
  return '';
}

function parseGeminiNewsletterResponse(rawResponse, context = {}) {
  const payload = context.parsedPayload || extractJson(
    rawTextFromGeminiResponse(rawResponse),
    context.stage || 'editor',
    'Gemini'
  );
  const issue = normalizeNewsletterIssue(payload, {
    date: context.newsletterDate || context.date
  });
  const validation = validateNewsletterIssueModel(issue, {
    requireLegacyRendererFields: context.requireLegacyRendererFields === true
  });
  return adapterOutput({
    provider: 'gemini',
    providerModel: context.model || context.providerModel || 'unknown',
    rawShapeVersion: context.rawShapeVersion || 'unknown',
    issue: validation.normalized,
    diagnostics: {
      warnings: validation.warnings,
      repairedFields: validation.warnings
        .filter(item => item.code === 'legacy_field_repaired')
        .map(item => item.path),
      droppedFields: validation.warnings
        .filter(item => item.code === 'provider_raw_field_dropped')
        .map(item => item.path),
      rawResponseStored: context.rawResponseStored === true
    }
  });
}

module.exports = {
  parseGeminiNewsletterResponse
};
