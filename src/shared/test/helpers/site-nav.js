'use strict';

// 공용 헤더 나브를 잠그는 테스트가 함께 쓰는 추출기.
//
// 페이지마다 따로 쓴 정규식이 `class="nav-links"[\s\S]*>홈</a>` 처럼 열려 있으면, 헤더가 아니라
// **푸터**의 같은 라벨이 뒤쪽 절을 만족시켜 헤더를 통째로 영어로 바꿔도 통과한다(실측). 컨테이너로
// 먼저 자른 뒤 그 안의 앵커만 보는 이 한 벌을 세 페이지가 같이 쓴다.

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

// **헤더 안에서만** 찾는다. 문서 순서상 첫 nav-links 를 집으면, 헤더 컨테이너가 모양을 바꾸고
// 다른 곳(예: 푸터)에 nav-links 가 생겼을 때 헤더가 영어여도 조용히 통과한다(실측).
//
// class 는 낱말 단위로 본다. `\bnav-links\b` 로 쓰면 하이픈이 단어 경계라 `homepage-nav-links`
// 까지 걸려서, `nav-links` 토큰을 지워도 잠금이 살아 있는 것처럼 통과한다(실측).
//
// 여는 태그와 본문을 한 정규식으로 잡지 않는다. 나브 컨테이너는 바깥 div 안에 있어서, 바깥 태그가
// 먼저 매치되면 그 본문이 나브의 여는 태그까지 삼켜 버려 나브를 영영 못 찾는다(실측).
function navLinks(html) {
  const source = String(html);
  const headerOpen = source.match(/<header\b[^>]*>/i);
  if (!headerOpen) return null;
  const header = balancedBody(source, headerOpen.index + headerOpen[0].length, 'header');

  // div 든 nav 든 받는다 — 시맨틱을 <nav> 로 바꾸는 것은 정당한 변경이지 회귀가 아니다.
  for (const opening of header.matchAll(/<(div|nav)\b[^>]*class="([^"]*)"[^>]*>/gi)) {
    if (!opening[2].split(/\s+/).includes('nav-links')) continue;
    const body = balancedBody(header, opening.index + opening[0].length, opening[1]);
    return [...body.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(match => ({
      href: match[1],
      label: match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    }));
  }
  return null;
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

module.exports = {
  EXPECTED_LABELS,
  GITHUB_URL,
  navLinks,
  assertSharedNav
};
