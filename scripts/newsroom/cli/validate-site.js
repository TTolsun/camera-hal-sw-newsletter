const fs = require('fs');
const path = require('path');
const {
  readJson,
  repoPath
} = require('../common/common');
const {
  newsroomDir
} = require('../common/artifact-paths');
const {
  articlePolicy,
  articleCountRangeText
} = require('../common/newsletter-policy');
const {
  HEADLINE_STATE_REL_PATH,
  validateHomepageHeadlineState
} = require('../common/homepage-headline');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../common/validation-targets');
const {
  validateRenderedIssueStructure
} = require('../validate/rendered-issue-structure');
const {
  buildRemediationMessage,
  latestDiagnosticsOnly,
  validateRetentionMetadata
} = require('../common/public-state-reconciliation');

const root = process.cwd();
const dataPath = path.join(root, 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const requiredFields = ['date', 'title', 'summary', 'html', 'md', 'tags'];
const briefingHeadings = [
  '## 1. 이번 주 3줄 브리핑'
];
const legacySectionHeadings = [
  '## 2. AOSP Camera Watch',
  '## 3. Tech Trend Radar',
  '## 4. 이번 주 C++ / AI 실전 팁'
];
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return readJson(filePath);
  } catch (error) {
    warn(`Could not parse ${path.relative(root, filePath)} for quality warnings: ${error.message}`);
    return null;
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTruthy(value) {
  return value === true || value === 'true';
}

function countValue(value) {
  const parsed = finiteNumber(value);
  return parsed === null ? 0 : parsed;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedCategory(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizedStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function factCheckSourceGapCount(factCheck) {
  if (Number.isFinite(Number(factCheck?.source_gap_count))) return Number(factCheck.source_gap_count);
  return ensureArray(factCheck?.source_gaps).length;
}

function blockingDeductionCategories(quality) {
  const metricsCategories = ensureArray(quality?.metrics?.blocking_deduction_categories)
    .map(normalizedCategory)
    .filter(Boolean);
  if (metricsCategories.length > 0) return [...new Set(metricsCategories)];

  return [...new Set(ensureArray(quality?.deductions)
    .filter(deduction => deduction?.blocking === true)
    .map(deduction => normalizedCategory(deduction?.category))
    .filter(Boolean))];
}

function hasCompositionOnlyBlocker(quality) {
  const categories = blockingDeductionCategories(quality);
  if (categories.length !== 1 || categories[0] !== 'composition') return false;

  const blockingCount = finiteNumber(quality?.metrics?.blocking_deduction_count);
  if (blockingCount !== null) return blockingCount > 0;

  return ensureArray(quality?.deductions).some(deduction =>
    deduction?.blocking === true && normalizedCategory(deduction?.category) === 'composition'
  );
}

function reviewPublicationExceptionFor(date, articleCount) {
  const dir = newsroomDir(root, date);
  const status = readJsonIfExists(path.join(dir, 'generation-status.json'));
  const quality = readJsonIfExists(path.join(dir, 'quality-report.json'));
  const factCheck = readJsonIfExists(path.join(dir, 'fact-check-report.json'));
  const staleClaim = readJsonIfExists(path.join(dir, 'stale-claim-report.json'));
  const reason =
    status?.review_publication_ready_reason ||
    status?.editor_review_reason ||
    quality?.review_publication_ready_reason ||
    quality?.editor_review_reason ||
    status?.fallback_public_issue_reason ||
    quality?.fallback_public_issue_reason;
  const qualityArticleCount = finiteNumber(quality?.metrics?.article_count);
  const approved =
    status?.review_publication_ready === true &&
    status?.final_publish_ready === false &&
    status?.editor_review_required === true &&
    status?.public_newsletter_ready === true &&
    status?.homepage_visible_after_merge === true &&
    nonEmptyString(reason) &&
    normalizedStatus(quality?.status) === 'NEEDS_FIX' &&
    hasCompositionOnlyBlocker(quality) &&
    (qualityArticleCount === null || qualityArticleCount === articleCount) &&
    countValue(quality?.metrics?.source_integrity_violation_count) === 0 &&
    countValue(quality?.metrics?.must_fix_count) === 0 &&
    countValue(quality?.metrics?.source_gap_count) === 0 &&
    normalizedStatus(quality?.metrics?.stale_claim_status) !== 'NEEDS_FIX' &&
    countValue(quality?.metrics?.stale_claim_hard_failure_count) === 0 &&
    normalizedStatus(factCheck?.status) !== 'NEEDS_FIX' &&
    ensureArray(factCheck?.must_fix).length === 0 &&
    factCheckSourceGapCount(factCheck) === 0 &&
    normalizedStatus(staleClaim?.status) !== 'NEEDS_FIX' &&
    ensureArray(staleClaim?.hard_failures).length === 0;
  if (!approved) return null;
  return reason.trim();
}

function sectionText(content, heading, nextHeadingPattern = /^## /m) {
  const start = content.indexOf(heading);
  if (start === -1) return '';
  const afterHeading = content.slice(start + heading.length);
  const next = afterHeading.search(nextHeadingPattern);
  return next === -1 ? afterHeading : afterHeading.slice(0, next);
}

function hasAny(content, values) {
  return values.some(value => content.includes(value));
}

function textFromHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function publicationNoticeText(html) {
  const match = String(html || '').match(/<[^>]+class=["'][^"']*\bpublication-notice\b[^>]*>[\s\S]*?<\/(?:div|section|aside)>/i);
  return match ? textFromHtml(match[0]) : '';
}

function sameOrderedValues(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function issueTagsFromHtml(html) {
  const tagRowMatch = html.match(/<div\b[^>]*class=["'][^"']*\bissue-tags\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (!tagRowMatch) return null;
  return [...tagRowMatch[1].matchAll(/<span\b[^>]*class=["'][^"']*\btag\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map(match => textFromHtml(match[1]))
    .filter(Boolean);
}

function validateNewsletterHtmlTags(item, html, strictArtifactValidation) {
  const actualTags = issueTagsFromHtml(html);
  const expectedTags = ensureArray(item.tags).map(tag => String(tag));
  const message = actualTags === null
    ? `Newsletter ${item.date} HTML missing issue tag row for data/newsletters.json tags: ${expectedTags.join(', ') || 'none'}.`
    : `Newsletter ${item.date} HTML issue tags [${actualTags.join(', ') || 'none'}] do not match data/newsletters.json tags [${expectedTags.join(', ') || 'none'}].`;

  if (actualTags !== null && sameOrderedValues(actualTags, expectedTags)) return;
  if (strictArtifactValidation) {
    fail(message);
  }
}

function isFallbackPublicIssue(item, status = {}) {
  return item?.publication_mode === 'fallback_public' || status?.publication_mode === 'fallback_public';
}

function validatePublicationModeInvariants(item, status = {}) {
  const publicationMode = item.publication_mode || status.publication_mode || '';
  const homepageVisibility = item.homepage_visibility || status.homepage_visibility || 'normal';
  const cameraAnchorCount = finiteNumber(item.camera_anchor_count ?? status.camera_anchor_count);
  if (cameraAnchorCount === 0 && homepageVisibility !== 'hidden') {
    if (publicationMode !== 'fallback_public') {
      fail(`Newsletter ${item.date} with camera_anchor_count=0 must use publication_mode=fallback_public or be hidden.`);
    }
    if (homepageVisibility !== 'visible_with_fallback_badge') {
      fail(`Newsletter ${item.date} fallback-only public issue must use homepage_visibility=visible_with_fallback_badge.`);
    }
  }
  if (publicationMode !== 'fallback_public') return;
  if (homepageVisibility !== 'visible_with_fallback_badge') {
    fail(`Newsletter ${item.date} fallback_public issue must use homepage_visibility=visible_with_fallback_badge.`);
  }
  if (!isTruthy(item.fallback_only ?? status.fallback_only)) {
    fail(`Newsletter ${item.date} fallback_public issue must expose fallback_only=true.`);
  }
  if (cameraAnchorCount !== 0) {
    fail(`Newsletter ${item.date} fallback_public issue must expose camera_anchor_count=0.`);
  }
  if (status.publication_mode === 'fallback_public' && !isTruthy(status.fallback_public_ready)) {
    fail(`Newsletter ${item.date} fallback_public generation status must expose fallback_public_ready=true.`);
  }
}

function validateFallbackPublicPresentation(item, html, markdown, status = {}) {
  if (!isFallbackPublicIssue(item, status)) return;
  const tags = ensureArray(item.tags).map(String);
  const cameraAnchorCount = finiteNumber(item.camera_anchor_count ?? status.camera_anchor_count);
  if (item.homepage_badge !== 'Tooling Watch Edition') {
    fail(`Newsletter ${item.date} fallback_public entry must expose homepage_badge=Tooling Watch Edition.`);
  }
  if (item.homepage_visibility !== 'visible_with_fallback_badge') {
    fail(`Newsletter ${item.date} fallback_public entry must use homepage_visibility=visible_with_fallback_badge.`);
  }
  if (!tags.includes('Tooling Watch Edition')) {
    fail(`Newsletter ${item.date} fallback_public tags must include Tooling Watch Edition.`);
  }
  if (!tags.includes('Tooling Watch')) {
    fail(`Newsletter ${item.date} fallback_public tags must include Tooling Watch.`);
  }
  if (cameraAnchorCount === 0 && tags.includes('Camera HAL')) {
    fail(`Newsletter ${item.date} fallback-only metadata must not expose Camera HAL as a homepage tag.`);
  }
  if (!/Tooling Watch Edition/.test(publicationNoticeText(html))) {
    fail(`Newsletter ${item.date} fallback_public HTML must show a visible Tooling Watch Edition publication notice.`);
  }
  if (!/Tooling Watch Edition/.test(markdown)) {
    fail(`Newsletter ${item.date} fallback_public markdown must disclose Tooling Watch Edition status.`);
  }
}

function siteHeaderExpectedLabels() {
  return ['Latest', 'Archive', 'GitHub'];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSiteHeaderComponent(content) {
  return /<header\b[^>]*\bdata-site-header\b/i.test(content);
}

function expectedSiteHeaderScript(relPath) {
  return relPath === 'index.html'
    ? 'assets/js/site-header.js'
    : '../../assets/js/site-header.js';
}

function hasSiteHeaderScript(content, relPath) {
  const expected = expectedSiteHeaderScript(relPath);
  const pattern = new RegExp(`<script\\b[^>]*\\bsrc=["']${escapeRegex(expected)}["'][^>]*>\\s*</script>`, 'i');
  return pattern.test(content);
}

function validateSiteNavLabels(content, relPath) {
  const siteNavMatch = content.match(/<nav\b[^>]*class=["'][^"']*\bsite-nav\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/i);
  if (!siteNavMatch) {
    if (hasSiteHeaderComponent(content) && !hasSiteHeaderScript(content, relPath)) {
      fail(`Shared site header in ${relPath} must load ${expectedSiteHeaderScript(relPath)}.`);
    }
    return;
  }

  const labels = [...siteNavMatch[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => textFromHtml(match[1]))
    .filter(label => label && !['Camera HAL / SW Newsletter', 'Camera SW / Newsletter', 'Camera SW Newsletter'].includes(label));
  const expected = siteHeaderExpectedLabels();
  const actual = labels.slice(0, expected.length);
  const matchesExpected = actual.length === expected.length &&
    expected.every((label, index) => actual[index] === label);
  if (!matchesExpected) {
    fail(`Site navigation labels must be ${expected.join(' / ')} in ${relPath}; found ${actual.join(' / ') || 'none'}`);
  }
}

function sourceTail(section) {
  const match = section.match(/\*\*(Sources|출처)[^\n]*\*\*([\s\S]*)/);
  return match ? match[2] : section;
}

function hasSourceEntry(section) {
  return /-\s+(?:\[.+?\]\(https?:\/\/|.+?:\s+https?:\/\/)/.test(sourceTail(section));
}

function getBriefingHeading(md) {
  return briefingHeadings.find(heading => md.includes(heading)) || '';
}

function mainArticleBlocks(md) {
  const matches = [...md.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  const blocks = [];
  for (let i = 0; i < matches.length; i += 1) {
    const index = Number(matches[i][1]);
    const title = matches[i][2].trim();
    if (index <= 1) continue;
    if (/Action Items/i.test(title) || title.includes('Action') || title.includes('실행 항목')) continue;
    if (/^References$/i.test(title) || title === '참고자료') continue;

    const start = matches[i].index + matches[i][0].length;
    const nextMatch = matches[i + 1];
    const end = nextMatch ? nextMatch.index : md.length;
    blocks.push({ heading: matches[i][0], title, text: md.slice(start, end) });
  }
  return blocks;
}

function hasEngineeringPerspective(text) {
  return /Camera HAL|HAL|Android Camera|CameraX|AOSP Camera|stream|buffer|metadata|request|result|CTS|VTS|CDD|NPU|GPU|ISP|thermal|latency|성능|검증|호환/.test(text);
}

function isNewFormat(md) {
  return md.includes('## 1. 이번 주 3줄 브리핑') &&
    !legacySectionHeadings.some(heading => md.includes(heading));
}

function validateArticleQuality(item, md, newFormat, strictArtifactValidation) {
  const articles = mainArticleBlocks(md);
  const articleCountOutOfRange = articles.length < articlePolicy.mainArticleCount.min ||
    articles.length > articlePolicy.mainArticleCount.max;
  if (articleCountOutOfRange) {
    const message = `Newsletter ${item.date} main article count is ${articles.length}; expected Newsletter Policy range ${articleCountRangeText()}.`;
    const exceptionReason = articles.length < articlePolicy.mainArticleCount.min
      ? reviewPublicationExceptionFor(item.date, articles.length)
      : null;
    if (strictArtifactValidation && exceptionReason) {
      warn(`${message} review publication exception: ${exceptionReason}.`);
    } else if (strictArtifactValidation) {
      fail(message);
    } else {
      warn(`${message} ${historicalPolicyWarningReason()}.`);
    }
  }

  if (newFormat) {
    if (!/AI|Gemini|agent|on-device|NPU|LLM|인공지능/i.test(md)) {
      warn(`Newsletter ${item.date} has no AI-related article or AI Corner signal.`);
    }
  }

  for (const article of articles) {
    if (!hasAny(article.text, ['Sources', '출처'])) {
      fail(`Newsletter ${item.date} section missing sources heading: ${article.heading}`);
    }
    if (!hasSourceEntry(article.text)) {
      fail(`Newsletter ${item.date} article has no source entries: ${article.heading}`);
    }
    if (newFormat && !hasAny(article.text, ['Action Item', 'Action Items', '확인할 Action Item', '확인해볼 아이템', '실행 항목', '확인할 점'])) {
      warn(`Newsletter ${item.date} article may be missing Action Item content: ${article.heading}`);
    }
    if (newFormat && !hasAny(article.text, ['Camera HAL 관점', 'Camera HAL에서']) && !hasEngineeringPerspective(article.text)) {
      warn(`Newsletter ${item.date} article may be missing Camera HAL perspective: ${article.heading}`);
    }
  }
}

function validateSourceGapArtifact(date, strictArtifactValidation) {
  const factCheck = readJsonIfExists(path.join(newsroomDir(root, date), 'fact-check-report.json'));
  if (!factCheck) return;
  const sourceGapCount = factCheckSourceGapCount(factCheck);
  if (sourceGapCount >= 3) {
    warn(`Newsletter ${date} fact-check source_gap_count is ${sourceGapCount}.`);
  }
  if (factCheck.status === 'NEEDS_FIX' && Array.isArray(factCheck.must_fix) && factCheck.must_fix.length > 0) {
    const message = `Newsletter ${date} has unresolved fact-check must_fix items.`;
    if (strictArtifactValidation) {
      fail(message);
    } else {
      warn(`${message} ${historicalPolicyWarningReason()}.`);
    }
  }
}

function validateRootHomepageContract(newsletters) {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  const html = read(indexPath);
  if (!/fetch\(\s*['"]data\/newsletters\.json['"]/.test(html)) {
    fail('root index.html must fetch data/newsletters.json as the homepage/archive source of truth.');
  }
  if (!/fetch\(\s*['"]data\/homepage-headline\.json['"]/.test(html)) {
    fail('root index.html must fetch data/homepage-headline.json through a separate headline loader.');
  }
  const exposedDates = [...html.matchAll(/newsletters\/(\d{4}-\d{2}-\d{2})\//g)]
    .map(match => match[1]);
  const publicDates = new Set(newsletters.map(item => item?.date).filter(Boolean));
  for (const date of [...new Set(exposedDates)]) {
    if (!publicDates.has(date)) {
      fail(`root index.html hardcodes stale newsletter exposure for ${date}. ${buildRemediationMessage(date)}`);
    }
  }
}

function validateHomepageHeadlineData() {
  const filePath = path.join(root, HEADLINE_STATE_REL_PATH);
  if (!fs.existsSync(filePath)) return;
  let state = null;
  try {
    state = readJson(filePath);
  } catch (error) {
    fail(`${HEADLINE_STATE_REL_PATH} must be valid JSON: ${error.message}`);
    return;
  }
  const result = validateHomepageHeadlineState(state);
  if (!result.ok) {
    for (const error of result.errors) {
      fail(`${HEADLINE_STATE_REL_PATH}: ${error}`);
    }
  }
  const headline = state.current_headline;
  if (!headline) return;
  if (headline.newsletter_url) {
    const newsletterPath = repoPath(root, headline.newsletter_url);
    if (!newsletterPath) {
      fail(`${HEADLINE_STATE_REL_PATH}: current_headline.newsletter_url escapes repository.`);
    }
  }
  if (headline.newsletter_article_url) {
    const [newsletterArticleRelPath, articleAnchor = ''] = String(headline.newsletter_article_url).split('#');
    if (!newsletterArticleRelPath) {
      fail(`${HEADLINE_STATE_REL_PATH}: current_headline.newsletter_article_url must include a repository-relative HTML path before #anchor.`);
    } else {
      const newsletterArticlePath = repoPath(root, newsletterArticleRelPath);
      if (!newsletterArticlePath) {
        fail(`${HEADLINE_STATE_REL_PATH}: current_headline.newsletter_article_url escapes repository.`);
      } else if (articleAnchor) {
        const html = read(newsletterArticlePath);
        const escapedAnchor = articleAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`\\bid=["']${escapedAnchor}["']`).test(html)) {
          fail(`${HEADLINE_STATE_REL_PATH}: current_headline.newsletter_article_url anchor is missing from ${newsletterArticleRelPath}.`);
        }
      }
    }
  }
  if (headline.image_url) {
    const imageUrl = String(headline.image_url || '').trim();
    const isHttps = /^https:\/\//i.test(imageUrl);
    const imagePath = isHttps ? '' : repoPath(root, imageUrl);
    if (!isHttps && (!imagePath || !fs.existsSync(imagePath))) {
      fail(`${HEADLINE_STATE_REL_PATH}: current_headline.image_url must be https URL or existing repository-relative path.`);
    }
    if (!String(headline.image_alt || '').trim()) {
      fail(`${HEADLINE_STATE_REL_PATH}: current_headline.image_alt is required when image_url is present.`);
    }
  }
  if (!/^https?:\/\//i.test(String(headline.source_url || ''))) {
    fail(`${HEADLINE_STATE_REL_PATH}: current_headline.source_url must be an absolute http(s) URL.`);
  }
}

function validateRetentionForDate(date) {
  const retention = validateRetentionMetadata({ root, date });
  if (retention.exists && !retention.valid) {
    fail(`Invalid ${retention.path}: ${retention.error}\n${buildRemediationMessage(date)}`);
  }
  return retention;
}

function validateAllRetentionFiles() {
  const contentDir = path.join(root, 'content', 'newsroom');
  if (!fs.existsSync(contentDir)) return;
  for (const entry of fs.readdirSync(contentDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !datePattern.test(entry.name)) continue;
    const retentionPath = path.join(contentDir, entry.name, 'public-retention.json');
    if (!fs.existsSync(retentionPath)) continue;
    validateRetentionForDate(entry.name);
  }
}

function validateLatestPublicState(item) {
  const status = readJsonIfExists(path.join(newsroomDir(root, item.date), 'generation-status.json'));
  if (!status) return;
  const retention = validateRetentionForDate(item.date);
  if (latestDiagnosticsOnly(status) && !retention.valid) {
    fail([
      `Newsletter ${item.date} is diagnostics-only but data/newsletters.json exposes it.`,
      `latest status=${status.status || status.generation_status || 'UNKNOWN'}`,
      `public_newsletter_ready=${String(status.public_newsletter_ready)}`,
      `final_publish_ready=${String(status.final_publish_ready)}`,
      `review_publication_ready=${String(status.review_publication_ready)}`,
      `retention_valid=${String(retention.valid)}`,
      buildRemediationMessage(item.date)
    ].join('\n'));
  }
}

if (!fs.existsSync(dataPath)) {
  fail('Missing data/newsletters.json');
}

if (process.env.REQUIRE_NEWSLETTER_DATE_FILE === '1' && !fs.existsSync(newsletterDatePath)) {
  fail('Missing .tmp/newsletter-date.txt. The newsletter generate step likely failed before or during Gemini generation.');
}

let newsletters = [];
try {
  newsletters = readJson(dataPath);
} catch (error) {
  fail(`Invalid JSON in data/newsletters.json: ${error.message}`);
}

if (!Array.isArray(newsletters)) {
  fail('data/newsletters.json must contain an array');
  newsletters = [];
}

const seenDates = new Set();
const strictDates = strictTargetDates({ root, newsletterDatePath });
validateRootHomepageContract(newsletters);
validateHomepageHeadlineData();
validateAllRetentionFiles();
for (const [index, item] of newsletters.entries()) {
  for (const field of requiredFields) {
    if (!(field in item)) {
      fail(`Newsletter entry ${index} is missing "${field}"`);
    }
  }

  if (!datePattern.test(item.date || '')) {
    fail(`Newsletter entry ${index} has invalid date: ${item.date}`);
  }

  if (seenDates.has(item.date)) {
    fail(`Duplicate newsletter date: ${item.date}`);
  }
  seenDates.add(item.date);

  if (!Array.isArray(item.tags)) {
    fail(`Newsletter ${item.date} tags must be an array`);
  }

  validateLatestPublicState(item);

  for (const key of ['html', 'md']) {
    const relPath = item[key];
    const absPath = repoPath(root, relPath || '');
    if (!absPath) {
      fail(`Newsletter ${item.date} ${key} path escapes repository: ${relPath}`);
      continue;
    }
    if (!fs.existsSync(absPath)) {
      fail(`Newsletter ${item.date} ${key} file does not exist: ${relPath}`);
      continue;
    }

    const content = read(absPath);
    if (/\bTODO\b/.test(content)) {
      fail(`Published newsletter contains TODO: ${relPath}`);
    }
  }

  if (item.md) {
    const mdPath = repoPath(root, item.md);
    if (mdPath && fs.existsSync(mdPath)) {
      const md = read(mdPath);
      const briefingHeading = getBriefingHeading(md);
      if (!briefingHeading) {
        fail(`Newsletter ${item.date} markdown missing briefing section`);
      } else {
        const briefing = sectionText(md, briefingHeading);
        const briefingBullets = briefing
          .split('\n')
          .filter(line => /^- /.test(line.trim()));
        if (briefingBullets.length !== 3) {
          fail(`Newsletter ${item.date} must have exactly 3 briefing bullets, found ${briefingBullets.length}`);
        }
      }

      if (!hasAny(md, ['## References', '## 참고자료'])) {
        fail(`Newsletter ${item.date} markdown missing References/참고자료 section`);
      }

      const strictArtifactValidation = strictDates.has(item.date);
      const htmlPath = repoPath(root, item.html || '');
      const html = htmlPath && fs.existsSync(htmlPath) ? read(htmlPath) : '';
      const editor = readJsonIfExists(path.join(newsroomDir(root, item.date), 'editor-draft.json'));
      const status = readJsonIfExists(path.join(newsroomDir(root, item.date), 'generation-status.json')) || {};
      validatePublicationModeInvariants(item, status);
      validateFallbackPublicPresentation(item, html, md, status);
      validateNewsletterHtmlTags(item, html, strictArtifactValidation);
      const structural = validateRenderedIssueStructure({
        date: item.date,
        editor,
        markdown: md,
        html,
        root,
        validateDataIndex: index === 0
      });
      if (!structural.ok) {
        errors.push(...structural.errors);
      }
      validateArticleQuality(item, md, isNewFormat(md), strictArtifactValidation);
      validateSourceGapArtifact(item.date, strictArtifactValidation);
    }
  }
}

const htmlFiles = ['index.html'];
for (const item of newsletters) {
  if (item.html) htmlFiles.push(item.html);
}

for (const relPath of htmlFiles) {
  const absPath = repoPath(root, relPath);
  if (!absPath || !fs.existsSync(absPath)) continue;
  const content = read(absPath);
  const openAnchors = content.match(/<a\b/gi)?.length || 0;
  const closeAnchors = content.match(/<\/a>/gi)?.length || 0;
  if (openAnchors !== closeAnchors) {
    fail(`Anchor tag mismatch in ${relPath}`);
  }
  if (/\bTODO\b/.test(content)) {
    fail(`Published HTML contains TODO: ${relPath}`);
  }
  validateSiteNavLabels(content, relPath);

  if (relPath.startsWith('newsletters/')) {
    for (const className of ['issue-briefing', 'issue-section', 'source-list', 'reference-list']) {
      if (!content.includes(className)) {
        fail(`Newsletter HTML missing ${className}: ${relPath}`);
      }
    }
    const sourceBlocks = [];
    const sourceClassPattern = /class=["'][^"']*source-list[^"']*["']/gi;
    let sourceMatch;
    while ((sourceMatch = sourceClassPattern.exec(content)) !== null) {
      sourceBlocks.push(content.slice(sourceMatch.index, sourceMatch.index + 1200));
    }
    if (sourceBlocks.length === 0) {
      fail(`Newsletter HTML has no source-list blocks: ${relPath}`);
    }
    for (const block of sourceBlocks) {
      if (!/<a\s+[^>]*href=["']https?:\/\//i.test(block)) {
        fail(`Newsletter HTML source-list has no source links: ${relPath}`);
      }
    }
    if (!hasAny(content, ['Archive로 돌아가기', '아카이브로 돌아가기', 'Archive'])) {
      fail(`Newsletter HTML missing archive link text: ${relPath}`);
    }
    if (!hasAny(content, ['MD 원본 보기', 'MD'])) {
      fail(`Newsletter HTML missing markdown source link text: ${relPath}`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(warnings.map(warning => `Warning: ${warning}`).join('\n'));
}

if (errors.length > 0) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${newsletters.length} newsletter entries.`);
