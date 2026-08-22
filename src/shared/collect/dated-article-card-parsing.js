'use strict';

// 목록 페이지(Claude Blog /blog, Anthropic News /news)에서 (기사 링크, 발행일) 쌍을 뽑는다.
// 두 사이트 모두 날짜를 datetime 속성이나 JSON-LD로 주지 않고 사람이 읽는 텍스트로만 준다.
//
// 링크 위치 기준 근접 거리로 날짜를 붙이면 옆 카드 날짜를 훔쳐 온다(실측: Claude Blog는
// 날짜가 링크 앞 -188~-245바이트, Anthropic News는 +552~-245로 부호까지 뒤집힌다).
// 그래서 거리 대신 "카드 블록"을 경계로 쓴다 — 여는 태그부터 짝이 맞는 닫는 태그까지
// 깊이를 세어 자르고, 그 블록 안에서만 slug와 날짜를 찾는다.
//
// 두 사이트의 카드 컨테이너는 서로 다르다(실측).
// - Claude Blog(Webflow): 카드는 <div role="listitem" class="...w-dyn-item">이고
//   링크는 그 안의 자식 <a>다. 날짜는 링크보다 앞선 형제 <div>에 들어 있다.
// - Anthropic News(Next.js): 카드가 곧 <a href="/news/{slug}">이고
//   날짜 <time>이 그 앵커 안에 들어 있다.
// 그래서 컨테이너 후보를 한쪽으로 못 박지 않고 둘 다 후보로 넣은 뒤
// "링크를 감싸면서 날짜를 담은 가장 작은 블록"을 카드로 고른다.
const { decodeHtml } = require('../common/common');
const { displayDate } = require('../common/date-signals');

// 달 이름 표기는 정본(date-signals.displayDate)이 옮긴다. 표를 여기 또 두면 두 벌이 어긋난다.
// 스캔용 정규식만 여기 두고, 잡힌 문자열은 통째로 displayDate에 넘긴다.
const MONTH_DAY_YEAR_SCAN = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+20\d{2}\b/gi;

// 카드 안에서 사람이 읽는 텍스트만 남긴다. 인라인 SVG path 좌표("20 20", "10.5C3.22") 같은
// 숫자 더미가 날짜 정규식을 스치는 일을 막고, script/style은 카드 내용이 아니다.
const NON_TEXT_ELEMENT_PATTERN = /<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

// 카드 컨테이너 후보. role="listitem"은 Webflow가 붙이는 해시 class(w-variant-…)와 달리
// 리디자인해도 남는 ARIA 계약이라 표지로 더 오래 간다.
const LIST_ITEM_PATTERN = /<(div|li|article)(?=[\s/>])[^>]*\brole="listitem"[^>]*>/gi;

// 주석은 화면에도 없고 카드도 아니다. 후보 탐색 전에 지운다.
// 같은 길이의 공백으로 바꿔야 blockStart 오프셋이 원본과 같은 자리를 가리킨다.
// 지우지 않으면 주석 안의 옛 카드가 더 작아서 "가장 작은 블록"으로 이긴다(실측).
function withoutComments(html = '') {
  return String(html).replace(HTML_COMMENT_PATTERN, match => ' '.repeat(match.length));
}

function cardText(html = '') {
  return decodeHtml(
    String(html)
      .replace(HTML_COMMENT_PATTERN, ' ')
      .replace(NON_TEXT_ELEMENT_PATTERN, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
  ).trim();
}

/**
 * startIndex의 여는 태그부터 짝이 맞는 닫는 태그까지 잘라낸다.
 * 깊이가 0으로 닫히지 않으면 빈 문자열 — 경계를 못 찾은 블록을 통째로 쓰면
 * 목록 전체가 카드 하나로 둔갑해 옆 기사 날짜가 섞인다(fail-closed).
 */
function elementBlock(html = '', startIndex = 0, tagName = 'div') {
  const scanner = new RegExp(`<(/?)${tagName}(?=[\\s/>])[^>]*>`, 'gi');
  scanner.lastIndex = startIndex;
  let depth = 0;
  let match = scanner.exec(html);
  while (match) {
    depth += match[1] === '/' ? -1 : 1;
    if (depth === 0) return String(html).slice(startIndex, scanner.lastIndex);
    if (depth < 0) return '';
    match = scanner.exec(html);
  }
  return '';
}

function articleLinkPattern(pathPrefix) {
  return new RegExp(`<a\\b[^>]*\\bhref="${pathPrefix}/([a-z0-9][a-z0-9-]*)"[^>]*>`, 'gi');
}

function candidateBlocks(html, pathPrefix) {
  const value = String(html);
  const blocks = [];
  for (const match of value.matchAll(LIST_ITEM_PATTERN)) {
    const block = elementBlock(value, match.index, match[1]);
    if (block) blocks.push({ start: match.index, end: match.index + block.length, html: block });
  }
  for (const match of value.matchAll(articleLinkPattern(pathPrefix))) {
    const block = elementBlock(value, match.index, 'a');
    if (block) blocks.push({ start: match.index, end: match.index + block.length, html: block });
  }
  return blocks;
}

function distinctSlugs(block, pathPrefix) {
  return [...new Set(
    [...String(block).matchAll(new RegExp(`\\bhref="${pathPrefix}/([a-z0-9][a-z0-9-]*)"`, 'gi'))]
      .map(match => match[1])
  )];
}

// 달력에 없는 날(2026-08-41)을 만들지 않는다. displayDate는 월 이름만 옮기고
// 일자 범위는 보지 않으므로 여기서 되돌려 확인한다.
function calendarDate(value = '') {
  const iso = displayDate(value);
  if (!iso) return '';
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso ? '' : iso;
}

function distinctIsoDates(block) {
  const dates = new Set();
  for (const match of cardText(block).matchAll(MONTH_DAY_YEAR_SCAN)) {
    const iso = calendarDate(match[0]);
    if (iso) dates.add(iso);
  }
  return [...dates];
}

function resolveCards(html, pathPrefix) {
  const value = withoutComments(html);
  const bySlug = new Map();
  for (const block of candidateBlocks(value, pathPrefix)) {
    const slugs = distinctSlugs(block.html, pathPrefix);
    if (slugs.length !== 1) continue;
    const dates = distinctIsoDates(block.html);
    if (dates.length !== 1) continue;
    const [slug] = slugs;
    const previous = bySlug.get(slug);
    // 사본끼리 날짜가 어긋나면 어느 쪽이 맞는지 정할 근거가 없다. 크기로 고르지 말고 버린다.
    if (previous && previous.publishedAt !== dates[0]) {
      previous.dateConflict = true;
      continue;
    }
    if (previous && previous.blockBytes <= block.html.length) continue;
    bySlug.set(slug, {
      slug,
      publishedAt: dates[0],
      path: `${pathPrefix}/${slug}`,
      blockStart: block.start,
      blockBytes: block.html.length,
      dateConflict: previous ? previous.dateConflict === true : false
    });
  }
  return bySlug;
}

/**
 * 목록 HTML에서 (slug, 날짜) 쌍을 뽑는다. 같은 기사가 여러 번(hero·marquee·그리드) 실려도
 * slug 하나당 한 건만 남긴다.
 *
 * 카드 하나가 지켜야 하는 불변식 — 하나라도 깨지면 그 카드는 버린다(fail-closed).
 * 1. 블록 경계가 닫힌다.
 * 2. 블록 안 기사 링크 slug가 정확히 하나다. 같은 slug를 가리키는 <a>가 여럿인 것은
 *    정상이다(Webflow 카드는 clickable overlay·item-link로 같은 slug를 3번 넣는다).
 * 3. 블록 안 날짜가 정확히 하나이고 달력에 있는 날이다.
 * 4. 같은 slug의 사본들이 같은 날짜를 말한다.
 *
 * 목록의 배치 순서(marquee가 grid보다 앞)와 발행 순서는 다르다. 호출부가 '앞에서 N건'을
 * 집는 흔한 실수를 막으려고 최신순으로 돌려준다. 같은 날짜면 문서 위치로 안정 정렬한다.
 */
function parseDatedArticleCards(html = '', { pathPrefix = '/blog' } = {}) {
  return [...resolveCards(html, pathPrefix).values()]
    .filter(card => card.dateConflict !== true)
    .map(({ dateConflict, ...card }) => card)
    .sort((left, right) => (
      left.publishedAt < right.publishedAt ? 1
        : left.publishedAt > right.publishedAt ? -1
          : left.blockStart - right.blockStart
    ));
}

/**
 * 카드가 깨진 이유를 세어 둔다. 파서가 몇 건 뽑았는지만 보면 "0건인데 통과"를 못 잡는다.
 */
function datedArticleCardDiagnostics(html = '', { pathPrefix = '/blog' } = {}) {
  const value = withoutComments(html);
  const anchors = [...value.matchAll(articleLinkPattern(pathPrefix))];
  const anchorSlugs = new Set(anchors.map(match => match[1]));
  const resolved = resolveCards(value, pathPrefix);
  const kept = [...resolved.values()].filter(card => card.dateConflict !== true);
  const keptSlugs = new Set(kept.map(card => card.slug));
  return {
    anchor_count: anchors.length,
    anchor_slug_count: anchorSlugs.size,
    resolved_card_count: kept.length,
    unresolved_slugs: [...anchorSlugs].filter(slug => !keptSlugs.has(slug)).sort(),
    conflicted_slugs: [...resolved.values()].filter(card => card.dateConflict === true).map(card => card.slug).sort()
  };
}

/**
 * 목록에서 한 건도 못 뽑았으면 '이번 주 신규 없음'이 아니라 수집 실패다.
 * 사이트가 href 표기를 바꾸면 unresolved_slugs는 텅 빈 채로 깨끗해 보이므로
 * (분모가 파서와 같은 정규식에서 나온다) 카운트 자체를 판정 근거로 쓴다.
 */
function datedArticleCardCollectionFailure(html = '', { pathPrefix = '/blog' } = {}) {
  const diagnostics = datedArticleCardDiagnostics(html, { pathPrefix });
  if (diagnostics.resolved_card_count > 0) return '';
  return `${pathPrefix} index yielded no dated cards (anchors=${diagnostics.anchor_count}); treat as collection failure, not an empty week`;
}

module.exports = {
  // calendarDate와 distinctIsoDates는 Task 2의 페이지 파서가 같은 날짜 규칙을 쓰려고
  // 가져다 쓴다. 두 파일이 각자 월 이름 표를 두면 두 벌이 어긋난다.
  calendarDate,
  cardText,
  datedArticleCardCollectionFailure,
  datedArticleCardDiagnostics,
  distinctIsoDates,
  elementBlock,
  parseDatedArticleCards
};
