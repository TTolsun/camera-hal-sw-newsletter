'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { exclusionReasons } = require('../../select/newsroom-selection');
const { policyPrimaryCandidate } = require('../../../shared/test/helpers/selection-builders');

// YouTube 등의 재생목록(playlist) URL은 dated article이 아니라 영상 모음(collection)이다.
// dated evidence가 붙어 있어도 메인 기사로 승격되면 source-integrity 게이트가 "shared watch
// URL requires matching version/date evidence"로 hard-fail시켜 이슈 전체를 막는다.
// 선택을 게이트 방향으로 더 엄격하게(fail-closed) 만들어 playlist URL을 메인에서 제외한다.
const PLAYLIST_EXCLUSION = 'playlist/collection URL is not a dated main article';

test('a YouTube playlist URL is excluded from main article eligibility', () => {
  const playlist = policyPrimaryCandidate(0, {
    title: 'Google I/O 26 media pipeline sessions',
    url: 'https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S'
  });

  assert.ok(exclusionReasons(playlist).includes(PLAYLIST_EXCLUSION));
});

test('a normal dated article URL is not excluded by the playlist rule', () => {
  const normal = policyPrimaryCandidate(0);

  assert.equal(exclusionReasons(normal).includes(PLAYLIST_EXCLUSION), false);
});

test('a single YouTube watch video URL is not treated as a playlist collection', () => {
  const watch = policyPrimaryCandidate(0, {
    title: 'Google I/O 26 single session',
    url: 'https://www.youtube.com/watch?v=Wh3LWb_Phfk'
  });

  assert.equal(exclusionReasons(watch).includes(PLAYLIST_EXCLUSION), false);
});
