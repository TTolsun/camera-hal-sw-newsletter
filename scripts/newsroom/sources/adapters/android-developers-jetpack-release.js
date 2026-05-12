const { decodeHtml, htmlAttr } = require('../../common/common');
const { extractOutgoingLinksFromHtml } = require('../../collect/outgoing-links');

const ADAPTER_ID = 'android-developers-jetpack-release';
const SOURCE_TYPE = 'release_note';
const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const MONTH_DATE_PATTERN = new RegExp(`\\b(${MONTHS}\\s+\\d{1,2},\\s+20\\d{2})\\b`, 'i');
const ISO_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const VERSION_TOKEN_PATTERN = /\b\d+\.\d+\.\d+(?:[-\w.]*)?\b/i;
const BEHAVIOR_PATTERN = /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|remove(?:d|s)?|deprecat(?:ed|es)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|migrat(?:ed|es|ion)|compatibility|requirement|API|behavior|bug|crash|error)\b/i;
const ARTIFACT_TABLE_PATTERN = /\bcamera-[a-z0-9-]+\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)/i;

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

function text(value) {
  return String(value || '').trim();
}

function structuredText(value) {
  if (Array.isArray(value)) return value.map(structuredText).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(structuredText).filter(Boolean).join(' ');
  return text(value);
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.map(text).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function firstDate(value = '') {
  const iso = String(value).match(ISO_DATE_PATTERN);
  if (iso) return iso[1];
  const month = String(value).match(MONTH_DATE_PATTERN);
  return month ? month[1] : '';
}

function versionToken(value = '') {
  const match = String(value).match(VERSION_TOKEN_PATTERN);
  return match ? match[0] : '';
}

function cameraVersion(value = '') {
  const version = versionToken(value);
  return version ? `CameraX ${version}` : '';
}

function canonicalCameraReleaseUrl(value = '', version = '') {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'developer.android.google.cn') parsed.hostname = 'developer.android.com';
    if (parsed.hostname === 'developer.android.com') parsed.searchParams.delete('hl');
    const token = versionToken(version);
    if (
      parsed.hostname === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera' &&
      token
    ) {
      parsed.hash = `#${token}`;
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function targetVersionFromUrl(source = {}) {
  for (const raw of [source.url, source.sourceUrl]) {
    try {
      const token = versionToken(new URL(raw || '').hash);
      if (token) return token;
    } catch {
      continue;
    }
  }
  return '';
}

function canHandle(url = '', source = {}) {
  const value = `${source.id || ''} ${source.name || ''} ${url || source.url || source.sourceUrl || ''}`;
  return /\bcamerax-release-notes\b/i.test(value) ||
    /developer\.android(?:\.google\.cn|\.com)\/jetpack\/androidx\/releases\/camera/i.test(value);
}

function headingBlocks(html = '', baseUrl = '') {
  const value = String(html);
  const pattern = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  const matches = [...value.matchAll(pattern)];
  const blocks = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const titleHtml = current[2] || '';
    const attrs = current[1] || '';
    const id = htmlAttr(attrs, 'id') || htmlAttr(titleHtml, 'id') || versionToken(titleHtml);
    const start = current.index + current[0].length;
    const end = next ? next.index : value.length;
    const title = clean(titleHtml);
    const version = cameraVersion(`${title} ${id}`);
    if (!version) continue;
    blocks.push({
      title,
      version,
      version_token: versionToken(version),
      body: value.slice(start, end),
      url: canonicalCameraReleaseUrl(id ? `${baseUrl.replace(/#.*$/, '')}#${id}` : baseUrl, version)
    });
  }
  return blocks;
}

function removeNonReleaseBody(html = '') {
  return String(html)
    .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<pre\b[\s\S]*?(?:dependencies|implementation|androidx\.camera)[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code\b[\s\S]*?(?:dependencies|implementation|androidx\.camera)[\s\S]*?<\/code>/gi, ' ');
}

function categoryForHeading(heading = '') {
  const value = heading.toLowerCase();
  if (/bug|fix/.test(value)) return 'bug_fixes';
  if (/api/.test(value)) return 'api_changes';
  if (/feature|new/.test(value)) return 'new_features';
  if (/important/.test(value)) return 'important_changes';
  if (/dependency/.test(value)) return 'dependencies';
  return 'release_notes';
}

function subheadingBlocks(html = '') {
  const value = removeNonReleaseBody(html);
  const pattern = /<h[3-4]\b[^>]*>([\s\S]*?)<\/h[3-4]>/gi;
  const matches = [...value.matchAll(pattern)];
  if (matches.length === 0) {
    return [{ heading: 'Release Notes', body: value }];
  }
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const next = matches[index + 1];
    return {
      heading: clean(match[1]),
      body: value.slice(start, next ? next.index : value.length)
    };
  });
}

function linksFromHtml(html = '', baseUrl = '') {
  return [...String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map(match => ({
      text: clean(match[2]),
      url: absoluteUrl(htmlAttr(match[1], 'href'), baseUrl)
    }))
    .filter(link => link.url);
}

function artifactNames(value = '') {
  return unique([
    ...(String(value).match(/\bandroidx\.camera:[a-z0-9_.-]+\b/gi) || []),
    ...(String(value).match(/\bcamera-[a-z0-9-]+\b/gi) || [])
  ]);
}

function issueIds(value = '') {
  return unique(String(value).match(/\b(?:b\/\d+|issue\s+#?\d+)\b/gi) || []);
}

function isArtifactOnlyText(value = '') {
  const raw = String(value);
  return /Maven Group versions?|This library was last updated on:|View the Camera Library|Close\b/i.test(raw) ||
    ARTIFACT_TABLE_PATTERN.test(raw);
}

function itemFromHtml(html = '', baseUrl = '') {
  const value = clean(html);
  if (!value || value.length < 8 || firstDate(value) === value || isArtifactOnlyText(value)) return null;
  return {
    text: value,
    source_text: value,
    links: linksFromHtml(html, baseUrl),
    issue_ids: issueIds(value),
    artifact_names: artifactNames(value)
  };
}

function sectionItems(html = '', baseUrl = '') {
  const listItems = [...String(html).matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map(match => itemFromHtml(match[0], baseUrl))
    .filter(Boolean);
  if (listItems.length > 0) return listItems;
  return [...String(html).matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)]
    .map(match => itemFromHtml(match[0], baseUrl))
    .filter(Boolean);
}

function releaseSections(block) {
  return subheadingBlocks(block.body)
    .map(section => ({
      category: categoryForHeading(section.heading),
      heading: section.heading,
      items: sectionItems(section.body, block.url)
    }))
    .filter(section => section.items.length > 0);
}

function concreteItems(sections = []) {
  return sections.flatMap(section =>
    section.items.filter(item => BEHAVIOR_PATTERN.test(item.text) && !isArtifactOnlyText(item.text))
  );
}

function minorLineContext(block, blocks) {
  const token = versionToken(block.version);
  const match = token.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match || Number(match[3]) === 0) return null;
  const stableToken = `${match[1]}.${match[2]}.0`;
  const stable = blocks.find(item => versionToken(item.version) === stableToken);
  if (!stable) return null;
  const sections = releaseSections(stable);
  if (sections.length === 0) return null;
  return {
    version: cameraVersion(stableToken),
    date: firstDate(`${stable.title} ${clean(stable.body)}`),
    component: 'CameraX / androidx.camera',
    sections
  };
}

function buildExtraction(block, blocks, source) {
  const sections = releaseSections(block);
  const items = concreteItems(sections);
  const warnings = [];
  if (sections.length === 0) warnings.push('no_release_note_sections');
  if (items.length === 0) warnings.push('no_concrete_release_note_bullet');
  if (/<table\b/i.test(block.body)) warnings.push('raw_table_removed');
  const extractionQuality = {
    has_concrete_behavior_change: items.length > 0,
    used_fallback: items.length === 0,
    raw_table_used_as_body: false,
    main_article_allowed: items.length > 0,
    warnings
  };
  return {
    adapter_id: ADAPTER_ID,
    source_type: SOURCE_TYPE,
    source: {
      name: source.name || 'Android Developers',
      url: source.sourceUrl || source.url || block.url
    },
    release: {
      version: block.version,
      date: firstDate(`${block.title} ${clean(block.body)}`),
      component: 'CameraX / androidx.camera',
      sections
    },
    minor_line_context: minorLineContext(block, blocks),
    extraction_quality: extractionQuality
  };
}

function validationTargetsForExtraction(extraction) {
  const body = structuredText([extraction.release.sections, extraction.minor_line_context?.sections]);
  const targets = [];
  if (/VideoCapture/i.test(body)) targets.push('VideoCapture stream and stabilization validation');
  if (/ImageAnalysis/i.test(body)) targets.push('ImageAnalysis rotation and buffer validation');
  if (/SessionConfig/i.test(body)) targets.push('SessionConfig feature combination validation');
  if (/CameraPipe/i.test(body)) targets.push('CameraPipe compatibility validation');
  if (/Camera2/i.test(body)) targets.push('Camera2 interop regression validation');
  return unique(targets);
}

function buildDerivedHints(extraction) {
  const body = structuredText([extraction.release.sections, extraction.minor_line_context?.sections]);
  const warnings = [...extraction.extraction_quality.warnings];
  if (/Samsung|device[-\s]specific|Pixel/i.test(body)) warnings.push('device_specific_release_note');
  return {
    relevance_bucket_hint: 'direct_aosp_camera',
    impact_claim_level_hint: 'android_framework_adjacent',
    hal_boundary: 'framework_adjacent_not_direct_hal_contract',
    validation_targets: validationTargetsForExtraction(extraction),
    device_specific_notes: /Samsung|device[-\s]specific|Pixel/i.test(body)
      ? unique(body.match(/(?:Samsung|Pixel|device[-\s]specific)[^.]*\./gi) || [])
      : [],
    do_not_claim: [
      'Do not claim direct Camera HAL API or vendor HAL contract changes unless the release note explicitly says so.',
      'Do not use artifact version tables as behavior-change evidence.'
    ],
    main_article_allowed_hint: extraction.extraction_quality.main_article_allowed,
    warnings: unique(warnings)
  };
}

function firstConcreteBullet(extraction) {
  return concreteItems(extraction.release.sections)[0]?.text || '';
}

function extract(html = '', source = {}) {
  const targetVersion = targetVersionFromUrl(source);
  const blocks = headingBlocks(html, source.url || source.sourceUrl || '');
  const selectedBlocks = targetVersion
    ? blocks.filter(block => versionToken(block.version) === targetVersion)
    : blocks;
  return selectedBlocks.map(block => {
    const sourceExtraction = buildExtraction(block, blocks, source);
    const behavior = firstConcreteBullet(sourceExtraction);
    const derivedHints = buildDerivedHints(sourceExtraction);
    return {
      source,
      title: `${source.name || 'CameraX Release Notes'} - ${sourceExtraction.release.version}`,
      url: canonicalCameraReleaseUrl(block.url, sourceExtraction.release.version),
      publishedAt: sourceExtraction.release.date,
      summary: behavior,
      sourceKind: 'release_note_item',
      collectionMode: 'release-note-item',
      version_or_release: sourceExtraction.release.version,
      api_or_component: sourceExtraction.release.component,
      behavior_change: behavior,
      source_extraction: sourceExtraction,
      derived_editorial_hints: derivedHints,
      extraction_quality: sourceExtraction.extraction_quality,
      outgoing_links: extractOutgoingLinksFromHtml(block.body, {
        baseUrl: block.url,
        sourceField: 'release_note_row'
      })
    };
  }).filter(item =>
    item.source_extraction.extraction_quality.main_article_allowed &&
    item.publishedAt &&
    item.version_or_release &&
    item.api_or_component &&
    item.behavior_change
  );
}

module.exports = {
  ADAPTER_ID,
  canHandle,
  extract
};
