const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PUBLIC_ARTIFACT_POLICIES,
  PUBLIC_STATES,
  RECONCILIATION_ACTIONS,
  RUN_MODES,
  classifyLatestPublicState,
  reconcilePublicState,
  validateRetentionMetadata
} = require('../../scripts/newsroom/common/public-state-reconciliation');
const {
  readJson,
  tempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');

function writeRootIndex(root) {
  writeText(path.join(root, 'index.html'), [
    '<!doctype html><html><body>',
    '<div id="latest-card"></div>',
    '<div id="archive-list"></div>',
    '<script>',
    "async function loadNewsletters() { await fetch('data/newsletters.json'); }",
    'loadNewsletters();',
    '</script>',
    '</body></html>'
  ].join('\n'));
}

function writePublicArtifacts(root, date, overrides = {}) {
  writeText(path.join(root, 'newsletters', date, 'index.html'), overrides.html || '<!doctype html><html><body>issue</body></html>');
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), overrides.md || '# Issue\n');
  writeJson(path.join(root, 'data', 'newsletters.json'), overrides.items || [{
    date,
    title: `Issue ${date}`,
    summary: 'Summary',
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['Camera HAL']
  }]);
  writeRootIndex(root);
}

function writeStatus(root, date, status) {
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), { date, ...status });
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), { date, ...status });
}

function writeRetention(root, date, overrides = {}) {
  writeJson(path.join(root, 'content', 'newsroom', date, 'public-retention.json'), {
    retain_existing_public: true,
    date,
    scope: 'same_date_diagnostics_only',
    reason: 'Editor approved retaining this public issue.',
    approved_by: 'editor',
    approved_at: date,
    retained_public_artifacts: [
      `newsletters/${date}/index.html`,
      `newsletters/${date}/newsletter.md`
    ],
    ...overrides
  });
}

function readNewsletters(root) {
  return readJson(path.join(root, 'data', 'newsletters.json'));
}

test('classifyLatestPublicState returns fixed public states', () => {
  const root = tempRoot('public-state-classify-');
  const date = '2026-05-18';
  writePublicArtifacts(root, date);

  assert.equal(
    classifyLatestPublicState({
      root,
      date,
      status: {
        date,
        final_publish_ready: true,
        public_newsletter_ready: true
      }
    }),
    PUBLIC_STATES.PUBLISH_READY
  );

  writeJson(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), {
    fallback_public_issue_status: 'CREATED'
  });
  assert.equal(
    classifyLatestPublicState({
      root,
      date,
      status: {
        date,
        final_publish_ready: false,
        public_newsletter_ready: true,
        review_publication_ready: true
      }
    }),
    PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED
  );

  writeRetention(root, date);
  assert.equal(
    classifyLatestPublicState({
      root,
      date,
      status: {
        date,
        status: 'UNDERFILLED_NEEDS_FIX',
        final_publish_ready: false,
        public_newsletter_ready: false,
        review_publication_ready: false
      }
    }),
    PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC
  );
});

test('reconcilePublicState emits only fixed policy, action, and run_mode values', () => {
  const allowedPolicies = new Set(Object.values(PUBLIC_ARTIFACT_POLICIES));
  const allowedActions = new Set(Object.values(RECONCILIATION_ACTIONS));
  const allowedRunModes = new Set(Object.values(RUN_MODES));
  const root = tempRoot('public-state-enum-');
  const date = '2026-05-18';
  writePublicArtifacts(root, date);

  const cases = [
    {
      status: { date, final_publish_ready: true, public_newsletter_ready: true }
    },
    {
      prepare() {
        writeJson(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), {
          fallback_public_issue_status: 'CREATED'
        });
      },
      status: { date, final_publish_ready: false, public_newsletter_ready: true, review_publication_ready: true }
    },
    {
      prepare() {
        writeRetention(root, date);
      },
      status: {
        date,
        status: 'UNDERFILLED_NEEDS_FIX',
        final_publish_ready: false,
        public_newsletter_ready: false,
        review_publication_ready: false
      }
    }
  ];

  for (const item of cases) {
    item.prepare?.();
    const result = reconcilePublicState({
      root,
      date,
      status: item.status,
      write: false
    });
    assert.equal(allowedPolicies.has(result.outputs.public_artifact_policy), true);
    assert.equal(allowedActions.has(result.outputs.reconciliation_action), true);
    assert.equal(allowedRunModes.has(result.outputs.run_mode), true);
  }
});

test('diagnostics-only reconciliation removes only data index entry by default', () => {
  const root = tempRoot('public-state-hide-index-');
  const date = '2026-05-18';
  writePublicArtifacts(root, date);
  const status = {
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    final_publish_ready: false,
    public_newsletter_ready: false,
    review_publication_ready: false
  };
  writeStatus(root, date, status);

  const result = reconcilePublicState({
    root,
    date,
    status,
    changedArtifacts: [`content/newsroom/${date}/selection-report.json`],
    write: true
  });

  assert.equal(readNewsletters(root).some(item => item.date === date), false);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), true);
  assert.equal(result.outputs.effective_homepage_visible, 'false');
  assert.equal(result.outputs.public_artifact_policy, 'hide_existing_public_artifact_after_latest_diagnostics_only');
  assert.equal(result.changedArtifacts.includes('data/newsletters.json'), true);
  assert.equal(result.changedArtifacts.includes(`content/newsroom/${date}/generation-status.json`), true);

  const canonicalStatus = readJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'));
  const tmpStatus = readJson(path.join(root, '.tmp', 'newsletter-generation-status.json'));
  assert.deepEqual(canonicalStatus, tmpStatus);
  assert.equal(canonicalStatus.effective_homepage_visible, false);
});

test('invalid retention is ignored during reconcile and recorded in status', () => {
  const root = tempRoot('public-state-invalid-retention-');
  const date = '2026-05-18';
  writePublicArtifacts(root, date);
  writeRetention(root, date, { approved_at: '' });
  const status = {
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    final_publish_ready: false,
    public_newsletter_ready: false,
    review_publication_ready: false
  };

  const result = reconcilePublicState({ root, date, status, write: true });

  assert.equal(result.outputs.retention_valid, 'false');
  assert.match(result.outputs.retention_error, /approved_at/);
  assert.equal(result.outputs.public_artifact_policy, 'invalid_retention_ignored');
  assert.equal(result.outputs.reconciliation_action, 'invalid_retention_ignored_and_removed_index_entry');
  assert.equal(readNewsletters(root).some(item => item.date === date), false);
});

test('valid retention with missing file or hash mismatch is not visible', () => {
  const root = tempRoot('public-state-retention-file-hash-');
  const date = '2026-05-18';
  writePublicArtifacts(root, date);
  writeRetention(root, date);
  fs.rmSync(path.join(root, 'newsletters', date, 'newsletter.md'));

  let retention = validateRetentionMetadata({ root, date });
  assert.equal(retention.valid, false);
  assert.match(retention.error, /retained public artifact missing/);

  writePublicArtifacts(root, date);
  writeRetention(root, date, {
    retained_public_artifact_hashes: {
      [`newsletters/${date}/index.html`]: `sha256:${'0'.repeat(64)}`
    }
  });
  retention = validateRetentionMetadata({ root, date });
  assert.equal(retention.valid, false);
  assert.match(retention.error, /hashes mismatch/);
});
