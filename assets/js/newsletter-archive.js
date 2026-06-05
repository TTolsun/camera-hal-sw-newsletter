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
  const DEFAULT_STATE = { topic: 'all', sort: 'latest', page: 1 };
  const MANAGED_QUERY_KEYS = ['topic', 'sort', 'page'];
  const TOPIC_KEYS = new Set(TOPICS.map(topic => topic.key));
  const SORT_KEYS = new Set(['latest', 'oldest']);
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  const WEEKLY_KEY_PATTERN = /^\d{4}-W\d{2}$/;

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

  function normalizePageNumber(value) {
    const page = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(page) && page > 0 ? page : DEFAULT_STATE.page;
  }

  function normalizeArchiveState(source = {}) {
    return {
      topic: normalizeTopicKey(sourceValue(source, 'topic')),
      sort: normalizeSortKey(sourceValue(source, 'sort')),
      page: normalizePageNumber(sourceValue(source, 'page'))
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
    if (normalized.page !== DEFAULT_STATE.page) {
      params.set('page', String(normalized.page));
    }
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ''}${hash}`;
  }

  function weeklyKeyOf(entry) {
    const key = String(entry && entry.weeklyKey || '').trim();
    return WEEKLY_KEY_PATTERN.test(key) ? key : '';
  }

  // Card date chip shows the week's date range ("06.01~06.07"); falls back to the ISO week
  // ("2026-W23" -> "W23") and then the raw date when range bounds are unavailable.
  function weekLabel(entry) {
    const md = value => String(value).slice(5).replace('-', '.');
    const start = String((entry && (entry.weekStartDate || entry.week_start_date)) || '').trim();
    const end = String((entry && (entry.weekEndDate || entry.week_end_date)) || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return `${md(start)}~${md(end)}`;
    }
    const key = weeklyKeyOf(entry);
    return key ? key.slice(5) : String((entry && entry.date) || '');
  }

  // Card title without the trailing "(MM.DD ~ MM.DD)" range (shown in the date chip instead).
  function cardTitle(entry) {
    return String((entry && entry.title) || '').replace(/\s*\([^)]*\)\s*$/, '');
  }

  // Render the weekly card summary (this week's article titles) one per line so each title stays
  // distinguishable. Splits on newline or the legacy " · " separator for older index entries.
  function cardSummaryHtml(entry) {
    return String((entry && entry.summary) || '')
      .split(/\n+|\s+·\s+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(escapeHtml)
      .join('<br>');
  }

  function fallbackNewsletterHref(entry) {
    const weeklyKey = weeklyKeyOf(entry);
    if (weeklyKey) return `newsletters/${weeklyKey}/index.html`;
    const date = sortableDate(entry);
    return date ? `newsletters/${date}/index.html` : '';
  }

  function getSafeNewsletterHref(entry) {
    const raw = String(entry && entry.html || '').trim();
    const fallback = fallbackNewsletterHref(entry);
    const weeklyKey = weeklyKeyOf(entry);
    if (weeklyKey) {
      const allowedWeekly = new RegExp(`^newsletters/${weeklyKey}/(?:index\\.html)?$`);
      return raw && allowedWeekly.test(raw) ? raw : fallback;
    }
    const date = sortableDate(entry);
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
          <span class="issue-date">${escapeHtml(weekLabel(entry))}</span>
        </div>
        ${tagHtml}
        <h3 class="card-title clamp-2">${escapeHtml(cardTitle(entry))}</h3>
        <p class="card-summary ${escapeHtml(summaryClass)}">${cardSummaryHtml(entry)}</p>
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
