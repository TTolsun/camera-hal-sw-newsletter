// pure helpers — markdown rendering

function truncateText(value, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sanitizeMarkdownTableCell(value, { fallback = 'unknown', maxLength = 180 } = {}) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return truncateText(text || fallback, maxLength).replace(/\|/g, '\\|');
}

function sanitizeMarkdownLinkUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '%20')
    .replace(/\|/g, '%7C')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');
}

function markdownTableCell(value) {
  if (value && typeof value === 'object' && value.__markdownTableCell === true) {
    return String(value.value || '').replace(/[\r\n]+/g, ' ').trim() || 'unknown';
  }
  return sanitizeMarkdownTableCell(value);
}

function trustedMarkdownTableCell(value) {
  return { __markdownTableCell: true, value };
}

function renderMarkdownTable(headers, rows) {
  const safeHeaders = headers.map(header => sanitizeMarkdownTableCell(header));
  const separator = headers.map((_, index) => (index === 0 ? '---:' : '---'));
  const body = rows.map(row => `| ${row.map(cell => markdownTableCell(cell)).join(' | ')} |`);
  return [
    `| ${safeHeaders.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body
  ].join('\n');
}

module.exports = {
  sanitizeMarkdownTableCell,
  sanitizeMarkdownLinkUrl,
  markdownTableCell,
  trustedMarkdownTableCell,
  renderMarkdownTable
};
