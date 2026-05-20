const { decodeHtml, htmlAttr } = require('../common/common');
const { extractOutgoingLinksFromHtml } = require('./outgoing-links');

const ROUNDUP_PATTERN = /\b(?:17\s+things|what'?s\s+new|google\s+i\/o\s+recap|android\s+show|announcements?|roundup|recap)\b/i;
const STRONG_TOPIC_PATTERN = /\b(?:CameraX|Camera2|Camera\b|VideoCapture|PreviewView|Ultra\s+HDR|HDR\s+video|APV|Advanced\s+Professional\s+Video|image\s+pipeline)\b/i;
const STRONG_NON_SCREEN_TOPIC_PATTERN = /\b(?:CameraX|Camera2|VideoCapture|PreviewView|Ultra\s+HDR|HDR\s+video|APV|Advanced\s+Professional\s+Video|image\s+pipeline)\b/i;
const BROAD_TOPIC_PATTERN = /\b(?:media|gallery|video(?:\s+call)?|audio)\b/i;
const BROAD_CONTEXT_PATTERN = /\b(?:capture|camera\s+output|media\s+framework|video\s+capture|preview|gallery\s+output|HDR|Ultra\s+HDR)\b/i;
const ROUNDUP_BEHAVIOR_CHANGE_PATTERN = /\b(?:announce(?:d|s)?|introduc(?:e|ed|es|ing)|bring(?:s|ing)?|brought|enable(?:d|s)?|let\s+developers|available|preview|can\s+use|support(?:ed|s)?|improve(?:d|s|ment)?|add(?:ed|s)?|update(?:d|s)?)\b/i;

function decodeContent(value = '') {
  return decodeHtml(String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function clean(value = '') {
  return decodeContent(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugFragment(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'topic';
}

function absoluteUrl(href = '', baseUrl = '') {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

function firstAnchor(chunk = '', baseUrl = '') {
  const match = String(chunk).match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (!match) return null;
  const href = htmlAttr(match[1], 'href');
  return {
    href,
    title: clean(match[2]),
    url: href ? absoluteUrl(href, baseUrl) : ''
  };
}

function headingBlocks(html = '') {
  const value = decodeContent(html);
  const matches = [...value.matchAll(/<(h[2-4])([^>]*)>([\s\S]*?)<\/\1>/gi)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = match.index + match[0].length;
    const end = next ? next.index : value.length;
    const attrs = match[2] || '';
    const heading = clean(match[3]);
    const id = htmlAttr(attrs, 'id') || htmlAttr(match[3] || '', 'id');
    return {
      index: index + 1,
      heading,
      html: value.slice(start, end),
      anchorId: id
    };
  }).filter(block => block.heading && clean(block.html).length >= 40);
}

function listBlocks(html = '') {
  const value = decodeContent(html);
  return [...value.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)]
    .map((match, index) => {
      const anchor = firstAnchor(match[0]);
      const text = clean(match[0]);
      const heading = anchor?.title || text.split(/(?<=[.!?])\s+/)[0] || text.slice(0, 80);
      return {
        index: index + 1,
        heading,
        html: match[0],
        anchorId: ''
      };
    })
    .filter(block => block.heading && clean(block.html).length >= 40);
}

function evidenceSentences(value = '') {
  return clean(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function hasTopicTrigger(value = '') {
  const text = clean(value);
  const hasScreenRecording = /\bscreen\s+recording\b/i.test(text);
  const hasFrontCamera = /\bfront\s+camera\b/i.test(text);
  if (hasScreenRecording && !hasFrontCamera && !STRONG_NON_SCREEN_TOPIC_PATTERN.test(text)) {
    return false;
  }
  if (STRONG_TOPIC_PATTERN.test(text)) return true;
  if (hasScreenRecording && hasFrontCamera && /\bAndroid\b/i.test(text)) return true;
  return BROAD_TOPIC_PATTERN.test(text) &&
    /\bAndroid\b/i.test(text) &&
    BROAD_CONTEXT_PATTERN.test(text);
}

function behaviorSentence(heading = '', body = '') {
  return evidenceSentences(body)
    .find(sentence =>
      ROUNDUP_BEHAVIOR_CHANGE_PATTERN.test(sentence) &&
      hasTopicTrigger(`${heading}. ${sentence}`)
    ) || '';
}

function componentFor(value = '') {
  const text = clean(value);
  if (/\bCameraX\b|VideoCapture|PreviewView/i.test(text)) return 'CameraX / Android camera APIs';
  if (/\bCamera2\b/i.test(text)) return 'Camera2 / Android camera framework';
  if (/\b(?:APV|Advanced\s+Professional\s+Video|Ultra\s+HDR|HDR\s+video|video\s+capture|camera\s+output|media\s+framework|gallery\s+output)\b/i.test(text)) {
    return 'Android media/camera output';
  }
  if (/\bcamera\b/i.test(text)) return 'Android camera output';
  return 'Android media/camera output';
}

function bucketHintFor(value = '') {
  return /\b(?:CameraX|Camera2|VideoCapture|PreviewView)\b/i.test(value)
    ? 'direct_aosp_camera'
    : 'android_platform_camera_adjacent';
}

function childUrl(parentUrl = '', block = {}) {
  if (block.anchorId) {
    try {
      const parsed = new URL(parentUrl);
      parsed.hash = block.anchorId;
      return parsed.toString();
    } catch {
      return `${String(parentUrl).replace(/#.*$/, '')}#${block.anchorId}`;
    }
  }
  const anchor = firstAnchor(block.html, parentUrl);
  if (anchor?.url) return anchor.url;
  const slug = slugFragment(block.heading);
  return `${String(parentUrl || '').replace(/#.*$/, '')}#roundup-child-${block.index}-${slug}`;
}

function childBlocks(html = '') {
  const headings = headingBlocks(html);
  if (headings.length > 0) return headings;
  return listBlocks(html);
}

function extractRoundupChildTopics({
  source,
  parentTitle = '',
  parentUrl = '',
  publishedAt = '',
  html = '',
  rawText = ''
} = {}) {
  const decodedHtml = decodeContent(html);
  const readable = clean(`${parentTitle} ${rawText || decodedHtml}`);
  if (!ROUNDUP_PATTERN.test(readable) || clean(decodedHtml).length < 120) return [];

  const items = [];
  const seen = new Set();
  for (const block of childBlocks(decodedHtml)) {
    const body = clean(block.html);
    const evidenceText = clean(`${block.heading}. ${body}`);
    if (!hasTopicTrigger(evidenceText)) continue;
    const behavior = behaviorSentence(block.heading, body);
    if (!behavior) continue;

    const links = extractOutgoingLinksFromHtml(block.html, {
      baseUrl: parentUrl,
      sourceField: 'rss.roundup_child'
    });
    const url = childUrl(parentUrl, block);
    const key = `${url}|${block.heading}|${behavior}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const extractionQuality = {
      has_concrete_child_topic_evidence: true,
      main_article_allowed: true,
      used_fallback: false
    };
    items.push({
      source,
      title: `${block.heading} - ${parentTitle}`.slice(0, 180),
      url,
      publishedAt,
      summary: behavior,
      sourceKind: 'blog_post_item',
      collectionMode: 'article-item',
      parentUrl,
      parentTitle,
      version_or_release: '',
      api_or_component: componentFor(evidenceText),
      behavior_change: behavior,
      relevanceBucketHint: bucketHintFor(evidenceText),
      source_extraction: {
        mode: 'roundup_child_topic',
        parent_title: parentTitle,
        parent_url: parentUrl,
        child_heading: block.heading,
        evidence_blocks: [{
          heading: block.heading,
          text: evidenceText,
          source_text: evidenceText,
          links
        }],
        links,
        extraction_quality: extractionQuality
      },
      extraction_quality: extractionQuality,
      outgoing_links: links
    });
  }

  return items.slice(0, 8);
}

module.exports = {
  extractRoundupChildTopics,
  ROUNDUP_BEHAVIOR_CHANGE_PATTERN
};
