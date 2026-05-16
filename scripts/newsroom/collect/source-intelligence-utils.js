const crypto = require('crypto');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value = '') {
  return String(value || '').trim();
}

function stableId(parts) {
  return crypto
    .createHash('sha256')
    .update(parts.map(part => text(part).toLowerCase()).join('\n'))
    .digest('hex')
    .slice(0, 16);
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = url.hash || '';
    return url.toString();
  } catch (_error) {
    return '';
  }
}

function urlHostname(value = '') {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_error) {
    return '';
  }
}

function domainMatches(hostname, domain) {
  const host = text(hostname).toLowerCase().replace(/^www\./, '');
  const allowed = text(domain).toLowerCase().replace(/^www\./, '');
  return Boolean(host && allowed && (host === allowed || host.endsWith(`.${allowed}`)));
}

function sourceAllowedDomains(source = {}) {
  const domains = new Set();
  const addUrl = (value) => {
    const host = urlHostname(value);
    if (host) domains.add(host);
  };
  addUrl(source.sourceUrl);
  addUrl(source.rssUrl);
  for (const domain of source.linkedEvidencePolicy?.allowedDomains || []) {
    if (text(domain)) domains.add(text(domain).toLowerCase().replace(/^www\./, ''));
  }
  return [...domains];
}

function registryAllowedDomains(sourceRegistry = {}) {
  const domains = new Set();
  for (const source of sourceRegistry.sources || []) {
    for (const domain of sourceAllowedDomains(source)) {
      domains.add(domain);
    }
  }
  return [...domains];
}

function sourceForUrl(sourceRegistry = {}, url = '') {
  const host = urlHostname(url);
  if (!host) return null;
  for (const source of sourceRegistry.sources || []) {
    if (sourceAllowedDomains(source).some(domain => domainMatches(host, domain))) {
      return source;
    }
  }
  return null;
}

function isUrlAllowed(sourceRegistry = {}, url = '') {
  const host = urlHostname(url);
  return Boolean(host && registryAllowedDomains(sourceRegistry).some(domain => domainMatches(host, domain)));
}

function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function candidateUrl(candidate = {}) {
  return normalizeUrl(candidate.url || candidate.articleUrl || candidate.article_url);
}

function candidateTitle(candidate = {}) {
  return text(candidate.title || candidate.headline);
}

function candidateDate(candidate = {}) {
  return text(candidate.publishedAt || candidate.published_date || candidate.publishedDate);
}

function fetchTextWithLimit(fetchImpl, url, options = {}) {
  const timeoutMs = options.timeoutMs || 5000;
  const maxBytes = options.maxBytes || 200000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const fetchOptions = controller ? { signal: controller.signal } : {};
  return Promise.resolve()
    .then(() => fetchImpl(url, fetchOptions))
    .then(async response => {
      if (!response || response.ok === false) {
        throw new Error(`fetch failed: ${response?.status || 'unknown'}`);
      }
      const body = await response.text();
      return String(body || '').slice(0, maxBytes);
    })
    .finally(() => {
      if (timeout) clearTimeout(timeout);
    });
}

module.exports = {
  candidateDate,
  candidateTitle,
  candidateUrl,
  clamp,
  domainMatches,
  fetchTextWithLimit,
  isObject,
  isUrlAllowed,
  numeric,
  normalizeUrl,
  registryAllowedDomains,
  sourceAllowedDomains,
  sourceForUrl,
  stableId,
  text,
  urlHostname
};
