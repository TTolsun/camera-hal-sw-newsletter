const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeHeadlineImageUrl
} = require('../../../scripts/newsroom/common/homepage-headline');

const NEWSLETTER_URL = 'newsletters/2026-05-29/index.html';

test('newsletter-page-relative path is resolved to repo-root-relative path', () => {
  assert.equal(
    normalizeHeadlineImageUrl('../../assets/images/fallback/android.svg', NEWSLETTER_URL),
    'assets/images/fallback/android.svg'
  );
});

test('https URL is returned unchanged', () => {
  const url = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjd6QUmqCnkvDT9M0IoWA6y_752MRk01nHVQOa644yYkgoMGMDk8Dy6ow6X4SqFzzODP-a1kRaNcuF-1ZyR_lk5fTfdbuEMKDvuX4s7LFaGNuMswzvMCFoYeaQ3RLf2OZPYUWN5BsnqRIsmDub85hpYZNGY7AsaHCsHlfkxLqfqm0PozMhkyqK4i6WfgGM/s2048/image.png';
  assert.equal(normalizeHeadlineImageUrl(url, NEWSLETTER_URL), url);
});

test('already root-relative path that does not escape is returned as-is and does not start with ..', () => {
  const result = normalizeHeadlineImageUrl('assets/images/fallback/ai.svg', NEWSLETTER_URL);
  assert.equal(result.startsWith('..'), false);
  assert.equal(result, 'assets/images/fallback/ai.svg');
});

test('empty input returns empty string', () => {
  assert.equal(normalizeHeadlineImageUrl('', NEWSLETTER_URL), '');
  assert.equal(normalizeHeadlineImageUrl(null, NEWSLETTER_URL), '');
  assert.equal(normalizeHeadlineImageUrl(undefined, NEWSLETTER_URL), '');
});
