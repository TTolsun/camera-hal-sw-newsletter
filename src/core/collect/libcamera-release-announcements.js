// libcamera 릴리스 공지는 pipermail 아카이브의 인덱스 페이지(월 목록)에만 연결돼 있어
// parseLibcameraReleaseAnnouncement가 인덱스에서는 version/date를 못 찾아 source-gap이 됐다.
// 인덱스 -> 최근 월 아카이브(date.html) -> "libcamera vX.Y.Z released" 메시지를 따라가
// 메시지 페이지를 기존 파서로 재사용해 dated 릴리스 후보를 만든다(security-bulletin-cve.js와 동일 패턴).
// libcamera 릴리스는 분기 단위라 최신 월에는 릴리스가 없을 때가 많아, lookback(~90일)을 덮도록
// 최근 몇 개월을 최신순으로 훑어 가장 최근 릴리스를 찾는다.
const { parseSourceSpecificItems } = require('./source-item-parsers');
const { fetchTextWithLimit } = require('./source-intelligence-utils');
const { decodeHtml } = require('../common/common');

const MONTH_NUMBER = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12
};

const RELEASE_SUBJECT_PATTERN = /libcamera\s+v?\d+\.\d+(?:\.\d+)?\s+released/i;
const REPLY_SUBJECT_PATTERN = /\bre:/i;
const MAX_MONTH_ARCHIVES = 4;

function defaultFetchText(url) {
  return fetchTextWithLimit(globalThis.fetch, url, { timeoutMs: 5000, maxBytes: 400000 });
}

function absolute(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

function cleanText(html = '') {
  return decodeHtml(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function anchors(html) {
  const list = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    list.push({ href: match[1], text: cleanText(match[2]) });
  }
  return list;
}

// 인덱스 HTML에서 월 아카이브 디렉터리(YYYY-Month)를 최신순으로 모은다.
function monthDirsNewestFirst(indexHtml) {
  const seen = new Map();
  const pattern = /(\d{4})-([A-Za-z]{3,9})(?=[/"'])/g;
  let match;
  while ((match = pattern.exec(indexHtml)) !== null) {
    const month = MONTH_NUMBER[match[2].toLowerCase()];
    if (!month) continue;
    const dir = `${match[1]}-${match[2]}`;
    if (!seen.has(dir)) seen.set(dir, { dir, year: Number(match[1]), month });
  }
  return [...seen.values()]
    .sort((left, right) => right.year - left.year || right.month - left.month)
    .map(entry => entry.dir);
}

// 월 아카이브 목록에서 원본 "libcamera vX.Y.Z released" 메시지 링크를 찾는다(답장 Re: 제외).
function releaseMessageHref(monthHtml) {
  const link = anchors(monthHtml).find(anchor =>
    RELEASE_SUBJECT_PATTERN.test(anchor.text) &&
    !REPLY_SUBJECT_PATTERN.test(anchor.text) &&
    /\.html?$/i.test(anchor.href));
  return link ? link.href : '';
}

async function releaseItemsForMonth(dir, base, source, fetchTextImpl) {
  const listingUrl = absolute(`${dir}/date.html`, base);
  if (!listingUrl) return [];
  const monthHtml = await fetchTextImpl(listingUrl);
  if (!monthHtml) return [];
  const messageHref = releaseMessageHref(monthHtml);
  if (!messageHref) return [];
  const messageUrl = absolute(messageHref, listingUrl);
  if (!messageUrl) return [];
  const messageHtml = await fetchTextImpl(messageUrl);
  if (!messageHtml) return [];
  return parseSourceSpecificItems(messageHtml, { ...source, url: messageUrl, sourceUrl: messageUrl });
}

/**
 * pipermail 인덱스 HTML을 받아 최근 월 아카이브를 최신순으로 훑어 가장 최근 릴리스 공지를
 * 따라가 dated 릴리스 후보를 반환한다. 한 달 fetch가 실패해도 다음 달로 넘어가며,
 * 어느 달에서도 릴리스를 못 찾으면 빈 배열을 반환한다(graceful).
 */
async function resolveLibcameraReleaseAnnouncementItems(indexHtml = '', source = {}, options = {}) {
  const fetchTextImpl = options.fetchTextImpl || defaultFetchText;
  const indexUrl = source.url || source.sourceUrl || '';
  const base = indexUrl.endsWith('/') ? indexUrl : `${indexUrl}/`;

  for (const dir of monthDirsNewestFirst(indexHtml).slice(0, MAX_MONTH_ARCHIVES)) {
    try {
      const items = await releaseItemsForMonth(dir, base, source, fetchTextImpl);
      if (items.length > 0) return items;
    } catch {
      // 이 달 아카이브를 못 읽으면 다음(과거) 달로 넘어간다.
    }
  }
  return [];
}

module.exports = {
  resolveLibcameraReleaseAnnouncementItems
};
