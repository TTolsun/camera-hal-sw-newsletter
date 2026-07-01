const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveRaspberryPiLibcameraReleaseItems
} = require('../../../collect/raspberrypi-libcamera-releases');

const RELEASES_URL = 'https://github.com/raspberrypi/libcamera/releases';

function source(overrides = {}) {
  return {
    id: 'raspberrypi-libcamera-releases',
    name: 'Raspberry Pi libcamera Releases',
    url: RELEASES_URL,
    sourceUrl: RELEASES_URL,
    rssUrl: 'https://github.com/raspberrypi/libcamera/releases.atom',
    ...overrides
  };
}

// Representative GitHub releases.atom: real release + packaging/branch tags to drop.
function atom() {
  const entry = (tag, updated) => [
    '<entry>',
    `<id>tag:github.com,2008:Repository/1/${tag}</id>`,
    `<updated>${updated}</updated>`,
    `<link rel="alternate" type="text/html" href="https://github.com/raspberrypi/libcamera/releases/tag/${encodeURIComponent(tag)}"/>`,
    `<title>${tag}</title>`,
    '<content type="html">release notes</content>',
    '</entry>'
  ].join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    entry('v0.7.1+rpt20260609', '2026-06-09T07:36:01Z'),
    entry('pios/0.7.1+rpt20260429-1', '2026-05-22T10:41:17Z'),
    entry('upstream/0.7.1+rpt20260429', '2026-05-01T18:50:10Z'),
    entry('v0.7.1+rpt20260429', '2026-05-01T06:38:26Z'),
    entry('libcamera v0.7.1', '2026-04-28T19:14:11Z'),
    '</feed>'
  ].join('');
}

test('parses release entries into canonical dated candidates', () => {
  const items = resolveRaspberryPiLibcameraReleaseItems(atom(), source());

  const first = items.find(item => /v0\.7\.1\+rpt20260609/.test(item.version_or_release));
  assert.ok(first, 'the latest downstream release is present');
  assert.equal(first.sourceKind, 'release_note_item');
  assert.equal(first.version_or_release, 'v0.7.1+rpt20260609');
  assert.equal(first.publishedAt, '2026-06-09');
  assert.match(first.title, /Raspberry Pi libcamera Releases - v0\.7\.1\+rpt20260609/);
  assert.match(first.url, /releases\/tag\/v0\.7\.1(%2B|\+)rpt20260609/);
  assert.match(first.api_or_component, /libcamera/i);
  assert.equal(first.relevanceBucketHint, 'camera_driver_image_pipeline');
});

test('drops pios/ and upstream/ packaging tags, keeps upstream and downstream releases', () => {
  const titles = resolveRaspberryPiLibcameraReleaseItems(atom(), source())
    .map(item => item.version_or_release);

  assert.ok(titles.includes('v0.7.1+rpt20260609'));
  assert.ok(titles.includes('v0.7.1+rpt20260429'));
  assert.ok(titles.includes('libcamera v0.7.1'));
  assert.equal(titles.some(tag => /^pios\//.test(tag)), false);
  assert.equal(titles.some(tag => /^upstream\//.test(tag)), false);
});

test('returns empty for empty or feed-with-no-entries input', () => {
  assert.deepEqual(resolveRaspberryPiLibcameraReleaseItems('', source()), []);
  assert.deepEqual(
    resolveRaspberryPiLibcameraReleaseItems('<feed xmlns="http://www.w3.org/2005/Atom"></feed>', source()),
    []
  );
});

test('skips entries missing a link or date', () => {
  const broken = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '<entry><title>v9.9.9+rpt20260101</title></entry>',
    '</feed>'
  ].join('');
  assert.deepEqual(resolveRaspberryPiLibcameraReleaseItems(broken, source()), []);
});
