const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 발행 orchestrator의 process/runtime IO 헬퍼를 입력→출력으로 고정한다(#655).
// readSeedEvidencePackForDate(없으면 null/있으면 파싱)·containsTodo(TODO 마커 감지)·
// runNpmScript(플랫폼별 execFileSync 명령 구성)·runValidate(site+images 위임)를 검증한다.

const RUNNER_PATH = require.resolve('../../publish/orchestrator-validate-runner');
const CHILD_PROCESS_PATH = require.resolve('child_process');

const {
  readSeedEvidencePackForDate,
  containsTodo
} = require(RUNNER_PATH);

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('readSeedEvidencePackForDate: pack이 없으면 null을 반환한다', () => {
  const root = tempDir('validate-runner-absent-');
  try {
    assert.equal(readSeedEvidencePackForDate('2026-06-23', root), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('readSeedEvidencePackForDate: pack이 있으면 JSON을 파싱해 반환한다', () => {
  const root = tempDir('validate-runner-present-');
  try {
    const date = '2026-06-23';
    const dir = path.join(root, 'articles', 'content', 'collected-news', date);
    fs.mkdirSync(dir, { recursive: true });
    const pack = { date, evidence: [{ id: 'e1' }] };
    fs.writeFileSync(path.join(dir, 'seed-evidence-pack.json'), JSON.stringify(pack), 'utf8');
    assert.deepEqual(readSeedEvidencePackForDate(date, root), pack);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('containsTodo: 어떤 파일이라도 TODO 마커가 있으면 true, 없거나 부재면 false', () => {
  const dir = tempDir('validate-runner-todo-');
  try {
    const withTodo = path.join(dir, 'with-todo.txt');
    const clean = path.join(dir, 'clean.txt');
    const missing = path.join(dir, 'missing.txt');
    fs.writeFileSync(withTodo, 'line\n// TODO fix this\n', 'utf8');
    fs.writeFileSync(clean, 'all good here\n', 'utf8');

    assert.equal(containsTodo([clean, withTodo]), true);
    assert.equal(containsTodo([clean]), false);
    assert.equal(containsTodo([missing]), false);
    // 부분 단어(TODOLIST)는 \bTODO\b 경계로 매치되지 않는다.
    const word = path.join(dir, 'word.txt');
    fs.writeFileSync(word, 'TODOLIST is not a marker\n', 'utf8');
    assert.equal(containsTodo([word]), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// runNpmScript/runValidate는 execFileSync를 stub해 실제 npm을 띄우지 않고 명령 구성만 검증한다.
function loadRunnerWithExecStub(execImpl) {
  const realChildProcess = require.cache[CHILD_PROCESS_PATH];
  require.cache[CHILD_PROCESS_PATH] = {
    id: CHILD_PROCESS_PATH,
    filename: CHILD_PROCESS_PATH,
    loaded: true,
    exports: { execFileSync: execImpl }
  };
  delete require.cache[RUNNER_PATH];
  const mod = require(RUNNER_PATH);
  function restore() {
    delete require.cache[RUNNER_PATH];
    if (realChildProcess) require.cache[CHILD_PROCESS_PATH] = realChildProcess;
    else delete require.cache[CHILD_PROCESS_PATH];
    // 이후 테스트가 실제 child_process를 쓰는 runner를 받도록 캐시를 비운다.
    require(RUNNER_PATH);
  }
  return { mod, restore };
}

test('runNpmScript: 플랫폼에 맞는 execFileSync 명령을 구성한다', () => {
  const calls = [];
  const { mod, restore } = loadRunnerWithExecStub((file, args, options) => {
    calls.push({ file, args, options });
    return 'stub-output';
  });
  try {
    const out = mod.runNpmScript('validate:site');
    assert.equal(out, 'stub-output');
    assert.equal(calls.length, 1);
    const { file, args, options } = calls[0];
    if (process.platform === 'win32') {
      assert.equal(file, 'cmd.exe');
      assert.deepEqual(args, ['/d', '/s', '/c', 'npm.cmd run validate:site']);
    } else {
      assert.equal(file, 'npm');
      assert.deepEqual(args, ['run', 'validate:site']);
    }
    assert.equal(options.encoding, 'utf8');
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.equal(typeof options.cwd, 'string');
  } finally {
    restore();
  }
});

test('runValidate: validate:site와 validate:images를 실행하고 ok:true로 합친다', () => {
  const scripts = [];
  const { mod, restore } = loadRunnerWithExecStub((file, args) => {
    const joined = args.join(' ');
    scripts.push(joined);
    return joined.includes('validate:site') ? 'site ok' : 'images ok';
  });
  try {
    const result = mod.runValidate();
    assert.equal(result.ok, true);
    assert.match(result.text, /site ok/);
    assert.match(result.text, /images ok/);
    assert.equal(scripts.length, 2);
  } finally {
    restore();
  }
});

test('runValidate: 스크립트 실패 시 ok:false와 stdout/stderr 텍스트를 반환한다', () => {
  const { mod, restore } = loadRunnerWithExecStub(() => {
    const error = new Error('exec failed');
    error.stdout = 'partial stdout';
    error.stderr = 'boom stderr';
    throw error;
  });
  try {
    const result = mod.runValidate();
    assert.equal(result.ok, false);
    assert.match(result.text, /partial stdout/);
    assert.match(result.text, /boom stderr/);
  } finally {
    restore();
  }
});
