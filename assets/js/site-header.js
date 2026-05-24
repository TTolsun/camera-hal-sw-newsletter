(function initSiteHeader(global) {
  const GITHUB_URL = 'https://github.com/TTolsun/camera-hal-sw-newsletter';
  const BRAND_LABEL = 'Camera HAL / SW Newsletter';
  const NAV_ITEMS = [
    { label: 'Latest', path: 'index.html#latest' },
    { label: 'Archive', path: 'index.html#archive' },
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
    return `<nav class="site-nav content-wrap" aria-label="Primary navigation">
      <a class="site-brand" href="${escapeHtml(brandHref)}" aria-label="${escapeHtml(BRAND_LABEL)}">
        <span>Camera HAL </span><span class="brand-separator" aria-hidden="true"></span><span>SW Newsletter</span>
      </a>
      <div class="nav-links">
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

  const api = {
    BRAND_LABEL,
    NAV_ITEMS,
    siteHeaderHtml,
    mountSiteHeaders
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
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
