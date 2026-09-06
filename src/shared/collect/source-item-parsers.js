const { decodeHtml, htmlAttr } = require('../common/common');
const { extractOutgoingLinksFromHtml } = require('./outgoing-links');
const { parseSourceWithAdapters } = require('../sources/registry');
const {
  firstConcreteBullet: firstVersionedReleaseBullet,
  normalizeVersionedReleaseExtraction
} = require('./versioned-release-row');

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const ISO_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const MONTH_DATE_PATTERN = new RegExp(`\\b(${MONTHS}\\s+\\d{1,2},\\s+20\\d{2})\\b`, 'i');
const MONTH_DAY_YEAR_PATTERN = new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})\\s+(20\\d{2})\\b`, 'i');
const MONTH_DAY_TIME_YEAR_PATTERN = new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s+(?:[A-Z]{2,5}|[+-]\\d{4}))?\\s+(20\\d{2})\\b`, 'i');
const RFC_DATE_PATTERN = new RegExp(`\\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\\s+(\\d{1,2})\\s+(${MONTHS})\\s+(20\\d{2})\\b`, 'i');
const MONTH_YEAR_PATTERN = new RegExp(`\\b(${MONTHS})\\s+(20\\d{2})\\b`, 'i');
const SMR_PATTERN = /\b(?:SMR[-\s]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]?20\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\s+SMR|Security Maintenance Release)\b/i;
const VERSION_PATTERN = /\b(?:Android\s+\d+(?:\s+QPR\d+)?|CameraX\s+\d+\.\d+\.\d+(?:[-\w.]*)?|Media3\s+\d+\.\d+\.\d+(?:[-\w.]*)?|Claude Code\s+v?\d+\.\d+\.\d+(?:[-\w.]*)?|LLVM\s+\d+\.\d+(?:\.\d+)?|libcamera\s+v?\d+\.\d+(?:\.\d+)?|SMR[-\s]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]?20\d{2}|v?\d+\.\d+\.\d+(?:[-\w.]*)?)\b/i;
const BEHAVIOR_PATTERN = /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|remove(?:d|s)?|deprecat(?:ed|es)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|migrat(?:ed|es|ion)|security|vulnerability|CVE|bulletin|release(?:d|s)?|compatibility|requirement|API|behavior)\b/i;
const MONTH_NUMBER = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12'
};

function stripTags(value = '') {
  return decodeHtml(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function clean(value = '') {
  return stripTags(value).replace(/\s+/g, ' ').trim();
}

function formatExactMonthDate(year, monthName, day) {
  const mm = MONTH_NUMBER[String(monthName || '').toLowerCase()];
  if (!mm) return '';
  return `${year}-${mm}-${String(day).padStart(2, '0')}`;
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function firstDate(text = '') {
  const iso = String(text).match(ISO_DATE_PATTERN);
  if (iso) return iso[1];
  const month = String(text).match(MONTH_DATE_PATTERN);
  if (month) return month[1];
  const monthDayTimeYear = String(text).match(MONTH_DAY_TIME_YEAR_PATTERN);
  if (monthDayTimeYear) return formatExactMonthDate(monthDayTimeYear[3], monthDayTimeYear[1], monthDayTimeYear[2]);
  const monthDayYear = String(text).match(MONTH_DAY_YEAR_PATTERN);
  if (monthDayYear) return formatExactMonthDate(monthDayYear[3], monthDayYear[1], monthDayYear[2]);
  const rfcDate = String(text).match(RFC_DATE_PATTERN);
  if (rfcDate) return formatExactMonthDate(rfcDate[3], rfcDate[2], rfcDate[1]);
  const compactSmr = String(text).match(/\bSMR[-\s]?([A-Z][a-z]{2})[-\s]?(20\d{2})\b/i);
  if (compactSmr) {
    const mm = MONTH_NUMBER[compactSmr[1].toLowerCase()];
    return mm ? `${compactSmr[2]}-${mm}-01` : '';
  }
  return '';
}

function firstMonthYearDate(text = '') {
  const monthYear = String(text).match(MONTH_YEAR_PATTERN);
  if (!monthYear) return '';
  const mm = MONTH_NUMBER[monthYear[1].toLowerCase()];
  return mm ? `${monthYear[2]}-${mm}-01` : '';
}

function firstSmrDate(text = '') {
  const dated = firstDate(text);
  if (dated) return dated;
  if (!SMR_PATTERN.test(String(text))) return '';
  const monthYear = String(text).match(MONTH_YEAR_PATTERN);
  if (monthYear) {
    const mm = MONTH_NUMBER[monthYear[1].toLowerCase()];
    return mm ? `${monthYear[2]}-${mm}-01` : '';
  }
  return '';
}

function firstVersion(text = '') {
  const match = String(text).match(VERSION_PATTERN);
  if (match) return match[0];
  const smr = String(text).match(SMR_PATTERN);
  return smr ? smr[0] : '';
}

function firstBehavior(text = '') {
  const sentences = clean(text).split(/(?<=[.!?])\s+|\n+/).map(item => item.trim()).filter(Boolean);
  return sentences.find(sentence => BEHAVIOR_PATTERN.test(sentence)) || sentences[0] || '';
}

function componentFromText(text = '', fallback = '') {
  const value = String(text);
  const components = [
    'CameraX',
    'androidx.camera',
    'Camera2',
    'Camera HAL',
    'Camera Provider',
    'CameraProvider',
    'AOSP Camera',
    'Camera images automation',
    'Test camera images',
    'Automotive Camera Service',
    'CameraPipe',
    'SessionConfig',
    'ImageAnalysis',
    'VideoCapture',
    'PreviewView',
    'CameraController',
    'CameraEffect',
    'Media3',
    'MediaCodec',
    'MediaRecorder',
    'MediaStore',
    'Photo Picker',
    'SurfaceView',
    'TextureView',
    'WebRTC',
    'A/V Sync',
    'Android media pipeline',
    'CDD',
    'CDD camera orientation',
    'CTS',
    'VTS',
    'Camera ITS',
    'Android framework',
    'Android Security Bulletin',
    'libcamera',
    'V4L2',
    'media controller',
    'LLVM',
    'Clang',
    'Claude Code',
    'AI coding agent',
    'Samsung Mobile Security',
    'Samsung SMR'
  ];
  return components.find(component => new RegExp(component.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value)) || fallback;
}

function slugFragment(value = '') {
  const slug = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || 'item';
}

function urlWithFragment(baseUrl, value) {
  try {
    const parsed = new URL(baseUrl);
    parsed.hash = slugFragment(value);
    return parsed.toString();
  } catch {
    return `${String(baseUrl).replace(/#.*$/, '')}#${slugFragment(value)}`;
  }
}

function firstAnchor(chunk = '', baseUrl = '') {
  const match = String(chunk).match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const href = htmlAttr(match[1], 'href');
  const title = clean(match[2]);
  return {
    href,
    title,
    url: href ? absoluteUrl(href, baseUrl) : ''
  };
}

function tableCells(row = '') {
  return [...String(row).matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map(match => clean(match[1]))
    .filter(Boolean);
}

function childChunks(body = '') {
  const rows = [...String(body).matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map(match => match[0])
    .filter(row => !/<th\b/i.test(row) || /<td\b/i.test(row));
  const listItems = [...String(body).matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map(match => match[0]);
  const articleCards = [...String(body).matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)]
    .map(match => match[0]);
  return rows.length > 0 ? rows : listItems.length > 0 ? listItems : articleCards;
}

function indexedChildChunks(body = '') {
  const value = String(body);
  const rows = [...value.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map(match => ({ chunk: match[0], index: match.index || 0 }))
    .filter(item => !/<th\b/i.test(item.chunk) || /<td\b/i.test(item.chunk));
  const listItems = [...value.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map(match => ({ chunk: match[0], index: match.index || 0 }));
  const articleCards = [...value.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)]
    .map(match => ({ chunk: match[0], index: match.index || 0 }));
  return rows.length > 0 ? rows : listItems.length > 0 ? listItems : articleCards;
}

function surroundingText(html = '', index = 0, length = 0, before = 1400, after = 900) {
  const value = String(html);
  return value.slice(
    Math.max(0, index - before),
    Math.min(value.length, index + length + after)
  );
}

function childTitle(chunk = '', fallback = '') {
  const anchor = firstAnchor(chunk, fallback);
  if (anchor?.title) return anchor.title;
  const cells = tableCells(chunk);
  const titleCell = cells.find(cell => !firstDate(cell) && !firstMonthYearDate(cell)) || cells[0];
  return titleCell || clean(chunk).slice(0, 140);
}

function monthLabel(value = '') {
  const match = String(value).match(MONTH_YEAR_PATTERN);
  return match ? `${match[1]} ${match[2]}` : '';
}

function cameraVersionFromText(text = '', fallback = '') {
  const version = firstVersion(text);
  if (!version && fallback) return fallback;
  if (/CameraX|androidx\.camera/i.test(text) && /^\d+\.\d+\.\d+/.test(version)) {
    return `CameraX ${version}`;
  }
  return version || fallback;
}

function cameraVersionToken(value = '') {
  const match = String(value).match(/\b\d+\.\d+\.\d+(?:[-\w.]*)?\b/i);
  return match ? match[0] : '';
}

function cameraComponentFromText(value = '', fallback = 'CameraX / androidx.camera') {
  const artifactMatch = String(value).match(/\bandroidx\.camera:[a-z0-9-]+\b/i);
  if (artifactMatch) return `CameraX / ${artifactMatch[0]}`;
  const match = String(value).match(/\bandroidx\.camera\b/i);
  if (match) return `CameraX / ${match[0]}`;
  const cameraXComponent = String(value).match(/\b(CameraPipe|SessionConfig|ImageAnalysis|VideoCapture|PreviewView|CameraController|CameraEffect)\b/i);
  if (cameraXComponent) return `CameraX / ${cameraXComponent[1]}`;
  if (/CameraX|camera maven group|androidx\.camera|camera library/i.test(value)) return fallback;
  return fallback;
}

function cameraLatestUpdateTitle(title = '', version = '', component = '') {
  const cleanTitle = clean(title);
  const versionToken = cameraVersionToken(version);
  const componentLabel = String(component || 'CameraX / androidx.camera').replace(/^CameraX\s*\/\s*/i, '');
  if (versionToken && /\b(?:View the Camera Library|Camera Maven Group versions|Camera Library)\b/i.test(cleanTitle)) {
    return `CameraX ${versionToken} - ${cleanTitle}`;
  }
  if (versionToken && /^androidx\.camera/i.test(cleanTitle)) {
    return `CameraX ${versionToken} - ${cleanTitle}`;
  }
  if (versionToken && (!cleanTitle || cleanTitle === componentLabel)) {
    return `CameraX ${versionToken} - ${componentLabel}`;
  }
  return cleanTitle || [componentLabel, versionToken].filter(Boolean).join(' ');
}

function canonicalCameraReleaseUrl(value = '', version = '') {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'developer.android.google.cn') parsed.hostname = 'developer.android.com';
    if (parsed.hostname === 'developer.android.com') parsed.searchParams.delete('hl');
    const versionToken = cameraVersionToken(version);
    if (
      parsed.hostname === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera' &&
      !parsed.hash &&
      versionToken
    ) {
      parsed.hash = `#${versionToken}`;
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function isCameraUpdateRow(text = '') {
  return /\b(?:CameraX|androidx\.camera|Camera2|Android Camera|AOSP Camera|Camera HAL|Camera ITS|CDD\b[^.\n]{0,80}\bcamera|camera\b[^.\n]{0,80}\bCDD|Camera images automation|image(?:s)? automation|camera orientation|stream|buffer|metadata|capture request|capture result)\b/i
    .test(String(text));
}

const AOSP_SITE_CAMERA_UPDATE_PATTERNS = [
  /\bCamera ITS\b/i,
  /\bCamera image(?:s)? automation\b/i,
  /\bTest camera images\b/i,
  /\bCDD\b[^.\n]{0,120}\bcamera orientation\b/i,
  /\bcamera orientation\b[^.\n]{0,120}\bCDD\b/i,
  /\bAutomotive Camera Service\b/i,
  /\bCamera\s*Provider\b/i,
  /\bCameraProvider\b/i,
  /\bCamera\s*HAL\b/i
];

const NON_CAMERA_HAL_PATTERNS = [
  /\bWeaver HAL\b/i,
  /\bKeyMint HAL\b/i,
  /\bGatekeeper HAL\b/i,
  /\bAudio HAL\b/i
];

function isAospSiteCameraUpdateRow(text = '') {
  const value = String(text);
  const hasCameraEvidence = AOSP_SITE_CAMERA_UPDATE_PATTERNS.some(pattern => pattern.test(value));
  const hasOnlyNonCameraHalEvidence = NON_CAMERA_HAL_PATTERNS.some(pattern => pattern.test(value)) && !hasCameraEvidence;
  return hasCameraEvidence && !hasOnlyNonCameraHalEvidence;
}

function allMatchingChunks(body = '', pattern) {
  return [...String(body).matchAll(pattern)].map(match => match[0]);
}

function aospSiteUpdateChunks(body = '') {
  const value = String(body);
  const chunks = [
    ...childChunks(value),
    ...allMatchingChunks(value, /<p\b[^>]*>[\s\S]*?<\/p>/gi),
    ...allMatchingChunks(value, /<dt\b[^>]*>[\s\S]*?<\/dt>\s*<dd\b[^>]*>[\s\S]*?<\/dd>/gi),
    ...allMatchingChunks(value, /<h[5-6]\b[^>]*>[\s\S]*?<\/h[5-6]>\s*(?:(?!<h[1-6]\b)[\s\S]){0,1200}/gi)
  ];
  const seen = new Set();
  return chunks.filter(chunk => {
    const key = clean(chunk).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cameraXReleaseEvidence(text = '') {
  return /\b(?:CameraX|androidx\.camera|CameraPipe|SessionConfig|ImageAnalysis|VideoCapture|PreviewView|CameraController|CameraEffect|dynamic range|device bug fix|device-specific bug|camera)\b/i
    .test(String(text));
}

function categoryForHeading(heading = '') {
  const value = String(heading || '').toLowerCase();
  if (/bug|fix/.test(value)) return 'bug_fixes';
  if (/api/.test(value)) return 'api_changes';
  if (/feature|new/.test(value)) return 'new_features';
  if (/important/.test(value)) return 'important_changes';
  if (/dependency/.test(value)) return 'dependencies';
  return 'release_notes';
}

function artifactNames(value = '') {
  return [...new Set([
    ...(String(value).match(/\bandroidx\.camera:[a-z0-9_.-]+\b/gi) || []),
    ...(String(value).match(/\bcamera-[a-z0-9-]+\b/gi) || [])
  ])];
}

function issueIds(value = '') {
  return [...new Set(String(value).match(/\b(?:b\/\d+|issue\s+#?\d+)\b/gi) || [])];
}

function normalizeCameraXVersion(value = '', fallback = '') {
  const token = cameraVersionToken(`${value} ${fallback}`);
  if (token) return `CameraX ${token}`;
  const version = cameraVersionFromText(value, fallback);
  if (/^v?\d+\.\d+\.\d+/i.test(version)) return `CameraX ${version.replace(/^v/i, '')}`;
  return version;
}

function normalizeMedia3Version(value = '', fallback = '') {
  const version = firstVersion(`${value} ${fallback}`);
  const match = String(version).match(/\b(?:Media3\s+)?v?(\d+\.\d+\.\d+(?:[-\w.]*)?)\b/i);
  return match ? `Media3 ${match[1]}` : version || fallback;
}

function parserItemKey(item) {
  return `${item.url}|${item.title}`.toLowerCase();
}

function uniqueParserItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = parserItemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function headingBlocks(html, baseUrl) {
  const pattern = /<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi;
  const matches = [...String(html).matchAll(pattern)];
  const blocks = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = current.index + current[0].length;
    const end = next ? next.index : String(html).length;
    const attrs = current[2] || '';
    const id = htmlAttr(attrs, 'id') || htmlAttr(current[3] || '', 'id');
    blocks.push({
      title: clean(current[3]),
      body: String(html).slice(start, Math.min(end, start + 3500)),
      url: id ? `${baseUrl.replace(/#.*$/, '')}#${encodeURIComponent(id)}` : baseUrl
    });
  }
  return blocks;
}

function releaseItemsFromHeadings(html, source, options = {}) {
  const fallbackComponent = options.component || source.name;
  return headingBlocks(html, source.url)
    .filter(block => VERSION_PATTERN.test(`${block.title} ${block.body}`) || /release|version|bulletin|what'?s new/i.test(block.title))
    .map(block => {
      const evidenceText = `${block.title} ${block.body}`;
      const version = firstVersion(evidenceText);
      const date = firstDate(evidenceText);
      const component = componentFromText(evidenceText, fallbackComponent);
      const behavior = firstBehavior(block.body || block.title);
      return {
        source,
        title: [source.name, version || block.title].filter(Boolean).join(' - '),
        url: block.url,
        publishedAt: date,
        summary: behavior || clean(block.body).slice(0, 500),
        sourceKind: options.sourceKind || 'release_note_item',
        version_or_release: version,
        api_or_component: component,
        behavior_change: behavior,
        outgoing_links: extractOutgoingLinksFromHtml(block.body, {
          baseUrl: block.url,
          sourceField: 'release_note_block'
        })
      };
    })
    .filter(item => item.title && item.url)
    .slice(0, options.limit || 12);
}

function hasReleaseItemEvidence(item) {
  return Boolean(item.publishedAt && item.version_or_release && item.api_or_component && item.behavior_change);
}

function sourceUrlParts(source = {}) {
  for (const raw of [source.sourceUrl, source.url]) {
    try {
      return new URL(raw);
    } catch {
      continue;
    }
  }
  return null;
}

function trustedAndroidLatestUpdatesSource(source = {}) {
  const id = String(source.id || source.source_id || '').toLowerCase();
  if (id === 'android-developers-latest-updates') return true;
  const family = String(source.sourceFamilyId || source.source_family_id || source.sourceFamily || '').toLowerCase();
  if (family === 'android-developers-latest-updates') return true;
  const parsed = sourceUrlParts(source);
  const path = parsed?.pathname?.replace(/\/+$/, '');
  return parsed?.hostname === 'developer.android.com' && path === '/latest-updates';
}

function trustedCameraReleaseNoteUrl(value = '') {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera';
  } catch {
    return false;
  }
}

function isArtifactOnlyReleaseEvidence(value = '') {
  const text = String(value);
  return /Maven Group versions?|View the Camera Library|This library was last updated on:/i.test(text) ||
    /\b(?:implementation|dependencies|api)\s+['"]?androidx\.camera:/i.test(text) ||
    /\bcamera-[a-z0-9-]+\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)/i.test(text);
}

function concreteReleaseBehavior(value = '') {
  return clean(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean)
    .find(sentence =>
      BEHAVIOR_PATTERN.test(sentence) &&
      cameraXReleaseEvidence(sentence) &&
      !isArtifactOnlyReleaseEvidence(sentence)
    ) || '';
}

function concreteReleaseBehaviorFromChunk(chunk = '') {
  const cells = tableCells(chunk);
  const tableCandidates = cells.length >= 3
    ? [cells.slice(2).join(' '), cells[cells.length - 1]]
    : [];
  const paragraphCandidates = [...String(chunk).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => clean(match[1]));
  for (const candidate of [...tableCandidates, ...paragraphCandidates, clean(chunk)]) {
    const behavior = concreteReleaseBehavior(candidate);
    if (behavior) return behavior;
  }
  return '';
}

function sourceExtractionItemTexts(extraction = {}) {
  return [
    ...(Array.isArray(extraction?.release?.sections) ? extraction.release.sections : []),
    ...(Array.isArray(extraction?.minor_line_context?.sections) ? extraction.minor_line_context.sections : [])
  ].flatMap(section => Array.isArray(section?.items) ? section.items : [])
    .map(item => clean(item?.text || item?.source_text || ''))
    .filter(Boolean);
}

function hasConcreteVersionedReleaseExtraction(item = {}) {
  const extraction = item.source_extraction || {};
  const quality = item.extraction_quality || extraction.extraction_quality || {};
  if (quality.main_article_allowed === false || quality.has_concrete_behavior_change === false) {
    return false;
  }
  return sourceExtractionItemTexts({ release: extraction.release })
    .some(text => !isArtifactOnlyReleaseEvidence(text));
}

function versionedReleaseRowExtraction({
  source,
  heading,
  releaseUrl,
  date,
  version,
  component,
  behavior,
  links,
  diagnosticReason = ''
}) {
  const sections = behavior ? [{
    category: categoryForHeading(heading || 'Release Notes'),
    heading: heading || 'Release Notes',
    items: [{
      text: behavior,
      source_text: behavior,
      links: Array.isArray(links) ? links : [],
      issue_ids: issueIds(behavior),
      artifact_names: artifactNames(behavior)
    }]
  }] : [];
  const extraction = normalizeVersionedReleaseExtraction({
    adapterId: source.id || 'android-developers-latest-updates',
    sourceType: 'release_note',
    source: {
      name: source.name || 'Release Notes',
      url: releaseUrl || source.sourceUrl || source.url
    },
    parentSource: {
      name: source.name || 'Android Developers Latest Updates',
      url: source.sourceUrl || source.url || ''
    },
    heading: heading || version || '',
    releaseNoteUrl: releaseUrl,
    release: {
      version,
      date,
      component
    },
    sections,
    links,
    extractionQuality: {
      has_concrete_behavior_change: Boolean(behavior),
      used_fallback: !behavior,
      raw_table_used_as_body: false,
      main_article_allowed: Boolean(behavior),
      used_versioned_release_row_extractor: true,
      used_empty_evidence_fallback: !behavior,
      warnings: diagnosticReason ? [diagnosticReason] : []
    }
  });
  return extraction;
}

function latestUpdateItemFromEvidence({
  source,
  rawTitle,
  releaseUrl,
  date,
  version,
  component,
  behavior,
  links,
  contextTitle = '',
  diagnosticReason = ''
}) {
  const title = cameraLatestUpdateTitle(rawTitle, version, component);
  if (!behavior && isArtifactOnlyReleaseEvidence(`${rawTitle} ${releaseUrl}`)) {
    return null;
  }
  const extraction = versionedReleaseRowExtraction({
    source,
    heading: contextTitle || rawTitle || title,
    releaseUrl,
    date,
    version,
    component,
    behavior,
    links,
    diagnosticReason
  });
  const concreteBehavior = firstVersionedReleaseBullet(extraction);
  return {
    source,
    title,
    url: releaseUrl,
    publishedAt: date,
    datePrecision: date ? 'day' : '',
    parentUrl: source.url,
    parentTitle: source.name,
    sourceSection: source.section || '',
    summary: concreteBehavior,
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    version_or_release: version,
    api_or_component: component,
    behavior_change: concreteBehavior,
    source_extraction: extraction,
    extraction_quality: extraction.extraction_quality,
    relevanceBucketHint: 'android',
    linked_release_note_target_url: !concreteBehavior && trustedCameraReleaseNoteUrl(releaseUrl) ? releaseUrl : '',
    parser_gap_reason: !concreteBehavior ? 'missing_concrete_release_note_bullet' : '',
    outgoing_links: links
  };
}

function linkedItems(html, source, options = {}) {
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const items = [];
  for (const match of String(html).matchAll(anchorPattern)) {
    const href = htmlAttr(match[1], 'href');
    const title = clean(match[2]);
    if (!href || !title || !options.keep(title, href)) continue;
    const nearby = String(html).slice(Math.max(0, match.index - 500), Math.min(String(html).length, match.index + match[0].length + 900));
    const evidenceText = `${title} ${href} ${nearby}`;
    const version = firstVersion(evidenceText) || options.versionFallback?.(title, href) || '';
    const date = firstDate(evidenceText) || options.dateFallback?.(title, href, nearby) || '';
    const component = componentFromText(evidenceText, options.component || source.name);
    const behavior = firstBehavior(nearby || title);
    items.push({
      source,
      title,
      url: absoluteUrl(href, source.url),
      publishedAt: date,
      summary: behavior || clean(nearby).slice(0, 500),
      sourceKind: options.sourceKind || 'release_note_item',
      version_or_release: version,
      api_or_component: component,
      behavior_change: behavior,
      outgoing_links: extractOutgoingLinksFromHtml(match[0], {
        baseUrl: source.url,
        sourceField: 'release_note_row'
      })
    });
  }
  const seen = new Set();
  return items.filter(item => {
    const key = options.dedupeWithHash ? item.url : item.url.replace(/[?#].*$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, options.limit || 12);
}

function parseCameraXReleaseNotes(html, source) {
  return parseSourceWithAdapters(html, source);
}

function parseMedia3ReleaseNotes(html, source) {
  const items = headingBlocks(html, source.url)
    .map(block => {
      const version = normalizeMedia3Version(block.title, block.url);
      if (!/^Media3\s+\d+\.\d+\.\d+/i.test(version)) return null;
      const evidenceText = `${block.title} ${block.body}`;
      const date = firstDate(evidenceText);
      const component = componentFromText(evidenceText, 'Media3 / Android media pipeline');
      const behavior = firstBehavior(block.body || block.title);
      if (!date || !version || !component || !behavior) return null;
      const links = extractOutgoingLinksFromHtml(block.body, {
        baseUrl: block.url,
        sourceField: 'release_note_block'
      });
      const extraction = versionedReleaseRowExtraction({
        source,
        heading: block.title || version,
        releaseUrl: block.url,
        date,
        version,
        component,
        behavior,
        links,
        diagnosticReason: ''
      });
      return {
        source,
        title: `${source.name || 'Media3 Release Notes'} - ${version}`,
        url: block.url,
        publishedAt: date,
        datePrecision: 'day',
        parentUrl: source.url,
        parentTitle: source.name,
        sourceSection: source.section || '',
        summary: behavior,
        sourceKind: 'release_note_item',
        collectionMode: 'release-note-item',
        version_or_release: version,
        api_or_component: component,
        behavior_change: behavior,
        source_extraction: extraction,
        extraction_quality: extraction.extraction_quality,
        outgoing_links: links
      };
    })
    .filter(Boolean)
    .filter(hasReleaseItemEvidence);
  return uniqueParserItems(items).slice(0, 12);
}

function parseAospWhatsNew(html, source) {
  return linkedItems(html, source, {
    component: 'AOSP Camera / Android platform compatibility',
    sourceKind: 'release_note_item',
    keep: (title, href) => /release|what'?s new|Android\s+\d|camera|compatibility|CDD|CTS|VTS|ITS/i.test(`${title} ${href}`),
    versionFallback: (title) => (title.match(/\bAndroid\s+\d+(?:\s+QPR\d+)?\b/i) || [])[0] || '',
    limit: 12
  }).filter(hasReleaseItemEvidence);
}

// 섹션 랜딩 링크인지 판정한다. 문자열 접두사만 보면 /docs/compatibility/cts/camera-its 가
// /docs/compatibility/cts/camera-its-box 의 상위로 잘못 잡히므로, 경로 구분자까지 포함해
// 비교한다(형제 문서는 상위가 아니다).
function isSectionLandingUrl(sectionUrl = '', changedDocumentUrl = '') {
  try {
    const section = new URL(sectionUrl);
    const changed = new URL(changedDocumentUrl);
    if (section.origin !== changed.origin) return false;
    return changed.pathname.startsWith(`${section.pathname.replace(/\/+$/, '')}/`);
  } catch {
    return false;
  }
}

// AOSP Site Updates 표는 대개 첫 칸에 섹션 이름 링크를, 마지막 칸에 "무엇이 어디서 바뀌었는지"를
// 싣는다. 행 전체에서 첫 앵커를 고르면 그 섹션 랜딩 페이지(/docs/compatibility)가 제목과 URL이 되어,
// 독자가 실제로 바뀐 문서 대신 목차로 간다. 그래서 표 행이면 변경 내용 칸의 앵커를 본다.
// 다만 첫 칸이 이미 바뀐 문서를 직접 가리키고 마지막 칸에는 참고용 상호 링크만 있는 행도 있다.
// 그런 행에서 마지막 칸을 택하면 맞는 정체성을 틀린 것으로 바꾼다. 그래서 마지막 칸을 택하는
// 조건은 두 가지뿐이다. 첫 칸에 앵커가 없거나, 첫 칸 링크가 마지막 칸 링크의 상위 경로일 때.
// 나머지(표가 아닌 조각 포함)는 null을 돌려 기존 경로를 그대로 타게 한다.
//
// 셀 추출은 이 파일의 다른 파서와 같은 정규식 방식이다(repo에 DOM 파서 의존성이 없고, 이
// 함수 하나를 위해 들이지 않는다). 그래서 지원하는 표 구조를 좁게 가정한다.
//  - chunk는 aospSiteUpdateChunks가 자른 표 행 하나(<tr> 조각) 수준이며, 셀은 잘 닫힌
//    같은 층위의 <td>/<th>만 본다.
//  - 셀 안에 또 표가 중첩되면 안쪽 셀 태그가 같은 층위로 잡혀 칸 배열이 어긋날 수 있다.
//    AOSP Site Updates 표에는 그런 구조가 없다. 표 구조가 그렇게 바뀌면 이 가정부터 다시
//    본다 — 마지막 칸을 택하는 두 조건이 좁아서, 어긋난 칸 배열은 대개 null로 떨어져
//    기존 첫-앵커 경로로 후퇴한다.
function aospSiteUpdateCellAnchor(chunk = '', baseUrl = '') {
  const cells = [...String(chunk).matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1]);
  if (cells.length < 2) return null;
  const updateAnchor = firstAnchor(cells[cells.length - 1], baseUrl);
  if (!updateAnchor?.title || !updateAnchor.url) return null;
  const sectionAnchor = firstAnchor(cells[0], baseUrl);
  if (!sectionAnchor?.url) return updateAnchor;
  return isSectionLandingUrl(sectionAnchor.url, updateAnchor.url) ? updateAnchor : null;
}

function parseAospSiteUpdates(html, source) {
  const parentUrl = source.url;
  const parentTitle = source.name;
  const items = [];

  for (const block of headingBlocks(html, parentUrl)) {
    const date = firstMonthYearDate(block.title);
    if (!date) continue;
    const sourceMonth = monthLabel(block.title);
    for (const chunk of aospSiteUpdateChunks(block.body)) {
      const updateCellAnchor = aospSiteUpdateCellAnchor(chunk, parentUrl);
      const title = updateCellAnchor?.title || childTitle(chunk, parentUrl);
      const evidenceText = `${block.title} ${title} ${clean(chunk)}`;
      if (!isAospSiteCameraUpdateRow(evidenceText)) continue;
      const anchor = updateCellAnchor || firstAnchor(chunk, parentUrl);
      const url = anchor?.url || urlWithFragment(parentUrl, `${sourceMonth} ${title}`);
      const component = componentFromText(evidenceText, /CDD/i.test(evidenceText)
        ? 'CDD camera'
        : /Camera ITS/i.test(evidenceText) ? 'Camera ITS'
        : /Automotive Camera Service/i.test(evidenceText) ? 'Automotive Camera Service'
        : /Camera\s*Provider|CameraProvider/i.test(evidenceText) ? 'Camera Provider'
        : 'AOSP Camera');
      const extractedBehavior = firstBehavior(evidenceText);
      const behavior = BEHAVIOR_PATTERN.test(extractedBehavior)
        ? extractedBehavior
        : `Updated ${title} in ${sourceMonth}.`;
      items.push({
        source,
        title,
        url,
        publishedAt: date,
        datePrecision: 'month',
        parentUrl,
        parentTitle,
        sourceSection: source.section || '',
        sourceMonth,
        summary: behavior,
        sourceKind: 'release_note_item',
        collectionMode: 'release-note-item',
        version_or_release: `AOSP Site Updates - ${sourceMonth}`,
        api_or_component: component,
        behavior_change: behavior
      });
    }
  }

  return uniqueParserItems(items).slice(0, 12);
}

function parseAndroidLatestUpdates(html, source) {
  if (!trustedAndroidLatestUpdatesSource(source)) return [];
  const linked = linkedItems(html, source, {
    component: 'CameraX / androidx.camera',
    sourceKind: 'release_note_item',
    keep: (title, href) => /Camera Maven Group versions|CameraX|androidx\.camera|camera/i.test(`${title} ${href}`),
    versionFallback: (title, href) => cameraVersionFromText(`${title} ${href}`, ''),
    dateFallback: (_title, _href, nearby) => firstDate(nearby),
    dedupeWithHash: true,
    limit: 12
  }).map(item => {
    if (isArtifactOnlyReleaseEvidence(`${item.title} ${item.url}`)) return null;
    const version = cameraVersionFromText(`${item.title} ${item.url} ${item.version_or_release}`, item.version_or_release);
    const component = cameraComponentFromText(`${item.title} ${item.url} ${item.summary} ${item.api_or_component}`);
    const releaseUrl = canonicalCameraReleaseUrl(item.url, version);
    const behavior = concreteReleaseBehavior(`${item.summary} ${item.behavior_change}`);
    const links = extractOutgoingLinksFromHtml(`${item.title} ${item.url}`, {
      baseUrl: source.url,
      sourceField: 'release_note_row'
    });
    return latestUpdateItemFromEvidence({
      source,
      rawTitle: item.title,
      releaseUrl,
      date: item.publishedAt,
      version,
      component,
      behavior,
      links,
      diagnosticReason: behavior ? '' : 'missing_concrete_release_note_bullet'
    });
  }).filter(Boolean);

  const rowsByKey = new Map();
  const addRow = (chunk, contextText = '', contextTitle = '') => {
    const rawTitle = childTitle(chunk, source.url);
    const anchor = firstAnchor(chunk, source.url);
    const cells = tableCells(chunk);
    const rowIdentity = `${rawTitle} ${anchor?.href || ''} ${cells.slice(0, 2).join(' ')}`;
    const evidenceText = `${contextTitle} ${rawTitle} ${clean(chunk)} ${clean(contextText)}`;
    if (!/\b(?:Camera Maven Group versions|CameraX|androidx\.camera|camera)\b/i.test(rowIdentity)) return;
    const date = firstDate(evidenceText);
    const version = cameraVersionFromText(evidenceText, '');
    const component = cameraComponentFromText(evidenceText);
    const title = cameraLatestUpdateTitle(rawTitle, version, component);
    const releaseUrl = canonicalCameraReleaseUrl(anchor?.url || urlWithFragment(source.url, `${contextTitle} ${title}`), version);
    const behavior = concreteReleaseBehaviorFromChunk(chunk);
    const links = extractOutgoingLinksFromHtml(chunk, {
      baseUrl: source.url,
      sourceField: 'release_note_row'
    });
    const item = latestUpdateItemFromEvidence({
      source,
      rawTitle,
      releaseUrl,
      date,
      version,
      component,
      behavior,
      links,
      contextTitle,
      diagnosticReason: behavior ? '' : 'missing_concrete_release_note_bullet'
    });
    if (!item) return;
    if (!hasReleaseItemEvidence(item) && !item.linked_release_note_target_url) return;
    rowsByKey.set(parserItemKey(item), item);
  };

  const rows = [];
  for (const block of headingBlocks(html, source.url)) {
    for (const chunk of childChunks(block.body)) {
      addRow(chunk, `${block.title} ${block.body}`, block.title);
    }
  }
  for (const item of indexedChildChunks(html)) {
    addRow(item.chunk, surroundingText(html, item.index, item.chunk.length), '');
  }
  rows.push(...rowsByKey.values());
  return uniqueParserItems([...rows, ...linked])
    .filter(item =>
      item.publishedAt &&
      item.version_or_release &&
      item.api_or_component &&
      (item.behavior_change || item.linked_release_note_target_url)
    )
    .slice(0, 12);
}

function parseAndroidSecurityBulletin(html, source) {
  return linkedItems(html, source, {
    component: 'Android Security Bulletin',
    sourceKind: 'release_note_item',
    keep: (title, href) => /security bulletin|bulletin|20\d{2}-\d{2}-\d{2}|20\d{2}\/\d{2}/i.test(`${title} ${href}`),
    versionFallback: (title, href) => firstDate(`${title} ${href}`) || 'Android Security Bulletin',
    dateFallback: (title, href) => {
      const compact = String(href).match(/\b(20\d{2})(\d{2})(\d{2})\b/);
      if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
      return firstMonthYearDate(`${title} ${href}`);
    },
    limit: 12
  })
    .map(item => ({
      ...item,
      api_or_component: /Android Security Bulletin/i.test(item.api_or_component || '')
        ? item.api_or_component
        : `Android Security Bulletin / ${item.api_or_component || 'Android framework'}`
    }))
    .filter(hasReleaseItemEvidence);
}

function parseLibcameraBlog(html, source) {
  return linkedItems(html, source, {
    component: 'libcamera / V4L2 camera pipeline',
    sourceKind: 'blog_post_item',
    keep: (title, href) => /blog|news|release|camera|pipeline|V4L2|libcamera/i.test(`${title} ${href}`),
    dateFallback: (_title, _href, nearby) => firstDate(nearby) || firstMonthYearDate(nearby),
    limit: 10
  }).filter(item =>
    item.publishedAt &&
    item.api_or_component &&
    item.behavior_change &&
    /\b(?:libcamera|V4L2|camera|pipeline|media controller|image sensor)\b/i.test(`${item.title} ${item.summary} ${item.api_or_component} ${item.behavior_change}`)
  );
}

function pageTitle(html = '', fallback = '') {
  return clean((String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || fallback);
}

function parseLibcameraReleaseAnnouncement(html, source) {
  const title = pageTitle(html, source.name);
  const pageText = clean(html);
  const evidenceText = `${title} ${pageText}`;
  const version = firstVersion(evidenceText);
  const date = firstDate(evidenceText);
  const hasCameraPipelineEvidence = /\b(?:libcamera|SoftISP|V4L2|camera|pipeline|image pipeline|media controller|image sensor|sensor configuration|sensor)\b/i
    .test(evidenceText);
  if (!version || !date || !/\blibcamera\b/i.test(evidenceText) || !hasCameraPipelineEvidence) {
    return [];
  }
  const releaseDetails = [];
  if (/\b(?:SoftISP|software_isp|de-?bayering|debaying|Debayer)\b/i.test(evidenceText)) {
    releaseDetails.push('SoftISP debayering and image pipeline throughput');
  }
  if (/\b(?:Mali-C55|pipeline handler|camera support)\b/i.test(evidenceText)) {
    releaseDetails.push('pipeline handler camera support');
  }
  if (/\b(?:sensor mode configuration|sensor configuration)\b/i.test(evidenceText)) {
    releaseDetails.push('sensor mode configuration');
  }
  const extractedBehavior = firstBehavior(evidenceText);
  const behavior = releaseDetails.length > 0
    ? `Released ${version} with ${releaseDetails.join(', ')} updates.`
    : BEHAVIOR_PATTERN.test(extractedBehavior) ? extractedBehavior
    : `Released ${version} with libcamera camera pipeline updates.`;
  return [{
    source,
    title: `${source.name} - ${version}`,
    url: source.url,
    publishedAt: date,
    summary: behavior,
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    parentUrl: source.url,
    parentTitle: source.name,
    version_or_release: version,
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: behavior,
    relevanceBucketHint: 'camera_driver_image_pipeline',
    outgoing_links: extractOutgoingLinksFromHtml(html, {
      baseUrl: source.url,
      sourceField: 'html.body'
    })
  }];
}

function parseLlvmReleaseNotes(html, source) {
  return linkedItems(html, source, {
    component: 'LLVM / Clang native toolchain',
    sourceKind: 'release_note_item',
    keep: (title, href) => /LLVM|Clang|release|ReleaseNotes|releases?\/\d+\.\d+/i.test(`${title} ${href}`),
    versionFallback: (title, href) => {
      const version = String(`${title} ${href}`).match(/\b\d+\.\d+(?:\.\d+)?\b/);
      return version ? `LLVM ${version[0]}` : '';
    },
    limit: 12
  }).filter(hasReleaseItemEvidence);
}

function parseClaudeCodeChangelog(html, source) {
  return releaseItemsFromHeadings(html, source, {
    component: 'Claude Code / AI coding agent',
    sourceKind: 'release_note_item',
    limit: 12
  })
    .map(item => ({
      ...item,
      title: item.version_or_release
        ? `${source.name} - ${item.version_or_release}`
        : item.title,
      api_or_component: item.api_or_component || 'Claude Code / AI coding agent'
    }))
    .filter(item => item.publishedAt && item.version_or_release && item.api_or_component && item.behavior_change);
}

function parseSamsungMobileSecurityUpdates(html, source) {
  return headingBlocks(html, source.url)
    .filter(block => /SMR|Security Maintenance Release|security bulletin|vulnerabilit|CVE/i.test(`${block.title} ${block.body}`))
    .map(block => {
      const evidenceText = `${block.title} ${block.body}`;
      const date = firstSmrDate(evidenceText);
      const version = firstVersion(evidenceText) || (date ? `${date.slice(0, 7)} SMR` : '');
      const behavior = firstBehavior(block.body || block.title);
      return {
        source,
        title: `${source.name} - ${version || block.title}`,
        url: block.url,
        publishedAt: date,
        summary: behavior || clean(block.body).slice(0, 500),
        sourceKind: 'release_note_item',
        version_or_release: version,
        api_or_component: componentFromText(evidenceText, 'Samsung Mobile Security / Android Security Bulletin'),
        behavior_change: behavior
      };
    })
    .filter(item => item.title && item.url && item.publishedAt && item.version_or_release && item.behavior_change)
    .slice(0, 12);
}

const PARSERS = {
  'android-developers-latest-updates': parseAndroidLatestUpdates,
  'camerax-release-notes': parseCameraXReleaseNotes,
  'androidx-media3-release-notes': parseMedia3ReleaseNotes,
  'aosp-whats-new-release-notes': parseAospWhatsNew,
  'aosp-site-updates': parseAospSiteUpdates,
  'android-security-bulletin': parseAndroidSecurityBulletin,
  'claude-code-changelog': parseClaudeCodeChangelog,
  'libcamera-blog': parseLibcameraBlog,
  'libcamera-release-announcements': parseLibcameraReleaseAnnouncement,
  'llvm-release-notes': parseLlvmReleaseNotes,
  'samsung-mobile-security-updates': parseSamsungMobileSecurityUpdates
};

function parseSourceSpecificItems(html, source) {
  const parser = PARSERS[source.id] || (trustedAndroidLatestUpdatesSource(source) ? parseAndroidLatestUpdates : null);
  return parser ? parser(html, source) : [];
}

module.exports = {
  hasConcreteVersionedReleaseExtraction,
  parseSourceSpecificItems
};
