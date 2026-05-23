const TRACKING_QUERY_PARAMS = new Set(['ref', 'fbclid', 'gclid']);

function isTrackingQueryParam(name = '') {
  const lower = String(name || '').toLowerCase();
  return lower.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lower);
}

function isReleaseVersionAnchor(value = '') {
  const fragment = String(value || '').trim().replace(/^#/, '');
  return /^(?:v|version[_-]?)?\d+(?:[._]\d+){1,3}(?:[-._]?(?:alpha|beta|rc|preview|stable)\d*)?$/i.test(fragment);
}

function normalizeSearchParams(parsed, warnings) {
  const groups = new Map();
  for (const [name, value] of parsed.searchParams.entries()) {
    if (isTrackingQueryParam(name)) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(value);
  }

  if ([...groups.values()].some(values => values.length > 1)) {
    warnings.push({
      type: 'duplicate_query_key',
      url: parsed.toString(),
      message: 'Duplicate query key group preserved in original relative order.'
    });
  }

  parsed.search = '';
  for (const key of [...groups.keys()].sort((left, right) => left.localeCompare(right))) {
    for (const value of groups.get(key)) {
      parsed.searchParams.append(key, value);
    }
  }
}

function normalizeNewsSourceKey(value = '') {
  const raw = String(value || '').trim();
  const warnings = [];
  if (!raw) {
    return { key: '', raw, parse_failed: false, warnings };
  }

  try {
    const parsed = new URL(raw);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    normalizeSearchParams(parsed, warnings);
    const fragment = parsed.hash ? parsed.hash.slice(1) : '';
    if (!isReleaseVersionAnchor(fragment)) parsed.hash = '';
    return {
      key: parsed.toString(),
      raw,
      parse_failed: false,
      warnings
    };
  } catch (error) {
    return {
      key: raw,
      raw,
      parse_failed: true,
      warnings: [{
        type: 'url_parse_failed',
        url: raw,
        message: error.message
      }]
    };
  }
}

module.exports = {
  isReleaseVersionAnchor,
  normalizeNewsSourceKey
};
