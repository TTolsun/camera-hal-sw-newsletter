const {
  DEFAULT_AUDIT_REPORT_PATH,
  DEFAULT_CLEANUP_REPORT_PATH,
  auditHistoricalArchive
} = require('../validate/historical-archive');

function main() {
  const result = auditHistoricalArchive({
    root: process.cwd(),
    writeReports: true
  });

  if (result.warnings.length > 0) {
    console.warn(result.warnings.map(warning => `Warning: ${warning}`).join('\n'));
  }
  if (result.errors.length > 0) {
    console.warn(result.errors.map(error => `Warning: ${error}`).join('\n'));
  }

  console.log(`Wrote ${DEFAULT_AUDIT_REPORT_PATH}`);
  console.log(`Wrote ${DEFAULT_CLEANUP_REPORT_PATH}`);
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
  main
};
