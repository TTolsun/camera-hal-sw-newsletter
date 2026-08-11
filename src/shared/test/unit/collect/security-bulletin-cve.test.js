const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveSecurityBulletinCveItems
} = require('../../../collect/security-bulletin-cve');
const { readTextFixture } = require('../../helpers/fixture-loader');

function source(overrides = {}) {
  return {
    id: 'android-security-bulletin',
    name: 'Android Security Bulletin',
    url: 'https://source.android.com/docs/security/bulletin',
    sourceUrl: 'https://source.android.com/docs/security/bulletin',
    ...overrides
  };
}

const JUNE_URL = 'https://source.android.com/docs/security/bulletin/2026/2026-06-01';
const MAY_URL = 'https://source.android.com/docs/security/bulletin/2026/2026-05-01';

function indexItems() {
  return [
    { url: MAY_URL, publishedAt: '2026-05-01', title: 'May 2026', sourceKind: 'release_note_item' },
    { url: JUNE_URL, publishedAt: '2026-06-01', title: 'June 2026', sourceKind: 'release_note_item' }
  ];
}

function monthlyFetch() {
  const monthly = readTextFixture('source-html/android-security-bulletin-2026-06.html');
  return async (url) => {
    if (url === JUNE_URL) return monthly;
    throw new Error(`unexpected fetch: ${url}`);
  };
}

function assertParsedItemContract(item) {
  assert.ok(item.title, 'title');
  assert.ok(item.url, 'url');
  assert.ok(item.publishedAt, 'publishedAt');
  assert.equal(item.sourceKind, 'release_note_item');
  assert.ok(item.version_or_release, 'version_or_release');
  assert.ok(item.api_or_component, 'api_or_component');
  assert.ok(item.behavior_change, 'behavior_change');
}

test('emits one candidate per camera/media-relevant CVE with concrete evidence', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const ids = items.map(item => item.cve_id).sort();
  assert.deepEqual(ids, [
    'CVE-2026-0002', 'CVE-2026-0004', 'CVE-2026-0006', 'CVE-2026-0007',
    'CVE-2026-0008', 'CVE-2026-0009', 'CVE-2026-0010'
  ]);

  for (const item of items) {
    assertParsedItemContract(item);
    assert.equal(item.publishedAt, '2026-06-01');
    assert.match(item.title, /CVE-2026-00(0[2467]|08|09|10)/);
    assert.match(item.url, /^https:\/\/source\.android\.com\/docs\/security\/bulletin\//);
    assert.match(item.api_or_component, /Android Security Bulletin/);
    assert.match(item.behavior_change, /vulnerability|security|fix|CVE/i);
  }
});

test('emits camera RAW/DNG and image-codec System CVEs as camera-output candidates', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const dng = items.find(item => item.cve_id === 'CVE-2026-0008');
  assert.ok(dng, 'dng_sdk RAW/DNG CVE must be emitted');
  assert.match(dng.api_or_component, /dng_sdk/);
  assert.equal(dng.severity, 'Critical');
  assert.equal(dng.relevanceBucketHint, 'android_multimedia_camera_output');

  const png = items.find(item => item.cve_id === 'CVE-2026-0009');
  assert.ok(png, 'libpng image-decoding CVE must be emitted');
  assert.match(png.api_or_component, /libpng/);
  assert.equal(png.relevanceBucketHint, 'android_multimedia_camera_output');

  const jpeg = items.find(item => item.cve_id === 'CVE-2026-0010');
  assert.ok(jpeg, 'libjpeg image-decoding CVE must be emitted');
  assert.equal(jpeg.relevanceBucketHint, 'android_multimedia_camera_output');
});

test('classifies component and severity from the bulletin section', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const media = items.find(item => item.cve_id === 'CVE-2026-0002');
  assert.match(media.api_or_component, /Media framework/i);
  assert.match(media.behavior_change, /Critical/i);
  assert.equal(media.relevanceBucketHint, 'android_multimedia_camera_output');

  const vendor = items.find(item => item.cve_id === 'CVE-2026-0004');
  assert.match(vendor.api_or_component, /Camera/i);
  assert.equal(vendor.relevanceBucketHint, 'camera_driver_image_pipeline');

  const kernel = items.find(item => item.cve_id === 'CVE-2026-0006');
  assert.match(kernel.api_or_component, /Camera driver|V4L2/i);
  assert.equal(kernel.relevanceBucketHint, 'camera_driver_image_pipeline');
});

test('includes vendor camera CVEs named only by a codename and decodes HTML entities', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const camss = items.find(item => item.cve_id === 'CVE-2026-0007');
  assert.ok(camss, 'a Qualcomm CVE identified only by the CAMSS codename must be included');
  assert.match(camss.api_or_component, /CAMSS pipeline/);
  assert.doesNotMatch(camss.api_or_component, /&#x20;|&amp;|&nbsp;/);
  assert.equal(camss.relevanceBucketHint, 'camera_driver_image_pipeline');
});

test('canonicalizes the emitted bulletin URL', async () => {
  const monthly = readTextFixture('source-html/android-security-bulletin-2026-06.html');
  const items = await resolveSecurityBulletinCveItems(
    [{ url: `${JUNE_URL}?hl=ko`, publishedAt: '2026-06-01', title: 'June 2026' }],
    source(),
    { fetchTextImpl: async () => monthly }
  );

  assert.ok(items.length > 0);
  for (const item of items) {
    assert.doesNotMatch(item.url, /hl=/);
    assert.match(item.url, /#cve-2026-/);
  }
});

test('excludes Low-severity CVEs below the Moderate floor', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.equal(items.some(item => item.cve_id === 'CVE-2026-0003'), false);
});

test('excludes CVEs without camera or media relevance', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.equal(items.some(item => item.cve_id === 'CVE-2026-0001'), false);
  assert.equal(items.some(item => item.cve_id === 'CVE-2026-0005'), false);
});

test('fetches only the latest bulletin within the index', async () => {
  const fetched = [];
  const monthly = readTextFixture('source-html/android-security-bulletin-2026-06.html');
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === JUNE_URL) return monthly;
    throw new Error(`should not fetch older bulletin: ${url}`);
  };

  await resolveSecurityBulletinCveItems(indexItems(), source(), { fetchTextImpl });

  assert.equal(fetched.length, 1);
  assert.equal(fetched[0], JUNE_URL);
});

test('respects the per-bulletin item cap', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: monthlyFetch(),
    maxItems: 2
  });

  assert.equal(items.length, 2);
});

test('returns empty when the monthly fetch fails', async () => {
  const items = await resolveSecurityBulletinCveItems(indexItems(), source(), {
    fetchTextImpl: async () => {
      throw new Error('network down');
    }
  });

  assert.deepEqual(items, []);
});

test('returns empty when there are no index items', async () => {
  const items = await resolveSecurityBulletinCveItems([], source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.deepEqual(items, []);
});

// 라이브 실측(2026-08-11): 게시판 인덱스는 Overview 내비 링크를 월별 링크보다 먼저 내놓고,
// 그 Overview 항목이 최신 월과 같은 날짜(2026-08-01)를 물려받는다. 날짜만 보고 고르면
// 동률에서 Overview가 이겨 CVE 표가 없는 asb-overview 페이지를 받아 카메라 CVE가 0건이 된다.
test('follows the monthly bulletin, not an Overview nav link that shares the newest date', async () => {
  const OVERVIEW_URL = 'https://source.android.com/docs/security/bulletin/asb-overview';
  const fetched = [];
  const monthly = readTextFixture('source-html/android-security-bulletin-2026-06.html');
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === JUNE_URL) return monthly;
    throw new Error(`should not fetch a non-monthly page: ${url}`);
  };

  const items = await resolveSecurityBulletinCveItems([
    { url: OVERVIEW_URL, publishedAt: '2026-06-01', title: 'Overview', sourceKind: 'release_note_item' },
    { url: JUNE_URL, publishedAt: '2026-06-01', title: 'June 2026', sourceKind: 'release_note_item' },
    { url: MAY_URL, publishedAt: '2026-05-01', title: 'May 2026', sourceKind: 'release_note_item' }
  ], source(), { fetchTextImpl });

  assert.deepEqual(fetched, [JUNE_URL]);
  assert.ok(items.length > 0, '월별 게시판을 따라갔으면 카메라/미디어 CVE 후보가 나와야 한다');
});

// 버전별 게시판(/bulletin/android-17)도 날짜 경로가 없는 내비 링크다. 월별 링크가 하나도
// 없으면 아무 페이지나 받는 대신 조용히 비운다(없는 증거를 만들지 않는다).
// 이 소스는 generic fallback이 막혀 있어 빈 결과가 곧 "이번 달 카메라 CVE 없음"으로 읽히므로,
// 구조 변경으로 매치가 0건이 된 경우를 사후에 구분할 수 있게 경고를 남겨야 한다.
test('returns empty and warns when the index has no monthly bulletin link', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  let items;
  try {
    items = await resolveSecurityBulletinCveItems([
      { url: 'https://source.android.com/docs/security/bulletin/asb-overview', publishedAt: '2026-06-01', title: 'Overview' },
      { url: 'https://source.android.com/docs/security/bulletin/android-17', publishedAt: '2026-02-01', title: 'Android 17' }
    ], source(), {
      fetchTextImpl: async (url) => {
        throw new Error(`should not fetch a non-monthly page: ${url}`);
      }
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(items, []);
  assert.ok(
    warnings.some(line => line.includes('none matched the monthly bulletin URL shape')),
    '월별 링크 무매치는 경고로 남아야 한다'
  );
});

test('warns even when the index itself is empty', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await resolveSecurityBulletinCveItems([], source(), { fetchTextImpl: monthlyFetch() });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(line => line.includes('none matched the monthly bulletin URL shape')));
});
