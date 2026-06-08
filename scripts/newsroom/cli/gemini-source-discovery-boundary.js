const fs = require('fs');
const path = require('path');

const {
  kstDate,
  readJson
} = require('../common/common');
const {
  evidenceValidationReportPath,
  evidenceValidationReportRelPath,
  extractedSourceFactsPath,
  extractedSourceFactsRelPath,
  collectedCandidatesPath,
  collectedCandidatesRelPath,
  geminiCandidatesPath,
  geminiCandidatesRelPath,
  geminiSourceProposalValidationReportPath,
  geminiSourceProposalValidationReportRelPath,
  geminiSourceProposalsPath,
  geminiSourceProposalsRelPath,
  geminiUsageReportPath,
  geminiUsageReportRelPath,
  manualCandidatesPath,
  manualCandidatesRelPath,
  mergedCandidateManifestPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesPath,
  mergedCandidatesRelPath,
  newsroomDir,
  newsroomRelPath,
  rawCandidateManifestPath,
  rawCandidateManifestRelPath,
  seedCandidatesPath,
  seedEvidencePackMarkdownPath,
  seedEvidencePackPath,
  seedFetchReportMarkdownPath,
  seedFetchReportPath,
  seedMergeReportMarkdownPath,
  seedMergeReportPath,
  sourceClustersPath,
  sourceClustersRelPath,
  sourceDiscoveryFeedbackReportMarkdownPath,
  sourceDiscoveryFeedbackReportMarkdownRelPath,
  sourceDiscoveryFeedbackReportPath,
  sourceDiscoveryFeedbackReportRelPath,
  sourceQualityReportMarkdownPath,
  sourceQualityReportMarkdownRelPath,
  sourceQualityReportPath,
  sourceQualityReportRelPath
} = require('../common/artifact-paths');
const {
  sourceDiscoveryCandidateStats,
  sourceDiscoveryStatsSummary,
  writeMergedCandidateArtifacts
} = require('../common/candidate-artifacts');
const {
  createGeminiUsageBudget
} = require('../common/gemini-usage-budget');
const {
  writeJson
} = require('../common/common');
const {
  readRuntimeConfig
} = require('../common/runtime-config');
const {
  renderEditorPrSummary
} = require('../common/editor-pr-summary');
const {
  runGeminiSourceDiscovery
} = require('../collect/gemini-source-discovery');
const {
  expandLinkedEvidenceCandidates
} = require('../collect/linked-evidence-candidate-expansion');
const {
  approvedCollectionIntentFromManifest
} = require('../collect/collection-intent');
const {
  runSeedEvidenceExpansion
} = require('../collect/seed-evidence');
const {
  extractSourceFacts
} = require('../collect/extract-source-facts');
const {
  checkSourceDuplicates
} = require('../collect/check-source-duplicates');
const {
  renderSourceQualityMarkdown,
  scoreSourceCandidates
} = require('../collect/score-source-candidates');
const {
  validateCandidateEvidence
} = require('../evidence/validate-candidate-evidence');
const {
  candidateTitle,
  candidateUrl,
  text
} = require('../collect/source-intelligence-utils');

const FAILED_LLM_CREDENTIALS = 'FAILED_LLM_CREDENTIALS';
const SEED_ONLY_LLM_CREDENTIALS_MISSING = 'SEED_ONLY_LLM_CREDENTIALS_MISSING';

const REJECTED_REASON_LABELS = {
  duplicate_source: '이미 수집된 후보와 중복',
  parser_gap: 'source extraction 보강 필요',
  source_gap: '기사 근거 부족',
  taxonomy_gap: 'bucket/classifier 또는 허용 domain 보강 필요',
  credential_failure: 'Gemini 실행 불가',
  other: '기타 확인 필요'
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--date') {
      args.date = argv[index + 1] || '';
      index += 1;
    } else if (item === '--preflight-only') {
      args.preflightOnly = true;
    } else if (item === '--dry-run') {
      // --dry-run: 모든 가드(Missing manual candidate artifact 포함)는 실행하되
      // 실제 파일 write를 건너뜁니다. 로컬 검증용으로 git-tracked RRC 파일 오염 방지.
      args.dryRun = true;
    }
  }
  return args;
}

function candidateItems(payload = {}) {
  return Array.isArray(payload?.candidates) ? payload.candidates : [];
}

function findManualCandidatePath(root, date) {
  const manualPath = manualCandidatesPath(root, date);
  if (fs.existsSync(manualPath)) return manualPath;
  const legacyPath = collectedCandidatesPath(root, date);
  if (fs.existsSync(legacyPath)) return legacyPath;
  throw new Error(`Missing manual candidate artifact: ${manualCandidatesRelPath(date)} or ${collectedCandidatesRelPath(date)}`);
}

function normalizeRejectedReason(reason = '') {
  const value = String(reason || '').toLowerCase();
  if (/credential|auth|api[_ -]?key/.test(value)) return 'credential_failure';
  if (/duplicate|already|manual/.test(value)) return 'duplicate_source';
  if (/parser|extract|not_extractable/.test(value)) return 'parser_gap';
  if (/source[_ -]?gap|evidence|missing_source/.test(value)) return 'source_gap';
  if (/domain|taxonomy|bucket|policy|not_allowed|scope/.test(value)) return 'taxonomy_gap';
  return 'other';
}

function rejectedReasonSummary(rejectedProposals = [], status = '') {
  const counts = new Map();
  if (status === FAILED_LLM_CREDENTIALS) {
    counts.set('credential_failure', 1);
  }
  for (const item of Array.isArray(rejectedProposals) ? rejectedProposals : []) {
    const key = normalizeRejectedReason(item?.rejected_reason || item?.reason || item?.message);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      count,
      interpretation: REJECTED_REASON_LABELS[key] || REJECTED_REASON_LABELS.other
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function numberStat(stats, key) {
  const value = Number(stats?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function sourceDiscoveryHandoff({
  status,
  stats = null,
  mergedCandidateRelPath = '',
  sourceDiscoveryFeedbackReport = null,
  llmUsed = false
} = {}) {
  const mergedCount = numberStat(stats, 'merged_candidate_count');
  const geminiPublishableCount = numberStat(stats, 'gemini_publishable_candidate_count');
  const seedPublishableCount = numberStat(stats, 'seed_publishable_candidate_count');
  const publishableCount = geminiPublishableCount + seedPublishableCount;
  const geminiNewUniqueCount = numberStat(stats, 'gemini_new_unique_url_count');
  const newUniqueCount = geminiNewUniqueCount + numberStat(stats, 'seed_new_unique_url_count');
  const hasMergedArtifact = Boolean(mergedCandidateRelPath);
  const geminiDiscoveryNoNewUniqueUrl = Boolean(llmUsed) && geminiNewUniqueCount === 0;
  if (status === FAILED_LLM_CREDENTIALS || !hasMergedArtifact || mergedCount === 0) {
    return {
      nextStep: 'blocked',
      label: '진행 불가',
      reason: status === FAILED_LLM_CREDENTIALS
        ? 'Gemini source discovery credential preflight가 실패했습니다.'
        : 'merged-candidates artifact가 없거나 후보 수가 0개입니다.'
    };
  }
  if (publishableCount > 0) {
    return {
      nextStep: 'run_03',
      label: geminiDiscoveryNoNewUniqueUrl ? '03 진행 가능 — Gemini 신규 URL 없음' : '03 진행 가능',
      reason: seedPublishableCount > 0 && geminiPublishableCount === 0
        ? 'Seed evidence expansion에서 publishable 후보가 확인되었습니다.'
        : 'Gemini 또는 seed discovery에서 publishable 후보가 확인되었습니다.',
      gemini_discovery_no_new_unique_url: geminiDiscoveryNoNewUniqueUrl
    };
  }
  if (newUniqueCount === 0 || sourceDiscoveryFeedbackReport?.status === 'WARNING') {
    return {
      nextStep: 'strengthen_candidates',
      label: geminiDiscoveryNoNewUniqueUrl
        ? '03 진행 가능하나 후보 보강 권장 — Gemini 신규 URL 없음'
        : '03 진행 가능하나 후보 보강 권장',
      reason: 'merged artifact는 생성되었지만 Gemini 신규 publishable 후보가 없거나 parser/source gap이 남아 있습니다.',
      gemini_discovery_no_new_unique_url: geminiDiscoveryNoNewUniqueUrl
    };
  }
  return {
    nextStep: 'run_03',
    label: '03 진행 가능',
    reason: 'merged candidate artifact가 생성되었습니다.',
    gemini_discovery_no_new_unique_url: false
  };
}

function sourceDiscoveryVerdict({
  status,
  stats = null,
  handoff = {},
  sourceDiscoveryFeedbackReport = null
} = {}) {
  if (handoff.nextStep === 'blocked') {
    return {
      label: '실패',
      action: 'credential 또는 artifact 문제를 해결한 뒤 02를 다시 실행하세요.',
      firstLook: 'merged artifact와 credential failure 여부를 먼저 확인하세요.'
    };
  }
  if (sourceDiscoveryFeedbackReport?.status === 'WARNING') {
    return {
      label: '검토 필요',
      action: 'parser/source feedback을 확인하고 후보 보강 여부를 판단하세요.',
      firstLook: `parser/source feedback warning이 있습니다. parser_gap_count=${sourceDiscoveryFeedbackReport.parser_gap_count ?? 0}`
    };
  }
  const geminiPublishableCount = numberStat(stats, 'gemini_publishable_candidate_count');
  const seedPublishableCount = numberStat(stats, 'seed_publishable_candidate_count');
  const publishableCount = geminiPublishableCount + seedPublishableCount;
  if (publishableCount > 0) {
    return {
      label: '검토 가능',
      action: 'merged 후보를 확인한 뒤 03 final newsletter generation으로 진행할 수 있습니다.',
      firstLook: seedPublishableCount > 0 && geminiPublishableCount === 0
        ? `${seedPublishableCount}개 seed publishable 후보가 있습니다.`
        : `${publishableCount}개 publishable 후보가 있습니다.`
    };
  }
  if (status === 'PASS') {
    return {
      label: '검토 필요',
      action: '후보 품질을 확인하고 필요하면 source를 보강한 뒤 03 진행 여부를 판단하세요.',
      firstLook: 'Gemini 신규 publishable 후보가 없습니다.'
    };
  }
  return {
    label: '검토 필요',
    action: 'source discovery report와 artifact를 확인하세요.',
    firstLook: '상세 report의 status와 rejected proposal을 확인하세요.'
  };
}

function renderReport({
  date,
  status,
  statusDetail = '',
  disabledPassThrough,
  llmUsed,
  geminiCandidateCount,
  mergeMode,
  discoveryStats = null,
  sourceCandidateRelPath = '',
  geminiCandidateRelPath = '',
  mergedCandidateRelPath = '',
  manifestRelPath = '',
  proposalValidationReportRelPath = '',
  seedEvidenceRefs = {},
  sourceDiscoveryFeedbackReportRelPath = '',
  sourceDiscoveryFeedbackReportMarkdownRelPath = '',
  sourceDiscoveryFeedbackReport = null,
  rejectedProposals = []
}) {
  const stats = discoveryStats && typeof discoveryStats === 'object' ? discoveryStats : null;
  const handoff = sourceDiscoveryHandoff({
    status,
    stats,
    mergedCandidateRelPath,
    sourceDiscoveryFeedbackReport,
    llmUsed
  });
  const verdict = sourceDiscoveryVerdict({
    status,
    stats,
    handoff,
    sourceDiscoveryFeedbackReport
  });
  const rejectedSummary = rejectedReasonSummary(rejectedProposals, status);
  const rejectedRows = rejectedSummary.length > 0
    ? rejectedSummary.map(item => [`rejected: ${item.key}`, item.count, item.interpretation])
    : [['rejected proposal', 0, '없음']];
  const lines = [
    `# Gemini Source Discovery Report - ${date}`,
    '',
    renderEditorPrSummary({
      stage: 'source_discovery',
      verdict,
      handoff,
      summaryRows: [
        ['생성 단계', 'Gemini source discovery'],
        ['기준 날짜', date],
        ['status_detail', statusDetail || 'none'],
        ['merge_mode', mergeMode],
        ['merged candidate artifact', mergedCandidateRelPath || '없음'],
        ['source discovery feedback', sourceDiscoveryFeedbackReportRelPath || '없음']
      ],
      checklistItems: [
        {
          label: 'Gemini 또는 seed publishable 후보 여부 확인',
          checked: numberStat(stats, 'gemini_publishable_candidate_count') + numberStat(stats, 'seed_publishable_candidate_count') > 0
        },
        { label: 'manual 후보와 중복만 생성했는지 확인', checked: false },
        { label: 'parser/source/taxonomy gap 확인', checked: false },
        { label: 'merged-candidates artifact 정상 생성 확인', checked: Boolean(mergedCandidateRelPath) },
        { label: '03 진행 전 source_gap 후보가 main으로 승격되지 않았는지 확인', checked: false }
      ],
      resultRows: [
        ['manual 후보', stats?.manual_candidate_count ?? 'unknown', '입력'],
        ['Gemini 후보', stats?.gemini_candidate_count ?? geminiCandidateCount ?? 'unknown', llmUsed ? '실행됨' : '비활성/pass-through'],
        ['Gemini 신규 unique 후보', stats?.gemini_new_unique_url_count ?? 'unknown', Number(stats?.gemini_new_unique_url_count ?? 0) > 0 ? '있음' : '없음'],
        ['Gemini publishable 후보', stats?.gemini_publishable_candidate_count ?? 0, Number(stats?.gemini_publishable_candidate_count ?? 0) > 0 ? '있음' : '없음'],
        ['linked evidence 파생 후보', stats?.derived_candidate_count ?? 0, Number(stats?.derived_candidate_count ?? 0) > 0 ? '있음' : '없음(non-failing)'],
        ['linked 파생 publishable 후보', stats?.derived_publishable_candidate_count ?? 0, Number(stats?.derived_publishable_candidate_count ?? 0) > 0 ? '있음' : '없음'],
        ['seed 후보', stats?.seed_candidate_count ?? 0, Number(stats?.seed_candidate_count ?? 0) > 0 ? '있음' : '없음'],
        ['seed 신규 unique 후보', stats?.seed_new_unique_url_count ?? 0, Number(stats?.seed_new_unique_url_count ?? 0) > 0 ? '있음' : '없음'],
        ['seed publishable 후보', stats?.seed_publishable_candidate_count ?? 0, Number(stats?.seed_publishable_candidate_count ?? 0) > 0 ? '있음' : '없음'],
        ['중복 후보', stats?.gemini_manual_duplicate_url_count ?? 0, Number(stats?.gemini_manual_duplicate_url_count ?? 0) > 0 ? '확인 필요' : '낮음'],
        ['parser gap', sourceDiscoveryFeedbackReport?.parser_gap_count ?? 0, Number(sourceDiscoveryFeedbackReport?.parser_gap_count ?? 0) > 0 ? '보강 필요' : '없음'],
        ['Gemini parser failure', sourceDiscoveryFeedbackReport?.gemini_parser_failure_count ?? 0, Number(sourceDiscoveryFeedbackReport?.gemini_parser_failure_count ?? 0) > 0 ? '보강 필요' : '없음'],
        ...rejectedRows
      ]
    }),
    '- 원본 후보와 merged 후보는 아래 artifact에서 확인하세요.',
    `- source_candidate_artifact: ${sourceCandidateRelPath || '없음'}`,
    `- gemini_candidate_artifact: ${geminiCandidateRelPath || '없음'}`,
    `- merged_candidate_artifact: ${mergedCandidateRelPath || '없음'}`,
    `- merged_candidate_manifest: ${manifestRelPath || '없음'}`,
    `- proposal_validation_report: ${proposalValidationReportRelPath || '없음'}`,
    `- source_discovery_feedback_report: ${sourceDiscoveryFeedbackReportMarkdownRelPath || sourceDiscoveryFeedbackReportRelPath || '없음'}`,
    '- rejected proposal 원문: proposal_validation_report artifact에서 확인하세요.',
    '- parser/source feedback 원문: source_discovery_feedback_report artifact에서 확인하세요.',
    '- PR body에는 편집장 1차 판단에 필요한 요약만 남깁니다.',
    ''
  ];

  if (handoff.gemini_discovery_no_new_unique_url) {
    lines.push(
      '### ⚠️ Gemini 신규 URL 없음 (Ineffective Discovery)',
      '',
      `Gemini discovery가 실행됐지만 manual 후보와 전부 중복입니다 (gemini_new_unique_url_count=${stats?.gemini_new_unique_url_count ?? 0}).`,
      'source coverage가 늘지 않았습니다.',
      '',
      '**권장 조치:** source family 확장, discovery prompt 재검토, 또는 seed URL 추가를 고려하세요.',
      ''
    );
  }

  if (status === FAILED_LLM_CREDENTIALS) {
    lines.push(
      '- Gemini source discovery credential preflight가 실패했습니다.',
      'Candidate artifacts were not modified.',
      ''
    );
  } else {
    if (statusDetail === SEED_ONLY_LLM_CREDENTIALS_MISSING) {
      lines.push(
        '- approved seed evidence expansion 후 Gemini credentials가 없어 Gemini discovery는 건너뛰었습니다.',
        '- Seed evidence artifacts와 seed-only merged candidates는 생성되었습니다.',
        ''
      );
    }
    if (seedEvidenceRefs.seed_candidate_artifact || seedEvidenceRefs.seed_evidence_pack) {
      lines.push(
        `- seed_candidate_artifact: ${seedEvidenceRefs.seed_candidate_artifact || '없음'}`,
        `- seed_evidence_pack: ${seedEvidenceRefs.seed_evidence_pack || '없음'}`,
        ''
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeReport(root, date, markdown) {
  const dir = newsroomDir(root, date);
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, 'gemini-source-discovery-report.md');
  fs.writeFileSync(reportPath, markdown, 'utf8');
  return reportPath;
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function removeStaleNormalOutputs(root, date) {
  removeIfExists(mergedCandidatesPath(root, date));
  removeIfExists(mergedCandidateManifestPath(root, date));
  removeIfExists(geminiCandidatesPath(root, date));
  removeIfExists(geminiSourceProposalsPath(root, date));
  removeIfExists(geminiSourceProposalValidationReportPath(root, date));
  removeIfExists(geminiUsageReportPath(root, date));
  removeIfExists(extractedSourceFactsPath(root, date));
  removeIfExists(sourceQualityReportPath(root, date));
  removeIfExists(sourceQualityReportMarkdownPath(root, date));
  removeIfExists(sourceClustersPath(root, date));
  removeIfExists(evidenceValidationReportPath(root, date));
  removeIfExists(seedCandidatesPath(root, date));
  removeIfExists(seedEvidencePackPath(root, date));
  removeIfExists(seedEvidencePackMarkdownPath(root, date));
  removeIfExists(seedFetchReportPath(root, date));
  removeIfExists(seedFetchReportMarkdownPath(root, date));
  removeIfExists(seedMergeReportPath(root, date));
  removeIfExists(seedMergeReportMarkdownPath(root, date));
  removeIfExists(sourceDiscoveryFeedbackReportPath(root, date));
  removeIfExists(sourceDiscoveryFeedbackReportMarkdownPath(root, date));
}

function assertEnabledCredentials(root, date, env, { writeReportOnFailure = true } = {}) {
  try {
    readRuntimeConfig(env, { requireLlmCredentials: true });
  } catch (error) {
    if (writeReportOnFailure) {
      const report = renderReport({
        date,
        status: FAILED_LLM_CREDENTIALS,
        disabledPassThrough: false,
        llmUsed: false,
        geminiCandidateCount: 0,
        mergeMode: 'credential_preflight_failed'
      });
      error.reportPath = writeReport(root, date, report);
    }
    error.status = FAILED_LLM_CREDENTIALS;
    throw error;
  }
}

function enabledCredentialsError(env) {
  try {
    readRuntimeConfig(env, { requireLlmCredentials: true });
    return null;
  } catch (error) {
    return error;
  }
}

function candidatePayload(date, candidates, basePayload = {}) {
  return {
    ...basePayload,
    schema_version: Math.max(Number(basePayload.schema_version || 5), 5),
    date,
    newsletter_date: date,
    generated_at: new Date().toISOString(),
    candidates,
    failures: Array.isArray(basePayload.failures) ? basePayload.failures : []
  };
}

function boolTrue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function firstText(...values) {
  return values.map(text).find(Boolean) || '';
}

function urlParts(value = '') {
  try {
    const parsed = new URL(String(value || '').trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return {
      href: parsed.href,
      hostname,
      pathname: parsed.pathname.toLowerCase(),
      family: `${parsed.protocol.toLowerCase()}//${hostname}${parsed.pathname.replace(/\/$/, '').toLowerCase()}`
    };
  } catch (_error) {
    return {
      href: '',
      hostname: '',
      pathname: '',
      family: ''
    };
  }
}

function normalizedCandidateUrlForFeedback(candidate = {}) {
  const raw = candidateUrl(candidate);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const port = parsed.port ? `:${parsed.port}` : '';
    const pathname = parsed.pathname.replace(/\/$/, '');
    return `${protocol}//${hostname}${port}${pathname}${parsed.hash}`;
  } catch (_error) {
    return String(raw || '').trim();
  }
}

function candidateUrlFamily(candidate = {}) {
  return urlParts(candidateUrl(candidate)).family;
}

function sourceIdentity(candidate = {}) {
  return firstText(
    candidate.source_id,
    candidate.sourceId,
    candidate.source_slug,
    candidate.source,
    candidate.source_name,
    candidate.sourceName
  );
}

function sourceIdentityHaystack(candidate = {}) {
  return [
    candidate.source_id,
    candidate.sourceId,
    candidate.source_slug,
    candidate.source,
    candidate.source_name,
    candidate.sourceName,
    candidate.sourceUrl,
    candidate.source_url
  ].map(text).join(' ').toLowerCase();
}

function sourceIdentitySlug(candidate = {}) {
  return sourceIdentityHaystack(candidate).replace(/[^a-z0-9]+/g, '-');
}

function officialCameraSource(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  const identity = sourceIdentitySlug(candidate);
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) return true;
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) return true;
  return /\b(?:android-developers-latest-updates|camerax-release-notes|aosp-site-updates)\b/.test(identity);
}

function parserBackedCameraSource(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  const identity = sourceIdentitySlug(candidate);
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) return true;
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) return true;
  return /\b(?:android-developers-latest-updates|camerax-release-notes|aosp-site-updates)\b/.test(identity);
}

function parserGapEligible(candidate = {}) {
  const finalEligibility = firstText(candidate.finalSelectionEligibility, candidate.final_selection_eligibility).toLowerCase();
  const sourceQualityBucket = firstText(candidate.source_quality_bucket).toLowerCase();
  return ['main', 'short'].includes(finalEligibility) ||
    boolTrue(candidate.main_eligible) ||
    ['strong_candidate', 'review_candidate', 'strong', 'review'].includes(sourceQualityBucket);
}

function officialKnownParserBackedUrl(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) return true;
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) return true;
  return false;
}

function sourceValidationStatusAllowsParserGap(candidate = {}) {
  if (!boolTrue(candidate.source_gap_risk)) return true;
  const status = firstText(candidate.evidence_validation_status, candidate.source_validation_status).toLowerCase();
  return ['pass', 'review', 'editor_review_required', 'fetch_failed_review_required'].includes(status);
}

function sourceValidationAllowsParserGap(candidate = {}) {
  return sourceValidationStatusAllowsParserGap(candidate) || officialKnownParserBackedUrl(candidate);
}

function parserGapConfidence(candidate = {}) {
  if (!sourceValidationStatusAllowsParserGap(candidate) && officialKnownParserBackedUrl(candidate)) {
    return 'medium';
  }
  return 'high';
}

function sourceExtractionItemText(item = {}) {
  if (typeof item === 'string') return text(item);
  if (!item || typeof item !== 'object') return '';
  return firstText(item.text, item.body, item.title, item.summary, item.description);
}

function sourceExtractionSections(candidate = {}) {
  const extraction = candidate.source_extraction;
  if (!extraction || typeof extraction !== 'object') return [];
  return [
    ...(Array.isArray(extraction?.release?.sections) ? extraction.release.sections : []),
    ...(Array.isArray(extraction?.minor_line_context?.sections) ? extraction.minor_line_context.sections : [])
  ];
}

function hasConcreteSourceExtractionBullet(candidate = {}) {
  return sourceExtractionSections(candidate)
    .flatMap(section => Array.isArray(section?.items) ? section.items : [])
    .some(item => Boolean(sourceExtractionItemText(item)));
}

function parserGapReason(candidate = {}) {
  if (!candidate.source_extraction || typeof candidate.source_extraction !== 'object') {
    return 'missing_source_extraction';
  }
  if (!hasConcreteSourceExtractionBullet(candidate)) {
    return 'empty_source_extraction_release_sections';
  }
  return '';
}

function parserGapCandidate(candidate = {}) {
  return officialCameraSource(candidate) &&
    parserBackedCameraSource(candidate) &&
    parserGapEligible(candidate) &&
    sourceValidationAllowsParserGap(candidate) &&
    Boolean(parserGapReason(candidate));
}

function adapterHint(candidate = {}) {
  const parts = urlParts(candidateUrl(candidate));
  const identity = sourceIdentitySlug(candidate);
  if (parts.hostname === 'developer.android.com' && /\/jetpack\/androidx\/releases\/camera\b/.test(parts.pathname)) {
    return {
      adapter_hint: 'android-developers-jetpack-release',
      repair_hint: 'Check AndroidX Camera release-note block parser and source_extraction.release.sections extraction.'
    };
  }
  if (/\bandroid-developers-latest-updates\b/.test(identity)) {
    return {
      adapter_hint: 'android-developers-latest-updates',
      repair_hint: 'Check latest updates table/card row extraction and Camera Maven Group row handling.'
    };
  }
  if (parts.hostname === 'source.android.com' && /\bcamera\b/.test(parts.pathname)) {
    return {
      adapter_hint: firstText(candidate.source_id, candidate.sourceId) || 'aosp-site-updates',
      repair_hint: 'Check AOSP camera update row extraction.'
    };
  }
  return {
    adapter_hint: null,
    repair_hint: ''
  };
}

function selectorExclusionReason(candidate = {}) {
  const haystack = [
    candidate.title,
    candidate.version_or_release,
    candidate.versionOrRelease,
    candidate.url,
    candidate.summary,
    candidate.behavior_change
  ].map(text).join(' ');
  if (/camerax|androidx\.camera|\/jetpack\/androidx\/releases\/camera/i.test(haystack)) {
    return 'CameraX release-note candidate has no concrete source_extraction bullet';
  }
  return parserGapReason(candidate) === 'missing_source_extraction'
    ? 'missing source_extraction for official parser-backed candidate'
    : 'source_extraction.release.sections has no concrete bullet';
}

function duplicateDiscoveryMatches(manualCandidates = [], geminiCandidates = []) {
  const exactUrls = new Set();
  const familyUrls = new Set();
  for (const gemini of geminiCandidates) {
    const url = normalizedCandidateUrlForFeedback(gemini);
    const family = candidateUrlFamily(gemini);
    if (url) exactUrls.add(url);
    if (family) familyUrls.add(family);
  }
  const duplicateMatches = new Map();
  for (const manual of manualCandidates) {
    const url = normalizedCandidateUrlForFeedback(manual);
    const family = candidateUrlFamily(manual);
    const key = candidateKey(manual);
    if (url && exactUrls.has(url)) {
      duplicateMatches.set(key, 'exact_normalized_url');
    } else if (family && familyUrls.has(family)) {
      duplicateMatches.set(key, 'same_release_page_family');
    }
  }
  return duplicateMatches;
}

function isGeminiDiscoveryCandidate(candidate = {}) {
  return candidate.origin === 'gemini_discovery' ||
    candidate.collectionStage === 'gemini' ||
    candidate.collection_stage === 'gemini';
}

function buildSourceDiscoveryFeedbackReport({
  date,
  manualCandidates = [],
  mergedCandidates = [],
  geminiCandidates = [],
  proposalValidations = []
} = {}) {
  const duplicateMatches = duplicateDiscoveryMatches(manualCandidates, geminiCandidates);
  const candidatesByKey = new Map();
  for (const candidate of mergedCandidates) {
    if (isGeminiDiscoveryCandidate(candidate)) continue;
    const key = candidateKey(candidate);
    if (key && !candidatesByKey.has(key)) {
      candidatesByKey.set(key, candidate);
    }
  }
  for (const candidate of manualCandidates) {
    const key = candidateKey(candidate);
    if (key && !candidatesByKey.has(key)) {
      candidatesByKey.set(key, candidate);
    }
  }

  const items = [];
  for (const candidate of candidatesByKey.values()) {
    if (!parserGapCandidate(candidate)) continue;
    const hints = adapterHint(candidate);
    const key = candidateKey(candidate);
    const reason = parserGapReason(candidate);
    const title = firstText(candidate.version_or_release, candidate.versionOrRelease, candidateTitle(candidate), candidate.title);
    const duplicateMatchType = duplicateMatches.get(key) || null;
    const item = {
      severity: 'warning',
      action: 'PARSER_REPAIR_REQUIRED',
      reason,
      candidate_title: title,
      url: candidateUrl(candidate),
      source_id: sourceIdentity(candidate),
      adapter_hint: hints.adapter_hint,
      duplicate_discovered_by_gemini: Boolean(duplicateMatchType),
      duplicate_match_type: duplicateMatchType,
      source_gap_risk: boolTrue(candidate.source_gap_risk),
      evidence_validation_status: firstText(candidate.evidence_validation_status, candidate.source_validation_status) || null,
      source_quality_bucket: firstText(candidate.source_quality_bucket) || null,
      final_selection_eligibility: firstText(candidate.final_selection_eligibility, candidate.finalSelectionEligibility) || null,
      confidence: parserGapConfidence(candidate),
      selector_exclusion_reason: selectorExclusionReason(candidate),
      recommendation: hints.repair_hint ||
        'Repair the source parser so the matching official source block preserves concrete source_extraction bullets.'
    };
    items.push(item);
  }

  const gemini_parser_failures = (Array.isArray(proposalValidations) ? proposalValidations : [])
    .filter(item => ['parser_repair_required', 'discovered_not_extractable'].includes(item.rejected_reason))
    .map(item => ({
      severity: 'warning',
      action: 'GEMINI_PARSER_EXTRACTION_REQUIRED',
      candidate_url: item.normalized_url || item.candidate_url || '',
      source_policy_match: item.source_policy_match || '',
      discovery_status: item.discovery_status || 'discovered',
      extraction_status: item.extraction_status || item.rejected_reason,
      adapter_hint: item.adapter_hint || null,
      rejected_reason: item.rejected_reason || '',
      suggested_fixture_case: item.suggested_fixture_case || '',
      message: item.message || ''
    }));
  const duplicateDiscoveryGapCount = items.filter(item => item.duplicate_discovered_by_gemini).length;
  return {
    schema_version: 1,
    report_type: 'source_discovery_feedback',
    date,
    status: items.length > 0 || gemini_parser_failures.length > 0 ? 'WARNING' : 'PASS',
    parser_gap_count: items.length,
    duplicate_discovery_gap_count: duplicateDiscoveryGapCount,
    gemini_parser_failure_count: gemini_parser_failures.length,
    gemini_parser_failures,
    items
  };
}

function renderSourceDiscoveryFeedbackMarkdown(report = {}) {
  const lines = [
    `# Source Discovery Feedback Report - ${report.date || 'unknown'}`,
    '',
    `status=${report.status || 'PASS'}`,
    `parser_gap_count=${Number(report.parser_gap_count || 0)}`,
    `duplicate_discovery_gap_count=${Number(report.duplicate_discovery_gap_count || 0)}`,
    `gemini_parser_failure_count=${Number(report.gemini_parser_failure_count || 0)}`,
    '',
    '| Action | Reason | Candidate | Adapter | Duplicate Discovery | Duplicate Match | Confidence | URL |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const item of report.items || []) {
    lines.push([
      item.action || '',
      item.reason || '',
      String(item.candidate_title || '').replace(/\|/g, '\\|'),
      item.adapter_hint || '',
      item.duplicate_discovered_by_gemini ? 'true' : 'false',
      item.duplicate_match_type || '',
      item.confidence || '',
      item.url || ''
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  if (!Array.isArray(report.items) || report.items.length === 0) {
    lines.push('| none | none | none | none | false |  |  |  |');
  }
  lines.push('');

  lines.push('## Gemini parser extraction failures', '');
  lines.push('| Action | Reason | Discovery Status | Extraction Status | Adapter | Source | URL |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const item of report.gemini_parser_failures || []) {
    lines.push([
      item.action || '',
      item.rejected_reason || '',
      item.discovery_status || '',
      item.extraction_status || '',
      item.adapter_hint || '',
      String(item.source_policy_match || '').replace(/\|/g, '\\|'),
      item.candidate_url || ''
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }
  if (!Array.isArray(report.gemini_parser_failures) || report.gemini_parser_failures.length === 0) {
    lines.push('| none | none | none | none | none | none |  |');
  }
  lines.push('');

  for (const item of report.gemini_parser_failures || []) {
    lines.push(
      `- ${item.action}: ${item.candidate_url || 'unknown'}`,
      `  - rejected_reason: ${item.rejected_reason || ''}`,
      `  - discovery_status: ${item.discovery_status || ''}`,
      `  - extraction_status: ${item.extraction_status || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - suggested_fixture_case: ${item.suggested_fixture_case || ''}`,
      ''
    );
  }

  for (const item of report.items || []) {
    lines.push(
      `- ${item.action}: ${item.candidate_title || 'unknown'}`,
      `  - url: ${item.url || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - reason: ${item.reason || ''}`,
      `  - duplicate_discovered_by_gemini: ${item.duplicate_discovered_by_gemini ? 'true' : 'false'}`,
      `  - duplicate_match_type: ${item.duplicate_match_type || ''}`,
      `  - confidence: ${item.confidence || ''}`,
      `  - source_gap_risk: ${item.source_gap_risk ? 'true' : 'false'}`,
      `  - evidence_validation_status: ${item.evidence_validation_status || ''}`,
      `  - recommendation: ${item.recommendation || ''}`,
      ''
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderSourceDiscoveryFeedbackSummary(report = {}, markdownRelPath = '') {
  const status = report.status || 'PASS';
  const parserGapCount = Number(report.parser_gap_count || 0);
  const duplicateGapCount = Number(report.duplicate_discovery_gap_count || 0);
  const geminiParserFailureCount = Number(report.gemini_parser_failure_count || 0);
  const lines = [
    '## Parser/source feedback',
    '',
    `status=${status}`,
    `parser_gap_count=${parserGapCount}`,
    `duplicate_discovery_gap_count=${duplicateGapCount}`,
    `gemini_parser_failure_count=${geminiParserFailureCount}`
  ];
  if (markdownRelPath) {
    lines.push(`source_discovery_feedback_report_markdown=${markdownRelPath}`);
  }
  lines.push('');
  for (const item of (report.items || []).slice(0, 3)) {
    lines.push(
      `- ${item.action}: ${item.candidate_title || 'unknown'}`,
      `  - url: ${item.url || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - reason: ${item.reason || ''}`,
      `  - duplicate_match_type: ${item.duplicate_match_type || ''}`,
      `  - confidence: ${item.confidence || ''}`,
      item.duplicate_discovered_by_gemini
        ? `  - Gemini rediscovered this URL (${item.duplicate_match_type || 'unknown_match'}), but the manual candidate lacks concrete source_extraction bullets.`
        : '  - Manual candidate lacks concrete source_extraction bullets.'
    );
  }
  if (parserGapCount > 3) {
    lines.push(`- ${parserGapCount - 3} more item(s) in ${markdownRelPath}`);
  }
  for (const item of (report.gemini_parser_failures || []).slice(0, 3)) {
    lines.push(
      `- ${item.action}: ${item.candidate_url || 'unknown'}`,
      `  - rejected_reason: ${item.rejected_reason || ''}`,
      `  - discovery_status: ${item.discovery_status || ''}`,
      `  - extraction_status: ${item.extraction_status || ''}`,
      `  - adapter_hint: ${item.adapter_hint || ''}`,
      `  - suggested_fixture_case: ${item.suggested_fixture_case || ''}`
    );
  }
  if (geminiParserFailureCount > 3) {
    lines.push(`- ${geminiParserFailureCount - 3} more Gemini parser failure item(s) in ${markdownRelPath}`);
  }
  lines.push('');
  return lines;
}

function writeSourceDiscoveryFeedbackReport(root, date, report) {
  const dir = newsroomDir(root, date);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(sourceDiscoveryFeedbackReportPath(root, date), report);
  fs.writeFileSync(sourceDiscoveryFeedbackReportMarkdownPath(root, date), renderSourceDiscoveryFeedbackMarkdown(report), 'utf8');
  return {
    report,
    jsonPath: sourceDiscoveryFeedbackReportPath(root, date),
    markdownPath: sourceDiscoveryFeedbackReportMarkdownPath(root, date),
    jsonRelPath: sourceDiscoveryFeedbackReportRelPath(date),
    markdownRelPath: sourceDiscoveryFeedbackReportMarkdownRelPath(date)
  };
}

function candidateKey(candidate = {}) {
  return candidate.id || candidate.source_candidate_id || candidateUrl(candidate) || candidateTitle(candidate);
}

function candidatePublishedDate(candidate = {}) {
  return String(candidate.published_date || candidate.publishedAt || candidate.publishedDate || '').trim();
}

function evidenceReliabilityRank(candidate = {}) {
  const reliability = String(candidate.reliability || candidate.source_reliability || '').trim().toLowerCase();
  return ['official', 'upstream', 'project-official'].includes(reliability) ? 0 : 1;
}

function evidencePriority(candidate = {}, isCanonical = false) {
  const score = Number(candidate.source_quality_score || 0);
  return {
    canonical_rank: isCanonical ? 0 : 1,
    bucket_rank: candidate.source_quality_bucket === 'strong_candidate' ? 0 : 1,
    score: Number.isFinite(score) ? score : 0,
    reliability_rank: evidenceReliabilityRank(candidate),
    published_date: candidatePublishedDate(candidate),
    stable_key: String(candidateKey(candidate) || '')
  };
}

function compareEvidenceTargets(left, right) {
  const a = left.priority;
  const b = right.priority;
  return a.canonical_rank - b.canonical_rank ||
    a.bucket_rank - b.bucket_rank ||
    b.score - a.score ||
    a.reliability_rank - b.reliability_rank ||
    b.published_date.localeCompare(a.published_date) ||
    a.stable_key.localeCompare(b.stable_key);
}

function selectEvidenceFetchTargets(candidates = [], clusterReport = {}, options = {}) {
  const maxTargets = options.maxTargets || 12;
  const canonicalRefs = new Set();
  for (const cluster of clusterReport.clusters || []) {
    if (Number(cluster.duplicate_count || 0) <= 0) continue;
    if (cluster.canonical_url) canonicalRefs.add(`url:${cluster.canonical_url}`);
    if (cluster.canonical_title) canonicalRefs.add(`title:${cluster.canonical_title}`);
  }

  const targetMap = new Map();
  function isCanonical(candidate) {
    return canonicalRefs.has(`url:${candidateUrl(candidate)}`) ||
      canonicalRefs.has(`title:${candidateTitle(candidate)}`);
  }
  function add(candidate, canonical = false) {
    const key = candidateKey(candidate);
    if (!key) return;
    const existing = targetMap.get(key);
    targetMap.set(key, {
      candidate,
      isCanonical: canonical || existing?.isCanonical === true
    });
  }

  for (const candidate of candidates) {
    const finalEligible = ['main', 'short'].includes(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
    const qualityEligible = ['strong_candidate', 'review_candidate'].includes(candidate.source_quality_bucket);
    if (finalEligible && qualityEligible && candidate.duplicate_of_selected_source !== true) {
      add(candidate, isCanonical(candidate));
    }
  }

  for (const candidate of candidates) {
    const canonical = isCanonical(candidate);
    if (canonical && candidate.duplicate_of_selected_source !== true) {
      add(candidate, true);
    }
  }

  return [...targetMap.values()]
    .map(item => ({
      candidate: item.candidate,
      priority: evidencePriority(item.candidate, item.isCanonical)
    }))
    .sort(compareEvidenceTargets)
    .slice(0, maxTargets)
    .map(item => item.candidate);
}

function writeSeedOnlySourceDiscoveryResult({
  root,
  date,
  manualPayload,
  sourceCandidatePath,
  sourceManifestPath,
  seedExpansion,
  statusDetail = ''
}) {
  const manualCandidates = candidateItems(manualPayload);
  const seedUsed = seedExpansion?.stats?.seed_used === true;
  const mergeMode = seedUsed ? 'seed_evidence_expansion' : 'disabled_pass_through';
  const mergedCandidates = seedExpansion ? seedExpansion.mergedCandidates : manualCandidates;
  const mergedPayload = seedUsed ? candidatePayload(date, mergedCandidates, manualPayload) : manualPayload;
  const discoveryStats = sourceDiscoveryCandidateStats({
    manualCandidates,
    seedCandidates: seedExpansion?.seedCandidates || [],
    geminiCandidates: [],
    mergedCandidates
  });
  if (seedExpansion?.stats) {
    Object.assign(discoveryStats, seedExpansion.stats);
  }
  const feedback = writeSourceDiscoveryFeedbackReport(root, date, buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates,
    geminiCandidates: [],
    mergedCandidates
  }));
  const generatedAt = new Date().toISOString();
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    seedPayload: seedExpansion?.seedPayload || null,
    geminiPayload: [],
    generatedAt,
    mergeMode,
    geminiCandidateCount: 0,
    llmUsed: false,
    seedUsed,
    status: 'PASS',
    statusDetail,
    manifestSchemaVersion: seedUsed ? 2 : 1,
    discoveryStats,
    reportRefs: {
      ...(seedExpansion?.reportRefs || {}),
      source_discovery_feedback_report: feedback.jsonRelPath,
      source_discovery_feedback_report_markdown: feedback.markdownRelPath
    }
  });
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const report = renderReport({
    date,
    status: 'PASS',
    statusDetail,
    disabledPassThrough: !seedUsed,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode,
    discoveryStats,
    summary: statusDetail === SEED_ONLY_LLM_CREDENTIALS_MISSING
      ? 'Seed evidence expansion ran; Gemini discovery was skipped because LLM credentials were missing.'
      : seedUsed
        ? 'Seed evidence expansion ran without Gemini; manual candidates were merged with approved seed evidence.'
        : sourceDiscoveryStatsSummary(discoveryStats, { llmUsed: false }),
    sourceCandidateRelPath,
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    seedEvidenceRefs: seedExpansion?.reportRefs || {},
    sourceDiscoveryFeedbackReportRelPath: feedback.jsonRelPath,
    sourceDiscoveryFeedbackReportMarkdownRelPath: feedback.markdownRelPath,
    sourceDiscoveryFeedbackReport: feedback.report
  });
  const reportPath = writeReport(root, date, report);

  return {
    date,
    status: 'PASS',
    status_detail: statusDetail,
    candidate_count: mergedPayload.candidates?.length ?? candidateItems(manualPayload).length,
    source_candidate_artifact: sourceCandidateRelPath,
    source_manifest: fs.existsSync(sourceManifestPath) ? rawCandidateManifestRelPath(date) : '',
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    seed_candidate_artifact: seedExpansion?.reportRefs?.seed_candidate_artifact || '',
    seed_evidence_pack: seedExpansion?.reportRefs?.seed_evidence_pack || '',
    source_discovery_feedback_report: feedback.jsonRelPath,
    source_discovery_feedback_report_markdown: feedback.markdownRelPath,
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    manifest: result.manifest
  };
}

async function runEnabled({
  root,
  env,
  date,
  preflightOnly = false,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch,
  lookupImpl
}) {
  if (preflightOnly) {
    assertEnabledCredentials(root, date, env);
    return {
      date,
      status: 'PASS',
      preflight_only: true
    };
  }

  const sourceCandidatePath = findManualCandidatePath(root, date);
  const manualPayload = readJson(sourceCandidatePath);
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const sourceManifestPath = rawCandidateManifestPath(root, date);
  const sourceManifest = fs.existsSync(sourceManifestPath) ? readJson(sourceManifestPath) : {};
  const collectionIntent = approvedCollectionIntentFromManifest({
    root,
    date,
    manifest: sourceManifest
  });
  const hasSeedUrls = Number(collectionIntent?.seedUrlCount || 0) > 0;
  if (!hasSeedUrls) {
    assertEnabledCredentials(root, date, env, { writeReportOnFailure: false });
  }
  removeStaleNormalOutputs(root, date);

  const seedExpansion = hasSeedUrls
    ? await runSeedEvidenceExpansion({
        root,
        date,
        manualPayload,
        collectionIntent,
        fetchImpl,
        lookupImpl
      })
    : null;
  const credentialError = hasSeedUrls ? enabledCredentialsError(env) : null;
  if (credentialError) {
    return writeSeedOnlySourceDiscoveryResult({
      root,
      date,
      manualPayload,
      sourceCandidatePath,
      sourceManifestPath,
      seedExpansion,
      statusDetail: SEED_ONLY_LLM_CREDENTIALS_MISSING
    });
  }
  const budget = createGeminiUsageBudget({ root });
  const discovery = await runGeminiSourceDiscovery({
    root,
    date,
    manualPayload,
    budget,
    proposalPayload,
    callLlmJsonBudgetedImpl,
    fetchImpl
  });
  const manualCandidates = candidateItems(manualPayload);
  const seedCandidates = seedExpansion?.seedCandidates || [];
  const geminiCandidates = discovery.promotedCandidates;

  // #429: linked evidence expansion. 수동 후보에 이미 보존된 outgoing_links에서 아직 모르는
  // 공식/등록 도메인 링크를 골라 Gemini(sourceDiscovery 단계)가 뉴스레터 가치를 판정하고,
  // 통과한 링크를 origin=gemini_linked_discovery 파생 후보로 만들어 동일 selection 게이트에
  // 흘려보낸다. extract-only, non-failing.
  const sourceRegistryPath = path.join(root, 'data', 'news-sources.json');
  const sourceRegistry = fs.existsSync(sourceRegistryPath)
    ? readJson(sourceRegistryPath)
    : { sources: [] };
  const linkedExpansion = await expandLinkedEvidenceCandidates({
    date,
    manualCandidates,
    sourceRegistry,
    callLlmJsonBudgetedImpl,
    budget,
    enabled: true
  });
  const derivedCandidates = linkedExpansion.derivedCandidates;

  const mergedInput = [
    ...(seedExpansion ? seedExpansion.mergedCandidates : manualCandidates),
    ...geminiCandidates,
    ...derivedCandidates
  ];
  const seedUsed = seedExpansion?.stats?.seed_used === true;
  const mergeMode = seedUsed ? 'seed_evidence_plus_gemini_discovery' : 'gemini_source_discovery';

  const scored = scoreSourceCandidates(mergedInput, { newsletterDate: date });
  writeJson(sourceQualityReportPath(root, date), scored.report);
  fs.writeFileSync(sourceQualityReportMarkdownPath(root, date), renderSourceQualityMarkdown(scored.report), 'utf8');

  const clustered = checkSourceDuplicates(scored.annotatedCandidates, { newsletterDate: date });
  writeJson(sourceClustersPath(root, date), clustered.report);

  const evidenceFetchTargets = selectEvidenceFetchTargets(clustered.annotatedCandidates, clustered.report, { maxTargets: 12 });
  const sourceFacts = await extractSourceFacts(evidenceFetchTargets, {
    fetch: true,
    fetchImpl,
    timeoutMs: 5000,
    maxBytes: 200000,
    metadataFallback: false
  });
  writeJson(extractedSourceFactsPath(root, date), sourceFacts);

  const evidence = validateCandidateEvidence(clustered.annotatedCandidates, sourceFacts, { newsletterDate: date });
  writeJson(evidenceValidationReportPath(root, date), evidence.report);

  const usageReport = budget.writeReport(geminiUsageReportPath(root, date), {
    date,
    calls: discovery.calls
  });

  const geminiAnnotatedCandidates = evidence.annotatedCandidates.filter(item => item.origin === 'gemini_discovery');
  const derivedAnnotatedCandidates = evidence.annotatedCandidates.filter(item => item.origin === 'gemini_linked_discovery');
  const discoveryStats = sourceDiscoveryCandidateStats({
    manualCandidates,
    seedCandidates,
    geminiCandidates: geminiAnnotatedCandidates,
    derivedCandidates: derivedAnnotatedCandidates,
    mergedCandidates: evidence.annotatedCandidates,
    linkedDiscoveryStatus: linkedExpansion.stats.linked_discovery_status
  });
  if (seedExpansion?.stats) {
    Object.assign(discoveryStats, seedExpansion.stats);
  }
  const feedback = writeSourceDiscoveryFeedbackReport(root, date, buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates,
    geminiCandidates: geminiAnnotatedCandidates,
    mergedCandidates: evidence.annotatedCandidates,
    proposalValidations: discovery.proposalValidationReport.validations
  }));
  const mergedPayload = candidatePayload(date, evidence.annotatedCandidates, manualPayload);
  const geminiPayload = candidatePayload(date, geminiAnnotatedCandidates, {
    failures: discovery.rejectedProposals
  });
  const generatedAt = new Date().toISOString();
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    seedPayload: seedExpansion?.seedPayload || null,
    geminiPayload,
    generatedAt,
    mergeMode,
    geminiCandidateCount: geminiPayload.candidates.length,
    llmUsed: true,
    seedUsed,
    status: 'PASS',
    manifestSchemaVersion: 2,
    discoveryStats,
    reportRefs: {
      usage_report: geminiUsageReportRelPath(date),
      proposal_validation_report: geminiSourceProposalValidationReportRelPath(date),
      source_quality_report: sourceQualityReportRelPath(date),
      source_quality_report_markdown: sourceQualityReportMarkdownRelPath(date),
      source_clusters: sourceClustersRelPath(date),
      evidence_validation_report: evidenceValidationReportRelPath(date),
      ...(seedExpansion?.reportRefs || {}),
      source_discovery_feedback_report: feedback.jsonRelPath,
      source_discovery_feedback_report_markdown: feedback.markdownRelPath
    }
  });
  const report = renderReport({
    date,
    status: 'PASS',
    disabledPassThrough: false,
    llmUsed: true,
    geminiCandidateCount: geminiPayload.candidates.length,
    mergeMode,
    discoveryStats,
    summary: sourceDiscoveryStatsSummary(discoveryStats, { llmUsed: true }),
    sourceCandidateRelPath,
    proposalRelPath: geminiSourceProposalsRelPath(date),
    proposalValidationReportRelPath: geminiSourceProposalValidationReportRelPath(date),
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    usageReportRelPath: geminiUsageReportRelPath(date),
    sourceQualityReportRelPath: sourceQualityReportRelPath(date),
    sourceClustersRelPath: sourceClustersRelPath(date),
    evidenceValidationReportRelPath: evidenceValidationReportRelPath(date),
    seedEvidenceRefs: seedExpansion?.reportRefs || {},
    sourceDiscoveryFeedbackReportRelPath: feedback.jsonRelPath,
    sourceDiscoveryFeedbackReportMarkdownRelPath: feedback.markdownRelPath,
    sourceDiscoveryFeedbackReport: feedback.report,
    rejectedProposals: discovery.rejectedProposals
  });
  const reportPath = writeReport(root, date, report);

  return {
    date,
    status: 'PASS',
    candidate_count: mergedPayload.candidates.length,
    source_candidate_artifact: sourceCandidateRelPath,
    source_manifest: fs.existsSync(sourceManifestPath) ? rawCandidateManifestRelPath(date) : '',
    gemini_source_proposals: geminiSourceProposalsRelPath(date),
    proposal_validation_report: geminiSourceProposalValidationReportRelPath(date),
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    seed_candidate_artifact: seedExpansion?.reportRefs?.seed_candidate_artifact || '',
    seed_evidence_pack: seedExpansion?.reportRefs?.seed_evidence_pack || '',
    source_discovery_feedback_report: feedback.jsonRelPath,
    source_discovery_feedback_report_markdown: feedback.markdownRelPath,
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    usageReport,
    manifest: result.manifest
  };
}

async function run({
  root = process.cwd(),
  env = process.env,
  date: inputDate = '',
  preflightOnly = false,
  dryRun = false,
  proposalPayload = null,
  callLlmJsonBudgetedImpl = null,
  fetchImpl = globalThis.fetch,
  lookupImpl
} = {}) {
  const runtimeConfig = readRuntimeConfig(env);
  const date = inputDate || runtimeConfig.newsletterDate || kstDate();

  if (runtimeConfig.newsroomEnableGeminiSourceDiscovery) {
    return runEnabled({
      root,
      env,
      date,
      preflightOnly,
      proposalPayload,
      callLlmJsonBudgetedImpl,
      fetchImpl,
      lookupImpl
    });
  }

  const sourceCandidatePath = findManualCandidatePath(root, date);
  const payload = readJson(sourceCandidatePath);
  const manualCandidates = candidateItems(payload);
  const sourceManifestPath = rawCandidateManifestPath(root, date);
  const sourceManifest = fs.existsSync(sourceManifestPath) ? readJson(sourceManifestPath) : {};

  if (dryRun) {
    // --dry-run: 가드는 실행했으므로 여기서 종료. git-tracked RRC 파일을 덮어쓰지 않음.
    process.stderr.write('[dry-run] disabled-passthrough 모드 가드 통과. 파일 write를 건너뜁니다.\n');
    return {
      date,
      status: 'PASS',
      dry_run: true,
      candidate_count: manualCandidates.length,
      source_candidate_artifact: sourceCandidatePath.endsWith('manual-candidates.json')
        ? manualCandidatesRelPath(date)
        : collectedCandidatesRelPath(date)
    };
  }

  removeStaleNormalOutputs(root, date);
  const collectionIntent = approvedCollectionIntentFromManifest({
    root,
    date,
    manifest: sourceManifest
  });
  const hasSeedUrls = Number(collectionIntent?.seedUrlCount || 0) > 0;
  const seedExpansion = hasSeedUrls
    ? await runSeedEvidenceExpansion({
        root,
        date,
        manualPayload: payload,
        collectionIntent,
        fetchImpl,
        lookupImpl
      })
    : null;
  const seedUsed = seedExpansion?.stats?.seed_used === true;
  const mergeMode = seedUsed ? 'seed_evidence_expansion' : 'disabled_pass_through';
  const mergedCandidates = seedExpansion ? seedExpansion.mergedCandidates : manualCandidates;
  const mergedPayload = seedUsed ? candidatePayload(date, mergedCandidates, payload) : payload;
  const generatedAt = new Date().toISOString();
  const discoveryStats = sourceDiscoveryCandidateStats({
    manualCandidates,
    seedCandidates: seedExpansion?.seedCandidates || [],
    geminiCandidates: [],
    mergedCandidates
  });
  if (seedExpansion?.stats) {
    Object.assign(discoveryStats, seedExpansion.stats);
  }
  const result = writeMergedCandidateArtifacts({
    root,
    date,
    payload: mergedPayload,
    sourceCandidatePath,
    sourceManifestPath,
    seedPayload: seedExpansion?.seedPayload || null,
    geminiPayload: [],
    generatedAt,
    mergeMode,
    geminiCandidateCount: 0,
    llmUsed: false,
    seedUsed,
    status: 'PASS',
    manifestSchemaVersion: seedUsed ? 2 : 1,
    discoveryStats,
    reportRefs: seedExpansion?.reportRefs || {}
  });
  const feedback = writeSourceDiscoveryFeedbackReport(root, date, buildSourceDiscoveryFeedbackReport({
    date,
    manualCandidates,
    geminiCandidates: [],
    mergedCandidates
  }));
  const sourceCandidateRelPath = sourceCandidatePath.endsWith('manual-candidates.json')
    ? manualCandidatesRelPath(date)
    : collectedCandidatesRelPath(date);
  const report = renderReport({
    date,
    status: 'PASS',
    disabledPassThrough: !seedUsed,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode,
    discoveryStats,
    summary: seedUsed
      ? 'Seed evidence expansion ran without Gemini; manual candidates were merged with approved seed evidence.'
      : sourceDiscoveryStatsSummary(discoveryStats, { llmUsed: false }),
    sourceCandidateRelPath,
    geminiCandidateRelPath: geminiCandidatesRelPath(date),
    mergedCandidateRelPath: mergedCandidatesRelPath(date),
    manifestRelPath: mergedCandidateManifestRelPath(date),
    seedEvidenceRefs: seedExpansion?.reportRefs || {},
    sourceDiscoveryFeedbackReportRelPath: feedback.jsonRelPath,
    sourceDiscoveryFeedbackReportMarkdownRelPath: feedback.markdownRelPath,
    sourceDiscoveryFeedbackReport: feedback.report
  });
  const reportPath = writeReport(root, date, report);

  return {
    date,
    status: 'PASS',
    candidate_count: candidateItems(payload).length,
    source_candidate_artifact: sourceCandidateRelPath,
    source_manifest: fs.existsSync(sourceManifestPath) ? rawCandidateManifestRelPath(date) : '',
    gemini_candidate_artifact: geminiCandidatesRelPath(date),
    merged_candidate_artifact: mergedCandidatesRelPath(date),
    merged_candidate_manifest: mergedCandidateManifestRelPath(date),
    seed_candidate_artifact: seedExpansion?.reportRefs?.seed_candidate_artifact || '',
    seed_evidence_pack: seedExpansion?.reportRefs?.seed_evidence_pack || '',
    source_discovery_feedback_report: feedback.jsonRelPath,
    source_discovery_feedback_report_markdown: feedback.markdownRelPath,
    report: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
    reportPath,
    manifest: result.manifest
  };
}

if (require.main === module) {
  Promise.resolve()
    .then(() => {
      const args = parseArgs();
      return run({ date: args.date, preflightOnly: args.preflightOnly, dryRun: args.dryRun });
    })
    .then((result) => {
      if (result.preflight_only) {
        console.log('Gemini source discovery credential preflight passed.');
        return;
      }
      if (result.dry_run) {
        console.log(`[dry-run] 가드 통과. candidate_count=${result.candidate_count}. 파일은 변경되지 않았습니다.`);
        return;
      }
      console.log(`Gemini source discovery wrote ${result.merged_candidate_artifact}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  FAILED_LLM_CREDENTIALS,
  SEED_ONLY_LLM_CREDENTIALS_MISSING,
  buildSourceDiscoveryFeedbackReport,
  findManualCandidatePath,
  normalizeRejectedReason,
  parseArgs,
  rejectedReasonSummary,
  renderReport,
  renderSourceDiscoveryFeedbackMarkdown,
  run,
  selectEvidenceFetchTargets,
  sourceDiscoveryHandoff
};
