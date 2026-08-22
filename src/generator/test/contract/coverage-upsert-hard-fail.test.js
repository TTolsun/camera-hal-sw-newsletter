'use strict';

// weekly coverage backfill(phase 2)이 라이브에 이미 반영된 뒤에는 모든 위클리 이슈가
// coverage_week_key를 갖고 있어야 한다. 이 계약은 그 전제가 깨졌을 때 — 위클리 이슈에
// coverage_week_key가 없거나, 이번 실행이 계산한 대상 주와 이미 실린 값이 다를 때 —
// writeWeeklyNewsletterArtifacts가 페이지 파일을 쓰기 전에 hard-fail하는 것을 잠근다.
// 절반만 갱신된 상태(일부 파일은 새 값, 인덱스 엔트리는 옛 값)로 끝나는 것을 막기 위해서다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { writeWeeklyNewsletterArtifacts } = require('../../render/weekly-newsletter-output');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-upsert-hard-fail-'));
}

function section(id, url) {
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
    public_article: {
      headline: `CameraX ${id}`,
      lead: `CameraX ${id}는 호환성 확인 신호를 제공합니다.`,
      body_paragraphs: ['공식 근거입니다.', '검증 범위로 제한합니다.'],
      camera_hal_takeaway: '검증 트리거로 다룹니다.',
      reader_checkpoints: ['ITS smoke', '호환성 확인'],
      source_links: [{ title: 'Android', url, source_role: 'primary' }]
    },
    sources: [{ title: 'Android', url }]
  };
}

function draft(sections) {
  return { date: '2026-06-04', title: 'Daily', summary: '요약', briefing: ['하나', '둘', '셋'], sections, action_items: ['a'], references: [] };
}

function weeklyArtifactPaths(root, weeklyKey) {
  return [
    path.join(root, 'articles', 'newsletters', weeklyKey, 'index.html'),
    path.join(root, 'articles', 'newsletters', weeklyKey, 'newsletter.md'),
    path.join(root, 'articles', 'newsletters', weeklyKey, 'issue.json'),
    path.join(root, 'articles', 'data', 'newsletters-weekly.json')
  ];
}

function snapshotFiles(paths) {
  return paths.filter(filePath => fs.existsSync(filePath)).map(filePath => [filePath, fs.readFileSync(filePath, 'utf8')]);
}

function assertUnchanged(snapshot) {
  for (const [filePath, before] of snapshot) {
    assert.equal(fs.readFileSync(filePath, 'utf8'), before, `${filePath} changed despite the rejected upsert`);
  }
}

test('an existing weekly issue missing coverage_week_key rejects the upsert without touching files', async () => {
  const root = tempRoot();
  // 2026-06-04는 위클리 identity 주 2026-W23에 속한다. coverage 필드 없이 직접 이슈 파일을
  // 심어 phase 2 backfill 이전 상태(또는 backfill 누락)를 흉내낸다.
  const weeklyDir = path.join(root, 'articles', 'newsletters', '2026-W23');
  fs.mkdirSync(weeklyDir, { recursive: true });
  fs.writeFileSync(path.join(weeklyDir, 'issue.json'), JSON.stringify({
    weeklyKey: '2026-W23',
    sections: [section('existing', 'https://example.com/existing')]
  }), 'utf8');
  const snapshot = snapshotFiles(weeklyArtifactPaths(root, '2026-W23'));

  await assert.rejects(
    () => writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('new', 'https://example.com/new')]), tags: [] }),
    /missing coverage_week_key on existing issue 2026-W23/
  );

  assertUnchanged(snapshot);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'data', 'newsletters-weekly.json')), false);
});

test('an existing weekly issue whose recorded coverage week differs from the computed one rejects the upsert', async () => {
  const root = tempRoot();
  const url = 'https://example.com/first';
  // 2026-06-04는 coverageForAnchorDate 기준 대상 주 2026-W22를 계산한다. 이미 실린 값이
  // 이와 다르면(예: 실행 오류로 다른 override가 섞인 이슈) 어긋난 대상 주 위에 이어 쓰지
  // 않고 그 자리에서 멈춰야 한다.
  await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-04',
    editor: { ...draft([section('first', url)]), coverage_week_key: '2026-W99', coverage_start_date: '2026-01-01', coverage_end_date: '2026-01-07' },
    tags: []
  });
  const snapshot = snapshotFiles(weeklyArtifactPaths(root, '2026-W23'));

  await assert.rejects(
    () => writeWeeklyNewsletterArtifacts({ root, date: '2026-06-04', editor: draft([section('second', 'https://example.com/second')]), tags: [] }),
    /weekly coverage mismatch: existing=2026-W99 incoming=2026-W22/
  );

  assertUnchanged(snapshot);
});

test('a first-ever write to a week with no existing issue computes and stores coverage without rejecting', async () => {
  const root = tempRoot();
  const result = await writeWeeklyNewsletterArtifacts({
    root,
    date: '2026-06-04',
    editor: draft([section('fresh', 'https://example.com/fresh')]),
    tags: []
  });

  assert.equal(result.weeklyKey, '2026-W23');
  const issue = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'newsletters', '2026-W23', 'issue.json'), 'utf8'));
  assert.equal(issue.coverage_week_key, '2026-W22');
  assert.equal(issue.coverage_start_date, '2026-05-25');
  assert.equal(issue.coverage_end_date, '2026-05-31');
  assert.equal(issue.coverage_mode, 'iso_week');
  assert.equal(issue.generation_anchor_date, '2026-06-04');
});
