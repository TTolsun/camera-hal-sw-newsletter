'use strict';

const { applyTranslation } = require('../render/apply-translation');
const { translationInput } = require('./translation-schema');
const { hasKoreanText } = require('../../shared/common/korean-text');
const { validatePublicArticle } = require('../reporter/public-article-contract');

function urls(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"\]가-힣]+/g) || [];
  return [...new Set(matches.map(value => {
    let url = value;
    while (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length) url = url.slice(0, -1);
    return url.replace(/[.,;]+$/, '');
  }))].sort();
}

function withoutUrls(text) {
  let result = String(text || '');
  for (const url of urls(result)) result = result.split(url).join('');
  return result;
}

function protectedTokens(text) {
  const prose = withoutUrls(text);
  return [...new Set([
    ...Array.from(prose.matchAll(/`([^`\n]+)`/g), match => match[1]).filter(value => !hasKoreanText(value)),
    ...(prose.match(/\b[A-Za-z][A-Za-z0-9_-]*-v?\d+(?:\.\d+)+(?:[A-Za-z0-9.-]*)\b|\bv?\d+\.\d+(?:\.\d+)*(?:[-\w.]*)\b|\b[A-Z][A-Z0-9_]*\d[A-Z0-9_]*\b|\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b|\b[A-Za-z]+(?:[A-Z][a-z]+)+\w*\b/g) || [])
  ])];
}

function contractIssueSignature(item) {
  // 위치는 빼고 종류만 본다. 번역은 문장을 나눌 수 있어 같은 위반의 블록 번호가 달라질 수 있다.
  return [item.type, item.key, item.construct].map(value => value ?? '').join('|');
}

// 번역이 validate:public과 같은 기사 계약 검사기에서 원문에 없던 위반을 만들면 거부한다. 프롬프트가 금지해도
// LLM이 식별자에 백틱을 붙이는 일이 있었고(2026-10-26 W44: 기사 5건 10곳), 이 검사가 없으면 1차 응답이
// 그대로 기록된 뒤 워크플로 최종 검증에서야 실패해 재시도 기회를 잃는다. 원문이 이미 갖고 있던 위반은 번역의
// 잘못이 아니므로 여기서 거부하지 않는다. 그 위반은 validate:public이 issue.json을 검사할 때 따로 막는다.
// 재시도는 한 번뿐이므로 모든 기사의 위반을 위치와 함께 모아 한 번에 알린다.
// 검사기는 정규화하면서 입력을 고칠 수 있으므로 사본을 넘긴다. 원본 issue가 바뀌면 다음 시도의
// applyTranslation이 원문 바이트와 issue가 다르다며 거부한다.
function assertNoNewContractIssues(sourceIssue, translatedIssue) {
  const issue = structuredClone(sourceIssue);
  const english = structuredClone(translatedIssue);
  const violations = issue.sections.flatMap((section, index) => {
    const existing = new Set(validatePublicArticle(section, index, { issue }).map(contractIssueSignature));
    return validatePublicArticle(english.sections[index], index, { issue: english })
      .filter(item => !existing.has(contractIssueSignature(item)))
      .map(item => {
        const position = item.blockIndex !== undefined ? ` block ${item.blockIndex}` : item.line !== undefined ? ` line ${item.line}` : '';
        return `sections[${index}] ${[item.type, item.key, item.construct].filter(Boolean).join(' ')}${position}`;
      });
  });
  if (violations.length > 0) {
    throw new Error(`Public article contract violation in translation: ${violations.join('; ')}`);
  }
}

function translationChecks(issue, overlay, sourceText) {
  const original = translationInput(issue, sourceText);
  // Also rejects missing/duplicate IDs, unknown keys, incomplete optional fields and stale hashes.
  const english = applyTranslation(issue, overlay, { sourceText });
  for (const group of ['sections', 'reference_articles']) {
    if (JSON.stringify(original[group].map(item => item.id)) !== JSON.stringify(overlay[group].map(item => item.id))) {
      throw new Error(`Translation ID order mismatch: ${group}`);
    }
  }
  function compare(source, target, field) {
    if (typeof source === 'string') {
      if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing translation: ${field}`);
      // URLs and source-title map keys are immutable identities, not translatable prose.
      if (hasKoreanText(withoutUrls(target))) throw new Error(`Korean text remains: ${field}`);
      if (JSON.stringify(urls(source)) !== JSON.stringify(urls(target))) throw new Error(`Translation URL mismatch: ${field}`);
      for (const token of protectedTokens(source)) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(target)) throw new Error(`Missing protected token ${token}: ${field}`);
      }
    } else if (Array.isArray(source)) {
      source.forEach((value, i) => compare(value, target?.[i], `${field}[${i}]`));
    } else if (source && typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        if (['id', 'weekly_key', 'source_hash', 'schemaVersion'].includes(key)) continue;
        compare(value, target?.[key], `${field}.${key}`);
      }
    }
  }
  compare(original, overlay, 'translation');
  // Optional extra prose must not provide a way around the Korean detector.
  compare(overlay, overlay, 'translation');
  assertNoNewContractIssues(issue, english);
  return { issue: english, checks: { ids: true, urls: true, english: true, tokens: true } };
}

module.exports = { translationChecks, urls, protectedTokens };
