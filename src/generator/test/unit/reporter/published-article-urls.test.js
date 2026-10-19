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

test('발행 날짜 근거가 없는 주간호는 날짜를 추정하지 않는다', () => {
  // anchor나 원문 날짜를 발행일로 추정하지 않는다.
  const root = tempRoot('published-article-urls-weekly');
  writeIssue(root, '2026-W34', issueMarkdown());
  const published = readPublishedArticles(root);
  assert.deepEqual(published.articles, []);
  assert.equal(published.issuesScanned, 1);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-22' }).articles, []);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-23' }).articles, []);
});

test('뉴스레터 디렉터리가 없으면 빈 배열이다', () => {
  assert.deepEqual(readPublishedArticles(tempRoot('published-article-urls-empty')), { issuesScanned: 0, articles: [] });
});

function writeHistory(root, articles) {
  const dir = path.join(root, 'state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'article-exposure-history.json'), JSON.stringify({ schemaVersion: 1, articles }), 'utf8');
}

function articleRecord(url, date, type = 'newsletter_article') {
  return { source_url: url, newsletter_article_date: date, exposure_type: type, newsletter_url: 'newsletters/2026-W34/index.html' };
}

test('주간 누적 기사별 명시 발행일로 같은 주 asOf 이후 기사를 제외한다', () => {
  const root = tempRoot('published-article-urls-weekly-asof');
  const later = 'https://example.com/later-article';
  writeIssue(root, '2026-W34', issueMarkdown() + '\n## 3. 후속 기사\n\n**Sources**\n\n- [later](' + later + ')\n');
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-17'), articleRecord(later, '2026-08-20')]);
  const dir = path.join(root, 'articles/newsletters/2026-W34');
  fs.writeFileSync(path.join(dir, 'issue.json'), JSON.stringify({ weekly_key: '2026-W34', generation_anchor_date: '2026-08-17', sections: [{ source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }] }, { source_candidate_url: later, sources: [{ url: later }] }] }));
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-19' }).articles, [{ url: ARTICLE_URL, newsletter_date: '2026-08-17' }]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-20' }).articles, [
    { url: ARTICLE_URL, newsletter_date: '2026-08-17' }, { url: later, newsletter_date: '2026-08-20' }
  ]);
});

test('홈 헤드라인과 다른 주의 노출 기록은 주간 기사 발행일 근거가 아니다', () => {
  const root = tempRoot('published-article-urls-weekly-history');
  writeIssue(root, '2026-W34', issueMarkdown());
  writeWeeklySource(root, [{ source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }] }]);
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-17', 'homepage_headline'), articleRecord(ARTICLE_URL, '2026-08-10')]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-18' }).articles, []);
  writeHistory(root, [{ ...articleRecord(ARTICLE_URL, '2026-08-18', 'homepage_headline'), exposure_types: ['newsletter_article', 'homepage_headline'] }]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-18' }).articles, [{ url: ARTICLE_URL, newsletter_date: '2026-08-18' }]);
});

test('노출 이력만 있고 공개 본문에 없는 URL은 발행 기사로 세지 않는다', () => {
  const root = tempRoot('published-article-urls-weekly-public');
  writeIssue(root, '2026-W34', issueMarkdown());
  writeHistory(root, [articleRecord(REFERENCE_URL, '2026-08-17')]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-18' }).articles, []);
});

test('dated와 weekly 중복은 기존의 가장 이른 날짜와 URL 정렬을 보존한다', () => {
  const root = tempRoot('published-article-urls-weekly-dedup');
  const second = 'https://example.com/a';
  writeIssue(root, '2026-08-17', issueMarkdown());
  writeIssue(root, '2026-W34', issueMarkdown() + '\n## 3. 다른 기사\n\n**Sources**\n\n- [other](' + second + ')\n');
  writeWeeklySource(root, [{ source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }] }, { sources: [{ url: second }] }]);
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-20'), articleRecord(second, '2026-08-17')]);
  const result = readPublishedArticles(root);
  assert.equal(result.issuesScanned, 2);
  assert.deepEqual(result.articles, [{ url: ARTICLE_URL, newsletter_date: '2026-08-17' }, { url: second, newsletter_date: '2026-08-17' }].sort((a, b) => a.url.localeCompare(b.url)));
});

function writeWeeklySource(root, sections) {
  const dir = path.join(root, 'articles/newsletters/2026-W34');
  fs.writeFileSync(path.join(dir, 'issue.json'), JSON.stringify({ weekly_key: '2026-W34', generation_anchor_date: '2026-08-17', sections }), 'utf8');
}

test('명시 primary 발행일을 같은 공개 기사의 secondary Sources에 결속한다', () => {
  const root = tempRoot('published-article-urls-weekly-secondary');
  writeIssue(root, '2026-W34', issueMarkdown().replace('## 참고 / 더 읽을거리', '- [보조](https://example.com/secondary)\n\n## 참고 / 더 읽을거리'));
  writeWeeklySource(root, [{ source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }, { url: 'https://example.com/secondary' }] }]);
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-20')]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-19' }).articles, []);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-20' }).articles, [
    { url: ARTICLE_URL, newsletter_date: '2026-08-20' }, { url: 'https://example.com/secondary', newsletter_date: '2026-08-20' }
  ].sort((a, b) => a.url.localeCompare(b.url)));
});

test('여러 primary가 한 Sources에 있으면 미확인 secondary 날짜를 추정하지 않는다', () => {
  const root = tempRoot('published-article-urls-weekly-ambiguous');
  writeIssue(root, '2026-W34', issueMarkdown().replace('## 참고 / 더 읽을거리', '- [둘째](https://example.com/second)\n- [보조](https://example.com/secondary)\n\n## 참고 / 더 읽을거리'));
  writeWeeklySource(root, [{ source_candidate_url: ARTICLE_URL }, { source_candidate_url: 'https://example.com/second' }]);
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-17'), articleRecord('https://example.com/second', '2026-08-20')]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-18' }).articles, [{ url: ARTICLE_URL, newsletter_date: '2026-08-17' }]);
});

test('기사 노출 날짜와 공개 weekly URL이 다른 주이면 발행일로 쓰지 않는다', () => {
  const root = tempRoot('published-article-urls-weekly-url');
  writeIssue(root, '2026-W34', issueMarkdown());
  writeWeeklySource(root, [{ source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }] }]);
  writeHistory(root, [{ ...articleRecord(ARTICLE_URL, '2026-08-17'), newsletter_url: 'newsletters/2026-W35/index.html' }]);
  assert.deepEqual(readPublishedArticles(root).articles, []);
});

test('실제 recordNewsletterArticles producer의 primary 기록으로 보조 출처도 포함한다', () => {
  const { recordNewsletterArticles, emptyExposureHistory } = require('../../../reporter/article-exposure-history');
  const root = tempRoot('published-article-urls-producer');
  const secondary = 'https://example.com/secondary';
  const section = { source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }, { url: secondary }] };
  writeIssue(root, '2026-W34', issueMarkdown().replace('## 참고 / 더 읽을거리', '- [보조](' + secondary + ')\n\n## 참고 / 더 읽을거리'));
  writeWeeklySource(root, [section]);
  const history = recordNewsletterArticles(emptyExposureHistory('2026-08-17'), [section], { date: '2026-08-17', newsletterUrl: 'newsletters/2026-W34/index.html' });
  writeHistory(root, history.articles);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-17' }).articles, [
    { url: ARTICLE_URL, newsletter_date: '2026-08-17' }, { url: secondary, newsletter_date: '2026-08-17' }
  ].sort((a, b) => a.url.localeCompare(b.url)));
});

test('보조 Sources가 나중에 추가된 경우 primary의 마지막 명시 발행일보다 앞당기지 않는다', () => {
  const root = tempRoot('published-article-urls-later-sources');
  const secondary = 'https://example.com/later-source';
  writeIssue(root, '2026-W34', issueMarkdown().replace('## 참고 / 더 읽을거리', '- [보조](' + secondary + ')\n\n## 참고 / 더 읽을거리'));
  writeWeeklySource(root, [{ source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }, { url: secondary }] }]);
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-20')]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-19' }).articles, []);
});

test('weekly issue 식별자 손상은 다른 주 근거로 조용히 읽지 않는다', () => {
  const root = tempRoot('published-article-urls-weekly-identity');
  writeIssue(root, '2026-W34', issueMarkdown());
  const dir = path.join(root, 'articles/newsletters/2026-W34');
  fs.writeFileSync(path.join(dir, 'issue.json'), JSON.stringify({ weekly_key: '2026-W35', sections: [] }));
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-17')]);
  assert.throws(() => readPublishedArticles(root), /Invalid weekly publication issue/);
});

test('명시 발행 이력이 없는 secondary만 별도로 날짜를 갖지 않는다', () => {
  const root = tempRoot('published-article-urls-weekly-unbound');
  writeIssue(root, '2026-W34', issueMarkdown().replace('## 참고 / 더 읽을거리', '- [추가](https://example.com/not-in-issue)\n\n## 참고 / 더 읽을거리'));
  writeWeeklySource(root, [{ sources: [{ url: ARTICLE_URL }] }]);
  writeHistory(root, [articleRecord(ARTICLE_URL, '2026-08-17')]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-17' }).articles, [{ url: ARTICLE_URL, newsletter_date: '2026-08-17' }]);
});

test('실제 selectedArticles producer의 stable identity로 raw primary 발행일을 찾는다', () => {
  const { articleIdentityKey } = require('../../../../shared/common/article-identity');
  const { recordNewsletterArticles, emptyExposureHistory } = require('../../../reporter/article-exposure-history');
  const root = tempRoot('published-article-urls-selected-identity');
  const raw = 'https://developer.android.com/Media/Test?hl=en';
  const candidate = { url: raw, normalized_url: 'https://developer.android.com/media/test', article_identity_key: articleIdentityKey({ url: raw }) };
  const section = { source_candidate_url: raw, sources: [{ url: raw }] };
  writeIssue(root, '2026-W34', issueMarkdown({ sourceUrl: raw }));
  writeWeeklySource(root, [section]);
  const history = recordNewsletterArticles(emptyExposureHistory('2026-08-17'), [section], {
    date: '2026-08-17', newsletterUrl: 'newsletters/2026-W34/index.html', selectedArticles: [candidate]
  });
  assert.equal(history.articles[0].source_url, candidate.normalized_url);
  assert.equal(history.articles[0].article_identity_key, articleIdentityKey({ url: raw }));
  writeHistory(root, history.articles);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-17' }).articles, [{ url: raw, newsletter_date: '2026-08-17' }]);
  // hl는 tracking parameter가 아니다. 같은 host/path라도 다른 query 기사로 넓혀 매칭하지 않는다.
  const other = raw.replace('hl=en', 'hl=ko');
  writeIssue(root, '2026-W34', issueMarkdown({ sourceUrl: other }));
  writeWeeklySource(root, [{ source_candidate_url: other, sources: [{ url: other }] }]);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-17' }).articles, []);
});

test('후속 homepage가 source_url 표기를 바꿔도 stable article identity와 명시 발행일을 보존한다', () => {
  const { articleIdentityKey } = require('../../../../shared/common/article-identity');
  const { recordNewsletterArticles, recordArticleExposure, emptyExposureHistory } = require('../../../reporter/article-exposure-history');
  const root = tempRoot('published-article-urls-homepage-identity');
  const raw = 'https://developer.android.com/Media/Test?hl=en';
  const key = articleIdentityKey({ url: raw });
  const section = { source_candidate_url: raw, sources: [{ url: raw }] };
  writeIssue(root, '2026-W34', issueMarkdown({ sourceUrl: raw }));
  writeWeeklySource(root, [section]);
  let history = recordNewsletterArticles(emptyExposureHistory('2026-08-17'), [section], { date: '2026-08-17', newsletterUrl: 'newsletters/2026-W34/index.html' });
  history = recordArticleExposure(history, { article_identity_key: key, canonical_url: 'https://developer.android.com/media/test' }, { date: '2026-08-19', type: 'homepage_headline', newsletterUrl: 'newsletters/2026-W34/index.html' });
  assert.equal(history.articles[0].exposure_type, 'homepage_headline');
  assert.equal(history.articles[0].newsletter_article_date, '2026-08-17');
  assert.notEqual(history.articles[0].source_url, raw);
  writeHistory(root, history.articles);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-17' }).articles, [{ url: raw, newsletter_date: '2026-08-17' }]);
});

test('다음 주 homepage 노출 URL은 이전 주 공개 기사의 명시 발행일을 지우지 않는다', () => {
  const { recordNewsletterArticles, recordArticleExposure, emptyExposureHistory } = require('../../../reporter/article-exposure-history');
  const root = tempRoot('published-article-urls-next-week-homepage');
  const section = { source_candidate_url: ARTICLE_URL, sources: [{ url: ARTICLE_URL }] };
  writeIssue(root, '2026-W34', issueMarkdown());
  writeWeeklySource(root, [section]);
  let history = recordNewsletterArticles(emptyExposureHistory('2026-08-17'), [section], { date: '2026-08-17', newsletterUrl: 'newsletters/2026-W34/index.html' });
  writeHistory(root, history.articles);
  const before = readPublishedArticles(root, { asOf: '2026-08-17' });
  assert.deepEqual(before.articles, [{ url: ARTICLE_URL, newsletter_date: '2026-08-17' }]);
  history = recordArticleExposure(history, { url: ARTICLE_URL }, { date: '2026-08-24', type: 'homepage_headline', newsletterUrl: 'newsletters/2026-W35/index.html' });
  assert.equal(history.articles[0].newsletter_url, 'newsletters/2026-W35/index.html');
  assert.equal(history.articles[0].newsletter_article_date, '2026-08-17');
  writeHistory(root, history.articles);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-17' }), before);
  assert.deepEqual(readPublishedArticles(root).articles, before.articles);
  assert.deepEqual(readPublishedArticles(root, { asOf: '2026-08-16' }).articles, []);
});
