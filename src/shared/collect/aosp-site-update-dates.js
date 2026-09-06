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
  return fetchTextWithLimit(globalThis.fetch, url, { timeoutMs: 5000, maxBytes: 400000 });
}

/**
 * 페이지에서 일 단위 날짜와 그 날짜의 출처를 함께 뽑는다.
 *
 * "Last updated" 표기를 먼저 보고, 없으면 본문의 첫 날짜를 쓴다 — source-monitor 가
 * 스냅샷을 만들 때 쓰는 것과 같은 두 추출기이고 같은 순서다. 어느 쪽이 답했는지에 따라
 * date_source 어휘가 갈리므로(visible_last_updated 는 신뢰도 85, visible_date 는 100)
 * 날짜만 돌려주면 그 구분을 잃는다.
 *
 * 날짜 해석은 explicitDayDate 로 좁힌다. 기본 해석기(firstDateMatch)는 "July 2026" 을
 * new Date() 폴백으로 2026-07-01 까지 만들어 주는데, 그 값을 받으면 월 정밀도 항목을 일
 * 정밀도로 올리면서 아무도 모르는 "1일"을 발행일로 박게 된다.
 *
 * @returns {{date: string, dateSource: string}}
 */
function pageDate(html = '') {
  const lastUpdated = visibleLastUpdated(html, explicitDayDate);
  if (lastUpdated) return { date: lastUpdated, dateSource: 'visible_last_updated' };

  const visible = visibleDate(html, explicitDayDate);
  if (visible) return { date: visible, dateSource: 'visible_date' };

  return { date: '', dateSource: '' };
}

/**
 * 페이지가 말하는 날짜가 그 행이 실린 달 안에 있는지 본다.
 *
 * 페이지의 "Last updated" 는 그 페이지를 **아무 이유로든** 마지막으로 손댄 날이지, 사이트
 * 업데이트 표의 그 행이 말하는 변경이 일어난 날이 아니다. 실측(hl=en):
 *
 *   2026-03 행 "Buy and set up a Gen2 box" → 페이지 2026-08-31 (183일 뒤)
 *   2026-02 행 "Overview"                  → 페이지 2026-06-17 (136일 뒤)
 *
 * 이 값을 그대로 쓰면 몇 달 지난 행이 이번 주 기사 날짜를 얻어 수집 창 안으로 들어온다.
 * 월 정밀도 가드가 막고 있던 바로 그 일이고, 일 정밀도가 붙는 만큼 더 나쁘다.
 * 그래서 같은 달일 때만 올린다.
 */
function describesSameMonth(pageIso, monthIso) {
  return Boolean(pageIso) && pageIso.slice(0, 7) === String(monthIso || '').slice(0, 7);
}

function isMonthPrecision(item = {}) {
  return item.datePrecision === 'month' && Boolean(item.url);
}

/**
 * 표 파서 결과를 그대로 쓰되 월 정밀도 항목의 날짜만 올린다.
 *
 * 날짜를 못 얻거나 그 날짜가 행의 달을 벗어나면 항목을 그대로 둔다. 월 정밀도인 채로 남아
 * 참고 레인에 머무는 것이 지금 동작이고, 못 읽은 날짜를 지어내는 것보다 낫다.
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
  const signalByUrl = new Map();

  for (const url of targets) {
    try {
      // hl=en 은 여기서 붙인다. defaultFetchText 안에만 두면 프로덕션이 늘 주입하는
      // fetchTextImpl 이 그 방어를 지나쳐 기계 번역본을 받는다. 번역본은 원문보다 두 달까지
      // 뒤처지고(실측: 영문 August 2026, 한국어·중국어 June 2026) "Last updated" 표기도
      // 번역돼 날짜를 못 읽는다.
      const signal = pageDate(await fetchText(fetchUrlForContent(url)));
      if (signal.date) signalByUrl.set(url, signal);
    } catch (error) {
      // 날짜 보강은 부가 기능이다. 한 페이지가 실패해도 나머지 후보는 그대로 나가야 한다.
      onDiagnostic?.({
        type: 'aosp_site_update_date_lookup_failed',
        url,
        reason: error?.message || String(error)
      });
    }
  }

  if (signalByUrl.size === 0) return items;

  return items.map(item => {
    const signal = isMonthPrecision(item) ? signalByUrl.get(item.url) : null;
    if (!signal) return item;

    if (!describesSameMonth(signal.date, item.publishedAt)) {
      onDiagnostic?.({
        type: 'aosp_site_update_date_outside_row_month',
        url: item.url,
        reason: `page date ${signal.date} is outside site update month ${item.publishedAt}`
      });
      return item;
    }

    return {
      ...item,
      publishedAt: signal.date,
      datePrecision: 'day',
      // 어휘는 date-signals.js 의 DATE_SOURCES 에 있는 값만 쓴다. 여기서 지어낸 이름을 쓰면
      // quality-deduction-rules 의 validateDateSource 가 후보마다 위반을 붙인다.
      date_source: signal.dateSource,
      // 표가 말한 월은 근거 추적용으로 남긴다. 이 필드가 있다는 것이 곧 대상 페이지에서
      // 날짜를 올렸다는 표시다.
      site_update_month: item.publishedAt
    };
  });
}

module.exports = { resolveAospSiteUpdateItems, pageDate, describesSameMonth, MAX_DATE_LOOKUPS };
