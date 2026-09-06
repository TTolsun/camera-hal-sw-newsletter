'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveQualcommSecurityBulletinItems,
  parseBulletinRows,
  bodyPublishedDate,
  bulletinBodyUrl
} = require('../../../collect/qualcomm-security-bulletin');

const SOURCE = {
  id: 'qualcomm-security-bulletins',
  sourceUrl: 'https://docs.qualcomm.com/product/publicresources/securitybulletin',
  category: 'vendor-security'
};
const NOW = new Date('2026-07-10T00:00:00Z');

// 2026-09-06 실측 응답에서 이 리졸버가 읽는 필드만 남긴 모양.
function searchResponse(resources) {
  return JSON.stringify({ start: 0, total: resources.length, resources });
}
function julyResource(overrides = {}) {
  return {
    title: 'July 2026 Security Bulletin',
    url: 'https://docs.qualcomm.com/securitybulletin/july-2026-bulletin.html',
    dcn: '80-73802-98',
    publishedOn: '2026-07-06T14:57:03Z',
    ...overrides
  };
}
// 실측 본문의 표는 5열이다: Public ID / Security Rating / CVSS Rating / Technology Area / Date Reported.
function bulletinBody({ published = '07/06/2026', rows = null } = {}) {
  const body = rows || [
    ['CVE-2026-21368', 'Medium', 'Medium', 'Camera Driver', '07/31/2025'],
    ['CVE-2026-21369', 'High', 'High', 'Computer Vision', '08/04/2025'],
    ['CVE-2026-21370', 'Critical', 'Critical', 'Automotive GPU', '08/09/2025']
  ];
  const tr = body.map(cells =>
    `<tr>${cells.map(c => `<td class="entry cellrowborder">${c}</td>`).join('')}</tr>`).join('');
  return `<html><body><h1>July 2026 Security Bulletin</h1>
    <p>Published: ${published}</p>
    <table><tbody>${tr}</tbody></table></body></html>`;
}

// 요청을 순서대로 기록하는 fetch client stub. 실제 client와 같은 결과 모양을 돌려준다.
function stubClient(handlers) {
  const calls = [];
  return {
    calls,
    fetchBounded: async (url, options = {}) => {
      calls.push({ url, ...options });
      const handler = handlers.find(h => h.match(url, options));
      if (!handler) return { ok: false, status: 404, body: '', error: 'http_404' };
      return { ok: true, status: 200, body: handler.body, error: '' };
    }
  };
}
function searchHandler(body) {
  return { match: url => url.includes('globalsearch'), body };
}
function bodyHandler(body) {
  return { match: url => url.includes('/bundle/publicresource/') && !url.includes('globalsearch'), body };
}

test('parses the five-column CVE table and skips rows without a CVE', () => {
  const rows = parseBulletinRows(bulletinBody());
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    cve_id: 'CVE-2026-21368', severity: 'Medium', cvss: 'Medium',
    technology_area: 'Camera Driver', date_reported: '07/31/2025'
  });
  // 부속 표(열 수가 다르거나 CVE가 없는 행)는 후보가 되면 안 된다.
  const noise = '<table><tr><td>Chipset</td><td>SM8650</td></tr></table>';
  assert.equal(parseBulletinRows(noise).length, 0);
});

test('reads the published date the document states about itself', () => {
  assert.equal(bodyPublishedDate(bulletinBody({ published: '08/03/2026' })), '2026-08-03');
  assert.equal(bodyPublishedDate('<p>no date here</p>'), '');
});

test('builds the body url from the document id and the listed slug', () => {
  assert.equal(
    bulletinBodyUrl('https://docs.qualcomm.com', '80-73802-98',
      'https://docs.qualcomm.com/securitybulletin/july-2026-bulletin.html'),
    'https://docs.qualcomm.com/bundle/publicresource/80-73802-98/topics/july-2026-bulletin.html'
  );
  // 문서 id가 없으면 본문 주소를 만들 수 없다. 추측한 주소를 만들면 안 된다.
  assert.equal(bulletinBodyUrl('https://docs.qualcomm.com', '', 'https://x/july.html'), '');
});

test('sends the search request shape the endpoint actually accepts', async () => {
  const client = stubClient([searchHandler(searchResponse([])), bodyHandler(bulletinBody())]);
  await resolveQualcommSecurityBulletinItems({ source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7 });

  const search = client.calls.find(call => call.url.includes('globalsearch'));
  assert.ok(search, '검색 요청을 보내야 한다');
  assert.equal(search.method, 'POST');
  assert.equal(search.contentType, 'text/plain',
    'application/json으로 보내면 이 엔드포인트는 500을 돌려준다(실측)');
  const payload = JSON.parse(search.body);
  assert.deepEqual(payload.sortFields, [{ field: 'score', order: 'desc' }],
    'sortFields를 비우면 500이다(실측)');
  assert.deepEqual(payload.filterFields, [{
    field: 'pkDocumentPath', values: ['PDC20903/2026 Security Bulletins']
  }], '제품 id만 넣고 연도를 빼면 500이다(실측)');
});

test('follows the document id to the body with a referer', async () => {
  const client = stubClient([
    searchHandler(searchResponse([julyResource()])),
    bodyHandler(bulletinBody())
  ]);
  await resolveQualcommSecurityBulletinItems({ source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7 });

  const body = client.calls.find(call => call.url.includes('/topics/'));
  assert.ok(body, '본문을 따라가야 한다');
  assert.equal(body.url,
    'https://docs.qualcomm.com/bundle/publicresource/80-73802-98/topics/july-2026-bulletin.html');
  assert.ok(body.referer, 'referer 없이 요청하면 이 본문은 404다(실측)');
});

test('keeps only camera-area rows and states the document date', async () => {
  const client = stubClient([
    searchHandler(searchResponse([julyResource()])),
    bodyHandler(bulletinBody())
  ]);
  const items = await resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  });

  assert.equal(items.length, 1, 'Automotive GPU와 Computer Vision 행은 카메라가 아니다');
  const item = items[0];
  assert.equal(item.version_or_release, 'CVE-2026-21368');
  assert.equal(item.publishedAt, '2026-07-06', '목록의 publishedOn이 아니라 본문이 밝힌 발행일이다');
  assert.equal(item.sourceKind, 'release_note_item');
  assert.equal(item.api_or_component, 'Qualcomm Security Bulletin / Camera Driver');
  assert.ok(item.behavior_change.includes('CVE-2026-21368'));
  assert.equal(item.url, 'https://docs.qualcomm.com/securitybulletin/july-2026-bulletin.html',
    '사람이 열 수 있는 게시판 주소를 증거 URL로 쓴다');
  assert.equal(item.source, SOURCE, 'normalizeCandidate가 source에서 category/priority를 읽는다');
});

test('produces nothing when the document does not state a published date', async () => {
  // 날짜를 추정하지 않는다. 목록의 publishedOn으로 채우면 재발행 타임스탬프를 문서 발행일로
  // 발행하게 되고, 그 후보는 창 판정을 실제와 다르게 통과한다.
  const client = stubClient([
    searchHandler(searchResponse([julyResource()])),
    bodyHandler(bulletinBody({ published: '' }).replace('Published: ', 'Published'))
  ]);
  const items = await resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  });
  assert.deepEqual(items, []);
});

test('drops a bulletin whose own date falls outside the collection window', async () => {
  // 목록 publishedOn은 창 안인데 본문이 밝힌 날짜가 창 밖인 경우다(재발행 타임스탬프).
  // 창 판정의 정본은 본문이다.
  const client = stubClient([
    searchHandler(searchResponse([julyResource({ publishedOn: '2026-07-08T00:00:00Z' })])),
    bodyHandler(bulletinBody({ published: '02/02/2026' }))
  ]);
  const items = await resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  });
  assert.deepEqual(items, []);
});

test('ignores bulletins published outside the window before spending a body fetch', async () => {
  const client = stubClient([
    searchHandler(searchResponse([julyResource({ publishedOn: '2026-02-02T00:00:00Z' })])),
    bodyHandler(bulletinBody())
  ]);
  const items = await resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  });
  assert.deepEqual(items, []);
  assert.equal(client.calls.filter(call => call.url.includes('/topics/')).length, 0,
    '창 밖 게시판의 본문은 받지 않는다');
});

test('returns nothing without a fetch client instead of throwing', async () => {
  const items = await resolveQualcommSecurityBulletinItems({ source: SOURCE, now: NOW, lookbackDays: 7 });
  assert.deepEqual(items, []);
});

// --- 빈 결과의 사유 (리뷰 지적, PR #1079) ----------------------------------
// 이 소스는 리졸버 등록만으로 제너릭 폴백이 꺼지고 PARSERS에도 없어, 빈 결과가 곧 후보 0건이다.
// 그래서 "조용한 창"과 "못 읽음"이 같은 빈 배열로 끝나면 안 된다.

function captureWarnings(run) {
  const original = console.warn;
  const lines = [];
  console.warn = message => lines.push(String(message));
  return Promise.resolve()
    .then(run)
    .then(value => ({ value, lines }))
    .finally(() => { console.warn = original; });
}

test('says the response shape changed when the search returns no resources array', async () => {
  const client = stubClient([
    { match: url => url.includes('globalsearch'), body: JSON.stringify({ start: 0, total: 0 }) },
    bodyHandler(bulletinBody())
  ]);
  const { value, lines } = await captureWarnings(() => resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  }));
  assert.deepEqual(value, []);
  assert.ok(lines.some(line => line.includes('response shape may have changed')),
    'resources 배열이 없는 것은 "게시판이 없다"가 아니라 "응답 모양이 바뀌었다"다');
  assert.ok(lines.some(line => line.includes('read failure, not a quiet window')),
    '결과 0건의 이유가 읽기 실패임을 한 줄로 남겨야 한다');
});

test('stays silent when the window is legitimately quiet', async () => {
  // 목록은 정상적으로 읽혔고 그 해에 창 안 게시판이 없을 뿐이다. 이건 사실이므로 경고하지 않는다.
  const client = stubClient([
    searchHandler(searchResponse([julyResource({ publishedOn: '2026-02-02T00:00:00Z' })])),
    bodyHandler(bulletinBody())
  ]);
  const { value, lines } = await captureWarnings(() => resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  }));
  assert.deepEqual(value, []);
  assert.deepEqual(lines, [], '조용한 창까지 경고하면 진짜 고장이 소음에 묻힌다');
});

test('names the in-window bulletins the per-run cap left unread', async () => {
  // 창 안 게시판이 상한(3)을 넘는 상태를 실제로 만든다. 넷째부터는 본문을 안 받으므로,
  // 그 사실을 남기지 않으면 "이번 창에 카메라 CVE 없음"으로 잘못 읽힌다.
  const resources = ['07-04', '07-05', '07-06', '07-07'].map((day, index) => julyResource({
    title: `July 2026 Security Bulletin rev ${index}`,
    url: `https://docs.qualcomm.com/securitybulletin/july-2026-rev${index}.html`,
    dcn: `80-73802-9${index}`,
    publishedOn: `2026-${day.replace('-', '-')}T00:00:00Z`
  }));
  const client = stubClient([searchHandler(searchResponse(resources)), bodyHandler(bulletinBody())]);
  const { lines } = await captureWarnings(() => resolveQualcommSecurityBulletinItems({
    source: SOURCE, fetchClient: client, now: NOW, lookbackDays: 7
  }));

  assert.equal(client.calls.filter(call => call.url.includes('/topics/')).length, 3,
    '본문은 상한만큼만 받는다');
  const capped = lines.find(line => line.includes('exceeded the per-run body cap'));
  assert.ok(capped, '상한이 자른 사실을 남겨야 한다');
  assert.ok(capped.includes('rev 0'), '빠진 게시판의 이름을 적어야 한다');
});
