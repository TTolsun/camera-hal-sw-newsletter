'use strict';

// 공용 헤더·푸터 나브를 잠그는 테스트가 함께 쓰는 추출기.
//
// 페이지마다 따로 쓴 정규식이 `class="nav-links"[\s\S]*>홈</a>` 처럼 열려 있으면, 헤더가 아니라
// **푸터**의 같은 라벨이 뒤쪽 절을 만족시켜 헤더를 통째로 영어로 바꿔도 통과한다(실측). 컨테이너로
// 먼저 자른 뒤 그 안의 앵커만 보는 이 한 벌을 네 표면(홈·아카이브·Lab·렌더된 이슈)이 같이 쓴다.

const assert = require('node:assert/strict');

const EXPECTED_LABELS = ['홈', '아카이브', 'GitHub'];
const GITHUB_URL = 'https://github.com/TTolsun/camera-hal-sw-newsletter';

// 컨테이너 본문을 짝이 맞는 닫는 태그까지 자른다. 첫 `</div>` 에서 끊으면 나브 안에 중첩 div 가
// 생겼을 때 그 뒤의 링크가 통째로 안 보인다 — 없어진 validate-site 테스트가 덮던 "4번째 Sources
// 링크" 축이 바로 그 모양이다(실측).
function balancedBody(source, openTagEnd, tagName) {
  const open = new RegExp(`<${tagName}\\b`, 'gi');
  const close = new RegExp(`</${tagName}\\s*>`, 'gi');
  let depth = 1;
  let cursor = openTagEnd;
  while (depth > 0) {
    open.lastIndex = cursor;
    close.lastIndex = cursor;
    const nextOpen = open.exec(source);
    const nextClose = close.exec(source);
    if (!nextClose) return source.slice(openTagEnd);
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      cursor = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return source.slice(openTagEnd, nextClose.index);
    cursor = nextClose.index + nextClose[0].length;
  }
  return source.slice(openTagEnd);
}

// class 는 낱말 단위로 본다. `\bnav-links\b` 로 쓰면 하이픈이 단어 경계라 `homepage-nav-links`
// 까지 걸려서, `nav-links` 토큰을 지워도 잠금이 살아 있는 것처럼 통과한다(실측).
function hasClassToken(openingTag, token) {
  const attribute = String(openingTag).match(/\sclass="([^"]*)"/i);
  return Boolean(attribute) && attribute[1].split(/\s+/).includes(token);
}

function plainText(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function anchors(html) {
  return [...String(html).matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(match => ({
    href: match[1],
    label: plainText(match[2])
  }));
}

// 여는 태그와 본문을 한 정규식으로 잡지 않는다. 나브·푸터 컨테이너는 바깥 div 안에 있어서, 바깥
// 태그가 먼저 매치되면 그 본문이 안쪽 컨테이너의 여는 태그까지 삼켜 버려 영영 못 찾는다(실측).
function containerBody(source, tagNames, classToken) {
  const text = String(source);
  for (const opening of text.matchAll(new RegExp(`<(${tagNames.join('|')})\\b[^>]*>`, 'gi'))) {
    if (!hasClassToken(opening[0], classToken)) continue;
    return balancedBody(text, opening.index + opening[0].length, opening[1]);
  }
  return null;
}

// 같은 class 를 가진 형제들의 본문을 순서대로 모은다. 한 형제를 찾으면 그 본문 끝으로 건너뛰므로,
// 안에 중첩된 같은 이름의 태그를 또 하나의 형제로 세지 않는다.
function siblingBodies(source, tagName, classToken) {
  const text = String(source);
  const opening = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const bodies = [];
  let match = opening.exec(text);
  while (match) {
    if (hasClassToken(match[0], classToken)) {
      const bodyStart = match.index + match[0].length;
      const body = balancedBody(text, bodyStart, tagName);
      bodies.push(body);
      opening.lastIndex = bodyStart + body.length;
    }
    match = opening.exec(text);
  }
  return bodies;
}

// **헤더 안에서만** 찾는다. 문서 순서상 첫 nav-links 를 집으면, 헤더 컨테이너가 모양을 바꾸고
// 다른 곳(예: 푸터)에 nav-links 가 생겼을 때 헤더가 영어여도 조용히 통과한다(실측).
//
// div 든 nav 든 받는다 — 시맨틱을 <nav> 로 바꾸는 것은 정당한 변경이지 회귀가 아니다.
function navLinks(html) {
  const source = String(html);
  const headerOpen = source.match(/<header\b[^>]*>/i);
  if (!headerOpen) return null;
  const header = balancedBody(source, headerOpen.index + headerOpen[0].length, 'header');

  const navBody = containerBody(header, ['div', 'nav'], 'nav-links');
  return navBody === null ? null : anchors(navBody);
}

// rootPath 는 그 페이지에서 사이트 루트로 가는 접두어다('' 또는 '../../').
function assertSharedNav(html, rootPath = '') {
  const links = navLinks(html);
  assert.ok(links, '<header> 안에 nav-links 컨테이너가 있어야 한다');
  assert.deepEqual(links.map(link => link.label), EXPECTED_LABELS);
  assert.deepEqual(links.map(link => link.href), [
    `${rootPath}index.html`,
    `${rootPath}archive.html`,
    GITHUB_URL
  ]);
}

// ---- 푸터 (#1022) ----
//
// 푸터 나브 라벨은 어느 페이지에서도 잠기지 않았다. `index.html` 의 푸터 라벨만 영어로 바꿔도
// 전체 테스트가 통과한다(실측 2026-09-01, 이슈 #1022 재현). 헤더와 같은 형태로 잠근다 —
// `.site-footer` 로 먼저 자르고, 그 안의 컬럼별 라벨을 고정 배열로 비교한다.

const EXPECTED_FOOTER_COLUMN_TITLES = ['뉴스레터', '주제', '리소스'];

// 컬럼별 링크 라벨. 「주제」 컬럼의 빈 배열도 잠금의 일부다 — 링크가 새로 생기면 여기서 걸린다.
const EXPECTED_FOOTER_LINK_LABELS = [
  ['홈', '아카이브'],
  [],
  ['AI Engineering Lab', 'GitHub']
];

// 「뉴스레터」·「리소스」 컬럼의 노트는 아직 링크가 아닌 나브 항목이다. "아직 없는 기능을 죽은
// 링크로 만들지 않는다"는 DESIGN.md 결정이 겉으로 드러난 자리이고, 기능이 생기면 그대로 링크가
// 된다 — 나브 축이므로 문구까지 잠근다. 링크가 아니라 <span> 이라 링크 배열과 섞이지 않는다.
const EXPECTED_FOOTER_PLACEHOLDER_NOTES = [
  ['구독 (지원예정)'],
  ['RSS (지원예정)', '편집 정책 (지원예정)']
];

// 「주제」 컬럼은 나브가 아니라 주제 분류 편집 카피다. 문구까지 잠그면 순수한 콘텐츠 편집(예: 주제
// 하나의 이름 변경)이 "나브 라벨" 이름을 단 테스트 4개를 깨고, 그건 #1022 가 막으려던 것이 아니다.
// 개수만 본다 — 항목이 늘거나 줄면 그건 편집이 아니라 푸터 구조 변경이다.
const EXPECTED_FOOTER_TOPIC_NOTE_COUNT = 3;

// `.site-footer` 안의 `.footer-cols` 를 컬럼 단위로 쪼갠다. 컬럼 경계를 지키는 이유는, 라벨을
// 평평한 한 배열로 모으면 「홈」이 「리소스」 컬럼으로 옮겨가도 통과하기 때문이다.
function footerColumns(html) {
  const footer = containerBody(html, ['footer'], 'site-footer');
  if (footer === null) return null;
  const columns = containerBody(footer, ['div'], 'footer-cols');
  if (columns === null) return null;

  return siblingBodies(columns, 'div', 'footer-col').map(body => ({
    title: siblingBodies(body, 'span', 'footer-col-title').map(plainText)[0] ?? null,
    links: anchors(body),
    notes: siblingBodies(body, 'span', 'footer-note').map(plainText)
  }));
}

// rootPath 는 assertSharedNav 와 같은 뜻이다('' 또는 '../../').
//
// labHref 는 「리소스」 컬럼의 AI Engineering Lab 링크가 가리키는 곳이다. 네 표면 중 Lab 페이지만
// 그 링크가 자기 자신이라 `index.html` 이고, 나머지 셋은 rootPath 로 유도된다 — 그래서 기본값을
// 두되 Lab 페이지가 자기 값을 넘긴다. 이 인자를 두지 않고 헬퍼에서 뺐더니 홈·아카이브 두 표면의
// Lab href 잠금이 대체 없이 사라졌다: 배포본을 훑는 homepage-archive.test.js 는 단언 전에
// assemble-site.js 의 withLearningFooterLink() 를 거치는데, 그게 label 로 찾은 링크를 통째로
// 정규화하므로 커밋본의 href 가 틀려도 잡지 못한다(실측: 홈의 href 를 바꿔도 fail 0).
function assertSharedFooterNav(html, rootPath = '', labHref = `${rootPath}learning/ai-engineering/index.html`) {
  const columns = footerColumns(html);
  assert.ok(columns, '<footer class="site-footer"> 안에 footer-cols 컨테이너가 있어야 한다');
  assert.deepEqual(columns.map(column => column.title), EXPECTED_FOOTER_COLUMN_TITLES);
  assert.deepEqual(
    columns.map(column => column.links.map(link => link.label)),
    EXPECTED_FOOTER_LINK_LABELS
  );
  assert.deepEqual([columns[0].notes, columns[2].notes], EXPECTED_FOOTER_PLACEHOLDER_NOTES);
  assert.equal(columns[1].notes.length, EXPECTED_FOOTER_TOPIC_NOTE_COUNT);
  assert.deepEqual(columns[0].links.map(link => link.href), [
    `${rootPath}index.html`,
    `${rootPath}archive.html`
  ]);
  assert.deepEqual(columns[2].links.map(link => link.href), [labHref, GITHUB_URL]);
}

// ---- 헤더 브랜드 (#1021) ----
//
// 나브 라벨만 잠그면 반쯤 마이그레이션된 헤더를 못 잡는다. 레거시 27개는 라벨이 영어인 동시에
// 워드마크가 "Camera SW Newsletter"였고 로고 이미지가 아예 없었다 — 라벨 두 개만 고치면 나브는
// 한글인데 브랜드는 옛 세대인 상태가 된다. 그래서 `.site-brand` 를 통째로(링크·aria-label·로고·
// 워드마크) 본다. 헤더 안으로 먼저 자르는 이유는 나브와 같다: 문서의 다른 곳에 있는 같은 문자열이
// 대신 만족시키지 못하게 한다.
const EXPECTED_BRAND_LABEL = 'Camera SW Newsroom';
const BRAND_LOGO_PATH = 'assets/images/brand/HALley-logo.png';

function siteBrand(html) {
  const source = String(html);
  const headerOpen = source.match(/<header\b[^>]*>/i);
  if (!headerOpen) return null;
  const header = balancedBody(source, headerOpen.index + headerOpen[0].length, 'header');

  for (const opening of header.matchAll(/<a\b[^>]*>/gi)) {
    if (!hasClassToken(opening[0], 'site-brand')) continue;
    const body = balancedBody(header, opening.index + opening[0].length, 'a');
    // 로고는 class 토큰으로 찾은 뒤 그 태그에서 src 를 뽑는다. `class="..." src="..."` 순서를
    // 한 정규식에 굳혀 두면 속성 순서만 바뀌어도 잠금이 조용히 풀린다.
    const logo = [...body.matchAll(/<img\b[^>]*>/gi)].find(tag => hasClassToken(tag[0], 'brand-logo'));
    return {
      href: opening[0].match(/\shref="([^"]*)"/i)?.[1] ?? null,
      ariaLabel: opening[0].match(/\saria-label="([^"]*)"/i)?.[1] ?? null,
      logoSrc: logo ? (logo[0].match(/\ssrc="([^"]*)"/i)?.[1] ?? null) : null,
      wordmark: plainText(body)
    };
  }
  return null;
}

// rootPath 는 assertSharedNav 와 같은 뜻이다('' 또는 '../../').
function assertSharedBrand(html, rootPath = '') {
  const brand = siteBrand(html);
  assert.ok(brand, '<header> 안에 site-brand 링크가 있어야 한다');
  assert.equal(brand.href, `${rootPath}index.html`);
  assert.equal(brand.ariaLabel, EXPECTED_BRAND_LABEL);
  assert.equal(brand.logoSrc, `${rootPath}${BRAND_LOGO_PATH}`);
  assert.equal(brand.wordmark, EXPECTED_BRAND_LABEL);
}

module.exports = {
  EXPECTED_LABELS,
  EXPECTED_BRAND_LABEL,
  BRAND_LOGO_PATH,
  EXPECTED_FOOTER_COLUMN_TITLES,
  EXPECTED_FOOTER_LINK_LABELS,
  EXPECTED_FOOTER_PLACEHOLDER_NOTES,
  EXPECTED_FOOTER_TOPIC_NOTE_COUNT,
  GITHUB_URL,
  navLinks,
  siteBrand,
  footerColumns,
  assertSharedNav,
  assertSharedBrand,
  assertSharedFooterNav
};
