const fs = require('fs');
const path = require('path');

const {
  rawEnglishProseRuns,
  visibleHtmlText,
  visibleMarkdownText
} = require('../quality/public-newsletter');

const root = process.cwd();
const errors = [];

const markdownRoots = [
  'README.md',
  'AGENTS.md',
  'plan.md',
  'handoff.md',
  path.join('.github', 'pull_request_template.md'),
  path.join('.github', 'PULL_REQUEST_TEMPLATE'),
  'docs'
];

const promptHostFiles = [
  path.join('src', 'generator', 'publish', 'gemini-newsroom-newsletter.js'),
  path.join('src', 'generator', 'publish', 'build-newsroom-pr-body.js'),
  path.join('src', 'generator', 'render', 'newsletter-renderer.js')
];

const generatedPathParts = new Set([
  'collected-news',
  'content',
  'newsletters',
  'newsroom',
  'node_modules'
]);

const mojibakePattern = /[\uFFFD\uF900-\uFAFF]/;
const hangulPattern = /[가-힣]/;
const canonicalNewsletterTitlePattern = /^Camera HAL \/ SW Newsletter - \d{4}-\d{2}-\d{2}$/;

const staleEnglishPhrases = [
  'Project Structure & Module Organization',
  'Build, Test, and Development Commands',
  'Coding Style & Naming Conventions',
  'Testing Guidelines',
  'Commit & Pull Request Guidelines',
  'Agent-Specific Instructions',
  '# Newsletter Sources',
  '# News Source Registry',
  '# Manual-Quality Newsletter Example',
  '## Files inspected',
  '## Commands run',
  '## Test results'
];

function repoPath(relPath) {
  return path.join(root, relPath);
}

function relPath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function isGeneratedPath(filePath) {
  return relPath(filePath).split('/').some(part => generatedPathParts.has(part));
}

function addLongEnglishProseErrors(label, value) {
  for (const run of rawEnglishProseRuns(value)) {
    errors.push(`${label}: 긴 영어 prose가 남아 있습니다. 한국어로 요약하세요: ${run.slice(0, 120)}`);
  }
}

function collectMarkdown(filePath, out = []) {
  if (!fs.existsSync(filePath) || isGeneratedPath(filePath)) return out;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      collectMarkdown(path.join(filePath, entry), out);
    }
    return out;
  }
  if (filePath.endsWith('.md')) out.push(filePath);
  return out;
}

function checkMarkdown() {
  const files = markdownRoots.flatMap(item => collectMarkdown(repoPath(item)));
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    const displayPath = relPath(filePath);
    if (mojibakePattern.test(text)) {
      errors.push(`${displayPath}: 깨진 인코딩으로 보이는 문자가 있습니다.`);
    }
    for (const phrase of staleEnglishPhrases) {
      if (text.includes(phrase)) {
        errors.push(`${displayPath}: 한국어 문서로 바꿔야 하는 영어 문구가 남아 있습니다: ${phrase}`);
      }
    }
  }
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(repoPath(rel), 'utf8'));
}

function checkNewsletterData() {
  const items = readJson(path.join('articles', 'data', 'newsletters.json'));
  for (const item of items) {
    const title = String(item.title || '');
    const expectedCanonicalTitle = item.date ? `Camera HAL / SW Newsletter - ${item.date}` : '';
    const canonicalNewsletterTitle = canonicalNewsletterTitlePattern.test(title) && title === expectedCanonicalTitle;
    if (!hangulPattern.test(title) && !canonicalNewsletterTitle) {
      errors.push(`data/newsletters.json: ${item.date} title에 한국어 표시값이 없습니다.`);
    }
    if (!hangulPattern.test(String(item.summary || ''))) {
      errors.push(`data/newsletters.json: ${item.date} summary에 한국어 표시값이 없습니다.`);
    }
    addLongEnglishProseErrors(`data/newsletters.json: ${item.date} title`, title);
    addLongEnglishProseErrors(`data/newsletters.json: ${item.date} summary`, item.summary || '');
  }
}

function checkHomepageHeadlineData() {
  const rel = path.join('articles', 'data', 'homepage-headline.json');
  const filePath = repoPath(rel);
  if (!fs.existsSync(filePath)) return;
  const state = readJson(rel);
  const headline = state?.current_headline;
  if (!headline) return;
  for (const field of ['title', 'summary']) {
    const value = String(headline[field] || '');
    if (!hangulPattern.test(value)) {
      errors.push(`data/homepage-headline.json: current_headline.${field}에 한국어 표시값이 없습니다.`);
    }
    addLongEnglishProseErrors(`data/homepage-headline.json: current_headline.${field}`, value);
  }
}

function checkLatestPublicNewsletterArtifacts() {
  const items = readJson(path.join('articles', 'data', 'newsletters.json'));
  const latest = items[0];
  if (!latest) return;
  for (const rel of [latest.md, latest.html].filter(Boolean)) {
    const filePath = repoPath(rel);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8');
    const visible = rel.endsWith('.html') ? visibleHtmlText(text) : visibleMarkdownText(text);
    addLongEnglishProseErrors(rel, visible);
  }
}

function checkSourceRegistry() {
  const registry = readJson(path.join('src', 'core', 'data', 'news-sources.json'));
  for (const source of registry.sources || []) {
    if (!hangulPattern.test(String(source.usageHint || ''))) {
      errors.push(`src/core/data/news-sources.json: ${source.id}.usageHint는 한국어 설명을 포함해야 합니다.`);
    }
  }
}

function checkPromptHosts() {
  for (const rel of promptHostFiles) {
    const filePath = repoPath(rel);
    if (!fs.existsSync(filePath)) continue;
    addLongEnglishProseErrors(rel, fs.readFileSync(filePath, 'utf8'));
  }
}

checkMarkdown();
checkNewsletterData();
checkHomepageHeadlineData();
checkLatestPublicNewsletterArtifacts();
checkSourceRegistry();
checkPromptHosts();

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Localization validation passed.');
