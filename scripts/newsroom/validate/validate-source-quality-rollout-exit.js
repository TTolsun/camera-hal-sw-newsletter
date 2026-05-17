const fs = require('fs');
const path = require('path');

const DATE_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_SCHEMA_VERSION = 2;
const REQUIRED_SUMMARY_FIELDS = Object.freeze([
  'summary.source_url_quality_distribution',
  'summary.source_quality_status_summary',
  'summary.source_quality_blocker_summary',
  'summary.selected_main_source_quality_coverage',
  'summary.main_eligible_source_quality_coverage',
  'summary.conditional_source_promoted_count',
  'summary.conditional_source_blocked_count',
  'summary.unknown_source_quality_count',
  'summary.source_quality_field_drift_count',
  'summary.legacy_source_quality_warning_count'
]);

const COVERAGE_CHECKS = Object.freeze([
  {
    label: 'selected_main',
    display: 'selected_main source_quality',
    basePath: 'summary.selected_main_source_quality_coverage',
    withField: 'with_source_quality_count',
    totalField: 'selected_main_count'
  },
  {
    label: 'main_eligible',
    display: 'main_eligible source_quality',
    basePath: 'summary.main_eligible_source_quality_coverage',
    withField: 'with_source_quality_count',
    totalField: 'main_eligible_candidate_count'
  }
]);

const ZERO_COUNT_CHECKS = Object.freeze([
  'summary.legacy_source_quality_warning_count',
  'summary.source_quality_field_drift_count',
  'summary.unknown_source_quality_count'
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, segment) => {
    if (!isPlainObject(current) && !Array.isArray(current)) return undefined;
    return Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : undefined;
  }, value);
}

function hasPath(value, dottedPath) {
  return getPath(value, dottedPath) !== undefined;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCount(value) {
  const number = toNumber(value);
  return number === null ? 'missing' : String(number);
}

function markdownEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function reportPath(root, date) {
  return path.join(root, 'content', 'newsroom', date, 'source-effectiveness-report.json');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function discoverSourceEffectivenessReports(root = process.cwd()) {
  const newsroomDir = path.join(root, 'content', 'newsroom');
  if (!fs.existsSync(newsroomDir)) {
    throw new Error(`FAIL: missing newsroom artifact directory: ${path.relative(root, newsroomDir).replace(/\\/g, '/')}`);
  }

  return fs.readdirSync(newsroomDir)
    .filter(name => DATE_DIR_PATTERN.test(name))
    .map(date => ({ date, filePath: reportPath(root, date) }))
    .filter(item => fs.existsSync(item.filePath))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function missingRequiredFields(report) {
  return REQUIRED_SUMMARY_FIELDS.filter(field => !hasPath(report, field));
}

function numericAt(report, field, date, errors) {
  if (!hasPath(report, field)) {
    errors.push(`FAIL: ${date} is schema_version=${report.schema_version} but missing ${field}.`);
    return null;
  }
  const value = toNumber(getPath(report, field));
  if (value === null) {
    errors.push(`FAIL: ${date} has non-numeric ${field}: ${JSON.stringify(getPath(report, field))}.`);
  }
  return value;
}

function coverageFor(report, check, date, errors) {
  const withPath = `${check.basePath}.${check.withField}`;
  const totalPath = `${check.basePath}.${check.totalField}`;
  const withCount = numericAt(report, withPath, date, errors);
  const totalCount = numericAt(report, totalPath, date, errors);
  return { withCount, totalCount, text: `${formatCount(withCount)}/${formatCount(totalCount)}` };
}

function evaluatePostRolloutReport(report, date) {
  const errors = [];
  const selectedMain = coverageFor(report, COVERAGE_CHECKS[0], date, errors);
  const mainEligible = coverageFor(report, COVERAGE_CHECKS[1], date, errors);
  if (selectedMain.withCount !== null &&
    selectedMain.totalCount !== null &&
    selectedMain.withCount !== selectedMain.totalCount) {
    errors.push(`FAIL: ${date} selected_main source_quality coverage mismatch: ${selectedMain.withCount}/${selectedMain.totalCount}.`);
  }
  if (mainEligible.withCount !== null &&
    mainEligible.totalCount !== null &&
    mainEligible.withCount !== mainEligible.totalCount) {
    errors.push(`FAIL: ${date} main_eligible source_quality coverage mismatch: ${mainEligible.withCount}/${mainEligible.totalCount}.`);
  }

  const zeroCounts = {};
  for (const field of ZERO_COUNT_CHECKS) {
    const value = numericAt(report, field, date, errors);
    const key = field.split('.').pop();
    zeroCounts[key] = value;
    if (value !== null && value !== 0) {
      errors.push(`FAIL: ${date} ${key}=${value}.`);
    }
  }

  return {
    errors,
    row: {
      date,
      schema: report.schema_version,
      selectedMain: selectedMain.text,
      mainEligible: mainEligible.text,
      legacyWarning: formatCount(zeroCounts.legacy_source_quality_warning_count),
      drift: formatCount(zeroCounts.source_quality_field_drift_count),
      unknown: formatCount(zeroCounts.unknown_source_quality_count),
      result: errors.length === 0 ? 'PASS' : 'FAIL'
    }
  };
}

function classifyReport(item) {
  let report;
  try {
    report = readJson(item.filePath);
  } catch (error) {
    return {
      kind: 'invalid',
      date: item.date,
      errors: [`FAIL: ${item.date} source-effectiveness report is invalid JSON: ${error.message}.`]
    };
  }

  if (report.date !== item.date) {
    return {
      kind: 'invalid',
      date: item.date,
      errors: [`FAIL: ${item.date} source-effectiveness report date mismatch: report.date=${JSON.stringify(report.date)}.`]
    };
  }

  const schemaVersion = toNumber(report.schema_version);
  if (schemaVersion === null) {
    return {
      kind: 'invalid',
      date: item.date,
      errors: [`FAIL: ${item.date} source-effectiveness report has non-numeric schema_version: ${JSON.stringify(report.schema_version)}.`]
    };
  }

  if (schemaVersion < MIN_SCHEMA_VERSION) {
    return {
      kind: 'legacy',
      date: item.date,
      report,
      schemaVersion
    };
  }

  const missing = missingRequiredFields(report);
  if (missing.length > 0) {
    return {
      kind: 'invalid',
      date: item.date,
      report,
      schemaVersion,
      errors: missing.map(field => `FAIL: ${item.date} is schema_version=${schemaVersion} but missing ${field}.`)
    };
  }

  return {
    kind: 'post-rollout',
    date: item.date,
    report,
    schemaVersion
  };
}

function renderEvidenceTable(rows) {
  const lines = [
    '| Date | Schema | Selected main SQ | Main eligible SQ | Legacy warning | Drift | Unknown | Result |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];
  for (const row of rows) {
    lines.push(`| ${markdownEscape(row.date)} | ${markdownEscape(row.schema)} | ${markdownEscape(row.selectedMain)} | ${markdownEscape(row.mainEligible)} | ${markdownEscape(row.legacyWarning)} | ${markdownEscape(row.drift)} | ${markdownEscape(row.unknown)} | ${markdownEscape(row.result)} |`);
  }
  return lines.join('\n');
}

function validateSourceQualityRolloutExit(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const reports = discoverSourceEffectivenessReports(root).map(classifyReport);
  const errors = reports.flatMap(report => report.kind === 'invalid' ? report.errors : []);
  const legacyReports = reports.filter(report => report.kind === 'legacy');
  const postRolloutReports = reports.filter(report => report.kind === 'post-rollout');
  const selectedReports = postRolloutReports.slice(0, 2);
  const evaluated = selectedReports.map(item => evaluatePostRolloutReport(item.report, item.date));
  for (const item of evaluated) errors.push(...item.errors);

  if (postRolloutReports.length < 2) {
    errors.push(`FAIL: only ${postRolloutReports.length} post-rollout source-effectiveness report found. Need 2.`);
  }

  const rows = evaluated.map(item => item.row);
  return {
    ok: errors.length === 0,
    errors,
    rows,
    table: renderEvidenceTable(rows),
    postRolloutReportsChecked: selectedReports.length,
    legacyReportsExcluded: legacyReports.length,
    discoveredReportCount: reports.length
  };
}

function runCli(args = process.argv.slice(2), options = {}) {
  const rootArgIndex = args.indexOf('--root');
  if (rootArgIndex >= 0 && !args[rootArgIndex + 1]) {
    console.error('FAIL: --root requires a path.');
    return 1;
  }
  const root = rootArgIndex >= 0 ? args[rootArgIndex + 1] : options.root || process.cwd();
  let result;
  try {
    result = validateSourceQualityRolloutExit({ root });
  } catch (error) {
    console.error(error.message || String(error));
    return 1;
  }
  console.log(result.table);
  console.log('');
  if (result.ok) {
    console.log('Source quality rollout exit: PASS');
    console.log(`Post-rollout reports checked: ${result.postRolloutReportsChecked}`);
    console.log(`Legacy reports excluded: ${result.legacyReportsExcluded}`);
    return 0;
  }
  for (const error of result.errors) console.error(error);
  console.error('Source quality rollout exit: FAIL');
  console.error(`Post-rollout reports checked: ${result.postRolloutReportsChecked}`);
  console.error(`Legacy reports excluded: ${result.legacyReportsExcluded}`);
  return 1;
}

if (require.main === module) {
  process.exit(runCli());
}

module.exports = {
  REQUIRED_SUMMARY_FIELDS,
  classifyReport,
  discoverSourceEffectivenessReports,
  evaluatePostRolloutReport,
  renderEvidenceTable,
  runCli,
  validateSourceQualityRolloutExit
};
