const fs = require('fs');
const path = require('path');

const {
  readJson
} = require('../common/common');
const {
  qualityGatePolicy
} = require('../common/newsletter-policy');
const {
  newsroomRelPath
} = require('../common/artifact-paths');
const {
  strictTargetDates
} = require('../common/validation-targets');
const {
  buildNewsletterQualityReport
} = require('../validate/newsletter-quality');

function usage() {
  return [
    'Usage: node scripts/annotate-publication-quality.js [--date YYYY-MM-DD] [--all] [--latest]',
    '',
    'Reports publication quality and fact-check issues as GitHub Actions annotations.',
    'Quality issues do not fail the command; invalid CLI/system inputs do.',
    '',
    'Target policy:',
    '- --date YYYY-MM-DD inspects only that public issue.',
    '- --all inspects every historical public issue.',
    '- Changed public issue dates inspect matching public issue dates, even when --latest is present.',
    '- --latest permits fallback to the latest public issue only when no changed public issue date is detected.',
    '- With no explicit target and no changed public issue date, the command fails instead of silently falling back.'
  ].join('\n');
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function countFromArrayOrValue(arrayValue, countValue) {
  const count = toNumber(countValue);
  if (count !== null) return count;
  return ensureArray(arrayValue).length;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dates: [],
    all: false,
    latest: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--date requires a YYYY-MM-DD value');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`Invalid --date value: ${value}`);
      }
      options.dates.push(value);
      index += 1;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--latest') {
      options.latest = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.all && options.dates.length > 0) {
    throw new Error('--all cannot be combined with --date');
  }
  if (options.latest && options.dates.length > 0) {
    throw new Error('--latest cannot be combined with --date');
  }
  if (options.latest && options.all) {
    throw new Error('--latest cannot be combined with --all');
  }

  return options;
}

function readJsonOptional(root, relPath) {
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      value: null,
      relPath
    };
  }
  try {
    return {
      exists: true,
      value: readJson(filePath),
      relPath
    };
  } catch (error) {
    throw new Error(`Invalid JSON in ${relPath}: ${error.message}`);
  }
}

function readNewsletterItems(root) {
  const relPath = 'data/newsletters.json';
  const filePath = path.join(root, relPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${relPath}`);
  }
  let items;
  try {
    items = readJson(filePath);
  } catch (error) {
    throw new Error(`Invalid JSON in ${relPath}: ${error.message}`);
  }
  if (!Array.isArray(items)) {
    throw new Error('data/newsletters.json must contain an array');
  }
  return items;
}

function latestPublicIssue(items) {
  return [...items]
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(String(item?.date || '')))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 1);
}

function resolveTargetItems(root, options = {}) {
  const items = readNewsletterItems(root);
  if (options.all) return items;

  const explicitDates = new Set(options.dates || []);
  if (explicitDates.size > 0) {
    const selected = items.filter(item => explicitDates.has(item.date));
    for (const date of explicitDates) {
      if (!selected.some(item => item.date === date)) {
        throw new Error(`No data/newsletters.json entry found for target date: ${date}`);
      }
    }
    return selected;
  }

  const targetDates = options.targetDates instanceof Set
    ? options.targetDates
    : strictTargetDates({ root });

  if (targetDates.size > 0) {
    const selected = items.filter(item => targetDates.has(item.date));
    const selectedDates = new Set(selected.map(item => item.date));
    const missingDates = [...targetDates].filter(date => !selectedDates.has(date));
    if (missingDates.length > 0) {
      throw new Error(`No data/newsletters.json entry found for detected target date(s): ${missingDates.join(', ')}`);
    }
    return selected;
  }

  if (options.latest) return latestPublicIssue(items);
  throw new Error('No target public issue date detected. Pass --date YYYY-MM-DD, --all, or --latest.');
}

function addAnnotation(annotations, level, file, title, message) {
  annotations.push({
    level,
    file,
    title,
    message
  });
}

function firstText(items, keys) {
  for (const item of ensureArray(items)) {
    if (typeof item === 'string' && item.trim()) return item.trim();
    for (const key of keys) {
      if (item?.[key]) return String(item[key]).trim();
    }
  }
  return '';
}

function summarizeSample(items, keys) {
  const first = firstText(items, keys);
  return first ? ` Sample: ${first}` : '';
}

function maybeAnnotateQuality({
  annotations,
  date,
  quality,
  editor,
  reporter,
  factCheck,
  shortlist,
  staleClaim,
  strictClaimValidation = false
}) {
  const relPath = newsroomRelPath(date, 'quality-report.json');
  if (!quality.exists) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Missing quality report',
      `Newsletter ${date} has public artifacts but no quality-report.json.`
    );
    return;
  }

  const report = quality.value || {};
  const threshold = toNumber(report.threshold) ?? qualityGatePolicy.threshold;
  const score = toNumber(report.score);

  if (score === null) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Invalid quality score',
      `Newsletter ${date} quality report has invalid score.`
    );
  } else if (score < threshold) {
    addAnnotation(
      annotations,
      'warning',
      relPath,
      'Quality score below threshold',
      `Newsletter ${date} quality score ${score}/${threshold} is below threshold.`
    );
  }

  if (threshold < qualityGatePolicy.threshold) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Quality threshold below policy',
      `Newsletter ${date} quality threshold ${threshold} is below current policy threshold ${qualityGatePolicy.threshold}.`
    );
  }

  if (report.status !== 'PASS') {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Quality status not PASS',
      `Newsletter ${date} quality status is ${report.status || 'UNKNOWN'}.`
    );
  }

  if (!Array.isArray(report.deductions)) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Invalid quality deductions',
      `Newsletter ${date} quality report must include deductions array.`
    );
  }

  if (editor.exists && factCheck.exists) {
    const recomputed = buildNewsletterQualityReport(date, editor.value, reporter.value || {}, factCheck.value, {
      threshold,
      shortlistReport: shortlist.value || null,
      staleClaimReport: staleClaim.value || null,
      strictClaimValidation
    });
    if (recomputed.score !== score || recomputed.status !== report.status) {
      addAnnotation(
        annotations,
        'error',
        relPath,
        'Stale quality report',
        `Newsletter ${date} quality report is stale. Expected ${recomputed.score}/${threshold} ${recomputed.status}, found ${score}/${threshold} ${report.status || 'UNKNOWN'}.`
      );
    }
  } else {
    addAnnotation(
      annotations,
      'warning',
      relPath,
      'Quality recompute skipped',
      `Newsletter ${date} quality report could not be recomputed because editor or fact-check artifacts are missing.`
    );
  }
}

function maybeAnnotateFactCheck({ annotations, date, factCheck }) {
  const relPath = newsroomRelPath(date, 'fact-check-report.json');
  if (!factCheck.exists) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Missing fact-check report',
      `Newsletter ${date} has public artifacts but no fact-check-report.json.`
    );
    return;
  }

  const report = factCheck.value || {};
  const mustFixCount = ensureArray(report.must_fix).length;
  const sourceGapCount = countFromArrayOrValue(report.source_gaps, report.source_gap_count);

  if (report.status !== 'PASS') {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Fact-check status not PASS',
      `Newsletter ${date} fact-check status is ${report.status || 'UNKNOWN'}.`
    );
  }
  if (mustFixCount > 0) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Fact-check must_fix items remain',
      `Newsletter ${date} has ${mustFixCount} must_fix item(s).${summarizeSample(report.must_fix, ['issue', 'claim', 'headline', 'reason'])}`
    );
  }
  if (sourceGapCount > 0) {
    addAnnotation(
      annotations,
      'error',
      relPath,
      'Fact-check source gaps remain',
      `Newsletter ${date} has ${sourceGapCount} source gap(s).${summarizeSample(report.source_gaps, ['issue', 'claim', 'headline', 'reason'])}`
    );
  }
}

function maybeAnnotateStatus({ annotations, date, generationStatus, shortlist, staleClaim }) {
  const statusRelPath = newsroomRelPath(date, 'generation-status.json');
  const status = generationStatus.value || {};
  const shortlistValue = shortlist.value || {};
  const staleValue = staleClaim.value || {};

  if (!generationStatus.exists) {
    addAnnotation(
      annotations,
      'error',
      statusRelPath,
      'Missing generation status',
      `Newsletter ${date} has public artifacts but no generation-status.json.`
    );
  } else {
    if (status.final_publish_ready !== true) {
      addAnnotation(
        annotations,
        'error',
        statusRelPath,
        'AI publish readiness is false',
        `Newsletter ${date} final_publish_ready is ${String(status.final_publish_ready)}. Editor merge is required for publication approval.`
      );
    }
    if (status.publish_gate_passed !== true) {
      addAnnotation(
        annotations,
        'error',
        statusRelPath,
        'Publish gate not passed',
        `Newsletter ${date} publish_gate_passed is ${String(status.publish_gate_passed)}.`
      );
    }
  }

  if (shortlist.exists && shortlistValue.publish_gate_passed !== true) {
    addAnnotation(
      annotations,
      'error',
      shortlist.relPath,
      'Selection publish gate not passed',
      `Newsletter ${date} shortlist publish_gate_passed is ${String(shortlistValue.publish_gate_passed)}.`
    );
  }

  const staleStatus = staleValue.status || status.stale_claim_status;
  const staleHardFailureCount = staleClaim.exists
    ? ensureArray(staleValue.hard_failures).length
    : countFromArrayOrValue(null, status.stale_claim_hard_failure_count);
  if (staleStatus === 'NEEDS_FIX') {
    addAnnotation(
      annotations,
      'error',
      staleClaim.exists ? staleClaim.relPath : statusRelPath,
      'Stale claim status needs fix',
      `Newsletter ${date} stale claim status is NEEDS_FIX.`
    );
  }
  if (staleHardFailureCount > 0) {
    addAnnotation(
      annotations,
      'error',
      staleClaim.exists ? staleClaim.relPath : statusRelPath,
      'Stale claim hard failures remain',
      `Newsletter ${date} has ${staleHardFailureCount} stale-claim hard failure(s).`
    );
  }
}

function collectPublicationQualityAnnotations(options = {}) {
  const root = options.root || process.cwd();
  const parsedOptions = options.parsedOptions || parseArgs(options.argv || []);
  const annotations = [];
  const items = resolveTargetItems(root, parsedOptions);
  const strictDates = strictTargetDates({ root });

  for (const item of items) {
    const date = item.date;
    const relBase = `content/newsroom/${date}`;
    const quality = readJsonOptional(root, `${relBase}/quality-report.json`);
    const factCheck = readJsonOptional(root, `${relBase}/fact-check-report.json`);
    const editor = readJsonOptional(root, `${relBase}/editor-draft.json`);
    const reporter = readJsonOptional(root, `${relBase}/reporter-candidates.json`);
    const generationStatus = readJsonOptional(root, `${relBase}/generation-status.json`);
    const shortlist = readJsonOptional(root, `${relBase}/shortlisted-candidates.json`);
    const staleClaim = readJsonOptional(root, `${relBase}/stale-claim-report.json`);

    maybeAnnotateQuality({
      annotations,
      date,
      quality,
      editor,
      reporter,
      factCheck,
      shortlist,
      staleClaim,
      strictClaimValidation: strictDates.has(date) || process.env.REQUIRE_NEWSLETTER_QUALITY === '1'
    });
    maybeAnnotateFactCheck({
      annotations,
      date,
      factCheck
    });
    maybeAnnotateStatus({
      annotations,
      date,
      generationStatus,
      shortlist,
      staleClaim
    });
  }

  return {
    targetDates: items.map(item => item.date),
    annotations
  };
}

function escapeAnnotationValue(value, { property = false } = {}) {
  let escaped = String(value ?? '')
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
  if (property) {
    escaped = escaped
      .replace(/:/g, '%3A')
      .replace(/,/g, '%2C');
  }
  return escaped;
}

function renderAnnotationCommand(annotation) {
  const properties = [
    annotation.file ? `file=${escapeAnnotationValue(annotation.file, { property: true })}` : '',
    annotation.title ? `title=${escapeAnnotationValue(annotation.title, { property: true })}` : ''
  ].filter(Boolean).join(',');
  return `::${annotation.level} ${properties}::${escapeAnnotationValue(annotation.message)}`;
}

function main(argv = process.argv.slice(2), { root = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    const parsedOptions = parseArgs(argv);
    if (parsedOptions.help) {
      stdout.write(`${usage()}\n`);
      return 0;
    }

    const result = collectPublicationQualityAnnotations({ root, parsedOptions });
    for (const annotation of result.annotations) {
      stdout.write(`${renderAnnotationCommand(annotation)}\n`);
    }
    stdout.write(`Publication quality annotation completed for ${result.targetDates.length} newsletter issue(s); annotations=${result.annotations.length}.\n`);
    return 0;
  } catch (error) {
    stderr.write(`Publication quality annotation failed: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  collectPublicationQualityAnnotations,
  escapeAnnotationValue,
  main,
  parseArgs,
  renderAnnotationCommand,
  latestPublicIssue,
  resolveTargetItems
};
