const PUBLIC_ARTICLE_REQUIRED_KEYS = Object.freeze([
  'headline',
  'lead',
  'body_paragraphs',
  'camera_hal_takeaway',
  'reader_checkpoints',
  'source_links'
]);

const PUBLIC_SOURCE_LINK_ALLOWED_KEYS = Object.freeze([
  'title',
  'url',
  'publisher',
  'source_role',
  'checked_at'
]);

const PUBLIC_SOURCE_ROLES = Object.freeze([
  'primary',
  'supporting',
  'context'
]);

const NO_IMMEDIATE_ACTION_TEXT = '즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function compactText(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function publicSafeText(value) {
  return compactText(value)
    .replace(/\bTooling Watch \/ Fallback:\s*/gi, '')
    .replace(/\bFallback\b/gi, 'Watch')
    .replace(/\bReview-only\b/gi, '참고 동향')
    .replace(/\bquality gate\b/gi, 'quality review')
    .replace(/\bcandidate\b/gi, 'source item')
    .trim();
}

const INTERNAL_PUBLIC_TERM_PATTERN = /Review-only|Fallback|quality gate|candidate|editor review|normal publishable coverage|reader_owners|check_within_2_weeks|HAL Signal Capsule|why_now|impact_axes|do_not_overstate|guardrail|section repair|hard failure|candidate shortage|deterministic reconstruction|source-bound|publish gate/i;

function hasInternalPublicTerm(value) {
  return INTERNAL_PUBLIC_TERM_PATTERN.test(compactText(value));
}

function fallbackLeadText(sourceText, headline) {
  const fallback = `${headline || 'Camera HAL 관련 소식'} is shared as source-backed context for Camera HAL readers.`;
  if (!sourceText || hasInternalPublicTerm(sourceText)) return fallback;
  return publicSafeText(sourceText);
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const output = [];
  for (const item of values) {
    const normalized = compactText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizePublicSafeStringArray(value) {
  return normalizeStringArray(value).map(publicSafeText).filter(Boolean);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function publicUrlError(value) {
  const raw = compactText(value);
  if (!raw) return 'missing_url';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return 'invalid_url';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'non_public_scheme';
  const urlText = raw.toLowerCase();
  if (urlText.includes('/.tmp/') || urlText.includes('/content/newsroom/') || urlText.includes('/content/collected-news/')) {
    return 'internal_artifact_url';
  }
  if (parsed.hostname === 'github.com' && /\/actions\/(?:runs|workflows)\//i.test(parsed.pathname)) {
    return 'github_actions_artifact_url';
  }
  return '';
}

function normalizeSourceLink(source = {}) {
  if (!isPlainObject(source)) return null;
  const output = {
    title: compactText(source.title),
    url: compactText(source.url)
  };
  for (const key of ['publisher', 'source_role', 'checked_at']) {
    const value = compactText(source[key]);
    if (value) output[key] = value;
  }
  return output;
}

function sourceLinkIssues(source = {}, index = 0) {
  const issues = [];
  if (!isPlainObject(source)) {
    return [{ type: 'invalid_source_link', index, reason: 'not_object' }];
  }
  const unexpected = Object.keys(source).filter(key => !PUBLIC_SOURCE_LINK_ALLOWED_KEYS.includes(key));
  if (unexpected.length > 0) {
    issues.push({ type: 'unexpected_source_link_keys', index, keys: unexpected });
  }
  if (!compactText(source.title)) {
    issues.push({ type: 'invalid_source_link', index, field: 'title', reason: 'missing_title' });
  }
  const urlError = publicUrlError(source.url);
  if (urlError) {
    issues.push({ type: 'invalid_source_link', index, field: 'url', reason: urlError });
  }
  const role = compactText(source.source_role);
  if (role && !PUBLIC_SOURCE_ROLES.includes(role)) {
    issues.push({ type: 'invalid_source_link', index, field: 'source_role', reason: 'unsupported_role', value: role });
  }
  return issues;
}

function sourceLinksFromSection(section = {}) {
  return ensureArray(section.sources)
    .map(source => normalizeSourceLink({
      title: publicSafeText(source?.title || source?.url),
      url: source?.url,
      source_role: 'primary'
    }))
    .filter(source => source && source.title && source.url && !publicUrlError(source.url));
}

function fallbackParagraphs(section = {}) {
  const paragraphs = normalizePublicSafeStringArray([
    section.background,
    section.camera_hal_perspective || section.why_it_matters
  ]);
  while (paragraphs.length < 2) {
    paragraphs.push('이 항목은 공개 출처가 제공한 범위 안에서만 참고 동향으로 공유합니다.');
  }
  return paragraphs.slice(0, 4);
}

function fallbackCheckpoints(section = {}) {
  const actions = normalizePublicSafeStringArray(section.action_items)
    .filter(item => !/source URL|published date|Publication|Direct HAL behavior claim|watch\/supporting context|다음 issue|후속 release note/i.test(item));
  return actions.length > 0 ? actions : [NO_IMMEDIATE_ACTION_TEXT];
}

function publicArticleForSection(section = {}, { allowLegacyFallback = true } = {}) {
  const raw = isPlainObject(section.public_article) ? section.public_article : {};
  const sourceLinks = ensureArray(raw.source_links)
    .map(normalizeSourceLink)
    .filter(Boolean);
  const normalized = {
    headline: compactText(raw.headline),
    lead: compactText(raw.lead),
    body_paragraphs: normalizeStringArray(raw.body_paragraphs),
    camera_hal_takeaway: compactText(raw.camera_hal_takeaway),
    reader_checkpoints: normalizeStringArray(raw.reader_checkpoints),
    source_links: sourceLinks
  };

  if (!allowLegacyFallback) return normalized;

  if (!normalized.headline) normalized.headline = publicSafeText(section.headline || section.category || 'Camera HAL 관련 소식');
  if (!normalized.lead) normalized.lead = fallbackLeadText(section.what_changed || section.summary || section.evidence_summary, normalized.headline);
  if (normalized.body_paragraphs.length < 2) normalized.body_paragraphs = fallbackParagraphs(section);
  if (!normalized.camera_hal_takeaway) {
    normalized.camera_hal_takeaway = publicSafeText(section.camera_hal_perspective || section.why_it_matters || 'Camera HAL / Driver 관점의 직접 영향은 공개 출처가 확인한 범위에서만 해석합니다.');
  }
  if (normalized.reader_checkpoints.length === 0) normalized.reader_checkpoints = fallbackCheckpoints(section);
  if (normalized.source_links.length === 0) normalized.source_links = sourceLinksFromSection(section);
  return normalized;
}

function validatePublicArticle(section = {}, index = 0) {
  const issues = [];
  const headline = compactText(section.headline || section.category || `article ${index + 1}`);
  if (!isPlainObject(section.public_article)) {
    return [{
      index: index + 1,
      headline,
      type: 'missing_public_article',
      keys: PUBLIC_ARTICLE_REQUIRED_KEYS
    }];
  }
  const raw = section.public_article;
  const unexpected = Object.keys(raw).filter(key => !PUBLIC_ARTICLE_REQUIRED_KEYS.includes(key));
  if (unexpected.length > 0) {
    issues.push({ index: index + 1, headline, type: 'unexpected_public_article_keys', keys: unexpected });
  }
  const normalized = publicArticleForSection(section, { allowLegacyFallback: false });
  for (const key of ['headline', 'lead', 'camera_hal_takeaway']) {
    if (!normalized[key]) issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key });
  }
  if (normalized.body_paragraphs.length < 2) {
    issues.push({ index: index + 1, headline, type: 'insufficient_public_body_paragraphs', key: 'body_paragraphs', actualCount: normalized.body_paragraphs.length, expectedMinCount: 2 });
  }
  if (normalized.reader_checkpoints.length === 0) {
    issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key: 'reader_checkpoints' });
  }
  if (normalized.source_links.length === 0) {
    issues.push({ index: index + 1, headline, type: 'empty_public_article_field', key: 'source_links' });
  }
  ensureArray(raw.source_links).forEach((source, sourceIndex) => {
    for (const issue of sourceLinkIssues(source, sourceIndex)) {
      issues.push({ index: index + 1, headline, ...issue });
    }
  });
  // Semantic validation also normalizes public_article for downstream render and quality paths.
  section.public_article = normalized;
  return issues;
}

module.exports = {
  NO_IMMEDIATE_ACTION_TEXT,
  PUBLIC_ARTICLE_REQUIRED_KEYS,
  PUBLIC_SOURCE_LINK_ALLOWED_KEYS,
  PUBLIC_SOURCE_ROLES,
  publicArticleForSection,
  publicUrlError,
  sourceLinkIssues,
  validatePublicArticle
};
