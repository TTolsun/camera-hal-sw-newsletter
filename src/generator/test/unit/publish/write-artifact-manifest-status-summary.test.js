'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildManifest } = require('../../../publish/write-artifact-manifest');

// generation-status.json이 coverage lineage(대상 주·carry-forward 판정)를 갖고 있으면
// artifact-manifest.json의 status_summary도 그 값을 그대로 실어야 한다 — 리뷰어가 전체
// generation-status.json을 열지 않고 manifest 요약만으로도 대상 주·carry 상태를 확인할 수
// 있어야 한다.
test('artifact manifest status_summary carries coverage lineage from generation-status.json', () => {
  const snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-manifest-status-summary-'));
  const date = '2026-08-19';
  fs.mkdirSync(path.join(snapshotDir, '.tmp'), { recursive: true });
  fs.writeFileSync(path.join(snapshotDir, '.tmp', 'newsletter-date.txt'), date, 'utf8');
  fs.writeFileSync(
    path.join(snapshotDir, '.tmp', 'newsletter-generation-status.json'),
    JSON.stringify({
      date,
      status: 'PASS',
      coverage_week_key: '2026-W33',
      coverage_start_date: '2026-08-10',
      coverage_end_date: '2026-08-16',
      generation_anchor_date: date,
      carry_forward_status: 'overflow'
    }),
    'utf8'
  );

  const manifest = buildManifest(snapshotDir, date);

  assert.equal(manifest.status_summary.coverage_week_key, '2026-W33');
  assert.equal(manifest.status_summary.coverage_start_date, '2026-08-10');
  assert.equal(manifest.status_summary.coverage_end_date, '2026-08-16');
  assert.equal(manifest.status_summary.generation_anchor_date, date);
  assert.equal(manifest.status_summary.carry_forward_status, 'overflow');
});
