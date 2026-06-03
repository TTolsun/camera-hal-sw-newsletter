const fs = require('fs');
const path = require('path');

const {
  articleIdentityKey,
  sourceUrl
} = require('./article-identity');

const EXPOSURE_HISTORY_REL_PATH = path.join('data', 'article-exposure-history.json');
const SCHEMA_VERSION = 1;

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || '').trim();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function historyPath(root = process.cwd()) {
  return path.join(root, EXPOSURE_HISTORY_REL_PATH);
}

function emptyExposureHistory(date = todayDate()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    coverage: {
      mode: 'forward_only',
      coverage_starts_at: date,
      backfill_included: false
    },
    articles: []
  };
}

function normalizeExposureHistory(value, date = todayDate()) {
  const base = emptyExposureHistory(date);
  const history = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const coverage = history.coverage && typeof history.coverage === 'object'
    ? history.coverage
    : {};
  return {
    schemaVersion: Number(history.schemaVersion || history.schema_version || SCHEMA_VERSION),
    coverage: {
      mode: coverage.mode || 'forward_only',
      coverage_starts_at: coverage.coverage_starts_at || coverage.coverageStartsAt || date,
      backfill_included: coverage.backfill_included === true
    },
    articles: ensureArray(history.articles).filter(item => item && typeof item === 'object')
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readExposureHistory(root = process.cwd(), date = todayDate()) {
  const existing = readJsonIfExists(historyPath(root));
  if (existing) return normalizeExposureHistory(existing, date);
  return seedExposureHistoryFromNewsletters(root, date);
}

function writeExposureHistory(root = process.cwd(), history) {
  const filePath = historyPath(root);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  return filePath;
}

function exposureRecordFromNewsletter(item = {}) {
  if (!item || typeof item !== 'object') return null;
  const url = text(item.html || item.url);
  if (!url) return null;
  return {
    article_identity_key: articleIdentityKey({
      article_identity_key: item.article_identity_key,
      canonical_url: url,
      title: item.title,
      published_date: item.date
    }),
    title: text(item.title),
    source_url: text(item.source_url || item.sourceUrl || item.html),
    newsletter_date: text(item.date),
    newsletter_url: text(item.html),
    exposure_type: 'newsletter_index_seed',
    exposed_at: text(item.date),
    first_exposed_at: text(item.date),
    last_exposed_at: text(item.date),
    exposure_count: 1,
    exposure_types: ['newsletter_index_seed']
  };
}

function seedExposureHistoryFromNewsletters(root = process.cwd(), date = todayDate()) {
  const history = emptyExposureHistory(date);
  const newslettersPath = path.join(root, 'data', 'newsletters.json');
  const newsletters = readJsonIfExists(newslettersPath);
  if (!Array.isArray(newsletters) || newsletters.length === 0) return history;
  const latest = [...newsletters]
    .filter(item => item && text(item.date))
    .sort((a, b) => text(b.date).localeCompare(text(a.date)))
    .slice(0, 5);
  history.articles = latest.map(exposureRecordFromNewsletter).filter(Boolean);
  return history;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function recordArticleExposure(history, article = {}, options = {}) {
  const normalized = normalizeExposureHistory(history, options.date || todayDate());
  const key = articleIdentityKey(article);
  const existingIndex = normalized.articles.findIndex(item => item.article_identity_key === key);
  const exposureType = text(options.type || 'homepage_headline');
  const newsletterDate = text(options.date || article.newsletter_date);
  const record = {
    article_identity_key: key,
    title: text(article.title),
    source_url: sourceUrl(article),
    newsletter_date: newsletterDate,
    newsletter_url: text(options.newsletterUrl || article.newsletter_url),
    exposure_type: exposureType,
    headline_score: Number.isFinite(Number(options.score)) ? Number(options.score) : null,
    reuse_reason: text(options.reuseReason),
    exposed_at: text(options.exposedAt || options.date || article.selected_at || todayDate())
  };
  if (exposureType === 'newsletter_article' && newsletterDate) {
    record.cooldown_until = addDays(newsletterDate, Number(options.cooldownDays) || 21);
  }
  record.first_exposed_at = record.exposed_at;
  record.last_exposed_at = record.exposed_at;
  record.exposure_count = 1;
  record.exposure_types = [record.exposure_type].filter(Boolean);
  if (existingIndex >= 0) {
    const previous = normalized.articles[existingIndex];
    const previousCount = Number(previous.exposure_count);
    const exposureTypes = [
      ...ensureArray(previous.exposure_types),
      previous.exposure_type,
      record.exposure_type
    ].filter(Boolean);
    const sameExposureEvent = text(previous.last_exposed_at || previous.exposed_at) === record.exposed_at &&
      ensureArray(previous.exposure_types).concat(previous.exposure_type).includes(record.exposure_type);
    normalized.articles[existingIndex] = {
      ...previous,
      ...record,
      first_exposed_at: text(previous.first_exposed_at || previous.exposed_at || record.exposed_at),
      last_exposed_at: record.exposed_at,
      exposure_count: sameExposureEvent
        ? (Number.isFinite(previousCount) && previousCount > 0 ? previousCount : 1)
        : (Number.isFinite(previousCount) && previousCount > 0 ? previousCount + 1 : 2),
      exposure_types: [...new Set(exposureTypes)]
    };
  } else {
    normalized.articles.unshift(record);
  }
  return normalized;
}

function recordNewsletterArticles(history, sections = [], options = {}) {
  let current = normalizeExposureHistory(history, options.date || todayDate());
  for (const section of ensureArray(sections)) {
    if (!section || typeof section !== 'object') continue;
    current = recordArticleExposure(current, section, {
      date: options.date,
      type: 'newsletter_article',
      newsletterUrl: options.newsletterUrl,
      cooldownDays: options.cooldownDays || 21
    });
  }
  return current;
}

function exposureMap(history = {}) {
  return new Map(ensureArray(history.articles)
    .map(item => [text(item.article_identity_key), item])
    .filter(([key]) => key));
}

function annotateArticleExposure(article = {}, history = {}) {
  const key = articleIdentityKey(article);
  const record = exposureMap(history).get(key) || null;
  const today = todayDate();
  const publishedWithinCooldown = record?.exposure_type === 'newsletter_article' &&
    Boolean(record.cooldown_until) &&
    today <= record.cooldown_until;
  return {
    ...article,
    article_identity_key: key,
    already_exposed: Boolean(record),
    published_within_cooldown: publishedWithinCooldown,
    last_newsletter_date: publishedWithinCooldown ? text(record.newsletter_date) : null,
    exposure_history_record: record
  };
}

function dedupeByArticleIdentity(articles = []) {
  const out = [];
  const seen = new Set();
  for (const article of ensureArray(articles)) {
    const key = articleIdentityKey(article);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...article, article_identity_key: key });
  }
  return out;
}

function everCoveredAsNewsletterArticle(identityKey, history = {}) {
  const key = text(identityKey);
  if (!key) return false;
  return ensureArray(history.articles).some(item =>
    text(item.article_identity_key) === key &&
    (text(item.exposure_type) === 'newsletter_article' ||
      ensureArray(item.exposure_types).includes('newsletter_article'))
  );
}

module.exports = {
  EXPOSURE_HISTORY_REL_PATH,
  annotateArticleExposure,
  dedupeByArticleIdentity,
  everCoveredAsNewsletterArticle,
  emptyExposureHistory,
  historyPath,
  normalizeExposureHistory,
  readExposureHistory,
  recordArticleExposure,
  recordNewsletterArticles,
  seedExposureHistoryFromNewsletters,
  writeExposureHistory
};
