// state/quirk-ledger.json(기기 우회 장부의 누적 상태) 계약 검증기.
// 쓰는 쪽(generator/diagnostics/quirk-ledger-state.js)과 읽는 쪽 검증이 같은 상수를 쓰도록 한 곳에 둔다.

const SUPPORTED_SCHEMA_VERSION = 1;
const RETENTION_WEEKS = 12;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE_SOURCES = Object.freeze(['diff_code', 'diff_comment', 'commit_message']);
const QUIRK_CHANGES = Object.freeze(['added', 'modified', 'deleted']);

function validateEntry(entry, index, errors) {
  const label = `entries[${index}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!Number.isInteger(entry.change_number) || entry.change_number <= 0) errors.push(`${label}.change_number must be a positive integer.`);
  if (!DATE_PATTERN.test(String(entry.submitted_date || ''))) errors.push(`${label}.submitted_date must be YYYY-MM-DD.`);
  if (typeof entry.subject !== 'string' || !entry.subject) errors.push(`${label}.subject must be a non-empty string.`);
  if (typeof entry.url !== 'string' || !entry.url) errors.push(`${label}.url must be a non-empty string.`);
  if (!Array.isArray(entry.quirk_classes) || entry.quirk_classes.length === 0) {
    errors.push(`${label}.quirk_classes must be a non-empty array.`);
  } else {
    for (const quirk of entry.quirk_classes) {
      if (!quirk || typeof quirk.name !== 'string' || !quirk.name || !QUIRK_CHANGES.includes(quirk.change)) {
        errors.push(`${label}.quirk_classes items need a name and a change of ${QUIRK_CHANGES.join('|')}.`);
      }
    }
  }
  if (!Array.isArray(entry.devices)) {
    errors.push(`${label}.devices must be an array.`);
  } else {
    for (const device of entry.devices) {
      if (!device || typeof device.identifier !== 'string' || !device.identifier || !DEVICE_SOURCES.includes(device.source)) {
        errors.push(`${label}.devices items need an identifier and a source of ${DEVICE_SOURCES.join('|')}.`);
      }
    }
  }
  if (typeof entry.no_device !== 'boolean') {
    errors.push(`${label}.no_device must be a boolean.`);
  } else if (Array.isArray(entry.devices) && entry.no_device !== (entry.devices.length === 0)) {
    errors.push(`${label}.no_device must be true exactly when devices is empty.`);
  }
  if (typeof entry.exynos !== 'boolean') errors.push(`${label}.exynos must be a boolean.`);
  if (!Array.isArray(entry.exynos_evidence)) errors.push(`${label}.exynos_evidence must be an array.`);
  // 근거 없는 Exynos 표시를 막는다: 표시는 근거 문자열이 있을 때만 켜진다.
  if (entry.exynos === true && Array.isArray(entry.exynos_evidence) && entry.exynos_evidence.length === 0) {
    errors.push(`${label}.exynos is true but exynos_evidence is empty.`);
  }
}

function validateQuirkLedgerStateText(text, { filePath = 'state/quirk-ledger.json' } = {}) {
  const errors = [];
  let state;
  try {
    state = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`${filePath} is not valid JSON: ${error.message}`] };
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { ok: false, errors: [`${filePath} must be a JSON object.`] };
  }
  if (state.schemaVersion !== SUPPORTED_SCHEMA_VERSION) errors.push(`schemaVersion must be ${SUPPORTED_SCHEMA_VERSION}.`);
  if (state.retention_weeks !== RETENTION_WEEKS) errors.push(`retention_weeks must be ${RETENTION_WEEKS}.`);
  if (!DATE_PATTERN.test(String(state.last_window_end_date || ''))) errors.push('last_window_end_date must be YYYY-MM-DD.');
  if (!Array.isArray(state.entries)) {
    errors.push('entries must be an array.');
  } else {
    const seen = new Set();
    state.entries.forEach((entry, index) => {
      validateEntry(entry, index, errors);
      if (entry && seen.has(entry.change_number)) errors.push(`entries[${index}].change_number ${entry.change_number} is duplicated.`);
      if (entry) seen.add(entry.change_number);
    });
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  DEVICE_SOURCES,
  QUIRK_CHANGES,
  RETENTION_WEEKS,
  SUPPORTED_SCHEMA_VERSION,
  validateQuirkLedgerStateText
};
