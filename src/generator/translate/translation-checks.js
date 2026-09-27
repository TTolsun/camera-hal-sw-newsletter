'use strict';

const { applyTranslation } = require('../render/apply-translation');
const { translationInput } = require('./translation-schema');
const { hasKoreanText } = require('../../shared/common/korean-text');

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
  return { issue: english, checks: { ids: true, urls: true, english: true, tokens: true } };
}

module.exports = { translationChecks, urls, protectedTokens };
