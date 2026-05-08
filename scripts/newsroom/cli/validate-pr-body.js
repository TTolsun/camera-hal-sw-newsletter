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

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function boolFromMatch(match) {
  if (!match) return null;
  return match[1] === 'true';
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function numberFromMatch(match) {
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractStatusSection(text) {
  const startMatch = /^## 생성 상태\s*$/m.exec(text);
  if (!startMatch) return '';
  const bodyStart = startMatch.index + startMatch[0].length;
  const rest = text.slice(bodyStart);
  const nextMatch = /^##\s+/m.exec(rest);
  return nextMatch ? rest.slice(0, nextMatch.index) : rest;
}

function parseStatusSection(section) {
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

function validatePrBodyText(text) {
  const errors = [];
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

  if (parsed.failureKind === 'editorial_reviewable') {
    if (!/발행 불가 경고:/.test(statusSection) || !/발행 불가 review PR/.test(statusSection)) {
      errors.push('editorial_reviewable PR body must contain the non-publish warning.');
    }
    if (parsed.finalPublishReady !== false) {
      errors.push(`editorial_reviewable PR body must show final_publish_ready=false, got ${parsed.finalPublishReady}.`);
    }
    if (parsed.validateOk !== false) {
      errors.push(`editorial_reviewable PR body must show validate_ok=false, got ${parsed.validateOk}.`);
    }
    if (parsed.editorReviewRequired !== true) {
      errors.push(`editorial_reviewable PR body must show editor_review_required=true, got ${parsed.editorReviewRequired}.`);
    }
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
  const result = validatePrBodyText(text);
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
  extractStatusSection,
  parseStatusSection,
  validatePrBodyFile,
  validatePrBodyText
};
