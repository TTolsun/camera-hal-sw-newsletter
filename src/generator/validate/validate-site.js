const { ensureArray } = require('../../shared/common/value-coercion');
const fs = require('fs');
const path = require('path');
const {
  readJson,
  repoPath
} = require('../../shared/common/common');
const {
  newsroomDir,
  publicAssetPath
} = require('../../shared/common/artifact-paths');
const {
  articlePolicy,
  articleCountRangeText
} = require('../../shared/common/newsletter-policy');
const {
  HEADLINE_STATE_REL_PATH,
  validateHomepageHeadlineState
} = require('../reporter/homepage-headline');
const {
  historicalPolicyWarningReason,
  strictTargetDates
} = require('../reporter/validation-targets');
const {
  validateRenderedIssueStructure
} = require('../quality/rendered-issue-structure');
const {
  buildRemediationMessage,
  latestDiagnosticsOnly,
  validateRetentionMetadata
} = require('../publish/public-state-reconciliation');
const {
  PUBLICATION_MODES,
  HOMEPAGE_VISIBILITY,
  FALLBACK_HOMEPAGE_BADGE
} = require('../../shared/common/publication-mode');

const root = process.cwd();
const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
const newsletterDatePath = path.join(root, '.tmp', 'newsletter-date.txt');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const requiredFields = ['date', 'title', 'summary', 'html', 'md', 'tags'];
const subscriptionConfigPath = path.join(root, 'config', 'subscription.json');
const subscriptionFetchPath = 'config/subscription.json';
const subscriptionAllowedKeys = new Set(['schemaVersion', 'enabled', 'provider', 'mode', 'subscribeUrl']);
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
    quality?.editor_review_reason;
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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLocalOrDevHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
  if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.test');
}

function isPlaceholderSubscribeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value || /[<>]/.test(value)) return true;
  if (/placeholder|todo|actual beehiiv/i.test(value)) return true;
  try {
    const url = new URL(value);
    return /^(example\.com|example\.org|example\.net)$/i.test(url.hostname);
  } catch (_error) {
    return false;
  }
}

function validHostedSubscribeUrl(raw) {
  const value = String(raw || '').trim();
  if (isPlaceholderSubscribeUrl(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !isLocalOrDevHost(url.hostname);
  } catch (_error) {
    return false;
  }
}

function readSubscriptionConfig() {
  if (!fs.existsSync(subscriptionConfigPath)) {
    return { exists: false, enabled: false };
  }

  try {
    const config = readJson(subscriptionConfigPath);
    return { exists: true, enabled: config?.enabled === true, config };
  } catch (error) {
    fail(`Invalid config/subscription.json: ${error.message}`);
    return { exists: true, enabled: false };
  }
}

function validateSubscriptionConfig() {
  const state = readSubscriptionConfig();
  if (!state.exists) return state;

  const { config } = state;
  if (!isPlainObject(config)) {
    fail('config/subscription.json must contain an object.');
    return { exists: true, enabled: false };
  }

  for (const key of Object.keys(config)) {
    if (!subscriptionAllowedKeys.has(key)) {
      fail(`config/subscription.json contains unsupported field: ${key}.`);
    }
    if (/(?:api[_-]?key|token|secret)/i.test(key)) {
      fail(`config/subscription.json must not expose token-like field: ${key}.`);
    }
  }

  if (config.schemaVersion !== 1) {
    fail('config/subscription.json schemaVersion must be 1.');
  }
  if (typeof config.enabled !== 'boolean') {
    fail('config/subscription.json enabled must be a boolean.');
  }
  if (config.provider !== 'beehiiv') {
    fail('config/subscription.json provider must be beehiiv.');
  }
  if (config.mode !== 'hosted_link') {
    fail('config/subscription.json mode must be hosted_link.');
  }

  const subscribeUrl = String(config.subscribeUrl || '').trim();
  if (config.enabled === true) {
    if (!validHostedSubscribeUrl(subscribeUrl)) {
      fail('config/subscription.json enabled=true requires a valid absolute HTTPS subscribeUrl that is not a placeholder or local/dev URL.');
    }
  } else if (subscribeUrl && !validHostedSubscribeUrl(subscribeUrl)) {
    fail('config/subscription.json subscribeUrl must be empty or a valid absolute HTTPS URL when disabled.');
  }

  return { exists: true, enabled: config.enabled === true, config };
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
    : `Newsletter ${item.date} HTML issue tags [${actualTags.join(', ') || 'none'}] do not match articles/data/newsletters.json tags [${expectedTags.join(', ') || 'none'}].`;

  if (actualTags !== null && sameOrderedValues(actualTags, expectedTags)) return;
  if (strictArtifactValidation) {
    fail(message);
  }
}

function isFallbackPublicIssue(item, status = {}) {
  return item?.publication_mode === PUBLICATION_MODES.FALLBACK_PUBLIC || status?.publication_mode === PUBLICATION_MODES.FALLBACK_PUBLIC;
}

function validatePublicationModeInvariants(item, status = {}) {
  const publicationMode = item.publication_mode || status.publication_mode || '';
  const homepageVisibility = item.homepage_visibility || status.homepage_visibility || HOMEPAGE_VISIBILITY.NORMAL;
  const cameraAnchorCount = finiteNumber(item.camera_anchor_count ?? status.camera_anchor_count);
  if (cameraAnchorCount === 0 && homepageVisibility !== HOMEPAGE_VISIBILITY.HIDDEN) {
    if (publicationMode !== PUBLICATION_MODES.FALLBACK_PUBLIC) {
      fail(`Newsletter ${item.date} with camera_anchor_count=0 must use publication_mode=fallback_public or be hidden.`);
    }
    if (homepageVisibility !== HOMEPAGE_VISIBILITY.VISIBLE_WITH_FALLBACK_BADGE) {
      fail(`Newsletter ${item.date} fallback-only public issue must use homepage_visibility=visible_with_fallback_badge.`);
    }
  }
  if (publicationMode !== PUBLICATION_MODES.FALLBACK_PUBLIC) return;
  if (homepageVisibility !== HOMEPAGE_VISIBILITY.VISIBLE_WITH_FALLBACK_BADGE) {
    fail(`Newsletter ${item.date} fallback_public issue must use homepage_visibility=visible_with_fallback_badge.`);
  }
  if (!isTruthy(item.fallback_only ?? status.fallback_only)) {
    fail(`Newsletter ${item.date} fallback_public issue must expose fallback_only=true.`);
  }
  if (cameraAnchorCount !== 0) {
    fail(`Newsletter ${item.date} fallback_public issue must expose camera_anchor_count=0.`);
  }
  if (status.publication_mode === PUBLICATION_MODES.FALLBACK_PUBLIC && !isTruthy(status.fallback_public_ready)) {
    fail(`Newsletter ${item.date} fallback_public generation status must expose fallback_public_ready=true.`);
  }
}

function validateFallbackPublicPresentation(item, html, markdown, status = {}) {
  if (!isFallbackPublicIssue(item, status)) return;
  const tags = ensureArray(item.tags).map(String);
  const cameraAnchorCount = finiteNumber(item.camera_anchor_count ?? status.camera_anchor_count);
  if (item.homepage_badge !== FALLBACK_HOMEPAGE_BADGE) {
    fail(`Newsletter ${item.date} fallback_public entry must expose homepage_badge=Tooling Watch Edition.`);
  }
  if (item.homepage_visibility !== HOMEPAGE_VISIBILITY.VISIBLE_WITH_FALLBACK_BADGE) {
    fail(`Newsletter ${item.date} fallback_public entry must use homepage_visibility=visible_with_fallback_badge.`);
  }
  if (!tags.includes(FALLBACK_HOMEPAGE_BADGE)) {
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
  return ['홈', '아카이브', 'GitHub'];
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

function subscriptionSectionHtml(html) {
  const match = String(html || '').match(/<section\b(?=[^>]*\bdata-subscription-section\b)[^>]*>[\s\S]*?<\/section>/i);
  return match ? match[0] : '';
}

function subscriptionScopedScriptHtml(html) {
  const chunks = [];
  for (const match of String(html || '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = match[1];
    const blockMatch = script.match(/\basync function fetchSubscriptionConfig\b[\s\S]*?\n\s*function findHeadlineNewsletter\b/);
    if (blockMatch) {
      chunks.push(blockMatch[0]);
      continue;
    }
    chunks.push(...script
      .split(/\r?\n/)
      .filter(line => /subscription/i.test(line)));
  }
  return chunks.join('\n');
}

function hasSubscriptionActionHref(sectionHtml) {
  return /<a\b(?=[^>]*\bdata-subscription-action\b)(?=[^>]*\bhref=["'][^"']+["'])[^>]*>/i.test(sectionHtml);
}

function validateRootHomepageSubscriptionContract(html, subscriptionState) {
  if (!new RegExp(`fetch\\(\\s*['"]${escapeRegex(subscriptionFetchPath)}['"]`).test(html)) {
    fail('root index.html must fetch config/subscription.json through a repo-relative path.');
  }
  if (/fetch\(\s*['"]\/config\/subscription\.json['"]/.test(html)) {
    fail('root index.html must not fetch /config/subscription.json with an absolute path.');
  }

  const sectionHtml = subscriptionSectionHtml(html);
  if (!sectionHtml) {
    fail('root index.html must include a data-subscription-section hook.');
    return;
  }
  if (!/<section\b[^>]*\bhidden\b/i.test(sectionHtml)) {
    fail('root index.html subscription section must be hidden by default.');
  }
  if (!/<a\b(?=[^>]*\bdata-subscription-action\b)[^>]*>/i.test(sectionHtml)) {
    fail('root index.html subscription section must include a data-subscription-action anchor.');
  }
  for (const tagName of ['form', 'input', 'button']) {
    if (new RegExp(`<${tagName}\\b`, 'i').test(sectionHtml)) {
      fail(`root index.html subscription section must not include <${tagName}>.`);
    }
  }
  if (/<a\b(?=[^>]*\bdata-subscription-action\b)(?=[^>]*\brole=)[^>]*>/i.test(sectionHtml)) {
    fail('root index.html subscription CTA must remain a normal anchor without a forced role.');
  }
  if (!subscriptionState.enabled && hasSubscriptionActionHref(sectionHtml)) {
    fail('root index.html must not render an active subscription CTA when subscription is disabled or missing.');
  }

  const scopedHtml = `${sectionHtml}\n${subscriptionScopedScriptHtml(html)}`;
  if (/\b(localStorage|sessionStorage)\b|document\.cookie|\b(?:api[_-]?key|token|secret)\b/i.test(scopedHtml)) {
    fail('root index.html subscription path must not persist email/subscription data or expose token-like fields.');
  }
}

function validateRootHomepageContract(newsletters) {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  const html = read(indexPath);
  const subscriptionState = validateSubscriptionConfig();
  if (!/fetch\(\s*['"]data\/newsletters-weekly\.json['"]/.test(html)) {
    fail('root index.html must fetch data/newsletters-weekly.json as the homepage/archive source of truth.');
  }
  if (!/fetch\(\s*['"]data\/homepage-headline\.json['"]/.test(html)) {
    fail('root index.html must fetch data/homepage-headline.json through a separate headline loader.');
  }
  // 홈의 인라인 스크립트는 이 모듈의 window.NewsletterArchive(토픽·정렬·카드 렌더·fallback 판정)에
  // 의존한다. 스크립트 태그가 빠지면 히어로와 최신 소식 그리드가 동시에 비는데, data fetch 계약만
  // 잠겨 있으면 그 상태로도 게이트를 통과한다. archive.html 과 같은 검사를 홈에도 건다.
  if (!/assets\/js\/newsletter-archive\.js/.test(html)) {
    fail('root index.html must load assets/js/newsletter-archive.js.');
  }
  validateRootHomepageSubscriptionContract(html, subscriptionState);
  const exposedDates = [...html.matchAll(/newsletters\/(\d{4}-\d{2}-\d{2})\//g)]
    .map(match => match[1]);
  const publicDates = new Set(newsletters.map(item => item?.date).filter(Boolean));
  for (const date of [...new Set(exposedDates)]) {
    if (!publicDates.has(date)) {
      fail(`root index.html hardcodes stale newsletter exposure for ${date}. ${buildRemediationMessage(date)}`);
    }
  }
  if (!/<a\b[^>]*\bhref=["']archive\.html["'][^>]*>\s*전체 아카이브 보기\s*<\/a>/i.test(html)) {
    fail('root index.html must link the 전체 아카이브 보기 archive action to archive.html.');
  }
}

function validateArchivePageContract(newsletters) {
  const relPath = 'archive.html';
  const archivePath = publicAssetPath(root, relPath);
  if (!fs.existsSync(archivePath)) {
    fail('Missing required public archive route: archive.html');
    return;
  }
  const html = read(archivePath);
  if (!/<body\b[^>]*class=["'][^"']*\bhomepage\b[^"']*["']/i.test(html)) {
    fail('archive.html must use the same body.homepage shell as index.html.');
  }
  if (!/assets\/js\/newsletter-archive\.js/.test(html)) {
    fail('archive.html must load assets/js/newsletter-archive.js.');
  }
  if (!/fetch\(\s*['"]data\/newsletters-weekly\.json['"]/.test(html)) {
    fail('archive.html must fetch data/newsletters-weekly.json as the archive source of truth.');
  }
  for (const hook of [
    'data-page="archive"',
    'data-archive-status',
    'data-archive-controls',
    'data-topic-filter',
    'data-sort-control',
    'data-result-summary',
    'data-archive-grid',
    'data-archive-pagination',
    'data-empty-state',
    'data-error-state'
  ]) {
    if (!html.includes(hook)) {
      fail(`archive.html missing required archive hook: ${hook}`);
    }
  }
  const exposedDates = [...html.matchAll(/newsletters\/(\d{4}-\d{2}-\d{2})\//g)]
    .map(match => match[1]);
  const publicDates = new Set(newsletters.map(item => item?.date).filter(Boolean));
  for (const date of [...new Set(exposedDates)]) {
    if (!publicDates.has(date)) {
      fail(`archive.html hardcodes stale newsletter exposure for ${date}. ${buildRemediationMessage(date)}`);
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
    const newsletterPath = publicAssetPath(root, headline.newsletter_url);
    if (!newsletterPath) {
      fail(`${HEADLINE_STATE_REL_PATH}: current_headline.newsletter_url escapes repository.`);
    }
  }
  if (headline.newsletter_article_url) {
    const [newsletterArticleRelPath, articleAnchor = ''] = String(headline.newsletter_article_url).split('#');
    if (!newsletterArticleRelPath) {
      fail(`${HEADLINE_STATE_REL_PATH}: current_headline.newsletter_article_url must include a repository-relative HTML path before #anchor.`);
    } else {
      const newsletterArticlePath = publicAssetPath(root, newsletterArticleRelPath);
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
    const imagePath = isHttps ? '' : publicAssetPath(root, imageUrl);
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
  const contentDir = path.join(root, 'articles', 'content', 'newsroom');
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
      `Newsletter ${item.date} is diagnostics-only but articles/data/newsletters.json exposes it.`,
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
validateArchivePageContract(newsletters);
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
    // item.html/md는 서빙 URL(newsletters/<date>/...)이며 디스크상으로는 articles/ 아래에 있다.
    const absPath = publicAssetPath(root, relPath || '');
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
    const mdPath = publicAssetPath(root, item.md);
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
      const htmlPath = publicAssetPath(root, item.html || '');
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

const htmlFiles = ['index.html', 'archive.html'];
for (const item of newsletters) {
  if (item.html) htmlFiles.push(item.html);
}

for (const relPath of htmlFiles) {
  // 서빙 URL(index.html/archive.html/newsletters/<date>/...)을 디스크 위치로 매핑.
  const absPath = publicAssetPath(root, relPath);
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
