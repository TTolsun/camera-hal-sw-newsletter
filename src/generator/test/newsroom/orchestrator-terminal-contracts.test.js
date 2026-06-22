const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertJsonArtifactsReadable,
  assertTerminalPublicationContracts
} = require('../../publish/orchestrator-terminal-contracts');
const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 god-file에 인라인으로 있던 terminal publication 헬퍼를 입력→동작으로 고정한다.
// updateNewsletterData/persistHeadlineStateArtifacts는 module-level root/dataPath(process.cwd())에
// 묶이므로, cwd를 temp로 바꾼 뒤 모듈을 새로 require해 검증한다.

const CONTRACTS_MODULE = '../../publish/orchestrator-terminal-contracts';

function withCwd(dir, run) {
  const previous = process.cwd();
  const resolvedKey = require.resolve(CONTRACTS_MODULE);
  process.chdir(dir);
  delete require.cache[resolvedKey];
  try {
    const fresh = require(CONTRACTS_MODULE);
    return run(fresh);
  } finally {
    process.chdir(previous);
    delete require.cache[resolvedKey];
  }
}

test('assertJsonArtifactsReadable: 모든 파일이 파싱되면 통과하고, 깨진 JSON이면 던진다', () => {
  const dir = tempRoot('terminal-contracts-');
  const good = path.join(dir, 'good.json');
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(good, JSON.stringify({ ok: true }), 'utf8');
  fs.writeFileSync(bad, '{ not valid json', 'utf8');

  assert.doesNotThrow(() => assertJsonArtifactsReadable([good]));
  assert.throws(() => assertJsonArtifactsReadable([good, bad]));
});

test('assertTerminalPublicationContracts: 구조 검증 실패 시 recovery-prompt를 남기고 던진다', () => {
  const newsroomDir = tempRoot('terminal-contracts-');
  const date = '2026-05-08';

  assert.throws(
    () => assertTerminalPublicationContracts({
      date,
      editor: { date, sections: [] },
      markdown: 'clearly not a valid newsletter',
      html: '<p>broken</p>',
      newsroomDir,
      shortlistReport: { selected_articles: [] },
      qualityReport: null,
      factCheck: null
    }),
    /Terminal structural validation failed/
  );

  const recoveryPath = path.join(newsroomDir, 'recovery-prompt.md');
  assert.ok(fs.existsSync(recoveryPath));
  const text = fs.readFileSync(recoveryPath, 'utf8');
  assert.match(text, /structural validation/);
});

test('updateNewsletterData: newsletters.json 인덱스에 이번 이슈를 날짜 내림차순으로 반영한다', () => {
  const rootDir = tempRoot('terminal-contracts-');
  withCwd(rootDir, (contracts) => {
    const dataPath = path.join(rootDir, 'articles', 'data', 'newsletters.json');
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify([
      { date: '2026-05-01', title: 'old' },
      { date: '2026-05-08', title: 'will be replaced' }
    ]), 'utf8');

    contracts.updateNewsletterData('2026-05-08', {
      title: 'Weekly Camera HAL',
      summary: 'ISP/HAL roundup',
      sections: []
    });

    const written = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    assert.deepEqual(written.map(item => item.date), ['2026-05-08', '2026-05-01']);
    const replaced = written.find(item => item.date === '2026-05-08');
    assert.equal(replaced.title, 'Weekly Camera HAL');
    assert.equal(replaced.html, 'newsletters/2026-05-08/index.html');
    assert.equal(replaced.md, 'newsletters/2026-05-08/newsletter.md');
    assert.ok(Array.isArray(replaced.tags));
  });
});

test('persistHeadlineStateArtifacts: 공개 산출물이 아니면 파일을 쓰지 않고 coverage를 그대로 돌려준다', () => {
  const rootDir = tempRoot('terminal-contracts-');
  withCwd(rootDir, (contracts) => {
    const result = contracts.persistHeadlineStateArtifacts({
      date: '2026-05-08',
      shortlistReport: { article_exposure_coverage: { total: 3 } },
      shouldWritePublicArtifacts: false,
      editor: { sections: [] }
    });
    assert.deepEqual(result.files, []);
    assert.deepEqual(result.exposureCoverage, { total: 3 });
  });
});
