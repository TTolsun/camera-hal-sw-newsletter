'use strict';

// 개별 기사 페이지(Claude Blog /blog/{slug}, Anthropic News /news/{slug})에서
// 정본 URL과 발행일을 읽는다. 두 사이트의 날짜 신호가 다르다.
//
// Claude Blog는 <link rel="canonical">과 JSON-LD BlogPosting이 둘 다 있다
// (단 datePublished가 ISO가 아니라 "Aug 18, 2026" 표기이고, rel보다 href가 먼저 온다).
// Anthropic News는 canonical만 있고 JSON-LD 블록이 0개, 날짜 meta도 0개다 —
// 헤더의 사람이 읽는 텍스트가 유일한 날짜다.
const { decodeHtml } = require('../common/common');
const { calendarDate, distinctIsoDates } = require('./dated-article-card-parsing');

// 기사 본문을 나르는 JSON-LD 타입만 신뢰한다. 관련 기사 카드나 조직 정보 노드가
// 같은 @graph 안에 섞여 있어도 이 목록에 없으면 날짜 후보로 보지 않는다.
const ARTICLE_JSON_LD_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

// htmlAttr(common.js:45)은 속성명 앞 경계를 보지 않아 data-href를 href로 집는다.
// 정본 URL은 기사 동일성의 뿌리라 여기서만은 경계를 세워 읽는다.
function attributeValue(tag = '', name = '') {
  const match = new RegExp(`(?:^|[\\s"'])${name}\\s*=\\s*("[^"]*"|'[^']*')`, 'i').exec(String(tag));
  return match ? decodeHtml(match[1].slice(1, -1)) : '';
}

/**
 * (a) 정본 URL. rel="canonical"과 href의 순서가 사이트마다 다르므로
 * (Claude Blog는 href가 먼저 온다) 태그를 통째로 잡은 뒤 속성을 꺼낸다.
 * canonical이 없으면 og:url로 물러선다.
 */
function canonicalPageUrl(html = '') {
  const value = String(html);
  const canonical = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(value);
  const canonicalHref = canonical ? attributeValue(canonical[0], 'href') : '';
  if (canonicalHref) return canonicalHref;
  const ogUrl = /<meta\b[^>]*\b(?:property|name)=["']og:url["'][^>]*>/i.exec(value);
  return ogUrl ? attributeValue(ogUrl[0], 'content') : '';
}

/**
 * (b) 헤더 가시 날짜. 본문 아래 관련 기사 카드에도 날짜가 있으므로(실측: 이 기사에는
 * h1 뒤 18,460바이트 지점부터 남의 기사 날짜가 4건 더 나온다) 바이트 거리로 자르지 않고
 * 문서 구조로 자른다 — h1이 끝난 자리부터 첫 h2/h3 직전까지가 기사 헤더다.
 * 그 구간의 날짜가 정확히 하나가 아니면 빈 값(fail-closed).
 */
function articleHeaderDate(html = '') {
  const value = String(html);
  const heading = /<h1\b[^>]*>[\s\S]*?<\/h1\s*>/i.exec(value);
  if (!heading) return '';
  const rest = value.slice(heading.index + heading[0].length);
  const nextHeading = rest.search(/<h[23]\b/i);
  const dates = distinctIsoDates(nextHeading < 0 ? rest : rest.slice(0, nextHeading));
  return dates.length === 1 ? dates[0] : '';
}

/**
 * <script type="application/ld+json"> 블록들을 노드 배열로 펼친다. @graph로 묶인
 * 하위 노드도 펼친다. 깨진 JSON은 그 블록만 건너뛴다 — 정규식으로 값을 긁으면
 * 다른 노드의 날짜를 집을 위험이 있어 반드시 JSON.parse로만 읽는다.
 */
function jsonLdNodes(html = '') {
  const nodes = [];
  const blocks = String(html).match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(decodeHtml(body));
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of roots) {
        if (!node || typeof node !== 'object') continue;
        nodes.push(node);
        if (Array.isArray(node['@graph'])) nodes.push(...node['@graph']);
      }
    } catch {
      // 블록 하나가 깨졌다고 페이지 전체 날짜 인식을 포기하지 않는다.
    }
  }
  return nodes;
}

/**
 * (c) JSON-LD datePublished. 기사 타입 노드가 여럿이면 관련 기사 노드가 먼저 올 수 있어
 * 첫 노드를 무조건 믿으면 남의 날짜를 집는다. 서로 다른 값이 둘 이상이면 비운다.
 * dateModified는 쓰지 않는다 — 재발행일이 발행일로 둔갑한다
 * (실측: 이 기사는 datePublished "Aug 18, 2026", dateModified "Aug 20, 2026").
 */
function jsonLdDatePublished(html = '') {
  const dates = new Set();
  for (const node of jsonLdNodes(html)) {
    const types = [].concat(node['@type'] || []);
    if (!types.some(type => ARTICLE_JSON_LD_TYPES.has(type))) continue;
    const date = calendarDate(node.datePublished || '');
    if (date) dates.add(date);
  }
  return dates.size === 1 ? [...dates][0] : '';
}

/**
 * 세 신호를 함께 돌려준다. 어느 하나를 다른 하나로 메우지 않는다 —
 * 어떤 신호가 없었는지가 그대로 보여야 소스가 조용히 바뀐 것을 나중에 알아챈다.
 * date_source는 date-signals.js의 닫힌 어휘만 쓴다. 새 값을 만들면
 * dateSourceConfidence가 0을 주고 그 후보는 watchlist로 떨어진다(실측).
 */
function resolveDatedArticlePage(html = '') {
  const headerDate = articleHeaderDate(html);
  const structuredDate = jsonLdDatePublished(html);
  const conflict = Boolean(headerDate && structuredDate && headerDate !== structuredDate);
  const publishedDate = conflict ? '' : (structuredDate || headerDate);
  return {
    canonical_url: canonicalPageUrl(html),
    header_visible_date: headerDate,
    json_ld_date_published: structuredDate,
    published_date: publishedDate,
    date_conflict: conflict,
    date_source: !publishedDate ? 'missing' : structuredDate ? 'structured_date_published' : 'visible_date'
  };
}

module.exports = {
  articleHeaderDate,
  canonicalPageUrl,
  jsonLdDatePublished,
  resolveDatedArticlePage
};
