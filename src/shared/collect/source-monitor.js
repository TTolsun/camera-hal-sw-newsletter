const { ensureArray } = require('../common/value-coercion');
const fs = require('fs');
const path = require('path');

const {
  DATE_SOURCE_CONFIDENCE,
  dateQualityForCandidate,
  dateSourceConfidence,
  normalizeDate
} = require('../common/date-signals');
const {
  contentHash,
  evidenceId,
  hashText,
  normalizeSourceUrl,
  normalizedContentHash,
  sourceEventId,
  sourceIdentityKey,
  visibleText
} = require('../common/source-identity');
const {
  sourceQualityFlatFields
} = require('./source-quality-classifier');
const {
  validateSourceMonitorRegistryText
} = require('../validate/source-monitor-registry-validator');
const { CANDIDATE_SCHEMA_VERSION } = require('../common/candidate-artifacts');
const {
  cameraItsReleaseNoteEvidence,
  cameraItsReleaseNoteExtract,
  cameraItsReleaseNoteFingerprint
} = require('./camera-its-release-note-evidence');

const SNAPSHOT_SCHEMA_VERSION = 1;
const PROCESSED_ID_LIMIT = 500;
// page_removed 는 콘텐츠 자체가 사라진 변경이라 content_changed=true 로 두지만,
// candidateAllowed 산정에서는 별도로 차단된다(URL 안정성 결여).
const NON_CONTENT_CHANGE_EVENT_TYPES = new Set(['no_meaningful_change', 'metadata_only_changed']);
const CANDIDATE_BLOCKED_EVENT_TYPES = new Set(['page_removed']);
const SOURCE_MONITOR_REGISTRY_REL_PATH = 'state/source-monitor-registry.json';
const SOURCE_SNAPSHOT_ROOT = path.join('state', 'source-snapshots');
const SOURCE_EVENTS_ROOT = path.join('articles', 'content', 'source-events');

function text(value) {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function unique(values) {
  return [...new Set(ensureArray(values).map(text).filter(Boolean))];
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeJsonAtomic(filePath, value, options = {}) {
  const writeFileSync = options.writeFileSync || fs.writeFileSync;
  const renameSync = options.renameSync || fs.renameSync;
  const unlinkSync = options.unlinkSync || fs.unlinkSync;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // Preserve the original write/rename failure.
    }
    throw error;
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function monitorRegistryPath(root) {
  return path.join(root, SOURCE_MONITOR_REGISTRY_REL_PATH);
}

function snapshotPath(root, sourceId) {
  return path.join(root, SOURCE_SNAPSHOT_ROOT, `${sourceId}.json`);
}

function sourceEventsDir(root, date) {
  return path.join(root, SOURCE_EVENTS_ROOT, date);
}

function sourceEventsJsonPath(root, date) {
  return path.join(sourceEventsDir(root, date), 'source-change-events.json');
}

function sourceEventsMarkdownPath(root, date) {
  return path.join(sourceEventsDir(root, date), 'source-change-events.md');
}

function loadRegistry(root = process.cwd()) {
  const filePath = monitorRegistryPath(root);
  if (!fs.existsSync(filePath)) {
    return { schemaVersion: 1, sources: [] };
  }
  const source = fs.readFileSync(filePath, 'utf8');
  const result = validateSourceMonitorRegistryText(source, {
    filePath: SOURCE_MONITOR_REGISTRY_REL_PATH
  });
  if (!result.ok) {
    throw new Error(`Invalid source monitor registry:\n${result.errors.join('\n')}`);
  }
  return result.registry;
}

function emptySnapshot(sourceId) {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source_id: sourceId,
    updated_at: '',
    pages: [],
    processed_source_event_ids: [],
    processed_evidence_ids: []
  };
}

function loadSnapshot(root, sourceId) {
  const filePath = snapshotPath(root, sourceId);
  const snapshot = readJsonIfExists(filePath);
  if (!snapshot) return emptySnapshot(sourceId);
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`${path.relative(root, filePath).replace(/\\/g, '/')} schemaVersion must be ${SNAPSHOT_SCHEMA_VERSION}.`);
  }
  return {
    ...emptySnapshot(sourceId),
    ...snapshot,
    pages: ensureArray(snapshot.pages),
    processed_source_event_ids: ensureArray(snapshot.processed_source_event_ids),
    processed_evidence_ids: ensureArray(snapshot.processed_evidence_ids)
  };
}

function boundedHistory(values) {
  return unique(values).slice(-PROCESSED_ID_LIMIT);
}

function titleFromHtml(html = '', fallback = '') {
  const title = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) ||
    String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return title ? visibleText(title[1]).slice(0, 160) : fallback;
}

function firstDateMatch(value = '') {
  const raw = text(value);
  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const monthDate = raw.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),\s+(20\d{2})\b/i);
  if (monthDate) {
    const month = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12'
    }[monthDate[1].slice(0, 3).toLowerCase()];
    return `${monthDate[3]}-${month}-${monthDate[2].padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function visibleLastUpdated(html = '') {
  const value = visibleText(html);
  // lazy 캡처는 "Last updated 2026-07-21 UTC."에서 첫 단어 경계("2026")까지만 잡아
  // firstDateMatch의 new Date("2026") 폴백이 연초 날짜(2026-01-01)로 둔갑시켰다(실스냅샷 실증).
  // "Last updated" 뒤 구간을 통째로 넘겨 완전한 날짜 매칭(ISO/월 이름)에 맡긴다.
  const match = value.match(/\bLast updated\b([^.\n]*)/i);
  return match ? firstDateMatch(match[1]) : '';
}

function visibleDate(html = '') {
  const value = visibleText(html).replace(/\bLast updated\s+[^.\n]+/gi, ' ');
  return firstDateMatch(value);
}

function structuredDate(html = '', names = []) {
  for (const name of names) {
    const pattern = new RegExp(`<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
    const reversePattern = new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`, 'i');
    const match = String(html).match(pattern) || String(html).match(reversePattern);
    if (match) {
      const date = firstDateMatch(match[1]);
      if (date) return date;
    }
  }
  return '';
}

function meaningfulAnchors(html = '', pageUrl = '') {
  const anchors = new Set();
  for (const match of String(html).matchAll(/\b(?:id|href)=["']#?([a-z0-9][a-z0-9._:-]*(?:\d+\.\d+\.\d+(?:[-\w.]*)?)?)[\"']/gi)) {
    const anchor = match[1];
    if (/\d+\.\d+\.\d+|camera|hal|cdd|its|cts|vts|release/i.test(anchor)) {
      anchors.add(`${normalizeSourceUrl(pageUrl)}#${anchor.toLowerCase()}`);
    }
  }
  return [...anchors].sort();
}

function releaseEvidenceKey(anchors = []) {
  const release = ensureArray(anchors).find(anchor => /\d+\.\d+\.\d+(?:[-\w.]*)?/i.test(anchor));
  return release || '';
}

function releaseRowKey(row = {}) {
  if (!row) return '';
  return text(row.anchor || row.version);
}

// 앵커 하나만으로는 릴리스 행의 정체성이 되지 않는다. 실제 CameraX 릴리스 노트 페이지는
// 같은 id를 단 h3 섹션(camera-view-1.0.0-alpha12)을 두 번 싣고, 그러면 서로 다른 두 구간이
// 한 열쇠로 겹친다. 겹치면 지도에는 뒤 행만 남아서 앞 행의 해시를 뒤 행의 해시와 비교하게
// 되고, 둘은 절대 같아지지 않으므로 매 실행마다 2020년 날짜를 단 release_row_changed가
// 나온다(그 5년 전 이벤트가 이슈로 신고된 증상이다).
// 그래서 같은 앵커가 두 번째로 나오면 등장 순서를 붙여 행을 갈라 준다. 행 목록의 순서는
// extractReleaseRows가 확정해 두므로 이 번호도 실행마다 같은 값이 나온다.
function releaseRowKeys(rows = []) {
  const occurrenceCount = new Map();
  return ensureArray(rows).map(row => {
    const anchorKey = releaseRowKey(row);
    if (!anchorKey) return '';
    const occurrence = (occurrenceCount.get(anchorKey) || 0) + 1;
    occurrenceCount.set(anchorKey, occurrence);
    return occurrence === 1 ? anchorKey : `${anchorKey}#occurrence-${occurrence}`;
  });
}

function releaseRowsByKey(rows = []) {
  const keys = releaseRowKeys(rows);
  const map = new Map();
  ensureArray(rows).forEach((row, index) => {
    if (keys[index]) map.set(keys[index], row);
  });
  return map;
}

function releaseRowDiff(previousRows = [], currentRows = []) {
  const previousByKey = releaseRowsByKey(previousRows);
  const rows = ensureArray(currentRows);
  const keys = releaseRowKeys(rows);
  for (let index = 0; index < rows.length; index += 1) {
    const key = keys[index];
    if (!key) continue;
    const row = rows[index];
    const previous = previousByKey.get(key);
    if (!previous) {
      return { type: 'added', row };
    }
    if (text(previous.hash) !== text(row.hash)) {
      return { type: 'changed', row, previous };
    }
  }
  return { type: '', row: null, previous: null };
}

function extractReleaseRows(html = '', pageUrl = '') {
  const source = String(html || '');
  const headings = [...source.matchAll(/<(h[2-4])\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(match => {
    const attrs = match[2] || '';
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    return {
      index: match.index,
      end: match.index + match[0].length,
      id: idMatch ? idMatch[1] : '',
      html: match[0],
      text: visibleText(match[3])
    };
  });
  const rows = [];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const next = headings[index + 1];
    const sectionHtml = source.slice(heading.index, next ? next.index : source.length);
    const sectionText = visibleText(sectionHtml);
    const releaseText = `${heading.id} ${heading.text} ${sectionText}`;
    const versionMatch = releaseText.match(/\b\d+\.\d+\.\d+(?:[-\w.]*)?\b/i);
    if (!versionMatch) continue;
    const version = versionMatch[0];
    const anchorId = heading.id || version;
    const anchor = `${normalizeSourceUrl(pageUrl)}#${anchorId.toLowerCase()}`;
    rows.push({
      version,
      anchor,
      date: firstDateMatch(sectionText),
      hash: hashText(sectionText, 32),
      title: heading.text || version
    });
  }
  // 대표 릴리스 행은 "가장 최근 날짜"여야 한다. anchor 알파벳 순으로 정렬하면 아카이브 행을
  // 앞쪽에 싣는 페이지에서 5년 전 행이 첫 원소가 되고, 그 날짜가 release_row_date(신뢰도 95)를
  // 달고 스냅샷과 이벤트에 그대로 실린다. 날짜가 없는 행은 뒤로 밀고, 동률과 무날짜는
  // anchor 오름차순으로 갈라 실행마다 같은 순서가 나오게 한다.
  return rows.sort((a, b) => text(b.date).localeCompare(text(a.date)) || a.anchor.localeCompare(b.anchor));
}

function hasExtractor(source = {}, name = '') {
  const extractors = ensureArray(source.date_extractors);
  return extractors.length === 0 || extractors.includes(name);
}

function dateSignalForObservation(source = {}, observation = {}, releaseRow = null) {
  if (hasExtractor(source, 'release_row_date') && (releaseRow?.date || observation.release_row_date)) {
    return {
      effective_date: releaseRow?.date || observation.release_row_date,
      date_source: 'release_row_date'
    };
  }
  if (hasExtractor(source, 'visible_date') && observation.visible_date) {
    return {
      effective_date: observation.visible_date,
      date_source: 'visible_date'
    };
  }
  if (hasExtractor(source, 'visible_last_updated') && observation.visible_last_updated) {
    return {
      effective_date: observation.visible_last_updated,
      date_source: 'visible_last_updated'
    };
  }
  if (hasExtractor(source, 'structured_date_published') && observation.structured_date_published) {
    return {
      effective_date: observation.structured_date_published,
      date_source: 'structured_date_published'
    };
  }
  if (hasExtractor(source, 'structured_date_modified') && observation.structured_date_modified) {
    return {
      effective_date: observation.structured_date_modified,
      date_source: 'structured_date_modified'
    };
  }
  if (hasExtractor(source, 'sitemap_lastmod') && observation.sitemap_lastmod) {
    return {
      effective_date: observation.sitemap_lastmod,
      date_source: 'sitemap_lastmod'
    };
  }
  if (hasExtractor(source, 'http_last_modified') && observation.http_last_modified) {
    return {
      effective_date: observation.http_last_modified,
      date_source: 'http_last_modified'
    };
  }
  return {
    effective_date: '',
    date_source: 'missing'
  };
}

function observationFromHtml({ source, url, html, status = 200, headers = {} }) {
  const canonicalUrl = normalizeSourceUrl(url);
  let releaseNoteExtract = null;
  try {
    releaseNoteExtract = cameraItsReleaseNoteExtract(html, canonicalUrl);
  } catch {
    releaseNoteExtract = null;
  }
  const httpLastModified = firstDateMatch(headers['last-modified'] || headers['Last-Modified']);
  const releaseRows = extractReleaseRows(html, canonicalUrl);
  const primaryReleaseRow = releaseRows[0] || {};
  return {
    source_identity_key: sourceIdentityKey({ sourceId: source.source_id, url: canonicalUrl }),
    url,
    canonical_url: canonicalUrl,
    title: titleFromHtml(html, source.source_id),
    visible_date: visibleDate(html),
    visible_last_updated: visibleLastUpdated(html),
    structured_date_published: structuredDate(html, ['datePublished', 'article:published_time']),
    structured_date_modified: structuredDate(html, ['dateModified', 'article:modified_time']),
    sitemap_lastmod: '',
    http_last_modified: httpLastModified,
    content_hash: contentHash(html),
    normalized_content_hash: normalizedContentHash(html),
    // 릴리스 노트 문서는 "무엇이 적혀 있나"가 기사감인데 이벤트 후보는 자리표시자만 실어 왔다.
    // 섹션 지문은 스냅샷에 남겨 다음 실행에서 무엇이 바뀌었는지 가리고, 문장·링크가 붙은
    // 추출 결과는 이벤트까지만 들려보낸다(스냅샷에는 저장하지 않는다).
    // 판정(언제 바뀌었나)은 그대로 정규화 본문 해시 비교가 한다.
    // 부가 기능인 내용 추출이 실패해도 핵심인 변화 감지는 계속돼야 하므로 여기서 삼킨다.
    release_note_sections: cameraItsReleaseNoteFingerprint(releaseNoteExtract),
    release_note_extract: releaseNoteExtract,
    anchors: meaningfulAnchors(html, canonicalUrl),
    release_row_date: primaryReleaseRow.date || '',
    release_row_version: primaryReleaseRow.version || '',
    release_row_anchor: primaryReleaseRow.anchor || '',
    release_row_hash: primaryReleaseRow.hash || '',
    release_rows: releaseRows,
    first_seen_at: '',
    last_seen_at: '',
    seen_count: 0,
    status
  };
}

async function fetchWithTimeout(url, timeoutMs, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CameraHALNewsletterBot/1.0 (+https://github.com/TTolsun/camera-hal-sw-newsletter)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const headers = {};
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    }
    const body = response.status === 404 || response.status === 410 ? '' : await response.text();
    return {
      ok: response.ok,
      status: response.status,
      headers,
      body
    };
  } finally {
    clearTimeout(timeout);
  }
}

function targetUrlsForSource(source = {}) {
  return unique([...(source.seed_urls || []), source.root_url]).slice(0, source.max_pages_per_run || 1);
}

async function collectObservationsForSource(source, options = {}) {
  const diagnostics = [];
  const observations = [];
  const targets = targetUrlsForSource(source);
  for (const url of targets) {
    try {
      const fetched = await fetchWithTimeout(url, source.fetch_timeout_ms, options.fetchImpl);
      if (fetched.status === 404 || fetched.status === 410) {
        observations.push({
          source_identity_key: sourceIdentityKey({ sourceId: source.source_id, url }),
          url,
          canonical_url: normalizeSourceUrl(url),
          title: url,
          removed_status: fetched.status,
          first_seen_at: '',
          last_seen_at: '',
          seen_count: 0
        });
        continue;
      }
      if (!fetched.ok) {
        diagnostics.push({
          type: 'monitor_error',
          source_id: source.source_id,
          url,
          status: fetched.status,
          message: `Fetch failed with status ${fetched.status}.`
        });
        continue;
      }
      observations.push(observationFromHtml({
        source,
        url,
        html: fetched.body,
        status: fetched.status,
        headers: fetched.headers
      }));
    } catch (error) {
      diagnostics.push({
        type: 'monitor_error',
        source_id: source.source_id,
        url,
        message: error.name === 'AbortError' ? 'Fetch timeout.' : error.message
      });
    }
  }
  return {
    observations,
    diagnostics,
    incomplete: diagnostics.length > 0 || observations.length === 0
  };
}

function changedDateField(previous = {}, current = {}, source = {}) {
  for (const field of ['release_row_date', 'visible_date', 'visible_last_updated', 'structured_date_published', 'structured_date_modified', 'sitemap_lastmod', 'http_last_modified']) {
    if (!hasExtractor(source, field)) continue;
    if (text(previous[field]) !== text(current[field]) && text(current[field])) return field;
  }
  return '';
}

function eventTypeForDateField(field) {
  if (field === 'release_row_date') return 'release_row_changed';
  if (field === 'visible_last_updated') return 'last_updated_changed';
  if (field === 'structured_date_modified') return 'structured_modified_changed';
  if (field === 'sitemap_lastmod') return 'sitemap_lastmod_changed';
  return 'material_content_changed';
}

function dateSourceForDateField(field) {
  if (field === 'release_row_date') return 'release_row_date';
  if (field === 'visible_date') return 'visible_date';
  if (field === 'visible_last_updated') return 'visible_last_updated';
  if (field === 'structured_date_published') return 'structured_date_published';
  if (field === 'structured_date_modified') return 'structured_date_modified';
  if (field === 'sitemap_lastmod') return 'sitemap_lastmod';
  if (field === 'http_last_modified') return 'http_last_modified';
  return 'missing';
}

function urlMatchesPattern(url, pattern) {
  const normalizedUrl = normalizeSourceUrl(url);
  const normalizedPattern = String(pattern || '').trim();
  if (!normalizedUrl || !normalizedPattern) return false;
  if (normalizedPattern.endsWith('/**')) {
    return normalizedUrl.startsWith(normalizedPattern.slice(0, -3));
  }
  if (normalizedPattern.endsWith('*')) {
    return normalizedUrl.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedUrl === normalizeSourceUrl(normalizedPattern);
}

function pageInRegistryScope(source = {}, page = {}) {
  const url = page.canonical_url || page.url || '';
  const patterns = ensureArray(source.url_patterns);
  return patterns.length === 0
    ? normalizeSourceUrl(url).startsWith(normalizeSourceUrl(source.root_url))
    : patterns.some(pattern => urlMatchesPattern(url, pattern));
}

function buildEvent({ source, previous, current, eventType, dateSource, effectiveDate, detectedAt, duplicate = false, reason = '', releaseRow = null }) {
  const identityKey = current?.source_identity_key || previous?.source_identity_key || '';
  const normalizedEffectiveDate = normalizeDate(effectiveDate);
  const evidenceKey = releaseRowKey(releaseRow) ||
    releaseEvidenceKey(current?.anchors) ||
    current?.normalized_content_hash ||
    current?.canonical_url ||
    identityKey;
  const source_event_id = sourceEventId({
    sourceId: source.source_id,
    eventType,
    sourceIdentityKey: identityKey,
    effectiveDate: normalizedEffectiveDate,
    evidenceKey
  });
  const evidence_id = evidenceId({
    sourceId: source.source_id,
    sourceIdentityKey: identityKey,
    eventType,
    effectiveDate: normalizedEffectiveDate,
    evidenceKey
  });
  const date_confidence = dateSourceConfidence(dateSource);
  const contentChanged = text(previous?.normalized_content_hash) !== text(current?.normalized_content_hash);
  const candidateAllowed = !duplicate &&
    !NON_CONTENT_CHANGE_EVENT_TYPES.has(eventType) &&
    !CANDIDATE_BLOCKED_EVENT_TYPES.has(eventType);
  const mainArticleAllowed = candidateAllowed &&
    source.main_article_allowed === true &&
    eventType !== 'page_added' &&
    date_confidence >= 85 &&
    !['content_hash_changed_without_date', 'snapshot_detected_at', 'missing'].includes(dateSource);
  return {
    source_event_id,
    evidence_id,
    source_id: source.source_id,
    event_type: eventType,
    url: current?.url || previous?.url || '',
    canonical_url: current?.canonical_url || previous?.canonical_url || '',
    title: current?.title || previous?.title || source.source_id,
    previous_values: withoutDerivedEvidence(previous),
    current_values: withoutDerivedEvidence(current),
    content_changed: contentChanged,
    detected_at: detectedAt,
    effective_date: normalizedEffectiveDate,
    date_source: dateSource,
    date_confidence,
    candidate_allowed: candidateAllowed,
    main_article_allowed: mainArticleAllowed,
    // 증거는 본문이 실제로 바뀐 이벤트에만 싣는다. anchor_added/page_added는 candidate_allowed
    // 이지만 본문 변경이 아니므로, 문서 내용을 그 주의 변화로 보고하면 과다 주장이 된다.
    release_note_evidence: contentChanged
      ? cameraItsReleaseNoteEvidence(current?.release_note_extract, previous?.release_note_sections)
      : null,
    release_row_date: releaseRow?.date || current?.release_row_date || '',
    release_row_version: releaseRow?.version || current?.release_row_version || '',
    release_row_anchor: releaseRow?.anchor || current?.release_row_anchor || '',
    release_row_hash: releaseRow?.hash || current?.release_row_hash || '',
    duplicate_processed: duplicate,
    needs_editor_date_review: date_confidence < 85 || dateSource === 'content_hash_changed_without_date',
    reason
  };
}

function classifyObservation({ source, previous, current, snapshot, detectedAt }) {
  const processedEvents = new Set(snapshot.processed_source_event_ids);
  const processedEvidence = new Set(snapshot.processed_evidence_ids);
  let eventType = 'no_meaningful_change';
  let dateSource = 'missing';
  let effectiveDate = '';
  let reason = 'No meaningful source change.';
  let releaseRow = null;
  const contentHashEnabled = source.content_hash_enabled !== false;

  if (current.removed_status === 404 || current.removed_status === 410 || current.removed_status === 'scope_disappearance') {
    eventType = 'page_removed';
    dateSource = 'missing';
    reason = current.removed_status === 'scope_disappearance'
      ? 'Confirmed removed from healthy source observation scope.'
      : `Confirmed removed with HTTP ${current.removed_status}.`;
  } else if (!previous) {
    eventType = 'page_added';
    const signal = dateSignalForObservation(source, current);
    effectiveDate = signal.effective_date || detectedAt;
    dateSource = signal.effective_date ? signal.date_source : 'snapshot_page_added';
    reason = 'New page under monitored source.';
  } else {
    const previousAnchors = new Set(ensureArray(previous.anchors));
    const addedAnchors = ensureArray(current.anchors).filter(anchor => !previousAnchors.has(anchor));
    const dateField = changedDateField(previous, current, source);
    const normalizedChanged = contentHashEnabled &&
      text(previous.normalized_content_hash) !== text(current.normalized_content_hash);
    const releaseDiff = releaseRowDiff(previous.release_rows, current.release_rows);
    if (releaseDiff.type === 'added') {
      eventType = 'release_row_added';
      releaseRow = releaseDiff.row;
      const signal = dateSignalForObservation(source, current, releaseRow);
      effectiveDate = signal.effective_date || detectedAt;
      dateSource = signal.effective_date ? signal.date_source : 'snapshot_detected_at';
      reason = 'Release row/version added.';
    } else if (releaseDiff.type === 'changed') {
      eventType = 'release_row_changed';
      releaseRow = releaseDiff.row;
      const signal = dateSignalForObservation(source, current, releaseRow);
      effectiveDate = signal.effective_date || detectedAt;
      dateSource = signal.effective_date ? signal.date_source : 'snapshot_detected_at';
      reason = 'Release row content changed.';
    } else if (addedAnchors.some(anchor => /\d+\.\d+\.\d+(?:[-\w.]*)?/i.test(anchor))) {
      eventType = 'release_row_added';
      releaseRow = {
        anchor: addedAnchors.find(anchor => /\d+\.\d+\.\d+(?:[-\w.]*)?/i.test(anchor)),
        version: text(addedAnchors.find(anchor => /\d+\.\d+\.\d+(?:[-\w.]*)?/i.test(anchor))).match(/\d+\.\d+\.\d+(?:[-\w.]*)?/i)?.[0] || ''
      };
      const signal = dateSignalForObservation(source, current, releaseRow);
      effectiveDate = signal.effective_date || detectedAt;
      dateSource = signal.effective_date ? signal.date_source : 'snapshot_detected_at';
      reason = 'Release row/version/anchor added.';
    } else if (dateField && normalizedChanged) {
      eventType = eventTypeForDateField(dateField);
      effectiveDate = current[dateField];
      dateSource = dateSourceForDateField(dateField);
      reason = 'Date signal changed with normalized content hash changed.';
    } else if (normalizedChanged) {
      eventType = 'content_changed_without_date_change';
      effectiveDate = detectedAt;
      dateSource = 'content_hash_changed_without_date';
      reason = 'Normalized content hash changed without date change.';
    } else if (dateField) {
      eventType = 'metadata_only_changed';
      effectiveDate = current[dateField];
      dateSource = dateSourceForDateField(dateField);
      reason = 'Date/metadata changed with normalized content hash unchanged.';
    } else if (addedAnchors.length > 0) {
      eventType = 'anchor_added';
      const signal = dateSignalForObservation(source, current);
      effectiveDate = signal.effective_date || detectedAt;
      dateSource = signal.effective_date ? signal.date_source : 'snapshot_detected_at';
      reason = 'Anchor added without material body change.';
    }
  }

  const event = buildEvent({
    source,
    previous,
    current,
    eventType,
    dateSource,
    effectiveDate,
    detectedAt,
    releaseRow,
    reason
  });
  if (processedEvents.has(event.source_event_id) || processedEvidence.has(event.evidence_id)) {
    return {
      ...event,
      candidate_allowed: false,
      main_article_allowed: false,
      duplicate_processed: true,
      reason: `Duplicate processed ${processedEvents.has(event.source_event_id) ? 'source_event_id' : 'evidence_id'}.`
    };
  }
  return event;
}

// release_note_extract(문장·링크가 붙은 추출 결과)는 매 실행마다 다시 뽑는 파생 값이다.
// 스냅샷에도, git으로 추적되는 source-change-events.json의 previous/current_values에도
// 저장하지 않는다 — 파일만 커지고 diff가 시끄러워질 뿐이다. 다음 실행의 비교에 필요한 것은
// 섹션 지문(release_note_sections)뿐이고 그것만 영속화한다.
function withoutDerivedEvidence(observation) {
  if (!observation) return null;
  const { release_note_extract, ...persisted } = observation;
  return persisted;
}

function nextPage(previous, current, detectedAt) {
  return {
    ...withoutDerivedEvidence(current),
    first_seen_at: previous?.first_seen_at || detectedAt,
    last_seen_at: detectedAt,
    seen_count: number(previous?.seen_count) + 1
  };
}

function nextSnapshotForSource(source, previousSnapshot, observations, events, detectedAt) {
  const previousByKey = new Map(ensureArray(previousSnapshot.pages).map(page => [page.source_identity_key, page]));
  const pages = [];
  for (const current of observations) {
    if (current.removed_status) continue;
    const previous = previousByKey.get(current.source_identity_key);
    pages.push(nextPage(previous, current, detectedAt));
  }
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source_id: source.source_id,
    updated_at: detectedAt,
    pages,
    processed_source_event_ids: boundedHistory([
      ...previousSnapshot.processed_source_event_ids,
      ...events.filter(event => event.event_type !== 'no_meaningful_change').map(event => event.source_event_id)
    ]),
    processed_evidence_ids: boundedHistory([
      ...previousSnapshot.processed_evidence_ids,
      ...events.filter(event => event.candidate_allowed === true).map(event => event.evidence_id)
    ])
  };
}

function sourceQualityForEvent(event) {
  const allowed = event.main_article_allowed === true;
  const blockers = allowed ? [] : [event.needs_editor_date_review ? 'source_gap_risk' : 'fallback_without_concrete_source_fact'];
  const sourceQuality = {
    source_role: 'official_documentation_reference',
    source_url_quality: allowed ? 'official_site_update_row' : 'official_documentation_reference',
    source_quality_status: allowed ? 'allowed' : 'blocked',
    main_article_source_allowed: allowed,
    main_article_source_allowed_reason: allowed ? 'Source event has strong dated evidence.' : 'Source event is diagnostic or weak-date context.',
    main_article_source_blockers: blockers,
    cross_check_status: 'not_required',
    requires_cross_check: false,
    requires_conditional_evidence: false,
    conditional_evidence_type: '',
    evidence_granularity: 'source_change_event',
    source_quality_notes: ['source snapshot change event']
  };
  return {
    source_quality: sourceQuality,
    ...sourceQualityFlatFields(sourceQuality)
  };
}

function bucketForSource(source = {}) {
  const categories = ensureArray(source.expected_categories);
  if (source.selection_lane === 'supporting_native_tooling') return 'cpp_ai_tooling_fallback';
  if (categories.includes('camera-api') || source.source_id.includes('camerax')) return 'android_platform_camera_adjacent';
  if (categories.includes('camera-hal') || categories.includes('aosp')) return 'direct_aosp_camera';
  return 'generic_tech_watchlist';
}

function candidateFromEvent(event, source) {
  if (event.candidate_allowed !== true) return null;
  const dateQuality = dateQualityForCandidate(event);
  const mainDateEligible = dateQuality.main_article_date_eligible && event.main_article_allowed === true;
  const finalSelectionEligibility = mainDateEligible
    ? (source.selection_lane === 'supporting_native_tooling' || source.fallback_only ? 'short' : 'main')
    : 'watchlist';
  const bucket = bucketForSource(source);
  // 릴리스 노트 증거가 있으면 자리표시자 대신 페이지에서 뽑은 구체 내용을 싣는다.
  // 이벤트가 만들어졌다는 것 자체가 "본문이 바뀌었다"는 뜻이므로(날짜만 바뀐 날은 여기까지
  // 오지 않는다) 이 증거를 그 주의 사건 내용으로 쓰는 것이 정확하다.
  const releaseNoteEvidence = event.release_note_evidence || null;
  const sourceQuality = sourceQualityForEvent({
    ...event,
    main_article_allowed: mainDateEligible
  });
  return {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    source: source.source_id,
    source_name: source.source_id,
    source_id: source.source_id,
    source_root_url: source.root_url,
    sourceUrl: source.root_url,
    source_url: source.root_url,
    articleUrl: event.url,
    article_url: event.url,
    evidence_url: event.canonical_url || event.url,
    url: event.url,
    title: event.title,
    summary: `${event.event_type}: ${event.reason}`,
    origin: 'source_monitor',
    collectionStage: 'source_snapshot_change_detection',
    collection_stage: 'source_snapshot_change_detection',
    sourceType: 'source_change_event',
    source_type: 'source_change_event',
    source_kind: 'source_change_event',
    collectionMode: 'source-change-event',
    collection_mode: 'source-change-event',
    isArticleCandidate: mainDateEligible,
    is_article_candidate: mainDateEligible,
    isWatchPage: !mainDateEligible,
    is_watch_page: !mainDateEligible,
    hasDatedEvidence: mainDateEligible,
    has_dated_evidence: mainDateEligible,
    finalSelectionEligibility,
    final_selection_eligibility: finalSelectionEligibility,
    source_gap_risk: !mainDateEligible,
    main_eligible: mainDateEligible,
    briefing_only: !mainDateEligible,
    reference_only: !mainDateEligible,
    candidate_allowed: event.candidate_allowed,
    main_article_allowed: event.main_article_allowed,
    event_type: event.event_type,
    article_role: mainDateEligible ? 'source_event_main_candidate' : 'source_event_review_context',
    needs_editor_date_review: event.needs_editor_date_review,
    effective_date: event.effective_date,
    date_source: event.date_source,
    date_confidence: event.date_confidence,
    detected_at: event.detected_at,
    first_seen_at: event.current_values?.first_seen_at || '',
    last_seen_at: event.current_values?.last_seen_at || '',
    source_identity_key: event.current_values?.source_identity_key || event.previous_values?.source_identity_key || '',
    source_event_id: event.source_event_id,
    evidence_id: event.evidence_id,
    release_row_date: event.release_row_date,
    release_row_version: event.release_row_version,
    release_row_anchor: event.release_row_anchor,
    release_row_hash: event.release_row_hash,
    primary_evidence_ids: [event.evidence_id],
    evidence_ids: [event.evidence_id],
    publishedAt: '',
    published_date: '',
    datePrecision: event.effective_date ? 'day' : '',
    date_precision: event.effective_date ? 'day' : '',
    relevance_bucket: bucket,
    relevanceBucket: bucket,
    category: ensureArray(source.expected_categories)[0] || 'android',
    source_category: ensureArray(source.expected_categories)[0] || 'android',
    priority: source.source_priority,
    source_priority: source.source_priority,
    reliability: 'official',
    source_reliability: 'official',
    source_quality_required: true,
    ...sourceQuality,
    version_or_release: event.release_row_version ||
      releaseNoteEvidence?.version_or_release ||
      event.release_row_anchor || releaseEvidenceKey(event.current_values?.anchors || []),
    api_or_component: releaseNoteEvidence?.api_or_component ||
      (bucket === 'cpp_ai_tooling_fallback' ? 'Android native tooling workflow' : 'Camera source snapshot change'),
    behavior_change: releaseNoteEvidence?.behavior_change || event.reason,
    ...(releaseNoteEvidence?.section_links?.length
      ? { outgoing_links: releaseNoteEvidence.section_links }
      : {}),
    evidence_score: mainDateEligible ? 8 : 4,
    relevanceScore: mainDateEligible ? 85 : 45,
    relevance_score: mainDateEligible ? 85 : 45,
    cameraHalRelevanceScore: bucket === 'direct_aosp_camera' ? 85 : 60,
    camera_hal_relevance_score: bucket === 'direct_aosp_camera' ? 85 : 60,
    selection_exclusion_reason: mainDateEligible
      ? 'Source snapshot event has strong date evidence and source binding.'
      : 'Source snapshot event is review/watchlist only because date evidence is weak or diagnostic.',
    verification_hint: 'Review source-change-events artifacts before using this candidate.',
    date_quality: dateQuality,
    content_changed: !NON_CONTENT_CHANGE_EVENT_TYPES.has(event.event_type),
    snapshot_last_seen_at: event.current_values?.last_seen_at || '',
    snapshot_seen_count: event.current_values?.seen_count || 0
  };
}

function summarizeEvents(events = [], diagnostics = []) {
  const counts = {};
  for (const event of events) {
    counts[event.event_type] = (counts[event.event_type] || 0) + 1;
  }
  return {
    monitored_source_count: unique(events.map(event => event.source_id)).length,
    snapshot_page_count: events.filter(event => event.current_values && !event.current_values.removed_status).length,
    new_page_count: counts.page_added || 0,
    updated_page_count: ['last_updated_changed', 'structured_modified_changed', 'sitemap_lastmod_changed', 'material_content_changed', 'content_changed_without_date_change', 'release_row_added', 'release_row_changed', 'anchor_added'].reduce((sum, key) => sum + (counts[key] || 0), 0),
    release_row_added_count: counts.release_row_added || 0,
    release_row_changed_count: counts.release_row_changed || 0,
    anchor_added_count: counts.anchor_added || 0,
    material_content_change_count: (counts.material_content_changed || 0) + (counts.content_changed_without_date_change || 0),
    no_meaningful_change_count: counts.no_meaningful_change || 0,
    generated_candidate_count: events.filter(event => event.candidate_allowed === true).length,
    candidate_allowed_count: events.filter(event => event.candidate_allowed === true).length,
    main_article_allowed_count: events.filter(event => event.main_article_allowed === true).length,
    watchlist_only_count: events.filter(event => event.candidate_allowed === true && event.main_article_allowed !== true).length,
    duplicate_event_evidence_count: events.filter(event => event.duplicate_processed === true).length,
    monitor_diagnostic_count: diagnostics.length,
    event_type_counts: counts
  };
}

function markdownReport(report) {
  const lines = [
    `# Source Change Events - ${report.date}`,
    '',
    '## Source Snapshot Changes',
    '',
    `- monitored source count: ${report.summary.monitored_source_count}`,
    `- snapshot page count: ${report.summary.snapshot_page_count}`,
    `- new page count: ${report.summary.new_page_count}`,
    `- updated page count: ${report.summary.updated_page_count}`,
    `- release row added count: ${report.summary.release_row_added_count}`,
    `- release row changed count: ${report.summary.release_row_changed_count}`,
    `- anchor added count: ${report.summary.anchor_added_count}`,
    `- material content change count: ${report.summary.material_content_change_count}`,
    `- no meaningful change count: ${report.summary.no_meaningful_change_count}`,
    '',
    '## Source Change Events',
    '',
    '| event_type | source_id | candidate_allowed | date_source | date_confidence | title |',
    '| --- | --- | --- | --- | ---: | --- |'
  ];
  for (const event of report.events) {
    lines.push(`| ${event.event_type} | ${event.source_id} | ${event.candidate_allowed ? 'yes' : 'no'} | ${event.date_source} | ${event.date_confidence} | ${String(event.title || '').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('## Evidence Identity / Duplicate Guard');
  lines.push('');
  lines.push(`- generated candidate count: ${report.summary.generated_candidate_count}`);
  lines.push(`- candidate allowed count: ${report.summary.candidate_allowed_count}`);
  lines.push(`- main article allowed count: ${report.summary.main_article_allowed_count}`);
  lines.push(`- watchlist only count: ${report.summary.watchlist_only_count}`);
  lines.push(`- duplicate event/evidence count: ${report.summary.duplicate_event_evidence_count}`);
  lines.push('- `processed_source_event_ids`: prevents repeated diagnostic/source event reporting for the same change.');
  lines.push('- `processed_evidence_ids`: prevents repeated article candidate conversion for source event evidence that survived into candidate artifacts.');
  lines.push('- `page_removed` and `metadata_only_changed` may update `processed_source_event_ids` without adding `processed_evidence_ids`.');
  lines.push('');
  lines.push('## Date Quality');
  lines.push('');
  lines.push('| source_event_id | effective_date | date_source | date_confidence | needs_editor_date_review | main_article_allowed |');
  lines.push('| --- | --- | --- | ---: | --- | --- |');
  for (const event of report.events) {
    lines.push(`| ${event.source_event_id} | ${event.effective_date || '-'} | ${event.date_source} | ${event.date_confidence} | ${event.needs_editor_date_review ? 'yes' : 'no'} | ${event.main_article_allowed ? 'yes' : 'no'} |`);
  }
  if (report.diagnostics.length > 0) {
    lines.push('');
    lines.push('## Monitor Diagnostics');
    lines.push('');
    for (const diagnostic of report.diagnostics) {
      lines.push(`- ${diagnostic.type}: ${diagnostic.source_id} ${diagnostic.url || ''} ${diagnostic.message || ''}`.trim());
    }
  }
  lines.push('');
  return lines.join('\n');
}

function buildNextSnapshotWrites(source, snapshot, observations, events, detectedAt) {
  return {
    source,
    previousSnapshot: snapshot,
    events,
    snapshot: nextSnapshotForSource(source, snapshot, observations, events, detectedAt)
  };
}

function buildSourceEventCandidates(events = [], sourceById = new Map()) {
  return ensureArray(events)
    .map(event => candidateFromEvent(event, sourceById.get(event.source_id)))
    .filter(Boolean);
}

function normalizeSet(values = []) {
  if (values instanceof Set) return values;
  return new Set(ensureArray(values).map(text).filter(Boolean));
}

function filterSnapshotWritesByIncludedEvidenceIds(snapshotWrites = [], includedEvidenceIds = new Set()) {
  const included = normalizeSet(includedEvidenceIds);
  return ensureArray(snapshotWrites).map(item => {
    const previousSnapshot = item.previousSnapshot || emptySnapshot(item.source?.source_id);
    const events = ensureArray(item.events);
    const includedCandidateEvents = events.filter(event =>
      event.candidate_allowed === true &&
      included.has(event.evidence_id)
    );
    const diagnosticEvents = events.filter(event =>
      event.event_type !== 'no_meaningful_change' &&
      event.candidate_allowed !== true
    );
    return {
      ...item,
      snapshot: {
        ...item.snapshot,
        processed_source_event_ids: boundedHistory([
          ...ensureArray(previousSnapshot.processed_source_event_ids),
          ...diagnosticEvents.map(event => event.source_event_id),
          ...includedCandidateEvents.map(event => event.source_event_id)
        ]),
        processed_evidence_ids: boundedHistory([
          ...ensureArray(previousSnapshot.processed_evidence_ids),
          ...includedCandidateEvents.map(event => event.evidence_id)
        ])
      }
    };
  });
}

function commitSourceSnapshotWrites({ root = process.cwd(), snapshotWrites = [], writeOptions = {} } = {}) {
  for (const item of ensureArray(snapshotWrites)) {
    writeJsonAtomic(snapshotPath(root, item.source.source_id), item.snapshot, writeOptions);
  }
}

function writeSourceEventArtifacts({ root = process.cwd(), date, report }) {
  writeJson(sourceEventsJsonPath(root, date), report);
  fs.mkdirSync(sourceEventsDir(root, date), { recursive: true });
  fs.writeFileSync(sourceEventsMarkdownPath(root, date), markdownReport(report), 'utf8');
}

async function collectAndClassifySourceEvents(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date;
  const detectedAt = options.detectedAt || `${date}T00:00:00.000Z`;
  const registry = options.registry || loadRegistry(root);
  const allEvents = [];
  const allDiagnostics = [];
  const snapshotWrites = [];
  const sourceById = new Map();

  for (const source of ensureArray(registry.sources)) {
    sourceById.set(source.source_id, source);
    const snapshot = options.snapshots?.[source.source_id] || loadSnapshot(root, source.source_id);
    const previousByKey = new Map(snapshot.pages.map(page => [page.source_identity_key, page]));
    const collected = options.observations?.[source.source_id]
      ? { observations: options.observations[source.source_id], diagnostics: [], incomplete: false }
      : await collectObservationsForSource(source, options);
    allDiagnostics.push(...collected.diagnostics);
    if (collected.incomplete) {
      allDiagnostics.push({
        type: 'incomplete_observation',
        source_id: source.source_id,
        message: 'Source observation incomplete; snapshot write and candidate conversion skipped for this source.'
      });
      continue;
    }
    const events = collected.observations.map(current => classifyObservation({
      source,
      previous: previousByKey.get(current.source_identity_key) || null,
      current,
      snapshot,
      detectedAt
    }));
    const currentKeys = new Set(collected.observations.map(observation => observation.source_identity_key));
    for (const previous of snapshot.pages) {
      if (currentKeys.has(previous.source_identity_key)) continue;
      if (!pageInRegistryScope(source, previous)) continue;
      events.push(classifyObservation({
        source,
        previous,
        current: {
          ...previous,
          removed_status: 'scope_disappearance'
        },
        snapshot,
        detectedAt
      }));
    }
    allEvents.push(...events);
    snapshotWrites.push(buildNextSnapshotWrites(source, snapshot, collected.observations, events, detectedAt));
  }

  return {
    date,
    detectedAt,
    events: allEvents,
    diagnostics: allDiagnostics,
    snapshotWrites,
    sourceById
  };
}

async function runSourceMonitor(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date;
  const collected = await collectAndClassifySourceEvents(options);
  const allCandidates = buildSourceEventCandidates(collected.events, collected.sourceById);

  const report = {
    schema_version: 1,
    date,
    generated_at: collected.detectedAt,
    summary: summarizeEvents(collected.events, collected.diagnostics),
    events: collected.events,
    diagnostics: collected.diagnostics
  };

  if (options.writeArtifacts !== false) {
    writeSourceEventArtifacts({ root, date, report });
    if (options.commitSnapshots !== false) {
      commitSourceSnapshotWrites({
        root,
        snapshotWrites: collected.snapshotWrites,
        writeOptions: options.snapshotWriteOptions || {}
      });
    }
  }

  return {
    report,
    candidates: allCandidates,
    snapshotWrites: collected.snapshotWrites
  };
}

module.exports = {
  CANDIDATE_BLOCKED_EVENT_TYPES,
  NON_CONTENT_CHANGE_EVENT_TYPES,
  PROCESSED_ID_LIMIT,
  SNAPSHOT_SCHEMA_VERSION,
  SOURCE_EVENTS_ROOT,
  SOURCE_MONITOR_REGISTRY_REL_PATH,
  SOURCE_SNAPSHOT_ROOT,
  buildNextSnapshotWrites,
  buildSourceEventCandidates,
  candidateFromEvent,
  classifyObservation,
  collectAndClassifySourceEvents,
  collectObservationsForSource,
  commitSourceSnapshotWrites,
  filterSnapshotWritesByIncludedEvidenceIds,
  loadRegistry,
  loadSnapshot,
  observationFromHtml,
  markdownReport,
  runSourceMonitor,
  sourceEventsJsonPath,
  sourceEventsMarkdownPath,
  snapshotPath,
  summarizeEvents,
  visibleLastUpdated
};
