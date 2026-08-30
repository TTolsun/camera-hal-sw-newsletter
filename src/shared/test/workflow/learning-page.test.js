const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { mediaBlock, selectorGroupBlock, assertCssDeclaration } = require('../helpers/css-blocks');

const root = path.join(__dirname, '..', '..', '..', '..');

// AI Engineering Lab 페이지는 styles.css 밖에 자기 stylesheet 를 하나 더 갖는 유일한 공개
// 페이지다. 여기 규칙은 다른 페이지의 CSS 잠금이 읽지 않으므로 자기 계약은 스스로 잠근다.

function readLearningStylesheet() {
  return fs.readFileSync(path.join(root, 'articles', 'css', 'learning.css'), 'utf8');
}

// grid-template-columns 값을 트랙 단위로 쪼갠다. 괄호 깊이를 세므로 minmax(0, 1fr) 은 통째로
// 한 트랙이고, repeat(N, …) 은 개수를 떼고 안쪽 트랙 목록을 다시 쪼갠다. 값 전체를 한 덩어리로
// 보면 `minmax(0, 1fr) 1fr` 처럼 맨 fr 이 섞인 선언을 놓친다.
function gridTracks(value) {
  const tokens = [];
  let depth = 0;
  let current = '';
  for (const char of String(value)) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (depth === 0 && /[\s,]/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);

  return tokens.flatMap(token => {
    const repeat = token.match(/^repeat\((.*)\)$/i);
    if (!repeat) return [token];
    return gridTracks(repeat[1].replace(/^[^,]*,/, ''));
  });
}

// 이 페이지의 유연 트랙은 minmax(0, …) 로만 쓴다. `1fr` 은 `minmax(auto, 1fr)` 이라 트랙이
// 내용의 최소 폭 아래로 줄지 않는데, 이 카드들 안에는 그 최소 폭이 휴대폰 화면보다 넓은 것들이
// 있어서(.scoreboard 의 min-width:720px 표, white-space:pre 인 .artifact-tree) 트랙이 화면
// 밖으로 밀리고 페이지 전체가 가로로 스크롤된다.
//
// 0 이 아닌 하한(예: minmax(220px, 1fr))도 막는다. 그런 하한이 안전한지는 그 안에 무엇이
// 들어가느냐에 달렸고, 여기 카드 내용은 계속 늘어난다 — 폭마다 재보는 대신 바닥을 0 으로
// 통일한다. 정말 하한이 필요하면 이 규칙을 먼저 고치고 근거를 남긴다.
function isBlowoutTrack(track) {
  if (/^minmax\(/i.test(track)) return !/^minmax\(\s*0\s*,/i.test(track);
  return /^\d*\.?\d*fr$/i.test(track);
}

test('learning page writes every flexible grid track as minmax(0, ...)', () => {
  const css = readLearningStylesheet();
  const declarations = [...css.matchAll(/grid-template-columns:\s*([^;]+);/g)].map(match => match[1].trim());
  assert.ok(declarations.length > 0, 'learning.css should define grid tracks');

  const blowouts = declarations.filter(value => gridTracks(value).some(isBlowoutTrack));
  assert.deepEqual(
    blowouts,
    [],
    'fr 트랙은 minmax(0, …) 로 감싼다 — 그렇지 않으면 좁은 화면에서 카드가 뷰포트를 넘긴다'
  );
});

test('learning page narrow-screen overrides collapse the card grids to one column', () => {
  const narrow = mediaBlock(readLearningStylesheet(), '(max-width: 780px)');

  // 카드 그리드 4종은 좁은 화면에서 한 열로 접는다. 하나라도 빠지면 그 그리드만 화면을 넘긴다.
  // .loop-flow 는 여기 없다 — 단계 흐름이라 3열을 유지하는 것이 의도다.
  for (const selector of ['.learning-grid', '.source-grid', '.week-columns', '.week-card']) {
    assertCssDeclaration(selectorGroupBlock(narrow, selector), 'grid-template-columns', 'minmax(0, 1fr)');
  }
});

// ---- 가로 스크롤 컨테이너의 키보드 도달성 (#1009) ----

function readLearningPage() {
  return fs.readFileSync(path.join(root, 'articles', 'learning', 'ai-engineering', 'index.html'), 'utf8');
}

// 이 페이지가 읽는 두 stylesheet 에서 가로 스크롤을 켜는 셀렉터를 **전부** 모은다. class 하나짜리만
// 모으면 `.week-result table` 같은 복합 셀렉터와 공용 시트의 `pre` 가 조용히 빠져나가, "모든 스크롤
// 컨테이너를 분류한다"는 잠금이 실제로 지키는 것보다 넓게 주장하게 된다.
// @media 여는 줄만 걷어내면 두 파일 다 한 겹이라 규칙 경계가 정확히 잡힌다.
// 숏핸드 `overflow` 도 가로 스크롤을 켠다. 롱핸드만 보면 잡히고 안 잡히는 경계가
// "스크롤 컨테이너인가" 가 아니라 "어떤 속성 이름으로 썼는가" 가 된다.
const SCROLLS_HORIZONTALLY = /(?:^|[\s;{])overflow(?:-x|-inline)?:\s*(?:auto|scroll)/;

function scrollContainerSelectors(sheets) {
  const selectors = new Set();
  for (const css of sheets) {
    const flat = String(css).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
    for (const rule of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!SCROLLS_HORIZONTALLY.test(rule[2])) continue;
      for (const part of rule[1].split(',')) {
        const selector = part.trim();
        if (selector) selectors.add(selector);
      }
    }
  }
  return selectors;
}

// class 속성을 낱말 단위로 비교한다. 정규식으로 class 이름을 이어 붙이면 부분 문자열까지
// 걸리거나 이스케이프가 어긋나기 쉬워서, 여는 태그를 뽑은 뒤 속성만 따로 본다.
function openingTagsWithClass(html, className) {
  return [...String(html).matchAll(/<[a-z][a-z0-9]*[^>]*>/gi)]
    .map(match => match[0])
    .filter(tag => {
      const attribute = tag.match(/\sclass="([^"]*)"/);
      return Boolean(attribute) && attribute[1].split(/\s+/).includes(className);
    });
}

// .week-result 블록마다 첫 <table> 이 그 블록의 결과 표다. 여는 div 로 자른 뒤 첫 표만 본다.
function weekResultTableTags(html) {
  return String(html).split('<div class="week-result">').slice(1)
    .map(section => (section.match(/<table[^>]*>/) || [])[0])
    .filter(Boolean);
}

// 초점 가능한 자식이 없는 스크롤 컨테이너는 키보드로 스크롤할 방법이 없다(WCAG 2.1.1).
// 각 항목은 stylesheet 에 쓴 셀렉터와, 그 셀렉터가 HTML 에서 무엇을 가리키는지 짝지어 둔다.
const KEYBOARD_SCROLLABLE = [
  { selector: '.scoreboard', tags: html => openingTagsWithClass(html, 'scoreboard') },
  { selector: '.artifact-tree', tags: html => openingTagsWithClass(html, 'artifact-tree') },
  { selector: '.code-block-light', tags: html => openingTagsWithClass(html, 'code-block-light') },
  // 320px 에서 13px 을 감춘다(실측). 375px 이상만 재고 "안 넘친다" 고 면제했다가 놓쳤던 자리다 —
  // WCAG 1.4.10 Reflow 가 하한으로 잡는 폭은 375px 이 아니라 320px 이다.
  { selector: '.week-result table', tags: weekResultTableTags }
];

// 면제는 사유를 문자열로 적지 않는다. 사유가 참인지를 이 테스트가 직접 확인한다.
const EXEMPT_SCROLL_SELECTORS = ['.learning-nav-inner', 'pre'];

test('learning page classifies every scroll container as keyboard-reachable or exempt', () => {
  const sheets = [readLearningStylesheet(), fs.readFileSync(path.join(root, 'articles', 'css', 'styles.css'), 'utf8')];
  const found = [...scrollContainerSelectors(sheets)].sort();
  const classified = [...KEYBOARD_SCROLLABLE.map(entry => entry.selector), ...EXEMPT_SCROLL_SELECTORS].sort();
  assert.deepEqual(
    found,
    classified,
    '새 가로 스크롤 컨테이너는 KEYBOARD_SCROLLABLE 이나 EXEMPT_SCROLL_SELECTORS 중 하나로 분류한다'
  );
});

test('learning page gives every keyboard-scrollable container a tab stop', () => {
  const html = readLearningPage();
  for (const { selector, tags } of KEYBOARD_SCROLLABLE) {
    const openings = tags(html);
    assert.ok(openings.length > 0, `${selector} should appear in the learning page`);
    const missing = openings.filter(tag => !/\stabindex="0"/.test(tag));
    assert.deepEqual(missing, [], `${selector} 요소는 전부 tabindex="0" 을 가져야 한다`);
  }
});

// 면제 사유를 실제로 검사한다. 사유가 거짓이 되면(링크가 사라지거나 <pre> 가 생기면) 실패한다.
test('learning page still earns each scroll container exemption', () => {
  const html = readLearningPage();
  // .learning-nav-inner: 안의 링크가 초점을 받고, 링크로 탭하면 브라우저가 스트립을 스크롤한다.
  const nav = html.match(/<div class="learning-shell learning-nav-inner">([\s\S]*?)<\/div>/);
  assert.ok(nav, '.learning-nav-inner should exist');
  assert.match(nav[1], /<a\s+href=/, '.learning-nav-inner 면제 근거는 초점 가능한 자식이다');
  // pre: 이 페이지에 없다. 생기면 KEYBOARD_SCROLLABLE 로 옮겨야 한다.
  assert.doesNotMatch(html, /<pre[\s>]/, 'pre 면제 근거는 이 페이지에 <pre> 가 없다는 것이다');
});

test('learning page names each scoreboard region it exposes as a landmark', () => {
  const scoreboards = openingTagsWithClass(readLearningPage(), 'scoreboard');
  assert.equal(scoreboards.length, 4);
  // landmark 로 노출하는 이상 이름이 있어야 목록에서 서로 구별된다. 이름 없는 region 은
  // 스크린리더 landmark 목록에 "region" 네 줄로만 뜬다.
  for (const tag of scoreboards) {
    assert.match(tag, /role="region"/);
    assert.match(tag, /aria-label="[^"]+"/);
  }
  const labels = scoreboards.map(tag => tag.match(/aria-label="([^"]+)"/)[1]);
  assert.equal(new Set(labels).size, labels.length, 'scoreboard 라벨은 서로 달라야 한다');
});

// 코드·트리 블록은 이름은 갖되 landmark 는 아니다. role="group" 은 landmark 가 아니라서
// 9개를 이름 붙여도 landmark 목록이 코드 블록으로 덮이지 않는다. role 없이 aria-label 만 두면
// generic div 의 이름은 AT 가 신뢰성 있게 노출하지 않으므로 role 은 있어야 한다.
test('learning page names code and tree blocks without making them landmarks', () => {
  const html = readLearningPage();
  for (const className of ['artifact-tree', 'code-block-light']) {
    const tags = openingTagsWithClass(html, className);
    assert.ok(tags.length > 0, `${className} should appear in the learning page`);
    for (const tag of tags) {
      assert.match(tag, /role="group"/, `${className} 은 이름을 갖는 group 이다`);
      assert.match(tag, /aria-label="[^"]+"/, `${className} 에는 이름이 있어야 한다`);
      assert.doesNotMatch(tag, /role="region"/, `${className} 은 landmark 가 아니다`);
    }
  }
});

// Tab 초점은 브라우저가 요소를 화면 안으로 굴려 넣는데, 이 페이지는 sticky 가 2단이라 여백이
// 없으면 요소 상단이 그 밑에 깔린다. 값의 근거는 learning.css 주석에 실측으로 적혀 있다.
test('learning page keeps focus targets clear of the two-tier sticky header', () => {
  const css = readLearningStylesheet();
  for (const selector of ['.scoreboard', '.artifact-tree', '.code-block-light']) {
    assertCssDeclaration(selectorGroupBlock(css, selector), 'scroll-margin-top', '124px');
    assertCssDeclaration(
      selectorGroupBlock(mediaBlock(css, '(max-width: 780px)'), selector),
      'scroll-margin-top',
      '185px'
    );
  }
});
