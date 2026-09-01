const { ensureArray } = require('../../shared/common/value-coercion');
const fs = require('fs');
const path = require('path');

const {
  articleIdentityKey,
  normalizeArticleUrl,
  sourceUrl
} = require('../../shared/common/article-identity');
// 선정단 dedup(candidatesAreDuplicate)·대표 선택·fallbackGroupKey가 이미 쓰는 시리즈 키 정본과,
// 수집 단계의 재제출 병합(collapseSeriesRerolls)이 쓰는 제목 축. 재게재 게이트가 같은 함수를 써야
// "같은 패치 시리즈인가"라는 질문에 파이프라인 전체가 한 답을 낸다.
const { seriesKey, seriesSubjectKey } = require('../../shared/common/article-groups');

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

// 시리즈 키와 subject 키는 수집 시점 후보에서 유도되는 값이고, 기사의 정체성은 나중 노출로 바뀌지
// 않는다. 반면 갱신 입력은 후보가 아닐 수 있다 — 홈페이지 헤드라인 갱신은 렌더된 한국어 헤드라인을
// 실어 오므로 거기서 유도한 키는 틀린 값이다. 그래서 갱신 때 이미 남아 있는 값을 지킨다.
// 두 키가 같은 성질(후보에서 한 번 정해지면 불변)이라 규칙도 하나로 둔다.
const CANDIDATE_DERIVED_SERIES_FIELDS = ['series_identity_key', 'series_subject_key'];

function preservedSeriesKeys(previous, record) {
  const kept = {};
  for (const field of CANDIDATE_DERIVED_SERIES_FIELDS) {
    const value = text(previous?.[field]) || text(record?.[field]);
    if (value) kept[field] = value;
  }
  return kept;
}

function recordArticleExposure(history, article = {}, options = {}) {
  const normalized = normalizeExposureHistory(history, options.date || todayDate());
  const key = articleIdentityKey(article);
  const existingIndex = normalized.articles.findIndex(item => item.article_identity_key === key);
  const exposureType = text(options.type || 'homepage_headline');
  const newsletterDate = text(options.date || article.newsletter_date);
  // URL identity 옆에 시리즈 키와 재제출 subject 키를 병기한다. identity 자체를 시리즈 인지형으로
  // 바꾸지 않는 이유는 이미 쌓인 기록의 키가 전부 달라져 조회가 통째로 깨지기 때문이다.
  //
  // subject 키를 저장하는 이유: 읽기 시점에 record.title에서 유도하면 안 된다. title은 표시용 값이라
  // 발행 단계의 홈페이지 헤드라인 갱신(persistHomepageHeadlineArtifacts)이 렌더된 한국어 헤드라인으로
  // 덮어쓴다 — 그러면 매 호의 헤드라인 기사 1건만 subject 키가 붕괴해 재제출 축이 조용히 죽는다
  // (실제 state의 IMX908 레코드가 그 상태였다).
  //
  // 시리즈가 아니면 두 필드를 아예 넣지 않는다. 읽기 시점이 "필드 없음"과 "빈 값"을 똑같이 다루므로
  // 판정은 같고, 대부분을 차지하는 비시리즈 기록에 의미 없는 빈 필드가 붙는 것만 막는다.
  const seriesIdentityKey = seriesKey(article);
  const record = {
    article_identity_key: key,
    ...(seriesIdentityKey ? {
      series_identity_key: seriesIdentityKey,
      series_subject_key: seriesSubjectKey(article)
    } : {}),
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
    // newsletter_date는 "마지막 노출 주"다. 같은 URL이 다음 주에도 헤드라인으로 유지되면 그때의
    // homepage_headline 기록이 spread로 그 값을 덮는다(cooldown_until은 이 분기에서만 쓰이므로
    // 살아남는다). 그래서 main 기사로 발행된 주를 따로 남긴다 — 쿨다운의 시작일이자, 재게재
    // 경고가 "언제 발행됐는지"로 인용해야 하는 값이다.
    record.newsletter_article_date = newsletterDate;
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
      ...preservedSeriesKeys(previous, record),
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
//
// 후보 대조는 articleIdentityKey로 한다. sourceUrl은 normalized_url을 url보다 먼저 보는데 그 값은
// selection normalizer 산물이라 URL 전체가 소문자이고 쿼리가 없다 — section이 들고 있는 raw 후보
// URL과 정규화 규칙이 달라, 대문자나 쿼리(예: developer.android.com의 ?hl=)가 있으면 조용히
// 빗나간다. 후보의 article_identity_key는 raw URL에서 만들어지므로 같은 규칙끼리 맞는다.
function newsletterArticleExposure(section, selectedArticles) {
  const url = text(section.source_candidate_url) || text(ensureArray(section.sources)[0]?.url);
  const fallback = { canonical_url: url, title: text(section.headline) };
  const key = normalizeArticleUrl(url);
  // 키가 비면 대조하지 않는다. 빈 키끼리 맞아떨어지면 발행되지 않은 URL에 쿨다운이 찍힌다.
  if (!key) return fallback;
  return ensureArray(selectedArticles).find(item => articleIdentityKey(item) === `url:${key}`) || fallback;
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

// 한 레코드의 시리즈 키. 저장된 값이 없으면 source_url에서 유도한다.
//
// 시리즈 키가 필요한 이유: 수집 단계는 한 패치 시리즈를 대표 1건으로 줄이는데, 그 대표 URL이
// 주마다 바뀐다(#799 (source, seriesId) collapse, #822 커버레터 우선). 지난주 08/12 조각으로
// 발행한 시리즈가 이번 주에 커버레터 URL로 들어오면 URL identity는 다른 값이라, URL만 보는
// 게이트는 같은 시리즈를 못 알아보고 그대로 통과시킨다.
//
// 폴백이 필요한 이유: state 파일을 마이그레이션하지 않으므로 이미 쌓인 기록에는 이 필드가 없다.
// lore는 message-id가 URL 안에 있어(loreMessageIdFromUrl) URL만으로 소급 적용되지만, patchwork는
// 시리즈 식별자가 수집기에서 오므로 URL만으로는 만들 수 없다 — 그래서 쓰기 시점 저장과 읽기 시점
// 폴백 두 갈래가 다 필요하다.
function recordSeriesIdentityKey(record) {
  return text(record?.series_identity_key) || seriesKey({ url: text(record?.source_url) });
}

// 재제출 축의 소스 스코프. 수집 단계의 재제출 병합은 `${source_id}::${subject}`로 한 소스 안에서만
// 병합하는데(collapseSeriesRerolls), 노출 기록에는 source_id가 없다. 기록과 후보 양쪽에서 똑같이
// 얻을 수 있는 URL 호스트로 대신한다 — 실측(35주치 시리즈 후보 257건)에서 source_id와 호스트는
// 1:1이었다(lore-linux-media-list <-> lore.kernel.org, patchwork-libcamera-patches <->
// patchwork.libcamera.org). 스코프를 빼면 서로 다른 소스의 같은 제목이 맞아떨어진다.
function sourceScope(url) {
  try {
    return new URL(text(url)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// 재제출(v2 -> v3)은 lore message-id도 patchwork series id도 새로 발급받으므로 시리즈 키가 달라진다.
// 수집 단계는 그래서 브래킷 접두부를 뗀 제목으로 재제출을 병합해 대표를 최신 버전으로 갈아 끼운다
// (#824). 게이트가 그 축을 모르면 지난주 v3로 발행한 시리즈가 이번 주 v4 대표로 그대로 통과한다 —
// #1036이 든 실제 사례(Lenovo Yoga Book YB1-X91)가 정확히 이것이다.
//
// collapse와 같은 제약을 그대로 건다: 시리즈일 때만, 그리고 소스 스코프 안에서만. 그래야 오차단
// 표면이 collapse보다 넓어지지 않는다.
function rerollIdentityKey(seriesIdentityKey, url, subject) {
  if (!seriesIdentityKey) return '';
  const scope = sourceScope(url);
  if (!scope || !subject) return '';
  return `${scope}::${subject}`;
}

// 레코드의 재제출 subject 키. 저장된 값을 먼저 쓰고, 없을 때만 title에서 유도한다.
// title 폴백은 기존 기록(이 필드가 없는 31건) 하위호환용이다 — 그 기록의 title이 헤드라인 갱신으로
// 덮인 상태면 이 축이 안 걸리지만, 저장값이 생기는 다음 발행부터는 정확해진다.
function recordSeriesSubjectKey(record) {
  return text(record?.series_subject_key) || seriesSubjectKey({ title: record?.title });
}

// 후보를 게이트가 대조하는 세 축(URL identity · 시리즈 · 재제출)으로 환원한다.
function articleMatchKeys(article = {}) {
  const series = seriesKey(article);
  return {
    identity: articleIdentityKey(article),
    series,
    reroll: rerollIdentityKey(series, sourceUrl(article), seriesSubjectKey(article))
  };
}

// 이 레코드가 후보와 같은 기사인가. URL identity가 같거나, 같은 패치 시리즈거나, 같은 시리즈의
// 재제출이면 같은 기사로 본다. 쿨다운 검사와 catch-up 필터가 이 한 술어를 함께 쓴다 — 같은 규칙을
// 두 곳에 따로 적으면 한쪽만 고쳐지는 것이 #963에서 실제로 일어난 일이다.
//
// 시리즈·재제출 키가 없는 후보(대부분의 소스)는 빈 문자열이다. 빈 키끼리 맞아떨어지면 발행된 기사
// 1건이 그 주 비시리즈 후보 전부를 막아 편성이 통째로 비게 된다 — 값이 있을 때만 대조한다.
function recordMatchesArticle(record, keys) {
  if (text(record?.article_identity_key) === keys.identity) return true;
  const series = recordSeriesIdentityKey(record);
  if (keys.series && series === keys.series) return true;
  if (!keys.reroll) return false;
  return rerollIdentityKey(series, record?.source_url, recordSeriesSubjectKey(record)) === keys.reroll;
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

// 이력이 들고 있는 main 기사 발행 기록의 수. 재게재 게이트가 실제로 볼 데이터가 몇 건인지를
// 산출물에 남기는 값이라, 레코드 술어를 가진 이 모듈이 함께 센다. 호출부가 각자 exposure_type과
// exposure_types를 다시 보면 술어 사본이 늘고 한쪽만 고쳐진다.
function newsletterArticleRecordCount(history) {
  return ensureArray(history?.articles).filter(isNewsletterArticleRecord).length;
}

// 이 레코드가 지금 생성 중인 호(asOf) 자신의 발행 기록인가.
// 워크플로 03은 ref: main을 체크아웃하므로 이미 발행된 날짜로 다시 돌리면 state에 그 호 자신의
// 레코드가 들어 있다. 그걸 남의 이력으로 세면 재실행이 자기 편성을 통째로 갈아치운다.
// 쿨다운 검사와 catch-up 이력 필터가 같은 한 줄을 쓴다 — 두 곳에 같은 규칙을 따로 적으면 한쪽만
// 고쳐지는 것이 #963에서 실제로 일어난 일이다. asOf가 비면(호출부가 date를 안 주면) 아무것도
// 자기 것으로 보지 않아 기존 동작이 그대로 남는다.
function isSameIssueRecord(record, asOf) {
  const date = text(asOf);
  return Boolean(date) && text(record?.newsletter_article_date) === date;
}

// 이 레코드가 지금(asOf) 재게재를 막고 있는가.
function blocksRepublication(record, asOf) {
  return isNewsletterArticleRecord(record) &&
    Boolean(record.cooldown_until) &&
    asOf <= record.cooldown_until &&
    !isSameIssueRecord(record, asOf);
}

function annotateArticleExposure(article = {}, history = {}, options = {}) {
  const keys = articleMatchKeys(article);
  // 쿨다운 비교 기준은 이슈 date다. 벽시계(todayDate)를 쓰면 같은 이력·같은 후보라도 리플레이나
  // carry 실행 시점에 따라 판정이 달라져 선정이 비결정적이 된다. date를 못 받는 호출부는 기존
  // 동작(오늘 기준)을 그대로 유지한다.
  const asOf = text(options.date) || todayDate();
  // 일치 레코드는 여러 건일 수 있다 — 같은 시리즈가 여러 주에 걸쳐 발행되면 조각마다 1건씩 남는다.
  // 그중 1건을 먼저 고른 뒤 그 레코드만 검사하면, 만료된 레코드가 배열 앞에 있을 때 아직 살아 있는
  // 쿨다운을 가려 재게재가 통과한다(실제 state의 AR0234가 그 상태였다: 2026-08-03 발행분이
  // 2026-08-10 발행분보다 앞에 있어 08-25~08-31 판정이 전부 만료본을 집었다).
  // 그래서 "쿨다운이 살아 있는 레코드가 있는가"를 술어로 묻고, 없을 때만 표시용 레코드를 고른다.
  const matches = ensureArray(history.articles).filter(item => recordMatchesArticle(item, keys));
  const blocking = matches.find(item => blocksRepublication(item, asOf)) || null;
  const record = blocking || exposureMap(history).get(keys.identity) || matches[0] || null;
  const publishedAt = text(record?.newsletter_article_date);
  const publishedWithinCooldown = Boolean(blocking);
  return {
    ...article,
    article_identity_key: keys.identity,
    already_exposed: Boolean(record),
    published_within_cooldown: publishedWithinCooldown,
    last_newsletter_date: publishedWithinCooldown ? publishedAt : null,
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

// options.date는 쿨다운 검사가 쓰는 것과 같은 as-of date다. 그 호 자신이 발행한 레코드는 이력에서
// 빠진다 — 안 그러면 같은 date 재실행이 그 호가 catch-up 레인으로 낸 기사를 자기 이력으로 배제한다.
//
// 첫 인자는 identity 문자열이 아니라 후보다. 쿨다운 검사(annotateArticleExposure)와 같은 입력을
// 받아 두 술어가 identity와 시리즈 키를 이 모듈 안에서 똑같이 유도하게 하려는 것이다 — 같은 규칙을
// 호출부마다 따로 적으면 한쪽만 고쳐지는 것이 #963에서 실제로 일어난 일이다.
function everCoveredAsNewsletterArticle(article = {}, history = {}, options = {}) {
  const keys = articleMatchKeys(article);
  return ensureArray(history.articles).some(item =>
    recordMatchesArticle(item, keys) &&
    isNewsletterArticleRecord(item) &&
    !isSameIssueRecord(item, options.date)
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
  newsletterArticleRecordCount,
  normalizeExposureHistory,
  readExposureHistory,
  recordArticleExposure,
  recordNewsletterArticles,
  seedExposureHistoryFromNewsletters,
  writeExposureHistory
};
