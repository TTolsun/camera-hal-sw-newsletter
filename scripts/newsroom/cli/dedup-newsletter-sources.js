const {
  DEFAULT_DRY_RUN_REPORT,
  DEFAULT_EXPECTED_EXPOSED_DATES,
  DEFAULT_POST_RUN_REPORT,
  applyCleanupPlan,
  buildCleanupPlan,
  buildPostCleanupReport
} = require('../common/newsletter-source-dedup-cleanup');
const {
  writeJson
} = require('../common/common');
const fs = require('fs');
const path = require('path');

function readJsonIfExists(absPath) {
  if (!fs.existsSync(absPath)) return null;
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

function parseArgs(argv = []) {
  return {
    apply: argv.includes('--apply'),
    postCheck: argv.includes('--post-check')
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const root = process.cwd();
  if (options.postCheck) {
    const dryRunReportPath = path.join(root, DEFAULT_DRY_RUN_REPORT);
    const report = buildPostCleanupReport({
      root,
      dryRunReport: readJsonIfExists(dryRunReportPath),
      expectedExposedDates: DEFAULT_EXPECTED_EXPOSED_DATES
    });
    writeJson(path.join(root, DEFAULT_POST_RUN_REPORT), report);
    if (!report.ok) {
      throw new Error(`Post-cleanup invariants failed:\n${report.errors.join('\n')}`);
    }
    console.log(`Wrote ${DEFAULT_POST_RUN_REPORT}`);
    return;
  }

  if (options.apply) {
    const result = applyCleanupPlan({ root });
    console.log(`Wrote ${DEFAULT_DRY_RUN_REPORT}`);
    console.log(`Wrote ${DEFAULT_POST_RUN_REPORT}`);
    console.log(`Changed issues: ${result.changedIssues.join(', ') || 'none'}`);
    console.log(`Deleted paths: ${result.deletedPaths.length}`);
    return;
  }

  const report = buildCleanupPlan({ root });
  const reportForDisk = { ...report };
  delete reportForDisk.internal;
  writeJson(path.join(root, DEFAULT_DRY_RUN_REPORT), reportForDisk);
  if (!report.ok) {
    throw new Error(`Dry-run cleanup plan failed:\n${report.errors.join('\n')}`);
  }
  console.log(`Wrote ${DEFAULT_DRY_RUN_REPORT}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`- ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  readJsonIfExists
};
