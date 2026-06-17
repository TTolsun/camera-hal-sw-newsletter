'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { dateTokens } = require('../../quality/quality-section-binding');

// 회귀: 한국어 날짜 정규식의 앞뒤 \b가 한글 경계에서 word-boundary 전이를 못 만들어
// (한글은 \w 아님; 특히 '일' 뒤 공백/문장끝) dateTokens가 한글 날짜를 전혀 못 잡던 버그.
// 한국어가 기본 출력 언어라 모든 한글 section의 date 매칭(claim-evidence 바인딩의
// shared-URL evidence 신호)을 죽이고 있었다. \b 제거로 정상화.
test('dateTokens extracts Korean-formatted dates (word-boundary regex regression)', () => {
  assert.deepEqual([...dateTokens('2026년 6월 9일')], ['2026-06-09']);
  assert.deepEqual([...dateTokens('출시일 2026년 6월 15일 공개')], ['2026-06-15']);
});

test('dateTokens still extracts ISO/numeric dates', () => {
  assert.deepEqual([...dateTokens('2026-06-09')], ['2026-06-09']);
});
