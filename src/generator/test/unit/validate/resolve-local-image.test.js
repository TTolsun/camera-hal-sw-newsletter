'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('path');

const {
  changedPublicNewsletterDates,
  resolveLocalImage,
  shouldLiveValidate
} = require('../../../validate/validate-external-images');

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

// 이미지 감사 리포트 부재를 차단하는 스코프. 공개 산출물이 변경 집합(=커밋)에 들어온 날짜만
// 감사가 돌았어야 하는 주로 본다. 워크플로 03의 첫 실행은 공개 산출물이 아직 작업 트리에만
// 있어 이 집합이 비므로 초록으로 남는다.
test('changedPublicNewsletterDates picks up committed public newsletter artifacts', () => {
  const dates = changedPublicNewsletterDates([
    'articles/newsletters/2026-08-10/index.html',
    'articles/newsletters/2026-08-03/newsletter.md',
    'articles\\newsletters\\2026-07-27\\index.html'
  ]);
  assert.deepEqual([...dates].sort(), ['2026-07-27', '2026-08-03', '2026-08-10']);
});

test('changedPublicNewsletterDates ignores non-public artifacts of the same date', () => {
  // newsroom 증거물만 바뀐 PR은 발행물을 다시 내는 것이 아니므로 감사 리포트를 요구하지 않는다.
  // 리포트 자신의 변경이 스스로를 요구하게 만드는 순환도 여기서 끊긴다.
  const dates = changedPublicNewsletterDates([
    'articles/content/newsroom/2026-08-10/editor-draft.json',
    'articles/content/newsroom/2026-08-10/image-audit-report.json',
    'articles/data/newsletters.json',
    'articles/newsletters/2026-W33/index.html',
    'src/generator/validate/validate-external-images.js'
  ]);
  assert.deepEqual([...dates], []);
});
