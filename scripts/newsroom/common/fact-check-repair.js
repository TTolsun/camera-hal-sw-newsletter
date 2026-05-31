const fs = require('fs');
const path = require('path');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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

// decision_metadata 필드(impact/scope/action/overclaim_risk)에 대한 must_fix 항목을 제거
// PR #466 회귀 차단: LLM fact-checker가 decision_metadata를 must_fix로 잡는 경우 자동 drop
const DECISION_METADATA_FIELD_PATTERN = /sections\[\d+\]\.public_article\.decision_metadata\./;

function itemIsDecisionMetadataMustFix(item = {}) {
  const location = String(item.location || '').replace(/\\/g, '/');
  const field = String(item.field || '').replace(/\\/g, '/');
  return DECISION_METADATA_FIELD_PATTERN.test(location) || DECISION_METADATA_FIELD_PATTERN.test(field);
}

function dropDecisionMetadataMustFix(factCheck = {}) {
  const dropped = [];
  const mustFix = [];

  for (const item of ensureArray(factCheck.must_fix)) {
    if (itemIsDecisionMetadataMustFix(item)) {
      dropped.push(item);
      continue;
    }
    mustFix.push(item);
  }

  const recommendedFixes = ensureArray(factCheck.recommended_fixes).filter(item => {
    const text = String(item || '');
    return !DECISION_METADATA_FIELD_PATTERN.test(text);
  });

  const droppedCount = dropped.length;
  if (droppedCount > 0) {
    console.log(`[fact-check-repair] fact-check-decision-metadata-dropped-count: ${droppedCount} must_fix 항목 제거됨 (decision_metadata 필드 패턴)`);
  }

  const next = {
    ...factCheck,
    must_fix: mustFix,
    recommended_fixes: recommendedFixes
  };

  if (next.status === 'NEEDS_FIX' && mustFix.length === 0 &&
      ensureArray(next.source_gaps).length === 0 && droppedCount > 0) {
    next.status = 'PASS';
    // PASS 승격 시 LLM이 남긴 must_fix 안내 문구가 그대로 노출되지 않도록 결정론적 문구로 교체
    next.final_comment = `decision_metadata must_fix ${droppedCount}건이 자동 필터로 정리되어 PASS 처리됨.`;
  }

  return { factCheck: next, droppedCount };
}

module.exports = {
  itemLooksLikeFallbackImageFalsePositive,
  pruneResolvedFallbackImageFactCheckItems,
  sectionHasSafeResolvedFallback,
  dropDecisionMetadataMustFix
};
