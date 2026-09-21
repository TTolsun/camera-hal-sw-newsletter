'use strict';

// 주간 에디터 레터(issue.intro_letter) 계약 (T10, #853, 설계 §4.7).
//
// finalize에서 최종 기사 세트가 확정된 뒤 별도 소형 LLM 호출로 2~5문장 편집자 편지를 만들고,
// 결정론 게이트 lintIntroLetter가 통과시킨 것만 발행한다. 게이트와 채택이 같은 모듈·같은 PR에
// 있어 무방비 기간이 없다. 프롬프트를 newsletter-prompts.js에 두지 않는 이유: 그 파일은 T9가
// 전면 재작성할 예정이라 교집합을 만들면 안 된다.
//
// 게이트 4종:
// 1. 커버리지 — 최종 기사마다 headline 변별 토큰이 레터에 최소 1개 등장.
// 2. 유령 기사 금지 — 레터의 기술 식별자 토큰 전부가 최종 headline/lead 토큰 집합의 부분집합.
// 3. prose-leakage — 내부 식별자·금지어 스캔(publicProseLeakageIssues 재사용).
// 4. 길이 상하한 — 문자 수와 문장 수.
//
// 게이트 실패 시 1회 재생성, 재실패 시 레터 없이 반환한다 — 호출부(weekly-newsletter-output)가
// 기존 weeklySummaryText 결정론 문장으로 fallback한다(v2에서 유일하게 남는 독자 도달 결정론
// 문장, 승인된 명시적 fallback).

const { publicProseLeakageIssues } = require('../reporter/public-prose-leakage');
const { LLM_STAGES, stageRun } = require('../../shared/llm/stage-catalog');

const INTRO_LETTER_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['intro_letter'],
  properties: {
    intro_letter: { type: 'STRING' }
  }
};

const INTRO_LETTER_SYSTEM_INSTRUCTION = [
  '당신은 Camera HAL / SW 주간 뉴스레터의 에디터입니다.',
  '이번 주 최종 기사 목록(articles: headline과 lead)이 주어집니다.',
  '독자에게 이번 호를 소개하는 에디터 편지(intro_letter)를 한국어 2~5문장으로 작성합니다.',
  '모든 기사를 최소 한 번씩 언급하되, 각 기사는 headline에 있는 기술 식별자(제품명, 버전, 칩 이름 등)를 그대로 써서 가리킵니다.',
  'headline과 lead에 없는 기술 식별자·버전·수치를 새로 만들지 마세요.',
  '내부 파이프라인 용어(validator, quality gate, publish 같은 표현)를 쓰지 마세요.',
  'intro_letter 문자열 하나만 담은 JSON으로 답합니다.'
].join('\n');

const INTRO_LETTER_LENGTH_MIN = 40;
const INTRO_LETTER_LENGTH_MAX = 700;
const INTRO_LETTER_SENTENCE_MIN = 2;
const INTRO_LETTER_SENTENCE_MAX = 5;

// 영문 기능어와 이 뉴스레터 매 호에 나오는 도메인 일반어. 변별력이 없어 커버리지 토큰과
// 유령 기사 판정 토큰 양쪽에서 제외한다.
const GENERIC_TOKENS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'from', 'by', 'at',
  'as', 'is', 'are', 'was', 'were', 'be', 'this', 'that', 'it', 'its', 'into', 'new',
  'camera', 'android', 'hal', 'sw', 'api', 'release', 'update', 'driver', 'newsletter'
]);

// 한국어·영문 혼합 텍스트에서 기술 식별자 후보(ASCII 영숫자 토큰)를 뽑는다. 휴리스틱이라
// false negative(정상 레터 차단)는 fallback으로 안전하고, false positive(유령 언급 통과)가
// 잔존 리스크다(설계 §7-4).
function technicalTokens(value) {
  const matches = String(value || '').match(/[A-Za-z0-9][A-Za-z0-9._+\-\/#]*/g) || [];
  return matches
    .map(token => token.replace(/[._+\-\/#]+$/, '').toLowerCase())
    .filter(token => token.length >= 2 && !GENERIC_TOKENS.has(token));
}

function articleHeadline(article = {}) {
  return String((article.public_article && article.public_article.headline) || article.headline || '');
}

function articleLead(article = {}) {
  return String((article.public_article && article.public_article.lead) || '');
}

// 커버리지 판정용 변별 토큰. 순한글 headline은 기술 토큰이 없으므로 공백 단위 낱말(2자 이상)로
// 변별한다 — 그래도 없으면 빈 배열이고, 그 기사는 커버 불가로 실패해 fallback으로 떨어진다.
function coverageTokens(headline) {
  const technical = technicalTokens(headline);
  if (technical.length > 0) return technical;
  return String(headline || '')
    .split(/\s+/)
    .map(word => word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase())
    .filter(word => word.length >= 2);
}

// 문장 경계: 종결 부호 뒤가 공백이나 끝일 때만 센다. "v0.7.2" 같은 버전 표기의 마침표를
// 문장으로 세지 않기 위해서다.
function sentenceCount(letter) {
  return (String(letter).match(/[.!?。！？](?=\s|$)/g) || []).length;
}

// 결정론 게이트. 통과하면 { ok: true, issues: [] }.
function lintIntroLetter(introLetter, articles = []) {
  const letter = String(introLetter || '').trim();
  const lowerLetter = letter.toLowerCase();
  const issues = [];

  if (letter.length < INTRO_LETTER_LENGTH_MIN || letter.length > INTRO_LETTER_LENGTH_MAX) {
    issues.push(`length_out_of_bounds:${letter.length}`);
  }
  const sentences = sentenceCount(letter);
  if (sentences < INTRO_LETTER_SENTENCE_MIN || sentences > INTRO_LETTER_SENTENCE_MAX) {
    issues.push(`sentence_count_out_of_bounds:${sentences}`);
  }

  for (const article of articles) {
    const headline = articleHeadline(article);
    const covered = coverageTokens(headline).some(token => lowerLetter.includes(token));
    if (!covered) issues.push(`uncovered_article:${headline}`);
  }

  const allowedTokens = new Set();
  for (const article of articles) {
    for (const token of technicalTokens(`${articleHeadline(article)} ${articleLead(article)}`)) {
      allowedTokens.add(token);
    }
  }
  for (const token of new Set(technicalTokens(letter))) {
    if (!allowedTokens.has(token)) issues.push(`ghost_token:${token}`);
  }

  for (const leak of publicProseLeakageIssues(letter, 'intro_letter')) {
    issues.push(`prose_leakage:${leak}`);
  }

  return { ok: issues.length === 0, issues };
}

// same-week upsert 멱등 + 생성/재생성/fallback 결정.
// - 저장된 레터가 현재 최종 기사 집합의 게이트를 통과하면 바이트 동일하게 재사용한다.
// - 저장 레터가 실패했으면(기사 추가·demote 드리프트) 재생성 1회, 처음부터 없으면 생성 1회 +
//   재생성 1회. 전부 실패하면 introLetter 없이 반환한다(호출부가 weeklySummaryText로 fallback).
async function resolveIntroLetter({ articles = [], storedIntroLetter, generateIntroLetter } = {}) {
  const stored = String(storedIntroLetter || '').trim();
  const storedLint = stored ? lintIntroLetter(stored, articles) : null;
  if (storedLint && storedLint.ok) {
    return { introLetter: stored, status: 'reused', reason: '' };
  }
  if (typeof generateIntroLetter !== 'function') {
    return {
      introLetter: '',
      status: 'fallback',
      reason: storedLint ? `stored_letter_failed_gate:${storedLint.issues.join(',')}` : 'no_generator'
    };
  }
  const maxAttempts = storedLint ? 1 : 2;
  const failures = storedLint ? [`stored_letter_failed_gate:${storedLint.issues.join(',')}`] : [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let candidate = '';
    try {
      candidate = String(await generateIntroLetter({ articles }) || '').trim();
    } catch (error) {
      failures.push(`attempt_${attempt}_error:${String(error && error.message || error)}`);
      continue;
    }
    const lint = lintIntroLetter(candidate, articles);
    if (lint.ok) {
      return { introLetter: candidate, status: attempt === 1 ? 'generated' : 'regenerated', reason: '' };
    }
    failures.push(`attempt_${attempt}_failed_gate:${lint.issues.join(',')}`);
  }
  return { introLetter: '', status: 'fallback', reason: failures.join(' | ') };
}

// newsroom LLM client(callLlmJson)를 intro-letter stage로 배선한다. 입력은 최종 기사의
// headline+lead만 — 드리프트 재료(본문·내부 필드)를 프롬프트에서 차단한다.
function buildIntroLetterGenerator({ callLlmJson, stage = stageRun(LLM_STAGES.INTRO_LETTER) } = {}) {
  if (typeof callLlmJson !== 'function') return null;
  return async ({ articles = [] } = {}) => {
    const prompt = JSON.stringify({
      articles: articles.map(article => ({ headline: articleHeadline(article), lead: articleLead(article) }))
    });
    // sampling은 stage catalog의 intro_letter 정의(default temperature)가 정한다 —
    // callLlmJson의 options는 temperature를 소비하지 않는다.
    const response = await callLlmJson(
      stage, INTRO_LETTER_SYSTEM_INSTRUCTION, prompt, INTRO_LETTER_RESPONSE_SCHEMA
    );
    return response && response.intro_letter;
  };
}

module.exports = {
  INTRO_LETTER_RESPONSE_SCHEMA,
  INTRO_LETTER_SYSTEM_INSTRUCTION,
  buildIntroLetterGenerator,
  lintIntroLetter,
  resolveIntroLetter
};
