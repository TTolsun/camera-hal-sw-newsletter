const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', '..', 'data', 'news-sources.json');

// lore.kernel.org(public-inbox)의 "최근 메시지" 피드(new.atom)는 리스트 전체의 최근 몇 건만 돌려준다.
// linux-media는 트래픽이 많아서 그 피드가 덮는 시간 창이 약 2시간(0.09일)밖에 안 되는데,
// 수집은 주 1회 돌고(newsletters-00-orchestrator.yml) 선정 창은 7일이다
// (newsletter-policy.json selectionWindowPolicy.primarySelectionDays). 그래서 7일 중 6일 넘게가
// 구조적으로 수집 대상에서 빠졌다(#806).
//
// 창을 넓히는 레버는 페이지네이션이 아니라 서버측 필터링이다. 리스트 전체를 대상으로 하면
// 최근 200건으로도 1.8일밖에 못 덮지만(하루 약 110건), 제목 범위 카메라 검색은 같은 200건
// 한도로 13일을 덮는다(카메라 트래픽은 하루 약 15건).
//
// 이 테스트가 잠그는 것은 쿼리 "어휘"가 아니라 "필터링된 atom 검색 피드를 쓴다"는 불변식이다.
// 어휘를 여기 복사하면 aosp-camera-scope의 STRONG_CAMERA_DRIVER_PATTERNS와 갈라지는 네 번째
// 어휘 드리프트가 된다(#744 -> #792 -> #805). 쿼리는 recall을 확보하는 전치 필터일 뿐이고,
// 카메라 여부를 판정하는 단일 출처는 여전히 분류기다.
function loreListSources() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  return registry.sources.filter(source => typeof source.rssUrl === 'string' &&
    /^https:\/\/lore\.kernel\.org\//i.test(source.rssUrl));
}

test('lore list sources use a filtered atom search feed instead of the unbounded recent feed', () => {
  const sources = loreListSources();
  assert.ok(sources.length > 0, 'news-sources.json에 lore.kernel.org RSS 소스가 최소 1개는 있어야 한다.');

  for (const source of sources) {
    const url = new URL(source.rssUrl);

    assert.ok(
      !url.pathname.endsWith('/new.atom'),
      `${source.id}: new.atom은 최근 메시지 몇 건만 덮어서(linux-media 기준 약 2시간) 주간 선정 창을 담을 수 없다.`
    );

    const query = url.searchParams.get('q');
    assert.ok(
      query && query.trim(),
      `${source.id}: rssUrl에 비어 있지 않은 q= 서버측 필터가 있어야 수집 창이 주간 선정 창을 덮는다.`
    );

    assert.equal(
      url.searchParams.get('x'),
      'A',
      `${source.id}: rssUrl은 atom 출력(x=A)을 요청해야 한다. 없으면 RSS 파서가 HTML을 받는다.`
    );
  }
});
