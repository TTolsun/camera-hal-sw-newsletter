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
  assert.deepEqual(ids, ['CVE-2026-0002', 'CVE-2026-0004', 'CVE-2026-0006', 'CVE-2026-0007']);

  for (const item of items) {
    assertParsedItemContract(item);
    assert.equal(item.publishedAt, '2026-06-01');
    assert.match(item.title, /CVE-2026-000[2467]/);
    assert.match(item.url, /^https:\/\/source\.android\.com\/docs\/security\/bulletin\//);
    assert.match(item.api_or_component, /Android Security Bulletin/);
    assert.match(item.behavior_change, /vulnerability|security|fix|CVE/i);
  }
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
