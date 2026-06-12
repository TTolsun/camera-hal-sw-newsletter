const { ensureArray } = require('./value-coercion');

// Deep text flattener used by reader-safe term detection. Kept private so this
// module stays self-contained and independent of the dedup-cleanup orchestrator.
function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function normalizeMergeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readerSafeText(value) {
  return normalizeMergeText(value)
    .replace(/중복\s*News Source/gi, '공개 출처')
    .replace(/중복\s*source\s*cleanup/gi, '공개 출처 정리')
    .replace(/중복\s*issue/gi, '이전 발행본')
    .replace(/survivor article/gi, '기사')
    .replace(/\bsurvivor\b/gi, '남은 기사')
    .replace(/\bdonor\b/gi, '이전 기사')
    .replace(/\bcleanup\b/gi, '정리')
    .replace(/\bsource-backed\b/gi, '공개 출처가 확인한')
    .replace(/\bsource-bound\b/gi, '출처 범위 안의')
    .replace(/\bdeterministic reconstruction\b/gi, '공개 기사 정리')
    .replace(/\bnormal publishable coverage\b/gi, '직접 발행 범위')
    .replace(/\bsection repair\b/gi, '기사 보정')
    .replace(/구조화\s*필드/gi, '기사 자료')
    .replace(/\bcpp_ai_tooling_fallback\b/gi, 'native tooling 참고 항목')
    .replace(/\bgeneric_tech_watchlist\b/gi, '기술 참고 항목')
    .replace(/\bsource_dedup(?:_[a-z0-9_]+)?\b/gi, '출처 정리')
    .replace(/\bPublication\b/gi, '발행')
    .replace(/\bDirect HAL behavior claim\b/gi, '직접 HAL 동작 주장')
    .replace(/\bDirect camera-stack evidence\b/gi, '직접 camera stack 근거')
    .replace(/\bwatch\/supporting context\b/gi, '참고 맥락')
    .replace(/\bwatch\/supporting material\b/gi, '참고 자료')
    .replace(/\bLinked source\b/gi, '연결된 출처')
    .replace(/\bSource evidence\b/gi, '출처 근거')
    .replace(/\bsource evidence\b/gi, '출처 근거')
    .replace(/\bsource URL\b/gi, '출처 URL')
    .replace(/\bpublished date\b/gi, '게시일')
    .replace(/\bFallback\b/gi, 'Watch')
    .replace(/\bReview-only\b/gi, '참고')
    .replace(/\bcandidate\b/gi, '항목')
    .trim();
}

function hasInternalReaderTerm(value) {
  return /survivor|donor|cleanup|source_dedup|source-backed|deterministic reconstruction|normal publishable coverage|section repair|중복\s*issue|중복\s*source|구조화\s*필드|cpp_ai_tooling_fallback|generic_tech_watchlist/i.test(text(value));
}

function publicArticleIsUsable(article = {}) {
  return article && typeof article === 'object' &&
    readerSafeText(article.headline) &&
    readerSafeText(article.lead) &&
    ensureArray(article.body_paragraphs).filter(item => readerSafeText(item)).length >= 2 &&
    readerSafeText(article.camera_hal_takeaway) &&
    ensureArray(article.reader_checkpoints).filter(item => readerSafeText(item)).length >= 2 &&
    !hasInternalReaderTerm(article);
}

function splitReaderSentences(value) {
  const normalized = readerSafeText(value);
  if (!normalized) return [];
  return normalized
    .split(/(?<=[!?。])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=습니다\.)\s+|(?<=[A-Za-z)]\.)\s+(?=[A-Z가-힣])/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function readerParagraph(value, { maxChars = 640, maxSentences = 2 } = {}) {
  const sentences = splitReaderSentences(value);
  const output = [];
  const seen = new Set();
  for (const sentence of sentences.length > 0 ? sentences : [readerSafeText(value)]) {
    const key = sentence.toLowerCase();
    if (!sentence || seen.has(key)) continue;
    seen.add(key);
    output.push(sentence);
    if (output.length >= maxSentences) break;
    if (output.join(' ').length >= maxChars) break;
  }
  let paragraph = output.join(' ').trim();
  if (paragraph.length <= maxChars) return paragraph;
  paragraph = paragraph.slice(0, maxChars).replace(/\s+\S*$/u, '').trim();
  return paragraph ? `${paragraph}...` : '';
}

function readerTextArray(value) {
  return ensureArray(value)
    .map(readerSafeText)
    .filter(Boolean);
}

function firstReaderText(values = []) {
  for (const value of values) {
    const normalized = readerSafeText(value);
    if (normalized) return normalized;
  }
  return '';
}

function sentenceLead(value, fallback) {
  const normalized = readerSafeText(value);
  if (!normalized) return fallback;
  if (normalized.length <= 280) return normalized;
  const koreanSentence = normalized.match(/^.{40,280}?(?:다\.|요\.|습니다\.)/u)?.[0];
  if (koreanSentence) return koreanSentence.trim();
  const englishSentence = normalized.match(/^.{80,280}?\.(?=\s+[A-Z가-힣]|$)/u)?.[0];
  if (englishSentence) return englishSentence.trim();
  const clipped = normalized.slice(0, 280).replace(/\s+\S*$/u, '').trim();
  return clipped ? `${clipped}...` : normalized;
}

module.exports = {
  normalizeMergeText,
  readerSafeText,
  hasInternalReaderTerm,
  publicArticleIsUsable,
  splitReaderSentences,
  readerParagraph,
  readerTextArray,
  firstReaderText,
  sentenceLead
};
