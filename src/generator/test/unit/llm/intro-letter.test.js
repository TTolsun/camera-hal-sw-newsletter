'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  INTRO_LETTER_RESPONSE_SCHEMA,
  buildIntroLetterGenerator,
  lintIntroLetter,
  resolveIntroLetter
} = require('../../../editor/intro-letter');

// 게이트/생성 입력으로 쓰는 최종 기사 형태(주간 upsert의 최종 section 최소 표본).
function article(headline, lead) {
  return { public_article: { headline, lead } };
}

const ARTICLES = [
  article('libcamera v0.7.2 릴리스', 'libcamera v0.7.2가 imx296 embedded data 처리를 되돌렸습니다.'),
  article('SM8750 ISP 드라이버 패치', 'SM8750 ISP 드라이버 시리즈가 리뷰에 올라왔습니다.')
];

// 두 기사 모두의 변별 토큰(libcamera, SM8750)을 담고, 길이·문장 수 경계 안에 있는 통과 레터.
const PASSING_LETTER =
  '이번 주에는 libcamera v0.7.2 릴리스를 살펴봅니다. ' +
  'SM8750 ISP 드라이버 패치 시리즈도 함께 다룹니다. ' +
  '두 소식 모두 실무 검증 포인트를 정리했습니다.';

test('lintIntroLetter: 모든 기사의 변별 토큰을 담은 레터는 통과한다', () => {
  const result = lintIntroLetter(PASSING_LETTER, ARTICLES);
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
});

test('lintIntroLetter: 기사 하나의 변별 토큰이 빠지면 커버리지 미달로 실패한다', () => {
  const letter =
    '이번 주에는 libcamera v0.7.2 릴리스를 살펴봅니다. ' +
    '그 외에도 여러 소식을 함께 정리했습니다.';
  const result = lintIntroLetter(letter, ARTICLES);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.startsWith('uncovered_article:SM8750')));
});

test('lintIntroLetter: headline/lead에 없는 기술 식별자는 유령 토큰으로 실패한다', () => {
  const letter =
    '이번 주에는 libcamera v0.7.2 릴리스를 살펴봅니다. ' +
    'SM8750 ISP 드라이버 패치와 함께 CameraX SessionProcessor 소식도 다룹니다.';
  const result = lintIntroLetter(letter, ARTICLES);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.startsWith('ghost_token:camerax')));
  assert.ok(result.issues.some(issue => issue.startsWith('ghost_token:sessionprocessor')));
});

test('lintIntroLetter: 내부 금지어(prose-leakage)가 있으면 실패한다', () => {
  const letter =
    '이번 주에는 libcamera v0.7.2 릴리스를 살펴봅니다. ' +
    'SM8750 ISP 드라이버 패치는 publish gate를 통과했습니다.';
  const result = lintIntroLetter(letter, ARTICLES);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(issue => issue.startsWith('prose_leakage:')));
});

test('lintIntroLetter: 문장 수 상하한(2~5문장)을 벗어나면 실패한다', () => {
  const oneSentence = '이번 주에는 libcamera v0.7.2 릴리스와 SM8750 ISP 드라이버 패치를 다룹니다.';
  assert.ok(lintIntroLetter(oneSentence, ARTICLES).issues.some(issue => issue.startsWith('sentence_count_out_of_bounds:1')));

  const sixSentences =
    'libcamera 소식입니다. SM8750 소식입니다. 셋째 문장입니다. ' +
    '넷째 문장입니다. 다섯째 문장입니다. 여섯째 문장입니다.';
  assert.ok(lintIntroLetter(sixSentences, ARTICLES).issues.some(issue => issue.startsWith('sentence_count_out_of_bounds:6')));
});

test('lintIntroLetter: 길이 상하한을 벗어나면 실패한다', () => {
  const tooShort = 'libcamera 소식. SM8750 소식.';
  assert.ok(lintIntroLetter(tooShort, ARTICLES).issues.some(issue => issue.startsWith('length_out_of_bounds:')));

  const tooLong =
    `이번 주에는 libcamera 릴리스를 다룹니다. SM8750 소식도 있습니다. ${'같은 내용을 아주 길게 반복해 씁니다 '.repeat(40)}마무리 문장입니다.`;
  assert.ok(lintIntroLetter(tooLong, ARTICLES).issues.some(issue => issue.startsWith('length_out_of_bounds:')));
});

test('lintIntroLetter: 문장 중간의 버전 표기(v0.7.2)는 문장 경계로 세지 않는다', () => {
  // "v0.7.2"의 마침표들이 문장으로 세어지면 통과 레터가 문장 수 초과로 떨어진다.
  const result = lintIntroLetter(PASSING_LETTER, ARTICLES);
  assert.ok(!result.issues.some(issue => issue.startsWith('sentence_count_out_of_bounds:')));
});

test('resolveIntroLetter: 저장된 레터가 게이트를 통과하면 생성 호출 없이 바이트 동일하게 재사용한다', async () => {
  let generatorCalls = 0;
  const resolution = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: PASSING_LETTER,
    generateIntroLetter: async () => { generatorCalls += 1; return '새 레터'; }
  });
  assert.equal(resolution.introLetter, PASSING_LETTER);
  assert.equal(resolution.status, 'reused');
  assert.equal(generatorCalls, 0);
});

test('resolveIntroLetter: 저장된 레터가 게이트에 실패하면 재생성 1회 후 실패 시 fallback한다', async () => {
  let generatorCalls = 0;
  const resolution = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: '기사 추가로 더는 커버리지를 만족하지 못하는 옛 레터입니다. 두 번째 문장입니다.',
    generateIntroLetter: async () => { generatorCalls += 1; return '여전히 게이트에 실패하는 레터입니다. 두 번째 문장입니다.'; }
  });
  assert.equal(generatorCalls, 1);
  assert.equal(resolution.introLetter, '');
  assert.equal(resolution.status, 'fallback');
  assert.ok(resolution.reason.length > 0);
});

test('resolveIntroLetter: 저장된 레터가 없으면 생성 1회 실패 후 재생성 1회로 채택한다', async () => {
  const responses = ['게이트에 실패하는 첫 응답입니다. 두 번째 문장입니다.', PASSING_LETTER];
  const resolution = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: '',
    generateIntroLetter: async () => responses.shift()
  });
  assert.equal(resolution.introLetter, PASSING_LETTER);
  assert.equal(resolution.status, 'regenerated');
});

test('resolveIntroLetter: 생성 호출이 던져도 fallback으로 끝난다(발행을 막지 않는다)', async () => {
  const resolution = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: '',
    generateIntroLetter: async () => { throw new Error('provider unavailable'); }
  });
  assert.equal(resolution.introLetter, '');
  assert.equal(resolution.status, 'fallback');
  assert.match(resolution.reason, /provider unavailable/);
});

test('resolveIntroLetter: 생성기가 없으면 저장 레터 재사용만 하고 아니면 fallback한다', async () => {
  const reused = await resolveIntroLetter({ articles: ARTICLES, storedIntroLetter: PASSING_LETTER });
  assert.equal(reused.status, 'reused');
  const fallback = await resolveIntroLetter({ articles: ARTICLES, storedIntroLetter: '' });
  assert.equal(fallback.status, 'fallback');
  assert.equal(fallback.reason, 'no_generator');
});

test('buildIntroLetterGenerator: intro-letter stage로 headline+lead만 실어 호출하고 문자열을 돌려준다', async () => {
  const calls = [];
  const generateIntroLetter = buildIntroLetterGenerator({
    callLlmJson: async (stage, systemInstruction, prompt, schema, options) => {
      calls.push({ stage, systemInstruction, prompt, schema, options });
      return { intro_letter: PASSING_LETTER };
    }
  });
  const letter = await generateIntroLetter({ articles: ARTICLES });
  assert.equal(letter, PASSING_LETTER);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].stage.label, 'intro-letter');
  assert.equal(calls[0].schema, INTRO_LETTER_RESPONSE_SCHEMA);
  // 드리프트 재료 차단: 프롬프트에는 최종 기사의 headline+lead만 실린다.
  const promptPayload = JSON.parse(calls[0].prompt);
  assert.deepEqual(promptPayload, {
    articles: ARTICLES.map(item => ({ headline: item.public_article.headline, lead: item.public_article.lead }))
  });
});

test('buildIntroLetterGenerator: callLlmJson이 없으면 null을 돌려준다', () => {
  assert.equal(buildIntroLetterGenerator({}), null);
});
