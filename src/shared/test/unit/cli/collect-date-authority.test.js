'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCandidate, withinLookback, newsletterDateWindowEnd } =
  require('../../../cli/collect-news-candidates');
const { deepDiveAccrualEntries } = require('../../../collect/deep-dive-topic-accrual');

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

test('근거 URL이 http(s)가 아니면 버린다', () => {
  for (const bad of ['/blog', 'javascript:alert(1)', 'data:text/html,x']) {
    const candidate = normalizeCandidate(raw({ date_evidence_url: bad }));
    assert.equal(candidate.date_evidence_url, '', `fail-open: ${bad}`);
  }
});
