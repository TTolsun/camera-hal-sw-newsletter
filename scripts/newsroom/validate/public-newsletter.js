const fs = require('fs');

const {
  NO_IMMEDIATE_ACTION_TEXT,
  publicProseLeakageIssues,
  publicUrlError
} = require('../common/public-article-contract');

const GENERIC_CHECKPOINT_PATTERNS = Object.freeze([
  /source URL/i,
  /^published date(?:\s+check)?$/i,
  /article text/i,
  /다음\s*issue/i,
  /후속\s*release note/i,
  /HAL 직접 변경 claim/i,
  /watch\/supporting context/i,
  /Direct HAL behavior claim/i,
  /Publication 전에/i
]);

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

function htmlJsonScriptBlocks(value) {
  const blocks = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(String(value || ''))) !== null) {
    const attrs = match[1] || '';
    if (!/type\s*=\s*["']application\/(?:json|ld\+json)["']/i.test(attrs) && !/NEWSLETTER_DATA|newsletter/i.test(match[2])) {
      continue;
    }
    blocks.push(decodeEntities(match[2] || '').trim());
  }
  return blocks.filter(Boolean);
}

function allowedForbiddenTerms(options = {}) {
  return new Set();
}

function findForbiddenTerms(text, label, options = {}) {
  const allowed = allowedForbiddenTerms(options);
  const filtered = publicProseLeakageIssues(text, label)
    .filter(message => ![...allowed].some(term => message.toLowerCase().includes(String(term).toLowerCase())));
  return filtered;
}

function publicArtifactUrlError(value) {
  const raw = String(value || '').trim();
  const normalized = raw.replace(/\\/g, '/').toLowerCase();
  if (
    normalized.startsWith('.tmp/') ||
    normalized.startsWith('/.tmp/') ||
    normalized.startsWith('content/newsroom/') ||
    normalized.startsWith('/content/newsroom/') ||
    normalized.startsWith('content/collected-news/') ||
    normalized.startsWith('/content/collected-news/') ||
    normalized.includes('/.tmp/') ||
    normalized.includes('/content/newsroom/') ||
    normalized.includes('/content/collected-news/')
  ) {
    return 'internal_artifact_url';
  }
  return publicUrlError(raw);
}

function markdownLinks(value) {
  const links = [];
  const pattern = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(String(value || ''))) !== null) {
    links.push(match[1]);
  }
  return links;
}

function sourceBlocks(markdown) {
  const blocks = [];
  const lines = String(markdown || '').split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    if (/^\*\*(?:Sources|출처)\*\*\s*$/i.test(line) || /^##\s+(?:참고자료|References)\s*$/i.test(line)) {
      if (current !== null) blocks.push(current.join('\n'));
      current = [];
      continue;
    }
    if (current !== null && (/^---\s*$/.test(line) || /^##\s+/.test(line))) {
      blocks.push(current.join('\n'));
      current = null;
    }
    if (current !== null) current.push(line);
  }
  if (current !== null) blocks.push(current.join('\n'));
  return blocks;
}

function validatePublicSourceLinks(markdown, label) {
  const errors = [];
  for (const block of sourceBlocks(markdown)) {
    for (const url of markdownLinks(block)) {
      const reason = publicArtifactUrlError(url);
      if (reason) errors.push(`${label} public source link has non-public URL (${reason}): ${url}`);
    }
  }
  return errors;
}

function mainArticleBlocks(markdown) {
  const matches = [...String(markdown || '').matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let index = 0; index < matches.length; index += 1) {
    const number = Number(matches[index][1]);
    const title = matches[index][2].trim();
    if (/^(?:참고자료|References)$/i.test(title)) continue;
    if (/Action|실행/.test(title)) continue;
    if (/이번 주|브리핑|요약/.test(title)) continue;
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1] ? matches[index + 1].index : markdown.length;
    const text = markdown.slice(start, end);
    blocks.push({ number, title, text });
  }
  return blocks;
}

function checkpointItems(articleText) {
  const match = String(articleText || '').match(/#{3,4}\s+(?:(?:Camera HAL\s*\/\s*Driver|Android Native \/ Tooling)\s+관점(?:에서의 의미|에서 확인할 점)?|확인할 점)\s+([\s\S]*?)(?:\n\*\*(?:Sources|출처)\*\*|\n#{2,4}\s+|$)/);
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

function repeatedCheckpointErrors(articleCheckpoints) {
  const errors = [];
  const comparable = articleCheckpoints
    .map((items, index) => ({ index, items: items.map(normalizedCheckpoint).filter(Boolean) }))
    .filter(item => item.items.length > 0);
  if (comparable.length < 2) return errors;

  const first = comparable[0].items.join('\n');
  if (comparable.every(item => item.items.join('\n') === first)) {
    errors.push('Public checkpoint bullet lists are identical across all articles.');
    return errors;
  }

  for (let left = 0; left < comparable.length; left += 1) {
    for (let right = left + 1; right < comparable.length; right += 1) {
      const leftSet = new Set(comparable[left].items);
      const rightItems = comparable[right].items;
      const overlap = rightItems.filter(item => leftSet.has(item)).length;
      const denominator = Math.min(comparable[left].items.length, rightItems.length);
      if (denominator > 0 && overlap / denominator >= 0.7) {
        errors.push(`Public checkpoint bullet lists overlap 70% or more between article ${comparable[left].index + 1} and article ${comparable[right].index + 1}.`);
      }
    }
  }
  return errors;
}

const ENGLISH_PROSE_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'any',
  'are',
  'as',
  'because',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'like',
  'of',
  'offering',
  'our',
  'that',
  'the',
  'this',
  'to',
  'using',
  'with',
  'you',
  'your'
]);

function rawEnglishProseRuns(value) {
  const runs = String(value || '').match(/\b(?:[A-Za-z][A-Za-z0-9+/#.-]*[\s,;:()/-]+){16,}[A-Za-z][A-Za-z0-9+/#.-]*\b/g) || [];
  return runs.filter(run => {
    const words = run.toLowerCase().match(/[a-z]+/g) || [];
    const stopwordCount = words.filter(word => ENGLISH_PROSE_STOPWORDS.has(word)).length;
    return stopwordCount >= 5;
  });
}

function longEnglishParagraphErrors(article, paragraphs, label) {
  const errors = [];
  for (const paragraph of paragraphs) {
    for (const run of rawEnglishProseRuns(paragraph)) {
      errors.push(`${label} article ${article.number} contains a long English prose run; summarize it in Korean instead: ${run.slice(0, 120)}`);
    }
  }
  return errors;
}

function validatePublicMarkdown(markdown, label = 'newsletter.md', options = {}) {
  const errors = [];
  const visible = visibleMarkdownText(markdown);
  errors.push(...findForbiddenTerms(visible, label, options));
  errors.push(...validatePublicSourceLinks(markdown, label));
  if (/verified_facts|확인된 변경점:|확인한 사실 \/ 릴리스 요약/i.test(visible)) {
    errors.push(`${label} renders raw verified facts/checklist language.`);
  }

  const articleCheckpoints = [];
  for (const article of mainArticleBlocks(markdown)) {
    const items = checkpointItems(article.text);
    articleCheckpoints.push(items);
    for (const item of items) {
      if (item === NO_IMMEDIATE_ACTION_TEXT) {
        errors.push(`${label} article ${article.number} has generic fallback checkpoint: ${item}`);
        continue;
      }
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
    errors.push(...longEnglishParagraphErrors(article, paragraphs, label));
  }
  errors.push(...repeatedCheckpointErrors(articleCheckpoints));
  return errors;
}

function validatePublicHtml(html, label = 'index.html', options = {}) {
  const visible = visibleHtmlText(html);
  const errors = findForbiddenTerms(visible, label, options);
  htmlJsonScriptBlocks(html).forEach((block, index) => {
    try {
      errors.push(...validatePublicJsonText(JSON.parse(block), `${label}:script[${index}]`));
    } catch (_) {
      errors.push(...findForbiddenTerms(block, `${label}:script[${index}]`, options));
    }
  });
  return errors;
}

function publicJsonTextValues(value, keyPath = []) {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const key = keyPath[keyPath.length - 1] || '';
    if ([
      'title',
      'summary',
      'headline',
      'lead',
      'body_paragraphs',
      'camera_hal_takeaway',
      'reader_checkpoints',
      'tags',
      'homepage_badge',
      'publication_notice',
      'source_links'
    ].includes(key) || keyPath.includes('public_article')) {
      return [String(value)];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => publicJsonTextValues(item, keyPath.concat(String(index))));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => publicJsonTextValues(item, keyPath.concat(key)));
  }
  return [];
}

function validatePublicJsonText(json = '', label = 'public.json') {
  const raw = typeof json === 'string' ? json : JSON.stringify(json || {});
  const forbidden = [
    'story_contract_version',
    'source_subtitle',
    'source_links',
    'decision_metadata',
    'editorial_story',
    'reader_scenario',
    'what_happened',
    'why_it_matters',
    'field_scenario',
    'not_to_overclaim',
    'editor_take',
    'processed_source_event_ids',
    'processed_evidence_ids',
    'previous_values',
    'current_values',
    'source_gap_risk',
    'finalSelectionEligibility',
    'candidate_pool_preflight',
    'relevance_bucket',
    'impact_claim_level',
    'do_not_claim',
    'do_not_overstate',
    'hal_signal_capsule',
    'article_sections',
    'specificity_checks',
    'overclaim_guardrails',
    'main_article_readiness',
    'data/source-snapshots/',
    'content/source-events/'
  ];
  const errors = forbidden
    .filter(term => String(raw || '').includes(term))
    .map(term => `${label} contains internal source snapshot state: ${term}`);
  if (typeof json === 'string') {
    return errors.concat(findForbiddenTerms(raw, label));
  }
  const publicText = publicJsonTextValues(json).join('\n');
  return errors.concat(findForbiddenTerms(publicText, label));
}

function validatePublicNewsletterArtifacts({ markdown = '', html = '', json = '', markdownLabel = 'newsletter.md', htmlLabel = 'index.html', jsonLabel = 'public.json', publicationMode = '', fallbackOnly = false } = {}) {
  const options = { publicationMode, fallbackOnly };
  return [
    ...validatePublicMarkdown(markdown, markdownLabel, options),
    ...validatePublicHtml(html, htmlLabel, options),
    ...validatePublicJsonText(json, jsonLabel)
  ];
}

function validatePublicNewsletterFiles(markdownPath, htmlPath, options = {}) {
  return validatePublicNewsletterArtifacts({
    markdown: readText(markdownPath),
    html: readText(htmlPath),
    markdownLabel: markdownPath,
    htmlLabel: htmlPath,
    json: options.json || '',
    jsonLabel: options.jsonLabel || 'public.json'
  });
}

module.exports = {
  GENERIC_CHECKPOINT_PATTERNS,
  validatePublicHtml,
  validatePublicJsonText,
  validatePublicMarkdown,
  validatePublicNewsletterArtifacts,
  validatePublicNewsletterFiles,
  validatePublicSourceLinks,
  rawEnglishProseRuns,
  visibleHtmlText,
  visibleMarkdownText
};
