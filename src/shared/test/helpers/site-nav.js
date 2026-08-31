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

// `(지원예정)` 노트는 링크가 아니라 <span> 이라 링크 배열과 섞이지 않는다 — 따로 고정 배열로
// 비교한다. 이 문구는 "아직 없는 기능을 죽은 링크로 만들지 않는다"는 DESIGN.md 결정이 겉으로
// 드러난 자리이므로, 값이 바뀌면 결정도 함께 바뀐 것이다.
const EXPECTED_FOOTER_NOTES = [
  ['구독 (지원예정)'],
  ['Camera HAL · Android', 'Driver · Image Processing', 'AI · SoC Platform'],
  ['RSS (지원예정)', '편집 정책 (지원예정)']
];

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
// **잠그는 범위**: 컬럼 제목 3개, 컬럼별 링크 라벨, 컬럼별 노트 문구, 그리고 네 표면이 모두 같은
// href(홈·아카이브·GitHub). 「리소스」 컬럼의 AI Engineering Lab href 만 여기서 보지 않는다 —
// Lab 페이지에서는 그 링크가 자기 자신을 가리켜 `index.html` 이고 다른 세 표면에서는
// `${rootPath}learning/ai-engineering/index.html` 이라, rootPath 로 유도되지 않는 유일한 값이다.
// 그 href 는 homepage-archive.test.js 의 "site assembly makes every deployed public page footer
// link to the AI Engineering lab" 이 배포되는 페이지 전부를 페이지별 기대값으로 이미 잠그고
// 있고, 렌더러가 만드는 쪽은 newsletter-renderer.test.js 가 따로 잠근다.
function assertSharedFooterNav(html, rootPath = '') {
  const columns = footerColumns(html);
  assert.ok(columns, '<footer class="site-footer"> 안에 footer-cols 컨테이너가 있어야 한다');
  assert.deepEqual(columns.map(column => column.title), EXPECTED_FOOTER_COLUMN_TITLES);
  assert.deepEqual(
    columns.map(column => column.links.map(link => link.label)),
    EXPECTED_FOOTER_LINK_LABELS
  );
  assert.deepEqual(columns.map(column => column.notes), EXPECTED_FOOTER_NOTES);
  assert.deepEqual(columns[0].links.map(link => link.href), [
    `${rootPath}index.html`,
    `${rootPath}archive.html`
  ]);
  assert.equal(columns[2].links[1].href, GITHUB_URL);
}

module.exports = {
  EXPECTED_LABELS,
  EXPECTED_FOOTER_COLUMN_TITLES,
  EXPECTED_FOOTER_LINK_LABELS,
  EXPECTED_FOOTER_NOTES,
  GITHUB_URL,
  navLinks,
  footerColumns,
  assertSharedNav,
  assertSharedFooterNav
};
