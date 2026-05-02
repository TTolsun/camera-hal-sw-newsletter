const QUALITY_THRESHOLD = 90;
const MIN_MAIN_ARTICLES = 4;
const MAX_MAIN_ARTICLES = 5;
const BLOCKING_DEDUCTION_CATEGORIES = new Set([
  'required-fields',
  'evidence-specificity',
  'hal-depth',
  'actionability',
  'composition',
  'hal-relevance',
  'source-integrity'
]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value || '').trim();
}

function sectionText(section) {
  return [
    section.category,
    section.headline,
    section.what_changed,
    section.background,
    section.why_it_matters,
    section.camera_hal_perspective,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.team_summary,
    section.confirmed_facts,
    section.camera_hal_checks,
    section.action_items,
    section.sources
  ].map(text).join(' ');
}

function normalizeForMatch(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPattern(value, pattern) {
  return pattern.test(text(value));
}

function boundedDeduct(state, category, points, reason, location = '') {
  if (points <= 0) return;
  state.deductions.push({ category, points, reason, location });
}

function countSections(sections, pattern) {
  return sections.filter(section => hasPattern(sectionText(section), pattern)).length;
}

function hasSpecificEvidence(section) {
  const evidence = [
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes
  ].map(text).join(' ');
  return /(?:\b(?:Android|CameraX|libcamera|OpenCL|LLVM|Clang|C\+\+|NDK|SDK|Glaze)\s*\d|[A-Za-z0-9_+.-]+\s+\d+\.\d+(?:\.\d+)*|\b\d+\.\d+(?:\.\d+)*\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:version|release|release date|published date|API\/component|behavior change|source gap|rolling page|no dated release|requires cross-check|official-source|cross-checked)\b|(?:version|release|API|component|extension|module|library):\s*\S+)/i
    .test(evidence);
}

function hasGenericMonitoringWithoutEvidence(section) {
  const body = sectionText(section);
  const generic = /monitor|watch|track|follow|review|모니터|추적|확인|주시|검토/i.test(body);
  return generic && !hasSpecificEvidence(section);
}

function hasHalDepth(section) {
  return /Camera HAL|HAL|Android Camera|CameraX|AOSP Camera|stream|buffer|metadata|request|result|CTS|VTS|Camera ITS|CDD|latency|frame drop|thermal|power|memory|binder|scheduling|NPU|GPU|ISP|YUV|RAW|PRIVATE|logical|physical|vendor tag|session parameter/i
    .test(sectionText(section));
}

function hasConcreteAction(section) {
  const actions = ensureArray(section.action_items);
  if (actions.length === 0) return false;
  return actions.some(action => /test|log|metric|measure|CTS|VTS|Camera ITS|stream|metadata|latency|frame drop|thermal|device|owner|API|PoC|benchmark|profile|검증|테스트|측정|로그|지표|벤치마크|담당|기기/i.test(text(action)));
}

function hasValidAiRelevance(section) {
  if (!section.is_ai_related && !/AI|agent|LLM|NPU|GPU|on-device|inference|model/i.test(sectionText(section))) {
    return false;
  }
  return /camera input|image|frame|stream|buffer|ImageAnalysis|NPU|GPU|ISP|privacy|HAL workflow|developer productivity|latency|thermal|power|agent|Camera HAL|Android Camera/i
    .test(sectionText(section));
}

function sourceGapCount(factCheck) {
  if (Number.isFinite(Number(factCheck?.source_gap_count))) return Number(factCheck.source_gap_count);
  return ensureArray(factCheck?.source_gaps).length;
}

function deductionMatchesSection(deduction, section) {
  const location = normalizeForMatch(deduction?.location);
  if (!location) return false;
  const labels = [
    section?.headline,
    section?.category,
    section?.location
  ].map(normalizeForMatch).filter(Boolean);
  return labels.some(label => location === label || location.includes(label) || label.includes(location));
}

function sectionHasQualityDeductions(section, deductions, categories = [
  'required-fields',
  'evidence-specificity',
  'hal-depth',
  'actionability'
]) {
  const categorySet = new Set(categories);
  return ensureArray(deductions).some(deduction =>
    categorySet.has(deduction?.category) && deductionMatchesSection(deduction, section)
  );
}

function factCheckItemMentionsSection(item, section) {
  const haystack = normalizeForMatch(item);
  if (!haystack) return false;
  const labels = [
    section?.headline,
    section?.category,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ].map(normalizeForMatch).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function sectionHasFactCheckMustFix(section, factCheck) {
  return ensureArray(factCheck?.must_fix).some(item => factCheckItemMentionsSection(item, section));
}

function sectionHasSourceGap(section, factCheck) {
  const localGap = /source gap|rolling page|no dated release|missing source|needs cross-check|needs-cross-check|출처\s*공백|소스\s*갭/i
    .test(sectionText(section));
  if (localGap) return true;
  return ensureArray(factCheck?.source_gaps).some(item => factCheckItemMentionsSection(item, section));
}

function sectionPassesArticleGate(section, qualityReport, factCheck) {
  return !sectionHasQualityDeductions(section, qualityReport?.deductions) &&
    !sectionHasFactCheckMustFix(section, factCheck) &&
    !sectionHasSourceGap(section, factCheck);
}

function blockingDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => BLOCKING_DEDUCTION_CATEGORIES.has(deduction?.category));
}

function buildNewsletterQualityReport(date, editor, reporter = {}, factCheck = {}, options = {}) {
  const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : QUALITY_THRESHOLD;
  const sections = ensureArray(editor.sections);
  const state = { deductions: [] };

  if (sections.length < MIN_MAIN_ARTICLES || sections.length > MAX_MAIN_ARTICLES) {
    boundedDeduct(state, 'composition', 4, `Expected 4-5 main articles, found ${sections.length}.`);
  }
  if (ensureArray(editor.briefing).length !== 3) {
    boundedDeduct(state, 'composition', 3, `Expected exactly 3 briefing bullets, found ${ensureArray(editor.briefing).length}.`);
  }
  if (!sections.some(hasValidAiRelevance)) {
    boundedDeduct(state, 'composition', 5, 'No AI article has a clear Camera HAL, camera input path, or HAL workflow relevance.');
  }
  const cameraCoverage = countSections(sections, /Camera HAL|Android Camera|CameraX|AOSP Camera|Camera2|CTS|VTS|Camera ITS/i);
  if (cameraCoverage < 2) {
    boundedDeduct(state, 'hal-relevance', 8, `Expected at least 2 Camera HAL / Android Camera articles, found ${cameraCoverage}.`);
  }

  sections.forEach((section, index) => {
    const location = section.category || section.headline || `article ${index + 1}`;
    const requiredTextFields = ['headline', 'what_changed', 'evidence_summary', 'background', 'camera_hal_perspective', 'team_summary'];
    for (const field of requiredTextFields) {
      if (!text(section[field])) {
        boundedDeduct(state, 'required-fields', 3, `Missing required article field: ${field}.`, location);
      }
    }
    for (const field of ['confirmed_facts', 'specificity_checks', 'source_verification_notes', 'camera_hal_checks', 'action_items', 'sources']) {
      if (ensureArray(section[field]).length === 0) {
        boundedDeduct(state, 'required-fields', 4, `Missing required article list: ${field}.`, location);
      }
    }
    if (!hasSpecificEvidence(section)) {
      boundedDeduct(state, 'evidence-specificity', 5, 'Article lacks concrete version, release date, API, component, behavior change, or explicit evidence note.', location);
    }
    if (hasGenericMonitoringWithoutEvidence(section)) {
      boundedDeduct(state, 'evidence-specificity', 4, 'Article uses generic monitoring/review language without naming the concrete source, version, API, date, or behavior change.', location);
    }
    if (!hasHalDepth(section)) {
      boundedDeduct(state, 'hal-depth', 4, 'Article lacks concrete Camera HAL engineering depth.', location);
    }
    if (!hasConcreteAction(section)) {
      boundedDeduct(state, 'actionability', 4, 'Article action item is not concrete enough for a HAL engineering team.', location);
    }
    if (/C\+\+|LLVM|Clang|Linux|libcamera|AI|agent|LLM|OpenCL|NPU|GPU/i.test(sectionText(section)) && !hasHalDepth(section)) {
      boundedDeduct(state, 'hal-relevance', 4, 'Non-camera article does not clearly connect back to Camera HAL work.', location);
    }
  });

  const mustFixCount = ensureArray(factCheck.must_fix).length;
  if (factCheck.status === 'NEEDS_FIX' && mustFixCount > 0) {
    boundedDeduct(state, 'source-integrity', Math.min(15, mustFixCount * 5), `Fact checker returned ${mustFixCount} must_fix item(s).`);
  }
  const gaps = sourceGapCount(factCheck);
  if (gaps > 0) {
    boundedDeduct(state, 'source-integrity', Math.min(10, gaps * 3), `Fact checker reported ${gaps} source gap(s).`);
  }

  const selectedReporterCandidates = ensureArray(reporter.candidates).filter(candidate => candidate.selected);
  const lowScoreSelected = selectedReporterCandidates.filter(candidate => {
    const total =
      Number(candidate.camera_hal_relevance_score || 0) +
      Number(candidate.android_camera_relevance_score || 0) +
      Number(candidate.practical_actionability_score || 0);
    return total < 8;
  });
  if (lowScoreSelected.length > 0) {
    boundedDeduct(state, 'hal-relevance', Math.min(8, lowScoreSelected.length * 2), `${lowScoreSelected.length} selected reporter candidate(s) have weak HAL/actionability scores.`);
  }

  const totalDeductions = state.deductions.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, 100 - totalDeductions);
  const hasFactCheckMustFix = factCheck.status === 'NEEDS_FIX' || mustFixCount > 0;
  const blockers = blockingDeductions(state.deductions);
  const status = score >= threshold && gaps === 0 && !hasFactCheckMustFix && blockers.length === 0 ? 'PASS' : 'NEEDS_FIX';
  return {
    schema_version: 1,
    date,
    score,
    threshold,
    status,
    summary: status === 'PASS'
      ? `Quality score ${score}/${threshold}; ready for editor-in-chief review.`
      : `Quality score ${score}/${threshold}; resolve source gaps and deductions before publication.`,
    deductions: state.deductions,
    metrics: {
      article_count: sections.length,
      briefing_count: ensureArray(editor.briefing).length,
      camera_article_count: cameraCoverage,
      ai_article_count: sections.filter(hasValidAiRelevance).length,
      fact_check_status: factCheck.status || 'UNKNOWN',
      must_fix_count: mustFixCount,
      source_gap_count: gaps,
      blocking_deduction_count: blockers.length,
      blocking_deduction_categories: [...new Set(blockers.map(deduction => deduction.category))]
    }
  };
}

function buildQualityReportMarkdown(report) {
  const deductions = ensureArray(report.deductions);
  return `# Newsletter Quality Report - ${report.date}

## Score

- Score: ${report.score}/100
- Threshold: ${report.threshold}
- Status: ${report.status}
- Summary: ${report.summary}

## Metrics

- Article count: ${report.metrics.article_count}
- Briefing count: ${report.metrics.briefing_count}
- Camera article count: ${report.metrics.camera_article_count}
- AI article count: ${report.metrics.ai_article_count}
- Fact-check status: ${report.metrics.fact_check_status}
- Must-fix count: ${report.metrics.must_fix_count}
- Source gap count: ${report.metrics.source_gap_count}
- Blocking deduction count: ${report.metrics.blocking_deduction_count || 0}
- Blocking deduction categories: ${ensureArray(report.metrics.blocking_deduction_categories).join(', ') || 'none'}

## Deductions

${deductions.length === 0 ? '- None' : deductions.map(item => `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}`).join('\n')}
`;
}

module.exports = {
  QUALITY_THRESHOLD,
  MIN_MAIN_ARTICLES,
  MAX_MAIN_ARTICLES,
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  sectionHasQualityDeductions,
  sectionHasFactCheckMustFix,
  sectionHasSourceGap,
  sectionPassesArticleGate,
  blockingDeductions
};
