const fs = require('fs');
const {
  resolvePublishStatus
} = require('../common/publish-status');

const FORBIDDEN_ENGLISH_HEADINGS = [
  '## Generation Status',
  '## Composition Summary',
  '## Deterministic Final Selection Status',
  '## Editor Action Guidance',
  '## Generated Artifacts'
];
const LEGACY_GENERATED_ARTIFACTS_HEADING = '\u003f\uc579\uaf66\u0020\u003f\uacd7\ud167\u81fe\u003f';
const EVIDENCE_PACK_SUMMARY_HEADING = 'Evidence Pack 요약';
const EVIDENCE_PACK_SELECTED_HEADING = '선택된 Main Article 근거';
const EVIDENCE_PACK_EXCLUDED_HEADING = '제외 후보 근거';
const EVIDENCE_PACK_DIAGNOSTICS_HEADING = 'Needs-fix / Review-only 진단';
const EVIDENCE_PACK_CHECKLIST_HEADING = '사람 검토 체크리스트';

function toText(value) {
  return String(value ?? '');
}

function countMatches(text, pattern) {
  return [...toText(text).matchAll(pattern)].length;
}

function boolFromMatch(match) {
  if (!match) return null;
  return match[1] === 'true';
}

function firstMatch(text, pattern) {
  const match = toText(text).match(pattern);
  return match ? match[1].trim() : '';
}

function numberFromMatch(match) {
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractStatusSection(text) {
  text = toText(text);
  const startMatch = /^## 생성 상태\s*$/m.exec(text);
  if (!startMatch) return '';
  const bodyStart = startMatch.index + startMatch[0].length;
  const rest = text.slice(bodyStart);
  const nextMatch = /^##\s+/m.exec(rest);
  return nextMatch ? rest.slice(0, nextMatch.index) : rest;
}

function extractSections(text) {
  const source = toText(text);
  const headings = [...source.matchAll(/^##\s+(.+?)\s*$/gm)];
  const sections = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index][1].trim();
    const bodyStart = headings[index].index + headings[index][0].length;
    const bodyEnd = headings[index + 1]?.index ?? source.length;
    sections.set(heading, source.slice(bodyStart, bodyEnd));
  }
  return sections;
}

function sectionByHeading(sections, headings) {
  for (const heading of headings) {
    if (sections.has(heading)) return sections.get(heading);
  }
  for (const [heading, body] of sections.entries()) {
    if (headings.some(expected => heading.includes(expected))) return body;
  }
  return '';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function publicArtifactPatterns(date = '') {
  const datePattern = date ? escapeRegExp(date) : '\\d{4}-\\d{2}-\\d{2}';
  return {
    newsletterMd: new RegExp(`^-\\s+newsletters/${datePattern}/newsletter\\.md\\b.*$`, 'm'),
    newsletterHtml: new RegExp(`^-\\s+newsletters/${datePattern}/index\\.html\\b.*$`, 'm'),
    dataIndex: /^-\s+data\/newsletters\.json\b.*$/m
  };
}

function datePatternForValidation(date = '') {
  return date ? escapeRegExp(date) : '\\d{4}-\\d{2}-\\d{2}';
}

function exactHeadingCount(text, level, heading) {
  return countMatches(text, new RegExp(`^${'#'.repeat(level)} ${escapeRegExp(heading)}$`, 'gm'));
}

function extractSubsection(section, heading) {
  const source = toText(section);
  const pattern = new RegExp(`^### ${escapeRegExp(heading)}\\s*$`, 'm');
  const match = pattern.exec(source);
  if (!match) return '';
  const bodyStart = match.index + match[0].length;
  const rest = source.slice(bodyStart);
  const next = /^###\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function firstNumberAfterLabel(section, label) {
  const match = toText(section).match(new RegExp(`${escapeRegExp(label)}:\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function markdownHeaderColumns(section) {
  const lines = toText(section).split(/\r?\n/);
  const header = lines.find((line, index) =>
    line.trim().startsWith('|') &&
    lines[index + 1] &&
    /^\s*\|\s*:?-{3,}/.test(lines[index + 1])
  );
  if (!header) return [];
  return header
    .split('|')
    .map(column => column.trim())
    .filter(Boolean);
}

function validateMarkdownTableColumns(section, label, requiredColumns, errors) {
  const columns = markdownHeaderColumns(section);
  const missing = requiredColumns.filter(column => !columns.includes(column));
  if (missing.length > 0) {
    errors.push(`${label} table is missing required columns: ${missing.join(', ')}.`);
  }
}

function diagnosticLineHasValue(section, label) {
  const match = toText(section).match(new RegExp(`^- ${escapeRegExp(label)}:\\s*(.+)$`, 'm'));
  return Boolean(match && match[1].trim() && match[1].trim() !== 'none');
}

function hasCompleteMarkdownLink(value) {
  const text = toText(value);
  const angleWrappedLink = /\[[^\]\n]+\]\(<[^>\n]+>\)/;
  const plainLink = /\[[^\]\n]+\]\([^)>\n]+\)/;
  return angleWrappedLink.test(text) || plainLink.test(text);
}

function isReviewOnlyBody(text) {
  const source = toText(text);
  return (
    /\breview[- ]only\b/i.test(source) ||
    /검토 전용/.test(source)
  ) && /public_newsletter_ready\s*[:=]\s*false\b/i.test(source);
}

function isCandidateShortageBody(text) {
  const source = toText(text);
  return /failure_kind[=:]\s*candidate_shortage_reviewable\b/i.test(source) ||
    /^## Candidate Pool Preflight\s*$/m.test(source);
}

function hasReviewOnlyPublicFilesNotReadyText(text) {
  const source = toText(text);
  return /public newsletter files(?:가)?\s*(?:are\s+)?not\s+ready/i.test(source) ||
    /public files\s*(?:are\s*)?not\s+ready/i.test(source) ||
    /public newsletter files(?:가)?\s*준비되지 않았/.test(source);
}

function hasReviewOnlyNegativePublishText(text) {
  const source = toText(text);
  return /not publish-ready/i.test(source) ||
    /publish-ready label must not be applied/i.test(source) ||
    /publish-ready[^.\n]*(?:must not|금지|제거)/i.test(source) ||
    /발행 가능 상태가 아닙니다/.test(source) ||
    /발행 가능한 PR이 아닙니다/.test(source);
}

function reviewOnlyPositivePublishReadyLines(text) {
  return toText(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      if (/this pr is publish-ready/i.test(line)) return true;
      if (/\bready to publish\b/i.test(line)) return true;
      if (/final publish ready:\s*true/i.test(line)) return true;
      if (/final_publish_ready\s*[:=]\s*true\b/i.test(line)) return true;
      if (/public newsletter generated successfully/i.test(line)) return true;
      if (!/publish-ready/i.test(line)) return false;
      return !/\bnot publish-ready\b|must not|label must not be applied|reserved for|has_ai_publish_ready=true|금지|제거|아닙니다/i.test(line);
    });
}

function validateReviewOnlyContract(text, parsed, errors) {
  if (!/\breview[- ]only\b/i.test(text) && !/검토 전용/.test(text)) {
    errors.push('review-only PR body must include a review-only marker.');
  }
  if (!/public_newsletter_ready\s*[:=]\s*false\b/i.test(text)) {
    errors.push('review-only PR body must include public_newsletter_ready=false.');
  }
  if (!/final_publish_ready\s*[:=]\s*false\b/i.test(text)) {
    errors.push('review-only PR body must include final_publish_ready=false.');
  }
  if (!hasReviewOnlyNegativePublishText(text)) {
    errors.push('review-only PR body must state that it is not publish-ready.');
  }
  if (!hasReviewOnlyPublicFilesNotReadyText(text)) {
    errors.push('review-only PR body must state that public newsletter files are not ready.');
  }
  if (parsed.finalPublishReady === true) {
    errors.push('review-only PR body must not set final_publish_ready=true.');
  }
  const positiveLines = reviewOnlyPositivePublishReadyLines(text);
  if (positiveLines.length > 0) {
    errors.push(`review-only PR body contains misleading publish-ready wording: ${positiveLines.slice(0, 3).join('; ')}`);
  }
}

function validateCandidateTraceSection(text, sections, options, errors) {
  const traceCount = exactHeadingCount(text, 2, '후보 기사 추적');
  if (traceCount !== 1) {
    errors.push(`PR body must contain exactly one "## 후보 기사 추적" heading, found ${traceCount}.`);
    return;
  }

  const traceSection = sectionByHeading(sections, ['후보 기사 추적']);
  if (!traceSection) {
    errors.push('PR body is missing 후보 기사 추적 section.');
    return;
  }

  for (const heading of [
    '한눈에 보는 후보 판단',
    '최종 선택 기사',
    'Reserve 후보',
    '제외/강등/거절된 주요 후보',
    '품질/팩트체크 연결',
    '상세 artifact'
  ]) {
    if (!new RegExp(`^### ${escapeRegExp(heading)}\\s*$`, 'm').test(traceSection)) {
      errors.push(`후보 기사 추적 section is missing "### ${heading}" subsection.`);
    }
  }

  const datePattern = datePatternForValidation(options.date);
  const requiredPaths = [
    options.allowMissingReporterCandidates ? '' : `content/newsroom/${datePattern}/reporter-candidates\\.json`,
    `content/collected-news/${datePattern}/candidates\\.json`
  ].filter(Boolean);
  for (const requiredPath of requiredPaths) {
    if (!new RegExp(requiredPath).test(traceSection)) {
      errors.push(`후보 기사 추적 section must list artifact path matching ${requiredPath}.`);
    }
  }

  if (traceSection.includes('후보 기사 artifact를 찾을 수 없어 추적 섹션을 생성하지 못했습니다.')) {
    if (!/읽기\/형식 요약:\s*\n-\s+/m.test(traceSection)) {
      errors.push('후보 기사 추적 fallback must include missing/read/shape summary.');
    }
  }

  const brokenLinkRows = traceSection
    .split(/\r?\n/)
    .filter(line => line.trim().startsWith('|') && line.includes('](') && !hasCompleteMarkdownLink(line));
  if (brokenLinkRows.length > 0) {
    errors.push('후보 기사 추적 table contains an incomplete Markdown source link.');
  }

  const finalSelectedCount = firstNumberAfterLabel(traceSection, '최종 선택 기사');
  if (finalSelectedCount > 0) {
    const finalSection = extractSubsection(traceSection, '최종 선택 기사');
    if (!hasCompleteMarkdownLink(finalSection)) {
      errors.push('최종 선택 기사 table must include at least one Markdown source link.');
    }
    if (!/cand_\d{3}/.test(finalSection)) {
      errors.push('최종 선택 기사 table must include at least one Candidate ID.');
    }
    if (!/\b(?:final_selected|primary_selected)\b/.test(finalSection)) {
      errors.push('최종 선택 기사 table must include final_selected or primary_selected status.');
    }
  }
}

function validateEvidencePackSections(text, sections, parsed, errors) {
  const summaryCount = exactHeadingCount(text, 2, EVIDENCE_PACK_SUMMARY_HEADING);
  if (summaryCount === 0) return;
  if (summaryCount !== 1) {
    errors.push(`PR body must contain at most one "## ${EVIDENCE_PACK_SUMMARY_HEADING}" heading, found ${summaryCount}.`);
    return;
  }

  const summarySection = sectionByHeading(sections, [EVIDENCE_PACK_SUMMARY_HEADING]);
  if (!summarySection) {
    errors.push(`PR body is missing ${EVIDENCE_PACK_SUMMARY_HEADING} section body.`);
    return;
  }

  if (/Evidence Pack summary:\s*unavailable/i.test(summarySection)) {
    if (!/Reason:\s*content\/newsroom\/\d{4}-\d{2}-\d{2}\/evidence-pack-summary\.json\b/.test(summarySection)) {
      errors.push('Unavailable Evidence Pack summary must include the expected artifact path reason.');
    }
    return;
  }

  for (const label of [
    'Raw candidates',
    'Eligible candidates',
    'Selected main articles',
    'Reserve candidates',
    'Excluded candidates',
    'Primary camera stack count',
    'Supporting bucket count',
    'Fallback window used',
    'Fallback bucket used'
  ]) {
    if (!new RegExp(`^- ${escapeRegExp(label)}:\\s+`, 'm').test(summarySection)) {
      errors.push(`Evidence Pack summary is missing "${label}" row.`);
    }
  }

  const selectedSection = sectionByHeading(sections, [EVIDENCE_PACK_SELECTED_HEADING]);
  const excludedSection = sectionByHeading(sections, [EVIDENCE_PACK_EXCLUDED_HEADING]);
  const diagnosticsSection = sectionByHeading(sections, [EVIDENCE_PACK_DIAGNOSTICS_HEADING]);
  const checklistSection = sectionByHeading(sections, [EVIDENCE_PACK_CHECKLIST_HEADING]);

  if (!selectedSection) errors.push(`PR body is missing ${EVIDENCE_PACK_SELECTED_HEADING} section.`);
  if (!excludedSection) errors.push(`PR body is missing ${EVIDENCE_PACK_EXCLUDED_HEADING} section.`);
  if (!diagnosticsSection) errors.push(`PR body is missing ${EVIDENCE_PACK_DIAGNOSTICS_HEADING} section.`);
  if (!checklistSection) errors.push(`PR body is missing ${EVIDENCE_PACK_CHECKLIST_HEADING} section.`);

  if (selectedSection) {
    const selectedCount = firstNumberAfterLabel(summarySection, 'Selected main articles');
    if (selectedCount > 0 && /^\s*-\s+none\s*$/m.test(selectedSection)) {
      errors.push('Evidence Pack selected article count is positive but selected table is empty.');
    }
    if (!/^\s*-\s+none\s*$/m.test(selectedSection)) {
      validateMarkdownTableColumns(
        selectedSection,
        'Evidence Pack selected article',
        ['#', 'Title', 'Source', 'URL', 'Source tier', 'Source role', 'URL quality', 'Bucket', 'Freshness', 'Reason'],
        errors
      );
    }
  }

  if (excludedSection && !/^\s*-\s+none\s*$/m.test(excludedSection)) {
    validateMarkdownTableColumns(
      excludedSection,
      'Evidence Pack excluded candidate',
      ['Title', 'Source', 'Bucket', 'Reason'],
      errors
    );
  }

  if (diagnosticsSection) {
    const requiredDiagnosticLabels = [
      'Quality hard failures',
      'Fact-check must-fix',
      'Repair failure',
      'Fallback builder failure',
      'Candidate shortage hints'
    ];
    for (const label of requiredDiagnosticLabels) {
      if (!new RegExp(`^- ${escapeRegExp(label)}:\\s+`, 'm').test(diagnosticsSection)) {
        errors.push(`Evidence Pack diagnostics is missing "${label}" row.`);
      }
    }
    const needsFixOrReviewOnly = parsed.overallStatus !== 'PASS' || parsed.finalPublishReady === false || isReviewOnlyBody(text);
    if (
      needsFixOrReviewOnly &&
      !requiredDiagnosticLabels.some(label => diagnosticLineHasValue(diagnosticsSection, label))
    ) {
      errors.push('Needs-fix or review-only Evidence Pack diagnostics must include at least one actionable diagnostic.');
    }
  }

  if (checklistSection && countMatches(checklistSection, /^- \[ \]\s+/gm) < 5) {
    errors.push('Evidence Pack human review checklist must include at least five unchecked items.');
  }
}

function parseStatusSection(section) {
  section = toText(section);
  return {
    overallStatus: firstMatch(section, /^전체 상태:\s*([A-Z_]+)/m),
    failureKind: firstMatch(section, /^failure_kind[=:]\s*([a-z_]+)/m),
    finalPublishReady: boolFromMatch(section.match(/final_publish_ready:\s*(true|false)/)),
    validateOk: boolFromMatch(section.match(/validate_ok[=:]\s*(true|false)/)),
    editorReviewRequired: boolFromMatch(section.match(/editor_review_required[=:]\s*(true|false)/)),
    qualityStatus: firstMatch(section, /^품질 상태:\s*([A-Z_]+)/m),
    factCheckStatus: firstMatch(section, /^팩트체크 상태:\s*([A-Z_]+)/m),
    mustFixCount: numberFromMatch(section.match(/must_fix_count[:=]\s*(\d+)/)),
    sourceGapCount: numberFromMatch(section.match(/source_gap_count[:=]\s*(\d+)/)),
    staleClaimStatus: firstMatch(section, /^Stale claim 상태:\s*([A-Z_]+)/m),
    staleClaimHardFailureCount: numberFromMatch(section.match(/hard_failures=(\d+)/)),
    validateOutcome: firstMatch(section, /^검증 결과:\s*([^\n]+)/m),
    consistencyErrors: firstMatch(section, /consistency_errors:\s*([^\)\n]+)/m)
  };
}

function parseArgs(argv) {
  const options = {};
  let filePath = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--root') {
      options.root = argv[index + 1] || '';
      index += 1;
    } else if (!filePath) {
      filePath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { filePath, options };
}

function validatePrBodyText(text, options = {}) {
  text = toText(text);
  const errors = [];
  const sections = extractSections(text);
  const generationStatusCount = countMatches(text, /^## 생성 상태$/gm);
  if (generationStatusCount !== 1) {
    errors.push(`PR body must contain exactly one "## 생성 상태" heading, found ${generationStatusCount}.`);
  }

  for (const heading of FORBIDDEN_ENGLISH_HEADINGS) {
    if (text.includes(heading)) {
      errors.push(`PR body must not contain English heading: ${heading}`);
    }
  }

  const statusSection = extractStatusSection(text);
  if (!statusSection) {
    errors.push('PR body is missing 생성 상태 section.');
    return { ok: false, errors };
  }

  const parsed = parseStatusSection(statusSection);
  const reviewOnly = isReviewOnlyBody(text);
  const candidateShortage = isCandidateShortageBody(text);
  if (reviewOnly) {
    validateReviewOnlyContract(text, parsed, errors);
  }
  if (candidateShortage) {
    if (!/^## Candidate Pool Preflight\s*$/m.test(text)) {
      errors.push('candidate_shortage_reviewable PR body must include Candidate Pool Preflight section.');
    }
    if (!/LLM editor generation was skipped because candidate pool was insufficient\./.test(text)) {
      errors.push('candidate_shortage_reviewable PR body must state that LLM editor generation was skipped.');
    }
  }
  if (parsed.consistencyErrors !== 'none') {
    errors.push(`PR body has consistency_errors: ${parsed.consistencyErrors || 'missing'}`);
  }
  if (parsed.overallStatus === 'PASS' && parsed.finalPublishReady === false) {
    errors.push('전체 상태 is PASS while final_publish_ready is false.');
  }
  if (
    (parsed.overallStatus === 'PASS' || parsed.finalPublishReady === true) &&
    /\b(?:FAILED|NEEDS_FIX)\b/.test(statusSection)
  ) {
    errors.push('생성 상태 summary mixes PASS with FAILED/NEEDS_FIX.');
  }

  const patterns = publicArtifactPatterns(options.date);
  const generatedArtifactsSection = sectionByHeading(sections, ['생성 산출물', LEGACY_GENERATED_ARTIFACTS_HEADING]);
  if (!generatedArtifactsSection) {
    errors.push('PR body must contain generated artifacts section.');
  }
  validateCandidateTraceSection(text, sections, {
    ...options,
    allowMissingReporterCandidates: candidateShortage
  }, errors);
  validateEvidencePackSections(text, sections, parsed, errors);
  if (!reviewOnly && /생성하지 않은 public 산출물|not generated|not updated/.test(text)) {
    errors.push('Newsletter PR body must not describe public newsletter files as not generated or not updated.');
  }
  if (!reviewOnly && parsed.finalPublishReady === false && !/public newsletter files는 생성되었습니다/.test(text)) {
    errors.push('final_publish_ready=false PR body must state that public newsletter files were generated for editor-approved merge.');
  }

  if (parsed.finalPublishReady === true) {
    if (parsed.qualityStatus !== 'PASS') {
      errors.push(`final_publish_ready is true but 품질 상태 is ${parsed.qualityStatus || 'missing'}.`);
    }
    if (parsed.factCheckStatus !== 'PASS') {
      errors.push(`final_publish_ready is true but 팩트체크 상태 is ${parsed.factCheckStatus || 'missing'}.`);
    }
    if (parsed.mustFixCount !== 0) {
      errors.push(`final_publish_ready is true but must_fix_count is ${parsed.mustFixCount ?? 'missing'}.`);
    }
    if (parsed.sourceGapCount !== 0) {
      errors.push(`final_publish_ready is true but source_gap_count is ${parsed.sourceGapCount ?? 'missing'}.`);
    }
    if (parsed.staleClaimStatus === 'NEEDS_FIX') {
      errors.push('final_publish_ready is true but Stale claim 상태 is NEEDS_FIX.');
    }
    if (parsed.staleClaimHardFailureCount !== 0) {
      errors.push(`final_publish_ready is true but stale hard failure count is ${parsed.staleClaimHardFailureCount ?? 'missing'}.`);
    }
    if (parsed.validateOutcome !== 'success') {
      errors.push(`final_publish_ready is true but 검증 결과 is ${parsed.validateOutcome || 'missing'}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function validatePrBodyFile(filePath, options = {}) {
  const text = fs.readFileSync(filePath, 'utf8');
  const result = validatePrBodyText(text, options);
  const resolved = resolvePublishStatus(options);
  if (resolved.consistencyErrors.length > 0) {
    result.errors.push(`Artifact consistency errors: ${resolved.consistencyErrors.join('; ')}`);
    result.ok = false;
  }
  return result;
}

function main() {
  const { filePath, options } = parseArgs(process.argv.slice(2));
  if (!filePath) {
    console.error('Usage: node scripts/validate-pr-body.js <pr-body.md> [--date YYYY-MM-DD] [--root <repo-root>]');
    process.exit(1);
  }
  const result = validatePrBodyFile(filePath, options);
  if (!result.ok) {
    console.error(result.errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log('Validated newsroom PR body.');
}

if (require.main === module) {
  main();
}

module.exports = {
  extractSections,
  extractStatusSection,
  parseStatusSection,
  validatePrBodyFile,
  validatePrBodyText
};
