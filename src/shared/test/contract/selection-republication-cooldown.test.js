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
  'Camera provider AIDL revision'
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
