'use strict';

// coverage 경계 밖([E, U)) 후보를 dedupe 직후·cap 이전에 떼어내 보존하는지 고정한다(Task 8).
// 이번 호 대상이 아닌 후보가 소스별/전역 캡에 끼어 이번 주 신호를 밀어내면 안 되고, 다음 실행이
// carry-forward로 읽을 수 있게 원시 재평가 payload 그대로 살아남아야 한다.

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const {
  candidateRankOrder,
  capNotYetEligible,
  capPerSource,
  collapseSeriesRepresentatives,
  dedupe,
  MAX_CANDIDATES_PER_SOURCE,
  MAX_FINAL_CANDIDATES,
  NOT_YET_ELIGIBLE_MAX_BYTES,
  NOT_YET_ELIGIBLE_MAX_COUNT,
  partitionByCoverageEligibility,
  withinLookback,
  writeNotYetEligibleOverflowIfNeeded
} = require('../../../cli/collect-news-candidates');
const { coverageForAnchorDate } = require('../../../common/coverage-week');
const { tempRoot } = require('../../helpers/fs');

// 2026-08-17은 월요일이라 coverage 주(직전 완결 ISO 주)가 [2026-08-10, 2026-08-17) 로 딱 떨어진다.
const ANCHOR_DATE = '2026-08-17';
const COVERAGE = coverageForAnchorDate(ANCHOR_DATE);
const NOW = new Date('2026-08-17T23:59:59.999Z');
const LOOKBACK_DAYS = 35;

function inCoverageItem(index) {
  return {
    source_id: 'lore-linux-media-list',
    source: 'lore-linux-media-list',
    title: `in-coverage-${index}`,
    url: `https://lore.kernel.org/linux-media/in-coverage-${index}/`,
    publishedAt: '2026-08-11T00:00:00Z',
    relevanceScore: 50,
    source_priority: 'high',
    source_reliability: 'project-official'
  };
}

function notYetEligibleItem(index, publishedAt = '2026-08-17T06:00:00Z') {
  return {
    source_id: 'lore-linux-media-list',
    source: 'lore-linux-media-list',
    title: `future-${index}`,
    url: `https://lore.kernel.org/linux-media/future-${index}/`,
    publishedAt,
    relevanceScore: 50,
    source_priority: 'high',
    source_reliability: 'project-official'
  };
}

// main()의 dedupe → coverage 분리 → cap 체인을 그대로 재현하되 네트워크 없이 순수 함수만으로
// 구성한다.
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

test('not_yet_eligible 분리는 dedupe 직후·cap 이전이다', () => {
  const inCoverage = Array.from({ length: 10 }, (_, i) => inCoverageItem(i));
  const futureCandidates = Array.from({ length: 5 }, (_, i) => notYetEligibleItem(i));

  const { candidates, notYetEligible } = runCollectChain([...inCoverage, ...futureCandidates]);

  assert.equal(notYetEligible.length, 5, '경계 밖 5건 전부가 not_yet_eligible로 분리된다');
  assert.equal(candidates.length, MAX_CANDIDATES_PER_SOURCE,
    '소스당 캡은 남은 coverage-안 후보(10건)에만 적용돼 8건으로 줄어든다');
  assert.ok(candidates.every(c => c.title.startsWith('in-coverage-')),
    'not_yet_eligible 후보는 캡을 적용받는 최종 candidates에 섞이지 않는다');
  assert.ok(notYetEligible.every(c => c.title.startsWith('future-')));
});

test('E 정각 후보는 선정 제외 + not_yet_eligible 포함', () => {
  // coverage_end_exclusive_at(E)은 2026-08-17T00:00:00.000Z. 정확히 그 시각에 발행된 후보는
  // coverageAgeDays가 음수(-1)라 not_yet_eligible로 분류돼야 한다([E, U) 반개구간의 좌측 경계).
  assert.equal(COVERAGE.coverage_end_exclusive_at, '2026-08-17T00:00:00.000Z');
  const boundaryItem = notYetEligibleItem('boundary', COVERAGE.coverage_end_exclusive_at);

  const { candidates, notYetEligible } = runCollectChain([boundaryItem]);

  assert.equal(candidates.length, 0, 'E 정각 후보는 이번 호 candidates에서 제외된다');
  assert.equal(notYetEligible.length, 1);
  assert.equal(notYetEligible[0].title, 'future-boundary');
});

test('상한 초과 시 committed 목록은 60건, 전체는 .tmp에 보존되고 overflow 플래그가 선다', () => {
  // 바이트 상한을 확실히 넘기도록 후보마다 큰 summary를 붙이고, publishedAt을 오름차순으로
  // 서로 다르게 만들어 정렬 결과를 예측 가능하게 한다.
  const oversized = Array.from({ length: 90 }, (_, i) => ({
    ...notYetEligibleItem(String(i).padStart(3, '0')),
    publishedAt: new Date(Date.parse('2026-08-17T00:00:00Z') + i * 60000).toISOString(),
    summary: 'x'.repeat(4000)
  }));

  const capResult = capNotYetEligible(oversized);

  assert.equal(capResult.overflow, true);
  assert.ok(capResult.committed.length <= NOT_YET_ELIGIBLE_MAX_COUNT);
  assert.ok(
    Buffer.byteLength(JSON.stringify(capResult.committed), 'utf8') <= NOT_YET_ELIGIBLE_MAX_BYTES,
    'committed 목록은 바이트 상한도 지킨다'
  );
  assert.equal(capResult.full.length, 90);
  // 정렬순 상한까지이므로 committed는 전체 목록의 앞부분과 같아야 한다.
  assert.deepEqual(
    capResult.committed.map(c => c.title),
    capResult.full.slice(0, capResult.committed.length).map(c => c.title)
  );

  const root = tempRoot('not-yet-eligible-overflow-');
  writeNotYetEligibleOverflowIfNeeded(root, capResult);
  const overflowPath = path.join(root, '.tmp', 'not-yet-eligible-full.json');
  assert.equal(fs.existsSync(overflowPath), true);
  const written = JSON.parse(fs.readFileSync(overflowPath, 'utf8'));
  assert.equal(written.length, 90);
});

test('건수는 60건 미만이어도 바이트 상한을 넘으면 잘라내고 overflow를 켠다', () => {
  // 10건 * 30000자 summary = 약 300000바이트 > 262144. 건수 상한(60)에는 안 걸린다.
  const heavy = Array.from({ length: 10 }, (_, i) => ({
    ...notYetEligibleItem(String(i).padStart(2, '0')),
    publishedAt: new Date(Date.parse('2026-08-17T00:00:00Z') + i * 60000).toISOString(),
    summary: 'y'.repeat(30000)
  }));

  const capResult = capNotYetEligible(heavy);

  assert.equal(capResult.overflow, true);
  assert.ok(capResult.committed.length < 10, '바이트 상한 때문에 건수 상한 이전에 잘려야 한다');
  assert.ok(Buffer.byteLength(JSON.stringify(capResult.committed), 'utf8') <= NOT_YET_ELIGIBLE_MAX_BYTES);
  assert.equal(capResult.full.length, 10);
});

test('상한 안이면 overflow 파일을 쓰지 않는다', () => {
  const small = Array.from({ length: 3 }, (_, i) => notYetEligibleItem(i));
  const capResult = capNotYetEligible(small);
  assert.equal(capResult.overflow, false);
  assert.equal(capResult.committed.length, 3);

  const root = tempRoot('not-yet-eligible-no-overflow-');
  writeNotYetEligibleOverflowIfNeeded(root, capResult);
  const overflowPath = path.join(root, '.tmp', 'not-yet-eligible-full.json');
  assert.equal(fs.existsSync(overflowPath), false);
});
