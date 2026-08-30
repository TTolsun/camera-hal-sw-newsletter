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
