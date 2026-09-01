const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { mediaBlock, exactSelectorBlock, selectorGroupBlock, assertCssDeclaration } = require('../helpers/css-blocks');
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

// Tab 초점은 브라우저가 요소를 화면 안으로 굴려 넣는데, 이 페이지는 sticky 가 2단이라 여백이
// 없으면 요소 상단이 그 밑에 깔린다. 값의 근거는 learning.css 주석에 실측으로 적혀 있다.
test('learning page keeps focus targets clear of the two-tier sticky header', () => {
  const css = readLearningStylesheet();
  // 셀렉터로 규칙을 찾으면 `.week-result table` 처럼 다른 규칙에도 쓰이는 셀렉터가 엉뚱한 블록에
  // 걸린다. 반대로 선언에서 출발해, scroll-margin-top 을 주는 규칙들이 무엇을 덮는지 모은다.
  const covered = (scope, value) => {
    const flat = String(scope).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '');
    const selectors = new Set();
    for (const rule of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!new RegExp(`scroll-margin-top:\\s*${value}\\s*;`).test(rule[2])) continue;
      for (const part of rule[1].split(',')) selectors.add(part.trim());
    }
    return selectors;
  };

  // 목록을 따로 적지 않고 KEYBOARD_SCROLLABLE 에서 돈다 — 탭 정거장을 하나 늘리면서 가림 방지를
  // 빠뜨리는 일이 없도록. 두 목록이 갈리면 새 항목만 보호 없이 남는다.
  const wide = covered(css, '124px');
  const narrow = covered(mediaBlock(css, '(max-width: 780px)'), '185px');
  for (const { selector } of KEYBOARD_SCROLLABLE) {
    assert.ok(wide.has(selector), `${selector} 는 넓은 화면 scroll-margin-top 을 받아야 한다`);
    assert.ok(narrow.has(selector), `${selector} 는 좁은 화면 scroll-margin-top 을 받아야 한다`);
  }
});

// ---- 좁은 화면에서 목차 나브가 헤더 뒤로 들어가지 않는다 (#1023) ----

// 이 페이지의 sticky 는 2단이다 — .site-header(top:0, z-index:20) 위에 .learning-nav(z-index:10).
// 헤더는 좁은 화면에서 .homepage-nav 가 column 으로 접히며 59px 에서 133px 로 커지는데, 나브의
// top 은 59px 고정이라 그 구간에서 목차가 헤더 뒤로 통째로 들어가 보이지 않았다.
//
// 잠글 것이 둘이다. 폭이 하나, 높이가 하나다.
// - 폭: 나브 override 가 헤더가 접히는 폭보다 좁으면 그 사이에서 다시 가려지고, 넓으면 헤더와
//   나브 사이에 빈 띠가 생긴다 — 이 파일에 이미 있는 780px 블록을 재사용했다면 641~780px 에서
//   74px 이 벌어진다(실측).
// - 높이: 133 이라는 값 자체는 styles.css 의 헤더 기하에서 나온 파생값이다. 폭만 잠그면 그 입력이
//   바뀌어도(예: .homepage-nav 의 padding 을 12px 에서 20px 로 늘리면 헤더는 149px 이 된다)
//   브레이크포인트는 그대로라 아무 검사도 깨지지 않고, 나브만 조용히 어긋난다.
const HEADER_FOLD_QUERY = '(max-width: 640px)';

// 브라우저 실측값(Chrome, 배포된 페이지, 320~1265px). 이 단언이 실제로 지키는 범위는 좁으니
// 그대로 적어 둔다.
// - 합산식에 이미 든 항이 바뀌는 것: 잡는다. 다만 아래 learning.css 비교와 중복이다.
// - 합산식과 learning.css 의 top 이 **함께** 어긋나는 것: 여기서만 잡는다. 합산식에서 항을 하나
//   지우면 learning.css 비교가 먼저 걸리므로 그것만으로는 이 값이 필요 없지만, learning.css 까지
//   그 잘못된 값으로 맞추면 두 쪽이 합의해 버린다. 그때 남는 것이 실측값과 대는 이 단언뿐이다.
// - 헤더에 **새 항이 생기는 것**: 못 잡는다. 두 가지가 다 여기 해당한다 — .site-header 에 세로
//   패딩을 더하는 경우, 그리고 640px 블록에서 .homepage-nav-links 가 width:100% + flex-wrap:wrap
//   을 받으므로 링크가 하나 늘면 좁은 화면에서 34px 줄이 하나 더 쌓이는 경우(합산식은 링크줄을
//   한 줄로만 센다 — 지금 세 링크는 감기지 않지만 구조는 그대로다). 둘 다 실제 헤더만 커진다.
// 이 단언이 깨지면 숫자만 맞추지 말고 브라우저에서 다시 재서 갱신한다.
const MEASURED_HEADER_HEIGHT = { unfolded: 59, folded: 133 };

// 목차 스트립(.learning-nav)의 높이 42.5px 중 CSS 에서 나오지 않는 항 — 링크 한 줄의 line box.
// 스트립 높이는 뷰포트 폭에 의존하지 않는다(실측 320~1265px 에서 42.5px 고정). 나머지 27px 은
// .learning-nav-inner 의 세로 패딩 26px 과 .learning-nav 의 아래 테두리 1px 이라 아래에서 CSS 로
// 읽는다. 이 항만 폰트가 정하므로 실측으로 남긴다.
const MEASURED_NAV_LINK_LINE_BOX = 15.5;

// 선언 값을 토큰 목록으로 돌려준다. 같은 속성이 여러 번 쓰였으면 뒤에 온 것이 이긴다(CSS 와 같다).
function declarationTokens(block, property) {
  const normalized = String(block).replace(/\s+/g, ' ');
  const found = [...normalized.matchAll(new RegExp(`(?:^|[;{ ])${property}\\s*:\\s*([^;]+);`, 'g'))];
  assert.ok(found.length > 0, `${property} 선언이 있어야 한다`);
  return found[found.length - 1][1].trim().split(' ');
}

// 블록의 세로 패딩(위 + 아래)을 돌려준다. 선언을 쓰인 순서대로 훑으며 상·하를 각각 덮어쓴다 —
// `padding` 숏핸드는 값이 3개 이상일 때만 아래가 갈리고, `padding-top`/`padding-bottom` 롱핸드는
// 그 한 변만 바꾼다. 토큰 개수를 세지 않고 펼친 두 값을 비교하므로 `padding: 12px 0 12px 0`(4값
// 이지만 대칭)은 통과하고, `padding: 12px 0` 뒤의 `padding-bottom: 20px` 은 걸린다.
// 두 배로 세는 것 자체가 상·하 대칭 가정이라, 갈리면 합산식을 쓸 수 없으므로 실패한다.
function verticalPadding(block, label) {
  let top = '0px';
  let bottom = '0px';
  const normalized = String(block).replace(/\s+/g, ' ');
  for (const rule of normalized.matchAll(/(?:^|[;{ ])(padding(?:-top|-bottom)?)\s*:\s*([^;]+);/g)) {
    const tokens = rule[2].trim().split(' ');
    if (rule[1] === 'padding-top') top = tokens[0];
    else if (rule[1] === 'padding-bottom') bottom = tokens[0];
    else {
      top = tokens[0];
      bottom = tokens.length >= 3 ? tokens[2] : tokens[0];
    }
  }
  // px 검사를 대칭 검사보다 먼저 한다 — `padding: var(--x, 4px) 0` 처럼 토큰이 갈라지는 값에
  // "위아래가 다르다" 고 오진하지 않도록.
  for (const [edge, value] of [['위', top], ['아래', bottom]]) {
    assert.match(value, /^\d+(?:\.\d+)?px$/, `${label} 의 ${edge} 패딩은 px 값이어야 한다 — ${value}`);
  }
  assert.equal(bottom, top, `${label} 의 위아래 패딩이 다르다 — 세로 패딩을 두 배로 세는 가정이 깨진다`);
  return Number.parseFloat(top) * 2;
}

// 선언에서 px 수치를 뽑는다. 값이 여러 토큰인 숏핸드(`border-bottom: 1px solid …`)는 첫 토큰만
// 본다. px 이 아닌 값(`auto`, `var(…)`)이 들어오면 조용히 0 으로 세는 대신 실패한다.
function pxDeclaration(block, property) {
  const tokens = declarationTokens(block, property);
  assert.match(tokens[0], /^\d+(?:\.\d+)?px$/, `${property} 의 첫 토큰은 px 값이어야 한다 — ${tokens.join(' ')}`);
  return Number.parseFloat(tokens[0]);
}

test('learning page pins the sticky table of contents to the folded header', () => {
  const styles = readSiteStylesheet();
  const folded = mediaBlock(styles, HEADER_FOLD_QUERY);

  // 640px 의 근거는 이 한 줄이다 — 헤더가 한 줄에서 두 줄로 바뀌는 지점.
  assertCssDeclaration(exactSelectorBlock(folded, '.homepage-nav'), 'flex-direction', 'column');

  // 헤더 높이를 이루는 항을 styles.css 에서 그대로 읽어 더한다. 값을 적어 두기만 하고 합을 세지
  // 않으면 항이 바뀌어도 아무도 못 잡는다.
  const border = pxDeclaration(exactSelectorBlock(styles, '.site-header'), 'border-bottom');
  const nav = exactSelectorBlock(styles, '.homepage-nav');
  // 한 줄 헤더: .homepage-nav 의 min-height 가 브랜드(54px)·링크(44px)보다 커서 높이를 지배한다.
  const unfolded = pxDeclaration(nav, 'min-height') + border;
  // 두 줄 헤더: min-height 가 auto 로 풀리고 세로 패딩 + 브랜드 + 간격 + 링크줄이 쌓인다.
  const foldedHeight =
    verticalPadding(exactSelectorBlock(folded, '.homepage-nav'), '.homepage-nav')
    + pxDeclaration(exactSelectorBlock(styles, '.homepage-brand'), 'min-height')
    + pxDeclaration(nav, 'gap')
    + pxDeclaration(exactSelectorBlock(folded, '.homepage-nav-links a'), 'min-height')
    + border;

  assert.deepEqual(
    { unfolded, folded: foldedHeight },
    MEASURED_HEADER_HEIGHT,
    '합산식이 실측 헤더 높이와 갈렸다 — 헤더 기하를 바꿨다면 브라우저에서 다시 재고 실측값을 갱신한다'
  );

  const css = readLearningStylesheet();
  // 두 top 은 각각 그때의 헤더 높이와 같아야 한다. 리터럴이 아니라 위에서 계산한 값과 비교하므로,
  // 헤더 기하가 바뀌면 learning.css 를 따라 고치지 않는 한 여기서 깨진다.
  assertCssDeclaration(exactSelectorBlock(css, '.learning-nav'), 'top', `${unfolded}px`);
  assertCssDeclaration(
    exactSelectorBlock(mediaBlock(css, HEADER_FOLD_QUERY), '.learning-nav'),
    'top',
    `${foldedHeight}px`
  );

  // 이 변경은 #1015 의 scroll-margin-top 여유를 깎았다. 나브가 헤더 뒤에 숨어 있던 때는 좁은 화면
  // 가림 밴드가 헤더 높이 하나(133px)라 185px 까지 52px 이 남았는데, 이제 그 아래로 목차 스트립이
  // 쌓여 175.5px 이 되어 여유가 9.5px 다. 185px 은 리터럴이라 헤더가 커져도 따라오지 않는다 —
  // .homepage-nav 의 패딩을 늘리고 위 세 값을 규정대로 갱신하면 밴드는 191.5px 이 되는데 185px 은
  // 그대로 통과했다. 그래서 밴드도 파생값으로 잰다. 값 일치가 아니라 하한 비교다 — 과다 제공은
  // 초점 대상을 조금 더 내릴 뿐이라 무해하고, 동등 비교는 과잉 구속이다. 값을 올리는 것 자체는
  // 위쪽 #1015 테스트가 리터럴로 잠그고 있으므로, 이 하한은 그 잠금을 대신하지 않고 덧댄다.
  const stripHeight =
    verticalPadding(exactSelectorBlock(css, '.learning-nav-inner'), '.learning-nav-inner')
    + pxDeclaration(exactSelectorBlock(css, '.learning-nav'), 'border-bottom')
    + MEASURED_NAV_LINK_LINE_BOX;
  const scrollMargin = scope => pxDeclaration(selectorGroupBlock(scope, '.scoreboard'), 'scroll-margin-top');
  for (const [label, scope, band] of [
    ['넓은 화면', css, unfolded + stripHeight],
    ['좁은 화면', mediaBlock(css, '(max-width: 780px)'), foldedHeight + stripHeight]
  ]) {
    assert.ok(
      scrollMargin(scope) >= band,
      `${label} scroll-margin-top 이 가림 밴드보다 작다 — ${scrollMargin(scope)}px < ${band}px`
    );
  }
});
