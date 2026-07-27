const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { main } = require('../../publish/build-hal-signal-quality-report');
const { tempRoot } = require('../../../shared/test/helpers/fs');

// generate(orchestrator)가 리뷰 패키지 작성 전에 hal-signal-quality-report를 생성하므로,
// 워크플로우의 always() 스텝은 generate가 리뷰 패키지 작성 전에 죽은 경우의 진단 백필로만 동작한다.
// 이미 있는 리포트를 덮어쓰면 generated_at만 바뀐 바이트가 artifact-manifest.json의
// sha256과 어긋나므로, --skip-if-present가 그 재생성을 막는다.

function reportPaths(root, date) {
  const reportDir = path.join(root, 'articles', 'content', 'newsroom', date);
  return {
    json: path.join(reportDir, 'hal-signal-quality-report.json'),
    markdown: path.join(reportDir, 'hal-signal-quality-report.md')
  };
}

test('CLI: --skip-if-present는 리포트가 없으면 정상 생성한다', () => {
  const root = tempRoot('hal-signal-cli-');
  const date = '2026-05-08';

  const exitCode = main(['--date', date, '--skip-if-present'], {}, root);

  const { json, markdown } = reportPaths(root, date);
  assert.equal(exitCode, 0);
  assert.ok(fs.existsSync(json));
  assert.ok(fs.existsSync(markdown));
});

test('CLI: --skip-if-present는 이미 있는 리포트를 덮어쓰지 않는다', () => {
  const root = tempRoot('hal-signal-cli-');
  const date = '2026-05-08';
  const { json, markdown } = reportPaths(root, date);
  fs.mkdirSync(path.dirname(json), { recursive: true });
  fs.writeFileSync(json, '{"marker":"generate 단계에서 쓴 리포트"}\n', 'utf8');
  fs.writeFileSync(markdown, '# generate 단계에서 쓴 리포트\n', 'utf8');

  const exitCode = main(['--date', date, '--skip-if-present'], {}, root);

  assert.equal(exitCode, 0);
  assert.equal(fs.readFileSync(json, 'utf8'), '{"marker":"generate 단계에서 쓴 리포트"}\n');
  assert.equal(fs.readFileSync(markdown, 'utf8'), '# generate 단계에서 쓴 리포트\n');
});

test('CLI: --skip-if-present여도 리포트 한 쪽만 있으면 온전한 쌍으로 재생성한다', () => {
  const root = tempRoot('hal-signal-cli-');
  const date = '2026-05-08';
  const { json, markdown } = reportPaths(root, date);
  fs.mkdirSync(path.dirname(markdown), { recursive: true });
  fs.writeFileSync(markdown, '# json 없이 남은 리포트\n', 'utf8');

  const exitCode = main(['--date', date, '--skip-if-present'], {}, root);

  assert.equal(exitCode, 0);
  assert.ok(fs.existsSync(json));
  assert.notEqual(fs.readFileSync(markdown, 'utf8'), '# json 없이 남은 리포트\n');
});

test('CLI: 플래그 없이 실행하면 기존 리포트를 재생성한다', () => {
  const root = tempRoot('hal-signal-cli-');
  const date = '2026-05-08';
  const { json, markdown } = reportPaths(root, date);
  fs.mkdirSync(path.dirname(json), { recursive: true });
  fs.writeFileSync(json, '{"marker":"오래된 리포트"}\n', 'utf8');
  fs.writeFileSync(markdown, '# 오래된 리포트\n', 'utf8');

  const exitCode = main(['--date', date], {}, root);

  assert.equal(exitCode, 0);
  assert.notEqual(fs.readFileSync(json, 'utf8'), '{"marker":"오래된 리포트"}\n');
  assert.notEqual(fs.readFileSync(markdown, 'utf8'), '# 오래된 리포트\n');
});
