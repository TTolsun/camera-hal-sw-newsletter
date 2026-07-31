const { ensureArray } = require('../shared/common/value-coercion');
const dns = require('dns');
const fs = require('fs');
const net = require('net');
const path = require('path');

const {
  seedCandidatesPath,
  seedCandidatesRelPath,
  seedEvidencePackMarkdownPath,
  seedEvidencePackMarkdownRelPath,
  seedEvidencePackPath,
  seedEvidencePackRelPath,
  seedFetchReportMarkdownPath,
  seedFetchReportMarkdownRelPath,
  seedFetchReportPath,
  seedFetchReportRelPath,
  seedMergeReportMarkdownPath,
  seedMergeReportMarkdownRelPath,
  seedMergeReportPath,
  seedMergeReportRelPath
} = require('../shared/common/artifact-paths');
const {
  decodeHtml,
  htmlAttr,
  readJson,
  writeJson
} = require('../shared/common/common');
const {
  classifyOutgoingLinks,
  EVIDENCE_ROLES
} = require('../shared/evidence/linked-evidence-link-classifier');
const {
  extractOutgoingLinksFromHtml
} = require('../shared/collect/outgoing-links');
const {
  parseSourceSpecificItems
} = require('../shared/collect/source-item-parsers');
const {
  sourceForUrl,
  stableId,
  text,
  urlHostname
} = require('../shared/collect/source-intelligence-utils');
const {
  CANDIDATE_SCHEMA_VERSION
} = require('../shared/common/candidate-artifacts');

const SCHEMA_VERSION = 1;
const DEFAULT_LIMITS = Object.freeze({
  maxLinksPerSeedUrl: 8,
  maxTotalSeedLinksPerRun: 40,
  fetchTimeoutMs: 5000,
  maxBytesPerPage: 200000,
  maxRedirects: 5
});
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

class SeedEvidenceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SeedEvidenceError';
    this.details = details;
  }
}

function compact(value, max = 220) {
  const cleaned = text(value).replace(/\s+/g, ' ');
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trim()}...`;
}

function stripTags(value = '') {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function titleFromHtml(html = '', fallback = '') {
  const metaTitle = String(html).match(/<meta\b[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*>/i);
  if (metaTitle) {
    const value = htmlAttr(metaTitle[0], 'content');
    if (value) return compact(value, 180);
  }
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return compact(match ? stripTags(match[1]) : fallback, 180);
}

function dateFromHtml(html = '') {
  const value = String(html || '');
  const meta = value.match(/<(?:meta|time)\b[^>]*(?:datePublished|published_time|pubdate|datetime)["']?\s*(?:content|=)?\s*["']?(\d{4}-\d{2}-\d{2})/i);
  if (meta) return meta[1];
  const plain = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return plain ? plain[1] : '';
}

function normalizedHost(hostname = '') {
  return String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
}

function embeddedMappedIPv4(hostname = '') {
  const host = normalizedHost(hostname);
  const dotted = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return '';
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  if (!Number.isInteger(high) || !Number.isInteger(low) || high < 0 || high > 0xffff || low < 0 || low > 0xffff) {
    return '';
  }
  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff
  ].join('.');
}

function isIPv4(hostname = '') {
  return net.isIP(normalizedHost(hostname)) === 4;
}

function ipv4Parts(hostname = '') {
  if (!isIPv4(hostname)) return null;
  const parts = normalizedHost(hostname).split('.').map(Number);
  return parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isBlockedIPv4(hostname = '') {
  const parts = ipv4Parts(hostname);
  if (!parts) return false;
  const [a, b] = parts;
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254);
}

function isBlockedIPv6(hostname = '') {
  const host = normalizedHost(hostname);
  const mappedIPv4 = embeddedMappedIPv4(host);
  if (mappedIPv4) return isBlockedIPv4(mappedIPv4);
  const firstHextet = Number.parseInt(host.split(':')[0] || '', 16);
  const isLinkLocal = Number.isInteger(firstHextet) && firstHextet >= 0xfe80 && firstHextet <= 0xfebf;
  return host === '::1' ||
    host === '::' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    isLinkLocal ||
    host.startsWith('0:0:0:0:0:0:0:1');
}

function isBlockedHostname(hostname = '') {
  const host = normalizedHost(hostname);
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.corp') || host.endsWith('.lan')) return true;
  if (host === 'metadata.google.internal') return true;
  if (host === '169.254.169.254') return true;
  if (isBlockedIPv4(host) || isBlockedIPv6(host)) return true;
  return false;
}

function parsePublicHttpsUrl(rawUrl = '') {
  let parsed;
  try {
    parsed = new URL(text(rawUrl));
  } catch {
    throw new SeedEvidenceError('invalid_url', { url: rawUrl });
  }
  if (parsed.protocol !== 'https:') {
    throw new SeedEvidenceError('non_https_url', { url: rawUrl });
  }
  if (parsed.username || parsed.password) {
    throw new SeedEvidenceError('embedded_credentials_url', { url: rawUrl });
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new SeedEvidenceError('blocked_internal_host', { url: rawUrl, hostname: parsed.hostname });
  }
  return parsed;
}

async function assertPublicHttpsUrl(rawUrl = '', options = {}) {
  const parsed = parsePublicHttpsUrl(rawUrl);
  const lookupImpl = options.lookupImpl === undefined ? dns.promises.lookup : options.lookupImpl;
  if (typeof lookupImpl === 'function' && net.isIP(normalizedHost(parsed.hostname)) === 0) {
    const records = await lookupImpl(parsed.hostname, { all: true });
    for (const record of ensureArray(records)) {
      if (isBlockedIPv4(record.address) || isBlockedIPv6(record.address)) {
        throw new SeedEvidenceError('dns_resolved_private_address', {
          url: rawUrl,
          hostname: parsed.hostname,
          address: record.address
        });
      }
    }
  }
  return parsed.toString();
}

async function fetchPublicText(fetchImpl, url, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_LIMITS.fetchTimeoutMs;
  const maxBytes = options.maxBytes || DEFAULT_LIMITS.maxBytesPerPage;
  const maxRedirects = options.maxRedirects ?? DEFAULT_LIMITS.maxRedirects;
  let currentUrl = await assertPublicHttpsUrl(url, options);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(currentUrl, {
        redirect: 'manual',
        ...(controller ? { signal: controller.signal } : {})
      });
      if (REDIRECT_STATUSES.has(Number(response?.status))) {
        const location = response?.headers?.get?.('location') || '';
        if (!location) {
          throw new SeedEvidenceError('redirect_missing_location', { url: currentUrl });
        }
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = await assertPublicHttpsUrl(nextUrl, options);
        continue;
      }

      const finalUrl = response?.url || currentUrl;
      await assertPublicHttpsUrl(finalUrl, options);
      if (!response || response.ok === false) {
        throw new SeedEvidenceError('fetch_failed', { url: currentUrl, status: response?.status || 'unknown' });
      }
      const body = await response.text();
      return {
        url: currentUrl,
        finalUrl,
        body: String(body || '').slice(0, maxBytes)
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  throw new SeedEvidenceError('too_many_redirects', { url });
}

function normalizedUrlKey(value = '') {
  try {
    const parsed = new URL(value);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.searchParams.delete('hl');
    return parsed.toString();
  } catch {
    return text(value).toLowerCase();
  }
}

function sourcePolicy(source = {}, seedUrl = '') {
  const allowed = new Set([
    urlHostname(seedUrl),
    urlHostname(source.sourceUrl || source.url || seedUrl),
    ...ensureArray(source.linkedEvidencePolicy?.allowedDomains),
    'developer.android.com',
    'source.android.com',
    'android-review.googlesource.com',
    'issuetracker.google.com',
    'github.com',
    'libcamera.org',
    'lists.libcamera.org',
    'git.libcamera.org'
  ].map(item => text(item).toLowerCase().replace(/^www\./, '')).filter(Boolean));
  return {
    enabled: true,
    allowedDomains: [...allowed],
    importantAnchorKeywords: source.linkedEvidencePolicy?.importantAnchorKeywords,
    ignoreAnchorKeywords: source.linkedEvidencePolicy?.ignoreAnchorKeywords
  };
}

function sourceExtractionItems(candidate = {}) {
  return [
    ...ensureArray(candidate.source_extraction?.release?.sections),
    ...ensureArray(candidate.source_extraction?.minor_line_context?.sections)
  ].flatMap(section => ensureArray(section.items))
    .map(item => compact(item.text || item.source_text, 220))
    .filter(Boolean);
}

function evidenceId(seedId, index, role = 'primary') {
  return `${seedId}-${role}-${String(index + 1).padStart(2, '0')}`;
}

function isUsableLinkedEvidence(item = {}) {
  return item &&
    item.fetch_status !== 'failed_or_blocked' &&
    Array.isArray(item.source_backed_items) &&
    item.source_backed_items.length > 0;
}

function buildPrimaryEvidence(seed, candidate, index, seedUrl) {
  const sourceItems = sourceExtractionItems(candidate);
  const fallbackItems = [candidate.summary, candidate.behavior_change].map(item => compact(item, 220)).filter(Boolean);
  const facts = [...new Set(sourceItems.length > 0 ? sourceItems : fallbackItems)].slice(0, 5);
  return {
    evidence_id: evidenceId(seed.seed_id, index, 'primary'),
    url: candidate.url || seedUrl,
    title: candidate.title || seed.expected_topic || seedUrl,
    published_at: candidate.publishedAt || candidate.published_date || '',
    source_backed_items: facts,
    source_role: 'official_release_source',
    evidence_granularity: candidate.source_extraction ? 'structured_source_extraction' : 'seed_page'
  };
}

function seedCandidateFromEvidence({
  date,
  seed,
  source,
  candidate,
  primaryEvidence,
  packIndex
}) {
  const url = primaryEvidence.url || seed.url;
  const id = `seed-${stableId([seed.seed_id, url, primaryEvidence.evidence_id])}`;
  const facts = primaryEvidence.source_backed_items || [];
  return {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    id,
    source_candidate_id: id,
    title: candidate.title || seed.expected_topic || primaryEvidence.title,
    url,
    articleUrl: url,
    article_url: url,
    source: source.name || candidate.source?.name || 'Seed URL evidence',
    source_name: source.name || candidate.source?.name || 'Seed URL evidence',
    sourceUrl: source.sourceUrl || source.url || '',
    source_url: source.sourceUrl || source.url || '',
    source_id: source.id || candidate.source_id || '',
    category: source.category || 'unknown',
    source_category: source.category || 'unknown',
    section: source.section || source.category || 'unknown',
    source_section: source.section || source.category || 'unknown',
    priority: seed.priority || source.priority || 'medium',
    reliability: source.reliability || 'unknown',
    source_reliability: source.reliability || 'unknown',
    origin: 'seed_url_evidence',
    collectionStage: 'seed_evidence',
    collection_stage: 'seed_evidence',
    manualSeed: true,
    manual_seed: true,
    seed_ids: [seed.seed_id],
    evidence_pack_ids: [`${seed.seed_id}-pack`],
    primary_evidence_ids: [primaryEvidence.evidence_id],
    linked_evidence_ids: [],
    source_extraction_ref: `${path.basename(seedEvidencePackRelPath(date))}#/packs/${packIndex}`,
    source_backed_items: facts,
    release_note_items: facts,
    compact_evidence: {
      primary_facts: facts.slice(0, 4),
      linked_context: [],
      do_not_claim: [
        'Do not claim HAL/API/runtime/driver behavior unless source evidence explicitly says it.',
        'Keyword hints are discovery hints only and are not source-backed facts.'
      ],
      evidence_urls: [primaryEvidence.url].filter(Boolean)
    },
    evidence: facts,
    summary: facts[0] || candidate.summary || '',
    publishedAt: primaryEvidence.published_at || candidate.publishedAt || '',
    published_date: primaryEvidence.published_at || candidate.published_date || '',
    hasDatedEvidence: Boolean(primaryEvidence.published_at),
    has_dated_evidence: Boolean(primaryEvidence.published_at),
    version_or_release: candidate.version_or_release || candidate.source_extraction?.release?.version || '',
    api_or_component: candidate.api_or_component || candidate.source_extraction?.release?.component || '',
    source_extraction: candidate.source_extraction || null,
    extraction_quality: candidate.extraction_quality || candidate.source_extraction?.extraction_quality || null,
    finalSelectionEligibility: facts.length > 0 && primaryEvidence.published_at ? 'short' : 'watchlist',
    final_selection_eligibility: facts.length > 0 && primaryEvidence.published_at ? 'short' : 'watchlist',
    source_gap_risk: !(facts.length > 0 && primaryEvidence.published_at),
    main_eligible: facts.length > 0 && Boolean(primaryEvidence.published_at),
    briefing_only: !(facts.length > 0 && primaryEvidence.published_at),
    reference_only: !(facts.length > 0 && primaryEvidence.published_at),
    relevanceScore: facts.length > 0 ? 70 : 45,
    relevance_score: facts.length > 0 ? 70 : 45,
    cameraHalRelevanceScore: facts.length > 0 ? 70 : 45,
    camera_hal_relevance_score: facts.length > 0 ? 70 : 45
  };
}

function preserveManualEditorialFields(manual, seedCandidate) {
  const output = { ...manual };
  const fillIfMissing = [
    'source_extraction',
    'extraction_quality',
    'linked_evidence_summary',
    'publishedAt',
    'published_date',
    'version_or_release',
    'api_or_component',
    'source_backed_items',
    'release_note_items',
    'compact_evidence'
  ];
  for (const field of fillIfMissing) {
    if ((output[field] === undefined || output[field] === null || output[field] === '') && seedCandidate[field] !== undefined) {
      output[field] = seedCandidate[field];
    }
  }
  output.seed_ids = [...new Set([...ensureArray(output.seed_ids), ...ensureArray(seedCandidate.seed_ids)])];
  output.evidence_pack_ids = [...new Set([...ensureArray(output.evidence_pack_ids), ...ensureArray(seedCandidate.evidence_pack_ids)])];
  output.primary_evidence_ids = [...new Set([...ensureArray(output.primary_evidence_ids), ...ensureArray(seedCandidate.primary_evidence_ids)])];
  output.linked_evidence_ids = [...new Set([...ensureArray(output.linked_evidence_ids), ...ensureArray(seedCandidate.linked_evidence_ids)])];
  output.blocked_linked_evidence_ids = [...new Set([
    ...ensureArray(output.blocked_linked_evidence_ids),
    ...ensureArray(seedCandidate.blocked_linked_evidence_ids)
  ])];
  output.blocked_linked_evidence_urls = [...new Set([
    ...ensureArray(output.blocked_linked_evidence_urls),
    ...ensureArray(seedCandidate.blocked_linked_evidence_urls)
  ])];
  output.seed_evidence_pack_refs = [...new Set([
    ...ensureArray(output.seed_evidence_pack_refs),
    seedCandidate.source_extraction_ref
  ].filter(Boolean))];
  output.do_not_claim = [...new Set([
    ...ensureArray(output.do_not_claim),
    ...ensureArray(seedCandidate.compact_evidence?.do_not_claim)
  ])];
  return output;
}

function mergeSeedCandidates(manualCandidates = [], seedCandidates = []) {
  const manualByUrl = new Map();
  const merged = manualCandidates.map(candidate => ({ ...candidate }));
  for (const [index, candidate] of merged.entries()) {
    const key = normalizedUrlKey(candidate.url || candidate.article_url || candidate.articleUrl);
    if (key) manualByUrl.set(key, index);
  }
  const report = {
    schema_version: SCHEMA_VERSION,
    report_type: 'seed_merge_report',
    generated_at: new Date().toISOString(),
    enriched_duplicate_count: 0,
    new_seed_candidate_count: 0,
    conflicts: [],
    decisions: []
  };
  for (const seedCandidate of seedCandidates) {
    const key = normalizedUrlKey(seedCandidate.url);
    if (manualByUrl.has(key)) {
      const index = manualByUrl.get(key);
      const before = merged[index];
      merged[index] = preserveManualEditorialFields(before, seedCandidate);
      report.enriched_duplicate_count += 1;
      report.decisions.push({
        url: seedCandidate.url,
        action: 'enriched_manual_candidate',
        preserved_fields: ['title', 'headline', 'editor_note', 'priority', 'source_id'],
        added_evidence_ids: seedCandidate.primary_evidence_ids || []
      });
      for (const field of ['title', 'headline', 'priority', 'source_id']) {
        if (before[field] && seedCandidate[field] && before[field] !== seedCandidate[field]) {
          report.conflicts.push({
            url: seedCandidate.url,
            field,
            kept: before[field],
            ignored: seedCandidate[field],
            rule: 'manual_editorial_field_preserved'
          });
        }
      }
    } else {
      merged.push(seedCandidate);
      report.new_seed_candidate_count += 1;
      report.decisions.push({
        url: seedCandidate.url,
        action: 'added_seed_candidate',
        added_evidence_ids: seedCandidate.primary_evidence_ids || []
      });
    }
  }
  return { mergedCandidates: merged, report };
}

function renderSeedFetchReportMarkdown(report = {}) {
  const lines = [
    `# Seed Fetch Report - ${report.newsletter_date || report.date || 'unknown'}`,
    '',
    `- seed_url_count: ${report.seed_url_count || 0}`,
    `- fetched_seed_count: ${report.fetched_seed_count || 0}`,
    `- blocked_url_count: ${report.blocked_url_count || 0}`,
    `- fetch_failed_count: ${report.fetch_failed_count || 0}`,
    '',
    '## Seeds',
    ''
  ];
  for (const item of ensureArray(report.seeds)) {
    lines.push(`- ${item.seed_id}: ${item.status} ${item.url}${item.reason ? ` (${item.reason})` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderSeedEvidencePackMarkdown(pack = {}) {
  const lines = [
    `# Seed Evidence Pack - ${pack.newsletter_date || pack.date || 'unknown'}`,
    '',
    `- pack_count: ${ensureArray(pack.packs).length}`,
    `- primary_evidence_count: ${pack.summary?.primary_evidence_count || 0}`,
    `- main_article_allowed_count: ${pack.summary?.main_article_allowed_count || 0}`,
    '',
    '## Packs',
    ''
  ];
  for (const item of ensureArray(pack.packs)) {
    lines.push(`- ${item.evidence_pack_id}: primary=${ensureArray(item.primary_evidence).length}, linked=${ensureArray(item.linked_evidence).length}, allowed=${item.extraction_quality?.main_article_allowed === true ? 'true' : 'false'}`);
  }
  return `${lines.join('\n')}\n`;
}

function renderSeedMergeReportMarkdown(report = {}) {
  const lines = [
    `# Seed Merge Report - ${report.newsletter_date || report.date || 'unknown'}`,
    '',
    `- enriched_duplicate_count: ${report.enriched_duplicate_count || 0}`,
    `- new_seed_candidate_count: ${report.new_seed_candidate_count || 0}`,
    `- conflict_count: ${ensureArray(report.conflicts).length}`,
    '',
    '## Decisions',
    ''
  ];
  for (const item of ensureArray(report.decisions)) {
    lines.push(`- ${item.action}: ${item.url}`);
  }
  return `${lines.join('\n')}\n`;
}

async function runSeedEvidenceExpansion({
  root = process.cwd(),
  date,
  manualPayload,
  collectionIntent,
  sourceRegistryPath = path.join(root, 'src', 'shared', 'data', 'news-sources.json'),
  fetchImpl = globalThis.fetch,
  lookupImpl,
  limits = {}
} = {}) {
  const effectiveLimits = { ...DEFAULT_LIMITS, ...limits };
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : { sources: [] };
  const seedPayload = collectionIntent?.payload || { seed_urls: [], keyword_hints: [] };
  const fetchRows = [];
  const packs = [];
  const seedCandidates = [];
  let followedLinkCount = 0;

  for (const seed of ensureArray(seedPayload.seed_urls)) {
    let fetched;
    try {
      fetched = await fetchPublicText(fetchImpl, seed.url, {
        lookupImpl,
        timeoutMs: effectiveLimits.fetchTimeoutMs,
        maxBytes: effectiveLimits.maxBytesPerPage
      });
    } catch (error) {
      fetchRows.push({
        seed_id: seed.seed_id,
        url: seed.url,
        status: error instanceof SeedEvidenceError && error.message !== 'fetch_failed' ? 'blocked' : 'failed',
        reason: error.message,
        details: error.details || {}
      });
      continue;
    }

    const source = {
      ...(sourceForUrl(sourceRegistry, fetched.finalUrl || seed.url) || {}),
      url: fetched.finalUrl || seed.url
    };
    const sourceName = source.name || 'Seed URL evidence';
    const pageTitle = titleFromHtml(fetched.body, seed.expected_topic || sourceName);
    const pageDate = dateFromHtml(fetched.body);
    const outgoingLinks = extractOutgoingLinksFromHtml(fetched.body, {
      baseUrl: fetched.finalUrl || seed.url,
      sourceField: 'seed.html'
    });
    const classifiedLinks = classifyOutgoingLinks(outgoingLinks, sourcePolicy(source, fetched.finalUrl || seed.url));
    const primaryLinkCandidates = classifiedLinks
      .filter(link => link.evidence_role === EVIDENCE_ROLES.PRIMARY_EVIDENCE)
      .slice(0, effectiveLimits.maxLinksPerSeedUrl);
    const linkedEvidence = [];
    for (const [linkIndex, link] of primaryLinkCandidates.entries()) {
      if (followedLinkCount >= effectiveLimits.maxTotalSeedLinksPerRun) break;
      followedLinkCount += 1;
      try {
        const linked = await fetchPublicText(fetchImpl, link.url, {
          lookupImpl,
          timeoutMs: effectiveLimits.fetchTimeoutMs,
          maxBytes: effectiveLimits.maxBytesPerPage
        });
        linkedEvidence.push({
          evidence_id: evidenceId(seed.seed_id, linkIndex, 'linked'),
          url: linked.finalUrl || link.url,
          title: titleFromHtml(linked.body, link.text || link.url),
          published_at: dateFromHtml(linked.body),
          source_backed_items: [compact(stripTags(linked.body), 220)].filter(Boolean),
          source_role: 'linked_primary_evidence',
          evidence_granularity: 'linked_page'
        });
      } catch (error) {
        linkedEvidence.push({
          evidence_id: evidenceId(seed.seed_id, linkIndex, 'linked'),
          url: link.url,
          fetch_status: 'failed_or_blocked',
          reason: error.message,
          source_backed_items: []
        });
      }
    }

    const parserSource = {
      ...source,
      name: sourceName,
      sourceUrl: source.sourceUrl || seed.url,
      url: fetched.finalUrl || seed.url
    };
    const parsedItems = parseSourceSpecificItems(fetched.body, parserSource);
    const primaryEvidence = parsedItems.length > 0
      ? parsedItems.map((item, index) => buildPrimaryEvidence(seed, item, index, fetched.finalUrl || seed.url))
      : [{
          evidence_id: evidenceId(seed.seed_id, 0, 'primary'),
          url: fetched.finalUrl || seed.url,
          title: pageTitle,
          published_at: pageDate,
          source_backed_items: pageDate ? [compact(stripTags(fetched.body), 220)] : [],
          source_role: 'seed_page',
          evidence_granularity: 'page_summary'
        }];
    const concreteFacts = primaryEvidence.flatMap(item => item.source_backed_items || []);
    const packIndex = packs.length;
    const pack = {
      evidence_pack_id: `${seed.seed_id}-pack`,
      seed_id: seed.seed_id,
      seed_url: seed.url,
      final_url: fetched.finalUrl || seed.url,
      title: pageTitle,
      fetch_status: 'pass',
      primary_evidence: primaryEvidence,
      linked_evidence: linkedEvidence,
      noise_links: classifiedLinks.filter(link => link.evidence_role === EVIDENCE_ROLES.NOISE),
      blocked_links: classifiedLinks.filter(link =>
        link.evidence_role === EVIDENCE_ROLES.UNSUPPORTED ||
        link.evidence_role === EVIDENCE_ROLES.BLOCKED_OR_DEFERRED
      ),
      do_not_claim: [
        'Do not claim Camera HAL API/runtime/driver behavior unless source evidence explicitly says it.',
        'Do not use failed, blocked, or noise links as factual support.',
        'Keyword hints are discovery hints only, not source-backed facts.'
      ],
      extraction_quality: {
        seed_fetch_status: 'pass',
        has_primary_evidence: primaryEvidence.length > 0,
        has_concrete_facts: concreteFacts.length > 0,
        linked_evidence_followed: linkedEvidence.some(item => item.source_backed_items?.length > 0),
        main_article_allowed: primaryEvidence.some(item => item.published_at && ensureArray(item.source_backed_items).length > 0)
      }
    };
    packs.push(pack);
    fetchRows.push({
      seed_id: seed.seed_id,
      url: seed.url,
      final_url: fetched.finalUrl || seed.url,
      status: 'pass',
      title: pageTitle,
      primary_evidence_count: primaryEvidence.length,
      linked_evidence_count: linkedEvidence.length
    });
    const usableLinkedEvidence = linkedEvidence.filter(isUsableLinkedEvidence);
    const blockedLinkedEvidence = linkedEvidence.filter(item => item.fetch_status === 'failed_or_blocked');
    primaryEvidence.forEach((evidence, index) => {
      if (!evidence.published_at || ensureArray(evidence.source_backed_items).length === 0) return;
      const sourceCandidate = parsedItems[index] || {
        title: evidence.title,
        url: evidence.url,
        source: parserSource,
        publishedAt: evidence.published_at,
        summary: evidence.source_backed_items[0]
      };
      const candidate = seedCandidateFromEvidence({
        date,
        seed,
        source: parserSource,
        candidate: sourceCandidate,
        primaryEvidence: evidence,
        packIndex
      });
      candidate.linked_evidence_ids = usableLinkedEvidence.map(item => item.evidence_id);
      candidate.blocked_linked_evidence_ids = blockedLinkedEvidence.map(item => item.evidence_id);
      candidate.blocked_linked_evidence_urls = blockedLinkedEvidence.map(item => item.url).filter(Boolean);
      candidate.compact_evidence.linked_context = usableLinkedEvidence
        .flatMap(item => item.source_backed_items || [])
        .slice(0, 3);
      candidate.compact_evidence.evidence_urls = [
        ...candidate.compact_evidence.evidence_urls,
        ...usableLinkedEvidence.map(item => item.url)
      ].filter(Boolean);
      seedCandidates.push(candidate);
    });
  }

  const fetchReport = {
    schema_version: SCHEMA_VERSION,
    report_type: 'seed_fetch_report',
    newsletter_date: date,
    generated_at: new Date().toISOString(),
    seed_url_count: ensureArray(seedPayload.seed_urls).length,
    fetched_seed_count: fetchRows.filter(item => item.status === 'pass').length,
    blocked_url_count: fetchRows.filter(item => item.status === 'blocked').length,
    fetch_failed_count: fetchRows.filter(item => item.status === 'failed').length,
    keyword_hints: ensureArray(seedPayload.keyword_hints),
    keyword_hints_are_facts: false,
    seeds: fetchRows
  };
  const evidencePack = {
    schema_version: SCHEMA_VERSION,
    report_type: 'seed_evidence_pack',
    newsletter_date: date,
    generated_at: fetchReport.generated_at,
    packs,
    summary: {
      seed_url_count: ensureArray(seedPayload.seed_urls).length,
      pack_count: packs.length,
      primary_evidence_count: packs.reduce((count, pack) => count + ensureArray(pack.primary_evidence).length, 0),
      linked_evidence_count: packs.reduce((count, pack) => count + ensureArray(pack.linked_evidence).length, 0),
      main_article_allowed_count: packs.filter(pack => pack.extraction_quality?.main_article_allowed === true).length
    }
  };
  const seedPayloadOut = {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    date,
    newsletter_date: date,
    generated_at: fetchReport.generated_at,
    candidates: seedCandidates,
    failures: fetchRows.filter(item => item.status !== 'pass')
  };
  const merge = mergeSeedCandidates(manualPayload?.candidates || [], seedCandidates);
  const mergeReport = {
    ...merge.report,
    newsletter_date: date,
    seed_candidate_count: seedCandidates.length
  };

  writeJson(seedFetchReportPath(root, date), fetchReport);
  fs.writeFileSync(seedFetchReportMarkdownPath(root, date), renderSeedFetchReportMarkdown(fetchReport), 'utf8');
  writeJson(seedEvidencePackPath(root, date), evidencePack);
  fs.writeFileSync(seedEvidencePackMarkdownPath(root, date), renderSeedEvidencePackMarkdown(evidencePack), 'utf8');
  writeJson(seedCandidatesPath(root, date), seedPayloadOut);
  writeJson(seedMergeReportPath(root, date), mergeReport);
  fs.writeFileSync(seedMergeReportMarkdownPath(root, date), renderSeedMergeReportMarkdown(mergeReport), 'utf8');

  return {
    seedCandidates,
    seedPayload: seedPayloadOut,
    mergedCandidates: merge.mergedCandidates,
    fetchReport,
    evidencePack,
    mergeReport,
    stats: {
      seed_used: ensureArray(seedPayload.seed_urls).length > 0,
      seed_candidate_count: seedCandidates.length,
      seed_new_unique_url_count: mergeReport.new_seed_candidate_count,
      seed_enriched_duplicate_count: mergeReport.enriched_duplicate_count,
      seed_publishable_candidate_count: seedCandidates.filter(candidate => candidate.main_eligible !== false && candidate.source_gap_risk !== true).length,
      seed_blocked_url_count: fetchReport.blocked_url_count,
      seed_fetch_failed_count: fetchReport.fetch_failed_count,
      seed_primary_evidence_count: evidencePack.summary.primary_evidence_count
    },
    reportRefs: {
      seed_candidate_artifact: seedCandidatesRelPath(date),
      seed_evidence_pack: seedEvidencePackRelPath(date),
      seed_evidence_pack_markdown: seedEvidencePackMarkdownRelPath(date),
      seed_fetch_report: seedFetchReportRelPath(date),
      seed_fetch_report_markdown: seedFetchReportMarkdownRelPath(date),
      seed_merge_report: seedMergeReportRelPath(date),
      seed_merge_report_markdown: seedMergeReportMarkdownRelPath(date)
    }
  };
}

module.exports = {
  DEFAULT_LIMITS,
  SeedEvidenceError,
  assertPublicHttpsUrl,
  fetchPublicText,
  mergeSeedCandidates,
  normalizedUrlKey,
  runSeedEvidenceExpansion
};
