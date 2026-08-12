const EVENT_TYPES = Object.freeze([
  'page_added',
  'page_removed',
  'last_updated_changed',
  'structured_modified_changed',
  'sitemap_lastmod_changed',
  'release_row_added',
  'release_row_changed',
  'anchor_added',
  'material_content_changed',
  'content_changed_without_date_change',
  'metadata_only_changed',
  'no_meaningful_change'
]);

const DATE_SOURCE_CONFIDENCE = Object.freeze({
  visible_date: 100,
  structured_date_published: 95,
  release_row_date: 95,
  visible_last_updated: 85,
  structured_date_modified: 85,
  rss_pub_date: 85,
  atom_updated: 85,
  sitemap_lastmod: 70,
  url_path_date: 65,
  snapshot_page_added: 60,
  http_last_modified: 45,
  content_hash_changed_without_date: 40,
  snapshot_detected_at: 35,
  missing: 0
});

const DATE_SOURCES = Object.freeze(Object.keys(DATE_SOURCE_CONFIDENCE));
const EVENT_TYPE_SET = new Set(EVENT_TYPES);
const DATE_SOURCE_SET = new Set(DATE_SOURCES);

function text(value) {
  return String(value || '').trim();
}

function number(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeDate(value) {
  const raw = text(value);
  if (!raw) return '';
  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

const MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]);

const DISPLAY_ISO_DATE_PATTERN = /^(20\d{2})-(\d{2})-(\d{2})/;
const DISPLAY_MONTH_DAY_YEAR_PATTERN = /^([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})$/;
const DISPLAY_DAY_MONTH_YEAR_PATTERN = /^(?:[A-Za-z]{3},\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b/;

// 월 이름을 숫자로 옮긴다. 전체 이름('July')과 3글자 약칭('Jul') 둘 다 받되 정확히 일치할
// 때만 인정한다 — 앞 3글자만 보면 'Junk'가 6월로 둔갑한다.
function monthNumberFromName(value) {
  const name = text(value).toLowerCase();
  const index = MONTH_NAMES.findIndex(month => {
    const full = month.toLowerCase();
    return name === full || name === full.slice(0, 3);
  });
  return index < 0 ? '' : String(index + 1).padStart(2, '0');
}

function formatDateFromMonthName(year, monthName, day) {
  const month = monthNumberFromName(monthName);
  if (!month) return '';
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

// 표시용 날짜 정규화. 소스마다 원문 표기가 달라(ISO 날짜 '2026-03-25' / ISO 타임스탬프
// '2026-07-10T11:12:38+01:00' / 'July 01, 2026' / RSS pubDate 'Thu, 30 Apr 2026 22:36:23 +0000')
// 원문을 그대로 찍으면 한 목록 안에서 표기가 뒤섞인다. 넷 다 YYYY-MM-DD로 맞춘다.
// 돌려주는 값은 '' 아니면 YYYY-MM-DD 둘 중 하나뿐이다.
//
// normalizeDate를 재사용하지 않는 이유 두 가지:
//   1. new Date('July 01, 2026')는 로컬 자정으로 해석돼 toISOString에서 하루 밀린다
//      (실측 Asia/Seoul: '2026-06-30'). 그래서 월 이름은 표로 직접 옮긴다.
//   2. normalizeDate('2026-07')는 '2026-07-01'로 없는 정밀도를 만들어낸다.
// 타임존도 변환하지 않는다 — 변환하면 소스가 말한 날짜 자체가 바뀐다.
// 아는 형식이 아니면 날짜를 지어내는 대신 ''를 돌려 호출부가 판단하게 한다.
function displayDate(value) {
  const raw = text(value);

  const isoDate = DISPLAY_ISO_DATE_PATTERN.exec(raw);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const monthDayYear = DISPLAY_MONTH_DAY_YEAR_PATTERN.exec(raw);
  if (monthDayYear) return formatDateFromMonthName(monthDayYear[3], monthDayYear[1], monthDayYear[2]);

  const dayMonthYear = DISPLAY_DAY_MONTH_YEAR_PATTERN.exec(raw);
  if (dayMonthYear) return formatDateFromMonthName(dayMonthYear[3], dayMonthYear[2], dayMonthYear[1]);

  return '';
}

function isKnownEventType(value) {
  return EVENT_TYPE_SET.has(text(value));
}

// month 정밀도 후보(AOSP Site Updates의 월별 묶음 행)는 그 달 어느 날의 변경인지 알 수 없어
// 날짜가 달의 1일로 채워진다. 그래서 창 안/밖 판정은 점이 아니라 달 범위(1일~말일)가 창과
// 겹치는지로 해야 한다. 수집과 선정이 이 규칙을 각각 구현하다 어긋나서 창 안 AOSP Camera ITS
// 문서 갱신이 통째로 사라진 적이 있어(2026-08-10) 규칙을 여기 한 곳에만 둔다.
function monthRangeOverlapsWindow(value, windowStartMs, windowEndMs) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return false;
  const monthStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const monthEndMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999);
  return monthEndMs >= windowStartMs && monthStartMs <= windowEndMs;
}

function isKnownDateSource(value) {
  return DATE_SOURCE_SET.has(text(value));
}

function dateSourceConfidence(value) {
  const source = text(value) || 'missing';
  return DATE_SOURCE_CONFIDENCE[source] ?? 0;
}

function validateEventType(value, label = 'event_type') {
  return isKnownEventType(value) ? '' : `${label} must be one of: ${EVENT_TYPES.join(', ')}.`;
}

function validateDateSource(value, label = 'date_source') {
  return isKnownDateSource(value) ? '' : `${label} must be one of: ${DATE_SOURCES.join(', ')}.`;
}

function publishReadyDateEvidenceFromConfidence(confidence) {
  return number(confidence) >= 85;
}

function weakDateReviewRequired(confidence, dateSource) {
  const source = text(dateSource);
  return number(confidence) < 85 ||
    source === 'content_hash_changed_without_date' ||
    source === 'snapshot_detected_at' ||
    source === 'missing';
}

function resolveCandidateDateEvidence(candidate = {}) {
  const publishedDate = normalizeDate(candidate.published_date || candidate.publishedAt || candidate.published_at);
  if (publishedDate) {
    const source = text(candidate.date_source) || 'visible_date';
    const confidence = Math.max(dateSourceConfidence(source), 85);
    return {
      date: publishedDate,
      date_field: 'published_date',
      date_source: source,
      date_confidence: confidence,
      publish_ready_date_evidence: true,
      needs_editor_date_review: false,
      reason: 'published_date present'
    };
  }

  const effectiveDate = normalizeDate(candidate.effective_date || candidate.effectiveDate);
  const source = text(candidate.date_source) || (effectiveDate ? 'missing' : 'missing');
  const confidence = number(candidate.date_confidence, dateSourceConfidence(source));
  const blockedSource = ['snapshot_detected_at', 'content_hash_changed_without_date', 'missing'].includes(source);
  const publishReady = Boolean(effectiveDate) &&
    publishReadyDateEvidenceFromConfidence(confidence) &&
    !blockedSource;
  return {
    date: effectiveDate,
    date_field: effectiveDate ? 'effective_date' : '',
    date_source: source,
    date_confidence: confidence,
    publish_ready_date_evidence: publishReady,
    needs_editor_date_review: candidate.needs_editor_date_review === true ||
      weakDateReviewRequired(confidence, source),
    reason: effectiveDate ? 'effective_date present' : 'missing date evidence'
  };
}

function dateQualityForCandidate(candidate = {}) {
  const evidence = resolveCandidateDateEvidence(candidate);
  return {
    effective_date: text(candidate.effective_date || candidate.effectiveDate),
    published_date_present: Boolean(text(candidate.published_date || candidate.publishedAt || candidate.published_at)),
    date_source: evidence.date_source,
    date_confidence: evidence.date_confidence,
    needs_editor_date_review: evidence.needs_editor_date_review,
    main_article_date_eligible: evidence.publish_ready_date_evidence,
    date_field: evidence.date_field
  };
}

module.exports = {
  DATE_SOURCE_CONFIDENCE,
  DATE_SOURCES,
  EVENT_TYPES,
  dateQualityForCandidate,
  dateSourceConfidence,
  displayDate,
  isKnownDateSource,
  isKnownEventType,
  monthRangeOverlapsWindow,
  normalizeDate,
  publishReadyDateEvidenceFromConfidence,
  resolveCandidateDateEvidence,
  validateDateSource,
  validateEventType,
  weakDateReviewRequired
};
