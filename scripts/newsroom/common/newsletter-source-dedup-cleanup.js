const { ensureArray } = require('./value-coercion');
const {
  normalizeMergeText,
  readerSafeText,
  publicArticleIsUsable,
  readerParagraph,
  readerTextArray,
  firstReaderText,
  sentenceLead
} = require('./reader-text');
const fs = require('fs');
const path = require('path');

const {
  readJson,
  repoPath,
  writeJson
} = require('./common');
const {
  normalizeHalSignalFields
} = require('./hal-signal-quality');
const {
  publicArticleForSection
} = require('./public-article-contract');
const {
  buildHtml,
  buildMarkdown,
  issueTags
} = require('../render/newsletter-renderer');
const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown
} = require('../validate/newsletter-quality');
const {
  auditHistoricalArchive
} = require('../validate/historical-archive');
const {
  LEDGER_PATH: AUDIT_LEDGER_PATH,
  INVENTORY_PATH: AUDIT_INVENTORY_PATH
} = require('./audit-paths');
const {
  isReleaseVersionAnchor,
  normalizeNewsSourceKey
} = require('./source-url-key');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DRY_RUN_REPORT = '.tmp/codex/source-dedup-cleanup-plan.json';
const DEFAULT_POST_RUN_REPORT = '.tmp/codex/source-dedup-cleanup-post-run.json';
const DEFAULT_EXPECTED_EXPOSED_DATES = Object.freeze([
  '2026-05-05',
  '2026-05-07',
  '2026-05-11',
  '2026-05-12',
  '2026-05-15',
  '2026-05-20',
  '2026-05-21',
  '2026-05-22'
]);
const REMOVED_ROUTE_NOTE = 'source_dedup_cleanup_removed_public_route';
const FALLBACK_PUBLIC_NOTICE = Object.freeze([
  'Tooling Watch Edition',
  '이번 호는 Camera HAL / Driver / Android multimedia 직접 후보가 부족하여 Android native tooling / build/test/debug workflow 중심의 참고 issue로 발행되었습니다.',
  'Camera pipeline, Android native 성능, build/test/debug workflow 관점에서 참고 가능한 항목만 선별했으며 정상 Camera HAL issue로 간주하지 않습니다.'
]);
const REVIEW_PUBLIC_NOTICE = Object.freeze([
  '검토 발행본입니다.',
  '각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.'
]);

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPosix(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function unique(values = []) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const parsed = typeof value === 'string' ? value.trim() : value;
    const key = typeof parsed === 'string' ? parsed.toLowerCase() : JSON.stringify(parsed);
    if (!parsed || seen.has(key)) continue;
    seen.add(key);
    output.push(parsed);
  }
  return output;
}

function listDateDirs(root, relDir) {
  const dir = path.join(root, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && DATE_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort();
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(value).replace(/[ \t]+$/gm, ''), 'utf8');
}

function sourceUrlsForSection(section = {}) {
  const sourceUrls = uniqueSourcesByUrl(section.sources).map(source => source?.url).filter(Boolean);
  if (sourceUrls.length > 0) return unique(sourceUrls);
  return uniqueSourcesByUrl(section.public_article?.source_links).map(source => source?.url).filter(Boolean);
}

function sourceDedupeKey(source = {}) {
  const normalized = normalizeNewsSourceKey(source?.url || '');
  return normalized.key || text(source?.url).toLowerCase();
}

function uniqueSourcesByUrl(sources = []) {
  const seen = new Set();
  const output = [];
  for (const source of ensureArray(sources)) {
    if (!source?.url) continue;
    const key = sourceDedupeKey(source);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(source);
  }
  return output;
}

function sourceLinksForSection(section = {}) {
  return uniqueSourcesByUrl(section.sources)
    .filter(source => source?.url)
    .map(source => ({
      title: source.title || source.url,
      url: source.url,
      publisher: source.publisher || source.source || '',
      source_role: source.source_role || 'primary',
      checked_at: source.checked_at || ''
    }))
    .map(source => Object.fromEntries(Object.entries(source).filter(([, value]) => text(value))));
}

function collectArticleRecords({ root = process.cwd(), indexedDates = new Set() } = {}) {
  const newsroomDates = listDateDirs(root, path.join('content', 'newsroom'));
  const records = [];
  const parseWarnings = [];
  for (const date of newsroomDates) {
    const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
    if (!fs.existsSync(editorPath)) continue;
    const issue = readJson(editorPath);
    ensureArray(issue.sections).forEach((section, index) => {
      const normalizedSources = sourceUrlsForSection(section)
        .map(url => {
          const normalized = normalizeNewsSourceKey(url);
          parseWarnings.push(...normalized.warnings.map(warning => ({
            ...warning,
            date,
            section_index: index + 1,
            headline: section.headline || section.category || ''
          })));
          return normalized;
        })
        .filter(item => item.key);
      records.push({
        id: `${date}#${index + 1}`,
        date,
        section_index: index + 1,
        indexed: indexedDates.has(date),
        headline: section.headline || section.category || '',
        source_keys: unique(normalizedSources.map(item => item.key)),
        source_details: normalizedSources,
        section
      });
    });
  }
  return { records, parseWarnings };
}

function buildGroups(records = []) {
  const groups = new Map();
  for (const record of records) {
    for (const key of record.source_keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
  }
  return groups;
}

function compareRecordForSurvivor(left, right) {
  const byDate = String(right.date).localeCompare(String(left.date));
  if (byDate) return byDate;
  return left.section_index - right.section_index;
}

function sortedDates(values) {
  return [...new Set(values)].filter(Boolean).sort();
}

function sameDateSet(left = [], right = []) {
  const l = sortedDates(left);
  const r = sortedDates(right);
  return l.length === r.length && l.every((value, index) => value === r[index]);
}

function publicArtifactPathsForDate(date) {
  return [
    `newsletters/${date}`,
    `content/newsroom/${date}`,
    `content/collected-news/${date}`
  ];
}

function removedPathsForDates(root, dates = []) {
  const output = [];
  for (const date of sortedDates(dates)) {
    for (const relPath of publicArtifactPathsForDate(date)) {
      if (fs.existsSync(path.join(root, relPath))) output.push(relPath);
    }
  }
  const rewriteDir = path.join(root, 'content', 'audit', 'historical-rewrite-diff');
  if (fs.existsSync(rewriteDir)) {
    for (const entry of fs.readdirSync(rewriteDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const date = entry.name.slice(0, 10);
      if (dates.includes(date)) output.push(`content/audit/historical-rewrite-diff/${entry.name}`);
    }
  }
  return output.sort();
}

function buildCleanupPlan({
  root = process.cwd(),
  expectedExposedDates = DEFAULT_EXPECTED_EXPOSED_DATES
} = {}) {
  const newsletterItems = readJson(path.join(root, 'data', 'newsletters.json'));
  if (!Array.isArray(newsletterItems)) throw new Error('data/newsletters.json must contain an array');
  const indexedDates = new Set(newsletterItems.map(item => String(item?.date || '')).filter(date => DATE_PATTERN.test(date)));
  const { records, parseWarnings } = collectArticleRecords({ root, indexedDates });
  const recordsById = new Map(records.map(record => [record.id, record]));
  const groups = buildGroups(records);
  const duplicateGroups = [];
  const survivorByKey = new Map();
  const errors = [];

  for (const [sourceKey, groupRecords] of groups.entries()) {
    if (groupRecords.length < 2) continue;
    const parseFailed = groupRecords.some(record => record.source_details.some(source => source.key === sourceKey && source.parse_failed));
    if (parseFailed) {
      errors.push(`Parse-failed URL is part of duplicate group: ${sourceKey}`);
    }
    const indexedCandidates = groupRecords.filter(record => record.indexed);
    if (indexedCandidates.length === 0) {
      errors.push(`Duplicate source group has no indexed survivor candidate: ${sourceKey}`);
      continue;
    }
    const survivor = [...indexedCandidates].sort(compareRecordForSurvivor)[0];
    survivorByKey.set(sourceKey, survivor);
    duplicateGroups.push({
      source_key: sourceKey,
      survivor: {
        id: survivor.id,
        date: survivor.date,
        section_index: survivor.section_index,
        headline: survivor.headline
      },
      donors: groupRecords
        .filter(record => record.id !== survivor.id)
        .map(record => ({
          id: record.id,
          date: record.date,
          section_index: record.section_index,
          indexed: record.indexed,
          headline: record.headline
        })),
      records: groupRecords.map(record => ({
        id: record.id,
        date: record.date,
        section_index: record.section_index,
        indexed: record.indexed,
        headline: record.headline
      }))
    });
  }

  const duplicateKeys = new Set(duplicateGroups.map(group => group.source_key));
  const keepRecordIds = new Set();
  const donorRecordsBySurvivor = new Map();
  for (const record of records) {
    const duplicateRecordKeys = record.source_keys.filter(key => duplicateKeys.has(key));
    if (duplicateRecordKeys.length === 0 && record.indexed) {
      keepRecordIds.add(record.id);
      continue;
    }
    if (duplicateRecordKeys.some(key => survivorByKey.get(key)?.id === record.id)) {
      keepRecordIds.add(record.id);
    }
  }

  for (const group of duplicateGroups) {
    const survivor = recordsById.get(group.survivor.id);
    if (!survivor || !keepRecordIds.has(survivor.id)) {
      errors.push(`Survivor candidate would be removed: ${group.survivor.id}`);
      continue;
    }
    const current = donorRecordsBySurvivor.get(survivor.id) || [];
    for (const donor of group.donors) {
      const donorRecord = recordsById.get(donor.id);
      if (donorRecord) current.push({ source_key: group.source_key, record: donorRecord });
    }
    donorRecordsBySurvivor.set(survivor.id, current);
  }

  const finalIndexedDates = sortedDates([...indexedDates].filter(date =>
    records.some(record => record.date === date && keepRecordIds.has(record.id))
  ));
  const zeroArticleIssues = sortedDates([...indexedDates].filter(date => !finalIndexedDates.includes(date)));
  const allArtifactDates = sortedDates([
    ...listDateDirs(root, 'newsletters'),
    ...listDateDirs(root, path.join('content', 'newsroom')),
    ...listDateDirs(root, path.join('content', 'collected-news'))
  ]);
  const removedArtifactDates = sortedDates(allArtifactDates.filter(date => !finalIndexedDates.includes(date)));
  if (!sameDateSet(finalIndexedDates, expectedExposedDates)) {
    errors.push(`Final exposed date set mismatch. Expected ${expectedExposedDates.join(', ')}, found ${finalIndexedDates.join(', ')}`);
  }

  return {
    schema_version: 1,
    mode: 'dry_run',
    expected_exposed_dates: sortedDates(expectedExposedDates),
    final_exposed_dates: finalIndexedDates,
    duplicate_groups: duplicateGroups,
    duplicate_group_count: duplicateGroups.length,
    parse_warnings: parseWarnings,
    zero_article_issues: zeroArticleIssues,
    removed_indexed_dates: zeroArticleIssues,
    removed_artifact_dates: removedArtifactDates,
    removed_paths: removedPathsForDates(root, removedArtifactDates),
    errors,
    ok: errors.length === 0,
    internal: {
      records,
      keepRecordIds,
      donorRecordsBySurvivor
    }
  };
}

function mergeStringArray(baseValue, donorValue) {
  return unique([
    ...ensureArray(baseValue).map(normalizeMergeText),
    ...ensureArray(donorValue).map(normalizeMergeText)
  ]);
}

function mergeTextField(baseValue, donorValue) {
  const merged = mergeStringArray([baseValue], [donorValue]);
  return merged.join(' ');
}

function donorSourceUrl(donorRecord, sourceKey = '') {
  const matchingSource = sourcesMatchingKey(donorRecord.section.sources, sourceKey)[0];
  return matchingSource?.url || sourceUrlsForSection(donorRecord.section)[0] || '';
}

function hasSourceBinding(donorRecord, sourceKey = '') {
  return Boolean(donorSourceUrl(donorRecord, sourceKey));
}

function mergeArticleSections(base = {}, donor = {}) {
  const output = { ...base };
  output.verified_facts = mergeStringArray(base.verified_facts, donor.verified_facts);
  output.background_context = mergeTextField(base.background_context, donor.background_context);
  output.hal_driver_impact = mergeTextField(base.hal_driver_impact, donor.hal_driver_impact);
  output.action_items = mergeStringArray(base.action_items, donor.action_items);
  output.team_share_points = mergeTextField(base.team_share_points, donor.team_share_points);
  output.known_limitations = mergeStringArray(base.known_limitations, donor.known_limitations);
  output.watch_items = mergeStringArray(base.watch_items, donor.watch_items);
  output.do_not_claim = mergeStringArray(base.do_not_claim, donor.do_not_claim);
  return output;
}

function sourcesMatchingKey(sources = [], sourceKey = '') {
  return ensureArray(sources).filter(source => {
    const normalized = normalizeNewsSourceKey(source?.url || '');
    return normalized.key === sourceKey;
  });
}

function mergeDonorIntoSection(section, donorRecord, sourceKey) {
  const donor = donorRecord.section;
  const donorUrl = donorSourceUrl(donorRecord, sourceKey);
  const sourceBound = hasSourceBinding(donorRecord, sourceKey);
  const provenance = ensureArray(section.source_dedup_merge_provenance);
  provenance.push({
    merged_from_date: donorRecord.date,
    merged_from_section: donorRecord.section_index,
    merged_from_headline: donorRecord.headline,
    merged_from_source_url: donorUrl,
    source_key: sourceKey,
    merge_reason: 'duplicate_news_source_structured_merge'
  });
  section.source_dedup_merge_provenance = provenance;

  section.confirmed_facts = mergeStringArray(section.confirmed_facts, donor.confirmed_facts);
  section.what_changed = mergeTextField(section.what_changed, donor.what_changed);
  section.background = mergeTextField(section.background, donor.background);
  section.article_sections = mergeArticleSections(section.article_sections || {}, donor.article_sections || {});

  if (sourceBound) {
    section.camera_hal_perspective = mergeTextField(section.camera_hal_perspective, donor.camera_hal_perspective);
    section.camera_hal_checks = mergeStringArray(section.camera_hal_checks, donor.camera_hal_checks);
    section.action_items = mergeStringArray(section.action_items, donor.action_items);
  }

  const mergedSources = unique([
    ...ensureArray(section.sources),
    ...sourcesMatchingKey(donor.sources, sourceKey)
  ].filter(source => source?.url).map(source => JSON.stringify(source))).map(item => JSON.parse(item));
  section.sources = uniqueSourcesByUrl(mergedSources);
  return section;
}

function ensureHalSignalCapsule(section) {
  if (section.hal_signal_capsule && typeof section.hal_signal_capsule === 'object') return section;
  const normalized = normalizeHalSignalFields(section);
  const impactAxes = normalized.hal_impact_axes.filter(axis => axis !== 'unknown');
  const readerOwners = normalized.reader_owners.filter(owner => owner !== 'unknown_owner');
  section.hal_signal_capsule = {
    why_now: text(section.what_changed || section.evidence_summary || section.headline),
    reader_owners: readerOwners.length > 0 ? readerOwners : ['camera_hal_owner'],
    check_within_2_weeks: ensureArray(section.action_items)[0] ||
      'Review source-bound camera validation impact within 2 weeks.',
    impact_axes: impactAxes.length > 0 ? impactAxes : ['reference_only'],
    do_not_overstate: ensureArray(normalized.do_not_overstate).length > 0
      ? normalized.do_not_overstate
      : ['Do not claim direct Camera HAL API changes without downstream evidence.']
  };
  return section;
}

function publicParagraphsForSection(section, publicHeadline) {
  const articleSections = section.article_sections || {};
  const background = readerParagraph(articleSections.background_context) || readerParagraph(section.background);
  const impact = readerParagraph(articleSections.hal_driver_impact) || readerParagraph(section.camera_hal_perspective);
  const paragraphs = mergeStringArray([background, impact], [])
    .filter(item => !/발행 전에|출처 URL|게시일|follow-up validation 필요 여부/i.test(item))
    .slice(0, 2);
  while (paragraphs.length < 2) {
    paragraphs.push(`${publicHeadline}은 공개 출처가 제공한 범위 안에서 Camera HAL / Android camera 독자가 참고할 만한 변경과 점검 포인트로 정리했습니다.`);
  }
  return paragraphs.slice(0, 2);
}

function publicCheckpointsForSection(section) {
  const articleSections = section.article_sections || {};
  const actions = mergeStringArray([
    ...readerTextArray(section.action_items),
    ...readerTextArray(articleSections.action_items),
    ...readerTextArray(section.camera_hal_checks)
  ], [])
    .filter(item => !/발행 전에|출처 URL|게시일|follow-up validation 필요 여부|직접 HAL 동작 주장|참고 맥락|다음 issue에서 재평가|upstream release note/i.test(item))
    .slice(0, 4);
  if (actions.length > 0) return actions;
  return sectionIsFallback(section)
    ? ['Native build, test, debug workflow에서 제품 camera path에 실제로 연결되는 항목만 추적합니다.']
    : ['관련 owner가 기존 compatibility, regression, log 확인 범위 안에서 필요한 점검만 표시합니다.'];
}

function briefingSnippet(value, maxLength = 160) {
  const normalized = readerSafeText(value);
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength).replace(/\s+\S*$/u, '').trim();
  return clipped ? `${clipped}...` : normalized;
}

function briefingSentence(value, { maxChars = 260, maxSentences = 2 } = {}) {
  return readerParagraph(value, { maxChars, maxSentences })
    .replace(/\s+/g, ' ')
    .trim();
}

function checkpointFocus(value) {
  const normalized = readerSafeText(value)
    .replace(/[.。]+$/u, '')
    .trim();
  return normalized
    .replace(/등록하지 않습니다$/u, '등록하지 않는 것')
    .replace(/([A-Za-z가-힣]+)합니다$/u, '$1하는 것')
    .trim();
}

function combinedBriefingContext(articles = []) {
  const checkpoints = articles
    .map(article => checkpointFocus(ensureArray(article.reader_checkpoints)[0]))
    .filter(Boolean);
  if (checkpoints.length >= 2) {
    return `첫 번째 기사는 ${briefingSnippet(checkpoints[0], 120)}, 두 번째 기사는 ${briefingSnippet(checkpoints[1], 120)}부터 보면 실제 적용 범위를 판단하기 쉽습니다.`;
  }
  if (checkpoints.length === 1) {
    return `${briefingSnippet(checkpoints[0], 180)}부터 보면 기사 내용을 실제 검증 작업으로 옮기기 쉽습니다.`;
  }
  const takeaways = articles
    .map(article => briefingSentence(article.camera_hal_takeaway, { maxChars: 130, maxSentences: 1 }))
    .filter(Boolean);
  if (takeaways.length > 0) {
    return briefingSentence(takeaways.join(' '), { maxChars: 260, maxSentences: 2 });
  }
  const backgrounds = articles
    .flatMap(article => ensureArray(article.body_paragraphs))
    .map(paragraph => briefingSentence(paragraph, { maxChars: 130, maxSentences: 1 }))
    .filter(Boolean);
  return briefingSentence(backgrounds.join(' '), { maxChars: 260, maxSentences: 2 });
}

function rebuildPublicArticle(section) {
  const headline = text(section.headline || section.category || 'Camera HAL 관련 source');
  const publicHeadline = headline
    .replace(/\bTooling Watch\s*\/\s*Fallback:?\s*/gi, 'Tooling Watch: ')
    .replace(/\bTooling Watch\s*\/\s*Watch:?\s*/gi, 'Tooling Watch: ')
    .replace(/\bFallback\b/gi, 'Watch')
    .trim();
  const sourceLinks = sourceLinksForSection(section);
  if (publicArticleIsUsable(section.public_article)) {
    section.public_article = {
      ...section.public_article,
      headline: publicHeadline,
      source_links: sourceLinks.length > 0 ? sourceLinks : ensureArray(section.public_article.source_links)
    };
    return section;
  }
  const primarySource = sourceLinks[0]?.title || sourceLinks[0]?.url || '공개 source';
  const leadFallback = `${primarySource}는 ${publicHeadline} 관련 내용을 공개했습니다. Camera HAL / Android camera 독자는 이 내용을 실제 제품 경로와 연결되는지 확인할 참고 신호로 읽어야 합니다.`;
  const lead = sentenceLead(firstReaderText([
    section.background,
    section.article_sections?.background_context,
    section.what_changed,
    section.article_sections?.verified_facts
  ]), leadFallback);
  const perspective = firstReaderText([
    section.article_sections?.hal_driver_impact,
    section.camera_hal_perspective
  ]) || (sectionIsFallback(section)
    ? '직접 HAL 변경으로 단정하지 않고, native build/test/debug workflow에 줄 수 있는 간접 신호로만 봅니다.'
    : 'Camera HAL / Driver owner는 공개 출처가 직접 말한 범위 안에서 stream, buffer, metadata, pipeline 검증 필요성을 확인합니다.');
  section.public_article = {
    headline: publicHeadline,
    lead,
    body_paragraphs: publicParagraphsForSection(section, publicHeadline),
    camera_hal_takeaway: readerParagraph(perspective, { maxChars: 520, maxSentences: 2 }),
    reader_checkpoints: publicCheckpointsForSection(section),
    source_links: sourceLinks
  };
  return section;
}

function sectionIsFallback(section = {}) {
  const bucket = text(section.relevance_bucket || section.final_relevance_bucket).toLowerCase();
  return section.counts_as_fallback_topic === true ||
    ['cpp_ai_tooling_fallback', 'generic_tech_watchlist'].includes(bucket);
}

function sectionIsCameraAnchor(section = {}) {
  if (sectionIsFallback(section)) return false;
  if (section.counts_as_primary_camera_topic === true) return true;
  const bucket = text(section.relevance_bucket || section.final_relevance_bucket).toLowerCase();
  return [
    'direct_aosp_camera',
    'camera_driver_image_pipeline',
    'android_platform_camera_adjacent',
    'android_multimedia_camera_output',
    'soc_platform_signal'
  ].includes(bucket);
}

function generateBriefing(sections = []) {
  const articles = sections.map(section => publicArticleForSection(section));
  const leadArticles = articles.length >= 2 ? articles.slice(0, 2) : articles;
  const primaryBullets = leadArticles
    .map(article => briefingSentence(article.lead, { maxChars: 260, maxSentences: 2 }))
    .filter(Boolean);
  if (articles.length >= 2) {
    const remainingLeads = articles.slice(2)
      .map(article => briefingSentence(article.lead, { maxChars: 140, maxSentences: 1 }))
      .filter(Boolean);
    if (remainingLeads.length > 0) {
      primaryBullets.push(briefingSentence(remainingLeads.join(' '), { maxChars: 280, maxSentences: 3 }));
    }
    const context = combinedBriefingContext(articles);
    if (context) primaryBullets.push(context);
  } else {
    for (const article of articles) {
      const takeaway = briefingSentence(article.camera_hal_takeaway, { maxChars: 260, maxSentences: 2 });
      if (takeaway) primaryBullets.push(takeaway);
      const context = combinedBriefingContext([article]);
      if (context) primaryBullets.push(context);
    }
  }
  const bullets = [];
  for (const item of primaryBullets) {
    if (bullets.some(existing => existing.toLowerCase() === item.toLowerCase())) continue;
    bullets.push(item);
    if (bullets.length >= 3) break;
  }
  while (bullets.length < 3) bullets.push('Camera HAL / Android camera 독자가 확인할 변경 범위와 확인 포인트를 정리했습니다.');
  return bullets.slice(0, 3);
}

function generateSummary(date, sections = []) {
  const headlines = sections.map(section => publicArticleForSection(section).headline).filter(Boolean);
  if (headlines.length === 0) {
    return `이번 ${date}호는 공개할 main article이 없습니다.`;
  }
  return `이번 ${date}호는 ${headlines.length}개 기사(${headlines.join(', ')})를 Camera HAL / Android camera 개발자가 확인할 변경 범위와 확인 포인트 중심으로 정리했습니다.`;
}

function issueIndexEntry(issue) {
  return {
    date: issue.date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${issue.date}/index.html`,
    md: `newsletters/${issue.date}/newsletter.md`,
    tags: issueTags(issue),
    publication_mode: issue.publication_mode || 'review_only',
    homepage_visibility: issue.homepage_visibility || 'normal',
    fallback_only: issue.fallback_only === true,
    camera_anchor_count: Number.isFinite(Number(issue.camera_anchor_count)) ? Number(issue.camera_anchor_count) : 0,
    ...(issue.homepage_badge ? { homepage_badge: issue.homepage_badge } : {})
  };
}

function updateQualityReport(root, date, issue) {
  const factCheck = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'));
  if (!factCheck) return null;
  const reporter = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json')) || {};
  const shortlistReport = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json')) || null;
  const staleClaimReport = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'stale-claim-report.json')) || null;
  const previous = readJsonIfExists(path.join(root, 'content', 'newsroom', date, 'quality-report.json')) || {};
  const threshold = Number.isFinite(Number(previous.threshold)) ? Number(previous.threshold) : 85;
  const report = buildNewsletterQualityReport(date, issue, reporter, factCheck, {
    threshold,
    shortlistReport,
    staleClaimReport
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), report);
  writeText(path.join(root, 'content', 'newsroom', date, 'quality-report.md'), buildQualityReportMarkdown(report));
  return report;
}

function updatedIssueForDate(root, date, plan) {
  const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
  const original = readJson(editorPath);
  const records = plan.internal.records
    .filter(record => record.date === date && plan.internal.keepRecordIds.has(record.id))
    .sort((left, right) => left.section_index - right.section_index);
  const sections = records.map(record => {
    const section = cloneJson(record.section);
    const donors = ensureArray(plan.internal.donorRecordsBySurvivor.get(record.id));
    const seenDonors = new Set();
    for (const donor of donors) {
      const key = `${donor.source_key}|${donor.record.id}`;
      if (seenDonors.has(key)) continue;
      seenDonors.add(key);
      mergeDonorIntoSection(section, donor.record, donor.source_key);
    }
    ensureHalSignalCapsule(section);
    rebuildPublicArticle(section);
    return section;
  });
  const fallbackSectionCount = sections.filter(sectionIsFallback).length;
  const cameraAnchorCount = sections.filter(sectionIsCameraAnchor).length;
  const fallbackOnly = sections.length > 0 && cameraAnchorCount === 0;
  const publicationFields = fallbackOnly
    ? {
        publication_mode: 'fallback_public',
        homepage_visibility: 'visible_with_fallback_badge',
        normal_public_ready: false,
        automatic_publish_ready: false,
        public_artifact_ready: true,
        fallback_public_ready: true,
        homepage_badge: 'Tooling Watch Edition',
        publication_notice: [...FALLBACK_PUBLIC_NOTICE]
      }
    : {
        publication_mode: original.publication_mode || 'review_only',
        homepage_visibility: original.homepage_visibility === 'visible_with_fallback_badge'
          ? 'normal'
          : (original.homepage_visibility || 'normal'),
        fallback_public_ready: false,
        fallback_only: false,
        homepage_badge: '',
        publication_notice: [...REVIEW_PUBLIC_NOTICE]
      };
  return {
    ...original,
    ...publicationFields,
    summary: generateSummary(date, sections),
    briefing: generateBriefing(sections),
    sections,
    references: uniqueSourcesByUrl(sections.flatMap(section => ensureArray(section.sources)))
      .filter(source => source?.url)
      .map(source => ({
        title: source.title || source.url,
        url: source.url
      })),
    camera_anchor_count: cameraAnchorCount,
    fallback_section_count: fallbackSectionCount,
    fallback_only: fallbackOnly
  };
}

function safeRemovePath(root, relPath, deletedPaths) {
  const target = repoPath(root, relPath);
  if (!target) throw new Error(`Refusing to remove path outside repository: ${relPath}`);
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside repository: ${relPath}`);
  }
  if (!fs.existsSync(resolvedTarget)) return;
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
  deletedPaths.push(toPosix(relPath));
}

function updateSidecar(root, removedDates) {
  const sidecarPath = path.join(root, 'content', 'audit', 'historical-archive-status.json');
  if (!fs.existsSync(sidecarPath)) return [];
  const entries = readJson(sidecarPath);
  const removed = new Set(removedDates);
  const changed = [];
  const next = ensureArray(entries).map(entry => {
    if (!removed.has(entry?.date)) return entry;
    changed.push(entry.date);
    return {
      date: entry.date,
      archive_status: 'removed',
      historical_cleanup_reviewed: true,
      known_limitations: unique([
        ...ensureArray(entry.known_limitations),
        'duplicate_news_source_cleanup',
        'removed_archive_entry',
        'public_route_intentionally_removed'
      ]),
      historical_cleanup_context: 'source_dedup_cleanup',
      public_visibility: 'removed',
      removal_reason: REMOVED_ROUTE_NOTE
    };
  });
  writeJson(sidecarPath, next);
  return changed;
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function slugifyArticleText(value) {
  return stripHtml(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rewriteDiffSlug(relPath = '') {
  const match = toPosix(relPath).match(/^content\/audit\/historical-rewrite-diff\/(\d{4}-\d{2}-\d{2})-([a-z0-9][a-z0-9-]*)\.md$/);
  return match ? { date: match[1], slug: match[2] } : null;
}

function keptArticleSlugsByDate(root, dates = []) {
  const output = new Map();
  for (const date of dates) {
    const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
    if (!fs.existsSync(editorPath)) continue;
    const issue = readJson(editorPath);
    output.set(date, new Set(ensureArray(issue.sections)
      .map(section => publicArticleForSection(section).headline || section.headline || section.category)
      .map(slugifyArticleText)
      .filter(Boolean)));
  }
  return output;
}

function pruneRewriteDiffsForKeptDates(root, finalDates, deletedPaths) {
  const sidecarPath = path.join(root, 'content', 'audit', 'historical-archive-status.json');
  const diffDir = path.join(root, 'content', 'audit', 'historical-rewrite-diff');
  if (!fs.existsSync(sidecarPath) || !fs.existsSync(diffDir)) return;
  const finalDateSet = new Set(finalDates);
  const keptSlugs = keptArticleSlugsByDate(root, finalDates);
  const entries = readJson(sidecarPath);
  let changed = false;
  const next = ensureArray(entries).map(entry => {
    if (!finalDateSet.has(entry?.date)) return entry;
    const currentPaths = unique([
      ...ensureArray(entry.material_rewrite_diffs),
      ...(entry.material_rewrite_diff ? [entry.material_rewrite_diff] : [])
    ]);
    if (currentPaths.length === 0) return entry;
    const allowedSlugs = keptSlugs.get(entry.date) || new Set();
    const keptPaths = [];
    for (const relPath of currentPaths) {
      const parsed = rewriteDiffSlug(relPath);
      const keep = parsed && parsed.date === entry.date && allowedSlugs.has(parsed.slug);
      if (keep) {
        keptPaths.push(relPath);
      } else if (fs.existsSync(path.join(root, relPath))) {
        safeRemovePath(root, relPath, deletedPaths);
      }
    }
    if (keptPaths.length === currentPaths.length) return entry;
    changed = true;
    if (keptPaths.length === 0) {
      const {
        material_rewrite_diff: _materialRewriteDiff,
        material_rewrite_diffs: _materialRewriteDiffs,
        rewrite_status: _rewriteStatus,
        ...rest
      } = entry;
      return rest;
    }
    return {
      ...entry,
      rewrite_status: 'material_rewrite',
      material_rewrite_diff: keptPaths[0],
      material_rewrite_diffs: keptPaths
    };
  });
  if (changed) writeJson(sidecarPath, next);
}

function updateLedger(root, removedDates) {
  const ledgerPath = path.join(root, AUDIT_LEDGER_PATH);
  if (!fs.existsSync(ledgerPath)) return;
  const removed = new Set(removedDates);
  const lines = fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/);
  const next = lines.map(line => {
    const match = line.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
    if (!match || !removed.has(match[1])) return line;
    const date = match[1];
    return `| ${date} | source_dedup_cleanup | duplicate News Source cleanup removed this public route after merging source-backed structured content into the survivor indexed issue | no | removed_archive | removed | removed | source_dedup_cleanup |`;
  });
  writeText(ledgerPath, `${next.join('\n').replace(/\s+$/u, '')}\n`);
}

function updateInventory(root, removedDates) {
  const inventoryPath = path.join(root, AUDIT_INVENTORY_PATH);
  if (!fs.existsSync(inventoryPath)) return;
  const removed = new Set(removedDates);
  const lines = fs.readFileSync(inventoryPath, 'utf8').split(/\r?\n/);
  const output = [];
  const emitted = new Set();
  for (const line of lines) {
    let nextLine = line
      .replace(/Includes article-level rows for the 13 current public artifact dates in `newsletters\/YYYY-MM-DD\/newsletter\.md`\./,
        'Includes article-level rows for public artifact dates retained after source dedup cleanup.')
      .replace(/Article heading count was recalculated from public `newsletter\.md` files during this expansion: 40 article rows plus 1 removed summary row\./,
        'Article heading count is maintained by cleanup scripts; removed duplicate-source dates are represented by summary rows.');
    const match = nextLine.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
    if (match && removed.has(match[1])) {
      const date = match[1];
      if (emitted.has(date)) continue;
      emitted.add(date);
      nextLine = `| ${date} | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |`;
    }
    output.push(nextLine);
  }
  writeText(inventoryPath, `${output.join('\n').replace(/\s+$/u, '')}\n`);
}

function removeRewriteDiffs(root, removedDates, deletedPaths) {
  const dir = path.join(root, 'content', 'audit', 'historical-rewrite-diff');
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const date = entry.name.slice(0, 10);
    if (!removedDates.includes(date)) continue;
    safeRemovePath(root, path.join('content', 'audit', 'historical-rewrite-diff', entry.name), deletedPaths);
  }
}

function applyCleanupPlan({
  root = process.cwd(),
  expectedExposedDates = DEFAULT_EXPECTED_EXPOSED_DATES,
  dryRunReportPath = DEFAULT_DRY_RUN_REPORT,
  postRunReportPath = DEFAULT_POST_RUN_REPORT
} = {}) {
  const plan = buildCleanupPlan({ root, expectedExposedDates });
  const reportForDisk = { ...plan };
  delete reportForDisk.internal;
  writeJson(path.join(root, dryRunReportPath), reportForDisk);
  if (!plan.ok) {
    throw new Error(`Dry-run cleanup plan failed:\n${plan.errors.join('\n')}`);
  }

  const changedIssues = [];
  const finalDates = plan.final_exposed_dates;
  const nextIndex = [];
  for (const date of finalDates) {
    const issue = updatedIssueForDate(root, date, plan);
    const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
    writeJson(editorPath, issue);
    writeText(path.join(root, 'content', 'newsroom', date, 'editor-draft.md'), buildMarkdown(issue));
    writeText(path.join(root, 'newsletters', date, 'newsletter.md'), buildMarkdown(issue));
    writeText(path.join(root, 'newsletters', date, 'index.html'), buildHtml(issue));
    updateQualityReport(root, date, issue);
    nextIndex.push(issueIndexEntry(issue));
    changedIssues.push(date);
  }
  nextIndex.sort((left, right) => String(right.date).localeCompare(String(left.date)));
  writeJson(path.join(root, 'data', 'newsletters.json'), nextIndex);

  const deletedPaths = [];
  removeRewriteDiffs(root, plan.removed_artifact_dates, deletedPaths);
  for (const relPath of plan.removed_paths) {
    if (relPath.startsWith('content/audit/historical-rewrite-diff/')) continue;
    safeRemovePath(root, relPath, deletedPaths);
  }
  const sidecarChangedDates = updateSidecar(root, plan.removed_artifact_dates);
  updateLedger(root, sidecarChangedDates);
  updateInventory(root, sidecarChangedDates);
  pruneRewriteDiffsForKeptDates(root, finalDates, deletedPaths);
  auditHistoricalArchive({ root, writeReports: true });

  const post = buildPostCleanupReport({
    root,
    dryRunReport: reportForDisk,
    expectedExposedDates
  });
  writeJson(path.join(root, postRunReportPath), post);
  if (!post.ok) {
    throw new Error(`Post-cleanup invariants failed:\n${post.errors.join('\n')}`);
  }
  return {
    dryRunReport: reportForDisk,
    postRunReport: post,
    changedIssues,
    deletedPaths
  };
}

function readDateSetFromIndex(root) {
  const items = readJson(path.join(root, 'data', 'newsletters.json'));
  return sortedDates(ensureArray(items).map(item => item?.date).filter(date => DATE_PATTERN.test(String(date))));
}

function datesWithPublicArtifacts(root) {
  return listDateDirs(root, 'newsletters').filter(date =>
    fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')) &&
    fs.existsSync(path.join(root, 'newsletters', date, 'index.html'))
  );
}

function datesWithEditorDraft(root) {
  return listDateDirs(root, path.join('content', 'newsroom')).filter(date =>
    fs.existsSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'))
  );
}

function exposedDuplicateSourceGroups(root) {
  const indexedDates = new Set(readDateSetFromIndex(root));
  const { records, parseWarnings } = collectArticleRecords({ root, indexedDates });
  const groups = [...buildGroups(records).entries()]
    .filter(([, groupRecords]) => groupRecords.filter(record => record.indexed).length > 1)
    .map(([sourceKey, groupRecords]) => ({
      source_key: sourceKey,
      records: groupRecords.filter(record => record.indexed).map(record => ({
        id: record.id,
        date: record.date,
        headline: record.headline
      }))
    }));
  return { groups, parseWarnings };
}

function removedDateReferences(root, removedDates = []) {
  const existingFiles = [];
  const candidates = ['index.html'];
  for (const file of fs.readdirSync(root)) {
    if (/^(?:sitemap|feed|rss|atom)\.(?:xml|json)$/i.test(file)) candidates.push(file);
  }
  for (const relPath of candidates) {
    const absPath = path.join(root, relPath);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue;
    const textValue = fs.readFileSync(absPath, 'utf8');
    for (const date of removedDates) {
      if (textValue.includes(`newsletters/${date}`)) existingFiles.push({ date, path: relPath });
    }
  }
  return existingFiles;
}

function archiveStatusByDate(root) {
  const sidecarPath = path.join(root, 'content', 'audit', 'historical-archive-status.json');
  if (!fs.existsSync(sidecarPath)) return new Map();
  return new Map(ensureArray(readJson(sidecarPath)).map(entry => [entry.date, entry]));
}

function sourceDedupRemovedDatesFromSidecar(root) {
  return [...archiveStatusByDate(root).entries()]
    .filter(([, entry]) =>
      entry?.archive_status === 'removed' &&
      entry?.public_visibility === 'removed' &&
      entry?.historical_cleanup_context === 'source_dedup_cleanup'
    )
    .map(([date]) => date)
    .filter(date => DATE_PATTERN.test(String(date)))
    .sort();
}

function generatedAuditEntriesByDate(root) {
  const auditPath = path.join(root, 'content', 'audit', 'historical-newsletter-audit-report.json');
  if (!fs.existsSync(auditPath)) return new Map();
  return new Map(ensureArray(readJson(auditPath).entries).map(entry => [entry.date, entry]));
}

function buildPostCleanupReport({
  root = process.cwd(),
  dryRunReport = null,
  expectedExposedDates = DEFAULT_EXPECTED_EXPOSED_DATES
} = {}) {
  const errors = [];
  const indexDates = readDateSetFromIndex(root);
  const publicDates = datesWithPublicArtifacts(root);
  const editorDates = datesWithEditorDraft(root);
  const collectedDates = listDateDirs(root, path.join('content', 'collected-news'));
  const expectedDates = sortedDates(expectedExposedDates);
  const dryRunRemovedDates = sortedDates(dryRunReport?.removed_artifact_dates || []);
  const removedDates = dryRunRemovedDates.length > 0 ? dryRunRemovedDates : sourceDedupRemovedDatesFromSidecar(root);
  const removedDateSource = dryRunRemovedDates.length > 0 ? 'dry_run_report' : 'source_dedup_sidecar';
  const duplicates = exposedDuplicateSourceGroups(root);
  const sidecar = archiveStatusByDate(root);
  const audit = generatedAuditEntriesByDate(root);
  const deletedPathMismatches = [];
  const orphanCollectedDates = collectedDates.filter(date => !indexDates.includes(date));

  if (!sameDateSet(indexDates, expectedDates)) errors.push(`data/newsletters.json date set mismatch: ${indexDates.join(', ')}`);
  if (!sameDateSet(indexDates, publicDates)) errors.push(`Public artifact date set mismatch: ${publicDates.join(', ')}`);
  if (!sameDateSet(indexDates, editorDates)) errors.push(`Editor draft date set mismatch: ${editorDates.join(', ')}`);
  if (orphanCollectedDates.length > 0) errors.push(`Unindexed collected-news dates remain: ${orphanCollectedDates.join(', ')}`);
  if (duplicates.groups.length > 0) errors.push(`Exposed duplicate source groups remain: ${duplicates.groups.map(group => group.source_key).join(', ')}`);
  for (const date of removedDates) {
    if (indexDates.includes(date)) errors.push(`Removed date remains in data/newsletters.json: ${date}`);
    if (publicDates.includes(date)) errors.push(`Removed date still has public artifact: ${date}`);
    if (editorDates.includes(date)) errors.push(`Removed date still has editor draft: ${date}`);
    if (collectedDates.includes(date)) errors.push(`Removed date still has collected-news artifact: ${date}`);
    const entry = sidecar.get(date);
    if (entry && (entry.archive_status !== 'removed' || entry.public_visibility !== 'removed')) {
      errors.push(`Removed sidecar state mismatch for ${date}`);
    }
    const auditEntry = audit.get(date);
    if (auditEntry && (auditEntry.archive_status !== 'removed' || auditEntry.public_visibility !== 'removed')) {
      errors.push(`Removed audit state mismatch for ${date}`);
    }
  }
  for (const relPath of ensureArray(dryRunReport?.removed_paths)) {
    if (fs.existsSync(path.join(root, relPath))) deletedPathMismatches.push(relPath);
  }
  if (deletedPathMismatches.length > 0) {
    errors.push(`Dry-run removed_paths still exist: ${deletedPathMismatches.join(', ')}`);
  }
  const routeReferences = removedDateReferences(root, removedDates);
  if (routeReferences.length > 0) {
    errors.push(`Removed date route references remain: ${routeReferences.map(item => `${item.path}:${item.date}`).join(', ')}`);
  }

  return {
    schema_version: 1,
    mode: 'post_cleanup',
    expected_exposed_dates: expectedDates,
    data_newsletters_dates: indexDates,
    public_artifact_dates: publicDates,
    editor_draft_dates: editorDates,
    collected_news_dates: collectedDates,
    removed_dates: removedDates,
    removed_date_source: removedDateSource,
    duplicate_groups: duplicates.groups,
    parse_warnings: duplicates.parseWarnings,
    orphan_collected_news_dates: orphanCollectedDates,
    deleted_path_mismatches: deletedPathMismatches,
    route_references: routeReferences,
    errors,
    ok: errors.length === 0
  };
}

module.exports = {
  DEFAULT_DRY_RUN_REPORT,
  DEFAULT_EXPECTED_EXPOSED_DATES,
  DEFAULT_POST_RUN_REPORT,
  applyCleanupPlan,
  buildCleanupPlan,
  buildPostCleanupReport,
  mergeDonorIntoSection,
  normalizeNewsSourceKey,
  isReleaseVersionAnchor
};
