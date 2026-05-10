const {
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES,
  MAX_LINKED_EVIDENCE_PER_CANDIDATE
} = require('./linked-evidence-types');
const { normalizeLinkedEvidence } = require('./linked-evidence-schema');

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const CHANGE_ID_RE = /\bI[a-f0-9]{8,40}\b/gi;
const BUG_ID_RE = /\bb\/(\d{4,})\b/gi;
const CVE_RE = /\bCVE-\d{4}-\d{4,}\b/gi;
const ANCHOR_RE = /(?:href=["']|[\s(])(#(?:[A-Za-z0-9][A-Za-z0-9_.:-]*))(?:["')\s]|$)/gi;

const CANDIDATE_TEXT_FIELDS = [
  'title',
  'summary',
  'description',
  'content',
  'rawHtml',
  'html',
  'sourceHtml',
  'releaseNoteHtml'
];

function cleanUrl(value) {
  return String(value || '')
    .replace(/[.,;:!?]+$/g, '')
    .replace(/&amp;/g, '&')
    .trim();
}

function makeEvidence({ type, url = '', identifier = '', sourceText = '', rawExcerpt = '' }) {
  return normalizeLinkedEvidence({
    type,
    url,
    identifier,
    source_text: sourceText,
    raw_excerpt: rawExcerpt,
    fetch_status: FETCH_STATUSES.NOT_FETCHED
  });
}

function classifyUrl(url) {
  const normalized = cleanUrl(url);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (_) {
    return {
      type: LINKED_EVIDENCE_TYPES.GENERIC_URL,
      url: normalized,
      identifier: normalized
    };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host === 'android-review.googlesource.com') {
    const id = path.match(/\/c\/[^/]+\/\+\/(\d+)/)?.[1] || path.match(/\/(\d+)$/)?.[1] || normalized;
    return { type: LINKED_EVIDENCE_TYPES.ANDROID_GERRIT, url: normalized, identifier: id };
  }

  if (host === 'issuetracker.google.com' && /^\/issues\/\d+/.test(path)) {
    return {
      type: LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER,
      url: normalized,
      identifier: path.match(/^\/issues\/(\d+)/)[1]
    };
  }

  if (host === 'github.com') {
    const pull = path.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (pull) {
      return {
        type: LINKED_EVIDENCE_TYPES.GITHUB_PULL_REQUEST,
        url: normalized,
        identifier: `${pull[1]}/${pull[2]}#${pull[3]}`
      };
    }

    const issue = path.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (issue) {
      return {
        type: LINKED_EVIDENCE_TYPES.GITHUB_ISSUE,
        url: normalized,
        identifier: `${issue[1]}/${issue[2]}#${issue[3]}`
      };
    }

    const commit = path.match(/^\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{7,40})/i);
    if (commit) {
      return {
        type: LINKED_EVIDENCE_TYPES.GITHUB_COMMIT,
        url: normalized,
        identifier: `${commit[1]}/${commit[2]}@${commit[3]}`
      };
    }

    const release = path.match(/^\/([^/]+)\/([^/]+)\/releases\/tag\/([^/]+)/);
    if (release) {
      return {
        type: LINKED_EVIDENCE_TYPES.GITHUB_RELEASE,
        url: normalized,
        identifier: `${release[1]}/${release[2]}@${decodeURIComponent(release[3])}`
      };
    }
  }

  if (
    host === 'lists.libcamera.org' ||
    host === 'lore.kernel.org' ||
    host.endsWith('.lore.kernel.org') ||
    host.includes('patchwork')
  ) {
    return {
      type: LINKED_EVIDENCE_TYPES.MAILING_LIST,
      url: normalized,
      identifier: normalized
    };
  }

  return {
    type: LINKED_EVIDENCE_TYPES.GENERIC_URL,
    url: normalized,
    identifier: normalized
  };
}

function addEvidence(results, seen, evidence) {
  if (results.length >= MAX_LINKED_EVIDENCE_PER_CANDIDATE) return;
  const key = [evidence.type, evidence.url, evidence.identifier].join('\0');
  if (seen.has(key)) return;
  seen.add(key);
  results.push(evidence);
}

function excerptAround(text, match, radius = 160) {
  const index = Math.max(0, text.indexOf(match));
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + match.length + radius);
  return text.slice(start, end);
}

function extractLinkedEvidenceFromText(input, options = {}) {
  const sourceText = String(input || '');
  const primaryUrls = new Set([options.primaryUrl, ...(options.primaryUrls || [])].filter(Boolean).map(cleanUrl));
  const results = [];
  const seen = new Set();

  for (const match of sourceText.matchAll(URL_RE)) {
    const url = cleanUrl(match[0]);
    if (!url || primaryUrls.has(url)) continue;
    const classified = classifyUrl(url);
    addEvidence(results, seen, makeEvidence({
      ...classified,
      sourceText: url,
      rawExcerpt: excerptAround(sourceText, match[0])
    }));
  }

  for (const match of sourceText.matchAll(CHANGE_ID_RE)) {
    addEvidence(results, seen, makeEvidence({
      type: LINKED_EVIDENCE_TYPES.ANDROID_GERRIT,
      identifier: match[0],
      sourceText: match[0],
      rawExcerpt: excerptAround(sourceText, match[0])
    }));
  }

  for (const match of sourceText.matchAll(BUG_ID_RE)) {
    addEvidence(results, seen, makeEvidence({
      type: LINKED_EVIDENCE_TYPES.GOOGLE_ISSUE_TRACKER,
      identifier: match[1],
      sourceText: match[0],
      rawExcerpt: excerptAround(sourceText, match[0])
    }));
  }

  for (const match of sourceText.matchAll(CVE_RE)) {
    addEvidence(results, seen, makeEvidence({
      type: LINKED_EVIDENCE_TYPES.CVE,
      identifier: match[0].toUpperCase(),
      sourceText: match[0],
      rawExcerpt: excerptAround(sourceText, match[0])
    }));
  }

  for (const match of sourceText.matchAll(ANCHOR_RE)) {
    addEvidence(results, seen, makeEvidence({
      type: LINKED_EVIDENCE_TYPES.DOCS_ANCHOR,
      identifier: match[1],
      sourceText: match[1],
      rawExcerpt: excerptAround(sourceText, match[1])
    }));
  }

  return results;
}

function extractLinkedEvidenceFromCandidate(candidate = {}) {
  const source = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
  const text = CANDIDATE_TEXT_FIELDS
    .map(field => source[field])
    .filter(value => value !== undefined && value !== null)
    .map(String)
    .join('\n');

  return extractLinkedEvidenceFromText(text, {
    primaryUrl: source.url || source.articleUrl || source.article_url
  });
}

module.exports = {
  extractLinkedEvidenceFromCandidate,
  extractLinkedEvidenceFromText
};
