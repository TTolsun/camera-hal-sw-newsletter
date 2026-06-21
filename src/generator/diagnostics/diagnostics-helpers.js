// Shared leaf helpers for the source-diagnostics reports.
//
// Single responsibility: small pure value/candidate/markdown helpers used by
// both source-effectiveness-report.js and source-quality-diagnosis.js. These
// were byte-identical copies in both files; keeping a single definition stops
// the camera-relevance keyword regex and candidate-eligibility rules from
// drifting apart between the two reports.

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function lower(value) {
  return text(value).toLowerCase();
}

function sourceObject(candidate = {}) {
  return objectValue(candidate.source);
}

function finalSelectionEligibility(candidate = {}) {
  return lower(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function hasDatedEvidence(candidate = {}) {
  if (candidate.hasDatedEvidence === false) return false;
  if (candidate.has_dated_evidence === false) return false;
  return true;
}

function isEligibleCandidate(candidate = {}) {
  const eligibility = finalSelectionEligibility(candidate);
  return candidate.main_eligible !== false &&
    candidate.source_gap_risk !== true &&
    candidate.reference_only !== true &&
    hasDatedEvidence(candidate) &&
    ['main', 'short'].includes(eligibility);
}

function cameraRelevantRawSignal(candidate = {}) {
  const haystack = [
    candidate.title,
    candidate.summary,
    candidate.description,
    candidate.category,
    candidate.relevance_bucket,
    candidate.source_name,
    candidate.api_or_component,
    candidate.version_or_release,
    candidate.behavior_change,
    candidate.source_extraction,
    candidate.derived_editorial_hints
  ].map(value => typeof value === 'object' ? JSON.stringify(value) : text(value)).join(' ');
  return /\b(?:camera|camerax|camera2|androidx\.camera|hal|stream|buffer|metadata|image\s+pipeline|isp|v4l2|libcamera)\b/i.test(haystack);
}

function markdownEscape(value) {
  return text(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function markdownTable(headers, rows) {
  if (rows.length === 0) return '_없음_\n';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`
  ];
  for (const row of rows) {
    lines.push(`| ${row.map(markdownEscape).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  text,
  objectValue,
  lower,
  sourceObject,
  finalSelectionEligibility,
  hasDatedEvidence,
  isEligibleCandidate,
  cameraRelevantRawSignal,
  markdownEscape,
  markdownTable
};
