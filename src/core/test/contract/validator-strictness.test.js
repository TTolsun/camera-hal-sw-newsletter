const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsletterQualityReport
} = require('../../../generator/quality/newsletter-quality');
const {
  articlePolicy,
  getHeadlinePolicy,
  qualityGatePolicy
} = require('../../common/newsletter-policy');
const {
  policySnapshot
} = require('../../../generator/reporter/homepage-headline');
const {
  reporterCandidatesFor,
  validSections
} = require('../helpers/quality-builders');
const {
  tempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
const validateSitePath = path.join(repoRoot, 'src', 'generator', 'publish', 'validate-site.js');
const validateQualityPath = path.join(repoRoot, 'src', 'generator', 'publish', 'validate-quality.js');

function runScript(scriptPath, root, env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: '',
      GITHUB_BASE_REF: '',
      ...env
    }
  });
}

function newsletterMarkdown(date, articleCount, { todo = false } = {}) {
  const articles = Array.from({ length: articleCount }, (_, index) => {
    const number = index + 2;
    return [
      `## ${number}. CameraX release ${index}`,
      '',
      'CameraX changed Android Camera compatibility behavior for Camera HAL stream and metadata validation.',
      '',
      '**Sources**',
      `- [CameraX release ${index}](https://example.com/${date}/source-${index})`,
      ''
    ].join('\n');
  });
  return [
    '# Camera HAL / SW Newsletter',
    '',
    '## 1. 이번 주 3줄 브리핑',
    '- Camera stack validation signal one.',
    '- Camera stack validation signal two.',
    '- Camera stack validation signal three.',
    '',
    ...articles,
    '## References',
    '- [Reference](https://example.com/reference)',
    todo ? 'TODO: remove this before publishing.' : ''
  ].join('\n');
}

function newsletterHtml(date, {
  tags = ['camera-hal'],
  navLabels = ['Latest', 'Archive', 'GitHub']
} = {}) {
  const tagHtml = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
  const navHrefs = ['#latest', '#archive', 'https://github.com/TTolsun/camera-hal-sw-newsletter'];
  const navHtml = navLabels
    .map((label, index) => `<a href="${navHrefs[index] || '#'}">${label}</a>`)
    .join('');
  return [
    '<!doctype html>',
    '<html><body>',
    '<nav class="site-nav content-wrap" aria-label="Primary navigation">',
    '<a class="site-brand" href="index.html">Camera HAL / SW Newsletter</a>',
    `<div class="nav-links">${navHtml}</div>`,
    '</nav>',
    '<main>',
    `<div class="tag-row issue-tags">${tagHtml}</div>`,
    '<section class="issue-briefing"></section>',
    '<section class="issue-section">',
    '<ul class="source-list"><li><a href="https://example.com/source">Source</a></li></ul>',
    '<ul class="reference-list"><li><a href="https://example.com/reference">Reference</a></li></ul>',
    '</section>',
    `<a href="../">Archive</a><a href="newsletter.md">MD</a><span>${date}</span>`,
    '</main>',
    '</body></html>'
  ].join('\n');
}

function rootNavHtml(navLabels = ['Home', 'Archive', 'GitHub']) {
  const navHrefs = ['index.html', 'archive.html', 'https://github.com/TTolsun/camera-hal-sw-newsletter'];
  const navHtml = navLabels
    .map((label, index) => `<a href="${navHrefs[index] || '#'}">${label}</a>`)
    .join('');
  return [
    '<nav class="site-nav content-wrap" aria-label="Primary navigation">',
    '<a class="site-brand" href="index.html">Camera HAL / SW Newsletter</a>',
    `<div class="nav-links">${navHtml}</div>`,
    '</nav>'
  ].join('\n');
}

function rootSiteHeaderComponentHtml() {
  return [
    '<script src="assets/js/site-header.js" defer></script>',
    '<header class="site-header" data-site-header></header>'
  ].join('\n');
}

function rootIndexHtml(extra = '', { navLabels = null, siteHeaderComponent = true } = {}) {
  return [
    '<!doctype html><html><body>',
    navLabels ? rootNavHtml(navLabels) : (siteHeaderComponent ? rootSiteHeaderComponentHtml() : ''),
    '<a class="section-link" href="archive.html">전체 아카이브 보기</a>',
    '<div id="latest-card"></div>',
    '<div id="archive-list"></div>',
    '<section class="section subscribe-section" data-subscription-section hidden>',
    '<a class="button subscribe-link" data-subscription-action>Subscribe</a>',
    '</section>',
    extra,
    '<script>',
    "async function loadHomepageHeadline() { await fetch('data/homepage-headline.json'); }",
    "async function loadNewsletters() { const latest = {}; const archive = []; await fetch('data/newsletters-weekly.json'); }",
    "async function loadSubscription() { await fetch('config/subscription.json'); document.querySelector('[data-subscription-section]'); document.querySelector('[data-subscription-action]'); }",
    'loadHomepageHeadline();',
    'loadNewsletters();',
    'loadSubscription();',
    '</script>',
    '</body></html>'
  ].join('\n');
}

function rootArchiveHtml(extra = '') {
  return [
    '<!doctype html><html><body class="homepage">',
    '<main id="archive-page" data-page="archive">',
    '<section data-archive-status aria-live="polite"></section>',
    '<form data-archive-controls>',
    '<div data-topic-filter></div>',
    '<select data-sort-control><option value="latest">최신순</option><option value="oldest">오래된순</option></select>',
    '</form>',
    '<p data-result-summary></p>',
    '<div data-archive-grid></div>',
    '<nav data-archive-pagination hidden></nav>',
    '<div data-empty-state hidden></div>',
    '<div data-error-state hidden></div>',
    '</main>',
    '<footer class="site-footer"><a href="index.html">Home</a><a href="archive.html">Archive</a><a href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a></footer>',
    '<script src="assets/js/newsletter-archive.js"></script>',
    '<script>',
    "async function loadArchiveNewsletters() { await fetch('data/newsletters-weekly.json'); }",
    'loadArchiveNewsletters();',
    '</script>',
    extra,
    '</body></html>'
  ].join('\n');
}

function subscriptionConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    enabled: false,
    provider: 'beehiiv',
    mode: 'hosted_link',
    subscribeUrl: '',
    ...overrides
  };
}

function writeSiteFixture(root, {
  date = '2026-04-01',
  articleCount,
  todo = false,
  strict = false,
  factCheckMustFix = false,
  editorApprovedException = false,
  dataTags = ['camera-hal'],
  htmlTags = dataTags,
  navLabels = ['Home', 'Archive', 'GitHub'],
  sourceGapCount = null,
  staleClaimHardFailure = false,
  qualityDeductions = null,
  qualityMetrics = {},
  statusOverrides = {}
} = {}) {
  const count = articleCount ?? Math.max(0, articlePolicy.mainArticleCount.min - 1);
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: dataTags
  }]);
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), newsletterMarkdown(date, count, { todo }));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), newsletterHtml(date, {
    tags: htmlTags,
    navLabels
  }));
  writeText(path.join(root, 'index.html'), rootIndexHtml());
  writeText(path.join(root, 'articles', 'archive.html'), rootArchiveHtml());
  if (factCheckMustFix || sourceGapCount !== null) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), {
      status: factCheckMustFix ? 'NEEDS_FIX' : 'PASS',
      must_fix: factCheckMustFix ? ['CameraX release has an unresolved source claim.'] : [],
      source_gaps: sourceGapCount > 0 ? ['CameraX release has a source gap.'] : [],
      source_gap_count: sourceGapCount ?? 0
    });
  }
  if (staleClaimHardFailure) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'stale-claim-report.json'), {
      status: 'NEEDS_FIX',
      stale_claim_items_removed: [],
      unsupported_release_claims_removed: [],
      hard_failures: [{ reason: 'removed-section-claim-remains' }]
    });
  }
  if (editorApprovedException) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
      final_publish_ready: false,
      editor_review_required: true,
      public_newsletter_ready: true,
      review_publication_ready: true,
      diagnostics_only: false,
      homepage_visible_after_merge: true,
      review_publication_ready_reason: 'Only two independent camera-stack public articles remain.',
      ...statusOverrides
    });
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), {
      status: 'NEEDS_FIX',
      review_publication_ready_reason: 'Only two independent camera-stack public articles remain.',
      deductions: qualityDeductions || [{
        category: 'composition',
        points: 8,
        reason: 'Main article count is below policy minimum.',
        blocking: true,
        severity: 'hard'
      }],
      metrics: {
        article_count: count,
        must_fix_count: 0,
        source_gap_count: 0,
        stale_claim_status: 'PASS',
        stale_claim_hard_failure_count: 0,
        source_integrity_violation_count: 0,
        blocking_deduction_count: 1,
        blocking_deduction_categories: ['composition'],
        ...qualityMetrics
      }
    });
  }
  if (strict) {
    writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  }
}

function fallbackNewsletterMarkdown(date, articleCount, { notice = true } = {}) {
  const markdown = newsletterMarkdown(date, articleCount);
  if (!notice) return markdown;
  return markdown.replace(
    '\n## 1.',
    '\n> Tooling Watch Edition\n> Direct camera anchor was not available this week.\n\n## 1.'
  );
}

function fallbackNewsletterHtml(date, { tags, notice = true } = {}) {
  const html = newsletterHtml(date, { tags });
  if (!notice) return html;
  return html.replace(
    '<section class="issue-briefing">',
    '<div class="publication-notice" role="note"><p>Tooling Watch Edition</p><p>Direct camera anchor was not available this week.</p></div>\n<section class="issue-briefing">'
  );
}

function writeFallbackPublicSiteFixture(root, {
  date = '2026-05-20',
  tags = ['Tooling Watch Edition', 'Tooling Watch'],
  homepageBadge = 'Tooling Watch Edition',
  homepageVisibility = 'visible_with_fallback_badge',
  notice = true,
  publicationMode = 'fallback_public',
  fallbackOnly = true,
  cameraAnchorCount = 0,
  statusOverrides = {}
} = {}) {
  const articleCount = articlePolicy.mainArticleCount.min;
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: 'Tooling Watch Edition',
    summary: 'Tooling Watch Edition - Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags,
    publication_mode: publicationMode,
    homepage_visibility: homepageVisibility,
    fallback_only: fallbackOnly,
    camera_anchor_count: cameraAnchorCount,
    ...(homepageBadge ? { homepage_badge: homepageBadge } : {})
  }]);
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), fallbackNewsletterMarkdown(date, articleCount, { notice }));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), fallbackNewsletterHtml(date, { tags, notice }));
  writeText(path.join(root, 'index.html'), rootIndexHtml());
  writeText(path.join(root, 'articles', 'archive.html'), rootArchiveHtml());
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    publication_mode: publicationMode,
    homepage_visibility: homepageVisibility,
    fallback_only: fallbackOnly,
    camera_anchor_count: cameraAnchorCount,
    fallback_public_ready: true,
    homepage_badge: homepageBadge,
    public_newsletter_ready: true,
    review_publication_ready: true,
    diagnostics_only: false,
    homepage_visible_after_merge: true,
    final_publish_ready: false,
    editor_review_required: true,
    ...statusOverrides
  });
}

function homepageHeadlineState({
  date = '2026-05-23',
  overrides = {}
} = {}) {
  const policy = getHeadlinePolicy();
  return {
    schemaVersion: 1,
    updated_at: `${date}T00:00:00+09:00`,
    current_headline: {
      article_identity_key: 'url:https://example.com/source',
      title: 'Camera HAL headline',
      summary: 'Camera HAL headline summary.',
      source_url: 'https://example.com/source',
      newsletter_date: date,
      newsletter_url: `newsletters/${date}/index.html`,
      selected_at: date,
      base_score: 100,
      current_score: 100,
      last_scored_at: date,
      date_evidence: {
        date,
        date_field: 'published_date',
        evidence_level: 'dated_release',
        publish_ready_date_evidence: true
      },
      quality_flags: {
        source_gap_risk: false,
        fact_check_must_fix_unresolved: false,
        stale_claim_hard_failure: false,
        blocked_source: false
      },
      score_breakdown: {},
      snapshot: {
        category: articlePolicy.primaryCameraStack.buckets[0],
        source_name: 'Example Source'
      },
      ...overrides
    },
    headline_history: [],
    policy: policySnapshot(policy)
  };
}

function writeQualityFixture(root, { date = '2026-04-01', strict = false } = {}) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['camera-hal']
  }]);
  const sections = validSections(articlePolicy.mainArticleCount.min);
  const editor = { briefing: ['one', 'two', 'three'], sections };
  const reporter = { candidates: reporterCandidatesFor(sections) };
  const factCheck = { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 };
  const threshold = Math.max(0, qualityGatePolicy.threshold - 1);
  const report = buildNewsletterQualityReport(date, editor, reporter, factCheck, { threshold });
  const staleReport = {
    ...report,
    score: report.score - 1
  };
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  writeJson(path.join(newsroomDir, 'quality-report.json'), staleReport);
  if (strict) {
    writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  }
}

function writeMissingClaimsQualityFixture(root, { date = '2026-04-01', strictReport = false } = {}) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['camera-hal']
  }]);
  const sections = validSections(articlePolicy.mainArticleCount.min).map(item => {
    const { claims, ...rest } = item;
    return rest;
  });
  const editor = { briefing: ['one', 'two', 'three'], sections };
  const reporter = { candidates: reporterCandidatesFor(sections) };
  const factCheck = { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 };
  const report = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
    strictClaimValidation: strictReport
  });
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  writeJson(path.join(newsroomDir, 'quality-report.json'), report);
}

function writeReviewOnlyQualityStatus(root, date, overrides = {}) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['camera-hal'],
    publication_mode: 'review_only',
    homepage_visibility: 'normal',
    fallback_only: false,
    camera_anchor_count: articlePolicy.mainArticleCount.min
  }]);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    publication_mode: 'review_only',
    final_publish_ready: false,
    editor_review_required: true,
    public_newsletter_ready: true,
    review_publication_ready: true,
    diagnostics_only: false,
    homepage_visible_after_merge: true,
    review_publication_ready_reason: 'Public newsletter files were generated for editor-approved review-only publication.',
    ...overrides
  });
}

function writeFallbackPublicQualityStatus(root, date, overrides = {}) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL / SW Newsletter',
    summary: 'Tooling Watch Edition',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Tooling Watch Edition', 'Tooling Watch'],
    publication_mode: 'fallback_public',
    homepage_visibility: 'visible_with_fallback_badge',
    fallback_only: true,
    camera_anchor_count: 0,
    homepage_badge: 'Tooling Watch Edition'
  }]);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    publication_mode: 'fallback_public',
    homepage_visibility: 'visible_with_fallback_badge',
    fallback_only: true,
    camera_anchor_count: 0,
    fallback_public_ready: true,
    final_publish_ready: false,
    editor_review_required: true,
    public_newsletter_ready: true,
    review_publication_ready: true,
    diagnostics_only: false,
    homepage_visible_after_merge: true,
    review_publication_ready_reason: 'Editor-approved public newsletter files were generated for review publication.',
    ...overrides
  });
}

function writeDiagnosticsOnlyStatus(root, date, overrides = {}) {
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    public_newsletter_ready: false,
    final_publish_ready: false,
    review_publication_ready: false,
    diagnostics_only: true,
    ...overrides
  });
}

function writePublicRetention(root, date, overrides = {}) {
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'public-retention.json'), {
    retain_existing_public: true,
    date,
    scope: 'same_date_diagnostics_only',
    reason: 'Editor approved retaining this previous public issue after a later diagnostics-only run.',
    approved_by: 'editor',
    approved_at: date,
    retained_public_artifacts: [
      `articles/newsletters/${date}/index.html`,
      `articles/newsletters/${date}/newsletter.md`
    ],
    ...overrides
  });
}

test('historical validate-site article count drift is warning-only', () => {
  const root = tempRoot('validate-site-historical-');
  writeSiteFixture(root);

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /historical artifact outside current\/changed\/generated validation target, warning only/);
});

test('strict validate-site article count drift remains hard failure', () => {
  const root = tempRoot('validate-site-strict-');
  writeSiteFixture(root, { strict: true });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected Newsletter Policy range/);
});

test('strict validate-site article count drift allows explicit review publication exception', () => {
  const root = tempRoot('validate-site-review-publication-');
  writeSiteFixture(root, {
    strict: true,
    editorApprovedException: true
  });

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /review publication exception/);
  assert.match(result.stderr, /expected Newsletter Policy range/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('strict validate-site HTML issue tag drift remains hard failure', () => {
  const root = tempRoot('validate-site-tag-drift-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min,
    dataTags: ['Camera HAL', 'Android'],
    htmlTags: ['Camera HAL', 'Android', 'AI']
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTML issue tags \[Camera HAL, Android, AI\] do not match articles\/data\/newsletters\.json tags \[Camera HAL, Android\]/);
});

test('strict validate-site rejects localized issue site nav labels', () => {
  const root = tempRoot('validate-site-nav-labels-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min,
    navLabels: ['\ucd5c\uc2e0\ud638', '\uc544\uce74\uc774\ube0c', 'GitHub']
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Site navigation labels must be Home \/ Archive \/ GitHub/);
});

test('validate-site accepts root homepage nav without Sources link', () => {
  const root = tempRoot('validate-site-root-nav-labels-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml('', {
    navLabels: ['Home', 'Archive', 'GitHub']
  }));

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
});

test('validate-site rejects root homepage nav with stale Sources link', () => {
  const root = tempRoot('validate-site-root-nav-sources-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml('', {
    navLabels: ['Home', 'Archive', 'Sources', 'GitHub']
  }));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Site navigation labels must be Home \/ Archive \/ GitHub in index\.html/);
});

test('validate-site accepts shared root site header component', () => {
  const root = tempRoot('validate-site-root-header-component-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml());

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
});

test('validate-site rejects shared site header component without script', () => {
  const root = tempRoot('validate-site-root-header-component-script-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml('', {
    siteHeaderComponent: false
  }).replace('<div id="latest-card"></div>', '<header class="site-header" data-site-header></header>\n<div id="latest-card"></div>'));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Shared site header in index\.html must load assets\/js\/site-header\.js/);
});

test('validate-site accepts disabled subscription config and scoped unrelated UI code', () => {
  const root = tempRoot('validate-site-subscription-disabled-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeJson(path.join(root, 'config', 'subscription.json'), subscriptionConfig());
  writeText(path.join(root, 'index.html'), rootIndexHtml([
    '<p class="button">Unrelated action copy</p>',
    '<script>localStorage.setItem("archive-view", "compact");</script>'
  ].join('\n')));

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
});

test('validate-site accepts enabled subscription with custom HTTPS hosted URL', () => {
  const root = tempRoot('validate-site-subscription-enabled-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeJson(path.join(root, 'config', 'subscription.json'), subscriptionConfig({
    enabled: true,
    subscribeUrl: 'https://subscribe.camera-sw-newsletter.com/join'
  }));

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
});

test('validate-site rejects unsafe subscription URLs when enabled', () => {
  for (const [name, subscribeUrl] of [
    ['placeholder', '<actual beehiiv hosted subscribe URL>'],
    ['empty', ''],
    ['http', 'http://subscribe.camera-sw-newsletter.com/join'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/plain,subscribe'],
    ['mailto', 'mailto:news@example.com'],
    ['localhost', 'https://localhost/subscribe'],
    ['example', 'https://example.com/subscribe']
  ]) {
    const root = tempRoot(`validate-site-subscription-${name}-`);
    writeSiteFixture(root, {
      strict: true,
      articleCount: articlePolicy.mainArticleCount.min
    });
    writeJson(path.join(root, 'config', 'subscription.json'), subscriptionConfig({
      enabled: true,
      subscribeUrl
    }));

    const result = runScript(validateSitePath, root);

    assert.notEqual(result.status, 0, `${name} should fail validation`);
    assert.match(result.stderr, /enabled=true requires a valid absolute HTTPS subscribeUrl/);
  }
});

test('validate-site requires repo-relative subscription fetch path', () => {
  const root = tempRoot('validate-site-subscription-fetch-path-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml().replace(
    "fetch('config/subscription.json')",
    "fetch('/config/subscription.json')"
  ));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must fetch config\/subscription\.json through a repo-relative path/);
  assert.match(result.stderr, /must not fetch \/config\/subscription\.json/);
});

test('validate-site rejects fake subscription form controls in the subscription section', () => {
  const root = tempRoot('validate-site-subscription-form-');
  writeSiteFixture(root, {
    strict: true,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml().replace(
    '<a class="button subscribe-link" data-subscription-action>Subscribe</a>',
    '<form><input type="email"><button type="submit">Subscribe</button></form><a class="button subscribe-link" data-subscription-action>Subscribe</a>'
  ));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /subscription section must not include <form>/);
  assert.match(result.stderr, /subscription section must not include <input>/);
  assert.match(result.stderr, /subscription section must not include <button>/);
});

test('validate-site fails fallback_public without badge or publication notice', () => {
  const root = tempRoot('validate-site-fallback-public-missing-disclosure-');
  writeFallbackPublicSiteFixture(root, {
    homepageBadge: '',
    notice: false
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fallback_public entry must expose homepage_badge=Tooling Watch Edition/);
  assert.match(result.stderr, /fallback_public HTML must show a visible Tooling Watch Edition publication notice/);
  assert.match(result.stderr, /fallback_public markdown must disclose Tooling Watch Edition status/);
});

test('validate-site fails fallback-only homepage metadata that looks like a normal Camera HAL issue', () => {
  const root = tempRoot('validate-site-fallback-public-camera-tag-');
  writeFallbackPublicSiteFixture(root, {
    tags: ['Camera HAL', 'Tooling Watch Edition', 'Tooling Watch']
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fallback-only metadata must not expose Camera HAL as a homepage tag/);
});

test('validate-site fails homepage-visible no-anchor issue without fallback_public mode', () => {
  const root = tempRoot('validate-site-no-anchor-without-fallback-public-');
  writeFallbackPublicSiteFixture(root, {
    tags: ['Android', 'C++'],
    homepageBadge: '',
    homepageVisibility: 'normal',
    publicationMode: 'review_only',
    fallbackOnly: false,
    cameraAnchorCount: 0
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /camera_anchor_count=0 must use publication_mode=fallback_public or be hidden/);
  assert.match(result.stderr, /fallback-only public issue must use homepage_visibility=visible_with_fallback_badge/);
});

test('validate-site fails fallback_public metadata contract conflicts', () => {
  const root = tempRoot('validate-site-fallback-public-contract-conflict-');
  writeFallbackPublicSiteFixture(root, {
    fallbackOnly: false,
    cameraAnchorCount: 1,
    statusOverrides: {
      fallback_public_ready: false
    }
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fallback_public issue must expose fallback_only=true/);
  assert.match(result.stderr, /fallback_public issue must expose camera_anchor_count=0/);
  assert.match(result.stderr, /fallback_public generation status must expose fallback_public_ready=true/);
});

test('validate-site fails when diagnostics-only date remains public without retention', () => {
  const root = tempRoot('validate-site-public-diagnostics-conflict-');
  const date = '2026-05-18';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeDiagnosticsOnlyStatus(root, date);

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /diagnostics-only but articles\/data\/newsletters\.json exposes it/);
  assert.match(result.stderr, /Remove the 2026-05-18 entry from articles\/data\/newsletters\.json/);
});

test('validate-site fails invalid public retention with remediation example', () => {
  const root = tempRoot('validate-site-invalid-public-retention-');
  const date = '2026-05-18';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeDiagnosticsOnlyStatus(root, date);
  writePublicRetention(root, date, {
    approved_at: ''
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid articles\/content\/newsroom\/2026-05-18\/public-retention\.json/);
  assert.match(result.stderr, /approved_at=YYYY-MM-DD/);
  assert.match(result.stderr, /retained_public_artifacts=\[/);
});

test('validate-site allows diagnostics-only public index when valid retention exists', () => {
  const root = tempRoot('validate-site-valid-public-retention-');
  const date = '2026-05-18';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeDiagnosticsOnlyStatus(root, date);
  writePublicRetention(root, date);

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /diagnostics-only but articles\/data\/newsletters\.json exposes it/);
});

test('validate-site fails root homepage stale hardcoded newsletter exposure', () => {
  const root = tempRoot('validate-site-root-stale-hardcoded-');
  const date = '2026-04-01';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(
    path.join(root, 'index.html'),
    rootIndexHtml('<a href="newsletters/2026-05-18/index.html">stale issue</a>')
  );

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /root index\.html hardcodes stale newsletter exposure for 2026-05-18/);
});

test('validate-site rejects missing required archive page route', () => {
  const root = tempRoot('validate-site-missing-archive-route-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min
  });
  fs.unlinkSync(path.join(root, 'articles', 'archive.html'));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required public archive route: archive\.html/);
});

test('validate-site rejects archive page without shared helper reference', () => {
  const root = tempRoot('validate-site-archive-helper-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'articles', 'archive.html'), rootArchiveHtml().replace('<script src="assets/js/newsletter-archive.js"></script>', ''));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /archive\.html must load assets\/js\/newsletter-archive\.js/);
});

test('validate-site rejects archive page without required hooks', () => {
  const root = tempRoot('validate-site-archive-hooks-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'articles', 'archive.html'), rootArchiveHtml().replace('data-archive-grid', 'data-archive-list'));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /archive\.html missing required archive hook: data-archive-grid/);
});

test('validate-site rejects archive page stale hardcoded newsletter exposure', () => {
  const root = tempRoot('validate-site-archive-stale-hardcoded-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'articles', 'archive.html'), rootArchiveHtml('<a href="newsletters/2026-05-18/index.html">stale issue</a>'));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /archive\.html hardcodes stale newsletter exposure for 2026-05-18/);
});

test('validate-site stale homepage headline score failure includes refresh remediation', () => {
  const root = tempRoot('validate-site-stale-homepage-headline-');
  const policy = getHeadlinePolicy();
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), {
    schemaVersion: 1,
    updated_at: '2020-01-01T00:00:00+09:00',
    current_headline: {
      article_identity_key: 'url:https://source.android.com/docs/camera/stale-headline',
      title: 'Stale Camera HAL headline',
      summary: 'Stale Camera HAL headline summary.',
      source_url: 'https://source.android.com/docs/camera/stale-headline',
      newsletter_date: '2020-01-01',
      newsletter_url: 'newsletters/2020-01-01/index.html',
      selected_at: '2020-01-01',
      base_score: policy.minimumHeadlineScore,
      current_score: policy.minimumHeadlineScore,
      last_scored_at: '2020-01-01',
      date_evidence: {
        date: '2020-01-01',
        date_field: 'published_date',
        evidence_level: 'dated_release',
        publish_ready_date_evidence: true
      },
      quality_flags: {
        source_gap_risk: false,
        fact_check_must_fix_unresolved: false,
        stale_claim_hard_failure: false,
        blocked_source: false
      },
      score_breakdown: {},
      snapshot: {
        category: articlePolicy.primaryCameraStack.buckets[0],
        source_name: 'source.android.com'
      }
    },
    headline_history: [],
    policy: policySnapshot(policy)
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /current_headline failed validation: headline_score_below_minimum/);
  assert.match(result.stderr, /Run newsletter generation to refresh or clear homepage headline state/);
});

test('validate-site rejects homepage headline image without alt text', () => {
  const root = tempRoot('validate-site-headline-image-alt-');
  const date = '2026-05-23';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), homepageHeadlineState({
    date,
    overrides: {
      image_url: 'https://example.com/headline.png',
      image_alt: ''
    }
  }));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /current_headline\.image_alt is required when image_url is present/);
});

test('validate-site rejects homepage headline non-https external image URL', () => {
  const root = tempRoot('validate-site-headline-http-image-');
  const date = '2026-05-23';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), homepageHeadlineState({
    date,
    overrides: {
      image_url: 'http://example.com/headline.png',
      image_alt: 'Camera HAL headline image'
    }
  }));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /current_headline\.image_url must be https URL or existing repository-relative path/);
});

test('validate-site rejects homepage headline article URL without repository path', () => {
  const root = tempRoot('validate-site-headline-anchor-only-');
  const date = '2026-05-23';
  writeSiteFixture(root, {
    date,
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeJson(path.join(root, 'articles', 'data', 'homepage-headline.json'), homepageHeadlineState({
    date,
    overrides: {
      newsletter_article_url: '#article-camerax'
    }
  }));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /current_headline\.newsletter_article_url must include a repository-relative HTML path before #anchor/);
});

test('strict review publication exception applies only to composition-only blockers', () => {
  const cases = [
    {
      name: 'source-integrity',
      options: {
        qualityDeductions: [
          {
            category: 'composition',
            points: 8,
            reason: 'Main article count is below policy minimum.',
            blocking: true,
            severity: 'hard'
          },
          {
            category: 'source-integrity',
            points: 20,
            reason: 'Duplicate source binding.',
            blocking: true,
            severity: 'hard'
          }
        ],
        qualityMetrics: {
          source_integrity_violation_count: 1,
          blocking_deduction_count: 2,
          blocking_deduction_categories: ['composition', 'source-integrity']
        }
      }
    },
    {
      name: 'fact-check',
      options: {
        factCheckMustFix: true,
        qualityMetrics: {
          must_fix_count: 1
        }
      }
    },
    {
      name: 'source-gap',
      options: {
        sourceGapCount: 1,
        qualityMetrics: {
          source_gap_count: 1
        }
      }
    },
    {
      name: 'stale-claim',
      options: {
        staleClaimHardFailure: true,
        qualityMetrics: {
          stale_claim_status: 'NEEDS_FIX',
          stale_claim_hard_failure_count: 1
        }
      }
    }
  ];

  for (const testCase of cases) {
    const root = tempRoot(`validate-site-review-publication-${testCase.name}-`);
    writeSiteFixture(root, {
      strict: true,
      editorApprovedException: true,
      ...testCase.options
    });

    const result = runScript(validateSitePath, root);

    assert.notEqual(result.status, 0, testCase.name);
    assert.match(result.stderr, /expected Newsletter Policy range/, testCase.name);
    assert.doesNotMatch(result.stderr, /review publication exception/, testCase.name);
  }
});

test('historical validate-site structural errors remain hard failures', () => {
  const root = tempRoot('validate-site-structural-');
  writeSiteFixture(root, { todo: true });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Published newsletter contains TODO/);
});

test('historical validate-site fact-check must_fix is warning-only', () => {
  const root = tempRoot('validate-site-historical-must-fix-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min,
    factCheckMustFix: true
  });

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /unresolved fact-check must_fix items/);
  assert.match(result.stderr, /historical artifact outside current\/changed\/generated validation target, warning only/);
});

test('strict validate-site fact-check must_fix remains hard failure', () => {
  const root = tempRoot('validate-site-strict-must-fix-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min,
    factCheckMustFix: true,
    strict: true
  });

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unresolved fact-check must_fix items/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target, warning only/);
});

test('historical validate-quality threshold and recompute drift are warning-only', () => {
  const root = tempRoot('validate-quality-historical-');
  writeQualityFixture(root);

  const result = runScript(validateQualityPath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /quality threshold is below current Newsletter Policy threshold/);
  assert.match(result.stderr, /quality report is stale/);
  assert.match(result.stderr, /historical artifact outside current\/changed\/generated validation target, warning only/);
});

test('strict validate-quality threshold and recompute drift remain hard failures', () => {
  const root = tempRoot('validate-quality-strict-');
  writeQualityFixture(root, { strict: true });

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality threshold is below current Newsletter Policy threshold/);
  assert.match(result.stderr, /quality report is stale/);
});

test('historical validate-quality missing claims report is warning-only', () => {
  const root = tempRoot('validate-quality-historical-missing-claims-');
  writeMissingClaimsQualityFixture(root, { strictReport: true });

  const result = runScript(validateQualityPath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /quality score \d+\/\d+ does not pass: NEEDS_FIX/);
  assert.match(result.stderr, /historical artifact outside current\/changed\/generated validation target, warning only/);
});

test('newsletter date target makes validate-quality missing claims strict', () => {
  const root = tempRoot('validate-quality-newsletter-date-missing-claims-');
  const date = '2026-04-01';
  writeMissingClaimsQualityFixture(root, { date });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('review-only publication target does not make claim-contract drift a hard quality failure', () => {
  const root = tempRoot('validate-quality-review-only-missing-claims-');
  const date = '2026-04-01';
  writeMissingClaimsQualityFixture(root, { date });
  writeReviewOnlyQualityStatus(root, date);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const result = runScript(validateQualityPath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('fallback-public publication target does not make claim-contract drift a hard quality failure', () => {
  const root = tempRoot('validate-quality-fallback-public-missing-claims-');
  const date = '2026-04-01';
  writeMissingClaimsQualityFixture(root, { date });
  writeFallbackPublicQualityStatus(root, date);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const result = runScript(validateQualityPath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('review-only publication target still rejects lowered quality threshold', () => {
  const root = tempRoot('validate-quality-review-only-low-threshold-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date });
  writeReviewOnlyQualityStatus(root, date);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality threshold is below current Newsletter Policy threshold/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('current generation status date makes validate-quality strict', () => {
  const root = tempRoot('validate-quality-current-generation-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date });
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'STARTED',
    candidate_input: {
      mode: 'artifact'
    }
  });

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality threshold is below current Newsletter Policy threshold/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('current canonical generation-status date makes validate-quality strict', () => {
  const root = tempRoot('validate-quality-current-canonical-generation-');
  const date = '2026-04-01';
  writeMissingClaimsQualityFixture(root, { date });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    date,
    status: 'STAGE_3_QUALITY',
    run_context: {
      github_sha: 'current-sha'
    }
  });

  const result = runScript(validateQualityPath, root, { GITHUB_SHA: 'current-sha' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('REQUIRE_NEWSLETTER_QUALITY forces strict missing claims validation', () => {
  const root = tempRoot('validate-quality-require-quality-missing-claims-');
  writeMissingClaimsQualityFixture(root);

  const result = runScript(validateQualityPath, root, { REQUIRE_NEWSLETTER_QUALITY: '1' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('stale generation status sha does not make validate-quality strict', () => {
  const root = tempRoot('validate-quality-stale-generation-status-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date });
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'NEEDS_FIX',
    run_context: {
      github_sha: 'stale-sha'
    }
  });

  const result = runScript(validateQualityPath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /historical artifact outside current\/changed\/generated validation target, warning only/);
});
