const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_LOG_PAGES,
  parseReleaseRows,
  resolveAospReleaseCameraChangeItems
} = require('../../../collect/aosp-release-camera-changes');

const SOURCE = {
  id: 'aosp-release-camera-changes',
  name: 'AOSP Release Source Drop (camera changes)',
  sourceUrl: 'https://source.android.com/docs/setup/reference/build-numbers?hl=en'
};

// 릴리스 직후를 가정한 고정 시각. 최신 릴리스(2026-06-05)가 창 안에 있다.
const NOW = new Date('2026-06-20T00:00:00Z');

function releaseRow(build, tag, version, patchLevel) {
  return `<tr>\n  <td>${build}</td>\n  <td>${tag}</td>\n  <td>${version}</td>\n  <td></td>\n  <td>${patchLevel}</td>\n</tr>`;
}

function buildNumbersHtml(rows) {
  return `<table><thead><tr><th>Build ID</th><th>Tag</th><th>Version</th><th>Supported devices</th><th>Security patch level</th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`;
}

const DEFAULT_HTML = buildNumbersHtml([
  releaseRow('CP2A.260605.016', 'android-17.0.0_r1', 'Android17', '2026-06-05'),
  releaseRow('BP4A.251205.006', 'android-16.0.0_r4', 'Android16', '2025-12-05'),
  releaseRow('BP3A.250905.014', 'android-16.0.0_r3', 'Android16', '2025-09-05')
]);

function commit(subject, paths) {
  return {
    commit: 'a'.repeat(40),
    message: `${subject}\n\nChange-Id: I0123456789`,
    committer: { time: 'Fri Mar 27 17:27:40 2026 +0000' },
    tree_diff: paths.map(path => ({ type: 'modify', new_path: path, old_path: path }))
  };
}

function gitilesPayload(log, next) {
  return `)]}'\n${JSON.stringify(next ? { log, next } : { log })}`;
}

// 저장소별 응답을 URL로 갈라 주는 fetch 스텁. 기록된 URL로 호출 여부까지 관찰한다.
function gitilesStub(responsesByRepository) {
  const requested = [];
  const fetchTextImpl = async (url) => {
    requested.push(url);
    const entry = Object.entries(responsesByRepository).find(([repository]) => url.includes(repository));
    if (!entry) return gitilesPayload([]);
    const pages = entry[1];
    const pageIndex = requested.filter(item => item.includes(entry[0])).length - 1;
    return pages[Math.min(pageIndex, pages.length - 1)];
  };
  return { fetchTextImpl, requested };
}

test('parseReleaseRows keeps ISO-dated rows and orders them newest first', () => {
  const releases = parseReleaseRows(DEFAULT_HTML);
  assert.deepEqual(
    releases.map(release => release.tag),
    ['android-17.0.0_r1', 'android-16.0.0_r4', 'android-16.0.0_r3']
  );
  assert.equal(releases[0].releaseDate, '2026-06-05');
});

test('parseReleaseRows drops rows whose security patch level is not an ISO date', () => {
  // 현지화된 표기(5.09.2025 r.)는 날짜로 추정하지 않고 버린다.
  const html = buildNumbersHtml([
    releaseRow('CP2A.260605.016', 'android-17.0.0_r1', 'Android17', '2026-06-05'),
    releaseRow('BP3A.250905.014', 'android-16.0.0_r3', 'Android16', '5.09.2025 r.')
  ]);
  assert.deepEqual(parseReleaseRows(html).map(release => release.tag), ['android-17.0.0_r1']);
});

test('emits one candidate per repository that has camera commits in the release delta', async () => {
  const { fetchTextImpl, requested } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([
      commit('Camera: Freeze android.hardware.camera.metadata for Android17', ['camera/metadata/aidl/Android.bp']),
      commit('Add OWNERS for nfc', ['nfc/OWNERS'])
    ])],
    'platform/frameworks/av': [gitilesPayload([
      commit('virtual_camera: BLOB size detection using CameraBlob footer', ['services/camera/virtualcamera/Util.cc'])
    ])],
    'platform/hardware/google/camera': [gitilesPayload([
      commit('GCH: Plumb ProcessBatchRequest', ['common/hal/google_camera_hal/camera_device_session.cc'])
    ])]
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now: NOW });

  assert.equal(items.length, 3);
  // 직전 릴리스와의 범위로 조회해야 이번 드롭에 새로 들어온 변경만 센다.
  assert.ok(requested.every(url => url.includes('android-16.0.0_r4..android-17.0.0_r1')), 'queried the release delta');

  const halInterface = items[0];
  assert.equal(halInterface.publishedAt, '2026-06-05', 'uses the security patch level, not the commit time');
  assert.equal(halInterface.version_or_release, 'android-17.0.0_r1');
  assert.equal(halInterface.sourceKind, 'release_note_item');
  assert.equal(halInterface.relevanceBucketHint, 'direct_aosp_camera');
  assert.equal(
    halInterface.url,
    'https://android.googlesource.com/platform/hardware/interfaces/+log/android-16.0.0_r4..android-17.0.0_r1'
  );
  // camera 경로를 건드리지 않은 커밋은 세지 않는다.
  assert.match(halInterface.title, /1 camera change\(s\)/);
  assert.match(halInterface.summary, /Freeze android\.hardware\.camera\.metadata/);
  assert.ok(!halInterface.summary.includes('Add OWNERS for nfc'));
});

test('skips repositories whose release delta has no camera commits', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([commit('Introduce IBootControl 1.1.', ['boot/aidl/Android.bp'])])],
    'platform/frameworks/av': [gitilesPayload([commit('Camera: Clean up NV21/YV12 formats in docs', ['camera/ndk/NdkCameraMetadataTags.h'])])],
    'platform/hardware/google/camera': [gitilesPayload([])]
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now: NOW });

  assert.equal(items.length, 1);
  assert.match(items[0].title, /camera framework \/ cameraserver/);
});

test('reports the counted scope when paging stops at the page cap', async () => {
  const page = gitilesPayload(
    [commit('Camera: Enable surface id queries', ['services/camera/libcameraservice/api2/CameraDeviceClient.cpp'])],
    'next-page-token'
  );
  const { fetchTextImpl, requested } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([])],
    'platform/frameworks/av': [page],
    'platform/hardware/google/camera': [gitilesPayload([])]
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now: NOW });

  assert.equal(items.length, 1);
  // 끝까지 읽지 못했으면 집계를 전체 건수인 척하지 않고 읽은 범위를 밝힌다.
  assert.match(items[0].summary, /newest commits of the android-16\.0\.0_r4\.\.android-17\.0\.0_r1 range/);
  assert.equal(requested.filter(url => url.includes('platform/frameworks/av')).length, MAX_LOG_PAGES);
});

test('says the full range was counted when paging completes', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([])],
    'platform/frameworks/av': [gitilesPayload([commit('Camera: fix leak', ['camera/CameraMetadata.cpp'])])],
    'platform/hardware/google/camera': [gitilesPayload([])]
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now: NOW });

  assert.match(items[0].summary, /the full android-16\.0\.0_r4\.\.android-17\.0\.0_r1 range/);
});

test('does not touch git when the newest release is already outside the window', async () => {
  let fetchCount = 0;
  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl: async () => {
      fetchCount += 1;
      return gitilesPayload([]);
    },
    now: new Date('2026-08-06T00:00:00Z')
  });

  assert.deepEqual(items, []);
  assert.equal(fetchCount, 0, 'a stale release costs no git requests');
});

test('returns [] when the table has no previous release to diff against', async () => {
  let fetchCount = 0;
  const html = buildNumbersHtml([releaseRow('CP2A.260605.016', 'android-17.0.0_r1', 'Android17', '2026-06-05')]);
  const items = await resolveAospReleaseCameraChangeItems(html, SOURCE, {
    fetchTextImpl: async () => {
      fetchCount += 1;
      return gitilesPayload([]);
    },
    now: NOW
  });

  assert.deepEqual(items, []);
  assert.equal(fetchCount, 0);
});

test('survives a gitiles response that is not parseable', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': ['<html>503 Service Unavailable</html>'],
    'platform/frameworks/av': [gitilesPayload([commit('Camera: fix leak', ['camera/CameraMetadata.cpp'])])],
    'platform/hardware/google/camera': [gitilesPayload([])]
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now: NOW });

  assert.equal(items.length, 1, 'one bad repository does not drop the others');
});
