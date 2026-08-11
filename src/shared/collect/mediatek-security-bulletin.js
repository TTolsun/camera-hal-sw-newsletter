// MediaTek 제품 보안 게시판의 월별 페이지를 따라가 CVE 표를 파싱하고, 카메라/이미징 핵심
// CVE를 CVE별 후보로 만든다. 인덱스 페이지에는 월별 링크만 있고 CVE가 하나도 없어서 인덱스
// 파싱만으로는 dated 증거를 만들 수 없다 — Android Security Bulletin(security-bulletin-cve.js)과
// 같은 followed-source 구조다.
//
// 표 구조는 Android 게시판과 다르다. Android는 CVE 한 줄이 한 행인 컬럼 표인데, MediaTek은
// CVE 하나당 표 하나이고 각 행이 라벨/값 쌍(<th>Subcomponent</th><td>imgsensor</td>)이다.
// 그래서 표 파서만 따로 두고, 카메라 판정과 심각도 하한은 Android 게시판과 같은 단일 출처를 쓴다.
//
// 실측 근거(2026-08-11): 2026-08-03 게시판의 CVE-2026-20486(Subcomponent imgsensor,
// CWE-754, 영향 칩셋 11종)이 이 창에서 확인된 유일한 벤더 카메라 코드 신호였는데,
// MediaTek이 소스로 등록돼 있지 않아 뉴스레터가 통째로 놓쳤다.
const { canonicalContentUrl, fetchUrlForContent, fetchTextWithLimit } = require('./source-intelligence-utils');
const {
  CAMERA_MEDIA_PATTERN,
  CVE_PATTERN,
  MONTH_NAMES,
  cleanHtmlText: clean,
  minimumSeverityRank,
  severityRank
} = require('./security-bulletin-shared');

// MediaTek은 2월 링크를 'feb-2026'처럼 줄여 쓴 해가 있다. 월 이름 앞 3글자로 맞춘다.
const MONTH_INDEX = new Map();
for (const [index, name] of MONTH_NAMES.entries()) {
  const lower = name.toLowerCase();
  MONTH_INDEX.set(lower, index + 1);
  MONTH_INDEX.set(lower.slice(0, 3), index + 1);
}

const MONTHLY_LINK_PATTERN = /href="([^"]*\/product-security-bulletin\/([a-z]+)-(20\d{2})(?:\?[^"]*)?)"/gi;

function defaultFetchText(url) {
  return fetchTextWithLimit(globalThis.fetch, fetchUrlForContent(url), { timeoutMs: 8000, maxBytes: 600000 });
}

function monthLabel(month, year) {
  const name = MONTH_NAMES[month - 1];
  return `${name} ${year}`;
}

function sourceHost(source = {}) {
  try {
    return new URL(String(source.sourceUrl || source.url || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// href를 소스 URL 기준으로 절대 URL로 풀고, 등록된 소스와 host가 같을 때만 받아들인다.
// 이 리졸버가 만드는 후보는 official_release_source·mainArticlePolicy=allowed라 그 URL이
// 그대로 main 기사 source binding 증거가 된다. 인덱스 HTML에 섞인 제3자 host 링크를
// 따라가면 남의 페이지를 MediaTek 공식 증거로 싣게 되므로 host를 반드시 묶는다.
function sameHostBulletinUrl(href, source) {
  const host = sourceHost(source);
  if (!host) return '';
  let absolute;
  try {
    absolute = new URL(href, source.sourceUrl || source.url);
  } catch {
    return '';
  }
  if (absolute.hostname.toLowerCase() !== host) return '';
  // `?hsLang=en` 같은 로케일 파라미터는 증거 URL의 일부가 아니다. 발행 링크에 남기지 않는다.
  absolute.search = '';
  return absolute.toString();
}

/**
 * 인덱스 HTML에서 월별 게시판 링크를 뽑아 (연, 월) 기준 가장 최신 한 건을 돌려준다.
 * 등록 소스와 host가 다른 링크는 버린다. 링크가 없으면 null(=이번 실행에서 따라갈 게시판 없음).
 */
function latestMonthlyBulletin(indexHtml = '', source = {}) {
  let latest = null;
  let foreignHostSkips = 0;
  const registeredHost = sourceHost(source);
  if (!registeredHost) {
    // 등록 소스 URL을 못 읽으면 host를 묶을 수 없다. 링크 host가 실제로 다른 경우와 원인이
    // 달라서 사유를 따로 남긴다(같은 카운터로 합치면 사실과 다른 경고가 찍힌다).
    console.warn('mediatek-security-bulletin: registered source URL is unreadable; cannot bind monthly links to a host.');
    return null;
  }
  for (const match of String(indexHtml).matchAll(MONTHLY_LINK_PATTERN)) {
    const month = MONTH_INDEX.get(match[2].toLowerCase());
    if (!month) continue;
    const url = sameHostBulletinUrl(match[1], source);
    if (!url) {
      foreignHostSkips += 1;
      continue;
    }
    const year = Number(match[3]);
    const rank = year * 100 + month;
    if (!latest || rank > latest.rank) {
      latest = { url, month, year, rank };
    }
  }
  if (foreignHostSkips > 0) {
    console.warn(`mediatek-security-bulletin: skipped ${foreignHostSkips} monthly link(s) whose host differs from ${registeredHost}.`);
  }
  if (!latest) {
    // 이 소스는 generic fallback이 막혀 있어 빈 결과가 곧 "이번 달 카메라 CVE 없음"으로 읽힌다.
    // 링크 형태가 바뀌어 매치가 0건이 된 경우와 구분되게 로그를 남긴다.
    console.warn('mediatek-security-bulletin: no monthly bulletin link matched on the index page; no CVE candidates produced.');
  }
  return latest;
}

// 월별 페이지 본문에 'Published 2026-08-03' 형태로 게시일이 적혀 있다.
function bulletinPublishedDate(html = '') {
  const match = /Published[^0-9]{0,12}(20\d{2}-\d{2}-\d{2})/i.exec(clean(html));
  return match ? match[1] : '';
}

function labeledRows(tableHtml) {
  const rows = {};
  for (const match of String(tableHtml).matchAll(/<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    rows[clean(match[1]).toLowerCase()] = clean(match[2]);
  }
  return rows;
}

/**
 * CVE 하나당 표 하나인 월별 페이지를 파싱해 CVE 행 목록을 돌려준다.
 * CVE 값이 없는 표(칩셋 목록 등 부속 표)는 건너뛴다.
 */
function parseMonthlyBulletin(html = '') {
  const rows = [];
  for (const match of String(html).matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const fields = labeledRows(match[0]);
    const cveMatch = CVE_PATTERN.exec(fields.cve || '');
    if (!cveMatch) continue;
    rows.push({
      cve_id: cveMatch[0].toUpperCase(),
      component: fields.subcomponent || '',
      severity: fields.severity || '',
      cwe: fields.cwe || '',
      description: fields.description || '',
      chipsets: fields['affected chipsets'] || ''
    });
  }
  return rows;
}

function isCameraOrImaging(row) {
  return CAMERA_MEDIA_PATTERN.test(`${row.component} ${row.cwe} ${row.description}`);
}

function buildCveItem(row, bulletin, source) {
  const label = monthLabel(bulletin.month, bulletin.year);
  const baseUrl = canonicalContentUrl(String(bulletin.url || '').split('#')[0]);
  const anchor = `#${row.cve_id.toUpperCase().replace(/-/g, '_')}`;
  const chipsets = row.chipsets ? ` 영향 칩셋: ${row.chipsets}.` : '';
  const weakness = row.cwe ? ` (${row.cwe})` : '';
  // severity는 심각도 하한 필터를 통과한 행만 여기 오므로 항상 값이 있다.
  return {
    source,
    title: `${label} MediaTek Security Bulletin: ${row.cve_id} — ${row.component}`,
    url: baseUrl ? `${baseUrl}${anchor}` : '',
    publishedAt: bulletin.publishedAt,
    sourceKind: 'release_note_item',
    version_or_release: row.cve_id,
    api_or_component: `MediaTek Security Bulletin / ${row.component}`,
    behavior_change:
      `${row.description || 'Security fix'}${weakness} — ${row.severity} severity fix shipped in the ${label} MediaTek Security Bulletin (${row.cve_id}).${chipsets}`,
    // Android 게시판은 framework/system 섹션이 섞여 있어 행마다 버킷을 유도하지만, MediaTek은
    // 벤더 SoC 커널 컴포넌트(imgsensor/imgsys)만 카메라로 잡히므로 항상 driver/image pipeline이다.
    relevanceBucketHint: 'camera_driver_image_pipeline',
    cve_id: row.cve_id,
    severity: row.severity
  };
}

/**
 * 인덱스 HTML에서 최신 월별 게시판을 찾아 fetch하고, 카메라/이미징 CVE를 후보로 반환한다.
 * 게시판을 못 가져오거나(네트워크/구조 변경) 게시일이 없거나 관련 CVE가 없으면 빈 배열을 반환한다.
 */
async function resolveMediatekSecurityBulletinItems(indexHtml = '', source = {}, options = {}) {
  const fetchTextImpl = options.fetchTextImpl || defaultFetchText;
  const maxItems = Number.isFinite(options.maxItems) ? Math.max(0, options.maxItems) : 10;
  const minRank = minimumSeverityRank(options.minSeverity);

  const latest = latestMonthlyBulletin(indexHtml, source);
  if (!latest) return [];

  // 아래 실패 경로는 전부 빈 배열로 끝난다. 이 소스는 generic fallback이 막혀 있어 빈 결과가
  // 곧 "이번 달 카메라 CVE 없음"으로 읽히므로, 신호 없음과 구조 변경/네트워크 장애를 구분할 수
  // 있게 각 경로에 사유를 남긴다.
  let html;
  try {
    html = await fetchTextImpl(latest.url);
  } catch (error) {
    console.warn(`mediatek-security-bulletin: failed to fetch ${latest.url}: ${error && error.message}`);
    return [];
  }
  if (!html) {
    console.warn(`mediatek-security-bulletin: ${latest.url} returned an empty body.`);
    return [];
  }

  // 게시일이 없으면 날짜를 추정하지 않는다. dated 증거 없는 후보는 어차피 main이 될 수 없고,
  // 월 첫날로 채우면 선정 창이 실제보다 오래된 신호로 오해한다.
  const publishedAt = bulletinPublishedDate(html);
  if (!publishedAt) {
    console.warn(`mediatek-security-bulletin: ${latest.url} has no Published date; no CVE candidates produced.`);
    return [];
  }

  const bulletin = { ...latest, publishedAt };
  const rows = parseMonthlyBulletin(html);
  if (rows.length === 0) {
    console.warn(`mediatek-security-bulletin: ${bulletin.url} yielded no CVE table rows; the page structure may have changed.`);
  }
  const relevant = rows
    .filter(row => isCameraOrImaging(row) && severityRank(row.severity) >= minRank)
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));

  if (relevant.length > maxItems) {
    console.warn(`mediatek-security-bulletin: ${bulletin.url} yielded ${relevant.length} camera CVEs; keeping top ${maxItems} by severity, dropping ${relevant.length - maxItems}.`);
  }

  return relevant.slice(0, maxItems).map(row => buildCveItem(row, bulletin, source));
}

module.exports = {
  resolveMediatekSecurityBulletinItems
};
