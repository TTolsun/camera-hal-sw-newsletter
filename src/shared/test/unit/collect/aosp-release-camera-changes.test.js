const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_LOG_PAGES,
  parseReleaseRows,
  resolveAospReleaseCameraChangeItems,
  selectReleasePair
} = require('../../../collect/aosp-release-camera-changes');
const { normalizeCandidate } = require('../../../cli/collect-news-candidates');

const SOURCE = {
  id: 'aosp-release-camera-changes',
  name: 'AOSP Release Source Drop (camera changes)',
  sourceUrl: 'https://source.android.com/docs/setup/reference/build-numbers?hl=en'
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
  keywords: ['AOSP', 'Camera HAL', 'AIDL', 'cameraserver']
};

// android-17.0.0_r1의 보안 패치 레벨(2026-06-05) 직후를 가정한 고정 시각.
const NOW = new Date('2026-06-20T00:00:00Z');
const LOOKBACK_DAYS = 35;

function releaseRow(build, tag, version, devices, patchLevel) {
  return `<tr>\n  <td>${build}</td>\n  <td>${tag}</td>\n  <td>${version}</td>\n  <td>${devices}</td>\n  <td>${patchLevel}</td>\n</tr>`;
}

function buildNumbersHtml(rows) {
  return `<table><thead><tr><th>Build ID</th><th>Tag</th><th>Version</th><th>Supported devices</th><th>Security patch level</th></tr></thead><tbody>${rows.join('\n')}</tbody></table>`;
}

const R17 = releaseRow('CP2A.260605.016', 'android-17.0.0_r1', 'Android17', '', '2026-06-05');
const R16_4 = releaseRow('BP4A.251205.006', 'android-16.0.0_r4', 'Android16', '', '2025-12-05');
const R16_3 = releaseRow('BP3A.250905.014', 'android-16.0.0_r3', 'Android16', '', '2025-09-05');

const DEFAULT_HTML = buildNumbersHtml([R17, R16_4, R16_3]);

function commit(subject, tree_diff) {
  return {
    commit: 'a'.repeat(40),
    message: `${subject}\n\nChange-Id: I0123456789`,
    committer: { time: 'Fri Mar 27 17:27:40 2026 +0000' },
    tree_diff
  };
}

function modified(path) {
  return [{ type: 'modify', new_path: path, old_path: path }];
}

function gitilesPayload(log, next) {
  return `)]}'\n${JSON.stringify(next ? { log, next } : { log })}`;
}

/**
 * 저장소별로 페이지 응답을 순서대로 돌려주는 fetch 스텁.
 * 배열의 마지막 응답은 그 뒤 호출에서도 반복 사용한다(페이지 상한 테스트용).
 * 응답 자리에 Error를 두면 그 호출에서 reject한다(네트워크 실패 재현).
 */
function gitilesStub(pagesByRepository) {
  const requested = [];
  const consumed = new Map();
  const fetchTextImpl = async (url) => {
    requested.push(url);
    const repository = Object.keys(pagesByRepository).find(key => url.includes(key));
    if (!repository) return gitilesPayload([]);
    const pages = pagesByRepository[repository];
    const index = consumed.get(repository) || 0;
    consumed.set(repository, index + 1);
    const page = pages[Math.min(index, pages.length - 1)];
    if (page instanceof Error) throw page;
    return page;
  };
  return { fetchTextImpl, requested };
}

const EMPTY = [gitilesPayload([])];

test('parseReleaseRows keeps only rows that carry both a release tag and an ISO date', () => {
  // 현지화된 표기(5.09.2025 r.)와 빈 셀은 날짜로 추정하지 않고 버린다.
  const html = buildNumbersHtml([
    R17,
    releaseRow('BP3A.250905.014', 'android-16.0.0_r3', 'Android16', '', '5.09.2025 r.'),
    releaseRow('LMY48W', 'android-5.1.1_r24', 'Lollipop', 'Nexus 6', '')
  ]);
  assert.deepEqual(parseReleaseRows(html).map(release => release.tag), ['android-17.0.0_r1']);
});

test('parseReleaseRows reads rows whose unused cells carry links or markup', () => {
  // 쓰지도 않는 열의 마크업을 고정하면 그 행의 릴리스가 통째로 사라진다.
  const html = buildNumbersHtml([
    releaseRow('CP2A.260605.016', 'android-17.0.0_r1', '<a href="/docs">Android17</a>', 'Pixel 9<br>Pixel 10', '2026-06-05'),
    R16_4
  ]);
  assert.deepEqual(parseReleaseRows(html).map(release => release.tag), ['android-17.0.0_r1', 'android-16.0.0_r4']);
});

test('parseReleaseRows keeps the first row when one tag has several build rows', () => {
  const html = buildNumbersHtml([
    R17,
    releaseRow('CP2A.260605.017', 'android-17.0.0_r1', 'Android17', '', '2026-07-05'),
    R16_4
  ]);
  const releases = parseReleaseRows(html);
  assert.equal(releases.length, 2, 'the duplicate tag row is dropped');
  assert.equal(releases[0].releaseDate, '2026-06-05');
  assert.equal(selectReleasePair(releases).previousTag, 'android-16.0.0_r4');
});

test('selectReleasePair picks the newest release by date, not by version order', () => {
  // 상위 major가 나온 뒤 도착하는 하위 major 보안 드롭이 영영 안 보이면 안 된다.
  const html = buildNumbersHtml([
    releaseRow('BP4A.260905.001', 'android-16.0.0_r5', 'Android16', '', '2026-09-05'),
    R17,
    R16_4
  ]);
  const pair = selectReleasePair(parseReleaseRows(html));
  assert.equal(pair.tag, 'android-16.0.0_r5');
  // 직전은 같은 라인의 android-16.0.0_r4다. 날짜순 직전(android-17.0.0_r1)을 쓰면 브랜치가 섞인다.
  assert.equal(pair.previousTag, 'android-16.0.0_r4');
  assert.equal(pair.releaseDate, '2026-09-05');
});

test('selectReleasePair orders _r numbers numerically, not lexically', () => {
  const html = buildNumbersHtml([
    releaseRow('BP4A.251205.009', 'android-16.0.0_r9', 'Android16', '', '2025-11-05'),
    releaseRow('BP4A.251205.010', 'android-16.0.0_r10', 'Android16', '', '2025-12-05'),
    R16_4
  ]);
  const pair = selectReleasePair(parseReleaseRows(html));
  assert.equal(pair.tag, 'android-16.0.0_r10');
  assert.equal(pair.previousTag, 'android-16.0.0_r9', '_r9 < _r10 numerically');
});

test('selectReleasePair is unaffected by the row order on the page', () => {
  const shuffled = buildNumbersHtml([R16_3, R17, R16_4]);
  const pair = selectReleasePair(parseReleaseRows(shuffled));
  assert.equal(pair.tag, 'android-17.0.0_r1');
  assert.equal(pair.previousTag, 'android-16.0.0_r4');
});

test('emits one candidate per repository that has camera commits in the release delta', async () => {
  const { fetchTextImpl, requested } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([
      commit('Camera: Freeze android.hardware.camera.metadata for Android17', modified('camera/metadata/aidl/Android.bp')),
      commit('Add OWNERS for nfc', modified('nfc/OWNERS'))
    ])],
    'platform/frameworks/av': [gitilesPayload([
      commit('virtual_camera: BLOB size detection using CameraBlob footer', modified('services/camera/virtualcamera/Util.cc'))
    ])],
    'platform/hardware/google/camera': [gitilesPayload([
      commit('GCH: Plumb ProcessBatchRequest', modified('common/hal/google_camera_hal/camera_device_session.cc'))
    ])]
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.equal(items.length, 3);
  assert.ok(requested.every(url => url.includes('android-16.0.0_r4..android-17.0.0_r1')), 'queried the release delta');

  const halInterface = items[0];
  assert.equal(halInterface.publishedAt, '2026-06-05', 'uses the security patch level, not the commit time');
  assert.equal(halInterface.version_or_release, 'android-17.0.0_r1');
  assert.equal(
    halInterface.url,
    'https://android.googlesource.com/platform/hardware/interfaces/+log/android-16.0.0_r4..android-17.0.0_r1'
  );
  // 제목에는 바인딩된 URL에서 그대로 확인되는 값만 남는다: 릴리스 태그와 저장소 경로(#857).
  assert.equal(
    halInterface.title,
    'AOSP android-17.0.0_r1 source release — camera path changes in platform/hardware/interfaces'
  );
  // camera 경로를 건드리지 않은 커밋은 세지 않는다. 코드 파생 건수는 제목이 아니라 메타데이터에 둔다.
  assert.doesNotMatch(halInterface.title, /camera change\(s\)/);
  assert.equal(halInterface.camera_path_commit_count, 1);
  assert.equal(halInterface.camera_path_commit_count_is_lower_bound, false);
  assert.match(halInterface.summary, /Freeze android\.hardware\.camera\.metadata/);
  assert.ok(!halInterface.summary.includes('Add OWNERS for nfc'));
});

test('candidates carry the four release_note_item evidence fields the collect gate requires', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([
      commit('Camera: Unfreeze camera metadata API', modified('camera/metadata/aidl/Android.bp'))
    ])],
    'platform/frameworks/av': EMPTY,
    'platform/hardware/google/camera': EMPTY
  });

  const [item] = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  // releaseNoteItemMissingEvidence는 date/version/component/behavior 네 근거를 모두 요구한다.
  assert.equal(item.sourceKind, 'release_note_item');
  assert.equal(item.collectionMode, 'release-note-item');
  assert.equal(item.publishedAt, '2026-06-05');
  assert.equal(item.version_or_release, 'android-17.0.0_r1');
  assert.match(item.api_or_component, /platform\/hardware\/interfaces/);
  assert.ok(item.behavior_change && item.behavior_change.length > 0);
  assert.equal(item.parentUrl, SOURCE.sourceUrl);
  assert.equal(item.parentTitle, SOURCE.name);
  assert.equal(item.relevanceBucketHint, 'direct_aosp_camera');
  // 날짜 주장은 커밋 로그가 아니라 build-numbers 표에서 오므로 후보 본문이 그 출처를 들고 있어야 한다.
  assert.match(item.summary, /build-numbers table \(https:\/\/source\.android\.com/);
});

test('counts camera files that a commit renames away or deletes', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([
      // 삭제 엔트리는 new_path가 실제 경로가 아니다. old_path를 보지 않으면 통째로 놓친다.
      commit('Camera: drop obsolete metadata fixture', [{ type: 'delete', old_path: 'camera/metadata/legacy.json', new_path: '/dev/null' }])
    ])],
    'platform/frameworks/av': EMPTY,
    'platform/hardware/google/camera': EMPTY
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].camera_path_commit_count, 1);
});

test('skips repositories whose release delta has no camera commits', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([commit('Introduce IBootControl 1.1.', modified('boot/aidl/Android.bp'))])],
    'platform/frameworks/av': [gitilesPayload([commit('Camera: Clean up NV21/YV12 formats in docs', modified('camera/ndk/NdkCameraMetadataTags.h'))])],
    'platform/hardware/google/camera': EMPTY
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.equal(items.length, 1);
  assert.match(items[0].title, /platform\/frameworks\/av/);
});

test('states the count as a lower bound when paging stops at the page cap', async () => {
  const page = gitilesPayload(
    [commit('Camera: Enable surface id queries', modified('services/camera/libcameraservice/api2/CameraDeviceClient.cpp'))],
    'next-page-token'
  );
  const { fetchTextImpl, requested } = gitilesStub({
    'platform/hardware/interfaces': EMPTY,
    'platform/frameworks/av': [page],
    'platform/hardware/google/camera': EMPTY
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.equal(items.length, 1);
  // 끝까지 읽지 못했으면 요약이 하한으로 말하고, 메타데이터가 하한임을 표시한다.
  // 제목은 건수를 아예 말하지 않으므로 하한 여부와 무관하게 같은 문장이다(#857).
  assert.equal(
    items[0].title,
    'AOSP android-17.0.0_r1 source release — camera path changes in platform/frameworks/av'
  );
  assert.equal(items[0].camera_path_commit_count_is_lower_bound, true);
  assert.match(items[0].summary, /at least \d+, counted within the \d+ newest commits/);
  assert.equal(requested.filter(url => url.includes('platform/frameworks/av')).length, MAX_LOG_PAGES);
});

test('states the full range when a next token is followed by an empty page', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': EMPTY,
    'platform/frameworks/av': [
      gitilesPayload([commit('Camera: fix leak', modified('camera/CameraMetadata.cpp'))], 'next-page-token'),
      gitilesPayload([])
    ],
    'platform/hardware/google/camera': EMPTY
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  // 델타를 다 읽었으므로 하한이 아니라 확정 건수로 말해야 한다.
  assert.equal(items[0].camera_path_commit_count, 1);
  assert.equal(items[0].camera_path_commit_count_is_lower_bound, false);
  assert.match(items[0].summary, /counted across the full android-16\.0\.0_r4\.\.android-17\.0\.0_r1 range/);
});

test('one repository failing its fetch does not drop the others', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [new Error('503 Service Unavailable')],
    'platform/frameworks/av': [gitilesPayload([commit('Camera: fix leak', modified('camera/CameraMetadata.cpp'))])],
    'platform/hardware/google/camera': EMPTY
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.equal(items.length, 1);
  assert.match(items[0].title, /platform\/frameworks\/av/);
});

test('survives a gitiles response that is not parseable', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': ['<html>503 Service Unavailable</html>'],
    'platform/frameworks/av': [gitilesPayload([commit('Camera: fix leak', modified('camera/CameraMetadata.cpp'))])],
    'platform/hardware/google/camera': EMPTY
  });

  const items = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.equal(items.length, 1);
});

test('collection window comes from the caller, so a catch-up lookback still reaches the drop', async () => {
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': EMPTY,
    'platform/frameworks/av': [gitilesPayload([commit('Camera: fix leak', modified('camera/CameraMetadata.cpp'))])],
    'platform/hardware/google/camera': EMPTY
  });
  // 릴리스 2026-06-05 기준 50일 뒤. 기본 35일 창에는 없지만 catch-up run(60일)에는 있다.
  const now = new Date('2026-07-25T00:00:00Z');

  const missed = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now, lookbackDays: 35 });
  assert.deepEqual(missed, [], 'outside the default window');

  const caught = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, { fetchTextImpl, now, lookbackDays: 60 });
  assert.equal(caught.length, 1, 'a wider caller window reaches the same drop');
});

test('the window edge is inclusive and future-dated rows cost no requests', async () => {
  const probe = () => {
    let fetchCount = 0;
    return {
      fetchTextImpl: async () => {
        fetchCount += 1;
        return gitilesPayload([]);
      },
      calls: () => fetchCount
    };
  };

  // 릴리스 2026-06-05 + 35일 = 2026-07-10 (경계 포함)
  const onEdge = probe();
  await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl: onEdge.fetchTextImpl,
    now: new Date('2026-07-10T00:00:00Z'),
    lookbackDays: LOOKBACK_DAYS
  });
  assert.ok(onEdge.calls() > 0, 'day 35 is still inside the window');

  const pastEdge = probe();
  await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl: pastEdge.fetchTextImpl,
    now: new Date('2026-07-11T00:00:00Z'),
    lookbackDays: LOOKBACK_DAYS
  });
  assert.equal(pastEdge.calls(), 0, 'day 36 costs no git requests');

  const future = probe();
  await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl: future.fetchTextImpl,
    now: new Date('2026-06-01T00:00:00Z'),
    lookbackDays: LOOKBACK_DAYS
  });
  assert.equal(future.calls(), 0, 'a release dated ahead of the window end is not collected yet');
});

test('gitiles requests carry an explicit timeout so one slow page cannot stall collection', async () => {
  const timeouts = [];
  await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
    fetchTextImpl: async (_url, timeoutMs) => {
      timeouts.push(timeoutMs);
      return gitilesPayload([]);
    },
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.ok(timeouts.length > 0, 'the delta was queried');
  // 수집 루프의 공용 fetch는 기본 타임아웃이 없다. 인자를 빼면 지연 응답 하나가 실행 전체를 멈춘다.
  assert.ok(timeouts.every(timeoutMs => Number.isFinite(timeoutMs) && timeoutMs > 0), 'every request passes a timeout');
});

test('a failed repository leaves a warning so a broken source is not read as a quiet week', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    const { fetchTextImpl } = gitilesStub({
      'platform/hardware/interfaces': [new Error('503 Service Unavailable')],
      'platform/frameworks/av': ['<html>not gitiles json</html>'],
      'platform/hardware/google/camera': EMPTY
    });
    await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, SOURCE, {
      fetchTextImpl,
      now: NOW,
      lookbackDays: LOOKBACK_DAYS
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('platform/hardware/interfaces') && line.includes('fetch failed')));
  assert.ok(warnings.some(line => line.includes('platform/frameworks/av') && line.includes('parseable gitiles JSON')));
});

test('returns [] when the table has no previous release to diff against', async () => {
  let fetchCount = 0;
  const html = buildNumbersHtml([R17]);
  const items = await resolveAospReleaseCameraChangeItems(html, SOURCE, {
    fetchTextImpl: async () => {
      fetchCount += 1;
      return gitilesPayload([]);
    },
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });

  assert.deepEqual(items, []);
  assert.equal(fetchCount, 0);
});

test('the derived camera commit count survives candidate normalization as metadata', async () => {
  // normalizeCandidate는 whitelist다. 여기에 없는 필드는 candidates.json에서 사라지므로,
  // "제목에서 건수를 빼고 메타데이터로 옮겼다"는 말이 산출물에서도 참이어야 한다(#857).
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload(
      [commit('Camera: Enable surface id queries', modified('camera/metadata/aidl/Android.bp'))],
      'next-page-token'
    )],
    'platform/frameworks/av': EMPTY,
    'platform/hardware/google/camera': EMPTY
  });

  const [item] = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, REGISTRY_SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });
  const normalized = normalizeCandidate(item);

  assert.equal(normalized.title, item.title);
  assert.doesNotMatch(normalized.title, /camera change\(s\)/);
  assert.equal(normalized.camera_path_commit_count, MAX_LOG_PAGES);
  assert.equal(normalized.camera_path_commit_count_is_lower_bound, true);
});

test('the drop candidate carries the Change-Id and commit SHA of every camera commit it counted', async () => {
  // #1033: Gerrit 후보와 이 집계 후보는 제목도 URL도 겹치지 않는다. 같은 변경인지 아는 유일한 길이
  // 이 목록이라, whitelist에서 빠지면 선정 단계가 같은 변경을 두 기사로 낸다.
  const withChangeId = {
    commit: 'e'.repeat(40),
    message: 'Camera: return error for capture request if camera unplugged\n\nChange-Id: I41b74d543e8b8a7ad46a261d49ee311543e1ed8d\n',
    committer: { time: 'Fri Mar 27 17:27:40 2026 +0000' },
    tree_diff: modified('camera/device/aidl/ICameraDevice.aidl')
  };
  const withoutChangeId = {
    commit: 'f'.repeat(40),
    message: 'Camera: drop stale buffer\n',
    committer: { time: 'Fri Mar 27 17:27:40 2026 +0000' },
    tree_diff: modified('camera/device/aidl/ICameraDeviceSession.aidl')
  };
  const { fetchTextImpl } = gitilesStub({
    'platform/hardware/interfaces': [gitilesPayload([withChangeId, withoutChangeId])],
    'platform/frameworks/av': EMPTY,
    'platform/hardware/google/camera': EMPTY
  });

  const [item] = await resolveAospReleaseCameraChangeItems(DEFAULT_HTML, REGISTRY_SOURCE, {
    fetchTextImpl,
    now: NOW,
    lookbackDays: LOOKBACK_DAYS
  });
  const normalized = normalizeCandidate(item);

  assert.deepEqual(normalized.covered_gerrit_change_ids, ['I41b74d543e8b8a7ad46a261d49ee311543e1ed8d']);
  assert.deepEqual(normalized.covered_commit_shas, ['e'.repeat(40), 'f'.repeat(40)]);
});
