const fs = require('fs');
const path = require('path');

const {
  buildHalSignalQualityReport,
  loadHalSignalQualityInputs
} = require('../../../generator/render/hal-signal-quality-report');

function usage() {
  return [
    'Usage: node src/core/tooling/cli/build-hal-signal-quality-scorecard.js --dates YYYY-MM-DD[,YYYY-MM-DD...] [--output path]',
    '',
    'The scorecard builder is read-only unless --output is provided.'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dates') {
      options.dates = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--dates=')) {
      options.dates = arg.slice('--dates='.length);
    } else if (arg === '--output') {
      options.output = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function parseDates(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(date => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Date must use YYYY-MM-DD, found: ${date}`);
      }
      return date;
    });
}

function renderScorecard(reports) {
  const rows = reports.map(report => {
    const summary = report.hal_signal_quality_summary || {};
    return [
      report.date,
      report.status,
      summary.main_article_count ?? 0,
      summary.strong_signal_count ?? 0,
      summary.usable_signal_count ?? 0,
      summary.weak_signal_count ?? 0,
      summary.article_count_with_hal_signal_capsule ?? 0,
      summary.generic_signal_hard_blocker_count ?? 0
    ];
  });
  return `# HAL Signal Quality Baseline

This is a read-only baseline snapshot generated from existing artifacts.

| date | status | main_article_count | strong_signal_count | usable_signal_count | weak_signal_count | article_count_with_hal_signal_capsule | generic_signal_hard_blocker_count |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n') || '| none | none | 0 | 0 | 0 | 0 | 0 | 0 |'}
`;
}

function buildScorecard(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const dates = parseDates(options.dates);
  const reports = dates.map(date => buildHalSignalQualityReport({
    root,
    date,
    inputs: loadHalSignalQualityInputs(root, date)
  }));
  return {
    dates,
    reports,
    markdown: renderScorecard(reports)
  };
}

function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const dates = parseDates(options.dates);
  if (dates.length === 0) {
    throw new Error('At least one --dates value is required.');
  }
  const result = buildScorecard({ root, dates: dates.join(',') });
  if (options.output) {
    const outputPath = path.resolve(root, options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.markdown, 'utf8');
    console.log(`Wrote ${path.relative(root, outputPath).replace(/\\/g, '/')}`);
  } else {
    process.stdout.write(result.markdown);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  buildScorecard,
  main,
  parseArgs,
  parseDates,
  renderScorecard
};
