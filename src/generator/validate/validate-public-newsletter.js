const fs = require('fs');
const path = require('path');
const { weeklyKeyForDate } = require('../reporter/weekly-newsletter');
const { applyTranslation } = require('../render/apply-translation');

const {
  readJson,
  repoPath
} = require('../../shared/common/common');
const {
  publicAssetPath
} = require('../../shared/common/artifact-paths');
const {
  changedFilesFromGit,
  historicalPolicyWarningReason,
  readNewsletterDate,
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

function newsroomJsonIssues(date, changedFiles = null) {
  const errors = [];
  const dir = path.join(root, 'articles', 'content', 'newsroom', date);
  for (const filePath of readJsonFilesInDir(dir).filter(file => !isDiagnosticsOnlyNewsroomJson(file))) {
    const rel = path.relative(root, filePath).replace(/\\/g, '/');
    if (changedFiles && !changedFiles.has(rel)) continue;
    const value = readJson(filePath);
    errors.push(...(path.basename(filePath) === 'editor-draft.json'
      ? activeRenderedArticleIssues(value, rel) : publicArticlePathIssues(value, rel)));
  }
  return errors;
}

function activeRenderedArticleIssues(issue, label) {
  if (!Array.isArray(issue?.sections)) return [label + ': renderer sections must contain an array'];
  // Only active renderer sections inherit this issue's contract marker. Archived
  // metadata.legacySection/public_article values keep their original provenance.
  return issue.sections.flatMap((section, index) => validatePublicArticle(section, index, { issue })
    .map(error => label + ':sections[' + index + '].public_article failed: ' + error.type + (error.key ? ' ' + error.key : '') + (error.reason ? ' ' + error.reason : '') + (error.message ? ' ' + error.message : '')));
}

function weeklyRenderInputIssues(rootDir, weeklyKey) {
  const errors = [];
  const dir = path.join(rootDir, 'articles', 'newsletters', weeklyKey);
  for (const filePath of readJsonFilesInDir(dir)) {
    const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const name = path.basename(filePath);
    try {
      const value = readJson(filePath);
      if (!['issue.json', 'publication-source.json', 'translation.en.json'].includes(name)) {
        errors.push(...validatePublicNewsletterArtifacts({ json: value, jsonLabel: rel }));
        continue;
      }
      // Renderer/translation inputs carry required contract keys, not reader-facing
      // JSON projections. Keep raw monitor state forbidden and validate active prose
      // through its article contract rather than banning its schema field names.
      const raw = JSON.stringify(value);
      for (const term of ['processed_source_event_ids', 'processed_evidence_ids', 'previous_values', 'current_values', 'state/source-snapshots/', 'content/source-events/']) {
        if (raw.includes(term)) errors.push(rel + ' contains raw source monitor state: ' + term);
      }
      if (name === 'translation.en.json') {
        const sourceText = fs.readFileSync(path.join(dir, 'issue.json'), 'utf8');
        errors.push(...activeRenderedArticleIssues(applyTranslation(JSON.parse(sourceText), value, { sourceText }), rel));
      } else {
        const issue = name === 'publication-source.json' ? value.issue : value;
        errors.push(...activeRenderedArticleIssues(issue, rel));
      }
    } catch (error) {
      errors.push(rel + ': invalid render input: ' + error.message);
    }
  }
  return errors;
}

function validatePublicJsonFilesForDate(date) {
  const errors = newsroomJsonIssues(date);
  const newsletterDir = path.join(root, 'articles', 'newsletters', date);
  for (const filePath of readJsonFilesInDir(newsletterDir)) {
    const rel = path.relative(root, filePath).replace(/\\/g, '/');
    errors.push(...validatePublicNewsletterArtifacts({ json: readJson(filePath), jsonLabel: rel }));
  }
  errors.push(...weeklyRenderInputIssues(root, weeklyKeyForDate(date)));
  return errors;
}

function currentNewsroomJsonIssues() {
  const errors = [];
  const selectedDate = readNewsletterDate(newsletterDatePath);
  const changed = new Set(changedFilesFromGit({ root }));
  const dates = new Set([...changed].map(file => /^articles\/content\/newsroom\/(\d{4}-\d{2}-\d{2})\/[^/]+\.json$/.exec(file)?.[1]).filter(Boolean));
  if (DATE_PATTERN.test(selectedDate)) dates.add(selectedDate);
  for (const date of dates) {
    const statusPath = path.join(root, 'articles/content/newsroom', date, 'generation-status.json');
    const status = fs.existsSync(statusPath) ? readJson(statusPath) : {};
    if (status.public_output_expected === false) continue; // Non-public review drafts are not publication inputs.
    errors.push(...newsroomJsonIssues(date, date === selectedDate ? null : changed));
  }
  return errors;
}

function validateDateArtifacts(date) {
  const datedItem = newsletterItemForDate(date);
  const weeklyKey = weeklyKeyForDate(date);
  const weeklyIndexPath = path.join(root, 'articles/data/newsletters-weekly.json');
  const weeklyItems = fs.existsSync(weeklyIndexPath) ? readJson(weeklyIndexPath) : [];
  if (!Array.isArray(weeklyItems)) return ['articles/data/newsletters-weekly.json must contain an array'];
  const weeklyItem = weeklyItems.find(item => item?.weeklyKey === weeklyKey);
  // Explicit archive validation keeps the dated fallback. A weekly-only execution
  // must have its matching weekly entry; it cannot succeed by inspecting nothing.
  const selectedRun = fs.existsSync(newsletterDatePath) && fs.readFileSync(newsletterDatePath, 'utf8').trim() === date;
  const item = weeklyItem || (!selectedRun ? datedItem : null);
  if (!item) return ['articles/data/newsletters-weekly.json is missing publish week entry: ' + weeklyKey + ' for execution ' + date];
  if (weeklyItem && (weeklyItem.html !== 'newsletters/' + weeklyKey + '/index.html' || weeklyItem.md !== 'newsletters/' + weeklyKey + '/newsletter.md')) {
    return ['weekly ' + weeklyKey + ': public newsletter index path mismatch'];
  }
  const key = weeklyItem ? weeklyKey : date;
  const indexLabel = weeklyItem ? 'newsletters-weekly.json' : 'newsletters.json';
  const markdownPath = publicAssetPath(root, item.md || `newsletters/${key}/newsletter.md`);
  const htmlPath = publicAssetPath(root, item.html || `newsletters/${key}/index.html`);
  if (!markdownPath || !htmlPath || !fs.existsSync(markdownPath) || !fs.existsSync(htmlPath)) {
    return [`Public newsletter files are missing for ${date}.`];
  }
  const errors = validatePublicNewsletterFiles(markdownPath, htmlPath, {
    json: item,
    jsonLabel: `data/${indexLabel}:${key}`
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
  const strict = strictKeys || strictWeeklyKeys({
    root: rootDir,
    newsletterDatePath: path.join(rootDir, '.tmp', 'newsletter-date.txt')
  });
  const requireAll = process.env.REQUIRE_PUBLIC_NEWSLETTER_CONTRACT === '1';
  const dataPath = path.join(rootDir, 'articles', 'data', 'newsletters-weekly.json');
  if (!fs.existsSync(dataPath)) {
    if (strict.size > 0 || requireAll) errors.push('Missing data/newsletters-weekly.json for current public validation');
    return { errors, warnings };
  }
  const items = readJson(dataPath);
  if (!Array.isArray(items)) {
    errors.push('data/newsletters-weekly.json must contain an array');
    return { errors, warnings };
  }
  for (const weeklyKey of strict) {
    if (!items.some(item => item?.weeklyKey === weeklyKey)) errors.push('weekly ' + weeklyKey + ': missing public newsletter index entry');
  }
  const latestKey = items.map(item => item?.weeklyKey).filter(key => /^\d{4}-W\d{2}$/.test(key || '')).sort().at(-1);
  for (const item of items) {
    const weeklyKey = item?.weeklyKey;
    if (requireAll || strict.has(weeklyKey) || weeklyKey === latestKey) errors.push(...weeklyRenderInputIssues(rootDir, weeklyKey));
    if ((requireAll || strict.has(weeklyKey)) &&
      (item.html !== 'newsletters/' + weeklyKey + '/index.html' || item.md !== 'newsletters/' + weeklyKey + '/newsletter.md')) {
      errors.push('weekly ' + weeklyKey + ': public newsletter index path mismatch');
    }
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
    const result = validatePublicNewsletterFiles(markdownPath, htmlPath, {
      json: item,
      jsonLabel: 'data/newsletters-weekly.json:' + (weeklyKey || 'entry')
    }).map(error => `weekly ${weeklyKey || 'entry'}: ${error}`);
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
  errors.push(...currentNewsroomJsonIssues());
  if (fs.existsSync(newsletterDatePath) && !DATE_PATTERN.test(fs.readFileSync(newsletterDatePath, 'utf8').trim())) {
    errors.push('Invalid .tmp/newsletter-date.txt execution date');
  }
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
