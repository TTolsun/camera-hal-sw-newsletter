const { ensureArray } = require('../../shared/common/value-coercion');
const { candidateGroupKey } = require('../../shared/common/article-groups');
const { buildCandidateIndex, candidateForSection } = require('../editor/editor-contract-helpers');
function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).join(' ');
  return String(value || '').trim();
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value) {
  return normalize(value).replace(/[^a-z0-9가-힣]+/g, '');
}

function sourceUrls(section) {
  return ensureArray(section?.sources).map(source => text(source?.url)).filter(Boolean);
}

function sourceTitles(section) {
  return ensureArray(section?.sources).map(source => text(source?.title)).filter(Boolean);
}

function sectionSummary(section, index = 0) {
  return {
    index: index + 1,
    headline: text(section?.headline),
    source_urls: sourceUrls(section),
    source_titles: sourceTitles(section),
    version_or_release: text(section?.version_or_release || section?.versionOrRelease),
    api_or_component: text(section?.api_or_component || section?.apiOrComponent),
    behavior_change: text(section?.behavior_change || section?.behaviorChange),
    relevance_bucket: text(section?.relevance_bucket),
    editorial_priority: section?.editorial_priority ?? ''
  };
}

function sectionEvidenceText(section) {
  return [
    section?.headline,
    section?.category,
    section?.what_changed,
    section?.confirmed_facts,
    section?.evidence_summary,
    section?.specificity_checks,
    section?.source_verification_notes,
    section?.article_sections,
    section?.camera_hal_checks,
    section?.action_items,
    section?.version_or_release,
    section?.api_or_component,
    section?.behavior_change,
    section?.relevance_bucket,
    section?.editorial_priority,
    ensureArray(section?.sources).map(source => `${source?.title || ''} ${source?.url || ''}`).join(' ')
  ].map(text).join(' ');
}

function candidateEvidenceText(candidate) {
  return [
    candidate?.title,
    candidate?.summary,
    candidate?.source,
    candidate?.url,
    candidate?.article_url,
    candidate?.version_or_release,
    candidate?.api_or_component,
    candidate?.behavior_change,
    candidate?.relevance_bucket,
    candidate?.editorial_priority,
    candidate?.evidence_notes,
    candidate?.source_hint
  ].map(text).join(' ');
}

// 기사 하나를 다른 기사와 구분해 주는 낱말만 남긴다.
//
// claimKeysForSection의 키(headline 전문, source_url, version 등)로는 못 잡는 잔재가 있다.
// 실제로 막힌 사례(2026-08-10)에서 남은 것은 'Sony IMX576'이라는 센서 모델명이었는데,
// headline 전문은 본문에 그대로 나타나지 않고 version('1.32.0')·api('v4l2')는
// textContainsClaim의 8자 하한에 걸려 거부됐다.
//
// 삭제 키는 두 관문을 모두 통과해야 한다. 문장을 지우는 일이라 넓게 잡으면 살아남은
// 기사의 참인 문장이 조용히 상투구로 바뀐다.
//
//  1. 모델명 형태여야 한다 — 글자 두 개 이상 뒤에 숫자 두 개 이상(imx576·ar0234·hm1092).
//     'csi-2'·'10-bit'·'6.17.1'·'h.264'는 이 형태가 아니라 통과하지 못한다.
//  2. 살아남은 기사들이 쓰지 않는 낱말이어야 한다(차집합). 차집합의 바탕은 최종 기사의
//     **전체 내용**이다 — 공개 본문(public_article)까지 본다. evidence 필드만 빼면
//     본문에서만 쓰인 모델명이 차집합에 남아 그 기사 문장을 지운다.
//
// 낱말은 구분자(- . _ @)로 한 번 더 쪼갠 하위 낱말까지 본다. 'IMX576-based'가 한 낱말로
// 잡히면 이 변경이 잡으려던 잔재를 그대로 놓친다(실측 확인).
const DROPPED_GROUP_TOKEN_FIELD = 'dropped_group_token';
const MODEL_IDENTIFIER_PATTERN = /^[a-z]{2,}\d{2,}[a-z0-9]*$/;

// 모델명과 같은 모양이지만 기사 식별자가 아닌 것들 — 픽셀 포맷과 비트 깊이 어휘다.
// 'RAW10'은 imx576과 같은 모양(글자+숫자)이라 패턴만으로는 갈라지지 않는데, 빠진 기사와
// 살아남은 기사가 같은 포맷을 다루면서 표기가 달라 차집합에 남는 일이 실제로 생긴다
// (테스트가 이 오탐을 잡았다). 닫힌 어휘라 목록으로 두는 편이 규칙을 비트는 것보다 낫다.
// 목록이 아니라 접두사 규칙으로 둔다. 'RAW10'을 목록에 넣어도 'SBGGR10'·'SRGGB12' 같은
// V4L2 미디어버스 포맷이 같은 방식으로 새어 나오기 때문이다. 실제 센서 부품번호
// (imx*/ov*/ar*/hm*/gc*/sc*)는 이 접두사들과 겹치지 않는다.
const FORMAT_VOCABULARY_PATTERN =
  /^(?:raw|rgb|bgr|argb|bgra|rgba|yuv|yuyv|uyvy|nv|sbggr|srggb|sgrbg|sgbrg|bayer|mipi|srgb)\d+[a-z0-9]*$/;

function textTokens(value) {
  const raw = String(text(value) || '')
    .toLowerCase()
    .normalize('NFC')
    .match(/[a-z0-9][a-z0-9._@-]*|[가-힣]{2,}/g) || [];
  const tokens = new Set();
  for (const token of raw) {
    tokens.add(token);
    for (const part of token.split(/[._@-]+/)) {
      if (part) tokens.add(part);
    }
  }
  return [...tokens];
}

function looksLikeModelIdentifier(token) {
  if (FORMAT_VOCABULARY_PATTERN.test(token)) return false;
  return MODEL_IDENTIFIER_PATTERN.test(token);
}

// 최종 기사가 독자에게 내보내는 모든 글. evidence 필드만 보면 공개 본문에서만 쓰인
// 낱말이 차집합에 남아 그 기사의 문장을 지운다.
function sectionSurvivingText(section) {
  // article_sections는 sectionEvidenceText가 이미 담는다. 공개 본문만 더한다.
  return [sectionEvidenceText(section), text(section?.public_article)].join(' ');
}

function droppedGroupTokenClaimKeys(droppedCandidates, finalSections) {
  const survivingTokens = new Set(
    ensureArray(finalSections).flatMap(section => textTokens(sectionSurvivingText(section)))
  );
  const keys = new Map();
  for (const candidate of ensureArray(droppedCandidates)) {
    // url은 제외한다. 기존 source_url claim key가 이미 담당하고, 호스트 이름까지 삭제
    // 키로 쓰면 기사 식별과 무관한 문장이 지워진다.
    const source = [candidate?.title, candidate?.headline].map(text).join(' ');
    for (const token of textTokens(source)) {
      if (survivingTokens.has(token)) continue;
      if (!looksLikeModelIdentifier(token)) continue;
      if (keys.has(token)) continue;
      keys.set(token, {
        field: DROPPED_GROUP_TOKEN_FIELD,
        value: token,
        normalized: token,
        compact: compact(token)
      });
    }
  }
  return [...keys.values()];
}

function claimKeysForSection(section) {
  const keys = [];
  const fields = {
    headline: section?.headline,
    source_url: sourceUrls(section),
    source_title: sourceTitles(section),
    version_or_release: section?.version_or_release || section?.versionOrRelease,
    api_or_component: section?.api_or_component || section?.apiOrComponent,
    behavior_change: section?.behavior_change || section?.behaviorChange,
    relevance_bucket: section?.relevance_bucket,
    editorial_priority: section?.editorial_priority
  };

  for (const [field, raw] of Object.entries(fields)) {
    for (const value of ensureArray(raw).length > 0 ? ensureArray(raw) : [raw]) {
      const claim = text(value);
      if (!claim || claim.length < 3) continue;
      keys.push({
        field,
        value: claim,
        normalized: normalize(claim),
        compact: compact(claim)
      });
    }
  }

  for (const claim of releaseClaimsFromText(sectionEvidenceText(section))) {
    keys.push({
      field: 'release_claim',
      value: claim,
      normalized: normalize(claim),
      compact: compact(claim)
    });
  }

  const seen = new Set();
  return keys.filter(key => {
    const dedupeKey = `${key.field}:${key.compact}`;
    if (!key.compact || seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}

function releaseClaimsFromText(value) {
  const body = text(value);
  const patterns = [
    /\bAndroid\s+\d+\s+Beta\s+\d+\b/gi,
    /\bAndroid\s+\d+(?:\.\d+)?\s+(?:Beta|QPR|Developer Preview|DP|stable|release)\s*\d*\b/gi,
    /\bCameraX\s+\d+(?:\.\d+){1,3}(?:[-\w.]*)?\b/gi,
    /\blibcamera\s+\d+(?:\.\d+){1,3}(?:[-\w.]*)?\b/gi,
    /\bV4L2\s+\d+(?:\.\d+){1,3}(?:[-\w.]*)?\b/gi,
    /\bLinux\s+\d+(?:\.\d+){1,3}(?:[-\w.]*)?\b/gi,
    /\bkernel\s+\d+(?:\.\d+){1,3}(?:[-\w.]*)?\b/gi,
    /\b(?:Snapdragon|Exynos|Tensor|Dimensity)\s+[A-Za-z0-9+.-]+\b/gi,
    /\b(?:CPU|GPU|NPU|ISP|DSP)\s+[A-Za-z0-9+.-]+\s+(?:release|driver|firmware|update|launch)\b/gi
  ];
  const claims = [];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) {
      claims.push(match[0].replace(/\s+/g, ' ').trim());
    }
  }
  return [...new Set(claims)];
}

function textContainsClaim(value, claim) {
  const body = normalize(value);
  const packed = compact(value);
  if (!body || !claim?.compact) return false;
  // 낱말 단위로 본다. 부분 문자열로 보면 'imx57'이 'imx576'에 걸리는 식의 오탐이 난다.
  // 아래 8자 하한은 이 계열에 적용하지 않는다 — 안전장치는 모델명 형태 판정과 살아남은
  // 기사와의 차집합이고, 둘 다 키를 만드는 droppedGroupTokenClaimKeys에서 이미 걸렀다.
  if (claim.field === DROPPED_GROUP_TOKEN_FIELD) {
    return textTokens(value).includes(claim.normalized);
  }
  if (claim.field === 'source_url') return body.includes(claim.normalized);
  if (claim.compact.length < 8 && claim.field !== 'editorial_priority') return false;
  return body.includes(claim.normalized) || packed.includes(claim.compact);
}

function hasClaimSupport(claim, evidenceText) {
  if (!claim?.compact) return false;
  return textContainsClaim(evidenceText, claim);
}

function finalSourceMap(editor) {
  const refs = new Map();
  for (const section of ensureArray(editor?.sections)) {
    for (const source of ensureArray(section?.sources)) {
      if (!source?.url) continue;
      refs.set(source.url, { title: source.title || source.url, url: source.url });
    }
  }
  return refs;
}

function splitSentences(value) {
  const normalized = text(value);
  if (!normalized) return [];
  return normalized
    .replace(/([.!?。？！])\s+/g, '$1\n')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

// 스크럽이 채워 넣는 대체 문장은 기사에서 값을 가져오지 않는다. briefing과 action_items
// 두 생성기에 같은 규칙을 적용한다. 이유는 두 가지이고, 둘 다 결정론 스크럽이 스스로 발행을
// 막는 형태다.
//
//  1. `${headline}: ...` 형태는 headline이 후보 title과 같은 주에 newsletter-quality의
//     briefingRawCopyFindings에 "출처 제목을 그대로 베낀 bullet"으로 걸린다(-6, blocking).
//     그 검사의 대상은 LLM이 제목을 베끼는 것이므로 검사를 비켜 가게 만들지 않고, 스크럽이
//     제목을 인용하지 않게 한다. 지금 그 검사는 briefing만 보지만, action_items에 같은 형태를
//     남겨 두면 검사가 넓어지는 순간 같은 자가 차단이 재현된다.
//  2. 대체 문장은 스크럽이 끝난 뒤에 붙어 다시 스크럽되지 않는다. 기사에서 가져온 값은
//     떨어진 기사의 claim과 겹치는 순간(예: 두 기사가 같은 api_or_component를 다룰 때)
//     removed-section-claim-remains를 깨워 같은 자가 차단을 낸다. 카테고리처럼 짧은 값도
//     이 위험을 피하지 못하므로 넣지 않는다.
//
// 문장 수는 기사 수와 무관하게 최소 개수를 채운다. 기사 수에 묶으면 얇은 주(최종 기사 1~2건)에
// briefing 3칸을 못 채워 지운 문장을 되돌리게 되고, 그 잔재가 곧바로 발행을 막는다.
const REPLACEMENT_BRIEFING_SENTENCES = [
  '이번 호에 실린 기사의 출처와 날짜 근거부터 카메라 관점에서 확인한다.',
  '각 변경이 Camera framework, HAL, driver 중 어디까지 닿는지 영향 범위를 좁혀 본다.',
  '2주 내 검증 항목과 담당자를 정해 변경 이후 카메라 파이프라인 회귀를 추적한다.'
];

const REPLACEMENT_ACTION_SENTENCES = [
  '이번 호 기사마다 담당자를 지정해 출처, 영향 범위, 2주 내 검증 항목을 재확인한다.'
];

function replacementBriefing() {
  return REPLACEMENT_BRIEFING_SENTENCES;
}

function replacementActions() {
  return REPLACEMENT_ACTION_SENTENCES;
}

function classifyText(value, context) {
  const staleClaims = context.removedClaimKeys.filter(claim => textContainsClaim(value, claim));
  const releaseClaims = releaseClaimsFromText(value)
    .map(claim => ({ value: claim, normalized: normalize(claim), compact: compact(claim), field: 'release_claim' }));
  const unsupportedReleaseClaims = releaseClaims.filter(claim => {
    const stale = staleClaims.some(staleClaim => staleClaim.compact === claim.compact);
    if (stale) return true;
    const finalSupported = hasClaimSupport(claim, context.finalEvidenceText);
    const candidateSupported = hasClaimSupport(claim, context.selectedCandidateEvidenceText);
    return !finalSupported && !candidateSupported;
  });
  return {
    stale_claims: staleClaims,
    unsupported_release_claims: unsupportedReleaseClaims,
    should_remove: staleClaims.length > 0 || unsupportedReleaseClaims.length > 0
  };
}

function scrubString(value, field, context) {
  const original = text(value);
  const sentences = splitSentences(original);
  if (sentences.length === 0) return { value: original, removals: [] };
  const kept = [];
  const removals = [];
  for (const sentence of sentences) {
    const classification = classifyText(sentence, context);
    if (classification.should_remove) {
      removals.push({
        field,
        text: sentence,
        stale_claims: classification.stale_claims.map(claim => claim.value),
        unsupported_release_claims: classification.unsupported_release_claims.map(claim => claim.value),
        action: 'removed-sentence'
      });
    } else {
      kept.push(sentence);
    }
  }
  return {
    value: kept.join(' ').trim(),
    removals
  };
}

function scrubList(items, field, context, replacements = [], minCount = 0) {
  const kept = [];
  const removals = [];
  for (const item of ensureArray(items)) {
    const classification = classifyText(item, context);
    if (classification.should_remove) {
      removals.push({
        field,
        text: text(item),
        stale_claims: classification.stale_claims.map(claim => claim.value),
        unsupported_release_claims: classification.unsupported_release_claims.map(claim => claim.value),
        action: 'removed-item'
      });
    } else {
      kept.push(item);
    }
  }
  for (const replacement of replacements) {
    if (kept.length >= minCount) break;
    if (!kept.some(item => normalize(item) === normalize(replacement))) kept.push(replacement);
  }
  // 대체 문구가 모자라 최소 개수를 못 채우면 지운 항목을 되돌린다. 지금 두 호출자는 항상
  // 최소 개수만큼의 대체 문장을 넘기므로(briefing 3개, action_items 1개) 이 되돌림은 일어나지
  // 않는다. 그래도 남겨 둔다 — minCount를 받는 helper가 그 계약을 못 지키는 쪽으로 새면,
  // 되돌리지 않을 경우 finalize의 validateEditor가 briefing 개수 계약 위반으로 예외를 던져
  // 산출물조차 남지 않는다. 되돌리면 잔재가 removed-section-claim-remains로 잡혀 진단이 남은
  // 채 발행만 막힌다.
  const restored = [];
  while (kept.length < minCount && removals.length > 0) {
    const item = removals.shift();
    restored.push({ ...item, action: 'restored-to-keep-minimum' });
    kept.push(item.text);
  }
  return { value: kept, removals: [...removals, ...restored] };
}

function scrubReferences(editor, report) {
  const usedRefs = finalSourceMap(editor);
  const originalRefs = ensureArray(editor.references);
  const unused = originalRefs.filter(source => source?.url && !usedRefs.has(source.url));
  if (unused.length > 0) {
    report.unused_references_removed = unused.map(source => ({
      title: source.title || source.url,
      url: source.url
    }));
  }
  editor.references = [...usedRefs.values()];
}

// coverage 게이트가 쓰는 판별과 같은 3개 플래그를 본다. 스크럽만 2개로 보면 선정 집합의
// 정의가 게이트와 달라져, primary_selected로만 표시된 그룹의 잔재를 그대로 놓친다.
function selectedCandidates(reporter) {
  return ensureArray(reporter?.candidates).filter(candidate =>
    candidate?.final_selected === true ||
    candidate?.selected_for_editor === true ||
    candidate?.primary_selected === true);
}

// 섹션 → 그룹 키. 정본 경로(source_candidate_hash와 섹션의 모든 source URL로 후보를 찾아
// 그 후보의 키를 쓰는 것)를 그대로 재사용한다. url/title로 약하게 다시 만들면
// patchwork seriesId나 hash로만 묶인 그룹에서 키가 어긋나, 살아남은 기사가 "빠진 것"으로
// 분류돼 그 기사의 참인 문장이 지워진다.
function renderedGroupKeysForSections(finalSections, reporter) {
  // buildCandidateIndex는 reporter 객체를 받아 내부에서 candidates를 읽는다. 배열을 넘기면
  // 색인이 비어 candidateForSection이 항상 null을 돌려주고, 이 블록이 조용히 죽는다.
  const candidateIndex = buildCandidateIndex(reporter);
  const keys = new Set();
  for (const section of ensureArray(finalSections)) {
    const explicit = text(section?.article_group_key || section?.articleGroupKey);
    if (explicit) keys.add(explicit);
    const matched = candidateForSection(section, candidateIndex);
    if (matched) {
      const key = candidateGroupKey(matched);
      if (key) keys.add(key);
    }
    // 후보 색인에 못 걸리는 섹션(직접 편집 등)을 위한 마지막 폴백. 넓게 잡는 방향이라
    // 안전하다 — rendered 집합이 커지면 삭제가 줄어든다.
    const derived = candidateGroupKey({
      url: ensureArray(section?.sources)[0]?.url,
      title: section?.headline
    });
    if (derived) keys.add(derived);
  }
  return keys;
}

function selectedCandidatesMissingFromSections(reporter, finalSections) {
  const renderedGroupKeys = renderedGroupKeysForSections(finalSections, reporter);
  return selectedCandidates(reporter)
    .filter(candidate => {
      const key = candidateGroupKey(candidate);
      return key && !renderedGroupKeys.has(key);
    });
}

function selectedCandidateEvidence(reporter) {
  return selectedCandidates(reporter).map(candidateEvidenceText).join(' ');
}

function scrubStaleClaims(editor, options = {}) {
  const draft = {
    ...editor,
    briefing: ensureArray(editor?.briefing).slice(),
    action_items: ensureArray(editor?.action_items).slice(),
    references: ensureArray(editor?.references).slice()
  };
  const finalSections = ensureArray(draft.sections);
  const removedSections = ensureArray(options.removedSections);
  // 선정은 됐는데 최종 기사에 없는 그룹. removedSections는 editor가 한 번이라도 써낸
  // 섹션에서만 나오므로, 한 번도 렌더되지 않고 hard block된 그룹은 여기서만 잡힌다.
  const droppedSelectedCandidates = selectedCandidatesMissingFromSections(options.reporter, finalSections);
  const context = {
    removedClaimKeys: [
      ...removedSections.flatMap(claimKeysForSection),
      ...droppedGroupTokenClaimKeys(droppedSelectedCandidates, finalSections)
    ],
    finalEvidenceText: finalSections.map(sectionEvidenceText).join(' '),
    selectedCandidateEvidenceText: selectedCandidateEvidence(options.reporter)
  };
  const report = {
    schema_version: 1,
    date: options.date || draft.date || '',
    status: 'PASS',
    removed_sections: removedSections.map(sectionSummary),
    // 어느 그룹 때문에 문장을 지웠는지 남긴다. 토큰 문자열만 남기면 매주 되풀이되는
    // editor 비일관성을 역추적할 수 없다.
    dropped_selected_groups: droppedSelectedCandidates.map(candidate => ({
      article_group_key: candidateGroupKey(candidate),
      title: text(candidate?.title),
      url: text(candidate?.url)
    })),
    restored_to_keep_minimum: [],
    final_section_sources: [...finalSourceMap(draft).values()],
    stale_claim_items_removed: [],
    unsupported_release_claims_removed: [],
    unused_references_removed: [],
    retained_release_claims: [],
    hard_failures: []
  };

  const summary = scrubString(draft.summary, 'summary', context);
  draft.summary = summary.value || (finalSections[0]?.headline
    ? `${finalSections[0].headline} 등 최종 선정된 기사 기준으로 이번 호를 정리했다.`
    : draft.summary);

  const briefing = scrubList(draft.briefing, 'briefing', context, replacementBriefing(), 3);
  draft.briefing = briefing.value.slice(0, 3);
  const actions = scrubList(draft.action_items, 'action_items', context, replacementActions(), 1);
  draft.action_items = actions.value;
  scrubReferences(draft, report);

  const allRemovals = [...summary.removals, ...briefing.removals, ...actions.removals];
  // 최소 개수를 지키려고 되돌린 항목은 지운 게 아니다. 제거 목록에 넣으면 보고서가
  // 실제로는 남아 있는 문장을 지웠다고 말하게 된다.
  const removals = allRemovals.filter(item => item.action !== 'restored-to-keep-minimum');
  report.restored_to_keep_minimum = allRemovals.filter(item => item.action === 'restored-to-keep-minimum');
  report.stale_claim_items_removed = removals.filter(item => item.stale_claims.length > 0);
  report.unsupported_release_claims_removed = removals.filter(item => item.unsupported_release_claims.length > 0);

  const finalGlobalText = [
    draft.summary,
    draft.briefing,
    draft.action_items,
    draft.references
  ].map(text).join(' ');
  // A claim from a removed section is NOT a stale orphan if a SURVIVING final section
  // legitimately re-uses it (same headline, source URL/title, version, API, behavior, ...).
  // Exclude those so the editor reworking a section but keeping its identity/source does
  // not trip removed-section-claim-remains.
  const finalSectionClaimValues = new Set();
  for (const section of finalSections) {
    for (const key of claimKeysForSection(section)) {
      finalSectionClaimValues.add(text(key.value));
    }
  }
  const unresolvedStaleClaims = context.removedClaimKeys
    .filter(claim => textContainsClaim(finalGlobalText, claim))
    .filter(claim => !finalSectionClaimValues.has(text(claim.value)))
    .map(claim => claim.value);
  if (unresolvedStaleClaims.length > 0) {
    report.hard_failures.push({
      reason: 'removed-section-claim-remains',
      claims: [...new Set(unresolvedStaleClaims)]
    });
  }
  if (draft.briefing.length !== 3) {
    report.hard_failures.push({
      reason: 'briefing-count-after-stale-claim-scrub',
      count: draft.briefing.length
    });
  }

  const retainedClaims = releaseClaimsFromText(finalGlobalText).filter(claim =>
    hasClaimSupport({ value: claim, normalized: normalize(claim), compact: compact(claim), field: 'release_claim' }, context.finalEvidenceText)
  );
  report.retained_release_claims = retainedClaims.map(claim => ({
    claim,
    reason: 'retained because the claim appears in final section evidence.'
  }));
  report.status = report.hard_failures.length > 0 ? 'NEEDS_FIX' : 'PASS';
  return { editor: draft, report };
}

// 같은 실행에서 스크럽이 두 번 돌면 report도 두 개 나온다(#869: thin-week salvage가 기사를
// 떨어뜨린 뒤의 재스크럽). 나중 report만 쓰면 앞 스크럽이 낸 hard_failure가 사라져 게이트가
// 느슨해지고, 앞에서 무엇을 지웠는지도 산출물에서 사라진다. 그래서 누적 기록과 hard_failure는
// 이어 붙이고, 최종 텍스트의 상태를 나타내는 필드(final_section_sources, retained_release_claims,
// dropped_selected_groups 등)는 나중 report 값을 그대로 쓴다.
// restored_to_keep_minimum도 상태 필드다. 이 필드는 "지우지 않고 되돌려 남긴 문장"을 뜻하는데,
// 이어 붙이면 앞 스크럽이 되돌린 문장을 뒤 스크럽이 실제로 지웠을 때 같은 문장이
// restored와 removed 양쪽에 실린다. 뒤 스크럽은 앞 스크럽 결과 텍스트를 통째로 다시 보므로
// 나중 값이 최종 텍스트를 설명한다.
function mergeStaleClaimReports(previous, next) {
  if (!previous) return next;
  const concat = field => [...ensureArray(previous[field]), ...ensureArray(next[field])];
  const hardFailures = concat('hard_failures');
  // status를 hard_failures 길이로만 다시 계산하지 않는다. 게이트는 status와 hard_failures를
  // 둘 다 보므로, hard_failure 없이 NEEDS_FIX인 report를 합치면서 PASS로 낮추면 앞 스크럽이
  // 세운 판정이 조용히 사라진다. 어느 한쪽이라도 PASS가 아니면 합집합도 PASS가 아니다.
  const needsFix = hardFailures.length > 0 ||
    text(previous.status) !== 'PASS' ||
    text(next.status) !== 'PASS';
  return {
    ...next,
    removed_sections: concat('removed_sections'),
    stale_claim_items_removed: concat('stale_claim_items_removed'),
    unsupported_release_claims_removed: concat('unsupported_release_claims_removed'),
    unused_references_removed: concat('unused_references_removed'),
    hard_failures: hardFailures,
    status: needsFix ? 'NEEDS_FIX' : 'PASS'
  };
}

function pruneResolvedStaleFactCheckItems(factCheck, staleReport) {
  const removedClaims = [
    ...ensureArray(staleReport?.stale_claim_items_removed),
    ...ensureArray(staleReport?.unsupported_release_claims_removed)
  ].flatMap(item => [
    ...ensureArray(item.stale_claims),
    ...ensureArray(item.unsupported_release_claims)
  ]);
  if (removedClaims.length === 0) return factCheck;
  // 모델명 형태의 짧은 키는 부분 문자열로 보면 무관한 must_fix까지 잘라 status를
  // NEEDS_FIX에서 PASS로 뒤집을 수 있다. 그 계열만 낱말 단위로 본다.
  const removedModelTokens = new Set(removedClaims.filter(looksLikeModelIdentifier));
  const removedClaimCompacts = new Set(
    removedClaims.filter(claim => !looksLikeModelIdentifier(claim)).map(compact).filter(Boolean)
  );
  function mentionsRemovedClaim(item) {
    const body = compact(item);
    if (removedModelTokens.size > 0) {
      const tokens = textTokens(item);
      if ([...removedModelTokens].some(token => tokens.includes(token))) return true;
    }
    return [...removedClaimCompacts].some(claim => claim && body.includes(claim));
  }
  const next = {
    ...factCheck,
    must_fix: ensureArray(factCheck?.must_fix).filter(item => !mentionsRemovedClaim(item)),
    recommended_fixes: ensureArray(factCheck?.recommended_fixes).filter(item => !mentionsRemovedClaim(item)),
    source_gaps: ensureArray(factCheck?.source_gaps).filter(item => !mentionsRemovedClaim(item))
  };
  next.source_gap_count = next.source_gaps.length;
  if (next.must_fix.length === 0 && next.source_gaps.length === 0 && next.status === 'NEEDS_FIX') {
    next.status = 'PASS';
  }
  return next;
}

function buildStaleClaimReportMarkdown(report) {
  const removed = ensureArray(report.stale_claim_items_removed)
    .map(item => `- ${item.field}: ${item.text}`)
    .join('\n') || '- none';
  const unsupported = ensureArray(report.unsupported_release_claims_removed)
    .map(item => `- ${item.field}: ${item.unsupported_release_claims.join('; ')} -- ${item.text}`)
    .join('\n') || '- none';
  const unused = ensureArray(report.unused_references_removed)
    .map(source => `- [${source.title}](${source.url})`)
    .join('\n') || '- none';
  const retained = ensureArray(report.retained_release_claims)
    .map(item => `- ${item.claim}: ${item.reason}`)
    .join('\n') || '- none';
  const hard = ensureArray(report.hard_failures)
    .map(item => `- ${item.reason}: ${JSON.stringify(item)}`)
    .join('\n') || '- none';
  return `# Stale Claim Report - ${report.date}

## Status

${report.status}

## Removed Section Claims

${removed}

## Unsupported Release Claims Removed

${unsupported}

## Unused References Moved Out Of Final References

${unused}

## Retained Release Claims

${retained}

## Hard Failures

${hard}
`;
}

module.exports = {
  buildStaleClaimReportMarkdown,
  claimKeysForSection,
  mergeStaleClaimReports,
  pruneResolvedStaleFactCheckItems,
  releaseClaimsFromText,
  scrubStaleClaims,
  sectionSummary
};
