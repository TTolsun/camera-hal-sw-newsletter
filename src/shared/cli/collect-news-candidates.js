const fs = require('fs');
const path = require('path');
const {
  decodeHtml,
  kstDate,
  readJson
} = require('../common/common');
const {
  collectedNewsDir,
  newsroomDir
} = require('../common/artifact-paths');
const {
  writeManualCandidateArtifacts
} = require('../common/candidate-artifacts');
const { parseManualSourceUrls } = require('../collect/collection-intent');
const { readRuntimeConfig } = require('../common/runtime-config');
const {
  extractImageCandidatesFromHtml,
  extractImageCandidatesFromRssBlock,
  validateImageCandidates
} = require('../render/image-candidates');
const {
  parseSourceSpecificItems
} = require('../collect/source-item-parsers');
const {
  extractRoundupChildTopics,
  ROUNDUP_BEHAVIOR_CHANGE_PATTERN
} = require('../collect/roundup-child-topic-extractor');
const {
  resolveLinkedReleaseNoteEvidenceItems
} = require('../collect/linked-release-note-evidence');
const {
  resolveFollowedSourceItems,
  shouldSuppressGenericFallback
} = require('../collect/followed-source-item-resolvers');
const {
  DEFAULT_SECTION_MAP,
  normalizeEnabledSources,
  normalizeSourceEntry,
  readSourceRegistry
} = require('../collect/news-source-section-resolver');
const {
  extractOutgoingLinksFromHtml,
  mergeOutgoingLinks,
  normalizeOutgoingLinks
} = require('../collect/outgoing-links');
const {
  deriveLoreSeriesId,
  isLoreReplyItem
} = require('../collect/lore-thread-series');
const {
  BUCKETS,
  STRONG_CAMERA_DRIVER_PATTERNS,
  classifyAospCameraStackCandidate,
  detectNativeAndroidToolingWorkflow
} = require('../domain/aosp-camera-scope');
const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  NATIVE_TOOLING_WORKFLOW_TYPE
} = require('../common/article-groups');
const {
  analyzeLinkedEvidenceForCandidates,
  writeLinkedEvidenceDiagnosticsArtifacts
} = require('../evidence/linked-evidence-diagnostics');
const {
  classifySourceQuality,
  mapSourceQualityToBaseDecision,
  sourceQualityFlatFields
} = require('../collect/source-quality-classifier');
const {
  canonicalContentUrl,
  fetchUrlForContent
} = require('../collect/source-intelligence-utils');
const {
  commitSourceSnapshotWrites,
  filterSnapshotWritesByIncludedEvidenceIds,
  runSourceMonitor
} = require('../collect/source-monitor');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const structuredSourcesPath = path.join(root, 'src', 'shared', 'data', 'news-sources.json');
const legacySourcesPath = path.join(root, 'docs', 'NEWS_SOURCES.md');
const AUDIENCE = 'AOSP Camera / Camera Driver / SoC Platform / C++ engineer';

const CANDIDATE_SCHEMA_VERSION = 6;

// Final candidate pool handed to the newsroom. A per-source cap keeps a single
// high-volume source (e.g. an Android Developers Blog roundup that explodes into
// many child topics) from monopolizing the pool and evicting lower-ranked but
// useful camera-driver / V4L2 / libcamera / ISP leads before the slice.
const MAX_FINAL_CANDIDATES = 40;
const MAX_CANDIDATES_PER_SOURCE = 8;

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
const RELIABILITY_WEIGHT = { official: 3, 'project-official': 2, 'official-community': 2 };
const DAY_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_ONLY_RELIABILITY = new Set([
  'community',
  'newsletter',
  'expert-media',
  'community-doc'
]);

const CAMERA_KEYWORDS = [
  'camera', 'camerax', 'camera2', 'hal', 'aosp', 'image', 'capture', 'raw', 'raw10', 'raw12', 'raw14',
  'ultra hdr', 'hdr', 'dynamic range', 'stream', 'buffer', 'metadata', 'session', 'android',
  'its', 'cts', 'vts', 'cdd', 'libcamera', 'v4l2', 'isp', 'image sensor', 'mipi', 'csi-2',
  'dma-buf', 'mediacodec', 'media3', 'mediarecorder', 'mediastore', 'photo picker', 'surfaceview',
  'textureview', 'webrtc', 'av sync', 'a/v sync', 'soc', 'cpu', 'gpu', 'npu', 'dsp', 'dvfs', 'eas', 'thermal', 'power',
  'qualcomm', 'samsung', 'arm', 'mediatek', 'exynos', 'snapdragon', 'tensor'
];
const TECH_KEYWORDS = [
  'c++', 'cpp', 'clang', 'llvm', 'gcc', 'ndk', 'build', 'test', 'gtest', 'googletest', 'perfetto',
  'github', 'copilot', 'agent', 'ai', 'model', 'developer', 'tool', 'automation', 'sanitizer',
  'ai agent', 'coding agent', 'codex', 'claude code'
];

const FEED_HINTS = [
  {
    match: 'android-developers.googleblog.com',
    feed: 'https://android-developers.googleblog.com/feeds/posts/default?alt=rss'
  },
  {
    match: 'isocpp.org/blog',
    feed: 'https://isocpp.org/blog/rss/category/news'
  },
  {
    match: 'github.blog/changelog',
    feed: 'https://github.blog/changelog/feed/'
  },
  {
    match: 'developers.googleblog.com',
    feed: 'https://developers.googleblog.com/feeds/posts/default?alt=rss'
  },
  {
    match: 'openai.com/news',
    feed: 'https://openai.com/news/rss.xml'
  }
];
const WATCH_SOURCE_MODES = new Set(['release-note-watch', 'documentation-watch', 'homepage-watch']);
const WATCH_CANDIDATE_MODES = new Set(['html-watch-page', 'release-note-page', 'homepage-watch']);
const FINAL_SELECTION_ELIGIBILITIES = new Set(['main', 'short', 'watchlist', 'exclude']);
const FALLBACK_INELIGIBLE_SOURCE_KINDS = new Set(['documentation_page', 'rolling_page', 'blog_index']);
const ITEM_LEVEL_SOURCE_KINDS = new Set(['rss_item', 'release_note_item', 'blog_post_item']);
const VERSION_OR_RELEASE_PATTERN = /\b(?:Android\s+\d+(?:\s+QPR\d+)?|Android\s+CLI\s+\d+(?:\.\d+){0,2}|CameraX\s+\d+\.\d+\.\d+(?:[-\w.]*)?|Media3\s+\d+\.\d+\.\d+(?:[-\w.]*)?|LLVM\s+\d+\.\d+(?:\.\d+)?|libcamera\s+v?\d+\.\d+(?:\.\d+)?|v?\d+\.\d+\.\d+(?:[-\w.]*)?|release notes?|security bulletin|stable\s+\d+(?:\.\d+)*)\b/i;
const API_OR_COMPONENT_PATTERN = /\b(?:CameraX|androidx\.camera|Camera2|Camera HAL|AOSP Camera|CDD|CTS|VTS|Camera ITS|Android framework|Android Security Bulletin|MediaCodec|Media3|MediaRecorder|MediaStore|Photo\s+Picker|SurfaceView|TextureView|WebRTC|A\/V\s+Sync|AV\s+sync|Android Studio|Android CLI|Google AI Studio|Gemini in Android Studio|Android Gradle Plugin|AGP|Gradle|libcamera|V4L2|media controller|image sensor|ISP|MIPI\s*CSI-?2|DMA-?BUF|SoC|CPU|GPU|NPU|DSP|DVFS|EAS|LLVM|Clang|GCC|NDK|JNI|SDK|API)\b/i;
const BEHAVIOR_CHANGE_PATTERN = /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|remove(?:d|s)?|deprecat(?:ed|es)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|migrat(?:ed|es|ion)|accelerat(?:e|ed|es|ing)|build(?:s|ing)?|test(?:s|ing)?|debug(?:s|ging)?|profil(?:e|ed|es|ing)|stable|security|vulnerability|CVE|bulletin|release(?:d|s)?|compatibility|requirement|API|behavior)\b/i;

let sectionMap = { ...DEFAULT_SECTION_MAP };
let activeSourcesPath = legacySourcesPath;

function decode(value = '') {
  return decodeHtml(value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decode(match[1]) : '';
}

function rawTag(block, name) {
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(block || '').match(new RegExp(`<${escapedName}[^>]*>([\\s\\S]*?)<\\/${escapedName}>`, 'i'));
  if (!match) return '';
  return String(match[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function parseStructuredSources() {
  const registry = readSourceRegistry(structuredSourcesPath, readJson);
  const normalized = normalizeEnabledSources(registry, { normalizeCollectionModeHint });
  sectionMap = normalized.sectionMap;
  const sources = normalized.sources
    .filter(source => source.name && source.url)
    .sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0));

  if (sources.length === 0) {
    throw new Error('No enabled sources found in src/shared/data/news-sources.json');
  }
  activeSourcesPath = structuredSourcesPath;
  return sources;
}

function parseLegacySources() {
  if (!fs.existsSync(legacySourcesPath)) {
    throw new Error('Missing src/shared/data/news-sources.json and docs/NEWS_SOURCES.md');
  }

  const markdown = fs.readFileSync(legacySourcesPath, 'utf8');
  const sources = [];
  const regex = /^-\s+([^:]+):\s+(https?:\/\/\S+)/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    sources.push(normalizeSourceEntry({
      name: match[1].trim(),
      sourceUrl: match[2].trim(),
      rssUrl: feedFor(match[2].trim()),
      candidateOnly: false,
      requiresCrossCheck: true
    }, sectionMap, {
      allowFeedHint: true,
      defaultCategory: 'tech-trends',
      index: sources.length,
      label: `legacySources[${sources.length}]`,
      normalizeCollectionModeHint
    }));
  }
  if (sources.length === 0) {
    throw new Error('No sources found in docs/NEWS_SOURCES.md');
  }
  activeSourcesPath = legacySourcesPath;
  return sources;
}

function parseSources() {
  return fs.existsSync(structuredSourcesPath) ? parseStructuredSources() : parseLegacySources();
}

function feedFor(url) {
  const hint = FEED_HINTS.find(item => url.includes(item.match));
  return hint ? hint.feed : null;
}

function sourceFeed(source) {
  return source.rssUrl || (source.allowFeedHint ? feedFor(source.url) : null);
}

function normalizeCollectionModeHint(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  const aliases = {
    rss: 'rss-source',
    feed: 'rss-source',
    'rss-item': 'rss-source',
    release: 'release-note-watch',
    'release-note': 'release-note-watch',
    'release-notes': 'release-note-watch',
    changelog: 'release-note-watch',
    documentation: 'documentation-watch',
    docs: 'documentation-watch',
    doc: 'documentation-watch',
    homepage: 'homepage-watch',
    home: 'homepage-watch',
    blog: 'homepage-watch',
    media: 'media-lead',
    'media-source': 'media-lead',
    lead: 'media-lead'
  };
  const mode = aliases[normalized] || normalized;
  return ['rss-source', 'release-note-watch', 'documentation-watch', 'homepage-watch', 'media-lead'].includes(mode)
    ? mode
    : '';
}

function sourceCollectionMode(source) {
  if (source.collectionModeHint) return source.collectionModeHint;
  if (source.rssUrl || sourceFeed(source)) return 'rss-source';
  const value = `${source.id || ''} ${source.name || ''} ${source.url || ''} ${source.reliability || ''}`;
  if (/release|changelog|bulletin|securityupdate|linuxchanges|latest-updates|what'?s new/i.test(value)) {
    return 'release-note-watch';
  }
  if (/documentation|docs\/core\/camera|introduction|cdd|compatibility\/cdd|newsletter/i.test(value)) {
    return 'documentation-watch';
  }
  if (/media|newsletter|community|lwn|phoronix|infoq|register|stack|spectrum|eetimes|embedded|zdnet|yozm/i.test(value)) {
    return 'media-lead';
  }
  return 'homepage-watch';
}

async function fetchText(url, timeoutMs = 0) {
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      signal: controller ? controller.signal : undefined,
      headers: {
        'user-agent': 'camera-hal-sw-newsletter/1.0',
        accept: 'text/html,application/rss+xml,application/xml,text/xml,*/*'
      }
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function rssParentRawItem(block, source) {
  const title = tag(block, 'title');
  const linkTag = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  const link = tag(block, 'link') || (linkTag ? linkTag[1] : source.url);
  const date = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published');
  // public-inbox(lore) atom 답장 엔트리는 thr:in-reply-to href에 부모 메시지의 lore URL을 담는다.
  // 이 부모 URL을 보존해야 답장을 부모 패치 시리즈 그룹에 묶을 수 있다.
  const inReplyToTag = block.match(/<thr:in-reply-to[^>]*\bhref=["']([^"']+)["']/i) ||
    block.match(/<in-reply-to[^>]*\bhref=["']([^"']+)["']/i);
  const inReplyTo = inReplyToTag ? decode(inReplyToTag[1]) : '';
  const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded') || tag(block, 'content');
  const outgoingLinks = mergeOutgoingLinks(
    extractOutgoingLinksFromHtml(rawTag(block, 'description'), {
      baseUrl: link || source.url,
      sourceField: 'rss.description'
    }),
    extractOutgoingLinksFromHtml(rawTag(block, 'summary'), {
      baseUrl: link || source.url,
      sourceField: 'rss.summary'
    }),
    extractOutgoingLinksFromHtml(rawTag(block, 'content:encoded'), {
      baseUrl: link || source.url,
      sourceField: 'rss.content'
    }),
    extractOutgoingLinksFromHtml(rawTag(block, 'content'), {
      baseUrl: link || source.url,
      sourceField: 'rss.content'
    })
  );
  return {
    source,
    title,
    url: link,
    publishedAt: date,
    summary,
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    in_reply_to: inReplyTo,
    // lore 시리즈 조각을 collapseSeriesRepresentatives가 대표 1건으로 묶을 수 있게
    // message-id 규약에서 시리즈 키를 파생한다(비-lore URL은 null).
    seriesId: deriveLoreSeriesId({ url: link, inReplyTo }),
    outgoing_links: outgoingLinks,
    imageCandidates: extractImageCandidatesFromRssBlock(block, link, source)
  };
}

function rssItemHtml(block) {
  return rawTag(block, 'content:encoded') ||
    rawTag(block, 'description') ||
    rawTag(block, 'content') ||
    rawTag(block, 'summary');
}

function parseRss(xml, source) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.flatMap(block => {
    const parentRaw = rssParentRawItem(block, source);
    // lore 답장(Re:)은 후보로 만들지 않는다 — 캡 슬롯/reserve를 답장이 차지하는 것을 막는다.
    if (isLoreReplyItem(parentRaw)) return [];
    const parent = normalizeCandidate(parentRaw);
    const childItems = extractRoundupChildTopics({
      source,
      parentTitle: parentRaw.title,
      parentUrl: parentRaw.url,
      publishedAt: parentRaw.publishedAt,
      html: rssItemHtml(block),
      rawText: parentRaw.summary
    }).map(item => normalizeCandidate(item));
    return [parent, ...childItems];
  }).filter(item => item.title && item.url);
}

function parseHtmlPage(html, source) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || source.name);
  const description = decode(
    (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) || [])[1] ||
    (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i) || [])[1] ||
    'No RSS feed is configured. Use this source page as a change/release-note watch target.'
  );
  return [normalizeCandidate({
    source,
    title,
    url: source.url,
    publishedAt: '',
    summary: description,
    sourceKind: inferFallbackSourceKind(source),
    collectionMode: fallbackCandidateCollectionMode(source),
    outgoing_links: extractOutgoingLinksFromHtml(html, {
      baseUrl: source.url,
      sourceField: 'html.body'
    }),
    imageCandidates: extractImageCandidatesFromHtml(html, source.url, source)
  })];
}

function keywordHits(text, keywords) {
  return keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
}

function firstMatch(pattern, value) {
  const match = String(value || '').match(pattern);
  return match ? match[0] : '';
}

function firstBehavior(value) {
  const sentences = String(value || '')
    .split(/(?<=[.!?])\s+|[•\n]/)
    .map(item => item.trim())
    .filter(Boolean);
  return sentences.find(sentence => BEHAVIOR_CHANGE_PATTERN.test(sentence)) || sentences[0] || '';
}

function isOfficialAndroidDeveloperSource(source = {}, raw = {}) {
  const sourceIdentity = [
    source.id,
    source.name
  ].map(item => String(item || '')).join(' ');
  const sourceUrls = [
    source.id,
    source.name,
    source.url,
    source.sourceUrl,
    raw.url,
    raw.sourceUrl,
    raw.source_url
  ].map(item => String(item || '')).join(' ');
  return /\bandroid-developers-blog\b|Android Developers Blog/i.test(sourceIdentity) ||
    /android-developers\.googleblog\.com/i.test(sourceUrls);
}

function nativeAndroidToolingEvidence(raw = {}, source = {}, title = '', summary = '') {
  const candidate = {
    ...raw,
    title,
    summary,
    source: source.name,
    source_name: source.name,
    category: source.category,
    source_category: source.category,
    section: source.section,
    source_section: source.section,
    usageHint: source.usageHint,
    source_usage_hint: source.usageHint
  };
  const detected = detectNativeAndroidToolingWorkflow(candidate);
  return {
    ...detected,
    official_android_developer_source: isOfficialAndroidDeveloperSource(source, raw),
    eligible: detected.detected && isOfficialAndroidDeveloperSource(source, raw)
  };
}

function hasBehaviorChangeForRaw(raw, behaviorChange) {
  if (raw?.source_extraction?.mode === 'roundup_child_topic') {
    return ROUNDUP_BEHAVIOR_CHANGE_PATTERN.test(behaviorChange);
  }
  return BEHAVIOR_CHANGE_PATTERN.test(behaviorChange);
}

// 컨텍스트 스팬 패턴(예: /\bLinux\b[^.\n]{0,120}\bcamera subsystem\b/)의 매치는 문장 조각이라
// component 라벨로 부적합하다. 토큰/짧은 구절 매치만 evidence 라벨로 채택한다(그 외는 커밋 전과
// 동일하게 미인정 유지).
const MAX_DRIVER_COMPONENT_LABEL_LENGTH = 48;

function componentFromText(value, source) {
  const match = firstMatch(API_OR_COMPONENT_PATTERN, value);
  if (match) return match;
  // #805: rkisp1/camss처럼 "ISP"가 토큰 내부에 있는 벤더 드라이버명은 위 패턴의 \bISP\b가 놓친다.
  // 분류기·스코어러(#744/#792)와 같은 단일출처 어휘로 fallback해 세 소비자의 인식 범위를 정합시킨다.
  for (const pattern of STRONG_CAMERA_DRIVER_PATTERNS) {
    const driverMatch = firstMatch(pattern, value);
    if (driverMatch && driverMatch.length <= MAX_DRIVER_COMPONENT_LABEL_LENGTH) return driverMatch;
  }
  return '';
}

function inferFallbackSourceKind(source) {
  const url = source.url || source.sourceUrl || '';
  const id = source.id || '';
  const name = source.name || '';
  if (/documentation|docs\/core\/camera|introduction|cdd|compatibility\/cdd/i.test(`${id} ${url} ${name}`)) {
    return 'documentation_page';
  }
  if (/blog|news-and-blog|research\.google\/blog|deepmind\.google\/blog/i.test(`${id} ${url} ${name}`)) {
    return 'blog_index';
  }
  return 'rolling_page';
}

function fallbackCandidateCollectionMode(source) {
  const mode = sourceCollectionMode(source);
  if (mode === 'release-note-watch') return 'release-note-page';
  if (mode === 'homepage-watch' || mode === 'media-lead') return 'homepage-watch';
  return 'html-watch-page';
}

function candidateCollectionMode(raw, source, sourceKind) {
  const explicit = String(raw.collectionMode || raw.collection_mode || '').trim();
  if (explicit) return explicit;
  if (sourceKind === 'rss_item') return 'rss-item';
  if (sourceKind === 'release_note_item') return 'release-note-item';
  if (sourceKind === 'blog_post_item') return 'article-item';
  return fallbackCandidateCollectionMode(source);
}

function hasConcreteReleaseEvidence(metadata) {
  return metadata.has_published_date &&
    metadata.has_version_or_release &&
    metadata.has_api_or_component &&
    metadata.has_behavior_change;
}

function selectionExclusionReason(classification, metadata) {
  if (classification.finalSelectionEligibility === 'main') return 'Eligible for main article selection.';
  if (classification.finalSelectionEligibility === 'short') return 'Eligible for short newsletter use.';
  if (classification.isWatchPage && !classification.hasDatedEvidence) {
    return 'No RSS item, no published date, no concrete release/API/behavior change detected.';
  }
  if (classification.finalSelectionEligibility === 'watchlist') {
    return 'Watchlist/reference material; select only after extracting concrete dated release/API/behavior evidence.';
  }
  if (metadata.source_gap_risk) {
    return 'Excluded from main/short selection because source evidence is incomplete or source-gap risk is present.';
  }
  return 'Excluded or low-confidence item below the main/short candidate tier.';
}

function evidenceSignalKindFor(classification, metadata) {
  if (classification.hasDatedEvidence && classification.collectionMode === 'release-note-item') return 'dated-release-evidence';
  if (classification.hasDatedEvidence && classification.collectionMode === 'rss-item') return 'dated-rss-article';
  if (classification.hasDatedEvidence) return 'dated-concrete-evidence';
  if (classification.isWatchPage) return 'undated-watch-page';
  if (metadata.evidence_score >= 4) return 'partial-evidence';
  return 'low-confidence';
}

function classifySelection(raw, source, metadata, score, candidateOnly) {
  const sourceMode = sourceCollectionMode(source);
  let collectionMode = candidateCollectionMode(raw, source, metadata.source_kind);
  if (metadata.source_role === 'reference_index' || metadata.source_role === 'official_documentation_reference') {
    const classification = {
      collectionMode,
      sourceCollectionMode: sourceMode,
      isArticleCandidate: false,
      isWatchPage: true,
      hasDatedEvidence: false,
      finalSelectionEligibility: 'exclude'
    };
    return {
      ...classification,
      evidenceSignalKind: 'reference-index',
      selectionExclusionReason: 'Reference index source; use only as context/background and exclude from final article inputs.'
    };
  }
  const isReleaseNoteItem = metadata.source_kind === 'release_note_item';
  const isDatedArticleItem = ['rss_item', 'blog_post_item'].includes(metadata.source_kind);
  const releaseNoteItemHasConcreteEvidence = isReleaseNoteItem && hasConcreteReleaseEvidence(metadata);
  if (isReleaseNoteItem && sourceMode === 'release-note-watch' && !releaseNoteItemHasConcreteEvidence) {
    collectionMode = 'release-note-page';
  }
  const isWatchPage = WATCH_CANDIDATE_MODES.has(collectionMode) || FALLBACK_INELIGIBLE_SOURCE_KINDS.has(metadata.source_kind);
  const hasDatedEvidence = isWatchPage || isReleaseNoteItem
    ? hasConcreteReleaseEvidence(metadata)
    : isDatedArticleItem ? metadata.has_published_date : hasConcreteReleaseEvidence(metadata);
  const isArticleCandidate = Boolean(raw.url) &&
    !candidateOnly &&
    !isWatchPage &&
    (isReleaseNoteItem ? hasDatedEvidence : isDatedArticleItem && metadata.has_published_date);
  let finalSelectionEligibility = 'exclude';

  if (isWatchPage && !hasDatedEvidence) {
    finalSelectionEligibility = 'watchlist';
  } else if (metadata.source_gap_risk || candidateOnly || !hasDatedEvidence) {
    finalSelectionEligibility = isWatchPage ? 'watchlist' : 'exclude';
  } else if (score >= 80) {
    finalSelectionEligibility = 'main';
  } else if (score >= 50) {
    finalSelectionEligibility = 'short';
  }

  if (!FINAL_SELECTION_ELIGIBILITIES.has(finalSelectionEligibility)) {
    finalSelectionEligibility = 'exclude';
  }

  const classification = {
    collectionMode,
    sourceCollectionMode: sourceMode,
    isArticleCandidate,
    isWatchPage,
    hasDatedEvidence,
    finalSelectionEligibility
  };
  return {
    ...classification,
    evidenceSignalKind: evidenceSignalKindFor(classification, metadata),
    selectionExclusionReason: selectionExclusionReason(classification, metadata)
  };
}

function decisionFromCandidate({ classification, metadata, sourceQuality, snapshot, scopeMetadata, candidateOnly }) {
  const topic = (scopeMetadata && scopeMetadata.relevance_bucket) || '';
  const hasDate = Boolean(metadata.has_published_date);
  const hasConcreteChange = Boolean(
    metadata.has_version_or_release || metadata.has_api_or_component || metadata.has_behavior_change
  );

  const snapshotDecision = snapshot || undefined;
  const contentChanged = snapshot
    ? (typeof snapshot.contentChanged === 'boolean' ? snapshot.contentChanged : undefined)
    : undefined;

  const { baseEvidenceLevel, baseReasonKey } = mapSourceQualityToBaseDecision(
    sourceQuality,
    metadata,
    classification
  );

  let evidenceLevel = baseEvidenceLevel;

  if (
    topic === 'generic_tech_watchlist' &&
    evidenceLevel !== 'reference'
  ) {
    evidenceLevel = 'watch';
  }

  if (candidateOnly && evidenceLevel === 'primary') {
    evidenceLevel = 'watch';
  }

  let selection;
  if (evidenceLevel === 'reference') {
    selection = 'reference';
  } else if (evidenceLevel === 'watch') {
    selection = 'watch';
  } else {
    const eligibility = classification.finalSelectionEligibility;
    if (eligibility === 'main') {
      selection = 'main';
    } else if (eligibility === 'short') {
      selection = 'short';
    } else {
      selection = 'watch';
    }
  }

  let reason;
  if (snapshotDecision && contentChanged === false) {
    reason = 'Snapshot checked; no meaningful content change.';
  } else if (evidenceLevel === 'primary' && selection === 'main') {
    reason = 'Official dated release row with concrete change.';
  } else if (evidenceLevel === 'primary' && selection === 'short') {
    reason = 'Official dated source with supporting evidence.';
  } else if (evidenceLevel === 'verified') {
    reason = 'Source confirmed by primary cross-check.';
  } else if (evidenceLevel === 'watch') {
    if (baseReasonKey === 'watch_mailing_lead') {
      reason = 'Mailing-list/community lead requires primary confirmation.';
    } else if (baseReasonKey === 'watch_generic_trend' || topic === 'generic_tech_watchlist') {
      reason = 'Generic tech item without article-level camera/driver/SoC/native-tooling evidence.';
    } else if (baseReasonKey === 'watch_source_gap') {
      reason = 'Source has gap risk; keep as watch material.';
    } else if (baseReasonKey === 'watch_cross_check') {
      reason = 'Cross-check missing; awaiting primary confirmation.';
    } else if (sourceQuality && sourceQuality.source_url_quality === 'generic_ai_or_it_trend') {
      reason = 'Generic tech item without article-level camera/driver/SoC/native-tooling evidence.';
    } else if (!sourceQuality && metadata.source_gap_risk === true) {
      reason = 'Source has gap risk; keep as watch material.';
    } else {
      reason = 'Lacks primary confirmation; keep as watch material.';
    }
  } else if (evidenceLevel === 'reference') {
    reason = 'Background reference page; not an article candidate.';
  } else {
    reason = classification.selectionExclusionReason || 'Watch material.';
  }

  const result = {
    topic,
    evidenceLevel,
    selection,
    reason,
    hasDate,
    hasConcreteChange
  };

  if (snapshotDecision) {
    result.snapshot = {
      lastSeenAt: snapshotDecision.lastSeenAt || '',
      seenCount: snapshotDecision.seenCount || 0
    };
    if (typeof contentChanged === 'boolean') {
      result.contentChanged = contentChanged;
    }
  }

  return result;
}

function buildLegacyDecisionInputs(item) {
  const finalSelectionEligibility = item.finalSelectionEligibility || item.final_selection_eligibility || 'exclude';

  const classification = {
    collectionMode: item.collectionMode || item.collection_mode || '',
    sourceCollectionMode: item.sourceCollectionMode || item.source_collection_mode || '',
    isArticleCandidate: Boolean(item.isArticleCandidate || item.is_article_candidate),
    isWatchPage: Boolean(item.isWatchPage || item.is_watch_page),
    hasDatedEvidence: Boolean(item.hasDatedEvidence || item.has_dated_evidence),
    finalSelectionEligibility,
    evidenceSignalKind: item.evidenceSignalKind || item.evidence_signal_kind || '',
    selectionExclusionReason: item.selection_exclusion_reason || ''
  };

  const metadata = {
    source_kind: item.source_kind || '',
    source_role: item.source_role || '',
    has_published_date: Boolean(item.has_published_date || item.hasDatedEvidence || item.has_dated_evidence),
    has_version_or_release: Boolean(item.has_version_or_release),
    has_api_or_component: Boolean(item.has_api_or_component),
    has_behavior_change: Boolean(item.has_behavior_change),
    evidence_score: item.evidence_score || 0,
    source_gap_risk: Boolean(item.source_gap_risk),
    reference_only: Boolean(item.reference_only)
  };

  const sourceQuality = item.source_quality || {
    source_role: item.source_role || '',
    source_url_quality: item.source_url_quality || '',
    source_quality_status: item.source_quality_status || '',
    main_article_source_allowed: Boolean(item.main_article_source_allowed),
    main_article_source_allowed_reason: item.main_article_source_allowed_reason || '',
    main_article_source_blockers: Array.isArray(item.main_article_source_blockers) ? item.main_article_source_blockers : [],
    cross_check_status: item.cross_check_status || '',
    requires_cross_check: Boolean(item.requires_cross_check),
    requires_conditional_evidence: Boolean(item.requires_conditional_evidence),
    conditional_evidence_type: item.conditional_evidence_type || '',
    evidence_granularity: item.evidence_granularity || ''
  };

  const snapshot = (item.snapshot_last_seen_at || item.snapshot_seen_count !== undefined)
    ? {
        lastSeenAt: item.snapshot_last_seen_at || '',
        seenCount: item.snapshot_seen_count || 0,
        contentChanged: typeof item.content_changed === 'boolean' ? item.content_changed : undefined
      }
    : (item.snapshot || undefined);

  const scopeMetadata = {
    relevance_bucket: item.relevance_bucket || item.relevanceBucket || ''
  };

  const candidateOnly = Boolean(item.candidateOnly || item.candidate_only);

  return { classification, metadata, sourceQuality, snapshot, scopeMetadata, candidateOnly };
}

function evidenceMetadata(raw, source, title, summary, score, candidateOnly) {
  const sourceKind = raw.sourceKind || raw.source_kind || inferFallbackSourceKind(source);
  const sourceRole = String(raw.sourceRole || raw.source_role || source.sourceRole || source.source_role || '').trim();
  const evidenceText = `${title} ${summary} ${raw.version_or_release || ''} ${raw.api_or_component || ''} ${raw.behavior_change || ''}`;
  const toolingEvidence = nativeAndroidToolingEvidence(raw, source, title, summary);
  const versionOrRelease = String(raw.version_or_release || firstMatch(VERSION_OR_RELEASE_PATTERN, evidenceText)).trim();
  const apiOrComponent = String(
    raw.api_or_component ||
    componentFromText(evidenceText, source) ||
    (toolingEvidence.eligible ? 'Android native tooling workflow' : '')
  ).trim();
  const behaviorChange = String(
    raw.behavior_change ||
    firstBehavior(summary || title) ||
    (toolingEvidence.eligible ? 'Official Android tooling article describes native Android app workflow behavior.' : '')
  ).trim();
  const hasPublishedDate = Boolean(String(raw.publishedAt || raw.published_date || '').trim());
  const hasVersionOrRelease = Boolean(versionOrRelease);
  const hasApiOrComponent = Boolean(apiOrComponent);
  const hasBehaviorChange = Boolean(behaviorChange && hasBehaviorChangeForRaw(raw, behaviorChange));
  const evidenceScore =
    (hasPublishedDate ? 2 : 0) +
    (hasVersionOrRelease ? 2 : 0) +
    (hasApiOrComponent ? 2 : 0) +
    (hasBehaviorChange ? 2 : 0);
  const fallbackIneligible = FALLBACK_INELIGIBLE_SOURCE_KINDS.has(sourceKind);
  const itemLevel = ITEM_LEVEL_SOURCE_KINDS.has(sourceKind);
  const releaseNoteItemMissingEvidence = sourceKind === 'release_note_item' &&
    (!hasPublishedDate || !hasVersionOrRelease || !hasApiOrComponent || !hasBehaviorChange);
  const datedItemMissingEvidence = itemLevel &&
    sourceKind !== 'release_note_item' &&
    (!hasPublishedDate || !hasApiOrComponent || !hasBehaviorChange);
  const officialDatedNativeTooling = toolingEvidence.eligible && hasPublishedDate && hasApiOrComponent && hasBehaviorChange;
  const parserItemMissingCoreEvidence = !officialDatedNativeTooling &&
    (releaseNoteItemMissingEvidence || datedItemMissingEvidence);
  const referenceIndex = sourceRole === 'reference_index' || sourceRole === 'official_documentation_reference';
  const sourceGapRisk = referenceIndex || fallbackIneligible || parserItemMissingCoreEvidence || evidenceScore < 6;
  const mainEligible = !referenceIndex && !candidateOnly && !sourceGapRisk && evidenceScore >= 6 && score >= 30;

  return {
    source_kind: sourceKind,
    source_role: sourceRole,
    version_or_release: versionOrRelease,
    api_or_component: apiOrComponent,
    behavior_change: behaviorChange,
    has_published_date: hasPublishedDate,
    has_version_or_release: hasVersionOrRelease,
    has_api_or_component: hasApiOrComponent,
    has_behavior_change: hasBehaviorChange,
    source_gap_risk: sourceGapRisk,
    main_eligible: mainEligible,
    briefing_only: sourceGapRisk && !mainEligible,
    reference_only: referenceIndex || fallbackIneligible || (sourceGapRisk && evidenceScore < 4),
    evidence_score: evidenceScore,
    source_hint_api_or_component: source.category,
    native_android_tooling: toolingEvidence
  };
}

function sourceExtractionSections(raw) {
  return [
    ...(Array.isArray(raw?.source_extraction?.release?.sections) ? raw.source_extraction.release.sections : []),
    ...(Array.isArray(raw?.source_extraction?.minor_line_context?.sections) ? raw.source_extraction.minor_line_context.sections : [])
  ];
}

function sourceExtractionBullet(raw) {
  for (const section of sourceExtractionSections(raw)) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      const value = String(item?.text || item?.source_text || '').trim();
      if (value) return value;
    }
  }
  return '';
}

function sourceExtractionBackfill(raw) {
  const extraction = raw?.source_extraction || {};
  const release = extraction.release || {};
  const bullet = sourceExtractionBullet(raw);
  return {
    ...raw,
    publishedAt: String(release.date || raw.publishedAt || raw.published_date || '').trim(),
    version_or_release: String(release.version || raw.version_or_release || '').trim(),
    api_or_component: String(release.component || raw.api_or_component || '').trim(),
    behavior_change: String(bullet || raw.behavior_change || '').trim(),
    summary: String(bullet || raw.summary || '').trim(),
    relevanceBucketHint: raw.relevanceBucketHint,
    relevance_bucket_hint: raw.relevance_bucket_hint
  };
}

const REDDIT_HOSTS = new Set(['reddit.com', 'www.reddit.com']);

function isRedditSource(source = {}) {
  if (typeof source.id === 'string' && source.id.startsWith('reddit-')) return true;
  for (const value of [source.sourceUrl, source.url, source.rssUrl]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      if (REDDIT_HOSTS.has(new URL(value).host.toLowerCase())) return true;
    } catch (_error) { /* ignore unparsable url */ }
  }
  return false;
}

function redditSubreddit(source = {}) {
  const match = String(source.sourceUrl || source.url || source.rssUrl || '').match(/\/r\/([^/?#]+)/i);
  return match ? match[1] : '';
}

function communitySignalMarkers(source = {}) {
  if (!isRedditSource(source)) {
    return { community_signal: false };
  }
  return {
    community_signal: true,
    community_signal_source: 'reddit',
    community_signal_role: 'candidate_discovery',
    reddit_subreddit: redditSubreddit(source)
  };
}

function normalizeCandidate(raw) {
  raw = sourceExtractionBackfill(raw);
  const source = raw.source;
  const title = decode(raw.title);
  const summary = decode(raw.summary).slice(0, 500);
  const rawSourceKind = raw.sourceKind || raw.source_kind || inferFallbackSourceKind(source);
  const sourceType = raw.sourceType || raw.source_type || rawSourceKind;
  const url = canonicalContentUrl(raw.url);
  const sourceUrl = canonicalContentUrl(source.sourceUrl || source.url);
  const parentUrl = canonicalContentUrl(raw.parentUrl || raw.parent_url || '');
  const articleText = `${title} ${summary} ${raw.version_or_release || ''} ${raw.api_or_component || ''} ${raw.behavior_change || ''}`.toLowerCase();
  const cameraHits = keywordHits(articleText, CAMERA_KEYWORDS);
  const techHits = keywordHits(articleText, TECH_KEYWORDS);
  const sourcePriorHits = keywordHits(`${source.name} ${source.category} ${source.usageHint || ''}`.toLowerCase(), source.keywords);
  const categoryBoost = ['camera-hal', 'camera-api', 'android-media', 'aosp', 'compatibility', 'security'].includes(source.category) ? 5 : 0;
  const priorityBoost = (PRIORITY_WEIGHT[source.priority] || 0) * 4;
  const reliabilityBoost = (RELIABILITY_WEIGHT[source.reliability] || 0) * 3;
  const sourcePriorBoost = Math.min(3, sourcePriorHits);
  const rawScore = categoryBoost + cameraHits * 12 + techHits * 6 + sourcePriorBoost + priorityBoost + reliabilityBoost;
  const score = Math.min(100, rawScore);
  const candidateOnly = source.candidateOnly || CANDIDATE_ONLY_RELIABILITY.has(source.reliability);
  const section = source.section;
  const metadata = evidenceMetadata(raw, source, title, summary, score, candidateOnly);
  const scopeMetadata = classifyAospCameraStackCandidate({
    ...raw,
    title,
    summary,
    source: source.name,
    source_name: source.name,
    category: source.category,
    section,
    source_category: source.category,
    source_section: section,
    usageHint: source.usageHint,
    source_usage_hint: source.usageHint,
    version_or_release: metadata.version_or_release,
    api_or_component: metadata.api_or_component,
    behavior_change: metadata.behavior_change,
    relevance_bucket_hint: raw.relevanceBucketHint || raw.relevance_bucket_hint || ''
  });
  let classification = classifySelection(raw, source, metadata, score, candidateOnly);
  const nativeTooling = metadata.native_android_tooling || {};
  if (
    nativeTooling.eligible === true &&
    scopeMetadata.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK &&
    classification.hasDatedEvidence === true &&
    metadata.source_gap_risk === false
  ) {
    classification = {
      ...classification,
      finalSelectionEligibility: 'short',
      selectionExclusionReason: 'Official dated Android native tooling workflow article; eligible only as cpp_ai_tooling_fallback supporting main context.'
    };
  }
  if (scopeMetadata.relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST) {
    classification = {
      ...classification,
      finalSelectionEligibility: classification.hasDatedEvidence ? 'watchlist' : 'exclude',
      selectionExclusionReason: 'Generic technology item without article-level camera, driver, SoC, or native tooling evidence; keep as watchlist/briefing material.'
    };
  }
  const sourceGapRisk = metadata.source_gap_risk ||
    classification.finalSelectionEligibility === 'watchlist' ||
    classification.finalSelectionEligibility === 'exclude';
  const mainEligible = ['main', 'short'].includes(classification.finalSelectionEligibility);
  const briefingOnly = classification.finalSelectionEligibility === 'watchlist';
  const referenceOnly = classification.finalSelectionEligibility === 'watchlist' || metadata.reference_only;
  const sourceQualityCandidate = {
    ...raw,
    title,
    summary,
    url,
    article_url: url,
    sourceUrl,
    source_url: sourceUrl,
    source_kind: metadata.source_kind,
    hasDatedEvidence: classification.hasDatedEvidence,
    has_dated_evidence: classification.hasDatedEvidence,
    has_published_date: metadata.has_published_date,
    api_or_component: metadata.api_or_component,
    behavior_change: metadata.behavior_change,
    source_gap_risk: sourceGapRisk,
    reference_only: referenceOnly,
    candidateOnly,
    candidate_only: candidateOnly,
    requiresCrossCheck: source.requiresCrossCheck,
    requires_cross_check: source.requiresCrossCheck,
    ...scopeMetadata
  };
  const sourceQuality = classifySourceQuality({
    candidate: sourceQualityCandidate,
    source,
    metadata: {
      ...metadata,
      source_gap_risk: sourceGapRisk,
      reference_only: referenceOnly
    },
    scopeMetadata
  });
  const sourceQualityFlat = sourceQualityFlatFields(sourceQuality);

  const rawSnapshot = (raw.snapshot_last_seen_at || raw.snapshot_seen_count !== undefined)
    ? {
        lastSeenAt: raw.snapshot_last_seen_at || '',
        seenCount: raw.snapshot_seen_count || 0,
        contentChanged: typeof raw.content_changed === 'boolean' ? raw.content_changed : undefined
      }
    : undefined;

  const decision = decisionFromCandidate({
    classification,
    metadata,
    sourceQuality,
    snapshot: rawSnapshot,
    scopeMetadata,
    candidateOnly
  });

  return {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    source: source.name,
    source_name: source.name,
    sourceUrl,
    source_url: sourceUrl,
    articleUrl: url,
    article_url: url,
    source_id: source.id,
    category: source.category,
    section,
    source_category: source.category,
    source_section: section,
    priority: source.priority,
    reliability: source.reliability,
    source_quality_required: true,
    origin: raw.origin || 'source_registry',
    collectionStage: raw.collectionStage || raw.collection_stage || 'raw_collection',
    collection_stage: raw.collectionStage || raw.collection_stage || 'raw_collection',
    manualSeed: Boolean(raw.manualSeed || raw.manual_seed),
    manual_seed: Boolean(raw.manualSeed || raw.manual_seed),
    sourceType,
    source_type: sourceType,
    source_priority: source.priority,
    source_reliability: source.reliability,
    usageHint: source.usageHint,
    source_usage_hint: source.usageHint,
    source_linked_evidence_policy: source.linkedEvidencePolicy || null,
    source_quality: sourceQuality,
    ...sourceQualityFlat,
    candidateOnly,
    candidate_only: candidateOnly,
    ...communitySignalMarkers(source),
    collectionMode: classification.collectionMode,
    collection_mode: classification.collectionMode,
    sourceCollectionMode: classification.sourceCollectionMode,
    source_collection_mode: classification.sourceCollectionMode,
    isArticleCandidate: classification.isArticleCandidate,
    is_article_candidate: classification.isArticleCandidate,
    isWatchPage: classification.isWatchPage,
    is_watch_page: classification.isWatchPage,
    hasDatedEvidence: classification.hasDatedEvidence,
    has_dated_evidence: classification.hasDatedEvidence,
    evidenceSignalKind: classification.evidenceSignalKind,
    evidence_signal_kind: classification.evidenceSignalKind,
    evidenceLevel: decision.evidenceLevel,
    evidence_level: decision.evidenceLevel,
    finalSelectionEligibility: classification.finalSelectionEligibility,
    final_selection_eligibility: classification.finalSelectionEligibility,
    source_kind: metadata.source_kind,
    source_extraction: raw.source_extraction || null,
    derived_editorial_hints: raw.derived_editorial_hints || null,
    extraction_quality: raw.extraction_quality || raw.source_extraction?.extraction_quality || null,
    datePrecision: raw.datePrecision || raw.date_precision || '',
    date_precision: raw.datePrecision || raw.date_precision || '',
    parentUrl: parentUrl || '',
    parent_url: parentUrl || '',
    in_reply_to: canonicalContentUrl(raw.in_reply_to || raw.inReplyTo || ''),
    // patchwork.libcamera.org REST series id — 패치 시리즈 dedup 그룹 키(#795). 수집기(patchCandidate)가
    // 실어주며, 이 whitelist에 없으면 candidates.json에서 탈락해 선정 단계 dedup(article-groups seriesKey)이
    // 무효가 된다(#795 후속: 필드가 정규화에서 누락돼 프로덕션에서 시리즈가 collapse되지 않던 갭 수정).
    seriesId: raw.seriesId ?? raw.series_id ?? null,
    series_id: raw.seriesId ?? raw.series_id ?? null,
    parentTitle: raw.parentTitle || raw.parent_title || '',
    parent_title: raw.parentTitle || raw.parent_title || '',
    parentCanonicalUrl: canonicalContentUrl(raw.parentCanonicalUrl || raw.parent_canonical_url || parentUrl || ''),
    parent_canonical_url: canonicalContentUrl(raw.parentCanonicalUrl || raw.parent_canonical_url || parentUrl || ''),
    roundupItemIndex: raw.roundupItemIndex ?? raw.roundup_item_index ?? raw.source_extraction?.roundup_item_index ?? null,
    roundup_item_index: raw.roundupItemIndex ?? raw.roundup_item_index ?? raw.source_extraction?.roundup_item_index ?? null,
    anchorText: raw.anchorText || raw.anchor_text || raw.source_extraction?.anchor_text || '',
    anchor_text: raw.anchorText || raw.anchor_text || raw.source_extraction?.anchor_text || '',
    article_group_key: nativeTooling.eligible === true &&
      scopeMetadata.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK
      ? ANDROID_NATIVE_TOOLING_GROUP_KEY
      : raw.article_group_key || raw.articleGroupKey || '',
    tooling_workflow_type: nativeTooling.eligible === true &&
      scopeMetadata.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK
      ? NATIVE_TOOLING_WORKFLOW_TYPE
      : raw.tooling_workflow_type || raw.toolingWorkflowType || scopeMetadata.tooling_workflow_type || '',
    native_workflow_evidence_score: scopeMetadata.native_workflow_evidence_score || nativeTooling.native_workflow_evidence_score || 0,
    outgoing_links: normalizeOutgoingLinks(raw.outgoing_links || raw.outgoingLinks),
    sourceMonth: raw.sourceMonth || raw.source_month || '',
    source_month: raw.sourceMonth || raw.source_month || '',
    has_published_date: metadata.has_published_date,
    has_version_or_release: metadata.has_version_or_release,
    has_api_or_component: metadata.has_api_or_component,
    has_behavior_change: metadata.has_behavior_change,
    source_gap_risk: sourceGapRisk,
    main_eligible: mainEligible,
    briefing_only: briefingOnly,
    reference_only: referenceOnly,
    evidence_score: metadata.evidence_score,
    version_or_release: metadata.version_or_release,
    api_or_component: metadata.api_or_component,
    source_hint_api_or_component: metadata.source_hint_api_or_component,
    behavior_change: metadata.behavior_change,
    selection_exclusion_reason: classification.selectionExclusionReason,
    watchlist_reason: classification.finalSelectionEligibility === 'watchlist'
      ? classification.selectionExclusionReason
      : '',
    verification_hint: sourceGapRisk
      ? classification.selectionExclusionReason
      : candidateOnly || source.requiresCrossCheck
      ? 'Requires cross-check before final selection. Prefer official documentation, official blogs, release notes, or direct vendor/project sources.'
      : 'Can be used directly if the collected item supports the claim.',
    title,
    url,
    publishedAt: raw.publishedAt || '',
    published_date: raw.publishedAt || '',
    summary,
    relevanceScore: score,
    relevance_score: score,
    cameraHalRelevanceScore: score,
    camera_hal_relevance_score: score,
    ...scopeMetadata,
    imageCandidates: Array.isArray(raw.imageCandidates) ? raw.imageCandidates : [],
    image_candidates: Array.isArray(raw.imageCandidates) ? raw.imageCandidates : [],
    candidateTier: candidateTier(score, classification.finalSelectionEligibility),
    reason: buildReason(cameraHits, techHits, source, score, scopeMetadata),
    collection_reason: buildReason(cameraHits, techHits, source, score, scopeMetadata),
    decision,
    selection: decision.selection,
    decision_reason: decision.reason,
    has_date: decision.hasDate,
    has_concrete_change: decision.hasConcreteChange,
    topic_bucket: decision.topic
  };
}

async function enrichImageCandidates(candidate) {
  const source = {
    name: candidate.source,
    sourceUrl: candidate.sourceUrl || candidate.source_url,
    url: candidate.sourceUrl || candidate.source_url
  };
  let imageCandidates = Array.isArray(candidate.imageCandidates) ? candidate.imageCandidates : [];

  try {
    const html = await fetchText(candidate.articleUrl || candidate.url, 4500);
    imageCandidates = imageCandidates.concat(extractImageCandidatesFromHtml(html, candidate.articleUrl || candidate.url, source));
  } catch {
    // Article pages often block lightweight collectors. Keep RSS/source-page candidates when available.
  }

  const validated = await validateImageCandidates(imageCandidates);
  return {
    ...candidate,
    imageCandidates: validated,
    image_candidates: validated
  };
}

function candidateTier(score, finalSelectionEligibility = '') {
  if (finalSelectionEligibility === 'main') return 'main-article';
  if (finalSelectionEligibility === 'short') return 'short-news';
  if (finalSelectionEligibility === 'watchlist') return 'watchlist-reference';
  if (finalSelectionEligibility === 'exclude') return 'exclude';
  if (score >= 80) return 'main-article';
  if (score >= 50) return 'short-news';
  if (score >= 30) return 'reference-candidate';
  return 'exclude';
}

function buildReason(cameraHits, techHits, source, score, scopeMetadata = {}) {
  const prefix = `${source.name} (${source.reliability}, ${source.priority}, score ${score})`;
  if (scopeMetadata.relevance_bucket && scopeMetadata.relevance_bucket !== BUCKETS.GENERIC_TECH_WATCHLIST) {
    return `${prefix}: ${scopeMetadata.relevance_bucket} (${scopeMetadata.aosp_camera_relevance_reason})`;
  }
  if (scopeMetadata.relevance_bucket === BUCKETS.GENERIC_TECH_WATCHLIST) {
    return `${prefix}: generic_tech_watchlist; article-level camera, driver, SoC, or native tooling evidence was weak.`;
  }
  if (cameraHits > 0 && techHits > 0) {
    return `${prefix}: Camera HAL relevance and engineering productivity signals were both detected.`;
  }
  if (cameraHits > 0) {
    return `${prefix}: Camera, CameraX, HAL, Android, libcamera, V4L2, or compatibility signals were detected.`;
  }
  if (techHits > 0) {
    return `${prefix}: C++, LLVM/Clang, AI, build, test, or developer tooling signals were detected.`;
  }
  return `${prefix}: Keep as a watch-list candidate; editor should confirm direct Camera HAL relevance.`;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function newsletterDateWindowEnd(value) {
  const dateText = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  return parseDate(`${dateText}T23:59:59.999Z`);
}

function withinLookback(candidate, now, lookbackDays) {
  const date = parseDate(candidate.publishedAt);
  if (!date) return true;
  const windowEndMs = now.getTime();
  const windowStartMs = windowEndMs - lookbackDays * DAY_MS;
  const precision = String(candidate.datePrecision || candidate.date_precision || '').toLowerCase();
  if (precision === 'month') {
    const monthStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const monthEndMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999);
    return monthEndMs >= windowStartMs && monthStartMs <= windowEndMs;
  }
  const candidateMs = date.getTime();
  return candidateMs >= windowStartMs && candidateMs <= windowEndMs;
}

function titleKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function urlDedupeKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    return parsed.toString().replace(/\/(?=#|$)/, '').toLowerCase();
  } catch {
    const [withoutHash, hash = ''] = raw.split('#');
    return `${withoutHash.replace(/\?.*$/, '').replace(/\/$/, '')}${hash ? `#${hash}` : ''}`.toLowerCase();
  }
}

function isSourceChangeEventCandidate(item = {}) {
  return item.source_kind === 'source_change_event' ||
    item.source_type === 'source_change_event' ||
    item.sourceKind === 'source_change_event' ||
    item.sourceType === 'source_change_event' ||
    item.collectionMode === 'source-change-event' ||
    item.collection_mode === 'source-change-event';
}

// patchwork 등 series를 가진 소스는 한 patch 시리즈가 수십 개 조각으로 후보에 들어온다.
// per-source 캡(capPerSource)은 조각 단위로 세므로, 큰 시리즈가 캡을 자기 조각들로 소진하다
// 대표조차 남기지 못하고 통째로 밀려날 수 있다(선정 단계 series dedup(#795)은 캡 이후라 이때는
// 이미 늦다 — 캡에서 사라진 시리즈는 선정이 볼 기회조차 없다). 캡 이전에 (source, seriesId)별
// 대표 1건으로 collapse해, 시리즈가 캡에 대해 하나의 후보로 경쟁하게 한다. 입력이 이미 rank
// 정렬 상태이므로 first-seen이 그 시리즈의 최상위 대표다. seriesId가 없는 후보(대부분의 소스)는
// 그대로 통과하므로 다른 소스 동작에는 영향이 없다.
function collapseSeriesRepresentatives(candidates) {
  const seenSeries = new Set();
  const result = [];
  for (const item of candidates) {
    const seriesId = item.seriesId ?? item.series_id;
    if (seriesId !== undefined && seriesId !== null && seriesId !== '') {
      const key = `${item.source_id || item.source || ''}::${seriesId}`;
      if (seenSeries.has(key)) continue;
      seenSeries.add(key);
    }
    result.push(item);
  }
  return result;
}

function capPerSource(candidates, maxPerSource) {
  if (!Number.isFinite(maxPerSource) || maxPerSource <= 0) return [...candidates];
  const perSourceCount = new Map();
  const result = [];
  for (const item of candidates) {
    const key = item.source_id || item.source || '';
    const count = perSourceCount.get(key) || 0;
    if (count >= maxPerSource) continue;
    perSourceCount.set(key, count + 1);
    result.push(item);
  }
  return result;
}

function dedupe(candidates) {
  const ordered = [...candidates].sort((a, b) =>
    Number(isSourceChangeEventCandidate(b)) - Number(isSourceChangeEventCandidate(a))
  );
  const seenUrls = new Set();
  const seenTitles = new Set();
  const result = [];
  for (const item of ordered) {
    const urlKey = urlDedupeKey(item.url);
    const normalizedTitle = titleKey(item.title);
    if (seenUrls.has(urlKey)) continue;
    if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;
    seenUrls.add(urlKey);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    result.push(item);
  }
  return result;
}

function mdEscape(value = '') {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ').trimEnd();
}

function markdown(date, candidates, failures, lookbackDays, options = {}) {
  const lines = [];
  const sourceRegistryPath = options.sourcesPath || path.relative(root, activeSourcesPath);

  function resolveDecision(item) {
    if (item.decision) return item.decision;
    return decisionFromCandidate(buildLegacyDecisionInputs(item));
  }

  const mainCandidates = candidates.filter(item => resolveDecision(item).selection === 'main');
  const shortCandidates = candidates.filter(item => resolveDecision(item).selection === 'short');
  const watchCandidates = candidates.filter(item => resolveDecision(item).selection === 'watch');
  const referenceCandidates = candidates.filter(item => resolveDecision(item).selection === 'reference');

  function candidateTable(items) {
    lines.push('| Selection | Evidence | Topic | Title | Source | Date | Reason | Link |');
    lines.push('|---|---|---|---|---|---|---|---|');
    if (items.length === 0) {
      lines.push('| - | - | - | 없음 | - | - | - | - |');
      lines.push('');
      return;
    }
    for (const item of items) {
      const d = resolveDecision(item);
      lines.push(`| ${mdEscape(d.selection || '')} | ${mdEscape(d.evidenceLevel || '')} | ${mdEscape(d.topic || '')} | ${mdEscape(item.title)} | ${mdEscape(item.source)} | ${mdEscape(item.publishedAt || '검토 필요')} | ${mdEscape(d.reason || '')} | [link](${item.url}) |`);
    }
    lines.push('');
  }

  lines.push(`# 뉴스 후보 - ${date}`);
  lines.push('');
  lines.push('이 파일은 구조화된 newsletter source registry에서 생성됩니다. Gemini는 candidate JSON과 source metadata만 입력으로 사용하며 웹을 직접 browse하지 않습니다.');
  lines.push('');
  lines.push(`- Lookback: ${lookbackDays}일`);
  lines.push(`- 후보 수: ${candidates.length}`);
  lines.push(`- Source registry: ${sourceRegistryPath}`);
  lines.push('- Candidate-only media/community source는 final article selection 전에 official-source verification이 필요합니다.');
  lines.push('- 날짜가 있는 release/API/behavior evidence가 없는 static HTML page는 main article candidate가 아니라 watchlist/reference material입니다.');
  lines.push('');
  lines.push('## Gemini Newsroom 입력 요약');
  lines.push('');
  lines.push('```text');
  lines.push(`뉴스레터 날짜: ${date}`);
  lines.push(`대상 독자: ${AUDIENCE}`);
  lines.push('Inputs: content/collected-news/YYYY-MM-DD/manual-candidates.json, content/collected-news/YYYY-MM-DD/candidates.json, src/shared/data/news-sources.json, docs/NEWS_SOURCES.md');
  lines.push('Outputs: reporter-candidates.json, editor-draft.json, fact-check-report.json, newsletter.md, index.html, editor-in-chief-brief.md, release-qa-report.md');
  lines.push('```');
  lines.push('');

  lines.push('## Main 후보');
  lines.push('');
  candidateTable(mainCandidates);

  lines.push('## Short 후보');
  lines.push('');
  candidateTable(shortCandidates);

  lines.push('## Watchlist');
  lines.push('');
  candidateTable(watchCandidates);

  lines.push('## Reference / snapshot 페이지');
  lines.push('');
  candidateTable(referenceCandidates);

  lines.push('## 원본 후보');
  lines.push('');
  for (const [index, item] of candidates.entries()) {
    const d = resolveDecision(item);
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push('');
    lines.push(`- 출처: ${item.source}`);
    lines.push(`- 출처 URL: ${item.source_url}`);
    lines.push(`- 발행일: ${item.publishedAt || '검토 필요'}`);
    lines.push(`- Link: ${item.url}`);
    lines.push(`- Section: ${item.section}`);
    lines.push(`- Selection: ${d.selection || ''}`);
    lines.push(`- Evidence level: ${d.evidenceLevel || ''}`);
    lines.push(`- Topic: ${d.topic || ''}`);
    lines.push(`- Reason: ${d.reason || ''}`);
    lines.push(`- 날짜 근거 있음: ${item.hasDatedEvidence ? 'yes' : 'no'}`);
    lines.push(`- 요약: ${mdEscape(item.summary || '요약 없음')}`);
    if (d.snapshot) {
      lines.push(`- Snapshot last seen at: ${d.snapshot.lastSeenAt || ''}`);
      lines.push(`- Snapshot seen count: ${d.snapshot.seenCount ?? ''}`);
    }
    lines.push('');
  }

  lines.push('## Collector 실패');
  lines.push('');
  if (failures.length === 0) {
    lines.push('- 없음');
  } else {
    for (const failure of failures) {
      lines.push(`- ${failure.source}: ${failure.message}`);
    }
  }
  lines.push('');
  lines.push('## 편집장 체크리스트');
  lines.push('');
  lines.push('- [ ] High-priority official source를 먼저 검토했다.');
  lines.push('- [ ] Candidate-only source는 가능하면 official documentation 또는 blog로 교차 확인했다.');
  lines.push('- [ ] 각 final section이 source name과 source URL을 보존한다.');
  lines.push('- [ ] Final Markdown/HTML에 출처와 참고자료가 포함되어 있다.');
  lines.push('- [ ] Camera HAL relevance가 capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, implementation impact와 연결된다.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  // Fail fast on a malformed manual_source_urls input before doing any
  // collection work, so we never leave a manifest-less candidate artifact.
  parseManualSourceUrls(process.env.NEWSROOM_MANUAL_SOURCE_URLS || '');
  const date = runtimeConfig.newsletterDate || kstDate();
  const lookbackDays = runtimeConfig.lookbackDays;
  const now = runtimeConfig.newsletterDate
    ? newsletterDateWindowEnd(runtimeConfig.newsletterDate) || new Date()
    : new Date();
  const sources = parseSources();
  const failures = [];
  let candidates = [];
  let sourceMonitorResult = null;

  for (const source of sources) {
    try {
      const feed = sourceFeed(source);
      const target = feed || fetchUrlForContent(source.url);
      const text = await fetchText(target);
      const indexItems = parseSourceSpecificItems(text, source);
      // 일부 공식 소스는 인덱스 페이지(월별/아카이브 링크)만 연결돼 있어 인덱스 파싱만으로는
      // dated 증거를 못 만든다(source-gap). 최신 상세 페이지를 따라가 dated 후보를 만들고,
      // 만들지 못하면 기존 인덱스 동작을 유지한다.
      const followedItems = await resolveFollowedSourceItems(source, { indexItems, text, fetchTextImpl: fetchText });
      const sourceSpecificItems = followedItems.length > 0 ? followedItems : indexItems;
      const resolvedSourceSpecificItems = sourceSpecificItems.length > 0
        ? await resolveLinkedReleaseNoteEvidenceItems(sourceSpecificItems, source, { fetchTextImpl: fetchText })
        : [];
      // followed-resolver 소스는 큐레이션 추출이 비면 신호 없음이므로 제너릭 폴백을 막는다
      // (pipermail/bulletin 인덱스 나비링크를 후보로 만들던 origin).
      const parsed = resolvedSourceSpecificItems.length > 0
        ? resolvedSourceSpecificItems.map(item => normalizeCandidate(item))
        : shouldSuppressGenericFallback(source) ? []
        : feed ? parseRss(text, source) : parseHtmlPage(text, source);
      candidates.push(...parsed);
    } catch (error) {
      failures.push({ source: source.name, message: error.message });
    }
  }

  try {
    sourceMonitorResult = await runSourceMonitor({
      root,
      date,
      commitSnapshots: false
    });
    candidates.push(...sourceMonitorResult.candidates);
  } catch (error) {
    failures.push({ source: 'source-monitor', message: error.message });
  }

  const rankedCandidates = dedupe(candidates)
    .filter(item => withinLookback(item, now, lookbackDays))
    .filter(item => item.cameraHalRelevanceScore >= 30 || item.source_priority === 'high')
    .sort((a, b) => {
      const priorityDelta = (PRIORITY_WEIGHT[b.source_priority] || 0) - (PRIORITY_WEIGHT[a.source_priority] || 0);
      const reliabilityDelta = (RELIABILITY_WEIGHT[b.source_reliability] || 0) - (RELIABILITY_WEIGHT[a.source_reliability] || 0);
      return priorityDelta || reliabilityDelta || b.relevanceScore - a.relevanceScore;
    });
  candidates = capPerSource(collapseSeriesRepresentatives(rankedCandidates), MAX_CANDIDATES_PER_SOURCE).slice(0, MAX_FINAL_CANDIDATES);

  const enrichedCandidates = [];
  for (const candidate of candidates) {
    enrichedCandidates.push(await enrichImageCandidates(candidate));
  }
  candidates = enrichedCandidates;

  const outDir = collectedNewsDir(root, date);
  const dateNewsroomDir = newsroomDir(root, date);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(dateNewsroomDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });

  const linkedEvidenceDiagnostics = await analyzeLinkedEvidenceForCandidates(date, candidates, {
    runtimeConfig
  });
  candidates = linkedEvidenceDiagnostics.candidates;
  writeLinkedEvidenceDiagnosticsArtifacts(dateNewsroomDir, linkedEvidenceDiagnostics);

  if (candidates.length === 0) {
    throw new Error('No news candidates collected. Check src/shared/data/news-sources.json, docs/NEWS_SOURCES.md, or network access.');
  }

  const generatedAt = new Date().toISOString();
  const candidatePayload = {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    date,
    newsletter_date: date,
    audience: AUDIENCE,
    lookback_days: lookbackDays,
    generated_at: generatedAt,
    sources_path: path.relative(root, activeSourcesPath).replace(/\\/g, '/'),
    section_map: sectionMap,
    candidates,
    failures
  };
  writeManualCandidateArtifacts({
    root,
    date,
    payload: candidatePayload,
    sourceCount: sources.length,
    manualSourceUrls: process.env.NEWSROOM_MANUAL_SOURCE_URLS || '',
    collectionIntentPath: process.env.NEWSROOM_COLLECTION_INTENT_PATH || '',
    generatedAt,
    workflow: 'manual-source-collection-pr'
  });
  fs.writeFileSync(path.join(dateNewsroomDir, 'news-candidates.md'), markdown(date, candidates, failures, lookbackDays), 'utf8');
  fs.writeFileSync(path.join(root, '.tmp', 'news-candidate-date.txt'), date, 'utf8');
  if (sourceMonitorResult) {
    const includedEvidenceIds = new Set(candidates
      .filter(isSourceChangeEventCandidate)
      .map(candidate => candidate.evidence_id)
      .filter(Boolean));
    commitSourceSnapshotWrites({
      root,
      snapshotWrites: filterSnapshotWritesByIncludedEvidenceIds(
        sourceMonitorResult.snapshotWrites,
        includedEvidenceIds
      )
    });
  }

  console.log(`Collected ${candidates.length} candidates for ${date}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  CANDIDATE_SCHEMA_VERSION,
  MAX_FINAL_CANDIDATES,
  MAX_CANDIDATES_PER_SOURCE,
  canonicalContentUrl,
  capPerSource,
  collapseSeriesRepresentatives,
  componentFromText,
  decisionFromCandidate,
  dedupe,
  evidenceMetadata,
  fetchUrlForContent,
  isSourceChangeEventCandidate,
  newsletterDateWindowEnd,
  normalizeCandidate,
  parseHtmlPage,
  parseRss,
  renderCandidateMarkdown: markdown,
  resolveLinkedReleaseNoteEvidenceItems,
  withinLookback
};
