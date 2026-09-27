(function initSiteHeader(global) {
  const GITHUB_URL = 'https://github.com/TTolsun/camera-hal-sw-newsletter';
  // 워드마크는 두 조각으로 나뉘어 보이지만(`brand-name` + `brand-subtitle`) aria-label 은 한 줄
  // 문자열이다. 두 자리를 각각 리터럴로 적으면 접근성 이름과 눈에 보이는 이름이 조용히 갈릴 수
  // 있으므로 같은 조각에서 만든다.
  const BRAND_NAME = 'Camera SW';
  const BRAND_SUBTITLE = 'Newsroom';
  const BRAND_LABEL = `${BRAND_NAME} ${BRAND_SUBTITLE}`;
  const BRAND_LOGO_PATH = 'assets/images/brand/HALley-logo.png';
  const NAV_ITEMS = [
    { label: '홈', path: 'index.html' },
    { label: '아카이브', path: 'archive.html' },
    { label: 'GitHub', href: GITHUB_URL }
  ];

  function normalizeRootPath(rootPath) {
    const raw = String(rootPath || '').trim();
    if (!raw || raw === '.' || raw === './') return '';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function siteHref(item, rootPath) {
    if (item.href) return item.href;
    return `${normalizeRootPath(rootPath)}${item.path}`;
  }

  // 헤더의 정본은 이슈 페이지 렌더러(`src/generator/render/newsletter-renderer.js` 의
  // homepageHeaderHtml)다 — 홈·아카이브·Lab 의 정적 헤더도 같은 마크업이고, 공용 헬퍼
  // `src/shared/test/helpers/site-nav.js` 가 그 네 표면의 **나브를** 한 벌로 잠근다(브랜드는
  // 렌더 산출물과 커밋된 이슈 페이지에서 잠긴다). 이 컴포넌트도 같은 것을 낸다. 두 출력이
  // 같은지는 `newsletter-renderer.test.js` 가 직접 대조하므로, 정본이 바뀌면 여기도 함께
  // 바꿔야 초록이 된다.
  function siteHeaderHtml(options = {}) {
    const rootPath = normalizeRootPath(options.rootPath);
    const locale = options.locale || 'ko';
    const navPath = `${rootPath}${locale === 'en' ? 'en/' : ''}`;
    const brandHref = `${navPath}index.html`;
    const brandLogoSrc = `${rootPath}${BRAND_LOGO_PATH}`;
    const links = NAV_ITEMS
      .map((item, index) => `<a href="${escapeHtml(siteHref(item, navPath))}">${escapeHtml(locale === 'en' ? ['Home', 'Archive', 'GitHub'][index] : item.label)}</a>`)
      .join('\n        ');
    return `<header class="site-header homepage-site-header">
    <div class="homepage-nav content-wrap">
      <a class="site-brand homepage-brand" href="${escapeHtml(brandHref)}" aria-label="${escapeHtml(BRAND_LABEL)}">
        <img class="brand-logo" src="${escapeHtml(brandLogoSrc)}" alt="" width="30" height="30">
        <span class="brand-name">${escapeHtml(BRAND_NAME)} <span class="brand-subtitle">${escapeHtml(BRAND_SUBTITLE)}</span></span>
      </a>
      <div class="nav-links homepage-nav-links" aria-label="Primary navigation">
        ${links}
      </div>
    </div>
  </header>`;
  }

  // placeholder 는 그 자체가 `<header class="site-header" data-site-header>` 다 — `styles.css` 의
  // `.site-header[data-site-header]:empty { min-height: 61px }` 가 JS 전에 그 자리를 잡아 두고,
  // #1020 이 걷어낸 로드 검사도 `<header ... data-site-header>` 를 찾았다. siteHeaderHtml() 이
  // `<header>` 셸을 자기가 만드므로 host 의 **안을 채우면** `<header>` 안에 `<header>` 가 되어
  // 콘텐츠 모델 위반이고 sticky·border-bottom·backdrop-filter 가 두 겹으로 걸린다. 그래서 host
  // 를 통째로 대체한다. rootPath 는 대체 전에 읽는다.
  function mountSiteHeaders(root = global.document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    for (const target of root.querySelectorAll('[data-site-header]')) {
      const rootPath = target.getAttribute('data-site-root') || '';
      target.outerHTML = siteHeaderHtml({ rootPath, locale: root.documentElement?.lang || 'ko' });
    }
  }

  function normalizeComparablePath(path) {
    const withoutIndex = String(path || '').replace(/\/index\.html$/i, '/');
    const trimmed = withoutIndex.replace(/\/+$/, '');
    return trimmed || '/';
  }

  function languagePaths({ pathname, basePath = '/', alternateHref = '' }) {
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const relative = pathname.startsWith(base) ? pathname.slice(base.length) : '';
    const english = relative.startsWith('en/');
    const page = english ? relative.slice(3) : relative;
    // 주간호는 모두 영문판이 있다(과거 호는 수동 번역, 이후 호는 data-alternate-href). 날짜 호는 없다.
    const supported = ['', 'index.html', 'archive.html'].includes(page) || /^newsletters\/\d{4}-W\d{2}\/index\.html$/.test(page);
    const alternate = alternateHref.startsWith(base) && !alternateHref.startsWith('//') ? alternateHref : '';
    return {
      ko: english ? (alternate || `${base}${page}`) : pathname,
      en: english ? pathname : (alternate || `${base}en/${supported ? page : 'archive.html'}`)
    };
  }

  function mountLanguageSelectors(doc = global.document) {
    if (!doc || !doc.documentElement || typeof doc.querySelector !== 'function') return;
    const script = doc.querySelector('script[src$="assets/js/site-header.js"]');
    if (!script) return;
    const basePath = new URL('../../', script.src).pathname;
    const locale = doc.documentElement.lang === 'en' ? 'en' : 'ko';
    const paths = languagePaths({ pathname: global.location.pathname, basePath, alternateHref: doc.documentElement.getAttribute('data-alternate-href') || '' });
    for (const nav of doc.querySelectorAll('.homepage-nav-links')) {
      if (nav.querySelector('.language-selector')) continue;
      const container = doc.createElement('div');
      container.className = 'language-selector';
      container.innerHTML = `<button type="button" class="language-button" aria-expanded="false" aria-label="${locale === 'en' ? 'Choose language' : '언어 선택'}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><span>${locale === 'en' ? 'English' : '한국어'}</span><span aria-hidden="true">▾</span></button><ul class="language-options" hidden><li><a lang="ko" hreflang="ko" href="${escapeHtml(paths.ko)}"${locale === 'ko' ? ' aria-current="true"' : ''}>한국어</a></li><li><a lang="en" hreflang="en" href="${escapeHtml(paths.en)}"${locale === 'en' ? ' aria-current="true"' : ''}>English</a></li></ul>`;
      nav.appendChild(container);
      const button = container.querySelector('button');
      const list = container.querySelector('ul');
      const close = () => { list.hidden = true; button.setAttribute('aria-expanded', 'false'); };
      button.addEventListener('click', () => {
        list.hidden = !list.hidden;
        button.setAttribute('aria-expanded', String(!list.hidden));
      });
      button.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        list.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        list.querySelector('a').focus();
      });
      container.addEventListener('keydown', event => {
        if (event.key === 'Escape') { close(); button.focus(); }
      });
      container.addEventListener('focusout', event => { if (!container.contains(event.relatedTarget)) close(); });
      doc.addEventListener('click', event => { if (!container.contains(event.target)) close(); });
    }
  }

  // 이미 보고 있는 페이지를 가리키는 내부 링크(홈에서 "홈"/로고, 아카이브에서 "아카이브")를 누르면
  // 리로드 대신 맨 위로 부드럽게 스크롤한다 — handoff SPA 의 스크롤-업 느낌. 다른 페이지로 가는
  // 링크는 그대로 두어 페이지 전환(cross-document View Transition)이 작동한다.
  function initSamePageScrollToTop(doc = global.document) {
    if (!doc || typeof doc.addEventListener !== 'function') return;
    doc.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target && typeof event.target.closest === 'function' ? event.target.closest('a[href]') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      let url;
      try {
        url = new URL(anchor.href, global.location.href);
      } catch (error) {
        return;
      }
      if (url.origin !== global.location.origin) return;
      const samePage = normalizeComparablePath(url.pathname) === normalizeComparablePath(global.location.pathname) &&
        url.search === global.location.search;
      if (!samePage) return;
      event.preventDefault();
      const reduce = typeof global.matchMedia === 'function' && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      global.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  const api = {
    BRAND_LABEL,
    NAV_ITEMS,
    siteHeaderHtml,
    mountSiteHeaders,
    languagePaths,
    mountLanguageSelectors,
    initSamePageScrollToTop
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.SiteHeader = api;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', () => { mountSiteHeaders(); mountLanguageSelectors(); });
    } else {
      mountSiteHeaders();
      mountLanguageSelectors();
    }
    initSamePageScrollToTop();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
