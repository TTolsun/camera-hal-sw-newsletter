const fs = require('fs');
const path = require('path');

const {
  htmlAttr,
  readJson,
  repoPath
} = require('../../core/common/common');
const { isSafeExternalImageUrl, REJECT_PATH_PATTERN } = require('../../core/render/image-candidates');
const { repoLocalPath } = require('../render/article-image-resolver');
const { ensureArray } = require('../render/newsletter-renderer');
const {
  toLegacyEditorIssue
} = require('../../core/domain/newsletter-domain-normalize');

const REQUIRED_NEWSLETTER_FIELDS = ['date', 'title', 'summary', 'html', 'md', 'tags'];
const REQUIRED_ISSUE_CLASSES = ['issue-briefing', 'issue-section', 'source-list', 'reference-list'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_SOURCE_LABEL = '\u7570\uc496\ucfc2';
const LEGACY_REFERENCES_LABEL = '\uf9e1\uba78\ud02c\u003f\uba2e\uc9ba';
const LEGACY_REFERENCES_PREFIX = '\uf9e1\uba78\ud02c';
const LEGACY_ACTION_LABEL = '\u003f\u317d\ubefe';

function hasAny(content, values) {
  return values.some(value => content.includes(value));
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceTail(section) {
  const sourceLabelPattern = ['Sources', '출처', LEGACY_SOURCE_LABEL].map(escapeRegExp).join('|');
  const match = section.match(new RegExp(`\\*\\*(${sourceLabelPattern})[^\\n]*\\*\\*([\\s\\S]*)`));
  return match ? match[2] : section;
}

function hasSourceEntry(section) {
  return /-\s+(?:\[.+?\]\(https?:\/\/|.+?:\s+https?:\/\/)/.test(sourceTail(section));
}

function markdownSection(content, headingPattern, nextHeadingPattern = /^## /m) {
  const match = headingPattern.exec(content);
  if (!match) return '';
  const afterHeading = content.slice(match.index + match[0].length);
  const next = afterHeading.search(nextHeadingPattern);
  return next === -1 ? afterHeading : afterHeading.slice(0, next);
}

function briefingSection(markdown) {
  return markdownSection(markdown, /^##\s+1\.\s+.+$/m);
}

function hasReferencesSection(markdown) {
  const referencesLabelPattern = ['References', '참고자료', LEGACY_REFERENCES_LABEL].map(escapeRegExp).join('|');
  return new RegExp(`^##\\s+(${referencesLabelPattern})\\s*$`, 'm').test(markdown);
}

function mainArticleBlocks(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const index = Number(matches[i][1]);
    const title = matches[i][2].trim();
    if (index <= 1) continue;
    if (/Action Items/i.test(title) || title.includes('Action') || title.includes('실행') || title.includes(LEGACY_ACTION_LABEL)) continue;
    if (/^References$/i.test(title) || title.includes('참고자료') || title.includes(LEGACY_REFERENCES_PREFIX)) continue;

    const start = matches[i].index + matches[i][0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : markdown.length;
    blocks.push({ heading: matches[i][0], title, text: markdown.slice(start, end) });
  }
  return blocks;
}

function isFallbackImagePath(value) {
  return /^(?:(?:\.\.\/){1,3})?assets\/images\/fallback\//.test(String(value || '').replace(/\\/g, '/'));
}

function hasClassToken(content, className) {
  const classPattern = /class=["']([^"']*)["']/gi;
  let match;
  while ((match = classPattern.exec(String(content || ''))) !== null) {
    if (String(match[1] || '').split(/\s+/).includes(className)) return true;
  }
  return false;
}

function validateNewsletterIndex(root, errors) {
  const dataPath = path.join(root, 'data', 'newsletters.json');
  if (!fs.existsSync(dataPath)) {
    errors.push('Missing data/newsletters.json');
    return;
  }

  let newsletters = [];
  try {
    newsletters = readJson(dataPath);
  } catch (error) {
    errors.push(`Invalid JSON in data/newsletters.json: ${error.message}`);
    return;
  }

  if (!Array.isArray(newsletters)) {
    errors.push('data/newsletters.json must contain an array');
    return;
  }

  const seenDates = new Set();
  for (const [index, item] of newsletters.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Newsletter entry ${index} must be an object.`);
      continue;
    }
    for (const field of REQUIRED_NEWSLETTER_FIELDS) {
      if (!(field in item)) {
        errors.push(`Newsletter entry ${index} is missing "${field}"`);
      }
    }
    if (!DATE_PATTERN.test(item.date || '')) {
      errors.push(`Newsletter entry ${index} has invalid date: ${item.date}`);
    }
    if (seenDates.has(item.date)) {
      errors.push(`Duplicate newsletter date: ${item.date}`);
    }
    seenDates.add(item.date);
    if (!Array.isArray(item.tags)) {
      errors.push(`Newsletter ${item.date} tags must be an array`);
    }
    for (const key of ['html', 'md']) {
      if (!repoPath(root, item[key] || '')) {
        errors.push(`Newsletter ${item.date} ${key} path escapes repository: ${item[key]}`);
      }
    }
  }
}

function validateMarkdownStructure(date, markdown, errors) {
  const content = String(markdown || '');
  if (/\bTODO\b/.test(content)) {
    errors.push(`Published newsletter contains TODO: newsletters/${date}/newsletter.md`);
  }

  const briefing = briefingSection(content);
  if (!briefing) {
    errors.push(`Newsletter ${date} markdown missing briefing section`);
  } else {
    const briefingBullets = briefing
      .split('\n')
      .filter(line => /^- /.test(line.trim()));
    if (briefingBullets.length !== 3) {
      errors.push(`Newsletter ${date} must have exactly 3 briefing bullets, found ${briefingBullets.length}`);
    }
  }

  if (!hasReferencesSection(content)) {
    errors.push(`Newsletter ${date} markdown missing References/참고자료 section`);
  }

  for (const article of mainArticleBlocks(content)) {
    if (!hasAny(article.text, ['Sources', '출처', LEGACY_SOURCE_LABEL])) {
      errors.push(`Newsletter ${date} section missing sources heading: ${article.heading}`);
    }
    if (!hasSourceEntry(article.text)) {
      errors.push(`Newsletter ${date} article has no source entries: ${article.heading}`);
    }
  }
}

function validateArticleImages(relPath, html, root, errors) {
  const imageTags = String(html || '').match(/<img\b(?=[^>]*class=["'][^"']*\barticle-image\b)[^>]*>/gi) || [];
  for (const tag of imageTags) {
    const src = htmlAttr(tag, 'src');
    const alt = htmlAttr(tag, 'alt');
    const loading = htmlAttr(tag, 'loading');
    if (!src) {
      errors.push(`Newsletter article image missing src: ${relPath}`);
      continue;
    }
    if (/^data:/i.test(src) || /^http:/i.test(src)) {
      errors.push(`Newsletter article image uses disallowed URL scheme: ${relPath}`);
    }
    if (/^https:\/\//i.test(src)) {
      if (!isSafeExternalImageUrl(src) || REJECT_PATH_PATTERN.test(src)) {
        errors.push(`Newsletter article image uses rejected external URL: ${relPath}`);
      }
    } else {
      if (!isFallbackImagePath(src)) {
        errors.push(`Newsletter article image must be HTTPS or repo-local fallback: ${relPath}`);
      }
      const localPath = repoLocalPath(root, src);
      if (!localPath || !fs.existsSync(localPath)) {
        errors.push(`Newsletter article image fallback file is missing: ${relPath} (${src})`);
      }
    }
    if (!alt.trim()) {
      errors.push(`Newsletter article image missing alt text: ${relPath}`);
    }
    if (loading !== 'lazy') {
      errors.push(`Newsletter article image missing loading="lazy": ${relPath}`);
    }

    const start = String(html || '').indexOf(tag);
    const nearby = start >= 0 ? String(html || '').slice(start, start + 900) : '';
    if (!/article-image-caption/.test(nearby) || !/<a\s+[^>]*href=["']https:\/\//i.test(nearby)) {
      errors.push(`Newsletter article image missing caption attribution link: ${relPath}`);
    }
  }
}

function validateHtmlStructure(date, html, root, errors) {
  const content = String(html || '');
  const relPath = `newsletters/${date}/index.html`;
  if (!/<!doctype html>/i.test(content) || !/<html\b/i.test(content) || !/<\/html>/i.test(content)) {
    errors.push(`Newsletter HTML is structurally invalid: ${relPath}`);
  }

  const openAnchors = content.match(/<a\b/gi)?.length || 0;
  const closeAnchors = content.match(/<\/a>/gi)?.length || 0;
  if (openAnchors !== closeAnchors) {
    errors.push(`Anchor tag mismatch in ${relPath}`);
  }
  if (/\bTODO\b/.test(content)) {
    errors.push(`Published HTML contains TODO: ${relPath}`);
  }

  for (const className of REQUIRED_ISSUE_CLASSES) {
    if (!hasClassToken(content, className)) {
      errors.push(`Newsletter HTML missing ${className}: ${relPath}`);
    }
  }

  const sourceBlocks = [];
  const sourceClassPattern = /class=["'][^"']*source-list[^"']*["']/gi;
  let sourceMatch;
  while ((sourceMatch = sourceClassPattern.exec(content)) !== null) {
    sourceBlocks.push(content.slice(sourceMatch.index, sourceMatch.index + 1200));
  }
  if (sourceBlocks.length === 0) {
    errors.push(`Newsletter HTML has no source-list blocks: ${relPath}`);
  }
  for (const block of sourceBlocks) {
    if (!/<a\s+[^>]*href=["']https?:\/\//i.test(block)) {
      errors.push(`Newsletter HTML source-list has no source links: ${relPath}`);
    }
  }

  validateArticleImages(relPath, content, root, errors);
}

function validateSelectedImageContract(date, editor, root, errors) {
  if (!editor || !Array.isArray(editor.sections)) return;

  for (const [index, section] of editor.sections.entries()) {
    const label = section.headline || section.category || `section ${index + 1}`;
    const selectedImage = String(section.selectedImage || '').trim();
    if (!selectedImage) continue;

    const normalizedImage = selectedImage.replace(/\\/g, '/');
    if (/^https:\/\//i.test(normalizedImage)) {
      if (section.resolvedImage?.usedFallback === true) {
        errors.push(`Newsletter ${date} selectedImage still points to an external URL after fallback: ${label}`);
      }
      const imageCandidates = ensureArray(section.imageCandidates);
      if (!imageCandidates.some(image => image && image.url === selectedImage)) {
        errors.push(`Newsletter ${date} selectedImage is not in imageCandidates: ${label}`);
      }
      if (!isSafeExternalImageUrl(normalizedImage) || REJECT_PATH_PATTERN.test(normalizedImage)) {
        errors.push(`Newsletter ${date} selectedImage is not an allowed HTTPS article image: ${label}`);
      }
      for (const field of ['imageSource', 'imageAttribution', 'imageAlt', 'imageUsageDecisionReason']) {
        if (!String(section[field] || '').trim()) {
          errors.push(`Newsletter ${date} selectedImage missing ${field}: ${label}`);
        }
      }
      if (!/^https:\/\//i.test(String(section.imageSource || '').trim())) {
        errors.push(`Newsletter ${date} selectedImage imageSource must be an HTTPS URL: ${label}`);
      }
      if (!['unknown', 'allowed'].includes(section.imageLicenseStatus || '')) {
        errors.push(`Newsletter ${date} selectedImage has invalid imageLicenseStatus: ${label}`);
      }
      continue;
    }

    if (!isFallbackImagePath(normalizedImage)) {
      errors.push(`Newsletter ${date} selectedImage must be HTTPS or repo-local fallback: ${label}`);
    }
    const localPath = repoLocalPath(root, selectedImage);
    if (!localPath || !fs.existsSync(localPath)) {
      errors.push(`Newsletter ${date} selectedImage fallback file is missing: ${label} (${selectedImage})`);
    }
    if (section.resolvedImage?.usedFallback !== true) {
      errors.push(`Newsletter ${date} fallback selectedImage missing resolvedImage.usedFallback=true: ${label}`);
    }
    const resolvedUrl = section.resolvedImage?.url || section.resolvedImage?.src || '';
    if (resolvedUrl !== selectedImage) {
      errors.push(`Newsletter ${date} fallback selectedImage does not match resolvedImage.url: ${label}`);
    }
  }
}

function validateRenderedIssueStructure({
  date,
  editor = null,
  markdown = '',
  html = '',
  root = process.cwd(),
  validateDataIndex = true
} = {}) {
  editor = toLegacyEditorIssue(editor, { date });
  const errors = [];
  const issueDate = date || editor?.date || 'unknown';

  if (validateDataIndex) {
    validateNewsletterIndex(root, errors);
  }
  validateMarkdownStructure(issueDate, markdown, errors);
  validateHtmlStructure(issueDate, html, root, errors);
  validateSelectedImageContract(issueDate, editor, root, errors);

  return {
    ok: errors.length === 0,
    errors,
    text: errors.length > 0 ? errors.map(error => `- ${error}`).join('\n') : 'Rendered issue structure validation passed.'
  };
}

module.exports = {
  hasAny,
  mainArticleBlocks,
  validateRenderedIssueStructure
};
