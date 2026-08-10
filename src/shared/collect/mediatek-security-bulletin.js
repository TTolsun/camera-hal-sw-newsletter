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
const { decodeHtml } = require('../common/common');
const { canonicalContentUrl, fetchUrlForContent, fetchTextWithLimit } = require('./source-intelligence-utils');
const { CAMERA_MEDIA_PATTERN, severityRank, SEVERITY_RANK } = require('./security-bulletin-cve');

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

// MediaTek은 2월 링크를 'feb-2026'처럼 줄여 쓴 해가 있다. 월 이름 앞 3글자로 맞춘다.
const MONTH_INDEX = new Map();
for (const [index, name] of MONTH_NAMES.entries()) {
  MONTH_INDEX.set(name, index + 1);
  MONTH_INDEX.set(name.slice(0, 3), index + 1);
}

const CVE_PATTERN = /CVE-\d{4}-\d{4,}/i;
const MONTHLY_LINK_PATTERN = /href="([^"]*\/product-security-bulletin\/([a-z]+)-(20\d{2})(?:\?[^"]*)?)"/gi;

function defaultFetchText(url) {
  return fetchTextWithLimit(globalThis.fetch, fetchUrlForContent(url), { timeoutMs: 8000, maxBytes: 600000 });
}

function clean(html = '') {
  const stripped = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  return decodeHtml(stripped).replace(/\s+/g, ' ').trim();
}

function monthLabel(month, year) {
  const name = MONTH_NAMES[month - 1];
  return name ? `${name[0].toUpperCase()}${name.slice(1)} ${year}` : String(year);
}

/**
 * 인덱스 HTML에서 월별 게시판 링크를 뽑아 (연, 월) 기준 가장 최신 한 건을 돌려준다.
 * 링크가 없으면 null(=이번 실행에서 따라갈 게시판 없음).
 */
function latestMonthlyBulletin(indexHtml = '') {
  let latest = null;
  for (const match of String(indexHtml).matchAll(MONTHLY_LINK_PATTERN)) {
    const month = MONTH_INDEX.get(match[2].toLowerCase());
    if (!month) continue;
    const year = Number(match[3]);
    const rank = year * 100 + month;
    if (!latest || rank > latest.rank) {
      latest = { url: match[1], month, year, rank };
    }
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
  return {
    source,
    title: `${label} MediaTek Security Bulletin: ${row.cve_id} — ${row.component}`,
    url: baseUrl ? `${baseUrl}${anchor}` : '',
    publishedAt: bulletin.publishedAt,
    sourceKind: 'release_note_item',
    version_or_release: row.cve_id,
    api_or_component: `MediaTek Security Bulletin / ${row.component}`,
    behavior_change:
      `${row.description || 'Security fix'}${weakness} — ${row.severity || 'unspecified'} severity fix shipped in the ${label} MediaTek Security Bulletin (${row.cve_id}).${chipsets}`,
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
  const minRank = severityRank(options.minSeverity || 'moderate') || SEVERITY_RANK.moderate;

  const latest = latestMonthlyBulletin(indexHtml);
  if (!latest) return [];

  let html;
  try {
    html = await fetchTextImpl(latest.url);
  } catch {
    return [];
  }
  if (!html) return [];

  // 게시일이 없으면 날짜를 추정하지 않는다. dated 증거 없는 후보는 어차피 main이 될 수 없고,
  // 월 첫날로 채우면 선정 창이 실제보다 오래된 신호로 오해한다.
  const publishedAt = bulletinPublishedDate(html);
  if (!publishedAt) return [];

  const bulletin = { ...latest, publishedAt };
  const relevant = parseMonthlyBulletin(html)
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
