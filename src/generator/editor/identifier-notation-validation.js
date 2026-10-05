const { ensureArray } = require('../../shared/common/value-coercion');

// Only compare identifier-like tokens with a spelling supplied by this article's
// facts or source titles. Ordinary compound words, dates, fractions and URLs are
// not identifier evidence. No prose is rewritten by this validator.
const IDENTIFIER_PATTERN = /(?<![A-Za-z0-9_./:+-])[A-Za-z0-9]+(?:[.:][A-Za-z0-9]+)*(?:[-/][A-Za-z0-9]+(?:[.:][A-Za-z0-9]+)*)+(?:\([A-Za-z0-9]+\))?(?![A-Za-z0-9_/-])/g;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenPattern(value) {
  const pattern = value.split(/\s+/).map(escapeRegex).join('[ \\t]+');
  // Korean particles may directly follow an identifier, whereas ASCII identifier
  // continuations and version suffixes must not turn a substring into a match.
  return new RegExp(`(?<![A-Za-z0-9_])${pattern}(?![A-Za-z0-9_]|[.:][A-Za-z0-9])`);
}

function stringsWithPaths(value, path, output = []) {
  if (typeof value === 'string') output.push({ path, text: value });
  else if (Array.isArray(value)) {
    value.forEach((item, index) => stringsWithPaths(item, `${path}.${index}`, output));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => stringsWithPaths(item, `${path}.${key}`, output));
  }
  return output;
}

function referenceTexts(section) {
  return stringsWithPaths([
    section.confirmed_facts,
    section.article_sections?.verified_facts,
    ensureArray(section.claims).filter(claim => claim?.claim_type === 'fact').map(claim => claim.text),
    ensureArray(section.sources).map(source => source?.title)
  ], 'references').map(item => item.text);
}

function identifierTokens(references) {
  const tokens = new Set();
  for (const text of references) {
    const withoutUrls = text.replace(/https?:\/\/\S+/g, '');
    for (const match of withoutUrls.matchAll(IDENTIFIER_PATTERN)) {
      const token = match[0];
      if (/^\d{4}-\d{2}(?:-\d{2})?$/.test(token)) continue;
      const modelOrVersion = /[A-Za-z][A-Za-z0-9]*\d|\d[A-Za-z]|\d[.:]\d/.test(token) ||
        /^[A-Z][A-Za-z]*[-/]\d/.test(token);
      const acronym = /^[A-Z]+(?:-[A-Z]{2,})+$/.test(token);
      if (modelOrVersion || acronym) tokens.add(token);
    }
  }
  return [...tokens];
}

function spaceSpellings(token) {
  const spaced = token.replace(/[-/]/g, ' ');
  return [...new Set([
    spaced,
    spaced.replace(/[()]/g, ''),
    spaced.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  ])];
}

function identifierNotationIssues(section = {}, index = 0, referenceSection = section) {
  const article = section.public_article || {};
  const references = referenceTexts(referenceSection);
  const prose = stringsWithPaths({
    headline: article.headline,
    lead: article.lead,
    body_markdown: article.body_markdown,
    body_paragraphs: article.body_paragraphs,
    camera_hal_takeaway: article.camera_hal_takeaway,
    reader_checkpoints: article.reader_checkpoints,
    editorial_story: article.editorial_story
  }, 'public_article');
  const issues = [];
  for (const expected of identifierTokens(references)) {
    if (prose.some(item => tokenPattern(expected).test(item.text))) continue;
    for (const observed of spaceSpellings(expected)) {
      const pattern = tokenPattern(observed);
      // A source may itself use both spellings. Do not demand one when the
      // article's evidence already supports the space-separated variant.
      if (references.some(text => pattern.test(text))) continue;
      for (const item of prose) {
        if (!pattern.test(item.text)) continue;
        issues.push({
          type: 'identifier_notation_loss',
          index: index + 1,
          field: item.path,
          expected,
          observed,
          message: `Preserve the source identifier spelling ${expected}; found ${observed}.`
        });
      }
    }
  }
  return issues;
}

module.exports = { identifierNotationIssues };
