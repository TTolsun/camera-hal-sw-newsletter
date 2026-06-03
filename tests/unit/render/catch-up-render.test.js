'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildMarkdown, buildHtml } = require('../../../scripts/newsroom/render/newsletter-renderer');

function issueWithCatchUp() {
  return {
    date: '2026-06-03',
    title: 'Test',
    summary: 'Test summary',
    briefing: ['a', 'b', 'c'],
    sections: [
      { headline: 'Fresh Camera item', coverage_type: 'fresh', public_article: { headline: 'Fresh Camera item', lead: 'lead', camera_hal_takeaway: 'takeaway' }, sources: [{ title: 's', url: 'https://example.com/fresh' }] },
      { headline: 'CameraX 1.6.0', coverage_type: 'catch_up', catch_up_age_days: 70, public_article: { headline: 'CameraX 1.6.0', lead: 'lead', camera_hal_takeaway: 'takeaway' }, sources: [{ title: 's', url: 'https://example.com/160' }] }
    ],
    references: []
  };
}

test('markdown groups catch_up sections under a 지난 소식 heading with a 주 전 badge', () => {
  const md = buildMarkdown(issueWithCatchUp());
  assert.match(md, /## 지난 소식/);
  assert.match(md, /주 전 릴리스/);
});

test('markdown without catch_up sections has no 지난 소식 heading', () => {
  const issue = issueWithCatchUp();
  issue.sections = [issue.sections[0]];
  const md = buildMarkdown(issue);
  assert.doesNotMatch(md, /## 지난 소식/);
});

test('html renders a catch-up divider when a catch_up section exists', () => {
  const html = buildHtml(issueWithCatchUp());
  assert.match(html, /catch-up-divider/);
  assert.match(html, /지난 소식/);
});
