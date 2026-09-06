// 구독 CTA 활성화 스크립트(#671).
//
// 홈(index.html)의 인라인 로더와 **같은 판정**을 쓴다: config/subscription.json 이
// enabled=true 이고 provider/mode 가 hosted_link 이며 subscribeUrl 이 실제 https 주소일 때만
// CTA 를 켠다. 홈과 다른 점은 페이지 깊이뿐이라 설정 경로를 마크업에서 받는다 — 아카이브는
// 'config/subscription.json', 이슈 페이지는 '../../config/subscription.json' 이다.
//
// 꺼져 있으면 **아무것도 하지 않는다**. 섹션은 hidden 인 채로, 푸터는 "구독 (지원예정)" 노트인
// 채로 남는다. 이 침묵이 계약이다: 설정이 꺼진 committed 기본값에서 이 스크립트가 페이지의
// 보이는 결과를 바꾸면 안 되고, 빈 href 앵커(죽은 링크)도 만들면 안 된다.
//
// 홈은 이 파일을 로드하지 않는다. 홈에는 같은 hook 을 다루는 인라인 로더가 이미 있어서 둘이
// 함께 돌면 같은 섹션을 두 번 건드린다. 홈의 섹션은 꺼져 있어도 "지원예정" 상태로 보이는데,
// 그것은 홈이 구독을 알리는 자리라서 내린 결정이고 여기의 침묵과 서로 다른 계약이다.
(function initSubscriptionCta(global) {
  const CONFIG_ATTRIBUTE = 'data-subscription-config';
  const DEFAULT_CONFIG_PATH = 'config/subscription.json';
  const SUBSCRIBE_ARIA_LABEL = 'Subscribe to Camera SW Newsletter';
  // 저장소 상대 경로만 받는다. 배포본에서 이 파일이 놓이는 깊이는 사이트 루트와 이슈 페이지
  // 두 가지뿐이라 '../' 반복 + 고정 파일명으로 충분하다.
  const CONFIG_PATH_PATTERN = /^(?:\.\.\/)*config\/subscription\.json$/;

  function isLocalOrDevSubscribeHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) return true;
    if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
    if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    return host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.test');
  }

  function hostedSubscribeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || /[<>]/.test(raw) || /placeholder|todo|actual beehiiv/i.test(raw)) return '';
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:') return '';
      if (isLocalOrDevSubscribeHost(url.hostname)) return '';
      if (/^(example\.com|example\.org|example\.net)$/i.test(url.hostname)) return '';
      return url.href;
    } catch (_error) {
      return '';
    }
  }

  function getValidSubscriptionUrl(config) {
    if (!config || typeof config !== 'object') return '';
    if (config.enabled !== true) return '';
    if (config.provider !== 'beehiiv' || config.mode !== 'hosted_link') return '';
    return hostedSubscribeUrl(config.subscribeUrl);
  }

  // 절대 경로('/config/...')나 scheme 이 붙은 값('https:', 'javascript:')은 배포본 밖을
  // 가리키므로 버린다. 버리면 fetch 자체를 하지 않아 CTA 는 꺼진 상태로 남는다.
  function safeConfigPath(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return DEFAULT_CONFIG_PATH;
    return CONFIG_PATH_PATTERN.test(raw) ? raw : '';
  }

  async function fetchSubscriptionConfig(configPath, fetchImpl) {
    const response = await fetchImpl(configPath, { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  }

  // 푸터는 노트와 링크를 둘 다 마크업에 두고 hidden 으로 가른다. 노트를 링크로 바꿔치기하지
  // 않는 이유는 committed 기본값(꺼짐)에서 푸터 마크업이 지금과 같아야 하기 때문이다.
  function revealFooterLink(note, link, href) {
    link.setAttribute('href', href);
    link.hidden = false;
    note.hidden = true;
  }

  async function applySubscriptionCta(doc, fetchImpl) {
    const section = doc.querySelector('[data-subscription-section]');
    const action = doc.querySelector('[data-subscription-action]');
    if (!section || !action) return false;

    const configPath = safeConfigPath(section.getAttribute(CONFIG_ATTRIBUTE));
    if (!configPath) return false;

    let href = '';
    try {
      href = getValidSubscriptionUrl(await fetchSubscriptionConfig(configPath, fetchImpl));
    } catch (error) {
      console.error(error);
      return false;
    }
    if (!href) return false;

    action.setAttribute('href', href);
    action.setAttribute('aria-label', SUBSCRIBE_ARIA_LABEL);
    section.hidden = false;

    const note = doc.querySelector('[data-subscription-footer-note]');
    const link = doc.querySelector('[data-subscription-footer-action]');
    if (note && link) revealFooterLink(note, link, href);
    return true;
  }

  const api = {
    CONFIG_ATTRIBUTE,
    DEFAULT_CONFIG_PATH,
    SUBSCRIBE_ARIA_LABEL,
    hostedSubscribeUrl,
    getValidSubscriptionUrl,
    safeConfigPath,
    applySubscriptionCta
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.SubscriptionCta = api;

  if (typeof document !== 'undefined' && typeof global.fetch === 'function') {
    applySubscriptionCta(document, global.fetch.bind(global));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
