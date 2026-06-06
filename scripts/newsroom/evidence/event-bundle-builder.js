const { ensureArray } = require('../common/value-coercion');
const crypto = require('crypto');
const {
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES
} = require('./linked-evidence-types');

const EVENT_TYPES = Object.freeze({
  RELEASE_NOTE: 'release_note',
  ANDROID_GERRIT_CHANGE: 'android_gerrit_change',
  GITHUB_RELEASE: 'github_release',
  GITHUB_PULL_REQUEST: 'github_pull_request',
  GITHUB_ISSUE: 'github_issue',
  CVE: 'cve',
  PRIMARY_URL: 'primary_url'
});

const EVENT_BUNDLE_DEDUPE_REASONS = Object.freeze({
  CANONICAL_RELEASE_NOTE_URL: 'canonical_release_note_url',
  SOURCE_RELEASE_VERSION: 'source_id + release.version',
  SOURCE_RELEASE_DATE_COMPONENT: 'source_id + release.date + component',
  ANDROID_GERRIT_CHANGE_ID: 'android_gerrit_change_id',
  GITHUB_RELEASE: 'github_owner_repo + release_tag',
  GITHUB_ISSUE_OR_PR: 'github_owner_repo + issue_or_pr_number',
  CVE: 'cve_id',
  NORMALIZED_PRIMARY_URL: 'normalized_primary_url'
});

const NO_CONTENT_FETCH_STATUSES = new Set([
  FETCH_STATUSES.BLOCKED,
  FETCH_STATUSES.FAILED,
  FETCH_STATUSES.SKIPPED,
  FETCH_STATUSES.UNSUPPORTED
]);

const NON_EVIDENCE_ROLES = new Set([
  'noise',
  'unsupported',
  'blocked_or_deferred',
  'secondary_context'
]);

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function firstText(...values) {
  return values.map(text).find(Boolean) || '';
}

function stableHash(value, length = 12) {
  return crypto.createHash('sha256').update(text(value)).digest('hex').slice(0, length);
}

function eventId(eventKey) {
  return `event_${stableHash(eventKey)}`;
}

function candidateId(candidate = {}, index = 0) {
  return firstText(
    candidate.event_candidate_id,
    candidate.primary_candidate_id,
    candidate.candidate_id,
    candidate.source_candidate_id,
    candidate.id
  ) || `candidate_${stableHash(`${index}:${primaryUrl(candidate)}:${candidate.title || ''}`)}`;
}

function preserveAndroidCameraReleaseHash(parsed) {
  return parsed.hostname.toLowerCase() === 'developer.android.com' &&
    parsed.pathname === '/jetpack/androidx/releases/camera' &&
    /^#(?:camera-[a-z0-9-]+-)?\d+\.\d+\.\d+(?:[-\w.]*)?$/i.test(parsed.hash);
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!preserveAndroidCameraReleaseHash(parsed)) parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function primaryUrl(candidate = {}) {
  return firstText(
    candidate.primary_url,
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url
  );
}

function sourceId(candidate = {}) {
  return firstText(candidate.source_id, candidate.sourceId, candidate.source?.id);
}

function releaseDetails(candidate = {}) {
  const release = candidate.source_extraction?.release || candidate.sourceExtraction?.release || {};
  const releaseValue = typeof candidate.release === 'string' ? candidate.release : '';
  return {
    version: firstText(
      release.version,
      candidate.release?.version,
      candidate.version_or_release,
      candidate.versionOrRelease,
      candidate.version,
      releaseValue
    ),
    date: dateOnly(firstText(
      release.date,
      candidate.release?.date,
      candidate.published_date,
      candidate.publishedAt,
      candidate.published_at,
      candidate.date
    )),
    component: firstText(
      release.component,
      candidate.release?.component,
      candidate.component,
      candidate.api_or_component,
      candidate.apiOrComponent
    )
  };
}

function dateOnly(value) {
  const normalized = text(value);
  if (!normalized) return '';
  const match = normalized.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : normalized;
}

function canonicalReleaseNoteUrl(candidate = {}) {
  return normalizeUrl(firstText(
    candidate.canonical_release_note_url,
    candidate.canonicalReleaseNoteUrl,
    candidate.source_extraction?.release?.canonical_url,
    candidate.source_extraction?.release?.canonicalUrl,
    candidate.sourceExtraction?.release?.canonical_url,
    candidate.sourceExtraction?.release?.canonicalUrl
  ));
}

function evidenceUrl(item = {}) {
  return firstText(item.url, item.href, item.link);
}

function evidenceItems(candidate = {}) {
  const items = [
    ...ensureArray(candidate.linked_evidence || candidate.linkedEvidence),
    ...ensureArray(candidate.source_aware_linked_evidence || candidate.sourceAwareLinkedEvidence),
    ...ensureArray(candidate.outgoing_links || candidate.outgoingLinks)
  ];
  return items.filter(isUsableEvidenceItem);
}

function isUsableEvidenceItem(item = {}) {
  const url = evidenceUrl(item);
  const identifier = text(item.identifier);
  if (!url && !identifier) return false;
  const role = text(item.evidence_role || item.evidenceRole);
  if (role && role !== 'primary_evidence') return false;
  if (NON_EVIDENCE_ROLES.has(role)) return false;
  const status = text(item.fetch_status || item.fetchStatus);
  if (NO_CONTENT_FETCH_STATUSES.has(status)) return false;
  return true;
}

function allEvidenceUrls(candidate = {}) {
  const urls = evidenceItems(candidate).map(evidenceUrl).map(normalizeUrl).filter(Boolean);
  return uniqueText(urls);
}

function uniqueText(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of ensureArray(values)) {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function candidateAndEvidenceUrls(candidate = {}) {
  return uniqueText([
    primaryUrl(candidate),
    candidate.normalized_url,
    ...allEvidenceUrls(candidate)
  ].map(normalizeUrl));
}

function androidGerritChangeId(candidate = {}) {
  for (const item of evidenceItems(candidate)) {
    const identifier = text(item.identifier);
    if (item.type === LINKED_EVIDENCE_TYPES.ANDROID_GERRIT && identifier) return identifier;
    const fromUrl = androidGerritChangeIdFromUrl(evidenceUrl(item));
    if (fromUrl) return fromUrl;
  }
  for (const url of candidateAndEvidenceUrls(candidate)) {
    const fromUrl = androidGerritChangeIdFromUrl(url);
    if (fromUrl) return fromUrl;
  }
  return '';
}

function androidGerritChangeIdFromUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.hostname.toLowerCase() !== 'android-review.googlesource.com') return '';
    return parsed.pathname.match(/\/\+\/(\d+)/)?.[1] || parsed.pathname.match(/\/(\d+)$/)?.[1] || '';
  } catch {
    return raw.match(/\bI[a-f0-9]{8,40}\b/i)?.[0] || '';
  }
}

function githubIdentity(candidate = {}) {
  for (const url of candidateAndEvidenceUrls(candidate)) {
    const release = githubIdentityFromUrl(url, 'release');
    if (release) return release;
  }
  for (const url of candidateAndEvidenceUrls(candidate)) {
    const issueOrPr = githubIdentityFromUrl(url, 'issue_or_pr');
    if (issueOrPr) return issueOrPr;
  }
  return null;
}

function githubIdentityFromUrl(value, mode) {
  try {
    const parsed = new URL(text(value));
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts.length < 4) return null;
    const repo = `${parts[0]}/${parts[1]}`.toLowerCase();
    if (mode === 'release' && parts[2] === 'releases' && parts[3] === 'tag' && parts[4]) {
      return {
        eventType: EVENT_TYPES.GITHUB_RELEASE,
        eventKey: `github:${repo}:release:${parts[4]}`,
        dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.GITHUB_RELEASE,
        confidence: 'medium'
      };
    }
    if (mode === 'issue_or_pr' && ['pull', 'issues'].includes(parts[2]) && /^\d+$/.test(parts[3])) {
      return {
        eventType: parts[2] === 'pull' ? EVENT_TYPES.GITHUB_PULL_REQUEST : EVENT_TYPES.GITHUB_ISSUE,
        eventKey: `github:${repo}:${parts[2]}:${parts[3]}`,
        dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.GITHUB_ISSUE_OR_PR,
        confidence: 'medium'
      };
    }
  } catch {
    return null;
  }
  return null;
}

function cveId(candidate = {}) {
  const haystack = [
    candidate.title,
    candidate.summary,
    candidate.description,
    candidate.version_or_release,
    candidate.behavior_change,
    ...evidenceItems(candidate).flatMap(item => [
      item.identifier,
      item.source_text,
      item.raw_excerpt,
      item.resolved?.title,
      item.resolved?.summary,
      ...ensureArray(item.resolved?.cve_ids)
    ])
  ].map(text).join(' ');
  return haystack.match(/\bCVE-\d{4}-\d{4,}\b/i)?.[0].toUpperCase() || '';
}

function keyCandidate(candidate = {}) {
  const release = releaseDetails(candidate);
  const id = sourceId(candidate);
  const canonicalUrl = canonicalReleaseNoteUrl(candidate);
  if (canonicalUrl) {
    return {
      eventKey: `release_note_url:${canonicalUrl}`,
      eventType: EVENT_TYPES.RELEASE_NOTE,
      dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.CANONICAL_RELEASE_NOTE_URL,
      confidence: 'high'
    };
  }
  if (id && release.version) {
    return {
      eventKey: `source:${text(id).toLowerCase()}:release:${text(release.version).toLowerCase()}`,
      eventType: EVENT_TYPES.RELEASE_NOTE,
      dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.SOURCE_RELEASE_VERSION,
      confidence: 'high'
    };
  }
  if (id && release.date && release.component) {
    return {
      eventKey: `source:${text(id).toLowerCase()}:date:${release.date}:component:${text(release.component).toLowerCase()}`,
      eventType: EVENT_TYPES.RELEASE_NOTE,
      dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.SOURCE_RELEASE_DATE_COMPONENT,
      confidence: 'medium'
    };
  }
  const gerritChangeId = androidGerritChangeId(candidate);
  if (gerritChangeId) {
    return {
      eventKey: `android_gerrit:${gerritChangeId}`,
      eventType: EVENT_TYPES.ANDROID_GERRIT_CHANGE,
      dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.ANDROID_GERRIT_CHANGE_ID,
      confidence: 'medium'
    };
  }
  const github = githubIdentity(candidate);
  if (github) return github;
  const cve = cveId(candidate);
  if (cve) {
    return {
      eventKey: `cve:${cve}`,
      eventType: EVENT_TYPES.CVE,
      dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.CVE,
      confidence: 'medium'
    };
  }
  const url = normalizeUrl(primaryUrl(candidate));
  if (url) {
    return {
      eventKey: `url:${url}`,
      eventType: EVENT_TYPES.PRIMARY_URL,
      dedupeReason: EVENT_BUNDLE_DEDUPE_REASONS.NORMALIZED_PRIMARY_URL,
      confidence: 'low'
    };
  }
  return null;
}

function impactAxes(candidate = {}) {
  const impact = candidate.impact_classification || candidate.impactClassification || {};
  return uniqueText([
    impact.impact_type,
    candidate.relevance_bucket,
    candidate.source_section,
    candidate.category
  ]);
}

function buildBundle(candidate = {}, index = 0) {
  const key = keyCandidate(candidate);
  const url = normalizeUrl(primaryUrl(candidate));
  if (!key || !url) return null;
  const release = releaseDetails(candidate);
  return {
    event_id: eventId(key.eventKey),
    primary_candidate_id: candidateId(candidate, index),
    event_key: key.eventKey,
    event_type: key.eventType,
    primary_url: url,
    evidence_urls: allEvidenceUrls(candidate).filter(item => item !== url),
    dedupe_reason: key.dedupeReason,
    release: {
      version: release.version,
      date: release.date
    },
    component: release.component,
    impact_axes: impactAxes(candidate),
    confidence: key.confidence,
    warnings: []
  };
}

function mergeBundle(base, incoming) {
  const warnings = [...base.warnings];
  if (incoming.release.version && base.release.version && incoming.release.version !== base.release.version) {
    warnings.push('event_bundle_release_version_conflict');
  }
  if (incoming.release.date && base.release.date && incoming.release.date !== base.release.date) {
    warnings.push('event_bundle_release_date_conflict');
  }
  if (incoming.component && base.component && incoming.component !== base.component) {
    warnings.push('event_bundle_component_conflict');
  }

  return {
    ...base,
    evidence_urls: uniqueText([
      ...base.evidence_urls,
      incoming.primary_url === base.primary_url ? '' : incoming.primary_url,
      ...incoming.evidence_urls
    ]),
    release: {
      version: base.release.version || incoming.release.version,
      date: base.release.date || incoming.release.date
    },
    component: base.component || incoming.component,
    impact_axes: uniqueText([...base.impact_axes, ...incoming.impact_axes]),
    warnings: uniqueText(warnings)
  };
}

function buildEventBundles(candidates = []) {
  const bundlesByKey = new Map();
  for (const [index, candidate] of ensureArray(candidates).entries()) {
    const bundle = buildBundle(candidate, index);
    if (!bundle) continue;
    const existing = bundlesByKey.get(bundle.event_key);
    bundlesByKey.set(bundle.event_key, existing ? mergeBundle(existing, bundle) : bundle);
  }
  return [...bundlesByKey.values()];
}

module.exports = {
  EVENT_BUNDLE_DEDUPE_REASONS,
  EVENT_TYPES,
  buildEventBundles,
  normalizeEventBundleUrl: normalizeUrl
};
