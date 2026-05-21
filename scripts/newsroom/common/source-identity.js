const crypto = require('crypto');

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'ref'
]);

function text(value) {
  return String(value || '').trim();
}

function hashText(value, length = 24) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, length);
}

function shouldRemoveParam(name = '') {
  const lower = String(name || '').toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

function preserveHash(parsed) {
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  if (!parsed.hash) return false;
  if (host === 'developer.android.com' && path === '/jetpack/androidx/releases/camera') {
    return /^#(?:camera-)?[\w.-]*\d+\.\d+\.\d+[-\w.]*$/i.test(parsed.hash);
  }
  if (host === 'source.android.com' && path.startsWith('/docs/')) return true;
  return false;
}

function normalizeSourceUrl(value = '') {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hostname = parsed.hostname.toLowerCase();
    for (const name of [...parsed.searchParams.keys()]) {
      if (shouldRemoveParam(name)) parsed.searchParams.delete(name);
    }
    if (!preserveHash(parsed)) parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw
      .replace(/([?&])(?:utm_[^=&#]+|fbclid|gclid|ref)=[^&#]*/gi, '$1')
      .replace(/[?&]$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }
}

function sourceIdentityKey({ sourceId = '', url = '' } = {}) {
  const normalizedUrl = normalizeSourceUrl(url);
  return `${text(sourceId) || 'unknown'}:${hashText(normalizedUrl, 32)}`;
}

function sourceEventId({
  sourceId = '',
  eventType = '',
  sourceIdentityKey: identityKey = '',
  effectiveDate = '',
  evidenceKey = ''
} = {}) {
  const parts = [sourceId, eventType, identityKey, effectiveDate, evidenceKey].map(text);
  return `source-event-${hashText(parts.join('\n'), 32)}`;
}

function evidenceId({
  sourceId = '',
  sourceIdentityKey: identityKey = '',
  eventType = '',
  effectiveDate = '',
  evidenceKey = ''
} = {}) {
  const parts = [sourceId, identityKey, eventType, effectiveDate, evidenceKey].map(text);
  return `evidence-${hashText(parts.join('\n'), 32)}`;
}

function stripHtmlNoise(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<[^>]+(?:cookie|banner|advert|related)[^>]*>[\s\S]*?<\/[^>]+>/gi, ' ');
}

function visibleText(html = '') {
  return stripHtmlNoise(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentHash(html = '') {
  return hashText(visibleText(html), 64);
}

function normalizedContentText(html = '') {
  return visibleText(html)
    .replace(/\bLast updated\s+20\d{2}-\d{2}-\d{2}\s+UTC\.?/gi, ' ')
    .replace(/\bLast updated\s+[A-Z][a-z]+\s+\d{1,2},\s+20\d{2}\b/gi, ' ')
    .replace(/\b(?:last crawled|generated at|build timestamp)[:\s]+[^\n.]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedContentHash(html = '') {
  return hashText(normalizedContentText(html), 64);
}

module.exports = {
  contentHash,
  evidenceId,
  hashText,
  normalizeSourceUrl,
  normalizedContentHash,
  normalizedContentText,
  sourceEventId,
  sourceIdentityKey,
  visibleText
};
