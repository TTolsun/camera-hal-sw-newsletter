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
  assert.equal(reviewSignals({ 'Verified': { approved: { _account_id: 1 } } }).positive, true);
  // 부정 표가 있으면 다른 label이 긍정이어도 긍정 근거로 보지 않는다.
  assert.equal(reviewSignals({ 'Code-Review': { rejected: { _account_id: 1 } }, 'Verified': { approved: { _account_id: 2 } } }).positive, false);
  assert.equal(reviewSignals({ 'Code-Review': {} }).phrase, 'No Code-Review or verification vote has been cast yet.');
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
