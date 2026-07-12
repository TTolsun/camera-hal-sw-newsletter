(function initSiteHeader(global) {
  const GITHUB_URL = 'https://github.com/TTolsun/camera-hal-sw-newsletter';
  const BRAND_LABEL = 'Camera SW Newsletter';
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

  function siteHeaderHtml(options = {}) {
    const rootPath = normalizeRootPath(options.rootPath);
    const brandHref = `${rootPath}index.html`;
    const links = NAV_ITEMS
      .map(item => `<a href="${escapeHtml(siteHref(item, rootPath))}">${escapeHtml(item.label)}</a>`)
      .join('\n        ');
    return `<nav class="site-nav content-wrap homepage-nav" aria-label="Primary navigation">
      <a class="site-brand homepage-brand" href="${escapeHtml(brandHref)}" aria-label="${escapeHtml(BRAND_LABEL)}">
        <span>Camera SW</span>
        <span class="brand-subtitle">Newsletter</span>
      </a>
      <div class="nav-links homepage-nav-links">
        ${links}
      </div>
    </nav>`;
  }

  function mountSiteHeaders(root = global.document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    for (const target of root.querySelectorAll('[data-site-header]')) {
      target.innerHTML = siteHeaderHtml({
        rootPath: target.getAttribute('data-site-root') || ''
      });
    }
  }

  function normalizeComparablePath(path) {
    const withoutIndex = String(path || '').replace(/\/index\.html$/i, '/');
    const trimmed = withoutIndex.replace(/\/+$/, '');
    return trimmed || '/';
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
    initSamePageScrollToTop
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.SiteHeader = api;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', () => mountSiteHeaders());
    } else {
      mountSiteHeaders();
    }
    initSamePageScrollToTop();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
