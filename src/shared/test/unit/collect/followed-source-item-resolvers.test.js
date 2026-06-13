const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FOLLOWED_SOURCE_RESOLVERS,
  followedSourceResolverIds,
  resolveFollowedSourceItems
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

test('registers exactly the two known followed-source resolver ids', () => {
  assert.deepEqual(
    followedSourceResolverIds().sort(),
    ['android-security-bulletin', 'libcamera-release-announcements']
  );
  assert.equal(FOLLOWED_SOURCE_RESOLVERS.length, 2);
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
