const { ensureArray } = require('../../shared/common/value-coercion');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const {
  articlePolicy,
  articleCountRangeText
} = require('../../shared/common/newsletter-policy');
const {
  findFieldHygieneIssues,
  inferGuardrailImpactClass
} = require('../reporter/article-field-builder');
const {
  ARTICLE_SECTION_ALLOWED_KEYS,
  ARTICLE_SECTION_KEYS,
  normalizeArticleSections,
  unexpectedArticleSectionKeys
} = require('../reporter/article-section-contract');
const {
  CAPSULE_REQUIRED_FIELDS,
  completeHalSignalCapsuleFromExistingFields,
  normalizeHalSignalCapsule
} = require('../reporter/hal-signal-quality');
const {
  issueStoryContractVersion,
  publicArticleExpectedKeys,
  storyContractMarkers,
  validatePublicArticle
} = require('../reporter/public-article-contract');
const {
  publicContractVersionFor
} = require('../../shared/common/story-contract-version');
const {
  buildAllowedClaimEvidence,
  buildEvidenceIndex,
  factCoveredByClaim,
  validateArticleClaims
} = require('../quality/claim-source-binding');
const {
  REPAIR_PATCH_CONTRACT_VIOLATION,
  checkRepairPatchContract
} = require('../repair/repair-patch-contract');
const {
  candidateGroupKey,
  EXPLICIT_DEMOTION_REASON_CODES,
  explicitDemotedGroups,
  explicitHardBlockedGroups,
  FORBIDDEN_SOURCE_READY_NATIVE_DEMOTION_REASONS,
  groupCoverageSummary,
  HARD_BLOCK_REASON_CODES,
  isNativeToolingWorkflow,
  normalizeUrl: normalizeGroupUrl
} = require('../../shared/common/article-groups');
const {
  normalizeSourceQuality
} = require('../../shared/collect/source-quality-classifier');
const {
  isDomainDraftArtifact,
  toLegacyEditorIssue
} = require('../../shared/domain/newsletter-domain-normalize');
const {
  EditorSemanticValidationError,
  cloneJson,
  actualType,
  text,
  countDetails,
  buildCandidateIndex,
  candidateForSection,
  sectionPolicyMetadata,
  semanticError,
  uniqueText
} = require('./editor-contract-helpers');
const {
  strictArticleSections,
  buildArticleSectionsFromSectionFields,
  completeStoryPublicArticle
} = require('./editor-section-builders');

const REQUIRED_BRIEFING_COUNT = 3;

const REPAIRABLE_SEMANTIC_FIELDS = new Set([
  'briefing',
  'summary',
  'sections.article_sections',
  'sections.public_article',
  'sections.hal_signal_capsule',
  'sections.field_hygiene',
  'sections.group_coverage',
  'sections.blocked_context',
  'sections.claims'
]);

function briefingCountError(value) {
  const details = countDetails(value, 'briefing', {
    expectedCount: REQUIRED_BRIEFING_COUNT
  });
  const got = details.actualType === 'array'
    ? details.actualCount
    : `non-array ${details.actualType}`;
  return new EditorSemanticValidationError(
    `Editor output must contain exactly 3 briefing items; got ${got}.`,
    details
  );
}

function validateSectionCount(value) {
  if (
    !Array.isArray(value.sections) ||
    value.sections.length < articlePolicy.mainArticleCount.min ||
    value.sections.length > articlePolicy.mainArticleCount.max
  ) {
    throw semanticError(
      `Editor output must contain ${articleCountRangeText()} sections; got ${
        Array.isArray(value.sections) ? value.sections.length : `non-array ${actualType(value.sections)}`
      }.`,
      {
        ...countDetails(value, 'sections', {
          expectedMinCount: articlePolicy.mainArticleCount.min,
          expectedMaxCount: articlePolicy.mainArticleCount.max
        })
      }
    );
  }
}

function validateEditorArticlePolicy(value, reporter = {}) {
  const candidateIndex = buildCandidateIndex(reporter);
  const sectionDetails = ensureArray(value.sections).map((section, index) => {
    const metadata = sectionPolicyMetadata(section, candidateForSection(section, candidateIndex));
    return {
      index: index + 1,
      headline: text(section.headline || section.category || `article ${index + 1}`),
      ...metadata
    };
  });
  const primaryCount = sectionDetails.filter(item => item.primary).length;
  const forbiddenSections = sectionDetails.filter(item => item.forbidden);

  if (primaryCount < articlePolicy.primaryCameraStack.minRequired) {
    throw semanticError(
      `Editor output must contain at least ${articlePolicy.primaryCameraStack.minRequired} Primary Camera Stack section(s).`,
      {
        field: 'sections.relevance_bucket',
        expectedMinCount: articlePolicy.primaryCameraStack.minRequired,
        actualCount: primaryCount,
        actualType: 'array',
        sectionCount: ensureArray(value.sections).length,
        primaryCameraStackBuckets: [...articlePolicy.primaryCameraStack.buckets],
        sectionDetails
      }
    );
  }

  if (forbiddenSections.length > 0) {
    throw semanticError(
      `Editor output contains forbidden main bucket section(s): ${forbiddenSections.map(item => item.headline).join(', ')}.`,
      {
        field: 'sections.relevance_bucket',
        forbiddenMainBuckets: [...articlePolicy.forbiddenMainBuckets],
        actualCount: forbiddenSections.length,
        actualType: 'array',
        sectionCount: ensureArray(value.sections).length,
        forbiddenSections
      }
    );
  }
  return { primaryCount, forbiddenSections, sectionDetails };
}

function validateFieldHygiene(value) {
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    const guardrailImpactClass = inferGuardrailImpactClass(section);
    const sectionIssues = findFieldHygieneIssues({
      ...section,
      guardrail_impact_class: guardrailImpactClass
    });
    for (const issue of sectionIssues.filter(item => item.blocking !== false)) {
      issues.push({
        index: index + 1,
        headline: text(section.headline || section.category || `article ${index + 1}`),
        guardrail_impact_class: guardrailImpactClass,
        ...issue
      });
    }
  });
  if (issues.length > 0) {
    throw semanticError('Editor output failed article field hygiene validation.', {
      field: 'sections.field_hygiene',
      actualCount: issues.length,
      sectionCount: ensureArray(value.sections).length,
      issues
    });
  }
}

function unsupportedStoryMarkerIssues(value = {}) {
  const sections = ensureArray(value?.sections);
  const targets = sections.length > 0 ? sections : [{ public_article: {} }];
  const issues = [];
  targets.forEach((section, index) => {
    const markers = storyContractMarkers(value, section, { requireStoryContract: false });
    for (const issue of ensureArray(markers.unsupported)) {
      issues.push({
        index: index + 1,
        headline: text(section.headline || section.category || `article ${index + 1}`),
        ...issue
      });
    }
  });
  return issues;
}

function unsupportedStoryMarkerReasonCodes(value = {}) {
  return uniqueText(unsupportedStoryMarkerIssues(value).map(issue => issue.type));
}

function deterministicallyRepairEditorSchema(value, options = {}) {
  const repaired = cloneJson(value);
  let changed = false;
  const reasonCodes = [];
  const unsupportedStoryMarkerCodes = unsupportedStoryMarkerReasonCodes(repaired);
  if (unsupportedStoryMarkerCodes.length > 0) {
    return {
      editor: null,
      reason_codes: unsupportedStoryMarkerCodes,
      repairable: false
    };
  }
  if (options.requireStoryContract === true) {
    // draft가 이미 선언한 버전으로 마커를 맞춘다. 버전을 고정해 두면 v2 draft의 이슈
    // 마커만 v1으로 되돌아가 섹션 마커와 어긋난 혼합 패밀리가 만들어진다.
    const draftContractVersion = issueStoryContractVersion(repaired);
    const publicContractVersion = publicContractVersionFor(draftContractVersion);
    if (repaired.public_contract_version !== publicContractVersion) {
      repaired.public_contract_version = publicContractVersion;
      changed = true;
    }
    const generationContractVersion = Number(repaired.generation_contract_version);
    if (
      !Number.isFinite(generationContractVersion) ||
      generationContractVersion < draftContractVersion
    ) {
      repaired.generation_contract_version = draftContractVersion;
      changed = true;
    }
  }
  for (const section of ensureArray(repaired?.sections)) {
    if (options.requireStoryContract === true) {
      section.public_article = completeStoryPublicArticle(section);
      changed = true;
    }
    const normalized = normalizeArticleSections(section);
    if (!(normalized.diagnostics.article_sections_present && normalized.diagnostics.complete)) {
      const candidate = buildArticleSectionsFromSectionFields(section);
      reasonCodes.push(...candidate.reason_codes);
      section.article_sections = candidate.article_sections;
      const repairedNormalized = normalizeArticleSections(section);
      if (!repairedNormalized.diagnostics.complete) {
        reasonCodes.push(...repairedNormalized.diagnostics.missing_required_keys.map(key => `missing_${key}`));
      } else {
        changed = true;
      }
    }

    const capsule = normalizeHalSignalCapsule(section);
    if (!capsule.complete) {
      const candidate = completeHalSignalCapsuleFromExistingFields(section, {
        mode: 'editor_deterministic_repair'
      });
      reasonCodes.push(...candidate.reason_codes);
      if (candidate.complete) {
        section.hal_signal_capsule = candidate.capsule;
        changed = true;
      }
    }
  }
  const uniqueReasonCodes = uniqueText(reasonCodes);
  if (uniqueReasonCodes.length > 0) {
    return {
      editor: null,
      reason_codes: uniqueReasonCodes
    };
  }
  return {
    editor: changed ? repaired : null,
    reason_codes: []
  };
}

const BACKFILL_FACT_CLAIM_IMPACT_LEVELS = Object.freeze([
  'no_hal_runtime_impact',
  'app_api_or_framework_adjacent',
  'native_tooling_workflow'
]);

function hasBlockingClaimIssues(result) {
  return [
    ...ensureArray(result.issues),
    ...ensureArray(result.claim_results).flatMap(claim => ensureArray(claim.issues))
  ].some(item => item.blocking !== false);
}

function backfillFactClaim({ section, candidate, articleIndex, seedEvidencePack, factText, allowedEvidence, claimId }) {
  for (const impactLevel of BACKFILL_FACT_CLAIM_IMPACT_LEVELS) {
    for (const evidence of allowedEvidence) {
      const evidenceId = text(evidence.evidence_id);
      const sourceUrls = ensureArray(evidence.source_urls).map(text).filter(Boolean);
      if (!evidenceId || sourceUrls.length === 0) continue;
      const claim = {
        claim_id: claimId,
        text: factText,
        claim_type: 'fact',
        evidence_ids: [evidenceId],
        source_urls: sourceUrls,
        impact_level: impactLevel,
        overclaim_risk: 'low'
      };
      const trialSection = cloneJson(section);
      trialSection.claims = [claim];
      const baseSections = trialSection.article_sections &&
        typeof trialSection.article_sections === 'object' &&
        !Array.isArray(trialSection.article_sections)
        ? trialSection.article_sections
        : {};
      trialSection.article_sections = { ...baseSections, verified_facts: [factText] };
      const result = validateArticleClaims({
        section: trialSection,
        candidate,
        articleIndex,
        strict: true,
        seedEvidencePack
      });
      if (!hasBlockingClaimIssues(result)) return claim;
    }
  }
  return null;
}

// Deterministic repair for `sections.claims`: when a strict main article has source-backed
// verified_facts[] that no claim_type=fact claim covers, copy each uncovered fact verbatim into a
// fact claim and bind it only to the candidate's own allowed_claim_evidence. This handles both an
// empty claims[] (원래 범위) and the #660 partial-coverage shape — editor가 대표 사실만 claim으로
// 쓰고 부수 verified_fact(스펙·리뷰 상태)의 claim을 빠뜨려 missing_matching_fact_claim으로 LLM
// semantic repair가 발동하던 지배 트리거. No new facts and no evidence are invented; the real
// claim binding validator is the oracle, so anything that cannot bind safely is left to the LLM
// repair path (and ultimately fails closed).
//
// #833이 기각한 "claim 텍스트 동기화"와 다르다: 그 설계는 이미 수용된 출력의 claim을 사후에 새
// 문구로 덮어써 coverage를 항진(fact==claim)으로 만들면서 evidence 재검증이 없었다. 여기서는 검증
// 진입 시점에 새 claim을 추가하고 같은 strict 오라클이 evidence 바인딩(protected token 지지 포함)을
// 통과시킬 때만 수용하므로, 게이트 강도는 editor가 직접 그 claim을 썼을 때와 동일하다.
function deterministicallyBackfillFactClaims(value, options = {}) {
  const reporter = options.reporter || { candidates: [] };
  const seedEvidencePack = options.seedEvidencePack || null;
  const repaired = cloneJson(value);
  const candidateIndex = buildCandidateIndex(reporter);
  const reasonCodes = [];
  let changed = false;

  ensureArray(repaired?.sections).forEach((section, index) => {
    const existingClaims = ensureArray(section.claims);
    const candidate = candidateForSection(section, candidateIndex) || {};
    let uncoveredFacts;
    if (existingClaims.length === 0) {
      uncoveredFacts = uniqueText(
        ensureArray(normalizeArticleSections(section).verified_facts).map(text).filter(Boolean)
      );
      if (uncoveredFacts.length === 0) {
        reasonCodes.push('no_verified_facts_to_bind');
        return;
      }
    } else {
      // claims가 이미 있는 섹션은 게이트와 같은 오라클로 미커버 fact만 추려서 그 부분만 채운다.
      // 미커버가 없으면(이 섹션의 실패 원인이 coverage가 아니면) 손대지 않는다.
      const currentResult = validateArticleClaims({
        section,
        candidate,
        articleIndex: index,
        strict: true,
        seedEvidencePack
      });
      uncoveredFacts = uniqueText(
        ensureArray(currentResult.uncovered_facts).map(item => text(item.text)).filter(Boolean)
      );
      if (uncoveredFacts.length === 0) return;
    }
    const allowedEvidence = buildAllowedClaimEvidence(candidate, section, { seedEvidencePack });
    if (allowedEvidence.length === 0) {
      reasonCodes.push('no_allowed_claim_evidence');
      return;
    }
    // 오라클의 duplicate_claim_id 판정과 같은 정규화(claim_id || claimId 별칭)로 수집해야
    // 별칭 형태의 기존 id와 충돌한 backfill id가 최종 검증을 무산시키지 않는다.
    const usedClaimIds = new Set(
      existingClaims.map(claim => text(claim?.claim_id || claim?.claimId)).filter(Boolean)
    );
    const newClaims = [];
    let sectionFailed = false;
    uncoveredFacts.forEach((factText, factIndex) => {
      if (sectionFailed) return;
      let claimIdNumber = factIndex + 1;
      let claimId = `article-${index + 1}-fact-${claimIdNumber}`;
      while (usedClaimIds.has(claimId)) {
        claimIdNumber += 1;
        claimId = `article-${index + 1}-fact-${claimIdNumber}`;
      }
      const claim = backfillFactClaim({
        section,
        candidate,
        articleIndex: index,
        seedEvidencePack,
        factText,
        allowedEvidence,
        claimId
      });
      if (!claim) {
        sectionFailed = true;
        reasonCodes.push('unbindable_verified_fact');
        return;
      }
      usedClaimIds.add(claimId);
      newClaims.push(claim);
    });
    if (sectionFailed) return;
    const candidateSection = cloneJson(section);
    candidateSection.claims = [...existingClaims, ...newClaims];
    const finalResult = validateArticleClaims({
      section: candidateSection,
      candidate,
      articleIndex: index,
      strict: true,
      seedEvidencePack
    });
    if (hasBlockingClaimIssues(finalResult)) {
      reasonCodes.push('backfilled_claims_failed_validation');
      return;
    }
    section.claims = candidateSection.claims;
    changed = true;
  });

  const uniqueReasonCodes = uniqueText(reasonCodes);
  if (uniqueReasonCodes.length > 0) {
    return { editor: null, reason_codes: uniqueReasonCodes };
  }
  return { editor: changed ? repaired : null, reason_codes: [] };
}

// Find the single allowed-evidence binding that lets an EXISTING fact claim pass strict
// claim validation, without changing the claim's text or impact_level. Returns the bound
// evidence_ids/source_urls, or null when nothing binds (fail closed — never invent support).
function bindEvidenceForExistingFactClaim({ section, candidate, articleIndex, seedEvidencePack, claim, allowedEvidence }) {
  const factText = text(claim.text || claim.claim);
  if (!factText) return null;
  for (const evidence of allowedEvidence) {
    const evidenceId = text(evidence.evidence_id);
    const sourceUrls = ensureArray(evidence.source_urls).map(text).filter(Boolean);
    if (!evidenceId || sourceUrls.length === 0) continue;
    const trialClaim = { ...claim, evidence_ids: [evidenceId], source_urls: sourceUrls };
    const trialSection = cloneJson(section);
    trialSection.claims = [trialClaim];
    const baseSections = trialSection.article_sections &&
      typeof trialSection.article_sections === 'object' &&
      !Array.isArray(trialSection.article_sections)
      ? trialSection.article_sections
      : {};
    trialSection.article_sections = { ...baseSections, verified_facts: [factText] };
    const result = validateArticleClaims({
      section: trialSection,
      candidate,
      articleIndex,
      strict: true,
      seedEvidencePack
    });
    if (!hasBlockingClaimIssues(result)) {
      return { evidence_ids: [evidenceId], source_urls: sourceUrls };
    }
  }
  return null;
}

// Deterministic provenance completion: the LLM editor frequently writes source-backed fact
// claims but omits the item-level evidence_ids pointer. This binds the omitted evidence_id from
// the candidate's own allowed_claim_evidence, but ONLY when the strict claim validator (the
// oracle) confirms the evidence actually supports the claim. Claims whose text is not supported
// stay unbound and keep failing closed, so this never invents support nor weakens the gate.
// claim이 인용한 evidence_id가 "실제로 해석되지 않는"(unknown/blocked/proposal 등) 경우만 식별한다.
// pack-fallback 같은 soft 매핑(derived_evidence_mapping, blocking:false)은 해석된 것으로 보고 제외한다.
const UNRESOLVED_EVIDENCE_REASON_CODES = new Set([
  'unknown_evidence_id',
  'keyword_hint_is_not_evidence',
  'gemini_proposal_is_not_evidence',
  'blocked_or_failed_evidence_id',
  'provenance_id_without_item_evidence'
]);

function factClaimHasUnresolvedEvidence({ section, candidate, articleIndex, seedEvidencePack, claim }) {
  const factText = text(claim.text || claim.claim);
  const trialSection = cloneJson(section);
  trialSection.claims = [claim];
  const baseSections = trialSection.article_sections &&
    typeof trialSection.article_sections === 'object' &&
    !Array.isArray(trialSection.article_sections)
    ? trialSection.article_sections
    : {};
  trialSection.article_sections = { ...baseSections, verified_facts: [factText] };
  const result = validateArticleClaims({
    section: trialSection,
    candidate,
    articleIndex,
    strict: true,
    seedEvidencePack
  });
  const issues = [
    ...ensureArray(result.issues),
    ...ensureArray(result.claim_results).flatMap(claimResult => ensureArray(claimResult.issues))
  ];
  return issues.some(item => item.blocking !== false && UNRESOLVED_EVIDENCE_REASON_CODES.has(item.reason_code));
}

function reconcileFactClaimEvidence(value, options = {}) {
  const reporter = options.reporter || { candidates: [] };
  const seedEvidencePack = options.seedEvidencePack || null;
  const sections = ensureArray(value?.sections);
  if (sections.length === 0) return value;
  const candidateIndex = buildCandidateIndex(reporter);
  const repaired = cloneJson(value);
  let changed = false;

  ensureArray(repaired.sections).forEach((section, index) => {
    const claims = ensureArray(section.claims);
    if (claims.length === 0) return;
    const candidate = candidateForSection(section, candidateIndex) || {};
    const allowedEvidence = buildAllowedClaimEvidence(candidate, section, { seedEvidencePack });
    if (allowedEvidence.length === 0) return;
    // 재바인딩 대상: fact claim 중 (a) evidence_ids가 비었거나(기존 missing 케이스),
    // (b) 인용한 id가 strict 검증에서 blocking "미해결 id" 이슈를 내는 경우(#502 unresolved 케이스).
    // pack-fallback처럼 soft(non-blocking)하게 해석되는 id는 그대로 둔다(게이트 진단 보존).
    const needsReconcile = claim => {
      if (String(claim?.claim_type || claim?.claimType || '').trim().toLowerCase() !== 'fact') return false;
      if (!text(claim?.text || claim?.claim)) return false;
      const currentIds = ensureArray(claim?.evidence_ids || claim?.evidenceIds).map(text).filter(Boolean);
      if (currentIds.length === 0) return true;
      return factClaimHasUnresolvedEvidence({
        section,
        candidate,
        articleIndex: index,
        seedEvidencePack,
        claim
      });
    };
    if (!claims.some(needsReconcile)) return;
    claims.forEach(claim => {
      if (!needsReconcile(claim)) return;
      // strict 오라클이 evidence가 claim 텍스트를 실제 뒷받침한다고 확인할 때만 바인딩한다.
      // 확인 실패면 그대로 두어 fail-closed(없던 근거를 만들지 않음, 게이트 약화 없음).
      const bound = bindEvidenceForExistingFactClaim({
        section,
        candidate,
        articleIndex: index,
        seedEvidencePack,
        claim,
        allowedEvidence
      });
      if (!bound) return;
      claim.evidence_ids = bound.evidence_ids;
      if (ensureArray(claim.source_urls || claim.sourceUrls).map(text).filter(Boolean).length === 0) {
        claim.source_urls = bound.source_urls;
      }
      changed = true;
    });
  });

  return changed ? repaired : value;
}

// 빈 evidence_ids만 다루던 기존 이름은 호환을 위해 reconcile의 별칭으로 유지한다.
const bindMissingFactClaimEvidence = reconcileFactClaimEvidence;

// evidence를 보지 않고 claim 텍스트만으로 fact↔claim cover를 따지는 빈 evidence index.
// dropVerifiedFactsClassifiedAsNonFact는 claim_type 불일치만 정리하므로 evidence 매칭은 불필요하다.
const EMPTY_EVIDENCE_INDEX = buildEvidenceIndex({}, {});

// editor가 같은 문장을 verified_facts(canonical source-backed 사실 목록)에 넣으면서 그 문장의
// claim은 비-fact(inference/recommendation)로 분류하면, claim 바인딩은 claim_type=fact claim으로만
// verified_facts를 cover하므로 그 사실은 어떤 fact claim으로도 cover되지 못해
// missing_matching_fact_claim이 발생하고 섹션 전체가 replace-or-demote된다(editor 출력의 자가당착).
// editor 자신의 비-fact 분류를 신뢰해 해당 문장을 사실 목록에서만 제거한다(비-fact claim 자체는
// 그대로 둔다). 추론을 사실로 발행하지 않으므로 이는 verified_facts 계약을 강제하는 것이지 claim
// binding을 약화하는 것이 아니다.
//   - cover 판정은 gate(claim binding)와 동일한 factCoveredByClaim(substring + token/char 유사도)을
//     써서, exact 텍스트 일치만 보던 데서 paraphrase된 fact claim이 cover하는 사실을 잘못 버리는 일을
//     막는다.
//   - 비-fact로 분류된 문장이라도 fact claim이 (fuzzy로라도) cover하면(이중 분류) 사실로 인정해 둔다.
//   - 제거 결과 verified_facts가 통째로 비면 결정을 미뤄 원본을 유지한다. 빈 verified_facts는 required
//     article-section 계약이 별도로(정당하게) 처리하므로, 여기서 비우면 blocker만 바뀔 뿐이다.
function dropVerifiedFactsClassifiedAsNonFact(section) {
  const claims = ensureArray(section?.claims);
  if (claims.length === 0) return section;
  const claimType = claim => String(claim?.claim_type || claim?.claimType || '').trim().toLowerCase();
  const factClaims = claims.filter(claim => claimType(claim) === 'fact');
  const nonFactClaims = claims.filter(claim => {
    const type = claimType(claim);
    return type && type !== 'fact';
  });
  if (nonFactClaims.length === 0) return section;
  const articleSections = section.article_sections;
  if (!articleSections || typeof articleSections !== 'object' || Array.isArray(articleSections)) return section;
  const verifiedFacts = ensureArray(articleSections.verified_facts);
  const coveredBy = (factText, claim) => factCoveredByClaim(factText, claim, EMPTY_EVIDENCE_INDEX).covered;
  const kept = verifiedFacts.filter(fact => {
    if (!text(fact)) return true;
    if (!nonFactClaims.some(claim => coveredBy(fact, claim))) return true;
    return factClaims.some(claim => coveredBy(fact, claim));
  });
  if (kept.length === verifiedFacts.length || kept.length === 0) return section;
  return { ...section, article_sections: { ...articleSections, verified_facts: kept } };
}

// repair patch 계약은 /article_sections/verified_facts/{i}는 수정을 허용하지만 claims는 수정 금지
// 경로다. 그런데 claim 바인딩 게이트는 모든 verified_facts가 claim_type=fact claim과 fuzzy 유사도
// (>=0.5)로 이어질 것을 요구하므로, patch가 사실을 같은 의미의 다른 문장으로 바꾸면(허용된 편집)
// 그 사실을 cover하던 claim은 옛 문구로 남아 missing_matching_fact_claim이 되고 repair 전체가
// 거부된다(2026-08-03 FAILED_REPAIR_REVIEWABLE). patch 적용 직후, 어떤 fact claim도 cover하지
// 못하는 verified_facts 편집만 base 문구로 되돌린다(claims는 절대 변경하지 않는다).
//
// claim 텍스트를 새 문구로 "동기화"하는 설계는 채택하지 않는다: fact==claim 항진 커버가 되어
// coverage 게이트가 무력화되고, 유사도 하한으로는 의미 반전 날조([0.2,0.5) 구간)와 짧은 문장의
// 어미-bigram 우연 일치를 막을 수 없음이 적대적 리뷰 재현으로 확인됐다. revert 방식은:
//   - claims 불변 + 커버 요구(>=0.5) 그대로 → 게이트 강도가 수정 전과 정확히 동일하다.
//   - base 문구는 repair 진입 시점에 strict 검증을 통과한 상태이므로, 이후 게이트가 같은 evidence
//     입력(reporter + seedEvidencePack)으로 재검증하는 한 revert 결과는 covered로 유지된다.
//   - 각 fact 항목을 독립적으로 keep-or-revert하므로 다중 fact 동시 rewrite의 순서 의존성이 없다.
//   - cover 판정은 게이트(validateClaimBindingContract)와 동일하게 후보의 실제 evidence index를 쓴다.
//     호출처는 후속 strict 게이트에도 같은 seedEvidencePack을 넘겨야 한다(오라클 입력 불일치 방지).
//   - 효과: 커버 범위를 벗어난 문구 편집 1건만 무효화되고 나머지 patch(prose 등)는 살아남아,
//     run 전체가 FAILED_REPAIR_REVIEWABLE로 죽는 대신 정상 재게이트(fact-check/quality)로 진행한다.
function revertUncoveredPatchedVerifiedFacts(baseEditor, patchedEditor, options = {}) {
  const baseSections = ensureArray(baseEditor?.sections);
  if (baseSections.length === 0 || ensureArray(patchedEditor?.sections).length === 0) return patchedEditor;
  const reporter = options.reporter || { candidates: [] };
  const seedEvidencePack = options.seedEvidencePack || null;
  const candidateIndex = buildCandidateIndex(reporter);
  const repaired = cloneJson(patchedEditor);
  let changed = false;
  // patch 경로는 section 개수/순서를 보존하므로(applyRepairPatches는 clone 후 in-place 교체) index로 대응한다.
  ensureArray(repaired.sections).forEach((section, sectionIndex) => {
    const baseSection = baseSections[sectionIndex];
    if (!baseSection) return;
    // patch는 실제 저장 배열(article_sections.verified_facts)의 기존 index만 교체할 수 있다
    // (setByPointer는 존재하는 키만 허용). 그 배열이 없으면 이 섹션은 patch 대상이 아니었다.
    const articleSections = section.article_sections;
    if (!articleSections || typeof articleSections !== 'object' || Array.isArray(articleSections)) return;
    if (!Array.isArray(articleSections.verified_facts)) return;
    const baseArticleSections = baseSection.article_sections;
    const oldFacts = baseArticleSections && typeof baseArticleSections === 'object' && !Array.isArray(baseArticleSections)
      ? ensureArray(baseArticleSections.verified_facts)
      : [];
    // factCoveredByClaim은 claim의 text/evidence_ids만 읽는다. 별칭 필드(claim/claimType/evidenceIds)
    // claim에서도 안전하도록 정규화 view로 판정한다(view는 판정 전용, 원본 claim은 불변).
    const factClaims = ensureArray(section.claims)
      .filter(claim => String(claim?.claim_type || claim?.claimType || '').trim().toLowerCase() === 'fact')
      .map(claim => ({
        text: text(claim?.text || claim?.claim),
        evidence_ids: ensureArray(claim?.evidence_ids || claim?.evidenceIds).map(text).filter(Boolean)
      }))
      .filter(view => view.text);
    // fact claim이 하나도 없으면 커버리지 판정이 성립하지 않는다(base fact도 똑같이 uncovered라
    // revert가 게이트 결과를 바꾸지 못하고, 비-strict 흐름의 정당한 문구 patch만 막는다). 그대로 둔다.
    if (factClaims.length === 0) return;
    const candidate = candidateForSection(section, candidateIndex) || {};
    const evidenceIndex = buildEvidenceIndex(candidate, section, { seedEvidencePack });
    articleSections.verified_facts.forEach((rawNewFact, factIndex) => {
      const newFact = text(rawNewFact);
      const oldFact = text(oldFacts[factIndex]);
      // oldFact가 비어 있으면(base slot이 빈 문자열 — strictArticleSections 이후엔 사실상 없음)
      // 되돌릴 base 문구가 없다. 그대로 두고 이후 strict 게이트가 판정하게 한다(fail-closed).
      if (!newFact || !oldFact || newFact === oldFact) return;
      if (factClaims.some(view => factCoveredByClaim(newFact, view, evidenceIndex).covered)) return;
      articleSections.verified_facts[factIndex] = oldFacts[factIndex];
      changed = true;
    });
  });
  return changed ? repaired : patchedEditor;
}

function validateArticleSectionContract(value) {
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    const normalized = normalizeArticleSections(section);
    const headline = text(section.headline || section.category || `article ${index + 1}`);
    if (!normalized.diagnostics.article_sections_present) {
      issues.push({
        index: index + 1,
        headline,
        type: 'missing_article_sections',
        keys: ARTICLE_SECTION_KEYS
      });
    } else {
      const unexpectedKeys = unexpectedArticleSectionKeys(section);
      if (unexpectedKeys.length > 0) {
        issues.push({
          index: index + 1,
          headline,
          type: 'unexpected_article_section_keys',
          keys: unexpectedKeys
        });
      }
      if (normalized.diagnostics.missing_keys.length > 0) {
        issues.push({
          index: index + 1,
          headline,
          type: 'empty_article_sections',
          keys: normalized.diagnostics.missing_required_keys
        });
      }
    }
    section.article_sections = strictArticleSections(section);
  });
  if (issues.length > 0) {
    throw semanticError('Editor output failed article section contract validation.', {
      field: 'sections.article_sections',
      expectedKeys: ARTICLE_SECTION_KEYS,
      allowedKeys: ARTICLE_SECTION_ALLOWED_KEYS,
      actualCount: issues.length,
      sectionCount: ensureArray(value.sections).length,
      issues
    });
  }
}

function validatePublicArticleContract(value, options = {}) {
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    issues.push(...validatePublicArticle(section, index, {
      issue: value,
      requireStoryContract: options.requireStoryContract === true
    }));
  });
  if (issues.length > 0) {
    throw semanticError('Editor output failed public article contract validation.', {
      field: 'sections.public_article',
      expectedKeys: publicArticleExpectedKeys(value, {
        requireStoryContract: options.requireStoryContract === true
      }),
      actualCount: issues.length,
      sectionCount: ensureArray(value.sections).length,
      issues
    });
  }
}

function validateHalSignalCapsules(value) {
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    const headline = text(section.headline || section.category || `article ${index + 1}`);
    const capsule = normalizeHalSignalCapsule(section);
    if (!capsule.present) {
      issues.push({
        index: index + 1,
        headline,
        type: 'missing_hal_signal_capsule',
        keys: CAPSULE_REQUIRED_FIELDS
      });
      return;
    }
    if (!capsule.complete) {
      issues.push({
        index: index + 1,
        headline,
        type: 'incomplete_hal_signal_capsule',
        keys: capsule.missing_keys
      });
    }
    section.hal_signal_capsule = capsule.capsule;
  });
  if (issues.length > 0) {
    throw semanticError('Editor output failed HAL Signal Capsule validation.', {
      field: 'sections.hal_signal_capsule',
      expectedKeys: CAPSULE_REQUIRED_FIELDS,
      actualCount: issues.length,
      sectionCount: ensureArray(value.sections).length,
      issues
    });
  }
}

function validateClaimBindingContract(value, reporter = {}, strictClaims = false, seedEvidencePack = null) {
  if (strictClaims !== true) return;
  const candidateIndex = buildCandidateIndex(reporter);
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    const result = validateArticleClaims({
      section,
      candidate: candidateForSection(section, candidateIndex) || {},
      articleIndex: index,
      strict: true,
      seedEvidencePack
    });
    const blockingIssues = [
      ...ensureArray(result.issues),
      ...ensureArray(result.claim_results).flatMap(claim => ensureArray(claim.issues))
    ].filter(item => item.blocking !== false);
    if (blockingIssues.length === 0) return;
    issues.push({
      index: index + 1,
      headline: text(section.headline || section.category || `article ${index + 1}`),
      status: result.status,
      issues: blockingIssues.map(item => ({
        reason_code: item.reason_code,
        message: item.message
      })),
      uncovered_facts: result.uncovered_facts
    });
  });
  if (issues.length > 0) {
    throw semanticError('Editor output failed claim binding validation.', {
      field: 'sections.claims',
      actualCount: issues.length,
      sectionCount: ensureArray(value.sections).length,
      issues
    });
  }
}

function selectedReporterCandidates(reporter = {}) {
  return ensureArray(reporter?.candidates).filter(candidate =>
    candidate.final_selected === true ||
    candidate.selected_for_editor === true ||
    candidate.primary_selected === true
  );
}

function hasDatedEvidence(candidate = {}) {
  return candidate.hasDatedEvidence === true ||
    candidate.has_dated_evidence === true ||
    Boolean(text(candidate.published_date || candidate.publishedAt || candidate.published_at || candidate.effective_date));
}

function hardBlockReasonForCandidate(candidate = {}) {
  if (candidate.source_gap_risk === true) return 'source_gap_risk';
  if (!hasDatedEvidence(candidate)) return 'missing_dated_evidence';
  const hasSourceQualitySignal = Boolean(candidate.source_quality) ||
    Boolean(text(candidate.source_quality_status || candidate.sourceQualityStatus || candidate.source_url_quality || candidate.sourceUrlQuality)) ||
    typeof candidate.main_article_source_allowed === 'boolean' ||
    typeof candidate.mainArticleSourceAllowed === 'boolean';
  if (!hasSourceQualitySignal) return '';
  const sourceQuality = normalizeSourceQuality(candidate);
  if (sourceQuality.main_article_source_allowed !== true ||
    sourceQuality.source_quality_status === 'blocked' ||
    sourceQuality.source_quality_status === 'unknown' ||
    sourceQuality.source_url_quality === 'unknown') {
    return 'blocked_source_quality';
  }
  const readinessBlockers = [
    ...ensureArray(candidate.main_article_readiness?.blockers),
    ...ensureArray(candidate.hal_signal_hard_blockers)
  ].map(text);
  if (readinessBlockers.some(item => /source_gap/i.test(item))) return 'source_gap_risk';
  if (readinessBlockers.some(item => /quality|source/i.test(item))) return 'blocked_source_quality';
  return '';
}

function hardBlockedGroupsFromSelected(candidates = []) {
  const byKey = new Map();
  for (const candidate of ensureArray(candidates)) {
    const key = candidateGroupKey(candidate);
    if (!key || byKey.has(key)) continue;
    const reason = hardBlockReasonForCandidate(candidate);
    if (!reason) continue;
    byKey.set(key, {
      article_group_key: key,
      hard_block_reason: reason,
      reason_code: reason
    });
  }
  return [...byKey.values()];
}

function finalSelectionEligibility(candidate = {}) {
  return text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
}

function isSourceReadyNativeToolingCandidate(candidate = {}) {
  if (!isNativeToolingWorkflow(candidate)) return false;
  if (!['main', 'short'].includes(finalSelectionEligibility(candidate))) return false;
  if (candidate.source_gap_risk === true || candidate.reference_only === true) return false;
  return hardBlockReasonForCandidate(candidate) === '';
}

function validateNativeToolingDemotions(selectedCandidates = [], demotedGroups = []) {
  const selectedNativeGroups = new Set(ensureArray(selectedCandidates)
    .filter(isSourceReadyNativeToolingCandidate)
    .map(candidateGroupKey)
    .filter(Boolean));
  if (selectedNativeGroups.size === 0) return;
  const invalid = ensureArray(demotedGroups)
    .filter(item => selectedNativeGroups.has(text(item.article_group_key)))
    .filter(item =>
      FORBIDDEN_SOURCE_READY_NATIVE_DEMOTION_REASONS.includes(text(item.reason_code)) ||
      !EXPLICIT_DEMOTION_REASON_CODES.includes(text(item.reason_code))
    );
  if (invalid.length > 0) {
    throw semanticError('Editor output demoted a source-ready native tooling group with an invalid reason.', {
      field: 'sections.group_coverage',
      invalid_demotions: invalid,
      allowed_reason_codes: EXPLICIT_DEMOTION_REASON_CODES,
      forbidden_reason_codes: FORBIDDEN_SOURCE_READY_NATIVE_DEMOTION_REASONS
    });
  }
}

function validateGroupStateReasonCodes(demotedGroups = [], hardBlockedGroups = []) {
  const invalidDemotions = ensureArray(demotedGroups)
    .filter(item => !EXPLICIT_DEMOTION_REASON_CODES.includes(text(item.reason_code)))
    .map(item => ({
      article_group_key: text(item.article_group_key),
      reason_code: text(item.reason_code)
    }));
  const invalidHardBlocks = ensureArray(hardBlockedGroups)
    .filter(item => !HARD_BLOCK_REASON_CODES.includes(text(item.reason_code)))
    .map(item => ({
      article_group_key: text(item.article_group_key),
      reason_code: text(item.reason_code)
    }));
  if (invalidDemotions.length > 0 || invalidHardBlocks.length > 0) {
    throw semanticError('Editor output used an invalid group state reason code.', {
      field: 'sections.group_coverage',
      invalid_demotions: invalidDemotions,
      invalid_hard_blocks: invalidHardBlocks,
      allowed_demotion_reason_codes: EXPLICIT_DEMOTION_REASON_CODES,
      allowed_hard_block_reason_codes: HARD_BLOCK_REASON_CODES
    });
  }
}

function sectionGroupKey(section = {}, candidate = null) {
  return text(section.article_group_key || section.articleGroupKey) ||
    (candidate ? candidateGroupKey(candidate) : '');
}

function validateSelectedGroupCoverage(value, reporter = {}, publishMode = 'DEEP') {
  const selectedGroupKeys = [...new Set(selectedReporterCandidates(reporter).map(candidateGroupKey).filter(Boolean))];
  if (selectedGroupKeys.length === 0) return null;
  // CONTEXT/QUIET 모드는 "선택된 모든 그룹이 메인 섹션으로 렌더링되어야 한다"를 요구하지 않는다.
  // 코어 기사가 없는 날의 정직한 발행을 허용하기 위함. 근거/출처 게이트는 별도로 유지된다.
  if (publishMode === 'CONTEXT' || publishMode === 'QUIET') {
    return null;
  }
  const selectedCandidates = selectedReporterCandidates(reporter);
  const candidateIndex = buildCandidateIndex(reporter);
  const renderedGroupKeys = ensureArray(value.sections)
    .map(section => sectionGroupKey(section, candidateForSection(section, candidateIndex)))
    .filter(Boolean);
  const demotedGroups = explicitDemotedGroups(value);
  const hardBlockedGroups = [
    ...hardBlockedGroupsFromSelected(selectedCandidates),
    ...explicitHardBlockedGroups(value)
  ];
  const hardBlockedKeys = new Set(hardBlockedGroups.map(item => text(item.article_group_key)).filter(Boolean));
  const effectiveDemotedGroups = demotedGroups.filter(item => !hardBlockedKeys.has(text(item.article_group_key)));
  validateGroupStateReasonCodes(effectiveDemotedGroups, hardBlockedGroups);
  validateNativeToolingDemotions(selectedCandidates, effectiveDemotedGroups);
  const coverage = groupCoverageSummary({
    selectedGroupKeys,
    renderedGroupKeys,
    demotedGroups: effectiveDemotedGroups,
    hardBlockedGroups
  });
  value.selected_group_count = coverage.selected_group_count;
  value.rendered_group_count = coverage.rendered_group_count;
  value.explicitly_demoted_group_count = coverage.explicitly_demoted_group_count;
  value.hard_blocked_group_count = coverage.hard_blocked_group_count;
  value.selected_representative_group_keys = coverage.selected_representative_group_keys;
  value.rendered_group_keys = coverage.rendered_group_keys;
  value.explicitly_demoted_group_keys = coverage.explicitly_demoted_group_keys;
  value.hard_blocked_group_keys = coverage.hard_blocked_group_keys;
  if (coverage.ok) return coverage;
  throw semanticError('Editor output failed selected group coverage validation.', {
    field: 'sections.group_coverage',
    ...coverage,
    sectionCount: ensureArray(value.sections).length
  });
}

function candidateBlockedContexts(candidate = {}) {
  return [
    ...ensureArray(candidate.related_context_candidates),
    ...ensureArray(candidate.blocked_context_candidates)
  ];
}

function blockedContextCandidates(reporter = {}) {
  const seen = new Set();
  return selectedReporterCandidates(reporter)
    // Defense-in-depth: a selected candidate's OWN source URL is never an "improperly used
    // blocked context" — it is the article's legitimate source. Drop blocked-context entries
    // whose normalized URL matches their originating candidate's own source URL, so a self-URL
    // that leaked into related/blocked context cannot raise blocked_context_url_used_as_article_source.
    // Per-candidate scope keeps a DIFFERENT article's blocked aggregator URL fully blocked.
    .flatMap(candidate => {
      const selfUrl = normalizeGroupUrl(text(
        candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url
      ));
      return candidateBlockedContexts(candidate)
        .filter(item => !selfUrl || normalizeGroupUrl(item.url) !== selfUrl);
    })
    .filter(item => item.context_usage_allowed !== true)
    .map(item => ({
      title: text(item.title),
      url: text(item.url),
      normalized_url: normalizeGroupUrl(item.url),
      context_role: text(item.context_role || item.context_usage_label),
      reason: text(item.blocked_from_independent_main_reason)
    }))
    .filter(item => {
      if (!item.title && !item.url) return false;
      const key = `${item.normalized_url}|${item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function validateBlockedContextUsage(value, reporter = {}) {
  const blocked = blockedContextCandidates(reporter);
  if (blocked.length === 0) return;
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    const sectionSourceUrls = ensureArray(section.sources)
      .map(source => normalizeGroupUrl(source?.url))
      .filter(Boolean);
    const publicSourceUrls = ensureArray(section.public_article?.source_links)
      .map(source => normalizeGroupUrl(source?.url))
      .filter(Boolean);
    const headline = text(section.headline || section.category || `article ${index + 1}`);
    const normalizedHeadline = headline.toLowerCase();
    for (const item of blocked) {
      if (item.normalized_url && (sectionSourceUrls.includes(item.normalized_url) || publicSourceUrls.includes(item.normalized_url))) {
        issues.push({
          index: index + 1,
          headline,
          type: 'blocked_context_url_used_as_article_source',
          url: item.url,
          context_role: item.context_role,
          reason: item.reason
        });
      }
      if (item.title && normalizedHeadline === item.title.toLowerCase()) {
        issues.push({
          index: index + 1,
          headline,
          type: 'blocked_context_title_used_as_independent_headline',
          title: item.title,
          context_role: item.context_role,
          reason: item.reason
        });
      }
    }
  });
  if (issues.length > 0) {
    throw semanticError('Editor output used blocked related context as an article source or headline.', {
      field: 'sections.blocked_context',
      actualCount: issues.length,
      sectionCount: ensureArray(value.sections).length,
      issues
    });
  }
}

function validateEditorOutputContract(value, date, options = {}) {
  const reporter = options.reporter || { candidates: [] };
  const normalizeSection = options.normalizeSection || (section => ({
    ...section,
    sources: ensureArray(section?.sources).filter(source => source && source.url)
  }));
  if (!value || typeof value !== 'object') {
    throw semanticError('Editor output must be a JSON object.', {
      field: 'editor',
      actualType: actualType(value),
      sectionCount: null
    });
  }
  if (isDomainDraftArtifact(value)) {
    value = toLegacyEditorIssue(value, { date });
  }
  if (value.date !== date) value.date = date;
  value.title = value.title || `Camera HAL / SW Newsletter - ${date}`;
  if (!value.title.includes(date)) value.title = `Camera HAL / SW Newsletter - ${date}`;
  if (!value.summary) {
    throw semanticError('Editor output is missing summary.', {
      field: 'summary',
      actualType: actualType(value.summary),
      sectionCount: Array.isArray(value.sections) ? value.sections.length : null
    });
  }
  if (!Array.isArray(value.briefing) || value.briefing.length !== REQUIRED_BRIEFING_COUNT) {
    throw briefingCountError(value);
  }
  validateSectionCount(value);

  value.sections = value.sections.map((section, index) => normalizeSection(section, index, reporter));
  validatePublicArticleContract(value, {
    requireStoryContract: options.requireStoryContract === true
  });
  validateArticleSectionContract(value);
  validateHalSignalCapsules(value);
  validateFieldHygiene(value);
  validateClaimBindingContract(value, reporter, options.strictClaims === true, options.seedEvidencePack || null);
  validateEditorArticlePolicy(value, reporter);
  validateBlockedContextUsage(value, reporter);
  validateSelectedGroupCoverage(value, reporter, options.publishMode);

  const emptySourceSections = value.sections
    .filter(section => ensureArray(section.sources).length === 0)
    .map(section => section.category);
  if (emptySourceSections.length > 0) {
    throw semanticError(`Editor output has sections without sources: ${emptySourceSections.join(', ')}`, {
      field: 'sections.sources',
      emptySourceSections,
      sectionCount: value.sections.length
    });
  }

  const refs = new Map();
  for (const section of value.sections) {
    for (const source of section.sources) {
      refs.set(source.url, { title: source.title || source.url, url: source.url });
    }
  }
  value.references = [...refs.values()];
  if (value.references.length === 0) {
    throw semanticError('Editor output must contain references.', {
      field: 'references',
      actualCount: 0,
      expectedMinCount: 1,
      sectionCount: value.sections.length
    });
  }
  return value;
}

function serializeEditorValidationError(error, extra = {}) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || error || 'Unknown editor validation failure.'),
    details: error?.details || null,
    field: error?.details?.field || error?.field || null,
    ...extra
  };
}

function diagnosticFileNames(attempt, phase = 'attempt') {
  if (phase === 'repair') {
    return {
      invalid: `editor-invalid-repair-attempt-${attempt}.json`,
      error: `editor-validation-error-repair-attempt-${attempt}.json`
    };
  }
  return {
    invalid: `editor-invalid-attempt-${attempt}.json`,
    error: `editor-validation-error-attempt-${attempt}.json`
  };
}

function writeEditorValidationDiagnostics({
  newsroomDir,
  attempt,
  phase = 'attempt',
  output,
  error,
  extra = {}
}) {
  const names = diagnosticFileNames(attempt, phase);
  const invalidOutput = output === undefined
    ? { unavailable: true }
    : output;
  writeJson(path.join(newsroomDir, names.invalid), invalidOutput);
  writeJson(path.join(newsroomDir, names.error), serializeEditorValidationError(error, extra));
  return names;
}

function sectionSourceSignature(editor) {
  return ensureArray(editor?.sections).map(section => ({
    headline: section?.headline || '',
    category: section?.category || '',
    sources: ensureArray(section?.sources).map(source => ({
      title: source?.title || '',
      url: source?.url || ''
    }))
  }));
}

function assertSectionsAndSourcesPreserved(before, after) {
  const beforeSignature = sectionSourceSignature(before);
  const afterSignature = sectionSourceSignature(after);
  if (JSON.stringify(beforeSignature) === JSON.stringify(afterSignature)) {
    return true;
  }
  throw semanticError('Editor semantic repair changed sections or sources.', {
    field: 'sections.sources',
    expected: beforeSignature,
    actual: afterSignature,
    sectionCount: afterSignature.length
  });
}

function attachSemanticStatus(error, status) {
  error.editorSemanticValidation = status.editor_semantic_validation;
  error.repairAttempted = status.repairAttempted;
  error.repairSucceeded = status.repairSucceeded;
  return error;
}

function isRepairableSemanticField(field) {
  return REPAIRABLE_SEMANTIC_FIELDS.has(text(field));
}

function isUnsupportedStoryMarkerRepairBlock(reasonCodes = []) {
  return ensureArray(reasonCodes).some(code => /^unsupported_.*contract_version$/.test(text(code)));
}

async function repairEditorOutputContract({
  value,
  date,
  reporter = { candidates: [] },
  attempt = 1,
  stage = 'editor',
  newsroomDir,
  normalizeSection,
  strictClaims = false,
  requireStoryContract = false,
  seedEvidencePack = null,
  publishMode = 'DEEP',
  repairFn
}) {
  const invalidEditor = cloneJson(value);
  const validate = candidate => validateEditorOutputContract(candidate, date, {
    reporter,
    normalizeSection,
    strictClaims,
    requireStoryContract,
    seedEvidencePack,
    publishMode
  });
  const unsupportedStoryMarkerPreflightIssues = unsupportedStoryMarkerIssues(invalidEditor);
  if (unsupportedStoryMarkerPreflightIssues.length > 0) {
    const reasonCodes = uniqueText(unsupportedStoryMarkerPreflightIssues.map(issue => issue.type));
    const error = semanticError('Editor output contains unsupported story contract marker.', {
      field: 'sections.public_article',
      actualCount: unsupportedStoryMarkerPreflightIssues.length,
      sectionCount: ensureArray(invalidEditor?.sections).length,
      issues: unsupportedStoryMarkerPreflightIssues
    });
    error.deterministic_repair_failure_reason_codes = reasonCodes;
    const initialDetails = {
      ...serializeEditorValidationError(error, {
        deterministic_repair_failure_reason_codes: reasonCodes
      }),
      stage,
      attempt
    };
    if (newsroomDir) {
      writeEditorValidationDiagnostics({
        newsroomDir,
        attempt,
        phase: 'attempt',
        output: invalidEditor,
        error,
        extra: {
          stage,
          attempt,
          repairAttempted: false,
          repairSucceeded: false,
          deterministic_repair_failure_reason_codes: reasonCodes
        }
      });
    }
    error.stage = stage;
    attachSemanticStatus(error, {
      editor_semantic_validation: initialDetails,
      repairAttempted: false,
      repairSucceeded: false
    });
    throw error;
  }

  try {
    const editor = validate(value);
    return {
      editor,
      editor_semantic_validation: null,
      repairAttempted: false,
      repairSucceeded: false
    };
  } catch (error) {
    if (!(error instanceof EditorSemanticValidationError)) throw error;
    const repairField = error.details?.field || error.field || '';
    let deterministicRepair = null;
    let deterministicRepairFailureReasonCodes = [];
    if (repairField === 'sections.article_sections' || repairField === 'sections.hal_signal_capsule' || repairField === 'sections.public_article') {
      deterministicRepair = deterministicallyRepairEditorSchema(invalidEditor, { requireStoryContract });
      deterministicRepairFailureReasonCodes = ensureArray(deterministicRepair?.reason_codes);
      if (deterministicRepairFailureReasonCodes.length > 0) {
        error.deterministic_repair_failure_reason_codes = deterministicRepairFailureReasonCodes;
      }
    } else if (repairField === 'sections.claims') {
      deterministicRepair = deterministicallyBackfillFactClaims(invalidEditor, { reporter, seedEvidencePack });
      deterministicRepairFailureReasonCodes = ensureArray(deterministicRepair?.reason_codes);
      if (deterministicRepairFailureReasonCodes.length > 0) {
        error.deterministic_repair_failure_reason_codes = deterministicRepairFailureReasonCodes;
      }
    }
    const initialDetails = {
      ...serializeEditorValidationError(error, deterministicRepairFailureReasonCodes.length > 0
        ? { deterministic_repair_failure_reason_codes: deterministicRepairFailureReasonCodes }
        : {}),
      stage,
      attempt
    };
    if (newsroomDir) {
      writeEditorValidationDiagnostics({
        newsroomDir,
        attempt,
        phase: 'attempt',
        output: invalidEditor,
        error,
        extra: {
          stage,
          attempt,
          repairAttempted: false,
          repairSucceeded: false,
          ...(deterministicRepairFailureReasonCodes.length > 0
            ? { deterministic_repair_failure_reason_codes: deterministicRepairFailureReasonCodes }
            : {})
        }
      });
    }

    if (!isRepairableSemanticField(repairField)) {
      error.stage = stage;
      attachSemanticStatus(error, {
        editor_semantic_validation: initialDetails,
        repairAttempted: false,
        repairSucceeded: false
      });
      throw error;
    }

    if (deterministicRepair?.repairable === false ||
      isUnsupportedStoryMarkerRepairBlock(deterministicRepairFailureReasonCodes)) {
      error.stage = stage;
      attachSemanticStatus(error, {
        editor_semantic_validation: initialDetails,
        repairAttempted: false,
        repairSucceeded: false
      });
      throw error;
    }

    if (deterministicRepair?.editor) {
      try {
        const deterministicEditor = validate(cloneJson(deterministicRepair.editor));
        assertSectionsAndSourcesPreserved(invalidEditor, deterministicRepair.editor);
        return {
          editor: deterministicEditor,
          editor_semantic_validation: initialDetails,
          repairAttempted: true,
          repairSucceeded: true,
          deterministicRepair: true
        };
      } catch (revalidationError) {
        // sections.claims 백필이 성공했으나 후속 게이트(다른 field)가 실패한 경우:
        // 낡은 claims 에러로 LLM을 재호출하는 대신 새 blocker를 바로 노출한다.
        if (
          repairField === 'sections.claims' &&
          revalidationError instanceof EditorSemanticValidationError
        ) {
          const newField = revalidationError.details?.field || revalidationError.field || '';
          if (newField !== repairField) {
            if (newsroomDir) {
              writeEditorValidationDiagnostics({
                newsroomDir,
                attempt,
                phase: 'repair',
                output: deterministicRepair.editor,
                error: revalidationError,
                extra: { stage, attempt, repairAttempted: true, repairSucceeded: false }
              });
            }
            revalidationError.stage = stage;
            attachSemanticStatus(revalidationError, {
              editor_semantic_validation: {
                ...serializeEditorValidationError(revalidationError),
                stage,
                attempt,
                initial: initialDetails
              },
              repairAttempted: true,
              repairSucceeded: false
            });
            throw revalidationError;
          }
        }
        // 그 외(스키마 수선 경로 또는 같은 필드 재실패): LLM 수선 경로로 fall through.
      }
    }

    if (typeof repairFn !== 'function') {
      error.stage = stage;
      const missingRepairError = attachSemanticStatus(error, {
        editor_semantic_validation: initialDetails,
        repairAttempted: false,
        repairSucceeded: false
      });
      throw missingRepairError;
    }

    let repairedRaw;
    try {
      repairedRaw = await repairFn({
        invalidEditor: cloneJson(invalidEditor),
        validationError: serializeEditorValidationError(error, deterministicRepairFailureReasonCodes.length > 0
          ? { deterministic_repair_failure_reason_codes: deterministicRepairFailureReasonCodes }
          : {}),
        details: error.details,
        stage,
        attempt
      });
      const repairedForValidation = cloneJson(repairedRaw);
      const repairedEditor = validate(repairedForValidation);
      // #482: repair must be an article-preserving patch. group_coverage and
      // blocked_context legitimately restructure sections, so they keep the
      // looser preserve check; every other field is held to the strict
      // identity/source/structure firewall, which rejects the LLM rewriting
      // article identity before the output is ever accepted.
      if (!['sections.group_coverage', 'sections.blocked_context'].includes(repairField)) {
        const patchContract = checkRepairPatchContract(invalidEditor, repairedRaw);
        if (!patchContract.ok) {
          throw semanticError('Editor semantic repair violated the article-preserving patch contract.', {
            field: 'sections.repair_patch',
            reason: REPAIR_PATCH_CONTRACT_VIOLATION,
            violations: patchContract.violations,
            sectionCount: ensureArray(repairedRaw?.sections).length
          });
        }
      }
      return {
        editor: repairedEditor,
        editor_semantic_validation: initialDetails,
        repairAttempted: true,
        repairSucceeded: true
      };
    } catch (repairError) {
      const semanticRepairError = repairError instanceof EditorSemanticValidationError
        ? repairError
        : semanticError(`Editor semantic repair failed: ${repairError.message}`, {
          field: repairField || 'editor',
          cause: repairError.message,
          sectionCount: Array.isArray(repairedRaw?.sections) ? repairedRaw.sections.length : null
        });
      const repairDetails = {
        ...serializeEditorValidationError(semanticRepairError),
        stage,
        attempt,
        initial: initialDetails
      };
      if (newsroomDir) {
        writeEditorValidationDiagnostics({
          newsroomDir,
          attempt,
          phase: 'repair',
          output: repairedRaw,
          error: semanticRepairError,
          extra: { stage, attempt, repairAttempted: true, repairSucceeded: false }
        });
      }
      semanticRepairError.stage = stage;
      attachSemanticStatus(semanticRepairError, {
        editor_semantic_validation: repairDetails,
        repairAttempted: true,
        repairSucceeded: false
      });
      throw semanticRepairError;
    }
  }
}

module.exports = {
  EditorSemanticValidationError,
  assertSectionsAndSourcesPreserved,
  bindMissingFactClaimEvidence,
  deterministicallyRepairEditorSchema,
  dropVerifiedFactsClassifiedAsNonFact,
  reconcileFactClaimEvidence,
  revertUncoveredPatchedVerifiedFacts,
  repairEditorOutputContract,
  serializeEditorValidationError,
  validateEditorArticlePolicy,
  validateEditorOutputContract,
  validatePublicArticleContract,
  writeEditorValidationDiagnostics
};
