const assert = require('node:assert/strict');
const test = require('node:test');
const {
  measureProseStyle,
  splitSentences,
  startsWithPurposeClause
} = require('../../quality/prose-style-metrics');
const { buildNewsletterQualityReport } = require('../../quality/newsletter-quality');
const { buildQualityReportMarkdown } = require('../../quality/quality-markdown');
const { koreanProseStylePrompt, koreanProseStyleExamplePrompt } = require('../../reporter/korean-prose-style-prompt');
const { editorSystemPrompt, editorCompletionSystemPrompt, editorRepairPatchSystemPrompt, factCheckSystemPrompt } = require('../../publish/orchestrator-stage-prompts');

function section(publicArticle) {
  return { public_article: publicArticle };
}

test('문장 분리는 소제목·코드 스팬·링크 주소를 길이에서 뺀다', () => {
  const sentences = splitSentences('### 왜 그랬나요?\n\n`EncoderBase.java`를 고쳤습니다. 자세한 내용은 https://example.com/a 에 있습니다.');
  assert.deepEqual(sentences, ['를 고쳤습니다.', '자세한 내용은 에 있습니다.']);
});

test('평균 문장 길이와 120자 초과 비율을 센다', () => {
  const long = `${'가'.repeat(125)}.`;
  const metrics = measureProseStyle([section({ lead: '짧은 문장입니다.', body_markdown: long, camera_hal_takeaway: '' })]);
  assert.equal(metrics.sentence_count, 2);
  assert.equal(metrics.long_sentence_count, 1);
  assert.equal(metrics.long_sentence_ratio, 0.5);
  assert.equal(metrics.reference_only, true);
});

test('목적절로 시작한 lead만 센다', () => {
  assert.equal(startsWithPurposeClause('색상 범위 불일치를 막기 위해, 인코더 설정이 병합되었습니다.'), true);
  assert.equal(startsWithPurposeClause('프레임이 늦게 도착하도록, 큐를 바꾼 패치가 병합되었습니다.'), true);
  assert.equal(startsWithPurposeClause('HeifWriter는 일부 8비트 입력의 불일치를 없애는 수정을 병합했습니다.'), false);
  assert.equal(startsWithPurposeClause(''), false);
});

test('번역투 후보를 유형별로 센다', () => {
  const metrics = measureProseStyle([section({
    lead: '이에 대해 설명하며, 이를 통해 확인합니다.',
    body_markdown: '디버깅에 있어 쓰입니다. 이는 만들어졌고, 수정되어진다.',
    camera_hal_takeaway: ''
  })]);
  assert.equal(metrics.translationese_counts.about, 1);
  assert.equal(metrics.translationese_counts.through, 1);
  assert.equal(metrics.translationese_counts.in_terms_of, 1);
  assert.equal(metrics.translationese_counts.double_passive, 1);
  assert.equal(metrics.translationese_counts.comma_after_connective, 1);
});

test('기사가 없으면 0과 빈 값으로 안전하게 돌려준다', () => {
  const metrics = measureProseStyle(undefined);
  assert.equal(metrics.sentence_count, 0);
  assert.equal(metrics.avg_sentence_length, 0);
  assert.equal(metrics.long_sentence_ratio, 0);
});

test('품질 보고서는 문체 지표를 싣되 문체 때문에 판정이 달라지지 않는다', () => {
  const plainArticle = { lead: '짧고 읽기 쉬운 문장입니다.', body_markdown: '본문입니다.', camera_hal_takeaway: '확인하세요.' };
  const heavyArticle = {
    lead: `${'긴 조건을 이어 붙여'.repeat(30)} 막기 위해, 이에 대해 설명되어진다.`,
    body_markdown: `${'가'.repeat(300)}.`,
    camera_hal_takeaway: '확인하세요.'
  };
  const build = publicArticle => buildNewsletterQualityReport('2026-11-17', { date: '2026-11-17', sections: [{ headline: 'h', public_article: publicArticle }] }, {}, {});
  const plain = build(plainArticle);
  const heavy = build(heavyArticle);
  assert.ok(plain.metrics.prose_style);
  assert.ok(heavy.metrics.prose_style.long_sentence_count >= 1);
  assert.equal(heavy.score, plain.score);
  assert.equal(heavy.status, plain.status);
  assert.deepEqual(heavy.deductions.map(item => item.reason), plain.deductions.map(item => item.reason));
  assert.match(buildQualityReportMarkdown(heavy), /## Prose Style \(reference only\)/);
});

test('한국어 말투 지침과 예시는 쓰기 단계에만 들어가고 판정 프롬프트에는 들어가지 않는다', () => {
  for (const build of [editorSystemPrompt, editorCompletionSystemPrompt, editorRepairPatchSystemPrompt]) {
    assert.ok(build().includes(koreanProseStylePrompt()));
    assert.ok(build().includes(koreanProseStyleExamplePrompt()));
  }
  assert.ok(!factCheckSystemPrompt().includes(koreanProseStylePrompt()));
  assert.match(koreanProseStyleExamplePrompt(), /다른 기사에 가져다 쓰면 안 됩니다/);
  assert.match(koreanProseStylePrompt(), /확정형으로 바꾸지 마세요/);
});
