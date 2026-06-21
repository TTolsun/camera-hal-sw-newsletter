// Orchestrator editor retry-contract helpers.
//
// Single responsibility: describe and enforce the contract that an editor retry
// pass must satisfy — how many sections the retry must return, which locked
// sections it must preserve, and whether the draft opted into the story
// contract. Pure transforms on their arguments only — no generationRunState, no
// fs, no module globals — extracted verbatim from the generation orchestrator
// (gemini-newsroom-newsletter.js).

const { ensureArray } = require('../render/newsletter-renderer');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const {
  sectionRepairSignature,
  sectionSummary
} = require('../../shared/common/section-identity');
const {
  GENERATION_CONTRACT_VERSION,
  STORY_CONTRACT_VERSION,
  STORY_PUBLIC_CONTRACT_VERSION
} = require('../reporter/public-article-contract');
const { normalizeEditorSection } = require('./orchestrator-reporter-normalize');
const { EditorSemanticValidationError } = require('../editor/editor-output-contract');

function editorRequestsStoryContract(editor = {}) {
  return editor?.public_contract_version === STORY_PUBLIC_CONTRACT_VERSION ||
    Number(editor?.generation_contract_version) >= GENERATION_CONTRACT_VERSION ||
    ensureArray(editor?.sections).some(section =>
      Number(section?.public_article?.story_contract_version) >= STORY_CONTRACT_VERSION
    );
}

function buildEditorRetryContract({
  lastKnownValidEditor = null,
  currentEditor = null,
  lockedSections = []
} = {}) {
  const previousValidSections = ensureArray(lastKnownValidEditor?.sections);
  const currentSections = ensureArray(currentEditor?.sections);
  const locked = ensureArray(lockedSections);
  const targetSectionCount = previousValidSections.length > 0
    ? previousValidSections.length
    : currentSections.length > 0
      ? currentSections.length
      : articlePolicy.mainArticleCount.min;
  return {
    target_section_count: targetSectionCount,
    locked_section_count: locked.length,
    replacement_required_count: Math.max(0, targetSectionCount - locked.length),
    locked_section_signatures: locked.map(sectionRepairSignature),
    locked_section_summaries: locked.map((section, index) => sectionSummary(section, index))
  };
}

function assertEditorRetryOutputContract(editor, contract, reporter = { candidates: [] }) {
  if (!contract) return true;
  const sections = ensureArray(editor?.sections);
  const targetSectionCount = Number(contract.target_section_count);
  const lockedSectionCount = Number(contract.locked_section_count);
  const replacementRequiredCount = Number(contract.replacement_required_count);
  const lockedSignatureStrings = ensureArray(contract.locked_section_signatures)
    .map(signature => JSON.stringify(signature));
  const outputSignatureStrings = sections.map(section =>
    JSON.stringify(sectionRepairSignature(normalizeEditorSection(section, 0, reporter)))
  );
  const returnedOnlyLockedSections = sections.length === lockedSectionCount &&
    replacementRequiredCount > 0 &&
    lockedSignatureStrings.length === lockedSectionCount &&
    lockedSignatureStrings.every(signature => outputSignatureStrings.includes(signature));
  if (returnedOnlyLockedSections) {
    throw new EditorSemanticValidationError('Editor retry output returned only locked sections instead of the complete target draft.', {
      field: 'sections',
      reason: 'locked_only_retry_output',
      expectedCount: targetSectionCount,
      actualCount: sections.length,
      target_section_count: targetSectionCount,
      locked_section_count: lockedSectionCount,
      replacement_required_count: replacementRequiredCount,
      actualType: 'array',
      sectionCount: sections.length
    });
  }
  if (Number.isFinite(targetSectionCount) && sections.length !== targetSectionCount) {
    throw new EditorSemanticValidationError(`Editor retry output must contain exactly ${targetSectionCount} sections; got ${sections.length}.`, {
      field: 'sections',
      reason: 'editor_retry_section_count_drift',
      expectedCount: targetSectionCount,
      actualCount: sections.length,
      target_section_count: targetSectionCount,
      locked_section_count: lockedSectionCount,
      replacement_required_count: replacementRequiredCount,
      actualType: 'array',
      sectionCount: sections.length
    });
  }
  for (const expected of ensureArray(contract.locked_section_signatures)) {
    const found = outputSignatureStrings.includes(JSON.stringify(expected));
    if (!found) {
      throw new EditorSemanticValidationError('Editor retry output omitted or changed a locked section.', {
        field: 'sections',
        reason: 'locked_section_missing_from_retry_output',
        expected,
        target_section_count: targetSectionCount,
        locked_section_count: lockedSectionCount,
        replacement_required_count: replacementRequiredCount,
        actualType: 'array',
        sectionCount: sections.length
      });
    }
  }
  return true;
}

module.exports = {
  editorRequestsStoryContract,
  buildEditorRetryContract,
  assertEditorRetryOutputContract
};
