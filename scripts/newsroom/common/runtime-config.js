const DEFAULT_RUNTIME_CONFIG = {
  newsletterDate: '',
  lookbackDays: 21,
  geminiModel: 'gemini-2.5-flash',
  geminiFallbackModels: ['gemini-2.5-flash-lite', 'gemini-2.5-pro'],
  geminiMaxRetries: 2,
  geminiRetryDelaysMs: [20000, 10000],
  geminiRetryMaxDelayMs: 180000,
  newsroomMaxQualityRetries: 3
};

function parseCsv(value) {
  if (value === undefined || value === null) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseInteger(value, fieldName, options = {}) {
  const hasDefault = Object.prototype.hasOwnProperty.call(options, 'defaultValue');
  if (value === undefined || value === null) {
    if (hasDefault) return options.defaultValue;
    throw new Error(`${fieldName} is required.`);
  }

  const text = String(value).trim();
  if (!text) {
    if (options.allowEmpty) return options.emptyValue;
    if (hasDefault && options.defaultOnEmpty) return options.defaultValue;
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (!/^-?\d+$/.test(text)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  const number = Number(text);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${fieldName} must be a safe integer.`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new Error(`${fieldName} must be >= ${options.min}.`);
  }
  if (options.max !== undefined && number > options.max) {
    throw new Error(`${fieldName} must be <= ${options.max}.`);
  }
  return number;
}

function parseIntegerList(value, fieldName) {
  const items = parseCsv(value);
  return items.map((item, index) => parseInteger(item, `${fieldName}[${index}]`, { min: 0 }));
}

function envValue(env, key, defaultValue) {
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : defaultValue;
}

function readRuntimeConfig(env = process.env, options = {}) {
  const newsletterDate = String(envValue(env, 'NEWSLETTER_DATE', DEFAULT_RUNTIME_CONFIG.newsletterDate) || '').trim();
  const geminiFallbackValue = envValue(env, 'GEMINI_FALLBACK_MODELS', DEFAULT_RUNTIME_CONFIG.geminiFallbackModels.join(','));

  const config = {
    newsletterDate,
    lookbackDays: parseInteger(envValue(env, 'LOOKBACK_DAYS', DEFAULT_RUNTIME_CONFIG.lookbackDays), 'LOOKBACK_DAYS', { min: 1 }),
    geminiModel: String(envValue(env, 'GEMINI_MODEL', DEFAULT_RUNTIME_CONFIG.geminiModel) || '').trim(),
    geminiFallbackModels: parseCsv(geminiFallbackValue),
    geminiMaxRetries: parseInteger(envValue(env, 'GEMINI_MAX_RETRIES', DEFAULT_RUNTIME_CONFIG.geminiMaxRetries), 'GEMINI_MAX_RETRIES', { min: 0 }),
    geminiRetryDelaysMs: parseIntegerList(
      envValue(env, 'GEMINI_RETRY_DELAYS_MS', DEFAULT_RUNTIME_CONFIG.geminiRetryDelaysMs.join(',')),
      'GEMINI_RETRY_DELAYS_MS'
    ),
    geminiRetryMaxDelayMs: parseInteger(
      envValue(env, 'GEMINI_RETRY_MAX_DELAY_MS', DEFAULT_RUNTIME_CONFIG.geminiRetryMaxDelayMs),
      'GEMINI_RETRY_MAX_DELAY_MS',
      { min: 0 }
    ),
    newsroomMaxQualityRetries: parseInteger(
      envValue(env, 'NEWSROOM_MAX_QUALITY_RETRIES', DEFAULT_RUNTIME_CONFIG.newsroomMaxQualityRetries),
      'NEWSROOM_MAX_QUALITY_RETRIES',
      { min: 0 }
    ),
    geminiApiKeyConfigured: Boolean(String(env.GEMINI_API_KEY || '').trim())
  };

  const result = validateRuntimeConfig(config, options);
  if (!result.ok) {
    throw new Error(result.errors.join('\n'));
  }

  return config;
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateRuntimeConfig(config, options = {}) {
  const errors = [];

  if (config.newsletterDate && !isValidIsoDate(config.newsletterDate)) {
    errors.push('NEWSLETTER_DATE must be empty or a valid YYYY-MM-DD date.');
  }
  if (!Number.isInteger(config.lookbackDays) || config.lookbackDays < 1) {
    errors.push('LOOKBACK_DAYS must be an integer >= 1.');
  }
  if (!String(config.geminiModel || '').trim()) {
    errors.push('GEMINI_MODEL must be non-empty.');
  }
  if (!Array.isArray(config.geminiFallbackModels)) {
    errors.push('GEMINI_FALLBACK_MODELS must be a comma-separated list.');
  } else if (config.geminiFallbackModels.some(item => !String(item || '').trim())) {
    errors.push('GEMINI_FALLBACK_MODELS must not contain empty model names.');
  }
  if (!Number.isInteger(config.geminiMaxRetries) || config.geminiMaxRetries < 0) {
    errors.push('GEMINI_MAX_RETRIES must be an integer >= 0.');
  }
  if (!Array.isArray(config.geminiRetryDelaysMs) || config.geminiRetryDelaysMs.length === 0) {
    errors.push('GEMINI_RETRY_DELAYS_MS must contain at least one integer delay.');
  } else if (config.geminiRetryDelaysMs.some(value => !Number.isInteger(value) || value < 0)) {
    errors.push('GEMINI_RETRY_DELAYS_MS values must be integers >= 0.');
  }
  if (!Number.isInteger(config.geminiRetryMaxDelayMs) || config.geminiRetryMaxDelayMs < 0) {
    errors.push('GEMINI_RETRY_MAX_DELAY_MS must be an integer >= 0.');
  }
  if (!Number.isInteger(config.newsroomMaxQualityRetries) || config.newsroomMaxQualityRetries < 0) {
    errors.push('NEWSROOM_MAX_QUALITY_RETRIES must be an integer >= 0.');
  }
  if (options.requireGeminiApiKey && !config.geminiApiKeyConfigured) {
    errors.push('GEMINI_API_KEY must be configured for Gemini newsroom generation.');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function sanitizeRuntimeConfig(config) {
  return {
    newsletterDate: config.newsletterDate,
    lookbackDays: config.lookbackDays,
    geminiModel: config.geminiModel,
    geminiFallbackModels: config.geminiFallbackModels,
    geminiMaxRetries: config.geminiMaxRetries,
    geminiRetryDelaysMs: config.geminiRetryDelaysMs,
    geminiRetryMaxDelayMs: config.geminiRetryMaxDelayMs,
    newsroomMaxQualityRetries: config.newsroomMaxQualityRetries,
    geminiApiKeyConfigured: Boolean(config.geminiApiKeyConfigured)
  };
}

module.exports = {
  DEFAULT_RUNTIME_CONFIG,
  readRuntimeConfig,
  validateRuntimeConfig,
  sanitizeRuntimeConfig,
  parseCsv,
  parseInteger,
  parseIntegerList
};
