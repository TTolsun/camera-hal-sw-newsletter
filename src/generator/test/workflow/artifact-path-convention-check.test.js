const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  checkArtifactPathConvention
} = require('../../../shared/tooling/validate/artifact-path-convention-check');

// 실제 git 호출을 피하려고 _trackedPaths로 대상 목록을 주입하고, 매니페스트 내용만 임시 트리에 쓴다.
function seedManifest(root, date, paths) {
  const relPath = `articles/content/newsroom/${date}/artifact-manifest.json`;
  const absPath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify({ files: paths.map(p => ({ path: p })) }), 'utf8');
  return relPath;
}

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-path-convention-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const OLD_CONVENTION_DATE = '2026-06-11';
const ROOT_CONVENTION_DATE = '2026-08-24';

test('각 매니페스트가 자기 날짜의 규약을 지키면 통과한다', () => {
  withTempRoot(root => {
    const tracked = [
      seedManifest(root, OLD_CONVENTION_DATE, [`content/newsroom/${OLD_CONVENTION_DATE}/quality-report.json`, 'sitemap.xml']),
      seedManifest(root, ROOT_CONVENTION_DATE, [`articles/content/newsroom/${ROOT_CONVENTION_DATE}/quality-report.json`, 'articles/sitemap.xml'])
    ];
    const result = checkArtifactPathConvention({ root, _trackedPaths: tracked });
    assert.equal(result.ok, true);
    assert.equal(result.checkedManifestCount, 2);
    assert.deepEqual(result.violations, []);
  });
});

test('과거 매니페스트가 사후 정규화되면 잡는다', () => {
  withTempRoot(root => {
    const tracked = [seedManifest(root, OLD_CONVENTION_DATE, [`articles/content/newsroom/${OLD_CONVENTION_DATE}/quality-report.json`])];
    const result = checkArtifactPathConvention({ root, _trackedPaths: tracked });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0].reason, /접두가 붙었다/);
  });
});

test('새 매니페스트가 옛 규약으로 쓰이면 잡는다', () => {
  withTempRoot(root => {
    const tracked = [seedManifest(root, ROOT_CONVENTION_DATE, [`content/newsroom/${ROOT_CONVENTION_DATE}/quality-report.json`])];
    const result = checkArtifactPathConvention({ root, _trackedPaths: tracked });
    assert.equal(result.ok, false);
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0].reason, /저장소 루트 기준이 아니다/);
  });
});

// 검사가 아무것도 못 읽고 조용히 통과하는 것이 이 검사의 가장 위험한 실패 모드다.
// sparse checkout·partial clone에서 이 경로로 들어온다.
test('검사 대상이 하나도 없으면 통과가 아니라 위반이다', () => {
  withTempRoot(root => {
    const result = checkArtifactPathConvention({ root, _trackedPaths: [] });
    assert.equal(result.ok, false);
    assert.equal(result.checkedManifestCount, 0);
    assert.match(result.violations[0].reason, /하나도 읽지 못했다/);
  });
});

test('공개 출력물 경로가 없는 매니페스트는 판정 불가로 잡는다', () => {
  withTempRoot(root => {
    const tracked = [seedManifest(root, ROOT_CONVENTION_DATE, ['state/article-exposure-history.json'])];
    const result = checkArtifactPathConvention({ root, _trackedPaths: tracked });
    assert.equal(result.ok, false);
    assert.match(result.violations[0].reason, /검사하지 못했다/);
  });
});

test('깨진 매니페스트는 파일을 지목해 보고한다', () => {
  withTempRoot(root => {
    const relPath = `articles/content/newsroom/${ROOT_CONVENTION_DATE}/artifact-manifest.json`;
    const absPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, '{ broken', 'utf8');
    const result = checkArtifactPathConvention({ root, _trackedPaths: [relPath] });
    assert.equal(result.ok, false);
    assert.equal(result.violations[0].label, relPath);
    assert.match(result.violations[0].reason, /읽거나 파싱하지 못했다/);
  });
});

// 경계는 첫 관측(06-16)이 아니라 원인(#262 phase 6 머지 = 2026-06-13)에 맞춰져 있다. 커밋된
// 매니페스트는 06-11 다음이 06-16이라 실데이터에 경계 표본이 없으므로, 합성 매니페스트로 잠근다.
// 이 테스트가 없으면 상수를 06-12~06-16 사이 아무 값으로 바꿔도 전부 통과한다.
test('규약 경계는 2026-06-13이다 — 그 전날은 옛 규약, 당일은 루트 기준', () => {
  withTempRoot(root => {
    const beforeBoundary = seedManifest(root, '2026-06-12', ['content/newsroom/2026-06-12/quality-report.json']);
    const onBoundary = seedManifest(root, '2026-06-13', ['articles/content/newsroom/2026-06-13/quality-report.json']);
    const accepted = checkArtifactPathConvention({ root, _trackedPaths: [beforeBoundary, onBoundary] });
    assert.equal(accepted.ok, true, '06-12=옛 규약 / 06-13=루트 기준이 모두 통과해야 한다');

    const swapped = checkArtifactPathConvention({
      root,
      _trackedPaths: [
        seedManifest(root, '2026-06-12', ['articles/content/newsroom/2026-06-12/quality-report.json']),
        seedManifest(root, '2026-06-13', ['content/newsroom/2026-06-13/quality-report.json'])
      ]
    });
    assert.equal(swapped.ok, false, '두 날짜의 규약을 서로 바꾸면 둘 다 잡혀야 한다');
    assert.equal(swapped.violations.length, 2);
  });
});

// 판정 대상 배열이 조용히 좁아지는 것을 막는다 — 키가 빠지면 그 배열의 위반이 통과해 버린다.
test('files[] 말고도 review_artifacts·retained_heavy_artifacts·committed_artifacts를 본다', () => {
  withTempRoot(root => {
    const relPath = `articles/content/newsroom/${ROOT_CONVENTION_DATE}/artifact-manifest.json`;
    const absPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, JSON.stringify({
      files: [{ path: `articles/content/newsroom/${ROOT_CONVENTION_DATE}/quality-report.json` }],
      review_artifacts: [{ path: `content/newsroom/${ROOT_CONVENTION_DATE}/00-review-guide.md` }],
      retained_heavy_artifacts: [{ path: `content/newsroom/${ROOT_CONVENTION_DATE}/editor-draft.json` }],
      committed_artifacts: [{ path: `content/newsroom/${ROOT_CONVENTION_DATE}/selection-report.json` }]
    }), 'utf8');

    const result = checkArtifactPathConvention({ root, _trackedPaths: [relPath] });
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.violations.map(violation => violation.key).sort(),
      ['committed_artifacts', 'retained_heavy_artifacts', 'review_artifacts']
    );
  });
});

test('날짜 디렉터리가 아닌 경로는 경고로만 남기고 건너뛴다', () => {
  withTempRoot(root => {
    const result = checkArtifactPathConvention({ root, _trackedPaths: ['articles/content/newsroom/artifact-manifest.json'] });
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0].reason, /날짜 디렉터리가 아님/);
  });
});
