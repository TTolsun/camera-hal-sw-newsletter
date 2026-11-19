'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  classifyArtifactPath,
  retentionCommitAllowlist
} = require('../../publish/review-artifact-inventory');
const { tempRoot, writeJson, writeText } = require('../../../shared/test/helpers/fs');

// 기기 우회 장부가 워크플로와 보존 목록에 "발행을 막지 않는 shadow 산출물"로만 연결됐는지 고정한다.

const WORKFLOW = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '.github', 'workflows', 'newsletters-03-editor-pr.yml'), 'utf8');
const DATE = '2026-11-16';

function stepBlock(name) {
  const start = WORKFLOW.indexOf(`- name: ${name}`);
  assert.notEqual(start, -1, `${name} 스텝이 없다`);
  const next = WORKFLOW.indexOf('\n      - name:', start + 1);
  return WORKFLOW.slice(start, next === -1 ? undefined : next);
}

test('워크플로 03의 장부 스텝은 always + continue-on-error이고 PR 커밋 목록 계산보다 앞이다', () => {
  const step = stepBlock('Generate quirk ledger report');
  assert.match(step, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.match(step, /continue-on-error:\s*true/);
  assert.match(step, /npm run report:quirk-ledger -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.ok(WORKFLOW.indexOf('- name: Generate quirk ledger report') < WORKFLOW.indexOf('- name: Resolve PR commit allowlist'));
});

test('장부 산출물은 공개 출력이 아니라 선정 진단 묶음의 소형 리뷰 산출물로 분류된다', () => {
  for (const relPath of [
    `articles/content/newsroom/${DATE}/quirk-ledger-report.json`,
    `articles/content/newsroom/${DATE}/quirk-ledger-report.md`
  ]) {
    const classified = classifyArtifactPath(relPath);
    assert.ok(classified, relPath);
    assert.notEqual(classified.group, 'public_output');
    assert.notEqual(classified.group, 'unknown_artifacts');
    assert.equal(classified.retention_grade, 'review_required_compact');
  }
});

test('PR 커밋 목록은 장부 보고서와 누적 상태를 담고, 없으면 담지 않는다', () => {
  const empty = tempRoot('quirk-allowlist-');
  const absent = retentionCommitAllowlist({ root: empty, date: DATE, runContext: { publicOutputExpected: true } });
  assert.ok(!absent.some(relPath => relPath.includes('quirk-ledger')), absent.join('\n'));

  const root = tempRoot('quirk-allowlist-');
  const newsroom = path.join(root, 'articles', 'content', 'newsroom', DATE);
  writeJson(path.join(newsroom, 'quirk-ledger-report.json'), {});
  writeText(path.join(newsroom, 'quirk-ledger-report.md'), '# 기기 우회 장부\n');
  writeJson(path.join(root, 'state', 'quirk-ledger.json'), {});
  const allow = retentionCommitAllowlist({ root, date: DATE, runContext: { publicOutputExpected: true } });
  for (const expected of [
    `articles/content/newsroom/${DATE}/quirk-ledger-report.json`,
    `articles/content/newsroom/${DATE}/quirk-ledger-report.md`,
    'state/quirk-ledger.json'
  ]) {
    assert.ok(allow.includes(expected), `${expected}\n${allow.join('\n')}`);
  }
});
