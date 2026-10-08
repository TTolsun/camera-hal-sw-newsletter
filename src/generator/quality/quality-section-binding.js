'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  normalizeForMatch,
  normalizedUrlKey,
  sourceEvidence
} = require('./candidate-claim-matching');
const {
  PRODUCT_VERSION_TOKEN_PATTERN,
  RELEASE_BOILERPLATE_TOKEN_PATTERN
} = require('../../shared/common/quality-gate-policy');
const { text } = require('./quality-text');

// Section <-> source-candidate binding and matching helpers. Moved verbatim out of
// newsletter-quality.js as part of the SRP split (issue #52 phase 6); the binding
// rules and tie-break scoring are the publish gate, so behaviour is byte-for-byte
// identical.

function normalizedTokens(value) {
  return normalizeForMatch(value)
    .split(/\s+/)
    .filter(token => token.length >= 3);
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizedTokens(left));
  const rightTokens = new Set(normalizedTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function weightedTitleTokens(value) {
  return normalizedTokens(value)
    .map(token => ({
      token,
      weight: PRODUCT_VERSION_TOKEN_PATTERN.test(token)
        ? 0.2
        : RELEASE_BOILERPLATE_TOKEN_PATTERN.test(token)
          ? 0
          : 1
    }))
    .filter(item => item.weight > 0);
}

function sourceTitleHasRawCopySignal(value) {
  return weightedTitleTokens(value).filter(item => item.weight >= 1).length >= 3;
}

function weightedTitleSimilarity(left, right) {
  const leftTokens = weightedTitleTokens(left);
  const rightTokens = weightedTitleTokens(right);
  const leftCore = leftTokens.filter(item => item.weight >= 1);
  const rightCore = rightTokens.filter(item => item.weight >= 1);
  if (leftCore.length < 3 || rightCore.length < 3) return 0;
  const rightWeights = new Map(rightTokens.map(item => [item.token, item.weight]));
  let intersection = 0;
  for (const item of leftTokens) {
    intersection += rightWeights.has(item.token) ? Math.min(item.weight, rightWeights.get(item.token)) : 0;
  }
  const denominator = Math.max(
    leftTokens.reduce((sum, item) => sum + item.weight, 0),
    rightTokens.reduce((sum, item) => sum + item.weight, 0)
  );
  return denominator > 0 ? intersection / denominator : 0;
}

function candidateTitleSimilarity(section, candidate) {
  const sectionLabels = [
    section?.headline,
    ...ensureArray(section?.sources).flatMap(source => [source?.title, source?.url])
  ];
  return Math.max(0, ...sectionLabels.map(label => tokenSimilarity(label, candidate?.title)));
}

function dateTokens(value) {
  const raw = text(value);
  const tokens = new Set();
  for (const match of raw.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    tokens.add(`${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`);
  }
  // \uD55C\uAE00(\uB144/\uC6D4/\uC77C)\uC740 \w\uAC00 \uC544\uB2C8\uB77C \uC55E\uB4A4 \b\uAC00 \uD55C\uAE00 \uACBD\uACC4\uC5D0\uC11C word-boundary \uC804\uC774\uB97C \uBABB \uB9CC\uB4E4\uC5B4
  // \uB9E4\uCE6D\uC774 \uD56D\uC0C1 \uC2E4\uD328\uD588\uB2E4(\uD2B9\uD788 '\uC77C' \uB4A4 \uACF5\uBC31/\uBB38\uC7A5\uB05D). \uD55C\uAD6D\uC5B4\uAC00 \uAE30\uBCF8 \uCD9C\uB825 \uC5B8\uC5B4\uB77C \uBAA8\uB4E0 \uD55C\uAE00
  // section\uC758 \uB0A0\uC9DC \uB9E4\uCE6D\uC744 \uC8FD\uC774\uB358 \uBC84\uADF8 \u2192 \b \uC81C\uAC70. (\uC5F0\uB3C4\uB294 20\d{2} 4\uC790\uB9AC\uB77C \uC624\uB9E4\uCE6D \uC704\uD5D8 \uC5C6\uC74C.)
  for (const match of raw.matchAll(/(20\d{2})\s*\uB144\s*(\d{1,2})\s*\uC6D4\s*(\d{1,2})\s*\uC77C/g)) {
    tokens.add(`${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`);
  }
  const monthPattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12'
  };
  for (const match of raw.matchAll(monthPattern)) {
    tokens.add(`${match[3]}-${months[match[1].slice(0, 3).toLowerCase()]}-${String(match[2]).padStart(2, '0')}`);
  }
  const dayMonthPattern = /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/gi;
  for (const match of raw.matchAll(dayMonthPattern)) {
    tokens.add(`${match[3]}-${months[match[2].slice(0, 3).toLowerCase()]}-${String(match[1]).padStart(2, '0')}`);
  }
  const parsed = raw.length <= 80 && /\b20\d{2}\b/.test(raw) ? Date.parse(raw) : NaN;
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    tokens.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`);
  }
  return tokens;
}

function valueAppearsInSection(section, value) {
  const needle = normalizeForMatch(value);
  if (!needle || needle.length < 3) return false;
  return normalizeForMatch(sourceEvidence(section)).includes(needle);
}

function candidateDateMatchesSection(section, candidate) {
  const candidateDates = dateTokens(candidate?.published_date || candidate?.publishedAt);
  if (candidateDates.size === 0) return false;
  const sectionDates = dateTokens(sourceEvidence(section));
  return [...candidateDates].some(date => sectionDates.has(date));
}

function candidateVersionMatchesSection(section, candidate) {
  return valueAppearsInSection(section, candidate?.version_or_release || candidate?.versionOrRelease);
}

function candidateApiMatchesSection(section, candidate) {
  const api = text(candidate?.api_or_component || candidate?.apiOrComponent);
  if (!api || /^api$/i.test(api)) return false;
  return valueAppearsInSection(section, api);
}

function sectionSourceIdMatches(section, candidate) {
  const haystack = normalizeForMatch([
    section?.headline,
    section?.sources
  ]);
  return [
    candidate?.source_id,
    candidate?.source,
    candidate?.source_name
  ].some(value => {
    const normalized = normalizeForMatch(value);
    return normalized && haystack.includes(normalized);
  });
}

function bindingTieBreakScore(section, entry) {
  const candidate = entry.candidate;
  let score = 0;
  if (sectionSourceIdMatches(section, candidate)) score += 8;
  score += candidateTitleSimilarity(section, candidate) * 6;
  if (candidateDateMatchesSection(section, candidate)) score += 4;
  if (candidateVersionMatchesSection(section, candidate)) score += 4;
  if (candidateApiMatchesSection(section, candidate)) score += 2;
  return Number(score.toFixed(4));
}

// 같은 후보 하나가 shortlist(우선순위 1)와 reporter(우선순위 3) 양쪽에 실려 오므로, 같은 URL의
// entry 수를 그대로 세면 선정된 기사는 언제나 "공유 URL"이 된다. 그러면 본문에 버전·날짜가 없는
// 기사가 바인딩을 잃고, claim 검증이 빈 후보로 돌아 모든 근거 id가 unknown_evidence_id가 된다
// (2026-10-05 libcamera AWB 시리즈: 커버레터·패치 원문 근거 11건이 전부 거부돼 자동 강등).
// version_or_release와 api_or_component는 reporter 병합이 LLM 값으로 덮으므로 키에서 뺀다.
// release-note/watch 수집 모드는 아래 정규식이 entry 수와 무관하게 계속 공유로 본다.
// normalizeForMatch는 한글·ASCII 밖의 문자를 지워 다른 제목을 한 키로 묶을 수 있어 쓰지 않는다.
function sameUrlCandidateKey(candidate = {}) {
  return [
    candidate.source_id || candidate.source,
    candidate.title,
    candidate.published_date || candidate.publishedAt
  ].map(value => text(value).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
}

function isSharedWatchOrReleaseNoteUrl(entry, sameUrlEntries) {
  const candidate = entry?.candidate || {};
  const distinctCandidates = new Set(ensureArray(sameUrlEntries).map(item => sameUrlCandidateKey(item?.candidate)));
  if (distinctCandidates.size > 1) return true;
  return /release-note|watch|documentation_page|watchlist/i.test([
    candidate.collectionMode,
    candidate.collection_mode,
    candidate.sourceCollectionMode,
    candidate.source_collection_mode,
    candidate.source_kind
  ].map(text).join(' '));
}

function sharedUrlEvidenceMatches(section, entry, sameUrlEntries) {
  if (!isSharedWatchOrReleaseNoteUrl(entry, sameUrlEntries)) return true;
  return candidateVersionMatchesSection(section, entry.candidate) || candidateDateMatchesSection(section, entry.candidate);
}

function candidateConsistencyViolation(section, candidate) {
  const sectionTextValue = sourceEvidence(section);
  const sectionDates = dateTokens(sectionTextValue);
  const candidateDates = dateTokens(candidate?.published_date || candidate?.publishedAt);
  if (candidateDates.size > 0 && sectionDates.size > 0 && ![...candidateDates].some(date => sectionDates.has(date))) {
    return 'published_date mismatch';
  }
  const version = text(candidate?.version_or_release || candidate?.versionOrRelease);
  if (version && !candidateVersionMatchesSection(section, candidate) && /\b(?:v?\d+(?:\.\d+)+|20\d{2}|C\+\+\d{2}|Android\s+\d+)\b/i.test(sectionTextValue)) {
    return 'version_or_release mismatch';
  }
  const api = text(candidate?.api_or_component || candidate?.apiOrComponent);
  if (api && !/^api$/i.test(api) && !candidateApiMatchesSection(section, candidate) && candidateTitleSimilarity(section, candidate) < 0.2) {
    return 'api_or_component mismatch';
  }
  return '';
}

function bindCandidateForSection(section, bindingIndex) {
  const sourceUrls = [
    section?.source_candidate_url,
    ...ensureArray(section?.sources).map(source => source?.url)
  ].map(text).filter(Boolean);
  const checked = new Set();
  for (const sourceUrl of sourceUrls) {
    const key = normalizedUrlKey(sourceUrl);
    if (!key || checked.has(key)) continue;
    checked.add(key);
    const matches = ensureArray(bindingIndex?.byUrl?.get(key));
    if (matches.length === 0) continue;
    const bestPriority = Math.min(...matches.map(entry => entry.priority));
    const priorityMatches = matches.filter(entry => entry.priority === bestPriority);
    const scored = priorityMatches
      .map(entry => ({ ...entry, tie_score: bindingTieBreakScore(section, entry) }))
      .sort((a, b) => b.tie_score - a.tie_score || String(a.candidate?.title || '').localeCompare(String(b.candidate?.title || '')));
    const best = scored[0];
    const tied = scored.filter(entry => entry.tie_score === best.tie_score);
    if (tied.length > 1) {
      return {
        status: 'ambiguous',
        reason: `Ambiguous source candidate match for normalized URL: ${key}.`,
        source_url: sourceUrl,
        candidates: tied.map(entry => ({
          title: text(entry.candidate?.title),
          source: text(entry.source),
          published_date: text(entry.candidate?.published_date || entry.candidate?.publishedAt),
          version_or_release: text(entry.candidate?.version_or_release || entry.candidate?.versionOrRelease)
        }))
      };
    }
    if (!sharedUrlEvidenceMatches(section, best, matches)) {
      return {
        status: 'evidence_mismatch',
        reason: 'Shared watch/release-note URL requires matching version_or_release or published_date evidence.',
        source_url: sourceUrl,
        candidate: best.candidate,
        binding_source: best.source
      };
    }
    const consistencyViolation = candidateConsistencyViolation(section, best.candidate);
    if (consistencyViolation) {
      return {
        status: 'evidence_mismatch',
        reason: `Article evidence conflicts with bound candidate metadata: ${consistencyViolation}.`,
        source_url: sourceUrl,
        candidate: best.candidate,
        binding_source: best.source
      };
    }
    return {
      status: 'bound',
      reason: '',
      source_url: sourceUrl,
      candidate: best.candidate,
      binding_source: best.source,
      tie_score: best.tie_score
    };
  }
  return {
    status: 'missing',
    reason: 'No reporter/shortlist source candidate matches this main article source URL.',
    source_url: sourceUrls[0] || ''
  };
}

module.exports = {
  normalizedTokens,
  tokenSimilarity,
  weightedTitleTokens,
  sourceTitleHasRawCopySignal,
  weightedTitleSimilarity,
  candidateTitleSimilarity,
  dateTokens,
  valueAppearsInSection,
  candidateDateMatchesSection,
  candidateVersionMatchesSection,
  candidateApiMatchesSection,
  sectionSourceIdMatches,
  bindingTieBreakScore,
  isSharedWatchOrReleaseNoteUrl,
  sharedUrlEvidenceMatches,
  candidateConsistencyViolation,
  bindCandidateForSection
};
