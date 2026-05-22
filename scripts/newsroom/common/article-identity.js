const crypto = require('crypto');

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'spm',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term'
]);

const RELEASE_ANCHOR_ALLOWLIST = Object.freeze([
  {
    host: 'developer.android.com',
    path: '/jetpack/androidx/releases/camera',
    pattern: /^#(?:camera-[a-z0-9-]+-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i
  },
  {
    host: 'source.android.com',
    pathPrefix: '/',
    pattern: /^#[a-z0-9][a-z0-9._-]*$/i
  }
]);

function text(value) {
  return String(value || '').trim();
}

function firstText(values) {
  return values.map(text).find(Boolean) || '';
}

function shouldPreserveHash(parsed) {
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  return RELEASE_ANCHOR_ALLOWLIST.some(rule => {
    if (host !== rule.host) return false;
    if (rule.path && pathname !== rule.path) return false;
    if (rule.pathPrefix && !pathname.startsWith(rule.pathPrefix)) return false;
    return rule.pattern.test(parsed.hash);
  });
}

function normalizeArticleUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hostname = parsed.hostname.toLowerCase();
    if (!shouldPreserveHash(parsed)) {
      parsed.hash = '';
    }
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    const normalized = parsed.toString().replace(/\/$/, '');
    return normalized;
  } catch {
    return raw
      .replace(/#[^\s]*$/, '')
      .replace(/[?&](?:utm_[^=&\s]+|fbclid|gclid|mc_cid|mc_eid|ref)=[^&\s]*/gi, '')
      .replace(/[?&]$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }
}

function sourceUrl(candidate = {}) {
  return firstText([
    candidate.canonical_url,
    candidate.canonicalUrl,
    candidate.normalized_url,
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.source_url,
    candidate.sourceUrl,
    candidate.source_canonical_url,
    candidate.sourceCanonicalUrl,
    candidate.source?.url
  ]);
}

function sourceEventIdentity(candidate = {}) {
  return firstText([
    candidate.source_event_identity,
    candidate.sourceEventIdentity,
    candidate.event_identity,
    candidate.eventIdentity,
    candidate.release?.version && candidate.release?.date
      ? `${candidate.release.version}:${candidate.release.date}`
      : '',
    candidate.source_extraction?.release?.version && candidate.source_extraction?.release?.date
      ? `${candidate.source_extraction.release.version}:${candidate.source_extraction.release.date}`
      : ''
  ]);
}

function normalizedContentBasis(candidate = {}) {
  return [
    candidate.title,
    candidate.summary,
    candidate.published_date,
    candidate.effective_date,
    candidate.version_or_release,
    candidate.api_or_component,
    candidate.behavior_change
  ].map(text).join('|').toLowerCase().replace(/\s+/g, ' ').trim();
}

function contentHash(value) {
  const body = typeof value === 'string' ? value : normalizedContentBasis(value);
  return crypto.createHash('sha256').update(body || 'missing-content').digest('hex').slice(0, 24);
}

function articleIdentityKey(candidate = {}) {
  if (text(candidate.article_identity_key)) return text(candidate.article_identity_key);
  const url = normalizeArticleUrl(sourceUrl(candidate));
  if (url) return `url:${url}`;
  const eventIdentity = sourceEventIdentity(candidate);
  if (eventIdentity) return `event:${eventIdentity.toLowerCase()}`;
  return `content:${contentHash(candidate)}`;
}

module.exports = {
  articleIdentityKey,
  contentHash,
  normalizeArticleUrl,
  sourceEventIdentity,
  sourceUrl
};
