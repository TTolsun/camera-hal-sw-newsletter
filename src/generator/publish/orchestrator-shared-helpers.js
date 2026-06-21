// Orchestrator shared leaf helpers.
//
// Single responsibility: tiny pure value/section helpers shared by the
// orchestrator (gemini-newsroom-newsletter.js) and its extracted sibling
// helper modules (reporter-match, judge-helpers, repair-plan). Pure transforms
// on their arguments only — no generationRunState, no fs, no module globals —
// so they are safe to share without changing behavior.

function numberOrDefault(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function stringOrEmpty(value) {
  return String(value || '').trim();
}

function sectionLabel(section) {
  return section.headline || section.category || 'untitled article';
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function fail(message) {
  throw new Error(message);
}

module.exports = {
  numberOrDefault,
  stringOrEmpty,
  sectionLabel,
  cloneJson,
  fail
};
