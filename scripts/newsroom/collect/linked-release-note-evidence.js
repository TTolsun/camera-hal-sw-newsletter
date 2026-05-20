const {
  canonicalContentUrl,
  fetchTextWithLimit
} = require('./source-intelligence-utils');
const {
  hasConcreteVersionedReleaseExtraction,
  parseSourceSpecificItems
} = require('./source-item-parsers');

async function fetchText(url, timeoutMs = 0) {
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      signal: controller ? controller.signal : undefined,
      headers: {
        'user-agent': 'camera-hal-sw-newsletter/1.0',
        accept: 'text/html,application/rss+xml,application/xml,text/xml,*/*'
      }
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function isTrustedLinkedReleaseNoteTarget(value = '') {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera';
  } catch {
    return false;
  }
}

function releaseNoteSourceForLinkedTarget(item = {}, parentSource = {}) {
  const url = String(item.linked_release_note_target_url || item.url || '').trim();
  return {
    ...parentSource,
    id: 'camerax-release-notes',
    name: 'CameraX Release Notes',
    sourceUrl: url,
    url
  };
}

function appendExtractionLink(extraction = {}, link = {}) {
  if (!extraction || typeof extraction !== 'object' || !link.url) return extraction;
  const links = Array.isArray(extraction.links) ? extraction.links : [];
  const key = `${link.role || ''}|${link.url || ''}`.toLowerCase();
  if (links.some(item => `${item.role || ''}|${item.url || ''}`.toLowerCase() === key)) {
    return extraction;
  }
  return {
    ...extraction,
    links: [...links, link]
  };
}

function mergeLinkedReleaseNoteEvidence(parentItem = {}, linkedItem = {}, parentSource = {}) {
  const targetUrl = String(parentItem.linked_release_note_target_url || linkedItem.url || '').trim();
  const parentUrl = parentItem.parentUrl || parentSource.url || parentSource.sourceUrl || '';
  let extraction = linkedItem.source_extraction || null;
  extraction = appendExtractionLink(extraction, {
    role: 'parent_source',
    text: parentItem.parentTitle || parentSource.name || 'Android Developers Latest Updates',
    url: parentUrl
  });
  extraction = appendExtractionLink(extraction, {
    role: 'release_note_anchor',
    text: linkedItem.version_or_release || parentItem.version_or_release || 'Release note',
    url: targetUrl
  });
  return {
    ...parentItem,
    ...linkedItem,
    source: parentItem.source || parentSource,
    parentUrl,
    parentTitle: parentItem.parentTitle || parentSource.name || '',
    sourceSection: parentItem.sourceSection || parentSource.section || '',
    relevanceBucketHint: parentItem.relevanceBucketHint || linkedItem.relevanceBucketHint,
    linked_release_note_target_url: targetUrl,
    linked_release_note_resolved: true,
    parser_gap_reason: '',
    source_extraction: extraction,
    extraction_quality: extraction?.extraction_quality || linkedItem.extraction_quality || null
  };
}

function markUnresolvedLinkedReleaseNote(item = {}, reason = 'missing_concrete_release_note_bullet') {
  const existingQuality = item.extraction_quality || item.source_extraction?.extraction_quality || {};
  const quality = {
    ...existingQuality,
    has_concrete_behavior_change: false,
    main_article_allowed: false,
    used_empty_evidence_fallback: true,
    warnings: [...new Set([
      ...((Array.isArray(existingQuality.warnings) ? existingQuality.warnings : [])),
      reason
    ])]
  };
  return {
    ...item,
    behavior_change: '',
    summary: '',
    parser_gap_reason: reason,
    linked_release_note_resolved: false,
    extraction_quality: quality,
    source_extraction: item.source_extraction
      ? {
          ...item.source_extraction,
          extraction_quality: quality
        }
      : item.source_extraction
  };
}

function linkedReleaseNoteFetchCacheKey(value) {
  const canonical = canonicalContentUrl(value);
  if (!canonical) return '';
  try {
    const parsed = new URL(canonical);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return canonical.replace(/#.*$/, '');
  }
}

/**
 * Resolves parser items that point to trusted linked release-note targets.
 *
 * Modes:
 * - Concrete item pass-through: items with existing concrete versioned release extraction are preserved.
 * - Linked target resolution: items with linked_release_note_target_url are fetched, parsed, and merged.
 * - Failure marking: untrusted/fetch/parser failures return unresolved items with main_article_allowed=false.
 *
 * Used by raw collection and Gemini source discovery to keep versioned_release_row evidence aligned.
 */
async function resolveLinkedReleaseNoteEvidenceItems(items = [], parentSource = {}, options = {}) {
  const fetchTextImpl = options.fetchTextImpl || fetchText;
  const fetchCache = options.fetchCache || new Map();
  async function fetchCached(url) {
    const cacheKey = linkedReleaseNoteFetchCacheKey(url) || url;
    if (!fetchCache.has(cacheKey)) {
      fetchCache.set(cacheKey, fetchTextImpl(url));
    }
    return fetchCache.get(cacheKey);
  }

  const resolved = [];
  for (const item of items) {
    const targetUrl = String(item.linked_release_note_target_url || '').trim();
    if (!targetUrl || hasConcreteVersionedReleaseExtraction(item)) {
      resolved.push(item);
      continue;
    }
    if (!isTrustedLinkedReleaseNoteTarget(targetUrl)) {
      resolved.push(markUnresolvedLinkedReleaseNote(item, 'untrusted_linked_release_note_target'));
      continue;
    }
    try {
      const html = await fetchCached(targetUrl);
      const linkedSource = releaseNoteSourceForLinkedTarget(item, parentSource);
      const linkedItems = parseSourceSpecificItems(html, linkedSource);
      const match = linkedItems.find(candidate =>
        canonicalContentUrl(candidate.url) === canonicalContentUrl(targetUrl) ||
        String(candidate.version_or_release || '') === String(item.version_or_release || '')
      ) || linkedItems[0];
      if (!match || !hasConcreteVersionedReleaseExtraction(match)) {
        resolved.push(markUnresolvedLinkedReleaseNote(item, 'missing_concrete_release_note_bullet'));
        continue;
      }
      resolved.push(mergeLinkedReleaseNoteEvidence(item, match, parentSource));
    } catch {
      resolved.push(markUnresolvedLinkedReleaseNote(item, 'linked_release_note_fetch_failed'));
    }
  }
  return resolved;
}

function fetchTextWithConfiguredLimit(fetchImpl, options = {}) {
  return url => fetchTextWithLimit(fetchImpl, url, {
    timeoutMs: options.timeoutMs || 5000,
    maxBytes: options.maxBytes || 200000
  });
}

module.exports = {
  fetchTextWithConfiguredLimit,
  isTrustedLinkedReleaseNoteTarget,
  linkedReleaseNoteFetchCacheKey,
  markUnresolvedLinkedReleaseNote,
  mergeLinkedReleaseNoteEvidence,
  releaseNoteSourceForLinkedTarget,
  resolveLinkedReleaseNoteEvidenceItems
};
