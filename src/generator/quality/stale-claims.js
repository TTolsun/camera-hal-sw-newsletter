const { ensureArray } = require('../../shared/common/value-coercion');
const { candidateGroupKey } = require('../../shared/common/article-groups');
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
// 그래서 낱말 단위로 본다. 안전장치는 길이 하한이 아니라 **차집합**이다 —
// 살아남은 기사들이 쓰는 낱말은 전부 빼기 때문에, 'sony'·'v4l2'·'sensor'처럼
// 공유되는 어휘로는 살아남은 기사의 문장을 지울 수 없다.
//
// 차집합만으로는 부족한 경우가 하나 있다. 살아남은 기사가 한국어로만 쓰였으면
// 'camera'·'driver' 같은 일반 영어 낱말이 차집합에 남는다. 그래서 식별자처럼 보이는
// 것만 통과시킨다: 숫자를 포함하거나(imx576·ar0234) 충분히 긴 것(siliconsignals.io).
const DROPPED_GROUP_TOKEN_MIN_LENGTH = 5;
const DROPPED_GROUP_TOKEN_LONG_LENGTH = 12;
const DROPPED_GROUP_TOKEN_FIELD = 'dropped_group_token';

function textTokens(value) {
  return String(text(value) || '')
    .toLowerCase()
    .normalize('NFC')
    .match(/[a-z0-9][a-z0-9._@-]*|[가-힣]{2,}/g) || [];
}

function looksLikeIdentifier(token) {
  if (token.length < DROPPED_GROUP_TOKEN_MIN_LENGTH) return false;
  return /\d/.test(token) || token.length >= DROPPED_GROUP_TOKEN_LONG_LENGTH;
}

function droppedGroupTokenClaimKeys(droppedCandidates, finalSections) {
  const survivingTokens = new Set(
    ensureArray(finalSections).flatMap(section => textTokens(sectionEvidenceText(section)))
  );
  const keys = new Map();
  for (const candidate of ensureArray(droppedCandidates)) {
    const source = [candidate?.title, candidate?.url, candidate?.headline].map(text).join(' ');
    for (const token of textTokens(source)) {
      if (survivingTokens.has(token)) continue;
      if (!looksLikeIdentifier(token)) continue;
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
  // 길이 하한도 적용하지 않는다 — 이 계열의 안전장치는 살아남은 기사와의 차집합이다.
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

function replacementBriefing(finalSections) {
  return ensureArray(finalSections).slice(0, 3).map(section =>
    `${section.headline || section.category}: 최종 선정된 출처 기준으로 Camera/driver/SoC 영향과 검증 포인트를 확인한다.`
  );
}

function replacementActions(finalSections) {
  return ensureArray(finalSections).slice(0, 3).map(section =>
    `${section.headline || section.category} 담당자를 지정해 출처, 영향 범위, 2주 내 검증 항목을 재확인한다.`
  );
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
  return { value: kept, removals };
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

function selectedCandidates(reporter) {
  return ensureArray(reporter?.candidates)
    .filter(candidate => candidate?.final_selected === true || candidate?.selected_for_editor === true);
}

// 섹션과 후보는 그룹 키를 다르게 들고 있을 수 있다. 섹션은 보통 article_group_key를
// 갖지만, 없으면 후보 쪽과 같은 규칙(url/title)으로 유도해야 짝이 맞는다. 한쪽만 보면
// 살아남은 기사까지 "빠진 것"으로 세어 멀쩡한 문장을 지우게 된다 — 그래서 둘 다 담는다.
function renderedGroupKeysForSections(finalSections) {
  const keys = new Set();
  for (const section of ensureArray(finalSections)) {
    const explicit = text(section?.article_group_key || section?.articleGroupKey);
    if (explicit) keys.add(explicit);
    const derived = candidateGroupKey({
      url: ensureArray(section?.sources)[0]?.url,
      title: section?.headline
    });
    if (derived) keys.add(derived);
  }
  return keys;
}

function selectedCandidatesMissingFromSections(reporter, finalSections) {
  const renderedGroupKeys = renderedGroupKeysForSections(finalSections);
  return selectedCandidates(reporter)
    .filter(candidate => {
      const key = candidateGroupKey(candidate);
      return key && !renderedGroupKeys.has(key);
    });
}

function selectedCandidateEvidence(reporter) {
  return ensureArray(reporter?.candidates)
    .filter(candidate => candidate?.final_selected === true || candidate?.selected_for_editor === true)
    .map(candidateEvidenceText)
    .join(' ');
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

  const briefing = scrubList(draft.briefing, 'briefing', context, replacementBriefing(finalSections), 3);
  draft.briefing = briefing.value.slice(0, 3);
  const actions = scrubList(draft.action_items, 'action_items', context, replacementActions(finalSections), 1);
  draft.action_items = actions.value;
  scrubReferences(draft, report);

  const removals = [...summary.removals, ...briefing.removals, ...actions.removals];
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

function pruneResolvedStaleFactCheckItems(factCheck, staleReport) {
  const removedClaims = [
    ...ensureArray(staleReport?.stale_claim_items_removed),
    ...ensureArray(staleReport?.unsupported_release_claims_removed)
  ].flatMap(item => [
    ...ensureArray(item.stale_claims),
    ...ensureArray(item.unsupported_release_claims)
  ]);
  if (removedClaims.length === 0) return factCheck;
  const removedClaimCompacts = new Set(removedClaims.map(compact).filter(Boolean));
  function mentionsRemovedClaim(item) {
    const body = compact(item);
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
  pruneResolvedStaleFactCheckItems,
  releaseClaimsFromText,
  scrubStaleClaims,
  sectionSummary
};
