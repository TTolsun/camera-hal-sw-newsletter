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

const { mainArticleBlocks, sourceBlock } = require('../quality/rendered-issue-structure');

const NEWSLETTERS_REL_PATH = path.join('articles', 'newsletters');
const ISSUE_MARKDOWN_FILE = 'newsletter.md';
const ISSUE_DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

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
 * mainArticleBlocks가 브리핑(`## 1.`)·Action Items·참고자료 절을 이미 걸러 준다. 참고 절을
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

/**
 * 발행된 모든 뉴스레터에서 기사 출처 URL과 그 발행일을 모은다.
 *
 * 디렉터리 레이아웃이 둘(`2026-08-17`과 `2026-W34`) 섞여 있고 같은 호가 양쪽에 다 있다.
 * 주 단위 이름에서는 발행일을 알 수 없으므로 날짜 디렉터리만 읽는다 - 날짜를 모르면 asOf로
 * 자를 수 없고, 자르지 못한 채 남기면 backfill이 미래 발행분을 보게 된다.
 *
 * @param {string} root 저장소 루트
 * @param {object} [options]
 * @param {string} [options.asOf] 이 날짜까지만 센다(YYYY-MM-DD). asOfExposureHistory와 같은
 *   역할이고 같은 이유로 필요하다 - 과거 주를 다시 돌릴 때 그 주가 몰랐던 발행을 알면 안 된다.
 * @returns {{url: string, newsletter_date: string}[]} URL당 가장 이른 발행일 하나
 */
function readPublishedArticles(root, { asOf = '' } = {}) {
  const dir = path.join(root, NEWSLETTERS_REL_PATH);
  if (!fs.existsSync(dir)) return [];

  const firstPublished = new Map();
  for (const name of fs.readdirSync(dir)) {
    if (!ISSUE_DATE_DIR.test(name)) continue;
    if (asOf && name > asOf) continue;
    const file = path.join(dir, name, ISSUE_MARKDOWN_FILE);
    if (!fs.existsSync(file)) continue;

    for (const url of publishedArticleUrlsFromMarkdown(fs.readFileSync(file, 'utf8'))) {
      const previous = firstPublished.get(url);
      // 같은 URL이 여러 호에 실렸으면 가장 이른 발행일을 남긴다. 재심에 필요한 사실은
      // "언제부터 이미 실린 상태였나"이지 마지막으로 언급된 날이 아니다.
      if (!previous || name < previous) firstPublished.set(url, name);
    }
  }

  return [...firstPublished.entries()]
    .map(([url, newsletterDate]) => ({ url, newsletter_date: newsletterDate }))
    .sort((a, b) => a.newsletter_date.localeCompare(b.newsletter_date) || a.url.localeCompare(b.url));
}

module.exports = {
  publishedArticleUrlsFromMarkdown,
  readPublishedArticles,
  NEWSLETTERS_REL_PATH
};
