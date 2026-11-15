'use strict';

const { applyTranslation } = require('../render/apply-translation');
const { translationInput } = require('./translation-schema');
const { hasKoreanText } = require('../../shared/common/korean-text');
const { validatePublicArticle } = require('../reporter/public-article-contract');
const { KOREAN_COUNTERPARTS, leakedTerm, isFaithfulTechnicalTerm } = require('../reporter/translated-technical-terms');

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

// 재시도 피드백용 문장이다. 코드명(public_article_leakage 등)은 모델에게 보일 필요가 없어 뺀다.
function contractHint(item) {
  const field = item.key || item.type;
  const term = leakedTerm(item);
  if (term && KOREAN_COUNTERPARTS[term]) {
    return `Do not use the word '${term}' in ${field} unless the Korean source uses ${KOREAN_COUNTERPARTS[term][0]}.`;
  }
  if (term) return `Do not use the phrase '${term}' in ${field}; describe it in plain camera-engineering words.`;
  if (item.type === 'public_article_leakage') return `Rewrite ${field} in plain reader-facing prose.`;
  if (item.type === 'body_markdown_forbidden_construct') {
    return `Remove the ${String(item.construct || 'extra').replace(/_/g, ' ')} formatting from body_markdown; keep plain paragraphs and the source's existing subheadings only.`;
  }
  return `Fix ${field} so it keeps the source article's structure in plain prose.`;
}

function contractMessage(item, index) {
  const position = item.blockIndex !== undefined ? ` block ${item.blockIndex}` : item.line !== undefined ? ` line ${item.line}` : '';
  const detail = item.type === 'public_article_leakage' && item.message ? ` (${item.message})` : '';
  return `Public article contract violation in translation: sections[${index}] ${[item.type, item.key, item.construct].filter(Boolean).join(' ')}${position}${detail}`;
}

// 번역이 validate:public과 같은 기사 계약 검사기에서 원문에 없던 위반을 만들면 거부한다. 프롬프트가 금지해도
// LLM이 식별자에 백틱을 붙이는 일이 있었고(2026-10-26 W44: 기사 5건 10곳), 이 검사가 없으면 1차 응답이
// 그대로 기록된 뒤 워크플로 최종 검증에서야 실패해 재시도 기회를 잃는다. 원문이 이미 갖고 있던 위반은 번역의
// 잘못이 아니므로 여기서 거부하지 않는다. 그 위반은 validate:public이 issue.json을 검사할 때 따로 막는다.
// 한국어 원문 대응어를 충실히 옮긴 기술 용어(KOREAN_COUNTERPARTS)도 새 위반이 아니다.
// 검사기는 정규화하면서 입력을 고칠 수 있으므로 사본을 넘긴다. 원본 issue가 바뀌면 다음 시도의
// applyTranslation이 원문 바이트와 issue가 다르다며 거부한다.
function newContractProblems(sourceIssue, translatedIssue) {
  const issue = structuredClone(sourceIssue);
  const english = structuredClone(translatedIssue);
  return issue.sections.flatMap((section, index) => {
    const existing = new Set(validatePublicArticle(section, index, { issue }).map(contractIssueSignature));
    return validatePublicArticle(english.sections[index], index, { issue: english })
      .filter(item => !existing.has(contractIssueSignature(item)) && !isFaithfulTechnicalTerm(item, section, english.sections[index]))
      .map(item => ({ unit: index, message: contractMessage(item, index), hint: contractHint(item) }));
  });
}

// 오류가 속한 재번역 단위를 경로에서 가린다. 기사는 번호, 호 단위 필드(title, summary, watch_points,
// reference_articles)는 'issue' 하나로 묶는다.
function unitOf(field) {
  const match = /^translation\.sections\[(\d+)\]/.exec(field);
  return match ? Number(match[1]) : 'issue';
}

function shortField(field) {
  return field.replace(/^translation\.(?:sections\[\d+\]\.)?/, '');
}

// 검사는 첫 오류에서 멈추지 않고 기사별·호 단위 오류를 모두 모은다. 번역 호출은 비싸서 재시도가 한 번뿐이므로
// 한 번에 모든 오류를 알려야 하고, 어느 기사가 틀렸는지 알아야 그 기사만 다시 번역할 수 있다.
// ID 순서·개수·식별 정보처럼 오류를 기사에 귀속할 수 없는 구조 오류는 호 전체 실패(structural)로 둔다.
function translationProblems(issue, overlay, sourceText) {
  const original = translationInput(issue, sourceText);
  let english;
  try {
    // Also rejects missing/duplicate IDs, unknown keys, incomplete optional fields and stale hashes.
    english = applyTranslation(issue, overlay, { sourceText });
    for (const group of ['sections', 'reference_articles']) {
      if (JSON.stringify(original[group].map(item => item.id)) !== JSON.stringify(overlay[group].map(item => item.id))) {
        throw new Error(`Translation ID order mismatch: ${group}`);
      }
    }
  } catch (error) {
    return { structural: error.message, problems: [] };
  }
  const problems = [];
  const seen = new Set();
  function add(unit, message, hint) {
    if (seen.has(`${unit}|${message}`)) return;
    seen.add(`${unit}|${message}`);
    problems.push({ unit, message, hint });
  }
  function compare(source, target, field) {
    if (typeof source === 'string') {
      if (typeof target !== 'string' || !target.trim()) {
        add(unitOf(field), `Missing translation: ${field}`, `Provide a translation for ${shortField(field)}.`);
        return;
      }
      // URLs and source-title map keys are immutable identities, not translatable prose.
      if (hasKoreanText(withoutUrls(target))) {
        add(unitOf(field), `Korean text remains: ${field}`, `Translate all Korean text in ${shortField(field)} into English.`);
      }
      if (JSON.stringify(urls(source)) !== JSON.stringify(urls(target))) {
        add(unitOf(field), `Translation URL mismatch: ${field}`, `Keep the URLs in ${shortField(field)} exactly as in the source.`);
      }
      for (const token of protectedTokens(source)) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(target)) {
          add(unitOf(field), `Missing protected token ${token}: ${field}`, `Keep the token ${token} exactly as in the source (in ${shortField(field)}).`);
        }
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
  for (const problem of newContractProblems(issue, english)) add(problem.unit, problem.message, problem.hint);
  return { structural: null, problems, english };
}

// 모든 오류를 모아 한 번에 던진다. 구조 오류는 error.problems가 없고, 그 외에는 error.problems로 기사별 재번역
// 대상과 사람이 읽는 피드백(hint)을 알 수 있다.
function translationChecks(issue, overlay, sourceText) {
  const { structural, problems, english } = translationProblems(issue, overlay, sourceText);
  if (structural) throw new Error(structural);
  if (problems.length > 0) {
    throw Object.assign(new Error(problems.map(problem => problem.message).join('; ')), { problems });
  }
  return { issue: english, checks: { ids: true, urls: true, english: true, tokens: true } };
}

module.exports = { translationChecks, urls, protectedTokens };
