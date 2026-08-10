const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveMediatekSecurityBulletinItems
} = require('../../../collect/mediatek-security-bulletin');
const { readTextFixture } = require('../../helpers/fixture-loader');

const AUGUST_URL = 'https://www.mediatek.com/product-security-bulletin/august-2026?hsLang=en';

function source(overrides = {}) {
  return {
    id: 'mediatek-security-bulletin',
    name: 'MediaTek Security Bulletin',
    url: 'https://www.mediatek.com/product-security-bulletin',
    sourceUrl: 'https://www.mediatek.com/product-security-bulletin',
    ...overrides
  };
}

function indexHtml() {
  return readTextFixture('source-html/mediatek-security-bulletin-index.html');
}

function monthlyFetch(fetched = []) {
  const monthly = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html');
  return async (url) => {
    fetched.push(url);
    if (url === AUGUST_URL) return monthly;
    throw new Error(`unexpected fetch: ${url}`);
  };
}

test('follows the newest monthly bulletin from the index', async () => {
  const fetched = [];
  await resolveMediatekSecurityBulletinItems(indexHtml(), source(), { fetchTextImpl: monthlyFetch(fetched) });

  assert.deepEqual(fetched, [AUGUST_URL], '인덱스 링크 순서가 아니라 연/월이 가장 최신인 게시판을 따라간다');
});

test('emits one candidate per camera CVE with concrete dated evidence', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.deepEqual(items.map(item => item.cve_id), ['CVE-2026-20486']);

  const [item] = items;
  assert.equal(item.publishedAt, '2026-08-03', '게시판 본문의 Published 날짜를 쓴다');
  assert.equal(item.sourceKind, 'release_note_item');
  assert.equal(item.version_or_release, 'CVE-2026-20486');
  assert.equal(item.api_or_component, 'MediaTek Security Bulletin / imgsensor');
  assert.equal(item.relevanceBucketHint, 'camera_driver_image_pipeline');
  assert.equal(item.url, `${AUGUST_URL}#CVE_2026_20486`);
  assert.match(item.title, /August 2026 MediaTek Security Bulletin: CVE-2026-20486 — imgsensor/);
  assert.match(item.behavior_change, /incorrect error handling/);
  assert.match(item.behavior_change, /CWE-754/);
  assert.match(item.behavior_change, /MT8910/, '영향 칩셋 목록이 증거에 남는다');
});

test('excludes non-camera subcomponents even at higher severity', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  const components = items.map(item => item.api_or_component).join(' ');
  assert.doesNotMatch(components, /TFA|hevc decoder|display/);
});

test('excludes camera CVEs below the Moderate severity floor', async () => {
  // imgsys 행은 카메라지만 Low라 하한에 걸린다.
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.doesNotMatch(items.map(item => item.cve_id).join(' '), /CVE-2026-20489/);
});

test('returns empty when the bulletin has no Published date', async () => {
  // 날짜를 추정해 채우면 선정 창이 실제와 어긋난다. 없으면 후보를 만들지 않는다.
  const undated = readTextFixture('source-html/mediatek-security-bulletin-2026-08.html')
    .replace('Published 2026-08-03', 'Coming soon');

  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: async () => undated
  });

  assert.deepEqual(items, []);
});

test('returns empty when the monthly fetch fails', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: async () => {
      throw new Error('network down');
    }
  });

  assert.deepEqual(items, []);
});

test('returns empty when the index has no monthly bulletin link', async () => {
  const items = await resolveMediatekSecurityBulletinItems(
    '<html><body><a href="https://www.mediatek.com/product-security-bulletin">Security Bulletin</a></body></html>',
    source(),
    {
      fetchTextImpl: async (url) => {
        throw new Error(`should not fetch: ${url}`);
      }
    }
  );

  assert.deepEqual(items, []);
});

test('respects the per-bulletin item cap', async () => {
  const items = await resolveMediatekSecurityBulletinItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch(),
    maxItems: 0
  });

  assert.deepEqual(items, []);
});
