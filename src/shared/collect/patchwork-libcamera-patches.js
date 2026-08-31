// patchwork.libcamera.org는 libcamera 프로젝트의 patch-review를 REST API(/api/patches/)로 노출한다.
// 각 patch 객체는 실제 제출 date(ISO)를 가지므로 dated 후보를 만들 수 있다(docs.kernel.org처럼
// 날짜가 없는 소스와 대조). 응답은 bare JSON 배열이라 parseRss/parseHtmlPage가 못 읽어
// followed-source 리졸버로 직접 파싱한다.
//
// patch-review는 dev churn이 많으므로 여기서는 dated 후보만 만들고, 카메라 관련성 판정은 분류기
// (aosp-camera-scope)에, main 승급은 mailing-list cross-check 게이트(mailing-list-patch-eligibility)에
// 맡긴다. 두 가지를 의도적으로 하지 않는다: (1) relevanceBucketHint를 강제하지 않는다 — 제목이
// 카메라 근거를 가질 때만 분류기가 카메라 버킷으로 올린다. (2) summary에 카메라/스코어링 키워드를
// 넣지 않는다 — technicalDepth는 제목+summary를 읽으므로, summary가 키워드를 주입하면 docs/build
// 같은 churn 패치까지 technicalDepth 하한을 넘어 main 슬롯 승급 대상이 되어버린다. summary는
// 중립으로 두고 실제 patch 제목만 technicalDepth를 결정하게 한다.
//
// 목록은 한 응답으로 끝나지 않는다(#970). 등록부 URL 하나만 읽으면 이 소스가 실제로 보는 창은
// 파이프라인 lookback(35일)이 아니라 "응답 한 페이지가 덮는 시간"이고, 그 폭은 제출량에 반비례한다.
// 2026-08-24 실측: 최신 50건이 09:06:35~09:14:06 = 7.5분만 덮었고 같은 커버리지 주(08-17~08-23)의
// patch 171건이 통째로 창 밖이었다. 조용한 주에는 같은 50건이 5일을 덮어 문제가 드러나지 않고,
// 바쁜 주에만 신호를 잃는다. 그래서 lookback 경계에 닿을 때까지 page를 따라간다.

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// 수집 창을 못 받았을 때의 기본값(runtime-config의 lookbackDays 기본과 같다).
const DEFAULT_LOOKBACK_DAYS = 35;

// 한 실행에서 읽을 최대 페이지 수. 등록부 URL의 per_page=250은 서버 상한이다(2026-08-31 실측:
// per_page=500/1000/2000이 모두 250건·같은 바이트로 응답). 그래서 per_page만 키워서는 35일을
// 못 덮고 page를 따라가야 한다. 상한 값은 실측 제출량에서 나온다: 2026-01-20~08-31의 patch
// 2000건을 받아 보면 가장 바쁜 35일 창이 603건(2026-08-24 종료)이고 가장 바쁜 한 주가 171건이라,
// 그 최대 주가 5주 내리 이어져도 855건 < 4 x 250 = 1000건이다.
const MAX_PATCH_PAGES = 4;

// 페이지 하나가 350KB 안팎이고 실측 응답이 2.3~4.7초다. 수집 루프의 공용 fetch는 기본 타임아웃이
// 없어서, 지연된 페이지 하나가 수집 실행 전체를 멈춰 세울 수 있다(aosp-release-camera-changes와 같은 이유).
const PATCH_PAGE_FETCH_TIMEOUT_MS = 10000;

// patchwork patch 객체의 series id. 한 시리즈의 조각들이 같은 series id를 공유하므로, 이 id를 후보에
// 실어 선정 단계 dedup(article-groups seriesKey)이 시리즈를 하나의 대표 기사로 collapse하게 한다(#795).
// URL(/patch/<id>/)의 id는 패치별 고유라 시리즈를 못 묶고, patchwork 후보엔 message-id도 없다.
function patchSeriesId(patch) {
  const series = patch && patch.series;
  const first = Array.isArray(series) ? series[0] : series;
  return first && first.id !== undefined && first.id !== null ? first.id : undefined;
}

function patchCandidate(patch, source) {
  if (!patch || typeof patch !== 'object') return null;
  const title = String(patch.name || '').replace(/\s+/g, ' ').trim();
  const url = String(patch.web_url || '').trim();
  const publishedAt = String(patch.date || '').slice(0, 10);
  if (!title || !url || !DATE_ONLY_PATTERN.test(publishedAt)) return null;

  const submitterName = patch.submitter && typeof patch.submitter === 'object'
    ? String(patch.submitter.name || '').replace(/\s+/g, ' ').trim()
    : '';
  const submittedBy = submitterName ? ` (submitted by ${submitterName})` : '';
  const state = String(patch.state || 'new').replace(/\s+/g, ' ').trim();
  const summary = `Patch under review on the project patch tracker${submittedBy}; `
    + `state ${state}, a proposed change not yet landed.`;

  return {
    source,
    title,
    url,
    publishedAt,
    summary,
    seriesId: patchSeriesId(patch),
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    parentUrl: source.sourceUrl || source.url,
    parentTitle: source.name
  };
}

// 목록 JSON 한 페이지를 patch 배열로 읽는다. 최상위가 배열이 아니거나 파싱이 실패하면
// (에러 객체 응답 포함) null을 돌려 "이 페이지는 못 읽었다"와 "빈 페이지"를 구분한다.
function parsePatchPage(text) {
  let patches;
  try {
    patches = JSON.parse(text);
  } catch {
    return null;
  }
  return Array.isArray(patches) ? patches : null;
}

function patchTime(patch) {
  return Date.parse(`${String((patch && patch.date) || '')}Z`);
}

// 이 페이지가 lookback 경계를 넘었는가. 날짜를 하나도 못 읽으면 아직 창 안이라고 말할 근거가
// 없으므로 넘은 것으로 본다.
function pageCrossesLookback(patches, cutoffMs) {
  const times = patches.map(patchTime).filter(Number.isFinite);
  if (times.length === 0) return true;
  return Math.min(...times) <= cutoffMs;
}

// 다음 페이지 URL은 등록부의 sourceUrl에서 파생한다. origin·경로·질의(order, per_page, format)를
// 여기 적어 두면 등록부를 바꿔도 따라오지 않아 두 정본이 생긴다.
function patchPageUrl(sourceUrl, page) {
  try {
    const url = new URL(String(sourceUrl || ''));
    url.searchParams.set('page', String(page));
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * patchwork REST API의 patch 목록 JSON 텍스트를 받아 dated 후보 배열을 반환한다.
 * 첫 페이지는 collector가 이미 받아 둔 `text`를 쓰고, 그 뒤 페이지만 `fetchTextImpl`로 가져온다.
 *
 * 페이지 순회는 두 조건 중 먼저 걸리는 쪽에서 멈춘다.
 *  1. 방금 읽은 페이지의 가장 오래된 patch가 lookback 창 밖 — 더 파도 이번 창의 후보는 없다.
 *  2. MAX_PATCH_PAGES 도달 — 창 안 제출이 끝없이 이어져도 한 실행의 요청 수를 묶는다.
 * 빈 페이지(목록 끝)와 페이지 조회 실패도 순회를 끝내되, 이미 모은 후보는 그대로 돌려준다.
 *
 * `fetchTextImpl`이 없으면 첫 페이지만 파싱한다(이슈 이전 동작). date나 web_url이 없는 patch는
 * 건너뛴다(graceful). 창 밖 후보를 여기서 버리지는 않는다 — 수집 풀 필터(withinLookback)가
 * 창의 정본이고, 리졸버는 그 창을 "어디까지 읽을지"에만 쓴다.
 */
async function resolvePatchworkLibcameraPatchItems(text = '', source = {}, options = {}) {
  let patches = parsePatchPage(text);
  if (!patches) return [];

  const candidates = patches.map(patch => patchCandidate(patch, source)).filter(Boolean);

  const fetchTextImpl = options.fetchTextImpl;
  if (typeof fetchTextImpl !== 'function') return candidates;
  const now = options.now instanceof Date ? options.now : new Date();
  const lookbackDays = Number.isFinite(options.lookbackDays) && options.lookbackDays > 0
    ? options.lookbackDays
    : DEFAULT_LOOKBACK_DAYS;
  const cutoffMs = now.getTime() - lookbackDays * DAY_MS;

  for (let page = 2; page <= MAX_PATCH_PAGES; page += 1) {
    if (patches.length === 0 || pageCrossesLookback(patches, cutoffMs)) break;
    const url = patchPageUrl(source.sourceUrl || source.url, page);
    if (!url) break;
    try {
      patches = parsePatchPage(await fetchTextImpl(url, PATCH_PAGE_FETCH_TIMEOUT_MS));
    } catch (error) {
      console.warn(`patchwork-libcamera-patches: ${url} fetch failed (${error.message}); stopping at page ${page - 1}.`);
      break;
    }
    if (!patches) {
      console.warn(`patchwork-libcamera-patches: ${url} did not return a patch array; stopping at page ${page - 1}.`);
      break;
    }
    candidates.push(...patches.map(patch => patchCandidate(patch, source)).filter(Boolean));
  }

  return candidates;
}

module.exports = {
  MAX_PATCH_PAGES,
  resolvePatchworkLibcameraPatchItems
};
