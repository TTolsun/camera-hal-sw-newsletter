const { ensureArray } = require('../common/value-coercion');
const fs = require('fs');
const path = require('path');
const {
  FETCH_STATUSES,
  LINKED_EVIDENCE_TYPES,
  RAW_EXCERPT_MAX_LENGTH
} = require('./linked-evidence-types');
const {
  classifyLinkedEvidenceUrl,
  extractLinkedEvidenceFromCandidate
} = require('./linked-evidence-extractor');
const {
  defaultResolved,
  resolveLinkedEvidence
} = require('./linked-evidence-resolver');
const {
  EVIDENCE_ROLES,
  classifyOutgoingLinks
} = require('./linked-evidence-link-classifier');
const {
  IMPACT_TYPES,
  classifyLinkedEvidenceImpact,
  defaultImpactClassification
} = require('./impact-classifier');
const {
  buildEventBundles
} = require('./event-bundle-builder');
const {
  DEFAULT_RUNTIME_CONFIG,
  LINKED_EVIDENCE_MODES
} = require('../common/runtime-config');

const SCHEMA_VERSION = 1;
const TOP_IDENTIFIER_LIMIT = 8;

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

function uniqueText(values = []) {
  return [...new Set(ensureArray(values).map(text).filter(Boolean))];
}

function integerOrDefault(value, fallback, min = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.floor(parsed)) : fallback;
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

function linkedEvidenceRuntimeOptions(options = {}) {
  const runtimeConfig = options.runtimeConfig || {};
  const mode = text(options.linkedEvidenceMode || runtimeConfig.linkedEvidenceMode) ||
    DEFAULT_RUNTIME_CONFIG.linkedEvidenceMode;
  return {
    mode,
    maxLinksPerCandidate: integerOrDefault(
      options.maxLinksPerCandidate ?? runtimeConfig.linkedEvidenceMaxLinksPerCandidate,
      DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxLinksPerCandidate,
      0
    ),
    maxLinksPerRun: integerOrDefault(
      options.maxLinksPerRun ?? runtimeConfig.linkedEvidenceMaxLinksPerRun,
      DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxLinksPerRun,
      0
    ),
    timeoutMs: integerOrDefault(
      options.timeoutMs ?? runtimeConfig.linkedEvidenceTimeoutMs,
      DEFAULT_RUNTIME_CONFIG.linkedEvidenceTimeoutMs,
      1
    ),
    maxBytes: integerOrDefault(
      options.maxBytes ?? runtimeConfig.linkedEvidenceMaxBytes,
      DEFAULT_RUNTIME_CONFIG.linkedEvidenceMaxBytes,
      1
    ),
    fetchClient: options.fetchClient
  };
}

function sourceLinkedEvidencePolicy(candidate = {}) {
  return candidate.source_linked_evidence_policy ||
    candidate.linkedEvidencePolicy ||
    candidate.linked_evidence_policy ||
    null;
}

function skippedReasonForRole(link = {}) {
  if (link.evidence_role === EVIDENCE_ROLES.NOISE) return 'ignored_by_policy';
  if (link.evidence_role === EVIDENCE_ROLES.UNSUPPORTED) {
    return link.classification_reason === 'invalid_or_unsupported_url'
      ? 'invalid_or_unsupported_url'
      : 'unsupported_domain';
  }
  if (link.evidence_role === EVIDENCE_ROLES.BLOCKED_OR_DEFERRED) return 'policy_disabled';
  if (link.evidence_role === EVIDENCE_ROLES.SECONDARY_CONTEXT) return 'not_primary_evidence';
  if (link.evidence_role !== EVIDENCE_ROLES.PRIMARY_EVIDENCE) return 'not_primary_evidence';
  return '';
}

function urlProtocol(value = '') {
  try {
    return new URL(text(value)).protocol;
  } catch {
    return '';
  }
}

function enrichClassifiedLink(link = {}, mode) {
  const roleReason = skippedReasonForRole(link);
  const protocol = urlProtocol(link.url);
  let skippedReason = roleReason;
  if (!skippedReason && protocol !== 'https:') skippedReason = protocol ? 'non_https_url' : 'invalid_url';
  if (!skippedReason && mode === LINKED_EVIDENCE_MODES.EXTRACT_ONLY) skippedReason = 'mode_extract_only';
  return {
    ...link,
    skipped_reason: skippedReason || ''
  };
}

function linkedEvidenceFromClassifiedLink(link = {}) {
  const classified = classifyLinkedEvidenceUrl(link.url);
  const rawExcerpt = uniqueText([link.text, link.url]).join(' ');
  return {
    type: classified.type || LINKED_EVIDENCE_TYPES.GENERIC_URL,
    url: classified.url || link.url,
    identifier: classified.identifier || link.url,
    source_text: text(link.text || link.url),
    raw_excerpt: rawExcerpt,
    fetch_status: FETCH_STATUSES.NOT_FETCHED,
    evidence_role: link.evidence_role,
    classification_reason: link.classification_reason,
    skipped_reason: link.skipped_reason
  };
}

function validateFinalUrlForClassifiedLink(link = {}, policy = {}) {
  return finalUrl => {
    const protocol = urlProtocol(finalUrl);
    if (protocol !== 'https:') {
      return {
        ok: false,
        skippedReason: 'redirect_non_https_url',
        warning: 'Linked evidence network fetch skipped: redirect final URL is not https.'
      };
    }
    const [classified] = classifyOutgoingLinks([{
      ...link,
      url: finalUrl
    }], policy);
    if (classified.evidence_role === EVIDENCE_ROLES.PRIMARY_EVIDENCE) {
      return { ok: true };
    }
    const skippedReason = classified.classification_reason === 'domain_not_allowed_by_policy'
      ? 'redirect_domain_not_allowed'
      : 'redirect_not_primary_evidence';
    return {
      ok: false,
      skippedReason,
      warning: `Linked evidence network fetch skipped: redirect final URL rejected by source policy (${classified.classification_reason || classified.evidence_role || 'unknown'}).`
    };
  };
}

function skippedSourceAwareEvidence(link = {}, reason = '') {
  const evidence = linkedEvidenceFromClassifiedLink({
    ...link,
    skipped_reason: reason || link.skipped_reason || 'not_resolved'
  });
  return {
    ...evidence,
    raw_excerpt: text(evidence.raw_excerpt).slice(0, RAW_EXCERPT_MAX_LENGTH),
    fetch_status: FETCH_STATUSES.SKIPPED,
    warnings: [`Linked evidence resolve skipped: ${evidence.skipped_reason}.`],
    resolver: 'source_aware_policy',
    resolved: defaultResolved()
  };
}

function fetchClientForMode(options = {}) {
  if (typeof options.fetchClient === 'function') return options.fetchClient;
  if (options.mode === LINKED_EVIDENCE_MODES.RESOLVE_ALLOWED_OFFICIAL_LINKS && typeof fetch === 'function') {
    return fetch;
  }
  return undefined;
}

async function resolveSourceAwareOutgoingEvidence(candidate = {}, options = {}, runState = { resolvedCount: 0 }) {
  const policy = sourceLinkedEvidencePolicy(candidate);
  const classifiedLinks = classifyOutgoingLinks(
    candidate.outgoing_links || candidate.outgoingLinks,
    policy
  ).map(link => enrichClassifiedLink(link, options.mode));
  const fetchClient = fetchClientForMode(options);
  const resolvedEvidence = [];
  let resolvedForCandidate = 0;

  for (const link of classifiedLinks) {
    if (link.skipped_reason) {
      resolvedEvidence.push(skippedSourceAwareEvidence(link));
      continue;
    }

    if (options.mode === LINKED_EVIDENCE_MODES.OFFLINE_FIXTURE_TEST && typeof fetchClient !== 'function') {
      resolvedEvidence.push(skippedSourceAwareEvidence(link, 'offline_fixture_fetch_client_missing'));
      continue;
    }

    if (options.mode !== LINKED_EVIDENCE_MODES.RESOLVE_ALLOWED_OFFICIAL_LINKS &&
        options.mode !== LINKED_EVIDENCE_MODES.OFFLINE_FIXTURE_TEST) {
      resolvedEvidence.push(skippedSourceAwareEvidence(link, 'mode_extract_only'));
      continue;
    }

    if (resolvedForCandidate >= options.maxLinksPerCandidate) {
      resolvedEvidence.push(skippedSourceAwareEvidence(link, 'max_links_per_candidate_exceeded'));
      continue;
    }

    if (runState.resolvedCount >= options.maxLinksPerRun) {
      resolvedEvidence.push(skippedSourceAwareEvidence(link, 'max_links_per_run_exceeded'));
      continue;
    }

    const [resolved] = await resolveLinkedEvidence([linkedEvidenceFromClassifiedLink(link)], {
      enableNetwork: true,
      fetchClient,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
      maxLinksPerCandidate: 1,
      httpsOnly: true,
      validateFinalUrl: validateFinalUrlForClassifiedLink(link, policy)
    });
    resolvedEvidence.push(resolved);
    resolvedForCandidate += 1;
    runState.resolvedCount += 1;
  }

  return {
    classifiedLinks,
    linkedEvidence: assertRawExcerptCap(resolvedEvidence),
    summary: buildLinkedEvidenceSummary(resolvedEvidence, null)
  };
}

function stripLinkedEvidencePayload(candidate = {}) {
  const {
    linked_evidence,
    linkedEvidence,
    linkedEvidenceContext,
    linked_evidence_context,
    source_linked_evidence_policy,
    linkedEvidencePolicy,
    linked_evidence_policy,
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
  const allIdentifiers = [];
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
    allIdentifiers.push(...ensureArray(summary.top_identifiers));
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
    top_identifiers: uniqueText(allIdentifiers).slice(0, TOP_IDENTIFIER_LIMIT)
  };
}

function eventBundleTotals(eventBundles = []) {
  const bundles = ensureArray(eventBundles);
  return {
    schema_version: SCHEMA_VERSION,
    total_count: bundles.length,
    by_event_type: countBy(bundles.map(bundle => bundle?.event_type)),
    by_dedupe_reason: countBy(bundles.map(bundle => bundle?.dedupe_reason)),
    warning_count: bundles.reduce((count, bundle) => count + ensureArray(bundle?.warnings).length, 0)
  };
}

function assertRawExcerptCap(evidenceItems = []) {
  return ensureArray(evidenceItems).map(item => ({
    ...item,
    raw_excerpt: text(item?.raw_excerpt).slice(0, RAW_EXCERPT_MAX_LENGTH)
  }));
}

function diagnosticsFailureWarning(error) {
  const message = text(error?.message || error || 'unknown diagnostics error').slice(0, 180);
  return `linked_evidence_diagnostics_failed: ${message}`;
}

async function analyzeLinkedEvidenceForCandidates(date, candidates = [], options = {}) {
  const extractCandidateEvidence = options.extractLinkedEvidenceFromCandidate || extractLinkedEvidenceFromCandidate;
  const resolveEvidence = options.resolveLinkedEvidence || resolveLinkedEvidence;
  const classifyImpact = options.classifyLinkedEvidenceImpact || classifyLinkedEvidenceImpact;
  const runtimeOptions = linkedEvidenceRuntimeOptions(options);
  const runState = { resolvedCount: 0 };
  const outputCandidates = [];
  const candidateReports = [];
  const eventBundleInputs = [];
  const reportWarnings = [];

  for (const candidate of ensureArray(candidates)) {
    let resolved = [];
    let impactClassification;
    let summary;

    try {
      const extracted = extractCandidateEvidence(candidate);
      resolved = assertRawExcerptCap(await resolveEvidence(extracted, { enableNetwork: false }));
      impactClassification = classifyImpact(candidate, resolved);
      summary = buildLinkedEvidenceSummary(resolved, impactClassification);
    } catch (error) {
      const warning = diagnosticsFailureWarning(error);
      reportWarnings.push(warning);
      resolved = [];
      impactClassification = {
        ...defaultImpactClassification(),
        warnings: [warning]
      };
      summary = buildLinkedEvidenceSummary([], impactClassification);
    }

    let sourceAware;
    try {
      sourceAware = await resolveSourceAwareOutgoingEvidence(candidate, runtimeOptions, runState);
    } catch (error) {
      const warning = diagnosticsFailureWarning(error);
      reportWarnings.push(warning);
      sourceAware = {
        classifiedLinks: [],
        linkedEvidence: [],
        summary: buildLinkedEvidenceSummary([], {
          ...defaultImpactClassification(),
          warnings: [warning]
        })
      };
    }

    const safeCandidate = {
      ...stripLinkedEvidencePayload(candidate),
      linked_evidence_summary: summary,
      impact_classification: impactClassification
    };
    outputCandidates.push(safeCandidate);
    eventBundleInputs.push({
      ...candidate,
      linked_evidence: resolved,
      source_aware_linked_evidence: sourceAware.linkedEvidence,
      impact_classification: impactClassification
    });
    candidateReports.push({
      ...candidateIdentity(candidate),
      linked_evidence_summary: summary,
      impact_classification: impactClassification,
      linked_evidence: resolved,
      classified_outgoing_links: sourceAware.classifiedLinks,
      source_aware_linked_evidence_summary: sourceAware.summary,
      source_aware_linked_evidence: sourceAware.linkedEvidence
    });
  }

  const eventBundles = buildEventBundles(eventBundleInputs);
  const eventBundleSummary = eventBundleTotals(eventBundles);

  const report = {
    schema_version: SCHEMA_VERSION,
    date: text(date),
    generated_at: new Date().toISOString(),
    linked_evidence_mode: runtimeOptions.mode,
    linked_evidence_limits: {
      max_links_per_candidate: runtimeOptions.maxLinksPerCandidate,
      max_links_per_run: runtimeOptions.maxLinksPerRun,
      timeout_ms: runtimeOptions.timeoutMs,
      max_bytes: runtimeOptions.maxBytes,
      https_only: true
    },
    enable_network: runtimeOptions.mode === LINKED_EVIDENCE_MODES.RESOLVE_ALLOWED_OFFICIAL_LINKS ||
      (runtimeOptions.mode === LINKED_EVIDENCE_MODES.OFFLINE_FIXTURE_TEST && typeof runtimeOptions.fetchClient === 'function'),
    candidate_count: outputCandidates.length,
    warnings: uniqueText(reportWarnings),
    totals: reportTotals(candidateReports),
    source_aware_totals: reportTotals(candidateReports.map(candidate => ({
      linked_evidence_summary: candidate.source_aware_linked_evidence_summary
    }))),
    event_bundle_summary: eventBundleSummary,
    candidates: candidateReports
  };

  const eventBundleArtifact = {
    schema_version: SCHEMA_VERSION,
    date: text(date),
    generated_at: report.generated_at,
    summary: eventBundleSummary,
    event_bundles: eventBundles
  };

  return {
    candidates: outputCandidates,
    report,
    markdown: renderLinkedEvidenceDiagnosticsMarkdown(report),
    eventBundleArtifact,
    eventBundleMarkdown: renderEventBundleDiagnosticsMarkdown(eventBundleArtifact)
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
    `- linked_evidence_mode: ${text(report.linked_evidence_mode) || LINKED_EVIDENCE_MODES.EXTRACT_ONLY}`,
    `- enable_network: ${report.enable_network === true ? 'true' : 'false'}`,
    `- candidate_count: ${report.candidate_count || 0}`,
    `- total_linked_evidence: ${totals.total_count || 0}`,
    `- source_aware_linked_evidence: ${(report.source_aware_totals || emptyLinkedEvidenceSummary()).total_count || 0}`,
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

function renderEventBundleDiagnosticsMarkdown(artifact = {}) {
  const summary = artifact.summary || eventBundleTotals(artifact.event_bundles);
  const bundles = ensureArray(artifact.event_bundles);
  const lines = [
    `# Event Bundle Diagnostics - ${text(artifact.date) || 'unknown'}`,
    '',
    `- schema_version: ${artifact.schema_version || SCHEMA_VERSION}`,
    `- event_bundle_count: ${summary.total_count || 0}`,
    `- warning_count: ${summary.warning_count || 0}`,
    '',
    '## Event Type Counts',
    '',
    renderCounts(summary.by_event_type),
    '',
    '## Dedupe Reason Counts',
    '',
    renderCounts(summary.by_dedupe_reason),
    '',
    '## Event Bundles',
    ''
  ];

  if (bundles.length === 0) {
    lines.push('- none');
  } else {
    for (const bundle of bundles) {
      lines.push(`- ${bundle.event_id}: ${bundle.event_type}, ${bundle.dedupe_reason}, primary=${bundle.primary_url}, evidence=${ensureArray(bundle.evidence_urls).length}, confidence=${bundle.confidence}`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}`;
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
  fs.writeFileSync(
    path.join(newsroomDir, 'event-bundles.json'),
    `${JSON.stringify(diagnostics.eventBundleArtifact || {
      schema_version: SCHEMA_VERSION,
      date: '',
      generated_at: '',
      summary: eventBundleTotals([]),
      event_bundles: []
    }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(newsroomDir, 'event-bundle-diagnostics.md'),
    diagnostics.eventBundleMarkdown || renderEventBundleDiagnosticsMarkdown({
      schema_version: SCHEMA_VERSION,
      event_bundles: []
    }),
    'utf8'
  );
}

module.exports = {
  analyzeLinkedEvidenceForCandidates,
  buildLinkedEvidenceSummary,
  emptyLinkedEvidenceSummary,
  renderEventBundleDiagnosticsMarkdown,
  renderLinkedEvidenceDiagnosticsMarkdown,
  stripLinkedEvidencePayload,
  writeLinkedEvidenceDiagnosticsArtifacts
};
