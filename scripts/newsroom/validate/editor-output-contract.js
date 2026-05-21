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
  inferImpactClaimLevel
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
  normalizeHalSignalCapsule
} = require('../common/hal-signal-quality');
const {
  PUBLIC_ARTICLE_REQUIRED_KEYS,
  validatePublicArticle
} = require('../common/public-article-contract');
const {
  validateArticleClaims
} = require('./claim-source-binding');
const {
  candidateGroupKey,
  explicitDemotedGroups,
  groupCoverageSummary,
  normalizeUrl: normalizeGroupUrl
} = require('../common/article-groups');

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

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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
    const impactClaimLevel = text(section.impact_claim_level || section.impactClaimLevel) ||
      inferImpactClaimLevel(section);
    const sectionIssues = findFieldHygieneIssues({
      ...section,
      impact_claim_level: impactClaimLevel
    });
    for (const issue of sectionIssues.filter(item => item.blocking !== false)) {
      issues.push({
        index: index + 1,
        headline: text(section.headline || section.category || `article ${index + 1}`),
        impact_claim_level: impactClaimLevel,
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

function validatePublicArticleContract(value) {
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    issues.push(...validatePublicArticle(section, index));
  });
  if (issues.length > 0) {
    throw semanticError('Editor output failed public article contract validation.', {
      field: 'sections.public_article',
      expectedKeys: PUBLIC_ARTICLE_REQUIRED_KEYS,
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

function validateClaimBindingContract(value, reporter = {}, strictClaims = false) {
  if (strictClaims !== true) return;
  const candidateIndex = buildCandidateIndex(reporter);
  const issues = [];
  ensureArray(value.sections).forEach((section, index) => {
    const result = validateArticleClaims({
      section,
      candidate: candidateForSection(section, candidateIndex) || {},
      articleIndex: index,
      strict: true
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

function sectionGroupKey(section = {}, candidate = null) {
  return text(section.article_group_key || section.articleGroupKey) ||
    (candidate ? candidateGroupKey(candidate) : '');
}

function validateSelectedGroupCoverage(value, reporter = {}) {
  const selectedGroupKeys = [...new Set(selectedReporterCandidates(reporter).map(candidateGroupKey).filter(Boolean))];
  if (selectedGroupKeys.length === 0) return null;
  const candidateIndex = buildCandidateIndex(reporter);
  const renderedGroupKeys = [...new Set(ensureArray(value.sections)
    .map(section => sectionGroupKey(section, candidateForSection(section, candidateIndex)))
    .filter(Boolean))];
  const demotedGroups = explicitDemotedGroups(value);
  const coverage = groupCoverageSummary({ selectedGroupKeys, renderedGroupKeys, demotedGroups });
  value.selected_group_count = coverage.selected_group_count;
  value.rendered_group_count = coverage.rendered_group_count;
  value.explicitly_demoted_group_count = coverage.explicitly_demoted_group_count;
  value.selected_representative_group_keys = coverage.selected_representative_group_keys;
  value.rendered_group_keys = coverage.rendered_group_keys;
  value.explicitly_demoted_group_keys = coverage.explicitly_demoted_group_keys;
  if (coverage.ok) return coverage;
  throw semanticError('Editor output failed selected group coverage validation.', {
    field: 'sections.group_coverage',
    ...coverage,
    sectionCount: ensureArray(value.sections).length
  });
}

function blockedContextCandidates(reporter = {}) {
  return selectedReporterCandidates(reporter)
    .flatMap(candidate => ensureArray(candidate.related_context_candidates || candidate.blocked_context_candidates))
    .filter(item => item.context_usage_allowed !== true)
    .map(item => ({
      title: text(item.title),
      url: text(item.url),
      normalized_url: normalizeGroupUrl(item.url),
      context_role: text(item.context_role || item.context_usage_label),
      reason: text(item.blocked_from_independent_main_reason)
    }))
    .filter(item => item.title || item.url);
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
  if (value.date !== date) value.date = date;
  value.title = value.title || `Camera HAL SW 뉴스레터 - ${date}`;
  if (!value.title.includes(date)) value.title = `Camera HAL SW 뉴스레터 - ${date}`;
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
  validatePublicArticleContract(value);
  validateArticleSectionContract(value);
  validateHalSignalCapsules(value);
  validateFieldHygiene(value);
  validateClaimBindingContract(value, reporter, options.strictClaims === true);
  validateEditorArticlePolicy(value, reporter);
  validateBlockedContextUsage(value, reporter);
  validateSelectedGroupCoverage(value, reporter);

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

async function repairEditorOutputContract({
  value,
  date,
  reporter = { candidates: [] },
  attempt = 1,
  stage = 'editor',
  newsroomDir,
  normalizeSection,
  strictClaims = false,
  repairFn
}) {
  const invalidEditor = cloneJson(value);
  const validate = candidate => validateEditorOutputContract(candidate, date, {
    reporter,
    normalizeSection,
    strictClaims
  });

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
    const initialDetails = {
      ...serializeEditorValidationError(error),
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
        extra: { stage, attempt, repairAttempted: false, repairSucceeded: false }
      });
    }

    const repairField = error.details?.field || error.field || '';
    if (!isRepairableSemanticField(repairField)) {
      error.stage = stage;
      attachSemanticStatus(error, {
        editor_semantic_validation: initialDetails,
        repairAttempted: false,
        repairSucceeded: false
      });
      throw error;
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
        validationError: serializeEditorValidationError(error),
        details: error.details,
        stage,
        attempt
      });
      const repairedForValidation = cloneJson(repairedRaw);
      const repairedEditor = validate(repairedForValidation);
      if (!['sections.group_coverage', 'sections.blocked_context'].includes(repairField)) {
        assertSectionsAndSourcesPreserved(invalidEditor, repairedRaw);
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
  repairEditorOutputContract,
  serializeEditorValidationError,
  validateEditorArticlePolicy,
  validateEditorOutputContract,
  validatePublicArticleContract,
  writeEditorValidationDiagnostics
};
