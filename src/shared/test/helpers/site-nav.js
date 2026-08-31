'use strict';

// 공용 헤더 나브를 잠그는 테스트가 함께 쓰는 추출기.
//
// 페이지마다 따로 쓴 정규식이 `class="nav-links"[\s\S]*>홈</a>` 처럼 열려 있으면, 헤더가 아니라
// **푸터**의 같은 라벨이 뒤쪽 절을 만족시켜 헤더를 통째로 영어로 바꿔도 통과한다(실측). 컨테이너로
// 먼저 자른 뒤 그 안의 앵커만 보는 이 한 벌을 세 페이지가 같이 쓴다.

const assert = require('node:assert/strict');

const EXPECTED_LABELS = ['홈', '아카이브', 'GitHub'];
const GITHUB_URL = 'https://github.com/TTolsun/camera-hal-sw-newsletter';

// class 는 낱말 단위로 본다. `\bnav-links\b` 로 쓰면 하이픈이 단어 경계라 `homepage-nav-links`
// 까지 걸려서, `nav-links` 토큰을 지워도 잠금이 살아 있는 것처럼 통과한다(실측).
//
// 여는 태그와 본문을 한 정규식으로 잡지 않는다. 나브 div 는 바깥 div 안에 있어서, 바깥 태그가
// 먼저 매치되면 그 본문이 나브의 여는 태그까지 삼켜 버려 나브를 영영 못 찾는다(실측).
// 여는 태그만 먼저 찾고, 거기서부터 다음 `</div>` 까지를 본문으로 자른다.
function navLinks(html) {
  const source = String(html);
  for (const opening of source.matchAll(/<div\b[^>]*class="([^"]*)"[^>]*>/g)) {
    if (!opening[1].split(/\s+/).includes('nav-links')) continue;
    const start = opening.index + opening[0].length;
    const end = source.indexOf('</div>', start);
    const body = end === -1 ? source.slice(start) : source.slice(start, end);
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
  assert.ok(links, '헤더에 .nav-links 컨테이너가 있어야 한다');
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
