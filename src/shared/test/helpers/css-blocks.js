'use strict';

// 공개 사이트 stylesheet 를 선언 단위로 잠그는 테스트가 공유하는 파서.
//
// 정규식으로 블록을 뜨면 들여쓰기 관례(닫는 중괄호가 몇 열인지)와 "찾는 선언이 블록 앞쪽에
// 있다"는 가정에 묶여, 규칙을 재배치하기만 해도 잠금이 거짓 실패한다. 중괄호를 세서 블록
// 경계를 정확히 찾는다. stylesheet 가 둘 이상이므로 파서도 한 벌만 둔다.

const assert = require('node:assert/strict');

function escapeForRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// startIndex 이후 첫 여는 중괄호부터 짝이 맞는 닫는 중괄호까지의 본문을 돌려준다.
function blockAt(css, startIndex) {
  const openIndex = css.indexOf('{', startIndex);
  assert.notEqual(openIndex, -1, 'CSS block should contain an opening brace');
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openIndex + 1, index);
      }
    }
  }
  assert.fail('CSS block should contain a matching closing brace');
}

function mediaBlock(css, query) {
  const index = css.indexOf(`@media ${query}`);
  assert.notEqual(index, -1, `@media ${query} block should exist`);
  return blockAt(css, index);
}

// selector 가 단독으로 쓰인 규칙만 찾는다. 콤마 그룹의 뒷줄에 같은 이름이 나오면 건너뛴다.
function exactSelectorBlock(css, selector) {
  const pattern = new RegExp(`(^|\\n)\\s*${escapeForRegExp(selector)}\\s*\\{`, 'g');
  for (const match of css.matchAll(pattern)) {
    const selectorIndex = match.index + match[0].indexOf(selector);
    const previous = css.slice(0, match.index).trimEnd();
    if (previous.endsWith(',')) continue;
    return blockAt(css, selectorIndex);
  }
  assert.fail(`${selector} exact block should exist`);
}

// selector 가 콤마 그룹의 어느 자리에 있어도 그 규칙 본문을 돌려준다. exactSelectorBlock 은
// 단독 규칙만 찾는데(그룹 여부 자체가 styles.css 잠금의 일부라 의도된 제약이다), 그룹으로 쓰는
// 것이 정상인 규칙을 잠글 때는 이쪽을 쓴다. 줄바꿈으로 흩어진 그룹도 같은 규칙으로 본다.
function selectorGroupBlock(css, selector) {
  const target = String(selector).trim();
  for (const match of String(css).matchAll(/\{/g)) {
    const before = css.slice(0, match.index);
    const boundary = Math.max(before.lastIndexOf('}'), before.lastIndexOf('{'));
    // 주석에는 콤마도 셀렉터처럼 생긴 낱말도 들어가므로 셀렉터 목록에서 먼저 걷어낸다.
    const selectorList = before.slice(boundary + 1).replace(/\/\*[\s\S]*?\*\//g, '');
    if (selectorList.includes(';')) continue;
    const parts = selectorList.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.includes(target)) return blockAt(css, match.index);
  }
  assert.fail(`${selector} rule should exist`);
}

function assertCssDeclaration(block, property, value) {
  const normalized = String(block).replace(/\s+/g, ' ');
  assert.match(normalized, new RegExp(`${property}\\s*:\\s*${escapeForRegExp(value)}\\s*;`));
}

module.exports = {
  blockAt,
  mediaBlock,
  exactSelectorBlock,
  selectorGroupBlock,
  assertCssDeclaration
};
