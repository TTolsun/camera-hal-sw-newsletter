const fs = require('fs');

const {
  NO_IMMEDIATE_ACTION_TEXT
} = require('../common/public-article-contract');

const PUBLIC_NEWSLETTER_FORBIDDEN_TERMS = Object.freeze([
  'Review-only',
  'review-only',
  'Fallback',
  'fallback',
  'quality gate',
  'candidate',
  'HAL Signal Capsule',
  'why_now',
  'impact_axes',
  'do_not_overstate',
  'guardrail',
  'section repair',
  'hard failure',
  'candidate shortage',
  'deterministic reconstruction',
  'source-bound',
  'publish gate'
]);

const GENERIC_CHECKPOINT_PATTERNS = Object.freeze([
  /source URL/i,
  /published date/i,
  /article text/i,
  /다음\s*issue/i,
  /후속\s*release note/i,
  /HAL 직접 변경 claim/i,
  /watch\/supporting context/i,
  /Direct HAL behavior claim/i,
  /Publication 전에/i
]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function visibleMarkdownText(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/`([^`]+)`/g, '$1');
}

function visibleHtmlText(value) {
  return decodeEntities(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function findForbiddenTerms(text, label) {
  const visible = String(text || '').toLowerCase();
  return PUBLIC_NEWSLETTER_FORBIDDEN_TERMS
    .filter(term => visible.includes(String(term || '').toLowerCase()))
    .map(term => `${label} contains internal public-forbidden term: ${term}`);
}

function mainArticleBlocks(markdown) {
  const matches = [...String(markdown || '').matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let index = 0; index < matches.length; index += 1) {
    const number = Number(matches[index][1]);
    const title = matches[index][2].trim();
    if (number <= 1) continue;
    if (/^(?:참고자료|References)$/i.test(title)) continue;
    if (/Action|실행/.test(title)) continue;
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1] ? matches[index + 1].index : markdown.length;
    blocks.push({ number, title, text: markdown.slice(start, end) });
  }
  return blocks;
}

function checkpointItems(articleText) {
  const match = String(articleText || '').match(/###\s+확인할 점\s+([\s\S]*?)(?:\n\*\*Sources\*\*|\n##\s+|$)/);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.replace(/^-\s+/, '').trim())
    .filter(Boolean);
}

function normalizedCheckpoint(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function allNoAction(checkpoints) {
  return checkpoints.length > 0 && checkpoints.every(item => item === NO_IMMEDIATE_ACTION_TEXT);
}

function repeatedCheckpointErrors(articleCheckpoints) {
  const errors = [];
  const comparable = articleCheckpoints
    .map((items, index) => ({ index, items: items.map(normalizedCheckpoint).filter(Boolean) }))
    .filter(item => item.items.length > 0 && !allNoAction(articleCheckpoints[item.index]));
  if (comparable.length < 2) return errors;

  const first = comparable[0].items.join('\n');
  if (comparable.every(item => item.items.join('\n') === first)) {
    errors.push('Public reader_checkpoints are identical across all articles.');
    return errors;
  }

  for (let left = 0; left < comparable.length; left += 1) {
    for (let right = left + 1; right < comparable.length; right += 1) {
      const leftSet = new Set(comparable[left].items);
      const rightItems = comparable[right].items;
      const overlap = rightItems.filter(item => leftSet.has(item)).length;
      const denominator = Math.min(comparable[left].items.length, rightItems.length);
      if (denominator > 0 && overlap / denominator >= 0.7) {
        errors.push(`Public reader_checkpoints overlap 70% or more between article ${comparable[left].index + 1} and article ${comparable[right].index + 1}.`);
      }
    }
  }
  return errors;
}

function validatePublicMarkdown(markdown, label = 'newsletter.md') {
  const errors = [];
  const visible = visibleMarkdownText(markdown);
  errors.push(...findForbiddenTerms(visible, label));
  if (/verified_facts|확인된 변경점:|확인한 사실 \/ 릴리스 요약/i.test(visible)) {
    errors.push(`${label} renders raw verified facts/checklist language.`);
  }

  const articleCheckpoints = [];
  for (const article of mainArticleBlocks(markdown)) {
    const items = checkpointItems(article.text);
    articleCheckpoints.push(items);
    if (items.length === 0) {
      errors.push(`${label} article ${article.number} is missing reader checkpoints.`);
    }
    for (const item of items) {
      if (item === NO_IMMEDIATE_ACTION_TEXT) continue;
      if (GENERIC_CHECKPOINT_PATTERNS.some(pattern => pattern.test(item))) {
        errors.push(`${label} article ${article.number} has editorial QA checkpoint: ${item}`);
      }
    }
    const paragraphs = String(article.text)
      .split(/\n{2,}/)
      .map(item => item.trim())
      .filter(item => item && !item.startsWith('- ') && !item.startsWith('**') && !item.startsWith('###') && !item.startsWith('!['));
    if (paragraphs.length < 3) {
      errors.push(`${label} article ${article.number} must include lead plus at least 2 body paragraphs.`);
    }
  }
  errors.push(...repeatedCheckpointErrors(articleCheckpoints));
  return errors;
}

function validatePublicHtml(html, label = 'index.html') {
  const visible = visibleHtmlText(html);
  return findForbiddenTerms(visible, label);
}

function validatePublicNewsletterArtifacts({ markdown = '', html = '', markdownLabel = 'newsletter.md', htmlLabel = 'index.html' } = {}) {
  return [
    ...validatePublicMarkdown(markdown, markdownLabel),
    ...validatePublicHtml(html, htmlLabel)
  ];
}

function validatePublicNewsletterFiles(markdownPath, htmlPath) {
  return validatePublicNewsletterArtifacts({
    markdown: readText(markdownPath),
    html: readText(htmlPath),
    markdownLabel: markdownPath,
    htmlLabel: htmlPath
  });
}

module.exports = {
  GENERIC_CHECKPOINT_PATTERNS,
  PUBLIC_NEWSLETTER_FORBIDDEN_TERMS,
  validatePublicHtml,
  validatePublicMarkdown,
  validatePublicNewsletterArtifacts,
  validatePublicNewsletterFiles,
  visibleHtmlText,
  visibleMarkdownText
};
