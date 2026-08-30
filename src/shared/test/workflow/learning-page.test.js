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

// learning.css 에서 가로 스크롤을 켜는 "단일 class 셀렉터" 를 모은다. 이 목록이 잠금의 입력이라,
// 새 스크롤 컨테이너를 만들면 아래 두 분류 중 하나에 넣을 때까지 테스트가 막는다.
// @media 여는 줄만 걷어내면 이 파일은 한 겹이라 규칙 경계가 정확히 잡힌다.
// (`.week-result table` 같은 복합 셀렉터는 여기 안 잡힌다 — 그 표는 width:100% 라 열이
//  min-content 로 줄어 375~780px 어디서도 실제로 스크롤되지 않는 것을 실측했다.)
function scrollContainerClasses(css) {
  const flat = String(css).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
  const classes = new Set();
  for (const rule of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/overflow-x:\s*(auto|scroll)/.test(rule[2])) continue;
    for (const part of rule[1].split(',')) {
      const simple = part.trim().match(/^\.([A-Za-z0-9_-]+)$/);
      if (simple) classes.add(simple[1]);
    }
  }
  return classes;
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

// 초점 가능한 자식이 없는 스크롤 컨테이너는 키보드로 스크롤할 방법이 없다(WCAG 2.1.1).
const KEYBOARD_SCROLLABLE = ['scoreboard', 'artifact-tree', 'code-block-light'];
// 목차 nav 는 예외다. 안의 링크가 이미 초점을 받고, 링크로 탭하면 브라우저가 컨테이너를
// 스크롤해 준다. 여기에 tabindex 를 주면 아무것도 못 하는 탭 정거장만 하나 늘어난다.
const FOCUSABLE_CHILDREN_EXEMPT = ['learning-nav-inner'];

test('learning page classifies every scroll container as keyboard-reachable or exempt', () => {
  const found = [...scrollContainerClasses(readLearningStylesheet())].sort();
  const classified = [...KEYBOARD_SCROLLABLE, ...FOCUSABLE_CHILDREN_EXEMPT].sort();
  assert.deepEqual(
    found,
    classified,
    '새 가로 스크롤 컨테이너는 KEYBOARD_SCROLLABLE 이나 FOCUSABLE_CHILDREN_EXEMPT 중 하나로 분류한다'
  );
});

test('learning page gives every keyboard-scrollable container a tab stop', () => {
  const html = readLearningPage();
  for (const className of KEYBOARD_SCROLLABLE) {
    const openings = openingTagsWithClass(html, className);
    assert.ok(openings.length > 0, `${className} should appear in the learning page`);
    const missing = openings.filter(tag => !/\stabindex="0"/.test(tag));
    assert.deepEqual(missing, [], `${className} 요소는 전부 tabindex="0" 을 가져야 한다`);
  }
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

// 코드·트리 블록에는 이름을 주지 않는다. role 없는 generic div 의 aria-label 은 AT 가
// 신뢰성 있게 노출하지 않고, 9개를 전부 landmark 로 만들면 landmark 목록이 코드 블록으로
// 뒤덮인다. 초점을 받으면 스크린리더가 내용을 읽어 주므로 도달성은 확보된다.
test('learning page does not turn code and tree blocks into landmarks', () => {
  const html = readLearningPage();
  for (const className of ['artifact-tree', 'code-block-light']) {
    for (const tag of openingTagsWithClass(html, className)) {
      assert.doesNotMatch(tag, /role="/, `${className} 은 landmark 가 아니다`);
    }
  }
});

test('site stylesheet gives keyboard-focusable non-native elements the shared focus ring', () => {
  // tabindex 로만 초점을 받는 요소가 브라우저 기본 링을 쓰면 사이트 focus 신호가 두 종류가 된다.
  const css = fs.readFileSync(path.join(root, 'articles', 'css', 'styles.css'), 'utf8');
  const focusRule = css.match(/a:focus-visible,[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(focusRule, 'styles.css should keep the shared focus-visible rule');
  assert.match(css, /\[tabindex\]:focus-visible/);
  assert.match(focusRule[1], /outline:\s*3px solid var\(--focus-ring\)\s*;/);
});
