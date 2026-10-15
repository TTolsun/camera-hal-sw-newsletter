'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  INTRO_LETTER_RESPONSE_SCHEMA,
  INTRO_LETTER_REVIEW_RESPONSE_SCHEMA,
  INTRO_LETTER_SYSTEM_INSTRUCTION,
  buildIntroLetterGenerator,
  buildIntroLetterReviewer,
  lintIntroLetter,
  introLetterSourceHash,
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
const PASSING_LETTER = ARTICLES.map(item => item.public_article.lead).join(' ');

// 사실 확인 단계가 통과시키는 검토자. 채택 경로 테스트에서 쓴다.
const ACCEPT = async () => ({ ok: true, issues: [] });

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
    storedIntroLetter: PASSING_LETTER, storedSourceHash: introLetterSourceHash(ARTICLES),
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
    generateIntroLetter: async () => responses.shift(),
    reviewIntroLetter: ACCEPT
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
  const reused = await resolveIntroLetter({ articles: ARTICLES, storedIntroLetter: PASSING_LETTER, storedSourceHash: introLetterSourceHash(ARTICLES) });
  assert.equal(reused.status, 'reused');
  const fallback = await resolveIntroLetter({ articles: ARTICLES, storedIntroLetter: '' });
  assert.equal(fallback.status, 'fallback');
  assert.equal(fallback.reason, 'no_generator');
});

test('buildIntroLetterGenerator: 공개 headline/lead/takeaway만 intro-letter stage에 전달한다', async () => {
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
  // 내부 QA·원시 근거·본문은 생성 입력에서 제외한다.
  const promptPayload = JSON.parse(calls[0].prompt);
  assert.deepEqual(promptPayload, {
    articles: ARTICLES.map(item => ({ headline: item.public_article.headline, lead: item.public_article.lead, takeaway: '' }))
  });
});

test('buildIntroLetterGenerator: callLlmJson이 없으면 null을 돌려준다', () => {
  assert.equal(buildIntroLetterGenerator({}), null);
});

// 소개·연결 문장은 결정론 게이트에서 막지 않는다. 예전 규칙(공개 문장 그대로만 허용)은 이런
// 레터를 전부 막아 매주 fallback했다(#1276 후속). 사실성은 사실 확인 단계가 판정한다.
test('lintIntroLetter accepts a connective overview that names every article', () => {
  const overview = '이번 주에는 libcamera v0.7.2 릴리스와 SM8750 ISP 드라이버 패치를 살펴봅니다. ' +
    '두 소식 모두 적용 조건과 확인할 사항을 기사에서 구분했습니다.';
  assert.deepEqual(lintIntroLetter(overview, ARTICLES).issues, []);
});

// 게이트를 통과해도 사실 확인이 거부하면 채택하지 않는다. 상태 반전·없는 수치·사내 성과·근거 없는
// 추세처럼 결정론으로 잡을 수 없는 문장이 이 경로로 막힌다.
test('resolveIntroLetter adopts a lint-passing letter only when the fact review accepts it', async () => {
  const claim = 'SM8750 ISP 드라이버 패치를 배포했습니다.';
  const letter = `${PASSING_LETTER} ${claim}`;
  assert.equal(lintIntroLetter(letter, ARTICLES).ok, true);
  const reviews = [];
  const rejected = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: '',
    generateIntroLetter: async () => letter,
    reviewIntroLetter: async input => { reviews.push(input); return { ok: false, issues: [`unsupported:${claim}`] }; }
  });
  assert.equal(rejected.status, 'fallback');
  assert.equal(rejected.introLetter, '');
  assert.match(rejected.reason, /attempt_1_failed_review:unsupported:SM8750 ISP 드라이버 패치를 배포했습니다\./);
  assert.match(rejected.reason, /attempt_2_failed_review:/);
  assert.equal(reviews.length, 2);
  assert.equal(reviews[0].introLetter, letter);
  assert.equal(reviews[0].articles, ARTICLES);

  const accepted = await resolveIntroLetter({
    articles: ARTICLES, storedIntroLetter: '', generateIntroLetter: async () => PASSING_LETTER, reviewIntroLetter: ACCEPT
  });
  assert.equal(accepted.status, 'generated');
  assert.equal(accepted.introLetter, PASSING_LETTER);
});

// 검증하지 못한 레터는 발행하지 않는다: 검토자가 없거나, 던지거나, ok가 정확히 true가 아니면 탈락.
test('resolveIntroLetter fails closed when the fact review is missing, errors or is not an explicit pass', async () => {
  for (const [reviewIntroLetter, reason] of [
    [undefined, /no_reviewer/],
    [async () => { throw new Error('judge unavailable'); }, /review_error:judge unavailable/],
    [async () => ({ ok: 'yes' }), /review_rejected/],
    [async () => null, /review_rejected/]
  ]) {
    const resolution = await resolveIntroLetter({
      articles: ARTICLES, storedIntroLetter: '', generateIntroLetter: async () => PASSING_LETTER, reviewIntroLetter
    });
    assert.equal(resolution.status, 'fallback');
    assert.equal(resolution.introLetter, '');
    assert.match(resolution.reason, reason);
  }
});

test('a stored letter with a matching fingerprint is reused without another fact review', async () => {
  let reviews = 0;
  const resolution = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: PASSING_LETTER,
    storedSourceHash: introLetterSourceHash(ARTICLES),
    generateIntroLetter: async () => '새 레터',
    reviewIntroLetter: async () => { reviews += 1; return { ok: true, issues: [] }; }
  });
  assert.equal(resolution.status, 'reused');
  assert.equal(reviews, 0);
});

test('buildIntroLetterReviewer sends only public fields and the letter to the intro-letter-review stage', async () => {
  const articles = structuredClone(ARTICLES);
  articles[0].public_article.camera_hal_takeaway = '조건을 참고할 수 있습니다.';
  articles[0].reader_checkpoints = ['private-check'];
  articles[0].public_article.body_paragraphs = ['private-body'];
  const calls = [];
  const review = buildIntroLetterReviewer({ callLlmJson: async (stage, systemInstruction, prompt, schema) => {
    calls.push({ stage, systemInstruction, prompt, schema });
    return { supported: true, unsupported_sentences: [] };
  } });
  assert.deepEqual(await review({ introLetter: PASSING_LETTER, articles }), { ok: true, issues: [] });
  assert.equal(calls[0].stage.label, 'intro-letter-review');
  assert.equal(calls[0].stage.definition.modelGroup, 'factcheck');
  assert.equal(calls[0].schema, INTRO_LETTER_REVIEW_RESPONSE_SCHEMA);
  assert.doesNotMatch(calls[0].prompt, /private-/);
  assert.deepEqual(JSON.parse(calls[0].prompt), {
    articles: articles.map(item => ({
      headline: item.public_article.headline, lead: item.public_article.lead, takeaway: item.public_article.camera_hal_takeaway || ''
    })),
    intro_letter: PASSING_LETTER
  });
  assert.equal(buildIntroLetterReviewer({}), null);
});

test('buildIntroLetterReviewer passes only an explicit supported verdict with no unsupported sentence', async () => {
  const reviewWith = response => buildIntroLetterReviewer({ callLlmJson: async () => response })({ introLetter: PASSING_LETTER, articles: ARTICLES });
  assert.deepEqual(await reviewWith({ supported: true, unsupported_sentences: [] }), { ok: true, issues: [] });
  assert.deepEqual(await reviewWith({ supported: true, unsupported_sentences: ['성능이 20% 향상됐습니다.'] }),
    { ok: false, issues: ['unsupported:성능이 20% 향상됐습니다.'] });
  assert.deepEqual(await reviewWith({ supported: false, unsupported_sentences: [] }), { ok: false, issues: ['review_rejected'] });
  for (const malformed of [null, {}, { supported: 'true', unsupported_sentences: [] }, { supported: true }]) {
    assert.deepEqual(await reviewWith(malformed), { ok: false, issues: ['review_malformed_response'] });
  }
});

test('source fingerprint covers final identity, order, public prose and sources, excluding image and internal QA', () => {
  const articles = structuredClone(ARTICLES);
  articles[0].public_article.body_paragraphs = ['검증된 공개 본문입니다.'];
  articles[0].public_article.source_links = [{ url: 'https://example.com/a', title: 'Source', source_role: 'primary' }];
  const hash = introLetterSourceHash(articles);
  assert.match(hash, /^sha256:[a-f0-9]{64}$/);
  for (const mutate of [
    value => value.reverse(),
    value => value.pop(),
    value => { value[0].id = 'new-id'; },
    value => { value[0].public_article.headline += ' 수정'; },
    value => { value[0].public_article.lead += ' 수정'; },
    value => { value[0].public_article.camera_hal_takeaway = '의미 수정'; },
    value => { value[0].public_article.body_paragraphs[0] += ' 수정'; },
    value => { value[0].public_article.source_links[0].url = 'https://example.com/b'; }
  ]) {
    const changed = structuredClone(articles);
    mutate(changed);
    assert.notEqual(introLetterSourceHash(changed), hash);
  }
  articles[0].selectedImage = 'https://example.com/image.png';
  articles[0].published_at = '2026-10-13';
  articles[0].public_article.reader_checkpoints = ['내부 QA 변경'];
  articles[0].decision_metadata = { private: true };
  assert.equal(introLetterSourceHash(articles), hash);
});

test('missing or stale stored fingerprint cannot reuse a lint-passing intro', async () => {
  for (const storedSourceHash of [undefined, 'sha256:stale']) {
    let calls = 0;
    const resolution = await resolveIntroLetter({ articles: ARTICLES, storedIntroLetter: PASSING_LETTER,
      storedSourceHash, generateIntroLetter: async () => { calls += 1; return PASSING_LETTER; }, reviewIntroLetter: ACCEPT });
    assert.equal(resolution.status, 'generated');
    assert.equal(calls, 1);
    assert.equal(resolution.sourceHash, introLetterSourceHash(ARTICLES));
    const fallback = await resolveIntroLetter({ articles: ARTICLES, storedIntroLetter: PASSING_LETTER, storedSourceHash });
    assert.equal(fallback.status, 'fallback');
    assert.equal(fallback.sourceHash, undefined);
  }
});

test('story-v2 public markdown participates in the fingerprint after normalization', () => {
  const articles = [article('SM8750 드라이버 제안', 'SM8750 변경을 제안했습니다.')];
  articles[0].public_article.story_contract_version = 2;
  articles[0].public_article.body_markdown = '## 조건\r\n\r\n검토 중인 변경입니다.';
  const before = introLetterSourceHash(articles);
  articles[0].public_article.body_markdown = '## 조건\n\n검토 중인 변경입니다.';
  assert.equal(introLetterSourceHash(articles), before);
  articles[0].public_article.body_markdown += '\n\n근거를 수정했습니다.';
  assert.notEqual(introLetterSourceHash(articles), before);
});

test('intro generation never passes internal review fields to the model', async () => {
  const articles = structuredClone(ARTICLES);
  articles[0].public_article.camera_hal_takeaway = '조건을 참고할 수 있습니다.';
  articles[0].reader_checkpoints = ['private-check'];
  articles[0].hal_signal_capsule = { private: 'private-signal' };
  articles[0].public_article.editorial_story = { private: 'private-story' };
  articles[0].public_article.body_paragraphs = ['private-body'];
  const generate = buildIntroLetterGenerator({ callLlmJson: async (_stage, _system, prompt) => {
    assert.doesNotMatch(prompt, /private-/);
    assert.equal(JSON.parse(prompt).articles[0].takeaway, '조건을 참고할 수 있습니다.');
    return { intro_letter: PASSING_LETTER };
  } });
  await generate({ articles });
});

test('the generation instruction states the same length and sentence bounds the gate enforces', () => {
  assert.match(INTRO_LETTER_SYSTEM_INSTRUCTION, /2~5문장/);
  assert.match(INTRO_LETTER_SYSTEM_INSTRUCTION, /700자 이내/);
  // 지시문의 700자가 실제 게이트 경계와 같은지 확인한다.
  const head = 'libcamera와 SM8750 소식입니다. ';
  const tail = ' 끝입니다.';
  const sized = length => `${head}${'가'.repeat(length - head.length - tail.length)}${tail}`;
  assert.equal(sized(700).length, 700);
  const lengthIssue = letter => lintIntroLetter(letter, ARTICLES).issues.some(issue => issue.startsWith('length_out_of_bounds:'));
  assert.equal(lengthIssue(sized(700)), false);
  assert.equal(lengthIssue(sized(701)), true);
});

test('a regeneration call receives the problems that discarded the previous answer', async () => {
  const received = [];
  const responses = ['게이트에 실패하는 첫 응답입니다. 두 번째 문장입니다.', PASSING_LETTER];
  const resolution = await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: '',
    generateIntroLetter: async ({ previousAttemptProblems }) => { received.push(previousAttemptProblems); return responses.shift(); },
    reviewIntroLetter: ACCEPT
  });
  assert.equal(resolution.status, 'regenerated');
  assert.deepEqual(received[0], []);
  assert.ok(received[1].some(issue => issue.startsWith('uncovered_article:')));
});

test('a regeneration call after a rejected fact review receives the unsupported sentences', async () => {
  const received = [];
  const review = async () => ({ ok: false, issues: ['unsupported:근거 없는 문장'] });
  await resolveIntroLetter({
    articles: ARTICLES,
    storedIntroLetter: '',
    generateIntroLetter: async ({ previousAttemptProblems }) => { received.push(previousAttemptProblems); return PASSING_LETTER; },
    reviewIntroLetter: review
  });
  assert.deepEqual(received, [[], ['unsupported:근거 없는 문장']]);
});

test('the generator adds previous_attempt_problems to the prompt only when there are problems', async () => {
  const prompts = [];
  const generate = buildIntroLetterGenerator({ callLlmJson: async (_stage, _system, prompt) => {
    prompts.push(JSON.parse(prompt));
    return { intro_letter: PASSING_LETTER };
  } });
  await generate({ articles: ARTICLES, previousAttemptProblems: [] });
  await generate({ articles: ARTICLES, previousAttemptProblems: ['length_out_of_bounds:835'] });
  assert.equal('previous_attempt_problems' in prompts[0], false);
  assert.deepEqual(prompts[1].previous_attempt_problems, ['length_out_of_bounds:835']);
});
