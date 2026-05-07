const path = require('path');
const { writeJson } = require('../common/common');

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
  if (!Array.isArray(value.sections) || value.sections.length < 3) {
    throw semanticError('Editor output must contain at least 3 sections.', {
      ...countDetails(value, 'sections', { expectedMinCount: 3 })
    });
  }

  value.sections = value.sections.map((section, index) => normalizeSection(section, index, reporter));

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
  validateEditorOutputContract,
  writeEditorValidationDiagnostics
};
