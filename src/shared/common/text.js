// pure helpers — text/HTML normalization

function stripHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength, options = {}) {
  const ellipsis = options.ellipsis || '...';
  const stripped = options.stripHtmlFirst ? stripHtml(value) : String(value ?? '');
  const normalized = stripped.replace(/\s+/g, ' ').trim();
  if (!Number.isFinite(maxLength) || maxLength <= 0) return normalized;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}${ellipsis}`;
}

module.exports = { stripHtml, truncateText };
