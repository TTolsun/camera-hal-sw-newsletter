const assert = require('node:assert/strict');
const test = require('node:test');

const { parseRss } = require('../../../cli/collect-news-candidates');

function loreIpuSource() {
  return {
    id: 'lore-linux-media-ipu',
    name: 'lore.kernel.org linux-media list (Intel IPU)',
    url: 'https://lore.kernel.org/linux-media/',
    sourceUrl: 'https://lore.kernel.org/linux-media/',
    category: 'linux-camera',
    section: 'Kernel / Media',
    priority: 'high',
    reliability: 'project-official',
    keywords: ['ipu6', 'ipu7', 'ipu-bridge'],
    requiresCrossCheck: false,
    candidateOnly: false
  };
}

function atomEntry({ title, url }) {
  return [
    '<entry>',
    `<title>${title}</title>`,
    '<updated>2026-09-14T06:14:00Z</updated>',
    `<link href="${url}"/>`,
    `<id>${url}</id>`,
    '<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">body</div></content>',
    '</entry>'
  ].join('\n');
}

// 커널 테스트 로봇(lkp@intel.com)의 빌드 결과 통지는 답장(Re:)과 같은 이유로 시리즈의 리드가
// 될 수 없다. 제목 검색 피드(s:ipu6 OR ...)에는 로봇 통지가 그대로 걸리므로(2026-09-14호
// candidates.json 실측 4건) parseRss가 후보로 만들지 않아야 한다. 같은 피드의 [PATCH ...]
// 엔트리는 브래킷 안에 콜론이 없어 로봇 제목 접두와 구분되며 후보로 남아야 한다.
test('parseRss drops lore kernel test robot build reports but keeps [PATCH] entries', () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:thr="http://purl.org/syndication/thread/1.0">',
    atomEntry({
      title: '[sailus-media-tree:ipu6] BUILD SUCCESS 6f6d9729301fbf8fadff3c1822cdd730ef6cd213',
      url: 'https://lore.kernel.org/linux-media/202609071453.Wr61Aa3p-lkp@intel.com/'
    }),
    atomEntry({
      title: "[sailus-media-tree:metadata 161/169] drivers/media/pci/intel/ipu6/ipu6-fw-isys.c:664:6: warning: variable 'source' set but not used",
      url: 'https://lore.kernel.org/linux-media/202609131638.i4iLw29I-lkp@intel.com/'
    }),
    atomEntry({
      title: '[sailus-media-tree:metadata 163/169] drivers/media/pci/intel/ipu6/ipu7-fw-isys.c:599:3: error: cannot jump from this goto statement to its label',
      url: 'https://lore.kernel.org/linux-media/202609140614.KMCttn8e-lkp@intel.com/'
    }),
    atomEntry({
      title: '[PATCH v2 1/3] media: ipu6: Check the remote pad before dereferencing it',
      url: 'https://lore.kernel.org/linux-media/20260909-ipu6-remote-pad-v2-1-abc123@example.org/'
    }),
    '</feed>'
  ].join('\n');

  const candidates = parseRss(atom, loreIpuSource());
  const titles = candidates.map(candidate => candidate.title);

  assert.deepEqual(
    titles,
    ['[PATCH v2 1/3] media: ipu6: Check the remote pad before dereferencing it'],
    `robot reports should not become candidates, got: ${JSON.stringify(titles)}`
  );
});

// Message-ID가 lkp@intel.com이 아니어도 로봇 제목 접두([tree:branch N/M] + warning:/error:/BUILD ...)만으로
// 걸러야 한다. 반대로 [PATCH v2 1/3]은 브래킷 안에 콜론이 없어 접두 정규식에 잡히지 않는다.
test('parseRss recognizes robot reports by the [tree:branch] title prefix alone', () => {
  const atom = [
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    atomEntry({
      title: '[linux-media:master 12/40] drivers/media/pci/intel/ipu6/ipu6-isys.c:120:5: error: implicit declaration',
      url: 'https://lore.kernel.org/linux-media/20260914-robot-report@example.org/'
    }),
    atomEntry({
      title: '[sailus-media-tree:ipu7] BUILD REGRESSION 0123456789abcdef0123456789abcdef01234567',
      url: 'https://lore.kernel.org/linux-media/20260914-robot-regression@example.org/'
    }),
    atomEntry({
      title: '[PATCH v2 1/3] media: ipu6: error: handling cleanup for the CSI-2 warning: path',
      url: 'https://lore.kernel.org/linux-media/20260914-patch-with-words@example.org/'
    }),
    '</feed>'
  ].join('\n');

  const titles = parseRss(atom, loreIpuSource()).map(candidate => candidate.title);
  assert.deepEqual(titles, ['[PATCH v2 1/3] media: ipu6: error: handling cleanup for the CSI-2 warning: path']);
});
