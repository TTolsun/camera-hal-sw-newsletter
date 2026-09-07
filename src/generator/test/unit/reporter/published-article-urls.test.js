'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  publishedArticleUrlsFromMarkdown,
  readPublishedArticles
} = require('../../../reporter/published-article-urls');
const { tempRoot } = require('../../../../shared/test/helpers/fs');

const ARTICLE_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
const REFERENCE_URL = 'https://example.com/reference-only';

function issueMarkdown({ sourceUrl = ARTICLE_URL, referenceUrl = REFERENCE_URL } = {}) {
  return [
    '# Camera HAL / SW Newsletter - 2026-05-12',
    '',
    '## 1. 이번 주 3줄 브리핑',
    '',
    '- CameraX 1.6.1 이야기',
    '',
    '## 2. CameraX 1.6.1 업데이트',
    '',
    '본문이다.',
    '',
    '### Camera HAL/Driver 관점에서의 의미',
    '',
    '의미다.',
    '',
    '**출처**',
    '',
    `- [1.6.1](${sourceUrl})`,
    '',
    '## 참고 / 더 읽을거리',
    '',
    `- [참고 자료](${referenceUrl}) — 기사로 쓰지 않은 것`,
    '',
    '## 참고자료',
    '',
    `- [참고 자료](${referenceUrl})`,
    ''
  ].join('\n');
}

function writeIssue(root, date, markdown) {
  const dir = path.join(root, 'articles', 'newsletters', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'newsletter.md'), markdown, 'utf8');
}

test('기사 절의 출처 URL을 뽑는다', () => {
  assert.deepEqual(publishedArticleUrlsFromMarkdown(issueMarkdown()), [ARTICLE_URL]);
});

test('참고 절의 링크는 발행으로 세지 않는다', () => {
  // mainArticleBlocks는 한 기사 절을 다음 **번호** 절까지로 자르므로, 마지막 기사 절에
  // `## 참고 / 더 읽을거리`와 `## 참고자료`가 딸려 온다(실측 유출 47건). 그 링크를 발행으로
  // 세면 아직 기사로 쓰지 않은 자료를 "이미 실렸다"고 잘못 막는다.
  const urls = publishedArticleUrlsFromMarkdown(issueMarkdown());
  assert.ok(!urls.includes(REFERENCE_URL), urls.join(', '));
});

test('브리핑 절의 링크도 세지 않는다', () => {
  // `## 1.`은 아래 기사들의 목차다. 여기서 걷으면 같은 기사를 두 번 세거나 목차 링크를
  // 기사 출처로 오인한다.
  const markdown = issueMarkdown().replace(
    '- CameraX 1.6.1 이야기',
    '- [CameraX 1.6.1 이야기](https://example.com/toc-link)'
  );
  const urls = publishedArticleUrlsFromMarkdown(markdown);
  assert.deepEqual(urls, [ARTICLE_URL]);
});

test('꺾쇠로 감싼 링크도 읽는다', () => {
  // 렌더러는 URL에 괄호가 들어갈 때 `(<url>)`로 감싼다. 한쪽만 받으면 그 링크를 통째로 놓친다.
  const urls = publishedArticleUrlsFromMarkdown(issueMarkdown({ sourceUrl: ARTICLE_URL })
    .replace(`(${ARTICLE_URL})`, `(<${ARTICLE_URL}>)`));
  assert.deepEqual(urls, [ARTICLE_URL]);
});

test('출처 블록이 없는 절에서는 본문 링크를 걷지 않는다', () => {
  // sourceTail은 라벨이 없으면 절 전체를 돌려준다. 그 폴백을 받으면 본문에 인용된 이슈
  // 트래커·커밋 링크까지 출처로 센다. sourceBlock은 빈 문자열을 준다.
  const markdown = [
    '# 제목',
    '',
    '## 2. 출처 블록이 없는 기사',
    '',
    '본문에 [이슈 링크](https://example.com/issue/1)가 있다.',
    ''
  ].join('\n');
  assert.deepEqual(publishedArticleUrlsFromMarkdown(markdown), []);
});

test('영문 출처 라벨도 읽는다', () => {
  // rendered-issue-structure가 Sources·출처·legacy 라벨을 함께 안다. 별도 파서를 두지 않는
  // 이유가 이것이다 - 여기서 다시 만들면 한쪽만 라벨을 따라간다.
  const markdown = issueMarkdown().replace('**출처**', '**Sources**');
  assert.deepEqual(publishedArticleUrlsFromMarkdown(markdown), [ARTICLE_URL]);
});

test('출처 블록 뒤의 ### 소제목은 자르지 않는다', () => {
  // 절 경계 자르기는 `## `만 본다. `#{2,}`로 넓히면 기사 안의 `### ` 소제목에서 잘려
  // 그 아래 출처 링크를 통째로 잃는다. 지금은 잃을 링크가 없어 다른 테스트가 못 잡는다.
  const markdown = [
    '# 제목',
    '',
    '## 2. 기사',
    '',
    '**출처**',
    '',
    `- [첫째](${ARTICLE_URL})`,
    '',
    '### 덧붙임',
    '',
    '- [둘째](https://example.com/second)',
    '',
    '## 참고자료',
    '',
    `- [참고](${REFERENCE_URL})`,
    ''
  ].join('\n');

  const urls = publishedArticleUrlsFromMarkdown(markdown);
  assert.deepEqual(urls, [ARTICLE_URL, 'https://example.com/second']);
  assert.ok(!urls.includes(REFERENCE_URL), '참고자료 절은 여전히 잘린다');
});

test('여러 호에서 모으고 가장 이른 발행일을 남긴다', () => {
  const root = tempRoot('published-article-urls');
  writeIssue(root, '2026-05-12', issueMarkdown());
  writeIssue(root, '2026-06-03', issueMarkdown());

  const published = readPublishedArticles(root);
  assert.equal(published.issuesScanned, 2);
  assert.deepEqual(published.articles, [{ url: ARTICLE_URL, newsletter_date: '2026-05-12' }],
    '재심에 필요한 사실은 언제부터 이미 실린 상태였나이지 마지막 언급일이 아니다');
});

test('asOf 이후에 발행된 호는 세지 않는다', () => {
  // 과거 주를 다시 돌릴 때 그 주가 몰랐던 발행을 알면 안 된다. 알면 그때는 오탈락이었던
  // 후보가 "이미 실렸다"로 뒤집혀, 백필이 잴 수 없는 것을 재게 된다.
  const root = tempRoot('published-article-urls-asof');
  writeIssue(root, '2026-08-17', issueMarkdown());

  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-10' }).articles, []);
  assert.equal(readPublishedArticles(root, { asOf: '2026-08-17' }).articles.length, 1, '같은 날은 센다');
});

test('주 단위 디렉터리는 읽지 않는다', () => {
  // `2026-W34`에서는 발행일을 알 수 없어 asOf로 자를 수 없다. 같은 호가 날짜 디렉터리에도
  // 있으므로 실제로 잃는 발행분은 없다.
  const root = tempRoot('published-article-urls-weekly');
  writeIssue(root, '2026-W34', issueMarkdown());
  const published = readPublishedArticles(root);
  assert.deepEqual(published.articles, []);
  assert.equal(published.issuesScanned, 0, '읽은 호가 0이면 레이아웃이 바뀐 것과 발행이 없는 것을 가를 수 있다');
});

test('뉴스레터 디렉터리가 없으면 빈 배열이다', () => {
  assert.deepEqual(readPublishedArticles(tempRoot('published-article-urls-empty')), { issuesScanned: 0, articles: [] });
});
