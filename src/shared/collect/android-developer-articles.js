'use strict';

const { MAX_BYTES_PER_ARTICLE } = require('./bounded-fetch-client');
const { cardText } = require('./dated-article-card-parsing');
const { canonicalPageUrl } = require('./dated-article-page-parsing');
const { workflowEvidence } = require('./dated-article-index-resolver');
const { dateSourceConfidence } = require('../common/date-signals');

const MAX_ARTICLES = 8;
const DAY_MS = 86400000;

function articleUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'developer.android.com' ||
        !/^\/blog\/posts\/[^/]+\/?$/.test(url.pathname)) return '';
    url.search = '';
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
}

// RSS 소개문에는 모델 홍보만 있고 실제 IDE/CLI 변경은 본문 뒤에 있을 수 있다.
// 공식 상세 페이지의 헤더·본문만 사용한다. 관련 기사·메뉴는 근거가 아니다.
function parseAndroidDeveloperArticle(html, expectedUrl) {
  const value = String(html || '');
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(value);
  if (!heading || articleUrl(canonicalPageUrl(value)) !== articleUrl(expectedUrl)) return null;
  const afterHeading = value.slice(heading.index);
  const end = afterHeading.search(/<[^>]+class=["'][^"']*adb--post-continue-reading-heading/i);
  if (end < 0) return null;
  const bodyHtml = afterHeading.slice(0, end);
  const rawDate = /<time\b[^>]*datetime=["']([^"']+)["']/i.exec(bodyHtml)?.[1];
  const timestamp = rawDate ? Date.parse(rawDate) : NaN;
  if (!Number.isFinite(timestamp)) return null;
  const bodyText = cardText(bodyHtml.replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ''));
  const evidence = workflowEvidence(bodyText);
  const component = /\b(?:Android Studio|Android CLI|CameraX|Camera2|Jetpack Compose|Android NDK)\b/i.exec(bodyText)?.[0] || '';
  return { title: cardText(heading[1]), publishedAt: new Date(timestamp).toISOString().slice(0, 10),
    summary: evidence.summary, summary_truncated: evidence.summaryTruncated,
    api_or_component: component, behavior_change: evidence.behaviorChange,
    source_extraction: { workflow: { sections: evidence.sections } } };
}

async function resolveAndroidDeveloperArticles(items, {
  fetchClient, now = new Date(), lookbackDays = 21, onDiagnostic
} = {}) {
  if (!fetchClient) throw new Error('Android article resolution requires a bounded fetch client');
  const inWindow = date => {
    const age = now.getTime() - Date.parse(date);
    return Number.isFinite(age) && age >= 0 && age <= lookbackDays * DAY_MS;
  };
  const results = [];
  let attempted = 0;
  const seen = new Set();
  for (const item of items) {
    const url = articleUrl(item.url);
    // Legacy Blogger articles retain the existing RSS path; arbitrary hosts are never followed.
    if (!url) { results.push(item); continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    if (!inWindow(item.publishedAt)) continue;
    if (attempted++ >= MAX_ARTICLES) {
      onDiagnostic?.({ kind: 'skipped_article_cap', url, detail: 'Android blog article fetch cap reached' });
      continue;
    }
    const response = await fetchClient.fetchBounded(`${url}?hl=en`, { maxBytes: MAX_BYTES_PER_ARTICLE });
    const parsed = response.ok && !response.truncated && !response.sourceBudgetExhausted
      ? parseAndroidDeveloperArticle(response.body, url) : null;
    if (!parsed) {
      onDiagnostic?.({ kind: 'fail_closed', url, reason: 'article_parse_failed',
        detail: 'Official article body, canonical URL and publication date could not be verified' });
      // Do not promote a teaser when the primary page could not be verified.
      continue;
    }
    if (!inWindow(parsed.publishedAt)) continue;
    results.push({ ...item, ...parsed, url, sourceKind: 'blog_post_item', collectionMode: 'article-item',
      effective_date: parsed.publishedAt, date_source: 'visible_date',
      date_confidence: dateSourceConfidence('visible_date'), date_evidence_url: url });
  }
  return results;
}

module.exports = { parseAndroidDeveloperArticle, resolveAndroidDeveloperArticles };
