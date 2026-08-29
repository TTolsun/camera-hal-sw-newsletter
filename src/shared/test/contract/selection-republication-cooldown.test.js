'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildShortlistReport,
  policyPrimaryCandidate
} = require('../helpers/selection-builders');
const { buildSelectionReport } = require('../../../generator/publish/orchestrator-report-builders');
const { selectionStatusExtra } = require('../../../generator/publish/orchestrator-status-builders');
const { renderCandidateSelectionDiagnostics } = require('../../../generator/select/selection-diagnostics');
const {
  NEWSLETTER_ARTICLE_COOLDOWN_DAYS
} = require('../../../generator/reporter/article-exposure-history');
const { normalizeArticleUrl } = require('../../common/article-identity');

const ISSUE_DATE = '2026-05-10';

function historyWith(records) {
  return {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-05-01', backfill_included: false },
    articles: records
  };
}

function publishedRecord(url, { newsletterDate, cooldownUntil }) {
  return {
    article_identity_key: `url:${url}`,
    title: url,
    source_url: url,
    newsletter_date: newsletterDate,
    exposure_type: 'newsletter_article',
    exposed_at: newsletterDate,
    newsletter_article_date: newsletterDate,
    cooldown_until: cooldownUntil,
    exposure_types: ['newsletter_article']
  };
}

function urls(candidates) {
  return (candidates || []).map(candidate => candidate.url);
}

// 제목이 서로 비슷하면 shortlist의 near-duplicate dedup이 먼저 걸러 쿨다운 판정까지 오지 않는다.
const DISTINCT_TITLES = [
  'CameraX release notes update',
  'V4L2 sensor driver rework',
  'libcamera IPA module refresh',
  'Camera HAL buffer manager change',
  'ISP tuning parameter contract',
  'Camera provider AIDL revision',
  'Depth sensor timestamp alignment',
  'Flash strobe timing calibration',
  'Zoom ratio control mapping',
  'Raw Bayer capture stream setup',
  'Multi camera physical stream sync',
  'Autofocus region metadata tag',
  'Video stabilization buffer path',
  'Preview surface format negotiation'
];

function distinctPrimaryCandidates(count) {
  return DISTINCT_TITLES.slice(0, count)
    .map((title, index) => policyPrimaryCandidate(index, { title }));
}

function candidateUrlAt(index) {
  return `https://example.com/policy-primary-${index}`;
}

test('a candidate published as a main article within the cooldown does not reach selection', () => {
  const blockedUrl = candidateUrlAt(0);
  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([
      publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  assert.ok(!urls(report.selected_articles).includes(blockedUrl));
  assert.ok(!urls(report.reserve_candidates).includes(blockedUrl));
  assert.ok(!urls(report.shortlisted_candidates).includes(blockedUrl));

  const excludedMatch = report.excluded_candidates.find(candidate => candidate.url === blockedUrl);
  assert.ok(excludedMatch, 'blocked candidate must be reported as excluded with a reason');
  assert.ok(excludedMatch.exclusion_reasons.some(reason => /republication cooldown/.test(reason)));

  // 이 설계의 핵심 잠금: 재게재 후보를 상류에서 걷어냈으므로 경고가 생기지 않고, 그 주 전체가
  // review-only로 강등되지 않는다.
  assert.deepEqual(report.selection_warnings, []);
  assert.equal(report.publish_ready, true);
  assert.equal(report.selected_article_count, 2);
});

test('a candidate published within the cooldown does not reach the reserve lane either', () => {
  // 6개를 넣으면 max(5)를 넘겨 정확히 policy-primary-1이 reserve로 떨어진다(결정론 정렬).
  // reconcileCoverage가 reserve를 main으로 승급시키므로 이 통로도 함께 닫혀야 한다.
  const reserveUrl = candidateUrlAt(1);
  const baseline = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(6), {});
  assert.deepEqual(urls(baseline.reserve_candidates), [reserveUrl]);

  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(6), {
    exposureHistory: historyWith([
      publishedRecord(reserveUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  assert.deepEqual(urls(report.reserve_candidates), []);
  assert.ok(!urls(report.selected_articles).includes(reserveUrl));
  assert.ok(report.excluded_candidates.some(candidate =>
    candidate.url === reserveUrl &&
    candidate.exclusion_reasons.some(reason => /republication cooldown/.test(reason))));
  assert.equal(report.publish_ready, true);
});

test('re-running the same date does not block the articles that issue itself published', () => {
  // 워크플로 03은 ref: main을 체크아웃하므로, 이미 발행된 날짜로 generate를 다시 돌리면 state
  // 파일에 그 주 자신의 레코드가 들어 있다. 그 레코드로 자기 기사를 막으면 재실행이 편성을
  // 통째로 갈아치운다.
  const ownUrl = candidateUrlAt(0);
  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([
      publishedRecord(ownUrl, { newsletterDate: ISSUE_DATE, cooldownUntil: '2026-05-31' })
    ])
  });

  assert.ok(urls(report.selected_articles).includes(ownUrl));
  assert.deepEqual(report.excluded_candidates.filter(candidate => candidate.url === ownUrl), []);
  assert.equal(report.selected_article_count, 3);
});

// catch-up 레인은 primary 레인과 다른 통로다. 선정 pool이 아니라 reference 창 후보를 보고,
// 쿨다운 술어가 아니라 게재 이력 술어(everCoveredAsNewsletterArticle)로 거른다. 자기차단 해제가
// primary 레인에만 적용되면 같은 회귀가 이 통로에 그대로 남는다.
const CATCH_UP_ISSUE_DATE = '2026-06-10';
const CATCH_UP_URL = 'https://source.android.com/docs/core/camera/aidl-v3';
const CATCH_UP_POLICY = {
  enabled: true,
  maxCatchUpArticles: 2,
  maxAgeDays: 90,
  targetMainArticles: 3,
  eligibleBuckets: ['direct_aosp_camera'],
  activationMode: 'fill_open_slots'
};

function strongRelease(overrides = {}) {
  return {
    relevance_bucket: 'direct_aosp_camera',
    aosp_camera_directness: 4,
    counts_as_primary_camera_topic: true,
    has_dated_evidence: true,
    finalSelectionEligibility: 'main',
    api_or_component: 'CameraX',
    ...overrides
  };
}

function catchUpWeekReport(exposureHistory) {
  return buildShortlistReport(CATCH_UP_ISSUE_DATE, {
    candidates: [
      strongRelease({
        title: 'CameraX 1.7.0',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0',
        published_date: '2026-06-01',
        version_or_release: '1.7.0',
        behavior_change: 'SessionConfig API'
      }),
      strongRelease({
        title: 'Camera HAL AIDL v3 interface update',
        url: CATCH_UP_URL,
        published_date: '2026-05-10',
        version_or_release: 'AIDL v3',
        behavior_change: 'ICameraDevice interface change'
      })
    ]
  }, { exposureHistory, catchUpPolicy: CATCH_UP_POLICY });
}

function catchUpRecord(newsletterArticleDate) {
  return historyWith([publishedRecord(CATCH_UP_URL, {
    newsletterDate: newsletterArticleDate,
    cooldownUntil: '2026-07-01'
  })]);
}

test('re-running the same date does not block the catch-up article that issue itself published', () => {
  const baseline = catchUpWeekReport(historyWith([]));
  assert.equal(baseline.catch_up_used_count, 1, '이 fixture는 catch-up 승급이 일어나는 주여야 한다');
  assert.ok(urls(baseline.selected_articles).includes(CATCH_UP_URL));

  const rerun = catchUpWeekReport(catchUpRecord(CATCH_UP_ISSUE_DATE));
  assert.equal(rerun.catch_up_used_count, 1);
  assert.ok(urls(rerun.selected_articles).includes(CATCH_UP_URL));
  assert.deepEqual(urls(rerun.selected_articles), urls(baseline.selected_articles));
});

test('a previous issue still keeps its article out of the catch-up lane', () => {
  const report = catchUpWeekReport(catchUpRecord('2026-06-03'));
  assert.equal(report.catch_up_used_count, 0);
  assert.ok(!urls(report.selected_articles).includes(CATCH_UP_URL));
});

test('the previous issue still blocks even though the same run date does not', () => {
  // 자기차단 해제가 쿨다운 자체를 무력화하면 안 된다. 발행일이 실행 date와 다르면 그대로 막힌다.
  const previousUrl = candidateUrlAt(0);
  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([
      publishedRecord(previousUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  assert.ok(!urls(report.selected_articles).includes(previousUrl));
  assert.equal(report.selected_article_count, 2);
});

test('a candidate whose cooldown has passed is not blocked', () => {
  const url = candidateUrlAt(0);
  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(2), {
    exposureHistory: historyWith([
      publishedRecord(url, { newsletterDate: '2026-03-01', cooldownUntil: '2026-03-22' })
    ])
  });

  assert.ok(urls(report.selected_articles).includes(url));
  assert.deepEqual(report.selection_warnings, []);
});

test('a different release anchor on the same page is not blocked', () => {
  const publishedUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03';
  const nextUrl = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha04';
  const [first, second] = distinctPrimaryCandidates(2);
  const report = buildShortlistReport(ISSUE_DATE, [{ ...first, url: nextUrl }, second], {
    exposureHistory: historyWith([
      publishedRecord(publishedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  assert.ok(urls(report.selected_articles).includes(nextUrl));
  assert.deepEqual(report.excluded_candidates.filter(candidate => candidate.url === nextUrl), []);
});

test('the cooldown filter does not narrow the shared main article score gate', () => {
  const blockedUrl = candidateUrlAt(0);
  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(2), {
    exposureHistory: historyWith([
      publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  const blocked = report.excluded_candidates.find(candidate => candidate.url === blockedUrl);
  // main_article_score_eligible는 점수 게이트이고 catch-up 레인이 재사용하는 공유 길목이다.
  // 이력 사유를 그 필드에 섞으면 이 이슈와 무관한 판정까지 함께 좁아진다.
  assert.equal(blocked.main_article_score_eligible, true);
  assert.deepEqual(blocked.score_filter_reasons, []);
});

test('the republication block reaches the committed selection-report.json', () => {
  // 선례(#838, release_class_catch_up): 전체 shortlistReport가 담기는
  // shortlisted-candidates.json은 커밋되지 않는다. 이 투영을 통과해야만 과차단이 시작됐는지를
  // 다음 run에서 커밋 이력만으로 판정할 수 있다.
  const blockedUrl = candidateUrlAt(0);
  const shortlist = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([
      publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));
  assert.deepEqual(selectionReport.republication_cooldown_blocked, {
    history_loaded: true,
    count: 1,
    urls: [blockedUrl]
  });
});

test('a run that blocks nothing reports zero rather than nothing', () => {
  // 관측 누락(null)과 "아무것도 막지 않음"(count 0)이 같은 값으로 접히면, 게이트가 죽어도
  // 정상 출력처럼 보인다.
  const shortlist = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([])
  });

  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));
  assert.deepEqual(selectionReport.republication_cooldown_blocked,
    { history_loaded: true, count: 0, urls: [] });
});

test('a run that never loaded the exposure history says so instead of reporting zero blocks', () => {
  // #963의 실패 유형은 게이트가 조용히 죽은 것이다(호출부가 root를 안 넘겨 exposureHistory가
  // 항상 null). history_loaded가 없으면 그 주의 커밋 산출물이 건강한 주와 바이트 동일이라
  // 배선이 다시 회귀해도 아무도 모른다.
  const shortlist = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {});

  const selectionReport = buildSelectionReport(ISSUE_DATE, shortlist, selectionStatusExtra(shortlist));
  assert.deepEqual(selectionReport.republication_cooldown_blocked,
    { history_loaded: false, count: 0, urls: [] });
});

test('the republication block passes the selection status allow-list', () => {
  // selectionStatusExtra는 selection-diagnostics.md와 generation-status.json이 함께 거치는
  // allow-list다. 여기서 빠지면 진단이 매 run 'unknown'으로 찍혀 관측이 없는 것과 같아진다.
  const blockedUrl = candidateUrlAt(0);
  const shortlist = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([
      publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  assert.deepEqual(selectionStatusExtra(shortlist).republication_cooldown_blocked, {
    history_loaded: true,
    count: 1,
    urls: [blockedUrl]
  });
});

test('the republication block is rendered into selection-diagnostics.md', () => {
  // 렌더는 production writer와 같은 seam(selectionStatusExtra)을 통과해야 한다.
  const blockedUrl = candidateUrlAt(0);
  const blockedWeek = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {
    exposureHistory: historyWith([
      publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });
  const blockedMarkdown = renderCandidateSelectionDiagnostics(selectionStatusExtra(blockedWeek));
  assert.match(blockedMarkdown, /- republication_history_loaded: true/);
  assert.match(blockedMarkdown, /- republication_cooldown_blocked: 1/);

  // 이력을 못 읽은 주는 "0건 차단"이 아니라 "관측 없음"으로 읽혀야 한다.
  const unwiredMarkdown = renderCandidateSelectionDiagnostics(
    selectionStatusExtra(buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), {}))
  );
  assert.match(unwiredMarkdown, /- republication_history_loaded: false/);
  assert.match(unwiredMarkdown, /- republication_cooldown_blocked: 0/);

  // 필드 자체가 없는 보고서(예전 산출물)는 unknown이다. false와 접히면 안 된다.
  const legacyMarkdown = renderCandidateSelectionDiagnostics({});
  assert.match(legacyMarkdown, /- republication_history_loaded: unknown/);
  assert.match(legacyMarkdown, /- republication_cooldown_blocked: unknown/);
});

function tempRootWithHistory(history) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selection-republication-cooldown-'));
  if (history) {
    fs.mkdirSync(path.join(root, 'state'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'state', 'article-exposure-history.json'),
      `${JSON.stringify(history, null, 2)}\n`,
      'utf8'
    );
  }
  return root;
}

test('the exposure history is read from root when no history object is passed', () => {
  const blockedUrl = candidateUrlAt(0);
  const root = tempRootWithHistory(historyWith([
    publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
  ]));

  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), { root });

  assert.ok(!urls(report.selected_articles).includes(blockedUrl));
  assert.ok(report.excluded_candidates.some(candidate =>
    candidate.url === blockedUrl &&
    candidate.exclusion_reasons.some(reason => /republication cooldown/.test(reason))));
});

test('a root without a history file falls back to the seed path without breaking selection', () => {
  const root = tempRootWithHistory(null);

  const report = buildShortlistReport(ISSUE_DATE, distinctPrimaryCandidates(3), { root });

  assert.equal(report.selected_article_count, 3);
  assert.deepEqual(report.selection_warnings, []);
  assert.equal(report.publish_ready, true);
});

test('the shortlist cap is applied after the cooldown filter, so a blocked seat is refilled', () => {
  // cap(12) slice가 필터보다 앞에 있으면, 잘린 자리가 cap 밖 후보로 채워지지 않고 그대로 빈다.
  // eligible_candidate_count와 거기서 파생되는 구성 요약·부족 힌트·preflight가 실제 후보 풀보다
  // 작게 보고된다. 선정과 reserve는 cap 없는 pool을 읽으므로 이 순서는 편성을 바꾸지 않는다.
  // 선정되지 않는 후보를 막는다. 선정된 후보를 막으면 편성이 바뀌는 것이 당연해져(그게 게이트의
  // 일이다) cap 순서만 따로 볼 수 없다.
  const blockedUrl = candidateUrlAt(2);
  const pool = distinctPrimaryCandidates(14);
  const baseline = buildShortlistReport(ISSUE_DATE, pool, { exposureHistory: historyWith([]) });
  assert.equal(baseline.eligible_candidate_count, 12, 'cap에 걸린 주여야 이 검사가 의미를 갖는다');
  assert.ok(!urls(baseline.selected_articles).includes(blockedUrl));

  const report = buildShortlistReport(ISSUE_DATE, pool, {
    exposureHistory: historyWith([
      publishedRecord(blockedUrl, { newsletterDate: '2026-05-03', cooldownUntil: '2026-05-24' })
    ])
  });

  assert.equal(report.eligible_candidate_count, 12);
  assert.deepEqual(report.selected_articles.map(candidate => candidate.url),
    baseline.selected_articles.map(candidate => candidate.url));
});

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');

function committedExposureHistory() {
  return JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'state', 'article-exposure-history.json'), 'utf8'));
}

function committedMainArticleRecords() {
  return committedExposureHistory().articles.filter(item =>
    item.exposure_type === 'newsletter_article' ||
    (item.exposure_types || []).includes('newsletter_article'));
}

// 발행된 주간 호의 section에서 "이 URL은 언제 main 기사로 나갔는가"를 만든다. backfill을 만들 때
// 실제로 쓴 검사이고, 이력이 스스로를 증명하지 못하게 하는 유일한 외부 근거다.
// 날짜형 디렉터리(articles/newsletters/2026-08-24)에는 issue.json이 없으므로 주간 호만 걸린다.
function publishedMainArticleDates() {
  const newslettersDir = path.join(REPO_ROOT, 'articles', 'newsletters');
  const dates = new Map();
  for (const name of fs.readdirSync(newslettersDir)) {
    const issuePath = path.join(newslettersDir, name, 'issue.json');
    if (!/^\d{4}-W\d{2}$/.test(name) || !fs.existsSync(issuePath)) continue;
    const issue = JSON.parse(fs.readFileSync(issuePath, 'utf8'));
    for (const section of issue.sections || []) {
      const url = String(section.source_candidate_url || (section.sources || [])[0]?.url || '').trim();
      assert.ok(url, `${name}: section without a source url cannot be bound to an identity key`);
      dates.set(`url:${normalizeArticleUrl(url)}`, String(issue.date));
    }
  }
  return dates;
}

// addDays(article-exposure-history.js)와 같은 규칙을 UTC로 독립 계산한다. 같은 함수를 불러
// 대조하면 상수와 규칙이 함께 틀려도 통과한다.
function plusDays(date, days) {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

test('the committed exposure history carries main-article records and no collapsed identity', () => {
  // 커밋된 state/article-exposure-history.json은 첫 실전 주(W36)에 이 게이트가 검사할 유일한
  // 근거다. content: 키는 identity 붕괴의 지문이다 — 후보는 url: 공간에 있으므로 content: 키는
  // 어떤 후보와도 매칭되지 않고, 그 키가 다시 나타나면 발행 기록이 다시 죽은 것이다.
  const collapsed = committedExposureHistory().articles
    .map(item => String(item.article_identity_key || ''))
    .filter(key => key.startsWith('content:'));
  assert.deepEqual(collapsed, []);

  const mainArticleRecords = committedMainArticleRecords();
  assert.ok(mainArticleRecords.length > 0, '검사할 발행 기록이 하나도 없으면 게이트는 관측이 없다');
  assert.ok(mainArticleRecords.every(item => item.cooldown_until && item.newsletter_article_date));
});

test('every committed main-article record is dated by the issue that published it', () => {
  // 자기모순 없는 틀린 날짜는 스위트를 그대로 통과한다. 손 편집·잘못된 머지·나중의 backfill이
  // 날짜를 일주일 밀면 쿨다운이 7일 일찍 끝나 게이트가 과소 차단하는데 CI는 초록이다 — #963이
  // 눈에 안 띈 것과 같은 무증상 실패다. 그래서 기대 날짜를 발행된 호에서 파생한다.
  const publishedDates = publishedMainArticleDates();
  const mainArticleRecords = committedMainArticleRecords();
  assert.ok(mainArticleRecords.length > 0);

  for (const record of mainArticleRecords) {
    const publishedDate = publishedDates.get(record.article_identity_key);
    assert.ok(publishedDate,
      `${record.article_identity_key}는 어떤 발행 호의 section도 아니다`);
    assert.equal(record.newsletter_article_date, publishedDate,
      `${record.article_identity_key}의 발행일이 issue.json과 다르다`);
    assert.equal(record.cooldown_until,
      plusDays(publishedDate, NEWSLETTER_ARTICLE_COOLDOWN_DAYS),
      `${record.article_identity_key}의 쿨다운 종료일이 발행일 + ${NEWSLETTER_ARTICLE_COOLDOWN_DAYS}일이 아니다`);
  }
});

test('no published main article inside the backfill window is missing from the history', () => {
  // 날짜 검사만으로는 "레코드가 통째로 빠진" 실패를 못 잡는다. 그건 게이트를 무증상으로 죽이는
  // 나머지 절반이다(#963 자체가 발행 기록이 남지 않아 생긴 일이다). 백필 창은 이력이 스스로
  // 말하게 둔다 — 가장 이른 발행 기록 날짜부터가 창이다.
  const mainArticleRecords = committedMainArticleRecords();
  const recordedKeys = new Set(mainArticleRecords.map(item => item.article_identity_key));
  const backfillStart = mainArticleRecords
    .map(item => item.newsletter_article_date)
    .sort()[0];

  const missing = [...publishedMainArticleDates()]
    .filter(([key, date]) => date >= backfillStart && !recordedKeys.has(key))
    .map(([key, date]) => `${date} ${key}`);
  assert.deepEqual(missing, []);
});
