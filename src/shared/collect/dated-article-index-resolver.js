'use strict';

// Claude Blog(/blog)와 Anthropic News(/news) 같은 "인덱스 페이지 + 날짜 있는 개별 기사" 소스를
// 공유하는 흐름 하나로 처리한다. 두 소스의 차이는 config({pathPrefix, origin, componentLabel})로만 받는다.
//
// 목록 → 카드(Task 1) → 창 필터 → 우선순위 → bounded fetch(Task 3) → 개별 페이지 파싱(Task 2) → 후보.
//
// 목록 URL 자체는 절대 후보가 되지 않는다. followed-source 레지스트리(followed-source-item-resolvers.js)에
// 등록되면 shouldSuppressGenericFallback이 켜져서, 이 함수가 빈 배열을 돌려줘도 인덱스 나비링크가
// 후보로 새지 않는다(collect-news-candidates.js의 generic 폴백 억제 지점).
//
// 설계 근거: docs/superpowers/specs/2026-08-22-dated-article-resolver-design.md
const {
  parseDatedArticleCards,
  datedArticleCardCollectionFailure,
  cardText
} = require('./dated-article-card-parsing');
const { resolveDatedArticlePage } = require('./dated-article-page-parsing');
const { MAX_BYTES_PER_ARTICLE } = require('./bounded-fetch-client');
const { dateSourceConfidence } = require('../common/date-signals');

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 7;
const DEFAULT_LOOKBACK_DAYS = 21;
// 설계서 §4.4 운영 기본값. bootstrap(과거 글 일괄 확보)은 이 상수를 올리지 않고 별도 1회성
// 실행으로 분리한다(§4.4) — 이 resolver는 그 분리를 몰라도 된다, 그냥 매 실행 상한만 지킨다.
const MAX_ARTICLES_PER_RUN = 8;

// 앵커가 나온 자리에서 앞뒤로 얼마를 붙여 한 문단으로 볼지. 문장 경계(마침표+공백, 불릿)를
// 만나면 거기서 끊는다. cardText가 이미 개행을 공백 하나로 뭉개므로 개행은 별도 경계로 못 쓴다.
const ANCHOR_PAD = 240;
// 한 기사에서 뽑는 근거 문단의 총 길이 상한.
const WORKFLOW_EVIDENCE_BUDGET = 1500;
// 캡슐까지 가는 섹션 수. article-capsules.js:10의 MAX_WORKFLOW_SECTIONS와 반드시 같은 값이어야
// 한다 — 여기서 더 많이 만들면 그쪽 slice가 나머지를 조용히 잘라 두 상수가 서로 다른 값을
// 가정하는 것처럼 보이는 결과가 나온다.
const MAX_WORKFLOW_SECTIONS = 2;
// 도입부에서 만드는 요약 길이. 앵커 문단을 복사하지 않는다 — summary가 앵커 문구를 담으면
// evidenceMetadata:781이 필드 존재만으로 점수를 줘 evidenceScore 게이트가 형해화된다.
const SUMMARY_LIMIT = 500;
// 본문의 끝. 이 뒤는 관련 기사 목록이고, 인덱스 페이지와 같은 카드 마크업
// (role="listitem" class="blog_cms_item w-dyn-item")을 쓴다. 자르지 않으면 남의 기사 제목과
// 날짜가 이 기사의 summary·sections로 들어간다. 마커가 없으면 문서 끝까지를 본문으로 본다
// (Anthropic News에는 이 구간 자체가 없다) — 없다고 실패로 닫지 않는다.
const ARTICLE_BODY_END_MARKERS = ['blog_related_section_wrap', 'data-cta-position="Related articles"'];

// 설계서 §4.5. 넓게 잡으면(bucket 패턴 전부의 합집합) 추출이 오탐 토큰을 오히려 농축한다는 것이
// 별도 조사에서 확인됐다 — 그래서 workflow 신호로만 좁힌다.
const WORKFLOW_ANCHORS = [
  /\b(?:build|test|CI|CD|debug)\b/i,
  /\b(?:log|logs|trace|metric|metrics|artifact|artifacts)\b/i,
  /\b(?:regression|incident|verification|verify)\b/i,
  /\b(?:code review|pull request|PR|approval|approval gate)\b/i,
  /\b(?:agent|agents|subagent|subagents|Claude Code)\b/i
];

// api_or_component은 본문에서 실제 도구·서비스 이름을 뽑는다. 못 찾으면 config.componentLabel로
// 물러선다. 이 목록은 설계서 §4.5가 예시로 든 다섯 개로 좁힌다 — 임의로 늘리면 근거 없는 라벨을
// 만들 위험이 있다.
const KNOWN_COMPONENT_PATTERN = /\b(?:Claude Code|GitHub Actions|GitHub|PagerDuty|Grafana|Kubernetes)\b/;

// 마침표 또는 불릿 뒤 공백을 문장 경계로 본다.
const SENTENCE_BOUNDARY_PATTERN = /[.•]\s+/;

// 사유를 자유 문자열로 두면 설계서 §4.12의 "사유별 건수"가 집계되지 않는다.
// card_link_mismatch·card_link_ambiguous·month_precision은 Task 1의 카드 파서가 이미
// fail-closed로 걸러서 이 resolver에 도달하지 않는다(카드 하나당 slug 정확히 1개·날짜 정확히
// 1개만 통과시킨다). 그래도 어휘 자체는 설계서 §4.3의 다섯 사유를 그대로 굳혀 exports한다 —
// 이 resolver가 실제로 내는 것은 canonical_mismatch·date_conflict 둘뿐이다.
const FAIL_CLOSED_REASONS = [
  'card_link_mismatch',
  'card_link_ambiguous',
  'canonical_mismatch',
  'date_conflict',
  'month_precision'
];

function noop() {}

function globalPattern(pattern) {
  return new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
}

function countAnchorHits(text) {
  let total = 0;
  for (const pattern of WORKFLOW_ANCHORS) {
    total += [...text.matchAll(globalPattern(pattern))].length;
  }
  return total;
}

// 카드 링크(우리가 만든 articleUrl)와 개별 기사 canonical을 비교하기 전 가벼운 정규화.
// 두 값 모두 이미 절대 URL·소문자 slug이므로 trailing slash 차이만 흡수한다.
function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

/**
 * 개별 기사 raw HTML에서 제목과 본문 평문을 뽑는다. 본문은 <h1>부터
 * ARTICLE_BODY_END_MARKERS 중 먼저 나오는 자리 앞까지다(마커가 없으면 문서 끝까지).
 * <h1>이 없으면(비정상 fixture 등) 문서 전체를 본문으로, 제목은 빈 문자열로 둔다.
 */
function extractArticleBody(html) {
  const value = String(html || '');
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(value);
  const title = heading ? cardText(heading[1]) : '';
  const bodyStart = heading ? heading.index : 0;
  let bodyEnd = value.length;
  for (const marker of ARTICLE_BODY_END_MARKERS) {
    const markerIndex = value.indexOf(marker, bodyStart);
    if (markerIndex >= 0 && markerIndex < bodyEnd) bodyEnd = markerIndex;
  }
  return { title, bodyText: cardText(value.slice(bodyStart, bodyEnd)) };
}

// 문장 단위로 자르되 각 문장의 시작/끝 offset도 함께 돌려준다(뒤에서 그 offset을 기준으로
// ANCHOR_PAD 문단을 만들어야 하므로).
function splitSentencesWithOffsets(text) {
  const sentences = [];
  const pattern = globalPattern(SENTENCE_BOUNDARY_PATTERN);
  let start = 0;
  let match = pattern.exec(text);
  while (match) {
    const end = match.index + match[0].length;
    sentences.push({ start, end, text: text.slice(start, end) });
    start = end;
    match = pattern.exec(text);
  }
  if (start < text.length) sentences.push({ start, end: text.length, text: text.slice(start) });
  return sentences;
}

// [hitStart, hitEnd) 주변으로 ANCHOR_PAD만큼 넓힌 뒤, 그 안에서 가장 가까운 문장 경계로
// 안쪽으로 당긴다. 경계를 못 찾으면 패딩 끝을 그대로 쓴다(하드 컷).
function trimToSentenceBoundary(text, hitStart, hitEnd) {
  const padStart = Math.max(0, hitStart - ANCHOR_PAD);
  const padEnd = Math.min(text.length, hitEnd + ANCHOR_PAD);
  const before = text.slice(padStart, hitStart);
  const after = text.slice(hitEnd, padEnd);

  let start = padStart;
  const beforeMatches = [...before.matchAll(globalPattern(SENTENCE_BOUNDARY_PATTERN))];
  if (beforeMatches.length > 0) {
    const last = beforeMatches[beforeMatches.length - 1];
    start = padStart + last.index + last[0].length;
  }

  let end = padEnd;
  const afterMatch = globalPattern(SENTENCE_BOUNDARY_PATTERN).exec(after);
  if (afterMatch) end = hitEnd + afterMatch.index + afterMatch[0].length;

  return { start, end };
}

/**
 * workflow 근거 추출. summary와 behavior_change/sections는 서로 다른 구간에서 나온다 —
 * summary는 도입부 SUMMARY_LIMIT자, 근거는 그 뒤(rest)에서만 찾는다. 겹치지 않게 분리해 둬야
 * "summary가 앵커 문구를 담으면 이 test는 앵커가 아니라 summary를 재게 된다"는 골든 케이스의
 * 음성 대조군이 항상 성립한다.
 *
 * behavior_change는 rest 전체에서 앵커 밀도가 가장 높은 한 문장이다(문단이 아니라 문장 —
 * ANCHOR_PAD로 넓힌 문단 단위로 순위를 매기면 반복되는 흔한 카테고리(예: CI/CD가 자주 나오는
 * 문단)가 항상 이겨서, 드물지만 결정적인 카테고리(예: 이 기사에서 3번뿐인 PR/approval)가 항상
 * 밀려난다 — 실측으로 확인).
 *
 * sections는 behavior_change를 포함해 앵커 밀도가 높은 상위 MAX_WORKFLOW_SECTIONS개 문장을
 * 각각 ANCHOR_PAD로 넓힌 문단이다. 동점이면 문서에 먼저 나온 쪽을 남긴다(Array.prototype.sort는
 * 안정 정렬이고 원본 문장 배열은 이미 문서 순서다).
 */
function workflowEvidence(bodyText) {
  const summary = bodyText.slice(0, SUMMARY_LIMIT).trim();
  const rest = bodyText.slice(SUMMARY_LIMIT);

  const rankedSentences = splitSentencesWithOffsets(rest)
    .map(sentence => ({ ...sentence, score: countAnchorHits(sentence.text) }))
    .filter(sentence => sentence.score > 0)
    .sort((left, right) => right.score - left.score);

  const behaviorChange = rankedSentences.length > 0 ? rankedSentences[0].text.trim() : '';

  let budget = WORKFLOW_EVIDENCE_BUDGET;
  const sections = [];
  for (const sentence of rankedSentences.slice(0, MAX_WORKFLOW_SECTIONS)) {
    if (budget <= 0) break;
    const { start, end } = trimToSentenceBoundary(rest, sentence.start, sentence.end);
    let paragraph = rest.slice(start, end).trim();
    if (!paragraph) continue;
    if (paragraph.length > budget) paragraph = paragraph.slice(0, budget).trim();
    if (!paragraph) continue;
    sections.push({ heading: '', items: [{ text: paragraph }] });
    budget -= paragraph.length;
  }

  const componentMatch = KNOWN_COMPONENT_PATTERN.exec(bodyText);
  return { summary, behaviorChange, sections, component: componentMatch ? componentMatch[0] : '' };
}

/**
 * 목록 카드 날짜를 기준으로 수집 창 구간을 매긴다. 창 밖이면 null(fetch 대상에서 아예 제외).
 * 'recent' = 최근 RECENT_WINDOW_DAYS일, 'mid' = 그 뒤부터 lookbackDays까지.
 * 카드 날짜는 Task 1이 이미 달력에 있는 날 하나로 보장하므로 파싱 실패는 여기서 다루지 않는다.
 */
function windowTier(cardDate, now, lookbackDays) {
  const releasedMs = Date.parse(`${cardDate}T00:00:00Z`);
  if (!Number.isFinite(releasedMs)) return null;
  const ageMs = now.getTime() - releasedMs;
  if (ageMs < 0 || ageMs > lookbackDays * DAY_MS) return null;
  return ageMs <= RECENT_WINDOW_DAYS * DAY_MS ? 'recent' : 'mid';
}

/**
 * 목록 페이지 html에서 날짜가 결속된 개별 기사 후보를 만든다. 인덱스 URL 자체는 절대
 * 후보가 되지 않는다(카드가 0건이어도 그냥 빈 배열).
 */
async function resolveDatedArticleIndexItems({
  html = '',
  source = {},
  fetchClient,
  now,
  lookbackDays,
  config = {},
  onDiagnostic
} = {}) {
  const emit = typeof onDiagnostic === 'function' ? onDiagnostic : noop;
  if (!fetchClient || typeof fetchClient.fetchBounded !== 'function') return [];

  const resolvedNow = now instanceof Date ? now : new Date();
  const resolvedLookbackDays = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? lookbackDays
    : DEFAULT_LOOKBACK_DAYS;
  const pathPrefix = config.pathPrefix || '/blog';
  const origin = config.origin || '';
  const componentLabel = config.componentLabel || '';
  const parentUrl = `${origin}${pathPrefix}`;
  const parentTitle = source.name || '';

  // 목록에서 한 건도 못 뽑았으면 '이번 주 신규 없음'이 아니라 수집 실패다(Task 1 계약).
  // 이 resolver의 반환값은 두 경우 모두 빈 배열이라 구분이 안 되므로 운영자용으로 남긴다.
  const collectionFailure = datedArticleCardCollectionFailure(html, { pathPrefix });
  if (collectionFailure) console.warn(`dated-article-index-resolver: ${collectionFailure}`);

  const cards = parseDatedArticleCards(html, { pathPrefix });

  // fetch 우선순위(설계서 §4.8):
  // 1. canonical dedupe — Task 1의 parseDatedArticleCards가 이미 slug당 카드 1개만 돌려주므로
  //    여기서 다시 할 일이 없다.
  // 2~3. 목록 날짜 기준 window 분류 후 최근 7일을 먼저 큐에 넣는다.
  // 4. '날짜 미확정' 구간은 Task 1이 이미 달력에 있는 날 하나를 보장해서 이 resolver에는
  //    도달하지 않는다(카드가 존재한다는 것 자체가 날짜가 확정됐다는 뜻이다) — 그래서 이 구간은
  //    비어 있는 채로 우선순위에서 자연히 빠진다.
  // 5. 그다음 8~lookbackDays일 구간.
  // 6. 구간 안 "미수집 -> workflow 신호(category·title) 순" tie-break는 생략한다 — Task 1의
  //    카드 구조가 slug/날짜/위치만 주고 title·category 텍스트를 노출하지 않는다. 대신 Task 1이
  //    이미 보장하는 최신순 문서 순서를 tie-break로 쓴다(각 구간 안에서 배열 순서가 유지된다).
  const recentCards = [];
  const midCards = [];
  for (const card of cards) {
    const tier = windowTier(card.publishedAt, resolvedNow, resolvedLookbackDays);
    if (tier === 'recent') recentCards.push(card);
    else if (tier === 'mid') midCards.push(card);
  }
  const orderedQueue = [...recentCards, ...midCards].slice(0, MAX_ARTICLES_PER_RUN);

  const results = [];
  const recentBudgetSkips = [];

  for (const card of orderedQueue) {
    const articleUrl = `${origin}${card.path}`;

    // 한 기사 fetch 결과를 판정한다. 어느 쪽이든 그 기사만 건너뛰고 루프는 계속한다 — 한 건의
    // 404로 나머지를 버리면 소스 전체가 조용히 0건이 된다. 예산(truncated||sourceBudgetExhausted)을
    // 먼저 보고, 그 다음 !ok를 본다 — Task 3이 상한에 걸린 2xx의 ok를 false로 두므로 순서를
    // 뒤집으면 예산 초과가 fetch 실패로 둔갑한다.
    const response = await fetchClient.fetchBounded(articleUrl, { maxBytes: MAX_BYTES_PER_ARTICLE });

    if (response.truncated || response.sourceBudgetExhausted) {
      emit({
        kind: 'skipped_article_budget',
        url: articleUrl,
        receivedBytes: response.receivedBytes,
        limitedBy: response.limitedBy,
        detail: 'article exceeded the byte budget'
      });
      if (recentCards.includes(card)) recentBudgetSkips.push(card);
      continue;
    }
    if (!response.ok || !response.body) {
      emit({
        kind: 'article_fetch_failed',
        url: articleUrl,
        receivedBytes: response.receivedBytes,
        limitedBy: '',
        status: response.status,
        attempts: response.attempts,
        error: response.error || `http_${response.status}`,
        detail: 'article fetch failed; the list-row date alone cannot bind a candidate'
      });
      continue;
    }

    const page = resolveDatedArticlePage(response.body);

    // canonical 확인이 날짜보다 먼저다 — canonical이 다르면 우리가 받은 페이지가 애초에
    // 이 카드가 가리킨 기사가 아니므로(목록에서 사라졌거나 다른 글로 리다이렉트), 그 페이지가
    // 준 날짜도 신뢰할 근거가 없다.
    const normalizedCardLink = normalizeUrl(articleUrl);
    const canonicalMatches = normalizedCardLink !== '' && normalizedCardLink === normalizeUrl(page.canonical_url);
    if (!canonicalMatches) {
      emit({
        kind: 'fail_closed',
        url: articleUrl,
        receivedBytes: 0,
        limitedBy: '',
        reason: 'canonical_mismatch',
        detail: 'article canonical url does not match the list card link'
      });
      continue;
    }

    // 날짜 2단계(설계서 §4.3).
    // 1) 개별 페이지가 날짜를 주면 그것을 쓴다 — 단, 목록 날짜와 다르면 무엇을 믿을지 정할
    //    근거가 없으므로 fail-closed(date_conflict)다.
    // 2) 개별 페이지가 날짜를 못 주면(canonical은 이미 확인됐다) 목록 날짜로 보완한다
    //    (release_row_date, 신뢰도 95).
    const pageDate = page.published_date;
    const listDate = card.publishedAt;
    let publishedAt;
    let effectiveDate;
    let dateSource;
    let dateEvidenceUrl;

    if (pageDate) {
      if (pageDate !== listDate) {
        emit({
          kind: 'fail_closed',
          url: articleUrl,
          receivedBytes: 0,
          limitedBy: '',
          reason: 'date_conflict',
          detail: `article page date ${pageDate} disagrees with list card date ${listDate}`
        });
        continue;
      }
      publishedAt = pageDate;
      effectiveDate = pageDate;
      dateSource = page.date_source; // 'visible_date' | 'structured_date_published'
      dateEvidenceUrl = page.canonical_url;
    } else {
      publishedAt = '';
      effectiveDate = listDate;
      dateSource = 'release_row_date';
      dateEvidenceUrl = parentUrl;
    }

    const parsedBody = extractArticleBody(response.body);
    const evidence = workflowEvidence(parsedBody.bodyText);

    results.push({
      source,
      title: parsedBody.title,
      url: page.canonical_url,
      sourceKind: 'blog_post_item', // collectionMode는 설정하지 않는다 —
      // collect-news-candidates.js가 이 sourceKind로부터 'article-item'을 파생한다.
      parentUrl,
      parentTitle,
      publishedAt,
      effective_date: effectiveDate,
      date_source: dateSource,
      date_confidence: dateSourceConfidence(dateSource),
      date_evidence_url: dateEvidenceUrl,
      summary: evidence.summary,
      api_or_component: evidence.component || componentLabel,
      behavior_change: evidence.behaviorChange,
      source_extraction: { workflow: { sections: evidence.sections } },
      relevanceBucketHint: '' // 분류는 후속 PR이 한다.
    });
  }

  // 최근 7일 기사가 예산 때문에 생략된 채 남아 있으면 알린다. remainingBytes()는 단조 감소라
  // 루프가 끝난 시점에 0이면 그 사이 어느 시점에 소스 예산이 실제로 바닥났다는 뜻이다.
  if (recentBudgetSkips.length > 0 && fetchClient.remainingBytes() <= 0) {
    emit({
      kind: 'recent_window_budget_exhausted',
      url: parentUrl,
      receivedBytes: 0,
      limitedBy: 'source-run',
      detail: `${recentBudgetSkips.length} recent-window article(s) skipped because the source run budget is exhausted`
    });
  }

  return results;
}

module.exports = {
  FAIL_CLOSED_REASONS,
  resolveDatedArticleIndexItems
};
