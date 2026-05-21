const {
  repairNewsletterImages
} = require('../metrics/newsletter-image-audit');

function usage() {
  return [
    'Usage: node scripts/repair-newsletter-images.js --date YYYY-MM-DD',
    '       node scripts/repair-newsletter-images.js --all-repairable',
    '',
    'Repairs only existing imageCandidates that pass deterministic image audit rules.'
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    allRepairable: false,
    liveValidation: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--date=')) {
      options.date = arg.slice('--date='.length);
    } else if (arg === '--all-repairable') {
      options.allRepairable = true;
    } else if (arg === '--live-validation') {
      options.liveValidation = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function validateOptions(options) {
  if (options.help) return options;
  if (options.allRepairable) return options;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(options.date || ''))) {
    throw new Error('Provide --date YYYY-MM-DD or --all-repairable.');
  }
  return options;
}

async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const options = validateOptions(parseArgs(argv));
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const repairs = await repairNewsletterImages({ ...options, root });
  const repairedArticleCount = repairs.reduce((sum, item) => sum + item.repairedArticleCount, 0);
  console.log(`Repaired ${repairedArticleCount} article image selection(s).`);
  for (const item of repairs) {
    console.log(`- ${item.date}: ${item.repairedArticleCount}`);
  }
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
  validateOptions
};
