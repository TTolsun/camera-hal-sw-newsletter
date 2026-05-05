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
const { readRuntimeConfig } = require('../common/runtime-config');
const {
  extractImageCandidatesFromHtml,
  extractImageCandidatesFromRssBlock,
  validateImageCandidates
} = require('../render/image-candidates');
const { parseSourceSpecificItems } = require('../collect/source-item-parsers');
const {
  DEFAULT_SECTION_MAP,
  normalizeEnabledSources,
  normalizeSourceEntry,
  readSourceRegistry
} = require('../collect/news-source-section-resolver');
const {
  BUCKETS,
  classifyAospCameraStackCandidate
} = require('../common/aosp-camera-scope');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);
const structuredSourcesPath = path.join(root, 'data', 'news-sources.json');
const legacySourcesPath = path.join(root, 'docs', 'news-sources.md');
const AUDIENCE = 'AOSP Camera / Camera Driver / SoC Platform / C++ engineer';

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };
const RELIABILITY_WEIGHT = { official: 3, 'project-official': 2, 'official-community': 2 };
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
  'dma-buf', 'soc', 'cpu', 'gpu', 'npu', 'dsp', 'dvfs', 'eas', 'thermal', 'power',
  'qualcomm', 'samsung', 'arm', 'mediatek', 'exynos', 'snapdragon', 'tensor'
];
const TECH_KEYWORDS = [
  'c++', 'cpp', 'clang', 'llvm', 'ndk', 'build', 'test', 'gtest', 'googletest', 'perfetto',
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
const VERSION_OR_RELEASE_PATTERN = /\b(?:Android\s+\d+(?:\s+QPR\d+)?|CameraX\s+\d+\.\d+\.\d+(?:[-\w.]*)?|LLVM\s+\d+\.\d+(?:\.\d+)?|libcamera\s+v?\d+\.\d+(?:\.\d+)?|v?\d+\.\d+\.\d+(?:[-\w.]*)?|release notes?|security bulletin)\b/i;
const API_OR_COMPONENT_PATTERN = /\b(?:CameraX|androidx\.camera|Camera2|Camera HAL|AOSP Camera|CDD|CTS|VTS|Camera ITS|Android framework|Android Security Bulletin|libcamera|V4L2|media controller|image sensor|ISP|MIPI\s*CSI-?2|DMA-?BUF|SoC|CPU|GPU|NPU|DSP|DVFS|EAS|LLVM|Clang|GCC|NDK|SDK|API)\b/i;
const BEHAVIOR_CHANGE_PATTERN = /\b(?:add(?:ed|s)?|change(?:d|s)?|fix(?:ed|es)?|remove(?:d|s)?|deprecat(?:ed|es)|support(?:ed|s)?|update(?:d|s)?|improve(?:d|s|ment)?|migrat(?:ed|es|ion)|security|vulnerability|CVE|bulletin|release(?:d|s)?|compatibility|requirement|API|behavior)\b/i;

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

function parseStructuredSources() {
  const registry = readSourceRegistry(structuredSourcesPath, readJson);
  const normalized = normalizeEnabledSources(registry, { normalizeCollectionModeHint });
  sectionMap = normalized.sectionMap;
  const sources = normalized.sources
    .filter(source => source.name && source.url)
    .sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0));

  if (sources.length === 0) {
    throw new Error('No enabled sources found in data/news-sources.json');
  }
  activeSourcesPath = structuredSourcesPath;
  return sources;
}

function parseLegacySources() {
  if (!fs.existsSync(legacySourcesPath)) {
    throw new Error('Missing data/news-sources.json and docs/news-sources.md');
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
    throw new Error('No sources found in docs/news-sources.md');
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

function parseRss(xml, source) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block => {
    const title = tag(block, 'title');
    const linkTag = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const link = tag(block, 'link') || (linkTag ? linkTag[1] : source.url);
    const date = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published');
    const summary = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    return normalizeCandidate({
      source,
      title,
      url: link,
      publishedAt: date,
      summary,
      sourceKind: 'rss_item',
      collectionMode: 'rss-item',
      imageCandidates: extractImageCandidatesFromRssBlock(block, link, source)
    });
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

function componentFromText(value, source) {
  const match = firstMatch(API_OR_COMPONENT_PATTERN, value);
  if (match) return match;
  if (['camera-hal', 'camera-api', 'aosp', 'compatibility'].includes(source.category)) return 'Android Camera / Camera HAL';
  if (['linux-camera', 'linux-kernel', 'driver', 'v4l2'].includes(source.category)) return 'Linux camera / V4L2';
  if (['soc', 'chipset', 'platform', 'gpu', 'npu'].includes(source.category)) return 'SoC platform / CPU / GPU / NPU';
  if (['cpp', 'toolchain', 'native', 'llvm'].includes(source.category)) return 'C++ / native toolchain';
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

function evidenceLevelFor(classification, metadata) {
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
    evidenceLevel: evidenceLevelFor(classification, metadata),
    selectionExclusionReason: selectionExclusionReason(classification, metadata)
  };
}

function evidenceMetadata(raw, source, title, summary, score, candidateOnly) {
  const sourceKind = raw.sourceKind || raw.source_kind || inferFallbackSourceKind(source);
  const evidenceText = `${title} ${summary} ${raw.version_or_release || ''} ${raw.api_or_component || ''} ${raw.behavior_change || ''}`;
  const versionOrRelease = String(raw.version_or_release || firstMatch(VERSION_OR_RELEASE_PATTERN, evidenceText)).trim();
  const apiOrComponent = String(raw.api_or_component || componentFromText(evidenceText, source)).trim();
  const behaviorChange = String(raw.behavior_change || firstBehavior(summary || title)).trim();
  const hasPublishedDate = Boolean(String(raw.publishedAt || raw.published_date || '').trim());
  const hasVersionOrRelease = Boolean(versionOrRelease);
  const hasApiOrComponent = Boolean(apiOrComponent);
  const hasBehaviorChange = Boolean(behaviorChange && BEHAVIOR_CHANGE_PATTERN.test(behaviorChange));
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
  const parserItemMissingCoreEvidence = releaseNoteItemMissingEvidence || datedItemMissingEvidence;
  const sourceGapRisk = fallbackIneligible || parserItemMissingCoreEvidence || evidenceScore < 6;
  const mainEligible = !candidateOnly && !sourceGapRisk && evidenceScore >= 6 && score >= 30;

  return {
    source_kind: sourceKind,
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
    reference_only: fallbackIneligible || (sourceGapRisk && evidenceScore < 4),
    evidence_score: evidenceScore
  };
}

function normalizeCandidate(raw) {
  const source = raw.source;
  const title = decode(raw.title);
  const summary = decode(raw.summary).slice(0, 500);
  const rawSourceKind = raw.sourceKind || raw.source_kind || inferFallbackSourceKind(source);
  const fallbackOrWatch = FALLBACK_INELIGIBLE_SOURCE_KINDS.has(rawSourceKind);
  const text = `${title} ${summary} ${fallbackOrWatch ? '' : source.keywords.join(' ')}`.toLowerCase();
  const cameraHits = keywordHits(text, CAMERA_KEYWORDS);
  const techHits = keywordHits(text, TECH_KEYWORDS);
  const sourceKeywordHits = fallbackOrWatch ? 0 : keywordHits(text, source.keywords);
  const categoryBoost = ['camera-hal', 'camera-api', 'aosp', 'compatibility', 'security'].includes(source.category) ? 35 : 0;
  const priorityBoost = (PRIORITY_WEIGHT[source.priority] || 0) * 4;
  const reliabilityBoost = (RELIABILITY_WEIGHT[source.reliability] || 0) * 3;
  const rawScore = categoryBoost + cameraHits * 8 + techHits * 4 + sourceKeywordHits * 3 + priorityBoost + reliabilityBoost;
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
    behavior_change: metadata.behavior_change
  });
  let classification = classifySelection(raw, source, metadata, score, candidateOnly);
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

  return {
    schema_version: 5,
    source: source.name,
    source_name: source.name,
    sourceUrl: source.sourceUrl,
    source_url: source.sourceUrl,
    articleUrl: raw.url,
    article_url: raw.url,
    source_id: source.id,
    category: source.category,
    section,
    source_category: source.category,
    source_section: section,
    priority: source.priority,
    reliability: source.reliability,
    source_priority: source.priority,
    source_reliability: source.reliability,
    usageHint: source.usageHint,
    source_usage_hint: source.usageHint,
    candidateOnly,
    candidate_only: candidateOnly,
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
    evidenceLevel: classification.evidenceLevel,
    evidence_level: classification.evidenceLevel,
    finalSelectionEligibility: classification.finalSelectionEligibility,
    final_selection_eligibility: classification.finalSelectionEligibility,
    source_kind: metadata.source_kind,
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
    behavior_change: metadata.behavior_change,
    requiresCrossCheck: source.requiresCrossCheck,
    requires_cross_check: source.requiresCrossCheck,
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
    url: raw.url,
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
    collection_reason: buildReason(cameraHits, techHits, source, score, scopeMetadata)
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

function withinLookback(candidate, now, lookbackDays) {
  const date = parseDate(candidate.publishedAt);
  if (!date) return true;
  const ageMs = now.getTime() - date.getTime();
  return ageMs >= 0 && ageMs <= lookbackDays * 24 * 60 * 60 * 1000;
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

function dedupe(candidates) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const result = [];
  for (const item of candidates) {
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
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function markdown(date, candidates, failures, lookbackDays) {
  const lines = [];
  const articleCandidates = candidates.filter(item => ['main', 'short'].includes(item.finalSelectionEligibility));
  const watchlist = candidates.filter(item => item.finalSelectionEligibility === 'watchlist');
  const excluded = candidates.filter(item => item.finalSelectionEligibility === 'exclude');

  function candidateTable(items) {
    lines.push('| 선택 가능성 | Bucket | Priority | 점수 | 근거 | 수집 mode | 날짜 근거 | 출처 종류 | 출처 | 제목 | 발행일 | 사유 | Link |');
    lines.push('|---|---|---:|---:|---:|---|---|---|---|---|---|---|---|');
    if (items.length === 0) {
      lines.push('| - | - | - | - | - | - | - | - | - | 없음 | - | - | - |');
      lines.push('');
      return;
    }
    for (const item of items) {
      lines.push(`| ${mdEscape(item.finalSelectionEligibility)} | ${mdEscape(item.relevance_bucket)} | ${item.editorial_priority || '-'} | ${item.relevanceScore} | ${item.evidence_score} | ${mdEscape(item.collectionMode)} | ${item.hasDatedEvidence ? 'yes' : 'no'} | ${mdEscape(item.source_kind)} | ${mdEscape(item.source)} | ${mdEscape(item.title)} | ${mdEscape(item.publishedAt || '검토 필요')} | ${mdEscape(item.selection_exclusion_reason || item.verification_hint || '')} | [link](${item.url}) |`);
    }
    lines.push('');
  }

  lines.push(`# 뉴스 후보 - ${date}`);
  lines.push('');
  lines.push('이 파일은 구조화된 newsletter source registry에서 생성됩니다. Gemini는 candidate JSON과 source metadata만 입력으로 사용하며 웹을 직접 browse하지 않습니다.');
  lines.push('');
  lines.push(`- Lookback: ${lookbackDays}일`);
  lines.push(`- 후보 수: ${candidates.length}`);
  lines.push(`- Source registry: ${path.relative(root, activeSourcesPath)}`);
  lines.push('- Candidate-only media/community source는 final article selection 전에 official-source verification이 필요합니다.');
  lines.push('- 날짜가 있는 release/API/behavior evidence가 없는 static HTML page는 main article candidate가 아니라 watchlist/reference material입니다.');
  lines.push('');
  lines.push('## Gemini Newsroom 입력 요약');
  lines.push('');
  lines.push('```text');
  lines.push(`뉴스레터 날짜: ${date}`);
  lines.push(`대상 독자: ${AUDIENCE}`);
  lines.push('Inputs: content/collected-news/YYYY-MM-DD/candidates.json, data/news-sources.json, docs/news-sources.md');
  lines.push('Outputs: reporter-candidates.json, editor-draft.json, fact-check-report.json, newsletter.md, index.html, editor-in-chief-brief.md, release-qa-report.md');
  lines.push('```');
  lines.push('');

  lines.push('## Main/short 기사 후보');
  lines.push('');
  candidateTable(articleCandidates);

  lines.push('## Watchlist/reference page');
  lines.push('');
  candidateTable(watchlist);

  lines.push('## 제외 또는 낮은 신뢰도 항목');
  lines.push('');
  candidateTable(excluded);

  lines.push('## 원본 후보');
  lines.push('');
  for (const [index, item] of candidates.entries()) {
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push('');
    lines.push(`- 출처: ${item.source}`);
    lines.push(`- 출처 URL: ${item.source_url}`);
    lines.push(`- 발행일: ${item.publishedAt || '검토 필요'}`);
    lines.push(`- Link: ${item.url}`);
    lines.push(`- Section: ${item.section}`);
    lines.push(`- Source category: ${item.source_category}`);
    lines.push(`- Source priority: ${item.source_priority}`);
    lines.push(`- Source reliability: ${item.source_reliability}`);
    lines.push(`- Editorial priority: ${item.editorial_priority}`);
    lines.push(`- Relevance bucket: ${item.relevance_bucket}`);
    lines.push(`- AOSP camera directness: ${item.aosp_camera_directness}`);
    lines.push(`- Driver stack relevance: ${item.driver_stack_relevance}`);
    lines.push(`- SoC platform relevance: ${item.soc_platform_relevance}`);
    lines.push(`- Native tooling relevance: ${item.native_tooling_relevance}`);
    lines.push(`- Counts as primary camera topic: ${item.counts_as_primary_camera_topic ? 'yes' : 'no'}`);
    lines.push(`- Counts as driver topic: ${item.counts_as_driver_topic ? 'yes' : 'no'}`);
    lines.push(`- Counts as SoC topic: ${item.counts_as_soc_topic ? 'yes' : 'no'}`);
    lines.push(`- Counts as fallback topic: ${item.counts_as_fallback_topic ? 'yes' : 'no'}`);
    lines.push(`- Evidence origin: ${item.evidence_origin}`);
    lines.push(`- Source hint: ${item.source_hint || 'none'}`);
    lines.push(`- Candidate only: ${item.candidate_only ? 'yes' : 'no'}`);
    lines.push(`- Collection mode: ${item.collectionMode}`);
    lines.push(`- Article candidate: ${item.isArticleCandidate ? 'yes' : 'no'}`);
    lines.push(`- Watch page: ${item.isWatchPage ? 'yes' : 'no'}`);
    lines.push(`- 날짜 근거 있음: ${item.hasDatedEvidence ? 'yes' : 'no'}`);
    lines.push(`- Evidence level: ${item.evidenceLevel}`);
    lines.push(`- Final selection eligibility: ${item.finalSelectionEligibility}`);
    lines.push(`- Source kind: ${item.source_kind}`);
    lines.push(`- Main eligible: ${item.main_eligible ? 'yes' : 'no'}`);
    lines.push(`- Briefing only: ${item.briefing_only ? 'yes' : 'no'}`);
    lines.push(`- Reference only: ${item.reference_only ? 'yes' : 'no'}`);
    lines.push(`- Source gap risk: ${item.source_gap_risk ? 'yes' : 'no'}`);
    lines.push(`- Evidence score: ${item.evidence_score}`);
    lines.push(`- Version/release: ${item.version_or_release || '추출 안 됨'}`);
    lines.push(`- API/component: ${item.api_or_component || '추출 안 됨'}`);
    lines.push(`- Behavior change: ${item.behavior_change || '추출 안 됨'}`);
    lines.push(`- Cross-check 필요: ${item.requires_cross_check ? 'yes' : 'no'}`);
    lines.push(`- Selection exclusion reason: ${item.selection_exclusion_reason}`);
    lines.push(`- Verification hint: ${item.verification_hint}`);
    lines.push(`- Relevance Score: ${item.relevanceScore}`);
    lines.push(`- 요약: ${item.summary || '요약 없음'}`);
    lines.push(`- Selection reason: ${item.reason}`);
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
  const date = runtimeConfig.newsletterDate || kstDate();
  const lookbackDays = runtimeConfig.lookbackDays;
  const now = new Date();
  const sources = parseSources();
  const failures = [];
  let candidates = [];

  for (const source of sources) {
    try {
      const feed = sourceFeed(source);
      const target = feed || source.url;
      const text = await fetchText(target);
      const sourceSpecificItems = parseSourceSpecificItems(text, source);
      const parsed = sourceSpecificItems.length > 0
        ? sourceSpecificItems.map(item => normalizeCandidate(item))
        : feed ? parseRss(text, source) : parseHtmlPage(text, source);
      candidates.push(...parsed);
    } catch (error) {
      failures.push({ source: source.name, message: error.message });
    }
  }

  candidates = dedupe(candidates)
    .filter(item => withinLookback(item, now, lookbackDays))
    .filter(item => item.cameraHalRelevanceScore >= 30 || item.source_priority === 'high')
    .sort((a, b) => {
      const priorityDelta = (PRIORITY_WEIGHT[b.source_priority] || 0) - (PRIORITY_WEIGHT[a.source_priority] || 0);
      const reliabilityDelta = (RELIABILITY_WEIGHT[b.source_reliability] || 0) - (RELIABILITY_WEIGHT[a.source_reliability] || 0);
      return priorityDelta || reliabilityDelta || b.relevanceScore - a.relevanceScore;
    })
    .slice(0, 40);

  const enrichedCandidates = [];
  for (const candidate of candidates) {
    enrichedCandidates.push(await enrichImageCandidates(candidate));
  }
  candidates = enrichedCandidates;

  if (candidates.length === 0) {
    throw new Error('No news candidates collected. Check data/news-sources.json, docs/news-sources.md, or network access.');
  }

  const outDir = collectedNewsDir(root, date);
  const dateNewsroomDir = newsroomDir(root, date);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(dateNewsroomDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });

  fs.writeFileSync(path.join(outDir, 'candidates.json'), JSON.stringify({
    schema_version: 5,
    date,
    newsletter_date: date,
    audience: AUDIENCE,
    lookback_days: lookbackDays,
    generated_at: new Date().toISOString(),
    sources_path: path.relative(root, activeSourcesPath).replace(/\\/g, '/'),
    section_map: sectionMap,
    candidates,
    failures
  }, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(dateNewsroomDir, 'news-candidates.md'), markdown(date, candidates, failures, lookbackDays), 'utf8');
  fs.writeFileSync(path.join(root, '.tmp', 'news-candidate-date.txt'), date, 'utf8');

  console.log(`Collected ${candidates.length} candidates for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
