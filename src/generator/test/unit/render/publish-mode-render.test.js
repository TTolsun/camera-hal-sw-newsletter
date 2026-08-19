'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMarkdown,
  buildHtml
} = require('../../../render/newsletter-renderer');

function baseIssue(overrides = {}) {
  return {
    date: '2026-06-02',
    title: 'Camera HAL / SW Newsletter - 2026-06-02',
    summary: '요약',
    briefing: ['신호 1', '신호 2', '신호 3'],
    sections: [],
    references: [],
    ...overrides
  };
}

test('QUIET issue with no sections renders briefing without crashing', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'QUIET' }));
  assert.match(md, /3줄 브리핑/);
  assert.doesNotMatch(md, /## 2\./);
});

test('QUIET issue with no sections renders HTML without crashing', () => {
  const html = buildHtml(baseIssue({ publish_mode: 'QUIET' }));
  assert.match(html, /이번 주 3줄 브리핑/);
  assert.match(html, /issue-references/);
});

test('watch_points render as a section when present (markdown)', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'QUIET', watch_points: ['다음 CameraX 릴리스 주목'] }));
  assert.match(md, /다음 관전 포인트/);
  assert.match(md, /다음 CameraX 릴리스 주목/);
});

test('watch_points render as a section when present (html)', () => {
  const html = buildHtml(baseIssue({ publish_mode: 'QUIET', watch_points: ['다음 CameraX 릴리스 주목'] }));
  assert.match(html, /다음 관전 포인트/);
  assert.match(html, /다음 CameraX 릴리스 주목/);
});

// #856 — 렌더러는 기간-수준 사실 주장을 쓰지 않는다.
//
// CONTEXT 모드는 compositionSummary 카운트만으로 정해지는 파이프라인 내부 판정이다. 그 플래그
// 하나로 "이번 기간 카메라 코어 직접 변경은 없었습니다"를 인쇄하면 LLM도 팩트체커도 본 적 없는
// 사실 주장이 발행된다. 실제로 2026-W26 은 V4L2 이미지 센서 드라이버 기사(정확히 카메라 코어
// 변경) 바로 위에 그 문장을 실었다. 대체 표현은 참/거짓을 가릴 수 있는 명제가 아니라, 그 호를
// 어떤 관점으로 읽는지 알리는 라벨이어야 한다.
//
// 좁은 패턴만 잠그면 문장을 조금 바꿔 쓴 재발을 놓치므로, 고정 픽스처 기준으로 렌더러가
// 기여하는 "무엇이 없었다"류 서술 자체가 0건임을 함께 단언한다.
const CONTEXT_LENS_LABEL = /실무 레이더 관점/;
const FABRICATED_QUIET_CORE_SENTENCE = /카메라 코어 직접 변경은 없었습니다/;
const PERIOD_LEVEL_ABSENCE_CLAIM = /없었습니다|없습니다/;

test('CONTEXT issue labels the context lens instead of claiming the period had no core changes (markdown)', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'CONTEXT', watch_points: [] }));
  assert.match(md, CONTEXT_LENS_LABEL);
  assert.doesNotMatch(md, FABRICATED_QUIET_CORE_SENTENCE);
  assert.doesNotMatch(md, PERIOD_LEVEL_ABSENCE_CLAIM);
});

test('CONTEXT issue labels the context lens instead of claiming the period had no core changes (html)', () => {
  const html = buildHtml(baseIssue({ publish_mode: 'CONTEXT', watch_points: [] }));
  assert.match(html, CONTEXT_LENS_LABEL);
  assert.doesNotMatch(html, FABRICATED_QUIET_CORE_SENTENCE);
  assert.doesNotMatch(html, PERIOD_LEVEL_ABSENCE_CLAIM);
});

test('DEEP issue without watch_points is unaffected by new sections', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'DEEP' }));
  assert.doesNotMatch(md, /관전 포인트/);
  assert.doesNotMatch(md, CONTEXT_LENS_LABEL);
  assert.doesNotMatch(md, PERIOD_LEVEL_ABSENCE_CLAIM);
});

test('empty watch_points array renders no watch-points section', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'QUIET', watch_points: [] }));
  assert.doesNotMatch(md, /관전 포인트/);
});
