const {
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES,
  RAW_EXCERPT_MAX_LENGTH
} = require('./linked-evidence-types');
const {
  normalizeLinkedEvidence,
  truncateRawExcerpt
} = require('./linked-evidence-schema');
const androidGerritResolver = require('./resolvers/android-gerrit-resolver');
const cveResolver = require('./resolvers/cve-resolver');
const genericUrlResolver = require('./resolvers/generic-url-resolver');
const githubResolver = require('./resolvers/github-resolver');
const googleIssueTrackerResolver = require('./resolvers/google-issue-tracker-resolver');
const mailingListResolver = require('./resolvers/mailing-list-resolver');

const BLOCKED_HTTP_STATUSES = new Set([401, 403, 429, 451]);
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MAX_BYTES = 200000;
const MAX_REDIRECTS = 3;

const FETCH_BACKED_RESOLVERS = [
  androidGerritResolver,
  googleIssueTrackerResolver,
  githubResolver,
  mailingListResolver,
  cveResolver,
  genericUrlResolver
];

function text(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function uniqueText(values, limit = 20) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function defaultResolved() {
  return {
    title: '',
    summary: '',
    changed_files: [],
    bug_ids: [],
    cve_ids: [],
    test_info: '',
    labels: [],
    component: ''
  };
}

function normalizeResolved(payload = {}) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    title: text(source.title).slice(0, 240),
    summary: text(source.summary).slice(0, 500),
    changed_files: uniqueText(source.changed_files || source.changedFiles, 50),
    bug_ids: uniqueText(source.bug_ids || source.bugIds, 50),
    cve_ids: uniqueText(source.cve_ids || source.cveIds, 50).map(item => item.toUpperCase()),
    test_info: text(source.test_info || source.testInfo).slice(0, 500),
    labels: uniqueText(source.labels, 50),
    component: text(source.component).slice(0, 240)
  };
}

function hasStructuredData(resolved) {
  return Boolean(
    resolved.title ||
    resolved.summary ||
    resolved.test_info ||
    resolved.component ||
    resolved.changed_files.length > 0 ||
    resolved.bug_ids.length > 0 ||
    resolved.cve_ids.length > 0 ||
    resolved.labels.length > 0
  );
}

function uniqueWarnings(values) {
  return uniqueText(values, 100);
}

function effectiveExcerptCap(value) {
  const parsed = Number(value);
  const safeValue = Number.isFinite(parsed)
    ? Math.max(0, Math.floor(parsed))
    : RAW_EXCERPT_MAX_LENGTH;
  return Math.min(safeValue, RAW_EXCERPT_MAX_LENGTH);
}

function effectiveMaxBytes(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : DEFAULT_MAX_BYTES;
}

function effectiveMaxLinks(value, fallback = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function buildResult(base, {
  resolver,
  fetchStatus,
  rawExcerpt = base.raw_excerpt,
  warnings = [],
  resolved = {},
  excerptCap = RAW_EXCERPT_MAX_LENGTH,
  skippedReason = base.skipped_reason
}) {
  const resolvedPayload = fetchStatus === FETCH_STATUSES.RESOLVED
    ? normalizeResolved(resolved)
    : defaultResolved();
  const result = {
    ...base,
    raw_excerpt: truncateRawExcerpt(rawExcerpt, excerptCap),
    fetch_status: fetchStatus,
    warnings: uniqueWarnings([...(base.warnings || []), ...warnings]),
    resolver,
    resolved: resolvedPayload
  };
  const reason = text(skippedReason);
  if (reason) result.skipped_reason = reason;
  return result;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function firstMatch(value, patterns) {
  for (const pattern of patterns) {
    const match = String(value || '').match(pattern);
    if (match?.[1]) return text(decodeHtmlEntities(match[1]));
  }
  return '';
}

function collectMatches(value, pattern, index = 1) {
  const result = [];
  for (const match of String(value || '').matchAll(pattern)) {
    if (match[index]) result.push(decodeHtmlEntities(match[index]));
  }
  return result;
}

function extractCommonStructured(body, evidence = {}) {
  const raw = String(body || '');
  const plain = stripHtml(raw);
  const title = firstMatch(raw, [
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  ]);
  const summary = firstMatch(raw, [
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i
  ]);
  const bugIds = uniqueText([
    ...collectMatches(raw, /\bb\/(\d{4,})\b/gi),
    ...collectMatches(raw, /\bBug:\s*(?:b\/)?(\d{4,})\b/gi),
    ...collectMatches(raw, /\bFixes:\s*(?:b\/)?(\d{4,})\b/gi),
    evidence.type === LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER ? evidence.identifier : ''
  ]);
  const cveIds = uniqueText([
    ...collectMatches(raw, /\b(CVE-\d{4}-\d{4,})\b/gi),
    evidence.type === LINKED_EVIDENCE_TYPES.CVE ? evidence.identifier : ''
  ]).map(item => item.toUpperCase());
  const testInfo = firstMatch(plain, [
    /\bTests?:\s*([^.;\n]{1,300})/i,
    /\bTested:\s*([^.;\n]{1,300})/i
  ]);
  const component = firstMatch(plain, [
    /\bComponent:\s*([^.;\n]{1,160})/i,
    /\bSubsystem:\s*([^.;\n]{1,160})/i
  ]);

  return normalizeResolved({
    title,
    summary,
    bug_ids: bugIds,
    cve_ids: cveIds,
    test_info: testInfo,
    component
  });
}

function extractChangedFiles(body) {
  const raw = String(body || '');
  return uniqueText([
    ...collectMatches(raw, /\bdata-path=["']([^"']+)["']/gi),
    ...collectMatches(raw, /\btitle=["']([^"']+\.(?:aidl|bp|cc|cpp|gradle|h|hpp|java|js|kt|mk|md|py|ts|xml))["']/gi),
    ...collectMatches(raw, /\b(?:[\w.+-]+\/)+[\w.+-]+\.(?:aidl|bp|cc|cpp|gradle|h|hpp|java|js|kt|mk|md|py|ts|xml)\b/gi, 0)
  ], 50);
}

function extractLabels(body) {
  const raw = String(body || '');
  return uniqueText([
    ...collectMatches(raw, /\bdata-name=["']([^"']+)["']/gi),
    ...collectMatches(raw, /\baria-label=["']Label:\s*([^"']+)["']/gi),
    ...collectMatches(raw, /<span[^>]+class=["'][^"']*(?:Label|label)[^"']*["'][^>]*>([^<]+)<\/span>/gi)
  ], 50);
}

function mergeResolved(...payloads) {
  const merged = defaultResolved();
  for (const payload of payloads) {
    const normalized = normalizeResolved(payload);
    merged.title ||= normalized.title;
    merged.summary ||= normalized.summary;
    merged.test_info ||= normalized.test_info;
    merged.component ||= normalized.component;
    merged.changed_files = uniqueText([...merged.changed_files, ...normalized.changed_files], 50);
    merged.bug_ids = uniqueText([...merged.bug_ids, ...normalized.bug_ids], 50);
    merged.cve_ids = uniqueText([...merged.cve_ids, ...normalized.cve_ids], 50);
    merged.labels = uniqueText([...merged.labels, ...normalized.labels], 50);
  }
  return merged;
}

async function responseText(response, maxBytes = DEFAULT_MAX_BYTES) {
  const byteLimit = effectiveMaxBytes(maxBytes);
  if (response?.body && typeof response.body.getReader === 'function' && typeof TextDecoder === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let body = '';
    let byteLength = 0;
    let oversized = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || []);
        if (byteLength + chunk.byteLength > byteLimit) {
          const remaining = Math.max(0, byteLimit - byteLength);
          if (remaining > 0) body += decoder.decode(chunk.slice(0, remaining), { stream: true });
          byteLength += chunk.byteLength;
          oversized = true;
          if (typeof reader.cancel === 'function') await reader.cancel();
          break;
        }
        body += decoder.decode(chunk, { stream: true });
        byteLength += chunk.byteLength;
      }
      body += decoder.decode();
    } catch (error) {
      if (!oversized) throw error;
    }

    return { body, byteLength, oversized };
  }

  const body = await response.text();
  const byteLength = Buffer.byteLength(body, 'utf8');
  return {
    body: byteLength > byteLimit ? body.slice(0, byteLimit) : body,
    byteLength,
    oversized: byteLength > byteLimit
  };
}

async function fetchWithTimeout(url, context) {
  const timeoutMs = Number.isFinite(Number(context.timeoutMs))
    ? Math.max(0, Number(context.timeoutMs))
    : DEFAULT_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeout = null;
  const request = {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'camera-hal-sw-newsletter/1.0',
      accept: 'text/html,application/json,text/plain,*/*'
    },
    signal: controller ? controller.signal : undefined
  };
  const fetchPromise = Promise.resolve().then(() => context.fetchClient(url, request));

  if (timeoutMs <= 0) return fetchPromise;

  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      if (controller) controller.abort();
      const error = new Error(`timeout after ${timeoutMs}ms`);
      error.name = 'AbortError';
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function responseStatus(response) {
  const status = Number(response?.status);
  if (Number.isFinite(status) && status > 0) return status;
  return null;
}

function responseOk(response, status) {
  if (!response) return false;
  if (response.ok === false) return false;
  return status >= 200 && status < 300;
}

function responseHeader(response, name) {
  const headers = response?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') return text(headers.get(name));
  const lowerName = String(name || '').toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === lowerName) return text(value);
  }
  return '';
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

function validateUrlForFetch(url, evidence, context, redirectReasonPrefix = '') {
  let parsed;
  try {
    parsed = new URL(text(url));
  } catch {
    return {
      ok: false,
      skippedReason: redirectReasonPrefix ? 'redirect_invalid_location' : 'invalid_url',
      warning: 'Linked evidence network fetch skipped: invalid URL.'
    };
  }

  if (context.httpsOnly !== false && parsed.protocol !== 'https:') {
    return {
      ok: false,
      skippedReason: redirectReasonPrefix ? 'redirect_non_https_url' : 'non_https_url',
      warning: 'Linked evidence network fetch skipped: non-https URL.'
    };
  }

  if (typeof context.validateFinalUrl === 'function') {
    const result = context.validateFinalUrl(parsed.toString(), evidence) || {};
    if (result.ok === false) {
      return {
        ok: false,
        skippedReason: text(result.skippedReason || result.skipped_reason || 'redirect_not_primary_evidence'),
        warning: text(result.warning || `Linked evidence network fetch skipped: ${result.skippedReason || result.skipped_reason || 'final URL rejected'}.`)
      };
    }
  }

  return {
    ok: true,
    url: parsed.toString()
  };
}

async function fetchWithRedirects(url, evidence, context) {
  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    const response = await fetchWithTimeout(currentUrl, context);
    const status = responseStatus(response);
    if (!isRedirectStatus(status)) {
      return { response, finalUrl: text(response?.url) || currentUrl };
    }

    if (redirectCount >= MAX_REDIRECTS) {
      return {
        skippedReason: 'redirect_limit_exceeded',
        warning: 'Linked evidence network fetch skipped: redirect limit exceeded.'
      };
    }

    const location = responseHeader(response, 'location');
    if (!location) {
      return {
        skippedReason: 'redirect_invalid_location',
        warning: 'Linked evidence network fetch skipped: redirect Location header is missing.'
      };
    }

    let nextUrl;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      return {
        skippedReason: 'redirect_invalid_location',
        warning: 'Linked evidence network fetch skipped: redirect Location header is invalid.'
      };
    }

    const validation = validateUrlForFetch(nextUrl, evidence, context, 'redirect');
    if (!validation.ok) {
      return validation;
    }

    currentUrl = validation.url;
    redirectCount += 1;
  }
}

async function resolveFetchBacked(evidence, options, context) {
  const resolver = options.resolver || 'unknown';
  if (!evidence.url) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.UNSUPPORTED,
      warnings: [`${resolver} resolver requires a URL.`],
      excerptCap: context.excerptCap
    });
  }

  const initialUrlValidation = validateUrlForFetch(evidence.url, evidence, {
    ...context,
    validateFinalUrl: null
  });
  if (!initialUrlValidation.ok) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.SKIPPED,
      warnings: [initialUrlValidation.warning],
      excerptCap: context.excerptCap,
      skippedReason: initialUrlValidation.skippedReason
    });
  }

  if (context.enableNetwork !== true) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.SKIPPED,
      warnings: ['Linked evidence network fetch skipped: enableNetwork is false.'],
      excerptCap: context.excerptCap,
      skippedReason: 'network_disabled'
    });
  }

  if (typeof context.fetchClient !== 'function') {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.SKIPPED,
      warnings: ['Linked evidence network fetch skipped: fetchClient is not configured.'],
      excerptCap: context.excerptCap,
      skippedReason: 'fetch_client_missing'
    });
  }

  let response;
  let finalUrl = evidence.url;
  try {
    const fetchResult = await fetchWithRedirects(initialUrlValidation.url, evidence, context);
    if (fetchResult.skippedReason) {
      return buildResult(evidence, {
        resolver,
        fetchStatus: FETCH_STATUSES.SKIPPED,
        warnings: [fetchResult.warning],
        excerptCap: context.excerptCap,
        skippedReason: fetchResult.skippedReason
      });
    }
    response = fetchResult.response;
    finalUrl = fetchResult.finalUrl;
  } catch (error) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.FAILED,
      warnings: [`Linked evidence fetch failed: ${text(error?.message || error?.name || 'unknown error')}`],
      excerptCap: context.excerptCap
    });
  }

  const status = responseStatus(response);
  if (status === null) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.FAILED,
      warnings: ['Linked evidence fetch failed: response status is missing or invalid.'],
      excerptCap: context.excerptCap
    });
  }

  const finalUrlValidation = validateUrlForFetch(finalUrl, evidence, context, 'redirect');
  if (!finalUrlValidation.ok) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.SKIPPED,
      warnings: [finalUrlValidation.warning],
      excerptCap: context.excerptCap,
      skippedReason: finalUrlValidation.skippedReason
    });
  }

  if (BLOCKED_HTTP_STATUSES.has(status)) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.BLOCKED,
      warnings: [`Linked evidence fetch blocked with HTTP ${status}.`],
      excerptCap: context.excerptCap
    });
  }

  if (!responseOk(response, status)) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.FAILED,
      warnings: [`Linked evidence fetch failed with HTTP ${status || 'unknown'}.`],
      excerptCap: context.excerptCap
    });
  }

  if (typeof response.text !== 'function') {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.FAILED,
      warnings: ['Linked evidence fetch failed: response text() is missing.'],
      excerptCap: context.excerptCap
    });
  }

  let body = '';
  let bodyBytes = 0;
  let bodyOversized = false;
  try {
    const result = await responseText(response, context.maxBytes);
    body = result.body;
    bodyBytes = result.byteLength;
    bodyOversized = result.oversized;
  } catch (error) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.FAILED,
      warnings: [`Linked evidence body read failed: ${text(error?.message || 'unknown error')}`],
      excerptCap: context.excerptCap
    });
  }

  if (bodyOversized) {
    return buildResult(evidence, {
      resolver,
      fetchStatus: FETCH_STATUSES.SKIPPED,
      rawExcerpt: body,
      warnings: [`Linked evidence response exceeded max bytes: ${bodyBytes}/${context.maxBytes}.`],
      excerptCap: context.excerptCap,
      skippedReason: 'response_too_large'
    });
  }

  const warnings = [];
  if (text(body).length > context.excerptCap) warnings.push('excerpt_truncated');
  const structured = mergeResolved(
    context.extractCommonStructured(body, evidence),
    typeof options.extractStructured === 'function' ? options.extractStructured(body, evidence, context) : {}
  );
  if (!hasStructuredData(structured)) warnings.push('structured_extraction_incomplete');

  return buildResult(evidence, {
    resolver,
    fetchStatus: FETCH_STATUSES.RESOLVED,
    rawExcerpt: body,
    resolved: structured,
    warnings,
    excerptCap: context.excerptCap
  });
}

function unsupportedResolver(evidence, resolver, reason, context) {
  return buildResult(evidence, {
    resolver,
    fetchStatus: FETCH_STATUSES.UNSUPPORTED,
    warnings: [reason || `Unsupported linked evidence type: ${evidence.type || 'unknown'}.`],
    excerptCap: context.excerptCap
  });
}

function resolverFor(type) {
  return FETCH_BACKED_RESOLVERS.find(resolver => resolver.supports(type)) || null;
}

function createContext(options) {
  const excerptCap = effectiveExcerptCap(options.maxExcerptChars);
  return {
    enableNetwork: options.enableNetwork,
    excerptCap,
    fetchClient: options.fetchClient,
    httpsOnly: options.httpsOnly,
    maxBytes: effectiveMaxBytes(options.maxBytes),
    timeoutMs: options.timeoutMs,
    validateFinalUrl: options.validateFinalUrl,
    extractChangedFiles,
    extractCommonStructured,
    extractLabels,
    mergeResolved,
    resolveFetchBacked,
    unsupportedResolver
  };
}

async function resolveOne(item, context) {
  const base = normalizeLinkedEvidence(item);
  const resolver = resolverFor(base.type);
  if (!resolver) {
    return unsupportedResolver(
      base,
      'unsupported',
      `Unsupported linked evidence type: ${base.type || 'unknown'}.`,
      context
    );
  }

  try {
    return await resolver.resolve(base, context);
  } catch (error) {
    return buildResult(base, {
      resolver: resolver.name || 'unknown',
      fetchStatus: FETCH_STATUSES.FAILED,
      warnings: [`Linked evidence resolver failed: ${text(error?.message || 'unknown error')}`],
      excerptCap: context.excerptCap
    });
  }
}

async function resolveLinkedEvidence(items, {
  fetchClient,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxExcerptChars = RAW_EXCERPT_MAX_LENGTH,
  maxBytes = DEFAULT_MAX_BYTES,
  maxLinksPerCandidate,
  maxLinks,
  httpsOnly = true,
  validateFinalUrl,
  enableNetwork = false
} = {}) {
  if (!Array.isArray(items)) return [];
  const context = createContext({
    enableNetwork,
    fetchClient,
    httpsOnly,
    maxBytes,
    maxExcerptChars,
    timeoutMs,
    validateFinalUrl
  });
  const linkLimit = effectiveMaxLinks(
    maxLinksPerCandidate === undefined ? maxLinks : maxLinksPerCandidate
  );
  const results = [];
  for (const [index, item] of items.entries()) {
    if (index >= linkLimit) {
      const base = normalizeLinkedEvidence(item);
      results.push(buildResult(base, {
        resolver: 'limit',
        fetchStatus: FETCH_STATUSES.SKIPPED,
        warnings: ['Linked evidence network fetch skipped: max links per candidate exceeded.'],
        excerptCap: context.excerptCap,
        skippedReason: 'max_links_per_candidate_exceeded'
      }));
      continue;
    }
    results.push(await resolveOne(item, context));
  }
  return results;
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_REDIRECTS,
  defaultResolved,
  resolveLinkedEvidence
};
