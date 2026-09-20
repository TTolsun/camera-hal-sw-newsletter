'use strict';

// Story Contract v2 T6 — repair 가상 블록 포인터 리졸버(#849, Refs #1090).
//
// 리졸버는 `/public_article/body_markdown/blocks/{i}` patch를 parseBodyBlocks 기준의
// i번째 블록 교체로 해석해 `/public_article/body_markdown` 전체 교체 patch로 변환한다.
// 인덱스 범위·블록 타입·값 형태가 어긋나면 patch fail이고, 전체 필드 교체로 자동
// 폴백하지 않는다(자동 폴백은 identity-drift 금지 형상의 재진입 — 설계 §4.6).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  bodyMarkdownLintRegressionViolations,
  resolveBodyMarkdownBlockPatches
} = require('../../../repair/body-markdown-block-patch');

const BODY = [
  '첫 문단은 리드 훅을 이어받아 장면을 연다.',
  '',
  '### 리뷰어가 되돌린 지점',
  '',
  '두 번째 문단은 소제목이 연 질문에 답한다.'
].join('\n');

function v2Section(bodyMarkdown = BODY) {
  return {
    headline: 'Headline 1',
    public_article: {
      headline: 'Headline 1',
      lead: '리드 문장입니다.',
      body_markdown: bodyMarkdown,
      camera_hal_takeaway: 'HAL 관점 정리입니다.'
    }
  };
}

test('resolves a paragraph block patch into a full body_markdown replace', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [{
    section_index: 0,
    op: 'replace',
    path: '/public_article/body_markdown/blocks/0',
    value: '고쳐 쓴 첫 문단이다.'
  }]);

  assert.equal(result.ok, true);
  assert.equal(result.patches.length, 1);
  assert.equal(result.patches[0].path, '/public_article/body_markdown');
  assert.equal(result.patches[0].value, [
    '고쳐 쓴 첫 문단이다.',
    '',
    '### 리뷰어가 되돌린 지점',
    '',
    '두 번째 문단은 소제목이 연 질문에 답한다.'
  ].join('\n'));
});

test('resolves a subheading block patch and keeps the ### prefix form', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [{
    section_index: 0,
    op: 'replace',
    path: '/public_article/body_markdown/blocks/1',
    value: '### 협상 경로가 걸린 이유'
  }]);

  assert.equal(result.ok, true);
  assert.match(result.patches[0].value, /^### 협상 경로가 걸린 이유$/m);
  assert.doesNotMatch(result.patches[0].value, /리뷰어가 되돌린 지점/);
});

test('two block patches on the same section both survive (review H1 regression)', () => {
  // 각 patch를 원본 기준으로 독립 해석하면 applyRepairPatches의 순차 적용에서
  // 마지막 전체 교체 patch가 앞의 편집을 덮어 소리 없이 유실된다.
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [
    {
      section_index: 0,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/0',
      value: '고쳐 쓴 첫 문단이다.'
    },
    {
      section_index: 0,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/2',
      value: '고쳐 쓴 마지막 문단이다.'
    }
  ]);

  assert.equal(result.ok, true);
  // 순차 적용에서 마지막 patch 값이 최종 본문이므로, 그 값에 두 편집이 모두 있어야 한다.
  const finalValue = result.patches[result.patches.length - 1].value;
  assert.match(finalValue, /고쳐 쓴 첫 문단이다/);
  assert.match(finalValue, /고쳐 쓴 마지막 문단이다/);
  assert.match(finalValue, /^### 리뷰어가 되돌린 지점$/m);
});

test('a block patch after a full body replace resolves against the replaced body', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [
    {
      section_index: 0,
      op: 'replace',
      path: '/public_article/body_markdown',
      value: '전체 교체 첫 문단.\n\n전체 교체 둘째 문단.'
    },
    {
      section_index: 0,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/1',
      value: '교체본 위에서 다시 고친 둘째 문단.'
    }
  ]);

  assert.equal(result.ok, true);
  const finalValue = result.patches[result.patches.length - 1].value;
  assert.match(finalValue, /전체 교체 첫 문단/);
  assert.match(finalValue, /교체본 위에서 다시 고친 둘째 문단/);
  // 원본 본문의 블록은 더 이상 기준이 아니다.
  assert.doesNotMatch(finalValue, /리뷰어가 되돌린 지점/);
});

test('passes non-block patches through unchanged', () => {
  const sections = [v2Section()];
  const patch = {
    section_index: 0,
    op: 'replace',
    path: '/public_article/lead',
    value: '새 리드입니다.'
  };
  const result = resolveBodyMarkdownBlockPatches(sections, [patch]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.patches, [patch]);
});

test('rejects a block index outside the parsed block range', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [{
    section_index: 0,
    op: 'replace',
    path: '/public_article/body_markdown/blocks/9',
    value: '문단'
  }]);

  assert.equal(result.ok, false);
  assert.equal(result.violations[0].detail, 'block_index_out_of_range');
});

test('rejects a block patch whose value changes the block type', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [{
    section_index: 0,
    op: 'replace',
    path: '/public_article/body_markdown/blocks/0',
    value: '### 문단을 소제목으로 바꾸려는 시도'
  }]);

  assert.equal(result.ok, false);
  assert.equal(result.violations[0].detail, 'block_type_mismatch');
});

test('rejects a block patch whose value is not a single block', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [{
    section_index: 0,
    op: 'replace',
    path: '/public_article/body_markdown/blocks/0',
    value: '문단 하나.\n\n문단 둘.'
  }]);

  assert.equal(result.ok, false);
  assert.equal(result.violations[0].detail, 'block_value_not_single_block');
});

test('rejects a block patch when the section has no body_markdown string', () => {
  const sections = [{ headline: 'Headline 1', public_article: { lead: '리드' } }];
  const result = resolveBodyMarkdownBlockPatches(sections, [{
    section_index: 0,
    op: 'replace',
    path: '/public_article/body_markdown/blocks/0',
    value: '문단'
  }]);

  assert.equal(result.ok, false);
  assert.equal(result.violations[0].detail, 'body_markdown_missing');
});

test('fails before mutating: one bad block patch rejects the whole batch', () => {
  const sections = [v2Section()];
  const result = resolveBodyMarkdownBlockPatches(sections, [
    {
      section_index: 0,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/0',
      value: '정상 교체 문단.'
    },
    {
      section_index: 0,
      op: 'replace',
      path: '/public_article/body_markdown/blocks/9',
      value: '범위 밖.'
    }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 1);
});

test('lint regression guard passes when the patched body introduces no new issue', () => {
  const before = [v2Section()];
  const after = [v2Section([
    '고쳐 쓴 첫 문단이다.',
    '',
    '### 리뷰어가 되돌린 지점',
    '',
    '두 번째 문단은 소제목이 연 질문에 답한다.'
  ].join('\n'))];

  assert.deepEqual(bodyMarkdownLintRegressionViolations(before, after), []);
});

test('lint regression guard fails when the patched body introduces a new violation', () => {
  const before = [v2Section()];
  const after = [v2Section([
    '- 리스트로 바꿔 쓴 본문',
    '',
    '두 번째 문단.'
  ].join('\n'))];

  const violations = bodyMarkdownLintRegressionViolations(before, after);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].detail, 'body_markdown_lint_regression');
  assert.ok(violations[0].issues.some(issue => issue.type === 'body_markdown_forbidden_construct'));
});

test('lint regression guard keeps pre-existing issues repairable without failing', () => {
  // 수리 전 본문이 이미 들고 있던 위반은 재발이 아니다. 그 위반을 그대로 두는 patch
  // (다른 블록만 교체)가 여기서 죽으면 lint 실패 기사를 블록 patch로 고칠 수 없게 된다.
  const brokenBody = [
    '- 이미 리스트 마커 위반이 있는 문단',
    '',
    '두 번째 문단.'
  ].join('\n');
  const before = [v2Section(brokenBody)];
  const after = [v2Section([
    '- 이미 리스트 마커 위반이 있는 문단',
    '',
    '고쳐 쓴 두 번째 문단.'
  ].join('\n'))];

  assert.deepEqual(bodyMarkdownLintRegressionViolations(before, after), []);
});

test('lint regression guard ignores sections whose body did not change', () => {
  const before = [v2Section('- 위반이 있지만 이번 patch 대상이 아닌 본문\n\n문단.')];
  const after = [v2Section('- 위반이 있지만 이번 patch 대상이 아닌 본문\n\n문단.')];

  assert.deepEqual(bodyMarkdownLintRegressionViolations(before, after), []);
});
