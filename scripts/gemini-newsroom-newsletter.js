const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  kstDate,
  readJson,
  readTextIfExists,
  writeJson
} = require('./lib/common');
const { callGeminiJson, getGeminiModelUsage } = require('./lib/gemini-client');
const { reporterSchema, editorSchema, factCheckSchema } = require('./lib/newsletter-schema');
const { isSafeExternalImageUrl } = require('./lib/image-candidates');
const { resolveIssueArticleImages } = require('./lib/article-image-resolver');
const {
  QUALITY_THRESHOLD,
  MIN_MAIN_ARTICLES,
  MAX_MAIN_ARTICLES,
  buildNewsletterQualityReport,
  buildQualityReportMarkdown,
  deductionMatchesSection,
  sectionHasSourceGap,
  sectionPassesArticleGate
} = require('./lib/newsletter-quality');
const {
  buildMarkdown,
  buildHtml,
  buildFactCheckMarkdown,
  buildEditorChiefBrief,
  buildReleaseQaReport,
  ensureArray
} = require('./lib/newsletter-renderer');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const sourceRegistryPath = path.join(root, 'data', 'news-sources.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function writeNewsletterDate(date) {
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'newsletter-date.txt'), date, 'utf8');
}

function writeGenerationStatus(value) {
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'newsletter-generation-status.json'),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function numberOrDefault(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function integerOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function stringOrEmpty(value) {
  return String(value || '').trim();
}

function imageCandidatesForReporterCandidate(candidate, collectedByUrl) {
  const collected = collectedByUrl.get(candidate.url) || collectedByUrl.get(candidate.article_url) || {};
  const images = ensureArray(candidate.imageCandidates).length > 0
    ? ensureArray(candidate.imageCandidates)
    : ensureArray(collected.imageCandidates);
  return images.filter(image => image && image.url && isSafeExternalImageUrl(image.url));
}

function collectedCandidateFor(candidate, collectedByUrl) {
  return collectedByUrl.get(candidate.url) ||
    collectedByUrl.get(candidate.article_url) ||
    collectedByUrl.get(candidate.articleUrl) ||
    {};
}

function reporterCandidateRejectionReason(candidate) {
  const halActionability =
    Number(candidate.camera_hal_relevance_score || 0) +
    Number(candidate.android_camera_relevance_score || 0) +
    Number(candidate.practical_actionability_score || 0);
  if (candidate.main_eligible === false) return 'main_eligible=false';
  if (candidate.source_gap_risk === true) return 'source_gap_risk=true';
  if (Number(candidate.evidence_score || 0) < 6) return `evidence_score=${Number(candidate.evidence_score || 0)} < 6`;
  if (halActionability < 8) return `HAL/actionability score ${halActionability} < 8`;
  return '';
}

function validateReporter(value, date, collectedCandidates = []) {
  const collectedByUrl = new Map();
  for (const candidate of ensureArray(collectedCandidates)) {
    if (candidate.url) collectedByUrl.set(candidate.url, candidate);
    if (candidate.article_url) collectedByUrl.set(candidate.article_url, candidate);
    if (candidate.articleUrl) collectedByUrl.set(candidate.articleUrl, candidate);
  }

  if (value.date !== date) value.date = date;
  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    fail('Reporter output must contain at least one candidate.');
  }
  const rejectedMainIneligible = [];
  for (const candidate of value.candidates) {
    if (!candidate.title || !candidate.url || !candidate.source) {
      fail('Reporter candidate is missing title, source, or url.');
    }
    const collected = collectedCandidateFor(candidate, collectedByUrl);
    candidate.camera_hal_relevance_score = numberOrDefault(candidate.camera_hal_relevance_score);
    candidate.android_camera_relevance_score = numberOrDefault(candidate.android_camera_relevance_score);
    candidate.practical_actionability_score = numberOrDefault(candidate.practical_actionability_score);
    candidate.source_reliability_score = numberOrDefault(candidate.source_reliability_score);
    candidate.freshness_score = numberOrDefault(candidate.freshness_score);
    candidate.ai_required_slot_fit_score = numberOrDefault(candidate.ai_required_slot_fit_score);
    candidate.cpp_fallback_value_score = numberOrDefault(candidate.cpp_fallback_value_score);
    candidate.version_or_release = stringOrEmpty(candidate.version_or_release || collected.version_or_release);
    candidate.api_or_component = stringOrEmpty(candidate.api_or_component || collected.api_or_component);
    candidate.behavior_change = stringOrEmpty(candidate.behavior_change || collected.behavior_change);
    candidate.source_kind = stringOrEmpty(collected.source_kind || candidate.source_kind);
    candidate.source_gap_risk = typeof collected.source_gap_risk === 'boolean'
      ? collected.source_gap_risk
      : Boolean(candidate.source_gap_risk);
    candidate.main_eligible = typeof collected.main_eligible === 'boolean'
      ? collected.main_eligible
      : Boolean(candidate.main_eligible);
    candidate.briefing_only = typeof collected.briefing_only === 'boolean'
      ? collected.briefing_only
      : Boolean(candidate.briefing_only);
    candidate.reference_only = typeof collected.reference_only === 'boolean'
      ? collected.reference_only
      : Boolean(candidate.reference_only);
    candidate.evidence_score = numberOrDefault(collected.evidence_score ?? candidate.evidence_score);
    candidate.evidence_notes = ensureArray(candidate.evidence_notes);
    candidate.cross_check_status = stringOrEmpty(candidate.cross_check_status || 'not-required');
    candidate.imageCandidates = imageCandidatesForReporterCandidate(candidate, collectedByUrl);
    if (typeof candidate.selected !== 'boolean') {
      const total =
        candidate.camera_hal_relevance_score +
        candidate.android_camera_relevance_score +
        candidate.practical_actionability_score +
        candidate.source_reliability_score +
        candidate.freshness_score +
        candidate.ai_required_slot_fit_score +
        candidate.cpp_fallback_value_score;
      candidate.selected = total >= 12;
    }
    const rejectionReason = reporterCandidateRejectionReason(candidate);
    if (candidate.selected && rejectionReason) {
      candidate.selected = false;
      rejectedMainIneligible.push({
        title: candidate.title,
        url: candidate.url,
        source: candidate.source,
        reason: rejectionReason
      });
    }
  }
  value.rejected_main_ineligible_candidates = rejectedMainIneligible;
  return value;
}

function reporterImageCandidatesForSection(section, reporter) {
  const sourceUrls = new Set(ensureArray(section.sources).map(source => source && source.url).filter(Boolean));
  const matching = ensureArray(reporter.candidates)
    .filter(candidate => sourceUrls.has(candidate.url))
    .flatMap(candidate => ensureArray(candidate.imageCandidates));
  const fallback = ensureArray(reporter.candidates).flatMap(candidate => ensureArray(candidate.imageCandidates));
  const seen = new Set();
  const images = (matching.length > 0 ? matching : fallback)
    .filter(image => image && image.url && isSafeExternalImageUrl(image.url))
    .filter(image => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  return images.slice(0, 6);
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function firstHttpsUrl(...values) {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (isHttpsUrl(trimmed)) return trimmed;
  }
  return '';
}

function normalizeSectionImageFields(section, reporter) {
  const sectionImages = ensureArray(section.imageCandidates).filter(image => image && image.url && isSafeExternalImageUrl(image.url));
  const imageCandidates = sectionImages.length > 0 ? sectionImages : reporterImageCandidatesForSection(section, reporter);
  const allowed = new Set(imageCandidates.map(image => image.url));
  const requestedImage = allowed.has(section.selectedImage) ? section.selectedImage : '';
  const selected = imageCandidates.find(image => image.url === requestedImage);

  if (requestedImage) {
    const imageSource = firstHttpsUrl(
      section.imageSource,
      selected?.articleUrl,
      selected?.sourceUrl,
      ensureArray(section.sources)[0]?.url
    );
    const imageAttribution = String(section.imageAttribution || selected?.attribution || ensureArray(section.sources)[0]?.title || '').trim();
    const imageAlt = String(section.imageAlt || selected?.alt || section.headline || 'Article image').trim();
    const imageLicenseStatus = String(section.imageLicenseStatus || selected?.licenseStatus || 'unknown').trim();

    if (imageSource && imageAttribution && imageAlt && imageLicenseStatus) {
      return {
        imageCandidates,
        selectedImage: requestedImage,
        imageSource,
        imageAttribution,
        imageAlt,
        imageLicenseStatus,
        imageUsageDecisionReason: section.imageUsageDecisionReason || 'Editor-selected image with HTTPS source attribution.'
      };
    }
  }

  return {
    imageCandidates,
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: section.imageUsageDecisionReason ||
      'No suitable image with complete HTTPS attribution metadata selected; local fallback visual will be used.'
  };
}

function validateEditor(value, date, reporter = { candidates: [] }) {
  if (value.date !== date) value.date = date;
  value.title = value.title || `Camera HAL SW Newsletter - ${date}`;
  if (!value.title.includes(date)) value.title = `Camera HAL SW Newsletter - ${date}`;
  if (!value.summary) fail('Editor output is missing summary.');
  if (!Array.isArray(value.briefing) || value.briefing.length !== 3) {
    fail('Editor output must contain exactly 3 briefing items.');
  }
  if (!Array.isArray(value.sections) || value.sections.length < 3) {
    fail('Editor output must contain at least 3 sections.');
  }

  const fallbackCategories = ['AOSP Camera Watch', 'Android Camera / AI Watch', 'C++ / AI Practical Tip'];
  value.sections = value.sections.map((section, index) => {
    const actionItems = ensureArray(section.action_items);
    const actionHints = ensureArray(section.action_hints);
    const normalized = {
      ...section,
      category: section.category || fallbackCategories[index] || `Main Article ${index + 1}`,
      confirmed_facts: ensureArray(section.confirmed_facts).length > 0
        ? ensureArray(section.confirmed_facts)
        : [section.what_changed].filter(Boolean),
      evidence_summary: stringOrEmpty(section.evidence_summary),
      specificity_checks: ensureArray(section.specificity_checks),
      source_verification_notes: ensureArray(section.source_verification_notes),
      camera_hal_perspective: section.camera_hal_perspective || section.why_it_matters || '',
      action_items: actionItems.length > 0 ? actionItems : actionHints,
      action_hints: actionHints.length > 0 ? actionHints : actionItems,
      team_summary: section.team_summary || section.why_it_matters || '',
      is_ai_related: Boolean(section.is_ai_related),
      article_type: section.article_type || (section.is_ai_related ? 'ai' : 'camera-hal'),
      sources: ensureArray(section.sources).filter(source => source && source.url)
    };
    return {
      ...normalized,
      ...normalizeSectionImageFields(normalized, reporter)
    };
  });

  const emptySourceSections = value.sections
    .filter(section => section.sources.length === 0)
    .map(section => section.category);
  if (emptySourceSections.length > 0) {
    fail(`Editor output has sections without sources: ${emptySourceSections.join(', ')}`);
  }

  const refs = new Map();
  for (const section of value.sections) {
    for (const source of section.sources) {
      refs.set(source.url, { title: source.title || source.url, url: source.url });
    }
  }
  for (const source of ensureArray(value.references)) {
    if (source && source.url) refs.set(source.url, { title: source.title || source.url, url: source.url });
  }
  value.references = [...refs.values()];
  if (value.references.length === 0) fail('Editor output must contain references.');
  return value;
}

function validateFactCheck(value) {
  if (!['PASS', 'NEEDS_FIX'].includes(value.status)) {
    value.status = ensureArray(value.must_fix).length > 0 ? 'NEEDS_FIX' : 'PASS';
  }
  value.must_fix = ensureArray(value.must_fix);
  value.recommended_fixes = ensureArray(value.recommended_fixes);
  value.source_gaps = ensureArray(value.source_gaps);
  value.source_gap_count = numberOrDefault(value.source_gap_count, value.source_gaps.length);
  value.final_comment = value.final_comment || '';
  return value;
}

function containsTodo(files) {
  return files.some(file => fs.existsSync(file) && /\bTODO\b/.test(fs.readFileSync(file, 'utf8')));
}

function updateNewsletterData(date, issue) {
  const entry = {
    date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL', 'Android', 'C++', 'AI']
  };

  const newsletters = fs.existsSync(dataPath) ? readJson(dataPath) : [];
  const updated = newsletters
    .filter(item => item.date !== date)
    .concat(entry)
    .sort((a, b) => b.date.localeCompare(a.date));
  writeJson(dataPath, updated);
}

function runValidate() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  try {
    const siteOutput = execFileSync(npmCommand, ['run', 'validate:site'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const imageOutput = execFileSync(npmCommand, ['run', 'validate:images'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output = [siteOutput, imageOutput].join('\n').trim();
    return { ok: true, text: output || 'npm run validate:site and validate:images passed.' };
  } catch (error) {
    return {
      ok: false,
      text: [error.stdout, error.stderr].filter(Boolean).join('\n').trim() || error.message
    };
  }
}

function warnResolvedImageFallbacks(issue) {
  for (const section of ensureArray(issue.sections)) {
    const resolved = section.resolvedImage || {};
    if (!resolved.usedFallback) continue;
    console.warn([
      'Warning: article image fallback applied',
      `  section: ${section.category || 'unknown section'}`,
      `  article: ${section.headline || 'unknown article'}`,
      `  original: ${resolved.originalSrc || section.selectedImage || 'n/a'}`,
      `  fallback: ${resolved.src}`,
      `  reason: ${resolved.reason || 'unknown'}`
    ].join('\n'));
  }
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(' ').filter(token => token.length > 1));
  const right = new Set(normalizeTitle(b).split(' ').filter(token => token.length > 1));
  if (left.size === 0 || right.size === 0) return 0;
  const overlap = [...left].filter(token => right.has(token)).length;
  return overlap / Math.max(left.size, right.size);
}

function sourceDateTitle(section) {
  const firstSource = ensureArray(section.sources)[0] || {};
  return {
    source: normalizeTitle(firstSource.title || section.source),
    publishedDate: String(section.published_date || section.publishedDate || '').trim(),
    title: section.headline || firstSource.title || ''
  };
}

function sectionUrls(section) {
  return ensureArray(section.sources).map(source => source && source.url).filter(Boolean);
}

function sectionsAreDuplicate(left, right) {
  const leftUrls = new Set(sectionUrls(left));
  if (sectionUrls(right).some(url => leftUrls.has(url))) return true;
  if (normalizeTitle(left.headline) && normalizeTitle(left.headline) === normalizeTitle(right.headline)) return true;
  if (titleSimilarity(left.headline, right.headline) >= 0.82) return true;
  const leftKey = sourceDateTitle(left);
  const rightKey = sourceDateTitle(right);
  return leftKey.source &&
    leftKey.source === rightKey.source &&
    leftKey.publishedDate &&
    leftKey.publishedDate === rightKey.publishedDate &&
    titleSimilarity(leftKey.title, rightKey.title) >= 0.68;
}

function candidateDuplicatesSections(candidate, sections) {
  const candidateSection = {
    headline: candidate.title,
    published_date: candidate.published_date,
    sources: [{ title: candidate.source, url: candidate.url }]
  };
  return sections.some(section => sectionsAreDuplicate(candidateSection, section));
}

function removeDisallowedSelections(reporter, lockedSections, excludedSections = []) {
  const rejected = [];
  for (const candidate of ensureArray(reporter.candidates)) {
    if (!candidate.selected) continue;
    if (candidateDuplicatesSections(candidate, lockedSections)) {
      candidate.selected = false;
      rejected.push({ title: candidate.title, reason: 'duplicate locked article' });
      continue;
    }
    if (candidateDuplicatesSections(candidate, excludedSections)) {
      candidate.selected = false;
      rejected.push({ title: candidate.title, reason: 'excluded source-gap or demoted article' });
    }
  }
  return rejected;
}

function mergeLockedSections(lockedSections, generatedSections, excludedSections = []) {
  const merged = [];
  const rejected = [];
  for (const section of lockedSections) {
    if (merged.length >= MAX_MAIN_ARTICLES) break;
    merged.push(section);
  }
  for (const section of generatedSections) {
    if (merged.length >= MAX_MAIN_ARTICLES) break;
    if (merged.some(existing => sectionsAreDuplicate(existing, section))) {
      rejected.push({ title: section.headline || section.category || 'untitled article', reason: 'duplicate locked article' });
      continue;
    }
    if (excludedSections.some(existing => sectionsAreDuplicate(existing, section))) {
      rejected.push({ title: section.headline || section.category || 'untitled article', reason: 'excluded source-gap or demoted article' });
      continue;
    }
    merged.push(section);
  }
  return { sections: merged, rejected };
}

function sectionSummary(section, index) {
  return {
    index: index + 1,
    headline: section.headline,
    category: section.category,
    urls: sectionUrls(section),
    source_titles: ensureArray(section.sources).map(source => source.title).filter(Boolean)
  };
}

function buildLockedArticleContext(lockedSections, excludedSections = []) {
  if (lockedSections.length === 0 && excludedSections.length === 0) return '';
  const lockedSummary = lockedSections.map((section, index) => ({
    ...sectionSummary(section, index)
  }));
  const excludedSummary = excludedSections.map((section, index) => sectionSummary(section, index));
  return [
    lockedSections.length > 0 ? 'Passed articles locked from previous quality attempts:' : '',
    lockedSections.length > 0 ? JSON.stringify(lockedSummary, null, 2) : '',
    lockedSections.length > 0 ? 'Keep these passed articles unchanged. Do not rewrite them except for formatting consistency.' : '',
    excludedSections.length > 0 ? 'Excluded source-gap/demoted articles from previous attempts:' : '',
    excludedSections.length > 0 ? JSON.stringify(excludedSummary, null, 2) : '',
    excludedSections.length > 0 ? 'Do not select candidates or generate articles that duplicate these excluded URLs, titles, source names, or same source + published_date + similar title.' : '',
    'Generate only missing replacement articles. Avoid duplicate URLs, duplicate or near-identical headlines, and same source + same published_date + similar title.'
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
      .slice(0, MAX_MAIN_ARTICLES),
    blockers
  };
}

function appendUniqueLockedArticles(currentLocked, candidates) {
  const locked = [...currentLocked];
  for (const section of candidates) {
    if (locked.length >= MAX_MAIN_ARTICLES) break;
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

function sectionLabel(section) {
  return section.headline || section.category || 'untitled article';
}

function sourceGapSections(editor, factCheck) {
  return ensureArray(editor.sections).filter(section => sectionHasSourceGap(section, factCheck));
}

function finalArticleSlotDistribution(sections) {
  const distribution = {
    android_camera_platform_api: 0,
    camerax_aosp_camera_compatibility: 0,
    linux_camera_libcamera_v4l2: 0,
    ai_camera_path_hal_workflow: 0,
    cpp_toolchain_fallback: 0,
    other: 0
  };
  for (const section of ensureArray(sections)) {
    const body = [
      section.category,
      section.headline,
      section.evidence_summary,
      section.camera_hal_perspective,
      section.article_type,
      ensureArray(section.sources).map(source => `${source.title} ${source.url}`).join(' ')
    ].join(' ');
    if (/AI|agent|LLM|NPU|GPU|on-device|inference|model/i.test(body) &&
      /camera|HAL|stream|buffer|ImageAnalysis|workflow|latency|thermal|power/i.test(body)) {
      distribution.ai_camera_path_hal_workflow += 1;
    } else if (/libcamera|V4L2|Linux camera|media controller/i.test(body)) {
      distribution.linux_camera_libcamera_v4l2 += 1;
    } else if (/CameraX|AOSP Camera|CDD|CTS|VTS|Camera ITS|compatibility/i.test(body)) {
      distribution.camerax_aosp_camera_compatibility += 1;
    } else if (/Android Camera|Camera2|platform API|Camera HAL|request|result|metadata|stream|buffer/i.test(body)) {
      distribution.android_camera_platform_api += 1;
    } else if (/C\+\+|LLVM|Clang|NDK|toolchain/i.test(body)) {
      distribution.cpp_toolchain_fallback += 1;
    } else {
      distribution.other += 1;
    }
  }
  return distribution;
}

function recommendedFixMentionsSection(item, section) {
  const haystack = normalizeTitle(item);
  const labels = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source.title, source.url])
  ].map(normalizeTitle).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function buildSectionRepairPlan(editor, qualityReport, factCheck) {
  const repairableCategories = new Set(['required-fields', 'evidence-specificity', 'hal-depth', 'actionability']);
  return ensureArray(editor.sections).map(section => {
    const deductions = ensureArray(qualityReport?.deductions)
      .filter(deduction => repairableCategories.has(deduction.category) && deductionMatchesSection(deduction, section));
    const recommendedFixes = ensureArray(factCheck?.recommended_fixes)
      .filter(item => recommendedFixMentionsSection(item, section));
    const hasSourceGap = sectionHasSourceGap(section, factCheck);
    const action = hasSourceGap
      ? 'replace-or-demote'
      : deductions.length > 0 || recommendedFixes.length > 0 ? 'repair-section' : 'preserve';
    return {
      headline: sectionLabel(section),
      sources: sectionUrls(section),
      action,
      source_gap: hasSourceGap,
      deductions: deductions.map(deduction => ({
        category: deduction.category,
        points: deduction.points,
        reason: deduction.reason,
        location: deduction.location || ''
      })),
      recommended_fixes: recommendedFixes
    };
  }).filter(item => item.action !== 'preserve');
}

function buildRetryHistoryMarkdown(date, attempts) {
  const rows = attempts.map(item => [
    item.attempt,
    item.model || 'default',
    `${item.score}/${item.threshold}`,
    item.status,
    ensureArray(item.locked_sections).length,
    ensureArray(item.rejected_duplicate_headlines).length,
    item.source_gap_count,
    item.must_fix_count
  ]);
  return `# Newsletter Retry History - ${date}

| Attempt | Model | Score | Status | Locked | Rejected duplicates | Source gaps | Must-fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}

${attempts.map(item => `## Attempt ${item.attempt}

- Selected articles: ${item.selected_article_headlines.join('; ') || 'none'}
- Locked articles: ${item.locked_article_headlines.join('; ') || 'none'}
- Source gap sections: ${ensureArray(item.source_gap_sections).join('; ') || 'none'}
- Demoted sections: ${ensureArray(item.demoted_sections).join('; ') || 'none'}
- Replaced sections: ${ensureArray(item.replaced_sections).join('; ') || 'none'}
- Repair actions: ${ensureArray(item.repair_actions).join('; ') || 'none'}
- Final slot distribution: ${JSON.stringify(item.final_article_slot_distribution || {})}
- Rejected main-ineligible candidates: ${ensureArray(item.rejected_main_ineligible_candidates).map(candidate => `${candidate.title || candidate} (${candidate.reason || 'rejected'})`).join('; ') || 'none'}
- Lock blockers: ${ensureArray(item.lock_blockers).join('; ') || 'none'}
- Rejected duplicate articles: ${ensureArray(item.rejected_duplicate_headlines).map(entry => typeof entry === 'string' ? entry : `${entry.title || 'untitled'} (${entry.reason || 'rejected'})`).join('; ') || 'none'}
- Deductions: ${item.deductions.length === 0 ? 'none' : item.deductions.map(deduction => `${deduction.points}pt ${deduction.category}${deduction.location ? ` (${deduction.location})` : ''}: ${deduction.reason}`).join('; ')}
`).join('\n')}`;
}

async function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();
  writeNewsletterDate(date);
  writeGenerationStatus({ date, status: 'STARTED', must_fix_count: 0 });

  const candidatePath = path.join(root, 'collected-news', date, 'candidates.json');
  const sourcesPath = path.join(root, 'docs', 'news-sources.md');
  const editorialPolicyPath = path.join(root, 'docs', 'editorial-policy.md');
  const newsletterTemplatePath = path.join(root, 'docs', 'newsletter-template.md');
  const goldenExamplePath = path.join(root, 'docs', 'golden-examples', 'manual-quality-newsletter.md');
  const newsroomDir = path.join(root, 'newsroom', date);
  const newsletterDir = path.join(root, 'newsletters', date);

  if (!fs.existsSync(candidatePath)) {
    fail(`Missing ${path.relative(root, candidatePath)}. Run scripts/collect-news-candidates.js first.`);
  }
  if (!fs.existsSync(sourceRegistryPath) && !fs.existsSync(sourcesPath)) {
    fail('Missing data/news-sources.json and docs/news-sources.md.');
  }

  const candidates = readJson(candidatePath);
  const sourcesMarkdown = readTextIfExists(sourcesPath);
  const editorialPolicy = readTextIfExists(editorialPolicyPath);
  const newsletterTemplate = readTextIfExists(newsletterTemplatePath);
  const goldenExample = readTextIfExists(goldenExamplePath);
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : null;
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(newsletterDir, { recursive: true });

  const commonContext = [
    `Newsletter date: ${date}`,
    'Audience: Camera HAL / Android Camera / C++ engineer',
    'Use only the collected candidate JSON, data/news-sources.json, docs/news-sources.md, and the editorial documents below. Do not browse the web.',
    'Keep source names and source URLs unchanged. Distinguish confirmed facts from interpretation.',
    'Final newsletter text must be Korean.',
    '',
    'docs/editorial-policy.md:',
    editorialPolicy,
    '',
    'docs/newsletter-template.md:',
    newsletterTemplate,
    '',
    'docs/golden-examples/manual-quality-newsletter.md:',
    goldenExample,
    '',
    'Use the golden example only as a style and structure reference. Do not copy facts, dates, versions, API/component names, behavior changes, sources, or action items unless they are present in the current candidate JSON.'
  ].join('\n');

  const maxQualityRetries = integerOrDefault(process.env.NEWSROOM_MAX_QUALITY_RETRIES, 3);
  const totalAttempts = 1 + maxQualityRetries;
  const retryHistory = [];
  let lockedSections = [];
  let reporter = null;
  let editor = null;
  let factCheck = null;
  let qualityReport = null;
  let excludedSections = [];

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const lockedContext = buildLockedArticleContext(lockedSections, excludedSections);
    const reporterStage = `reporter attempt ${attempt}/${totalAttempts}`;
    const editorStage = `editor attempt ${attempt}/${totalAttempts}`;
    const factCheckStage = `fact-checker attempt ${attempt}/${totalAttempts}`;
    console.log(`Starting Gemini newsroom quality attempt ${attempt}/${totalAttempts}. Locked articles: ${lockedSections.length}.`);

    reporter = validateReporter(await callGeminiJson(
      reporterStage,
      [
        'You are the AI reporter for Camera HAL SW Newsletter.',
        'Select and score only items meaningful to Camera HAL, Android Camera, CameraX, AOSP Camera, stream/buffer/metadata/request/result, C++, LLVM/Clang, AI Agent, on-device AI, NPU/GPU, and developer productivity.',
        'Give low scores to product promotion, general IT news, and weak Camera HAL relevance.',
        'Use priority, reliability, candidateOnly, requiresCrossCheck, section, and cameraHalRelevanceScore when selecting items.',
        'For main article selection, selected=true is allowed only when main_eligible=true, source_gap_risk=false, evidence_score >= 6, and camera_hal_relevance_score + android_camera_relevance_score + practical_actionability_score >= 8.',
        'Set selected=false for documentation_page, rolling_page, blog_index, briefing_only, reference_only, source_gap_risk=true, and main_eligible=false candidates.',
        'For every selected candidate, extract concrete evidence when available: version_or_release, api_or_component, behavior_change, evidence_notes, and cross_check_status.',
        'Preserve source_kind, source_gap_risk, main_eligible, briefing_only, reference_only, and evidence_score from the collected candidate metadata.',
        'If the source is a rolling page such as release notes or a watch page, say that explicitly in evidence_notes and do not present it as a dated release unless the candidate provides a date.',
        'cross_check_status must be one of: not-required, official-source, cross-checked, needs-cross-check.',
        'Candidate-only or requiresCrossCheck leads must not be selected unless cross_check_status is official-source or cross-checked.',
        'Preserve imageCandidates exactly from the collected candidate JSON. Do not invent image URLs, rewrite image URLs, or add image candidates.',
        lockedSections.length > 0 ? 'Do not select candidates that duplicate the locked article URLs, titles, sources, or source-date-title combinations listed in the retry context.' : '',
        'For every candidate, provide these numeric scores:',
        '- camera_hal_relevance_score: 0-5',
        '- android_camera_relevance_score: 0-5',
        '- practical_actionability_score: 0-5',
        '- source_reliability_score: 0-5',
        '- freshness_score: 0-3',
        '- ai_required_slot_fit_score: 0-3',
        '- cpp_fallback_value_score: 0-3',
        'Return only JSON matching the schema.'
      ].filter(Boolean).join('\n'),
      `${commonContext}\n\n${lockedContext}\n\nCollected candidates JSON:\n${JSON.stringify(candidates, null, 2)}\n\ndata/news-sources.json:\n${JSON.stringify(sourceRegistry, null, 2)}\n\ndocs/news-sources.md:\n${sourcesMarkdown}`,
      reporterSchema
    ), date, ensureArray(candidates.candidates));
    const rejectedReporterDuplicates = removeDisallowedSelections(reporter, lockedSections, excludedSections);
    writeJson(path.join(newsroomDir, `reporter-candidates-attempt-${attempt}.json`), reporter);

    editor = validateEditor(await callGeminiJson(
      editorStage,
      [
        'You are the AI editor for Camera HAL SW Newsletter.',
        'Write a Korean technical newsletter draft that a Camera HAL engineer can read in 10 minutes.',
        'Follow docs/editorial-policy.md and docs/newsletter-template.md exactly.',
        'Create exactly 5 main articles when enough non-duplicate source material exists; 4 main articles are acceptable only when strong candidates are insufficient.',
        `Final main article count must stay between ${MIN_MAIN_ARTICLES} and ${MAX_MAIN_ARTICLES}; do not force 5 articles when only 4 strong eligible candidates exist.`,
        'Use selected reporter candidates as main article inputs. Do not turn selected=false, main_eligible=false, source_gap_risk=true, briefing_only, or reference_only candidates into main articles.',
        'Target article slot mix: Android Camera / platform API 1-2; CameraX / AOSP Camera / compatibility 1-2; Linux camera / libcamera / V4L2 0-1; AI plus camera input path or HAL workflow at least 1; C++ / toolchain fallback 0-1.',
        'Include at least 1 AI-related article, and if possible at least 2 Camera HAL / Android Camera / CameraX / AOSP Camera articles.',
        'If there are not enough strong Camera HAL / Android Camera candidates, use C++ fallback only when it has concrete HAL native-code value.',
        lockedSections.length > 0 ? 'Locked articles from previous attempts are already quality-passing. Keep these passed articles unchanged and generate only missing replacement articles.' : '',
        lockedSections.length > 0 ? 'Do not duplicate locked article URLs, titles/headlines, source names, or same source + published date + similar title.' : '',
        'Avoid marketing tone. Include confirmed_facts, background, camera_hal_perspective, action_items, team_summary, and sources in every article.',
        'Every article must include evidence_summary, specificity_checks, and source_verification_notes.',
        'specificity_checks must name concrete evidence such as version, release date, API/component, source page, behavior change, or the exact source gap if the source is a rolling page.',
        'Do not write generic advice like "monitor AOSP updates" or "review CameraX changes" unless the sentence names the exact source, version/release, API/component, date, or behavior to watch.',
        'For AI, C++, Linux, or tooling articles, explicitly connect the item to Camera HAL through stream/buffer/metadata/request/result, CTS/VTS/Camera ITS, latency, frame drop, thermal, memory, NPU/GPU/ISP contention, or HAL workflow.',
        'Each action_items entry must be executable within 2 weeks and include at least one concrete test, log, metric, device class, API/component, stream combination, or code-owner style handoff.',
        'For each article, choose at most one selectedImage from that article imageCandidates. If relevance, rights risk, logo-only content, screenshot text density, or source fit is unclear, set selectedImage to an empty string.',
        'Do not invent image URLs. selectedImage must exactly match one imageCandidates.url value, or be an empty string.',
        'Prefer directly relevant 16:9 or 4:3 clean images from the source article over generic, logo-only, or promotional images.',
        'When selectedImage is set, ALWAYS provide imageSource, imageAttribution, imageAlt, imageLicenseStatus, and a short imageUsageDecisionReason. imageAlt must describe the image in article context.',
        'imageSource MUST be an HTTPS URL that links to the image source or article.',
        'imageAttribution MUST be non-empty source or article title text.',
        'If you cannot provide imageSource, imageAttribution, imageAlt, and imageLicenseStatus, do not select an image; leave selectedImage empty.',
        'Incomplete selected image metadata will be removed during validation and may cause publication validation failure.',
        'When no image is selected, keep selectedImage, imageSource, imageAttribution, and imageAlt empty, set imageLicenseStatus to none, and explain the rejection briefly in imageUsageDecisionReason.',
        'Separate facts and interpretation. Preserve source links. Return only JSON matching the schema.',
        'briefing must have exactly 3 items.'
      ].filter(Boolean).join('\n'),
      `${commonContext}\n\n${lockedContext}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}`,
      editorSchema
    ), date, reporter);

    const merged = mergeLockedSections(lockedSections, editor.sections, excludedSections);
    let rejectedGeneratedSections = [...merged.rejected];
    editor.sections = merged.sections;
    await resolveIssueArticleImages(editor, { root });
    warnResolvedImageFallbacks(editor);
    writeJson(path.join(newsroomDir, `editor-draft-attempt-${attempt}.json`), editor);
    fs.writeFileSync(path.join(newsroomDir, `editor-draft-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

    factCheck = validateFactCheck(await callGeminiJson(
      factCheckStage,
      [
        'You are the AI fact checker for Camera HAL SW Newsletter.',
        'Check factuality, missing sources, exaggerated language, and missing dates.',
        'Treat missing version, release date, API/component name, or behavior change as must_fix when an article presents a rolling page or generic watch item as a concrete update.',
        'Any claim without a source must be classified as must_fix.',
        'Flag general AI/C++ news that lacks Camera HAL or Android Camera interpretation.',
        'Flag any main article without concrete Action Item content.',
        'Flag any main article with weak Camera HAL perspective or missing engineering relevance.',
        'Flag candidate-only or requiresCrossCheck source usage unless the editor explains official-source or cross-checked verification.',
        'Do not rewrite for style. Focus only on factual errors, source problems, and editorial-policy violations.',
        'Return only JSON matching the schema.'
      ].join('\n'),
      `${commonContext}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}\n\nEditor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
      factCheckSchema
    ));
    writeJson(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.json`), factCheck);
    fs.writeFileSync(path.join(newsroomDir, `fact-check-report-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

    qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
      threshold: QUALITY_THRESHOLD
    });
    writeJson(path.join(newsroomDir, `quality-report-attempt-${attempt}.json`), qualityReport);
    fs.writeFileSync(path.join(newsroomDir, `quality-report-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');

    let repairActions = [];
    let demotedSections = sourceGapSections(editor, factCheck);
    let replacedSections = [];
    const repairPlan = buildSectionRepairPlan(editor, qualityReport, factCheck);
    if (qualityReport.status !== 'PASS' && repairPlan.length > 0) {
      repairActions = repairPlan.map(item => `${item.action}: ${item.headline}`);
      const repairStage = `editor repair attempt ${attempt}/${totalAttempts}`;
      const repairFactCheckStage = `fact-checker repair attempt ${attempt}/${totalAttempts}`;
      console.warn(`Quality attempt ${attempt}/${totalAttempts} is below threshold; running editor repair pass for ${repairPlan.length} section(s).`);
      const repairEditor = validateEditor(await callGeminiJson(
        repairStage,
        [
          'You are the AI repair editor for Camera HAL SW Newsletter.',
          'Return a full editor JSON draft, but only change sections listed in the repair plan.',
          'For required-fields, evidence-specificity, hal-depth, and actionability deductions, repair only the affected section.',
          'For source_gap=true sections, prefer replacement or demotion to briefing/reference over text repair.',
          'Replacement main articles must use reporter candidates with selected=true, main_eligible=true, source_gap_risk=false, evidence_score >= 6, and HAL/actionability score >= 8.',
          'Preserve locked/passing sections unchanged and do not duplicate locked or excluded articles.',
          `Keep ${MIN_MAIN_ARTICLES}-${MAX_MAIN_ARTICLES} main articles; 5 is the target only when enough strong eligible candidates exist.`,
          'Maintain the slot policy: Android Camera/platform API 1-2; CameraX/AOSP/compatibility 1-2; Linux camera/libcamera/V4L2 0-1; at least 1 AI camera path/HAL workflow article; C++/toolchain fallback 0-1.',
          'Use the golden example only for article structure and evidence/actionability style. Do not copy facts absent from current reporter candidates.',
          'Return only JSON matching the schema.'
        ].join('\n'),
        `${commonContext}\n\n${lockedContext}\n\nRepair plan JSON:\n${JSON.stringify(repairPlan, null, 2)}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}\n\nCurrent editor draft JSON:\n${JSON.stringify(editor, null, 2)}\n\nCurrent fact-check JSON:\n${JSON.stringify(factCheck, null, 2)}\n\nCurrent quality report JSON:\n${JSON.stringify(qualityReport, null, 2)}`,
        editorSchema
      ), date, reporter);
      const repairMerged = mergeLockedSections(lockedSections, repairEditor.sections, excludedSections.concat(demotedSections));
      rejectedGeneratedSections = rejectedGeneratedSections.concat(repairMerged.rejected);
      replacedSections = repairMerged.rejected
        .filter(item => item.reason === 'excluded source-gap or demoted article')
        .map(item => item.title);
      editor = {
        ...repairEditor,
        sections: repairMerged.sections
      };
      await resolveIssueArticleImages(editor, { root });
      warnResolvedImageFallbacks(editor);
      writeJson(path.join(newsroomDir, `editor-repair-attempt-${attempt}.json`), editor);
      fs.writeFileSync(path.join(newsroomDir, `editor-repair-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

      factCheck = validateFactCheck(await callGeminiJson(
        repairFactCheckStage,
        [
          'You are the AI fact checker for the repaired Camera HAL SW Newsletter draft.',
          'Check factuality, missing sources, exaggerated language, missing dates, source gaps, and editorial-policy violations.',
          'Treat any remaining source gap in a main article as must_fix.',
          'Return only JSON matching the schema.'
        ].join('\n'),
        `${commonContext}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}\n\nRepaired editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
        factCheckSchema
      ));
      writeJson(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.json`), factCheck);
      fs.writeFileSync(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

      qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
        threshold: QUALITY_THRESHOLD
      });
      writeJson(path.join(newsroomDir, `quality-report-repair-attempt-${attempt}.json`), qualityReport);
      fs.writeFileSync(path.join(newsroomDir, `quality-report-repair-attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
      demotedSections = demotedSections.concat(sourceGapSections(editor, factCheck));
    }

    excludedSections = appendUniqueSections(excludedSections, demotedSections);
    const lockSelection = selectLockedArticles(editor, qualityReport, factCheck);
    lockedSections = appendUniqueLockedArticles(lockedSections, lockSelection.articles);
    const rejectedDuplicateHeadlines = [...rejectedReporterDuplicates, ...rejectedGeneratedSections];
    const lockBlockers = lockSelection.blockers.map(deduction => `${deduction.category}: ${deduction.reason}`);
    retryHistory.push({
      attempt,
      model: [
        `reporter=${getGeminiModelUsage(reporterStage) || 'unknown'}`,
        `editor=${getGeminiModelUsage(editorStage) || 'unknown'}`,
        `fact-checker=${getGeminiModelUsage(factCheckStage) || 'unknown'}`
      ].join(', '),
      score: qualityReport.score,
      threshold: qualityReport.threshold,
      status: qualityReport.status,
      deductions: ensureArray(qualityReport.deductions),
      selected_article_headlines: lockedArticleHeadlines(editor.sections),
      locked_article_headlines: lockedArticleHeadlines(lockedSections),
      source_gap_sections: sourceGapSections(editor, factCheck).map(sectionLabel),
      demoted_sections: demotedSections.map(sectionLabel),
      replaced_sections: replacedSections,
      locked_sections: lockedSections.map((section, index) => sectionSummary(section, index)),
      repair_actions: repairActions,
      final_article_slot_distribution: finalArticleSlotDistribution(editor.sections),
      rejected_main_ineligible_candidates: ensureArray(reporter.rejected_main_ineligible_candidates),
      lock_blockers: lockBlockers,
      rejected_duplicate_headlines: rejectedDuplicateHeadlines,
      source_gap_count: qualityReport.metrics.source_gap_count,
      must_fix_count: qualityReport.metrics.must_fix_count
    });
    console.log(`Quality attempt ${attempt}/${totalAttempts}: score ${qualityReport.score}/${qualityReport.threshold}, status ${qualityReport.status}, deductions ${ensureArray(qualityReport.deductions).length}, locked articles ${lockedSections.length}, rejected duplicates ${rejectedDuplicateHeadlines.length}.`);
    if (lockBlockers.length > 0) {
      console.warn(`Quality attempt ${attempt}/${totalAttempts} has issue-level lock blocker(s): ${lockBlockers.join('; ')}.`);
    }

    if (qualityReport.status === 'PASS' && qualityReport.score >= qualityReport.threshold) break;
    if (attempt < totalAttempts) {
      console.warn(`Quality attempt ${attempt}/${totalAttempts} did not pass; retrying with ${lockedSections.length} locked article(s).`);
    }
  }

  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, factCheck), 'utf8');
  writeJson(path.join(newsroomDir, 'quality-report.json'), qualityReport);
  fs.writeFileSync(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(qualityReport), 'utf8');
  writeJson(path.join(newsroomDir, 'retry-history.json'), retryHistory);
  fs.writeFileSync(path.join(newsroomDir, 'retry-history.md'), buildRetryHistoryMarkdown(date, retryHistory), 'utf8');

  const newsletterMd = path.join(newsletterDir, 'newsletter.md');
  const newsletterHtml = path.join(newsletterDir, 'index.html');
  fs.writeFileSync(newsletterMd, buildMarkdown(editor), 'utf8');
  fs.writeFileSync(newsletterHtml, buildHtml(editor), 'utf8');
  updateNewsletterData(date, editor);

  const files = [
    `collected-news/${date}/candidates.json`,
    `newsroom/${date}/reporter-candidates.json`,
    `newsroom/${date}/editor-draft.json`,
    `newsroom/${date}/editor-draft.md`,
    `newsroom/${date}/fact-check-report.json`,
    `newsroom/${date}/fact-check-report.md`,
    `newsroom/${date}/quality-report.json`,
    `newsroom/${date}/quality-report.md`,
    `newsroom/${date}/retry-history.json`,
    `newsroom/${date}/retry-history.md`,
    `newsroom/${date}/editor-in-chief-brief.md`,
    `newsroom/${date}/release-qa-report.md`,
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`,
    'data/newsletters.json'
  ];

  fs.writeFileSync(path.join(newsroomDir, 'editor-in-chief-brief.md'), buildEditorChiefBrief(date, editor, factCheck, qualityReport), 'utf8');

  const emptySourceSections = editor.sections
    .filter(section => ensureArray(section.sources).filter(source => source && source.url).length === 0)
    .map(section => section.category);
  const todoFound = containsTodo([newsletterMd, newsletterHtml]);
  const validateResult = runValidate();
  fs.writeFileSync(
    path.join(newsroomDir, 'release-qa-report.md'),
    buildReleaseQaReport(date, files, validateResult.text, factCheck, todoFound, emptySourceSections, qualityReport),
    'utf8'
  );

  const mustFixCount = ensureArray(factCheck.must_fix).length;
  let generationStatus = 'PASS';
  if (factCheck.status === 'NEEDS_FIX' && mustFixCount > 0) {
    generationStatus = 'NEEDS_FIX';
  } else if (qualityReport.status !== 'PASS') {
    generationStatus = 'QUALITY_NEEDS_FIX';
  }
  writeGenerationStatus({
    date,
    status: generationStatus,
    fact_check_status: factCheck.status,
    must_fix_count: mustFixCount,
    quality_status: qualityReport.status,
    quality_score: qualityReport.score,
    quality_threshold: qualityReport.threshold,
    quality_deduction_count: ensureArray(qualityReport.deductions).length,
    quality_attempt_count: retryHistory.length,
    locked_article_count: retryHistory.at(-1)?.locked_article_headlines.length || 0,
    rejected_duplicate_article_count: retryHistory.reduce((sum, item) => sum + item.rejected_duplicate_headlines.length, 0),
    validate_ok: validateResult.ok,
    todo_found: todoFound,
    empty_source_sections: emptySourceSections,
    source_gap_count: factCheck.source_gap_count
  });

  if (todoFound) fail('Generated newsletter contains TODO.');
  if (emptySourceSections.length > 0) fail(`Generated sections without sources: ${emptySourceSections.join(', ')}`);
  if (!validateResult.ok) fail(`npm run validate failed:\n${validateResult.text}`);
  if (generationStatus === 'NEEDS_FIX') {
    console.warn('Gemini fact checker returned NEEDS_FIX with must_fix items. Artifacts were written for editor review.');
  } else if (generationStatus === 'QUALITY_NEEDS_FIX') {
    console.warn(`Newsletter quality score ${qualityReport.score}/${qualityReport.threshold} is below the required gate. Artifacts were written for editor review.`);
  }

  console.log(`Gemini newsroom newsletter generated for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
