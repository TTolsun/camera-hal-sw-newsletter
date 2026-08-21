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

  // coverage 필드 3개(coverage_week_key/coverage_start_date/coverage_end_date, optional, Task
  // 3·11이 채움)가 모두 유효할 때만 coverage 표시를 쓴다. cardKeyLabel과 weekRangeText가 이 판정을
  // 각자 따로 하면 하나만 채워진 경우(예: week_key만 있고 날짜가 없음) 라벨은 대상 주, range는
  // 발행 주를 가리키는 화면 불일치가 생긴다 — 한 함수로 모아 항상 같은 소스를 쓰게 한다. 라우팅용
  // weeklyKey(발행 identity)는 이 판정과 무관하게 그대로 둔다.
  function entryCoverageDisplay(entry) {
    const key = String(entry && entry.coverage_week_key || '').trim();
    const start = String(entry && entry.coverage_start_date || '').trim();
    const end = String(entry && entry.coverage_end_date || '').trim();
    const valid = WEEKLY_KEY_PATTERN.test(key) && DATE_PATTERN.test(start) && DATE_PATTERN.test(end);
    return valid ? { key, start, end } : null;
  }

  // Card date label prefers the coverage ISO week, then the published ISO week ("2026-W28" ->
  // "W28"), then a daily date. Falls back to empty (never the title, which the headline already
  // shows) so the meta line never duplicates it.
  function cardKeyLabel(entry) {
    const coverage = entryCoverageDisplay(entry);
    const key = coverage ? coverage.key : weeklyKeyOf(entry);
    if (key) return key.slice(5);
    return sortableDate(entry);
  }

  // Full "YYYY.MM.DD – MM.DD" range shown after the week label when week bounds are known.
  // coverage(대상 주)가 유효하면 그것으로 range를 만든다 — cardKeyLabel과 같은 판정을 쓴다.
  function weekRangeText(entry) {
    const coverage = entryCoverageDisplay(entry);
    const start = coverage ? coverage.start : String((entry && (entry.weekStartDate || entry.week_start_date)) || '').trim();
    const end = coverage ? coverage.end : String((entry && (entry.weekEndDate || entry.week_end_date)) || '').trim();
    if (DATE_PATTERN.test(start) && DATE_PATTERN.test(end)) {
      return `${start.replace(/-/g, '.')} – ${end.slice(5).replace('-', '.')}`;
    }
    return '';
  }

  // Card title without the trailing "(MM.DD ~ MM.DD)" range (shown in the meta line instead).
  function cardTitle(entry) {
    return String((entry && entry.title) || '').replace(/\s*\([^)]*\)\s*$/, '');
  }

  // The card leads with the issue's top article headline (first summary line), falling back to
  // the issue title. Splits on newline or the legacy " · " separator used by older entries.
  function cardHeadline(entry) {
    const [firstLine] = String((entry && entry.summary) || '')
      .split(/\n+|\s+·\s+/)
      .map(line => line.trim())
      .filter(Boolean);
    return firstLine || cardTitle(entry);
  }

  // Primary topic used as the card kicker; fallback issues surface their edition tag here.
  function cardKicker(entry) {
    const [first] = visibleTags(entry && entry.tags);
    return first || 'Camera HAL';
  }

  const FALLBACK_CARD_IMAGE = 'assets/images/fallback/newsletter-default.svg';

  // First real weekly article image, or the shared newsletter fallback when none is available.
  // Some legacy entries list a bundled fallback placeholder before a real https image, so we
  // prefer the first non-fallback source and only fall back to the placeholder when none exists.
  function cardImage(entry) {
    const images = ensureArray(entry && entry.article_images)
      .map(src => String(src ?? '').trim())
      .filter(Boolean);
    const firstReal = images.find(src => !src.startsWith('assets/images/fallback/'));
    return firstReal || images[0] || FALLBACK_CARD_IMAGE;
  }

  function cardMetaHtml(entry) {
    const range = weekRangeText(entry);
    const count = Number(entry && entry.article_count) || 0;
    const extras = [];
    if (range) extras.push(escapeHtml(range));
    if (count > 0) extras.push(`총 ${count}건`);
    const suffix = extras.length ? ` · ${extras.join(' · ')}` : '';
    return `<span class="issue-date">${escapeHtml(cardKeyLabel(entry))}</span>${suffix}`;
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

  // Image-forward card: 16:9 thumbnail, topic kicker, top-article headline, week meta line.
  function renderArchiveCard(entry, options = {}) {
    const href = getSafeNewsletterHref(entry);
    const accessibleName = `${entry && entry.date || ''} ${entry && entry.title || ''} ${options.ariaSuffix || '뉴스레터 열기'}`.trim();
    return `
      <a class="archive-card" href="${escapeHtml(href)}" aria-label="${escapeHtml(accessibleName)}">
        <div class="card-thumb nc-thumb">
          <img class="card-thumb-img" src="${escapeHtml(cardImage(entry))}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_CARD_IMAGE}'">
        </div>
        <div class="card-body">
          <div class="card-kicker">${escapeHtml(cardKicker(entry))}</div>
          <h3 class="card-title clamp-2 nc-h">${escapeHtml(cardHeadline(entry))}</h3>
          <div class="card-meta archive-card-meta">${cardMetaHtml(entry)}</div>
        </div>
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
