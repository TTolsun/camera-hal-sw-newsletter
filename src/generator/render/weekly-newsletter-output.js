'use strict';

// Additive weekly newsletter output (#486 PR2) with same-week upsert (#488), within-week duplicate
// detection and LLM merge (#489), and merged-article validation (#490). On a publish-ready run the
// orchestrator calls this to accumulate the run's articles into the matching ISO-week newsletter:
// load the existing weekly issue, resolve each incoming article against the week (append / LLM merge /
// reject, with merged articles validated before they replace existing ones), apply the weekly limits
// (#492), regenerate the weekly directory page, and upsert the separate data/newsletters-weekly.json.
// Daily output and data/newsletters.json are never touched. Without an injected LLM merge resolver
// this falls back to the deterministic behavior (skip exact duplicates, keep the rest).
//
// Weekly artifacts are written DURING generation, but the deterministic image repair
// (newsroom:repair-images) rewrites the daily editor draft AFTER generation. The exact-duplicate
// reject above means a re-run cannot carry the repaired image into the weekly issue, so the repair
// step calls syncWeeklyArticleImages to converge the weekly section image fields and the weekly
// index article_images to the repaired daily state.

const { ensureArray } = require('../../shared/common/value-coercion');
const fs = require('fs');
const path = require('path');

const { buildWeeklyNewsletterPage } = require('./weekly-newsletter-page');
const { weeklyTopicTags } = require('./newsletter-renderer');
const { writeSitemap } = require('./generate-sitemap');
const { weeklyKeyForDate } = require('../reporter/weekly-newsletter');
const { applyWeeklyArticleLimits } = require('../reporter/weekly-article-limits');
const { resolveWeeklyArticles, sectionIdentity } = require('../reporter/weekly-duplicate-merge');
const { indexContractVersionField } = require('../../shared/common/story-contract-version');

// Browser-safe (https) image for a weekly article section, used to show one article image on the
// homepage Latest card. Returns '' when the section has no usable https image.
function sectionBrowserImage(section = {}) {
  const candidate = (section.resolvedImage && (section.resolvedImage.url || section.resolvedImage.src)) ||
    section.selectedImage || '';
  return /^https:\/\//i.test(String(candidate)) ? String(candidate) : '';
}

// '../../assets/images/fallback/android.svg' -> 'assets/images/fallback/android.svg'.
// 홈페이지(사이트 루트)에서 그대로 쓸 수 있는 fallback 자산 경로만 반환하고, 그 외 로컬 경로는
// 이미지 fallback 계약에 따라 방출하지 않는다.
function normalizedFallbackImagePath(section = {}) {
  const candidate = (section.resolvedImage && (section.resolvedImage.url || section.resolvedImage.src)) ||
    section.selectedImage || '';
  const normalized = String(candidate).replace(/^(?:\.\.\/)+/, '');
  return normalized.startsWith('assets/images/fallback/') ? normalized : '';
}

// Distinct https article images for the issue, in section order. The Latest card picks the first one
// that does not match the homepage headline image (see index.html), so order/dedup are preserved.
// When no https image exists in the whole issue, one site-root-relative fallback asset path is
// emitted instead so the Latest card always has an image to show.
function weeklyArticleImages(sections = []) {
  const seen = new Set();
  const images = [];
  for (const section of ensureArray(sections)) {
    const image = sectionBrowserImage(section);
    if (image && !seen.has(image)) {
      seen.add(image);
      images.push(image);
    }
  }
  if (images.length === 0) {
    for (const section of ensureArray(sections)) {
      const fallback = normalizedFallbackImagePath(section);
      if (fallback) return [fallback];
    }
  }
  return images;
}

function loadExistingWeeklyIssue(root, weeklyKey) {
  const issuePath = path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json');
  if (!fs.existsSync(issuePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(issuePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function dedupeReferences(references) {
  const seen = new Set();
  const result = [];
  for (const reference of ensureArray(references)) {
    const url = String(reference && reference.url || '').trim();
    const key = url || JSON.stringify(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reference);
  }
  return result;
}

function weeklyIndexPath(root) {
  return path.join(root, 'articles', 'data', 'newsletters-weekly.json');
}

function readWeeklyIndex(dataPath) {
  if (!fs.existsSync(dataPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function weeklyIndexEntry(root, weeklyKey) {
  return readWeeklyIndex(weeklyIndexPath(root)).find(item => item && item.weeklyKey === weeklyKey) || null;
}

function upsertWeeklyIndex(root, entry) {
  const relPath = 'articles/data/newsletters-weekly.json';
  const dataPath = weeklyIndexPath(root);
  const updated = readWeeklyIndex(dataPath)
    .filter(item => item && item.weeklyKey !== entry.weeklyKey)
    .concat(entry)
    .sort((a, b) => String(b.weeklyKey || '').localeCompare(String(a.weeklyKey || '')));
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  // #51: 주간 발행 목록이 바뀌면 sitemap.xml을 같은 흐름에서 재생성한다. sitemap.xml은
  // publish PR commit allowlist에 포함되어 newsletters-weekly.json과 함께 main으로 반영된다.
  writeSitemap(root);
  return relPath;
}

// repair(applySelectedCandidate)가 daily editor-draft 섹션에 기록하는 이미지 필드 집합.
// weekly 동기화는 정확히 이 projection만 복사해 콘텐츠 병합 없이 이미지 상태만 수렴시킨다.
const SECTION_IMAGE_FIELDS = [
  'selectedImage',
  'imageSource',
  'imageAttribution',
  'imageAlt',
  'imageLicenseStatus',
  'imageUsageDecisionReason',
  'imageSelection',
  'resolvedImage'
];

function sectionImageProjection(section = {}) {
  const projection = {};
  for (const field of SECTION_IMAGE_FIELDS) {
    if (section[field] !== undefined) projection[field] = section[field];
  }
  return projection;
}

// Converge the weekly issue of `date`'s ISO week to the daily editor-draft image state. The weekly
// upsert rejects same-identity articles as exact duplicates, so the post-generation image repair
// cannot reach the weekly through a re-run; this targeted sync copies only the image fields of
// identity-matched sections, regenerates the weekly page, and refreshes article_images in
// data/newsletters-weekly.json (entries are never created here; sitemap is untouched).
// LLM 병합으로 identity가 바뀐 weekly 섹션은 매칭되지 않아 그대로 유지된다.
function syncWeeklyArticleImages({ root = process.cwd(), date, sections } = {}) {
  const weeklyKey = weeklyKeyForDate(date);
  const result = { weeklyKey, synced: false, patchedSectionCount: 0, articleImagesUpdated: false, files: [] };
  const issue = loadExistingWeeklyIssue(root, weeklyKey);
  if (!issue) return { ...result, reason: 'missing_weekly_issue' };
  const dailySections = ensureArray(sections).filter(Boolean);
  if (dailySections.length === 0) return { ...result, reason: 'missing_daily_sections' };

  const dailyByIdentity = new Map(
    dailySections.map(dailySection => [sectionIdentity(dailySection), dailySection])
  );
  for (const weeklySection of ensureArray(issue.sections)) {
    const dailySection = dailyByIdentity.get(sectionIdentity(weeklySection));
    if (!dailySection) continue;
    // 다운그레이드 가드: daily 섹션이 실제 https 이미지로 해석될 때만 weekly를 덮어쓴다.
    // (같은 주 다른 날짜의 미수리 fallback 상태가 이미 바인딩된 weekly 이미지를 지우지 않게)
    if (!sectionBrowserImage(dailySection)) continue;
    const projection = sectionImageProjection(dailySection);
    if (JSON.stringify(sectionImageProjection(weeklySection)) === JSON.stringify(projection)) continue;
    Object.assign(weeklySection, JSON.parse(JSON.stringify(projection)));
    result.patchedSectionCount += 1;
  }

  let currentSections = ensureArray(issue.sections);
  if (result.patchedSectionCount > 0) {
    const page = buildWeeklyNewsletterPage(issue, { weeklyKey });
    const dir = path.join(root, 'articles', 'newsletters', weeklyKey);
    fs.writeFileSync(path.join(dir, 'index.html'), page.html, 'utf8');
    fs.writeFileSync(path.join(dir, 'newsletter.md'), page.markdown, 'utf8');
    fs.writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(page.issue, null, 2)}\n`, 'utf8');
    currentSections = ensureArray(page.issue.sections);
    // result.files는 changedArtifacts에 쓰이는 디스크-상대 경로(articles/ 아래)다.
    result.files.push(
      `articles/newsletters/${weeklyKey}/index.html`,
      `articles/newsletters/${weeklyKey}/newsletter.md`,
      `articles/newsletters/${weeklyKey}/issue.json`
    );
  }

  const articleImages = weeklyArticleImages(currentSections);
  const dataPath = weeklyIndexPath(root);
  const index = readWeeklyIndex(dataPath);
  const entry = index.find(item => item && item.weeklyKey === weeklyKey);
  if (entry && JSON.stringify(ensureArray(entry.article_images)) !== JSON.stringify(articleImages)) {
    entry.article_images = articleImages;
    fs.writeFileSync(dataPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    result.articleImagesUpdated = true;
    result.files.push('articles/data/newsletters-weekly.json');
  }

  result.synced = true;
  return result;
}

async function writeWeeklyNewsletterArtifacts({ root = process.cwd(), date, editor, tags = [], mergeDuplicate, validateMerged } = {}) {
  const weeklyKey = weeklyKeyForDate(date);
  const existingIssue = loadExistingWeeklyIssue(root, weeklyKey);
  const existingSections = existingIssue ? ensureArray(existingIssue.sections) : [];

  const resolved = await resolveWeeklyArticles({
    existingArticles: existingSections,
    incomingArticles: ensureArray(editor && editor.sections),
    mergeDuplicate,
    validateMerged
  });
  const { articles } = applyWeeklyArticleLimits({ existing: resolved.existingArticles, incoming: resolved.appendedArticles });

  // 아카이브/홈 카드의 주제 분류·kicker 는 위클리 tags 로 결정된다. 이슈 레벨 editor.tags(대개
  // ['Camera HAL','Android'] 기본값이라 분류가 단조롭고 Driver/Image Processing/AI/SoC Platform
  // 필터가 비어 버린다) 대신, 그 주 기사(section)들의 relevance bucket 을 topic 태그로 집계한다.
  const mergedTags = weeklyTopicTags(articles);

  const mergedDraft = {
    ...editor,
    sections: articles,
    references: dedupeReferences([
      ...ensureArray(existingIssue && existingIssue.references),
      ...ensureArray(editor && editor.references)
    ])
  };
  const page = buildWeeklyNewsletterPage(mergedDraft, { date });
  page.issue.tags = mergedTags;

  // 홈·아카이브가 fetch하는 정본은 이 weekly 인덱스다. daily 인덱스와 같은 판정을 써서
  // 계약 버전을 기록한다(보존·미지원 거부·강등 거부, v1은 기본값이라 생략).
  //
  // 이 판정은 거부하면 throw한다. 그래서 페이지 파일을 쓰기 **전에** 부른다 — 쓴 뒤에
  // 부르면 거부된 실행이 index.html·newsletter.md·issue.json 은 새로 덮어쓴 채 인덱스
  // 엔트리만 옛 값으로 남겨, 공개 정본과 아티팩트가 어긋난 상태로 끝난다.
  const contractVersionField = indexContractVersionField(page.weeklyKey, page.issue, weeklyIndexEntry(root, page.weeklyKey));

  const dir = path.join(root, 'articles', 'newsletters', weeklyKey);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page.html, 'utf8');
  fs.writeFileSync(path.join(dir, 'newsletter.md'), page.markdown, 'utf8');
  fs.writeFileSync(path.join(dir, 'issue.json'), `${JSON.stringify(page.issue, null, 2)}\n`, 'utf8');

  const indexFile = upsertWeeklyIndex(root, {
    weeklyKey: page.weeklyKey,
    weekStartDate: page.weekStartDate,
    weekEndDate: page.weekEndDate,
    date: page.weekStartDate,
    // Card title is the bare ISO week ("2026-W23" -> "2026 W23"); the week date range
    // moves to the card date badge (weekStartDate/weekEndDate) so it is not duplicated here.
    title: String(page.weeklyKey).replace('-W', ' W'),
    // The card lists this week's article titles, one per line (newline-joined), so each title
    // stays distinguishable. page.issue.briefing is the title list.
    summary: (Array.isArray(page.issue.briefing) && page.issue.briefing.length
      ? page.issue.briefing.join('\n')
      : String(editor && editor.summary || (existingIssue && existingIssue.summary) || '')),
    html: page.indexRoute,
    md: page.markdownRoute,
    tags: mergedTags,
    article_count: articles.length,
    // Distinct https article images (section order) so the homepage Latest card can show one
    // article image that is not the headline image.
    article_images: weeklyArticleImages(page.issue.sections),
    ...contractVersionField
  });

  return {
    weeklyKey: page.weeklyKey,
    weeklyArticleCount: articles.length,
    addedArticleCount: resolved.appendedArticles.length,
    mergeWarnings: resolved.warnings,
    mergeDecisions: resolved.decisions,
    files: [
      // changedArtifacts에 쓰이는 디스크-상대 경로(articles/ 아래).
      `articles/newsletters/${weeklyKey}/index.html`,
      `articles/newsletters/${weeklyKey}/newsletter.md`,
      `articles/newsletters/${weeklyKey}/issue.json`,
      indexFile
    ]
  };
}

module.exports = { syncWeeklyArticleImages, writeWeeklyNewsletterArtifacts };
