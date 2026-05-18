const {
  validateHistoricalArchive
} = require('../validate/historical-archive');

function main() {
  const result = validateHistoricalArchive({
    root: process.cwd()
  });

  if (result.warnings.length > 0) {
    console.warn(result.warnings.map(warning => `Warning: ${warning}`).join('\n'));
  }
  if (!result.ok) {
    console.error(result.errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log('Validated historical newsletter archive.');
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
