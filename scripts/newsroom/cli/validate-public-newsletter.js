const fs = require('fs');
const path = require('path');

const {
  readJson,
  repoPath
} = require('../common/common');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../common/validation-targets');
const {
  validatePublicNewsletterFiles
} = require('../validate/public-newsletter');
const {
  validatePublicArticle
} = require('../common/public-article-contract');

const root = process.cwd();
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readNewsletterItems() {
  const dataPath = path.join(root, 'data', 'newsletters.json');
  if (!fs.existsSync(dataPath)) throw new Error('Missing data/newsletters.json');
  const items = readJson(dataPath);
  if (!Array.isArray(items)) throw new Error('data/newsletters.json must contain an array');
  return items;
}

function validateExplicitFiles(args) {
  if (args.length === 0) return null;
  if (args[0] === '--date') {
    const date = args[1];
    if (!DATE_PATTERN.test(String(date || ''))) {
      throw new Error('Usage: node scripts/validate-public-newsletter.js --date YYYY-MM-DD');
    }
    if (args.length !== 2) {
      throw new Error('Usage: node scripts/validate-public-newsletter.js --date YYYY-MM-DD');
    }
    return validateDateArtifacts(date);
  }
  if (args.length !== 2) {
    throw new Error('Usage: node scripts/validate-public-newsletter.js <newsletter.md> <index.html> OR --date YYYY-MM-DD');
  }
  const markdownPath = repoPath(root, args[0]);
  const htmlPath = repoPath(root, args[1]);
  if (!markdownPath || !htmlPath) throw new Error('Public newsletter paths must stay inside the repository.');
  return validatePublicNewsletterFiles(markdownPath, htmlPath);
}

function newsletterItemForDate(date) {
  return readNewsletterItems().find(item => item?.date === date) || null;
}

function publicArticlePathIssues(value, date) {
  const issues = [];
  for (const [index, section] of (Array.isArray(value?.sections) ? value.sections : []).entries()) {
    for (const issue of validatePublicArticle(section, index)) {
      issues.push(`content/newsroom/${date}/editor-draft.json public_article failed: ${issue.type}${issue.key ? ` ${issue.key}` : ''}${issue.reason ? ` ${issue.reason}` : ''}${issue.message ? ` ${issue.message}` : ''}`);
    }
  }
  return issues;
}

function validateDateArtifacts(date) {
  const item = newsletterItemForDate(date);
  if (!item) return [`data/newsletters.json is missing date entry: ${date}`];
  const markdownPath = repoPath(root, item.md || `newsletters/${date}/newsletter.md`);
  const htmlPath = repoPath(root, item.html || `newsletters/${date}/index.html`);
  if (!markdownPath || !htmlPath || !fs.existsSync(markdownPath) || !fs.existsSync(htmlPath)) {
    return [`Public newsletter files are missing for ${date}.`];
  }
  const errors = validatePublicNewsletterFiles(markdownPath, htmlPath, {
    json: item,
    jsonLabel: `data/newsletters.json:${date}`
  });
  const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
  if (fs.existsSync(editorPath)) {
    errors.push(...publicArticlePathIssues(readJson(editorPath), date));
  }
  return errors;
}

function validateIndexedNewsletters() {
  const errors = [];
  const warnings = [];
  const strictDates = strictTargetDates({ root, newsletterDatePath });
  const requireAll = process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT === '1';
  for (const item of readNewsletterItems()) {
    const markdownPath = repoPath(root, item?.md || '');
    const htmlPath = repoPath(root, item?.html || '');
    if (!markdownPath || !htmlPath || !fs.existsSync(markdownPath) || !fs.existsSync(htmlPath)) continue;
    const result = validatePublicNewsletterFiles(markdownPath, htmlPath, {
      json: item,
      jsonLabel: `data/newsletters.json:${item.date || item.title || 'entry'}`
    });
    if (result.length === 0) continue;
    if (requireAll || strictDates.has(item.date)) {
      errors.push(...result);
    } else {
      warnings.push(...result.map(error => `${error} ${historicalPolicyWarningReason()}.`));
    }
  }
  return { errors, warnings };
}

function main(argv = process.argv.slice(2)) {
  const explicit = validateExplicitFiles(argv);
  if (explicit) {
    if (explicit.length > 0) {
      console.error(explicit.map(error => `- ${error}`).join('\n'));
      process.exit(1);
    }
    console.log('Validated public newsletter artifacts.');
    return;
  }

  const { errors, warnings } = validateIndexedNewsletters();
  if (warnings.length > 0) {
    console.warn(warnings.map(warning => `Warning: ${warning}`).join('\n'));
  }
  if (errors.length > 0) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log('Validated public newsletter artifacts.');
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
  validateIndexedNewsletters
};
