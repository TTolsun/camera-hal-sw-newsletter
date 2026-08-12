// Orchestrator section-locking helpers.
//
// Single responsibility: decide which article sections and reporter candidates
// are locked, duplicate, eligible, or source-gapped across quality/repair retry
// attempts. Pure transforms on their arguments only — no generationRunState, no
// fs, no module globals — extracted verbatim from the generation orchestrator
// (gemini-newsroom-newsletter.js).

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  duplicateReasonForSections,
  sectionSummary,
  sectionUrls,
  sectionsAreDuplicate
} = require('../../shared/common/section-identity');
const { normalizeUrl } = require('../select/newsroom-selection');
const { isFinalSelected } = require('../select/selection-diagnostics');
const {
  sectionHasSourceGap,
  sectionPassesArticleGate
} = require('../quality/newsletter-quality');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const { sectionLabel, stringOrEmpty } = require('./orchestrator-shared-helpers');
const {
  reporterCandidateUrlMap,
  candidateForSourceUrl,
  reporterCandidateMainArticleBlockReason,
  isReserveCandidate
} = require('./orchestrator-reporter-normalize');

function candidateDuplicateReason(candidate, sections, context = 'locked') {
  const candidateSection = {
    headline: candidate.title,
    published_date: candidate.published_date,
    sources: [{ title: candidate.source, url: candidate.url }]
  };
  for (const section of ensureArray(sections)) {
    const reason = duplicateReasonForSections(candidateSection, section, context);
    if (reason) return reason;
  }
  return '';
}

function retryRejectionRecord(candidate, reason) {
  return {
    title: candidate.title || candidate.headline || candidate.category || 'untitled article',
    url: candidate.url || sectionUrls(candidate)[0] || '',
    source: candidate.source || ensureArray(candidate.sources)[0]?.title || '',
    relevance_bucket: candidate.relevance_bucket || '',
    editorial_priority: candidate.editorial_priority ?? null,
    reason
  };
}

function reserveUsageForSections(sections, reporter) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const records = ensureArray(sections).flatMap(section =>
    sectionUrls(section)
      .map(url => candidateForSourceUrl(url, candidateMap))
      .filter(candidate => candidate && isReserveCandidate(candidate))
      .map(candidate => retryRejectionRecord(candidate, 'used_reserve_candidate'))
  );
  return [...new Map(records.map(record => [record.url || record.title, record])).values()];
}

function candidatesForSections(sections, reporter) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const records = ensureArray(sections).flatMap(section =>
    sectionUrls(section)
      .map(url => candidateForSourceUrl(url, candidateMap))
      .filter(Boolean)
  );
  return [...new Map(records.map(candidate => [normalizeUrl(candidate.url), candidate])).values()];
}

function removeDisallowedSelections(reporter, lockedSections, excludedSections = []) {
  const rejected = [];
  for (const candidate of ensureArray(reporter.candidates)) {
    if (!isFinalSelected(candidate)) continue;
    const lockedReason = candidateDuplicateReason(candidate, lockedSections, 'locked');
    if (lockedReason) {
      candidate.final_selected = false;
      candidate.selected_for_editor = false;
      rejected.push(retryRejectionRecord(candidate, lockedReason));
      continue;
    }
    const excludedReason = candidateDuplicateReason(candidate, excludedSections, 'demoted');
    if (excludedReason) {
      candidate.final_selected = false;
      candidate.selected_for_editor = false;
      rejected.push(retryRejectionRecord(candidate, excludedReason));
    }
  }
  return rejected;
}

function mergeLockedSections(lockedSections, generatedSections, excludedSections = []) {
  const merged = [];
  const rejected = [];
  for (const section of lockedSections) {
    if (merged.length >= articlePolicy.mainArticleCount.max) break;
    merged.push(section);
  }
  for (const section of generatedSections) {
    if (merged.length >= articlePolicy.mainArticleCount.max) break;
    const lockedReason = merged
      .map(existing => duplicateReasonForSections(existing, section, 'locked'))
      .find(Boolean);
    if (lockedReason) {
      rejected.push(retryRejectionRecord(section, lockedReason));
      continue;
    }
    const excludedReason = ensureArray(excludedSections)
      .map(existing => duplicateReasonForSections(existing, section, 'demoted'))
      .find(Boolean);
    if (excludedReason) {
      rejected.push(retryRejectionRecord(section, excludedReason));
      continue;
    }
    merged.push(section);
  }
  return { sections: merged, rejected };
}

function sectionLockRecord(section, index, status = 'PASS', reason = '') {
  return {
    ...sectionSummary(section, index),
    status,
    reason,
    locked: status === 'PASS'
  };
}

function buildLockedArticleContext(lockedSections, excludedSections = []) {
  if (lockedSections.length === 0 && excludedSections.length === 0) return '';
  const lockedSummary = lockedSections.map((section, index) => ({
    ...sectionSummary(section, index)
  }));
  const excludedSummary = excludedSections.map((section, index) => sectionSummary(section, index));
  return [
    lockedSections.length > 0 ? 'Previous quality attempt에서 locked된 passed articles:' : '',
    lockedSections.length > 0 ? JSON.stringify(lockedSummary, null, 2) : '',
    lockedSections.length > 0 ? '통과한 article은 그대로 유지하세요. formatting consistency 외에는 다시 쓰지 마세요.' : '',
    excludedSections.length > 0 ? 'Previous quality attempt에서 excluded된 source-gap/demoted articles:' : '',
    excludedSections.length > 0 ? JSON.stringify(excludedSummary, null, 2) : '',
    excludedSections.length > 0 ? 'excluded URLs, titles, source names, 또는 same source + published_date + similar title과 중복되는 candidate를 선택하거나 article을 생성하지 마세요.' : '',
    'Missing replacement article만 생성하세요. Duplicate URL, duplicate 또는 near-identical headline, same source + same published_date + similar title 조합을 피하세요.'
  ].filter(Boolean).join('\n');
}

function lockedArticleHeadlines(lockedSections) {
  return lockedSections.map(section => section.headline || section.category || 'untitled article');
}

function issueLevelLockBlockers(qualityReport) {
  return ensureArray(qualityReport?.deductions).filter(deduction => {
    if (stringOrEmpty(deduction.location)) return false;
    if (deduction.category === 'composition') {
      return /main articles|No AI article/i.test(deduction.reason);
    }
    if (deduction.category === 'hal-relevance') {
      return /No AI|Expected at least|weak HAL|Camera HAL \/ Android Camera/i.test(deduction.reason);
    }
    return false;
  });
}

function selectLockedArticles(editor, qualityReport, factCheck) {
  const blockers = issueLevelLockBlockers(qualityReport);
  if (blockers.length > 0) {
    return { articles: [], blockers };
  }
  return {
    articles: ensureArray(editor.sections)
      .filter(section => sectionPassesArticleGate(section, qualityReport, factCheck))
      .slice(0, articlePolicy.mainArticleCount.max),
    blockers
  };
}

function appendUniqueLockedArticles(currentLocked, candidates) {
  const locked = [...currentLocked];
  for (const section of candidates) {
    if (locked.length >= articlePolicy.mainArticleCount.max) break;
    if (!locked.some(existing => sectionsAreDuplicate(existing, section))) {
      locked.push(section);
    }
  }
  return locked;
}

function appendUniqueSections(currentSections, candidates) {
  const sections = [...currentSections];
  for (const section of candidates) {
    if (!sections.some(existing => sectionsAreDuplicate(existing, section))) {
      sections.push(section);
    }
  }
  return sections;
}

function sourceGapSections(editor, factCheck) {
  return ensureArray(editor.sections).filter(section => sectionHasSourceGap(section, factCheck));
}

function reporterEligibilityFindings(editor, reporter, lockedSections = [], options = {}) {
  const candidateMap = reporterCandidateUrlMap(reporter);
  const findings = [];
  for (const section of ensureArray(editor.sections)) {
    if (lockedSections.some(locked => sectionsAreDuplicate(section, locked))) continue;
    for (const source of ensureArray(section.sources)) {
      const candidate = candidateForSourceUrl(source?.url, candidateMap);
      if (!candidate) continue;
      const reason = reporterCandidateMainArticleBlockReason(candidate, options);
      if (!reason) continue;
      findings.push({
        section,
        headline: sectionLabel(section),
        source_title: source.title || candidate.source || candidate.title || 'unknown source',
        source_url: source.url,
        candidate_title: candidate.title,
        candidate_url: candidate.url,
        reason
      });
    }
  }
  return findings;
}

function eligibilitySourceGapMessage(finding) {
  return [
    'Reporter eligibility violation',
    `section="${finding.headline}"`,
    `source="${finding.source_title}"`,
    `url=${finding.source_url || finding.candidate_url || 'unknown'}`,
    `candidate="${finding.candidate_title || 'unknown'}"`,
    `reason=${finding.reason}`,
    'action=replace-or-demote'
  ].join('; ');
}

function applyReporterEligibilityFindingsToFactCheck(factCheck, findings) {
  if (findings.length === 0) return factCheck;
  const sourceGaps = [...ensureArray(factCheck.source_gaps)];
  const seen = new Set(sourceGaps);
  for (const finding of findings) {
    const message = eligibilitySourceGapMessage(finding);
    if (!seen.has(message)) {
      seen.add(message);
      sourceGaps.push(message);
    }
  }
  return {
    ...factCheck,
    status: 'NEEDS_FIX',
    source_gaps: sourceGaps,
    source_gap_count: sourceGaps.length,
    final_comment: [
      factCheck.final_comment,
      'Reporter eligibility violations were added as source gaps and require replacement or demotion.'
    ].filter(Boolean).join(' ')
  };
}

module.exports = {
  candidateDuplicateReason,
  retryRejectionRecord,
  reserveUsageForSections,
  candidatesForSections,
  removeDisallowedSelections,
  mergeLockedSections,
  sectionLockRecord,
  buildLockedArticleContext,
  lockedArticleHeadlines,
  issueLevelLockBlockers,
  selectLockedArticles,
  appendUniqueLockedArticles,
  appendUniqueSections,
  sourceGapSections,
  reporterEligibilityFindings,
  eligibilitySourceGapMessage,
  applyReporterEligibilityFindingsToFactCheck
};
