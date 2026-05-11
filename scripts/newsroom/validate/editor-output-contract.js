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

const REQUIRED_BRIEFING_COUNT = 3;

class EditorSemanticValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EditorSemanticValidationError';
    this.details = details;
    this.field = details.field || '';
  }
}

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
  return text(candidate.source_candidate_hash || candidate.url_hash || candidate.normalized_url_hash);
}

function candidateUrls(candidate = {}) {
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
    for (const issue of sectionIssues) {
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
  validateFieldHygiene(value);
  validateEditorArticlePolicy(value, reporter);

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

async function repairEditorOutputContract({
  value,
  date,
  reporter = { candidates: [] },
  attempt = 1,
  stage = 'editor',
  newsroomDir,
  normalizeSection,
  repairFn
}) {
  const invalidEditor = cloneJson(value);
  const validate = candidate => validateEditorOutputContract(candidate, date, {
    reporter,
    normalizeSection
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

    if (error.details?.field !== 'briefing') {
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
      assertSectionsAndSourcesPreserved(invalidEditor, repairedRaw);
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
          field: 'briefing',
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
  writeEditorValidationDiagnostics
};
