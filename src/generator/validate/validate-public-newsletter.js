const fs = require('fs');
const path = require('path');

const {
  readJson,
  repoPath
} = require('../../shared/common/common');
const {
  publicAssetPath
} = require('../../shared/common/artifact-paths');
const {
  historicalPolicyWarningReason,
  strictTargetDates,
  strictWeeklyKeys
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
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
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
      throw new Error('Usage: node src/generator/validate/validate-public-newsletter.js --date YYYY-MM-DD');
    }
    if (args.length !== 2) {
      throw new Error('Usage: node src/generator/validate/validate-public-newsletter.js --date YYYY-MM-DD');
    }
    return validateDateArtifacts(date);
  }
  if (args.length !== 2) {
    throw new Error('Usage: node src/generator/validate/validate-public-newsletter.js <newsletter.md> <index.html> OR --date YYYY-MM-DD');
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
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  for (const filePath of readJsonFilesInDir(newsroomDir).filter(filePath => !isDiagnosticsOnlyNewsroomJson(filePath))) {
    const rel = path.relative(root, filePath).replace(/\\/g, '/');
    errors.push(...publicArticlePathIssues(readJson(filePath), rel));
  }
  const newsletterDir = path.join(root, 'articles', 'newsletters', date);
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
  if (!item) return [`articles/data/newsletters.json is missing date entry: ${date}`];
  const markdownPath = publicAssetPath(root, item.md || `newsletters/${date}/newsletter.md`);
  const htmlPath = publicAssetPath(root, item.html || `newsletters/${date}/index.html`);
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
    const markdownPath = publicAssetPath(root, item?.md || '');
    const htmlPath = publicAssetPath(root, item?.html || '');
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

// #1142: 주간 페이지도 콘텐츠 계약(validatePublicNewsletterFiles)의 strict 대상이다. 이번
// 변경이 건드린 주간 키와 이번 발행 주 키만 hard fail이고, 나머지 과거 호는 warning-only다.
// 발행된 주간호 20개(W19~W38)에 이 검사를 전수로 돌려 실패 0건을 확인한 뒤 strict로 올렸다.
// weeklyNewsletterStructureStatus의 structural 검사(issue.json 이미지 필드)는 여기 넣지
// 않는다 — 과거 6개 호가 옛 스키마라 사후에 만족시킬 수 없고, 그 층은 발행 시점의 이번 주
// 키만 게이트한다(resolve-reviewable-artifacts.js).
function validateIndexedWeeklyNewsletters({ rootDir = root, strictKeys = null } = {}) {
  const errors = [];
  const warnings = [];
  const dataPath = path.join(rootDir, 'articles', 'data', 'newsletters-weekly.json');
  if (!fs.existsSync(dataPath)) return { errors, warnings };
  const items = readJson(dataPath);
  if (!Array.isArray(items)) {
    errors.push('data/newsletters-weekly.json must contain an array');
    return { errors, warnings };
  }
  const strict = strictKeys || strictWeeklyKeys({
    root: rootDir,
    newsletterDatePath: path.join(rootDir, '.tmp', 'newsletter-date.txt')
  });
  const requireAll = process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT === '1';
  for (const item of items) {
    const weeklyKey = item?.weeklyKey;
    const markdownPath = publicAssetPath(rootDir, item?.md || '');
    const htmlPath = publicAssetPath(rootDir, item?.html || '');
    if (!markdownPath || !htmlPath || !fs.existsSync(markdownPath) || !fs.existsSync(htmlPath)) {
      // strict 키는 색인 엔트리가 있는데 실체 파일이 없으면 그 자체가 불일치다(엔트리와 파일은
      // 같은 발행 커밋에서 함께 생긴다). 과거 호의 부재는 일간 레인과 같은 이유로 여기서는
      // 넘어간다 — 존재 검사는 validate:site 층이 본다.
      if (requireAll || strict.has(weeklyKey)) {
        errors.push(`weekly ${weeklyKey || 'entry'}: public newsletter files are missing for an indexed entry`);
      }
      continue;
    }
    const result = validatePublicNewsletterFiles(markdownPath, htmlPath)
      .map(error => `weekly ${weeklyKey || 'entry'}: ${error}`);
    if (result.length === 0) continue;
    if (requireAll || strict.has(weeklyKey)) {
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
  const weekly = validateIndexedWeeklyNewsletters();
  errors.push(...weekly.errors);
  warnings.push(...weekly.warnings);
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
  validateIndexedNewsletters,
  validateIndexedWeeklyNewsletters
};
