// 일부 공식 소스는 인덱스 페이지(월별/아카이브 링크)만 연결돼 있어 인덱스 파싱만으로는
// dated 증거를 못 만든다(source-gap). 소스별로 최신 상세 페이지를 따라가 dated 후보를 만드는
// followed-source 리졸버를 source.id 기준 레지스트리 테이블로 디스패치한다. 새 리졸버를 추가할 때
// collect 디스패치 코드를 고치지 않고 이 테이블에만 항목을 더하면 된다(OCP).
const { resolveSecurityBulletinCveItems } = require('./security-bulletin-cve');
const { resolveMediatekSecurityBulletinItems } = require('./mediatek-security-bulletin');
const { resolveLibcameraReleaseAnnouncementItems } = require('./libcamera-release-announcements');
const { resolveRaspberryPiLibcameraReleaseItems } = require('./raspberrypi-libcamera-releases');
const { resolvePatchworkLibcameraPatchItems } = require('./patchwork-libcamera-patches');
const { resolveAospReleaseCameraChangeItems } = require('./aosp-release-camera-changes');
const { resolveGerritCameraChangeItems } = require('./gerrit-camera-changes');
const { resolveDatedArticleIndexItems } = require('./dated-article-index-resolver');

// 각 리졸버의 첫 인자가 다르다(security-bulletin은 indexItems, libcamera는 text/indexHtml,
// raspberrypi는 text/atom, patchwork는 text/JSON). 그래서 레지스트리 항목이 공통 컨텍스트
// ({ indexItems, text, source, fetchTextImpl })를 받아 각자에게 맞는 위치 인자로 풀어 넘긴다.
const FOLLOWED_SOURCE_RESOLVERS = [
  {
    id: 'android-security-bulletin',
    resolve: ({ indexItems, source, fetchTextImpl }) =>
      resolveSecurityBulletinCveItems(indexItems, source, { fetchTextImpl })
  },
  {
    id: 'mediatek-security-bulletin',
    resolve: ({ text, source, fetchTextImpl }) =>
      resolveMediatekSecurityBulletinItems(text, source, { fetchTextImpl })
  },
  {
    id: 'libcamera-release-announcements',
    resolve: ({ text, source, fetchTextImpl }) =>
      resolveLibcameraReleaseAnnouncementItems(text, source, { fetchTextImpl })
  },
  {
    id: 'raspberrypi-libcamera-releases',
    resolve: ({ text, source }) =>
      resolveRaspberryPiLibcameraReleaseItems(text, source)
  },
  {
    id: 'patchwork-libcamera-patches',
    // 목록 API는 한 응답이 lookback 창을 못 덮는다(#970). 창 경계까지 page를 따라가야 하므로
    // fetch impl과 수집 창을 함께 넘긴다(aosp-release-camera-changes와 같은 배선).
    // onDiagnostic까지 넘기는 이유(#1059): #970이 세운 페이지 상한에 걸려 창을 다 못 읽은 실행이
    // console.warn으로만 남으면 커밋된 산출물에서 "이번 주 신호 없음"과 구분되지 않는다.
    resolve: ({ text, source, fetchTextImpl, now, lookbackDays, onDiagnostic }) =>
      resolvePatchworkLibcameraPatchItems(text, source, { fetchTextImpl, now, lookbackDays, onDiagnostic })
  },
  {
    id: 'aosp-release-camera-changes',
    resolve: ({ text, source, fetchTextImpl, now, lookbackDays }) =>
      resolveAospReleaseCameraChangeItems(text, source, { fetchTextImpl, now, lookbackDays })
  },
  {
    // AOSP와 ChromeOS는 Gerrit 호스트만 다르고 응답 계약이 같다. 감시 대상(프로젝트·경로·상태)은
    // 등록부의 sourceUrl 질의가 정하고, 리졸버는 호스트를 그 URL의 origin에서 파생한다 - 그래서
    // 같은 리졸버를 두 항목이 공유한다.
    id: 'aosp-gerrit-camera-changes',
    resolve: ({ text, source, fetchTextImpl, now, lookbackDays, onDiagnostic }) =>
      resolveGerritCameraChangeItems(text, source, { fetchTextImpl, now, lookbackDays, onDiagnostic })
  },
  {
    id: 'chromeos-gerrit-camera-changes',
    resolve: ({ text, source, fetchTextImpl, now, lookbackDays, onDiagnostic }) =>
      resolveGerritCameraChangeItems(text, source, { fetchTextImpl, now, lookbackDays, onDiagnostic })
  },
  {
    id: 'claude-blog',
    // dated-article 리졸버는 bounded fetch client 없이는 개별 기사를 못 따라가 곧장 빈 배열로
    // 닫힌다(guard). collector가 이 소스에 client를 만들어 넘기는지는 여기 마커 하나로 정한다 —
    // 별도 목록(예: 과거의 collect-news-candidates.js DATED_ARTICLE_SOURCE_IDS)에 소스 id를
    // 또 적어야 했다면, 그 목록에 추가를 빠뜨리는 순간 이 항목은 등록만 되고 client 없이
    // 조용히 0건을 낸다 — 등록과 배선이 한 act가 되도록 이 마커로만 판단한다.
    requiresFetchClient: true,
    // 목록 origin·경로는 여기 적지 않는다. resolver가 source.sourceUrl(registry 정본)에서
    // 파생하므로, registry의 URL만 바꿔도 fetch 대상·parentUrl·기사 URL이 함께 따라간다.
    resolve: ({ text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts }) =>
      resolveDatedArticleIndexItems({
        html: text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts
      })
  },
  {
    id: 'anthropic-news',
    requiresFetchClient: true,
    resolve: ({ text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts }) =>
      resolveDatedArticleIndexItems({
        html: text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts
      })
  }
];

function followedSourceResolverIds() {
  return FOLLOWED_SOURCE_RESOLVERS.map(entry => entry.id);
}

/**
 * requiresFetchClient: true로 표시된 항목의 id만 돌려준다. collect-news-candidates.js가
 * 소스별 bounded fetch client를 만들지 정할 때 이 함수 하나만 본다 — 별도로 관리하는 두 번째
 * 목록이 없으므로 등록(FOLLOWED_SOURCE_RESOLVERS에 항목 추가)과 배선(client 생성)이 항상
 * 같은 자리에서 일어난다.
 */
function sourceIdsRequiringFetchClient() {
  return FOLLOWED_SOURCE_RESOLVERS.filter(entry => entry.requiresFetchClient === true).map(entry => entry.id);
}

/**
 * source.id에 맞는 followed-source 리졸버를 찾아 호출하고 그 결과(후보 배열)를 반환한다.
 * 등록된 리졸버가 없으면 빈 배열을 반환한다(기존 `let followedItems = []` 기본값과 동일).
 */
async function resolveFollowedSourceItems(source, { indexItems = [], text = '', fetchTextImpl, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts } = {}) {
  const entry = FOLLOWED_SOURCE_RESOLVERS.find(candidate => candidate.id === source.id);
  if (!entry) return [];
  return entry.resolve({ indexItems, text, source, fetchTextImpl, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts });
}

/**
 * 제너릭 parseRss/parseHtmlPage 폴백을 막아야 하는 소스인지 판정한다. 두 부류가 있다.
 *
 * 1. followed-resolver가 등록된 소스. 인덱스 페이지에 직접 후보가 없어 리졸버가 상세를 따라간다.
 *    그 큐레이션 추출이 비었다는 건 "이번 window에 신호 없음"이지, 인덱스 나비링크를 제너릭
 *    스크레이프하라는 뜻이 아니다.
 * 2. 설정상 참고 자료인 소스(`sourceRole=official_documentation_reference` 또는
 *    `mainArticlePolicy=reference_only`). 소비자 쪽은 이미 이 둘을 main article에서 하드
 *    제외한다 — collect-news-candidates.js의 `referenceIndex`가 `main_eligible=false`,
 *    `reference_only=true`로 닫고, source-quality-classifier.js도 `reference_only` blocker를
 *    붙인다. 그런데 생산자 쪽에서는 제너릭 폴백이 이런 소스의 인덱스 페이지 제목을 매주 후보
 *    한 건으로 만들어 낸다. 그 후보는 날짜가 없어 늘 `finalSelectionEligibility=exclude`로
 *    끝나고, 대신 진단(`parser_extraction_failure`, `KEEP_AND_FIX_PARSER`)을 상시로 켜서 진짜
 *    파서 고장 신호를 묻는다. 그래서 생산자를 소비자 계약에 맞춘다(#880).
 *
 * 여기서 막는 건 폴백뿐이다. 그리고 registry role이 `official_documentation_reference`인 소스는
 * 소스별 파서를 따로 두더라도 그 결과가 후보로 살아나지 않는다 — collect-news-candidates.js의
 * `classifySelection`(`:577`)이 파서 결과와 무관하게 `finalSelectionEligibility='exclude'`,
 * `isArticleCandidate=false`, `hasDatedEvidence=false`로 즉시 닫는다. 그 소스의 파서를 다시
 * 살리려면 registry role도 함께 되돌려야 한다. 이 술어는 `mainArticlePolicy=reference_only`만
 * 가진 소스도 막지만, 그쪽은 classifySelection의 role 분기를 타지 않는다 — 지금 registry의 참고
 * 소스는 전부 두 표시를 다 갖고 있어 해당 소스가 없다.
 */
function shouldSuppressGenericFallback(source) {
  if (!source) return false;
  if (followedSourceResolverIds().includes(source.id)) return true;
  return source.sourceRole === 'official_documentation_reference' ||
    source.mainArticlePolicy === 'reference_only';
}

module.exports = {
  FOLLOWED_SOURCE_RESOLVERS,
  followedSourceResolverIds,
  resolveFollowedSourceItems,
  shouldSuppressGenericFallback,
  sourceIdsRequiringFetchClient
};
