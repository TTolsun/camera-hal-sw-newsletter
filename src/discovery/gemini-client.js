const target = require.resolve('../shared/llm/llm-client');
delete require.cache[target];
const llmClient = require(target);

class GeminiJsonParseError extends llmClient.LlmJsonParseError {
  constructor(stage, message, rawText = '') {
    super(stage, message, rawText);
    this.name = 'GeminiJsonParseError';
  }
}

function extractJson(text, stage) {
  try {
    return llmClient.extractJson(text, stage, 'Gemini');
  } catch (error) {
    if (error instanceof llmClient.LlmJsonParseError) {
      const prefix = `[${stage}] `;
      const message = String(error.message || '').startsWith(prefix)
        ? String(error.message).slice(prefix.length)
        : error.message;
      throw new GeminiJsonParseError(stage, message, error.rawText);
    }
    throw error;
  }
}

module.exports = {
  GeminiJsonParseError,
  buildCostReport: llmClient.buildCostReport,
  buildCostReportMarkdown: llmClient.buildCostReportMarkdown,
  callGeminiJson: llmClient.callLlmJson,
  callGeminiJsonBudgeted: llmClient.callLlmJsonBudgeted,
  estimateCallCost: llmClient.estimateCallCost,
  extractJson,
  findPricing: llmClient.findPricing,
  getGeminiDiagnostics: llmClient.getLlmDiagnostics,
  getGeminiCostCalls: llmClient.getLlmCostCalls,
  getGeminiModelUsage: llmClient.getLlmModelUsage,
  parseRetryDelayMs: llmClient.parseRetryDelayMs,
  resetGeminiDiagnostics: llmClient.resetLlmDiagnostics,
  safeFilenamePart: llmClient.safeFilenamePart,
  saveRawGeminiOutput: llmClient.saveRawLlmOutput,
  usageMetadataFromResponse: llmClient.usageMetadataFromResponse
};
