const { ensureArray } = require('../common/value-coercion');
const path = require('path');
const { writeJson } = require('../common/common');
const {
  normalizeUrl
} = require('../generate/newsroom-selection');
const {
  articlePolicy,
  articleCountRangeText,
  isForbiddenMainBucket,
  isPrimaryCameraStackBucket
} = require('../common/newsletter-policy');
const {
  findFieldHygieneIssues,
  inferGuardrailImpactClass
} = require('../generate/article-field-builder');
const {
  ARTICLE_SECTION_ALLOWED_KEYS,
  ARTICLE_SECTION_KEYS,
  ARTICLE_SECTION_OPTIONAL_KEYS,
  normalizeArticleSections,
  unexpectedArticleSectionKeys
} = require('../common/article-section-contract');
const {
  CAPSULE_REQUIRED_FIELDS,
  completeHalSignalCapsuleFromExistingFields,
  normalizeHalSignalCapsule
} = require('../common/hal-signal-quality');
const {
  PUBLIC_ARTICLE_REQUIRED_KEYS,
  PUBLIC_ARTICLE_STORY_REQUIRED_KEYS,
  GENERATION_CONTRACT_VERSION,
  STORY_CONTRACT_VERSION,
  STORY_PUBLIC_CONTRACT_VERSION,
  publicArticleForSection,
  storyContractMarkers,
  validatePublicArticle
} = require('../common/public-article-contract');
const {
  buildAllowedClaimEvidence,
  validateArticleClaims
} = require('./claim-source-binding');
const {
  REPAIR_PATCH_CONTRACT_VIOLATION,
  checkRepairPatchContract
} = require('./repair-patch-contract');
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
} = require('../common/article-groups');
const {
  normalizeSourceQuality
} = require('../collect/source-quality-classifier');
const {
  isDomainDraftArtifact,
  toLegacyEditorIssue
} = require('../domain/newsletter-domain-normalize');

const REQUIRED_BRIEFING_COUNT = 3;

class EditorSemanticValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EditorSemanticValidationError';
    this.details = details;
    this.field = details.field || '';
  }
}

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

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function actualType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function text(value) {
  return String(value || '').trim();
}

function countDetails(value, field, expected = {}) {
  const actualValue = value?.[field];
  const isArray = Array.isArray(actualValue);
  return {
    field,
    ...expected,
    actualCount: isArray ? actualValue.length : null,
    actualType: actualType(actualValue),
    sectionCount: Array.isArray(value?.sections) ? value.sections.length : null
  };
}

function candidateHash(candidate = {}) {
  candidate = candidate || {};
  return text(candidate.source_candidate_hash || candidate.url_hash || candidate.normalized_url_hash);
}

function candidateUrls(candidate = {}) {
  candidate = candidate || {};
  return [
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url
  ].map(text).filter(Boolean);
}

function buildCandidateIndex(reporter = {}) {
  const byHash = new Map();
  const byUrl = new Map();
  for (const candidate of ensureArray(reporter?.candidates)) {
    const hash = candidateHash(candidate);
    if (hash && !byHash.has(hash)) byHash.set(hash, candidate);
    for (const url of candidateUrls(candidate)) {
      const key = normalizeUrl(url);
      if (key && !byUrl.has(key)) byUrl.set(key, candidate);
    }
  }
  return { byHash, byUrl };
}

function candidateForSection(section = {}, candidateIndex) {
  const hash = text(section.source_candidate_hash || section.url_hash || section.normalized_url_hash);
  if (hash && candidateIndex.byHash.has(hash)) return candidateIndex.byHash.get(hash);
  for (const source of ensureArray(section.sources)) {
    const key = normalizeUrl(source?.url);
    if (key && candidateIndex.byUrl.has(key)) return candidateIndex.byUrl.get(key);
  }
  return null;
}

function sectionPolicyMetadata(section = {}, candidate = null) {
  const sectionBucket = text(section.relevance_bucket);
  const candidateBucket = text(candidate?.relevance_bucket);
  const bucket = sectionBucket || candidateBucket;
  const sectionPrimaryFlag = section.counts_as_primary_camera_topic === true;
  const candidatePrimaryFlag = candidate?.counts_as_primary_camera_topic === true;
  return {
    bucket,
    primary: sectionPrimaryFlag ||
      candidatePrimaryFlag ||
      isPrimaryCameraStackBucket(sectionBucket) ||
      isPrimaryCameraStackBucket(candidateBucket),
    forbidden: isForbiddenMainBucket(sectionBucket) || isForbiddenMainBucket(candidateBucket),
    source_candidate_hash: text(section.source_candidate_hash || candidateHash(candidate)),
    source_candidate_url: text(section.source_candidate_url || candidate?.url || candidate?.article_url || candidate?.articleUrl)
  };
}

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

function semanticError(message, details = {}) {
  return new EditorSemanticValidationError(message, details);
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

function strictArticleSections(section) {
  const normalized = normalizeArticleSections(section);
  const output = {
    verified_facts: normalized.verified_facts,
    background_context: normalized.background_context,
    hal_driver_impact: normalized.hal_driver_impact,
    action_items: normalized.action_items,
    team_share_points: normalized.team_share_points
  };
  for (const key of ARTICLE_SECTION_OPTIONAL_KEYS) {
    if (normalized[key].length > 0) output[key] = normalized[key];
  }
  return output;
}

function uniqueText(values) {
  const output = [];
  const seen = new Set();
  const items = Array.isArray(values) ? values.flat() : [values];
  for (const value of items) {
    const parsed = text(value);
    if (!parsed) continue;
    const key = parsed.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(parsed);
  }
  return output;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergeBackgroundContext(section = {}) {
  const publicArticle = asObject(section.public_article);
  return uniqueText([
    section.evidence_summary,
    ...ensureArray(publicArticle.body_paragraphs)
  ]).join('\n\n');
}

function buildArticleSectionsFromSectionFields(section = {}) {
  const reasonCodes = [];
  const publicArticle = asObject(section.public_article);
  const editorialStory = asObject(publicArticle.editorial_story);
  const verifiedFacts = uniqueText(section.confirmed_facts);
  const backgroundContext = mergeBackgroundContext(section);
  const halDriverImpact = text(publicArticle.camera_hal_takeaway);
  const actionItems = uniqueText([section.action_items, section.camera_hal_checks]);
  const teamSharePoints = text(editorialStory.editor_take || publicArticle.camera_hal_takeaway);
  if (!backgroundContext) reasonCodes.push('missing_background_context');
  if (!halDriverImpact) reasonCodes.push('missing_hal_driver_impact');
  if (actionItems.length === 0) reasonCodes.push('missing_action_items');
  if (!teamSharePoints) reasonCodes.push('missing_team_share_points');

  const repaired = {
    verified_facts: verifiedFacts,
    background_context: backgroundContext,
    hal_driver_impact: halDriverImpact,
    action_items: actionItems,
    team_share_points: teamSharePoints
  };
  const knownLimitations = uniqueText([section.limitations, section.known_limitations]);
  const watchItems = uniqueText(section.watch_items);
  const doNotClaim = uniqueText([
    ...ensureArray(section.do_not_claim),
    ...ensureArray(section.overclaim_guardrails),
    ...ensureArray(section.do_not_overstate)
  ]);
  if (knownLimitations.length > 0) repaired.known_limitations = knownLimitations;
  if (watchItems.length > 0) repaired.watch_items = watchItems;
  if (doNotClaim.length > 0) repaired.do_not_claim = doNotClaim;
  return {
    article_sections: repaired,
    reason_codes: uniqueText(reasonCodes)
  };
}

function sourceSubtitleFromSection(section = {}, publicArticle = {}) {
  const firstSource = ensureArray(publicArticle.source_links)[0] || ensureArray(section.sources)[0] || {};
  return text(firstSource.title || firstSource.publisher || section.category || publicArticle.headline || section.headline);
}

function headlineRepairSuffix(section = {}, publicArticle = {}) {
  const combined = [
    section.relevance_bucket,
    section.category,
    section.headline,
    publicArticle.headline
  ].map(text).join(' ');
  if (/soc_platform|thermal|isp/i.test(combined)) return 'preview latency 검증 포인트';
  if (/camera_driver|image_pipeline|libcamera/i.test(combined)) return 'stream/buffer 검증 포인트';
  if (/android_platform|camerax|camera2/i.test(combined)) return 'preview/capture 호환성 확인';
  if (/tooling|cpp|native/i.test(combined)) return 'native tooling 확인 범위';
  return 'Camera HAL 검토 포인트';
}

function storyHeadlineFromSection(section = {}, publicArticle = {}) {
  const headline = text(publicArticle.headline || section.headline || section.category || 'Camera HAL 관련 소식');
  const normalizedHeadline = headline.toLowerCase();
  const sourceTitles = [
    ...ensureArray(section.sources),
    ...ensureArray(publicArticle.source_links)
  ]
    .map(source => text(source?.title))
    .filter(Boolean);
  if (sourceTitles.some(title => title.toLowerCase() === normalizedHeadline)) {
    return `${headline}: ${headlineRepairSuffix(section, publicArticle)}`;
  }
  return headline;
}

function buildStoryFromPublicArticle(section = {}, publicArticle = {}) {
  const headline = text(publicArticle.headline || section.headline || section.category || 'Camera HAL 관련 소식');
  const checkpoints = ensureArray(publicArticle.reader_checkpoints).filter(Boolean);
  const limitations = uniqueText([
    publicArticle.editorial_story?.not_to_overclaim,
    ...ensureArray(section.do_not_overstate),
    ...ensureArray(section.hal_signal_capsule?.do_not_overstate)
  ]);
  const articleSections = normalizeArticleSections(section);
  return {
    reader_scenario: `${headline}을 Camera HAL / Driver / Native tooling 리뷰 범위에 넣을지 판단하는 현업 상황을 가정합니다.`,
    what_happened: text(publicArticle.lead || section.what_changed || section.evidence_summary),
    why_it_matters: text(publicArticle.camera_hal_takeaway || articleSections.hal_driver_impact),
    field_scenario: checkpoints.join(' ') || text(section.camera_hal_checks || section.action_items),
    not_to_overclaim: limitations.join(' ') || 'source가 직접 말하지 않는 HAL runtime, driver branch, vendor tag, pipeline 영향으로 확대하지 않습니다.',
    editor_take: text(articleSections.team_share_points || publicArticle.camera_hal_takeaway || `${headline}은 source 범위 안에서만 확인합니다.`)
  };
}

function completeStoryPublicArticle(section = {}) {
  const publicArticle = publicArticleForSection(section);
  const headline = storyHeadlineFromSection(section, publicArticle);
  publicArticle.headline = headline;
  return {
    ...publicArticle,
    headline,
    story_contract_version: STORY_CONTRACT_VERSION,
    source_subtitle: text(publicArticle.source_subtitle) || sourceSubtitleFromSection(section, publicArticle),
    editorial_story: {
      ...buildStoryFromPublicArticle(section, publicArticle),
      ...(publicArticle.editorial_story && typeof publicArticle.editorial_story === 'object'
        ? Object.fromEntries(Object.entries(publicArticle.editorial_story).map(([key, value]) => [key, text(value)]))
        : {})
    }
  };
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
    if (repaired.public_contract_version !== STORY_PUBLIC_CONTRACT_VERSION) {
      repaired.public_contract_version = STORY_PUBLIC_CONTRACT_VERSION;
      changed = true;
    }
    const generationContractVersion = Number(repaired.generation_contract_version);
    if (
      !Number.isFinite(generationContractVersion) ||
      generationContractVersion < GENERATION_CONTRACT_VERSION
    ) {
      repaired.generation_contract_version = GENERATION_CONTRACT_VERSION;
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
// verified_facts[] but an empty claims[], copy each verified fact verbatim into a fact claim and
// bind it only to the candidate's own allowed_claim_evidence. No new facts and no evidence are
// invented; the real claim binding validator is the oracle, so anything that cannot bind safely is
// left to the LLM repair path (and ultimately fails closed).
function deterministicallyBackfillFactClaims(value, options = {}) {
  const reporter = options.reporter || { candidates: [] };
  const seedEvidencePack = options.seedEvidencePack || null;
  const repaired = cloneJson(value);
  const candidateIndex = buildCandidateIndex(reporter);
  const reasonCodes = [];
  let changed = false;

  ensureArray(repaired?.sections).forEach((section, index) => {
    if (ensureArray(section.claims).length > 0) return;
    const candidate = candidateForSection(section, candidateIndex) || {};
    const verifiedFacts = uniqueText(
      ensureArray(normalizeArticleSections(section).verified_facts).map(text).filter(Boolean)
    );
    if (verifiedFacts.length === 0) {
      reasonCodes.push('no_verified_facts_to_bind');
      return;
    }
    const allowedEvidence = buildAllowedClaimEvidence(candidate, section, { seedEvidencePack });
    if (allowedEvidence.length === 0) {
      reasonCodes.push('no_allowed_claim_evidence');
      return;
    }
    const newClaims = [];
    let sectionFailed = false;
    verifiedFacts.forEach((factText, factIndex) => {
      if (sectionFailed) return;
      const claim = backfillFactClaim({
        section,
        candidate,
        articleIndex: index,
        seedEvidencePack,
        factText,
        allowedEvidence,
        claimId: `article-${index + 1}-fact-${factIndex + 1}`
      });
      if (!claim) {
        sectionFailed = true;
        reasonCodes.push('unbindable_verified_fact');
        return;
      }
      newClaims.push(claim);
    });
    if (sectionFailed) return;
    const candidateSection = cloneJson(section);
    candidateSection.claims = newClaims;
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
    section.claims = newClaims;
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
      expectedKeys: options.requireStoryContract === true ? PUBLIC_ARTICLE_STORY_REQUIRED_KEYS : PUBLIC_ARTICLE_REQUIRED_KEYS,
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
  reconcileFactClaimEvidence,
  repairEditorOutputContract,
  serializeEditorValidationError,
  validateEditorArticlePolicy,
  validateEditorOutputContract,
  validatePublicArticleContract,
  writeEditorValidationDiagnostics
};
