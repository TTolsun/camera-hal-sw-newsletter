const fs = require('fs');
const path = require('path');

const {
  readJson,
  repoPath
} = require('../../core/common/common');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../reporter/validation-targets');
const {
  validatePublicNewsletterArtifacts,
  validatePublicNewsletterFiles
} = require('../quality/public-newsletter');
const {
  validatePublicArticle
} = require('../reporter/public-article-contract');

const root = process.cwd();
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

function publicArticlePathLabel(keyPath = []) {
  return keyPath.map(item => /^\d+$/.test(item) ? '[]' : item).join('.');
}

function looksLikeNewsletterIssue(value) {
  return isPlainObject(value) && (
    Object.prototype.hasOwnProperty.call(value, 'public_contract_version') ||
    Object.prototype.hasOwnProperty.call(value, 'generation_contract_version') ||
    Array.isArray(value.sections) ||
    Array.isArray(value.articles)
  );
}

function collectPublicArticleSections(value, keyPath = [], contextIssue = null) {
  const sections = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      sections.push(...collectPublicArticleSections(item, keyPath.concat(String(index)), contextIssue));
    });
    return sections;
  }
  if (!isPlainObject(value)) return sections;
  const nextIssue = looksLikeNewsletterIssue(value) ? value : contextIssue;
  for (const [key, item] of Object.entries(value)) {
    const itemPath = keyPath.concat(key);
    if (key === 'public_article' && isPlainObject(item)) {
      sections.push({
        keyPath: itemPath,
        issue: nextIssue || {},
        section: {
          ...value,
          public_article: item
        }
      });
      continue;
    }
    sections.push(...collectPublicArticleSections(item, itemPath, nextIssue));
  }
  return sections;
}

function publicArticlePathIssues(value, label) {
  const issues = [];
  for (const [index, { keyPath, section, issue: rootIssue }] of collectPublicArticleSections(value).entries()) {
    for (const issue of validatePublicArticle(section, index, { issue: rootIssue })) {
      issues.push(`${label}:${publicArticlePathLabel(keyPath)} failed: ${issue.type}${issue.key ? ` ${issue.key}` : ''}${issue.reason ? ` ${issue.reason}` : ''}${issue.message ? ` ${issue.message}` : ''}`);
    }
  }
  return issues;
}

function readJsonFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(dirPath, name));
}

function isDiagnosticsOnlyNewsroomJson(filePath) {
  return /(?:invalid|validation-error|attempt|retry-history|repair-failure)/i.test(path.basename(filePath));
}

function validatePublicJsonFilesForDate(date) {
  const errors = [];
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  for (const filePath of readJsonFilesInDir(newsroomDir).filter(filePath => !isDiagnosticsOnlyNewsroomJson(filePath))) {
    const rel = path.relative(root, filePath).replace(/\\/g, '/');
    errors.push(...publicArticlePathIssues(readJson(filePath), rel));
  }
  const newsletterDir = path.join(root, 'newsletters', date);
  for (const filePath of readJsonFilesInDir(newsletterDir)) {
    const rel = path.relative(root, filePath).replace(/\\/g, '/');
    errors.push(...validatePublicNewsletterArtifacts({
      json: readJson(filePath),
      jsonLabel: rel
    }));
  }
  return errors;
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
  errors.push(...validatePublicJsonFilesForDate(date));
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
  collectPublicArticleSections,
  main,
  publicArticlePathIssues,
  validateIndexedNewsletters
};
