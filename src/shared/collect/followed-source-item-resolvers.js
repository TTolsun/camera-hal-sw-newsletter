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
    resolve: ({ text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts }) =>
      resolveDatedArticleIndexItems({
        html: text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts,
        config: { pathPrefix: '/blog', origin: 'https://claude.com', componentLabel: 'Claude Code / AI coding agent' }
      })
  },
  {
    id: 'anthropic-news',
    resolve: ({ text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts }) =>
      resolveDatedArticleIndexItems({
        html: text, source, fetchClient, now, lookbackDays, onDiagnostic, onArticleCapCounts,
        config: { pathPrefix: '/news', origin: 'https://www.anthropic.com', componentLabel: 'Anthropic product announcement' }
      })
  }
];

function followedSourceResolverIds() {
  return FOLLOWED_SOURCE_RESOLVERS.map(entry => entry.id);
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
  shouldSuppressGenericFallback
};
