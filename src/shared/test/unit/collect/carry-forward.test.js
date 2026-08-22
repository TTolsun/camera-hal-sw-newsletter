'use strict';

// Task 9: 직전 주 scheduled coverage run이 남긴 not_yet_eligible 후보를 이번 수집 풀에
// 합류시키는 lineage 선택 + status 판정을 고정한다. 정상 원천은 committed
// merged-candidates.json뿐이다 — 상한 초과 시에만 남는 진단용 overflow 파일
// (.tmp/not-yet-eligible-full.json)은 여기서 절대 읽지 않는다.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { loadCarryForward, resolveCarryForwardStatus } = require('../../../collect/carry-forward');
const { coverageForAnchorDate, previousCoverageWeekKey, classifyCoverageWindow } = require('../../../common/coverage-week');
const {
  candidateRankOrder,
  capPerSource,
  collapseSeriesRepresentatives,
  dedupe,
  MAX_CANDIDATES_PER_SOURCE,
  MAX_FINAL_CANDIDATES,
  partitionByCoverageEligibility,
  withinLookback
} = require('../../../cli/collect-news-candidates');
const { tempRoot, writeJson, writeText } = require('../../helpers/fs');

// 2026-08-17은 월요일이라 coverage 주(직전 완결 ISO 주)가 [2026-08-10, 2026-08-17)로 딱
// 떨어진다(not-yet-eligible-partition.test.js와 동일한 anchor를 재사용).
const ANCHOR_DATE = '2026-08-17';
const NOW = new Date('2026-08-17T23:59:59.999Z');
const LOOKBACK_DAYS = 35;
const COVERAGE = coverageForAnchorDate(ANCHOR_DATE);
const PREVIOUS_WEEK_KEY = previousCoverageWeekKey(COVERAGE.coverage_week_key);

function mergedCandidatesPath(root, dateDir) {
  return path.join(root, 'articles', 'content', 'collected-news', dateDir, 'merged-candidates.json');
}

function generationStatusPath(root, dateDir) {
  return path.join(root, 'articles', 'content', 'newsroom', dateDir, 'generation-status.json');
}

function carryItem(label, overrides = {}) {
  return {
    schema_version: 7,
    title: `carried-${label}`,
    url: `https://lore.kernel.org/linux-media/carried-${label}/`,
    summary: `carried summary ${label}`,
    seriesId: `series-${label}`,
    series_id: `series-${label}`,
    source_id: 'lore-linux-media-list',
    source: 'lore-linux-media-list',
    publishedAt: '2026-08-11T00:00:00Z',
    relevanceScore: 50,
    source_priority: 'high',
    source_reliability: 'project-official',
    ...overrides
  };
}

function scheduledPayload(items, anchor) {
  return {
    schema_version: 7,
    coverage: { coverage_week_key: PREVIOUS_WEEK_KEY },
    run_mode: 'scheduled',
    generation_anchor_date: anchor,
    not_yet_eligible: items,
    candidates: []
  };
}

test('not_applicable: 직전 주 merged-candidates도 generation-status 흔적도 없다', () => {
  const root = tempRoot('carry-forward-not-applicable-');
  const result = loadCarryForward({ root, coverage: COVERAGE });
  assert.equal(result.status, 'not_applicable');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.carrySource, null);
});

test('missing_expected: 직전 주 run 흔적(generation-status)은 있는데 merged-candidates가 없다', () => {
  const root = tempRoot('carry-forward-missing-expected-');
  writeJson(generationStatusPath(root, '2026-08-10'), {
    date: '2026-08-10',
    coverage_week_key: PREVIOUS_WEEK_KEY,
    status: 'PASS'
  });
  const result = loadCarryForward({ root, coverage: COVERAGE });
  assert.equal(result.status, 'missing_expected');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.carrySource, null);
});

test('missing_expected가 아닌 generation-status(다른 주)는 not_applicable을 바꾸지 않는다', () => {
  const root = tempRoot('carry-forward-other-week-status-');
  writeJson(generationStatusPath(root, '2026-08-03'), {
    date: '2026-08-03',
    coverage_week_key: '2026-W31',
    status: 'PASS'
  });
  const result = loadCarryForward({ root, coverage: COVERAGE });
  assert.equal(result.status, 'not_applicable');
});

test('invalid: merged-candidates는 있으나 not_yet_eligible 항목에 title/url이 없다', () => {
  const root = tempRoot('carry-forward-invalid-schema-');
  writeJson(mergedCandidatesPath(root, '2026-08-10'), scheduledPayload([{ title: '', url: '' }], '2026-08-10'));
  const result = loadCarryForward({ root, coverage: COVERAGE });
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.candidates, []);
  assert.ok(result.carrySource, 'invalid 상태에서도 carry_source는 진단용으로 남는다');
  assert.equal(result.carrySource.run_mode, 'scheduled');
});

// 자동 lineage 스캔은 coverage_week_key/run_mode를 읽어야 매치 여부를 판단할 수 있는데,
// 파싱조차 안 되는 파일은 그 값을 읽을 수 없어 애초에 "이 파일이 매치였는지" 스캔 시점엔 판정할
// 수 없다. 스캔은 멈추지 않고 계속 진행해 다른 날짜의 정상 artifact를 찾되(아래 "정상 매치가
// 따로 있으면" 테스트), 끝까지 매치가 하나도 안 나왔는데 파싱 실패가 있었다면 "이 파일이 실제
// 직전 주 원천이었을 가능성"을 배제할 수 없으므로 not_applicable로 조용히 넘기지 않고 invalid로
// 승격한다(fix round 1 — 03단계가 아직 안 돌아 generation-status 흔적조차 없는 주에서 손상된
// 직전 주 원천을 영구히 침묵시키던 구멍 수정).
test('직전 주로 추정되는 파일이 파싱 불가 + generation-status 흔적도 없으면 invalid + 실패 경로 기록', () => {
  const root = tempRoot('carry-forward-invalid-parse-no-match-');
  const filePath = mergedCandidatesPath(root, '2026-08-10');
  writeText(filePath, '{ this is not json');

  const result = loadCarryForward({ root, coverage: COVERAGE });

  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(
    result.carrySource.scan_parse_failures,
    ['articles/content/collected-news/2026-08-10/merged-candidates.json']
  );
});

test('파싱 불가 파일이 섞여 있어도 다른 날짜에 정상 lineage 매치가 있으면 loaded + scan_parse_failures 기록', () => {
  const root = tempRoot('carry-forward-invalid-parse-with-match-');
  writeText(mergedCandidatesPath(root, 'run-corrupt'), '{ this is not json');
  writeJson(mergedCandidatesPath(root, 'run-good'), scheduledPayload([carryItem('good')], '2026-08-11'));

  const result = loadCarryForward({ root, coverage: COVERAGE });

  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.candidates.map(c => c.title), ['carried-good']);
  assert.equal(result.carrySource.path, 'articles/content/collected-news/run-good/merged-candidates.json');
  assert.deepEqual(
    result.carrySource.scan_parse_failures,
    ['articles/content/collected-news/run-corrupt/merged-candidates.json']
  );
});

test('파싱 실패도 없고 매치도 없으면 기존대로 generation-status 흔적 유무로 not_applicable/missing_expected를 가른다', () => {
  const root = tempRoot('carry-forward-no-failure-no-match-');
  const result = loadCarryForward({ root, coverage: COVERAGE });
  assert.equal(result.status, 'not_applicable');
  assert.equal(result.carrySource, null);
});

test('override 경로의 손상 JSON은 대상이 하나로 고정되어 있으므로 곧바로 invalid다', () => {
  const root = tempRoot('carry-forward-invalid-override-parse-');
  const overrideRelPath = 'articles/content/collected-news/manual-2026-08-15/merged-candidates.json';
  writeText(path.join(root, overrideRelPath), '{ this is not json');
  const result = loadCarryForward({ root, coverage: COVERAGE, carrySourcePathOverride: overrideRelPath });
  assert.equal(result.status, 'invalid');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.carrySource, null, '파싱 자체가 안 되면 run_mode 등 메타데이터를 못 읽으므로 carry_source도 없다');
});

test('loaded: 직전 주 scheduled merged-candidates에서 not_yet_eligible을 그대로 읽는다', () => {
  const root = tempRoot('carry-forward-loaded-');
  const items = [carryItem('a'), carryItem('b')];
  const filePath = mergedCandidatesPath(root, '2026-08-10');
  writeJson(filePath, scheduledPayload(items, '2026-08-10'));

  const result = loadCarryForward({ root, coverage: COVERAGE });

  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.candidates.map(c => c.title), ['carried-a', 'carried-b']);
  assert.equal(result.carrySource.path, 'articles/content/collected-news/2026-08-10/merged-candidates.json');
  assert.equal(result.carrySource.run_mode, 'scheduled');
  const expectedHash = crypto.createHash('sha256').update(fs.readFileSync(filePath, 'utf8'), 'utf8').digest('hex');
  assert.equal(result.carrySource.sha256, expectedHash);
});

test('loaded: not_yet_eligible이 빈 배열이어도 loaded다(빈 목록도 정상 결과)', () => {
  const root = tempRoot('carry-forward-loaded-empty-');
  writeJson(mergedCandidatesPath(root, '2026-08-10'), scheduledPayload([], '2026-08-10'));
  const result = loadCarryForward({ root, coverage: COVERAGE });
  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.candidates, []);
});

test('lineage 혼입: scheduled만 고르고, 같은 주 안에서는 generation_anchor_date 최신을 고른다', () => {
  const root = tempRoot('carry-forward-lineage-');

  // 직전 주 scheduled, anchor가 더 이른 실행.
  writeJson(mergedCandidatesPath(root, 'run-early'), scheduledPayload([carryItem('scheduled-early')], '2026-08-10'));
  // 직전 주지만 run_mode가 manual인 재실행 — anchor가 더 늦어도 scheduled가 아니므로 제외돼야 한다.
  writeJson(mergedCandidatesPath(root, 'run-manual'), {
    ...scheduledPayload([carryItem('manual-rerun')], '2026-08-12'),
    run_mode: 'manual'
  });
  // 더 오래된 주의 scheduled backfill — coverage_week_key가 달라 제외돼야 한다.
  writeJson(mergedCandidatesPath(root, 'run-older-week'), {
    ...scheduledPayload([carryItem('older-week-backfill')], '2026-07-27'),
    coverage: { coverage_week_key: '2026-W29' }
  });
  // 직전 주 scheduled, anchor가 가장 늦은 실행 — 이것이 선택돼야 한다.
  writeJson(mergedCandidatesPath(root, 'run-late'), scheduledPayload([carryItem('scheduled-late')], '2026-08-11'));

  const result = loadCarryForward({ root, coverage: COVERAGE });

  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.candidates.map(c => c.title), ['carried-scheduled-late']);
  assert.equal(result.carrySource.path, 'articles/content/collected-news/run-late/merged-candidates.json');
});

test('override 경로가 있으면 lineage 규칙(run_mode/coverage_week_key 일치)을 무시하고 그 파일만 쓴다', () => {
  const root = tempRoot('carry-forward-override-');
  // lineage 규칙으로는 절대 선택되지 않을 manual/다른 주 조합.
  const overrideRelPath = 'articles/content/collected-news/manual-2026-08-15/merged-candidates.json';
  writeJson(path.join(root, overrideRelPath), {
    ...scheduledPayload([carryItem('override-pick')], '2026-08-15'),
    run_mode: 'manual',
    coverage: { coverage_week_key: '2026-W29' }
  });
  // lineage로 골랐을 정상 후보도 함께 둬서, override가 이걸 무시함을 확인한다.
  writeJson(mergedCandidatesPath(root, 'run-late'), scheduledPayload([carryItem('would-be-lineage-pick')], '2026-08-11'));

  const result = loadCarryForward({ root, coverage: COVERAGE, carrySourcePathOverride: overrideRelPath });

  assert.equal(result.status, 'loaded');
  assert.deepEqual(result.candidates.map(c => c.title), ['carried-override-pick']);
  assert.equal(result.carrySource.path, overrideRelPath);
  assert.equal(result.carrySource.run_mode, 'manual');
});

test('override 경로가 존재하지 않으면 not_applicable이다', () => {
  const root = tempRoot('carry-forward-override-missing-');
  const result = loadCarryForward({
    root,
    coverage: COVERAGE,
    carrySourcePathOverride: 'articles/content/collected-news/2026-08-10/merged-candidates.json'
  });
  assert.equal(result.status, 'not_applicable');
  assert.equal(result.carrySource, null);
});

test('overflow는 이번 run 자체의 not_yet_eligible_overflow가 로드 상태보다 우선한다', () => {
  assert.equal(resolveCarryForwardStatus({ status: 'loaded', overflow: true }), 'overflow');
  assert.equal(resolveCarryForwardStatus({ status: 'invalid', overflow: true }), 'overflow');
  assert.equal(resolveCarryForwardStatus({ status: 'not_applicable', overflow: false }), 'not_applicable');
  assert.equal(resolveCarryForwardStatus({ status: 'loaded', overflow: false }), 'loaded');
});

// main()이 실제로 하는 일: live 후보 뒤에 carry 후보를 append한 뒤 기존 필터 체인을 다시 통과시킨다.
// 네트워크 호출 없이 순수 함수 조합만으로 그 체인을 재현한다(not-yet-eligible-partition.test.js와 동일 패턴).
function runCollectChain(rawCandidates, { coverage = COVERAGE, now = NOW, lookbackDays = LOOKBACK_DAYS } = {}) {
  const deduped = dedupe(rawCandidates);
  const { currentCoveragePool, notYetEligible } = partitionByCoverageEligibility(
    deduped, coverage, now, lookbackDays
  );
  const rankedCandidates = currentCoveragePool
    .filter(item => withinLookback(item, now, lookbackDays))
    .filter(item => item.cameraHalRelevanceScore >= 30 || item.source_priority === 'high')
    .sort(candidateRankOrder(now, coverage));
  const candidates = capPerSource(collapseSeriesRepresentatives(rankedCandidates), MAX_CANDIDATES_PER_SOURCE)
    .slice(0, MAX_FINAL_CANDIDATES);
  return { candidates, notYetEligible };
}

test('live 후보 뒤에 carry를 append해 dedupe하면 같은 URL/제목은 live가 이긴다', () => {
  const sharedUrl = 'https://lore.kernel.org/linux-media/shared-topic/';
  const sharedTitle = 'shared topic';
  const liveItem = {
    source_id: 'lore-linux-media-list',
    source: 'lore-linux-media-list',
    title: sharedTitle,
    url: sharedUrl,
    summary: 'live version summary',
    publishedAt: '2026-08-11T00:00:00Z',
    relevanceScore: 50,
    source_priority: 'high',
    source_reliability: 'project-official',
    cameraHalRelevanceScore: 50
  };
  const carriedDuplicate = {
    ...liveItem,
    summary: 'carried version summary (stale)'
  };

  const { candidates } = runCollectChain([liveItem, carriedDuplicate]);

  assert.equal(candidates.length, 1, 'live/carry 중복은 하나로 합쳐진다');
  assert.equal(candidates[0].summary, 'live version summary', 'URL/제목이 같으면 먼저 append된 live가 승리한다');
});

test('feed가 사라진 소스의 carry 후보도 payload만으로 정상 재평가돼 최종 candidates에 포함된다', () => {
  // 이 소스는 이번 run의 라이브 수집(feed 부재)에 없다고 가정 — carry 후보만 존재한다.
  const carried = carryItem('revived', {
    // 직전 주엔 [E,U) 밖(not_yet_eligible)이었지만, 이번 coverage 주 안(0~6일)으로 재평가돼야
    // primary가 되도록 이번 coverage 창 안 날짜로 재배치한다.
    publishedAt: COVERAGE.coverage_start_date + 'T12:00:00Z',
    cameraHalRelevanceScore: 60
  });
  assert.equal(
    classifyCoverageWindow(carried.publishedAt, COVERAGE), 'primary',
    'fixture 전제: 이 발행일은 이번 coverage 주 안(primary)이어야 한다'
  );

  const { candidates } = runCollectChain([carried]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].title, 'carried-revived', '제목이 보존된다');
  assert.equal(candidates[0].summary, 'carried summary revived', '요약이 보존된다');
  assert.equal(candidates[0].seriesId, 'series-revived', 'seriesId가 보존된다');
});
