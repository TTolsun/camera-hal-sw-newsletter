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

const SNAPSHOT_SCHEMA_VERSION = 1;
const PROCESSED_ID_LIMIT = 500;
const SOURCE_MONITOR_REGISTRY_REL_PATH = 'data/source-monitor-registry.json';
const SOURCE_SNAPSHOT_ROOT = path.join('data', 'source-snapshots');
const SOURCE_EVENTS_ROOT = path.join('content', 'source-events');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function visibleLastUpdated(html = '') {
  const value = visibleText(html);
  const match = value.match(/\bLast updated\s+([^.\n]+?)(?:\s+UTC)?\.?\b/i);
  return match ? firstDateMatch(match[1]) : '';
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

function dateSignalForObservation(observation = {}) {
  if (observation.visible_last_updated) {
    return {
      effective_date: observation.visible_last_updated,
      date_source: 'visible_last_updated'
    };
  }
  if (observation.structured_date_published) {
    return {
      effective_date: observation.structured_date_published,
      date_source: 'structured_date_published'
    };
  }
  if (observation.structured_date_modified) {
    return {
      effective_date: observation.structured_date_modified,
      date_source: 'structured_date_modified'
    };
  }
  if (observation.http_last_modified) {
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
  const httpLastModified = firstDateMatch(headers['last-modified'] || headers['Last-Modified']);
  return {
    source_identity_key: sourceIdentityKey({ sourceId: source.source_id, url: canonicalUrl }),
    url,
    canonical_url: canonicalUrl,
    title: titleFromHtml(html, source.source_id),
    visible_last_updated: visibleLastUpdated(html),
    structured_date_published: structuredDate(html, ['datePublished', 'article:published_time']),
    structured_date_modified: structuredDate(html, ['dateModified', 'article:modified_time']),
    sitemap_lastmod: '',
    http_last_modified: httpLastModified,
    content_hash: contentHash(html),
    normalized_content_hash: normalizedContentHash(html),
    anchors: meaningfulAnchors(html, canonicalUrl),
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
    const response = await fetchImpl(url, { signal: controller.signal });
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

function changedDateField(previous = {}, current = {}) {
  for (const field of ['visible_last_updated', 'structured_date_published', 'structured_date_modified', 'sitemap_lastmod', 'http_last_modified']) {
    if (text(previous[field]) !== text(current[field]) && text(current[field])) return field;
  }
  return '';
}

function eventTypeForDateField(field) {
  if (field === 'visible_last_updated') return 'last_updated_changed';
  if (field === 'structured_date_modified') return 'structured_modified_changed';
  if (field === 'sitemap_lastmod') return 'sitemap_lastmod_changed';
  return 'material_content_changed';
}

function dateSourceForDateField(field) {
  if (field === 'visible_last_updated') return 'visible_last_updated';
  if (field === 'structured_date_published') return 'structured_date_published';
  if (field === 'structured_date_modified') return 'structured_date_modified';
  if (field === 'sitemap_lastmod') return 'sitemap_lastmod';
  if (field === 'http_last_modified') return 'http_last_modified';
  return 'missing';
}

function buildEvent({ source, previous, current, eventType, dateSource, effectiveDate, detectedAt, duplicate = false, reason = '' }) {
  const identityKey = current?.source_identity_key || previous?.source_identity_key || '';
  const evidenceKey = releaseEvidenceKey(current?.anchors) || current?.normalized_content_hash || current?.canonical_url || identityKey;
  const source_event_id = sourceEventId({
    sourceId: source.source_id,
    eventType,
    sourceIdentityKey: identityKey,
    effectiveDate,
    evidenceKey
  });
  const evidence_id = evidenceId({
    sourceId: source.source_id,
    sourceIdentityKey: identityKey,
    eventType,
    effectiveDate,
    evidenceKey
  });
  const date_confidence = dateSourceConfidence(dateSource);
  const candidateAllowed = !duplicate &&
    !['page_removed', 'metadata_only_changed', 'no_meaningful_change'].includes(eventType);
  const mainArticleAllowed = candidateAllowed &&
    source.main_article_allowed === true &&
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
    previous_values: previous || null,
    current_values: current || null,
    content_changed: text(previous?.normalized_content_hash) !== text(current?.normalized_content_hash),
    detected_at: detectedAt,
    effective_date: normalizeDate(effectiveDate),
    date_source: dateSource,
    date_confidence,
    candidate_allowed: candidateAllowed,
    main_article_allowed: mainArticleAllowed,
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

  if (current.removed_status === 404 || current.removed_status === 410) {
    eventType = 'page_removed';
    dateSource = 'missing';
    reason = `Confirmed removed with HTTP ${current.removed_status}.`;
  } else if (!previous) {
    eventType = 'page_added';
    const signal = dateSignalForObservation(current);
    effectiveDate = signal.effective_date || detectedAt;
    dateSource = signal.effective_date ? signal.date_source : 'snapshot_page_added';
    reason = 'New page under monitored source.';
  } else {
    const previousAnchors = new Set(ensureArray(previous.anchors));
    const addedAnchors = ensureArray(current.anchors).filter(anchor => !previousAnchors.has(anchor));
    const dateField = changedDateField(previous, current);
    const normalizedChanged = text(previous.normalized_content_hash) !== text(current.normalized_content_hash);
    if (addedAnchors.some(anchor => /\d+\.\d+\.\d+(?:[-\w.]*)?/i.test(anchor))) {
      eventType = 'release_row_added';
      effectiveDate = dateSignalForObservation(current).effective_date || detectedAt;
      dateSource = dateSignalForObservation(current).effective_date ? dateSignalForObservation(current).date_source : 'snapshot_detected_at';
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
      effectiveDate = dateSignalForObservation(current).effective_date || detectedAt;
      dateSource = dateSignalForObservation(current).effective_date ? dateSignalForObservation(current).date_source : 'snapshot_detected_at';
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

function nextPage(previous, current, detectedAt) {
  return {
    ...current,
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
  const sourceQuality = sourceQualityForEvent({
    ...event,
    main_article_allowed: mainDateEligible
  });
  return {
    schema_version: 5,
    source: source.source_id,
    source_name: source.source_id,
    source_id: source.source_id,
    sourceUrl: source.root_url,
    source_url: source.root_url,
    articleUrl: event.url,
    article_url: event.url,
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
    version_or_release: releaseEvidenceKey(event.current_values?.anchors || []),
    api_or_component: bucket === 'cpp_ai_tooling_fallback' ? 'Android native tooling workflow' : 'Camera source snapshot change',
    behavior_change: event.reason,
    evidence_score: mainDateEligible ? 8 : 4,
    relevanceScore: mainDateEligible ? 85 : 45,
    relevance_score: mainDateEligible ? 85 : 45,
    cameraHalRelevanceScore: bucket === 'direct_aosp_camera' ? 85 : 60,
    camera_hal_relevance_score: bucket === 'direct_aosp_camera' ? 85 : 60,
    selection_exclusion_reason: mainDateEligible
      ? 'Source snapshot event has strong date evidence and source binding.'
      : 'Source snapshot event is review/watchlist only because date evidence is weak or diagnostic.',
    verification_hint: 'Review source-change-events artifacts before using this candidate.',
    date_quality: dateQuality
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
    updated_page_count: ['last_updated_changed', 'structured_modified_changed', 'sitemap_lastmod_changed', 'material_content_changed', 'content_changed_without_date_change'].reduce((sum, key) => sum + (counts[key] || 0), 0),
    material_content_change_count: (counts.material_content_changed || 0) + (counts.content_changed_without_date_change || 0),
    no_meaningful_change_count: counts.no_meaningful_change || 0,
    generated_candidate_count: events.filter(event => event.candidate_allowed === true).length,
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
  lines.push(`- duplicate event/evidence count: ${report.summary.duplicate_event_evidence_count}`);
  lines.push('- `processed_source_event_ids` and `processed_evidence_ids` are bounded snapshot state and are not public newsletter content.');
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

async function runSourceMonitor(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date;
  const detectedAt = options.detectedAt || `${date}T00:00:00.000Z`;
  const registry = options.registry || loadRegistry(root);
  const allEvents = [];
  const allDiagnostics = [];
  const allCandidates = [];
  const snapshotWrites = [];

  for (const source of ensureArray(registry.sources)) {
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
    allEvents.push(...events);
    allCandidates.push(...events.map(event => candidateFromEvent(event, source)).filter(Boolean));
    snapshotWrites.push({
      source,
      snapshot: nextSnapshotForSource(source, snapshot, collected.observations, events, detectedAt)
    });
  }

  const report = {
    schema_version: 1,
    date,
    generated_at: detectedAt,
    summary: summarizeEvents(allEvents, allDiagnostics),
    events: allEvents,
    diagnostics: allDiagnostics
  };

  if (options.writeArtifacts !== false) {
    writeJson(sourceEventsJsonPath(root, date), report);
    fs.mkdirSync(sourceEventsDir(root, date), { recursive: true });
    fs.writeFileSync(sourceEventsMarkdownPath(root, date), markdownReport(report), 'utf8');
    for (const item of snapshotWrites) {
      writeJson(snapshotPath(root, item.source.source_id), item.snapshot);
    }
  }

  return {
    report,
    candidates: allCandidates,
    snapshotWrites
  };
}

module.exports = {
  PROCESSED_ID_LIMIT,
  SNAPSHOT_SCHEMA_VERSION,
  SOURCE_EVENTS_ROOT,
  SOURCE_MONITOR_REGISTRY_REL_PATH,
  SOURCE_SNAPSHOT_ROOT,
  candidateFromEvent,
  classifyObservation,
  collectObservationsForSource,
  loadRegistry,
  loadSnapshot,
  markdownReport,
  runSourceMonitor,
  sourceEventsJsonPath,
  sourceEventsMarkdownPath,
  snapshotPath,
  summarizeEvents
};
