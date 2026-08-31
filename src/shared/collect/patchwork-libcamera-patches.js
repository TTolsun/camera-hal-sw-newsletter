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

// lookback 창 하나에 들어올 수 있는 patch 수의 실측 상한. 2024-09-24~2026-08-31의 patch
// 6000건(23.2개월)을 받아 35일 롤링으로 세면 최댓값이 603건(2026-08-24T09:14:06 종료)이고,
// 가장 바쁜 한 주가 2026-W34의 171건이다. 상위 8개 창이 전부 2026-08에 몰려 있어 지금이 관측
// 구간의 피크이고, 반기 제출량(2024H2 950, 2025H1 1099, 2025H2 1720, 2026H1 1352)에도 이 값을
// 곧 넘길 폭증 추세는 없다.
const BUSIEST_MEASURED_LOOKBACK_WINDOW_PATCHES = 603;

// 한 실행에서 읽을 최대 페이지 수. 등록부 URL의 per_page=250은 서버 상한이다(2026-08-31 실측:
// per_page=500/1000/2000이 모두 250건·같은 바이트로 응답). 그래서 per_page만 키워서는 35일을
// 못 덮고 page를 따라가야 한다. 4 x 250 = 1000건이면 위 실측 상한 603건을 덮고, 최대 주(171건)가
// 5주 내리 이어진 855건도 덮는다.
//
// 이 값이 충분한 유일한 이유가 등록부의 per_page이므로 둘은 한 쌍이다. 등록부만 per_page=50으로
// 되돌리면 4페이지 = 200건 < 603건이 되어 이슈 이전 결함으로 되돌아간다. 그 결합은
// patchwork-libcamera-patches.test.js가 등록부 per_page x MAX_PATCH_PAGES >=
// BUSIEST_MEASURED_LOOKBACK_WINDOW_PATCHES로 잠근다.
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

// patchwork는 타임존 없는 ISO(2026-08-31T13:23:12)로 준다. 오프셋이나 Z가 붙어 오는 날에도
// 그대로 읽도록, 이미 타임존이 있으면 Z를 덧붙이지 않는다. 붙여 버리면 모든 날짜가 NaN이 되어
// 아래 pageCrossesLookback이 첫 페이지에서 멈추고, 이슈 이전 동작으로 조용히 되돌아간다.
const TIMEZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

function patchTime(patch) {
  const raw = String((patch && patch.date) || '').trim();
  if (!raw) return NaN;
  return Date.parse(TIMEZONE_SUFFIX_PATTERN.test(raw) ? raw : `${raw}Z`);
}

/**
 * 이 페이지가 lookback 경계를 넘었는가. 가장 오래된 patch로 판단한다 — 페이지 안에 창 안 항목과
 * 창 밖 항목이 섞여 있으면 경계는 이미 이 페이지 안이므로 더 팔 이유가 없다.
 *
 * 빈 페이지(목록 끝)는 넘은 것으로 본다. 항목은 있는데 읽히는 날짜가 하나도 없는 경우도 창 안이라고
 * 말할 근거가 없어 멈추지만, 그건 정상 종료가 아니라 날짜 형식 드리프트다 — 조용히 첫 페이지만 읽는
 * 상태와 "이번 창은 여기까지"가 산출물에서 같은 모양이 되지 않도록 알린다.
 */
function pageCrossesLookback(patches, cutoffMs, pageNumber) {
  const times = patches.map(patchTime).filter(Number.isFinite);
  if (times.length === 0) {
    if (patches.length > 0) {
      console.warn(`patchwork-libcamera-patches: page ${pageNumber} carries ${patches.length} patch(es) but no parseable date; `
        + 'stopping without reading the lookback window.');
    }
    return true;
  }
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
 * 상한(2)으로 끝났는데 마지막 페이지가 아직 창 안이면 이번 창을 다 읽지 못한 것이다. 그 상태를
 * 조용히 두면 산출물에서 "이번 주 신호 적음"과 완전히 같은 모양이 되므로(#970이 지목한 바로 그
 * 서명) 다른 종료 경로와 같은 자리에 알린다.
 *
 * 더 위로 올리지 못하는 이유는 진단 어휘가 닫혀 있어서가 아니다 — dated-article-index-resolver의
 * DATED_ARTICLE_DIAGNOSTIC_KINDS는 "미등록 kind를 내지 말라"는 계약이지 kind를 더하지 말라는
 * 뜻이 아니고, skipped_index_budget처럼 resolver 밖에서 내는 kind도 이미 그 목록에 있다. 진짜
 * 이유는 소스 행이 안 생긴다는 것이다: 수집 리포트의 소스 행(datedArticleCollectionSectionLines)은
 * article_cap_counts_by_source와 received_bytes_by_source의 합집합으로 만드는데, patchwork는
 * dated-article 리졸버가 아니라 fetchClient가 null이라 두 맵 어디에도 안 들어간다. 지금 이벤트를
 * 내면 kind_counts만 오르고 어느 소스가 잘렸는지는 표에 안 남는다. 제대로 올리려면 patchwork
 * 바이트 계정이 먼저다(후속 이슈). 그동안은 console.warn이 Actions 로그에 남아 관측된다.
 *
 * 형제 리졸버(aosp-release-camera-changes)는 저장소당 집계 후보 하나에 truncated를 실어 본문에
 * "at least N"으로 적지만, 여기 후보는 patch 1건마다 하나라 하한임을 적을 집계 본문이 없다
 * (summary에 문구를 주입하면 위의 "키워드 미주입" 결정을 뒤집는다).
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

  for (let page = 1; page < MAX_PATCH_PAGES; page += 1) {
    if (pageCrossesLookback(patches, cutoffMs, page)) return candidates;
    const url = patchPageUrl(source.sourceUrl || source.url, page + 1);
    if (!url) return candidates;
    try {
      patches = parsePatchPage(await fetchTextImpl(url, PATCH_PAGE_FETCH_TIMEOUT_MS));
    } catch (error) {
      console.warn(`patchwork-libcamera-patches: ${url} fetch failed (${error.message}); stopping at page ${page}.`);
      return candidates;
    }
    if (!patches) {
      console.warn(`patchwork-libcamera-patches: ${url} did not return a patch array; stopping at page ${page}.`);
      return candidates;
    }
    candidates.push(...patches.map(patch => patchCandidate(patch, source)).filter(Boolean));
  }

  // 상한까지 다 읽고 나왔다. 마지막 페이지가 아직 창 안이면 이번 창을 다 읽지 못한 것이다.
  if (!pageCrossesLookback(patches, cutoffMs, MAX_PATCH_PAGES)) {
    console.warn(`patchwork-libcamera-patches: stopped at the ${MAX_PATCH_PAGES}-page ceiling with page ${MAX_PATCH_PAGES} still inside `
      + `the ${lookbackDays}-day window; the ${candidates.length} collected patch(es) are a lower bound, not the whole window.`);
  }
  return candidates;
}

module.exports = {
  BUSIEST_MEASURED_LOOKBACK_WINDOW_PATCHES,
  MAX_PATCH_PAGES,
  resolvePatchworkLibcameraPatchItems
};
