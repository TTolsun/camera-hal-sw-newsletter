const { decodeHtml, htmlAttr } = require('../common/common');
const { extractOutgoingLinksFromHtml } = require('./outgoing-links');

const ROUNDUP_PATTERN = /\b(?:17\s+things|what'?s\s+new|google\s+i\/o\s+recap|android\s+show|announcements?|roundup|recap)\b/i;
const STRONG_TOPIC_PATTERN = /\b(?:CameraX|Camera2|Camera\b|VideoCapture|PreviewView|Ultra\s+HDR|HDR\s+video|APV|Advanced\s+Professional\s+Video|image\s+pipeline)\b/i;
const STRONG_NON_SCREEN_TOPIC_PATTERN = /\b(?:CameraX|Camera2|VideoCapture|PreviewView|Ultra\s+HDR|HDR\s+video|APV|Advanced\s+Professional\s+Video|image\s+pipeline)\b/i;
const BROAD_TOPIC_PATTERN = /\b(?:media|gallery|video(?:\s+call)?|audio)\b/i;
const BROAD_CONTEXT_PATTERN = /\b(?:capture|camera\s+output|media\s+framework|video\s+capture|preview|gallery\s+output|HDR|Ultra\s+HDR)\b/i;
const MEDIA_PIPELINE_COMPONENT_PATTERN = /\b(?:MediaCodec|Media3|MediaRecorder|MediaStore|Photo\s+Picker|SurfaceView|TextureView|WebRTC)\b/i;
const MEDIA_CAMERA_OUTPUT_ANCHOR_PATTERN = /\b(?:camera|captur(?:e|ed|es|ing)|record(?:ed|ing)?|preview|gallery\s*\/\s*media\s+access|media\s+access|camera\s+output|gallery\s+output|sharing|captured\s+(?:image|video)|camera\s+switch(?:ing)?)\b/i;
const MEDIA_ENGINEERING_CHANGE_PATTERN = /\b(?:release\s+notes?|API|behavior|bug|fix(?:ed|es)?|regression|compatibility|latency|jank|frame\s+(?:drop|drops|timing|pacing)|A\/V\s+sync|audio\s*\/\s*video\s+sync|sync|performance|add(?:ed|s)?|change(?:d|s)?|introduc(?:e|ed|es|ing)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?)\b/i;
const ROUNDUP_BEHAVIOR_CHANGE_PATTERN = /\b(?:announce(?:d|s)?|introduc(?:e|ed|es|ing)|bring(?:s|ing)?|brought|enable(?:d|s)?|let\s+developers|available|preview|can\s+use|support(?:ed|s)?|improve(?:d|s|ment)?|add(?:ed|s)?|update(?:d|s)?)\b/i;
const DIRECT_CAMERA_API_PATTERN = /\b(?:CameraX|Camera2|VideoCapture|PreviewView|ImageCapture|ImageAnalysis)\b/i;
const MULTIMEDIA_CAMERA_OUTPUT_PATTERN = /\b(?:APV|Advanced\s+Professional\s+Video|Ultra\s+HDR|HDR\s+video|camera\s+output|media\s+framework|gallery\s+output|camera\s*\/\s*audio\s+sync|social\s+app\s+camera\s+capture|camera\s+capture\s+result)\b/i;

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
  if (
    MEDIA_PIPELINE_COMPONENT_PATTERN.test(text) &&
    MEDIA_CAMERA_OUTPUT_ANCHOR_PATTERN.test(text) &&
    MEDIA_ENGINEERING_CHANGE_PATTERN.test(text)
  ) {
    return true;
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
  if (/\b(?:MediaCodec|Media3|MediaRecorder|MediaStore|Photo\s+Picker|SurfaceView|TextureView|WebRTC)\b/i.test(text)) {
    return 'Android media/camera output';
  }
  if (/\b(?:APV|Advanced\s+Professional\s+Video|Ultra\s+HDR|HDR\s+video|video\s+capture|camera\s+output|media\s+framework|gallery\s+output)\b/i.test(text)) {
    return 'Android media/camera output';
  }
  if (/\bcamera\b/i.test(text)) return 'Android camera output';
  return 'Android media/camera output';
}

function bucketHintFor(value = '') {
  if (DIRECT_CAMERA_API_PATTERN.test(value)) return 'direct_aosp_camera';
  if (
    MULTIMEDIA_CAMERA_OUTPUT_PATTERN.test(value) ||
    (
      MEDIA_PIPELINE_COMPONENT_PATTERN.test(value) &&
      MEDIA_CAMERA_OUTPUT_ANCHOR_PATTERN.test(value) &&
      MEDIA_ENGINEERING_CHANGE_PATTERN.test(value)
    )
  ) return 'android_multimedia_camera_output';
  return 'android_platform_camera_adjacent';
}

// heading과 부모 문서 제목은 각각 페이지에 실재하는 문자열이지만, 둘을 그대로 이어 붙이면
// 어느 페이지에도 없는 제목이 만들어져 라이브 링크 텍스트로 나갔다(#857). 대신 두 문자열이
// 각각 무엇인지 드러내는 "섹션 이름 (『부모 문서 제목』 섹션)" 형태로 적는다.
// 두 요소를 모두 남기는 이유: title은 선정 스코어러의 키워드 입력이기도 해서, 한쪽을 빼면 점수가
// 떨어져 선정 결과가 바뀐다.
const TITLE_MAX_LENGTH = 180;
const SECTION_HEADING_MAX_LENGTH = 120;
const SECTION_MARKER_LENGTH = ' (『』 섹션)'.length;

function roundupChildTitle(heading = '', parentTitle = '') {
  const section = clean(heading).slice(0, SECTION_HEADING_MAX_LENGTH);
  const parent = clean(parentTitle);
  if (!parent) return section;
  // 합쳐 놓고 통째로 자르면 닫는 표기가 사라져 다시 페이지 제목처럼 읽힌다. 부모 제목만 줄인다.
  const room = TITLE_MAX_LENGTH - section.length - SECTION_MARKER_LENGTH;
  const shownParent = parent.length <= room ? parent : `${parent.slice(0, room - 1)}…`;
  return `${section} (『${shownParent}』 섹션)`;
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
      title: roundupChildTitle(block.heading, parentTitle),
      url,
      publishedAt,
      summary: behavior,
      sourceType: 'roundup_child',
      source_type: 'roundup_child',
      sourceKind: 'blog_post_item',
      collectionMode: 'article-item',
      parentUrl,
      parentTitle,
      parentCanonicalUrl: String(parentUrl || '').replace(/#.*$/, ''),
      parent_canonical_url: String(parentUrl || '').replace(/#.*$/, ''),
      roundupItemIndex: block.index,
      roundup_item_index: block.index,
      anchorText: block.heading,
      anchor_text: block.heading,
      version_or_release: '',
      api_or_component: componentFor(evidenceText),
      behavior_change: behavior,
      relevanceBucketHint: bucketHintFor(evidenceText),
      source_extraction: {
        mode: 'roundup_child_topic',
        parent_title: parentTitle,
        parent_url: parentUrl,
        parent_canonical_url: String(parentUrl || '').replace(/#.*$/, ''),
        roundup_item_index: block.index,
        anchor_text: block.heading,
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
