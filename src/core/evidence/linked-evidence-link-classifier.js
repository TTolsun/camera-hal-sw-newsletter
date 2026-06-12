const EVIDENCE_ROLES = Object.freeze({
  UNCLASSIFIED: 'unclassified',
  PRIMARY_EVIDENCE: 'primary_evidence',
  SECONDARY_CONTEXT: 'secondary_context',
  NOISE: 'noise',
  UNSUPPORTED: 'unsupported',
  BLOCKED_OR_DEFERRED: 'blocked_or_deferred'
});

const EVIDENCE_ROLE_VALUES = Object.freeze(Object.values(EVIDENCE_ROLES));

const DEFAULT_IMPORTANT_ANCHOR_KEYWORDS = Object.freeze([
  'release notes',
  'release note',
  'changelog',
  'documentation',
  'docs',
  'source code',
  'issue',
  'bug',
  'security bulletin',
  'details',
  'learn more',
  'gerrit',
  'commit',
  'pull request',
  'pr'
]);

const DEFAULT_IGNORE_ANCHOR_KEYWORDS = Object.freeze([
  'privacy',
  'subscribe',
  'share',
  'rss',
  'profile',
  'terms',
  'comment',
  'newsletter',
  'feed',
  'sign in',
  'login'
]);

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function ensureStringArray(value) {
  return Array.isArray(value)
    ? value.map(item => text(item).toLowerCase()).filter(Boolean)
    : [];
}

function normalizeDomain(value = '') {
  const raw = text(value).toLowerCase();
  if (!raw) return '';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '');
  }
}

function normalizeLinkedEvidencePolicy(policy = {}) {
  const source = policy && typeof policy === 'object' && !Array.isArray(policy) ? policy : {};
  return {
    enabled: source.enabled === true,
    allowedDomains: ensureStringArray(source.allowedDomains).map(normalizeDomain).filter(Boolean),
    importantAnchorKeywords: ensureStringArray(
      source.importantAnchorKeywords || DEFAULT_IMPORTANT_ANCHOR_KEYWORDS
    ),
    ignoreAnchorKeywords: ensureStringArray(
      source.ignoreAnchorKeywords || DEFAULT_IGNORE_ANCHOR_KEYWORDS
    )
  };
}

function includesKeyword(value, keywords = []) {
  const haystack = text(value).toLowerCase();
  return keywords.some(keyword => keyword && haystack.includes(keyword));
}

function parseUrl(value = '') {
  try {
    const parsed = new URL(text(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function hostAllowed(hostname = '', allowedDomains = []) {
  const host = normalizeDomain(hostname);
  return allowedDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function isUtilityUrl(parsed) {
  const value = `${parsed.hostname} ${parsed.pathname} ${parsed.search} ${parsed.hash}`.toLowerCase();
  return [
    /\/privacy(?:[/?#]|$)/,
    /\/terms(?:[/?#]|$)/,
    /\/profiles?(?:[/?#]|$)/,
    /\/authors?(?:[/?#]|$)/,
    /\/feeds?(?:[/?#]|$)/,
    /\/rss(?:[/?#]|$)/,
    /[?&]alt=rss\b/,
    /[?&]share=/,
    /\/share(?:[/?#]|$)/,
    /\/subscribe(?:[/?#]|$)/,
    /\/newsletter(?:[/?#]|$)/
  ].some(pattern => pattern.test(value));
}

function isOfficialPrimaryEvidenceUrl(parsed) {
  const host = normalizeDomain(parsed.hostname);
  const path = parsed.pathname.toLowerCase();
  if (host === 'android-review.googlesource.com' && /\/\+\/\d+/.test(path)) return true;
  if (host === 'issuetracker.google.com' && /^\/issues\/\d+/.test(path)) return true;
  if (host === 'github.com' && /\/(?:releases\/tag|commit|pull|issues)\//.test(path)) return true;
  if (host === 'developer.android.com' && (
    /\/jetpack\/androidx\/releases\//.test(path) ||
    /\/studio\/releases/.test(path) ||
    /\/docs\//.test(path)
  )) return true;
  if (host === 'source.android.com' && (
    /\/docs\/whatsnew/.test(path) ||
    /\/docs\/security\/bulletin/.test(path) ||
    /\/docs\/core\/camera/.test(path) ||
    /\/docs\/compatibility\/cdd/.test(path)
  )) return true;
  if (host === 'libcamera.org' && /\/(?:blog|introduction|guides|api-html)\//.test(path)) return true;
  if (host === 'lists.libcamera.org' && /\/pipermail\/libcamera-devel\//.test(path)) return true;
  if (host === 'git.libcamera.org') return true;
  return false;
}

function normalizeOutgoingLink(link = {}) {
  return {
    url: text(link.url),
    text: text(link.text),
    source_field: text(link.source_field || link.sourceField),
    extraction_method: text(link.extraction_method || link.extractionMethod || 'html_anchor')
  };
}

function classifyOutgoingLink(link = {}, policy = {}) {
  const normalized = normalizeOutgoingLink(link);
  const parsed = parseUrl(normalized.url);
  const normalizedPolicy = normalizeLinkedEvidencePolicy(policy);

  if (!parsed) {
    return {
      ...normalized,
      evidence_role: EVIDENCE_ROLES.UNSUPPORTED,
      classification_reason: 'invalid_or_unsupported_url'
    };
  }

  const ignored = includesKeyword(
    `${normalized.text} ${parsed.pathname} ${parsed.search} ${parsed.hash}`,
    normalizedPolicy.ignoreAnchorKeywords
  ) || isUtilityUrl(parsed);

  if (ignored) {
    return {
      ...normalized,
      evidence_role: EVIDENCE_ROLES.NOISE,
      classification_reason: 'ignored_utility_link'
    };
  }

  if (!normalizedPolicy.enabled) {
    return {
      ...normalized,
      evidence_role: EVIDENCE_ROLES.BLOCKED_OR_DEFERRED,
      classification_reason: 'linked_evidence_policy_disabled'
    };
  }

  if (!hostAllowed(parsed.hostname, normalizedPolicy.allowedDomains)) {
    return {
      ...normalized,
      evidence_role: EVIDENCE_ROLES.UNSUPPORTED,
      classification_reason: 'domain_not_allowed_by_policy'
    };
  }

  const importantAnchor = includesKeyword(normalized.text, normalizedPolicy.importantAnchorKeywords);
  const officialEvidence = isOfficialPrimaryEvidenceUrl(parsed);
  if (officialEvidence) {
    return {
      ...normalized,
      evidence_role: EVIDENCE_ROLES.PRIMARY_EVIDENCE,
      classification_reason: 'allowed_official_evidence_url'
    };
  }

  return {
    ...normalized,
    evidence_role: EVIDENCE_ROLES.SECONDARY_CONTEXT,
    classification_reason: importantAnchor ? 'important_allowed_context_link' : 'allowed_domain_context_link'
  };
}

function classifyOutgoingLinks(links = [], policy = {}) {
  return (Array.isArray(links) ? links : []).map(link => classifyOutgoingLink(link, policy));
}

module.exports = {
  DEFAULT_IGNORE_ANCHOR_KEYWORDS,
  DEFAULT_IMPORTANT_ANCHOR_KEYWORDS,
  EVIDENCE_ROLES,
  EVIDENCE_ROLE_VALUES,
  classifyOutgoingLink,
  classifyOutgoingLinks,
  normalizeLinkedEvidencePolicy
};
