// Repair patch contract (#482).
//
// Single responsibility: decide whether an LLM "repair" only made
// article-preserving edits, and apply field-level repair patches without
// letting the model touch article identity, structure, or source binding.
//
// The orchestrator used to accept a full editor-JSON rewrite from the repair
// model and only DETECT identity drift afterwards (a fire report, not a
// firewall). This module turns that into a contract: a repaired editor may
// differ from the last known-valid editor only in allowlisted text content;
// any change to section count/order, stable identity, source binding,
// coverage_type or published_date is a `repair_patch_contract_violation`.
//
// Pure transforms only — no IO, no LLM, no shared state.

const { ensureArray } = require('../../../src/core/common/value-coercion');
const {
  stableSectionKey
} = require('../../../src/core/common/section-identity');

const REPAIR_PATCH_CONTRACT_VIOLATION = 'repair_patch_contract_violation';

// Top-level section keys whose subtree a repair patch may rewrite (reader-facing
// prose). Everything outside these roots is article identity / source binding
// and must not be touched by a repair patch.
const PATCHABLE_SECTION_ROOTS = Object.freeze(['article_sections', 'public_article']);

function stringOrEmpty(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// Source binding is part of identity: both URL and title must be preserved.
function sourceBindingSignature(section) {
  return ensureArray(section && section.sources).map(source => ({
    title: stringOrEmpty(source && source.title),
    url: stringOrEmpty(source && source.url)
  }));
}

// The protected, must-not-drift snapshot of a single section. Limited to the
// fields #482 forbids a repair from changing: stable identity, source binding,
// coverage_type, published_date, candidate_id. Reader-facing prose (headline,
// category, body, verified_facts) is intentionally NOT here — those are
// patchable text content.
function protectedSectionSnapshot(section = {}) {
  return {
    source_candidate_hash: stringOrEmpty(
      section.source_candidate_hash || section.url_hash || section.normalized_url_hash
    ),
    source_binding: sourceBindingSignature(section),
    coverage_type: stringOrEmpty(section.coverage_type || section.coverageType),
    published_date: stringOrEmpty(section.published_date || section.publishedDate),
    candidate_id: stringOrEmpty(section.candidate_id || section.candidateId)
  };
}

function changedProtectedFields(baseSection, repairedSection) {
  const before = protectedSectionSnapshot(baseSection);
  const after = protectedSectionSnapshot(repairedSection);
  const fields = [];
  for (const key of Object.keys(before)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fields.push(key === 'source_binding' ? 'source_urls' : key);
    }
  }
  return [...new Set(fields)];
}

// Compares a repaired editor against the last known-valid editor and reports
// every article-preserving violation. ok === true means the repaired editor is
// an allowlisted text-only edit of the base.
function checkRepairPatchContract(baseEditor, repairedEditor, { allowSectionCountChange = false } = {}) {
  const baseSections = ensureArray(baseEditor && baseEditor.sections);
  const repairedSections = ensureArray(repairedEditor && repairedEditor.sections);
  const violations = [];

  if (!allowSectionCountChange && repairedSections.length !== baseSections.length) {
    violations.push({
      reason: 'section_count_changed',
      expectedCount: baseSections.length,
      actualCount: repairedSections.length
    });
  }

  const baseKeys = baseSections.map(stableSectionKey);
  const repairedKeys = repairedSections.map(stableSectionKey);
  const repairedKeySet = new Set(repairedKeys.filter(Boolean));
  const baseKeySet = new Set(baseKeys.filter(Boolean));

  for (const key of baseKeySet) {
    if (!repairedKeySet.has(key)) {
      violations.push({ reason: 'section_removed', key });
    }
  }
  for (const key of repairedKeySet) {
    if (!baseKeySet.has(key)) {
      violations.push({ reason: 'section_added', key });
    }
  }

  // Order check only when the identity set is otherwise preserved.
  if (baseKeySet.size === repairedKeySet.size && [...baseKeySet].every(key => repairedKeySet.has(key))) {
    const limit = Math.min(baseKeys.length, repairedKeys.length);
    for (let index = 0; index < limit; index += 1) {
      if (baseKeys[index] && repairedKeys[index] && baseKeys[index] !== repairedKeys[index]) {
        violations.push({ reason: 'section_order_changed', index });
        break;
      }
    }
  }

  for (let index = 0; index < baseSections.length; index += 1) {
    const baseSection = baseSections[index];
    const key = baseKeys[index];
    const repairedSection = key
      ? repairedSections.find(candidate => stableSectionKey(candidate) === key)
      : repairedSections[index];
    if (!repairedSection) continue;
    const fields = changedProtectedFields(baseSection, repairedSection);
    if (fields.length > 0) {
      violations.push({ reason: 'protected_field_changed', key, fields });
    }
  }

  return { ok: violations.length === 0, violations };
}

function splitPointer(path) {
  return String(path || '')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);
}

function setByPointer(target, segments, value) {
  let node = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (node === null || typeof node !== 'object' || !(segment in node)) {
      return false;
    }
    node = node[segment];
  }
  const last = segments[segments.length - 1];
  if (node === null || typeof node !== 'object' || !(last in node)) {
    return false;
  }
  node[last] = value;
  return true;
}

function locateSection(sections, patch) {
  if (patch && Number.isInteger(patch.section_index)) {
    return sections[patch.section_index] || null;
  }
  const key = patch && stringOrEmpty(patch.section_key);
  if (key) {
    return sections.find(section => stableSectionKey(section) === key) || null;
  }
  return null;
}

function patchViolation(patch, detail) {
  return { reason: REPAIR_PATCH_CONTRACT_VIOLATION, patch, ...detail };
}

// Applies field-level repair patches to the last known-valid editor. Validates
// every patch first; if ANY patch is illegal the base is returned unchanged
// (fail before mutating), so a contract violation can never corrupt the output.
function applyRepairPatches(baseEditor, patches = []) {
  const violations = [];
  const sections = ensureArray(baseEditor && baseEditor.sections);

  for (const patch of ensureArray(patches)) {
    const op = stringOrEmpty(patch && patch.op) || 'replace';
    if (op !== 'replace') {
      violations.push(patchViolation(patch, { detail: 'unsupported_op', op }));
      continue;
    }
    const section = locateSection(sections, patch);
    if (!section) {
      violations.push(patchViolation(patch, { detail: 'section_not_found' }));
      continue;
    }
    const segments = splitPointer(patch && patch.path);
    if (segments.length === 0 || !PATCHABLE_SECTION_ROOTS.includes(segments[0])) {
      violations.push(patchViolation(patch, { detail: 'protected_field_patch', field: segments[0] || '' }));
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations, output: cloneJson(baseEditor) };
  }

  const output = cloneJson(baseEditor);
  const outputSections = ensureArray(output.sections);
  for (const patch of ensureArray(patches)) {
    const section = locateSection(outputSections, patch);
    const segments = splitPointer(patch && patch.path);
    if (!setByPointer(section, segments, patch.value)) {
      return {
        ok: false,
        violations: [patchViolation(patch, { detail: 'patch_path_not_found' })],
        output: cloneJson(baseEditor)
      };
    }
  }

  return { ok: true, violations: [], output };
}

module.exports = {
  REPAIR_PATCH_CONTRACT_VIOLATION,
  PATCHABLE_SECTION_ROOTS,
  checkRepairPatchContract,
  applyRepairPatches,
  protectedSectionSnapshot
};
