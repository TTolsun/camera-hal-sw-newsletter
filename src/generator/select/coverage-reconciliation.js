'use strict';

// #724: LLM coverage 권한 wiring — 결정론 재조정.
//
// editorial-plan LLM은 후보별 coverage_decision(main_article/reference_only/exclude)을
// "제안"만 한다. 이 순수 함수가 그 제안을 받아 결정론 불변식을 강제해 최종 main 집합을
// 만든다:
//   1. 제안 tier 매핑 (미채점 후보는 결정론 tier 유지)
//   2. 승급 자격 가드 — main은 결정론적으로 main-eligible한 후보만
//   3. cap clamp — mainArticleCount.max / supportingMainMaxAllowed / forbidden
//   4. 발행가능 floor backfill — LLM은 뉴스레터를 발행불가로 만들 수 없다
//
// hard blocker(source-binding/evidence/freshness/hard-fail)는 이 모듈 밖 결정론
// validator가 그대로 담당한다. 이 슬라이스는 main 집합만 다루며 reference_only와 exclude는
// 둘 다 "main 아님"으로 collapse한다(참고자료 섹션은 기존 결정론 로직 유지).
const { ensureArray } = require('../../shared/common/value-coercion');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const { candidateGroupKey } = require('../../shared/common/article-groups');

const COVERAGE_MAIN = 'main_article';

// #909: reason_code는 기계가 읽는 값이라 LLM 원문을 그대로 이어붙이면 안 된다.
// coverage_decision은 스키마상 자유 문자열이고(enum 없음) 프롬프트 문장만이 값을 제한하므로,
// 모르는 값은 `editorial_plan_unrecognized`로 접고 원문은 coverage_decision에 그대로 남긴다.
// #969: 이 집합은 프롬프트가 제시하는 등급 목록의 사본이다. 프롬프트에 없는 값이 여기 남아
// 있으면 모델 드리프트가 정상 판단으로 기록된다. short_mention은 렌더 경로가 없어 제거했다.
const KNOWN_COVERAGE_DECISIONS = new Set(['main_article', 'reference_only', 'exclude']);

function demotionReasonCode({ proposedMain, coverageDecision }) {
  // main 제안까지 갔다가 빠졌으면 원인은 cap이다. 편집 계획 등급이 무엇이었든 마찬가지다.
  if (proposedMain) return 'cap_clamp';
  if (!coverageDecision) return 'unknown';
  if (!KNOWN_COVERAGE_DECISIONS.has(coverageDecision)) return 'editorial_plan_unrecognized';
  return `editorial_plan_${coverageDecision}`;
}

function forbiddenBuckets() {
  return new Set(ensureArray(articlePolicy.forbiddenMainBuckets));
}

function supportingBuckets() {
  return new Set(ensureArray(articlePolicy.supportingMainBuckets));
}

// dedup·backfill·diff 로그에 쓰는 후보 안정 식별자. selected/reserve 후보는
// url_hash를 가지며 url로 폴백한다.
function candidateKey(candidate) {
  return String(candidate?.url_hash || candidate?.url || candidate?.title || '').trim();
}

// 후보 목록의 대표 그룹키를 입력 순서대로, 중복 없이 뽑는다.
function uniqueGroupKeys(candidates) {
  return [...new Set(ensureArray(candidates).map(candidateGroupKey).filter(Boolean))];
}

// 승급 가드: LLM은 결정론이 이미 main 자격을 준 후보만 main으로 올릴 수 있다.
function isDeterministicallyMainEligible(candidate) {
  if (!candidate) return false;
  if (candidate.main_article_source_allowed !== true) return false;
  if (candidate.main_article_score_eligible === false) return false;
  if (forbiddenBuckets().has(String(candidate.relevance_bucket || ''))) return false;
  return true;
}

// LLM 제안을 견고하게 조회한다 — url 우선(양쪽 다 보유), url_hash/candidate_id 폴백
// (editorial_plans는 source_candidate_hash를 echo, 후보는 url_hash를 가짐).
function buildCoverageLookup(editorialPlanReport) {
  const byUrl = new Map();
  const byHash = new Map();
  for (const plan of ensureArray(editorialPlanReport?.editorial_plans)) {
    const entry = {
      // trim 없이 두면 " main_article"이 COVERAGE_MAIN과 안 맞아 main 제안이 조용히 강등된다.
      coverage_decision: String(plan?.coverage_decision || '').trim()
    };
    const url = String(plan?.url || '').trim();
    const hash = String(plan?.source_candidate_hash || '').trim();
    if (url) byUrl.set(url, entry);
    if (hash) byHash.set(hash, entry);
  }
  return { byUrl, byHash };
}

function coverageFor(lookup, candidate) {
  const url = String(candidate?.url || '').trim();
  if (url && lookup.byUrl.has(url)) return lookup.byUrl.get(url);
  const hash = String(
    candidate?.url_hash || candidate?.source_candidate_hash || candidate?.candidate_id || ''
  ).trim();
  if (hash && lookup.byHash.has(hash)) return lookup.byHash.get(hash);
  return null;
}

// cap clamp 순서: deterministic_score desc 단독.
//
// #1001: 예전에는 LLM impact_level을 1차 정렬 키로 두고 점수를 tiebreak로 썼지만, 그 순위표는
// high/medium/low 어휘였고 편집 계획 프롬프트는 Direct Impact / Design Reference / Trend Watch /
// Exclude를 지시한다. 겹치는 값이 없어 순위는 프로덕션에서 언제나 0이었고, 실제 clamp는 처음부터
// 점수 단독 정렬이었다. 어휘를 맞추면 그 순간부터 LLM 판단이 cap clamp 결과를 좌우하게 되므로
// (결정론/LLM 권한 경계를 넓히는 정책 변경이다) 죽은 정렬 키를 지워 현재 동작을 그대로 적는다.
function orderForClamp(items) {
  return [...items].sort((a, b) =>
    Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0));
}

function applyCaps(proposedMain) {
  // deterministic_score 순서는 cap 초과 시 "무엇을 떨굴지"만 정한다. emit 순서는 결정론 입력
  // 순서(proposedMain, editorial_priority 우선)를 보존해야 리드/본문 순서가 뒤집히지 않는다.
  const ordered = orderForClamp(proposedMain);
  const supporting = supportingBuckets();
  const supportingMax = Number(articlePolicy.publishReadyComposition?.supportingMainMaxAllowed ?? 1);
  const mainMax = Number(articlePolicy.mainArticleCount?.max ?? 5);
  const survivors = new Set();
  let supportingCount = 0;
  for (const candidate of ordered) {
    if (survivors.size >= mainMax) break;
    const isSupporting = supporting.has(String(candidate.relevance_bucket || ''));
    if (isSupporting && supportingCount >= supportingMax) continue;
    if (isSupporting) supportingCount += 1;
    survivors.add(candidateKey(candidate));
  }
  return proposedMain.filter(candidate => survivors.has(candidateKey(candidate)));
}

// 결정론 재조정 진입점. 항상 실행된다(toggle 없음) — LLM coverage 제안을 받아 결정론
// 불변식(승급 자격 가드·cap clamp·발행 floor backfill)을 강제한 최종 main 집합을 돌려준다.
function reconcileCoverage({ shortlistReport, editorialPlanReport } = {}) {
  const deterministicSelected = ensureArray(shortlistReport?.selected_articles);
  const reserve = ensureArray(shortlistReport?.reserve_candidates);
  // #1034: 채점 투영 전용 우주다. 편집 계획은 selected+reserve가 아니라 shortlisted capsule
  // 전체를 채점하므로(입력이 capsuleInputFromReport(articleCapsuleReport, 'shortlisted')),
  // 투영이 이 목록을 못 보면 매주 채점된 후보 1~2건이 조용히 빠진다. 아래 판정 단계는 이
  // 목록을 절대 읽지 않는다 — main 승급 자격은 결정론 선정과 reserve로 닫혀 있어야 한다.
  const scoredUniverse = ensureArray(shortlistReport?.shortlisted_candidates);
  const lookup = buildCoverageLookup(editorialPlanReport);
  const entryFor = (candidate) => coverageFor(lookup, candidate);
  const deterministicKeys = new Set(deterministicSelected.map(candidateKey));
  const changes = [];

  // 1-2. 제안 main 집합 + 승급 가드.
  const proposedMain = [];
  const seen = new Set();
  for (const candidate of [...deterministicSelected, ...reserve]) {
    const key = candidateKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    const grade = entryFor(candidate)?.coverage_decision || '';
    const wasMain = deterministicKeys.has(key);
    const proposesMain = grade ? grade === COVERAGE_MAIN : wasMain;
    if (!proposesMain) continue;
    if (isDeterministicallyMainEligible(candidate) || wasMain) {
      proposedMain.push(candidate);
    } else {
      // #1034: 사유는 변화를 만든 자리에서 세운다. 나중에 action으로 유추하면 소비자마다
      // 어휘가 갈리고, 이미 사유가 있는 강등과 규칙이 둘로 나뉜다.
      changes.push({ key, action: 'promotion_blocked_ineligible', reason_code: 'promotion_blocked_ineligible' });
    }
  }

  // 3. cap clamp.
  const proposedMainKeys = new Set(proposedMain.map(candidateKey));
  const clamped = applyCaps(proposedMain);
  const clampedKeys = new Set(clamped.map(candidateKey));

  // 4. 발행가능 floor backfill. deterministicSelected는 이미 forbidden-free이고, 현재
  //    mainArticleCount.min===1·supportingMainMaxAllowed===1이라 최대 1건만 backfill돼 cap을
  //    깨지 않는다. min을 1보다 크게 올리면 backfill이 supporting cap을 넘길 수 있으므로 그때는
  //    backfill도 applyCaps와 동일한 keep-predicate를 거쳐야 한다.
  const mainMin = Number(articlePolicy.mainArticleCount?.min ?? 1);
  if (clamped.length < mainMin) {
    const backfill = deterministicSelected
      .filter(candidate => !clampedKeys.has(candidateKey(candidate)))
      .sort((a, b) => Number(b.deterministic_score || 0) - Number(a.deterministic_score || 0));
    for (const candidate of backfill) {
      if (clamped.length >= mainMin) break;
      clamped.push(candidate);
      clampedKeys.add(candidateKey(candidate));
      changes.push({ key: candidateKey(candidate), action: 'floor_backfill', reason_code: 'floor_backfill' });
    }
  }

  // 결정론 baseline 대비 강등/승급 기록.
  //
  // #909: 강등에는 원본 판단과 실제 전환 원인을 **따로** 남긴다. LLM이 main_article로 제안한
  // 후보도 cap clamp에 밀리면 강등되므로, 제안(coverage_decision)을 그대로 사유로 복사하면
  // "왜 빠졌나"에 답하지 못한다(reason_code=main_article 같은 무의미한 기록이 남는다).
  for (const candidate of deterministicSelected) {
    const key = candidateKey(candidate);
    if (clampedKeys.has(key)) continue;
    const coverageDecision = entryFor(candidate)?.coverage_decision || '';
    changes.push({
      key,
      article_group_key: candidateGroupKey(candidate),
      action: 'demoted',
      coverage_decision: coverageDecision,
      reason_code: demotionReasonCode({
        proposedMain: proposedMainKeys.has(key),
        coverageDecision
      })
    });
  }
  for (const candidate of clamped) {
    if (!deterministicKeys.has(candidateKey(candidate))) {
      changes.push({ key: candidateKey(candidate), action: 'promoted', reason_code: 'promoted' });
    }
  }

  // #837: 재조정이 main 집합을 바꾸면 그 집합에서 파생된 요약도 같이 바뀌어야 한다.
  // 정본만 갈아끼우고 파생을 그대로 두면 generation-status의 coverage 등식
  // (selected === rendered + demoted + hardBlocked)이 재조정 前 좌변과 재조정 後
  // 우변을 섞어 계산해 정상 발행에도 group_coverage_ok=false를 찍는다.
  // 파생을 여기서 함께 내보내 호출부가 필드를 하나씩 대입하지 않게 한다.
  const deterministicGroupKeys = uniqueGroupKeys(deterministicSelected);
  const reconciledGroupKeys = uniqueGroupKeys(clamped);
  const reconciledGroupKeySet = new Set(reconciledGroupKeys);
  const deterministicGroupKeySet = new Set(deterministicGroupKeys);
  const demotedGroupKeys = deterministicGroupKeys.filter(key => !reconciledGroupKeySet.has(key));

  // #909: 리뷰가 읽는 정본은 그룹 단위다. candidate 단위 changes를 그대로 올리면 같은 그룹의
  // 후보 하나만 빠진 경우까지 "그룹 강등"으로 읽혀 진단이 왜곡된다. 그래서 그룹이 실제로
  // 사라진 경우(demotedGroupKeys)에만, 그 그룹에서 빠진 후보들의 사유를 모아 싣는다.
  const demotedChangesByGroup = new Map();
  for (const change of changes) {
    if (change.action !== 'demoted') continue;
    const groupKey = change.article_group_key;
    if (!groupKey) continue;
    if (!demotedChangesByGroup.has(groupKey)) demotedChangesByGroup.set(groupKey, []);
    demotedChangesByGroup.get(groupKey).push(change);
  }
  const demotedGroups = demotedGroupKeys.map(groupKey => ({
    article_group_key: groupKey,
    // 후보별 레코드를 그대로 싣는다. 사유·판단·후보를 각각 배열로 쪼개면 서로 독립적으로
    // dedup·필터링돼 짝이 어긋나고(빈 coverage_decision 하나면 인덱스가 밀린다), 길이가 우연히
    // 맞는 경우에는 뒤집힌 짝이 조용히 남는다. 단위는 그룹이되 짝은 후보 안에서 보존한다.
    demoted_candidates: (demotedChangesByGroup.get(groupKey) || []).map(change => ({
      candidate_key: change.key,
      coverage_decision: change.coverage_decision,
      reason_code: change.reason_code
    }))
  }));

  // #1034: 강등분만 남기면 계획이 채점한 후보의 나머지가 커밋 산출물 어디에도 남지 않는다.
  // reserve로 남은 후보와 catch-up pool 후보는 애초에 강등 대상이 아니라 위 목록에 절대
  // 나타나지 않고, 판단 원본을 담은 editorial-plan.json은 보존 등급이 debug_heavy라 커밋되지
  // 않는다. 그래서 "그 주 reserve 후보를 계획이 어떻게 채점했나"를 사후에 답할 수 없었다.
  // 채점된 후보 전부를 강등 여부와 무관하게 싣는다. 관측이지 판정이 아니라 게이트에 쓰이지
  // 않는다.
  //
  // reason_code는 "결정론 편성 대비 무슨 일이 있었나"를 담는다. 사유를 갖는 변화는 네 갈래이고,
  // changes.push가 일어나는 자리와 정확히 일대일이다:
  //   demoted(cap_clamp | editorial_plan_*) / promotion_blocked_ineligible / floor_backfill / promoted
  // 실제로 뭔가 일어난 후보가 null로 남으면 "아무 일도 없었다"로 잘못 읽힌다. 승급과 복귀는
  // 그 후보가 발행되는 경로라 특히 그렇다. 아무 일도 없던 후보만 null이다.
  //
  // 사유는 push 지점이 세우므로 여기서는 유추하지 않는다. 한 후보가 두 갈래에 걸리지는
  // 않는다 — backfill된 후보는 clampedKeys에 들어가 강등 루프가 건너뛰고, 승급·승급 차단은
  // 결정론 선정 밖 후보라 강등·복귀와 애초에 집합이 겹치지 않는다.
  const reasonCodeByCandidateKey = new Map(
    changes
      .filter(change => change.reason_code)
      .map(change => [change.key, change.reason_code])
  );
  const scoredCandidates = [];
  const scoredCandidateKeys = new Set();
  // 우주는 계획 입력과 같아야 한다. 어느 배열에서 후보를 만났는지가 곧 결정론 편성에서의
  // 역할이므로 배열마다 이름을 달아 돌고, 먼저 만난 역할을 남긴 뒤 키로 중복을 지운다.
  const scoredLineup = [
    ['selected', deterministicSelected],
    ['reserve', reserve],
    ['shortlisted', scoredUniverse]
  ];
  for (const [lineupRole, candidates] of scoredLineup) {
    for (const candidate of candidates) {
      const key = candidateKey(candidate);
      if (scoredCandidateKeys.has(key)) continue;
      const coverageDecision = entryFor(candidate)?.coverage_decision || '';
      // 채점되지 않은 후보는 담지 않는다. 목록이 "등급을 실제로 받은 후보"만 담아야 부재가
      // 곧 미채점이라는 답이 된다. 여기서 읽는 판단은 재조정이 실제로 본 값과 같은 조회를
      // 거치므로, 계획 항목 조회가 빗나간 후보도 재조정이 그랬듯 미채점으로 남는다.
      if (!coverageDecision) continue;
      scoredCandidateKeys.add(key);
      scoredCandidates.push({
        candidate_key: key,
        // #1034: 후보가 결정론 편성에서 어디에 있었나. candidate_key는 불투명 해시(sha256)라
        // 그것만으로는 어느 레코드가 reserve였는지 알 수 없고, 이슈의 검증 질문 1이 정확히
        // 그것을 묻는다. 그룹키로는 답할 수 없다 — 한 그룹키가 여러 후보를 접기 때문이다
        // (공유 explicit 키·lore 패치 시리즈·native tooling 상수). 그래서 후보 단위 사실로 싣는다.
        // 재조정 뒤 최종 main 여부는 이 값이 아니라 reason_code가 답한다(promoted/floor_backfill).
        lineup_role: lineupRole,
        // 강등 기록(reconciliation_demoted_groups)과 교차 참조하는 용도로 함께 싣는다.
        // #913이 그 기록에 쓴 키와 같은 함수라 두 목록을 그룹 단위로 이을 수 있다.
        article_group_key: candidateGroupKey(candidate),
        coverage_decision: coverageDecision,
        reason_code: reasonCodeByCandidateKey.get(key) || null
      });
    }
  }

  return {
    selected: clamped,
    // 재조정된 main 집합에서 파생되는 shortlistReport 요약 필드.
    selection_summary: {
      selected_article_count: clamped.length,
      selected_group_count: reconciledGroupKeys.length,
      selected_representative_group_keys: reconciledGroupKeys
    },
    diff: {
      deterministic_selected: [...deterministicKeys],
      reconciled_selected: clamped.map(candidateKey),
      changes,
      // 그룹 단위 provenance. changes[].key는 candidateKey(url_hash/url/title)라
      // 그룹키와 네임스페이스가 달라 그대로 쓰면 selected와 매칭되지 않는다. 또 같은
      // 그룹의 다른 후보가 살아남았으면 그룹이 강등된 게 아니므로 집합 차집합으로 센다.
      deterministic_selected_group_keys: deterministicGroupKeys,
      demoted_group_keys: demotedGroupKeys,
      demoted_groups: demotedGroups,
      editorial_plan_scored_candidates: scoredCandidates,
      promoted_group_keys: reconciledGroupKeys.filter(key => !deterministicGroupKeySet.has(key))
    }
  };
}

module.exports = {
  reconcileCoverage,
  isDeterministicallyMainEligible,
  candidateKey,
  // 테스트가 프롬프트 목록과 양방향으로 대조하려고 읽는다. 런타임 소비자는 없다.
  KNOWN_COVERAGE_DECISIONS
};
