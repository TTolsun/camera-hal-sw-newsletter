'use strict';

// #724 always-on: coverage 재조정이 main-set을 바꾼 뒤 reporter 선택 플래그가 재조정 결과와
// 일치하는지 고정한다. editor/fact-check/repair/completion/judge는 모두
// selectedReporterCapsules(= reporter.candidates.filter(isFinalSelected))로 작성·검증 집합을
// 정하므로, 이 동기화가 없으면 발행 콘텐츠가 publish_ready/composition 게이트가 승인한 편성과
// 어긋난다(코드 리뷰가 찾은 발행 무결성 버그).
const assert = require('node:assert/strict');
const test = require('node:test');

const { syncReporterSelectionToMain } = require('../../publish/orchestrator-reporter-normalize');
const { isFinalSelected } = require('../../select/selection-diagnostics');

function reporterCandidate(url, overrides = {}) {
  return { url, title: url, final_selected: false, selected_for_editor: false, primary_selected: false, ...overrides };
}

function selectedUrls(reporter) {
  return reporter.candidates.filter(isFinalSelected).map(candidate => candidate.url).sort();
}

test('promoted reserve and demoted main are reflected in reporter selection (content == gate)', () => {
  // 결정론 selected=[a, c], reserve=[b]. 재조정: a 강등, b 승급 → main=[b, c].
  const reporter = {
    candidates: [
      reporterCandidate('a', { final_selected: true, selected_for_editor: true, primary_selected: true }),
      reporterCandidate('b', { reserve_candidate: true }),
      reporterCandidate('c', { final_selected: true, selected_for_editor: true, primary_selected: true })
    ]
  };
  const reconciledMain = [{ url: 'b' }, { url: 'c' }];

  syncReporterSelectionToMain(reporter, reconciledMain);

  // 콘텐츠 파이프라인(isFinalSelected 필터)이 보는 집합이 재조정 편성과 정확히 일치한다.
  assert.deepEqual(selectedUrls(reporter), ['b', 'c']);

  const byUrl = new Map(reporter.candidates.map(candidate => [candidate.url, candidate]));
  // 강등된 a: 세 선택 플래그 모두 false.
  assert.equal(byUrl.get('a').final_selected, false);
  assert.equal(byUrl.get('a').selected_for_editor, false);
  assert.equal(byUrl.get('a').primary_selected, false);
  // 승급된 b: 선택되고 reserve 플래그는 해제(캡슐 중복 방지).
  assert.equal(byUrl.get('b').final_selected, true);
  assert.equal(byUrl.get('b').selected_for_editor, true);
  assert.equal(byUrl.get('b').primary_selected, true);
  assert.equal(byUrl.get('b').reserve_candidate, false);
});

test('reconciliation that changes nothing leaves the deterministic selection intact', () => {
  const reporter = {
    candidates: [
      reporterCandidate('a', { final_selected: true, selected_for_editor: true, primary_selected: true }),
      reporterCandidate('b', { reserve_candidate: true })
    ]
  };
  syncReporterSelectionToMain(reporter, [{ url: 'a' }]);
  assert.deepEqual(selectedUrls(reporter), ['a']);
  assert.equal(reporter.candidates.find(c => c.url === 'b').final_selected, false);
});

test('URL normalization matches reconciled candidates to reporter candidates', () => {
  // 재조정 후보와 reporter 후보의 URL 표기가 달라도(trailing slash 등) 매칭돼야 한다.
  const reporter = { candidates: [reporterCandidate('https://example.com/x')] };
  syncReporterSelectionToMain(reporter, [{ url: 'https://example.com/x/' }]);
  assert.equal(reporter.candidates[0].final_selected, true);
});
