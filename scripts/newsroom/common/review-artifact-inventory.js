const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  collectionIntentRelPath,
  collectedCandidatesRelPath,
  geminiCandidatesRelPath,
  manualCandidatesRelPath,
  mergedCandidateManifestRelPath,
  mergedCandidatesRelPath,
  newsroomRelPath,
  rawCandidateManifestRelPath,
  seedCandidatesRelPath,
  seedEvidencePackRelPath,
  seedFetchReportMarkdownRelPath,
  seedFetchReportRelPath,
  seedEvidencePackMarkdownRelPath,
  seedMergeReportMarkdownRelPath,
  seedMergeReportRelPath,
  toPosix
} = require('./artifact-paths');

const REVIEW_ARTIFACT_SCHEMA_VERSION = 2;

const REQUIRED_ALWAYS = 'always';
const REQUIRED_WHEN_SEED_USED = 'when_seed_used';
const REQUIRED_WHEN_PUBLIC_OUTPUT = 'when_public_output';
const REQUIRED_OPTIONAL = 'optional';

const GROUPS = [
  { group: 'editorial_brief', label: '편집장 브리프', review_order: 10 },
  { group: 'seed_evidence', label: 'Seed 근거 요약', review_order: 20 },
  { group: 'public_output', label: '최종 기사 / 공개 출력', review_order: 30 },
  { group: 'gate_reports', label: '사실성 / 품질 / HAL 게이트', review_order: 40 },
  { group: 'selection_diagnostics', label: '후보 선정 진단', review_order: 50 },
  { group: 'check_when_needed', label: '필요 시 확인', review_order: 60 },
  { group: 'debug_evidence', label: '디버그 근거', review_order: 90 },
  { group: 'unknown_artifacts', label: '미분류 산출물', review_order: 95 }
];

const GROUP_LABELS = Object.fromEntries(GROUPS.map(group => [group.group, group.label]));
const GROUP_ORDER = Object.fromEntries(GROUPS.map(group => [group.group, group.review_order]));

function repoPath(...segments) {
  return toPosix(path.join(...segments));
}

function fileExists(root, relPath) {
  return fs.existsSync(path.join(root, ...relPath.split('/')));
}

function readJsonIfExists(root, relPath) {
  const filePath = path.join(root, ...relPath.split('/'));
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function statArtifact(root, relPath) {
  const filePath = path.join(root, ...relPath.split('/'));
  if (!fs.existsSync(filePath)) {
    return { size: null, sha256: null };
  }
  const stat = fs.statSync(filePath);
  return {
    size: stat.size,
    sha256: hashFile(filePath)
  };
}

function normalizeChangedArtifacts(changedArtifacts = []) {
  return new Set((Array.isArray(changedArtifacts) ? changedArtifacts : [])
    .map(item => toPosix(String(item || '')))
    .filter(Boolean));
}

function isMarkdownLike(relPath) {
  return /\.(?:md|markdown|txt|html)$/i.test(relPath);
}

function isArtifactManifest(relPath) {
  return path.basename(String(relPath || '')) === 'artifact-manifest.json';
}

function isSeedArtifact(relPath, date) {
  const normalized = toPosix(relPath);
  const seedPaths = new Set([
    collectionIntentRelPath(date),
    seedCandidatesRelPath(date),
    seedEvidencePackRelPath(date),
    seedFetchReportRelPath(date),
    seedFetchReportMarkdownRelPath(date),
    seedEvidencePackMarkdownRelPath(date),
    seedMergeReportRelPath(date),
    seedMergeReportMarkdownRelPath(date)
  ]);
  return seedPaths.has(normalized);
}

function booleanFrom(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function deriveSeedUsed(root, date, runContext = {}) {
  const explicit = booleanFrom(runContext.seedUsed);
  if (explicit !== null) return explicit;

  const status = readJsonIfExists(root, newsroomRelPath(date, 'generation-status.json')) ||
    readJsonIfExists(root, '.tmp/newsletter-generation-status.json') ||
    {};
  const statusSeed = booleanFrom(status.seed_used ?? status.candidate_input?.seed_used);
  if (statusSeed !== null) return statusSeed;

  const mergedManifest = readJsonIfExists(root, mergedCandidateManifestRelPath(date));
  return mergedManifest?.seed_used === true || mergedManifest?.seed_used === 'true';
}

function derivePublicOutputExpected(runContext = {}) {
  const explicit = booleanFrom(runContext.publicOutputExpected);
  return explicit === null ? false : explicit;
}

function deriveStatusLabel(root, date, runContext = {}) {
  if (runContext.status !== undefined && runContext.status !== null && runContext.status !== '') {
    return String(runContext.status);
  }
  const status = readJsonIfExists(root, newsroomRelPath(date, 'generation-status.json')) ||
    readJsonIfExists(root, '.tmp/newsletter-generation-status.json') ||
    {};
  return String(status.status || 'unknown');
}

function requiredActive(required, context, derived) {
  if (derived) return false;
  if (required === REQUIRED_ALWAYS) return true;
  if (required === REQUIRED_WHEN_SEED_USED) return context.seedUsed === true;
  if (required === REQUIRED_WHEN_PUBLIC_OUTPUT) return context.publicOutputExpected === true;
  return false;
}

function entry({
  relPath,
  group,
  role,
  required = REQUIRED_OPTIONAL,
  reviewOrder,
  humanReadable = null,
  reviewBlocking = false,
  reviewBlockingWhenPresent = false,
  reviewAttentionRequired = false,
  derived = false
}) {
  return {
    path: relPath,
    group,
    label: GROUP_LABELS[group] || group,
    role,
    required,
    review_order: reviewOrder,
    human_readable: humanReadable === null ? isMarkdownLike(relPath) : Boolean(humanReadable),
    review_blocking: Boolean(reviewBlocking),
    review_blocking_when_present: Boolean(reviewBlockingWhenPresent),
    review_attention_required: Boolean(reviewAttentionRequired),
    derived: Boolean(derived)
  };
}

function exactCatalog(date) {
  return [
    entry({
      relPath: newsroomRelPath(date, '00-review-guide.md'),
      group: 'editorial_brief',
      role: 'generated_summary',
      reviewOrder: 10,
      humanReadable: true,
      reviewBlocking: true,
      derived: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'editor-in-chief-brief.md'),
      group: 'editorial_brief',
      role: 'must_read',
      required: REQUIRED_ALWAYS,
      reviewOrder: 11,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: seedEvidencePackMarkdownRelPath(date),
      group: 'seed_evidence',
      role: 'must_read',
      required: REQUIRED_WHEN_SEED_USED,
      reviewOrder: 20,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: seedMergeReportMarkdownRelPath(date),
      group: 'seed_evidence',
      role: 'must_read',
      required: REQUIRED_WHEN_SEED_USED,
      reviewOrder: 21,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: `newsletters/${date}/newsletter.md`,
      group: 'public_output',
      role: 'public_markdown',
      required: REQUIRED_WHEN_PUBLIC_OUTPUT,
      reviewOrder: 30,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: `newsletters/${date}/index.html`,
      group: 'public_output',
      role: 'public_html',
      required: REQUIRED_WHEN_PUBLIC_OUTPUT,
      reviewOrder: 31,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: 'data/newsletters.json',
      group: 'public_output',
      role: 'public_index',
      required: REQUIRED_WHEN_PUBLIC_OUTPUT,
      reviewOrder: 32,
      humanReadable: false,
      reviewBlocking: true
    }),
    entry({
      relPath: 'data/homepage-headline.json',
      group: 'public_output',
      role: 'homepage_state',
      reviewOrder: 33,
      humanReadable: false
    }),
    entry({
      relPath: 'data/article-exposure-history.json',
      group: 'public_output',
      role: 'exposure_state',
      reviewOrder: 34,
      humanReadable: false
    }),
    entry({
      relPath: newsroomRelPath(date, 'fact-check-report.md'),
      group: 'gate_reports',
      role: 'fact_check',
      required: REQUIRED_ALWAYS,
      reviewOrder: 40,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'quality-report.md'),
      group: 'gate_reports',
      role: 'quality_gate',
      required: REQUIRED_ALWAYS,
      reviewOrder: 41,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'hal-signal-quality-report.md'),
      group: 'gate_reports',
      role: 'hal_signal_gate',
      required: REQUIRED_ALWAYS,
      reviewOrder: 42,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'stale-claim-report.md'),
      group: 'gate_reports',
      role: 'stale_claim_gate',
      reviewOrder: 43,
      humanReadable: true,
      reviewBlocking: true,
      reviewBlockingWhenPresent: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'image-audit-report.md'),
      group: 'gate_reports',
      role: 'image_audit',
      reviewOrder: 44,
      humanReadable: true,
      reviewBlocking: true,
      reviewBlockingWhenPresent: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'source-quality-report.md'),
      group: 'gate_reports',
      role: 'source_quality',
      reviewOrder: 45,
      humanReadable: true,
      reviewBlocking: true,
      reviewBlockingWhenPresent: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'selection-diagnostics.md'),
      group: 'selection_diagnostics',
      role: 'selection_diagnostics',
      required: REQUIRED_ALWAYS,
      reviewOrder: 50,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'selection-report.md'),
      group: 'selection_diagnostics',
      role: 'selection_report',
      required: REQUIRED_ALWAYS,
      reviewOrder: 51,
      humanReadable: true,
      reviewBlocking: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'source-quality-diagnosis.md'),
      group: 'selection_diagnostics',
      role: 'source_quality_diagnosis',
      reviewOrder: 52,
      humanReadable: true
    }),
    entry({
      relPath: seedFetchReportMarkdownRelPath(date),
      group: 'check_when_needed',
      role: 'check_when_needed',
      required: REQUIRED_WHEN_SEED_USED,
      reviewOrder: 60,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'recovery-prompt.md'),
      group: 'check_when_needed',
      role: 'recovery_prompt',
      reviewOrder: 61,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'release-qa-report.md'),
      group: 'check_when_needed',
      role: 'release_qa',
      reviewOrder: 62,
      humanReadable: true,
      derived: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'retry-history.md'),
      group: 'check_when_needed',
      role: 'retry_history',
      reviewOrder: 63,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'linked-evidence-diagnostics.md'),
      group: 'check_when_needed',
      role: 'linked_evidence_diagnostics',
      reviewOrder: 64,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'event-bundle-diagnostics.md'),
      group: 'check_when_needed',
      role: 'event_bundle_diagnostics',
      reviewOrder: 65,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'source-effectiveness-report.md'),
      group: 'check_when_needed',
      role: 'source_effectiveness',
      reviewOrder: 66,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'source-discovery-feedback-report.md'),
      group: 'check_when_needed',
      role: 'source_discovery_feedback',
      reviewOrder: 67,
      humanReadable: true
    }),
    entry({
      relPath: newsroomRelPath(date, 'gemini-source-discovery-report.md'),
      group: 'check_when_needed',
      role: 'source_discovery_report',
      reviewOrder: 68,
      humanReadable: true
    }),
    ...debugExactCatalog(date)
  ];
}

function debugExactCatalog(date) {
  const debugFiles = [
    collectionIntentRelPath(date),
    manualCandidatesRelPath(date),
    collectedCandidatesRelPath(date),
    rawCandidateManifestRelPath(date),
    mergedCandidatesRelPath(date),
    mergedCandidateManifestRelPath(date),
    geminiCandidatesRelPath(date),
    seedCandidatesRelPath(date),
    seedEvidencePackRelPath(date),
    seedFetchReportRelPath(date),
    seedMergeReportRelPath(date),
    newsroomRelPath(date, 'artifact-manifest.json'),
    newsroomRelPath(date, 'generation-status.json'),
    newsroomRelPath(date, 'reporter-candidates.json'),
    newsroomRelPath(date, 'editor-draft.json'),
    newsroomRelPath(date, 'editor-draft.md'),
    newsroomRelPath(date, 'fact-check-report.json'),
    newsroomRelPath(date, 'quality-report.json'),
    newsroomRelPath(date, 'hal-signal-quality-report.json'),
    newsroomRelPath(date, 'stale-claim-report.json'),
    newsroomRelPath(date, 'retry-history.json'),
    newsroomRelPath(date, 'shortlisted-candidates.json'),
    newsroomRelPath(date, 'selection-report.json'),
    newsroomRelPath(date, 'linked-evidence-report.json'),
    newsroomRelPath(date, 'event-bundles.json'),
    newsroomRelPath(date, 'article-capsules.json'),
    newsroomRelPath(date, 'background-context.json'),
    newsroomRelPath(date, 'evidence-pack-summary.json'),
    newsroomRelPath(date, 'image-audit-report.json'),
    newsroomRelPath(date, 'source-quality-report.json'),
    newsroomRelPath(date, 'source-quality-diagnosis.json'),
    newsroomRelPath(date, 'source-effectiveness-report.json'),
    newsroomRelPath(date, 'source-discovery-feedback-report.json'),
    newsroomRelPath(date, 'source-clusters.json'),
    newsroomRelPath(date, 'gemini-source-proposals.json'),
    newsroomRelPath(date, 'gemini-source-proposal-validation-report.json'),
    newsroomRelPath(date, 'gemini-usage-report.json'),
    newsroomRelPath(date, 'extracted-source-facts.json'),
    newsroomRelPath(date, 'evidence-validation-report.json'),
    newsroomRelPath(date, 'fallback-public-issue.json'),
    newsroomRelPath(date, 'fallback-public-issue-diagnostics.json'),
    newsroomRelPath(date, 'cost-report.md'),
    newsroomRelPath(date, 'summary-cache-report.md'),
    newsroomRelPath(date, 'summary-cache-report.json'),
    repoPath('content', 'source-events', date, 'source-change-events.md'),
    repoPath('content', 'source-events', date, 'source-change-events.json')
  ];
  return debugFiles.map((relPath, index) => entry({
    relPath,
    group: isArtifactManifest(relPath) ? 'debug_evidence' : 'debug_evidence',
    role: isArtifactManifest(relPath) ? 'artifact_manifest' : 'debug_json',
    reviewOrder: isArtifactManifest(relPath) ? 92 : 90 + (index / 1000),
    humanReadable: isMarkdownLike(relPath),
    derived: isArtifactManifest(relPath)
  }));
}

function dynamicClassification(date, relPath) {
  const prefix = `content/newsroom/${date}/`;
  if (!relPath.startsWith(prefix)) return null;
  const filename = relPath.slice(prefix.length);
  const dynamicPatterns = [
    /^reporter-candidates-attempt-\d+\.json$/,
    /^editor-draft-attempt-\d+\.(?:json|md)$/,
    /^editor-(?:invalid|validation-error)(?:-repair)?-attempt-\d+\.json$/,
    /^editor-(?:repair|completion)-attempt-\d+\.(?:json|md)$/,
    /^editor-repair-sections-attempt-\d+\.json$/,
    /^fact-check-report-attempt-\d+\.(?:json|md)$/,
    /^fact-check-(?:repair|completion)-attempt-\d+\.(?:json|md)$/,
    /^quality-report-attempt-\d+\.(?:json|md)$/,
    /^quality-report-(?:repair|completion)-attempt-\d+\.(?:json|md)$/,
    /^quality-report-completion-attempt-\d+\.json$/,
    /^fact-check-completion-attempt-\d+\.json$/
  ];
  if (!dynamicPatterns.some(pattern => pattern.test(filename))) return null;
  return entry({
    relPath,
    group: 'debug_evidence',
    role: 'debug_attempt',
    reviewOrder: 91,
    humanReadable: isMarkdownLike(relPath)
  });
}

function walkFiles(root, dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkFiles(root, filePath, files);
    } else if (item.isFile()) {
      files.push(toPosix(path.relative(root, filePath)));
    }
  }
  return files;
}

function scannedReviewPaths(root, date) {
  const paths = [];
  const dirs = [
    repoPath('content', 'newsroom', date),
    repoPath('content', 'collected-news', date),
    repoPath('content', 'source-events', date),
    repoPath('newsletters', date)
  ];
  for (const dir of dirs) {
    walkFiles(root, path.join(root, ...dir.split('/')), paths);
  }
  for (const relPath of ['data/newsletters.json', 'data/homepage-headline.json', 'data/article-exposure-history.json']) {
    if (fileExists(root, relPath)) paths.push(relPath);
  }
  return [...new Set(paths.map(toPosix))]
    .filter(relPath => !shouldIgnoreScannedArtifact(relPath))
    .sort();
}

function shouldIgnoreScannedArtifact(relPath) {
  const normalized = toPosix(relPath);
  const name = normalized.split('/').pop();
  return name === '.DS_Store' ||
    name === 'Thumbs.db' ||
    name === 'artifact-manifest.json' ||
    name.endsWith('.tmp') ||
    name.endsWith('.bak');
}

function classifyUnknown(relPath) {
  return entry({
    relPath,
    group: 'unknown_artifacts',
    role: 'unclassified',
    reviewOrder: GROUP_ORDER.unknown_artifacts,
    humanReadable: isMarkdownLike(relPath),
    reviewAttentionRequired: true
  });
}

function materializeEntry(root, date, catalogEntry, context, changedSet) {
  const present = fileExists(root, catalogEntry.path);
  const active = requiredActive(catalogEntry.required, context, catalogEntry.derived);
  const staleSeedArtifact = !context.seedUsed && present && isSeedArtifact(catalogEntry.path, date);
  const missingRequired = active && !present;
  const derivedMissing = catalogEntry.derived && !present;
  const recoveryPromptAttention = shouldRequireRecoveryPromptAttention({ catalogEntry, context, present });
  const recoveryPromptMissing = recoveryPromptAttention && !present;
  const stat = statArtifact(root, catalogEntry.path);
  const reviewBlocking = catalogEntry.derived
    ? present && catalogEntry.review_blocking
    : catalogEntry.review_blocking &&
      !staleSeedArtifact &&
      (active || (present && catalogEntry.review_blocking_when_present));
  const warning = artifactWarning({
    staleSeedArtifact,
    derivedMissing,
    recoveryPromptMissing,
    missingRequired
  });

  return {
    path: catalogEntry.path,
    group: catalogEntry.group,
    label: catalogEntry.label || GROUP_LABELS[catalogEntry.group] || catalogEntry.group,
    role: catalogEntry.role,
    required: catalogEntry.required,
    requiredActive: active,
    present,
    human_readable: catalogEntry.human_readable,
    review_blocking: Boolean(reviewBlocking),
    review_attention_required: Boolean(
      catalogEntry.review_attention_required ||
      missingRequired ||
      staleSeedArtifact ||
      derivedMissing ||
      recoveryPromptAttention
    ),
    review_order: catalogEntry.review_order,
    changed: changedSet.has(catalogEntry.path),
    derived: catalogEntry.derived,
    size: present ? stat.size : null,
    sha256: present ? stat.sha256 : null,
    ...(warning ? { warning } : {})
  };
}

function artifactWarning({
  staleSeedArtifact,
  derivedMissing,
  recoveryPromptMissing,
  missingRequired
}) {
  if (staleSeedArtifact) {
    return {
      code: 'seed_artifact_present_without_seed',
      message: 'Seed artifact exists even though runContext.seedUsed=false.'
    };
  }
  if (derivedMissing) {
    return {
      code: 'derived_artifact_missing',
      message: 'Derived review artifact is missing.'
    };
  }
  if (recoveryPromptMissing) {
    return {
      code: 'recovery_prompt_missing_for_reviewable_failure',
      message: 'Recovery prompt is missing for a failure or reviewable run.'
    };
  }
  if (missingRequired) {
    return {
      code: 'required_artifact_missing',
      message: 'Required review artifact is missing for this run context.'
    };
  }
  return undefined;
}

function shouldRequireRecoveryPromptAttention({ catalogEntry, context, present }) {
  if (catalogEntry.role !== 'recovery_prompt') return false;
  if (present) return true;
  if (context.recoveryPromptExpected === true) return true;
  return isFailureOrReviewableStatus(context.status);
}

function isFailureOrReviewableStatus(status) {
  const normalized = String(status || '').toUpperCase();
  return normalized.includes('FAILED') ||
    normalized.includes('NEEDS_FIX') ||
    normalized.includes('REVIEWABLE');
}

function sortArtifacts(artifacts) {
  return artifacts.sort((left, right) =>
    Number(left.review_order) - Number(right.review_order) ||
    left.group.localeCompare(right.group) ||
    left.path.localeCompare(right.path)
  );
}

function buildGroups(artifacts) {
  return GROUPS
    .map(group => ({
      group: group.group,
      label: group.label,
      review_order: group.review_order,
      artifacts: artifacts.filter(artifact => artifact.group === group.group)
    }))
    .filter(group => group.artifacts.length > 0);
}

function buildReviewArtifactInventory({
  root = process.cwd(),
  date,
  changedArtifacts = [],
  runContext = {}
} = {}) {
  if (!date) {
    throw new Error('buildReviewArtifactInventory requires date');
  }
  const context = {
    seedUsed: deriveSeedUsed(root, date, runContext),
    publicOutputExpected: derivePublicOutputExpected(runContext),
    status: deriveStatusLabel(root, date, runContext),
    recoveryPromptExpected: booleanFrom(runContext.recoveryPromptExpected) === true
  };
  const changedSet = normalizeChangedArtifacts(changedArtifacts);
  const exactEntries = exactCatalog(date);
  const byPath = new Map(exactEntries.map(item => [item.path, item]));
  for (const relPath of scannedReviewPaths(root, date)) {
    if (byPath.has(relPath)) continue;
    const dynamic = dynamicClassification(date, relPath);
    byPath.set(relPath, dynamic || classifyUnknown(relPath));
  }
  const reviewArtifacts = sortArtifacts([...byPath.values()].map(item =>
    materializeEntry(root, date, item, context, changedSet)
  ));
  const missingRequired = reviewArtifacts.filter(artifact =>
    artifact.requiredActive && !artifact.present && !artifact.derived
  );
  const summary = {
    total: reviewArtifacts.length,
    present: reviewArtifacts.filter(artifact => artifact.present).length,
    missing: reviewArtifacts.filter(artifact => !artifact.present).length,
    missingRequired: missingRequired.length,
    reviewBlocking: reviewArtifacts.filter(artifact => artifact.review_blocking).length,
    attentionRequired: reviewArtifacts.filter(artifact => artifact.review_attention_required).length,
    seedUsed: context.seedUsed,
    publicOutputExpected: context.publicOutputExpected,
    status: context.status
  };

  return {
    schemaVersion: REVIEW_ARTIFACT_SCHEMA_VERSION,
    date,
    seedUsed: context.seedUsed,
    publicOutputExpected: context.publicOutputExpected,
    status: context.status,
    review_artifacts: reviewArtifacts,
    groups: buildGroups(reviewArtifacts),
    missingRequired,
    summary
  };
}

function artifactStatusText(artifact) {
  if (artifact.present) return artifact.changed ? 'changed' : 'present';
  if (artifact.requiredActive) return 'missing required';
  return 'missing optional';
}

function artifactLine(artifact) {
  const warning = artifact.warning?.code ? ` (${artifact.warning.code})` : '';
  return `- \`${artifact.path}\` - ${artifactStatusText(artifact)}${warning}`;
}

function renderReviewGuideMarkdown(inventory) {
  const lines = [
    `# 산출물 리뷰 가이드 - ${inventory.date}`,
    '',
    '## 요약',
    '',
    `- seed_used: ${inventory.seedUsed ? 'true' : 'false'}`,
    `- public_output_expected: ${inventory.publicOutputExpected ? 'true' : 'false'}`,
    `- status: ${inventory.status}`,
    `- present: ${inventory.summary.present}/${inventory.summary.total}`,
    `- missing_required: ${inventory.summary.missingRequired}`,
    `- attention_required: ${inventory.summary.attentionRequired}`,
    '',
    '## 읽는 순서',
    '',
    '1. 편집장 브리프',
    '2. Seed 근거 요약',
    '3. 최종 기사 / 공개 출력',
    '4. 사실성 / 품질 / HAL 게이트',
    '5. 후보 선정 진단',
    '6. 필요 시 확인',
    '7. 디버그 근거',
    '8. 미분류 산출물'
  ];

  for (const group of inventory.groups) {
    const visibleArtifacts = group.artifacts.filter(artifact =>
      artifact.present || artifact.requiredActive || artifact.review_attention_required
    );
    if (visibleArtifacts.length === 0) continue;
    lines.push('', `## ${group.label}`, '');
    lines.push(...visibleArtifacts.map(artifactLine));
  }

  if (inventory.missingRequired.length > 0) {
    lines.push('', '## 누락된 필수 확인 산출물', '');
    lines.push(...inventory.missingRequired.map(artifactLine));
  }

  const warnings = inventory.review_artifacts.filter(artifact => artifact.warning);
  if (warnings.length > 0) {
    lines.push('', '## 주의 필요', '');
    lines.push(...warnings.map(artifact =>
      `- \`${artifact.path}\`: ${artifact.warning.code} - ${artifact.warning.message}`
    ));
  }

  return `${lines.join('\n')}\n`;
}

function artifactsForGroup(inventory, groupName) {
  return inventory.review_artifacts.filter(artifact => artifact.group === groupName);
}

function humanReadableMustRead(inventory) {
  return inventory.review_artifacts.filter(artifact =>
    artifact.human_readable &&
    artifact.present &&
    ((artifact.role === 'must_read' && artifact.review_blocking) || artifact.group === 'editorial_brief')
  );
}

function presentHumanReadable(inventory, groupName) {
  return artifactsForGroup(inventory, groupName).filter(artifact =>
    artifact.present && artifact.human_readable
  );
}

function renderArtifactList(artifacts, fallback = '- none') {
  return artifacts.length > 0 ? artifacts.map(artifact => `- \`${artifact.path}\``).join('\n') : fallback;
}

function renderGeneratedArtifactsSummary(inventory) {
  const debugArtifacts = inventory.review_artifacts.filter(artifact =>
    artifact.present &&
    !artifact.human_readable &&
    ['debug_evidence', 'unknown_artifacts'].includes(artifact.group)
  );
  return [
    '## 생성 산출물',
    '',
    '### 필수 확인',
    renderArtifactList(humanReadableMustRead(inventory)),
    '',
    '### 최종 기사 / 공개 출력',
    renderArtifactList(presentHumanReadable(inventory, 'public_output')),
    '',
    '### 사실성 / 품질 / HAL 게이트',
    renderArtifactList(presentHumanReadable(inventory, 'gate_reports')),
    '',
    '### 디버그 근거',
    `- ${debugArtifacts.length} files. See \`content/newsroom/${inventory.date}/artifact-manifest.json\`.`
  ].join('\n');
}

function renderReleaseQaInventorySection(inventory) {
  const lines = [
    '## 산출물 리뷰 순서',
    '',
    `- present: ${inventory.summary.present}/${inventory.summary.total}`,
    `- missing_required: ${inventory.summary.missingRequired}`,
    `- attention_required: ${inventory.summary.attentionRequired}`,
    ''
  ];

  for (const group of inventory.groups) {
    const visible = group.artifacts.filter(artifact =>
      artifact.present || artifact.requiredActive || artifact.review_attention_required
    );
    if (visible.length === 0) continue;
    lines.push(`### ${group.label}`, '', ...visible.map(artifactLine), '');
  }

  return lines.join('\n').trimEnd();
}

function presentReviewFiles(inventory) {
  return inventory.review_artifacts
    .filter(artifact => artifact.present && !isArtifactManifest(artifact.path))
    .map(artifact => ({
      path: artifact.path,
      size: artifact.size,
      sha256: artifact.sha256
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function buildDateReviewManifest({
  root = process.cwd(),
  date,
  runContext = {},
  changedArtifacts = []
} = {}) {
  const inventory = buildReviewArtifactInventory({ root, date, changedArtifacts, runContext });
  return {
    schema_version: REVIEW_ARTIFACT_SCHEMA_VERSION,
    date,
    generated_at: new Date().toISOString(),
    review_summary: inventory.summary,
    files: presentReviewFiles(inventory),
    review_artifacts: inventory.review_artifacts,
    missing_required_review_artifacts: inventory.missingRequired.map(artifact => artifact.path)
  };
}

module.exports = {
  GROUPS,
  REVIEW_ARTIFACT_SCHEMA_VERSION,
  buildDateReviewManifest,
  buildReviewArtifactInventory,
  renderGeneratedArtifactsSummary,
  renderReleaseQaInventorySection,
  renderReviewGuideMarkdown
};
