const { ensureArray } = require('../../shared/common/value-coercion');
const MAX_FACTS = 12;
const MAX_FACT_LENGTH = 300;

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return '';
  return String(value || '').trim();
}

function compactText(value, max = MAX_FACT_LENGTH) {
  const raw = text(value).replace(/\s+/g, ' ').trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function candidateUrl(candidate = {}) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.source_candidate_url);
}

function parentUrl(candidate = {}) {
  return text(candidate.parent_url || candidate.parentUrl || candidate.parent_canonical_url || candidate.parentCanonicalUrl);
}

function normalizedSourceUrl(value, { stripHash = true } = {}) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    if (stripHash) parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function cameraReleasePage(value) {
  const raw = text(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera';
  } catch {
    return /developer\.android\.com\/jetpack\/androidx\/releases\/camera/i.test(raw);
  }
}

function candidateGroupKey(candidate = {}) {
  return text(candidate.article_group_key || candidate.articleGroupKey);
}

function candidateTitle(candidate = {}) {
  return text(candidate.title || candidate.headline || candidate.name);
}

// 읽는 섹션 그룹 집합은 claim-source-binding.js의 sourceExtractionItems와 같아야 한다(#944, #965).
// 두 소비자가 같은 컨테이너를 읽어야 LLM이 프롬프트에서 본 근거와 검증기가 바인딩에 쓰는 근거가
// 일치한다. 같은 것은 세 그룹의 집합과 순서까지이고, evidence_blocks의 위치와 item 필드 우선순위는
// 두 모듈이 예전부터 다르다(여기는 source_text 우선, 저기는 text 우선) — 이 함수의 계약이 아니다.
// workflow는 목록 끝에 둔다 — 앞에 두면 release / minor_line_context 후보의 기존 근거가
// MAX_FACTS 12칸 안에서 뒤로 밀려 출력이 바뀐다.
function extractionSectionItems(extraction = {}) {
  const sections = [
    ...ensureArray(extraction.release?.sections),
    ...ensureArray(extraction.minor_line_context?.sections),
    ...ensureArray(extraction.workflow?.sections)
  ];
  return sections.flatMap(section => ensureArray(section?.items));
}

function evidenceBlockTexts(value, depth = 0) {
  if (!value || depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap(item => evidenceBlockTexts(item, depth + 1));
  if (typeof value !== 'object') return [];

  const output = [];
  if (Array.isArray(value.evidence_blocks)) {
    for (const block of value.evidence_blocks) {
      output.push(text(block?.text || block?.source_text));
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      output.push(...evidenceBlockTexts(nested, depth + 1));
    }
  }
  return output.filter(Boolean);
}

function sourceExtractionFacts(candidate = {}) {
  const extraction = candidate.source_extraction || {};
  return [
    ...extractionSectionItems(extraction).map(item => text(item?.source_text || item?.text)),
    ...evidenceBlockTexts(extraction)
  ].filter(Boolean);
}

function factRecordsFromCandidate(candidate = {}, role = 'primary') {
  const includeCoreMetadata = role !== 'primary';
  const includeSummary = role !== 'primary' || !text(candidate.behavior_change || candidate.behaviorChange || candidate.what_changed);
  const records = [
    includeCoreMetadata && (candidate.published_date || candidate.publishedAt || candidate.published_at)
      ? { kind: 'published_date', text: text(candidate.published_date || candidate.publishedAt || candidate.published_at) }
      : null,
    includeCoreMetadata && (candidate.version_or_release || candidate.versionOrRelease)
      ? { kind: 'version_or_release', text: text(candidate.version_or_release || candidate.versionOrRelease) }
      : null,
    includeCoreMetadata && (candidate.api_or_component || candidate.apiOrComponent || candidate.component)
      ? { kind: 'api_or_component', text: text(candidate.api_or_component || candidate.apiOrComponent || candidate.component) }
      : null,
    candidate.behavior_change || candidate.behaviorChange || candidate.what_changed
      ? { kind: 'behavior_change', text: text(candidate.behavior_change || candidate.behaviorChange || candidate.what_changed) }
      : null,
    includeSummary && candidate.summary ? { kind: 'summary', text: compactText(candidate.summary, 180) } : null,
    ...sourceExtractionFacts(candidate).map(item => ({ kind: 'source_extraction', text: item })),
    ...ensureArray(candidate.compact_evidence?.primary_facts).map(item => ({ kind: 'primary_fact', text: item })),
    ...ensureArray(candidate.compact_evidence?.linked_context).map(item => ({ kind: 'linked_context', text: item })),
    ...ensureArray(candidate.evidence).map(item => ({ kind: 'evidence', text: item }))
  ].filter(item => item && text(item.text));

  return records.map(record => ({
    kind: record.kind,
    role,
    text: compactText(record.text)
  }));
}

function hasParentChildRelation(primary = {}, related = {}) {
  const primaryCanonical = normalizedSourceUrl(candidateUrl(primary));
  const relatedCanonical = normalizedSourceUrl(candidateUrl(related));
  const primaryParent = normalizedSourceUrl(parentUrl(primary));
  const relatedParent = normalizedSourceUrl(parentUrl(related));
  return Boolean(
    (primaryCanonical && relatedParent && primaryCanonical === relatedParent) ||
    (relatedCanonical && primaryParent && relatedCanonical === primaryParent) ||
    (primaryParent && relatedParent && primaryParent === relatedParent)
  );
}

function shouldIncludeRelatedCandidate(primary = {}, related = {}) {
  const primaryUrl = candidateUrl(primary);
  const relatedUrl = candidateUrl(related);
  if (!primaryUrl || !relatedUrl) return false;
  if (normalizedSourceUrl(primaryUrl, { stripHash: false }) === normalizedSourceUrl(relatedUrl, { stripHash: false })) {
    return true;
  }
  const primaryCanonical = normalizedSourceUrl(primaryUrl);
  const relatedCanonical = normalizedSourceUrl(relatedUrl);
  const sameCanonical = primaryCanonical && relatedCanonical && primaryCanonical === relatedCanonical;
  if (sameCanonical && hasParentChildRelation(primary, related)) return true;
  if (sameCanonical && !cameraReleasePage(primaryUrl) && !cameraReleasePage(relatedUrl)) return true;
  const group = candidateGroupKey(primary);
  if (group && group === candidateGroupKey(related) && hasParentChildRelation(primary, related)) return true;
  return false;
}

function uniqueFacts(records = []) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const value = compactText(record?.text);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push({
      ...record,
      text: value
    });
  }
  return output;
}

function buildArticleSourceFactBundle(candidate = {}, contextCandidates = []) {
  const related = ensureArray(contextCandidates)
    .filter(item => item && item !== candidate)
    .filter(item => shouldIncludeRelatedCandidate(candidate, item));
  const facts = uniqueFacts([
    ...factRecordsFromCandidate(candidate, 'primary'),
    ...related.flatMap(item => factRecordsFromCandidate(item, 'related_source_context'))
  ]).slice(0, MAX_FACTS);
  const nonDuplicateFacts = facts.filter(fact =>
    fact.role !== 'primary' ||
    !['behavior_change', 'summary'].includes(fact.kind)
  );
  const publicFacts = related.length === 0 && nonDuplicateFacts.length === 0 ? [] : facts;
  const supportingSourceUrls = [...new Set(related.map(candidateUrl).filter(Boolean))];
  return {
    source_url: candidateUrl(candidate),
    canonical_url: normalizedSourceUrl(candidateUrl(candidate)),
    source_title: candidateTitle(candidate),
    fact_count: publicFacts.length,
    facts: publicFacts,
    supporting_source_urls: supportingSourceUrls.slice(0, 8)
  };
}

module.exports = {
  buildArticleSourceFactBundle
};
