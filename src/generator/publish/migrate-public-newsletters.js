'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { trackedFiles } = require('../../shared/tooling/tracked-files');
const { buildHtml, buildMarkdown } = require('../render/newsletter-renderer');
const { applyTranslation, translationSourceHash } = require('../render/apply-translation');
const { planArticleTags } = require('../render/archive-article-tags');
const { hash, snapshot, preservation, preserveAnchors, recoverDaily, difference, legacyWeeklyView, publishedSourceLists, validatePublishedProjection } = require('../render/archive-publication');

const SOURCE_FILE = 'publication-source.json';
const ISSUE_KEY = /^\d{4}-(?:W(?:0[1-9]|[1-4][0-9]|5[0-3])|\d{2}-\d{2})$/;
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (root, file) => JSON.parse(read(root, file));

function inventory(root) {
  const weekly = json(root, 'articles/data/newsletters-weekly.json');
  const dated = json(root, 'articles/data/newsletters.json');
  return trackedFiles(root).filter(file => /^articles\/(?:en\/)?newsletters\/[^/]+\/index\.html$/.test(file)).sort().map(file => {
    const key = file.split('/').at(-2);
    const locale = file.startsWith('articles/en/') ? 'en' : 'ko';
    const weeklyKey = key.includes('-W');
    const sourcePath = `articles/newsletters/${key}/issue.json`;
    const overlayPath = `articles/newsletters/${key}/translation.en.json`;
    const source = fs.existsSync(path.join(root, sourcePath)) ? read(root, sourcePath) : null;
    const issue = source ? JSON.parse(source) : null;
    const saved = fs.existsSync(path.join(root, `articles/newsletters/${key}/${SOURCE_FILE}`));
    const html = read(root, file);
    const snap = snapshot(html);
    const entry = (weeklyKey ? weekly : dated).find(item => (weeklyKey ? item.weeklyKey : item.date) === key);
    let translation = 'not_applicable';
    if (weeklyKey) {
      if (!fs.existsSync(path.join(root, overlayPath))) translation = 'missing';
      else {
        try { applyTranslation(issue, json(root, overlayPath), { sourceText: source }); translation = 'valid'; }
        catch (error) { translation = error.message; }
      }
    }
    return { key, locale, file, role: key === '2026-W42' ? 'regression' :
      (!weeklyKey && key > '2026-10-12' ? 'post_issue_scope' : 'candidate'),
    input: issue ? (issue.public_contract_version || 'legacy-json-unversioned') : saved ? 'published-projection' : 'published-html-markdown',
    sourcePath: issue ? sourcePath : `articles/newsletters/${key}/${SOURCE_FILE}`,
    publishedDate: issue?.date || key, coverage: issue ? Object.fromEntries(Object.entries(issue).filter(([name]) => name.startsWith('coverage_'))) : { mode: 'unverified' },
    indexListed: Boolean(entry), homepageArchiveListed: weeklyKey && Boolean(entry), translation,
    sourceHash: hash(html), markdownHash: hash(read(root, file.replace('index.html', 'newsletter.md'))),
    issueHash: source ? translationSourceHash(source) : null, ...snap };
  });
}

// Compare public Markdown article prose independently of the HTML projection. Old Markdown can
// contain lists/code absent from HTML; preserving HTML alone must never silently delete that data.
function markdownUnits(markdown) {
  const start = markdown.search(/^## [2-9]\d*\. /m);
  if (start < 0) throw new Error('Missing Markdown articles');
  return markdown.slice(start).split(/\n\s*\n/).map(block => block.trim())
    .filter(block => block && block !== '---' && !/^<a id="[^"]+"[^>]*><\/a>$/.test(block) &&
      !/^### Camera HAL\/Driver (?:관점에서의 의미|perspective: what it means)$/.test(block) &&
      !/^\[(?:이번 주 핵심으로|이 호의 핵심으로|목차로 돌아가기|Back to|Contents)/.test(block))
    .map(block => block.replace(/^#{2,3} (?:\d+\. )?/, '').replace(/^\*\*(.*?)\*\*$/, '$1').replace(/!\[[^\]]*\]\(((?:\.\.\/)+assets\/images\/fallback\/[^)]+)\)/g, '![]($1)').replace(/\s+/g, ' ').trim());
}

function planPage(root, page) {
  const { key, locale, file } = page;
  const oldHtml = read(root, file);
  const markdownPath = file.replace('index.html', 'newsletter.md');
  const oldMarkdown = read(root, markdownPath);
  const dir = `articles/newsletters/${key}`;
  const inputs = [{ path: file, hash: hash(oldHtml) }, { path: markdownPath, hash: hash(oldMarkdown) }];
  let issue;
  let archive;
  const outputs = [];
  if (fs.existsSync(path.join(root, `${dir}/issue.json`))) {
    const sourceText = read(root, `${dir}/issue.json`);
    inputs.push({ path: `${dir}/issue.json`, hash: hash(sourceText) });
    issue = JSON.parse(sourceText);
    if (locale === 'en') {
      const translationText = read(root, `${dir}/translation.en.json`);
      inputs.push({ path: `${dir}/translation.en.json`, hash: hash(translationText) });
      issue = applyTranslation(issue, JSON.parse(translationText), { sourceText });
    }
    archive = legacyWeeklyView(issue);
    if (page.role !== 'regression') archive = { ...archive, sourceLists: publishedSourceLists(oldHtml) };
  } else {
    if (locale !== 'ko') throw new Error('Daily English recovery is out of scope');
    const sourcePath = `${dir}/${SOURCE_FILE}`;
    if (fs.existsSync(path.join(root, sourcePath))) {
      const text = read(root, sourcePath);
      inputs.push({ path: sourcePath, hash: hash(text) });
      archive = validatePublishedProjection(JSON.parse(text), key);
    } else {
      archive = recoverDaily(oldHtml, oldMarkdown, { htmlPath: file, markdownPath, date: key });
      outputs.push({ path: sourcePath, before: null, after: `${JSON.stringify(archive, null, 2)}\n` });
    }
    issue = archive.issue;
  }
  let html = preserveAnchors(oldHtml, buildHtml(issue, { locale, archive }));
  // Candidate output is canonicalized locally; regression controls retain renderer byte parity.
  if (page.role !== 'regression') html = html.replace(/[\t ]+$/gm, '');
  let markdown = buildMarkdown(issue, { locale, archive });
  const markdownIds = [...oldMarkdown.matchAll(/<a id="([^"]+)"[^>]*><\/a>/g)].map(match => match[1]);
  const missingMarkdownIds = markdownIds.filter(id => !markdown.includes(`<a id="${id}">`));
  if (missingMarkdownIds.length) {
    if (missingMarkdownIds.some(id => !/^[a-zA-Z0-9_-]+$/.test(id))) throw new Error('Unsupported Markdown anchor');
    markdown = markdown.replace(/^## 1\./m, `${missingMarkdownIds.sort().map(id => `<a id="${id}"></a>`).join('\n\n')}\n\n## 1.`);
  }
  const check = preservation(oldHtml, html);
  const markdownDelta = difference(markdownUnits(oldMarkdown), markdownUnits(markdown));
  if (markdownDelta.removed.length) check.errors.push(`Markdown content removed: ${markdownDelta.removed.length}`);
  check.ok = check.errors.length === 0;
  outputs.push({ path: file, before: oldHtml, after: html }, { path: markdownPath, before: oldMarkdown, after: markdown });
  return { key, locale, classification: archive?.daily ? 'published-recovery' : archive || page.input === 'legacy-json-unversioned' ? 'legacy-json-compatible' : 'direct-render',
    status: check.ok ? 'ready' : 'blocked', errors: check.errors, inputs, preservation: check.delta, markdownDelta,
    contentEdits: check.delta.articles.flatMap((article, index) => article.prose.added.map(text => ({ article: index + 1, addedPublicText: text,
      ...(archive?.articles?.[index]?.blocks?.some(block => block.origin === 'published-markdown') ? { basis: 'same-article-published-markdown', source: markdownPath } : {}) }))), outputs };
}

function applyPlans(root, plans) {
  if (plans.some(plan => plan.status === 'blocked')) return false;
  for (const plan of plans) {
    for (const input of plan.inputs) {
      if (hash(read(root, input.path)) !== input.hash) throw new Error(`Input changed: ${input.path}`);
    }
    for (const output of plan.outputs.filter(output => output.before === null)) {
      if (fs.existsSync(path.join(root, output.path))) throw new Error(`Output appeared: ${output.path}`);
    }
  }
  const written = [];
  try {
    for (const plan of plans) {
      for (const output of plan.outputs) {
        if (output.before === output.after) continue;
        fs.writeFileSync(path.join(root, output.path), output.after, 'utf8');
        written.push(output);
      }
    }
  } catch (error) {
    for (const output of written.reverse()) {
      if (output.before === null) fs.unlinkSync(path.join(root, output.path));
      else fs.writeFileSync(path.join(root, output.path), output.before, 'utf8');
    }
    throw error;
  }
  for (const plan of plans) plan.status = 'written';
  return true;
}

function migrate({ root = process.cwd(), keys = [], locales = ['ko', 'en'], write = false, tagsOnly = false, allTags = false } = {}) {
  if (!keys.length && write && !allTags) throw new Error('Writing requires explicit --issue selection');
  if (allTags && keys.length) throw new Error('--all-tags cannot be combined with --issue');
  if (keys.some(key => !ISSUE_KEY.test(key))) throw new Error('Invalid issue selection');
  if (!locales.length || locales.some(locale => !['ko', 'en'].includes(locale))) throw new Error('Invalid locale selection');
  const pages = inventory(root);
  if (allTags) { tagsOnly = true; keys = [...new Set(pages.map(page => page.key))]; }
  const base = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
  const selected = keys.length ? pages.filter(page => keys.includes(page.key) && locales.includes(page.locale)) : [];
  for (const key of keys) {
    if (!selected.some(page => page.key === key)) throw new Error(`No selected public page: ${key}`);
  }
  const plans = selected.map(page => {
    try { return tagsOnly ? planArticleTags(root, page) : planPage(root, page); }
    catch (error) { return { key: page.key, locale: page.locale, status: 'blocked', errors: [error.message], outputs: [] }; }
  });
  const blocked = plans.some(plan => plan.status === 'blocked');
  // Preflight every selected page and source before the first mutation. A failed member prevents
  // a partial Korean/English batch, and stale inputs cannot overwrite concurrent edits.
  if (write && !blocked) {
    applyPlans(root, plans);
  }
  return { schemaVersion: 1, base,
    mode: write ? 'write' : 'dry-run', operation: tagsOnly ? 'article-tags-only' : 'page-migration', blocked,
    counts: { total: pages.length, candidates: pages.filter(page => page.role === 'candidate').length,
      regression: pages.filter(page => page.role === 'regression').length, postIssueScope: pages.filter(page => page.role === 'post_issue_scope').length },
    inventory: pages, plans: plans.map(({ outputs, ...plan }) => ({ ...plan, files: outputs.map(output => ({ path: output.path,
      beforeHash: output.before === null ? null : hash(output.before), afterHash: hash(output.after), changed: output.before !== output.after,
      // Text is included only for changed files, so dry-run output is a complete reviewable proposal.
      ...(output.before !== output.after ? { before: output.before, after: output.after } : {}) })) })) };
}

function main(argv = process.argv.slice(2)) {
  const keys = [];
  let locales = ['ko', 'en'];
  let write = false;
  let tagsOnly = false;
  let allTags = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--issue' && argv[i + 1]) keys.push(...argv[++i].split(','));
    else if (argv[i] === '--locale' && argv[i + 1]) locales = argv[++i].split(',');
    else if (argv[i] === '--write') write = true;
    else if (argv[i] === '--tags-only') tagsOnly = true;
    else if (argv[i] === '--all-tags') allTags = true;
    else if (argv[i] !== '--dry-run' && argv[i] !== '--inventory') throw new Error(`Unknown argument: ${argv[i]}`);
  }
  const result = migrate({ keys, locales, write, tagsOnly, allTags });
  console.log(JSON.stringify(result, null, 2));
  if (result.blocked) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { inventory, markdownUnits, planPage, applyPlans, migrate, main };
