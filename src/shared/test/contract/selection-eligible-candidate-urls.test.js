'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildShortlistReport, policyPrimaryCandidate } = require('../helpers/selection-builders');
const { buildSelectionReport } = require('../../../generator/publish/orchestrator-report-builders');
const { selectionStatusExtra } = require('../../../generator/publish/orchestrator-status-builders');

const ISSUE_DATE = '2026-05-10';

// 제목이 서로 비슷하면 shortlist의 near-duplicate dedup이 먼저 걸러 자격 판정까지 오지 않는다.
const DISTINCT_TITLES = [
  'CameraX release notes update',
  'V4L2 sensor driver rework',
  'libcamera IPA module refresh',
  'Camera HAL buffer manager change',
  'ISP tuning parameter contract'
];

function distinctPrimaryCandidates(count) {
  return DISTINCT_TITLES.slice(0, count)
    .map((title, index) => policyPrimaryCandidate(index, { title }));
}

test('the eligible candidate list reaches the committed selection-report.json', () => {
  // 선례(#838 release_class_catch_up, #963 republication_cooldown_blocked): 전체
  // shortlistReport가 담기는 shortlisted-candidates.json은 커밋되지 않는다. 이 투영을
  // 통과해야만 '자격은 통과했는데 선정되지 않은 후보'를 커밋 이력만으로 짚을 수 있다.
  const shortlist = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {});
  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));

  assert.ok(Array.isArray(selectionReport.eligible_candidate_urls));
  assert.equal(
    selectionReport.eligible_candidate_urls.length,
    selectionReport.counts.eligible_candidate_count,
    '목록 길이가 eligible_candidate_count 와 다르면 소비자가 대조에서 막힌다'
  );
});

test('the listed URLs join with the published issue form, not the normalized one', () => {
  // issue.json 의 source_candidate_url 은 정규화 전 url 이다. normalized_url 로 내보내면
  // 발행 기사와 조인이 어긋나 '선정되지 않은 후보'를 빼낼 수 없다.
  const shortlist = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {});
  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));

  for (const url of selectionReport.eligible_candidate_urls) {
    assert.match(url, /^https:\/\/example\.com\/policy-primary-\d+$/);
  }
});

test('a run that never wired the list says so instead of reporting an empty pool', () => {
  // 관측 누락(null)과 '자격 통과 후보 없음'([])이 같은 값으로 접히면, 배선이 끊겨도
  // 정상 출력처럼 보인다. #963 과 같은 실패 유형이다.
  const unwired = selectionStatusExtra({ eligible_candidate_count: 3 });
  assert.equal(unwired.eligible_candidate_urls, null);

  const selectionReport = buildSelectionReport(ISSUE_DATE, { eligible_candidate_count: 3 }, unwired);
  assert.equal(selectionReport.eligible_candidate_urls, null);
});
