const { ensureArray } = require('./value-coercion');
const fs = require('fs');
const path = require('path');

function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\/+/, '');
}

function isHttpsUrl(value) {
  return /^https:\/\//i.test(String(value || '').trim());
}

function isFallbackImagePath(value) {
  const normalized = normalizePath(value);
  return /(?:^|\/)assets\/images\/fallback\//.test(normalized);
}

function fallbackPathExists(root, src) {
  if (!root || !src) return true;
  const normalized = normalizePath(src).replace(/^(\.\.\/){2}/, '');
  if (!normalized.startsWith('assets/images/fallback/')) return false;
  const absPath = path.resolve(root, normalized);
  const rootPath = path.resolve(root);
  if (absPath !== rootPath && !absPath.startsWith(`${rootPath}${path.sep}`)) return false;
  return fs.existsSync(absPath);
}

function sectionIndexFromLocation(location) {
  const match = String(location || '').match(/sections\[(\d+)]/);
  return match ? Number(match[1]) : null;
}

function itemLooksLikeFallbackImageFalsePositive(item = {}) {
  const text = [
    item.location,
    item.problem,
    item.suggestion
  ].join(' ').toLowerCase();

  return (
    /selectedimage|selected image|resolvedimage|image/.test(text) &&
    /fallback|broken external|external image url|local fallback/.test(text)
  );
}

function sectionHasSafeResolvedFallback(section = {}, options = {}) {
  const root = options.root || process.cwd();
  const selectedImage = String(section.selectedImage || '').trim();
  const resolvedUrl = String(section.resolvedImage?.url || section.resolvedImage?.src || '').trim();
  const reason = String(section.imageUsageDecisionReason || '').trim();

  if (section.resolvedImage?.usedFallback !== true) return false;
  if (!isFallbackImagePath(resolvedUrl)) return false;
  if (!fallbackPathExists(root, resolvedUrl)) return false;
  if (!reason) return false;
  if (selectedImage && isHttpsUrl(selectedImage)) return false;
  if (selectedImage && !isFallbackImagePath(selectedImage)) return false;
  return true;
}

function pruneResolvedFallbackImageFactCheckItems(factCheck = {}, issue = {}, options = {}) {
  const sections = ensureArray(issue.sections);
  const removed = [];
  const mustFix = [];

  for (const item of ensureArray(factCheck.must_fix)) {
    const index = sectionIndexFromLocation(item.location);
    const section = Number.isInteger(index) ? sections[index] : null;
    if (
      section &&
      itemLooksLikeFallbackImageFalsePositive(item) &&
      sectionHasSafeResolvedFallback(section, options)
    ) {
      removed.push(item);
      continue;
    }
    mustFix.push(item);
  }

  const sourceGaps = ensureArray(factCheck.source_gaps);
  const next = {
    ...factCheck,
    must_fix: mustFix,
    source_gaps: sourceGaps,
    source_gap_count: sourceGaps.length
  };

  if (next.status === 'NEEDS_FIX' && mustFix.length === 0 && sourceGaps.length === 0) {
    next.status = 'PASS';
  }

  return { factCheck: next, removed };
}

module.exports = {
  itemLooksLikeFallbackImageFalsePositive,
  pruneResolvedFallbackImageFactCheckItems,
  sectionHasSafeResolvedFallback
};
