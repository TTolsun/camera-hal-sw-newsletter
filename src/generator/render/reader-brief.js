'use strict';

const { articleDisplayRows } = require('./article-display');

// 이미 최종 정렬·언어 overlay가 적용된 issue만 입력한다. 파일/LLM/네트워크 쓰기는 없다.
function buildReaderBrief(issue, { locale = 'ko', issueHref, archive } = {}) {
  if (!['ko', 'en'].includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
  const prefix = locale === 'en' ? 'en/' : '';
  if (typeof issueHref !== 'string' ||
    !new RegExp(`^${prefix}newsletters/[0-9]{4}-(?:W(?:0[1-9]|[1-4][0-9]|5[0-3])${archive ? '|[0-9]{2}-[0-9]{2}' : ''})/index\\.html$`).test(issueHref)) {
    throw new Error('Invalid relative issueHref');
  }
  return {
    schema_version: 1,
    locale,
    intro: String(issue.summary || ''),
    items: articleDisplayRows(issue, { locale, issueHref, archive })
  };
}

module.exports = { buildReaderBrief };
