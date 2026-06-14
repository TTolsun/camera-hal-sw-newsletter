const assert = require('node:assert/strict');
const test = require('node:test');

const { parseRss } = require('../../../cli/collect-news-candidates');

function loreSource(overrides = {}) {
  return {
    id: 'lore-linux-media-list',
    name: 'lore.kernel.org linux-media list',
    url: 'https://lore.kernel.org/linux-media/',
    sourceUrl: 'https://lore.kernel.org/linux-media/',
    category: 'camera-hal',
    section: 'Kernel / Media',
    priority: 'high',
    reliability: 'project-official',
    keywords: ['camera', 'media', 'V4L2'],
    requiresCrossCheck: false,
    candidateOnly: false,
    ...overrides
  };
}

// lore(public-inbox) atom 피드의 답장 엔트리는 thr:in-reply-to href에 부모 메시지의 lore URL을 담는다.
// collector가 이 href를 in_reply_to로 보존해야 답장을 부모 패치 시리즈에 묶을 수 있다.
test('parseRss captures thr:in-reply-to href as in_reply_to for lore atom reply entries', () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:thr="http://purl.org/syndication/thread/1.0">',
    '<entry>',
    '<title>Re: [PATCH v10 4/6] dt-bindings: sun6i-a31-mipi-dphy: Add V3s SoC compatible entry</title>',
    '<updated>2026-06-13T16:00:00Z</updated>',
    '<link href="https://lore.kernel.org/linux-media/20260613-nondescript-sociable-goat-aee13a@quoll/"/>',
    '<id>urn:uuid:abc</id>',
    '<thr:in-reply-to ref="urn:uuid:def" href="https://lore.kernel.org/linux-media/20260613152655.212490-5-paulk@sys-base.io/"/>',
    '<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">review comment</div></content>',
    '</entry>',
    '</feed>'
  ].join('\n');

  const candidates = parseRss(atom, loreSource());
  const reply = candidates.find(candidate => /PATCH v10 4\/6/.test(candidate.title));
  assert.ok(reply, 'reply candidate should be parsed');
  assert.ok(
    String(reply.in_reply_to).includes('20260613152655.212490-5-paulk@sys-base.io'),
    `in_reply_to should hold the parent message URL, got: ${reply.in_reply_to}`
  );
});

test('parseRss leaves in_reply_to empty for non-reply entries', () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:thr="http://purl.org/syndication/thread/1.0">',
    '<entry>',
    '<title>[PATCH v10 0/6] Allwinner A31/A83T MIPI CSI-2 and A31 ISP / Platform Support</title>',
    '<updated>2026-06-13T15:27:00Z</updated>',
    '<link href="https://lore.kernel.org/linux-media/20260613152655.212490-1-paulk@sys-base.io/"/>',
    '<id>urn:uuid:cover</id>',
    '<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">cover letter</div></content>',
    '</entry>',
    '</feed>'
  ].join('\n');

  const candidates = parseRss(atom, loreSource());
  const cover = candidates.find(candidate => /PATCH v10 0\/6/.test(candidate.title));
  assert.ok(cover, 'cover candidate should be parsed');
  assert.equal(String(cover.in_reply_to || ''), '');
});
