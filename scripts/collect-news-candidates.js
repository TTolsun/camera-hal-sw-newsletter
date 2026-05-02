const fs = require('fs');
const path = require('path');
const {
  decodeHtml,
  kstDate,
  readJson
} = require('./lib/common');
const {
  extractImageCandidatesFromHtml,
  extractImageCandidatesFromRssBlock,
  validateImageCandidates
} = require('./lib/image-candidates');

const root = process.cwd();
const structuredSourcesPath = path.join(root, 'data', 'news-sources.json');
const legacySourcesPath = path.join(root, 'docs', 'news-sources.md');
const AUDIENCE = 'Camera HAL / Android Camera / C++ engineer';

const DEFAULT_SECTION_MAP = {
  android: 'Android / AOSP / Camera',
  'camera-api': 'Android / AOSP / Camera',
  'camera-hal': 'Android / AOSP / Camera',
  aosp: 'Android / AOSP / Camera',
  compatibility: 'Android / AOSP / Camera',
  security: 'Android / AOSP / Camera',
  'vendor-security': 'Android / AOSP / Camera',
  'linux-camera': 'Linux Camera / Driver',
  'linux-kernel': 'Linux Camera / Driver',
  driver: 'Linux Camera / Driver',
  v4l2: 'Linux Camera / Driver',
  cpp: 'C++ / Native / Toolchain',
  toolchain: 'C++ / Native / Toolchain',
  native: 'C++ / Native / Toolchain',
  llvm: 'C++ / Native / Toolchain',
  embedded: 'Embedded / Semiconductor',
  'embedded-ai': 'Embedded / Semiconductor',
  semiconductor: 'Embedded / Semiconductor',
  electronics: 'Embedded / Semiconductor',
  ai: 'AI / SW Engineering Trends',
  'ai-research': 'AI / SW Engineering Trends',
  'ai-engineering': 'AI / SW Engineering Trends',
  'ai-coding': 'AI / SW Engineering Trends',
  'ai-trends': 'AI / SW Engineering Trends',
  'tech-trends': 'AI / SW Engineering Trends',
  'software-engineering': 'AI / SW Engineering Trends',
  'open-source': 'AI / SW Engineering Trends',
  'korea-tech': 'Korean Tech Trends',
  'korea-engineering': 'Korean Tech Trends'
};

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
  'its', 'cts', 'vts', 'cdd', 'libcamera', 'v4l2', 'isp', 'image sensor', 'qualcomm', 'samsung', 'soc'
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

function normalizeSource(source, allowFeedHint = false) {
  return {
    id: source.id || '',
    name: source.name,
    url: source.sourceUrl || source.url,
    sourceUrl: source.sourceUrl || source.url,
    rssUrl: source.rssUrl || null,
    category: source.category || 'tech-trends',
    section: source.section || sectionMap[source.category] || 'AI / SW Engineering Trends',
    priority: source.priority || 'medium',
    reliability: source.reliability || 'unknown',
    candidateOnly: source.candidateOnly === true,
    requiresCrossCheck: source.requiresCrossCheck === true,
    allowFeedHint,
    usageHint: source.usageHint || '',
    keywords: Array.isArray(source.keywords) ? source.keywords : []
  };
}

function parseStructuredSources() {
  const registry = readJson(structuredSourcesPath);
  sectionMap = { ...DEFAULT_SECTION_MAP, ...(registry.sectionMap || {}) };
  const sources = (registry.sources || [])
    .filter(source => source.enabled !== false)
    .map(source => normalizeSource(source, false))
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
    sources.push(normalizeSource({
      name: match[1].trim(),
      sourceUrl: match[2].trim(),
      rssUrl: feedFor(match[2].trim()),
      candidateOnly: false,
      requiresCrossCheck: true
    }, true));
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
    imageCandidates: extractImageCandidatesFromHtml(html, source.url, source)
  })];
}

function keywordHits(text, keywords) {
  return keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
}

function normalizeCandidate(raw) {
  const source = raw.source;
  const title = decode(raw.title);
  const summary = decode(raw.summary).slice(0, 500);
  const text = `${title} ${summary} ${source.keywords.join(' ')}`.toLowerCase();
  const cameraHits = keywordHits(text, CAMERA_KEYWORDS);
  const techHits = keywordHits(text, TECH_KEYWORDS);
  const sourceKeywordHits = keywordHits(text, source.keywords);
  const categoryBoost = ['camera-hal', 'camera-api', 'aosp', 'compatibility', 'security'].includes(source.category) ? 35 : 0;
  const priorityBoost = (PRIORITY_WEIGHT[source.priority] || 0) * 4;
  const reliabilityBoost = (RELIABILITY_WEIGHT[source.reliability] || 0) * 3;
  const rawScore = categoryBoost + cameraHits * 8 + techHits * 4 + sourceKeywordHits * 3 + priorityBoost + reliabilityBoost;
  const score = Math.min(100, rawScore);
  const candidateOnly = source.candidateOnly || CANDIDATE_ONLY_RELIABILITY.has(source.reliability);
  const section = source.section || sectionMap[source.category] || 'AI / SW Engineering Trends';

  return {
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
    requiresCrossCheck: source.requiresCrossCheck,
    requires_cross_check: source.requiresCrossCheck,
    verification_hint: candidateOnly || source.requiresCrossCheck
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
    imageCandidates: Array.isArray(raw.imageCandidates) ? raw.imageCandidates : [],
    image_candidates: Array.isArray(raw.imageCandidates) ? raw.imageCandidates : [],
    candidateTier: candidateTier(score),
    reason: buildReason(cameraHits, techHits, source, score),
    collection_reason: buildReason(cameraHits, techHits, source, score)
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

function candidateTier(score) {
  if (score >= 80) return 'main-article';
  if (score >= 50) return 'short-news';
  if (score >= 30) return 'reference-candidate';
  return 'exclude';
}

function buildReason(cameraHits, techHits, source, score) {
  const prefix = `${source.name} (${source.reliability}, ${source.priority}, score ${score})`;
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

function dedupe(candidates) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const result = [];
  for (const item of candidates) {
    const urlKey = item.url.replace(/[?#].*$/, '').toLowerCase();
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
  const groups = candidates.reduce((acc, item) => {
    acc[item.section] = acc[item.section] || [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const lines = [];
  lines.push(`# News Candidates - ${date}`);
  lines.push('');
  lines.push('This file is generated from the structured newsletter source registry. Gemini uses the candidate JSON and source metadata as inputs and does not browse the web.');
  lines.push('');
  lines.push(`- Lookback: ${lookbackDays} days`);
  lines.push(`- Candidate count: ${candidates.length}`);
  lines.push(`- Source registry: ${path.relative(root, activeSourcesPath)}`);
  lines.push('- Candidate-only media/community sources require official-source verification before final article selection.');
  lines.push('');
  lines.push('## Gemini Newsroom Input Summary');
  lines.push('');
  lines.push('```text');
  lines.push(`Newsletter date: ${date}`);
  lines.push(`Audience: ${AUDIENCE}`);
  lines.push('Inputs: collected-news/YYYY-MM-DD/candidates.json, data/news-sources.json, docs/news-sources.md');
  lines.push('Outputs: reporter-candidates.json, editor-draft.json, fact-check-report.json, newsletter.md, index.html, editor-in-chief-brief.md, release-qa-report.md');
  lines.push('```');
  lines.push('');

  for (const [category, items] of Object.entries(groups)) {
    lines.push(`## ${category}`);
    lines.push('');
    lines.push('| Score | Source | Priority | Reliability | Candidate only | Title | Published | Link |');
    lines.push('|---:|---|---|---|---|---|---|---|');
    for (const item of items) {
      lines.push(`| ${item.relevanceScore} | ${mdEscape(item.source)} | ${item.source_priority} | ${item.source_reliability} | ${item.candidate_only ? 'yes' : 'no'} | ${mdEscape(item.title)} | ${mdEscape(item.publishedAt || 'review needed')} | [link](${item.url}) |`);
    }
    lines.push('');
  }

  lines.push('## Raw Candidates');
  lines.push('');
  for (const [index, item] of candidates.entries()) {
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push('');
    lines.push(`- Source: ${item.source}`);
    lines.push(`- Source URL: ${item.source_url}`);
    lines.push(`- Published: ${item.publishedAt || 'review needed'}`);
    lines.push(`- Link: ${item.url}`);
    lines.push(`- Section: ${item.section}`);
    lines.push(`- Source category: ${item.source_category}`);
    lines.push(`- Source priority: ${item.source_priority}`);
    lines.push(`- Source reliability: ${item.source_reliability}`);
    lines.push(`- Candidate only: ${item.candidate_only ? 'yes' : 'no'}`);
    lines.push(`- Requires cross-check: ${item.requires_cross_check ? 'yes' : 'no'}`);
    lines.push(`- Verification hint: ${item.verification_hint}`);
    lines.push(`- Relevance Score: ${item.relevanceScore}`);
    lines.push(`- Summary: ${item.summary || 'No summary'}`);
    lines.push(`- Selection reason: ${item.reason}`);
    lines.push('');
  }

  lines.push('## Collector Failures');
  lines.push('');
  if (failures.length === 0) {
    lines.push('- None');
  } else {
    for (const failure of failures) {
      lines.push(`- ${failure.source}: ${failure.message}`);
    }
  }
  lines.push('');
  lines.push('## Editor-in-Chief Checklist');
  lines.push('');
  lines.push('- [ ] High-priority official sources were reviewed first.');
  lines.push('- [ ] Candidate-only sources were cross-checked against official documentation or blogs when possible.');
  lines.push('- [ ] Each final section preserves source name and source URL.');
  lines.push('- [ ] Final Markdown/HTML includes Sources and References.');
  lines.push('- [ ] Camera HAL relevance is tied to capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, or implementation impact.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();
  const lookbackDays = Number(process.env.LOOKBACK_DAYS || 21);
  const now = new Date();
  const sources = parseSources();
  const failures = [];
  let candidates = [];

  for (const source of sources) {
    try {
      const feed = sourceFeed(source);
      const target = feed || source.url;
      const text = await fetchText(target);
      const parsed = feed ? parseRss(text, source) : parseHtmlPage(text, source);
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

  const outDir = path.join(root, 'collected-news', date);
  const newsroomDir = path.join(root, 'newsroom', date);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });

  fs.writeFileSync(path.join(outDir, 'candidates.json'), JSON.stringify({
    schema_version: 3,
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
  fs.writeFileSync(path.join(newsroomDir, 'news-candidates.md'), markdown(date, candidates, failures, lookbackDays), 'utf8');
  fs.writeFileSync(path.join(root, '.tmp', 'news-candidate-date.txt'), date, 'utf8');

  console.log(`Collected ${candidates.length} candidates for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
