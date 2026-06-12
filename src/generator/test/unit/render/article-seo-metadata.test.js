'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildHtml } = require('../../../render/newsletter-renderer');
const { SITE_BASE_URL, DEFAULT_OG_IMAGE, missingSeoTags, seoTagUrl } = require('../../../render/seo-metadata');

function baseIssue(overrides = {}) {
  return {
    date: '2026-06-02',
    title: 'Camera HAL / SW Newsletter - 2026-06-02',
    summary: 'CameraX와 V4L2 드라이버 흐름을 정리한 이번 주 뉴스레터입니다.',
    briefing: ['신호 1', '신호 2', '신호 3'],
    sections: [],
    references: [],
    ...overrides
  };
}

test('article page emits all required share/SEO meta tags', () => {
  const html = buildHtml(baseIssue());
  assert.deepEqual(missingSeoTags(html), []);
});

test('article page og:type is article and description comes from the issue summary', () => {
  const html = buildHtml(baseIssue());
  assert.match(html, /<meta property="og:type" content="article"/);
  assert.ok(html.includes('CameraX와 V4L2 드라이버 흐름을 정리한 이번 주 뉴스레터입니다.'));
  assert.equal(seoTagUrl(html, 'og:image'), DEFAULT_OG_IMAGE);
  assert.equal(seoTagUrl(html, 'twitter:image'), DEFAULT_OG_IMAGE);
});

test('daily issue canonical/og:url point at the dated public path', () => {
  const html = buildHtml(baseIssue());
  const expected = `${SITE_BASE_URL}newsletters/2026-06-02/index.html`;
  assert.equal(seoTagUrl(html, 'canonical'), expected);
  assert.equal(seoTagUrl(html, 'og:url'), expected);
});

test('weekly issue canonical/og:url use the weekly_key path', () => {
  const html = buildHtml(baseIssue({ weekly_key: '2026-W23', date: '2026-06-01' }));
  const expected = `${SITE_BASE_URL}newsletters/2026-W23/index.html`;
  assert.equal(seoTagUrl(html, 'canonical'), expected);
  assert.equal(seoTagUrl(html, 'og:url'), expected);
});
