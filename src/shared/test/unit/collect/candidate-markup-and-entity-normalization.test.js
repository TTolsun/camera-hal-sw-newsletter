'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeCandidate,
  parseRss
} = require('../../../cli/collect-news-candidates');
const {
  resolveRaspberryPiLibcameraReleaseItems
} = require('../../../collect/raspberrypi-libcamera-releases');

// #975: 수집 경계는 마크업 제거와 HTML entity 해제를 서로 다른 단계에서 한다. 피드 파싱은 원문
// 마크업을 받으므로 둘 다 필요하고, normalizeCandidate는 이미 entity가 풀린 텍스트를 받으므로
// 마크업 제거만 필요하다. 이 구분이 무너져 entity 해제가 두 번 걸리면, 첫 해제로 되살아난 본문의
// 꺾쇠 표기(`Signed-off-by: … <naush@raspberrypi.com>`)가 두 번째 마크업 제거에 삼켜진다.

function feedSource(overrides = {}) {
  return {
    id: 'raspberrypi-libcamera-releases',
    name: 'Raspberry Pi libcamera Releases',
    url: 'https://github.com/raspberrypi/libcamera/releases.atom',
    sourceUrl: 'https://github.com/raspberrypi/libcamera/releases.atom',
    category: 'linux-camera',
    section: 'Camera Driver / V4L2',
    priority: 'high',
    reliability: 'official',
    keywords: ['libcamera', 'camera'],
    ...overrides
  };
}

function atomFeed(contentXml) {
  return [
    '<feed>',
    '<entry>',
    '<title>v0.7.2+rpt20260817</title>',
    '<link href="https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2"/>',
    '<updated>2026-08-17T00:00:00Z</updated>',
    `<content type="html">${contentXml}</content>`,
    '</entry>',
    '</feed>'
  ].join('\n');
}

test('#975 본문의 꺾쇠 표기는 후보 summary까지 살아남는다', () => {
  const feed = atomFeed(
    'Revert "ipa: rpi: imx296: Enable embedded data" Right now embedded data with the imx296 ' +
    'cannot be negotiated with the CFE. Signed-off-by: Naushir Patuck &lt;naush@raspberrypi.com&gt;'
  );

  const [candidate] = parseRss(feed, feedSource());

  assert.match(candidate.summary, /Signed-off-by: Naushir Patuck <naush@raspberrypi\.com>/);
});

test('#975 escape된 HTML 마크업은 후보 summary에 남지 않는다', () => {
  const feed = atomFeed('&lt;p&gt;Camera HAL buffer fix landed.&lt;/p&gt;&lt;br /&gt;&lt;!-- editor note --&gt;');

  const [candidate] = parseRss(feed, feedSource());

  assert.equal(candidate.summary, 'Camera HAL buffer fix landed.');
});

test('#975 CDATA 안의 리터럴 마크업도 후보 summary에 남지 않는다', () => {
  const feed = atomFeed('<![CDATA[<p>Camera HAL buffer fix landed.</p>]]>');

  const [candidate] = parseRss(feed, feedSource());

  assert.equal(candidate.summary, 'Camera HAL buffer fix landed.');
});

test('#975 정규화는 멱등이다: 이미 정규화된 후보를 다시 넣어도 텍스트가 줄지 않는다', () => {
  const raw = {
    source: feedSource(),
    title: 'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2',
    publishedAt: '2026-08-17',
    summary: 'Reported-by: Naushir Patuck <naush@raspberrypi.com> for the AT&T sensor path.',
    sourceKind: 'release_note_item'
  };

  const first = normalizeCandidate(raw);
  const second = normalizeCandidate({ ...raw, summary: first.summary });

  assert.equal(first.summary, raw.summary);
  assert.equal(second.summary, first.summary);
});

test('#975 normalizeCandidate는 entity를 두 번 풀지 않는다', () => {
  // 소스별 수집기는 이미 entity를 푼 텍스트를 넘긴다. 그 텍스트에 남은 `&amp;`는 출처가 실제로
  // 그렇게 쓴 리터럴이므로 정규화가 다시 풀면 안 된다.
  const candidate = normalizeCandidate({
    source: feedSource(),
    title: 'libcamera: Fix &amp; cleanup in the imx296 pipeline',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2',
    publishedAt: '2026-08-17',
    summary: 'Documents how to escape &amp; and &lt; inside pipeline handler logs.',
    sourceKind: 'release_note_item'
  });

  assert.equal(candidate.title, 'libcamera: Fix &amp; cleanup in the imx296 pipeline');
  assert.equal(candidate.summary, 'Documents how to escape &amp; and &lt; inside pipeline handler logs.');
});

test('#975 Raspberry Pi 릴리스 수집기의 본문 꺾쇠도 후보까지 보존된다', () => {
  // GitHub releases.atom의 <content type="html">은 릴리스 본문 HTML에 XML escape를 한 겹 더
  // 씌운다. 그래서 본문의 리터럴 꺾쇠는 `&amp;lt;`로, 본문의 진짜 태그는 `&lt;p&gt;`로 들어온다.
  const feed = atomFeed(
    '&lt;p&gt;Revert "ipa: rpi: imx296: Enable embedded data" ' +
    'Signed-off-by: Naushir Patuck &amp;lt;naush@raspberrypi.com&amp;gt;&lt;/p&gt;'
  );
  const [item] = resolveRaspberryPiLibcameraReleaseItems(feed, feedSource());
  const candidate = normalizeCandidate(item);

  assert.match(item.summary, /<naush@raspberrypi\.com>/);
  assert.match(candidate.summary, /<naush@raspberrypi\.com>/);
});
