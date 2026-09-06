// Qualcomm 제품 보안 게시판의 월별 문서를 따라가 CVE 표를 파싱하고, 카메라/이미징 CVE를
// CVE별 후보로 만든다. MediaTek(mediatek-security-bulletin.js)과 같은 followed-source 구조지만
// 진입 경로가 다르다 — 등록된 인덱스 URL은 Angular SPA 셸이라 서버 HTML에 링크가 0개다.
// 그래서 인덱스 HTML을 파싱하지 않고 이 사이트의 공개 검색 API로 월별 문서를 해결한다.
//
// 왜 세 홉인가(2026-09-06 실측):
//   1. 검색 POST  - 연도 경로로 그 해 게시판 목록을 받는다. title/publishedOn/url/dcn이 나온다.
//   2. 본문 GET   - 문서 본문은 `/bundle/publicresource/<dcn>/topics/<slug>`에만 있다. dcn은
//                   1에서만 얻을 수 있고, Referer가 없으면 404다.
//   3. 표 파싱    - 본문의 5열 표(Public ID/Security Rating/CVSS Rating/Technology Area/
//                   Date Reported)에서 카메라 계열 행을 고른다.
// 등록 URL을 그대로 긁으면 어느 경로든 같은 셸(51,988 B)만 오고, sitemap.xml에는 dcn이 없다.
//
// 이 리졸버가 등록되는 순간 이 소스의 제너릭 폴백은 자동으로 꺼진다
// (`shouldSuppressGenericFallback`의 첫 절이 `followedSourceResolverIds()`다). 게다가 이 소스는
// `source-item-parsers.js`의 PARSERS에 없어 인덱스 폴백도 없다 — 빈 결과가 곧 후보 0건이다.
// 그래서 실패 경로마다 사유를 남겨 "이번 창에 카메라 CVE 없음"과 "구조 변경/네트워크 장애"를
// 구분할 수 있게 한다.
'use strict';

const { canonicalContentUrl } = require('./source-intelligence-utils');
const {
  CAMERA_MEDIA_PATTERN,
  CVE_PATTERN,
  cleanHtmlText: clean,
  minimumSeverityRank,
  severityRank
} = require('./security-bulletin-shared');

const SEARCH_PATH = '/bundle/publicresource/globalsearch';
// 이 사이트에서 Security Bulletins 제품을 가리키는 id다. 등록 URL에서 유도할 수 없어 값으로 둔다.
// 검색 필터의 경로는 `<제품 id>/<연도> Security Bulletins` 모양이고, 연도 단위로 물어야 한다 —
// 제품 id만 넣으면 전 연도가 섞여 나오고, 월까지 붙이면 월마다 한 번씩 물어야 한다.
const BULLETIN_PRODUCT_ID = 'PDC20903';
const BULLETIN_INDEX_PATH = '/product/publicresources/securitybulletin';
// 본문 GET은 Referer가 없으면 404다. 같은 사이트의 게시판 인덱스를 참조자로 보낸다.
const SEARCH_ROWS = 50;
const MAX_BULLETIN_BODIES = 3;
const MAX_SEARCH_BYTES = 300 * 1024;
const MAX_BODY_BYTES = 400 * 1024;

function sourceOrigin(source = {}) {
  try {
    return new URL(String(source.sourceUrl || source.url || '')).origin;
  } catch {
    return '';
  }
}

function searchPayload(year) {
  // 브라우저가 실제로 보내는 요청과 같은 모양이다. sortFields를 비우거나 filterFields에 연도
  // 없이 제품 id만 넣으면 서버가 500을 돌려준다(실측).
  return JSON.stringify({
    start: 0,
    rows: SEARCH_ROWS,
    searchText: '',
    sortFields: [{ field: 'score', order: 'desc' }],
    filterFields: [{
      field: 'pkDocumentPath',
      values: [`${BULLETIN_PRODUCT_ID}/${year} Security Bulletins`]
    }],
    filterFieldsQuery: [],
    IsFacetSearch: false,
    IsCustomSearch: false,
    IsProductContext: false
  });
}

function parseIsoDay(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

// 본문이 스스로 밝히는 발행일이 정본이다. 검색 목록의 publishedOn은 재발행 타임스탬프라
// 문서 발행월과 어긋나는 경우가 있어 창 사전 필터로만 쓴다.
function bodyPublishedDate(html = '') {
  const match = String(html).match(/Published:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!match) return '';
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

// 본문 URL은 목록이 준 dcn과 문서 slug로만 만들어진다. slug는 목록 url의 마지막 경로 조각이다.
function bulletinBodyUrl(origin, dcn, listedUrl) {
  const slug = String(listedUrl || '').split('?')[0].split('#')[0].split('/').filter(Boolean).pop();
  if (!origin || !dcn || !slug) return '';
  return `${origin}/bundle/publicresource/${encodeURIComponent(dcn)}/topics/${slug}`;
}

/**
 * 본문의 CVE 표를 행 단위로 파싱한다. 열은 Public ID / Security Rating / CVSS Rating /
 * Technology Area / Date Reported 다섯 개이고, 그 순서를 가정한다. 열이 다섯 개가 아니거나
 * 첫 칸에 CVE가 없는 행(부속 표)은 건너뛴다.
 */
function parseBulletinRows(html = '') {
  const rows = [];
  for (const rowMatch of String(html).matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const cells = [...rowMatch[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => clean(cell[1]));
    if (cells.length !== 5) continue;
    const cve = CVE_PATTERN.exec(cells[0]);
    if (!cve) continue;
    rows.push({
      cve_id: cve[0].toUpperCase(),
      severity: cells[1],
      cvss: cells[2],
      technology_area: cells[3],
      date_reported: cells[4]
    });
  }
  return rows;
}

function isCameraRow(row) {
  return CAMERA_MEDIA_PATTERN.test(row.technology_area);
}

function buildCveItem(row, bulletin, source) {
  const baseUrl = canonicalContentUrl(String(bulletin.url || '').split('#')[0]);
  const reported = row.date_reported ? ` 최초 보고 ${row.date_reported}.` : '';
  const cvss = row.cvss ? ` CVSS ${row.cvss}.` : '';
  return {
    source,
    title: `${bulletin.title}: ${row.cve_id} — ${row.technology_area}`,
    url: baseUrl,
    publishedAt: bulletin.publishedAt,
    sourceKind: 'release_note_item',
    version_or_release: row.cve_id,
    api_or_component: `Qualcomm Security Bulletin / ${row.technology_area}`,
    behavior_change:
      `${row.severity} severity fix shipped in the ${bulletin.title} (${row.cve_id}, ${row.technology_area}).${cvss}${reported}`,
    // Technology Area가 Camera/Camera Driver 같은 벤더 SoC 컴포넌트 라벨이라 항상 driver/ISP 층이다.
    relevanceBucketHint: 'camera_driver_image_pipeline',
    cve_id: row.cve_id,
    severity: row.severity
  };
}

function windowYears(now, lookbackDays) {
  const end = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const days = Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 7;
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
  return {
    years: [...years].sort((a, b) => b - a),
    startDay: start.toISOString().slice(0, 10),
    endDay: end.toISOString().slice(0, 10)
  };
}

async function readJson(fetchClient, url, body) {
  const response = await fetchClient.fetchBounded(url, {
    method: 'POST',
    body,
    contentType: 'text/plain',
    accept: 'application/json, text/plain, */*',
    maxBytes: MAX_SEARCH_BYTES
  });
  if (!response.ok) throw new Error(response.error || `http_${response.status}`);
  return JSON.parse(response.body);
}

/**
 * 수집 창 안에 발행된 Qualcomm 보안 게시판을 찾아 카메라/이미징 CVE를 후보로 반환한다.
 * 검색이 실패하거나, 창 안 게시판이 없거나, 본문에 발행일이 없거나, 카메라 행이 없으면
 * 빈 배열을 반환한다. 각 경로는 사유를 남긴다.
 */
async function resolveQualcommSecurityBulletinItems({
  source = {},
  fetchClient,
  now,
  lookbackDays,
  maxItems = 10,
  minSeverity
} = {}) {
  if (!fetchClient) {
    console.warn('qualcomm-security-bulletin: no bounded fetch client was provided; the resolver cannot run.');
    return [];
  }
  const origin = sourceOrigin(source);
  if (!origin) {
    console.warn('qualcomm-security-bulletin: registered source URL is unreadable; cannot build request URLs.');
    return [];
  }

  const { years, startDay, endDay } = windowYears(now, lookbackDays);
  const listed = [];
  for (const year of years) {
    let payload;
    try {
      payload = await readJson(fetchClient, `${origin}${SEARCH_PATH}`, searchPayload(year));
    } catch (error) {
      console.warn(`qualcomm-security-bulletin: ${year} bulletin search failed: ${error && error.message}`);
      continue;
    }
    for (const resource of payload && Array.isArray(payload.resources) ? payload.resources : []) {
      const day = parseIsoDay(resource && resource.publishedOn);
      if (!day || day < startDay || day > endDay) continue;
      listed.push({
        title: String(resource.title || '').trim(),
        url: String(resource.url || ''),
        dcn: String(resource.dcn || ''),
        listedDay: day
      });
    }
  }

  if (listed.length === 0) return [];

  const bodies = listed
    .sort((left, right) => right.listedDay.localeCompare(left.listedDay))
    .slice(0, MAX_BULLETIN_BODIES);

  const minRank = minimumSeverityRank(minSeverity);
  const items = [];
  for (const bulletin of bodies) {
    const bodyUrl = bulletinBodyUrl(origin, bulletin.dcn, bulletin.url);
    if (!bodyUrl) {
      console.warn(`qualcomm-security-bulletin: ${bulletin.title} has no document id; cannot reach its body.`);
      continue;
    }
    const response = await fetchClient.fetchBounded(bodyUrl, {
      accept: 'text/html,application/xhtml+xml',
      // referer가 없으면 이 본문은 404다(실측). 같은 사이트의 게시판 인덱스를 참조자로 보낸다.
      referer: `${origin}${BULLETIN_INDEX_PATH}`,
      maxBytes: MAX_BODY_BYTES
    });
    if (!response.ok || !response.body) {
      console.warn(`qualcomm-security-bulletin: failed to fetch ${bodyUrl}: ${response.error || 'empty body'}`);
      continue;
    }

    // 게시일이 없으면 날짜를 추정하지 않는다. 목록의 publishedOn으로 대신 채우면 재발행
    // 타임스탬프를 문서 발행일로 발행하게 된다.
    const publishedAt = bodyPublishedDate(response.body);
    if (!publishedAt) {
      console.warn(`qualcomm-security-bulletin: ${bodyUrl} has no Published date; no CVE candidates produced.`);
      continue;
    }
    // 본문 발행일이 창 밖이면 버린다. 창 판정의 정본은 목록이 아니라 본문이다.
    if (publishedAt < startDay || publishedAt > endDay) continue;

    const rows = parseBulletinRows(response.body);
    if (rows.length === 0) {
      console.warn(`qualcomm-security-bulletin: ${bodyUrl} yielded no CVE table rows; the page structure may have changed.`);
      continue;
    }
    const relevant = rows
      .filter(row => isCameraRow(row) && severityRank(row.severity) >= minRank)
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
    for (const row of relevant) {
      items.push(buildCveItem(row, { ...bulletin, publishedAt }, source));
    }
  }

  return items.slice(0, Math.max(0, maxItems));
}

module.exports = {
  resolveQualcommSecurityBulletinItems,
  parseBulletinRows,
  bodyPublishedDate,
  bulletinBodyUrl,
  BULLETIN_INDEX_PATH
};
