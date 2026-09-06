const fs = require('fs');
const path = require('path');
const {
  decodeHtml,
  kstDate,
  readJson,
  writeJson
} = require('../common/common');
const {
  collectedNewsDir,
  newsroomDir
} = require('../common/artifact-paths');
const {
  CANDIDATE_SCHEMA_VERSION,
  writeManualCandidateArtifacts
} = require('../common/candidate-artifacts');
const { parseManualSourceUrls } = require('../collect/collection-intent');
const { ensureArray } = require('../common/value-coercion');
const { readRuntimeConfig, resolveRunMode } = require('../common/runtime-config');
const {
  displayDate,
  monthRangeOverlapsWindow,
  resolveCandidateDateEvidence
} = require('../common/date-signals');
const { coverageForAnchorDate, classifyCoverageWindow } = require('../common/coverage-week');
const { loadCarryForward, resolveCarryForwardStatus } = require('../collect/carry-forward');
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
  shouldSuppressGenericFallback,
  sourceIdsRequiringFetchClient
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
  BUCKETS,
  STRONG_CAMERA_DRIVER_PATTERNS,
  classifyAospCameraStackCandidate,
  detectNativeAndroidToolingWorkflow
} = require('../domain/aosp-camera-scope');
const {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  NATIVE_TOOLING_WORKFLOW_TYPE,
  loreSeriesKey,
  seriesPatchNumber,
  seriesRerollVersion,
  seriesSubjectKey,
  titleKey
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
  fetchUrlForContent,
  normalizeUrl
} = require('../collect/source-intelligence-utils');
const {
  commitSourceSnapshotWrites,
  filterSnapshotWritesByIncludedEvidenceIds,
  runSourceMonitor
} = require('../collect/source-monitor');
const {
  accrueDeepDiveTopicsFromCollect
} = require('../collect/deep-dive-topic-accrual');
const {
  createBoundedFetchClient,
  MAX_BYTES_PER_INDEX_PAGE,
  MAX_BYTES_PER_SOURCE_RUN
} = require('../collect/bounded-fetch-client');
// 사유 어휘·kind 어휘의 정본은 resolver 모듈이다. 여기서 복제하면 두 목록이 갈라지고,
// 갈라진 쪽이 조용히 'unknown'으로 떨어진다.
const {
  DATED_ARTICLE_DIAGNOSTIC_KINDS,
  FAIL_CLOSED_REASONS
} = require('../collect/dated-article-index-resolver');

// 소스 id 목록을 여기서 또 하드코딩하지 않는다. followed-source-item-resolvers.js 레지스트리의
// requiresFetchClient 마커가 정본이다 — 새 dated-article 소스를 레지스트리에 등록하면서 이
// 목록에 추가하는 걸 잊는 사고(등록은 됐는데 client가 안 만들어져 resolver가 guard에서 조용히
// []를 돌려주는 실패)를 구조로 막는다.
function usesDatedArticleResolver(source) {
  return sourceIdsRequiringFetchClient().includes(String(source?.id || ''));
}

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const structuredSourcesPath = path.join(root, 'src', 'shared', 'data', 'news-sources.json');
const legacySourcesPath = path.join(root, 'docs', 'NEWS_SOURCES.md');
const AUDIENCE = 'AOSP Camera / Camera Driver / SoC Platform / C++ engineer';

// Final candidate pool handed to the newsroom. A per-source cap keeps a single
// high-volume source (e.g. an Android Developers Blog roundup that explodes into
// many child topics) from monopolizing the pool and evicting lower-ranked but
// useful camera-driver / V4L2 / libcamera / ISP leads before the slice.
const MAX_FINAL_CANDIDATES = 40;
const MAX_CANDIDATES_PER_SOURCE = 8;

// coverage 경계 밖([E, U))에서 분리해 다음 실행 carry-forward로 넘기는 목록의 상한. 소스가
// 폭주해도 collect payload가 무한정 커지지 않게 건수와 바이트 양쪽에 상한을 둔다.
const NOT_YET_ELIGIBLE_MAX_COUNT = 60;
const NOT_YET_ELIGIBLE_MAX_BYTES = 262144;
const NOT_YET_ELIGIBLE_OVERFLOW_REL_PATH = path.join('.tmp', 'not-yet-eligible-full.json');

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
// #976: revert는 커널·libcamera에서 흔한 변경 형태다. 이 어휘가 없으면 실제 동작 변경을 서술한
// 되돌림 릴리스가 근거 미달로 떨어지고, 아무 사실도 말하지 않는 템플릿 문장이 `release` 한 단어로
// 대신 통과하는 역전이 생긴다.
const BEHAVIOR_CHANGE_PATTERN = /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|remove(?:d|s)?|revert(?:ed|s)?|deprecat(?:ed|es)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|migrat(?:ed|es|ion)|accelerat(?:e|ed|es|ing)|build(?:s|ing)?|test(?:s|ing)?|debug(?:s|ging)?|profil(?:e|ed|es|ing)|stable|security|vulnerability|CVE|bulletin|release(?:d|s)?|compatibility|requirement|API|behavior)\b/i;

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
    // lore 시리즈 조각을 collapseSeriesRepresentatives가 대표 1건으로 묶을 수 있게 시리즈 키를
    // 파생한다. 파서는 선정 단계와 같은 단일출처(article-groups loreSeriesParts: 자기 message-id
    // 우선, 답장만 부모 폴백, 버전 토큰 선택적)를 재사용한다. 비-lore URL은 null.
    seriesId: loreSeriesKey({ url: link, in_reply_to: inReplyTo }) || null,
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

// lore(public-inbox) 답장(Re:)은 시리즈의 리드가 될 수 없으므로 후보에서 제외한다.
function isLoreReplyItem({ url, title } = {}) {
  return /^https?:\/\/lore\.kernel\.org\//i.test(String(url || '')) &&
    /^\s*re\s*:/i.test(String(title || ''));
}

function parseRss(xml, source) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.flatMap(block => {
    const parentRaw = rssParentRawItem(block, source);
    // lore 답장(Re:)은 후보로 만들지 않는다 — 답장이 캡 슬롯/reserve를 차지하는 것을 막는다
    // (2026-W31 실측: reserve 3석 중 2석이 Re: 답장). 원본 패치는 같은 제목 토큰으로 검색
    // 피드에 함께 들어오므로 창 안 시리즈의 신호는 유지된다.
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

// 동작 변경 문장을 뽑을 때 쓰는 문장 분할기다. 템플릿 표식 비교도 같은 분할기를 쓴다(#976).
function splitSentences(value) {
  return String(value || '')
    .split(/(?<=[.!?])\s+|[•\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function firstBehavior(value) {
  const sentences = splitSentences(value);
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

// #976: 수집기가 출처 본문 대신 채워 넣은 템플릿 문장인지 판정한다. 표식(collector_template_sentence)이
// 필드 이름이 아니라 문장 텍스트인 이유는, 같은 문장이 behavior_change로도 summary로도 흘러오기
// 때문이다. 표식을 다는 쪽은 그 문장을 만든 수집기다.
//
// 표식 전체 문장뿐 아니라 splitSentences로 쪼갠 조각과도 비교한다. behavior_change 후보 중 하나는
// firstBehavior가 돌려주는 값인데, firstBehavior의 반환값은 언제나 입력을 같은 분할기로 쪼갠 조각
// 하나다. 릴리스 이름은 자유 텍스트라 마침표가 들어가면 템플릿이 두 문장으로 갈리고, 그러면 전체
// 문장 비교만으로는 조각이 표식을 빠져나간다.
function collectorTemplateTexts(raw) {
  const template = String(raw?.collector_template_sentence || '').trim();
  if (!template) return [];
  return [template, ...splitSentences(template)].map(text => text.replace(/\s+/g, ' ').trim());
}

function isCollectorTemplateSentence(templateTexts, value) {
  if (!templateTexts.length) return false;
  return templateTexts.includes(String(value || '').replace(/\s+/g, ' ').trim());
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
  // 동작 변경 문장의 후보 순서는 종전과 같다(raw 필드 → summary/title에서 뽑은 첫 문장 → tooling 문장).
  const behaviorChangeTexts = [
    raw.behavior_change,
    firstBehavior(summary || title),
    toolingEvidence.eligible ? 'Official Android tooling article describes native Android app workflow behavior.' : ''
  ].map(value => String(value || ''));
  const behaviorChange = (behaviorChangeTexts.find(value => value) || '').trim();
  // #976: 수집기가 만든 템플릿 문장은 출처가 말한 사실이 아니므로 동작 변경 근거로 세지 않는다.
  // 수집기가 collector_template_sentence로 그 문장을 표식해 주면 여기서 건너뛰고 다음 후보 문장을
  // 본다. 본문이 없는 릴리스는 summary도 같은 문장이라, 표식과 그 문장 조각들이 raw 필드와
  // firstBehavior 칸을 함께 걸러 낸다.
  // 표식이 없는 후보의 판정 경로는 그대로다 — 어휘 패턴은 건드리지 않았다.
  const templateTexts = collectorTemplateTexts(raw);
  const behaviorChangeEvidence = (behaviorChangeTexts
    .find(value => value && !isCollectorTemplateSentence(templateTexts, value)) || '').trim();
  // 정본이 판정한다. raw.published_date/publishedAt/published_at 중 실제로 파싱되는 값만
  // "발행일 있음"으로 인정한다(resolveCandidateDateEvidence가 못 읽으면 effective_date로
  // 넘어가는데, 여기서는 그것도 publish_ready_date_evidence 기준으로 함께 본다).
  const hasPublishedDate = resolveCandidateDateEvidence(raw).publish_ready_date_evidence;
  const hasVersionOrRelease = Boolean(versionOrRelease);
  const hasApiOrComponent = Boolean(apiOrComponent);
  const hasBehaviorChange = Boolean(behaviorChangeEvidence && hasBehaviorChangeForRaw(raw, behaviorChangeEvidence));
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
    // AOSP 릴리스 드롭에서 camera 경로를 건드린 커밋 수. 코드의 경로 정규식과 페이지 상한에서
    // 파생된 값이라 후보 제목에 넣지 않고 여기에 둔다(#857). whitelist에 없으면 candidates.json에서
    // 사라져 "제목이 아니라 메타데이터로 옮겼다"는 말이 산출물에서 거짓이 된다.
    camera_path_commit_count: raw.camera_path_commit_count ?? null,
    camera_path_commit_count_is_lower_bound: raw.camera_path_commit_count_is_lower_bound ?? null,
    // Gerrit 변경의 정체성(#1033). Change-Id는 patchset을 갱신해도, 리베이스해도 그대로인 유일한
    // 식별자이고 commit SHA는 그 시점의 리비전이다. 둘 다 whitelist에 없으면 candidates.json에서
    // 사라져, 릴리스 드롭이 같은 변경을 실어 왔는지 선정 단계가 판단할 근거를 잃는다.
    gerrit_change_id: raw.gerrit_change_id || '',
    gerrit_change_number: raw.gerrit_change_number ?? null,
    gerrit_change_status: raw.gerrit_change_status || '',
    gerrit_commit_sha: raw.gerrit_commit_sha || '',
    gerrit_effective_date_field: raw.gerrit_effective_date_field || '',
    // 릴리스 드롭 후보가 실어 오는 Change-Id·commit SHA 목록. Gerrit 후보와 같은 변경인지 여기서만
    // 알 수 있다(드롭 후보는 저장소당 집계 1건이라 제목·URL로는 겹치지 않는다).
    covered_gerrit_change_ids: ensureArray(raw.covered_gerrit_change_ids),
    covered_commit_shas: ensureArray(raw.covered_commit_shas),
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
    // 수집기가 출처 본문 대신 채워 넣은 문장(#976). 동작 변경 근거 판정이 이 문장과 그 문장 조각을
    // 근거에서 빼므로, 표식이 후보 JSON에 남지 않으면 왜 has_behavior_change가 false인지 산출물만
    // 보고는 알 수 없다. 값을 만든 쪽은 수집기이므로 metadata가 아니라 raw에서 읽는다.
    collector_template_sentence: String(raw.collector_template_sentence || ''),
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
    // 날짜 정본이 두 번째로 보는 필드들. 화이트리스트에 없으면 정규화 단계에서 사라져
    // withinLookback/withinPrimarySelectionWindow와 선정 단계가 목록 fallback 후보의
    // 날짜를 영영 못 본다.
    //
    // 여기 실을 수 있는 것은 raw가 실제로 측정해 온 값뿐이다. resolveCandidateDateEvidence가
    // 돌려주는 date_source는 못 찾았을 때 'visible_date'/'missing'으로 메운 기본값이라,
    // 그걸 후보 레코드에 굳히면 측정하지 않은 출처를 후보가 주장하게 된다. 실제로
    // deep-dive-topic-accrual.candidateDateFields는 candidate.date_source가 있으면 그대로
    // 믿고 신뢰도를 표에서 뽑으므로, 기본값 'visible_date'가 심층 큐 state에 신뢰도 100으로
    // 굳는다(실측 32일 강등 후보 44건 전부 0→100). 파생값은 읽는 쪽이 정본으로 다시 구한다.
    //
    // 날짜 문자열은 displayDate로만 옮긴다. normalizeDate는 'August 14, 2026'을 로컬 자정으로
    // 해석해 Asia/Seoul에서 하루 앞당기고(실측 -> '2026-08-13'), '2026-08'을 '2026-08-01'로
    // 조작한다. 아는 형식이 아니면 ''를 돌려 날짜를 지어내지 않는다.
    effective_date: displayDate(raw.effective_date || raw.effectiveDate),
    date_source: String(raw.date_source || raw.dateSource || ''),
    date_confidence: Number(raw.date_confidence || raw.dateConfidence || 0),
    // normalizeUrl이 http(s)가 아니거나 파싱 불가한 값을 ''로 만든다. canonicalContentUrl만
    // 쓰면 '/blog'나 'javascript:...'가 그대로 통과해 근거 URL 자리에 실린다(실측).
    date_evidence_url: canonicalContentUrl(normalizeUrl(raw.date_evidence_url || raw.dateEvidenceUrl || '')),
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

// 창 계산에 쓸 시각. 어느 필드를 볼지는 정본이 정하고, 시각은 그 필드의 원문에서 읽는다.
// 원문을 먼저 읽는 이유는 타임스탬프를 살리기 위해서다(정본이 돌려주는 date는 YYYY-MM-DD로
// 잘려 있어, publishedAt '2026-08-22T20:00:00-08:00'처럼 실제 UTC가 하루 뒤인 값이 창
// 경계에서 밀린다).
//
// 폴백이 필요한 이유: 정본은 normalizeDate로 문자열 안의 ISO 날짜를 정규식으로 뽑아내지만
// parseDate는 new Date()라, 'Posted on 2024-01-05 by staff' 같은 값은 정본만 날짜로 읽는다.
// 폴백이 없으면 withinPrimarySelectionWindow의 가드는 "날짜 있음"으로 통과시키고
// withinLookback은 "날짜 없음"으로 무조건 통과시켜, 2년 지난 후보가 이번 주 창 가점을 받는다.
function candidateWindowDate(candidate) {
  const evidence = resolveCandidateDateEvidence(candidate);
  if (!evidence.date) return null;
  if (evidence.date_field === 'published_date') {
    return parseDate(candidate.published_date || candidate.publishedAt || candidate.published_at) ||
      parseDate(evidence.date);
  }
  return parseDate(evidence.date);
}

function withinLookback(candidate, now, lookbackDays) {
  // source_change_event lane의 effective_date는 "발행일"이 아니라 "문서 변경 유효일"이라
  // 몇 달 전 값이 들어온다(실측 2026-06-18 CameraX: 감지는 이번 주, 릴리스 행 날짜는 3개월 전).
  // 이 lane을 창으로 자르면 같은 문서 변경이 매주 재발화·재탈락하는 기아 루프가 된다.
  // 지금까지는 publishedAt이 항상 ''라 우연히 통과하던 것을 명시로 바꾼다.
  if (isSourceChangeEventCandidate(candidate)) return true;
  const date = candidateWindowDate(candidate);
  if (!date) return true;
  const windowEndMs = now.getTime();
  const windowStartMs = windowEndMs - lookbackDays * DAY_MS;
  const precision = String(candidate.datePrecision || candidate.date_precision || '').toLowerCase();
  if (precision === 'month') {
    return monthRangeOverlapsWindow(date, windowStartMs, windowEndMs);
  }
  const candidateMs = date.getTime();
  return candidateMs >= windowStartMs && candidateMs <= windowEndMs;
}

// 소스당 캡(MAX_CANDIDATES_PER_SOURCE)은 lookback 35일 풀에 걸리는데 정렬에 최신성 항이 없어서,
// lore처럼 한 주에 수십 건이 올라오는 메일링 리스트에서는 지난 주 후보가 이번 주 신호를 밀어냈다
// (2026-08-03 W32 실측: 라이브 피드에 창 안 비-답장 카메라 신호가 75건 있었는데 수집은 8건이고
// 그중 3건이 07-24~07-26 항목, 그 결과 R-Car ISP 확장 uAPI·CAMSS 하드웨어 버전 보고·uvcvideo quirk가
// 통째로 잘렸다). 같은 우선순위/신뢰도 안에서 primary selection window 후보를 앞세워 캡이 이번 주
// 신호부터 채우게 한다. 창 밖 후보를 버리지는 않으므로 catch-up lane이 쓸 재고는 그대로 남는다.
//
// 읽을 날짜가 없는 후보는 이 가점에서 제외한다. withinLookback은 날짜를 못 읽으면 true를
// 돌려주는데, 그건 수집 풀 필터(35일)에서 "날짜 없다고 버리지는 않는다"는 뜻이지 "이번 주
// 신호다"라는 뜻이 아니다. 그대로 랭킹에 쓰면 문서형 소스가 만든 nodate 페이지-제목 후보가
// 창 안 후보와 같은 등급을 받아, priority/reliability가 같은 dated 카메라 신호를 앞선다.
//
// source_change_event 후보는 가드 밖에 둔다. 이 lane은 날짜를 publishedAt이 아니라
// effective_date에 담아서(source-monitor.js: publishedAt은 항상 '', datePrecision은
// effective_date가 있을 때만 'day') publishedAt만 보면 "날짜 없음"으로 오판한다. 게다가 최종
// 후보로 살아남은 source_change_event의 evidence_id만 처리됨으로 적립되므로(아래 스냅샷 커밋
// 참조), 여기서 강등돼 전역 캡에 잘리면 같은 문서 변경 이벤트가 매주 재발화하면서 매주 다시
// 잘리는 기아 루프가 된다. 이 lane의 순위는 이번 변경으로 달라지지 않는다.
//
// 가점만 빼고 후보는 풀에 그대로 남는다 — 35일 풀 필터(아래 withinLookback 호출)는 건드리지
// 않는다. 다만 전역 캡(MAX_FINAL_CANDIDATES)은 그 뒤에 한 번 더 걸리므로, 순위가 밀린 nodate
// 후보가 최종 후보 파일에서 빠질 수는 있다.
//
// primary 판정은 coverage-week.js의 classifyCoverageWindow로 통일한다 — "이번 주 신호"는
// now로부터 뒤로 며칠이 아니라, coverage 주(직전 완결 ISO 주) 안(0~6일)인지로 정의된다.
// source_change_event 후보는 여전히 가드 밖에 둔다: publishedAt이 항상 빈 문자열이라
// classifyCoverageWindow가 이 후보를 절대 'primary'로 분류할 수 없으므로, 위 주석이 설명하는
// "이 lane의 순위는 이번 변경으로 달라지지 않는다"를 지키려면 무조건 true를 유지해야 한다.
//
// 분류에 넘기는 날짜는 raw publishedAt이 아니라 날짜 정본이 읽어낸 값이다. publishedAt만 보면
// 목록 fallback 후보(effective_date만 있고 publishedAt은 '')가 이 가드에서 영영 막힌다.
// 정본은 publishedAt/published_date/effective_date를 정해진 우선순위로 보므로, raw publishedAt
// 대비 판정이 넓어지는 경우는 (a) publishedAt이 없고 effective_date가 있는 후보와
// (b) publishedAt이 new Date()로는 못 읽히지만 정본의 정규식은 읽어내는 후보뿐이다.
// 날짜 문자열(YYYY-MM-DD)을 넘기는 것으로 충분하다 — coverage 분류는 일 단위다.
function withinPrimarySelectionWindow(candidate, coverage) {
  if (isSourceChangeEventCandidate(candidate)) return true;
  const evidence = resolveCandidateDateEvidence(candidate);
  if (!evidence.date) return false;
  return classifyCoverageWindow(evidence.date, coverage) === 'primary';
}

// coverage를 생략한 호출부(테스트 포함)를 위해 now의 날짜를 anchor로 삼아 기본 coverage를
// 계산한다. main()은 override(coverageWeekKeyOverride)를 반영한 coverage를 명시적으로 넘긴다.
function candidateRankOrder(now, coverage = coverageForAnchorDate(now.toISOString().slice(0, 10))) {
  return (a, b) => {
    const priorityDelta = (PRIORITY_WEIGHT[b.source_priority] || 0) - (PRIORITY_WEIGHT[a.source_priority] || 0);
    const reliabilityDelta = (RELIABILITY_WEIGHT[b.source_reliability] || 0) - (RELIABILITY_WEIGHT[a.source_reliability] || 0);
    const primaryWindowDelta = Number(withinPrimarySelectionWindow(b, coverage)) -
      Number(withinPrimarySelectionWindow(a, coverage));
    return priorityDelta || reliabilityDelta || primaryWindowDelta || b.relevanceScore - a.relevanceScore;
  };
}

// dedupe 직후·cap 이전에 coverage 경계 밖([E, U)) 후보를 떼어낸다. 이번 호 대상이 아니므로
// 소스별/전역 캡에 끼어 이번 주 신호를 밀어내면 안 되고, 다음 실행이 carry-forward로 읽을 수
// 있게 원시 재평가 payload 그대로 보존한다. source_change_event 후보는 publishedAt이 항상
// 빈 문자열이라 classifyCoverageWindow가 이미 'not_yet_eligible'로 분류하지 않지만, 이
// lane(source-monitor.js가 만드는 evidence_id 적립 후보)의 순위가 절대 이번 변경으로
// 흔들리면 안 되므로 명시적으로도 분리 대상에서 뺀다(위 withinPrimarySelectionWindow
// 주석 참조).
function partitionByCoverageEligibility(candidates, coverage, now, lookbackDays) {
  const notYetEligible = [];
  const currentCoveragePool = [];
  for (const item of candidates) {
    // raw publishedAt이 아니라 날짜 정본이 읽어낸 값을 분류에 넘긴다(위 withinPrimarySelectionWindow
    // 주석과 같은 이유). 목록 fallback 레인(dated-article-index-resolver.js)은 개별 페이지가 날짜를
    // 못 주면 publishedAt을 ''로 두고 목록 날짜를 effective_date에만 담는다. raw publishedAt만 보면
    // classifyCoverageWindow('')가 'unknown'을 돌려줘 절대 'not_yet_eligible'이 될 수 없고, coverage
    // 주 이후에 발행된 신호가 이번 호 대상 풀로 새어 들어간다.
    const evidence = resolveCandidateDateEvidence(item);
    const isNotYetEligible = !isSourceChangeEventCandidate(item) &&
      withinLookback(item, now, lookbackDays) &&
      classifyCoverageWindow(evidence.date, coverage) === 'not_yet_eligible';
    if (isNotYetEligible) {
      notYetEligible.push(item);
    } else {
      currentCoveragePool.push(item);
    }
  }
  return { notYetEligible, currentCoveragePool };
}

// 정렬도 같은 이유로 raw publishedAt이 아니라 날짜 정본을 읽는다 — 목록 fallback 후보는
// publishedAt이 항상 ''라 Date.parse('')가 두 후보 모두 NaN을 주고, NaN 비교는 항상
// true(NaN !== NaN)라 aTime - bTime이 NaN이 되어 정렬이 입력 순서에 발이 묶인다(안정 정렬이라
// 우연히 크래시는 안 나지만 날짜순 정렬이라는 계약이 조용히 깨진다).
function compareNotYetEligible(a, b) {
  const aTime = Date.parse(resolveCandidateDateEvidence(a).date);
  const bTime = Date.parse(resolveCandidateDateEvidence(b).date);
  if (aTime !== bTime) return aTime - bTime;
  return String(a.url || '').localeCompare(String(b.url || ''));
}

// 정렬(publishedAt 오름차순, 동률 url 사전순) 후 건수(60)·바이트(262144, JSON.stringify 기준)
// 양쪽 상한을 적용한다. 상한을 넘는 쪽만 잘라내므로 committed는 항상 정렬된 전체 목록의 접두어다.
function capNotYetEligible(notYetEligible) {
  const full = [...notYetEligible].sort(compareNotYetEligible);
  let committed = full.slice(0, NOT_YET_ELIGIBLE_MAX_COUNT);
  while (committed.length > 0 && Buffer.byteLength(JSON.stringify(committed), 'utf8') > NOT_YET_ELIGIBLE_MAX_BYTES) {
    committed = committed.slice(0, committed.length - 1);
  }
  return {
    full,
    committed,
    overflow: committed.length < full.length
  };
}

// 상한을 넘겼을 때만 전체 목록을 .tmp에 남긴다(미커밋 — 다음 실행의 참고용 진단 산출물).
// 정상 경로(상한 안)는 payload.not_yet_eligible 자체가 이미 전체 목록이라 별도 파일이 불필요하다.
function writeNotYetEligibleOverflowIfNeeded(rootDir, capResult) {
  if (!capResult.overflow) return;
  writeJson(path.join(rootDir, NOT_YET_ELIGIBLE_OVERFLOW_REL_PATH), capResult.full);
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
// 대표 1건으로 collapse해, 시리즈가 캡에 대해 하나의 후보로 경쟁하게 한다. 대표의 캡 경쟁
// 순위는 first-seen(rank 최상위 조각)의 자리를 쓰되, 내용은 patch 번호가 가장 낮은 조각
// (커버레터 0/N이 시리즈 개요를 담아 capsule/선정 입력 품질이 가장 좋다)으로 채운다.
// seriesId가 없는 후보(대부분의 소스)는 그대로 통과하므로 다른 소스 동작에는 영향이 없다.
function collapseSeriesRepresentatives(candidates) {
  const seenSeries = new Map();
  const collapsed = [];
  for (const item of candidates) {
    const seriesId = item.seriesId ?? item.series_id;
    if (seriesId !== undefined && seriesId !== null && seriesId !== '') {
      const key = `${item.source_id || item.source || ''}::${seriesId}`;
      if (seenSeries.has(key)) {
        const index = seenSeries.get(key);
        if (seriesPatchNumber(item) < seriesPatchNumber(collapsed[index])) collapsed[index] = item;
        continue;
      }
      seenSeries.set(key, collapsed.length);
    }
    collapsed.push(item);
  }
  return collapseSeriesRerolls(collapsed);
}

// 시리즈 re-roll(v1 -> v2 재제출)은 patchwork series id도 lore message-id도 새로 발급받아
// 위 (source, seriesId) collapse를 그대로 통과한다(#824 실측: 2026-W31 patchwork 8슬롯 중
// 4개가 같은 신호의 v1/v2 중복). 시리즈 후보 대표들끼리 브래킷 접두부([PATCH v2 3/6],
// [RFC,v2,1/1] 등)를 뗀 제목이 정확히 같으면 같은 논리 시리즈로 병합한다. 캡 경쟁 자리는
// first-seen 슬롯을 유지한다(위 collapse와 같은 원칙). 제목을 고쳐 재제출한 시리즈는
// 의도적으로 병합하지 않는다 — 퍼지 매칭의 오병합 위험이 슬롯 중복보다 나쁘다(실측된
// 한계 사례: Tegra VI RFC v2가 subject에 "tegra:" prefix를 추가해 미병합).
// 브래킷 접두부 파싱(seriesSubjectKey·seriesRerollVersion)은 article-groups가 정본이다.
// 재게재 게이트가 같은 재제출 축을 봐야 하므로 사본을 두지 않는다(#1036).

// re-roll 병합의 대표 선택: #822가 세운 커버레터 우선(낮은 patch 번호 = 시리즈 개요를 담아
// capsule/선정 입력 품질이 가장 좋다)을 버전 경계 너머로도 유지한다 — patch 번호가 더 낮은
// 대표가 이기고, 같으면 최신 버전이 이긴다. 최신 버전의 커버레터가 피드 창에서 밀려나
// 조각만 남은 실측 사례(2026-07-20 series 6049가 4조각에서 5/6 단일 조각으로 축소)에서,
// 구버전에 살아 있는 커버레터를 버리지 않기 위한 규칙이다.
function shouldPreferRerollRepresentative(item, kept) {
  const itemPatchNumber = seriesPatchNumber(item);
  const keptPatchNumber = seriesPatchNumber(kept);
  if (itemPatchNumber !== keptPatchNumber) return itemPatchNumber < keptPatchNumber;
  return seriesRerollVersion(item) > seriesRerollVersion(kept);
}

function collapseSeriesRerolls(candidates) {
  const seenSubjects = new Map();
  const result = [];
  for (const item of candidates) {
    const seriesId = item.seriesId ?? item.series_id;
    const isSeriesCandidate = seriesId !== undefined && seriesId !== null && seriesId !== '';
    const subject = isSeriesCandidate ? seriesSubjectKey(item) : '';
    if (subject) {
      const key = `${item.source_id || item.source || ''}::${subject}`;
      if (seenSubjects.has(key)) {
        const index = seenSubjects.get(key);
        if (shouldPreferRerollRepresentative(item, result[index])) result[index] = item;
        continue;
      }
      seenSubjects.set(key, result.length);
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

// 수집 진단(dated_article_collection)을 사람이 여는 표면까지 올린다. 진단은 후보 artifact에만
// 남아 있어서, 목록 마크업이 바뀌어 카드가 0장 파싱된 주에도 보고서에는 아무 흔적이 없었다.
// 그러면 마크업 파손과 "이번 주 신규 없음"이 보고서상 완전히 같은 모양이 된다(#945).
//
// 값이 없으면 절을 통째로 생략한다. 렌더는 절대 throw하면 안 된다 — 여기서 죽으면 진단을
// 보여주려던 변경이 그날 수집 자체를 날린다.
function datedArticleCollectionSectionLines(datedArticleCollection, candidates) {
  const lines = [];
  const kindCounts = datedArticleCollection.kind_counts || {};
  const articleCapCountsBySource = datedArticleCollection.article_cap_counts_by_source || {};
  const receivedBytesBySource = datedArticleCollection.received_bytes_by_source || {};

  // 0건 kind는 적지 않는다. 여섯 kind 중 다섯이 늘 0이라 전부 적으면 실제로 난 사건이 묻힌다.
  const nonZeroKindCounts = Object.entries(kindCounts).filter(([, count]) => Number(count) > 0);
  // 행은 두 맵의 합집합으로 잡는다. 인덱스 fetch가 예산에 걸리면 fetchSourceIndexText가
  // throw해 resolver까지 못 가므로 cap 카운터 키가 아예 안 생기고, 수신량만 finally로 남는다
  // (skipped_index_budget). cap 키만 기준으로 좁히면 정작 예산에 막힌 소스가 표에서 통째로
  // 사라져, 이 절이 보여주려던 실패가 다시 안 보이게 된다.
  const diagnosticSourceIds = [...new Set([
    ...Object.keys(articleCapCountsBySource),
    ...Object.keys(receivedBytesBySource)
  ])].sort();
  if (nonZeroKindCounts.length === 0 && diagnosticSourceIds.length === 0) return lines;

  // collected_count는 최종 후보에서 센다. "이 소스가 0건"이 한눈에 보여야 상한 때문에 줄어든
  // 것인지 목록 자체를 못 읽은 것인지가 같은 줄에서 갈린다.
  const collectedCountBySource = {};
  for (const item of candidates) {
    const sourceId = String(item.source_id || '');
    collectedCountBySource[sourceId] = (collectedCountBySource[sourceId] || 0) + 1;
  }

  function counterCell(value) {
    return value === undefined || value === null ? '-' : mdEscape(value);
  }

  lines.push('## 날짜 결속 수집 진단');
  lines.push('');
  if (diagnosticSourceIds.length > 0) {
    lines.push('| Source | collected_count | in_window_card_count | scheduled_article_count | skipped_article_cap_count | received_bytes |');
    lines.push('|---|---|---|---|---|---|');
    for (const sourceId of diagnosticSourceIds) {
      const articleCapCounts = articleCapCountsBySource[sourceId] || {};
      lines.push(`| ${mdEscape(sourceId)} | ${collectedCountBySource[sourceId] || 0} `
        + `| ${counterCell(articleCapCounts.in_window_card_count)} `
        + `| ${counterCell(articleCapCounts.scheduled_article_count)} `
        + `| ${counterCell(articleCapCounts.skipped_article_cap_count)} `
        + `| ${counterCell(receivedBytesBySource[sourceId])} |`);
    }
    lines.push('');
  }
  if (nonZeroKindCounts.length > 0) {
    lines.push('진단 건수(0건 kind는 생략):');
    lines.push('');
    for (const [kind, count] of nonZeroKindCounts) {
      lines.push(`- ${mdEscape(kind)}: ${mdEscape(count)}`);
    }
    lines.push('');
  }
  return lines;
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

  // index_collection_failed는 resolver가 throw하지 않고 빈 배열만 돌려주므로 failures에 안 들어온다.
  // 실패 절에 같이 실어야 "목록을 못 읽었다"가 "후보가 없었다"와 같은 무게로 보인다.
  const datedArticleCollection = options.datedArticleCollection || {};
  const datedArticleEvents = Array.isArray(datedArticleCollection.events) ? datedArticleCollection.events : [];
  const indexCollectionFailures = datedArticleEvents.filter(event => event.kind === 'index_collection_failed');

  lines.push('## Collector 실패');
  lines.push('');
  if (failures.length === 0 && indexCollectionFailures.length === 0) {
    lines.push('- 없음');
  } else {
    for (const failure of failures) {
      lines.push(`- ${failure.source}: ${failure.message}`);
    }
    for (const event of indexCollectionFailures) {
      lines.push(`- index_collection_failed: ${mdEscape(event.url || '')} - ${mdEscape(event.detail || '')}`);
    }
  }
  lines.push('');
  lines.push(...datedArticleCollectionSectionLines(datedArticleCollection, candidates));
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

// 수집 산출물(후보 artifact·raw 매니페스트·후보 markdown·날짜 파일·모니터 스냅샷)을 전부
// 디스크에 기록한 뒤에 심층(deep-dive) 주제 큐를 적립한다. 이 순서 자체가 계약이다.
//
// 이유: 적립은 선택 부가 기능인데 큐 파일이 손상되면 그대로 throw한다(구현 오류를 콘텐츠
// 실패로 위장하지 않는다는 불변식 3). 적립을 먼저 부르면 그 throw 하나로 그날의 후보·
// 매니페스트·진단이 통째로 디스크에 남지 않는다 — 적립과 아무 상관 없는 수집 결과까지
// 같이 사라진다. 그래서 throw는 그대로 두고(시끄러워야 한다) 순서만 뒤집는다. 산출물이
// 이미 기록된 뒤라 구현 오류가 그날의 수집 결과를 데려가지 못한다.
function writeCollectArtifactsThenAccrueDeepDiveTopics({
  root,
  date,
  candidatePayload,
  failures,
  lookbackDays,
  sourceCount,
  generatedAt,
  sourceMonitorResult,
  manualSourceUrls = '',
  collectionIntentPath = ''
}) {
  const candidates = candidatePayload.candidates;
  const dateNewsroomDir = newsroomDir(root, date);
  fs.mkdirSync(dateNewsroomDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });

  writeManualCandidateArtifacts({
    root,
    date,
    payload: candidatePayload,
    sourceCount,
    manualSourceUrls,
    collectionIntentPath,
    generatedAt,
    workflow: 'manual-source-collection-pr'
  });
  fs.writeFileSync(
    path.join(dateNewsroomDir, 'news-candidates.md'),
    markdown(date, candidates, failures, lookbackDays, {
      datedArticleCollection: candidatePayload.dated_article_collection
    }),
    'utf8'
  );
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

  const deepDiveAccrual = accrueDeepDiveTopicsFromCollect({
    root,
    date,
    candidates,
    monitorResult: sourceMonitorResult
  });
  console.log(`Deep-dive queue: +${deepDiveAccrual.accruedFingerprintCount} fingerprints, ${deepDiveAccrual.queueSize} topics`);
  return deepDiveAccrual;
}

// 목록 fetch는 collector가, 기사 fetch와 fail-closed 판정은 resolver가 소유한다.
// 두 곳이 같은 콜백을 받아야 여섯 kind가 한 배열에 모인다. 각자 만들면
// skipped_index_budget이 요약에서 통째로 빠진다.
//
// 누적 바이트도 여기에 모은다. 소스가 예외로 끝나도 collectFromSource의 finally가
// recordSourceBytes를 부르므로, 예산 초과로 실패한 소스의 수신량이 요약에 남는다.
//
// 기사 상한(article cap) 카운터도 같은 이유로 여기 모은다 — 상한 도달은 사건(kind)이
// 아니라 소스별 스칼라이므로 recordSourceBytes/receivedBytesBySource와 같은 모양으로 둔다.
function createSourceCollectionDiagnostics() {
  const events = [];
  const bytesBySource = {};
  const articleCapCountsBySource = {};
  return {
    record(event) { events.push({ ...event }); },
    recordSourceBytes(sourceId, bytes) { bytesBySource[String(sourceId)] = Number(bytes) || 0; },
    recordArticleCapCounts(sourceId, counts) { articleCapCountsBySource[String(sourceId)] = { ...counts }; },
    events() { return events.slice(); },
    receivedBytesBySource() { return { ...bytesBySource }; },
    articleCapCountsBySource() { return { ...articleCapCountsBySource }; }
  };
}

// 목록도 예산 안에서 받아야 maxBytesPerIndexPage가 실제로 강제된다.
// 다만 전역 fetchText를 바꾸면 다른 기존 소스의 수집 결과가 달라지므로
// dated-article resolver를 쓰는 두 소스에만 적용한다.
//
// fetchTextImpl을 인자로 받는다. 전역 fetchText를 직접 부르면 호출자가 주입한 stub이
// 무시돼 dated-article 아닌 소스의 테스트가 실제 네트워크를 탄다.
async function fetchSourceIndexText(target, fetchClient, onDiagnostic, fetchTextImpl = fetchText) {
  if (!fetchClient) return fetchTextImpl(target);
  const response = await fetchClient.fetchBounded(target, { maxBytes: MAX_BYTES_PER_INDEX_PAGE });

  // 판정 순서가 곧 진단의 정확도다. 예산 초과를 먼저 본다 —
  // Task 3은 상한에 걸린 2xx의 ok를 false로 두므로(Step 3 주석 (4)),
  // ok를 먼저 보면 예산 초과가 http 오류로 둔갑한다. 반대로 이 검사를
  // "body가 비었는가"로 두면 404·503·timeout까지 예산 초과로 잡힌다.
  // 예산 진단은 예산을 올려야 고쳐지는 사건에만 붙어야 한다.
  if (response.truncated || response.sourceBudgetExhausted) {
    // 목록 fetch는 resolver 호출 전에 끝난다. 이 사건을 볼 수 있는 것은 collector뿐이므로
    // 여기서 내지 않으면 skipped_index_budget이 어디에도 남지 않는다.
    if (typeof onDiagnostic === 'function') {
      onDiagnostic({
        kind: 'skipped_index_budget',
        url: target,
        receivedBytes: response.receivedBytes || 0,
        limitedBy: response.limitedBy || '',
        detail: `index exceeded the byte budget (status ${response.status}); truncated index is not parsed`
      });
    }
    throw new Error(`skipped_index_budget: ${target}, status ${response.status}`);
  }
  // HTTP/전송 실패는 원래 오류 그대로 올린다.
  if (!response.ok) {
    throw new Error(response.error || `http_${response.status}`);
  }
  // 예산에도 안 걸리고 2xx인데 body가 비었다. '기사 없음'이 아니라 수집 실패다.
  // 빈 인덱스를 파싱하면 후보 0건이 진단 없이 지나간다(리졸버 등록 후에는
  // shouldSuppressGenericFallback이 true라 generic 폴백도 없다).
  if (!response.body) {
    throw new Error(`empty_index_body: ${target}, status ${response.status}`);
  }
  return response.body;
}

async function collectFromSource(source, {
  now,
  lookbackDays,
  fetchTextImpl = fetchText,
  createClient = createBoundedFetchClient,
  onDiagnostic,
  onSourceBytes,
  onArticleCapCounts
} = {}) {
  const feed = sourceFeed(source);
  const target = feed || fetchUrlForContent(source.url);
  // 소스당 client 하나. 인덱스 fetch와 resolver가 같은 객체를 공유해야 6MiB 누적
  // 카운터가 하나로 유지된다. 별도 인스턴스를 만들면 실제로는 최대 12MiB가 흐른다.
  const fetchClient = usesDatedArticleResolver(source)
    ? createClient({ maxBytesPerSourceRun: MAX_BYTES_PER_SOURCE_RUN })
    : null;
  try {
    const text = await fetchSourceIndexText(target, fetchClient, onDiagnostic, fetchTextImpl);
    const indexItems = parseSourceSpecificItems(text, source);
    // 일부 공식 소스는 인덱스 페이지(월별/아카이브 링크)만 연결돼 있어 인덱스 파싱만으로는
    // dated 증거를 못 만든다(source-gap). 최신 상세 페이지를 따라가 dated 후보를 만들고,
    // 만들지 못하면 기존 인덱스 동작을 유지한다.
    // 수집 창(now/lookbackDays)도 함께 넘긴다. 릴리스 드롭처럼 "창 안일 때만 상세를 따라가는"
    // 리졸버가 창을 따로 하드코딩하면 catch-up run(LOOKBACK_DAYS 조정)이나 과거 날짜 재수집에서
    // 파이프라인 창과 어긋나 조용히 누락된다.
    const followedItems = await resolveFollowedSourceItems(source, {
      indexItems,
      text,
      fetchTextImpl,
      fetchClient,
      now,
      lookbackDays,
      onDiagnostic,
      // resolver는 소스를 모른다 — source.id를 아는 것은 여기뿐이므로 카운터를
      // 소스별로 키잉하는 책임은 여기서 진다(recordSourceBytes와 같은 자리).
      onArticleCapCounts: typeof onArticleCapCounts === 'function'
        ? counts => onArticleCapCounts(source.id, counts)
        : undefined
    });
    const sourceSpecificItems = followedItems.length > 0 ? followedItems : indexItems;
    const resolvedSourceSpecificItems = sourceSpecificItems.length > 0
      ? await resolveLinkedReleaseNoteEvidenceItems(sourceSpecificItems, source, { fetchTextImpl })
      : [];
    // followed-resolver 소스는 큐레이션 추출이 비면 신호 없음이므로 제너릭 폴백을 막는다
    // (pipermail/bulletin 인덱스 나비링크를 후보로 만들던 origin).
    const candidates = resolvedSourceSpecificItems.length > 0
      ? resolvedSourceSpecificItems.map(item => normalizeCandidate(item))
      : shouldSuppressGenericFallback(source) ? []
      : feed ? parseRss(text, source) : parseHtmlPage(text, source);
    return { candidates, receivedBytes: fetchClient ? fetchClient.consumedBytes() : 0 };
  } finally {
    // finally인 이유: 인덱스가 예산에 걸리면 fetchSourceIndexText가 throw하고 return에
    // 도달하지 못한다. 그러면 skipped_index_budget이 난 소스가 정작 received_bytes_by_source에서
    // 빠져, "예산을 넘겼다"는 진단과 "0바이트 받았다"는 요약이 서로 모순된다.
    if (fetchClient && typeof onSourceBytes === 'function') {
      onSourceBytes(source.id, fetchClient.consumedBytes());
    }
  }
}

// 설계서 §4.12: 누적 수신 바이트, date_source 분포, 예산 skip 건수, fail-closed 사유별 건수.
// candidates는 dedupe/cap을 지난 최종 후보라 분포도 "살아남은 후보 기준"이다. 그게
// 알고 싶은 값이다 — 수집 직후 분포는 뒤에서 잘려나간 것까지 세어 실제와 어긋난다.
function summarizeDatedArticleCollection({
  events = [],
  candidates = [],
  receivedBytesBySource = {},
  articleCapCountsBySource = {}
} = {}) {
  const kindCounts = {};
  for (const kind of DATED_ARTICLE_DIAGNOSTIC_KINDS) kindCounts[kind] = 0;
  // fail_closed_reasons와 같은 규칙: 어휘 밖 kind를 조용히 버리면(과거 동작) resolver가 새
  // kind를 내기 시작해도 collector 쪽 어휘를 안 맞추면 사건은 나는데 집계는 0으로 남는다.
  kindCounts.unknown = 0;
  const failClosedReasons = {};
  for (const rawEvent of events) {
    const kind = DATED_ARTICLE_DIAGNOSTIC_KINDS.includes(rawEvent.kind) ? rawEvent.kind : 'unknown';
    kindCounts[kind] += 1;
    if (kind !== 'fail_closed') continue;
    // 어휘 밖 사유는 'unknown'으로 정규화한다. 자유 문자열을 그대로 세면 오타 하나가
    // 새 사유로 잡혀 사유별 집계가 조용히 흩어지고, "닫힌 어휘"라는 계약이 이름만 남는다.
    const reason = String(rawEvent.reason || '');
    const key = FAIL_CLOSED_REASONS.includes(reason) ? reason : 'unknown';
    failClosedReasons[key] = (failClosedReasons[key] || 0) + 1;
  }
  const dateSourceCounts = {};
  for (const candidate of candidates) {
    if (!usesDatedArticleResolver({ id: candidate.source_id })) continue;
    const key = String(candidate.date_source || '') || 'missing';
    dateSourceCounts[key] = (dateSourceCounts[key] || 0) + 1;
  }
  return {
    events,
    kind_counts: kindCounts,
    fail_closed_reasons: failClosedReasons,
    date_source_counts: dateSourceCounts,
    received_bytes_by_source: receivedBytesBySource,
    article_cap_counts_by_source: articleCapCountsBySource
  };
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
  const collectionDiagnostics = createSourceCollectionDiagnostics();
  let candidates = [];
  let sourceMonitorResult = null;

  for (const source of sources) {
    try {
      const result = await collectFromSource(source, {
        now,
        lookbackDays,
        onDiagnostic: collectionDiagnostics.record,
        onSourceBytes: collectionDiagnostics.recordSourceBytes,
        onArticleCapCounts: collectionDiagnostics.recordArticleCapCounts
      });
      candidates.push(...result.candidates);
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

  const coverage = coverageForAnchorDate(date, runtimeConfig.coverageWeekKeyOverride);
  const collectionObservedAt = new Date().toISOString();

  // 직전 주 scheduled coverage run이 [E, U) 밖이라 남겨둔 not_yet_eligible 후보를 이번 풀에
  // 합류시킨다(Task 9). 이 후보는 원시(raw) 상태이므로 live 후보 뒤에 붙여 dedupe 이하 기존
  // 필터 체인을 그대로 재통과시킨다 — 파생 판정을 우회하지 않는다. dedupe는 배열 앞쪽을
  // 우선하므로(first-win) live 후보 뒤에 붙이면 URL/제목이 같을 때 항상 live가 이긴다.
  const carryForward = loadCarryForward({
    root,
    coverage,
    carrySourcePathOverride: runtimeConfig.carrySourcePathOverride
  });
  candidates.push(...carryForward.candidates);

  // [E, U) 후보(이번 coverage 주보다 최신인 후보)는 이번 호 대상이 아니다 — cap 이전에 떼어내
  // 다음 실행 carry-forward 원천으로 보존한다(Task 8/9).
  const { notYetEligible, currentCoveragePool } = partitionByCoverageEligibility(
    dedupe(candidates), coverage, now, lookbackDays
  );
  const notYetEligibleCap = capNotYetEligible(notYetEligible);
  writeNotYetEligibleOverflowIfNeeded(root, notYetEligibleCap);

  const rankedCandidates = currentCoveragePool
    .filter(item => withinLookback(item, now, lookbackDays))
    .filter(item => item.cameraHalRelevanceScore >= 30 || item.source_priority === 'high')
    .sort(candidateRankOrder(now, coverage));
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
    coverage,
    generation_anchor_date: date,
    collection_observed_at: collectionObservedAt,
    run_mode: resolveRunMode(process.env),
    not_yet_eligible: notYetEligibleCap.committed,
    not_yet_eligible_overflow: notYetEligibleCap.overflow,
    carry_forward_status: resolveCarryForwardStatus({
      status: carryForward.status,
      overflow: notYetEligibleCap.overflow
    }),
    carry_source: carryForward.carrySource,
    candidates,
    failures,
    dated_article_collection: summarizeDatedArticleCollection({
      events: collectionDiagnostics.events(),
      candidates,
      receivedBytesBySource: collectionDiagnostics.receivedBytesBySource(),
      articleCapCountsBySource: collectionDiagnostics.articleCapCountsBySource()
    })
  };
  writeCollectArtifactsThenAccrueDeepDiveTopics({
    root,
    date,
    candidatePayload,
    failures,
    lookbackDays,
    sourceCount: sources.length,
    generatedAt,
    sourceMonitorResult,
    manualSourceUrls: process.env.NEWSROOM_MANUAL_SOURCE_URLS || '',
    collectionIntentPath: process.env.NEWSROOM_COLLECTION_INTENT_PATH || ''
  });

  console.log(`Collected ${candidates.length} candidates for ${date}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  MAX_FINAL_CANDIDATES,
  MAX_CANDIDATES_PER_SOURCE,
  NOT_YET_ELIGIBLE_MAX_COUNT,
  NOT_YET_ELIGIBLE_MAX_BYTES,
  canonicalContentUrl,
  candidateRankOrder,
  capNotYetEligible,
  capPerSource,
  collapseSeriesRepresentatives,
  collectFromSource,
  componentFromText,
  createSourceCollectionDiagnostics,
  decisionFromCandidate,
  dedupe,
  evidenceMetadata,
  fetchUrlForContent,
  isSourceChangeEventCandidate,
  newsletterDateWindowEnd,
  normalizeCandidate,
  parseHtmlPage,
  parseRss,
  partitionByCoverageEligibility,
  renderCandidateMarkdown: markdown,
  resolveLinkedReleaseNoteEvidenceItems,
  summarizeDatedArticleCollection,
  urlDedupeKey,
  usesDatedArticleResolver,
  withinLookback,
  writeNotYetEligibleOverflowIfNeeded,
  writeCollectArtifactsThenAccrueDeepDiveTopics
};
