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
const validateSitePath = path.join(repoRoot, 'src', 'generator', 'validate', 'validate-site.js');
const validateQualityPath = path.join(repoRoot, 'src', 'generator', 'validate', 'validate-quality.js');

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

// 발행 페이지의 실제 shell 을 그대로 흉내낸다. 예전에는 `<nav class="site-nav">` 를 만들었는데
// 리디자인 이후 그 마크업을 쓰는 페이지는 0개였고, 그 어긋남 때문에 validate-site 의 나브 검사가
// 픽스처에서만 살아 있었다(라이브 53개에서 no-op). 픽스처가 실제 표면과 갈리면 같은 일이 반복된다.
function newsletterHtml(date, { tags = ['camera-hal'] } = {}) {
  const tagHtml = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
  return [
    '<!doctype html>',
    '<html><body class="homepage newsletter-issue-page">',
    '<header class="site-header homepage-site-header">',
    '<div class="homepage-nav content-wrap">',
    '<a class="site-brand homepage-brand" href="../../index.html" aria-label="Camera SW Newsroom">',
    '<span class="brand-name">Camera SW <span class="brand-subtitle">Newsroom</span></span>',
    '</a>',
    '<div class="nav-links homepage-nav-links" aria-label="Primary navigation">',
    '<a href="../../index.html">홈</a>',
    '<a href="../../archive.html">아카이브</a>',
    '<a href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>',
    '</div>',
    '</div>',
    '</header>',
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

// 실제 index.html 과 같은 형태: site-header.js 를 로드하면서도 정적 헤더 마크업을 직접 갖는다.
// (data-site-header 를 쓰는 공개 페이지는 0개다 — 그 컴포넌트는 현재 아무것도 mount 하지 않는다.)
function rootSiteHeaderHtml() {
  return [
    '<script src="assets/js/site-header.js" defer></script>',
    '<header class="site-header homepage-site-header">',
    '<div class="homepage-nav content-wrap">',
    '<a class="site-brand homepage-brand" href="index.html" aria-label="Camera SW Newsroom">Camera SW Newsroom</a>',
    '<div class="nav-links homepage-nav-links" aria-label="Primary navigation">',
    '<a href="index.html">홈</a>',
    '<a href="archive.html">아카이브</a>',
    '<a href="https://github.com/TTolsun/camera-hal-sw-newsletter">GitHub</a>',
    '</div>',
    '</div>',
    '</header>'
  ].join('\n');
}

function rootIndexHtml(extra = '') {
  return [
    '<!doctype html><html><body>',
    rootSiteHeaderHtml(),
    '<a class="section-link" href="archive.html">전체 아카이브 보기</a>',
    '<div id="featured-card"></div>',
    '<div id="latest-grid"></div>',
    '<section class="section subscribe-section" data-subscription-section hidden>',
    '<a class="button subscribe-link" data-subscription-action>Subscribe</a>',
    '</section>',
    extra,
    // 홈 인라인 스크립트가 window.NewsletterArchive 를 쓰므로 실제 index.html 처럼 먼저 로드한다.
    '<script src="assets/js/newsletter-archive.js"></script>',
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
    rootSiteHeaderHtml(),
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
  // 발행된 저장소에는 홈·아카이브가 fetch하는 weekly 인덱스도 있고 구조 검증이 둘 다
  // 스캔한다. 이 fixture는 daily 호만 모델링하므로 weekly는 엔트리 없이 존재만 한다.
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), []);
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), newsletterMarkdown(date, count, { todo }));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), newsletterHtml(date, {
    tags: htmlTags
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
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), []);
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

function writeQualityFixture(root, { date = '2026-04-01', strict = false, lowerThreshold = true } = {}) {
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
  const threshold = lowerThreshold ? Math.max(0, qualityGatePolicy.threshold - 1) : qualityGatePolicy.threshold;
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

// 임시 fixture 루트를 "발행 완료" 상태의 git 저장소로 만든다: 지정한 파일만 커밋하고
// 그 커밋을 origin/main으로 가리키게 해, worktree 파일이 발행본과 byte 동일한 상황을 재현한다.
function publishCommittedArtifacts(root, relPaths) {
  const run = (args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  };
  run(['init']);
  run(['add', '--', ...relPaths]);
  run([
    '-c', 'user.name=validator-strictness-test',
    '-c', 'user.email=validator-strictness-test@example.com',
    '-c', 'commit.gpgsign=false',
    'commit', '--no-verify', '-m', 'published state'
  ]);
  run(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
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

test('validate-site rejects root homepage without shared helper reference', () => {
  const root = tempRoot('validate-site-homepage-helper-');
  writeSiteFixture(root, {
    articleCount: articlePolicy.mainArticleCount.min
  });
  writeText(path.join(root, 'index.html'), rootIndexHtml().replace('<script src="assets/js/newsletter-archive.js"></script>', ''));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /root index\.html must load assets\/js\/newsletter-archive\.js/);
});

// 발행 레인은 위클리인데 htmlFiles 가 newsletters.json(dated)만 돌던 시절에는 위클리 이슈
// 페이지와 Lab 페이지가 HTML 계약 검사를 한 번도 받지 않았다. 아래 셋이 그 커버리지를 잠근다.

function addWeeklyIssue(root, weeklyKey, html) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey,
    html: `newsletters/${weeklyKey}/index.html`
  }]);
  writeText(path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'), html);
}

// 이 파일의 픽스처는 몇 달 동안 리디자인 이전 shell(`<nav class="site-nav">`)을 만들었고, 그래서
// 그 마크업을 찾던 validate-site 검사가 픽스처에서만 초록인 채 라이브 53개에서는 아무것도 하지
// 않았다. 실제 페이지에 0개인 마크업을 픽스처가 다시 쓰기 시작하면 같은 일이 반복되므로 막는다.
test('site fixtures model markup that published pages actually use', () => {
  // shell 을 이어 붙여 한 번에 보면 하나가 실제 마크업을 잃어도 나머지가 대신 만족시킨다 — 실제로
  // 아카이브 픽스처만 헤더를 빼도 통과했다. shell 마다 따로 본다.
  const shells = {
    newsletter: newsletterHtml('2026-04-01'),
    index: rootIndexHtml(),
    archive: rootArchiveHtml()
  };
  for (const [name, shell] of Object.entries(shells)) {
    for (const dead of ['site-nav', 'data-site-header']) {
      assert.doesNotMatch(
        shell,
        new RegExp(dead),
        `${name}: ${dead} 는 발행 페이지 53개 중 0개가 쓰는 마크업이다`
      );
    }
    // 실제 shell 의 표식. 이게 빠지면 그 픽스처가 다시 갈라진 것이다.
    assert.match(shell, /<header class="site-header homepage-site-header">/, `${name}: 헤더 shell`);
    assert.match(shell, /class="nav-links homepage-nav-links"/, `${name}: 나브 컨테이너`);
  }
});

test('validate-site scans weekly issue pages, not just dated ones', () => {
  const root = tempRoot('validate-site-weekly-scan-');
  writeSiteFixture(root, { articleCount: articlePolicy.mainArticleCount.min });
  // dated 호는 멀쩡하고 위클리 쪽에만 TODO 를 심는다 — dated 만 돌면 통과해 버리던 자리다.
  addWeeklyIssue(root, '2026-W21', newsletterHtml('2026-05-23').replace('<main>', '<main><p>TODO</p>'));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Published HTML contains TODO: newsletters\/2026-W21\/index\.html/);
});

test('validate-site scans the AI Engineering Lab page', () => {
  const root = tempRoot('validate-site-learning-scan-');
  writeSiteFixture(root, { articleCount: articlePolicy.mainArticleCount.min });
  writeText(
    path.join(root, 'articles', 'learning', 'ai-engineering', 'index.html'),
    '<!doctype html><html><body><a href="#x">unclosed</body></html>'
  );

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Anchor tag mismatch in learning\/ai-engineering\/index\.html/);
});

// 위클리 목록이 깨지면 htmlFiles 가 조용히 비어 발행 레인 전체가 무검사로 나간다. 그 방어는
// validate-site 가 아니라 rendered-issue-structure.js(NEWSLETTER_INDEX_PATHS)가 한다 — validate-site
// 는 그 결과에 기대어 목록을 읽기만 한다. 의존하는 계약이므로 여기서 통합으로 잠근다.
test('validate-site fails when the weekly index it reads is missing or malformed', () => {
  const cases = [
    ['missing', null, /Missing articles\/data\/newsletters-weekly\.json/],
    ['not json', 'not json at all', /Invalid JSON in articles\/data\/newsletters-weekly\.json/],
    ['an object', '{}', /articles\/data\/newsletters-weekly\.json must contain an array/]
  ];
  for (const [label, contents, expected] of cases) {
    const root = tempRoot(`validate-site-weekly-index-${label.replace(/\s+/g, '-')}-`);
    writeSiteFixture(root, { articleCount: articlePolicy.mainArticleCount.min });
    const indexPath = path.join(root, 'articles', 'data', 'newsletters-weekly.json');
    if (contents === null) fs.rmSync(indexPath);
    else writeText(indexPath, contents);

    const result = runScript(validateSitePath, root);

    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, expected, label);
  }
});

test('validate-site rejects a weekly index entry whose page is missing', () => {
  const root = tempRoot('validate-site-weekly-page-missing-');
  writeSiteFixture(root, { articleCount: articlePolicy.mainArticleCount.min });
  // 렌더가 실패해 페이지가 없어도 홈·아카이브는 그 카드를 링크한다. 조용히 건너뛰면 안 된다.
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{
    weeklyKey: '2026-W21',
    html: 'newsletters/2026-W21/index.html'
  }]);

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Weekly newsletter 2026-W21 html file does not exist/);
});

// 필수 클래스는 class 토큰으로 본다. 부분 문자열로 보면 본문에 이름이 글자로만 나와도 통과해
// 실제로는 그 블록이 없는 페이지가 발행된다.
//
// 위클리 페이지로 검사한다. dated 호는 rendered-issue-structure.js 가 같은 네 클래스를 이미
// 토큰으로 보므로 그쪽에서 잡혀 이 루프의 판정이 드러나지 않는다 — 그 구조 검사는 dated 루프
// 안에서만 돌기 때문에, 위클리에서는 여기가 유일한 검사다.
test('validate-site requires the issue classes as class tokens on weekly pages', () => {
  const root = tempRoot('validate-site-class-token-');
  writeSiteFixture(root, { articleCount: articlePolicy.mainArticleCount.min });
  // reference-list 만 클래스가 아니라 본문 글자로 남긴다(뒤따르는 블록 스캔이 없는 클래스라
  // 이 검사만 단독으로 갈린다).
  addWeeklyIssue(root, '2026-W21', newsletterHtml('2026-05-23').replace(
    '<ul class="reference-list"><li><a href="https://example.com/reference">Reference</a></li></ul>',
    '<p>이 호에는 reference-list 가 없습니다.</p>'
  ));

  const result = runScript(validateSitePath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Newsletter HTML missing reference-list: newsletters\/2026-W21\/index\.html/);
});

// Lab 페이지는 스캔 대상이지만 `newsletters/` 접두어가 아니라 이슈 전용 검사는 받지 않는다.
// 그 경계가 넓어지면 briefing·source-list 가 없는 이 페이지가 즉시 막힌다.
test('validate-site scans the Lab page without applying issue-only checks', () => {
  const root = tempRoot('validate-site-learning-pass-');
  writeSiteFixture(root, { articleCount: articlePolicy.mainArticleCount.min });
  writeText(
    path.join(root, 'articles', 'learning', 'ai-engineering', 'index.html'),
    '<!doctype html><html><body><main><p>학습 과정</p><a href="../../index.html">홈</a></main></body></html>'
  );

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /learning\/ai-engineering/);
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

test('strict validate-quality threshold and recompute drift remain hard failures outside the published-unchanged residue exception', () => {
  const root = tempRoot('validate-quality-strict-');
  writeQualityFixture(root, { strict: true });

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality threshold is below current Newsletter Policy threshold/);
  assert.match(result.stderr, /quality report is stale/);
});

function publishedRecomputeInputPaths(date) {
  return [
    `articles/content/newsroom/${date}/quality-report.json`,
    `articles/content/newsroom/${date}/fact-check-report.json`,
    `articles/content/newsroom/${date}/reporter-candidates.json`
  ];
}

test('strict validate-quality recompute drift on a published-unchanged report downgrades to residue warning', () => {
  const root = tempRoot('validate-quality-residue-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date, strict: true, lowerThreshold: false });
  publishCommittedArtifacts(root, publishedRecomputeInputPaths(date));

  const result = runScript(validateQualityPath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /quality report is stale/);
  assert.match(result.stderr, /uncommitted local editor-draft\.json residue/);
  assert.doesNotMatch(result.stderr, /historical artifact outside current\/changed\/generated validation target/);
});

test('strict validate-quality recompute drift still fails when the report differs from origin/main', () => {
  const root = tempRoot('validate-quality-residue-strict-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date, strict: true, lowerThreshold: false });
  publishCommittedArtifacts(root, publishedRecomputeInputPaths(date));
  const reportPath = path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  writeJson(reportPath, { ...report, summary: 'locally modified after publication' });

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /uncommitted local editor-draft\.json residue/);
});

test('strict validate-quality recompute drift still fails when a committed recompute input differs from origin/main', () => {
  const root = tempRoot('validate-quality-input-drift-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date, strict: true, lowerThreshold: false });
  publishCommittedArtifacts(root, publishedRecomputeInputPaths(date));
  const factCheckPath = path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json');
  const factCheck = JSON.parse(fs.readFileSync(factCheckPath, 'utf8'));
  writeJson(factCheckPath, { ...factCheck, note: 'locally modified after publication' });

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /uncommitted local editor-draft\.json residue/);
});

test('strict validate-quality recompute drift still fails when the report is absent from origin/main', () => {
  const root = tempRoot('validate-quality-unpublished-');
  const date = '2026-04-01';
  writeQualityFixture(root, { date, strict: true, lowerThreshold: false });
  publishCommittedArtifacts(root, ['articles/data/newsletters.json']);

  const result = runScript(validateQualityPath, root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /quality report is stale/);
  assert.doesNotMatch(result.stderr, /uncommitted local editor-draft\.json residue/);
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
