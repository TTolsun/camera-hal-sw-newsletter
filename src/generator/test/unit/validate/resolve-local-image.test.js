'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');

const { resolveLocalImage, shouldLiveValidate } = require('../../../validate/validate-external-images');

// 회귀: resolveLocalImage가 서빙 URL relPath(newsletters/<date>/...)를 repo root 기준으로 풀어
// ../../assets/ fallback 경로가 root/assets/(존재하지 않음)로 잘못 풀리고, 실제로 articles/assets/에
// 존재하는 fallback 이미지를 missing으로 오판해 발행 가능한 newsletter를 통째로 막던 버그.
// 서빙 URL은 디스크상 articles/ 아래에 있으므로 publicAssetPath와 동일하게 articles/ 기준 해석해야 한다.

test('resolveLocalImage resolves a served-URL newsletter.md relPath under articles/, not repo root', () => {
  const resolved = resolveLocalImage('newsletters/2026-06-16/newsletter.md', '../../assets/images/fallback/newsletter-default.svg');
  assert.ok(
    resolved && resolved.endsWith(path.join('articles', 'assets', 'images', 'fallback', 'newsletter-default.svg')),
    `expected the articles/assets fallback path, got ${resolved}`
  );
});

test('resolveLocalImage resolves the same fallback for an index.html served URL', () => {
  const resolved = resolveLocalImage('newsletters/2026-06-16/index.html', '../../assets/images/fallback/newsletter-default.svg');
  assert.ok(
    resolved && resolved.endsWith(path.join('articles', 'assets', 'images', 'fallback', 'newsletter-default.svg')),
    `expected the articles/assets fallback path, got ${resolved}`
  );
});

// 회귀: 외부 이미지 link rot(외부 호스트 403/소멸)이 무관한 PR의 CI를 막던 근본 원인은
// validate-external-images만 validation-targets 스코핑을 빠뜨려 과거 발행물 전부를 매 run live
// 검증해 hard-fail시킨 것. 외부 이미지 live 검증을 발행/변경 대상(strict target)으로만 한정한다.
test('shouldLiveValidate live-validates the strict target newsletter (current/changed/generated)', () => {
  assert.equal(shouldLiveValidate('2026-06-24', new Set(['2026-06-24'])), true);
});

test('shouldLiveValidate skips a historical newsletter so link rot cannot block or slow unrelated PRs', () => {
  assert.equal(shouldLiveValidate('2026-05-05', new Set(['2026-06-24'])), false);
  // strict target이 비어 있으면(예: 이미지/발행물과 무관한 PR) 모든 과거 발행물의 외부 이미지를 건너뛴다.
  assert.equal(shouldLiveValidate('2026-05-05', new Set()), false);
});
