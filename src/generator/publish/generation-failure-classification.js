// Generation failure classification.
//
// Single responsibility: map a thrown generation error to the diagnostic
// `failure_stage` and `failure_class` recorded in the generation status.
// These are pure transforms (error -> string) extracted from the generation
// orchestrator (gemini-newsroom-newsletter.js) so the orchestrator no longer
// owns this concern.

// stage 정체성은 에러가 구조화 필드로 싣고 온다(#981). 예전에는 메시지의 `[label]` prefix를
// 정규식으로 잘랐는데, 그건 sanitize가 아니라 의미 해석이라 label 철자에 묶여 있었다.
function failureStageFromError(error) {
  if (error?.stage) return error.stage;
  return 'generation';
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
