const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FOLLOWED_SOURCE_RESOLVERS,
  followedSourceResolverIds,
  resolveFollowedSourceItems,
  shouldSuppressGenericFallback
} = require('../../../collect/followed-source-item-resolvers');
const { readTextFixture } = require('../../helpers/fixture-loader');

// 보안 게시판 리졸버는 indexItems(첫 인자)에서 최신 게시판 URL을 골라 fetch하고,
// libcamera 리졸버는 text(첫 인자, 인덱스 HTML)에서 월 아카이브 디렉터리를 뽑아 fetch한다.
// 그래서 디스패치가 각 리졸버에 맞는 첫 인자를 넘겼는지 fetch된 URL로 관찰할 수 있다.
const SECURITY_JUNE_URL = 'https://source.android.com/docs/security/bulletin/2026/2026-06-01';
const LIBCAMERA_INDEX_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/';
const LIBCAMERA_MAY_LISTING_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/date.html';
const LIBCAMERA_MESSAGE_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000123.html';

function securityIndexItems() {
  return [
    { url: SECURITY_JUNE_URL, publishedAt: '2026-06-01', title: 'June 2026', sourceKind: 'release_note_item' }
  ];
}

test('registers exactly the known followed-source resolver ids', () => {
  assert.deepEqual(
    followedSourceResolverIds().sort(),
    [
      'android-security-bulletin',
      'aosp-release-camera-changes',
      'libcamera-release-announcements',
      'mediatek-security-bulletin',
      'patchwork-libcamera-patches',
      'raspberrypi-libcamera-releases'
    ]
  );
  assert.equal(FOLLOWED_SOURCE_RESOLVERS.length, 6);
});

test('routes raspberrypi-libcamera-releases to the release resolver with text (atom) as the first arg', async () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry><updated>2026-06-09T07:36:01Z</updated>',
    '<link rel="alternate" href="https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609"/>',
    '<title>v0.7.1+rpt20260609</title></entry>',
    '<entry><updated>2026-05-22T10:41:17Z</updated>',
    '<link rel="alternate" href="https://github.com/raspberrypi/libcamera/releases/tag/pios%2F0.7.1"/>',
    '<title>pios/0.7.1+rpt20260429-1</title></entry>',
    '</feed>'
  ].join('');
  let fetchCount = 0;
  const items = await resolveFollowedSourceItems(
    { id: 'raspberrypi-libcamera-releases', name: 'Raspberry Pi libcamera Releases', url: 'https://github.com/raspberrypi/libcamera/releases' },
    { indexItems: [], text: atom, fetchTextImpl: async () => { fetchCount += 1; return ''; } }
  );

  // 리졸버는 text(atom)만 파싱하고 추가 fetch는 하지 않는다.
  assert.equal(fetchCount, 0);
  assert.equal(items.length, 1, 'only the v* release survives, packaging tag dropped');
  assert.equal(items[0].version_or_release, 'v0.7.1+rpt20260609');
  assert.equal(items[0].relevanceBucketHint, 'camera_driver_image_pipeline');
});

test('routes patchwork-libcamera-patches to the patch resolver with text (JSON) as the first arg', async () => {
  const json = JSON.stringify([
    {
      web_url: 'https://patchwork.libcamera.org/patch/27198/',
      date: '2026-07-03T22:48:16',
      name: '[v2,1/2] libcamera: Add SensorSequence metadata control',
      state: 'new'
    }
  ]);
  let fetchCount = 0;
  const items = await resolveFollowedSourceItems(
    { id: 'patchwork-libcamera-patches', name: 'libcamera Patchwork (patch review)' },
    { indexItems: [], text: json, fetchTextImpl: async () => { fetchCount += 1; return ''; } }
  );

  // 리졸버는 text(JSON)만 파싱하고 추가 fetch는 하지 않는다.
  assert.equal(fetchCount, 0);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceKind, 'rss_item');
  assert.equal(items[0].publishedAt, '2026-07-03');
});

test('routes aosp-release-camera-changes to the release resolver with text (build-numbers HTML) as the first arg', async () => {
  // 리졸버는 릴리스가 수집 창 안일 때만 git을 조회한다. 디스패치를 관찰하려면 릴리스가 신선해야
  // 하므로 실행 시점의 오늘 날짜를 표에 넣는다(고정 날짜를 쓰면 시간이 지나 조회가 사라져
  // 라우팅이 깨져도 통과하는 테스트가 된다).
  const today = new Date().toISOString().slice(0, 10);
  const html = '<table><tbody>'
    + `<tr><td>CP2A.260605.016</td><td>android-17.0.0_r1</td><td>Android17</td><td></td><td>${today}</td></tr>`
    + '<tr><td>BP4A.251205.006</td><td>android-16.0.0_r4</td><td>Android16</td><td></td><td>2025-12-05</td></tr>'
    + '</tbody></table>';
  const fetched = [];
  const items = await resolveFollowedSourceItems(
    { id: 'aosp-release-camera-changes', name: 'AOSP Release Source Drop (camera changes)' },
    {
      indexItems: [],
      text: html,
      fetchTextImpl: async (url) => {
        fetched.push(url);
        return ')]}\'\n{"log":[]}';
      }
    }
  );

  // text(build-numbers HTML)가 첫 인자로 전달돼야 릴리스 태그를 뽑아 gitiles 범위를 조회한다.
  assert.ok(fetched.length > 0, 'dispatched to the release resolver with the build-numbers HTML');
  for (const url of fetched) {
    assert.match(url, /\+log\/android-16\.0\.0_r4\.\.android-17\.0\.0_r1\?format=JSON/);
  }
  assert.deepEqual(items, [], 'no camera commits in the stubbed delta');
});

test('shouldSuppressGenericFallback is true only for followed-resolver sources', () => {
  assert.equal(shouldSuppressGenericFallback({ id: 'libcamera-release-announcements' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'android-security-bulletin' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'raspberrypi-libcamera-releases' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'patchwork-libcamera-patches' }), true);
  assert.equal(shouldSuppressGenericFallback({ id: 'lore-linux-media-list' }), false);
  assert.equal(shouldSuppressGenericFallback({ id: 'libcamera-blog' }), false);
});

test('routes android-security-bulletin to the CVE resolver with indexItems as the first arg', async () => {
  const monthly = readTextFixture('source-html/android-security-bulletin-2026-06.html');
  const fetched = [];
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === SECURITY_JUNE_URL) return monthly;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveFollowedSourceItems(
    { id: 'android-security-bulletin', name: 'Android Security Bulletin' },
    { indexItems: securityIndexItems(), text: 'IGNORED INDEX HTML', fetchTextImpl }
  );

  // indexItems가 첫 인자로 전달돼야 게시판 URL을 골라 fetch한다(text는 보안 리졸버가 무시).
  assert.deepEqual(fetched, [SECURITY_JUNE_URL]);
  assert.ok(items.length > 0, 'CVE candidates emitted');
  for (const item of items) {
    assert.equal(item.sourceKind, 'release_note_item');
    assert.match(item.api_or_component, /Android Security Bulletin/);
  }
});

test('routes libcamera-release-announcements to the release resolver with text as the first arg', async () => {
  const index = readTextFixture('source-html/libcamera-pipermail-index.html');
  const may = readTextFixture('source-html/libcamera-pipermail-2026-may.html');
  const message = readTextFixture('source-html/libcamera-release-v0.8.0.html');
  const fetched = [];
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === LIBCAMERA_MAY_LISTING_URL) return may;
    if (url === LIBCAMERA_MESSAGE_URL) return message;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveFollowedSourceItems(
    { id: 'libcamera-release-announcements', name: 'libcamera Release Announcements', url: LIBCAMERA_INDEX_URL, sourceUrl: LIBCAMERA_INDEX_URL },
    // indexItems는 비워두고 text(인덱스 HTML)만 넘긴다 -> 월 아카이브를 따라가야 한다.
    { indexItems: [], text: index, fetchTextImpl }
  );

  // text가 첫 인자로 전달돼야 월 디렉터리를 뽑아 아카이브를 fetch한다.
  assert.ok(fetched.includes(LIBCAMERA_MAY_LISTING_URL), 'followed the month archive derived from text');
  assert.equal(items.length, 1);
  assert.equal(items[0].version_or_release, 'libcamera v0.8.0');
});

test('returns [] for an unknown source.id without fetching', async () => {
  let fetchCount = 0;
  const items = await resolveFollowedSourceItems(
    { id: 'some-other-source', name: 'Other' },
    {
      indexItems: securityIndexItems(),
      text: 'whatever',
      fetchTextImpl: async () => {
        fetchCount += 1;
        return '';
      }
    }
  );

  assert.deepEqual(items, []);
  assert.equal(fetchCount, 0, 'no resolver invoked for an unregistered id');
});

test('returns [] when called with no options (preserves the original default)', async () => {
  const items = await resolveFollowedSourceItems({ id: 'some-other-source' });
  assert.deepEqual(items, []);
});
