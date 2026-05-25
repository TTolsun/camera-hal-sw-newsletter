(function initNewsletterArchive(global) {
  const TOPICS = [
    { key: 'all', label: '전체', tag: '' },
    { key: 'camera-hal', label: 'Camera HAL', tag: 'Camera HAL' },
    { key: 'android', label: 'Android', tag: 'Android' },
    { key: 'driver', label: 'Driver', tag: 'Driver' },
    { key: 'image-processing', label: 'Image Processing', tag: 'Image Processing' },
    { key: 'ai', label: 'AI', tag: 'AI' },
    { key: 'soc-platform', label: 'SoC Platform', tag: 'SoC Platform' }
  ];
  const DEFAULT_STATE = { topic: 'all', sort: 'latest' };
  const MANAGED_QUERY_KEYS = ['topic', 'sort'];
  const TOPIC_KEYS = new Set(TOPICS.map(topic => topic.key));
  const SORT_KEYS = new Set(['latest', 'oldest']);
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function visibleTags(tags = []) {
    return ensureArray(tags)
      .map(tag => String(tag ?? '').trim())
      .filter(Boolean);
  }

  function sourceValue(source, key) {
    if (!source) return '';
    if (typeof URLSearchParams !== 'undefined' && source instanceof URLSearchParams) {
      return source.get(key) || '';
    }
    if (typeof source.get === 'function') {
      return source.get(key) || '';
    }
    return source[key] || '';
  }

  function normalizeTopicKey(value) {
    const key = String(value || '').trim();
    return TOPIC_KEYS.has(key) ? key : DEFAULT_STATE.topic;
  }

  function normalizeSortKey(value) {
    const key = String(value || '').trim();
    return SORT_KEYS.has(key) ? key : DEFAULT_STATE.sort;
  }

  function normalizeArchiveState(source = {}) {
    return {
      topic: normalizeTopicKey(sourceValue(source, 'topic')),
      sort: normalizeSortKey(sourceValue(source, 'sort'))
    };
  }

  function topicByKey(key) {
    return TOPICS.find(topic => topic.key === key) || TOPICS[0];
  }

  function sortableDate(entry) {
    const date = String(entry && entry.date || '').trim();
    return DATE_PATTERN.test(date) ? date : '';
  }

  function compareEntries(left, right, sort = DEFAULT_STATE.sort) {
    const normalizedSort = normalizeSortKey(sort);
    const leftDate = sortableDate(left);
    const rightDate = sortableDate(right);
    if (leftDate && rightDate) {
      return normalizedSort === 'oldest'
        ? leftDate.localeCompare(rightDate)
        : rightDate.localeCompare(leftDate);
    }
    if (leftDate) return -1;
    if (rightDate) return 1;
    return String(left && left.title || '').localeCompare(String(right && right.title || ''));
  }

  function sortEntries(entries, sort = DEFAULT_STATE.sort) {
    return ensureArray(entries).slice().sort((left, right) => compareEntries(left, right, sort));
  }

  function entryMatchesTopic(entry, topicKey) {
    const topic = topicByKey(topicKey);
    if (topic.key === DEFAULT_STATE.topic) return true;
    return visibleTags(entry && entry.tags).includes(topic.tag);
  }

  function filterEntries(entries, state = DEFAULT_STATE) {
    const normalized = normalizeArchiveState(state);
    return ensureArray(entries).filter(entry => entryMatchesTopic(entry, normalized.topic));
  }

  function latestEntry(entries) {
    return sortEntries(entries, 'latest')[0] || null;
  }

  function archivePreviewEntries(entries, state = DEFAULT_STATE, limit = 6) {
    const sortedEntries = sortEntries(entries, 'latest');
    const latest = sortedEntries[0] || null;
    const archiveEntries = latest ? sortedEntries.slice(1) : sortedEntries;
    const normalized = normalizeArchiveState(state);
    return sortEntries(filterEntries(archiveEntries, normalized), normalized.sort)
      .slice(0, Math.max(0, Number(limit) || 0));
  }

  function buildCanonicalArchiveUrl(location, state = DEFAULT_STATE) {
    const normalized = normalizeArchiveState(state);
    const pathname = String(location && location.pathname || 'archive.html');
    const hash = String(location && location.hash || '');
    const search = String(location && location.search || '').replace(/^\?/, '');
    const params = new URLSearchParams(search);
    for (const key of MANAGED_QUERY_KEYS) {
      params.delete(key);
    }
    if (normalized.topic !== DEFAULT_STATE.topic) {
      params.set('topic', normalized.topic);
    }
    if (normalized.sort !== DEFAULT_STATE.sort) {
      params.set('sort', normalized.sort);
    }
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ''}${hash}`;
  }

  function fallbackNewsletterHref(entry) {
    const date = sortableDate(entry);
    return date ? `newsletters/${date}/index.html` : '';
  }

  function getSafeNewsletterHref(entry) {
    const raw = String(entry && entry.html || '').trim();
    const date = sortableDate(entry);
    const fallback = fallbackNewsletterHref(entry);
    if (!raw || !date) return fallback;
    const allowed = new RegExp(`^newsletters/${date}/(?:index\\.html)?$`);
    if (allowed.test(raw)) return raw;
    return fallback;
  }

  function renderArchiveTags(tags = []) {
    const normalizedTags = visibleTags(tags);
    if (normalizedTags.length === 0) return '';

    const visibleArchiveTags = normalizedTags.slice(0, 3);
    const hiddenArchiveTags = normalizedTags.slice(3);
    const hiddenTagNames = hiddenArchiveTags.join(', ');
    const hiddenTagChip = hiddenArchiveTags.length > 0
      ? `<span class="tag tag-more" aria-label="${escapeHtml(`추가 태그 ${hiddenArchiveTags.length}개: ${hiddenTagNames}`)}" title="${escapeHtml(hiddenTagNames)}">+${hiddenArchiveTags.length}</span>`
      : '';

    return `<div class="tag-row archive-tags">${
      visibleArchiveTags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
    }${hiddenTagChip}</div>`;
  }

  function renderArchiveCard(entry, options = {}) {
    const href = getSafeNewsletterHref(entry);
    const accessibleName = `${entry && entry.date || ''} ${entry && entry.title || ''} ${options.ariaSuffix || '뉴스레터 열기'}`.trim();
    const summaryClass = options.summaryClass || 'archive-card-summary';
    const tagHtml = renderArchiveTags(entry && entry.tags);
    return `
      <a class="archive-card" href="${escapeHtml(href)}" aria-label="${escapeHtml(accessibleName)}">
        <div class="card-meta archive-card-meta">
          <span class="issue-date">${escapeHtml(entry && entry.date)}</span>
        </div>
        ${tagHtml}
        <h3 class="card-title clamp-2">${escapeHtml(entry && entry.title)}</h3>
        <p class="card-summary ${escapeHtml(summaryClass)} clamp-3">${escapeHtml(entry && entry.summary)}</p>
        <span class="card-bookmark" aria-hidden="true"></span>
      </a>
    `;
  }

  const api = {
    TOPICS,
    DEFAULT_STATE,
    MANAGED_QUERY_KEYS,
    normalizeArchiveState,
    buildCanonicalArchiveUrl,
    sortEntries,
    filterEntries,
    latestEntry,
    archivePreviewEntries,
    getSafeNewsletterHref,
    renderArchiveCard
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.NewsletterArchive = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
