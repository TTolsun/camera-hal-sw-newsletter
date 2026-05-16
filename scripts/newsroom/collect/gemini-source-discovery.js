const fs = require('fs');
const path = require('path');

const {
  geminiSourceProposalValidationReportPath,
  geminiSourceProposalValidationReportRelPath,
  geminiSourceProposalsPath,
  geminiSourceProposalsRelPath
} = require('../common/artifact-paths');
const {
  readJson,
  writeJson
} = require('../common/common');
const {
  callGeminiJsonBudgeted,
  getGeminiCostCalls,
  getGeminiDiagnostics
} = require('../generate/gemini-client');
const {
  candidateTitle,
  fetchTextWithLimit,
  isObject,
  isUrlAllowed,
  normalizeUrl,
  sourceForUrl,
  stableId,
  text
} = require('./source-intelligence-utils');

const PROPOSAL_TYPE = 'gemini_source_discovery';

function proposalResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      schema_version: { type: 'NUMBER' },
      proposal_type: { type: 'STRING' },
      newsletter_date: { type: 'STRING' },
      proposals: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            proposal_id: { type: 'STRING' },
            topic_gap: { type: 'STRING' },
            source_family: { type: 'STRING' },
            allowed_domains: { type: 'ARRAY', items: { type: 'STRING' } },
            search_keywords: { type: 'ARRAY', items: { type: 'STRING' } },
            candidate_urls: { type: 'ARRAY', items: { type: 'STRING' } },
            expected_evidence: { type: 'ARRAY', items: { type: 'STRING' } },
            risk_notes: { type: 'ARRAY', items: { type: 'STRING' } }
          },
          required: ['proposal_id', 'topic_gap', 'source_family', 'candidate_urls']
        }
      }
    },
    required: ['schema_version', 'proposal_type', 'newsletter_date', 'proposals']
  };
}

function normalizeProposalPayload(payload = {}, date = '') {
  if (!isObject(payload)) {
    return {
      schema_version: 1,
      proposal_type: PROPOSAL_TYPE,
      newsletter_date: date,
      proposals: []
    };
  }
  return {
    schema_version: 1,
    proposal_type: PROPOSAL_TYPE,
    newsletter_date: text(payload.newsletter_date || date),
    proposals: Array.isArray(payload.proposals)
      ? payload.proposals.map((proposal, index) => ({
        proposal_id: text(proposal.proposal_id) || `proposal-${index + 1}`,
        topic_gap: text(proposal.topic_gap),
        source_family: text(proposal.source_family || 'unknown'),
        allowed_domains: Array.isArray(proposal.allowed_domains) ? proposal.allowed_domains.map(text).filter(Boolean) : [],
        search_keywords: Array.isArray(proposal.search_keywords) ? proposal.search_keywords.map(text).filter(Boolean) : [],
        candidate_urls: Array.isArray(proposal.candidate_urls) ? proposal.candidate_urls.map(text).filter(Boolean) : [],
        expected_evidence: Array.isArray(proposal.expected_evidence) ? proposal.expected_evidence.map(text).filter(Boolean) : [],
        risk_notes: Array.isArray(proposal.risk_notes) ? proposal.risk_notes.map(text).filter(Boolean) : []
      }))
      : []
  };
}

function buildProposalPrompt({ date, manualCandidates = [], sourceRegistry = {} }) {
  const candidateSummary = manualCandidates.slice(0, 40).map(candidate => ({
    title: candidateTitle(candidate),
    url: candidate.url || candidate.articleUrl || candidate.article_url || '',
    source: candidate.source || candidate.source_name || '',
    finalSelectionEligibility: candidate.finalSelectionEligibility || candidate.final_selection_eligibility || '',
    source_gap_risk: candidate.source_gap_risk === true
  }));
  const registrySummary = (sourceRegistry.sources || []).filter(source => source.enabled !== false).map(source => ({
    id: source.id,
    name: source.name,
    sourceUrl: source.sourceUrl,
    reliability: source.reliability,
    category: source.category,
    keywords: source.keywords || []
  }));
  return [
    `Newsletter date: ${date}`,
    '',
    'You propose discovery intents only. Do not write newsletter articles.',
    'Return known source URLs only when they are from the provided registry domains or linked evidence domains.',
    '',
    'Manual candidates:',
    JSON.stringify(candidateSummary, null, 2),
    '',
    'Source registry:',
    JSON.stringify(registrySummary, null, 2)
  ].join('\n');
}

async function buildProposalPayload({ date, manualCandidates, sourceRegistry, budget, callLlmJsonBudgetedImpl }) {
  const callImpl = callLlmJsonBudgetedImpl || callGeminiJsonBudgeted;
  return normalizeProposalPayload(await callImpl(
    'sourceDiscovery',
    'You are a cautious source discovery planner for a Camera HAL SW newsletter. Return JSON only.',
    buildProposalPrompt({ date, manualCandidates, sourceRegistry }),
    proposalResponseSchema(),
    { budget }
  ), date);
}

function titleFromHtml(html = '', fallback = '') {
  const match = String(html).match(/<title[^>]*>([^<]+)<\/title>/i);
  return text(match ? match[1].replace(/\s+/g, ' ') : fallback);
}

function dateFromHtml(html = '') {
  const textValue = String(html);
  const metaMatch = textValue.match(/(?:datePublished|published_time|pubdate)["']?\s*(?:content|:)?\s*=\s*["']?(\d{4}-\d{2}-\d{2})/i);
  if (metaMatch) return metaMatch[1];
  const plainMatch = textValue.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return plainMatch ? plainMatch[1] : '';
}

async function promoteProposalUrls({ proposalPayload, sourceRegistry, fetchImpl, options = {} }) {
  const promoted = [];
  const rejected = [];
  const validationReport = [];
  const seenUrls = new Set();
  function recordValidation(proposal, rawUrl, values = {}) {
    const row = {
      proposal_id: proposal.proposal_id,
      candidate_url: rawUrl,
      normalized_url: values.normalized_url || '',
      accepted: values.accepted === true,
      rejected_reason: values.rejected_reason || '',
      source_policy_match: values.source_policy_match || ''
    };
    if (values.message) row.message = values.message;
    validationReport.push(row);
    return row;
  }

  for (const proposal of proposalPayload.proposals || []) {
    for (const rawUrl of proposal.candidate_urls || []) {
      const url = normalizeUrl(rawUrl);
      if (!url) {
        rejected.push({ proposal_id: proposal.proposal_id, url: rawUrl, rejected_reason: 'invalid_url' });
        recordValidation(proposal, rawUrl, { rejected_reason: 'invalid_url' });
        continue;
      }
      if (seenUrls.has(url)) {
        rejected.push({ proposal_id: proposal.proposal_id, url, rejected_reason: 'duplicate_proposal_url' });
        recordValidation(proposal, rawUrl, { normalized_url: url, rejected_reason: 'duplicate_proposal_url' });
        continue;
      }
      seenUrls.add(url);
      const source = sourceForUrl(sourceRegistry, url) || {};
      const sourcePolicyMatch = source.id || source.name || '';
      if (!isUrlAllowed(sourceRegistry, url)) {
        rejected.push({ proposal_id: proposal.proposal_id, url, rejected_reason: 'domain_not_allowed' });
        recordValidation(proposal, rawUrl, { normalized_url: url, rejected_reason: 'domain_not_allowed' });
        continue;
      }

      let html = '';
      if (fetchImpl) {
        try {
          html = await fetchTextWithLimit(fetchImpl, url, options);
        } catch (error) {
          rejected.push({ proposal_id: proposal.proposal_id, url, rejected_reason: 'fetch_failed', message: error.message });
          recordValidation(proposal, rawUrl, {
            normalized_url: url,
            rejected_reason: 'fetch_failed',
            source_policy_match: sourcePolicyMatch,
            message: error.message
          });
          continue;
        }
      }

      const publishedAt = dateFromHtml(html);
      const title = titleFromHtml(html, proposal.topic_gap || url);
      const hasDatedEvidence = Boolean(publishedAt);
      const sourceGapRisk = !hasDatedEvidence;
      const candidateId = `gemini-${stableId([url])}`;
      recordValidation(proposal, rawUrl, {
        normalized_url: url,
        accepted: true,
        source_policy_match: sourcePolicyMatch
      });
      promoted.push({
        schema_version: 5,
        id: candidateId,
        source_candidate_id: candidateId,
        title,
        url,
        articleUrl: url,
        article_url: url,
        source: source.name || proposal.source_family || 'Gemini discovery',
        source_name: source.name || proposal.source_family || 'Gemini discovery',
        sourceName: source.name || proposal.source_family || 'Gemini discovery',
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
        origin: 'gemini_discovery',
        collectionStage: 'gemini',
        collection_stage: 'gemini',
        manualSeed: false,
        manual_seed: false,
        sourceType: source.reliability === 'official' ? 'official_blog' : 'unknown',
        source_type: source.reliability === 'official' ? 'official_blog' : 'unknown',
        requiresCrossCheck: source.requiresCrossCheck === true,
        requires_cross_check: source.requiresCrossCheck === true,
        candidateOnly: source.candidateOnly === true,
        candidate_only: source.candidateOnly === true,
        topics: [proposal.topic_gap].filter(Boolean),
        keywords: proposal.search_keywords || [],
        evidence: proposal.expected_evidence || [],
        warnings: sourceGapRisk ? ['missing dated evidence from deterministic fetch'] : [],
        publishedAt,
        published_date: publishedAt,
        hasDatedEvidence: hasDatedEvidence,
        has_dated_evidence: hasDatedEvidence,
        finalSelectionEligibility: hasDatedEvidence ? 'short' : 'watchlist',
        final_selection_eligibility: hasDatedEvidence ? 'short' : 'watchlist',
        source_gap_risk: sourceGapRisk,
        source_gap_risk_level: sourceGapRisk ? 'high' : 'low',
        main_eligible: hasDatedEvidence,
        briefing_only: !hasDatedEvidence,
        reference_only: !hasDatedEvidence,
        relevanceScore: hasDatedEvidence ? 70 : 45,
        relevance_score: hasDatedEvidence ? 70 : 45,
        cameraHalRelevanceScore: hasDatedEvidence ? 70 : 45,
        camera_hal_relevance_score: hasDatedEvidence ? 70 : 45,
        proposal_id: proposal.proposal_id,
        proposal_trace_id: proposal.proposal_id,
        discovery_topic_gap: proposal.topic_gap,
        discovery_source_family: proposal.source_family
      });
    }
  }
  return { promoted, rejected, validationReport };
}

async function runGeminiSourceDiscovery({
  root = process.cwd(),
  date,
  manualPayload,
  sourceRegistryPath = path.join(root, 'data', 'news-sources.json'),
  budget,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch,
  fetch = true
} = {}) {
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : { sources: [] };
  const manualCandidates = Array.isArray(manualPayload?.candidates) ? manualPayload.candidates : [];
  const proposals = proposalPayload
    ? normalizeProposalPayload(proposalPayload, date)
    : await buildProposalPayload({ date, manualCandidates, sourceRegistry, budget, callLlmJsonBudgetedImpl });
  writeJson(geminiSourceProposalsPath(root, date), proposals);
  const validation = await promoteProposalUrls({
    proposalPayload: proposals,
    sourceRegistry,
    fetchImpl: fetch ? fetchImpl : null
  });
  const proposalValidationReport = {
    schema_version: 1,
    report_type: 'gemini_source_proposal_validation',
    newsletter_date: date,
    validations: validation.validationReport,
    counts: validation.validationReport.reduce((counts, item) => {
      const key = item.accepted ? 'accepted' : item.rejected_reason || 'rejected';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {})
  };
  writeJson(geminiSourceProposalValidationReportPath(root, date), proposalValidationReport);
  return {
    proposals,
    proposalsRelPath: geminiSourceProposalsRelPath(date),
    proposalValidationReport,
    proposalValidationReportRelPath: geminiSourceProposalValidationReportRelPath(date),
    promotedCandidates: validation.promoted,
    rejectedProposals: validation.rejected,
    diagnostics: getGeminiDiagnostics(),
    calls: getGeminiCostCalls()
  };
}

module.exports = {
  PROPOSAL_TYPE,
  normalizeProposalPayload,
  promoteProposalUrls,
  proposalResponseSchema,
  runGeminiSourceDiscovery
};
