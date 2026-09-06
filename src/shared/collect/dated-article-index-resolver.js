'use strict';

// Claude Blog(/blog)와 Anthropic News(/news) 같은 "인덱스 페이지 + 날짜 있는 개별 기사" 소스를
// 공유하는 흐름 하나로 처리한다. 두 소스의 차이는 registry(news-sources.json)의 sourceUrl 하나이며,
// 이 파일이 그 값에서 origin과 경로 접두사를 파생한다 — 같은 사실을 코드에 다시 적지 않는다.
//
// 목록 → 카드(Task 1) → 창 필터 → 우선순위 → bounded fetch(Task 3) → 개별 페이지 파싱(Task 2) → 후보.
//
// 목록 URL 자체는 절대 후보가 되지 않는다. followed-source 레지스트리(followed-source-item-resolvers.js)에
// 등록되면 shouldSuppressGenericFallback이 켜져서, 이 함수가 빈 배열을 돌려줘도 인덱스 나비링크가
// 후보로 새지 않는다(collect-news-candidates.js의 generic 폴백 억제 지점).
const {
  parseDatedArticleCards,
  datedArticleCardCollectionFailure,
  datedArticleCardDiagnostics,
  cardText
} = require('./dated-article-card-parsing');
const { resolveDatedArticlePage } = require('./dated-article-page-parsing');
const { MAX_BYTES_PER_ARTICLE } = require('./bounded-fetch-client');
const { dateSourceConfidence } = require('../common/date-signals');

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 7;
const DEFAULT_LOOKBACK_DAYS = 21;
// 운영 기본값. bootstrap(과거 글 일괄 확보)은 이 상수를 올리지 않고 별도 1회성
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
// 본문의 끝 후보. 자르지 않으면 이 기사 뒤에 오는 것들(남의 기사 카드, 사이트 내비·푸터)이
// 이 기사의 summary·behavior_change·sections로 들어간다.
//
// 후보는 두 갈래다. 아래 ARTICLE_BODY_END_MARKERS는 Claude Blog(Webflow) 관련 기사 목록의
// 표지다. 그 구간은 인덱스 페이지와 같은 카드 마크업(role="listitem" class="blog_cms_item
// w-dyn-item")을 써서, 남기면 남의 기사 제목과 날짜가 이 기사의 근거가 된다.
//
// ARTICLE_BODY_CLOSING_TAG_MARKERS는 닫는 태그다. Anthropic News(/news) 마크업에는 위 마커가
// 한 건도 없어서, 마커만 후보이던 동안에는 본문이 문서 끝까지로 잡혀 사이트 푸터의 제품 목록이
// behavior_change와 sections[0]에 실렸다(#964). 그 페이지는 <main> 안에 <article>이 두 겹
// (hero 하나 + 본문 하나)이라 첫 </article>이 본문의 끝이고, 그 뒤로 각주 블록과
// "Related content" 섹션과 푸터가 이어진다.
//
// 실측(2026-08-30, 라이브 /news 기사 11건 + 라이브 claude.com/blog 기사 5건):
// - 첫 </article>이 /news 11건 전부에서 경계가 된다. 그 경계가 없으면 11건 전부
//   behavior_change나 sections에 푸터 문구("Read more Products Claude Claude Code ...")가
//   들어간다.
// - </main>은 두 소스 어디에서도 이기지 못한다. 두 수치 모두 </main>까지의 간격이다:
//   /news는 첫 </article>이 5,008~8,151자 먼저 오고, claude.com/blog는 </article>이 아예 없는
//   대신 관련 기사 마커가 56,630~57,896자 먼저 온다(라이브 blog 23건, 간격이 거의 일정하다).
//   그래도 남겨 둔다 — <article>도 관련 기사 마커도 없는 페이지에서 푸터를 막아 줄 마지막
//   후보이기 때문이고, 그 경로는 합성 HTML 테스트가 잠근다.
//
// 대가: 첫 </article> 뒤에 오는 각주(Footnotes) 블록이 본문에서 함께 잘린다(11건 중 6건).
// improving-fable-5-s-biology-safeguards는 각주에만 실제 수치("67% on Claude.ai, 55% on
// Cowork, 17% on Claude Code, 7% on the Claude Platform")가 있어서, 잘리면 본문이
// 10,832 -> 8,495자가 되고 앵커가 6 -> 0으로 떨어져 behavior_change와 sections가 빈 값이 된다.
// 그래도 이 경계를 쓰는 이유는 셋이다.
// 1) 각주를 살리고 "Related content"만 배제하려면 그 섹션 전용 마커가 필요한데, 쓸 만한 것이
//    구조 경계보다 약하다. 해시를 와일드카드로 둔 모듈명 마커
//    (/<section class="LandingPageSection-module-scss-module__[^"]*__root"/)는 라이브 11건에서
//    그 섹션만 집는 것으로 확인됐다 — 즉 "대안이 없다"가 아니라 "대안이 더 약하다"가 맞다.
//    그 마커가 깨져 </main>로 떨어지면 11건 중 5건에 남의 기사 카드가 근거로 들어온다(실측).
//    class를 해시째 박는 것은 재배포 때 바뀌어 더 나쁘고(ZSMdoa 같은 빌드 해시),
//    <section> 태그 자체는 본문 안에도 나오며(model-hardware-standard 기사 본문에 6개 —
//    <section>을 경계로 쓰면 그 기사가 118,000자를 잃는다), "Related content" 문자열 매칭은
//    문구가 바뀌거나 지역화되면 깨진다. 그래서 구조 경계인 </article>을 택했다.
// 2) 각주가 잘리는 6건 중 실제로 근거가 달라지는 것은 위 1건뿐이다. 나머지 5건은 각주를
//    남기든 버리든 behavior_change와 sections가 글자 그대로 같다(실측).
// 3) 그 1건에서 각주를 살려 얻는 근거는 "Footnotes 1 As a result, ..."로 시작하는 각주
//    문장이다. 그것을 얻으려고 경계를 넓히면 경계가 깨진 날 푸터가 다시 근거가 된다.
//    근거가 비는 것이 사이트 내비·푸터를 근거로 쓰는 것보다 낫다.
// 이 손실은 anthropic-news-improving-fable-5-biology-safeguards.html 픽스처와 그 테스트가
// 드러낸다 — 경계를 옮기려면 그 테스트를 먼저 고쳐야 한다.
//
// 닫는 태그 후보는 <h1>을 찾은 페이지에서만 쓴다. <h1>이 없으면 본문이 어디서 시작하는지 알
// 수 없어 bodyStart가 0이 되는데, 그 상태에서는 문서 맨 앞의 내비를 닫는 </article> 하나가
// 진짜 본문보다 앞서서 본문 전체를 버린다(재현: '<article><nav>내비</nav></article><main><p>
// 본문</p></main>'이 내비 문구만 남긴다). 관련 기사 마커는 그 위험이 없다 — 문서 어디에 있든
// 그 자리가 관련 기사 목록의 시작이다.
//
// 후보가 하나도 안 잡히면 문서 끝까지를 본문으로 본다 — 없다고 실패로 닫지 않는다.
const ARTICLE_BODY_END_MARKERS = [
  /blog_related_section_wrap/,
  /data-cta-position="Related articles"/
];
const ARTICLE_BODY_CLOSING_TAG_MARKERS = [
  /<\/article\s*>/i,
  /<\/main\s*>/i
];

// 넓게 잡으면(bucket 패턴 전부의 합집합) 추출이 오탐 토큰을 오히려 농축한다는 것이
// 별도 조사에서 확인됐다 — 그래서 workflow 신호로만 좁힌다.
const WORKFLOW_ANCHORS = [
  /\b(?:build|test|CI|CD|debug)\b/i,
  /\b(?:log|logs|trace|metric|metrics|artifact|artifacts)\b/i,
  /\b(?:regression|incident|verification|verify)\b/i,
  /\b(?:code review|pull request|PR|approval|approval gate)\b/i,
  /\b(?:agent|agents|subagent|subagents|Claude Code)\b/i
];

// api_or_component은 본문에서 실제 도구·서비스 이름을 뽑아야만 채워진다. 못 찾으면 빈 문자열로
// 남긴다 — 소스별 상수(예: 'Claude Code / AI coding agent')로 대체하지 않는다. 그런 상수는
// 실제로 측정한 적 없는 값인데도 이 슬롯을 항상 채워, evidenceMetadata의 6점 게이트(발행일 2 +
// api_or_component 2 + behavior_change 2)를 이 소스의 모든 후보가 구조적으로 통과하게 만들었다
// (risk-reviewer 지적, 2026-08). 지금은 relevanceBucketHint가 비어 있어(분류는 후속 PR) 그 효과가
// 안 보이지만, 후속 PR이 이 lane을 일반 후보 풀로 열면 그 즉시 게이트가 무력화된다. 그래서 이
// 목록은 아래 여섯 개로 좁힌다 — 임의로 늘리면 근거 없는 라벨을 만들 위험이 있다.
const KNOWN_COMPONENT_PATTERN = /\b(?:Claude Code|GitHub Actions|GitHub|PagerDuty|Grafana|Kubernetes)\b/;

// 마침표 또는 불릿 뒤 공백을 문장 경계로 본다.
const SENTENCE_BOUNDARY_PATTERN = /[.•]\s+/;

// 사유를 자유 문자열로 두면 "사유별 건수"가 집계되지 않는다.
// card_link_mismatch·card_link_ambiguous·month_precision은 Task 1의 카드 파서가 이미
// fail-closed로 걸러서 이 resolver에 도달하지 않는다(카드 하나당 slug 정확히 1개·날짜 정확히
// 1개만 통과시킨다). 그래도 어휘 자체는 다섯 사유를 그대로 굳혀 exports한다 —
// 이 resolver가 실제로 내는 것은 canonical_mismatch·date_conflict 둘뿐이다.
const FAIL_CLOSED_REASONS = [
  'card_link_mismatch',
  'card_link_ambiguous',
  'canonical_mismatch',
  'date_conflict',
  'month_precision'
];

// 진단 kind 어휘의 정본도 여기다. collect-news-candidates.js가 별도로 같은 목록을 들고 있으면
// (FAIL_CLOSED_REASONS와 같은 이유로) 두 목록이 갈라질 수 있다 — resolver가 새 kind를 내기
// 시작해도 collector 쪽 목록에 더하는 걸 잊으면 사건은 나는데 요약 집계는 조용히 0으로 남는다.
// skipped_index_budget은 이 resolver가 아니라 collector(fetchSourceIndexText)가 내지만,
// "닫힌 어휘"는 kind를 내는 모든 위치가 공유해야 하는 계약이라 여기 정본에 함께 둔다.
// collection_window_truncated는 dated-article 리졸버가 아니라 목록을 페이지로 따라가는 수집기
// (patchwork-libcamera-patches, gerrit-camera-changes)가 낸다. 그 수집기들은 자기 상한에 걸려
// 수집 창을 끝까지 못 읽고 멈추는데, 그 상태는 산출물에서 "이번 주 신호 없음"과 같은 모양이다.
// skipped_index_budget과 같은 이유로 여기 정본에 함께 둔다.
// aosp_site_update_* 셋은 aosp-site-update-dates 가 낸다. 그 리졸버도 bounded client 를 쓰므로
// 이벤트가 같은 배열에 모이고 같은 요약(summarizeDatedArticleCollection)이 센다. 어휘 밖 이름은
// 'unknown' 으로 접히므로, 여기 적지 않으면 사건은 나는데 어느 사건인지가 요약에서 사라진다.
const DATED_ARTICLE_DIAGNOSTIC_KINDS = [
  'skipped_index_budget',
  'skipped_article_budget',
  'article_fetch_failed',
  'recent_window_budget_exhausted',
  'fail_closed',
  'index_collection_failed',
  'collection_window_truncated',
  'aosp_site_update_date_lookup_failed',
  'aosp_site_update_date_lookup_skipped',
  'aosp_site_update_date_outside_row_month',
  // followed-resolver 가 0건을 낸 사건. 그 소스는 제너릭 폴백이 막혀 있어 산출물에서
  // "조용한 주"와 모양이 같아진다. collector 만 그 둘을 가를 사실을 쥐고 있다.
  'followed_resolver_yielded_nothing'
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
 * 개별 기사 raw HTML에서 제목과 본문 평문을 뽑는다. 본문은 <h1>부터 경계 후보 중 먼저 나오는
 * 자리 앞까지다(후보가 하나도 없으면 문서 끝까지).
 * <h1>이 없으면(비정상 fixture 등) 문서 전체를 본문으로, 제목은 빈 문자열로 둔다 — 이때는
 * 닫는 태그 후보를 쓰지 않는다(ARTICLE_BODY_CLOSING_TAG_MARKERS 주석의 이유).
 */
function extractArticleBody(html) {
  const value = String(html || '');
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(value);
  const title = heading ? cardText(heading[1]) : '';
  const bodyStart = heading ? heading.index : 0;
  const markers = heading
    ? [...ARTICLE_BODY_END_MARKERS, ...ARTICLE_BODY_CLOSING_TAG_MARKERS]
    : ARTICLE_BODY_END_MARKERS;
  // 본문 시작 뒤에서만 후보를 찾는다. 여는 태그가 <h1>보다 앞에서 열린다는 사실은 이유가 되지
  // 못한다 — 닫는 태그를 찾는 데 여는 태그 위치는 쓰이지 않고, 라이브 /news 11건은 전부
  // <h1>(13,470~15,614)이 첫 닫는 태그(18,630~145,928)보다 앞이다. 이 slice가 막는 것은 그
  // 반대 배치다: 닫는 태그가 <h1>보다 앞에 있는 페이지에서 문서 처음부터 찾으면 bodyEnd가
  // bodyStart보다 앞서고, slice(bodyStart, bodyEnd)가 빈 본문을 돌려준다. 시작점을 수정 전과
  // 같게 유지해 그 경우에도 본문이 통째로 사라지지 않게 한다.
  const afterBodyStart = value.slice(bodyStart);
  let bodyEnd = value.length;
  for (const marker of markers) {
    const markerIndex = afterBodyStart.search(marker);
    if (markerIndex >= 0 && bodyStart + markerIndex < bodyEnd) bodyEnd = bodyStart + markerIndex;
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

// 두 문단 구간이 [start, end)로 서로 조금이라도 닿는지. 비율이나 유사도가 아니라 구간 교차
// 하나만 본다 — 한 글자라도 겹치면 같은 문장을 나눠 가진 것이고, 그게 막으려는 상태다.
function spansOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
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
 * sections는 behavior_change를 포함해 앵커 밀도가 높은 문장을 각각 ANCHOR_PAD로 넓힌 문단
 * MAX_WORKFLOW_SECTIONS개다. 동점이면 문서에 먼저 나온 쪽을 남긴다(Array.prototype.sort는
 * 안정 정렬이고 원본 문장 배열은 이미 문서 순서다).
 *
 * 여기서 중복 두 종류를 서로 다르게 다룬다. 판단 기준은 "캡슐의 같은 슬롯 안에서 같은 문단이
 * 두 번 세어지는가"다.
 *
 * 1) 섹션끼리의 중복은 막는다. 상위 두 문장이 본문에서 이웃하면 각각을 ANCHOR_PAD로 넓힌 두
 *    문단이 같은 구간을 담는다(합성 본문 실측: 1위 문단 [264,404), 2위 문단 [341,466)에서
 *    "The logs, trace output and metrics land in an artifact bundle." 한 문장이 양쪽에 그대로
 *    들어갔다). 둘 다 source_extraction.workflow.sections 한 슬롯으로 가므로 근거 2건처럼
 *    보이지만 실은 문단 1건이고, 그 중복 텍스트가 WORKFLOW_EVIDENCE_BUDGET을 먹어 다른 구간의
 *    근거는 예산이 없어 못 들어온다. 그래서 이미 채택한 [start, end) 구간과 겹치는 문장은
 *    건너뛰고 다음 순위로 넘어간다.
 *    상위 MAX_WORKFLOW_SECTIONS개만 시도하고 끝내면 건너뛴 만큼 섹션이 그냥 비어 근거가 오히려
 *    줄어든다. 그래서 순위 목록 전체를 훑되 채택 수가 MAX_WORKFLOW_SECTIONS에 닿으면 멈춘다 —
 *    "상위 2개를 시도한다"가 아니라 "겹치지 않는 2개를 채운다"가 이 루프의 계약이다.
 * 2) behavior_change와 섹션의 중복은 그대로 둔다(의도된 중복). behavior_change는 문장 하나짜리
 *    필드로 캡슐의 evidence 줄("behavior_change: ...", article-capsules.js:123)에 실리고,
 *    섹션은 그 문장을 둘러싼 문단으로 캡슐의 source_extraction.workflow(같은 파일 :175)에
 *    실린다. 1위 문장을 섹션에서 빼면 앵커 밀도가 가장 높은 문단이 통째로 사라져 근거가
 *    오히려 약해지므로, 중복을 지우는 쪽이 더 손해다.
 *    다만 #965 이후로는 두 값이 source_fact_bundle.facts 한 목록에도 별개 항목으로 실린다.
 *    거기서 겹침을 지우지 않는 이유는 uniqueFacts가 정확 일치만 보기 때문이고, 포함관계까지
 *    걸러내면 release 계열 후보의 기존 출력이 함께 바뀐다. 그래서 workflow 후보의 fact_count는
 *    문장과 문단을 각각 세어, 실제로 구별되는 근거 구간보다 1 크게 나올 수 있다.
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
  const takenSpans = [];
  for (const sentence of rankedSentences) {
    if (sections.length >= MAX_WORKFLOW_SECTIONS) break;
    if (budget <= 0) break;
    const span = trimToSentenceBoundary(rest, sentence.start, sentence.end);
    if (takenSpans.some(taken => spansOverlap(taken, span))) continue;
    let paragraph = rest.slice(span.start, span.end).trim();
    if (!paragraph) continue;
    if (paragraph.length > budget) paragraph = paragraph.slice(0, budget).trim();
    if (!paragraph) continue;
    sections.push({ heading: '', items: [{ text: paragraph }] });
    // 실제로 섹션을 실은 구간만 기록한다 — 위 continue로 버려진 구간까지 막으면 근거 없이
    // 뒤 순위를 잘라내게 된다.
    takenSpans.push(span);
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

// Task 1의 카드는 title·category를 노출하지 않으므로 slug를 신호원으로 쓴다. hyphen을 공백으로
// 바꾸면('nightly-ci-build-debug-report' -> 'nightly ci build debug report') WORKFLOW_ANCHORS의
// \b 경계 매치가 그대로 작동한다.
function slugWorkflowSignalScore(card) {
  return countAnchorHits(String(card.slug || '').replace(/-/g, ' '));
}

/**
 * 한 window 구간(recent 또는 mid) 안에서만 workflow 신호 점수로 재정렬한다. 구간을 넘나드는
 * 재정렬은 하지 않는다 — 오래된 구간의 신호 강한 글이 최신 구간 글보다 앞서면 안 된다.
 * 동점(대부분의 카드는 slug에 신호가 없어 점수 0으로 동점)이면 Array.prototype.sort의 안정성이
 * Task 1이 이미 보장한 최신순 문서 순서를 그대로 유지한다.
 */
function prioritizeByWorkflowSignal(tierCards) {
  return [...tierCards].sort((left, right) => slugWorkflowSignalScore(right) - slugWorkflowSignalScore(left));
}

/**
 * registry entry의 sourceUrl에서 목록 origin과 경로 접두사를 파생한다. 후행 슬래시는 몇 개든
 * 지운다 — 기사 URL을 `${origin}${pathPrefix}/${slug}`로 조립하고 카드 링크도 같은 접두사로
 * 찾으므로, `/blog/`를 그대로 두면 링크 패턴이 `href="/blog//slug"`가 돼 카드가 한 건도 안
 * 잡힌다. 하나만 지우면 `/blog//`(오타) 하나가 validate:config를 통과한 채 같은 0건으로
 * 닫힌다. 같은 collect layer의 canonicalDocumentUrl도 `/\/+$/`로 지운다.
 * sourceUrl이 없거나 절대 URL이 아니면 null을 돌려준다(기본 경로로 대신 도는 일은 없다).
 *
 * 슬래시를 지우고 나서 경로가 하나도 안 남는 sourceUrl(`https://claude.com`,
 * `https://claude.com/`, `https://claude.com//`)도 같은 null이다. 빈 접두사를 돌려주면 파생은
 * 성공한 것처럼 보여 아래 guard를 그냥 지나가지만, 링크 패턴이 `href="/([a-z0-9][a-z0-9-]*)"`로
 * 줄어 한 세그먼트짜리 루트 링크만 매치한다 — 진짜 기사 `/blog/post-one`은 버려지고
 * `/pricing`·`/careers` 같은 비기사 링크가 후보가 되는데 진단은 0건이라 운영자가 알 방법이 없다.
 * validate:config의 isHttpUrl은 protocol만 보므로 이런 registry 값이 게이트를 통과한다.
 */
function deriveIndexLocation(sourceUrl) {
  try {
    const parsed = new URL(String(sourceUrl));
    const pathPrefix = parsed.pathname.replace(/\/+$/, '');
    return pathPrefix ? { origin: parsed.origin, pathPrefix } : null;
  } catch {
    return null;
  }
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
  onDiagnostic,
  onArticleCapCounts
} = {}) {
  const emit = typeof onDiagnostic === 'function' ? onDiagnostic : noop;

  // 목록 주소의 정본은 registry(news-sources.json)의 sourceUrl 하나다. origin·경로를 호출부
  // 상수로 또 들고 있으면 registry만 바꿨을 때 인덱스는 새 주소로 받고 카드 매칭과 기사 URL
  // 조립은 옛 경로로 돈다 — 결과는 카드 0건(index_collection_failed)인데 진단이 가리키는
  // 원인("마크업이 바뀌었다")이 실제 원인("registry와 코드가 갈라졌다")과 다르다.
  const indexLocation = deriveIndexLocation(source.sourceUrl);
  if (!indexLocation) {
    // 기본 경로로 대신 돌면 엉뚱한 주소를 훑은 실패가 canonical_mismatch 같은 다른 사유로
    // 기록돼, 여기서도 진단이 실제 원인을 못 가리킨다. 그래서 명시적으로 0건으로 닫는다.
    emit({
      kind: 'index_collection_failed',
      url: String(source.sourceUrl || ''),
      receivedBytes: 0,
      limitedBy: '',
      detail: 'dated article resolver could not derive the index origin and path from source.sourceUrl '
        + '(registry entry has no absolute sourceUrl, or its sourceUrl has no path to scope the index scan to)'
    });
    return [];
  }
  const { origin, pathPrefix } = indexLocation;
  const parentUrl = `${origin}${pathPrefix}`;

  // 소스가 followed-source 레지스트리(requiresFetchClient: true)에 등록됐는데도 collector가
  // bounded client를 못 만들어 넘긴 경우다(예: 등록 후 client 배선을 빠뜨린 실수). 조용히 빈
  // 배열만 돌려주면 이 사건은 어디에도 안 남는다 — index_collection_failed와 같은 kind로 내되
  // detail로 "마크업이 깨졌다"가 아니라 "애초에 client가 없었다"임을 구분한다.
  if (!fetchClient || typeof fetchClient.fetchBounded !== 'function') {
    emit({
      kind: 'index_collection_failed',
      url: parentUrl,
      receivedBytes: 0,
      limitedBy: '',
      detail: 'dated article resolver called without a usable fetchClient (source registered but not wired to a bounded fetch client)'
    });
    return [];
  }

  const resolvedNow = now instanceof Date ? now : new Date();
  const resolvedLookbackDays = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? lookbackDays
    : DEFAULT_LOOKBACK_DAYS;
  const parentTitle = source.name || '';

  // 목록에서 한 건도 못 뽑았으면 '이번 주 신규 없음'이 아니라 수집 실패다(Task 1 계약).
  // 이 resolver의 반환값은 두 경우 모두 빈 배열이라 구분이 안 된다. console.warn만으로는
  // 이 사건이 artifact에 남지 않아 다섯 개 덜 중요한 사건은 세면서 가장 시끄러운 실패만
  // 조용히 사라진다 — 그래서 다른 다섯 kind와 똑같이 onDiagnostic으로 낸다.
  const collectionFailure = datedArticleCardCollectionFailure(html, { pathPrefix });
  if (collectionFailure) {
    const cardDiagnostics = datedArticleCardDiagnostics(html, { pathPrefix });
    emit({
      kind: 'index_collection_failed',
      url: parentUrl,
      receivedBytes: 0,
      limitedBy: '',
      detail: collectionFailure,
      anchor_count: cardDiagnostics.anchor_count,
      anchor_slug_count: cardDiagnostics.anchor_slug_count,
      resolved_card_count: cardDiagnostics.resolved_card_count,
      unresolved_count: cardDiagnostics.unresolved_slugs.length,
      conflicted_count: cardDiagnostics.conflicted_slugs.length
    });
  }

  const cards = parseDatedArticleCards(html, { pathPrefix });

  // fetch 우선순위(2026-08-23 fix round 1로 6번 구현):
  // 1. canonical dedupe — Task 1의 parseDatedArticleCards가 이미 slug당 카드 1개만 돌려주므로
  //    여기서 다시 할 일이 없다.
  // 2~3. 목록 날짜 기준 window 분류 후 최근 7일을 먼저 큐에 넣는다.
  // 4. '날짜 미확정' 구간은 Task 1이 이미 달력에 있는 날 하나를 보장해서 이 resolver에는
  //    도달하지 않는다(카드가 존재한다는 것 자체가 날짜가 확정됐다는 뜻이다) — 그래서 이 구간은
  //    비어 있는 채로 우선순위에서 자연히 빠진다.
  // 5. 그다음 8~lookbackDays일 구간.
  // 6. 구간 안 "미수집 -> workflow 신호(category·title) 순" tie-break: Task 1의 카드
  //    ({slug, publishedAt, path, blockStart, blockBytes})는 title·category 텍스트를 노출하지
  //    않는다. 그래서 신호원으로 slug를 쓴다 — hyphen을 공백으로 바꾸면('ai-ci-cd-on-call' ->
  //    'ai ci cd on call') 이미 갖고 있는 WORKFLOW_ANCHORS 정규식이 그대로 매치된다(새 어휘 없음).
  //    이 tie-break가 없으면 안 되는 이유: MAX_ARTICLES_PER_RUN=8은 실제 라이브 인덱스의 창 안
  //    기사 수(25건 중 21건이 21일 창 안)보다 훨씬 작다. 문서 순서(최신순)만 쓰면 8건 컷 바로
  //    밖에 있는 workflow 신호 강한 글이 매주 조용히 사라진다 — 이 PR이 없애려는 바로 그 맹점이
  //    신호원만 바뀐 채 재발한다. tie-break는 구간(recent/mid) 안에서만 적용한다 — 최신 기사가
  //    신호 점수 때문에 오래된 구간 기사에 밀리면 안 된다. 동점이면 문서 순서(Task 1이 보장하는
  //    최신순, 배열 안정 정렬로 유지)를 따른다.
  const recentCards = [];
  const midCards = [];
  for (const card of cards) {
    const tier = windowTier(card.publishedAt, resolvedNow, resolvedLookbackDays);
    if (tier === 'recent') recentCards.push(card);
    else if (tier === 'mid') midCards.push(card);
  }
  const windowedQueue = [...prioritizeByWorkflowSignal(recentCards), ...prioritizeByWorkflowSignal(midCards)];
  // 상한 도달은 정상 상태다 — 사건(kind)이 아니라 소스별 카운터로 남긴다. 라이브 Claude Blog
  // 인덱스는 25건 중 21건이 창 안이고 MAX_ARTICLES_PER_RUN=8이라, 매 실행 약 13건이 카운터 없이는
  // 조용히 사라진다(artifact의 모든 관련 필드가 0으로 읽힌다).
  const inWindowCardCount = windowedQueue.length;
  const orderedQueue = windowedQueue.slice(0, MAX_ARTICLES_PER_RUN);
  const scheduledArticleCount = orderedQueue.length;
  const skippedArticleCapCount = inWindowCardCount - scheduledArticleCount;
  if (typeof onArticleCapCounts === 'function') {
    onArticleCapCounts({
      in_window_card_count: inWindowCardCount,
      scheduled_article_count: scheduledArticleCount,
      skipped_article_cap_count: skippedArticleCapCount
    });
  }

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

    // 날짜 3단계.
    // 0) 페이지 자기 내부(헤더 가시 날짜 vs JSON-LD)에서 이미 날짜가 갈렸으면
    //    (dated-article-page-parsing.js의 date_conflict) 목록 날짜로 보완하면 안 된다 —
    //    페이지 스스로 "내 날짜를 못 믿는다"고 말한 것이지 "날짜가 없다"가 아니다. pageDate가
    //    ''라서 아래 else 분기(release_row_date)로 흘러들면, 자기모순을 알린 페이지가 목록
    //    날짜로 세탁돼 신뢰도 95짜리 publish-ready 후보가 된다 — 이 페이지가 정확히 막으려던
    //    상황이다. 그래서 여기서 fail-closed하고 다음 카드로 넘어간다.
    // 1) 페이지 내부는 갈리지 않고 날짜를 주면 그것을 쓴다 — 단, 목록 날짜와 다르면 무엇을
    //    믿을지 정할 근거가 없으므로 fail-closed(date_conflict)다.
    // 2) 개별 페이지가 날짜를 못 주면(canonical은 이미 확인됐다) 목록 날짜로 보완한다
    //    (release_row_date, 신뢰도 95).
    if (page.date_conflict) {
      emit({
        kind: 'fail_closed',
        url: articleUrl,
        receivedBytes: 0,
        limitedBy: '',
        reason: 'date_conflict',
        detail: `article page's own date signals disagree (header ${page.header_visible_date || '(none)'} `
          + `vs structured ${page.json_ld_date_published || '(none)'}); the page does not trust its own `
          + 'date, so the list-row date cannot be used to fill it in'
      });
      continue;
    }

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
      api_or_component: evidence.component,
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
  DATED_ARTICLE_DIAGNOSTIC_KINDS,
  FAIL_CLOSED_REASONS,
  resolveDatedArticleIndexItems
};
