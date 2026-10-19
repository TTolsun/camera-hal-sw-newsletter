'use strict';

// 발행된 뉴스레터 본문에서 "기사로 실린" 출처 URL을 뽑는다.
//
// state/article-exposure-history.json이 있는데도 이 모듈이 따로 필요한 이유는 그 파일의
// coverage가 `forward_only`이고 `coverage_starts_at`이 2026-07-27이기 때문이다. 그 이전에
// 발행된 기사는 `newsletter_article` 레코드가 없다. 실측: CameraX 1.6.0(2026-06-03)과
// 1.6.1(2026-05-11)은 본문 기사로 실렸는데 노출 이력에는 homepage_headline으로만 잡힌다.
// 그래서 노출 이력으로 "이미 실렸는가"를 물으면 창간 초기 발행분을 통째로 놓친다.
//
// 발행된 markdown이 그 질문의 1차 자료다. 절을 나누고 출처 블록을 찾는 일은
// quality/rendered-issue-structure.js가 이미 한다 - 그쪽이 영문 라벨(`**Sources**`)과 legacy
// 라벨까지 알고 있으므로 여기서 다시 만들지 않는다. 별도 파서를 두면 발행 형식이 바뀔 때
// 한쪽만 따라가고, 그 어긋남은 "이미 실린 기사를 안 실렸다고 보고"하는 방향으로 틀린다.

const fs = require('fs');
const path = require('path');

const { newslettersDir } = require('../../shared/common/artifact-paths');
const { articleIdentityKey } = require('../../shared/common/article-identity');
const { weeklyKeyForDate } = require('./weekly-newsletter');
const { mainArticleBlocks, sourceBlock } = require('../quality/rendered-issue-structure');

const NEWSLETTERS_REL_PATH = path.join('articles', 'newsletters');
const ISSUE_MARKDOWN_FILE = 'newsletter.md';
const ISSUE_DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;
const ISSUE_WEEK_DIR = /^\d{4}-W\d{2}$/;

// `[제목](<url>)`과 `[제목](url)` 둘 다 쓰인다. 꺾쇠는 URL에 괄호가 들어갈 때 렌더러가
// 붙이므로 한쪽만 받으면 그 링크를 통째로 놓친다(실측: 2026-08-24의 CameraX 링크).
const MARKDOWN_LINK = /\[[^\]]*\]\(<?(https?:\/\/[^\s)>]+)>?\)/g;

// mainArticleBlocks는 한 기사 절을 **다음 번호 절**까지로 자른다. 그래서 마지막 기사 절에는
// 뒤따르는 `## 참고자료`와 `## 참고 / 더 읽을거리`가 통째로 딸려 온다. 그 검증기에는 문제가
// 아니지만(절 안에 출처 항목이 있나만 본다) URL을 걷는 데는 치명적이다 - 실측으로 그 유출이
// 47건이고, 참고 링크를 발행으로 세면 실제 오탈락을 "이미 실렸다"고 잘못 막는다.
// 그래서 여기서 절 경계까지 한 번 더 자른다.
const NEXT_HEADING = /^##\s+/m;

function withinSection(text) {
  return String(text || '').split(NEXT_HEADING)[0];
}

/**
 * 뉴스레터 markdown 한 편에서 기사 출처 URL을 뽑는다.
 *
 * mainArticleBlocks가 브리핑·Action Items·참고자료 절을 제목 정확 일치로 이미 걸러 준다. 참고 절을
 * 세면 안 되는 이유는 그 자리가 "이번 주에 기사로 쓰지 않은 자료"를 모아 두는 곳이라,
 * 거기 있는 URL을 발행으로 세면 실제 오탈락을 이미 실렸다고 잘못 막기 때문이다.
 *
 * @param {string} markdown newsletter.md 전문
 * @returns {string[]} 기사 절 출처 블록의 URL (등장 순서, 중복 제거)
 */
function publishedArticleUrlsFromMarkdown(markdown = '') {
  const urls = [];
  for (const block of mainArticleBlocks(String(markdown || ''))) {
    for (const match of withinSection(sourceBlock(block.text)).matchAll(MARKDOWN_LINK)) {
      if (!urls.includes(match[1])) urls.push(match[1]);
    }
  }
  return urls;
}

// 주간호의 anchor/coverage/원문 날짜는 개별 기사의 발행일이 아니다. 실제 writer가
// 기록한 newsletter_article_date만 쓴다. 이력이 없는 과거 주간 기사는 날짜를 추정하지
// 않고 제외하며, 보존 dated 본문은 이력과 무관하게 계속 읽는다.
function weeklyPublicationDates(root, weeklyKey, markdown) {
  const historyPath = path.join(root, 'state', 'article-exposure-history.json');
  const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : {};
  const dates = new Map();
  for (const record of Array.isArray(history.articles) ? history.articles : []) {
    if (record?.exposure_type !== 'newsletter_article' &&
      !(Array.isArray(record?.exposure_types) && record.exposure_types.includes('newsletter_article'))) continue;
    // A later homepage exposure overwrites newsletter_url, but does not change
    // newsletter_article_date. For that producer, bind the explicit article date
    // and stable identity to the actual public week below instead of its mutable URL.
    if (record.newsletter_url !== 'newsletters/' + weeklyKey + '/index.html' &&
      record.exposure_type !== 'homepage_headline') continue;
    const date = record.newsletter_article_date;
    if (!ISSUE_DATE_DIR.test(String(date || ''))) continue;
    try {
      if (weeklyKeyForDate(date) !== weeklyKey) continue;
    } catch (_) { continue; }
    // source_url은 selected candidate의 normalized_url이나 후속 homepage 표기로 바뀐다.
    // writer와 같은 정본 identity를 사용해 query/path 의미를 보존한다.
    const identity = articleIdentityKey(record);
    const previous = dates.get(identity);
    if (!previous || date < previous) dates.set(identity, date);
  }
  const issuePath = path.join(newslettersDir(root, weeklyKey), 'issue.json');
  const issue = fs.existsSync(issuePath) ? JSON.parse(fs.readFileSync(issuePath, 'utf8')) : null;
  if (!issue) return new Map();
  if (issue.weekly_key !== weeklyKey || !Array.isArray(issue.sections)) {
    throw new Error('Invalid weekly publication issue: ' + weeklyKey);
  }
  const sections = issue.sections.map(section => ({
    primary: section?.source_candidate_url || section?.sources?.[0]?.url,
    sources: (Array.isArray(section?.sources) ? section.sources : []).map(source => source?.url).filter(Boolean)
  })).filter(section => section.primary);
  const published = new Map();
  for (const block of mainArticleBlocks(markdown)) {
    const urls = [...withinSection(sourceBlock(block.text)).matchAll(MARKDOWN_LINK)].map(match => match[1]);
    // primary의 명시 발행일을 같은 공개 기사 Sources에만 결속한다. 다른 기사의 primary가
    // 보조 출처로 들어온 모호한 조합에서는 secondary의 날짜를 추정하지 않는다.
    const matches = sections.filter(section => urls.includes(section.primary));
    const article = matches.length === 1 ? matches[0] : null;
    const articleDate = article ? dates.get(articleIdentityKey({ url: article.primary })) : null;
    for (const url of urls) {
      const directDate = dates.get(articleIdentityKey({ url }));
      const boundDate = article?.sources.includes(url) ? articleDate : null;
      const date = boundDate && directDate ? (boundDate < directDate ? boundDate : directDate) : boundDate || directDate;
      const previous = published.get(url);
      if (date && (!previous || date < previous)) published.set(url, date);
    }
  }
  return published;
}

/**
 * 발행된 Markdown의 기사 출처 URL을 모은다. dated 호는 디렉터리 날짜, weekly 호는
 * 공개 본문과 결속된 명시 발행 이력을 사용한다. asOf 이후 기록은 제외하고 URL당 가장
 * 이른 확인 발행일을 남긴다. issuesScanned는 실제로 읽은 Markdown 파일 수다.
 */
function readPublishedArticles(root, { asOf = '' } = {}) {
  const dir = path.join(root, NEWSLETTERS_REL_PATH);
  if (!fs.existsSync(dir)) return { issuesScanned: 0, articles: [] };

  const firstPublished = new Map();
  let issuesScanned = 0;
  for (const name of fs.readdirSync(dir)) {
    const dated = ISSUE_DATE_DIR.test(name);
    if (!dated && !ISSUE_WEEK_DIR.test(name)) continue;
    if (dated && asOf && name > asOf) continue;
    const file = path.join(newslettersDir(root, name), ISSUE_MARKDOWN_FILE);
    if (!fs.existsSync(file)) continue;
    issuesScanned += 1;

    const markdown = fs.readFileSync(file, 'utf8');
    const publications = dated
      ? publishedArticleUrlsFromMarkdown(markdown).map(url => [url, name])
      : weeklyPublicationDates(root, name, markdown);
    for (const [url, date] of publications) {
      if (asOf && date > asOf) continue;
      const previous = firstPublished.get(url);
      // 같은 URL이 여러 호에 실렸으면 가장 이른 발행일을 남긴다. 재심에 필요한 사실은
      // "언제부터 이미 실린 상태였나"이지 마지막으로 언급된 날이 아니다.
      if (!previous || date < previous) firstPublished.set(url, date);
    }
  }

  return {
    issuesScanned,
    articles: [...firstPublished.entries()]
      .map(([url, newsletterDate]) => ({ url, newsletter_date: newsletterDate }))
      .sort((a, b) => a.newsletter_date.localeCompare(b.newsletter_date) || a.url.localeCompare(b.url))
  };
}

module.exports = {
  publishedArticleUrlsFromMarkdown,
  readPublishedArticles,
  NEWSLETTERS_REL_PATH
};
