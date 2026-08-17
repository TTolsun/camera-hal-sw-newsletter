const assert = require('node:assert/strict');
const test = require('node:test');

// #908: coverage 재조정이 main 편성을 줄이면 editor에게 넘어가는 background context도 같은 편성으로
// 좁혀야 한다. 재조정 전 selected 뷰로 만들어진 배경 설명이 그대로 남으면 editor가 이미 main에서
// 빠진 기사까지 다뤄야 할 대상으로 보고 explicitly_demoted_groups에 선언해, 선택 집합 밖 강등이
// 커버리지 등식(article-groups.js의 groupCoverageSummary)을 깨뜨린다(2026-08-17 실측).

const {
  filterBackgroundContextToSelected
} = require('../../../reporter/background-context');

const REPORT = Object.freeze({
  schema_version: 1,
  date: '2026-08-17',
  stage: 'gemini-background-context',
  background_contexts: [
    {
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03',
      source_candidate_hash: 'hash-camerax',
      background_context: 'CameraX 배경'
    },
    {
      url: 'https://lore.kernel.org/linux-media/20260813-uvc-status-11-v1-1-2cf43e9590b0@chromium.org/',
      source_candidate_hash: 'hash-uvc',
      background_context: 'uvcvideo 배경'
    }
  ]
});

test('재조정으로 main에서 빠진 기사의 background context는 제거된다', () => {
  const reconciledSelected = [
    { url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03', url_hash: 'hash-camerax' }
  ];

  const filtered = filterBackgroundContextToSelected(REPORT, reconciledSelected);

  assert.deepEqual(
    filtered.background_contexts.map(item => item.source_candidate_hash),
    ['hash-camerax']
  );
});

test('url 표기가 달라도 source_candidate_hash가 같으면 남는다', () => {
  const reconciledSelected = [
    { url: 'https://developer.android.com/jetpack/androidx/releases/camera', source_candidate_hash: 'hash-uvc' }
  ];

  const filtered = filterBackgroundContextToSelected(REPORT, reconciledSelected);

  assert.deepEqual(
    filtered.background_contexts.map(item => item.source_candidate_hash),
    ['hash-uvc']
  );
});

test('원본 report를 변형하지 않고 나머지 필드는 그대로 둔다', () => {
  const reconciledSelected = [{ url_hash: 'hash-camerax' }];

  const filtered = filterBackgroundContextToSelected(REPORT, reconciledSelected);

  assert.equal(REPORT.background_contexts.length, 2);
  assert.notEqual(filtered, REPORT);
  assert.equal(filtered.schema_version, 1);
  assert.equal(filtered.date, '2026-08-17');
  assert.equal(filtered.stage, 'gemini-background-context');
});
