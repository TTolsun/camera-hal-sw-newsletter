const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  kstDate,
  readJson,
  readTextIfExists,
  writeJson
} = require('./lib/common');
const { callGeminiJson } = require('./lib/gemini-client');
const { reporterSchema, editorSchema, factCheckSchema } = require('./lib/newsletter-schema');
const { isSafeExternalImageUrl } = require('./lib/image-candidates');
const { resolveIssueArticleImages } = require('./lib/article-image-resolver');
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

function imageCandidatesForReporterCandidate(candidate, collectedByUrl) {
  const collected = collectedByUrl.get(candidate.url) || collectedByUrl.get(candidate.article_url) || {};
  const images = ensureArray(candidate.imageCandidates).length > 0
    ? ensureArray(candidate.imageCandidates)
    : ensureArray(collected.imageCandidates);
  return images.filter(image => image && image.url && isSafeExternalImageUrl(image.url));
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
  for (const candidate of value.candidates) {
    if (!candidate.title || !candidate.url || !candidate.source) {
      fail('Reporter candidate is missing title, source, or url.');
    }
    candidate.camera_hal_relevance_score = numberOrDefault(candidate.camera_hal_relevance_score);
    candidate.android_camera_relevance_score = numberOrDefault(candidate.android_camera_relevance_score);
    candidate.practical_actionability_score = numberOrDefault(candidate.practical_actionability_score);
    candidate.source_reliability_score = numberOrDefault(candidate.source_reliability_score);
    candidate.freshness_score = numberOrDefault(candidate.freshness_score);
    candidate.ai_required_slot_fit_score = numberOrDefault(candidate.ai_required_slot_fit_score);
    candidate.cpp_fallback_value_score = numberOrDefault(candidate.cpp_fallback_value_score);
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
  }
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
    const output = execFileSync(npmCommand, ['run', 'validate'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, text: output.trim() || 'npm run validate passed.' };
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

async function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();
  writeNewsletterDate(date);
  writeGenerationStatus({ date, status: 'STARTED', must_fix_count: 0 });

  const candidatePath = path.join(root, 'collected-news', date, 'candidates.json');
  const sourcesPath = path.join(root, 'docs', 'news-sources.md');
  const editorialPolicyPath = path.join(root, 'docs', 'editorial-policy.md');
  const newsletterTemplatePath = path.join(root, 'docs', 'newsletter-template.md');
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
    newsletterTemplate
  ].join('\n');

  const reporter = validateReporter(await callGeminiJson(
    'reporter',
    [
      'You are the AI reporter for Camera HAL SW Newsletter.',
      'Select and score only items meaningful to Camera HAL, Android Camera, CameraX, AOSP Camera, stream/buffer/metadata/request/result, C++, LLVM/Clang, AI Agent, on-device AI, NPU/GPU, and developer productivity.',
      'Give low scores to product promotion, general IT news, and weak Camera HAL relevance.',
      'Use priority, reliability, candidateOnly, requiresCrossCheck, section, and cameraHalRelevanceScore when selecting items.',
      'Preserve imageCandidates exactly from the collected candidate JSON. Do not invent image URLs, rewrite image URLs, or add image candidates.',
      'For every candidate, provide these numeric scores:',
      '- camera_hal_relevance_score: 0-5',
      '- android_camera_relevance_score: 0-5',
      '- practical_actionability_score: 0-5',
      '- source_reliability_score: 0-5',
      '- freshness_score: 0-3',
      '- ai_required_slot_fit_score: 0-3',
      '- cpp_fallback_value_score: 0-3',
      'Return only JSON matching the schema.'
    ].join('\n'),
    `${commonContext}\n\nCollected candidates JSON:\n${JSON.stringify(candidates, null, 2)}\n\ndata/news-sources.json:\n${JSON.stringify(sourceRegistry, null, 2)}\n\ndocs/news-sources.md:\n${sourcesMarkdown}`,
    reporterSchema
  ), date, ensureArray(candidates.candidates));
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);

  const editor = validateEditor(await callGeminiJson(
    'editor',
    [
      'You are the AI editor for Camera HAL SW Newsletter.',
      'Write a Korean technical newsletter draft that a Camera HAL engineer can read in 10 minutes.',
      'Follow docs/editorial-policy.md and docs/newsletter-template.md exactly.',
      'Create about 5 main articles. 4-6 articles are acceptable if the source set requires it.',
      'Include at least 1 AI-related article, and if possible at least 2 Camera HAL / Android Camera / CameraX / AOSP Camera articles.',
      'If there are not enough strong Camera HAL / Android Camera candidates, use C++ fallback only when it has concrete HAL native-code value.',
      'Avoid marketing tone. Include confirmed_facts, background, camera_hal_perspective, action_items, team_summary, and sources in every article.',
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
    ].join('\n'),
    `${commonContext}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}`,
    editorSchema
  ), date, reporter);
  await resolveIssueArticleImages(editor, { root });
  warnResolvedImageFallbacks(editor);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');

  const factCheck = validateFactCheck(await callGeminiJson(
    'fact-checker',
    [
      'You are the AI fact checker for Camera HAL SW Newsletter.',
      'Check factuality, missing sources, exaggerated language, and missing dates.',
      'Any claim without a source must be classified as must_fix.',
      'Flag general AI/C++ news that lacks Camera HAL or Android Camera interpretation.',
      'Flag any main article without concrete Action Item content.',
      'Flag any main article with weak Camera HAL perspective or missing engineering relevance.',
      'Do not rewrite for style. Focus only on factual errors, source problems, and editorial-policy violations.',
      'Return only JSON matching the schema.'
    ].join('\n'),
    `${commonContext}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}\n\nEditor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
    factCheckSchema
  ));
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, factCheck), 'utf8');

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
    `newsroom/${date}/editor-in-chief-brief.md`,
    `newsroom/${date}/release-qa-report.md`,
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`,
    'data/newsletters.json'
  ];

  fs.writeFileSync(path.join(newsroomDir, 'editor-in-chief-brief.md'), buildEditorChiefBrief(date, editor, factCheck), 'utf8');

  const emptySourceSections = editor.sections
    .filter(section => ensureArray(section.sources).filter(source => source && source.url).length === 0)
    .map(section => section.category);
  const todoFound = containsTodo([newsletterMd, newsletterHtml]);
  const validateResult = runValidate();
  fs.writeFileSync(
    path.join(newsroomDir, 'release-qa-report.md'),
    buildReleaseQaReport(date, files, validateResult.text, factCheck, todoFound, emptySourceSections),
    'utf8'
  );

  const mustFixCount = ensureArray(factCheck.must_fix).length;
  const generationStatus = factCheck.status === 'NEEDS_FIX' && mustFixCount > 0
    ? 'NEEDS_FIX'
    : 'PASS';
  writeGenerationStatus({
    date,
    status: generationStatus,
    fact_check_status: factCheck.status,
    must_fix_count: mustFixCount,
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
  }

  console.log(`Gemini newsroom newsletter generated for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
