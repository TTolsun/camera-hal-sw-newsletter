const { decodeHtml, htmlAttr } = require('../common/common');

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const ISO_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const MONTH_DATE_PATTERN = new RegExp(`\\b(${MONTHS}\\s+\\d{1,2},\\s+20\\d{2})\\b`, 'i');
const MONTH_YEAR_PATTERN = new RegExp(`\\b(${MONTHS})\\s+(20\\d{2})\\b`, 'i');
const SMR_PATTERN = /\b(?:SMR[-\s]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]?20\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}\s+SMR|Security Maintenance Release)\b/i;
const VERSION_PATTERN = /\b(?:Android\s+\d+(?:\s+QPR\d+)?|CameraX\s+\d+\.\d+\.\d+(?:[-\w.]*)?|Claude Code\s+v?\d+\.\d+\.\d+(?:[-\w.]*)?|LLVM\s+\d+\.\d+(?:\.\d+)?|libcamera\s+v?\d+\.\d+(?:\.\d+)?|SMR[-\s]?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s]?20\d{2}|v?\d+\.\d+\.\d+(?:[-\w.]*)?)\b/i;
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
    'AOSP Camera',
    'Camera images automation',
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
  return rows.length > 0 ? rows : listItems;
}

function indexedChildChunks(body = '') {
  const value = String(body);
  const rows = [...value.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map(match => ({ chunk: match[0], index: match.index || 0 }))
    .filter(item => !/<th\b/i.test(item.chunk) || /<td\b/i.test(item.chunk));
  const listItems = [...value.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map(match => ({ chunk: match[0], index: match.index || 0 }));
  return rows.length > 0 ? rows : listItems;
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

function isCameraUpdateRow(text = '') {
  return /\b(?:CameraX|androidx\.camera|Camera2|Android Camera|AOSP Camera|Camera HAL|Camera ITS|CDD\b[^.\n]{0,80}\bcamera|camera\b[^.\n]{0,80}\bCDD|Camera images automation|image(?:s)? automation|camera orientation|stream|buffer|metadata|capture request|capture result)\b/i
    .test(String(text));
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
        behavior_change: behavior
      };
    })
    .filter(item => item.title && item.url)
    .slice(0, options.limit || 12);
}

function hasReleaseItemEvidence(item) {
  return Boolean(item.publishedAt && item.version_or_release && item.api_or_component && item.behavior_change);
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
      behavior_change: behavior
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
  return releaseItemsFromHeadings(html, source, {
    component: 'CameraX / androidx.camera',
    sourceKind: 'release_note_item',
    limit: 10
  }).filter(hasReleaseItemEvidence);
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

function parseAospSiteUpdates(html, source) {
  const parentUrl = source.url;
  const parentTitle = source.name;
  const items = [];

  for (const block of headingBlocks(html, parentUrl)) {
    const date = firstMonthYearDate(block.title);
    if (!date) continue;
    const sourceMonth = monthLabel(block.title);
    for (const chunk of childChunks(block.body)) {
      const title = childTitle(chunk, parentUrl);
      const evidenceText = `${block.title} ${title} ${clean(chunk)}`;
      if (!isCameraUpdateRow(evidenceText)) continue;
      const anchor = firstAnchor(chunk, parentUrl);
      const url = anchor?.url || urlWithFragment(parentUrl, `${sourceMonth} ${title}`);
      const component = componentFromText(evidenceText, /CDD/i.test(evidenceText)
        ? 'CDD camera'
        : /Camera ITS/i.test(evidenceText) ? 'Camera ITS' : 'AOSP Camera');
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
  const linked = linkedItems(html, source, {
    component: 'CameraX / androidx.camera',
    sourceKind: 'release_note_item',
    keep: (title, href) => /Camera Maven Group versions|CameraX|androidx\.camera|camera/i.test(`${title} ${href}`),
    versionFallback: (title, href) => cameraVersionFromText(`${title} ${href}`, 'CameraX / androidx.camera'),
    dateFallback: (_title, _href, nearby) => firstDate(nearby),
    dedupeWithHash: true,
    limit: 12
  }).map(item => ({
    ...item,
    parentUrl: source.url,
    parentTitle: source.name,
    sourceSection: source.section || '',
    api_or_component: 'CameraX / androidx.camera',
    version_or_release: cameraVersionFromText(`${item.title} ${item.url} ${item.version_or_release}`, item.version_or_release),
    relevanceBucketHint: 'android_platform_camera_adjacent'
  }));

  const rowsByKey = new Map();
  const addRow = (chunk, contextText = '', contextTitle = '') => {
    const title = childTitle(chunk, source.url);
    const anchor = firstAnchor(chunk, source.url);
    const cells = tableCells(chunk);
    const rowIdentity = `${title} ${anchor?.href || ''} ${cells.slice(0, 2).join(' ')}`;
    const evidenceText = `${contextTitle} ${title} ${clean(chunk)} ${clean(contextText)}`;
    if (!/\b(?:Camera Maven Group versions|CameraX|androidx\.camera|camera)\b/i.test(rowIdentity)) return;
    const date = firstDate(evidenceText);
    const version = cameraVersionFromText(evidenceText, 'CameraX / androidx.camera');
    const extractedBehavior = firstBehavior(`${clean(chunk)} ${clean(contextText)}`);
    const behavior = BEHAVIOR_PATTERN.test(extractedBehavior)
      ? extractedBehavior
      : `Updated ${title}.`;
    const item = {
      source,
      title,
      url: anchor?.url || urlWithFragment(source.url, `${contextTitle} ${title}`),
      publishedAt: date,
      parentUrl: source.url,
      parentTitle: source.name,
      sourceSection: source.section || '',
      summary: behavior,
      sourceKind: 'release_note_item',
      collectionMode: 'release-note-item',
      version_or_release: version,
      api_or_component: 'CameraX / androidx.camera',
      behavior_change: behavior,
      relevanceBucketHint: 'android_platform_camera_adjacent'
    };
    if (!hasReleaseItemEvidence(item)) return;
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
  return uniqueParserItems([...linked, ...rows])
    .filter(item => item.publishedAt && item.version_or_release && item.api_or_component && item.behavior_change)
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
  'aosp-whats-new-release-notes': parseAospWhatsNew,
  'aosp-site-updates': parseAospSiteUpdates,
  'android-security-bulletin': parseAndroidSecurityBulletin,
  'claude-code-changelog': parseClaudeCodeChangelog,
  'libcamera-blog': parseLibcameraBlog,
  'llvm-release-notes': parseLlvmReleaseNotes,
  'samsung-mobile-security-updates': parseSamsungMobileSecurityUpdates
};

function parseSourceSpecificItems(html, source) {
  const parser = PARSERS[source.id];
  return parser ? parser(html, source) : [];
}

module.exports = {
  parseSourceSpecificItems
};
