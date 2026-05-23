const fs = require('fs');
const path = require('path');

const {
  readJson,
  repoPath
} = require('./common/common');
const {
  NO_IMMEDIATE_ACTION_TEXT
} = require('./common/public-article-contract');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function usage() {
  return 'Usage: node scripts/newsroom/validate-public-artifact-sync.js --date YYYY-MM-DD';
}

function articleHeadlineCountFromMarkdown(value = '') {
  return [...String(value).matchAll(/^##\s+\d+\.\s+.+$/gm)]
    .filter(match => !/^##\s+1\.\s+/.test(match[0]))
    .length;
}

function articleHeadlineCountFromHtml(value = '') {
  return (String(value).match(/\barticle-card\b/gi) || []).length;
}

function sourceCountFromMarkdown(value = '') {
  return (String(value).match(/^\s*-\s+\[[^\]]+\]\(https?:\/\/[^)]+\)/gm) || []).length;
}

function sourceCountFromHtml(value = '') {
  return (String(value).match(/<a\b[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi) || []).length;
}

function validatePublicArtifactSync({ root = process.cwd(), date }) {
  if (!DATE_PATTERN.test(String(date || ''))) throw new Error(usage());
  const errors = [];
  const indexPath = path.join(root, 'data', 'newsletters.json');
  const items = readJson(indexPath);
  const entry = Array.isArray(items) ? items.find(item => item?.date === date) : null;
  if (!entry) errors.push(`data/newsletters.json is missing date entry: ${date}`);

  const markdownPath = repoPath(root, entry?.md || `newsletters/${date}/newsletter.md`);
  const htmlPath = repoPath(root, entry?.html || `newsletters/${date}/index.html`);
  const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
  const statusPath = path.join(root, 'content', 'newsroom', date, 'generation-status.json');

  if (!markdownPath || !fs.existsSync(markdownPath)) errors.push(`Missing newsletter markdown for ${date}`);
  if (!htmlPath || !fs.existsSync(htmlPath)) errors.push(`Missing newsletter html for ${date}`);
  if (!fs.existsSync(editorPath)) errors.push(`Missing editor draft for ${date}`);
  if (!fs.existsSync(statusPath)) errors.push(`Missing generation status for ${date}`);
  if (errors.length > 0) return { ok: false, errors };

  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const editor = readJson(editorPath);
  const status = readJson(statusPath);
  const editorArticleCount = Array.isArray(editor.sections) ? editor.sections.length : 0;
  const markdownArticleCount = articleHeadlineCountFromMarkdown(markdown);
  const htmlArticleCount = articleHeadlineCountFromHtml(html);

  if (entry.date !== date) errors.push(`data/newsletters.json date mismatch: ${entry.date}`);
  if (editor.date !== date) errors.push(`editor-draft.json date mismatch: ${editor.date}`);
  if (status.date !== date) errors.push(`generation-status.json date mismatch: ${status.date}`);
  if (markdownArticleCount !== editorArticleCount) {
    errors.push(`newsletter.md article count mismatch: markdown=${markdownArticleCount}, editor=${editorArticleCount}`);
  }
  if (htmlArticleCount !== editorArticleCount) {
    errors.push(`index.html article count mismatch: html=${htmlArticleCount}, editor=${editorArticleCount}`);
  }
  if (sourceCountFromMarkdown(markdown) === 0 || sourceCountFromHtml(html) === 0) {
    errors.push('Rendered source count must be non-zero in markdown and html.');
  }
  if (markdown.includes(NO_IMMEDIATE_ACTION_TEXT) || html.includes(NO_IMMEDIATE_ACTION_TEXT)) {
    errors.push('Rendered public artifacts contain repeated generic fallback checkpoint text.');
  }

  return { ok: errors.length === 0, errors };
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] !== '--date') throw new Error(usage());
  const result = validatePublicArtifactSync({ date: argv[1] });
  if (!result.ok) {
    console.error(result.errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log('Validated public artifact sync.');
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
  validatePublicArtifactSync
};
