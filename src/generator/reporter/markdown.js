// pure helpers — markdown rendering
//
// 이 모듈은 markdown 테이블 셀 렌더링 전용 텍스트 처리를 담당한다.
// 범용 텍스트 truncation(stripHtml 옵션, ellipsis-after-maxLength 방식)은
// common/text.js의 truncateText를 사용한다. 이 모듈의 truncateMarkdownCell은
// ellipsis를 maxLength 안에 포함시켜 셀 폭을 보장하며, 외부에 export하지 않는다.

function truncateMarkdownCell(value, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sanitizeMarkdownTableCell(value, { fallback = 'unknown', maxLength = 180 } = {}) {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return truncateMarkdownCell(text || fallback, maxLength).replace(/\|/g, '\\|');
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
