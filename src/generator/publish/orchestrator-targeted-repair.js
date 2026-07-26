// 타깃 리페어 / 컴플리션 검증 클러스터 — repair patch와 completion 결과가 기사 identity·개수·
// 보호 필드를 바꾸지 않았는지 결정론적으로 가드한다(#655 god-file 분할).
//
// validateEditor는 orchestrator의 publish-mode(generationRunState)에 결합돼 있어 인자로 주입받는다.
// 나머지 의존(section-identity, repair-patch-contract 등)은 leaf 모듈에서 직접 가져온다. 본문은
// 추출 전과 동일하며, generationRunState.date 기본값만 호출자가 넘기는 명시 date로 바뀐다.

const { ensureArray } = require('../../shared/common/value-coercion');
const { cloneJson, fail } = require('./orchestrator-shared-helpers');
const { normalizeEditorSection } = require('./orchestrator-reporter-normalize');
const { EditorSemanticValidationError } = require('../editor/editor-output-contract');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const { applyRepairPatches, REPAIR_PATCH_CONTRACT_VIOLATION } = require('../repair/repair-patch-contract');
const {
  stableSectionKey,
  sameSectionLabel,
  signaturesMatch,
  sectionRepairSignature,
  stableSectionKeySet,
  sameStringSet,
  protectedRepairFieldsMatch,
  protectedRepairSignature
} = require('../../shared/common/section-identity');

function targetedRepairError(message, details = {}) {
  return new EditorSemanticValidationError(message, {
    field: 'sections',
    ...details
  });
}

function validateTargetedRepairResult({
  beforeSections = [],
  repairSections = [],
  afterSections = [],
  lockedSections = [],
  mode = 'targeted-repair',
  allowCountChange = false,
  date,
  reporter = { candidates: [] },
  baseIssue = null,
  validateEditor
} = {}) {
  const before = ensureArray(beforeSections);
  const repair = ensureArray(repairSections);
  const after = ensureArray(afterSections);
  const locked = ensureArray(lockedSections);

  if (mode === 'targeted-repair' && !allowCountChange && after.length !== before.length) {
    throw targetedRepairError('Targeted repair changed main article count outside completion/replacement mode.', {
      reason: 'section_count_drift',
      mode,
      expectedCount: before.length,
      actualCount: after.length,
      expectedMinCount: articlePolicy.mainArticleCount.min,
      expectedMaxCount: articlePolicy.mainArticleCount.max,
      actualType: 'array',
      sectionCount: after.length
    });
  }

  for (const generated of repair) {
    const generatedKey = stableSectionKey(generated);
    const matchingLocked = locked.find(section =>
      (generatedKey && stableSectionKey(section) === generatedKey) ||
      sameSectionLabel(section, generated)
    );
    if (matchingLocked && !signaturesMatch(matchingLocked, generated)) {
      throw targetedRepairError('Targeted repair attempted to mutate a locked section source binding.', {
        reason: 'locked_section_source_drift',
        mode,
        expected: sectionRepairSignature(matchingLocked),
        actual: sectionRepairSignature(generated),
        sectionCount: after.length
      });
    }
  }

  const usedBeforeIndexes = new Set();
  for (const lockedSection of locked) {
    const key = stableSectionKey(lockedSection);
    let originalIndex = before.findIndex((section, index) =>
      !usedBeforeIndexes.has(index) &&
      key &&
      stableSectionKey(section) === key &&
      signaturesMatch(section, lockedSection)
    );
    if (originalIndex < 0) {
      originalIndex = before.findIndex((section, index) =>
        !usedBeforeIndexes.has(index) &&
        key &&
        stableSectionKey(section) === key
      );
    }
    if (originalIndex < 0) {
      originalIndex = before.findIndex((section, index) =>
        !usedBeforeIndexes.has(index) &&
        sameSectionLabel(section, lockedSection)
      );
    }
    if (originalIndex < 0) {
      throw targetedRepairError('Targeted repair could not find a locked section in the original draft.', {
        reason: 'locked_section_missing_from_before',
        mode,
        expected: sectionRepairSignature(lockedSection),
        sectionCount: after.length
      });
    }
    usedBeforeIndexes.add(originalIndex);
    const actual = after[originalIndex];
    if (!actual || !signaturesMatch(lockedSection, actual)) {
      throw targetedRepairError('Targeted repair changed locked section order or source binding.', {
        reason: 'locked_section_order_or_source_drift',
        mode,
        index: originalIndex + 1,
        expected: sectionRepairSignature(lockedSection),
        actual: actual ? sectionRepairSignature(actual) : null,
        sectionCount: after.length
      });
    }
  }

  if (!allowCountChange && after.length !== before.length) {
    throw targetedRepairError('Targeted repair changed main article count outside completion/replacement mode.', {
      reason: 'section_count_drift',
      mode,
      expectedCount: before.length,
      actualCount: after.length,
      expectedMinCount: articlePolicy.mainArticleCount.min,
      expectedMaxCount: articlePolicy.mainArticleCount.max,
      actualType: 'array',
      sectionCount: after.length
    });
  }

  if (mode === 'targeted-repair') {
    const beforeKeys = stableSectionKeySet(before);
    const afterKeys = stableSectionKeySet(after);
    if (!sameStringSet(beforeKeys, afterKeys)) {
      throw targetedRepairError('Targeted repair changed article stable identity set.', {
        reason: 'section_identity_drift',
        mode,
        expected_keys: [...beforeKeys],
        actual_keys: [...afterKeys],
        sectionCount: after.length
      });
    }
    for (const beforeSection of before) {
      const key = stableSectionKey(beforeSection);
      const afterSection = after.find(section => stableSectionKey(section) === key);
      if (afterSection && !protectedRepairFieldsMatch(beforeSection, afterSection)) {
        throw targetedRepairError('Targeted repair changed protected article identity fields.', {
          reason: 'section_protected_field_drift',
          mode,
          key,
          expected: protectedRepairSignature(beforeSection),
          actual: protectedRepairSignature(afterSection),
          sectionCount: after.length
        });
      }
    }
  }

  // 합성 wrapper는 base editor의 issue 레벨 story marker를 그대로 물려받아야 한다.
  // marker 없이 검증하면 story-v1 section(public_article.story_contract_version 보유)이
  // story_contract_version_mismatch로 항상 실패한다(2026-07-20 발행 차단 원인).
  const storyMarkers = {};
  if (baseIssue && baseIssue.public_contract_version !== undefined) {
    storyMarkers.public_contract_version = baseIssue.public_contract_version;
  }
  if (baseIssue && baseIssue.generation_contract_version !== undefined) {
    storyMarkers.generation_contract_version = baseIssue.generation_contract_version;
  }
  validateEditor({
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'targeted repair validation',
    briefing: ['validation', 'validation', 'validation'],
    sections: after,
    action_items: [],
    references: [],
    ...storyMarkers
  }, date, reporter, { strictClaims: false });
  return true;
}

// #482: repair-plan item에는 안정적인 section index가 없고, patch 모델은
// section_key(stableSectionKey)를 echo한다. 각 patch를 현재 editor의 실제
// index로 다시 매핑해 applyRepairPatches가 의도한 section만 수정하게 하고,
// 사라졌거나 범위를 벗어난 section을 가리키는 patch는 거부한다.
function remapRepairPatchSections(sections, patches) {
  const normalized = [];
  const violations = [];
  for (const patch of ensureArray(patches)) {
    const key = patch && patch.section_key ? String(patch.section_key).trim() : '';
    let index = Number.isInteger(patch && patch.section_index) ? patch.section_index : -1;
    if (key) {
      index = sections.findIndex(section => stableSectionKey(section) === key);
      if (index < 0) {
        violations.push({ reason: REPAIR_PATCH_CONTRACT_VIOLATION, detail: 'section_key_not_found', section_key: key, patch });
        continue;
      }
    }
    if (index < 0 || index >= sections.length) {
      violations.push({ reason: REPAIR_PATCH_CONTRACT_VIOLATION, detail: 'section_index_out_of_range', section_index: patch ? patch.section_index : undefined, patch });
      continue;
    }
    normalized.push({ ...patch, section_index: index, section_key: stableSectionKey(sections[index]) });
  }
  return { normalized, violations };
}

// #482: article-preserving repair patch를 마지막 valid editor에 결정론적으로
// 적용하고 identity 가드를 다시 확인한다. 모델은 field-level patch만 반환하므로
// 어떤 기사가 존재하는지는 구조적으로 바뀔 수 없다. 보호 필드나 사라진 section을
// 가리키는 patch면 { ok:false, violations }(호출부는 직전 editor를 유지하고
// reviewable 실패로 보고), 정상이면 가드를 통과한 patched editor를 반환한다.
function applyRepairPatchesAndValidate({
  editor,
  patches = [],
  reporter = { candidates: [] },
  date,
  validateEditor
} = {}) {
  const baseEditor = cloneJson(editor);
  const beforeSections = ensureArray(baseEditor.sections);
  const { normalized, violations: remapViolations } = remapRepairPatchSections(beforeSections, patches);
  if (remapViolations.length > 0) {
    return { ok: false, editor: baseEditor, violations: remapViolations };
  }
  const applied = applyRepairPatches(baseEditor, normalized);
  if (!applied.ok) {
    return { ok: false, editor: baseEditor, violations: applied.violations };
  }
  const patchedSections = ensureArray(applied.output.sections);
  // 최후의 가드: patch-only 편집에서는 identity set, 개수, 보호 필드가 구조적으로
  // 불변이다. 이 검사는 방어선으로 남아, patch가 applyRepairPatches allowlist를
  // 빠져나간 경우에만 throw(-> reviewable 실패)한다.
  validateTargetedRepairResult({
    beforeSections,
    repairSections: patchedSections,
    afterSections: patchedSections,
    lockedSections: beforeSections,
    mode: 'targeted-repair',
    allowCountChange: false,
    date,
    reporter,
    baseIssue: baseEditor,
    validateEditor
  });
  return { ok: true, editor: applied.output, violations: [] };
}

function fallbackFactCheckForRepairFailure(error, factCheck = null) {
  if (factCheck) return cloneJson(factCheck);
  return {
    status: 'NEEDS_FIX',
    must_fix: [],
    recommended_fixes: [],
    source_gaps: [`Repair failure prevented follow-up fact-check: ${String(error?.message || error || 'Unknown repair failure.')}`],
    source_gap_count: 1,
    final_comment: 'Repair failed after a schema and policy valid editor draft was created. Use this draft for editor review only.'
  };
}

function validateCompletionSections(value, date, reporter) {
  const sections = ensureArray(value?.sections);
  if (sections.length === 0) fail('Editor completion output must contain at least one section.');
  const normalizedSections = sections.map((section, index) => normalizeEditorSection(section, index, reporter));
  const emptySourceSections = normalizedSections
    .filter(section => section.sources.length === 0)
    .map(section => section.category);
  if (emptySourceSections.length > 0) {
    fail(`Editor completion output has sections without sources: ${emptySourceSections.join(', ')}`);
  }
  return normalizedSections;
}

module.exports = {
  targetedRepairError,
  validateTargetedRepairResult,
  remapRepairPatchSections,
  applyRepairPatchesAndValidate,
  fallbackFactCheckForRepairFailure,
  validateCompletionSections
};
