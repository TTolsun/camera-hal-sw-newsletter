const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsletterQualityReport
} = require('../scripts/lib/newsletter-quality');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../scripts/lib/newsletter-policy');
const {
  reporterCandidatesFor,
  validSections
} = require('./helpers/quality-builders');

const repoRoot = path.join(__dirname, '..');
const validateSitePath = path.join(repoRoot, 'scripts', 'newsroom', 'cli', 'validate-site.js');
const validateQualityPath = path.join(repoRoot, 'scripts', 'newsroom', 'cli', 'validate-quality.js');

function tempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runScript(scriptPath, root) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: '',
      GITHUB_BASE_REF: ''
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
  fs.mkdirSync(path.join(root, 'newsletters', date), { recursive: true });
  fs.writeFileSync(path.join(root, 'newsletters', date, 'newsletter.md'), newsletterMarkdown(date, count, { todo }), 'utf8');
  fs.writeFileSync(path.join(root, 'newsletters', date, 'index.html'), newsletterHtml(date, { tags: htmlTags }), 'utf8');
  fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html><body><a href="newsletters/${date}/">Archive</a></body></html>`, 'utf8');
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
      manual_publication_ready: true,
      public_newsletter_ready: true,
      editor_approved_exception: true,
      editor_approved_exception_reason: 'Only two independent camera-stack public articles remain.',
      ...statusOverrides
    });
    writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
      status: 'NEEDS_FIX',
      editor_approved_exception: true,
      editor_approved_exception_reason: 'Only two independent camera-stack public articles remain.',
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
    fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
    fs.writeFileSync(path.join(root, '.tmp', 'newsletter-date.txt'), date, 'utf8');
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
    fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
    fs.writeFileSync(path.join(root, '.tmp', 'newsletter-date.txt'), date, 'utf8');
  }
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

test('strict validate-site article count drift allows explicit editor-approved exception', () => {
  const root = tempRoot('validate-site-editor-exception-');
  writeSiteFixture(root, {
    strict: true,
    editorApprovedException: true
  });

  const result = runScript(validateSitePath, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /editor-approved exception/);
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

test('strict editor-approved exception applies only to composition-only blockers', () => {
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
    const root = tempRoot(`validate-site-editor-exception-${testCase.name}-`);
    writeSiteFixture(root, {
      strict: true,
      editorApprovedException: true,
      ...testCase.options
    });

    const result = runScript(validateSitePath, root);

    assert.notEqual(result.status, 0, testCase.name);
    assert.match(result.stderr, /expected Newsletter Policy range/, testCase.name);
    assert.doesNotMatch(result.stderr, /editor-approved exception/, testCase.name);
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
