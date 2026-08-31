// Gemini linked evidence expansion (#429).
//
// 기존 Gemini source discovery는 LLM이 제안한 candidate_urls를 등록 도메인에 대조해
// 승격할 뿐, 수동 후보에 이미 붙어 있는 outbound 링크를 들여다보지 않아 사실상 재랭킹에
// 머문다. 이 모듈은 수집 단계에서 이미 보존된 outgoing_links를 분류·정규화·dedupe하고,
// 이미 알고 있는 URL을 제거한 뒤, Gemini(sourceDiscovery 단계, gemini-2.5-flash-lite)에게
// 뉴스레터 기사 가치가 있는 linked artifact만 고르게 한다. 선택된 링크는 기존 파생후보
// 패턴(roundup-child)을 본떠 origin=gemini_linked_discovery 후보로 만들어 기존 selection
// 게이트(source-binding / no-source-less-main)에 그대로 흘려보낸다.
//
// 추가 네트워크 fetch는 하지 않는다(extract-only). 결과가 없어도 실패하지 않는다.

const {
  canonicalDocumentUrl,
  sourceForUrl,
  registryAllowedDomains,
  urlHostname,
  stableId
} = require('../shared/collect/source-intelligence-utils');
const {
  classifyOutgoingLinks,
  EVIDENCE_ROLES
} = require('../shared/evidence/linked-evidence-link-classifier');
const { callGeminiJsonBudgeted } = require('./gemini-client');
const { LLM_STAGES, stageRun } = require('../shared/llm/stage-catalog');

// seed-evidence.js의 sourcePolicy와 동일한 공식 evidence 도메인 신뢰 집합.
const OFFICIAL_EVIDENCE_DOMAINS = Object.freeze([
  'developer.android.com',
  'source.android.com',
  'android-review.googlesource.com',
  'issuetracker.google.com',
  'github.com',
  'libcamera.org',
  'lists.libcamera.org',
  'git.libcamera.org'
]);

const LINKED_DISCOVERY_STATUS = Object.freeze({
  DISABLED: 'DISABLED',
  NO_NEW: 'NO_NEW_DERIVED_CANDIDATES',
  FOUND: 'FOUND_DERIVED_CANDIDATES'
});

// extract-only지만 후보 풀이 두꺼운 날 수십~수백 개 링크가 하나의 flash-lite 프롬프트로
// 몰리는 것을 막기 위해 per-candidate / per-run 상한을 둔다. 기본값은 기존 linked-evidence
// 정책(linkedEvidenceMaxLinksPerCandidate=8, linkedEvidenceMaxLinksPerRun=40)과 일치시킨다.
const DEFAULT_MAX_LINKS_PER_CANDIDATE = 8;
const DEFAULT_MAX_LINKS_PER_RUN = 40;

const KEPT_EVIDENCE_ROLES = new Set([
  EVIDENCE_ROLES.PRIMARY_EVIDENCE,
  EVIDENCE_ROLES.SECONDARY_CONTEXT
]);

const LINKED_DISCOVERY_SYSTEM_PROMPT =
  '당신은 Camera HAL SW newsletter를 위한 신중한 linked evidence discovery planner입니다. JSON만 반환하세요.';

function text(value) {
  return String(value || '').trim();
}

function positiveLimit(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function buildExpansionPolicy(sourceRegistry = {}) {
  const allowedDomains = new Set([
    ...registryAllowedDomains(sourceRegistry),
    ...OFFICIAL_EVIDENCE_DOMAINS
  ].map(domain => text(domain).toLowerCase().replace(/^www\./, '')).filter(Boolean));
  return {
    enabled: true,
    allowedDomains: [...allowedDomains]
  };
}

function candidateDocumentUrls(candidate = {}) {
  return [candidate.url, candidate.articleUrl, candidate.article_url]
    .map(canonicalDocumentUrl)
    .filter(Boolean);
}

function primaryCandidateUrl(candidate = {}) {
  return canonicalDocumentUrl(candidate.url || candidate.articleUrl || candidate.article_url || '');
}

function collectExpansionLinks(manualCandidates = [], sourceRegistry = {}, limits = {}) {
  const candidates = Array.isArray(manualCandidates) ? manualCandidates : [];
  const maxPerCandidate = positiveLimit(limits.maxLinksPerCandidate, DEFAULT_MAX_LINKS_PER_CANDIDATE);
  const maxPerRun = positiveLimit(limits.maxLinksPerRun, DEFAULT_MAX_LINKS_PER_RUN);
  const policy = buildExpansionPolicy(sourceRegistry);
  const manualUrlSet = new Set();
  for (const candidate of candidates) {
    for (const url of candidateDocumentUrls(candidate)) manualUrlSet.add(url);
  }

  const seen = new Set();
  const links = [];
  for (const candidate of candidates) {
    if (links.length >= maxPerRun) break;
    const parentUrl = primaryCandidateUrl(candidate);
    const classified = classifyOutgoingLinks(candidate.outgoing_links || [], policy);
    let keptForCandidate = 0;
    for (const link of classified) {
      if (keptForCandidate >= maxPerCandidate || links.length >= maxPerRun) break;
      if (!KEPT_EVIDENCE_ROLES.has(link.evidence_role)) continue;
      const url = canonicalDocumentUrl(link.url);
      if (!url) continue;
      if (manualUrlSet.has(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      keptForCandidate += 1;
      links.push({
        url,
        link_context: text(link.text),
        evidence_role: link.evidence_role,
        classification_reason: link.classification_reason || '',
        extraction_method: link.extraction_method || 'html_anchor',
        parent_candidate_id: text(candidate.id || candidate.source_candidate_id),
        parent_url: parentUrl,
        parent_title: text(candidate.title)
      });
    }
  }
  return { links, manualUrlSet };
}

function selectionResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      schema_version: { type: 'NUMBER' },
      selections: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            url: { type: 'STRING' },
            is_newsworthy: { type: 'BOOLEAN' },
            reason: { type: 'STRING' },
            suggested_article_type: { type: 'STRING' }
          },
          required: ['url', 'is_newsworthy']
        }
      }
    },
    required: ['selections']
  };
}

function buildSelectionPrompt({ date, links }) {
  const linkSummary = links.map((link, index) => ({
    index: index + 1,
    url: link.url,
    link_context: link.link_context,
    evidence_role: link.evidence_role,
    parent_title: link.parent_title,
    parent_url: link.parent_url
  }));
  return [
    `Newsletter date: ${date}`,
    '',
    '아래는 기존 수동 후보 기사에 연결된 linked evidence URL 목록입니다.',
    'Camera HAL / Camera Driver / V4L2·libcamera / ISP·image sensor 뉴스레터 기사로 가치 있는 항목만 고르세요.',
    '기사 본문을 작성하지 마세요. 제공된 URL과 link_context만 근거로 판단하세요.',
    '이미 수동 후보에 있는 내용의 단순 중복이면 is_newsworthy=false로 하세요.',
    'JSON만 반환하세요.',
    '',
    JSON.stringify(linkSummary, null, 2)
  ].join('\n');
}

async function selectNewsworthyLinks({ date, links = [], callLlmJsonBudgetedImpl, budget } = {}) {
  if (!Array.isArray(links) || links.length === 0 || typeof callLlmJsonBudgetedImpl !== 'function') {
    return [];
  }
  try {
    const payload = await callLlmJsonBudgetedImpl(
      stageRun(LLM_STAGES.SOURCE_DISCOVERY),
      LINKED_DISCOVERY_SYSTEM_PROMPT,
      buildSelectionPrompt({ date, links }),
      selectionResponseSchema(),
      { budget }
    );
    const selections = Array.isArray(payload?.selections) ? payload.selections : [];
    const byUrl = new Map();
    for (const selection of selections) {
      const url = canonicalDocumentUrl(selection.url);
      if (url) byUrl.set(url, selection);
    }
    const selected = [];
    for (const link of links) {
      const selection = byUrl.get(link.url);
      if (!selection || selection.is_newsworthy !== true) continue;
      selected.push({
        ...link,
        selection_reason: text(selection.reason),
        suggested_article_type: text(selection.suggested_article_type)
      });
    }
    return selected;
  } catch (_error) {
    return [];
  }
}

function buildDerivedCandidate(link, source, hostname) {
  const url = canonicalDocumentUrl(link.url);
  const candidateId = `gemini-linked-${stableId([url])}`;
  const sourceName = source.name || hostname || 'Gemini linked discovery';
  return {
    schema_version: 5,
    id: candidateId,
    source_candidate_id: candidateId,
    title: link.link_context || source.name || url,
    url,
    articleUrl: url,
    article_url: url,
    source: sourceName,
    source_name: sourceName,
    sourceName,
    sourceUrl: source.sourceUrl || '',
    source_url: source.sourceUrl || '',
    source_id: source.id || '',
    category: source.category || 'unknown',
    source_category: source.category || 'unknown',
    section: source.section || source.category || 'unknown',
    source_section: source.section || source.category || 'unknown',
    priority: source.priority || 'medium',
    reliability: source.reliability || 'unknown',
    source_reliability: source.reliability || 'unknown',
    origin: 'gemini_linked_discovery',
    collectionStage: 'gemini',
    collection_stage: 'gemini',
    manualSeed: false,
    manual_seed: false,
    derived_from_url: link.parent_url || '',
    parent_candidate_id: link.parent_candidate_id || '',
    parentUrl: link.parent_url || '',
    parent_url: link.parent_url || '',
    parentTitle: link.parent_title || '',
    parent_title: link.parent_title || '',
    anchorText: link.link_context || '',
    anchor_text: link.link_context || '',
    link_context: link.link_context || '',
    evidence_role: link.evidence_role || '',
    suggested_article_type: link.suggested_article_type || '',
    outgoing_links: [],
    source_extraction: {
      mode: 'gemini_linked_discovery',
      parent_candidate_id: link.parent_candidate_id || '',
      parent_url: link.parent_url || '',
      anchor_text: link.link_context || '',
      evidence_role: link.evidence_role || '',
      selection_reason: link.selection_reason || '',
      links: [{ url, text: link.link_context || '', role: 'derived_candidate' }]
    }
  };
}

function buildDerivedCandidates(selectedLinks = [], sourceRegistry = {}) {
  const seen = new Set();
  const candidates = [];
  for (const link of (Array.isArray(selectedLinks) ? selectedLinks : [])) {
    const url = canonicalDocumentUrl(link.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const source = sourceForUrl(sourceRegistry, url) || {};
    candidates.push(buildDerivedCandidate(link, source, urlHostname(url)));
  }
  return candidates;
}

// derived_new_unique_url_count는 manual URL 집합 대비로 sourceDiscoveryCandidateStats가
// 권위 있게 재계산하므로(candidate-artifacts.js) 여기서는 중복·오해 소지가 있어 내보내지 않는다.
function expansionStats(status, { extractedLinkCount = 0, newsworthyLinkCount = 0, derivedCount = 0 } = {}) {
  return {
    linked_discovery_status: status,
    extracted_link_count: extractedLinkCount,
    newsworthy_link_count: newsworthyLinkCount,
    derived_candidate_count: derivedCount
  };
}

async function expandLinkedEvidenceCandidates({
  date,
  manualCandidates = [],
  sourceRegistry = {},
  callLlmJsonBudgetedImpl,
  budget,
  enabled = false,
  maxLinksPerCandidate,
  maxLinksPerRun
} = {}) {
  if (!enabled) {
    return { derivedCandidates: [], stats: expansionStats(LINKED_DISCOVERY_STATUS.DISABLED) };
  }
  const callImpl = callLlmJsonBudgetedImpl || callGeminiJsonBudgeted;
  const { links } = collectExpansionLinks(manualCandidates, sourceRegistry, { maxLinksPerCandidate, maxLinksPerRun });
  const selected = await selectNewsworthyLinks({ date, links, callLlmJsonBudgetedImpl: callImpl, budget });
  const derivedCandidates = buildDerivedCandidates(selected, sourceRegistry);
  const status = derivedCandidates.length > 0
    ? LINKED_DISCOVERY_STATUS.FOUND
    : LINKED_DISCOVERY_STATUS.NO_NEW;
  return {
    derivedCandidates,
    stats: expansionStats(status, {
      extractedLinkCount: links.length,
      newsworthyLinkCount: selected.length,
      derivedCount: derivedCandidates.length
    })
  };
}

module.exports = {
  LINKED_DISCOVERY_STATUS,
  OFFICIAL_EVIDENCE_DOMAINS,
  buildExpansionPolicy,
  collectExpansionLinks,
  selectNewsworthyLinks,
  buildDerivedCandidates,
  expandLinkedEvidenceCandidates
};
