// Story Contract v2 공개 기사 본문(body_markdown)의 정규화·파싱·lint 책임 모듈.
//
// v2는 본문을 문단 배열(body_paragraphs)이 아니라 단일 markdown 문자열로 받는다.
// LLM이 서사 리듬과 기사별 소제목을 자유롭게 쓰되, 허용 문법은 allow-list로 좁힌다:
// `### ` 소제목 줄과 평문 문단 줄만 통과하고 나머지 markdown 구문은 전부 lint 실패다.
// deny-list가 아니라 allow-list라서, 여기 나열하지 않은 새 구문도 자동으로 막힌다.
//
// 정규화는 v1 경로(compactText/normalizeStringArray)를 절대 타지 않는다.
// compactText는 개행을 지워 문단 경계를 파괴하고, normalizeStringArray의 lowercase
// dedupe는 같은 문구의 소제목을 무음으로 drop한다. 둘 다 v2에서는 사실 왜곡이다.
//
// parseBodyBlocks 하나가 lint·렌더·문단 수 게이트·repair 블록 주소의 단일 정본이다.
// 범용 markdown 파서가 아니라 blank-line 분할 + `### ` 판별만 하는 결정론 함수다.

const SUBHEADING_PREFIX = '### ';
const BODY_MARKDOWN_MIN_PARAGRAPHS = 2;

// 소제목 deny-list. 프롬프트도 이 상수를 import해서 같은 정본을 쓴다.
// 완전 일치(구두점/공백/대소문자 무시)만 막는다. 부분 문자열로 막으면
// "센서 드라이버가 받는 영향" 같은 기사별 구체 소제목까지 잡히기 때문이다.
const RESERVED_SUBHEADING_TERMS = Object.freeze([
  // v1 고정 라벨
  'Camera HAL/Driver 관점에서의 의미',
  'Camera HAL · Driver 관점',
  'Camera HAL/Driver 관점',
  // v1 프롬프트가 쓰던 슬롯 라벨
  '현업 장면',
  '확인된 변화',
  '왜 봐야 하나',
  '왜 중요한가',
  '디버깅/리뷰 시나리오',
  '편집자 판단',
  '과장 금지',
  // 내부 키 어휘
  'editorial_story',
  'reader_scenario',
  'what_happened',
  'why_it_matters',
  'field_scenario',
  'not_to_overclaim',
  'editor_take',
  'camera_hal_takeaway',
  'decision_metadata',
  'reader_checkpoints',
  'source_subtitle',
  'source_links',
  'body_markdown',
  'hal_signal_capsule',
  // 조회형·인벤토리형 라벨
  'Impact',
  'Layer',
  'Scope',
  'Summary',
  'Overview',
  'Background',
  'Takeaway',
  '요약',
  '개요',
  '배경',
  '정리',
  '결론',
  '출처',
  '참고자료'
]);

// 라벨 형태로 변형된 관점/분류 헤딩 계열.
const RESERVED_SUBHEADING_PATTERNS = Object.freeze([
  /관점에서의\s*의미/,
  /camera\s*hal[^가-힣]*관점/i,
  /^(impact|layer|scope)\s*[:：]/i
]);

// 완전/준완전 일치 비교용 키. 공백·구두점·기호를 지우고 소문자로 접는다.
function comparisonKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

const RESERVED_SUBHEADING_KEYS = new Set(RESERVED_SUBHEADING_TERMS.map(comparisonKey));

function normalizeBodyMarkdown(value) {
  if (typeof value !== 'string') return '';
  const lines = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim());
  const collapsed = [];
  for (const line of lines) {
    if (line === '' && collapsed[collapsed.length - 1] === '') continue;
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[0] === '') collapsed.shift();
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') collapsed.pop();
  return collapsed.join('\n');
}

// 소제목 줄은 그 자체가 블록이고, 그 사이의 비어 있지 않은 줄들이 한 문단이다.
// 소제목 뒤에 빈 줄 없이 본문이 붙어도 두 블록으로 갈라진다.
function parseBodyBlocks(value) {
  const blocks = [];
  let paragraphLines = [];
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' '), blockIndex: blocks.length });
    paragraphLines = [];
  };
  for (const line of normalizeBodyMarkdown(value).split('\n')) {
    if (line === '') {
      flushParagraph();
      continue;
    }
    if (line.startsWith(SUBHEADING_PREFIX)) {
      flushParagraph();
      blocks.push({
        type: 'subheading',
        text: line.slice(SUBHEADING_PREFIX.length).trim(),
        blockIndex: blocks.length
      });
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();
  return blocks;
}

function bodyMarkdownMetrics(value) {
  const blocks = parseBodyBlocks(value);
  const subheadingCount = blocks.filter(block => block.type === 'subheading').length;
  return {
    blockCount: blocks.length,
    paragraphCount: blocks.length - subheadingCount,
    subheadingCount,
    // 소제목 유무는 advisory 신호일 뿐이다. hard 강제하면 "모든 기사에 소제목"이라는
    // 새 고정 템플릿이 생겨 v1과 같은 문제로 돌아간다.
    hasSubheading: subheadingCount > 0
  };
}

const BLOCK_CONSTRUCTS = Object.freeze([
  { construct: 'setext_heading', pattern: /^=+$/ },
  { construct: 'horizontal_rule', pattern: /^([-*_])( ?\1){2,}$/ },
  { construct: 'code_fence', pattern: /^(```|~~~)/ },
  { construct: 'blockquote', pattern: /^>/ },
  { construct: 'list_marker', pattern: /^[-*+]\s/ },
  { construct: 'ordered_list_marker', pattern: /^\d+[.)]\s/ },
  { construct: 'table', pattern: /^\|/ }
]);

const INLINE_CONSTRUCTS = Object.freeze([
  { construct: 'image', pattern: /!\[/ },
  { construct: 'link', pattern: /\[[^\]]*\]\s*[([]/ },
  { construct: 'inline_code', pattern: /`/ },
  { construct: 'raw_html', pattern: /<\/?[A-Za-z][^>]*>/ },
  { construct: 'strikethrough', pattern: /~~/ },
  // `*`는 강조·목록 어디에도 필요 없다. `_`는 __u32, v4l2_subdev 같은 식별자에 쓰이므로 건드리지 않는다.
  { construct: 'emphasis_marker', pattern: /\*/ }
]);

function firstMatchingConstruct(text, constructs) {
  for (const { construct, pattern } of constructs) {
    if (pattern.test(text)) return construct;
  }
  return '';
}

function bodyMarkdownIssue(type, detail) {
  return { type, key: 'body_markdown', ...detail };
}

// 줄 하나가 allow-list(`### ` 소제목 / 평문 문단)를 지키는지 본다.
function lintLine(line, lineNumber) {
  const heading = /^(#+)\s*(.*)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    if (level !== 3) {
      return bodyMarkdownIssue('body_markdown_forbidden_heading_level', { line: lineNumber, level });
    }
    if (!line.startsWith(SUBHEADING_PREFIX) || heading[2] === '') {
      return bodyMarkdownIssue('body_markdown_forbidden_construct', {
        line: lineNumber,
        construct: 'malformed_subheading'
      });
    }
    const headingConstruct = firstMatchingConstruct(heading[2], INLINE_CONSTRUCTS);
    if (headingConstruct) {
      return bodyMarkdownIssue('body_markdown_forbidden_construct', {
        line: lineNumber,
        construct: headingConstruct
      });
    }
    return null;
  }
  const construct = firstMatchingConstruct(line, BLOCK_CONSTRUCTS)
    || firstMatchingConstruct(line, INLINE_CONSTRUCTS);
  if (construct) {
    return bodyMarkdownIssue('body_markdown_forbidden_construct', { line: lineNumber, construct });
  }
  return null;
}

function reservedSubheadingMatch(subheading) {
  if (RESERVED_SUBHEADING_KEYS.has(comparisonKey(subheading))) return subheading;
  const pattern = RESERVED_SUBHEADING_PATTERNS.find(item => item.test(subheading));
  return pattern ? pattern.source : '';
}

function lintBodyMarkdown(value) {
  const issues = [];
  const normalized = normalizeBodyMarkdown(value);
  normalized.split('\n').forEach((line, index) => {
    if (line === '') return;
    const issue = lintLine(line, index + 1);
    if (issue) issues.push(issue);
  });

  const blocks = parseBodyBlocks(normalized);
  const paragraphCount = blocks.filter(block => block.type === 'paragraph').length;
  if (paragraphCount < BODY_MARKDOWN_MIN_PARAGRAPHS) {
    issues.push(bodyMarkdownIssue('insufficient_public_body_paragraphs', {
      actualCount: paragraphCount,
      expectedMinCount: BODY_MARKDOWN_MIN_PARAGRAPHS
    }));
  }

  blocks.forEach((block, index) => {
    if (block.type !== 'subheading') return;
    const reserved = reservedSubheadingMatch(block.text);
    if (reserved) {
      issues.push(bodyMarkdownIssue('body_markdown_reserved_subheading', {
        blockIndex: block.blockIndex,
        subheading: block.text,
        reserved
      }));
    }
    // 소제목 바로 다음 블록이 문단이 아니면 빈 섹션이다.
    if (blocks[index + 1]?.type !== 'paragraph') {
      issues.push(bodyMarkdownIssue('body_markdown_dangling_subheading', {
        blockIndex: block.blockIndex,
        subheading: block.text
      }));
    }
  });

  // 완전/준완전 일치만 hard fail이다. 리드 훅을 본문 후반에서 다른 표현으로
  // 되받는 서사의 에코는 정당한 기법이므로 막지 않는다.
  const seenBlockKeys = new Map();
  for (const block of blocks) {
    const key = `${block.type}:${comparisonKey(block.text)}`;
    if (seenBlockKeys.has(key)) {
      issues.push(bodyMarkdownIssue('body_markdown_duplicate_block', {
        blockIndex: block.blockIndex,
        duplicateOfBlockIndex: seenBlockKeys.get(key)
      }));
      continue;
    }
    seenBlockKeys.set(key, block.blockIndex);
  }

  return issues;
}

module.exports = {
  BODY_MARKDOWN_MIN_PARAGRAPHS,
  RESERVED_SUBHEADING_PATTERNS,
  RESERVED_SUBHEADING_TERMS,
  SUBHEADING_PREFIX,
  bodyMarkdownMetrics,
  lintBodyMarkdown,
  normalizeBodyMarkdown,
  parseBodyBlocks
};
