// Story Contract v2 공개 기사 본문(body_markdown)의 정규화·파싱·lint 책임 모듈.
//
// v2는 본문을 문단 배열(body_paragraphs)이 아니라 단일 markdown 문자열로 받는다.
// LLM이 서사 리듬과 기사별 소제목을 자유롭게 쓰되, 허용 문법은 allow-list로 좁힌다:
// `### ` 소제목 줄과 평문 문단 줄만 통과한다. 이름 붙은 금지 패턴을 먼저 보고,
// 거기 걸리지 않아도 markdown 활성 문자(``` ` ``, `*`, `[`, `]`, `<`, `>`, `~`, `|`)가
// 남아 있으면 markdown_active_character로 거부한다. 이 마감 규칙이 있어야
// 참조형 링크 정의·각주처럼 열거하지 않은 구문도 자동으로 막힌다.
// `_`는 __u32, v4l2_subdev_format 같은 uAPI 식별자에 쓰이므로 허용한다.
//
// 정규화는 v1 경로(compactText/normalizeStringArray)를 절대 타지 않는다.
// compactText는 개행을 지워 문단 경계를 파괴하고, normalizeStringArray의 lowercase
// dedupe는 같은 문구의 소제목을 무음으로 drop한다. 둘 다 v2에서는 사실 왜곡이다.
//
// 호출 계약: 배선하는 쪽은 normalizeBodyMarkdown 결과를 public_article.body_markdown의
// 정본 값으로 저장해야 한다. 원본을 그대로 보관하면 lint가 본 문자열과 렌더되는
// 문자열이 달라져(들여쓰기 코드 블록 등) 게이트가 헛돈다. issue의 line 번호도
// 정규화 후 기준이다.
//
// parseBodyBlocks 하나가 v2 경로의 lint·렌더·문단 수 판정·repair 블록 주소의 단일
// 정본이다. 범용 markdown 파서가 아니라 blank-line 분할 + `### ` 판별만 하는 결정론
// 함수다. v1 body_paragraphs 게이트(public-article-contract.js)는 그대로 공존하며,
// 이 모듈이 배선되기 전까지 실제 발행을 막는 본문 게이트는 여전히 v1 쪽이다.

const SUBHEADING_PREFIX = '### ';
const BODY_MARKDOWN_MIN_PARAGRAPHS = 2;

// 소제목 deny-list. T9에서 프롬프트가 이 상수를 import해 같은 정본을 쓰도록 잇는다
// (현재는 newsletter-prompts.js가 같은 라벨을 리터럴로 들고 있다).
// 완전 일치(구두점/공백/대소문자 무시)만 막는다. 부분 문자열로 막으면
// "센서 드라이버가 받는 영향" 같은 기사별 구체 소제목까지 잡히기 때문이다.
const RESERVED_SUBHEADING_TERMS = Object.freeze([
  // v1 고정 라벨(md 라벨과 HTML 라벨). RESERVED_SUBHEADING_PATTERNS도 이 계열을 덮지만,
  // 프롬프트에 그대로 보여줄 문구라 사람이 읽는 형태로 남긴다.
  'Camera HAL/Driver 관점에서의 의미',
  'Camera HAL · Driver 관점',
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
// 한글 조사 하나만 끼어도 빠져나가지 않도록 문자 종류가 아니라 거리로 제한한다.
const RESERVED_SUBHEADING_PATTERNS = Object.freeze([
  /관점에서의\s*의미/,
  /camera\s*hal.{0,8}관점/i,
  /^(impact|layer|scope)\s*[:：]/i
]);

// 완전/준완전 일치 비교용 키. 공백·구두점·기호를 지우고 소문자로 접는다.
function comparisonKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

const RESERVED_SUBHEADING_KEYS = new Map(
  RESERVED_SUBHEADING_TERMS.map(term => [comparisonKey(term), term])
);

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

function countParagraphs(blocks) {
  return blocks.filter(block => block.type === 'paragraph').length;
}

function bodyMarkdownMetrics(value) {
  const blocks = parseBodyBlocks(value);
  const subheadingCount = blocks.filter(block => block.type === 'subheading').length;
  return {
    paragraphCount: countParagraphs(blocks),
    subheadingCount,
    // 소제목 유무는 advisory 신호일 뿐이다. hard 강제하면 "모든 기사에 소제목"이라는
    // 새 고정 템플릿이 생겨 v1과 같은 문제로 돌아간다.
    hasSubheading: subheadingCount > 0
  };
}

// 줄에 고정된 구문. 문단으로 합쳐지면 사라지지만 markdown 원문에서는 살아 있으므로
// 줄 단위로 본다.
const BLOCK_CONSTRUCTS = Object.freeze([
  { construct: 'setext_heading', pattern: /^=+$/ },
  { construct: 'horizontal_rule', pattern: /^([-*_])( ?\1){2,}$/ },
  { construct: 'code_fence', pattern: /^(```|~~~)/ },
  { construct: 'blockquote', pattern: /^>/ },
  { construct: 'list_marker', pattern: /^[-*+]\s/ },
  { construct: 'ordered_list_marker', pattern: /^\d+[.)]\s/ },
  { construct: 'table', pattern: /^\|/ }
]);

// 줄바꿈으로 쪼개도 markdown이 다시 이어 붙이는 구문. 줄이 아니라 블록 텍스트에서 본다.
const INLINE_CONSTRUCTS = Object.freeze([
  { construct: 'image', pattern: /!\[/ },
  { construct: 'link', pattern: /\[[^\]]*\]\s*[([]/ },
  { construct: 'link_reference', pattern: /\[[^\]]*\]\s*:/ },
  { construct: 'inline_code', pattern: /`/ },
  { construct: 'raw_html', pattern: /<\/?[A-Za-z][^>]*>/ },
  { construct: 'strikethrough', pattern: /~~/ },
  { construct: 'emphasis_marker', pattern: /\*/ },
  // allow-list 마감. 위에서 이름 붙이지 못한 markdown 활성 문자가 남아 있으면 거부한다.
  // `>`는 줄 중간에서는 아무 구조도 만들지 못하고(줄 시작 `>`는 blockquote 규칙이 잡는다),
  // raw HTML·autolink는 어차피 `<`가 있어야 성립하므로 제외한다. `10->8` 같은 실제
  // 카메라 산문 표기를 막지 않기 위해서다.
  { construct: 'markdown_active_character', pattern: /[`*[\]<~|]/ }
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

// 줄 하나가 `### ` 소제목 형식과 줄 고정 구문 금지를 지키는지 본다.
// 인라인 구문은 여기서 보지 않는다 — 블록 단위 검사가 담당한다.
function lintLine(line, lineNumber) {
  const hashRun = /^#+/.exec(line);
  if (hashRun) {
    const level = hashRun[0].length;
    const rest = line.slice(level);
    const malformed = bodyMarkdownIssue('body_markdown_forbidden_construct', {
      line: lineNumber,
      construct: 'malformed_subheading'
    });
    if (rest !== '' && !rest.startsWith(' ')) {
      // `#844 패치가 병합됐다`처럼 hash 하나에 문자가 바로 붙는 줄은 CommonMark heading이
      // 아니라 평문이다. hash가 2개 이상이면 소제목을 쓰려다 형식을 틀린 것으로 본다.
      if (level > 1) return malformed;
    } else if (level !== 3) {
      return bodyMarkdownIssue('body_markdown_forbidden_heading_level', { line: lineNumber, level });
    } else if (rest.trim() === '') {
      return malformed;
    } else {
      return null;
    }
  }
  const construct = firstMatchingConstruct(line, BLOCK_CONSTRUCTS);
  if (construct) {
    return bodyMarkdownIssue('body_markdown_forbidden_construct', { line: lineNumber, construct });
  }
  return null;
}

// 걸린 deny-list 항목을 돌려준다(입력 소제목이 아니라 규칙 쪽). 없으면 빈 문자열.
function reservedSubheadingRule(subheading) {
  const term = RESERVED_SUBHEADING_KEYS.get(comparisonKey(subheading));
  if (term) return term;
  const pattern = RESERVED_SUBHEADING_PATTERNS.find(item => item.test(subheading));
  return pattern ? pattern.source : '';
}

// surroundings = 같은 기사에서 본문 밖에 이미 발행되는 문장들(lead, camera_hal_takeaway).
// v1은 렌더 시점에 이것과 겹치는 문단을 조용히 버렸는데, v2는 정본 문자열을 그대로
// 렌더하므로(무음 변형 금지) 겹침을 여기서 잡아야 한다. 안 잡으면 같은 문단이 본문과
// 시그니처 박스에 두 번 발행된다.
function lintBodyMarkdown(value, surroundings = {}) {
  const issues = [];
  const normalized = normalizeBodyMarkdown(value);
  normalized.split('\n').forEach((line, index) => {
    if (line === '') return;
    const issue = lintLine(line, index + 1);
    if (issue) issues.push(issue);
  });

  const blocks = parseBodyBlocks(normalized);

  // 문단은 여러 줄이 공백으로 합쳐지므로, 줄바꿈으로 쪼갠 raw HTML·링크는 줄 단위
  // 검사를 빠져나가고 합쳐진 뒤에 되살아난다. 합쳐진 텍스트에서 다시 본다.
  // 줄 단위에서 이미 걸렸다면 구조가 깨진 상태라 전체 필드 repair 대상이므로,
  // 같은 위반을 블록 주소로 한 번 더 세지 않는다.
  if (issues.length === 0) {
    for (const block of blocks) {
      const construct = firstMatchingConstruct(block.text, INLINE_CONSTRUCTS);
      if (construct) {
        issues.push(bodyMarkdownIssue('body_markdown_forbidden_construct', {
          blockIndex: block.blockIndex,
          construct
        }));
      }
    }
  }

  const paragraphCount = countParagraphs(blocks);
  if (paragraphCount < BODY_MARKDOWN_MIN_PARAGRAPHS) {
    issues.push(bodyMarkdownIssue('insufficient_public_body_paragraphs', {
      actualCount: paragraphCount,
      expectedMinCount: BODY_MARKDOWN_MIN_PARAGRAPHS
    }));
  }

  blocks.forEach((block, index) => {
    if (block.type !== 'subheading') return;
    const reserved = reservedSubheadingRule(block.text);
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

  // 본문 밖 문장과의 교차 중복. 위 블록 간 비교와 같은 기준(comparisonKey)을 쓴다.
  const surroundingKeys = new Map();
  for (const field of ['lead', 'camera_hal_takeaway']) {
    const key = comparisonKey(surroundings[field]);
    if (key) surroundingKeys.set(key, field);
  }
  if (surroundingKeys.size > 0) {
    for (const block of blocks) {
      if (block.type !== 'paragraph') continue;
      const field = surroundingKeys.get(comparisonKey(block.text));
      if (!field) continue;
      issues.push(bodyMarkdownIssue('body_markdown_duplicates_public_field', {
        blockIndex: block.blockIndex,
        duplicateOfField: field
      }));
    }
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
