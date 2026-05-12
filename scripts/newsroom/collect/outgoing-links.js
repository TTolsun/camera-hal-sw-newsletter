const { decodeHtml, htmlAttr } = require('../common/common');

const DEFAULT_EVIDENCE_ROLE = 'unclassified';
const DEFAULT_EXTRACTION_METHOD = 'html_anchor';
const MAX_LINK_TEXT_LENGTH = 180;

function stripTags(value = '') {
  return decodeHtml(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function cleanText(value = '') {
  const text = stripTags(value).replace(/\s+/g, ' ').trim();
  return text.length > MAX_LINK_TEXT_LENGTH
    ? `${text.slice(0, MAX_LINK_TEXT_LENGTH - 1).trim()}...`
    : text;
}

function absoluteHttpUrl(href = '', baseUrl = '') {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('#')) return '';
  try {
    const parsed = new URL(raw, baseUrl || undefined);
    return /^https?:$/i.test(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function outgoingLinkRecord({ url, text, sourceField, extractionMethod = DEFAULT_EXTRACTION_METHOD }) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;
  return {
    url: normalizedUrl,
    text: cleanText(text),
    source_field: String(sourceField || '').trim(),
    extraction_method: String(extractionMethod || DEFAULT_EXTRACTION_METHOD).trim(),
    evidence_role: DEFAULT_EVIDENCE_ROLE
  };
}

function extractOutgoingLinksFromHtml(html = '', options = {}) {
  const sourceField = options.sourceField || options.source_field || 'html.body';
  const extractionMethod = options.extractionMethod || options.extraction_method || DEFAULT_EXTRACTION_METHOD;
  const baseUrl = options.baseUrl || options.base_url || '';
  const links = [];

  for (const match of String(html || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const url = absoluteHttpUrl(htmlAttr(match[1] || '', 'href'), baseUrl);
    const record = outgoingLinkRecord({
      url,
      text: match[2] || '',
      sourceField,
      extractionMethod
    });
    if (record) links.push(record);
  }

  return normalizeOutgoingLinks(links);
}

function normalizeOutgoingLinks(value) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(value) ? value : []) {
    const record = outgoingLinkRecord({
      url: item?.url,
      text: item?.text,
      sourceField: item?.source_field || item?.sourceField,
      extractionMethod: item?.extraction_method || item?.extractionMethod
    });
    if (!record) continue;
    const key = [
      record.url.toLowerCase(),
      record.text.toLowerCase(),
      record.source_field.toLowerCase(),
      record.extraction_method.toLowerCase()
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }
  return result;
}

function mergeOutgoingLinks(...groups) {
  return normalizeOutgoingLinks(groups.flatMap(group => Array.isArray(group) ? group : []));
}

module.exports = {
  DEFAULT_EVIDENCE_ROLE,
  extractOutgoingLinksFromHtml,
  mergeOutgoingLinks,
  normalizeOutgoingLinks
};
