const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BODY_MARKDOWN_MIN_PARAGRAPHS,
  RESERVED_SUBHEADING_TERMS,
  RESERVED_SUBHEADING_PATTERNS,
  normalizeBodyMarkdown,
  parseBodyBlocks,
  lintBodyMarkdown,
  bodyMarkdownMetrics
} = require('../../../reporter/public-body-markdown');

const VALID_BODY = [
  '센서 드라이버 하나가 조용히 바뀌었다.',
  '',
  'libcamera 메인라인에 CAMSS 파이프라인 핸들러 패치가 병합되면서 IPA 모듈 경계가 다시 그어졌다.',
  '',
  '### 튜닝 일정이 흔들리는 지점',
  '',
  '벤더 IPA를 쓰는 팀은 재빌드 없이는 노출 제어 경로가 예전 값을 그대로 들고 간다.'
].join('\n');

function issueTypes(issues) {
  return issues.map(issue => issue.type);
}

test('normalizeBodyMarkdown converts CRLF and collapses in-line whitespace', () => {
  assert.equal(
    normalizeBodyMarkdown('첫\t 문단이다.\r\n\r\n둘째  문단이다.  '),
    '첫 문단이다.\n\n둘째 문단이다.'
  );
});

test('normalizeBodyMarkdown collapses repeated blank lines into one', () => {
  assert.equal(
    normalizeBodyMarkdown('첫 문단.\n\n\n\n둘째 문단.'),
    '첫 문단.\n\n둘째 문단.'
  );
});

test('normalizeBodyMarkdown trims leading and trailing blank lines', () => {
  assert.equal(normalizeBodyMarkdown('\n\n  본문.  \n\n'), '본문.');
});

test('normalizeBodyMarkdown is idempotent', () => {
  const once = normalizeBodyMarkdown(VALID_BODY);
  assert.equal(normalizeBodyMarkdown(once), once);
});

test('normalizeBodyMarkdown returns empty string for non-string input', () => {
  assert.equal(normalizeBodyMarkdown(['문단 하나', '문단 둘']), '');
  assert.equal(normalizeBodyMarkdown(null), '');
  assert.equal(normalizeBodyMarkdown(undefined), '');
});

test('parseBodyBlocks returns empty array for empty body', () => {
  assert.deepEqual(parseBodyBlocks(''), []);
});

test('parseBodyBlocks tags subheading and paragraph blocks with sequential blockIndex', () => {
  assert.deepEqual(parseBodyBlocks(VALID_BODY), [
    { type: 'paragraph', text: '센서 드라이버 하나가 조용히 바뀌었다.', blockIndex: 0 },
    {
      type: 'paragraph',
      text: 'libcamera 메인라인에 CAMSS 파이프라인 핸들러 패치가 병합되면서 IPA 모듈 경계가 다시 그어졌다.',
      blockIndex: 1
    },
    { type: 'subheading', text: '튜닝 일정이 흔들리는 지점', blockIndex: 2 },
    {
      type: 'paragraph',
      text: '벤더 IPA를 쓰는 팀은 재빌드 없이는 노출 제어 경로가 예전 값을 그대로 들고 간다.',
      blockIndex: 3
    }
  ]);
});

test('parseBodyBlocks splits a subheading glued to the next paragraph without a blank line', () => {
  const blocks = parseBodyBlocks('### 소제목\n바로 이어지는 문단.');
  assert.deepEqual(blocks.map(block => block.type), ['subheading', 'paragraph']);
  assert.equal(blocks[1].text, '바로 이어지는 문단.');
});

test('parseBodyBlocks joins soft-wrapped paragraph lines with a single space', () => {
  const blocks = parseBodyBlocks('앞줄이다.\n뒷줄이다.');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].text, '앞줄이다. 뒷줄이다.');
});

test('lintBodyMarkdown accepts a narrative body with one subheading', () => {
  assert.deepEqual(lintBodyMarkdown(VALID_BODY), []);
});

test('lintBodyMarkdown accepts a body with no subheading at all', () => {
  const body = '첫 문단이다.\n\n둘째 문단이다.';
  assert.deepEqual(lintBodyMarkdown(body), []);
});

test('lintBodyMarkdown accepts CRLF input without normalization at the call site', () => {
  assert.deepEqual(lintBodyMarkdown(VALID_BODY.replace(/\n/g, '\r\n')), []);
});

test('lintBodyMarkdown rejects heading levels other than three', () => {
  for (const [line, level] of [['# 제목', 1], ['## 2. 제목', 2], ['#### 제목', 4]]) {
    const issues = lintBodyMarkdown(`${line}\n\n첫 문단이다.\n\n둘째 문단이다.`);
    const heading = issues.find(issue => issue.type === 'body_markdown_forbidden_heading_level');
    assert.ok(heading, `expected heading level issue for ${line}`);
    assert.equal(heading.level, level);
    assert.equal(heading.line, 1);
    assert.equal(heading.key, 'body_markdown');
  }
});

test('lintBodyMarkdown rejects a level-three marker without heading text', () => {
  const issues = lintBodyMarkdown('###\n\n첫 문단이다.\n\n둘째 문단이다.');
  const issue = issues.find(item => item.type === 'body_markdown_forbidden_construct');
  assert.equal(issue.construct, 'malformed_subheading');
});

test('lintBodyMarkdown rejects block-level markdown constructs', () => {
  const cases = [
    ['- 목록 항목이다.', 'list_marker'],
    ['* 목록 항목이다.', 'list_marker'],
    ['1. 목록 항목이다.', 'ordered_list_marker'],
    ['> 인용문이다.', 'blockquote'],
    ['---', 'horizontal_rule'],
    ['===', 'setext_heading'],
    ['| 헤더 | 값 |', 'table'],
    ['```js', 'code_fence']
  ];
  for (const [line, construct] of cases) {
    const issues = lintBodyMarkdown(`첫 문단이다.\n\n${line}\n\n둘째 문단이다.`);
    const issue = issues.find(item => item.type === 'body_markdown_forbidden_construct');
    assert.ok(issue, `expected construct issue for ${line}`);
    assert.equal(issue.construct, construct, `construct mismatch for ${line}`);
  }
});

test('lintBodyMarkdown rejects inline markdown constructs', () => {
  const cases = [
    ['자세한 내용은 [패치](https://example.com)에 있다.', 'link'],
    ['![이미지](https://example.com/a.png)', 'image'],
    ['`v4l2_subdev` 구조체가 바뀐다.', 'inline_code'],
    ['<p>원시 HTML이다.</p>', 'raw_html'],
    ['**강조 라벨**', 'emphasis_marker'],
    ['~~취소선~~이다.', 'strikethrough']
  ];
  for (const [line, construct] of cases) {
    const issues = lintBodyMarkdown(`첫 문단이다.\n\n${line}\n\n둘째 문단이다.`);
    const issue = issues.find(item => item.type === 'body_markdown_forbidden_construct');
    assert.ok(issue, `expected construct issue for ${line}`);
    assert.equal(issue.construct, construct, `construct mismatch for ${line}`);
  }
});

test('lintBodyMarkdown rejects raw HTML split across soft-wrapped lines', () => {
  const body = '첫 문단이다.\n\n<img\nsrc="https://example.com/a.png"\n/>\n\n둘째 문단이다.';
  const issue = lintBodyMarkdown(body).find(item => item.type === 'body_markdown_forbidden_construct');
  assert.ok(issue, 'multi-line raw HTML must not pass the line-by-line scan');
  assert.equal(issue.construct, 'raw_html');
  assert.equal(issue.blockIndex, 1);
});

test('lintBodyMarkdown rejects a markdown link split across soft-wrapped lines', () => {
  const body = '첫 문단이다.\n\n[캡션\n](https://example.com)\n\n둘째 문단이다.';
  const issue = lintBodyMarkdown(body).find(item => item.type === 'body_markdown_forbidden_construct');
  assert.equal(issue.construct, 'link');
});

test('lintBodyMarkdown rejects markdown constructs it does not enumerate by name', () => {
  const cases = [
    ['[ref]: https://example.com', 'link_reference'],
    ['각주를 단다[^1] 이렇게.', 'markdown_active_character'],
    ['배열 인덱스 buffer[0] 이야기.', 'markdown_active_character']
  ];
  for (const [line, construct] of cases) {
    const issues = lintBodyMarkdown(`첫 문단이다.\n\n${line}\n\n둘째 문단이다.`);
    const issue = issues.find(item => item.type === 'body_markdown_forbidden_construct');
    assert.ok(issue, `expected construct issue for ${line}`);
    assert.equal(issue.construct, construct, `construct mismatch for ${line}`);
  }
});

test('lintBodyMarkdown keeps a hash-prefixed reference as plain prose', () => {
  assert.deepEqual(lintBodyMarkdown('#844 패치가 병합됐다.\n\n둘째 문단이다.'), []);
});

test('lintBodyMarkdown rejects a heading marker with no space before its text', () => {
  for (const line of ['##제목', '###소제목']) {
    const issues = lintBodyMarkdown(`${line}\n\n첫 문단이다.\n\n둘째 문단이다.`);
    const issue = issues.find(item => item.type === 'body_markdown_forbidden_construct');
    assert.ok(issue, `expected construct issue for ${line}`);
    assert.equal(issue.construct, 'malformed_subheading');
    assert.equal(issue.line, 1);
  }
});

test('lintBodyMarkdown reports line numbers on the normalized body', () => {
  const issues = lintBodyMarkdown('\r\n\r\n첫 문단이다.\r\n\r\n## 잘못된 헤딩\r\n\r\n둘째 문단이다.');
  const issue = issues.find(item => item.type === 'body_markdown_forbidden_heading_level');
  assert.equal(issue.line, 3);
});

test('lintBodyMarkdown checks constructs inside subheading text too', () => {
  const issues = lintBodyMarkdown('첫 문단이다.\n\n### [소제목](https://example.com)\n\n둘째 문단이다.');
  const issue = issues.find(item => item.type === 'body_markdown_forbidden_construct');
  assert.equal(issue.construct, 'link');
});

test('lintBodyMarkdown keeps underscore identifiers as plain prose', () => {
  const body = '__u32 필드가 v4l2_subdev_format에 추가됐다.\n\nHAL3 request 경로는 그대로다.';
  assert.deepEqual(lintBodyMarkdown(body), []);
});

test('lintBodyMarkdown reports too few paragraphs for a single-paragraph body', () => {
  const issues = lintBodyMarkdown('문단 하나뿐이다.');
  const issue = issues.find(item => item.type === 'insufficient_public_body_paragraphs');
  assert.equal(issue.actualCount, 1);
  assert.equal(issue.expectedMinCount, BODY_MARKDOWN_MIN_PARAGRAPHS);
  assert.equal(issue.key, 'body_markdown');
});

test('lintBodyMarkdown reports zero paragraphs for an empty body', () => {
  const issues = lintBodyMarkdown('');
  assert.deepEqual(issueTypes(issues), ['insufficient_public_body_paragraphs']);
  assert.equal(issues[0].actualCount, 0);
});

test('lintBodyMarkdown reports a dangling subheading with no paragraph after it', () => {
  const body = '첫 문단이다.\n\n둘째 문단이다.\n\n### 마지막 소제목';
  const issues = lintBodyMarkdown(body);
  const issue = issues.find(item => item.type === 'body_markdown_dangling_subheading');
  assert.equal(issue.blockIndex, 2);
  assert.equal(issue.subheading, '마지막 소제목');
});

test('lintBodyMarkdown reports a subheading immediately followed by another subheading', () => {
  const body = '### 첫 소제목\n\n### 둘째 소제목\n\n본문 문단이다.\n\n또 다른 문단이다.';
  const issues = lintBodyMarkdown(body);
  const dangling = issues.filter(item => item.type === 'body_markdown_dangling_subheading');
  assert.equal(dangling.length, 1);
  assert.equal(dangling[0].blockIndex, 0);
});

test('lintBodyMarkdown reports an exact duplicate paragraph block', () => {
  const line = 'libcamera가 CAMSS 파이프라인 핸들러를 병합했다.';
  const issues = lintBodyMarkdown(`${line}\n\n중간 문단이다.\n\n${line}`);
  const issue = issues.find(item => item.type === 'body_markdown_duplicate_block');
  assert.equal(issue.blockIndex, 2);
  assert.equal(issue.duplicateOfBlockIndex, 0);
});

test('lintBodyMarkdown reports a near-exact duplicate differing only in punctuation and spacing', () => {
  const body = [
    'libcamera가 CAMSS 파이프라인 핸들러를 병합했다.',
    '',
    '중간 문단이다.',
    '',
    'libcamera가 CAMSS 파이프라인 핸들러를 병합했다!!'
  ].join('\n');
  const issues = lintBodyMarkdown(body);
  assert.ok(issues.some(item => item.type === 'body_markdown_duplicate_block'));
});

test('lintBodyMarkdown allows a reworded echo of an earlier block', () => {
  const body = [
    '센서 드라이버 하나가 조용히 바뀌었다.',
    '',
    'CAMSS 파이프라인 핸들러가 IPA 모듈 경계를 다시 그었다.',
    '',
    '그 조용한 변경이 결국 튜닝 일정을 흔든다.'
  ].join('\n');
  assert.deepEqual(lintBodyMarkdown(body), []);
});

test('lintBodyMarkdown reports a duplicate subheading block', () => {
  const body = [
    '### 배선 순서',
    '',
    '첫 문단이다.',
    '',
    '### 배선 순서',
    '',
    '둘째 문단이다.'
  ].join('\n');
  const issue = lintBodyMarkdown(body).find(item => item.type === 'body_markdown_duplicate_block');
  assert.equal(issue.blockIndex, 2);
  assert.equal(issue.duplicateOfBlockIndex, 0);
});

test('lintBodyMarkdown rejects the v1 fixed perspective label as a subheading', () => {
  const body = '첫 문단이다.\n\n### Camera HAL/Driver 관점에서의 의미\n\n둘째 문단이다.';
  const issues = lintBodyMarkdown(body);
  const issue = issues.find(item => item.type === 'body_markdown_reserved_subheading');
  assert.equal(issue.subheading, 'Camera HAL/Driver 관점에서의 의미');
  assert.equal(issue.blockIndex, 1);
});

test('lintBodyMarkdown reports the deny-list rule that matched, not the input text', () => {
  const [issue] = lintBodyMarkdown('첫 문단이다.\n\n### 왜 중요한가\n\n둘째 문단이다.');
  assert.equal(issue.type, 'body_markdown_reserved_subheading');
  assert.equal(issue.subheading, '왜 중요한가');
  assert.ok(RESERVED_SUBHEADING_TERMS.includes(issue.reserved));
});

test('lintBodyMarkdown rejects perspective-style and internal-key subheadings', () => {
  const reserved = [
    'Camera HAL · Driver 관점',
    'Camera HAL의 관점',
    '드라이버 관점에서의 의미',
    'editorial_story',
    '왜 중요한가',
    'Impact: 파이프라인',
    '출처'
  ];
  for (const subheading of reserved) {
    const issues = lintBodyMarkdown(`첫 문단이다.\n\n### ${subheading}\n\n둘째 문단이다.`);
    assert.ok(
      issues.some(item => item.type === 'body_markdown_reserved_subheading'),
      `expected reserved subheading issue for ${subheading}`
    );
  }
});

test('lintBodyMarkdown allows an article-specific subheading that merely mentions impact', () => {
  const body = '첫 문단이다.\n\n### 센서 드라이버가 받는 영향\n\n둘째 문단이다.';
  assert.deepEqual(lintBodyMarkdown(body), []);
});

// T9에서 프롬프트가 이 상수를 import하면, 그때 "프롬프트 문구가 상수에서 파생된다"는
// 계약 테스트로 올린다. 지금은 소비자가 없으므로 export 형태만 잠근다.
test('reserved subheading constants stay frozen and carry the v1 fixed labels', () => {
  assert.ok(RESERVED_SUBHEADING_TERMS.includes('Camera HAL/Driver 관점에서의 의미'));
  assert.ok(RESERVED_SUBHEADING_TERMS.includes('Camera HAL · Driver 관점'));
  assert.ok(Object.isFrozen(RESERVED_SUBHEADING_TERMS));
  assert.ok(Object.isFrozen(RESERVED_SUBHEADING_PATTERNS));
});

test('bodyMarkdownMetrics reports subheading presence as an advisory signal', () => {
  assert.deepEqual(bodyMarkdownMetrics(VALID_BODY), {
    paragraphCount: 3,
    subheadingCount: 1,
    hasSubheading: true
  });
  assert.deepEqual(bodyMarkdownMetrics('첫 문단이다.\n\n둘째 문단이다.'), {
    paragraphCount: 2,
    subheadingCount: 0,
    hasSubheading: false
  });
});

test('bodyMarkdownMetrics paragraph count matches the lint paragraph count', () => {
  const body = '문단 하나뿐이다.\n\n### 소제목';
  const issue = lintBodyMarkdown(body)
    .find(item => item.type === 'insufficient_public_body_paragraphs');
  assert.equal(bodyMarkdownMetrics(body).paragraphCount, issue.actualCount);
});
