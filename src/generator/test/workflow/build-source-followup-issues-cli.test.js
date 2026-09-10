'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { main } = require('../../publish/build-source-followup-issues');
const { tempRoot, writeJson } = require('../../../shared/test/helpers/fs');

// 이 CLI는 돌리는 즉시 뉴스룸 회차 폴더에 draft 두 개를 쓴다. --dry-run은 그 쓰기를 건너뛰고
// 같은 draft 내용을 stdout으로만 내보내, 사람이 커밋 전에 읽어볼 수 있게 하는 경로다(#479).

// 연속 10회 기준을 넘기는 최소 회차. 픽스처 개수를 상수에서 파생시키지 않는다.
const RUN_DATES = [
  '2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03',
  '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'
];
const TARGET_DATE = '2026-09-07';
const SOURCE_ID = 'camerax-release-notes';

function stageRuns(root) {
  for (const date of RUN_DATES) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'source-quality-diagnosis.json'), {
      schema_version: 1,
      report_type: 'source-quality-diagnosis',
      date,
      source_breakdown: [{
        source_id: SOURCE_ID,
        source_name: `${SOURCE_ID} name`,
        reliability: 'official',
        priority: 'high',
        top_blockers: ['main_eligible=false'],
        parser_failure_signals: ['Official source produced candidates but parser rejections blocked eligibility.'],
        recommended_action: 'KEEP_AND_FIX_PARSER',
        recommended_action_label: 'KEEP_AND_FIX_PARSER label'
      }],
      recommended_issues: []
    });
  }
}

function draftPaths(root, date) {
  const runDir = path.join(root, 'articles', 'content', 'newsroom', date);
  return {
    json: path.join(runDir, 'source-followup-issues.json'),
    markdown: path.join(runDir, 'source-followup-issues.md')
  };
}

function runCapturingStdout(argv, root) {
  const lines = [];
  const original = console.log;
  console.log = message => lines.push(String(message));
  try {
    return { exitCode: main(argv, {}, root), stdout: lines.join('\n') };
  } finally {
    console.log = original;
  }
}

test('CLI: --dry-run은 파일을 쓰지 않고 draft를 stdout으로 낸다 (#479)', () => {
  const root = tempRoot('followup-cli-dry-run-');
  stageRuns(root);

  const { exitCode, stdout } = runCapturingStdout(['--dry-run', '--date', TARGET_DATE], root);

  const { json, markdown } = draftPaths(root, TARGET_DATE);
  assert.equal(exitCode, 0);
  assert.equal(fs.existsSync(json), false);
  assert.equal(fs.existsSync(markdown), false);
  assert.match(stdout, new RegExp(`# Source Follow-up Issue Drafts - ${TARGET_DATE}`));
  assert.match(stdout, new RegExp(SOURCE_ID));
  assert.match(stdout, /연속 10회/);
});

test('CLI: --dry-run이 없으면 기존대로 draft 두 개를 쓴다 (#479)', () => {
  const root = tempRoot('followup-cli-write-');
  stageRuns(root);

  const preview = runCapturingStdout(['--dry-run', '--date', TARGET_DATE], root);
  const { exitCode } = runCapturingStdout(['--date', TARGET_DATE], root);

  const { json, markdown } = draftPaths(root, TARGET_DATE);
  assert.equal(exitCode, 0);
  assert.equal(fs.existsSync(json), true);
  assert.equal(fs.existsSync(markdown), true);
  assert.match(fs.readFileSync(markdown, 'utf8'), new RegExp(SOURCE_ID));
  // 미리보기가 쓰이는 파일과 갈라지면 --dry-run이 거짓말이 된다. 같은 draft를 낸다는 것을
  // 주석이 아니라 이 비교가 잠근다.
  assert.equal(preview.stdout, fs.readFileSync(markdown, 'utf8'));
});

// --dry-run만 이 CLI가 직접 걷어내고 나머지는 공유 파서에 넘긴다. 공유 파서가 알 수 없는
// 인자를 던지는 동작이 그대로 남아 있어야 오타가 조용히 무시되지 않는다.
test('CLI: 알 수 없는 인자는 --dry-run과 함께 와도 거부한다 (#479)', () => {
  const root = tempRoot('followup-cli-unknown-arg-');

  assert.throws(
    () => main(['--dry-run', '--no-such-flag'], {}, root),
    /Unknown argument: --no-such-flag/
  );
});
