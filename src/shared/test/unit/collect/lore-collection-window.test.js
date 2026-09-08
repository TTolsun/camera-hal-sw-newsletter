const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { classifyAospCameraStackCandidate, BUCKETS } = require('../../../domain/aosp-camera-scope');

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

// 아래 두 테스트도 어휘 목록을 복사하지 않는다. 질의 문자열에서 s: 토큰을 읽어 와서 쓴다.
//
// 잠그는 범위는 아래 고른 IPU 제목들뿐이다. 분류기 어휘 전체와 질의의 결합을 잠그려면
// STRONG_CAMERA_DRIVER_PATTERNS를 순회해야 하는데, 지금 그렇게 하면 mtk-cam과 libipa가
// 질의에 없어 실패한다. 그 두 어휘를 넣을지는 관측 근거가 따로 필요해서 여기서 정하지 않는다.
function subjectSearchTokens(rssUrl) {
  const query = new URL(rssUrl).searchParams.get('q') || '';
  return (query.match(/\bs:[\w.-]+/gi) || []).map(term => term.slice(2).toLowerCase());
}

function loreSource(id) {
  const source = loreListSources().find(item => item.id === id);
  assert.ok(source, `news-sources.json에 ${id} 소스가 있어야 한다.`);
  return source;
}

// 수집 질의와 분류기는 서로 다른 층이지만 한 방향으로 묶여 있다. 분류기가 Intel IPU 드라이버
// 이름을 카메라 근거로 인정해도(#1107), 수집 질의가 그 제목을 끌어오지 못하면 분류기는 그 후보를
// 볼 기회조차 없다. 2026-09-07호 후보 풀에 실제로 들어온 IPU 항목은 전부 제목이나 요약에
// camera/sensor가 따로 있어서 들어온 것들이었다(#1111).
//
// 아래 제목들은 질의의 다른 토큰(camera/sensor/isp 등)을 하나도 담지 않도록 골랐다. 그래야
// 질의에서 IPU 토큰을 되돌리면 이 테스트가 실패한다.
const INTEL_IPU_PATCH_TITLES = [
  'media: ipu6: fix isys buffer handling',
  'media: ipu7: add isys firmware ABI definitions',
  'media: ipu3-cio2: fix frame buffer queue handling',
  'media: ipu-bridge: add ACPI quirk for Dell Latitude 9440'
];

test('lore search query reaches the Intel IPU patches the classifier counts as camera drivers (#1111)', () => {
  const tokens = subjectSearchTokens(loreSource('lore-linux-media-ipu').rssUrl);
  assert.ok(tokens.length > 0, 'lore IPU 질의에서 s: 토큰을 최소 하나는 읽어야 한다.');

  for (const title of INTEL_IPU_PATCH_TITLES) {
    const classified = classifyAospCameraStackCandidate({
      title,
      summary: 'Kernel patch reworks buffer handling and format negotiation helpers.'
    });
    assert.equal(
      classified.relevance_bucket,
      BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
      `${title}: 이 테스트의 전제는 분류기가 이 제목을 카메라 드라이버로 인정한다는 것이다.`
    );

    const reached = tokens.some(token => new RegExp(`\\b${token}\\b`, 'i').test(title));
    assert.ok(
      reached,
      `${title}: 분류기는 카메라로 인정하는데 lore 질의에는 이 제목을 끌어올 토큰이 없다. 수집이 안 되면 분류기가 판정할 기회 자체가 없다.`
    );
  }
});

// 이 테스트가 잠그는 것이 위 헤더 주석의 창 불변식이다. IPU 토큰을 일반 카메라 질의에 합치면
// 두 어휘가 같은 200건 예산을 나눠 쓴다. 2026-09-08 실측으로 합친 피드의 수집 창은 5.3일,
// 카메라 어휘만 쓰는 피드는 7.2일, IPU 어휘만 쓰는 피드는 17.4일이었다. 선정 창이 7일이므로
// 합치는 순간 주 후반 카메라 신호가 구조적으로 빠진다 — #806이 없앤 실패형 그대로다.
//
// 그래서 두 어휘는 서로 다른 소스에 있어야 한다. 소스가 나뉘면 각자 200건 예산을 따로 받는다.
test('the Intel IPU vocabulary stays off the general camera feed so it does not eat that feed window (#1111)', () => {
  const cameraTokens = subjectSearchTokens(loreSource('lore-linux-media-list').rssUrl);
  const ipuTokens = subjectSearchTokens(loreSource('lore-linux-media-ipu').rssUrl);

  assert.deepEqual(
    cameraTokens.filter(token => token.startsWith('ipu')),
    [],
    'IPU 토큰을 일반 카메라 질의에 합치면 lore 검색 200건 예산을 나눠 써서 수집 창이 선정 창(7일)보다 짧아진다.'
  );
  assert.ok(
    ipuTokens.length > 0 && ipuTokens.every(token => token.startsWith('ipu')),
    'IPU 전용 피드에는 IPU 토큰만 있어야 한다. 카메라 어휘를 여기 섞으면 같은 예산 잠식이 반대 방향으로 생긴다.'
  );
});

test('lore search query keeps the bare ipu token out of the linux-media feed (#1111)', () => {
  const tokens = subjectSearchTokens(loreSource('lore-linux-media-ipu').rssUrl);
  assert.ok(
    !tokens.includes('ipu'),
    '맨몸 ipu는 Intel Infrastructure Processing Unit(네트워크 오프로드)과 겹친다. 비카메라 후보는 분류기가 떨어뜨리지만 그 전에 소스당 캡 8칸을 먼저 먹으므로, 질의 단계에서 빼는 편이 싸다.'
  );
});
