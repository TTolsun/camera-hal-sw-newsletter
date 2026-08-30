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

function canonicalContentUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'developer.android.google.cn') {
      parsed.hostname = 'developer.android.com';
    }
    if (parsed.hostname === 'source.android.google.cn') {
      parsed.hostname = 'source.android.com';
    }
    if (['developer.android.com', 'source.android.com'].includes(parsed.hostname)) {
      parsed.searchParams.delete('hl');
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function canonicalDocumentUrl(value = '') {
  const canonical = canonicalContentUrl(value);
  if (!canonical) return '';
  try {
    const parsed = new URL(canonical);
    parsed.hash = '';
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    return parsed.toString();
  } catch {
    return canonical.replace(/#.*$/, '').replace(/\/+$/, '');
  }
}

function fetchUrlForContent(value = '') {
  const canonical = canonicalContentUrl(value);
  if (!canonical) return canonical;
  try {
    const parsed = new URL(canonical);
    if (['developer.android.com', 'source.android.com'].includes(parsed.hostname)) {
      parsed.searchParams.set('hl', 'en');
    }
    return parsed.toString();
  } catch {
    return canonical;
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
  const targetDocument = canonicalDocumentUrl(url);
  let target = null;
  try {
    target = targetDocument ? new URL(targetDocument) : null;
  } catch {
    target = null;
  }
  const sources = Array.isArray(sourceRegistry.sources) ? sourceRegistry.sources : [];
  if (!target) return null;

  const sourceMatches = sources
    .map((source, index) => {
      const sourceDocument = canonicalDocumentUrl(source.sourceUrl || source.url || '');
      let sourceUrl = null;
      try {
        sourceUrl = sourceDocument ? new URL(sourceDocument) : null;
      } catch {
        sourceUrl = null;
      }
      const sameHost = Boolean(sourceUrl && sourceUrl.hostname === target.hostname);
      const sourcePath = sourceUrl?.pathname?.replace(/\/+$/, '') || '';
      const targetPath = target.pathname.replace(/\/+$/, '');
      const exact = sameHost && sourceDocument === targetDocument;
      const prefix = sameHost && sourcePath && (
        targetPath === sourcePath ||
        targetPath.startsWith(`${sourcePath}/`)
      );
      return {
        source,
        index,
        exact,
        prefix,
        pathLength: prefix ? sourcePath.length : 0
      };
    })
    .filter(match => match.exact || match.prefix)
    .sort((left, right) =>
      Number(right.exact) - Number(left.exact) ||
      right.pathLength - left.pathLength ||
      String(left.source.id || left.source.name || '').localeCompare(String(right.source.id || right.source.name || '')) ||
      left.index - right.index
    );
  if (sourceMatches.length > 0) return sourceMatches[0].source;

  const host = target.hostname.toLowerCase().replace(/^www\./, '');
  const domainMatchesList = sources
    .map((source, index) => ({
      source,
      index,
      domainLength: Math.max(0, ...sourceAllowedDomains(source)
        .filter(domain => domainMatches(host, domain))
        .map(domain => domain.length))
    }))
    .filter(match => match.domainLength > 0)
    .sort((left, right) =>
      right.domainLength - left.domainLength ||
      String(left.source.id || left.source.name || '').localeCompare(String(right.source.id || right.source.name || '')) ||
      left.index - right.index
    );
  return domainMatchesList[0]?.source || null;
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

// 후보가 이번 호에 실릴 수 있는가. 근거 수집에서는 슬롯 순위를 정하는 1순위 신호이자
// 대상 집합에 넣을지를 가르는 조건이라, 고르는 쪽과 판정하는 쪽이 같은 값을 써야 한다.
// 후보 레코드가 camelCase와 snake_case를 섞어 들고 오므로 둘 다 본다.
function finalSelectionEligible(candidate = {}) {
  return ['main', 'short'].includes(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

// 근거 수집에서 "같은 출처"를 가르는 키. cap이 세는 단위이자 원문을 몇 번 받아올지 정하는
// 단위라서, 대상을 고르는 쪽과 실제로 받아오는 쪽이 같은 값을 써야 "한 칸 = 한 번 수신"이
// 성립한다. canonicalContentUrl을 쓰므로 Android 문서의 `hl` 로케일 파라미터만 무시하고
// 나머지 query와 fragment는 남는다 — `?q=` 목록 페이지나 `#버전` 앵커는 서로 다른 문서다.
function evidenceSourceKey(candidate = {}) {
  const canonical = canonicalContentUrl(candidateUrl(candidate));
  if (!canonical) return '';
  try {
    const parsed = new URL(canonical);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    return parsed.toString();
  } catch (_error) {
    return canonical;
  }
}

// 후보가 근거(fact)를 찾을 때 쓰는 id. 근거를 만드는 쪽(extract-source-facts)과 찾는 쪽
// (validate-candidate-evidence), 그리고 근거 수집 대상을 묶는 쪽이 반드시 같은 값을 써야 한다.
// 셋 중 하나라도 다른 산식을 쓰면 후보가 자기 근거를 못 찾아 not_checked 로 조용히 통과한다.
function candidateFactId(candidate = {}) {
  return candidate.id ||
    candidate.source_candidate_id ||
    stableId([candidateUrl(candidate), candidateTitle(candidate)]);
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
  canonicalContentUrl,
  canonicalDocumentUrl,
  candidateDate,
  candidateFactId,
  candidateTitle,
  candidateUrl,
  clamp,
  domainMatches,
  evidenceSourceKey,
  finalSelectionEligible,
  fetchUrlForContent,
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
