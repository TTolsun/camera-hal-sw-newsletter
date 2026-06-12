const path = require('path');

const {
  writeNewsletterImageAuditAggregate,
  writeNewsletterImageAuditArtifacts
} = require('../render/newsletter-image-audit');

function usage() {
  return [
    'Usage: node src/generator/publish/audit-newsletter-images.js [--date YYYY-MM-DD] [--all] [--live-validation] [--fail-on-publish-blocking]',
    '',
    'Default: --all'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    all: true,
    liveValidation: false,
    failOnPublishBlocking: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = argv[index + 1] || '';
      options.all = false;
      index += 1;
    } else if (arg.startsWith('--date=')) {
      options.date = arg.slice('--date='.length);
      options.all = false;
    } else if (arg === '--all') {
      options.all = true;
      options.date = '';
    } else if (arg === '--live-validation') {
      options.liveValidation = true;
    } else if (arg === '--fail-on-publish-blocking') {
      options.failOnPublishBlocking = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new Error(`Newsletter date must use YYYY-MM-DD, found: ${date || '(empty)'}`);
  }
  return date;
}

async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (options.all) {
    const result = await writeNewsletterImageAuditAggregate({ ...options, root });
    console.log(`Wrote ${path.relative(root, result.jsonPath).replace(/\\/g, '/')}`);
    console.log(`Wrote ${path.relative(root, result.markdownPath).replace(/\\/g, '/')}`);
    return 0;
  }
  const date = validateDate(options.date);
  const result = await writeNewsletterImageAuditArtifacts({ ...options, root, date });
  console.log(`Wrote ${path.relative(root, result.jsonPath).replace(/\\/g, '/')}`);
  console.log(`Wrote ${path.relative(root, result.markdownPath).replace(/\\/g, '/')}`);
  return 0;
}

if (require.main === module) {
  main().then(
    code => process.exit(code),
    error => {
      console.error(error.message);
      console.error(usage());
      process.exit(1);
    }
  );
}

module.exports = {
  main,
  parseArgs,
  validateDate
};
