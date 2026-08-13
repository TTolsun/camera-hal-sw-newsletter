// Story Contract v2 (T4/#873) — 발행 인덱스가 계약 버전의 정본이 된다.
//
// 지금 이슈별 계약 버전을 알 수 있는 유일한 입력은 editor-draft.json인데 그 파일은
// gitignored다(#742 전력). 즉 CI에서는 항상 null이라 버전 신호가 없다. 발행 시점에
// 인덱스 엔트리에 기록해 두면 커밋된 산출물만으로 판별할 수 있다.
//
// 인덱스는 둘이고 둘 다 정본이다: 품질 재계산이 읽는 daily articles/data/newsletters.json과
// 홈·아카이브가 fetch하는 weekly articles/data/newsletters-weekly.json. 기록 규칙과 검증
// 규칙은 양쪽이 같아야 한다 — 한쪽만 고치면 공개 정본에 계약 표시가 없는 상태가 생긴다.
//
// 규칙 둘: 필드가 없으면 v1이다(W20~W32 전부 커버, backfill 불요). 값이 있는데
// 지원 목록 밖이면 fail한다(모르는 계약을 통과시키지 않는다).

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { tempRoot } = require('../../../shared/test/helpers/fs');
const {
  newsletterIndexContractVersion,
  validateRenderedIssueStructure
} = require('../../quality/rendered-issue-structure');
const {
  writeWeeklyNewsletterArtifacts
} = require('../../render/weekly-newsletter-output');

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

function weeklyEntry(overrides = {}) {
  return {
    weeklyKey: '2026-W33',
    weekStartDate: '2026-08-10',
    weekEndDate: '2026-08-16',
    date: '2026-08-10',
    title: '2026 W33',
    summary: '이번 주 요약',
    html: 'newsletters/2026-W33/index.html',
    md: 'newsletters/2026-W33/newsletter.md',
    tags: ['camera-hal'],
    ...overrides
  };
}

// 구조 검증은 두 인덱스를 모두 스캔하므로 fixture도 둘 다 써야 실제 저장소 모양이 된다.
function writeIndexes(prefix, { newsletters = [], weekly = [] } = {}) {
  const root = tempRoot(prefix);
  const dataDir = path.join(root, 'articles', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'newsletters.json'), JSON.stringify(newsletters), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'newsletters-weekly.json'), JSON.stringify(weekly), 'utf8');
  return root;
}

function indexStructureErrors(root) {
  return validateRenderedIssueStructure({
    date: '2026-08-10',
    markdown: '',
    html: '',
    root,
    validateDataIndex: true,
    strictArtifactValidation: false
  }).errors;
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
  const root = writeIndexes('index-version-', {
    newsletters: [entry({ public_contract_version: 'story-v9' })]
  });

  const errors = indexStructureErrors(root);

  assert.equal(
    errors.some(error => /newsletters\.json entry 0 declares an unsupported public_contract_version/.test(error)),
    true,
    `모르는 계약 버전을 선언한 엔트리가 통과했다: ${JSON.stringify(errors)}`
  );
});

test('the index validator accepts entries without the version field', () => {
  const root = writeIndexes('index-version-legacy-', { newsletters: [entry()] });

  const errors = indexStructureErrors(root);

  assert.equal(
    errors.some(error => /public_contract_version/.test(error)),
    false,
    `버전 필드 없는 legacy 엔트리가 거부됐다: ${JSON.stringify(errors)}`
  );
});

// 홈·아카이브가 실제로 fetch하는 정본은 weekly 인덱스다. daily만 스캔하면 공개 정본에
// 모르는 계약 버전이 들어와도 게이트가 통과시킨다.
test('the index validator rejects an unsupported contract version in the weekly index', () => {
  const root = writeIndexes('index-version-weekly-', {
    newsletters: [entry()],
    weekly: [weeklyEntry({ public_contract_version: 'story-v9' })]
  });

  const errors = indexStructureErrors(root);

  assert.equal(
    errors.some(error => /newsletters-weekly\.json entry 0 declares an unsupported public_contract_version/.test(error)),
    true,
    `weekly 인덱스의 모르는 계약 버전이 통과했다: ${JSON.stringify(errors)}`
  );
});

test('the index validator accepts legacy weekly entries without the version field', () => {
  // 커밋된 weekly 엔트리 15개(W19~W33)가 전부 이 모양이다. backfill 없이 통과해야 한다.
  const root = writeIndexes('index-version-weekly-legacy-', {
    newsletters: [entry()],
    weekly: [weeklyEntry()]
  });

  const errors = indexStructureErrors(root);

  assert.equal(
    errors.some(error => /newsletters-weekly\.json/.test(error)),
    false,
    `legacy weekly 엔트리가 거부됐다: ${JSON.stringify(errors)}`
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

// ---- weekly 인덱스(#873) ----
//
// 홈·아카이브가 fetch하는 정본은 weekly 쪽이라, daily만 기록하면 v2 발행이 시작되는 순간부터
// 공개 정본에 계약 표시가 없는 상태가 된다. 기록 판정은 daily와 같은 함수를 쓴다.

function weeklySection(id, url, storyContractVersion) {
  const article = {
    headline: `CameraX ${id}`,
    lead: `CameraX ${id}는 호환성 확인 신호를 제공합니다.`,
    camera_hal_takeaway: '검증 트리거로 다룹니다.',
    reader_checkpoints: ['ITS smoke', '호환성 확인'],
    source_links: [{ title: 'Android', url, source_role: 'primary' }],
    story_contract_version: storyContractVersion
  };
  if (storyContractVersion === 2) article.body_markdown = '공식 근거입니다.\n\n검증 범위로 제한합니다.';
  else article.body_paragraphs = ['공식 근거입니다.', '검증 범위로 제한합니다.'];
  return {
    category: 'Android Camera',
    headline: `CameraX ${id}`,
    what_changed: `CameraX ${id} 변경 사항입니다.`,
    evidence_summary: 'Android Developers 릴리스 노트를 출처로 사용합니다.',
    confirmed_facts: [`${id} 릴리스 노트가 존재합니다.`, '날짜가 있습니다.'],
    specificity_checks: [`version=${id}`],
    source_verification_notes: ['공식 URL'],
    camera_hal_checks: ['stream 확인', 'metadata 확인'],
    action_items: ['ITS smoke', '호환성 확인'],
    score: 1,
    source_candidate_url: url,
    article_sections: {
      verified_facts: [`${id} 릴리스 노트가 존재합니다.`],
      background_context: 'CameraX는 Android 카메라 애플리케이션 계층의 일부입니다.',
      hal_driver_impact: 'Camera HAL 팀 확인',
      action_items: ['ITS smoke'],
      team_share_points: 'Camera 팀 검토'
    },
    public_article: article,
    sources: [{ title: 'Android', url }]
  };
}

function weeklyDraft(sections, markers = {}) {
  return {
    date: '2026-06-04',
    title: 'Daily',
    summary: '요약',
    briefing: ['하나', '둘', '셋'],
    sections,
    action_items: ['a'],
    references: [],
    ...markers
  };
}

const STORY_V2_MARKERS = { public_contract_version: 'story-v2', generation_contract_version: 2 };
const STORY_V1_MARKERS = { public_contract_version: 'story-v1', generation_contract_version: 1 };

function readWeeklyIndex(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), 'utf8'));
}

test('the weekly index records the contract version the issue declared', async () => {
  const root = tempRoot('weekly-index-version-');

  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-04',
    editor: weeklyDraft([weeklySection('1.7.0', 'https://example.com/a', 2)], STORY_V2_MARKERS),
    tags: []
  });

  assert.equal(readWeeklyIndex(root)[0].public_contract_version, 'story-v2');
});

test('the weekly index omits the version field for a v1 issue', async () => {
  const root = tempRoot('weekly-index-version-v1-');

  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-04',
    editor: weeklyDraft([weeklySection('1.7.0', 'https://example.com/a', 1)], STORY_V1_MARKERS),
    tags: []
  });

  // v1은 기본값이라 적지 않는다. 적으면 커밋된 weekly 엔트리 15개와 모양이 갈린다.
  assert.equal('public_contract_version' in readWeeklyIndex(root)[0], false);
});

test('a weekly rerun without the marker keeps the recorded contract version', async () => {
  // weekly 엔트리도 발행 때마다 통째로 교체된다. 같은 주에 마커 없는 실행이 한 번 더 돌면
  // 부재를 v1로 단정하는 순간 기록이 사라진다.
  const root = tempRoot('weekly-index-version-keep-');
  const url = 'https://example.com/a';

  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-01',
    editor: weeklyDraft([weeklySection('1.7.0', url, 2)], STORY_V2_MARKERS),
    tags: []
  });
  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-04',
    editor: weeklyDraft([weeklySection('1.7.0', url, 2)]),
    tags: []
  });

  assert.equal(readWeeklyIndex(root)[0].public_contract_version, 'story-v2');
});

// 혼합 stamp 정책(#873 작업 범위 3): 거부한다.
//
// 같은 주에 v2 이슈 마커가 이전 실행에서 넘어온 v1 section 위에 씌워지는 상태는 T5(#889)가
// render 진입에서 이미 hard-fail로 막는다. 낮춰서 발행하지 않고 실패시키는 것이 이 저장소의
// fail-over-fabricate 방침이고, 두 번째 혼합 탐지기를 새로 만들지 않는다.
test('a weekly v2 stamp over carried-over v1 sections fails instead of writing a mixed artifact', async () => {
  const root = tempRoot('weekly-index-version-mixed-');

  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-01',
    editor: weeklyDraft([weeklySection('1.6.0', 'https://example.com/a', 1)], STORY_V1_MARKERS),
    tags: []
  });

  await assert.rejects(
    () => writeWeeklyNewsletterArtifacts({
      root,
      date: '2026-06-04',
      editor: weeklyDraft([weeklySection('1.7.0', 'https://example.com/b', 2)], STORY_V2_MARKERS),
      tags: []
    }),
    /story_contract_version_family_mismatch\(public_contract_version=2 generation_contract_version=2 story_contract_version=1\)/
  );

  // 실패한 실행이 인덱스에 v2를 남기면 안 된다 — 남으면 공개 정본이 실제 아티팩트와 어긋난다.
  const index = readWeeklyIndex(root);
  assert.equal(index.length, 1);
  assert.equal('public_contract_version' in index[0], false);
});
