const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveAospSiteUpdateItems, pageDate, MAX_DATE_LOOKUPS } = require('../../../collect/aosp-site-update-dates');
const { resolveFollowedSourceItems, followedSourceResolverIds } = require('../../../collect/followed-source-item-resolvers');

const SOURCE = Object.freeze({
  id: 'aosp-site-updates',
  name: 'AOSP Site Updates',
  url: 'https://source.android.com/docs/setup/about/site-updates'
});

const TARGET = 'https://source.android.com/docs/compatibility/cts/camera-its-tests';

// 사이트 업데이트 표: 월별 묶음 제목 + 카메라 관련 행 하나.
function indexHtml() {
  return `<html><body>
    <h2>July 2026</h2>
    <table><tr>
      <td><a href="/docs/compatibility">Compatibility</a></td>
      <td>Updated <a href="/docs/compatibility/cts/camera-its-tests">Camera ITS tests</a>
          to add fast-FAIL descriptions to scene0 tests.</td>
    </tr></table>
  </body></html>`;
}

function targetHtml(dateLine = 'Last updated 2026-07-13 UTC.') {
  return `<html><body><main><p>${dateLine}</p><p>Camera ITS test catalogue.</p></main></body></html>`;
}

test('월 정밀도 날짜를 대상 페이지의 일 단위 날짜로 올린다', async () => {
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => targetHtml()
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.publishedAt, '2026-07-13');
  assert.equal(item.datePrecision, 'day');
  assert.equal(item.date_source, 'aosp_site_update_target_page');
  // 표가 말한 월은 근거 추적용으로 남긴다.
  assert.equal(item.site_update_month, '2026-07-01');
});

test('페이지에서 날짜를 못 얻으면 항목을 그대로 둔다', async () => {
  // 못 읽은 날짜를 지어내는 것보다 월 정밀도로 남아 참고 레인에 머무는 편이 낫다.
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => '<html><body><main><p>No date here.</p></main></body></html>'
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.datePrecision, 'month');
  assert.equal(item.date_source, undefined);
});

test('한 페이지가 실패해도 나머지 후보는 그대로 나간다', async () => {
  const diagnostics = [];
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => { throw new Error('boom'); },
    onDiagnostic: event => diagnostics.push(event)
  });

  assert.ok(items.length > 0);
  assert.equal(items.find(entry => entry.url === TARGET).datePrecision, 'month');
  assert.equal(diagnostics[0].type, 'aosp_site_update_date_lookup_failed');
  assert.match(diagnostics[0].reason, /boom/);
});

test('같은 URL 이 여러 행에 나와도 한 번만 가져온다', async () => {
  let calls = 0;
  await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => { calls += 1; return targetHtml(); }
  });
  assert.equal(calls, 1);
});

test('대상 페이지가 월까지만 알려 주면 정밀도를 올리지 않는다', async () => {
  // firstDateMatch 의 new Date() 폴백은 "July 2026" 을 2026-07-01 로 만들어 준다.
  // 그 값을 받아 일 정밀도로 올리면 아무도 모르는 "1일"을 발행일로 박게 된다.
  const items = await resolveAospSiteUpdateItems(indexHtml(), SOURCE, {
    fetchTextImpl: async () => '<html><body><main><p>Last updated July 2026.</p></main></body></html>'
  });

  const item = items.find(entry => entry.url === TARGET);
  assert.equal(item.datePrecision, 'month');
  assert.equal(item.publishedAt, '2026-07-01', '표가 준 월 값 그대로다');
  assert.equal(item.date_source, undefined);
});

test('연도만 적힌 페이지도 정밀도를 올리지 않는다', () => {
  assert.equal(pageDate('<main><p>Last updated 2026.</p></main>'), '');
  assert.equal(pageDate('<main><p>Copyright 2026 Google.</p></main>'), '');
});

test('Last updated 가 없으면 본문의 첫 날짜를 쓴다', () => {
  // source-monitor 가 스냅샷을 만들 때와 같은 두 추출기, 같은 순서다.
  assert.equal(pageDate(targetHtml('Last updated 2026-07-13 UTC.')), '2026-07-13');
  assert.equal(pageDate('<main><p>Published 2026-06-02.</p></main>'), '2026-06-02');
});

test('리졸버가 followed-source 레지스트리에 등록돼 있다', async () => {
  assert.ok(followedSourceResolverIds().includes('aosp-site-updates'));

  const items = await resolveFollowedSourceItems(SOURCE, {
    text: indexHtml(),
    fetchTextImpl: async () => targetHtml()
  });
  assert.equal(items.find(entry => entry.url === TARGET).publishedAt, '2026-07-13');
});

test('fetch 상한은 표 파서 상한과 같다', () => {
  // 표가 커져도 fetch 가 파서 출력 상한보다 늘지 않아야 한다.
  assert.equal(MAX_DATE_LOOKUPS, 12);
});
