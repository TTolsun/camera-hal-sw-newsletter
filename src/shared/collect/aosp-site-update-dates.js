// AOSP Site Updates 후보의 월 정밀도 날짜를 대상 페이지의 실제 날짜로 올린다.
//
// parseAospSiteUpdates 는 사이트 업데이트 표의 월별 묶음 제목에서 날짜를 읽으므로
// "2026년 7월"까지만 안다(datePrecision: 'month'). 선정은 월 정밀도를 참고 레인까지만
// 구제하고 catch-up 승격에서 제외한다 — 모르는 날짜를 기사 날짜로 발행하지 않겠다는
// 규칙이고 그 자체는 옳다.
//
// 그런데 날짜를 모르는 게 아니다. 표가 가리키는 페이지에는 일 단위 날짜가 적혀 있다.
// 실측: /docs/compatibility/cts/camera-its-tests 는 표에서 "July 2026" 이지만 페이지에는
// visible_date 2026-07-13 이 있다.
//
// 후보를 만드는 쪽(표 파서)은 대상 페이지를 열지 않고, 페이지를 읽는 쪽(source-monitor)은
// seed_urls 에 있는 페이지만 본다. 그 사이를 여기서 잇는다.
//
// 배경과 대안 비교는 retrieval 저장소의 docs/aosp-site-updates-date-precision.md 에 있다.

const { parseSourceSpecificItems } = require('./source-item-parsers');
const { fetchTextWithLimit, fetchUrlForContent } = require('./source-intelligence-utils');
const { explicitDayDate, visibleDate, visibleLastUpdated } = require('./source-monitor');

// parseAospSiteUpdates 가 한 번에 최대 12건을 내보낸다(카메라 관련 행만 남긴 뒤 slice).
// 그 상한을 그대로 따른다 — 표가 커져도 fetch 가 그보다 늘지 않는다.
const MAX_DATE_LOOKUPS = 12;

function defaultFetchText(url) {
  // source.android.com 은 Accept-Language 에 따라 기계 번역본을 준다. 번역본은 원문보다
  // 두 달까지 뒤처지고(실측: 영문 August 2026, 한국어·중국어 June 2026), "Last updated" 표기도
  // 번역돼 날짜를 못 읽는다. fetchUrlForContent 가 hl=en 을 붙여 원문을 강제한다 —
  // security-bulletin-cve.js 가 같은 이유로 이미 쓰고 있는 방어다.
  return fetchTextWithLimit(globalThis.fetch, fetchUrlForContent(url), { timeoutMs: 5000, maxBytes: 400000 });
}

/**
 * 페이지에서 일 단위 날짜를 뽑는다.
 * "Last updated" 표기를 먼저 보고, 없으면 본문의 첫 날짜를 쓴다 — source-monitor 가
 * 스냅샷을 만들 때 쓰는 것과 같은 두 추출기이고 같은 순서다.
 *
 * 다만 날짜 해석은 explicitDayDate 로 좁힌다. 기본 해석기(firstDateMatch)는 "July 2026" 을
 * new Date() 폴백으로 2026-07-01 까지 만들어 주는데, 그 값을 받으면 월 정밀도 항목을 일
 * 정밀도로 올리면서 아무도 모르는 "1일"을 발행일로 박게 된다. 그것은 이 모듈이 하지
 * 않겠다고 정한 바로 그 일이다.
 */
function pageDate(html = '') {
  return visibleLastUpdated(html, explicitDayDate) || visibleDate(html, explicitDayDate);
}

function isMonthPrecision(item = {}) {
  return item.datePrecision === 'month' && Boolean(item.url);
}

/**
 * 표 파서 결과를 그대로 쓰되 월 정밀도 항목의 날짜만 올린다.
 *
 * 날짜를 못 얻으면 항목을 그대로 둔다. 월 정밀도인 채로 남아 참고 레인에 머무는 것이
 * 지금 동작이고, 못 읽은 날짜를 지어내는 것보다 낫다.
 *
 * @param {string} html 사이트 업데이트 인덱스 HTML
 * @param {object} source 소스 정의
 * @param {object} [deps]
 * @param {(url: string) => Promise<string>} [deps.fetchTextImpl] 테스트 주입구
 * @param {(event: object) => void} [deps.onDiagnostic]
 */
async function resolveAospSiteUpdateItems(html, source, { fetchTextImpl, onDiagnostic } = {}) {
  const items = parseSourceSpecificItems(html, source);
  const fetchText = fetchTextImpl || defaultFetchText;

  // 같은 URL 이 여러 행에 나올 수 있다. 페이지는 한 번만 가져온다.
  const targets = [...new Set(items.filter(isMonthPrecision).map(item => item.url))]
    .slice(0, MAX_DATE_LOOKUPS);
  const dateByUrl = new Map();

  for (const url of targets) {
    try {
      const date = pageDate(await fetchText(url));
      if (date) dateByUrl.set(url, date);
    } catch (error) {
      // 날짜 보강은 부가 기능이다. 한 페이지가 실패해도 나머지 후보는 그대로 나가야 한다.
      onDiagnostic?.({ type: 'aosp_site_update_date_lookup_failed', url, reason: error.message });
    }
  }

  if (dateByUrl.size === 0) return items;

  return items.map(item => {
    const date = isMonthPrecision(item) ? dateByUrl.get(item.url) : '';
    if (!date) return item;
    return {
      ...item,
      publishedAt: date,
      datePrecision: 'day',
      // 어디서 온 날짜인지 남긴다. 표의 월 값과 다른 값이 실릴 때 근거를 추적할 수 있어야 한다.
      date_source: 'aosp_site_update_target_page',
      site_update_month: item.publishedAt
    };
  });
}

module.exports = { resolveAospSiteUpdateItems, pageDate, MAX_DATE_LOOKUPS };
