const {
  DEFAULT_AUDIT_REPORT_PATH,
  DEFAULT_CLEANUP_REPORT_PATH,
  auditHistoricalArchive
} = require('../quality/historical-archive');

function main() {
  const result = auditHistoricalArchive({
    root: process.cwd(),
    writeReports: true
  });

  if (result.warnings.length > 0) {
    console.warn(result.warnings.map(warning => `Warning: ${warning}`).join('\n'));
  }
  if (result.errors.length > 0) {
    console.warn(result.errors.map(error => `Validation error: ${error}`).join('\n'));
    console.warn('Audit completed with validation errors recorded in report.');
    console.warn('Run npm.cmd run validate:archive for merge-blocking validation.');
  } else {
    console.log('Audit completed with no merge-blocking archive validation errors.');
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
