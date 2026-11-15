'use strict';

const { applyTranslation } = require('../render/apply-translation');
const { translationInput } = require('./translation-schema');
const { hasKoreanText } = require('../../shared/common/korean-text');
const { validatePublicArticle } = require('../reporter/public-article-contract');
const { publicProseLeakageIssues } = require('../reporter/public-prose-leakage');

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

// 공개 기사 계약의 내부 용어 금지어 중 카메라 기술 용어로도 쓰이는 것만 둔 고정 표다. 한국어 원문이 왼쪽 용어의
// 한국어 대응어를 쓰면 그 번역은 새로 끼워 넣은 내부 용어가 아니라 원문을 옮긴 것이다(2026-W47: 폴백 → fallback,
// 검사기 → validators). 한국어판은 한국어 낱말이라 이 영어 규칙을 피했을 뿐이다. 'Review-only', 'publish gate',
// 'candidate shortage' 같은 순수 파이프라인 용어는 원문과 무관하게 계속 막아야 하므로 넣지 않는다.
const KOREAN_COUNTERPARTS = Object.freeze({
  fallback: ['폴백'],
  validator: ['검사기', '검증기', '밸리데이터']
});

// 누출 이슈 메시지("... contains internal public-forbidden term: Fallback", "... contextual internal term:
// validator+internal_marker")에서 걸린 용어만 꺼낸다. 문맥 marker는 판정 대상이 아니다.
function leakedTerm(item) {
  if (item.type !== 'public_article_leakage') return '';
  const match = /contains (?:internal public-forbidden term|contextual internal term): ([^+]+?)(?:\+\w+)?$/.exec(item.message || '');
  return match ? match[1].toLowerCase() : '';
}

// 문맥 금지어는 같은 문장·근처의 marker(internal 등)와 함께 걸린다. 일반 기술 문장에서도 자연스러운 marker만
// 한국어 대응어와 함께 둔다. debug, schema, pipeline, report, output, gate, policy, contract, public_article
// 같은 marker는 일부러 넣지 않아 원문과 무관하게 계속 막는다.
const KOREAN_MARKER_COUNTERPARTS = Object.freeze({
  internal: ['내부']
});

// 대응어 뒤에 '간'이 오면 다른 낱말이다('검증기간'은 검증기가 아니다).
function hasKoreanWord(words, value) {
  const serialized = JSON.stringify(value ?? '');
  return words.some(word => new RegExp(`${word}(?!간)`).test(serialized));
}

// 번역문에서 걸린 누출 이슈가 한국어 원문의 짝이 되는 필드(item.key)에 있는 대응어를 충실히 옮긴 것이면 true다.
// 다른 필드나 번역 대상이 아닌 필드(editorial_story 등)의 대응어는 보지 않는다. 문맥 이슈는 용어뿐 아니라 그
// 문맥을 만든 marker도 원문에 대응어가 있어야 한다. 어떤 marker가 걸렸는지는 메시지에 없으므로, 원문에 대응어가
// 있는 marker만 번역문 필드에서 지우고 같은 판정(publicProseLeakageIssues)을 다시 돌려 이슈가 사라지는지 본다.
// debug 같은 다른 marker가 남아 있으면 이슈가 그대로여서 막힌다.
// 번역 검사와 validate:public의 translation.en.json 검사가 같은 판정을 쓰도록 내보낸다.
function isFaithfulTechnicalTerm(item, sourceSection, englishSection) {
  const term = leakedTerm(item);
  const sourceValue = sourceSection?.public_article?.[item.key];
  if (!term || !hasKoreanWord(KOREAN_COUNTERPARTS[term] || [], sourceValue)) return false;
  if (!item.message.includes('contextual internal term')) return true;
  let serialized = JSON.stringify(englishSection?.public_article?.[item.key] ?? '');
  for (const [marker, words] of Object.entries(KOREAN_MARKER_COUNTERPARTS)) {
    if (hasKoreanWord(words, sourceValue)) serialized = serialized.replace(new RegExp(marker, 'gi'), 'inward');
  }
  return !publicProseLeakageIssues(JSON.parse(serialized), `public_article.${item.key}`).includes(item.message);
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

module.exports = { translationChecks, urls, protectedTokens, isFaithfulTechnicalTerm };
