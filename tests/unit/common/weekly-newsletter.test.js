'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  weeklyKeyForDate,
  weekBoundsForDate,
  weeklyNewsletterRoute,
  weeklyNewsletterMetadata,
  isValidWeeklyKey
} = require('../../../scripts/newsroom/common/weekly-newsletter');

// The issue #486 worked example: a date in ISO week 23 of 2026 maps to 2026-W23,
// whose Monday is 2026-06-01 and Sunday is 2026-06-07.
test('weeklyKeyForDate returns the ISO week-numbering key YYYY-Www', () => {
  assert.equal(weeklyKeyForDate('2026-06-04'), '2026-W23');
  assert.equal(weeklyKeyForDate('2026-06-01'), '2026-W23');
  assert.equal(weeklyKeyForDate('2026-06-07'), '2026-W23');
  assert.equal(weeklyKeyForDate('2026-06-08'), '2026-W24');
});

test('weeklyKeyForDate pads single-digit weeks to two digits', () => {
  // 2026-01-01 falls in ISO week 1.
  assert.equal(weeklyKeyForDate('2026-01-01'), '2026-W01');
});

test('weeklyKeyForDate uses the ISO week-numbering year across the year boundary', () => {
  // 2026-12-31 is a Thursday in ISO week 53 of 2026.
  assert.equal(weeklyKeyForDate('2026-12-31'), '2026-W53');
  // 2027-01-01 (Friday) still belongs to ISO week 53 of 2026.
  assert.equal(weeklyKeyForDate('2027-01-01'), '2026-W53');
});

test('weekBoundsForDate returns Monday..Sunday bounds and the weekly key', () => {
  assert.deepEqual(weekBoundsForDate('2026-06-04'), {
    weeklyKey: '2026-W23',
    weekStartDate: '2026-06-01',
    weekEndDate: '2026-06-07'
  });
});

test('weeklyNewsletterRoute builds the weekly public page route', () => {
  assert.equal(weeklyNewsletterRoute('2026-W23'), 'newsletters/2026-W23.html');
});

test('weeklyNewsletterMetadata produces the documented metadata shape', () => {
  assert.deepEqual(weeklyNewsletterMetadata({ date: '2026-06-04' }), {
    weeklyKey: '2026-W23',
    weekStartDate: '2026-06-01',
    weekEndDate: '2026-06-07',
    title: 'Camera HAL Weekly 2026-W23',
    url: 'newsletters/2026-W23.html'
  });
});

test('weeklyNewsletterMetadata accepts an explicit title and a weekly key', () => {
  const meta = weeklyNewsletterMetadata({ weeklyKey: '2026-W23', title: 'Custom Title' });
  assert.equal(meta.weeklyKey, '2026-W23');
  assert.equal(meta.title, 'Custom Title');
  assert.equal(meta.url, 'newsletters/2026-W23.html');
  assert.equal(meta.weekStartDate, '2026-06-01');
  assert.equal(meta.weekEndDate, '2026-06-07');
});

test('isValidWeeklyKey accepts well-formed keys and rejects malformed ones', () => {
  assert.equal(isValidWeeklyKey('2026-W23'), true);
  assert.equal(isValidWeeklyKey('2026-W01'), true);
  assert.equal(isValidWeeklyKey('2026-W53'), true);
  assert.equal(isValidWeeklyKey('2026-W00'), false);
  assert.equal(isValidWeeklyKey('2026-W54'), false);
  assert.equal(isValidWeeklyKey('2026-06-04'), false);
  assert.equal(isValidWeeklyKey('2026-W3'), false);
  assert.equal(isValidWeeklyKey(''), false);
});

test('weeklyKeyForDate rejects a malformed date', () => {
  assert.throws(() => weeklyKeyForDate('2026/06/04'), /YYYY-MM-DD/);
  assert.throws(() => weeklyKeyForDate('not-a-date'), /YYYY-MM-DD/);
});
