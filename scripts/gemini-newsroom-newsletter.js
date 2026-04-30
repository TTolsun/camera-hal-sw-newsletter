const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { callGeminiJson } = require('./lib/gemini-client');
const { reporterSchema, editorSchema, factCheckSchema } = require('./lib/newsletter-schema');
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

function kstDate(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Failed to read JSON ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeNewsletterDate(date) {
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'newsletter-date.txt'), date, 'utf8');
}

function validateReporter(value, date) {
  if (value.date !== date) value.date = date;
  if (!Array.isArray(value.candidates) || value.candidates.length === 0) {
    fail('Reporter output must contain at least one candidate.');
  }
  for (const candidate of value.candidates) {
    if (!candidate.title || !candidate.url || !candidate.source) {
      fail('Reporter candidate is missing title, source, or url.');
    }
    if (typeof candidate.selected !== 'boolean') {
      candidate.selected = Number(candidate.camera_hal_relevance_score || 0) >= 5;
    }
  }
  return value;
}

function validateEditor(value, date) {
  if (value.date !== date) value.date = date;
  value.title = value.title || `Camera HAL SW Newsletter - ${date}`;
  if (!value.title.includes(date)) value.title = `Camera HAL SW Newsletter - ${date}`;
  if (!value.summary) fail('Editor output is missing summary.');
  if (!Array.isArray(value.briefing) || value.briefing.length !== 3) {
    fail('Editor output must contain exactly 3 briefing items.');
  }
  if (!Array.isArray(value.sections) || value.sections.length !== 3) {
    fail('Editor output must contain exactly 3 sections.');
  }

  const categories = ['AOSP Camera Watch', 'Tech Trend Radar', 'C++ / AI Practical Tip'];
  value.sections = value.sections.map((section, index) => ({
    ...section,
    category: categories[index],
    sources: ensureArray(section.sources).filter(source => source && source.url)
  }));

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
  try {
    const output = execFileSync(process.execPath, ['scripts/validate-site.js'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, text: output.trim() || 'validate-site.js passed.' };
  } catch (error) {
    return {
      ok: false,
      text: [error.stdout, error.stderr].filter(Boolean).join('\n').trim() || error.message
    };
  }
}

async function main() {
  const date = process.env.NEWSLETTER_DATE || kstDate();
  writeNewsletterDate(date);

  const candidatePath = path.join(root, 'collected-news', date, 'candidates.json');
  const sourcesPath = path.join(root, 'docs', 'news-sources.md');
  const newsroomDir = path.join(root, 'newsroom', date);
  const newsletterDir = path.join(root, 'newsletters', date);

  if (!fs.existsSync(candidatePath)) {
    fail(`Missing ${path.relative(root, candidatePath)}. Run scripts/collect-news-candidates.js first.`);
  }
  if (!fs.existsSync(sourceRegistryPath) && !fs.existsSync(sourcesPath)) {
    fail('Missing data/news-sources.json and docs/news-sources.md.');
  }

  const candidates = readJson(candidatePath);
  const sourcesMarkdown = fs.existsSync(sourcesPath) ? fs.readFileSync(sourcesPath, 'utf8') : '';
  const sourceRegistry = fs.existsSync(sourceRegistryPath) ? readJson(sourceRegistryPath) : null;
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(newsletterDir, { recursive: true });

  const commonContext = [
    `Newsletter date: ${date}`,
    'Audience: Camera HAL / Android Camera / C++ engineer',
    'Use only the collected candidate JSON, data/news-sources.json, and docs/news-sources.md. Do not browse the web.',
    'Keep source names and source URLs unchanged. Distinguish facts from interpretation.',
    'Use candidate section/category metadata for filtering and grouping, but keep the existing newsletter output structure.',
    'Treat candidateOnly=true or requiresCrossCheck=true items as leads unless official or project-official sources support the same claim.',
    'Final newsletter text must be Korean.'
  ].join('\n');

  const reporter = validateReporter(await callGeminiJson(
    'reporter',
    [
      'You are the AI reporter for Camera HAL SW Newsletter.',
      'Select and score only items meaningful to Camera HAL, Android Camera, CameraX, AOSP Camera, stream/buffer/metadata/request/result, C++, LLVM/Clang, AI Agent, and developer productivity.',
      'Give low scores to product promotion, general IT news, and weak Camera HAL relevance.',
      'Use priority, reliability, candidateOnly, requiresCrossCheck, section, and cameraHalRelevanceScore when selecting items.',
      'Return only JSON matching the schema.'
    ].join('\n'),
    `${commonContext}\n\nCollected candidates JSON:\n${JSON.stringify(candidates, null, 2)}\n\ndata/news-sources.json:\n${JSON.stringify(sourceRegistry, null, 2)}\n\ndocs/news-sources.md:\n${sourcesMarkdown}`,
    reporterSchema
  ), date);
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);

  const editor = validateEditor(await callGeminiJson(
    'editor',
    [
      'You are the AI editor for Camera HAL SW Newsletter.',
      'Write a Korean technical newsletter draft that a Camera HAL engineer can read in 10 minutes.',
      'Avoid marketing tone. Include background knowledge and Camera HAL checks in every section.',
      'Separate facts and interpretation. Preserve source links. Return only JSON matching the schema.',
      'briefing must have exactly 3 items. sections must have exactly 3 items in this order: AOSP Camera Watch, Tech Trend Radar, C++ / AI Practical Tip.',
      'Use registry sections such as Linux Camera / Driver, Embedded / Semiconductor, AI / SW Engineering Trends, and Korean Tech Trends as candidate grouping signals inside the existing three-section newsletter format.'
    ].join('\n'),
    `${commonContext}\n\nReporter candidates JSON:\n${JSON.stringify(reporter, null, 2)}`,
    editorSchema
  ), date);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');

  const factCheck = validateFactCheck(await callGeminiJson(
    'fact-checker',
    [
      'You are the AI fact checker for Camera HAL SW Newsletter.',
      'Check factuality, missing sources, exaggerated language, and missing dates.',
      'Any claim without a source must be classified as must_fix.',
      'Do not rewrite for style. Focus only on factual errors and source problems.',
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

  if (todoFound) fail('Generated newsletter contains TODO.');
  if (emptySourceSections.length > 0) fail(`Generated sections without sources: ${emptySourceSections.join(', ')}`);
  if (!validateResult.ok) fail(`validate-site.js failed:\n${validateResult.text}`);
  if (factCheck.status === 'NEEDS_FIX' && factCheck.must_fix.length > 0) {
    fail('Gemini fact checker returned NEEDS_FIX with must_fix items. Artifacts were written for review.');
  }

  console.log(`Gemini newsroom newsletter generated for ${date}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
