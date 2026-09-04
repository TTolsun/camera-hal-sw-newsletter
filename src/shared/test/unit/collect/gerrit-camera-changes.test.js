const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_DETAIL_FETCHES,
  MIN_LIST_PAGE_SIZE,
  cameraFileScope,
  effectiveDate,
  hasEligibleState,
  resolveGerritCameraChangeItems,
  reviewSignals,
  subjectIsNoise
} = require('../../../collect/gerrit-camera-changes');
const { normalizeCandidate } = require('../../../cli/collect-news-candidates');
const { DATED_ARTICLE_DIAGNOSTIC_KINDS } = require('../../../collect/dated-article-index-resolver');
const registry = require('../../../data/news-sources.json');

const SOURCE = {
  id: 'aosp-gerrit-camera-changes',
  name: 'AOSP Gerrit (camera changes under review)',
  sourceUrl: 'https://android-review.googlesource.com/changes/?q=x&n=100'
};

// normalizeCandidate는 registry entry 수준의 source 필드를 읽는다.
const REGISTRY_SOURCE = {
  ...SOURCE,
  url: SOURCE.sourceUrl,
  category: 'camera-hal',
  section: 'Android / AOSP / Camera',
  priority: 'high',
  reliability: 'official',
  candidateOnly: false,
  requiresCrossCheck: false,
  requiresCrossCheckDefault: false,
  sourceRole: 'project_mailing_list_source',
  sourceUrlQualityHint: 'project_mailing_list_release',
  mainArticlePolicy: 'conditional',
  evidenceGranularityHint: 'article_with_primary_confirmation',
  keywords: ['AOSP', 'Gerrit', 'Camera HAL']
};

const NOW = new Date('2026-09-02T00:00:00Z');
const LOOKBACK_DAYS = 35;

const GERRIT_PREFIX = ")]}'\n";

function listBody(changes) {
  return `${GERRIT_PREFIX}${JSON.stringify(changes)}`;
}

function detailBody(detail) {
  return `${GERRIT_PREFIX}${JSON.stringify(detail)}`;
}

function listChange(overrides = {}) {
  return {
    _number: 4228183,
    project: 'platform/frameworks/av',
    branch: 'android17-release',
    status: 'NEW',
    subject: 'VirtualCamera: validate blobSizeBytes against buffer size',
    created: '2026-08-13 15:04:14.000000000',
    updated: '2026-08-13 15:05:36.000000000',
    ...overrides
  };
}

function detailFor(change, { files = ['services/camera/virtualcamera/VirtualCameraImagePassthroughHandler.cc'], labels = {}, sha = 'f'.repeat(40) } = {}) {
  const revisionFiles = { '/COMMIT_MSG': { status: 'A' } };
  for (const file of files) revisionFiles[file] = { lines_inserted: 6 };
  return {
    ...change,
    change_id: change.change_id || 'I0f5906b56ddfb8d23d079cd192c42f925b5c02d3',
    insertions: 6,
    deletions: 1,
    labels,
    current_revision: sha,
    revisions: { [sha]: { commit: sha, files: revisionFiles } }
  };
}

// 목록 한 건 + 그 상세 한 건을 돌려주는 fetch stub. 요청 URL을 기록해 상세 조회 횟수를 잰다.
function stubFetch(detailsByNumber) {
  const requested = [];
  return {
    requested,
    fetchTextImpl: async url => {
      requested.push(url);
      const match = String(url).match(/\/changes\/(\d+)\/detail/);
      if (!match) throw new Error(`unexpected url ${url}`);
      const detail = detailsByNumber[match[1]];
      if (!detail) throw new Error(`no stub detail for ${match[1]}`);
      return detailBody(detail);
    }
  };
}

async function resolveOne(change, detailOptions = {}) {
  const detail = detailFor(change, detailOptions);
  const stub = stubFetch({ [String(change._number)]: detail });
  const items = await resolveGerritCameraChangeItems(listBody([change]), SOURCE, {
    fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
  });
  return { items, requested: stub.requested };
}

test('MERGED uses submitted and NEW uses created as the effective date; updated is never used', () => {
  assert.deepEqual(
    effectiveDate({ status: 'MERGED', created: '2026-07-13 18:33:17.000000000', submitted: '2026-07-15 15:22:15.000000000', updated: '2026-09-01 00:00:00.000000000' }),
    { field: 'submitted', timeMs: Date.parse('2026-07-15T15:22:15Z'), date: '2026-07-15' }
  );
  assert.deepEqual(
    effectiveDate({ status: 'NEW', created: '2026-08-13 15:04:14.000000000', updated: '2026-09-01 00:00:00.000000000' }),
    { field: 'created', timeMs: Date.parse('2026-08-13T15:04:14Z'), date: '2026-08-13' }
  );
  // submitted가 없는 MERGED는 updated로 대신하지 않고 날짜 없음으로 둔다.
  assert.equal(effectiveDate({ status: 'MERGED', created: '2026-07-13 18:33:17.000000000', updated: '2026-09-01 00:00:00.000000000' }), null);
  assert.equal(effectiveDate({ status: 'ABANDONED', updated: '2026-09-01 00:00:00.000000000' }), null);
});

test('a patchset bump does not pull an old change back into the window', async () => {
  // 2026-05-01에 올라온 변경이 오늘 댓글로 updated만 갱신된 상태. updated를 날짜로 쓰면 매주 다시
  // 기사가 되고, created를 쓰면 창 밖이라 후보가 아니다.
  const stale = listChange({ created: '2026-05-01 00:00:00.000000000', updated: '2026-09-01 23:00:00.000000000' });
  const stub = stubFetch({});
  const items = await resolveGerritCameraChangeItems(listBody([stale]), SOURCE, {
    fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
  });
  assert.deepEqual(items, []);
  assert.deepEqual(stub.requested, [], '창 밖이면 상세를 아예 조회하지 않는다');
});

test('WIP and ABANDONED changes are not collected; NEW and MERGED are', () => {
  assert.equal(hasEligibleState({ status: 'NEW' }), true);
  assert.equal(hasEligibleState({ status: 'MERGED' }), true);
  assert.equal(hasEligibleState({ status: 'NEW', work_in_progress: true }), false);
  assert.equal(hasEligibleState({ status: 'ABANDONED' }), false);
  assert.equal(hasEligibleState({ status: 'ABANDONED', work_in_progress: true }), false);
  assert.equal(hasEligibleState({ status: 'DRAFT' }), false);
});

test('WIP and ABANDONED changes never reach the detail fetch', async () => {
  const changes = [
    listChange({ _number: 1, status: 'NEW', work_in_progress: true, created: '2026-08-20 00:00:00.000000000', updated: '2026-08-20 00:00:00.000000000' }),
    listChange({ _number: 2, status: 'ABANDONED', created: '2026-08-20 00:00:00.000000000', updated: '2026-08-20 00:00:00.000000000' })
  ];
  const stub = stubFetch({});
  const items = await resolveGerritCameraChangeItems(listBody(changes), SOURCE, {
    fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
  });
  assert.deepEqual(items, []);
  assert.deepEqual(stub.requested, []);
});

test('test and DO NOT SUBMIT subjects are dropped', () => {
  assert.equal(subjectIsNoise('Test commit'), true);
  assert.equal(subjectIsNoise('fake subject'), true);
  assert.equal(subjectIsNoise('camera: DO NOT SUBMIT experiment'), true);
  assert.equal(subjectIsNoise('Camera: fix deadlock when session create failed'), false);
  // "test"로 시작할 때만 걸린다 — 카메라 VTS/CTS 변경까지 지우지 않는다.
  assert.equal(subjectIsNoise('Update vts test to support automotive devices'), false);
});

test('OWNERS/TEST_MAPPING/build-only changes are not camera changes', () => {
  assert.equal(cameraFileScope('platform/frameworks/av', ['OWNERS']).isCameraChange, false);
  assert.equal(cameraFileScope('platform/frameworks/av', ['services/camera/OWNERS', 'services/camera/TEST_MAPPING']).isCameraChange, false);
  assert.equal(cameraFileScope('platform/hardware/google/camera', ['Android.bp', 'common/hal/Android.bp']).isCameraChange, false);
});

test('a tree-wide refactor that only grazes camera paths is not a camera change', () => {
  // 실측 사례: chromium-review 8269206은 23개 파일 중 camera/ 아래가 4개였다.
  const files = [
    ...Array.from({ length: 4 }, (_, index) => `camera/common/file${index}.cc`),
    ...Array.from({ length: 19 }, (_, index) => `diagnostics/file${index}.cc`)
  ];
  assert.equal(cameraFileScope('chromiumos/platform2', files).isCameraChange, false);
  // 절반이면 통과한다.
  assert.equal(cameraFileScope('chromiumos/platform2', ['camera/a.cc', 'shared/b.h']).isCameraChange, true);
});

test('a camera repository counts as camera scope even when no path segment says camera', () => {
  const scope = cameraFileScope('platform/hardware/google/camera', ['common/hal/google_camera_hal/camera_device_session.cc']);
  assert.equal(scope.isCameraChange, true);
  assert.equal(scope.camera.length, 1);
});

test('review signals read the label shortcuts and ignore the licensing bot', () => {
  assert.deepEqual(reviewSignals({ 'Open-Source-Licensing': { recommended: { _account_id: 1 } }, 'Code-Review': {} }).positive, false);
  assert.equal(reviewSignals({ 'Code-Review': { approved: { _account_id: 1 } } }).positive, true);
  assert.equal(reviewSignals({ 'Code-Review': { recommended: { _account_id: 1 } } }).positive, true);
  // 자동 검증 label은 긍정 근거가 아니다 - 통과했다는 뜻이지 사람이 코드를 봤다는 뜻이 아니다(#1061).
  assert.equal(reviewSignals({ 'Verified': { approved: { _account_id: 1 } } }).positive, false);
  assert.equal(reviewSignals({ 'Presubmit-Verified': { approved: { _account_id: 1 } } }).positive, false);
  // 부정 표가 있으면 다른 label이 긍정이어도 긍정 근거로 보지 않는다.
  assert.equal(reviewSignals({ 'Code-Review': { rejected: { _account_id: 1 } }, 'Verified': { approved: { _account_id: 2 } } }).positive, false);
  assert.equal(reviewSignals({ 'Code-Review': {} }).phrase, 'No Code-Review or verification vote has been cast yet.');
});

test('a failed verification blocks promotion even when a reviewer recommended the change', () => {
  // 리뷰어 +1만 보고 승격하면 presubmit이 깨진 제안이 main 기사가 된다.
  const signals = reviewSignals({
    'Code-Review': { recommended: { _account_id: 1 } },
    'Presubmit-Verified': { rejected: { _account_id: 2 } }
  });
  assert.equal(signals.positive, false);
  assert.equal(signals.negative, true);
  assert.match(signals.phrase, /Presubmit-Verified carries a negative vote/);
});

test('an automated verification pass without a human review stays watchlist_only', async () => {
  // presubmit 자동화가 붙이는 자리인 Verified 표 하나로 main 자격을 얻으면, 사람이 아무도 보지 않은
  // 제안이 main 기사가 된다(#1061). 이 코드는 표를 던진 주체를 확인하지 않으므로, 사람 리뷰라고
  // 말할 수 있는 것은 사람 리뷰 label인 Code-Review뿐이다.
  const signals = reviewSignals({ 'Verified': { approved: { _account_id: 1 } } });
  assert.equal(signals.positive, false);
  assert.equal(signals.negative, false);
  // 문구는 "리뷰가 붙었다"가 아니라 자동 검증만 통과했다고 말한다.
  assert.match(signals.phrase, /Automated verification only: Verified passed/);
  assert.doesNotMatch(signals.phrase, /^Reviewed:/);
  // 문구에는 점수를 쓰지 않는다 - approved는 "그 label의 최대값"이라 프로젝트 설정에 달려 있다.
  assert.doesNotMatch(signals.phrase, /[+-]\d/);

  // 판정이 문구에서 그치지 않고 후보 강등까지 간다.
  const { items } = await resolveOne(
    listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }),
    { labels: { 'Verified': { approved: { _account_id: 1 } } } }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].mainArticlePolicy, 'watchlist_only');

  const candidate = normalizeCandidate({ ...items[0], source: REGISTRY_SOURCE });
  assert.equal(candidate.main_article_source_allowed, false);
  assert.equal(candidate.source_quality_status, 'blocked');
});

test('an unreviewed NEW change is collected but blocked from main articles', async () => {
  const { items } = await resolveOne(listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }));
  assert.equal(items.length, 1);
  assert.equal(items[0].mainArticlePolicy, 'watchlist_only');

  const candidate = normalizeCandidate({ ...items[0], source: REGISTRY_SOURCE });
  assert.equal(candidate.main_article_source_allowed, false);
  assert.equal(candidate.source_quality_status, 'blocked');
  // blocker가 비어야 mailing-list 강한-근거 승급(upgradeable blocker가 하나라도 있어야 발동)이 걸리지 않는다.
  assert.deepEqual(candidate.main_article_source_blockers, []);
  assert.match(candidate.main_article_source_allowed_reason, /watchlist/i);
});

test('a merged change is main-article eligible and carries its Change-Id and commit SHA', async () => {
  const merged = listChange({
    _number: 8083988,
    project: 'chromiumos/platform2',
    branch: 'main',
    status: 'MERGED',
    subject: 'camera: Reference-count buffer IDs to prevent UAF',
    created: '2026-08-13 18:33:17.000000000',
    submitted: '2026-08-15 15:22:15.000000000',
    updated: '2026-08-15 15:22:15.000000000',
    change_id: 'I368f45098e25d465af809e880d0a4b943c690a3a'
  });
  const { items } = await resolveOne(merged, {
    files: ['camera/hal_adapter/camera_device_adapter.cc', 'camera/hal_adapter/camera_device_adapter.h'],
    labels: { 'Code-Review': { approved: { _account_id: 1 } }, 'Verified': { approved: { _account_id: 2 } } },
    sha: 'a'.repeat(40)
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].mainArticlePolicy, undefined, '병합된 변경은 후보 수준 강등을 붙이지 않는다');
  assert.equal(items[0].publishedAt, '2026-08-15');
  assert.equal(items[0].gerrit_change_id, 'I368f45098e25d465af809e880d0a4b943c690a3a');
  assert.equal(items[0].gerrit_commit_sha, 'a'.repeat(40));
  assert.equal(items[0].url, 'https://android-review.googlesource.com/c/chromiumos/platform2/+/8083988');

  const candidate = normalizeCandidate({ ...items[0], source: { ...REGISTRY_SOURCE, category: 'linux-camera', section: 'Linux Camera / Driver' } });
  assert.equal(candidate.main_article_source_allowed, true);
  assert.equal(candidate.gerrit_change_id, 'I368f45098e25d465af809e880d0a4b943c690a3a');
  assert.equal(candidate.gerrit_commit_sha, 'a'.repeat(40));
});

test('the summary states the facts the client-rendered change page cannot supply', async () => {
  const { items } = await resolveOne(listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }));
  const summary = items[0].summary;
  assert.match(summary, /Gerrit change 4228183 on platform\/frameworks\/av \(branch android17-release\)/);
  assert.match(summary, /proposed and not merged \(status NEW, created 2026-08-13\)/);
  // 파일 경로는 저장소 경로를 붙여 트리 전체 경로로 적는다.
  assert.match(summary, /platform\/frameworks\/av\/services\/camera\/virtualcamera\//);
  assert.match(summary, /No Code-Review or verification vote has been cast yet/);
  assert.match(summary, /Change-Id I0f5906b56ddfb8d23d079cd192c42f925b5c02d3/);
});

test('an AOSP camera change lands in the direct AOSP bucket and a ChromeOS one in the driver bucket', async () => {
  const { items: aospItems } = await resolveOne(listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }));
  const aosp = normalizeCandidate({ ...aospItems[0], source: REGISTRY_SOURCE });
  assert.equal(aosp.relevance_bucket, 'direct_aosp_camera');

  const { items: crosItems } = await resolveOne(listChange({
    _number: 8137322,
    project: 'chromiumos/platform2',
    branch: 'main',
    status: 'MERGED',
    subject: 'cros-camera-libs: Make libchrome dependency optional',
    submitted: '2026-08-20 00:00:00.000000000',
    updated: '2026-08-20 00:00:00.000000000'
  }), {
    files: ['camera/include/cros-camera/cros_camera_hal.h'],
    labels: { 'Code-Review': { approved: { _account_id: 1 } } }
  });
  const cros = normalizeCandidate({ ...crosItems[0], source: { ...REGISTRY_SOURCE, category: 'linux-camera', section: 'Linux Camera / Driver' } });
  assert.equal(cros.relevance_bucket, 'camera_driver_image_pipeline');
});

test('detail fetches are bounded and the truncation is reported', async () => {
  const changes = [];
  const details = {};
  for (let index = 0; index < MAX_DETAIL_FETCHES + 3; index += 1) {
    const change = listChange({
      _number: 5000 + index,
      created: '2026-08-20 00:00:00.000000000',
      updated: '2026-08-20 00:00:00.000000000'
    });
    changes.push(change);
    details[String(change._number)] = detailFor(change);
  }
  const stub = stubFetch(details);
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveGerritCameraChangeItems(listBody(changes), SOURCE, {
      fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(stub.requested.length, MAX_DETAIL_FETCHES);
  assert.ok(warnings.some(message => message.includes('the remainder is not collected this run')));
});

test('a list page that does not reach the window boundary is reported, not silently accepted', async () => {
  // 모든 항목의 updated가 창 안이면 이 페이지 뒤에 더 있을 수 있다는 뜻이다.
  const changes = [listChange({ created: '2026-08-30 00:00:00.000000000', updated: '2026-08-31 00:00:00.000000000' })];
  const stub = stubFetch({ '4228183': detailFor(changes[0]) });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveGerritCameraChangeItems(listBody(changes), SOURCE, {
      fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.ok(warnings.some(message => message.includes('does not reach back to the')));
});

test('a detail fetch failure skips only that change', async () => {
  const good = listChange({ _number: 1, created: '2026-08-20 00:00:00.000000000', updated: '2026-08-20 00:00:00.000000000' });
  const bad = listChange({ _number: 2, created: '2026-08-21 00:00:00.000000000', updated: '2026-08-21 00:00:00.000000000' });
  const details = { '1': detailFor(good) };
  const stub = stubFetch(details);
  const originalWarn = console.warn;
  console.warn = () => {};
  let items;
  try {
    items = await resolveGerritCameraChangeItems(listBody([bad, good]), SOURCE, {
      fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(items.length, 1);
  assert.equal(items[0].gerrit_change_number, 1);
});

test('a non-Gerrit body yields no candidates instead of throwing', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(await resolveGerritCameraChangeItems('<html>nope</html>', SOURCE, { fetchTextImpl: async () => '' }), []);
  } finally {
    console.warn = originalWarn;
  }
});

// 목록 한 페이지가 수집 창을 덮는다는 전제는 등록부 URL의 n에 달려 있다. 등록부만 낮추면 코드는
// 그대로인 채 창의 일부만 보게 되므로 둘을 한 쌍으로 잠근다(patchwork의 per_page x MAX_PATCH_PAGES와 같은 이유).
test('both Gerrit registry entries ask for at least the measured list page size', () => {
  const gerritSources = registry.sources.filter(source => source.id.endsWith('-gerrit-camera-changes'));
  assert.equal(gerritSources.length, 2);
  for (const source of gerritSources) {
    const pageSize = Number(new URL(source.sourceUrl).searchParams.get('n'));
    assert.ok(pageSize >= MIN_LIST_PAGE_SIZE, `${source.id} must request at least ${MIN_LIST_PAGE_SIZE} changes per page`);
    assert.equal(source.mainArticlePolicy, 'conditional');
    // requiresCrossCheck가 true가 되면 watchlist_only 후보에 upgradeable blocker가 생겨
    // mailing-list 강한-근거 승급이 리뷰 없는 제안을 main으로 올릴 수 있다.
    assert.equal(source.requiresCrossCheck, false);
    assert.equal(source.requiresCrossCheckDefault, false);
  }
});

test('the Change-Id and revision survive normalizeCandidate 500-character summary cap', () => {
  // 요약이 잘리는 것 자체는 막을 수 없다(저장소 경로 + 파일 이름은 길다). 잘려도 정체성 문장이
  // 남도록 문장 순서를 계약으로 잠근다. 순서를 되돌리면 이 단언이 깨진다.
  const cameraFiles = [
    'services/camera/virtualcamera/VirtualCameraImagePassthroughHandler.cc',
    'services/camera/virtualcamera/VirtualCameraImageTransformingHandler.cc',
    'services/camera/libcameraservice/common/CameraProviderManager.cpp',
    'services/camera/libcameraservice/device3/Camera3OutputUtils.cpp'
  ];
  const detail = detailFor(listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }), { files: cameraFiles });
  const scope = cameraFileScope(detail.project, [...cameraFiles, '/COMMIT_MSG']);
  assert.equal(scope.camera.length, 4);

  return resolveOne(listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }), { files: cameraFiles })
    .then(({ items }) => {
      const candidate = normalizeCandidate({ ...items[0], source: REGISTRY_SOURCE });
      assert.ok(candidate.summary.length <= 500);
      assert.match(candidate.summary, /Change-Id I0f5906b56ddfb8d23d079cd192c42f925b5c02d3/);
      assert.match(candidate.summary, /current revision [0-9a-f]{12}\./);
      assert.match(candidate.summary, /No Code-Review or verification vote has been cast yet/);
    });
});

test('the component label is a directory, not a joined list of full file paths', async () => {
  const { items } = await resolveOne(listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' }));
  assert.equal(
    items[0].api_or_component,
    'platform/frameworks/av/services/camera/virtualcamera'
  );
});

test('a change that merges between the list and detail reads is skipped, not dated from created', async () => {
  // 목록은 스냅숏이라 상세를 읽을 때는 이미 병합돼 있을 수 있다. 목록의 created를 그대로 쓰면
  // 요약이 그 날짜를 "submitted"라고 말하고 main 승격까지 열린다.
  const listed = listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' });
  const merged = detailFor({ ...listed, status: 'MERGED' });
  delete merged.submitted;
  const stub = stubFetch({ '4228183': merged });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  let items;
  try {
    items = await resolveGerritCameraChangeItems(listBody([listed]), SOURCE, {
      fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(items, []);
  assert.ok(warnings.some(message => message.includes('moved from NEW to MERGED between the list and detail reads')));
});

test('a change merged before the detail read is dated from submitted, not created', async () => {
  const listed = listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' });
  const merged = detailFor({ ...listed, status: 'MERGED', submitted: '2026-08-25 09:00:00.000000000' }, {
    labels: { 'Code-Review': { approved: { _account_id: 1 } } }
  });
  const stub = stubFetch({ '4228183': merged });
  const items = await resolveGerritCameraChangeItems(listBody([listed]), SOURCE, {
    fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, '2026-08-25');
  assert.equal(items[0].gerrit_effective_date_field, 'submitted');
  assert.equal(items[0].gerrit_change_status, 'MERGED');
  assert.equal(items[0].mainArticlePolicy, undefined);
});

test('a change that goes WIP between the list and detail reads is dropped', async () => {
  const listed = listChange({ created: '2026-08-13 15:04:14.000000000', updated: '2026-08-13 15:05:36.000000000' });
  const stub = stubFetch({ '4228183': detailFor({ ...listed, work_in_progress: true }) });
  const originalWarn = console.warn;
  console.warn = () => {};
  let items;
  try {
    items = await resolveGerritCameraChangeItems(listBody([listed]), SOURCE, {
      fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(items, []);
});

test('a MERGED change with no submitted timestamp is reported, not silently dropped', async () => {
  const merged = listChange({ status: 'MERGED', updated: '2026-08-25 00:00:00.000000000' });
  delete merged.created;
  const stub = stubFetch({});
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveGerritCameraChangeItems(listBody([merged]), SOURCE, {
      fetchTextImpl: stub.fetchTextImpl, now: NOW, lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(stub.requested, []);
  assert.ok(warnings.some(message => message.includes('carries no usable submitted timestamp')));
});

// #1059: console.warn은 Actions 로그에만 남고 그 로그는 커밋되지 않는다. 두 절단(목록 페이지가
// 창을 못 덮음 / 상세 조회 상한)이 커밋된 산출물까지 가야 "창을 다 못 읽었다"와 "이번 주 신호
// 없음"이 갈린다.
async function collectTruncationEvents(text, options) {
  const events = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await resolveGerritCameraChangeItems(text, SOURCE, { ...options, onDiagnostic: event => events.push(event) });
  } finally {
    console.warn = originalWarn;
  }
  return events;
}

test('the list page and detail-fetch truncations reach the committed diagnostics (#1059)', async () => {
  const shortOfWindow = [listChange({ created: '2026-08-30 00:00:00.000000000', updated: '2026-08-31 00:00:00.000000000' })];
  const listEvents = await collectTruncationEvents(listBody(shortOfWindow), {
    fetchTextImpl: stubFetch({ '4228183': detailFor(shortOfWindow[0]) }).fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });
  assert.equal(listEvents.length, 1, 'a list page short of the window is announced once');
  assert.equal(listEvents[0].kind, 'collection_window_truncated');
  assert.ok(
    DATED_ARTICLE_DIAGNOSTIC_KINDS.includes(listEvents[0].kind),
    'an unregistered kind is folded into "unknown", so the count would say nothing'
  );
  // 이 소스도 fetchClient를 안 써서 리포트의 소스별 표에 행이 없다.
  assert.equal(listEvents[0].source_id, 'aosp-gerrit-camera-changes');
  assert.equal(listEvents[0].lookback_days, LOOKBACK_DAYS);
  assert.match(listEvents[0].detail, /does not reach back to the/);

  const changes = [];
  const details = {};
  for (let index = 0; index < MAX_DETAIL_FETCHES + 3; index += 1) {
    const change = listChange({
      _number: 5000 + index,
      created: '2026-08-20 00:00:00.000000000',
      updated: '2026-08-20 00:00:00.000000000'
    });
    changes.push(change);
    details[String(change._number)] = detailFor(change);
  }
  // 창 밖 항목을 하나 붙여 목록 페이지가 창을 덮었음을 분명히 한다. 그러지 않으면 같은 fixture가
  // 두 절단을 동시에 참으로 만들어, 이 단언이 어느 쪽을 본 것인지 갈리지 않는다.
  changes.push(listChange({ _number: 4999, created: '2026-01-02 00:00:00.000000000', updated: '2026-01-03 00:00:00.000000000' }));
  const capEvents = await collectTruncationEvents(listBody(changes), {
    fetchTextImpl: stubFetch(details).fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });
  assert.equal(capEvents.length, 1, 'the detail-fetch cap is announced once');
  assert.match(capEvents[0].detail, /the remainder is not collected this run/);
});

test('a list page that reaches past the window emits no truncation event (#1059)', async () => {
  // 거짓 양성이 나면 매주 절단이 났다고 말하게 되어, 진짜 절단을 이 이벤트로 못 찾는다.
  const change = listChange({ created: '2026-08-20 00:00:00.000000000', updated: '2026-08-20 00:00:00.000000000' });
  const stale = listChange({ _number: 9, created: '2026-01-02 00:00:00.000000000', updated: '2026-01-03 00:00:00.000000000' });
  const events = await collectTruncationEvents(listBody([change, stale]), {
    fetchTextImpl: stubFetch({ '4228183': detailFor(change) }).fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });
  assert.deepEqual(events, [], 'a page whose oldest entry predates the window covered it');
});
