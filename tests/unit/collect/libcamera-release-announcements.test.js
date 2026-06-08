const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveLibcameraReleaseAnnouncementItems
} = require('../../../scripts/newsroom/collect/libcamera-release-announcements');
const { readTextFixture } = require('../../helpers/fixture-loader');

const INDEX_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/';
const MAY_LISTING_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/date.html';
const MESSAGE_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000123.html';

function source(overrides = {}) {
  return {
    id: 'libcamera-release-announcements',
    name: 'libcamera Release Announcements',
    url: INDEX_URL,
    sourceUrl: INDEX_URL,
    ...overrides
  };
}

function indexHtml() {
  return readTextFixture('source-html/libcamera-pipermail-index.html');
}

function monthlyFetch() {
  const may = readTextFixture('source-html/libcamera-pipermail-2026-may.html');
  const message = readTextFixture('source-html/libcamera-release-v0.8.0.html');
  return async (url) => {
    if (url === MAY_LISTING_URL) return may;
    if (url === MESSAGE_URL) return message;
    throw new Error(`unexpected fetch: ${url}`);
  };
}

test('emits a dated libcamera release candidate by following index -> month -> message', async () => {
  const items = await resolveLibcameraReleaseAnnouncementItems(indexHtml(), source(), {
    fetchTextImpl: monthlyFetch()
  });

  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.sourceKind, 'release_note_item');
  assert.equal(item.version_or_release, 'libcamera v0.8.0');
  assert.match(item.publishedAt, /^2026-05-22$/);
  assert.match(item.url, /2026-May\/000123\.html$/);
  assert.match(item.api_or_component, /libcamera/i);
  assert.match(item.behavior_change, /SoftISP|pipeline|sensor/i);
});

test('follows only the latest month archive', async () => {
  const fetched = [];
  const may = readTextFixture('source-html/libcamera-pipermail-2026-may.html');
  const message = readTextFixture('source-html/libcamera-release-v0.8.0.html');
  const fetchTextImpl = async (url) => {
    fetched.push(url);
    if (url === MAY_LISTING_URL) return may;
    if (url === MESSAGE_URL) return message;
    throw new Error(`should not fetch older month: ${url}`);
  };

  await resolveLibcameraReleaseAnnouncementItems(indexHtml(), source(), { fetchTextImpl });

  assert.ok(fetched.includes(MAY_LISTING_URL));
  assert.equal(fetched.some(url => /2026-April|2026-March/.test(url)), false);
});

test('returns empty when the archive fetch fails', async () => {
  const items = await resolveLibcameraReleaseAnnouncementItems(indexHtml(), source(), {
    fetchTextImpl: async () => {
      throw new Error('network down');
    }
  });

  assert.deepEqual(items, []);
});

test('returns empty when the latest month has no release announcement', async () => {
  const noRelease = '<html><body><ul><li><a href="000999.html">[libcamera-devel] [PATCH] pipeline fix</a></li></ul></body></html>';
  const items = await resolveLibcameraReleaseAnnouncementItems(indexHtml(), source(), {
    fetchTextImpl: async (url) => {
      if (url === MAY_LISTING_URL) return noRelease;
      throw new Error(`unexpected fetch: ${url}`);
    }
  });

  assert.deepEqual(items, []);
});

test('falls back to an earlier month when the latest has no release', async () => {
  const APRIL_LISTING_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/date.html';
  const APRIL_MESSAGE_URL = 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/000123.html';
  const mayNoRelease = '<html><body><ul><li><a href="000500.html">[libcamera-devel] [PATCH] pipeline fix</a></li></ul></body></html>';
  const aprilWithRelease = readTextFixture('source-html/libcamera-pipermail-2026-may.html');
  const message = readTextFixture('source-html/libcamera-release-v0.8.0.html');
  const fetchTextImpl = async (url) => {
    if (url === MAY_LISTING_URL) return mayNoRelease;
    if (url === APRIL_LISTING_URL) return aprilWithRelease;
    if (url === APRIL_MESSAGE_URL) return message;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveLibcameraReleaseAnnouncementItems(indexHtml(), source(), { fetchTextImpl });

  assert.equal(items.length, 1);
  assert.equal(items[0].version_or_release, 'libcamera v0.8.0');
  assert.match(items[0].url, /2026-April\/000123\.html$/);
});

test('skips reply messages and picks the original release announcement', async () => {
  const listingWithReply = [
    '<html><body><ul>',
    '<li><a href="000200.html">[libcamera-devel] Re: libcamera v0.8.0 released</a></li>',
    '<li><a href="000123.html">[libcamera-devel] libcamera v0.8.0 released</a></li>',
    '</ul></body></html>'
  ].join('');
  const message = readTextFixture('source-html/libcamera-release-v0.8.0.html');
  const fetchTextImpl = async (url) => {
    if (url === MAY_LISTING_URL) return listingWithReply;
    if (url === MESSAGE_URL) return message;
    throw new Error(`unexpected fetch: ${url}`);
  };

  const items = await resolveLibcameraReleaseAnnouncementItems(indexHtml(), source(), { fetchTextImpl });

  assert.equal(items.length, 1);
  assert.match(items[0].url, /2026-May\/000123\.html$/);
});

test('returns empty when the index has no month archives', async () => {
  const items = await resolveLibcameraReleaseAnnouncementItems(
    '<html><body><p>No monthly archives yet.</p></body></html>',
    source(),
    { fetchTextImpl: monthlyFetch() }
  );

  assert.deepEqual(items, []);
});
