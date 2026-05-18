const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsletterQualityReport
} = require('../../scripts/lib/newsletter-quality');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../../scripts/lib/newsletter-policy');
const {
  reporterCandidatesFor,
  validSections
} = require('../helpers/quality-builders');
const {
  tempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');

const repoRoot = path.join(__dirname, '..', '..');
const validateSitePath = path.join(repoRoot, 'scripts', 'newsroom', 'cli', 'validate-site.js');
const validateQualityPath = path.join(repoRoot, 'scripts', 'newsroom', 'cli', 'validate-quality.js');

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
    '# Camera HAL SW Newsletter',
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

function newsletterHtml(date, { tags = ['camera-hal'] } = {}) {
  const tagHtml = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
  return [
    '<!doctype html>',
    '<html><body>',
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

function rootIndexHtml(extra = '') {
  return [
    '<!doctype html><html><body>',
    '<div id="latest-card"></div>',
    '<div id="archive-list"></div>',
    extra,
    '<script>',
    "async function loadNewsletters() { const latest = {}; const archive = []; await fetch('data/newsletters.json'); }",
    'loadNewsletters();',
    '</script>',
    '</body></html>'
  ].join('\n');
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
  writeJson(path.join(root, 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL SW Newsletter',
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: dataTags
  }]);
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), newsletterMarkdown(date, count, { todo }));
  writeText(path.join(root, 'newsletters', date, 'index.html'), newsletterHtml(date, { tags: htmlTags }));
  writeText(path.join(root, 'index.html'), rootIndexHtml());
  if (factCheckMustFix || sourceGapCount !== null) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
      status: factCheckMustFix ? 'NEEDS_FIX' : 'PASS',
      must_fix: factCheckMustFix ? ['CameraX release has an unresolved source claim.'] : [],
      source_gaps: sourceGapCount > 0 ? ['CameraX release has a source gap.'] : [],
      source_gap_count: sourceGapCount ?? 0
    });
  }
  if (staleClaimHardFailure) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'stale-claim-report.json'), {
      status: 'NEEDS_FIX',
      stale_claim_items_removed: [],
      unsupported_release_claims_removed: [],
      hard_failures: [{ reason: 'removed-section-claim-remains' }]
    });
  }
  if (editorApprovedException) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), {
      final_publish_ready: false,
      editor_review_required: true,
      public_newsletter_ready: true,
      review_publication_ready: true,
      diagnostics_only: false,
      homepage_visible_after_merge: true,
      review_publication_ready_reason: 'Only two independent camera-stack public articles remain.',
      ...statusOverrides
    });
    writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
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

function writeQualityFixture(root, { date = '2026-04-01', strict = false } = {}) {
  writeJson(path.join(root, 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL SW Newsletter',
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
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  writeJson(path.join(newsroomDir, 'quality-report.json'), staleReport);
  if (strict) {
    writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  }
}

function writeMissingClaimsQualityFixture(root, { date = '2026-04-01', strictReport = false } = {}) {
  writeJson(path.join(root, 'data', 'newsletters.json'), [{
    date,
    title: 'Camera HAL SW Newsletter',
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
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  writeJson(path.join(newsroomDir, 'editor-draft.json'), editor);
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
  writeJson(path.join(newsroomDir, 'quality-report.json'), report);
}

function writeDiagnosticsOnlyStatus(root, date, overrides = {}) {
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), {
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'public-retention.json'), {
    retain_existing_public: true,
    date,
    scope: 'same_date_diagnostics_only',
    reason: 'Editor approved retaining this previous public issue after a later diagnostics-only run.',
    approved_by: 'editor',
    approved_at: date,
    retained_public_artifacts: [
      `newsletters/${date}/index.html`,
      `newsletters/${date}/newsletter.md`
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
  assert.match(result.stderr, /HTML issue tags \[Camera HAL, Android, AI\] do not match data\/newsletters\.json tags \[Camera HAL, Android\]/);
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
  assert.match(result.stderr, /diagnostics-only but data\/newsletters\.json exposes it/);
  assert.match(result.stderr, /Remove the 2026-05-18 entry from data\/newsletters\.json/);
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
  assert.match(result.stderr, /Invalid content\/newsroom\/2026-05-18\/public-retention\.json/);
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
  assert.doesNotMatch(result.stderr, /diagnostics-only but data\/newsletters\.json exposes it/);
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
  assert.match(result.stderr, /quality score \d+\/85 does not pass: NEEDS_FIX/);
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), {
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
