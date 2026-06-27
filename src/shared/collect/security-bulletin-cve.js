// Android Security Bulletin의 월별 페이지를 따라가 CVE 표를 파싱하고,
// 카메라/미디어 핵심 CVE를 CVE별 후보로 만든다. 인덱스 페이지(월별 링크)만 보던
// 기존 parseAndroidSecurityBulletin의 source-gap을 보완한다(게이트 약화 없이 진짜 증거 생성).
const { decodeHtml } = require('../common/common');
const { canonicalContentUrl, fetchUrlForContent, fetchTextWithLimit } = require('./source-intelligence-utils');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SEVERITY_RANK = { critical: 4, high: 3, moderate: 2, medium: 2, low: 1 };

// 미디어+카메라 핵심: Media framework, Camera service/HAL, V4L2/media 커널, 벤더 camera/ISP.
// 실제 게시판의 벤더/커널 섹션은 카메라 신호를 코드네임(camss/camx/csiphy 등)으로만 표기하므로 함께 본다.
// dng_sdk/libpng/libjpeg/RAW는 촬영한 RAW를 DNG로 저장하거나 썸네일/EXIF 이미지를 디코딩하는
// 카메라 출력 처리 라이브러리라 함께 본다(dng_sdk는 dng보다 먼저 둬야 통째로 매칭된다).
const CAMERA_MEDIA_PATTERN =
  /\b(?:camera|camera2|cameraserver|camera\s*hal|isp|image\s*sensor|v4l2|video4linux|camss|camx|csiphy|csid|cam[_-]\w+|drivers\/media|media\s*framework|libstagefright|stagefright|mediacodec|mediaprovider|mediaserver|media\s*codec|dng_sdk|libdng|dng|libpng|libjpeg(?:-turbo)?|camera\s*raw|raw\s+image)\b/i;

const CVE_PATTERN = /CVE-\d{4}-\d{4,}/i;

function defaultFetchText(url) {
  // source.android.com은 지역/Accept-Language에 따라 비영어(예: 번체 중국어) 페이지를 반환한다.
  // 그러면 표 헤더(Severity/Type)가 번역돼 컬럼 매칭이 깨지므로, fetchUrlForContent로 hl=en을 강제한다.
  return fetchTextWithLimit(globalThis.fetch, fetchUrlForContent(url), { timeoutMs: 5000, maxBytes: 400000 });
}

function clean(html = '') {
  const stripped = String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');
  return decodeHtml(stripped).replace(/\s+/g, ' ').trim();
}

function severityRank(value) {
  return SEVERITY_RANK[String(value || '').trim().toLowerCase()] || 0;
}

function monthLabel(date) {
  const match = /^(\d{4})-(\d{2})/.exec(String(date || ''));
  if (!match) return '';
  const name = MONTH_NAMES[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : '';
}

function latestBulletin(indexItems) {
  const withUrl = (Array.isArray(indexItems) ? indexItems : []).filter(item => item && item.url);
  if (!withUrl.length) return null;
  // 월별 게시판 링크는 href에 날짜를 담아 publishedAt가 채워진다. 날짜가 없는 항목
  // (Overview 등 네비게이션 링크)은 제외하고 날짜가 가장 최신인 게시판을 고른다.
  const dated = withUrl
    .map((item, index) => ({ item, index, time: Date.parse(item.publishedAt || '') }))
    .filter(entry => !Number.isNaN(entry.time));
  if (dated.length > 0) {
    return dated.sort((left, right) => right.time - left.time || left.index - right.index)[0].item;
  }
  // 파싱 가능한 날짜가 전혀 없으면 인덱스의 첫 항목(게시판은 최신순으로 나열된다)을 쓴다.
  return withUrl[0];
}

function parseCells(rowHtml) {
  const cells = [];
  const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = cellPattern.exec(rowHtml)) !== null) {
    cells.push(clean(match[1]));
  }
  return cells;
}

function columnIndex(headers, pattern) {
  return headers.findIndex(header => pattern.test(header));
}

// 게시판의 Framework/System/Media framework 표에는 Subcomponent 컬럼이 없고, 취약 모듈은
// References 셀의 AOSP/커널 소스 링크 경로로만 드러난다(예: .../platform/external/dng_sdk/+/...).
// 그 href 모음을 그대로 돌려준다(카메라 판정용). clean()이 href를 버리므로 raw 행에서 직접 뽑는다.
function rowReferenceHrefs(rowHtml) {
  return [...String(rowHtml).matchAll(/href="([^"]+)"/gi)].map(entry => entry[1]).join(' ');
}

// References href에서 AOSP 표준 모듈 경로(external/dng_sdk, frameworks/av, drivers/media 등)를 뽑아
// Subcomponent 컬럼이 없는 표에서도 컴포넌트 표기/분류에 쓴다.
function referencePathFromHrefs(hrefText) {
  const match = /\/(?:platform|kernel)\/((?:external|frameworks|hardware|system|packages|vendor|drivers|av|media)\/[^/?#+]+)/i
    .exec(String(hrefText || ''));
  return match ? match[1] : '';
}

function parseTableRows(tableHtml, section) {
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tableRows = [];
  let match;
  while ((match = rowPattern.exec(tableHtml)) !== null) {
    tableRows.push(match[1]);
  }
  if (tableRows.length < 2) return [];

  const headers = parseCells(tableRows[0]);
  const cveColumn = columnIndex(headers, /cve/i);
  const severityColumn = columnIndex(headers, /severity/i);
  const typeColumn = columnIndex(headers, /\btype\b/i);
  const componentColumn = columnIndex(headers, /subcomponent|component/i);
  const versionColumn = columnIndex(headers, /version/i);

  const rows = [];
  for (const rowHtml of tableRows.slice(1)) {
    const cells = parseCells(rowHtml);
    if (!cells.length) continue;
    const cveColumnText = cveColumn >= 0 ? cells[cveColumn] : '';
    const cveMatch = CVE_PATTERN.exec(cveColumnText) || CVE_PATTERN.exec(cells.join(' '));
    if (!cveMatch) continue;
    const subcomponent = componentColumn >= 0 ? cells[componentColumn] : '';
    const references = rowReferenceHrefs(rowHtml);
    const referencePath = referencePathFromHrefs(references);
    rows.push({
      cve_id: cveMatch[0].toUpperCase(),
      type: typeColumn >= 0 ? cells[typeColumn] : '',
      severity: severityColumn >= 0 ? cells[severityColumn] : '',
      versions: versionColumn >= 0 ? cells[versionColumn] : '',
      section,
      component: subcomponent || referencePath || section,
      references
    });
  }
  return rows;
}

function parseMonthlyBulletin(html) {
  const blockPattern = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<table[\s\S]*?<\/table>/gi;
  const rows = [];
  let section = '';
  let match;
  while ((match = blockPattern.exec(html)) !== null) {
    const block = match[0];
    if (/^<h[1-6]/i.test(block)) {
      section = clean(match[1]);
      continue;
    }
    rows.push(...parseTableRows(block, section));
  }
  return rows;
}

function isCameraOrMedia(row) {
  // section/component 외에 References href 경로(external/dng_sdk 등)도 함께 본다.
  // Subcomponent 컬럼이 없는 표에서는 카메라 모듈명이 href에만 있기 때문이다.
  return CAMERA_MEDIA_PATTERN.test(`${row.section} ${row.component} ${row.type} ${row.references || ''}`);
}

function bucketHint(row) {
  const text = `${row.section} ${row.component}`.toLowerCase();
  // dng_sdk/libpng/libjpeg/RAW는 촬영 이미지의 저장·디코딩을 담당하는 userspace 출력 라이브러리다.
  // 커널 드라이버가 아니므로 driver 분기보다 먼저 잡아 카메라 출력(multimedia) 신호로 본다.
  if (/dng_sdk|libdng|\bdng\b|libpng|libjpeg|raw\s*image|camera\s*raw/.test(text)) {
    return 'android_multimedia_camera_output';
  }
  // 벤더(Qualcomm/MediaTek 등)·커널·드라이버 카메라 CVE는 직접 AOSP Camera 프레임워크가 아니라
  // driver/image pipeline 신호다. AOSP framework/system 카메라만 direct_aosp_camera로 본다.
  if (/qualcomm|mediatek|\barm\b|imagination|kernel|v4l2|video4linux|camss|camx|csiphy|csid|cam[_-]\w+|drivers\/media|driver/.test(text)) {
    return 'camera_driver_image_pipeline';
  }
  if (/camera|isp|image sensor|camera2|cameraserver/.test(text)) {
    return 'direct_aosp_camera';
  }
  return 'android_multimedia_camera_output';
}

function buildCveItem(row, bulletin, source) {
  const date = bulletin.publishedAt || '';
  const label = monthLabel(date);
  const labelPrefix = label ? `${label} ` : '';
  const versions = row.versions ? ` / Android ${row.versions}` : '';
  const anchor = row.cve_id.toLowerCase();
  const baseUrl = canonicalContentUrl(String(bulletin.url || '').split('#')[0]);
  const type = row.type || 'Security';
  return {
    source,
    title: `${labelPrefix}Android Security Bulletin: ${row.cve_id} — ${row.component}`,
    url: baseUrl ? `${baseUrl}#${anchor}` : '',
    publishedAt: date,
    sourceKind: 'release_note_item',
    version_or_release: `${row.cve_id}${versions}`,
    api_or_component: `Android Security Bulletin / ${row.component}`,
    behavior_change: `${type} vulnerability (${row.severity || 'unspecified'} severity) in ${row.component}; security fix shipped in the ${labelPrefix}Android Security Bulletin (${row.cve_id}).`,
    relevanceBucketHint: bucketHint(row),
    cve_id: row.cve_id,
    severity: row.severity
  };
}

/**
 * 인덱스에서 파싱된 월별 게시판 링크 중 가장 최신 게시판 페이지를 fetch하고,
 * CVE 표를 파싱해 카메라/미디어 핵심 + 심각도 하한 이상 CVE를 CVE별 후보로 반환한다.
 *
 * - 게시판 페이지를 못 가져오거나(네트워크/구조 변경) 관련 CVE가 없으면 빈 배열을 반환한다(graceful).
 * - 반환 item은 release_note_item 증거 4필드(date/version/component/behavior)를 채워 게이트를 정당히 통과한다.
 */
async function resolveSecurityBulletinCveItems(indexItems = [], source = {}, options = {}) {
  const fetchTextImpl = options.fetchTextImpl || defaultFetchText;
  const maxItems = Number.isFinite(options.maxItems) ? Math.max(0, options.maxItems) : 15;
  const minRank = severityRank(options.minSeverity || 'moderate') || SEVERITY_RANK.moderate;

  const bulletin = latestBulletin(indexItems);
  if (!bulletin) return [];

  let html;
  try {
    html = await fetchTextImpl(bulletin.url);
  } catch {
    return [];
  }
  if (!html) return [];

  const relevant = parseMonthlyBulletin(html)
    .filter(row => isCameraOrMedia(row) && severityRank(row.severity) >= minRank)
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));

  if (relevant.length > maxItems) {
    console.warn(`security-bulletin-cve: ${bulletin.url} yielded ${relevant.length} camera/media CVEs; keeping top ${maxItems} by severity, dropping ${relevant.length - maxItems}.`);
  }

  return relevant.slice(0, maxItems).map(row => buildCveItem(row, bulletin, source));
}

module.exports = {
  resolveSecurityBulletinCveItems
};
