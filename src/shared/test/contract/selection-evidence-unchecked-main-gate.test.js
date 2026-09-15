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
const { renderCandidateSelectionDiagnostics } = require('../../../generator/select/selection-diagnostics');

// 원문을 한 번도 받지 않은 후보(evidence_validation_status: not_checked)는 결정론 선정의 main
// 슬롯을 받으면 안 된다(#1108). 실측 2026-09-07호: 발행 5건 중 patchwork 28179·28194 두 건이
// not_checked였고(source_fetch_used:false, supported_claims:0) 둘 다 원문의 의미를 틀렸다.
// fact-check는 문장이 출처에 묶였는지를 볼 뿐 원문과 대조하지 않으므로 그 층이 못 잡는다.
// 차단 후보는 main에서만 빠지고 reserve·참고 레인에는 남아야 하므로(#1126과 같은 층), 이
// 계약은 selected_articles와 reserve_candidates를 함께 본다.

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

function uncheckedTopScorer(overrides = {}) {
  return policyDriverCandidate(90, {
    title: 'libcamera software ISP worker start hang fix',
    url: 'https://patchwork.libcamera.org/patch/28194/',
    editorial_priority: 1,
    evidence_score: 10,
    driver_stack_relevance: 5,
    evidence_validation_status: 'not_checked',
    ...overrides
  });
}

function selectedUrls(report) {
  return report.selected_articles.map(article => article.url);
}

test('a not_checked candidate never takes a deterministic main slot even as the top scorer', () => {
  const unchecked = uncheckedTopScorer();
  const report = buildShortlistReport(ISSUE_DATE, [unchecked, ...fullWeekOfDriverCandidates()], {});

  assert.ok(
    !selectedUrls(report).includes(unchecked.url),
    `원문 미수신 후보가 main 슬롯을 받았다: ${JSON.stringify(selectedUrls(report))}`
  );
  assert.equal(
    report.selected_articles.length,
    articlePolicy.mainArticleCount.max,
    '차단 후보가 빠져도 정상 후보 5건이 max 슬롯을 그대로 채운다'
  );
  assert.ok(
    report.reserve_candidates.some(candidate => candidate.url === unchecked.url),
    'main에서만 빠지고 reserve에는 남아야 한다 — reserve 루프는 이 술어를 보지 않는다'
  );
});

test('only the exact not_checked value blocks; other statuses and a missing field stay main-selectable', () => {
  // 기본 모드(로컬 실행·테스트)의 입력 candidates.json에는 이 필드가 없다. 없는 값을 차단으로
  // 읽으면 로컬과 프로덕션이 갈라진다. fetch 실패는 선정 통과가 정해진 안전한 값이고(#1108
  // 코멘트), blocked는 final_selection_blocked로 exclusionReasons()가 따로 다룬다.
  const passing = [
    policyDriverCandidate(91, { title: 'IPU6 CSI-2 receiver reset sequence' }),
    policyDriverCandidate(92, { title: 'imx708 sensor binding update', evidence_validation_status: 'pass' }),
    policyDriverCandidate(93, {
      title: 'uvcvideo probe ordering change', evidence_validation_status: 'fetch_failed_review_required'
    }),
    policyDriverCandidate(94, {
      title: 'atomisp cleanup series', evidence_validation_status: 'editor_review_required'
    })
  ];
  assert.equal(passing[0].evidence_validation_status, undefined);

  const report = buildShortlistReport(ISSUE_DATE, passing, {});

  assert.deepEqual(selectedUrls(report).sort(), passing.map(candidate => candidate.url).sort());
});

// --- 관측 영속화 계약 ---------------------------------------------------------
//
// 선례(#838 release_class_catch_up, #963 republication_cooldown_blocked): 전체 shortlistReport가
// 담기는 shortlisted-candidates.json은 커밋되지 않는다. 이 값이 두 allow-list(orchestrator-report-
// builders·orchestrator-status-builders)와 selection-diagnostics 렌더를 전부 통과해야 커밋되는
// selection-report.json·generation-status.json·selection-diagnostics.md에 남고, 다음 호에서
// "게이트가 main 자격을 거둔 후보가 몇 건인가"를 발행 기사 수와 나란히 커밋 이력만으로 볼 수 있다.

test('the unchecked-evidence block reaches the committed selection-report.json', () => {
  const unchecked = uncheckedTopScorer();
  const shortlist = buildShortlistReport(ISSUE_DATE, [unchecked, ...fullWeekOfDriverCandidates()], {});

  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));
  assert.deepEqual(selectionReport.evidence_unchecked_main_blocked, {
    count: 1,
    candidate_urls: [unchecked.url]
  });
});

test('a run that blocks nothing reports zero rather than nothing', () => {
  // 관측 누락(null)과 "아무것도 막지 않음"(count 0)이 같은 값으로 접히면, 게이트 배선이 끊겨도
  // 정상 출력처럼 보인다.
  const shortlist = buildShortlistReport(ISSUE_DATE, fullWeekOfDriverCandidates(), {});

  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));
  assert.deepEqual(selectionReport.evidence_unchecked_main_blocked, { count: 0, candidate_urls: [] });
});

test('only candidates the other main predicates already admit are counted as blocked', () => {
  // 어차피 main이 못 되던 후보(소스 정책 차단)까지 세면 이 게이트의 몫이 아니게 된다.
  const alsoSourceBlocked = uncheckedTopScorer({
    url: 'https://patchwork.libcamera.org/patch/28179/',
    title: 'libcamera controls storage union naming',
    main_article_source_allowed: false
  });
  const shortlist = buildShortlistReport(ISSUE_DATE, [alsoSourceBlocked, ...fullWeekOfDriverCandidates()], {});

  assert.deepEqual(shortlist.evidence_unchecked_main_blocked, { count: 0, candidate_urls: [] });
});

test('the unchecked-evidence block passes the selection status allow-list', () => {
  // selectionStatusExtra는 selection-diagnostics.md와 generation-status.json이 함께 거치는
  // allow-list다. 여기서 빠지면 진단이 매 run 'unknown'으로 찍혀 관측이 없는 것과 같아진다.
  const unchecked = uncheckedTopScorer();
  const shortlist = buildShortlistReport(ISSUE_DATE, [unchecked, ...fullWeekOfDriverCandidates()], {});

  assert.deepEqual(selectionStatusExtra(shortlist).evidence_unchecked_main_blocked, {
    count: 1,
    candidate_urls: [unchecked.url]
  });
});

test('the unchecked-evidence block is rendered into selection-diagnostics.md', () => {
  // 렌더는 production writer와 같은 seam(selectionStatusExtra)을 통과해야 한다.
  const unchecked = uncheckedTopScorer();
  const blockedWeek = buildShortlistReport(ISSUE_DATE, [unchecked, ...fullWeekOfDriverCandidates()], {});
  assert.match(
    renderCandidateSelectionDiagnostics(selectionStatusExtra(blockedWeek)),
    /- evidence_unchecked_main_blocked: 1/
  );

  const quietWeek = buildShortlistReport(ISSUE_DATE, fullWeekOfDriverCandidates(), {});
  assert.match(
    renderCandidateSelectionDiagnostics(selectionStatusExtra(quietWeek)),
    /- evidence_unchecked_main_blocked: 0/
  );

  // 필드 자체가 없는 보고서(게이트 이전 산출물)는 0이 아니라 unknown이다.
  assert.match(renderCandidateSelectionDiagnostics({}), /- evidence_unchecked_main_blocked: unknown/);
});

// --- 2026-09-07호 축약 재생 ----------------------------------------------------
//
// 그 주 merged-candidates.json에서 발행 5건과 reserve 2건의 URL·제목·evidence_validation_status만
// 옮긴 최소 입력이다. 발행일·anchor·점수는 공유 fixture 기본값이다 — 창 판정은 이 계약의 대상이
// 아니다. 실제 산출물 재생(같은 주 입력 69건)에서도 결과는 같다: 28179·28194가 main에서 빠지고
// reserve에 있던 S5KJN5(pass)·OV5693 on IPU6(pass)이 올라와 5건이 유지된다.

function week0907Candidates() {
  const lore = (index, title, url) => policyDriverCandidate(index, {
    title, url, source: 'lore.kernel.org linux-media list', evidence_validation_status: 'pass'
  });
  const patchwork = (index, title, url) => policyDriverCandidate(index, {
    title, url, source: 'libcamera Patchwork (patch review)', evidence_validation_status: 'not_checked',
    // 그 주 점수 1·2위였다 — 게이트 없이는 이 둘이 슬롯을 먼저 가져간다.
    editorial_priority: 1, evidence_score: 10
  });
  return [
    lore(1, 'media: i2c: Add OmniVision OG0VA1B camera sensor driver',
      'https://lore.kernel.org/linux-media/20260901-og0va1b-v6-0-a05b2d04c892@oss.qualcomm.com/'),
    lore(2, 'x1e camss csi2 phy dtsi',
      'https://lore.kernel.org/linux-media/20260906-x1e-camss-csi2-phy-dtsi-v6-0-067f2ecc4630@linaro.org/'),
    lore(3, 'staging media atomisp gc0310 cleanup',
      'https://lore.kernel.org/linux-media/cover.1788360629.git.mauriziocasciano7@gmail.com/'),
    patchwork(4, 'libcamera: controls: Give name to the union containing storage',
      'https://patchwork.libcamera.org/patch/28179/'),
    patchwork(5, 'libcamera: software_isp: Skip stop before worker start',
      'https://patchwork.libcamera.org/patch/28194/'),
    lore(6, 'media: i2c: Add Samsung S5KJN5 image sensor',
      'https://lore.kernel.org/linux-media/20260901-sk5jn5-v3-0-17e728917bd4@oss.qualcomm.com/'),
    lore(7, 'media: Enable the OV5693 front camera on IPU6 Surface devices',
      'https://lore.kernel.org/linux-media/20260902142322.73523-1-fernandorimoli11@gmail.com/')
  ];
}

test('2026-09-07 replay: the two unchecked patchwork articles leave main and two fetched lore series fill the slots', () => {
  const candidates = week0907Candidates();
  const patchworkUrls = candidates
    .filter(candidate => candidate.evidence_validation_status === 'not_checked')
    .map(candidate => candidate.url);
  const loreUrls = candidates
    .filter(candidate => candidate.evidence_validation_status === 'pass')
    .map(candidate => candidate.url);

  const report = buildShortlistReport(ISSUE_DATE, candidates, {});

  assert.deepEqual(selectedUrls(report).sort(), loreUrls.sort(), '원문을 받은 lore 5건만 main이 된다');
  assert.equal(report.selected_articles.length, articlePolicy.mainArticleCount.max, '기사 수는 줄지 않는다');
  for (const url of patchworkUrls) {
    assert.ok(report.reserve_candidates.some(candidate => candidate.url === url), `${url}는 reserve에 남는다`);
  }
  assert.deepEqual(report.evidence_unchecked_main_blocked.candidate_urls.sort(), patchworkUrls.sort());
});
