const fs = require('fs');
const path = require('path');

const root = process.cwd();
const errors = [];

const markdownRoots = [
  'README.md',
  'AGENTS.md',
  'plan.md',
  'handoff.md',
  path.join('.github', 'pull_request_template.md'),
  'docs',
  'templates'
];

const generatedPathParts = new Set([
  'collected-news',
  'newsletters',
  'newsroom',
  'node_modules'
]);

const mojibakePattern = /[\uFFFD\uF900-\uFAFF]/;
const hangulPattern = /[가-힣]/;

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
  const items = readJson(path.join('data', 'newsletters.json'));
  for (const item of items) {
    if (!hangulPattern.test(String(item.title || ''))) {
      errors.push(`data/newsletters.json: ${item.date} title에 한국어 표시값이 없습니다.`);
    }
    if (!hangulPattern.test(String(item.summary || ''))) {
      errors.push(`data/newsletters.json: ${item.date} summary에 한국어 표시값이 없습니다.`);
    }
  }
}

function checkSourceRegistry() {
  const registry = readJson(path.join('data', 'news-sources.json'));
  for (const source of registry.sources || []) {
    if (!hangulPattern.test(String(source.usageHint || ''))) {
      errors.push(`data/news-sources.json: ${source.id}.usageHint는 한국어 설명을 포함해야 합니다.`);
    }
  }
}

checkMarkdown();
checkNewsletterData();
checkSourceRegistry();

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Localization validation passed.');
