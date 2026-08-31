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
    resolve: ({ text, source }) =>
      resolvePatchworkLibcameraPatchItems(text, source)
  },
  {
    id: 'aosp-release-camera-changes',
    resolve: ({ text, source, fetchTextImpl, now, lookbackDays }) =>
      resolveAospReleaseCameraChangeItems(text, source, { fetchTextImpl, now, lookbackDays })
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
 * followed-resolver가 등록된 소스는 인덱스 페이지에 직접 후보가 없어 리졸버가 상세를 따라간다.
 * 그 큐레이션 추출이 비었다는 건 "이번 window에 신호 없음"이지, 인덱스 나비링크를 제너릭
 * 스크레이프하라는 뜻이 아니다. 그래서 이런 소스는 제너릭 parseRss/parseHtmlPage 폴백을 막는다.
 */
function shouldSuppressGenericFallback(source) {
  return followedSourceResolverIds().includes(source && source.id);
}

module.exports = {
  FOLLOWED_SOURCE_RESOLVERS,
  followedSourceResolverIds,
  resolveFollowedSourceItems,
  shouldSuppressGenericFallback,
  sourceIdsRequiringFetchClient
};
