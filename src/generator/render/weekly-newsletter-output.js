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
const { coverageForAnchorDate } = require('../../shared/common/coverage-week');

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

async function writeWeeklyNewsletterArtifacts({
  root = process.cwd(),
  date,
  editor,
  mergeDuplicate,
  validateMerged,
  coverageWeekKeyOverride
} = {}) {
  const weeklyKey = weeklyKeyForDate(date);
  const existingIssue = loadExistingWeeklyIssue(root, weeklyKey);
  const existingSections = existingIssue ? ensureArray(existingIssue.sections) : [];

  // 이번 실행의 대상 주(coverage)를 이 시점에 한 번 정하고, 이미 이 위클리 이슈에 실린
  // 대상 주와 어긋나면 그 자리에서 멈춘다. weekly coverage backfill(phase 2, 별도 PR로
  // 이미 라이브에 반영됨) 이후에는 라이브의 모든 위클리 이슈가 coverage_week_key를 갖고
  // 있어야 하므로, 그 값이 없거나 이번 실행이 계산한 값과 다르면 같은 identity 주
  // (weeklyKey) 안에 서로 다른 대상 주의 기사가 섞인다는 뜻이다 — 페이지 파일을 쓰기
  // **전에** throw해 절반만 갱신된 상태를 막는다(indexContractVersionField의
  // "쓰기 전 throw" 선례와 같은 자리).
  const coverage = coverageForAnchorDate(date, coverageWeekKeyOverride);
  if (existingIssue) {
    const existingCoverageWeekKey = existingIssue.coverage_week_key;
    if (!existingCoverageWeekKey) {
      throw new Error(`missing coverage_week_key on existing issue ${weeklyKey}`);
    }
    if (existingCoverageWeekKey !== coverage.coverage_week_key) {
      throw new Error(`weekly coverage mismatch: existing=${existingCoverageWeekKey} incoming=${coverage.coverage_week_key}`);
    }
  }

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

  // coverage(대상 주) 5필드: 새 draft(editor)가 가진 값을 우선하고, 없으면 기존 이슈에 이미
  // 실린 값을 보존하며(pass-through), 그마저 없으면 이 함수가 방금 계산한 coverage로 채운다.
  // 그래야 coverage 필드가 없는 draft로 같은 주를 재-upsert해도(과거호, 전환 전 실행 등) 앞서
  // 실린 coverage 표시가 지워지지 않고, 처음 쓰는 주는 계산값으로 바로 채워진다.
  const computedCoverageFields = {
    coverage_week_key: coverage.coverage_week_key,
    coverage_start_date: coverage.coverage_start_date,
    coverage_end_date: coverage.coverage_end_date,
    coverage_mode: 'iso_week',
    generation_anchor_date: date
  };
  const coverageCarryFields = {};
  for (const field of ['coverage_week_key', 'coverage_start_date', 'coverage_end_date', 'coverage_mode', 'generation_anchor_date']) {
    const value = (editor && editor[field]) || (existingIssue && existingIssue[field]) || computedCoverageFields[field];
    if (value) coverageCarryFields[field] = value;
  }

  const mergedDraft = {
    ...editor,
    sections: articles,
    // 병합된 위클리 tags 를 렌더 **전에** draft 에 넣는다. 렌더 후 page.issue.tags 를 덮어쓰면
    // index.html(병합 전 editor tags)과 issue.json(병합 tags)이 서로 다른 tag 집합으로 커밋되어
    // issue.json 재렌더가 발행 페이지를 재현하지 못한다(2026-W30~W33에서 실측).
    tags: mergedTags,
    references: dedupeReferences([
      ...ensureArray(existingIssue && existingIssue.references),
      ...ensureArray(editor && editor.references)
    ]),
    ...coverageCarryFields
  };
  const page = buildWeeklyNewsletterPage(mergedDraft, { date });

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
    ...contractVersionField,
    // issue.json과 동일한 pass-through: 있으면 index entry에도 싣는다(홈·아카이브가 fetch하는
    // 정본은 이 index이기 때문에 여기 없으면 coverage 표시를 만들 수 없다).
    ...coverageCarryFields
  });

  return {
    weeklyKey: page.weeklyKey,
    weeklyArticleCount: articles.length,
    addedArticleCount: resolved.appendedArticles.length,
    mergeWarnings: resolved.warnings,
    mergeDecisions: resolved.decisions,
    // 이 주의 최종 기사 목록(merge·dedupe·limit 이후). 심층 발동 판정이 "위클리 최종 기사
    // 기준"이려면 호출자가 이 목록을 그대로 받아야 한다 — 여기서 부가 기능을 실행하면
    // 그 실패가 공개 산출물 기록보다 앞서 버린다.
    articles,
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
