'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCandidate, withinLookback, newsletterDateWindowEnd, candidateRankOrder } =
  require('../../../cli/collect-news-candidates');
const { deepDiveAccrualEntries } = require('../../../collect/deep-dive-topic-accrual');
const { coverageForWeekKey } = require('../../../common/coverage-week');

const source = {
  id: 'androidx-camerax-release-notes', name: 'CameraX release notes',
  url: 'https://developer.android.com/jetpack/androidx/releases/camera',
  sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
  category: 'android-camera', section: 'camera-hal', priority: 'high',
  reliability: 'official', usageHint: 'official', keywords: ['camera'],
  sourceRole: 'official_release_notes'
};

function raw(over) {
  return Object.assign({
    source,
    title: 'CameraX 1.6.1 camera HAL stream configuration change',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    publishedAt: '2026-08-20',
    summary: 'CameraX changes camera HAL stream configuration behavior.',
    sourceKind: 'rss_item', collectionMode: 'rss-item',
    api_or_component: 'CameraX',
    behavior_change: 'Changes camera HAL stream configuration behavior.'
  }, over || {});
}

test('수집기는 후보 레코드에 측정하지 않은 date_source를 스탬프하지 않는다', () => {
  const candidate = normalizeCandidate(raw());
  assert.equal(candidate.date_source || '', '',
    'raw가 date_source를 싣지 않았는데 정규화가 기본값을 지어냈다');
});

test('강등 후보 심층 적립은 수집기 정규화를 거쳐도 날짜 신뢰도를 지어내지 않는다', () => {
  const candidate = normalizeCandidate(raw());
  candidate.relevance_bucket = 'direct_aosp_camera';
  candidate.finalSelectionEligibility = 'watchlist';
  const entries = deepDiveAccrualEntries({
    candidates: [candidate], monitorEvents: [], pageExtracts: [], primaryLaneSources: new Map()
  });
  assert.equal(entries[0].evidence[0].date_source, 'candidate_published_at');
  assert.equal(entries[0].evidence[0].date_confidence, 0);
});

test('정본이 읽어낸 날짜가 창 밖이면 35일 풀에서 빠진다(날짜 파서 불일치로 새지 않는다)', () => {
  const now = newsletterDateWindowEnd('2026-08-22');
  for (const stamp of ['Posted on 2024-01-05 by staff', '[2024-01-05]']) {
    const candidate = normalizeCandidate(raw({ publishedAt: stamp }));
    assert.equal(withinLookback(candidate, now, 35), false, `창 밖 날짜가 새어 나갔다: ${stamp}`);
  }
});

// #927 fix round 1: hasPublishedDate가 "publishedAt이 비어있지 않다"에서
// "정본이 실제로 파싱한다"로 좁아진 지점(evidenceMetadata :787)은 그 자체를 겨냥한
// 테스트가 없어서, line 787을 예전 Boolean(raw.publishedAt) 식으로 되돌려도 전체
// 스위트가 그대로 초록이었다. hasDatedEvidence(rss_item/blog_post_item 레인에서
// metadata.has_published_date를 그대로 물려받는 필드, :573-575)가 이 좁아짐이
// 관측 가능하게 드러나는 지점이다.
test('발행일이 파싱 불가능한 문자열이면 dated evidence로 인정하지 않는다', () => {
  for (const stamp of ['TBD', 'Unknown', 'coming soon']) {
    const candidate = normalizeCandidate(raw({ publishedAt: stamp }));
    assert.equal(candidate.hasDatedEvidence, false,
      `비어있지 않지만 못 읽는 날짜가 dated evidence로 인정됐다: ${stamp}`);
  }
});

test('실제 날짜가 있으면 여전히 dated evidence로 인정한다(위 테스트가 잘못된 이유로 통과하지 않는 대조군)', () => {
  const candidate = normalizeCandidate(raw({ publishedAt: '2026-08-20' }));
  assert.equal(candidate.hasDatedEvidence, true);
});

test('source_change_event는 effective_date가 창 밖이어도 35일 풀에 남는다', () => {
  const now = newsletterDateWindowEnd('2026-06-18');
  const event = {
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    title: 'CameraX | Jetpack | Android Developers',
    source_kind: 'source_change_event',
    publishedAt: '',
    effective_date: '2026-03-25',   // 실측값: 감지는 이번 주, 릴리스 행 날짜는 3개월 전
    date_source: 'release_row_date',
    datePrecision: 'day'
  };
  assert.equal(withinLookback(event, now, 35), true,
    'source_change_event 면제가 사라지면 같은 문서 변경이 매주 재발화·재탈락하는 기아 루프가 된다');
});

test('목록 fallback 후보의 날짜 provenance가 정규화를 통과한다', () => {
  const candidate = normalizeCandidate(raw({
    publishedAt: '',
    sourceKind: 'blog_post_item',
    effective_date: '2026-08-14',
    date_source: 'release_row_date',
    date_confidence: 95,
    date_evidence_url: 'https://claude.com/blog'
  }));
  assert.equal(candidate.effective_date, '2026-08-14');
  assert.equal(candidate.date_source, 'release_row_date');
  assert.equal(candidate.date_confidence, 95, '95가 100으로 승격되면 안 된다');
  assert.equal(candidate.date_evidence_url, 'https://claude.com/blog');
});

// sourceExtractionBackfill(:847)은 release.date를 publishedAt으로, 첫 bullet을
// summary/behavior_change로 승격시킨다. workflow branch(Task 6이 채우는 근거)가 이
// 승격 경로를 타면 목록 날짜의 publishedAt 위장과 필드 분리 무효화가 재발한다.
// sourceExtractionSections(:830)이 release/minor_line_context만 모으므로 지금은 안전하지만,
// 나중에 탐색 범위를 넓히면 다시 깨질 수 있어 회귀를 여기 잠근다.
test('release-only backfill never reads the workflow branch', () => {
  const candidate = normalizeCandidate({
    source,
    title: 'Claude on call',
    url: 'https://claude.com/blog/ai-ci-cd-on-call',
    sourceKind: 'blog_post_item',
    publishedAt: '',
    effective_date: '2026-08-18',
    date_source: 'release_row_date',
    date_confidence: 95,
    summary: 'Real summary.',
    api_or_component: 'Claude Code',
    behavior_change: 'Real behavior change.',
    source_extraction: { workflow: { sections: [{ items: [{ text: 'Workflow paragraph.' }] }] } }
  });
  assert.equal(candidate.publishedAt, '', 'workflow 날짜가 publishedAt으로 승격되면 안 된다');
  assert.equal(candidate.summary, 'Real summary.');
  assert.equal(candidate.behavior_change, 'Real behavior change.');
});

// withinPrimarySelectionWindow(collect-news-candidates.js)는 목록 fallback 후보의 날짜 provenance를
// resolveCandidateDateEvidence로 읽는다(published_date가 없으면 effective_date로 물러선다).
// PR 이전 구현은 raw candidate.publishedAt만 봤다 — 목록 fallback 레인은 publishedAt이 항상 ''라서
// 그 구현으로 되돌아가면 이 가점이 절대 안 붙는다(예외 없이 조용히 사라진다, 회귀 시 테스트 실패도 없다).
test('list-fallback effective_date가 coverage 주 안이면 published_date 후보처럼 primary 가점을 받는다', () => {
  const coverage = coverageForWeekKey('2026-W33'); // 08-10 ~ 08-16
  const now = new Date('2026-08-22T00:00:00Z');
  const listFallback = {
    source_id: 'claude-blog', source: 'claude-blog', title: 'list-fallback-primary',
    publishedAt: '', effective_date: '2026-08-14', // coverage 주 안(나이 2일)
    relevanceScore: 10, source_priority: 'medium', source_reliability: 'official'
  };
  const outOfWindowButHighScore = {
    source_id: 'claude-blog', source: 'claude-blog', title: 'out-of-window-high-score',
    publishedAt: '2026-08-01', // coverage 주 밖(나이 15일) — fallback 등급
    relevanceScore: 90, source_priority: 'medium', source_reliability: 'official'
  };

  const sorted = [outOfWindowButHighScore, listFallback].sort(candidateRankOrder(now, coverage));

  assert.deepEqual(sorted.map(c => c.title), ['list-fallback-primary', 'out-of-window-high-score'],
    'effective_date 2026-08-14는 coverage 주 안이라 relevanceScore가 훨씬 낮아도 앞서야 한다 — ' +
    'withinPrimarySelectionWindow가 raw publishedAt(늘 \'\')만 보는 옛 구현으로 되돌아가면 이 가점이 사라져 ' +
    'relevanceScore만으로 정렬되고 순서가 뒤집힌다');
});

// candidateWindowDate(collect-news-candidates.js)의 published_date 분기는 정본이 돌려주는
// evidence.date(YYYY-MM-DD로 잘린 값)가 아니라 raw publishedAt을 다시 파싱해 시각까지 살린다.
// 이 분기를 지우고 parseDate(evidence.date)만 쓰면, 자정으로 잘린 값과 원문 시각이 몇 시간
// 차이 나는 후보가 창 경계에 걸쳐 있을 때 판정이 뒤집힌다 — 여기서는 UTC-8 오프셋
// '2026-08-22T20:00:00-08:00'(실제 UTC로는 2026-08-23 04:00Z)를 자정(2026-08-23 00:00Z)과
// 새벽 2시(윈도 경계) 사이에 걸쳐 둔다.
test('published_date 후보는 자정이 아니라 원문 시각으로 창 경계를 잰다', () => {
  const now = new Date('2026-09-13T02:00:00Z'); // windowStart = now - 21일 = 2026-08-23T02:00:00Z
  const candidate = { publishedAt: '2026-08-22T20:00:00-08:00' }; // UTC로는 2026-08-23T04:00:00Z
  assert.equal(withinLookback(candidate, now, 21), true,
    '원문 시각(04:00Z)은 창 시작(02:00Z) 안이다 — evidence.date만 쓰면 자정(00:00Z)으로 잘려 ' +
    '창 시작보다 앞선 것으로 잘못 밀려난다');
});

test('근거 URL이 http(s)가 아니면 버린다', () => {
  for (const bad of ['/blog', 'javascript:alert(1)', 'data:text/html,x']) {
    const candidate = normalizeCandidate(raw({ date_evidence_url: bad }));
    assert.equal(candidate.date_evidence_url, '', `fail-open: ${bad}`);
  }
});
