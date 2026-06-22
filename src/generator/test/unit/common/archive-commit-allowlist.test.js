'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { retentionCommitAllowlist } = require('../../../publish/review-artifact-inventory');

// #697: syncArchivePublicationState가 발행 시 디스크에 기록하는 archive 발행상태
// sidecar/ledger가 생성 PR add-paths에 담기도록 retentionCommitAllowlist에 포함되어야
// 한다(present일 때). 이게 빠져 매번 수동 reconcile chore가 필요했다. allowlist 포함은
// 파일 존재(present)와 분류 등급에만 의존하므로, 파일을 직접 만들어 그 동작을 고정한다.

const SIDECAR = 'articles/content/audit/historical-archive-status.json';
const LEDGER = 'articles/content/audit/newsletter-provenance-ledger.md';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'archive-allowlist-'));
}

function writeAuditFiles(root) {
  const auditDir = path.join(root, 'articles', 'content', 'audit');
  fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(auditDir, 'historical-archive-status.json'), '[]\n', 'utf8');
  fs.writeFileSync(path.join(auditDir, 'newsletter-provenance-ledger.md'), '# Provenance ledger\n', 'utf8');
}

test('retentionCommitAllowlist includes the archive audit sidecar and ledger when present', () => {
  const root = tempRoot();
  writeAuditFiles(root);
  const allow = retentionCommitAllowlist({ root, date: '2026-06-22', runContext: { publicOutputExpected: true } });
  assert.ok(allow.includes(SIDECAR), allow.join('\n'));
  assert.ok(allow.includes(LEDGER), allow.join('\n'));
});

test('retentionCommitAllowlist omits the archive audit files when absent', () => {
  const root = tempRoot();
  const allow = retentionCommitAllowlist({ root, date: '2026-06-22', runContext: { publicOutputExpected: true } });
  assert.ok(!allow.includes(SIDECAR), allow.join('\n'));
  assert.ok(!allow.includes(LEDGER), allow.join('\n'));
});
