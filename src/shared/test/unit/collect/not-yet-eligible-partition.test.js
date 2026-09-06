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
  notYetEligibleOverflowRelPath,
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

// dated-article-index-resolver.js의 목록 fallback 레인을 흉내낸다: 개별 페이지가 날짜를 못 주면
// publishedAt은 항상 ''이고 날짜는 effective_date에만 담긴다(date_source: 'release_row_date').
function notYetEligibleListFallbackItem(index, effectiveDate) {
  return {
    source_id: 'claude-blog',
    source: 'claude-blog',
    title: `list-fallback-${index}`,
    url: `https://claude.com/blog/list-fallback-${index}`,
    publishedAt: '',
    effective_date: effectiveDate,
    date_source: 'release_row_date',
    date_confidence: 95,
    relevanceScore: 50,
    source_priority: 'high',
    source_reliability: 'official'
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

test('publishedAt이 비고 effective_date만 있는 목록 fallback 후보도 not_yet_eligible로 분리된다', () => {
  // dated-article-index-resolver.js가 개별 페이지 날짜를 못 받으면 publishedAt은 ''로 두고
  // 목록 날짜를 effective_date에만 담는다. partitionByCoverageEligibility가 raw publishedAt만
  // 보면 classifyCoverageWindow('')가 'unknown'을 돌려줘 이 분기를 절대 못 타므로, coverage 주
  // 이후에 발행된 신호가 이번 호 대상 풀(currentCoveragePool)로 새어 들어간다.
  const item = notYetEligibleListFallbackItem('a', COVERAGE.coverage_end_exclusive_at.slice(0, 10));

  const { candidates, notYetEligible } = runCollectChain([item]);

  assert.equal(notYetEligible.length, 1, 'effective_date 기준으로 not_yet_eligible로 분리돼야 한다');
  assert.equal(notYetEligible[0].title, 'list-fallback-a');
  assert.equal(candidates.length, 0,
    'publishedAt이 비어 있다는 이유로 currentCoveragePool(이번 호 대상)로 새면 안 된다');
});

test('compareNotYetEligible도 raw publishedAt이 아니라 날짜 정본 기준으로 목록 fallback 후보를 정렬한다', () => {
  // 둘 다 publishedAt이 ''라 raw 필드만 보면 Date.parse('')가 NaN을 주고, NaN 비교는 항상
  // true라 aTime - bTime이 NaN이 되어 안정 정렬이 입력 순서를 그대로 통과시킨다 — 정렬 계약이
  // 조용히 깨진다. 입력을 일부러 날짜 역순으로 줘서 실제 정렬이 일어났는지를 관찰한다.
  const newer = notYetEligibleListFallbackItem('newer', '2026-08-20');
  const older = notYetEligibleListFallbackItem('older', COVERAGE.coverage_end_exclusive_at.slice(0, 10));

  const capResult = capNotYetEligible([newer, older]);

  assert.deepEqual(capResult.committed.map(item => item.title),
    ['list-fallback-older', 'list-fallback-newer'],
    'effective_date 오름차순으로 정렬돼야 한다 — raw publishedAt만 보면 입력 순서(newer, older)가 그대로 남는다');
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
  writeNotYetEligibleOverflowIfNeeded(root, ANCHOR_DATE, capResult);
  const overflowPath = path.join(root, notYetEligibleOverflowRelPath(ANCHOR_DATE));
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
  writeNotYetEligibleOverflowIfNeeded(root, ANCHOR_DATE, capResult);
  const overflowPath = path.join(root, notYetEligibleOverflowRelPath(ANCHOR_DATE));
  assert.equal(fs.existsSync(overflowPath), false);
});

// 진단 파일이 전역 단일 경로면, 같은 워킹트리에서 날짜만 다른 두 실행이 서로의 목록을 덮어쓴다.
// 파일 안에 실행 identity가 없어서 남은 파일이 어느 실행 것인지도 구분할 수 없다(issue #1040).
test('날짜가 다른 두 실행의 overflow 진단 파일은 서로를 덮어쓰지 않는다', () => {
  const root = tempRoot('not-yet-eligible-overflow-per-date-');
  const previousDate = '2026-08-10';
  const currentDate = '2026-08-17';

  const previousCap = capNotYetEligible(
    Array.from({ length: 70 }, (_, i) => notYetEligibleItem(`prev-${String(i).padStart(3, '0')}`))
  );
  const currentCap = capNotYetEligible(
    Array.from({ length: 80 }, (_, i) => notYetEligibleItem(`curr-${String(i).padStart(3, '0')}`))
  );
  assert.equal(previousCap.overflow, true);
  assert.equal(currentCap.overflow, true);

  writeNotYetEligibleOverflowIfNeeded(root, previousDate, previousCap);
  writeNotYetEligibleOverflowIfNeeded(root, currentDate, currentCap);

  const previousPath = path.join(root, notYetEligibleOverflowRelPath(previousDate));
  const currentPath = path.join(root, notYetEligibleOverflowRelPath(currentDate));

  const previousWritten = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
  const currentWritten = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  assert.equal(previousWritten.length, 70, '앞선 실행의 목록이 뒤 실행에 덮이면 안 된다');
  assert.equal(currentWritten.length, 80);
  assert.ok(previousWritten.every(item => item.title.startsWith('future-prev-')));
  assert.ok(currentWritten.every(item => item.title.startsWith('future-curr-')));
  assert.notEqual(previousPath, currentPath, '실행 날짜가 다르면 진단 파일 경로도 달라야 한다');
});
