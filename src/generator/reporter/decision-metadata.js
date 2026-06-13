// 의사결정 메타데이터(decision metadata) 허용값과 enum 정규화 책임 모듈.
// public-article-contract.js에서 DECISION_* 허용값 집합과 그 정규화 헬퍼만 분리한 것으로,
// 동작은 원본과 동일하다(순수 추출).

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function compactText(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

const DECISION_IMPACT_VALUES = Object.freeze(['Low', 'Medium', 'High']);
const DECISION_SCOPE_VALUES = Object.freeze(['HAL', 'Driver', 'Sensor', 'Tooling', 'AI', 'Framework', 'SoC']);
const DECISION_ACTION_VALUES = Object.freeze(['Ignore', 'Watch', 'Test', 'Adopt']);
const DECISION_RISK_VALUES = Object.freeze(['Low', 'Medium', 'High']);

function normalizeEnumArray(value, allowed, fallback = []) {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const output = [];
  for (const item of values) {
    const normalized = compactText(item);
    const canonical = allowed.find(value => value.toLowerCase() === normalized.toLowerCase());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    output.push(canonical);
  }
  return output.length > 0 ? output : fallback;
}

function actionRank(action) {
  return DECISION_ACTION_VALUES.indexOf(action);
}

module.exports = {
  DECISION_IMPACT_VALUES,
  DECISION_SCOPE_VALUES,
  DECISION_ACTION_VALUES,
  DECISION_RISK_VALUES,
  normalizeEnumArray,
  actionRank
};
