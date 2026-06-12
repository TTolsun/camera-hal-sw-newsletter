'use strict';

// Weekly newsletter identity model (#486, foundation for the daily->weekly publication model).
//
// This module is intentionally additive and pure: it derives ISO-week identity, week bounds, the
// public route, and the metadata shape for a weekly newsletter. It does NOT change daily generation
// or the daily public output. Pipeline wiring (weekly page rendering, weekly index, archive/homepage
// resolution, fixture migration) is deferred to the follow-up children of #485 (#487-#492).

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKLY_KEY_PATTERN = /^(\d{4})-W(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(date) {
  const match = DATE_PATTERN.exec(String(date || '').trim());
  if (!match) {
    throw new Error(`weekly newsletter date must be YYYY-MM-DD: ${date}`);
  }
  const [, year, month, day] = match;
  const utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    utc.getUTCFullYear() !== Number(year) ||
    utc.getUTCMonth() !== Number(month) - 1 ||
    utc.getUTCDate() !== Number(day)
  ) {
    throw new Error(`weekly newsletter date must be YYYY-MM-DD: ${date}`);
  }
  return utc;
}

function formatDate(utc) {
  const year = String(utc.getUTCFullYear()).padStart(4, '0');
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Days from Monday (Mon=0 .. Sun=6), so ISO weeks start on Monday.
function isoWeekdayIndex(utc) {
  return (utc.getUTCDay() + 6) % 7;
}

function thursdayOfWeek(utc) {
  const thursday = new Date(utc);
  thursday.setUTCDate(utc.getUTCDate() - isoWeekdayIndex(utc) + 3);
  return thursday;
}

// ISO 8601 week number and week-numbering year (the year of the week's Thursday).
function isoWeekParts(utc) {
  const thursday = thursdayOfWeek(utc);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = thursdayOfWeek(new Date(Date.UTC(isoYear, 0, 4)));
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return { isoYear, week };
}

function weeklyKeyForDate(date) {
  const { isoYear, week } = isoWeekParts(parseDate(date));
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

function weekBoundsForDate(date) {
  const utc = parseDate(date);
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - isoWeekdayIndex(utc));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weeklyKey: weeklyKeyForDate(date),
    weekStartDate: formatDate(monday),
    weekEndDate: formatDate(sunday)
  };
}

function isValidWeeklyKey(weeklyKey) {
  const match = WEEKLY_KEY_PATTERN.exec(String(weeklyKey || ''));
  if (!match) return false;
  const week = Number(match[2]);
  return week >= 1 && week <= 53;
}

// The Monday whose ISO week is `weeklyKey`. Week 1 is the week containing that year's first Thursday.
function mondayOfWeeklyKey(weeklyKey) {
  if (!isValidWeeklyKey(weeklyKey)) {
    throw new Error(`weekly key must be YYYY-Www: ${weeklyKey}`);
  }
  const [, isoYear, week] = WEEKLY_KEY_PATTERN.exec(weeklyKey);
  const firstThursday = thursdayOfWeek(new Date(Date.UTC(Number(isoYear), 0, 4)));
  const thursday = new Date(firstThursday);
  thursday.setUTCDate(firstThursday.getUTCDate() + (Number(week) - 1) * 7);
  const monday = new Date(thursday);
  monday.setUTCDate(thursday.getUTCDate() - 3);
  return monday;
}

function weekBoundsForKey(weeklyKey) {
  return weekBoundsForDate(formatDate(mondayOfWeeklyKey(weeklyKey)));
}

function weeklyNewsletterRoute(weeklyKey) {
  if (!isValidWeeklyKey(weeklyKey)) {
    throw new Error(`weekly key must be YYYY-Www: ${weeklyKey}`);
  }
  return `newsletters/${weeklyKey}.html`;
}

// Directory-form routes mirror the daily newsletters/<id>/{index.html,newsletter.md} contract that
// validators, the archive href allow-list, and the commit allow-list assume, keeping the blast radius
// of weekly wiring to a token widening (date -> date|weeklyKey) rather than a structural rewrite.
function weeklyNewsletterIndexRoute(weeklyKey) {
  if (!isValidWeeklyKey(weeklyKey)) {
    throw new Error(`weekly key must be YYYY-Www: ${weeklyKey}`);
  }
  return `newsletters/${weeklyKey}/index.html`;
}

function weeklyNewsletterMarkdownRoute(weeklyKey) {
  if (!isValidWeeklyKey(weeklyKey)) {
    throw new Error(`weekly key must be YYYY-Www: ${weeklyKey}`);
  }
  return `newsletters/${weeklyKey}/newsletter.md`;
}

function weeklyNewsletterMetadata({ date, weeklyKey, title } = {}) {
  const bounds = date ? weekBoundsForDate(date) : weekBoundsForKey(weeklyKey);
  return {
    weeklyKey: bounds.weeklyKey,
    weekStartDate: bounds.weekStartDate,
    weekEndDate: bounds.weekEndDate,
    title: String(title || '').trim() || `Camera HAL Weekly ${bounds.weeklyKey}`,
    url: weeklyNewsletterRoute(bounds.weeklyKey)
  };
}

module.exports = {
  isValidWeeklyKey,
  weekBoundsForDate,
  weekBoundsForKey,
  weeklyKeyForDate,
  weeklyNewsletterIndexRoute,
  weeklyNewsletterMarkdownRoute,
  weeklyNewsletterMetadata,
  weeklyNewsletterRoute
};
