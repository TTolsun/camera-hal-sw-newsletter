const fs = require('fs');
const path = require('path');
const {
  FETCH_STATUSES,
  RAW_EXCERPT_MAX_LENGTH
} = require('./linked-evidence-types');
const {
  extractLinkedEvidenceFromCandidate
} = require('./linked-evidence-extractor');
const {
  resolveLinkedEvidence
} = require('./linked-evidence-resolver');
const {
  IMPACT_TYPES,
  classifyLinkedEvidenceImpact
} = require('./impact-classifier');

const SCHEMA_VERSION = 1;
const TOP_IDENTIFIER_LIMIT = 8;

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function countBy(values) {
  const counts = {};
  for (const value of values.map(text).filter(Boolean)) {
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function bool(value) {
  return value === true;
}

function candidateUrl(candidate = {}) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl);
}

function candidateIdentity(candidate = {}) {
  return {
    title: text(candidate.title).slice(0, 240),
    url: candidateUrl(candidate),
    normalized_url: text(candidate.normalized_url),
    source: text(candidate.source || candidate.source_name),
    published_date: text(candidate.published_date || candidate.publishedAt || candidate.published_at),
    source_kind: text(candidate.source_kind),
    final_selection_eligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility)
  };
}

function emptyLinkedEvidenceSummary() {
  return {
    schema_version: SCHEMA_VERSION,
    total_count: 0,
    by_type: {},
    by_fetch_status: {},
    impact_type_counts: {},
    warning_count: 0,
    has_resolved_evidence: false,
    has_unresolved_evidence: false,
    top_identifiers: []
  };
}

function topIdentifiers(evidenceItems = []) {
  const seen = new Set();
  const identifiers = [];
  for (const item of ensureArray(evidenceItems)) {
    const identifier = text(item?.identifier || item?.url);
    if (!identifier || seen.has(identifier)) continue;
    seen.add(identifier);
    identifiers.push(identifier.slice(0, 160));
    if (identifiers.length >= TOP_IDENTIFIER_LIMIT) break;
  }
  return identifiers;
}

function buildLinkedEvidenceSummary(evidenceItems = [], impactClassification = null) {
  const evidence = ensureArray(evidenceItems);
  const warningCount = evidence.reduce((count, item) => count + ensureArray(item?.warnings).length, 0) +
    ensureArray(impactClassification?.warnings).length;
  const impactType = text(impactClassification?.impact_type);
  return {
    schema_version: SCHEMA_VERSION,
    total_count: evidence.length,
    by_type: countBy(evidence.map(item => item?.type)),
    by_fetch_status: countBy(evidence.map(item => item?.fetch_status)),
    impact_type_counts: impactType ? { [impactType]: 1 } : {},
    warning_count: warningCount,
    has_resolved_evidence: evidence.some(item => item?.fetch_status === FETCH_STATUSES.RESOLVED),
    has_unresolved_evidence: evidence.some(item => item?.fetch_status !== FETCH_STATUSES.RESOLVED),
    top_identifiers: topIdentifiers(evidence)
  };
}

function stripLinkedEvidencePayload(candidate = {}) {
  const {
    linked_evidence,
    linkedEvidence,
    linkedEvidenceContext,
    linked_evidence_context,
    raw_excerpt,
    rawExcerpt,
    resolved,
    ...safeCandidate
  } = candidate;
  return safeCandidate;
}

function reportTotals(candidateReports = []) {
  const summaries = ensureArray(candidateReports).map(item => item.linked_evidence_summary || emptyLinkedEvidenceSummary());
  const allTypes = [];
  const allStatuses = [];
  const allImpacts = [];
  let warningCount = 0;
  let totalCount = 0;
  let hasResolvedEvidence = false;
  let hasUnresolvedEvidence = false;

  for (const summary of summaries) {
    totalCount += summary.total_count || 0;
    warningCount += summary.warning_count || 0;
    hasResolvedEvidence ||= bool(summary.has_resolved_evidence);
    hasUnresolvedEvidence ||= bool(summary.has_unresolved_evidence);
    for (const [type, count] of Object.entries(summary.by_type || {})) {
      allTypes.push(...Array.from({ length: count }, () => type));
    }
    for (const [status, count] of Object.entries(summary.by_fetch_status || {})) {
      allStatuses.push(...Array.from({ length: count }, () => status));
    }
    for (const [impact, count] of Object.entries(summary.impact_type_counts || {})) {
      allImpacts.push(...Array.from({ length: count }, () => impact));
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    total_count: totalCount,
    by_type: countBy(allTypes),
    by_fetch_status: countBy(allStatuses),
    impact_type_counts: countBy(allImpacts),
    warning_count: warningCount,
    has_resolved_evidence: hasResolvedEvidence,
    has_unresolved_evidence: hasUnresolvedEvidence,
    top_identifiers: []
  };
}

function assertRawExcerptCap(evidenceItems = []) {
  return ensureArray(evidenceItems).map(item => ({
    ...item,
    raw_excerpt: text(item?.raw_excerpt).slice(0, RAW_EXCERPT_MAX_LENGTH)
  }));
}

async function analyzeLinkedEvidenceForCandidates(date, candidates = []) {
  const outputCandidates = [];
  const candidateReports = [];

  for (const candidate of ensureArray(candidates)) {
    const extracted = extractLinkedEvidenceFromCandidate(candidate);
    const resolved = assertRawExcerptCap(await resolveLinkedEvidence(extracted, { enableNetwork: false }));
    const impactClassification = classifyLinkedEvidenceImpact(candidate, resolved);
    const summary = buildLinkedEvidenceSummary(resolved, impactClassification);
    const safeCandidate = {
      ...stripLinkedEvidencePayload(candidate),
      linked_evidence_summary: summary,
      impact_classification: impactClassification
    };
    outputCandidates.push(safeCandidate);
    candidateReports.push({
      ...candidateIdentity(candidate),
      linked_evidence_summary: summary,
      impact_classification: impactClassification,
      linked_evidence: resolved
    });
  }

  const report = {
    schema_version: SCHEMA_VERSION,
    date: text(date),
    generated_at: new Date().toISOString(),
    enable_network: false,
    candidate_count: outputCandidates.length,
    totals: reportTotals(candidateReports),
    candidates: candidateReports
  };

  return {
    candidates: outputCandidates,
    report,
    markdown: renderLinkedEvidenceDiagnosticsMarkdown(report)
  };
}

function renderCounts(counts = {}) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '- none';
  return entries.map(([key, count]) => `- ${key}: ${count}`).join('\n');
}

function renderLinkedEvidenceDiagnosticsMarkdown(report = {}) {
  const totals = report.totals || emptyLinkedEvidenceSummary();
  const lines = [
    `# Linked Evidence Diagnostics - ${text(report.date) || 'unknown'}`,
    '',
    `- schema_version: ${report.schema_version || SCHEMA_VERSION}`,
    `- enable_network: ${report.enable_network === true ? 'true' : 'false'}`,
    `- candidate_count: ${report.candidate_count || 0}`,
    `- total_linked_evidence: ${totals.total_count || 0}`,
    `- warning_count: ${totals.warning_count || 0}`,
    '',
    '## Fetch Status Counts',
    '',
    renderCounts(totals.by_fetch_status),
    '',
    '## Impact Type Counts',
    '',
    renderCounts(totals.impact_type_counts || { [IMPACT_TYPES.UNKNOWN]: 0 }),
    '',
    '## Candidates',
    ''
  ];

  if (!ensureArray(report.candidates).length) {
    lines.push('- none');
  } else {
    for (const candidate of ensureArray(report.candidates)) {
      const summary = candidate.linked_evidence_summary || emptyLinkedEvidenceSummary();
      const impact = candidate.impact_classification || {};
      lines.push(`- ${candidate.title || candidate.url || 'untitled'}: ${summary.total_count} evidence, impact=${impact.impact_type || IMPACT_TYPES.UNKNOWN}, recommendation=${impact.recommended_article_type || 'unknown'}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeLinkedEvidenceDiagnosticsArtifacts(newsroomDir, diagnostics) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.writeFileSync(
    path.join(newsroomDir, 'linked-evidence-report.json'),
    `${JSON.stringify(diagnostics.report, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(newsroomDir, 'linked-evidence-diagnostics.md'),
    diagnostics.markdown,
    'utf8'
  );
}

module.exports = {
  analyzeLinkedEvidenceForCandidates,
  buildLinkedEvidenceSummary,
  emptyLinkedEvidenceSummary,
  renderLinkedEvidenceDiagnosticsMarkdown,
  stripLinkedEvidencePayload,
  writeLinkedEvidenceDiagnosticsArtifacts
};
