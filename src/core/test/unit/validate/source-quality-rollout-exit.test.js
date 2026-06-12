const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  validateSourceQualityRolloutExit
} = require('../../../tooling/validate/validate-source-quality-rollout-exit');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'source-quality-rollout-'));
}

function writeReport(root, date, overrides = {}) {
  const { summary: summaryOverrides, ...topLevelOverrides } = overrides;
  const summary = {
    source_url_quality_distribution: { official_dated_release: 1 },
    source_quality_status_summary: { allowed: 1 },
    source_quality_blocker_summary: {},
    selected_main_source_quality_coverage: {
      selected_main_count: 1,
      with_source_quality_count: 1
    },
    main_eligible_source_quality_coverage: {
      main_eligible_candidate_count: 1,
      with_source_quality_count: 1
    },
    conditional_source_promoted_count: 0,
    conditional_source_blocked_count: 0,
    unknown_source_quality_count: 0,
    source_quality_field_drift_count: 0,
    legacy_source_quality_warning_count: 0,
    ...summaryOverrides
  };
  const report = {
    schema_version: 2,
    date,
    summary,
    ...topLevelOverrides
  };
  const dir = path.join(root, 'content', 'newsroom', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'source-effectiveness-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
}

function run(root) {
  return validateSourceQualityRolloutExit({ root });
}

function assertFailsWith(result, pattern) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => pattern.test(error)), result.errors.join('\n'));
}

test('schema_version=1 report is excluded as legacy', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18');
  writeReport(root, '2026-05-16', { schema_version: 1, summary: {} });

  const result = run(root);

  assert.equal(result.ok, true);
  assert.equal(result.postRolloutReportsChecked, 2);
  assert.equal(result.legacyReportsExcluded, 1);
});

test('two valid schema_version=2 reports pass', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18');

  const result = run(root);

  assert.equal(result.ok, true);
  assert.match(result.table, /\| 2026-05-18 \| 2 \| 1\/1 \| 1\/1 \| 0 \| 0 \| 0 \| PASS \|/);
  assert.match(result.table, /\| 2026-05-17 \| 2 \| 1\/1 \| 1\/1 \| 0 \| 0 \| 0 \| PASS \|/);
});

test('only one post-rollout report fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-16', { schema_version: 1, summary: {} });

  const result = run(root);

  assertFailsWith(result, /only 1 post-rollout source-effectiveness report found\. Need 2\./);
});

test('schema_version=2 report missing required field fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18');
  const reportPath = path.join(root, 'content', 'newsroom', '2026-05-18', 'source-effectiveness-report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  delete report.summary.source_quality_field_drift_count;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const result = run(root);

  assertFailsWith(result, /2026-05-18 is schema_version=2 but missing summary\.source_quality_field_drift_count\./);
});

test('selected_main coverage mismatch fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18', {
    summary: {
      selected_main_source_quality_coverage: {
        selected_main_count: 3,
        with_source_quality_count: 2
      }
    }
  });

  const result = run(root);

  assertFailsWith(result, /2026-05-18 selected_main source_quality coverage mismatch: 2\/3\./);
});

test('main_eligible coverage mismatch fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18', {
    summary: {
      main_eligible_source_quality_coverage: {
        main_eligible_candidate_count: 4,
        with_source_quality_count: 3
      }
    }
  });

  const result = run(root);

  assertFailsWith(result, /2026-05-18 main_eligible source_quality coverage mismatch: 3\/4\./);
});

test('legacy_source_quality_warning_count greater than zero fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18', {
    summary: {
      legacy_source_quality_warning_count: 1
    }
  });

  const result = run(root);

  assertFailsWith(result, /2026-05-18 legacy_source_quality_warning_count=1\./);
});

test('source_quality_field_drift_count greater than zero fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18', {
    summary: {
      source_quality_field_drift_count: 1
    }
  });

  const result = run(root);

  assertFailsWith(result, /2026-05-18 source_quality_field_drift_count=1\./);
});

test('unknown_source_quality_count greater than zero fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18', {
    summary: {
      unknown_source_quality_count: 1
    }
  });

  const result = run(root);

  assertFailsWith(result, /2026-05-18 unknown_source_quality_count=1\./);
});

test('date mismatch between directory and report fails', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18', { date: '2026-05-17' });

  const result = run(root);

  assertFailsWith(result, /2026-05-18 source-effectiveness report date mismatch/);
});

test('Markdown-ready evidence table includes closure columns', () => {
  const root = tempRoot();
  writeReport(root, '2026-05-17');
  writeReport(root, '2026-05-18');

  const result = run(root);

  assert.match(result.table, /\| Date \| Schema \| Selected main SQ \| Main eligible SQ \| Legacy warning \| Drift \| Unknown \| Result \|/);
  assert.match(result.table, /\| 2026-05-18 \| 2 \| 1\/1 \| 1\/1 \| 0 \| 0 \| 0 \| PASS \|/);
});
