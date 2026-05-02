const { decodeHtml, htmlAttr } = require('./common');

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const ISO_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const MONTH_DATE_PATTERN = new RegExp(`\\b(${MONTHS}\\s+\\d{1,2},\\s+20\\d{2})\\b`, 'i');
const VERSION_PATTERN = /\b(?:Android\s+\d+(?:\s+QPR\d+)?|CameraX\s+\d+\.\d+\.\d+(?:[-\w.]*)?|LLVM\s+\d+\.\d+(?:\.\d+)?|libcamera\s+v?\d+\.\d+(?:\.\d+)?|v?\d+\.\d+\.\d+(?:[-\w.]*)?)\b/i;
const BEHAVIOR_PATTERN = /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|remove(?:d|s)?|deprecat(?:ed|es)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|migrat(?:ed|es|ion)|security|vulnerability|CVE|bulletin|release(?:d|s)?|compatibility|requirement|API|behavior)\b/i;

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
  return month ? month[1] : '';
}

function firstVersion(text = '') {
  const match = String(text).match(VERSION_PATTERN);
  return match ? match[0] : '';
}

function firstBehavior(text = '') {
  const sentences = clean(text).split(/(?<=[.!?])\s+|[•\n]/).map(item => item.trim()).filter(Boolean);
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
    'CDD',
    'CTS',
    'VTS',
    'Camera ITS',
    'Android framework',
    'Android Security Bulletin',
    'libcamera',
    'V4L2',
    'media controller',
    'LLVM',
    'Clang'
  ];
  return components.find(component => new RegExp(component.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value)) || fallback;
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
    const date = firstDate(evidenceText) || options.dateFallback?.(title, href) || '';
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
    const key = item.url.replace(/[?#].*$/, '');
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
  });
}

function parseAospWhatsNew(html, source) {
  return linkedItems(html, source, {
    component: 'AOSP Camera / Android platform compatibility',
    sourceKind: 'release_note_item',
    keep: (title, href) => /release|what'?s new|Android\s+\d|camera|compatibility|CDD|CTS|VTS|ITS/i.test(`${title} ${href}`),
    versionFallback: (title) => (title.match(/\bAndroid\s+\d+(?:\s+QPR\d+)?\b/i) || [])[0] || '',
    limit: 12
  });
}

function parseAndroidSecurityBulletin(html, source) {
  return linkedItems(html, source, {
    component: 'Android Security Bulletin',
    sourceKind: 'release_note_item',
    keep: (title, href) => /security bulletin|bulletin|20\d{2}-\d{2}-\d{2}|20\d{2}\/\d{2}/i.test(`${title} ${href}`),
    versionFallback: (title, href) => firstDate(`${title} ${href}`) || 'Android Security Bulletin',
    dateFallback: (title, href) => {
      const compact = String(href).match(/\b(20\d{2})(\d{2})(\d{2})\b/);
      return compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : '';
    },
    limit: 12
  });
}

function parseLibcameraBlog(html, source) {
  return linkedItems(html, source, {
    component: 'libcamera / V4L2 camera pipeline',
    sourceKind: 'blog_post_item',
    keep: (title, href) => /blog|news|release|camera|pipeline|V4L2|libcamera/i.test(`${title} ${href}`),
    limit: 10
  });
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
  });
}

const PARSERS = {
  'camerax-release-notes': parseCameraXReleaseNotes,
  'aosp-whats-new-release-notes': parseAospWhatsNew,
  'android-security-bulletin': parseAndroidSecurityBulletin,
  'libcamera-blog': parseLibcameraBlog,
  'llvm-release-notes': parseLlvmReleaseNotes
};

function parseSourceSpecificItems(html, source) {
  const parser = PARSERS[source.id];
  return parser ? parser(html, source) : [];
}

module.exports = {
  parseSourceSpecificItems
};
