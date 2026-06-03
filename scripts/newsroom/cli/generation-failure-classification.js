// Generation failure classification.
//
// Single responsibility: map a thrown generation error to the diagnostic
// `failure_stage` and `failure_class` recorded in the generation status.
// These are pure transforms (error -> string) extracted from the generation
// orchestrator (gemini-newsroom-newsletter.js) so the orchestrator no longer
// owns this concern.

function failureStageFromError(error) {
  if (error?.stage) return error.stage;
  const match = String(error?.message || '').match(/^\[([^\]]+)]/);
  return match ? match[1] : 'generation';
}

function failureClassFromError(error) {
  const message = String(error?.message || '');
  if (error?.code === 'provider_not_implemented' || /provider_not_implemented|API failed|provider configuration failed/i.test(message)) {
    return 'provider_failure';
  }
  if (error?.name === 'LlmJsonParseError' || error?.code === 'adapter_failure' || /adapter failure|not valid JSON|empty response/i.test(message)) {
    return 'adapter_failure';
  }
  if (error?.name === 'NewsletterDomainValidationError' || error?.code === 'domain_validation_failure') {
    return 'domain_validation_failure';
  }
  return '';
}

module.exports = {
  failureStageFromError,
  failureClassFromError
};
