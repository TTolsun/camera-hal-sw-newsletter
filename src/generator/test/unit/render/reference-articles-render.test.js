'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildMarkdown, buildHtml } = require('../../../render/newsletter-renderer');

function issueWithReferences() {
  return {
    date: '2026-06-08',
    title: 'Test',
    summary: 'Test summary',
    briefing: ['a', 'b', 'c'],
    sections: [
      {
        headline: 'Fresh Camera item',
        coverage_type: 'fresh',
        public_article: { headline: 'Fresh Camera item', lead: 'lead', camera_hal_takeaway: 'takeaway' },
        sources: [{ title: 's', url: 'https://example.com/fresh' }]
      }
    ],
    references: [],
    reference_articles: [
      {
        title: 'CameraX 1.6.0 Release Notes',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0',
        source: 'CameraX Release Notes',
        published_date: '2026-03-25',
        note: 'AOSP Camera 프레임워크 관련 참고'
      },
      {
        title: 'GCC 16.1 released',
        url: 'https://isocpp.org/blog/gcc-16-1',
        source: 'ISO C++ Blog',
        published_date: '2026-04-30',
        note: 'C++ / AI 네이티브 툴링 참고'
      }
    ]
  };
}

test('markdown renders a 참고 / 더 읽을거리 section listing reference articles', () => {
  const md = buildMarkdown(issueWithReferences());
  assert.match(md, /## 참고 \/ 더 읽을거리/);
  assert.match(md, /\[CameraX 1\.6\.0 Release Notes\]\(<https:\/\/developer\.android\.com\/jetpack\/androidx\/releases\/camera#1\.6\.0>\)/);
  assert.match(md, /GCC 16\.1 released/);
  assert.match(md, /2026-03-25/);
});

test('markdown omits the section when there are no reference articles', () => {
  const issue = issueWithReferences();
  delete issue.reference_articles;
  const md = buildMarkdown(issue);
  assert.doesNotMatch(md, /참고 \/ 더 읽을거리/);
});

test('escapes markdown-breaking titles and uses a safe link destination', () => {
  const issue = issueWithReferences();
  issue.reference_articles = [
    { title: 'Evil] hack', url: 'https://ok.test/x', source: 'Src', published_date: '2026-03-01', note: '참고' }
  ];
  const md = buildMarkdown(issue);
  assert.match(md, /Evil\\\] hack/);
  assert.match(md, /\(<https:\/\/ok\.test\/x>\)/);
  assert.doesNotMatch(md, /\[Evil\] hack\]\(/);
});

test('html renders the reference-articles section with links', () => {
  const html = buildHtml(issueWithReferences());
  assert.match(html, /issue-reference-articles/);
  assert.match(html, /참고 \/ 더 읽을거리/);
  assert.match(html, /href="https:\/\/isocpp\.org\/blog\/gcc-16-1"/);
});
