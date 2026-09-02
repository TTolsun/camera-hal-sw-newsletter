const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  stripMediaBlocks,
  mediaBlock,
  exactSelectorBlock,
  selectorGroupBlock,
  assertCssDeclaration
} = require('../helpers/css-blocks');
const { assertSharedNav, assertSharedFooterNav } = require('../helpers/site-nav');

const root = path.join(__dirname, '..', '..', '..', '..');

// AI Engineering Lab 페이지는 styles.css 밖에 자기 stylesheet 를 하나 더 갖는 유일한 공개
// 페이지다. 여기 규칙은 다른 페이지의 CSS 잠금이 읽지 않으므로 자기 계약은 스스로 잠근다.

function readLearningStylesheet() {
  return fs.readFileSync(path.join(root, 'articles', 'css', 'learning.css'), 'utf8');
}

function readSiteStylesheet() {
  return fs.readFileSync(path.join(root, 'articles', 'css', 'styles.css'), 'utf8');
}

function readLearningPage() {
  return fs.readFileSync(path.join(root, 'articles', 'learning', 'ai-engineering', 'index.html'), 'utf8');
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

// 나브 라벨은 페이지마다 다른 파일이 잠근다(어디가 어디를 맡는지는 DESIGN.md 「알려진 갭 / 후속」).
// Lab 페이지 몫이 비어 있어서 라벨이 영어로 돌아가도 아무도 못 잡았다 — 그 자리를 여기서 채운다.
test('learning page keeps the shared navigation labels and targets', () => {
  // 홈·아카이브와 같은 헬퍼를 쓴다 — 세 페이지의 나브 잠금이 한 형태여야 한 곳만 약해지지 않는다.
  // Lab 은 두 단계 아래라 사이트 루트 접두어가 '../../' 다.
  const html = readLearningPage();
  assertSharedNav(html, '../../');
  // 푸터도 같은 한 벌로 잠근다(#1022). 이 페이지에서만 「리소스」 컬럼의 AI Engineering Lab
  // 링크가 자기 자신을 가리키므로 세 번째 인자로 그 값을 넘긴다 — rootPath 로 유도되지 않는
  // 유일한 값이다.
  assertSharedFooterNav(html, '../../', 'index.html');
});

// ---- 가로 스크롤 컨테이너의 키보드 도달성 (#1009) ----

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
  const sheets = [readLearningStylesheet(), readSiteStylesheet()];
  const found = [...scrollContainerSelectors(sheets)].sort();
  const classified = [...KEYBOARD_SCROLLABLE.map(entry => entry.selector), ...EXEMPT_SCROLL_SELECTORS].sort();
  assert.deepEqual(
    found,
    classified,
    '새 가로 스크롤 컨테이너는 KEYBOARD_SCROLLABLE 이나 EXEMPT_SCROLL_SELECTORS 중 하나로 분류한다'
  );
});

test('learning page gives every keyboard-scrollable container a named tab stop', () => {
  const html = readLearningPage();
  const labels = [];
  for (const { selector, tags } of KEYBOARD_SCROLLABLE) {
    const openings = tags(html);
    assert.ok(openings.length > 0, `${selector} should appear in the learning page`);
    const missing = openings.filter(tag => !/\stabindex="0"/.test(tag));
    assert.deepEqual(missing, [], `${selector} 요소는 전부 tabindex="0" 을 가져야 한다`);
    // 이름 없는 초점 정거장은 스크린리더가 도착을 알리지 못한다. 새 탭 정거장이 이름 잠금을
    // 건너뛰지 못하도록 selector 별로 따로 두지 않고 같은 목록에서 돈다.
    const unnamed = openings.filter(tag => !/\saria-label="[^"]+"/.test(tag));
    assert.deepEqual(unnamed, [], `${selector} 요소는 전부 이름을 가져야 한다`);
    labels.push(...openings.map(tag => tag.match(/\saria-label="([^"]+)"/)[1]));
  }
  assert.equal(new Set(labels).size, labels.length, '초점 정거장 이름은 서로 달라야 한다');
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
      assert.doesNotMatch(tag, /role="region"/, `${className} 은 landmark 가 아니다`);
    }
  }
});

// 반대로 <table> 에는 role 을 주지 않는다. 암묵 role 이 이미 table 이라 무엇으로든 덮어쓰면
// 행·열 머리글과 셀의 연결이 통째로 사라진다(WCAG 1.3.1). aria-label 은 role 이 있는 요소라
// 그대로 이름으로 노출되므로 tabindex + aria-label 만으로 충분하다.
test('learning page keeps the result tables as tables', () => {
  for (const tag of weekResultTableTags(readLearningPage())) {
    assert.doesNotMatch(tag, /\srole="/, '<table> 의 암묵 role 을 덮어쓰지 않는다');
  }
});

// 폭 구간 하나에서 scroll-margin-top 을 주는 규칙을 찾아 셀렉터 집합과 px 값으로 돌려준다.
//
// 셀렉터로 규칙을 찾으면 `.week-result table` 처럼 다른 규칙에도 쓰이는 셀렉터가 엉뚱한 블록에
// 걸린다. 반대로 선언에서 출발한다. 이 페이지는 폭 구간마다 그런 규칙이 하나뿐이라, 둘 이상
// 나오면 실패한다 — 어느 것이 이기는지는 이 파서로 알 수 없어서 조용히 첫 규칙을 고르면 값이
// 틀린 채로 초록이 된다. 넓은 화면 규칙을 읽을 때는 scope 로 stripMediaBlocks() 결과를 넘긴다.
function scrollMarginRule(scope) {
  const flat = String(scope).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  for (const rule of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declaration = rule[2].match(/scroll-margin-top:\s*([^;]+);/);
    if (!declaration) continue;
    rules.push({
      selectors: new Set(rule[1].split(',').map(part => part.trim()).filter(Boolean)),
      value: declaration[1].trim()
    });
  }
  assert.equal(rules.length, 1, '한 폭 구간에서 scroll-margin-top 을 주는 규칙은 하나여야 한다');
  assert.match(rules[0].value, /^\d+(?:\.\d+)?px$/, `scroll-margin-top 은 px 값이어야 한다 — ${rules[0].value}`);
  return { selectors: rules[0].selectors, px: Number.parseFloat(rules[0].value) };
}

// Tab 초점은 브라우저가 요소를 화면 안으로 굴려 넣는데, 이 페이지는 sticky 가 2단이라 여백이
// 없으면 요소 상단이 그 밑에 깔린다.
test('learning page keeps focus targets clear of the two-tier sticky header', () => {
  const css = readLearningStylesheet();
  // 목록을 따로 적지 않고 KEYBOARD_SCROLLABLE 에서 돈다 — 탭 정거장을 하나 늘리면서 가림 방지를
  // 빠뜨리는 일이 없도록. 두 목록이 갈리면 새 항목만 보호 없이 남는다.
  const wide = scrollMarginRule(stripMediaBlocks(css));
  const narrow = scrollMarginRule(mediaBlock(css, '(max-width: 780px)'));
  for (const { selector } of KEYBOARD_SCROLLABLE) {
    assert.ok(wide.selectors.has(selector), `${selector} 는 넓은 화면 scroll-margin-top 을 받아야 한다`);
    assert.ok(narrow.selectors.has(selector), `${selector} 는 좁은 화면 scroll-margin-top 을 받아야 한다`);
  }
  // 좁은 화면 값만 리터럴로 잠근다. 그 값이 덮어야 하는 것은 두 줄로 접힌 헤더 높이인데, 접힌
  // 높이는 자식이 몇 줄로 흐르느냐로 정해져 CSS 선언에서 나오지 않는다(실측 133px). 넓은 화면
  // 값은 아래 밴드 테스트가 헤더 합에서 파생시키므로 여기서 리터럴로 잡지 않는다 (#1047).
  assert.equal(narrow.px, 185, '좁은 화면 scroll-margin-top 은 접힌 헤더(실측 133px)를 덮는 185px 이다');
});

// ---- 좁은 화면에서 목차 나브가 헤더 뒤로 들어가지 않는다 (#1023) ----

// 이 페이지의 sticky 는 넓은 화면에서만 2단이다 — .site-header(top:0, z-index:20) 아래에
// .learning-nav(top:59px, z-index:10). 좁은 화면에서는 .homepage-nav 가 column 으로 접히면서
// 헤더가 59px 에서 133px 로 커지는데, 그때도 나브를 sticky 로 두면 나브(59~101px)가 헤더
// (0~133px) 뒤로 통째로 들어가 목차가 보이지 않았다.
//
// 고른 해법은 그 폭에서 sticky 를 푸는 것이다. 나브 top 을 헤더 높이(133px)에 맞춰 헤더 아래에
// 쌓는 방법은 sticky 가 가리는 띠를 133px 에서 175px 로 키우는데, 그러면 밑에 깔리는 것이
// 목차만이 아니게 된다 — scroll-margin-top 이 없는 .source-card 가 완전히 가려지고(WCAG 2.4.11),
// 400% 확대에서 본문에 남는 높이가 줄어든다(WCAG 1.4.10). static 은 이 둘을 만들지 않는다.
// (목차 링크로 착지한 섹션 제목이 띠에 깔리는 것은 static 에서도 남는 기존 결함이다 —
// .learning-section 에 scroll-margin-top 이 없다. A 안은 그것을 더 나쁘게 할 뿐이었다.)
//
// 그래서 잠그는 것은 둘이다.
// - 폭: sticky 를 푸는 폭과 헤더가 접히는 폭이 같아야 한다. 갈리면 그 사이 구간에서 헤더는 두 줄인데
//   나브는 아직 sticky 라 원래 버그가 되살아난다.
// - 넓은 화면 top: 접히지 않은 헤더 높이와 같아야 한다. 리터럴로 두면 헤더의 min-height 가 바뀔 때
//   나브가 헤더에 파고들거나 둘 사이에 빈 띠가 생긴다.
// 접힌 헤더 높이(133px)는 이제 아무 값도 유도하지 않으므로 재지 않는다 — static 은 헤더가 얼마나
// 커지든 상관하지 않는다.
const HEADER_FOLD_QUERY = '(max-width: 640px)';

// 선언에서 px 수치를 뽑는다. 값이 여러 토큰인 숏핸드(`border-bottom: 1px solid …`)는 첫 토큰만
// 본다. 같은 속성이 여러 번 쓰였으면 뒤에 온 것이 이긴다(CSS 와 같다). px 이 아닌 값(`auto`,
// `var(…)`)이 들어오면 조용히 0 으로 세는 대신 실패한다.
function pxDeclaration(block, property) {
  const normalized = String(block).replace(/\s+/g, ' ');
  const found = [...normalized.matchAll(new RegExp(`(?:^|[;{ ])${property}\\s*:\\s*([^;]+);`, 'g'))];
  assert.ok(found.length > 0, `${property} 선언이 있어야 한다`);
  const value = found[found.length - 1][1].trim();
  const first = value.split(' ')[0];
  assert.match(first, /^\d+(?:\.\d+)?px$/, `${property} 의 첫 토큰은 px 값이어야 한다 — ${value}`);
  return Number.parseFloat(first);
}

// padding 숏핸드에서 위·아래 값을 읽는다. 토큰이 셋 이상이면 위와 아래가 서로 다를 수 있는데
// 이 값을 쓰는 계산은 둘이 같다고 전제하므로, 조용히 위쪽만 쓰는 대신 실패한다.
function verticalPadding(block) {
  const normalized = String(block).replace(/\s+/g, ' ');
  const found = [...normalized.matchAll(/(?:^|[;{ ])padding\s*:\s*([^;]+);/g)];
  assert.ok(found.length > 0, 'padding 선언이 있어야 한다');
  const tokens = found[found.length - 1][1].trim().split(' ');
  assert.ok(tokens.length <= 2, `padding 은 위·아래가 같은 형태여야 한다 — ${tokens.join(' ')}`);
  assert.match(tokens[0], /^\d+(?:\.\d+)?px$/, `padding 의 세로 값은 px 이어야 한다 — ${tokens[0]}`);
  return Number.parseFloat(tokens[0]);
}

// 접히지 않은 헤더 높이 = .homepage-nav 의 min-height + 헤더의 아래 테두리.
// 그 식은 min-height 가 헤더 높이를 지배한다는 전제 위에 있다. 자식이 그보다 커지면 헤더는
// min-height 와 무관하게 자라는데 min-height 는 그대로라, 파생값만 대조해서는 낡은 값을 못 잡는다
// (실측: 브랜드 min-height 만 80px 로 올리면 헤더가 81px 이 되어 641px 이상에서 나브 위 22px 이
// 헤더 뒤로 들어가는데 잠금은 초록이었다). 그래서 지배 관계 자체를 잠근다.
//
// 이 함수는 Lab 페이지 밖인 articles/css/styles.css 의 홈 헤더 기하(.homepage-nav·.homepage-brand)와
// 전역 토큰(:root --control-height)을 읽는다 — Lab 목차의 top 과 넓은 화면 scroll-margin-top 이
// 거기서 파생되기 때문이다.
function unfoldedHeaderHeight(styles) {
  const navMinHeight = pxDeclaration(exactSelectorBlock(styles, '.homepage-nav'), 'min-height');
  const tallestChild = Math.max(
    pxDeclaration(exactSelectorBlock(styles, '.homepage-brand'), 'min-height'),
    pxDeclaration(exactSelectorBlock(styles, ':root'), '--control-height')
  );
  assert.ok(
    navMinHeight >= tallestChild,
    `.homepage-nav 의 min-height(${navMinHeight}px)보다 큰 자식(${tallestChild}px)이 있다 — 헤더 높이를 더 이상 min-height 가 정하지 않으므로 이 계산이 성립하지 않는다`
  );
  return navMinHeight + pxDeclaration(exactSelectorBlock(styles, '.site-header'), 'border-bottom');
}

test('learning page drops the sticky table of contents where the header folds', () => {
  const styles = readSiteStylesheet();

  // 640px 의 근거는 이 한 줄이다 — 헤더가 한 줄에서 두 줄로 바뀌는 지점.
  assertCssDeclaration(exactSelectorBlock(mediaBlock(styles, HEADER_FOLD_QUERY), '.homepage-nav'), 'flex-direction', 'column');

  const unfolded = unfoldedHeaderHeight(styles);

  const css = readLearningStylesheet();
  const nav = exactSelectorBlock(css, '.learning-nav');
  // 넓은 화면: 헤더 바로 아래에 붙는다. top 은 리터럴이 아니라 위에서 계산한 높이와 비교하므로,
  // 헤더 min-height 가 바뀌면 learning.css 를 따라 고치지 않는 한 여기서 깨진다.
  assertCssDeclaration(nav, 'position', 'sticky');
  assertCssDeclaration(nav, 'top', `${unfolded}px`);
  // 좁은 화면: sticky 를 풀어 문서 흐름에 둔다. 가릴 것이 없으므로 헤더 높이와 무관해진다.
  assertCssDeclaration(
    exactSelectorBlock(mediaBlock(css, HEADER_FOLD_QUERY), '.learning-nav'),
    'position',
    'static'
  );
});

// ---- 목차 링크로 착지한 섹션이 sticky 밑에 깔리지 않는다 (#1046) ----

// 목차가 어디로 착지시키는지는 HTML 이 정하므로 id 목록을 여기 적지 않고 읽는다. 링크가 늘거나
// 가리키는 대상이 바뀌면 이 잠금이 새 대상까지 따라간다.
function tableOfContentsTargets(html) {
  const nav = String(html).match(/<div class="learning-shell learning-nav-inner">([\s\S]*?)<\/div>/);
  assert.ok(nav, '.learning-nav-inner should exist');
  const ids = [...nav[1].matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 0, '목차에는 페이지 안 앵커 링크가 있어야 한다');
  return ids;
}

// 그 id 를 가진 여는 태그의 class 목록. class 가 없으면 빈 배열이다.
function classesOfElementWithId(html, id) {
  const tag = [...String(html).matchAll(/<[a-z][a-z0-9]*[^>]*>/gi)]
    .map(match => match[0])
    .find(candidate => (candidate.match(/\sid="([^"]*)"/) || [])[1] === id);
  assert.ok(tag, `#${id} 를 가진 요소가 있어야 한다`);
  const attribute = tag.match(/\sclass="([^"]*)"/);
  return attribute ? attribute[1].split(/\s+/).filter(Boolean) : [];
}

// 브라우저는 앵커 대상의 위쪽을 뷰포트 y=0 에 맞추므로, scroll-margin-top 이 없으면 착지한
// 섹션의 제목이 sticky 띠 밑으로 통째로 들어간다(실측 390px, #curriculum: h2 가 79.8~114.3 으로
// 133px 띠 안에 들어갔다). 초점 대상과 같은 여백을 착지 대상에도 준다.
test('learning page gives every table-of-contents landing target a scroll margin', () => {
  const html = readLearningPage();
  const css = readLearningStylesheet();
  const wide = scrollMarginRule(stripMediaBlocks(css));
  const narrow = scrollMarginRule(mediaBlock(css, '(max-width: 780px)'));

  for (const id of tableOfContentsTargets(html)) {
    const classes = classesOfElementWithId(html, id);
    // 착지 요소의 class 중 하나가 scroll-margin-top 규칙의 셀렉터로 적혀 있어야 한다. class 하나
    // 짜리 셀렉터만 알아본다 — 이 페이지는 그 형태로만 여백을 주고, 그보다 넓게 읽으려면 이 파서가
    // CSS 셀렉터 엔진이 되어야 한다. 다른 형태로 여백을 주면 이 잠금은 (통과가 아니라) 실패한다.
    const receives = selectors => classes.some(name => selectors.has(`.${name}`));
    const seen = classes.join(' ') || '(class 없음)';
    assert.ok(receives(wide.selectors), `#${id} 착지 요소는 넓은 화면 scroll-margin-top 을 받아야 한다 — ${seen}`);
    assert.ok(receives(narrow.selectors), `#${id} 착지 요소는 좁은 화면 scroll-margin-top 을 받아야 한다 — ${seen}`);
  }
});

// ---- 넓은 화면 scroll-margin-top 을 헤더 합에서 파생시킨다 (#1047) ----

// 리터럴로 두면 규정대로 잠금을 지켜도 빠져나간다. 헤더의 min-height 를 올리면 #1023 잠금이
// .learning-nav 의 top 을 따라 고치도록 강제하지만, 그렇게 커진 띠가 scroll-margin-top 을 넘어도
// 잡는 검사가 없었다. 그래서 값을 리터럴로 대조하지 않고 띠를 계산해 하한으로만 본다.
//
// 하한인 이유는 과다 제공이 무해해서가 아니다 — 과다 제공은 요소를 아래로 굴리는 대신 뷰포트
// 높이를 쓴다. 320x256 에서 좁은 화면 값 185px 은 착지한 제목을 화면 아래로 통째로 밀어낸다
// (실측표는 learning.css 의 좁은 화면 블록 주석에 있다. 손익분기 약 140px). 이 테스트가 상한을
// 정하지 않는 것은 그 정리가 #1047 의 남은 항목이기 때문이지, 여유분이 공짜여서가 아니다.
test('learning page keeps the wide-screen scroll margin at or above the sticky band', () => {
  const styles = readSiteStylesheet();
  const css = readLearningStylesheet();

  // 목차 스트립 높이 = 안쪽 세로 패딩 두 번 + 링크 한 줄 높이 + 스트립 아래 테두리.
  // 링크의 line-height 가 px 로 적혀 있어야 이 식이 성립한다. 비워 두면 줄 높이가 폰트 메트릭에서
  // 나와(실측 15px, Pretendard 가 못 뜨면 다른 값) CSS 만 읽어서는 알 수 없다.
  const strip =
    verticalPadding(exactSelectorBlock(css, '.learning-nav-inner')) * 2
    + pxDeclaration(exactSelectorBlock(css, '.learning-nav a'), 'line-height')
    + pxDeclaration(exactSelectorBlock(css, '.learning-nav'), 'border-bottom');
  const band = unfoldedHeaderHeight(styles) + strip;

  const wide = scrollMarginRule(stripMediaBlocks(css)).px;
  assert.ok(
    wide >= band,
    `넓은 화면 scroll-margin-top(${wide}px)이 sticky 가 가리는 띠(${band}px)보다 작다 — 초점 대상과 목차 착지 대상의 상단이 그 밑에 깔린다`
  );
});
