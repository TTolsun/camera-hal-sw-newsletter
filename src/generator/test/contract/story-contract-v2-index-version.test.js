// Story Contract v2 (T4) — 발행 인덱스(newsletters.json)가 계약 버전의 정본이 된다.
//
// 지금 이슈별 계약 버전을 알 수 있는 유일한 입력은 editor-draft.json인데 그 파일은
// gitignored다(#742 전력). 즉 CI에서는 항상 null이라 버전 신호가 없다. 발행 시점에
// 인덱스 엔트리에 기록해 두면 커밋된 산출물만으로 판별할 수 있다.
//
// 규칙 둘: 필드가 없으면 v1이다(W20~W32 전부 커버, backfill 불요). 값이 있는데
// 지원 목록 밖이면 fail한다(모르는 계약을 통과시키지 않는다).

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { tempRoot } = require('../../../shared/test/helpers/fs');
const {
  newsletterIndexContractVersion
} = require('../../quality/rendered-issue-structure');

function entry(overrides = {}) {
  return {
    date: '2026-08-10',
    title: 'Camera HAL / SW Newsletter',
    summary: '이번 호 요약',
    html: 'newsletters/2026-08-10/index.html',
    md: 'newsletters/2026-08-10/newsletter.md',
    tags: ['camera-hal'],
    ...overrides
  };
}

test('an index entry without the version field resolves to v1', () => {
  assert.equal(newsletterIndexContractVersion(entry()), 1);
});

test('an index entry declaring story-v2 resolves to v2', () => {
  assert.equal(newsletterIndexContractVersion(entry({ public_contract_version: 'story-v2' })), 2);
});

test('an index entry declaring an unsupported version resolves to 0', () => {
  // 0은 "버전 없음"이 아니라 "판별 실패"다. 아래 인덱스 검증이 이 값을 오류로 올린다.
  assert.equal(newsletterIndexContractVersion(entry({ public_contract_version: 'story-v9' })), 0);
});

test('the index validator rejects an entry with an unsupported contract version', () => {
  const { validateRenderedIssueStructure } = require('../../quality/rendered-issue-structure');
  const root = tempRoot('index-version-');
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify([entry({ public_contract_version: 'story-v9' })]), 'utf8');

  const result = validateRenderedIssueStructure({
    date: '2026-08-10',
    markdown: '',
    html: '',
    root,
    validateDataIndex: true,
    strictArtifactValidation: false
  });

  assert.equal(
    result.errors.some(error => /public_contract_version/.test(error)),
    true,
    `모르는 계약 버전을 선언한 엔트리가 통과했다: ${JSON.stringify(result.errors)}`
  );
});

test('the index validator accepts entries without the version field', () => {
  const { validateRenderedIssueStructure } = require('../../quality/rendered-issue-structure');
  const root = tempRoot('index-version-legacy-');
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify([entry()]), 'utf8');

  const result = validateRenderedIssueStructure({
    date: '2026-08-10',
    markdown: '',
    html: '',
    root,
    validateDataIndex: true,
    strictArtifactValidation: false
  });

  assert.equal(
    result.errors.some(error => /public_contract_version/.test(error)),
    false,
    `버전 필드 없는 legacy 엔트리가 거부됐다: ${JSON.stringify(result.errors)}`
  );
});

test('publishing records the contract version the issue declared', () => {
  const root = tempRoot('index-version-writer-');
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify([]), 'utf8');

  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    // updateNewsletterData는 module load 시점의 cwd로 경로를 잡는다. cwd를 바꾼 뒤
    // 새로 로드해야 임시 루트에 쓴다.
    delete require.cache[require.resolve('../../publish/orchestrator-terminal-contracts')];
    const contracts = require('../../publish/orchestrator-terminal-contracts');
    contracts.updateNewsletterData('2026-08-10', {
      title: 'Weekly Camera HAL',
      summary: 'ISP/HAL roundup',
      public_contract_version: 'story-v2',
      sections: []
    });
  } finally {
    process.chdir(previousCwd);
    delete require.cache[require.resolve('../../publish/orchestrator-terminal-contracts')];
    require('../../publish/orchestrator-terminal-contracts');
  }

  const written = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.equal(written[0].public_contract_version, 'story-v2');
});

test('publishing omits the version field for a v1 issue', () => {
  const root = tempRoot('index-version-writer-v1-');
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify([]), 'utf8');

  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    delete require.cache[require.resolve('../../publish/orchestrator-terminal-contracts')];
    const contracts = require('../../publish/orchestrator-terminal-contracts');
    contracts.updateNewsletterData('2026-08-10', {
      title: 'Weekly Camera HAL',
      summary: 'ISP/HAL roundup',
      public_contract_version: 'story-v1',
      sections: []
    });
  } finally {
    process.chdir(previousCwd);
    delete require.cache[require.resolve('../../publish/orchestrator-terminal-contracts')];
    require('../../publish/orchestrator-terminal-contracts');
  }

  const written = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  // v1은 기본값이라 적지 않는다. 적으면 기존 31개 엔트리와 모양이 갈린다.
  assert.equal('public_contract_version' in written[0], false);
});

// 인덱스 엔트리는 발행 때마다 통째로 교체된다. 이슈가 마커를 안 들고 오는 실행이
// 실재하므로(targeted repair wrapper), 부재를 v1로 단정하면 재발행 한 번에 기록이 사라진다.
function publishInto(root, date, issue) {
  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    delete require.cache[require.resolve('../../publish/orchestrator-terminal-contracts')];
    return require('../../publish/orchestrator-terminal-contracts').updateNewsletterData(date, issue);
  } finally {
    process.chdir(previousCwd);
    delete require.cache[require.resolve('../../publish/orchestrator-terminal-contracts')];
    require('../../publish/orchestrator-terminal-contracts');
  }
}

function indexRoot(prefix) {
  const root = tempRoot(prefix);
  const dataPath = path.join(root, 'articles', 'data', 'newsletters.json');
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify([]), 'utf8');
  return { root, dataPath };
}

test('a republish without the marker keeps the recorded contract version', () => {
  const { root, dataPath } = indexRoot('index-version-keep-');

  publishInto(root, '2026-08-10', { title: 't', summary: 's', public_contract_version: 'story-v2', sections: [] });
  publishInto(root, '2026-08-10', { title: 't', summary: 's', sections: [] });

  const written = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.equal(written[0].public_contract_version, 'story-v2');
});

test('publishing refuses an unsupported contract version instead of poisoning the index', () => {
  const { root, dataPath } = indexRoot('index-version-reject-');

  assert.throws(
    () => publishInto(root, '2026-08-10', {
      title: 't',
      summary: 's',
      public_contract_version: 'story-v9',
      sections: []
    }),
    /unsupported public_contract_version/
  );

  // 인덱스가 오염되지 않아야 한다 — 오염되면 이후 실행마다 전체 엔트리 스캔이 실패한다.
  assert.deepEqual(JSON.parse(fs.readFileSync(dataPath, 'utf8')), []);
});

test('publishing refuses to downgrade a recorded contract version', () => {
  const { root } = indexRoot('index-version-downgrade-');

  publishInto(root, '2026-08-10', { title: 't', summary: 's', public_contract_version: 'story-v2', sections: [] });

  assert.throws(
    () => publishInto(root, '2026-08-10', {
      title: 't',
      summary: 's',
      public_contract_version: 'story-v1',
      sections: []
    }),
    /downgrade/
  );
});

// 보존 경로에도 같은 판정이 걸려야 한다. 안 그러면 인덱스에 이미 미지원 값이 있을 때
// 마커 없는 재발행이 그 값을 다시 써서, 자기 validator가 거부할 파일을 만든다.
test('publishing refuses to carry forward an unsupported recorded version', () => {
  const { root, dataPath } = indexRoot('index-version-carry-');
  fs.writeFileSync(dataPath, JSON.stringify([entry({ public_contract_version: 'story-v9' })]), 'utf8');

  assert.throws(
    () => publishInto(root, '2026-08-10', { title: 't', summary: 's', sections: [] }),
    /not supported/
  );
});
