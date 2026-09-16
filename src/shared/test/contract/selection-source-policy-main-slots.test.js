'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { articlePolicy } = require('../../common/newsletter-policy');
const {
  buildShortlistReport,
  policyDriverCandidate
} = require('../helpers/selection-builders');
const { buildSelectionReport } = require('../../../generator/publish/orchestrator-report-builders');
const { selectionStatusExtra } = require('../../../generator/publish/orchestrator-status-builders');

// 소스 정책이 main을 차단한 후보(main_article_source_allowed:false)는 결정론 선정의 main 슬롯을
// 받으면 안 된다(#1126). 실측 2026-09-14호: lore 빌드봇 보고 "[sailus-media-tree:ipu6] BUILD
// SUCCESS …"가 evidence_score 8로 점수 1위였는데, 선정은 main_article_score_eligible만 보고
// main 슬롯을 내줬고 editor hard block(blocked_source_quality)이 걷어내 selected 5 / rendered 4가
// 됐다. 차단 후보는 main에서만 빠지고 reserve·참고 레인에는 남아야 하므로, 이 계약은
// selected_articles와 reserve_candidates를 함께 본다.

const ISSUE_DATE = '2026-05-10';

// 제목이 서로 비슷하면 shortlist의 near-duplicate dedup이 먼저 걸러 슬롯 경쟁까지 오지 않는다.
const DISTINCT_TITLES = [
  'V4L2 sensor driver rework',
  'libcamera IPA module refresh',
  'Camera HAL buffer manager change',
  'ISP tuning parameter contract',
  'CSI-2 receiver frame routing fix'
];

function fullWeekOfDriverCandidates() {
  return DISTINCT_TITLES.map((title, index) => policyDriverCandidate(index, { title }));
}

// 실측 모양 그대로: 메일링 리스트 소스, cross_check_required_but_missing 하나만 blocker.
// 제목·본문을 빌드봇 보고 문구로 두는 이유는 decorate 시점의 메일링 리스트 패치 승급
// (applyMailingListPatchEligibilityToCandidate)이 이 fixture를 true로 뒤집지 못하게 하기 위해서다.
// 승급은 technicalDepth(제목·summary·behavior_change의 HAL/driver/kernel… 키워드) 0.5 이상을
// 요구하는데 빌드봇 문구는 0.25에 머문다(실측 동일). 승급을 패치 제출 제목으로 한정하는
// #1129 뒤에도 BUILD SUCCESS는 패치 제출이 아니므로 결과가 같다 — 머지 순서와 무관하다.
function sourcePolicyBlockedTopScorer() {
  const buildBotReport = 'tree/branch: git://linuxtv.org/sailus/media_tree.git ipu6 branch HEAD: 6f6d9729 ' +
    'elapsed time: 4351m configs tested: 43 configs skipped: 0 The following configs have been built successfully.';
  return policyDriverCandidate(90, {
    title: '[sailus-media-tree:ipu6] BUILD SUCCESS 6f6d9729301fbf8fadff3c1822cdd730ef6cd213',
    url: 'https://lore.kernel.org/linux-media/202609071453.Wr61Aa3p-lkp@intel.com/',
    source: 'lore.kernel.org linux-media list (Intel IPU)',
    summary: buildBotReport,
    behavior_change: buildBotReport,
    api_or_component: 'gcc',
    editorial_priority: 1,
    evidence_score: 10,
    driver_stack_relevance: 5,
    source_role: 'project_mailing_list_source',
    source_url_quality: 'project_mailing_list_release',
    source_quality_status: 'blocked',
    main_article_source_allowed: false,
    main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
    main_article_source_blockers: ['cross_check_required_but_missing'],
    cross_check_status: 'required_missing',
    requires_cross_check: true,
    source_quality: {
      source_role: 'project_mailing_list_source',
      source_url_quality: 'project_mailing_list_release',
      source_quality_status: 'blocked',
      main_article_source_allowed: false,
      main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
      main_article_source_blockers: ['cross_check_required_but_missing'],
      cross_check_status: 'required_missing',
      requires_cross_check: true,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'primary_confirmation',
      evidence_granularity: 'article_with_primary_confirmation'
    }
  });
}

test('a source-policy-blocked candidate never takes a deterministic main slot even as the top scorer', () => {
  const blocked = sourcePolicyBlockedTopScorer();
  const report = buildShortlistReport(ISSUE_DATE, [blocked, ...fullWeekOfDriverCandidates()], {});

  const selectedUrls = report.selected_articles.map(article => article.url);
  assert.ok(
    !selectedUrls.includes(blocked.url),
    `차단 후보가 main 슬롯을 받았다: ${JSON.stringify(selectedUrls)}`
  );
  assert.equal(
    report.selected_articles.length,
    articlePolicy.mainArticleCount.max,
    '차단 후보가 빠져도 정상 후보 5건이 max 슬롯을 그대로 채운다'
  );
  assert.ok(
    report.reserve_candidates.some(candidate => candidate.url === blocked.url),
    'main에서만 빠지고 reserve에는 남아야 한다 — reserve 루프는 이 술어를 보지 않는다'
  );
});

test('the committed selection report says why the blocked top scorer stayed in reserve', () => {
  // #1133: candidate_diagnostics 행만 보고 "점수 부족"과 "정책 차단"을 가를 수 있어야 한다.
  // eligible_candidate_urls는 shortlist 전체라 차단 후보를 그대로 담는다 — 그 목록을 좁히면
  // eligible_candidate_count와의 길이 계약(selection-eligible-candidate-urls.test.js)이 깨진다.
  const blocked = sourcePolicyBlockedTopScorer();
  const shortlist = buildShortlistReport(ISSUE_DATE, [blocked, ...fullWeekOfDriverCandidates()], {});
  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));

  // 진단 행의 url은 normalized_url이다(투영이 정규화 후 값을 우선한다).
  const blockedInReserve = shortlist.reserve_candidates.find(candidate => candidate.url === blocked.url);
  const blockedRow = selectionReport.candidate_diagnostics.find(row => row.url === blockedInReserve.normalized_url);
  assert.ok(blockedRow, '차단 후보 행이 candidate_diagnostics에 없다');
  assert.equal(blockedRow.stage, 'reserve');
  assert.deepEqual(blockedRow.source_policy_blockers, ['cross_check_required_but_missing']);
  assert.ok(
    selectionReport.candidate_diagnostics
      .filter(row => row.url !== blockedRow.url)
      .every(row => !('source_policy_blockers' in row)),
    '판정이 없는 후보 행에 source_policy_blockers가 생기면 안 된다'
  );
  assert.ok(selectionReport.eligible_candidate_urls.includes(blocked.url));
});

test('a candidate without any source-policy verdict is still main-selectable (explicit false only)', () => {
  // 공유 fixture 빌더와 discovery 경로 후보(실측 09-14: 71건 중 31건)는 이 플래그를 싣지 않는다.
  // 술어가 `!== true`면 이들이 전부 main에서 빠져 로컬과 프로덕션이 갈라진다.
  const bare = policyDriverCandidate(91, { title: 'IPU6 CSI-2 receiver reset sequence' });
  assert.equal(bare.main_article_source_allowed, undefined);

  const report = buildShortlistReport(ISSUE_DATE, [bare], {});

  assert.deepEqual(report.selected_articles.map(article => article.url), [bare.url]);
});
