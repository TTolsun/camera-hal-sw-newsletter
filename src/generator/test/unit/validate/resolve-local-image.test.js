'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');

const { resolveLocalImage } = require('../../../validate/validate-external-images');

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
