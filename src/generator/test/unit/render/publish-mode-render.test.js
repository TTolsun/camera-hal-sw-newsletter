'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMarkdown,
  buildHtml
} = require('../../../scripts/newsroom/render/newsletter-renderer');

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

test('CONTEXT issue shows quiet-core note (markdown)', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'CONTEXT', watch_points: [] }));
  assert.match(md, /카메라 코어 직접 변경은 없었습니다/);
});

test('CONTEXT issue shows quiet-core note (html)', () => {
  const html = buildHtml(baseIssue({ publish_mode: 'CONTEXT', watch_points: [] }));
  assert.match(html, /카메라 코어 직접 변경은 없었습니다/);
});

test('DEEP issue without watch_points is unaffected by new sections', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'DEEP' }));
  assert.doesNotMatch(md, /관전 포인트/);
  assert.doesNotMatch(md, /카메라 코어 직접 변경은 없었습니다/);
});

test('empty watch_points array renders no watch-points section', () => {
  const md = buildMarkdown(baseIssue({ publish_mode: 'QUIET', watch_points: [] }));
  assert.doesNotMatch(md, /관전 포인트/);
});
