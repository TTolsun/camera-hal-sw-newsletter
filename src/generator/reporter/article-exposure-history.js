const { ensureArray } = require('../../shared/common/value-coercion');
const fs = require('fs');
const path = require('path');

const {
  articleIdentityKey,
  normalizeArticleUrl,
  sourceUrl
} = require('../../shared/common/article-identity');

const EXPOSURE_HISTORY_REL_PATH = path.join('state', 'article-exposure-history.json');
const SCHEMA_VERSION = 1;
// main 기사로 발행된 URL의 재게재 쿨다운(일). 이 모듈이 cooldown_until을 계산하고 판정하므로
// 값도 여기 한 곳에만 둔다 — 호출부가 각자 21을 적으면 사본이 늘고 조용히 어긋난다.
const NEWSLETTER_ARTICLE_COOLDOWN_DAYS = 21;

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
  const newslettersPath = path.join(root, 'articles', 'data', 'newsletters.json');
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
    record.cooldown_until = addDays(newsletterDate, Number(options.cooldownDays) || NEWSLETTER_ARTICLE_COOLDOWN_DAYS);
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

// editor section을 그대로 기록하면 identity가 붕괴한다. section의 출처는 sources 배열이라
// articleIdentityKey의 url: 경로에 걸리지 않고, contentHash가 보는 7개 필드(title/summary/...)도
// 전부 비어 join 결과가 상수가 된다 — 내용과 무관하게 모든 section이 같은 키를 낸다.
//
// 그래서 section을 축으로 두고 identity만 후보에서 가져온다. 후보는 이미 decorateCandidate가 붙인
// article_identity_key(url: 공간)를 갖고 있으므로, 발행 기록이 다음 주 후보와 같은 공간에 남는다.
// 후보를 못 찾으면 section의 소스 URL로 같은 url: 키를 직접 만든다.
//
// 축을 editor.sections로 두는 것은 의도한 선택이다. weekly merge가 section을 reject하면 발행되지
// 않은 기사가 기록될 수 있지만, 발행이 주 1회라 과기록의 실질 차이가 거의 없다. 반대로
// weeklyFinalArticles와 분기하면 기록 축이 둘로 갈라져 어느 쪽이 정본인지 알 수 없게 된다.
function newsletterArticleExposure(section, selectedArticles) {
  const url = text(section.source_candidate_url) || text(ensureArray(section.sources)[0]?.url);
  const key = normalizeArticleUrl(url);
  return ensureArray(selectedArticles).find(item => normalizeArticleUrl(sourceUrl(item)) === key) ||
    { canonical_url: url, title: text(section.headline) };
}

function recordNewsletterArticles(history, sections = [], options = {}) {
  let current = normalizeExposureHistory(history, options.date || todayDate());
  for (const section of ensureArray(sections)) {
    if (!section || typeof section !== 'object') continue;
    current = recordArticleExposure(current, newsletterArticleExposure(section, options.selectedArticles), {
      date: options.date,
      type: 'newsletter_article',
      newsletterUrl: options.newsletterUrl,
      cooldownDays: options.cooldownDays || NEWSLETTER_ARTICLE_COOLDOWN_DAYS
    });
  }
  return current;
}

function exposureMap(history = {}) {
  return new Map(ensureArray(history.articles)
    .map(item => [text(item.article_identity_key), item])
    .filter(([key]) => key));
}

// 한 레코드가 newsletter_article로 노출된 적이 있는지 판정하는 단일 술어.
// exposure_type(단수)은 "마지막" 노출 유형이다. 어떤 URL이 한 주에 main 기사로 나간 뒤 다음 주에
// 헤드라인으로 유지되면 그 값이 homepage_headline으로 덮인다. 누적 이력인 exposure_types까지 함께
// 봐야 쿨다운 검사(annotateArticleExposure)와 catch-up 필터(everCoveredAsNewsletterArticle)가
// 같은 질문에 같은 답을 한다 — 예전에는 앞의 것만 단수형을 봐서 헤드라인 유지 주에 조용히 죽었다.
function isNewsletterArticleRecord(record) {
  if (!record || typeof record !== 'object') return false;
  return text(record.exposure_type) === 'newsletter_article' ||
    ensureArray(record.exposure_types).includes('newsletter_article');
}

function annotateArticleExposure(article = {}, history = {}, options = {}) {
  const key = articleIdentityKey(article);
  const record = exposureMap(history).get(key) || null;
  // 쿨다운 비교 기준은 이슈 date다. 벽시계(todayDate)를 쓰면 같은 이력·같은 후보라도 리플레이나
  // carry 실행 시점에 따라 판정이 달라져 선정이 비결정적이 된다. date를 못 받는 호출부는 기존
  // 동작(오늘 기준)을 그대로 유지한다.
  const asOf = text(options.date) || todayDate();
  const publishedWithinCooldown = isNewsletterArticleRecord(record) &&
    Boolean(record.cooldown_until) &&
    asOf <= record.cooldown_until;
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
    text(item.article_identity_key) === key && isNewsletterArticleRecord(item)
  );
}

module.exports = {
  EXPOSURE_HISTORY_REL_PATH,
  NEWSLETTER_ARTICLE_COOLDOWN_DAYS,
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
