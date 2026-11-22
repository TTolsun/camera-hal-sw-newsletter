'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  candidateUrls,
  candidateCanonicalUrl
} = require('./candidate-claim-matching');
const {
  IMPACT_TYPES,
  RECOMMENDED_ARTICLE_TYPES
} = require('../../shared/evidence/impact-classifier');
const {
  findFieldHygieneIssues
} = require('../reporter/article-field-builder');
const {
  normalizeArticleSections
} = require('../reporter/article-section-contract');
const {
  isRepairableStoryBodyIssue,
  validatePublicArticle
} = require('../reporter/public-article-contract');
const {
  validateDateSource,
  validateEventType,
  dateQualityForCandidate
} = require('../../shared/common/date-signals');
const {
  SOURCE_QUALITY_FIELD_DRIFT,
  normalizeSourceQuality,
  sourceQualityFieldDrift
} = require('../../shared/collect/source-quality-classifier');
const {
  LINKED_EVIDENCE_UNRESOLVED_STATUSES,
  LINKED_EVIDENCE_RUNTIME_TERMS,
  LINKED_EVIDENCE_RUNTIME_CLAIM,
  LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM,
  LINKED_EVIDENCE_HIGH_IMPACT_CLAIM,
  LINKED_EVIDENCE_LIMITATION_NOTE
} = require('../../shared/common/quality-gate-policy');
const { gerritTarget } = require('../reporter/gerrit-source-reader');
const { text } = require('./quality-text');
// claim 이슈 카테고리 매핑은 레지스트리 모듈로 분리했다(OCP). 여기서는 그대로 재노출한다.
const { claimIssueCategory } = require('./claim-issue-category');

// Per-rule deduction logic: candidate-selection eligibility, CameraX source-extraction
// integrity, linked-evidence overclaim, claim-validation, and the field/source/image
// deduction descriptors. Moved verbatim out of newsletter-quality.js as part of the
// SRP split (issue #52 phase 6); these rules are the publish gate, so the deduction
// weights and blocking semantics are byte-for-byte identical.

function candidateSelectionViolation(candidate) {
  if (!candidate) return '';
  const violations = [];
  const finalSelectionEligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  const hasDatedEvidence = typeof candidate.hasDatedEvidence === 'boolean'
    ? candidate.hasDatedEvidence
    : candidate.has_dated_evidence;
  const isWatchPage = typeof candidate.isWatchPage === 'boolean'
    ? candidate.isWatchPage
    : candidate.is_watch_page;
  if (!['main', 'short'].includes(finalSelectionEligibility)) {
    violations.push(`finalSelectionEligibility=${finalSelectionEligibility || 'unknown'}`);
  }
  if (hasDatedEvidence !== true) violations.push('missing dated evidence');
  if (text(candidate.event_type)) {
    const eventTypeError = validateEventType(candidate.event_type);
    if (eventTypeError) violations.push(`invalid event_type=${text(candidate.event_type)}`);
  }
  if (text(candidate.date_source)) {
    const dateSourceError = validateDateSource(candidate.date_source);
    if (dateSourceError) violations.push(`invalid date_source=${text(candidate.date_source)}`);
  }
  if (text(candidate.effective_date || candidate.effectiveDate)) {
    const dateQuality = dateQualityForCandidate(candidate);
    if (dateQuality.main_article_date_eligible !== true) {
      violations.push(`effective_date not publish-ready: date_source=${dateQuality.date_source}`);
    }
    if (['snapshot_detected_at', 'content_hash_changed_without_date', 'missing'].includes(dateQuality.date_source)) {
      violations.push(`weak source event date_source=${dateQuality.date_source}`);
    }
  }
  if (isWatchPage === true && hasDatedEvidence !== true) {
    violations.push('watch page lacks dated evidence');
  }
  if (candidate.main_eligible === false) violations.push('main_eligible=false');
  if (candidate.source_gap_risk === true) violations.push('source_gap_risk=true');
  if (candidate.reference_only === true) violations.push('reference_only=true');
  const hasCanonicalSourceQuality = Boolean(candidate.source_quality && typeof candidate.source_quality === 'object' && !Array.isArray(candidate.source_quality));
  if (candidate.source_quality_required === true && !hasCanonicalSourceQuality) {
    violations.push('missing canonical source_quality');
  }
  if (hasCanonicalSourceQuality) {
    const sourceQuality = normalizeSourceQuality(candidate);
    const drift = sourceQualityFieldDrift(candidate);
    if (!candidateCanonicalUrl(candidate)) violations.push('missing_url');
    if (drift.length > 0) violations.push(SOURCE_QUALITY_FIELD_DRIFT);
    if (sourceQuality.source_url_quality === 'unknown') violations.push('unresolved source_url_quality=unknown');
    if (sourceQuality.source_quality_status === 'blocked') violations.push('source_quality_status=blocked');
    if (sourceQuality.main_article_source_allowed !== true) violations.push('main_article_source_allowed=false');
    for (const blocker of ensureArray(sourceQuality.main_article_source_blockers)) {
      violations.push(`source_quality_blocker=${blocker}`);
    }
  }
  return violations.join('; ');
}

function sourceExtractionFor(section = {}, candidate = {}) {
  return section.source_extraction || candidate?.source_extraction || null;
}

function derivedHintsFor(section = {}, candidate = {}) {
  return section.derived_editorial_hints || candidate?.derived_editorial_hints || null;
}

function extractionQualityFor(section = {}, candidate = {}) {
  return section.extraction_quality ||
    candidate?.extraction_quality ||
    section.source_extraction?.extraction_quality ||
    candidate?.source_extraction?.extraction_quality ||
    null;
}

function sourceExtractionItems(value = {}) {
  return [
    ...(Array.isArray(value?.release?.sections) ? value.release.sections : []),
    ...(Array.isArray(value?.minor_line_context?.sections) ? value.minor_line_context.sections : [])
  ].flatMap(section => ensureArray(section?.items));
}

function hasSourceExtractionBullet(value = {}) {
  return sourceExtractionItems(value).some(item => text(item?.text || item?.source_text));
}

function cameraXReleaseUrl(value = '') {
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

function isCameraXReleaseArticle(section = {}, candidate = {}) {
  const extraction = sourceExtractionFor(section, candidate);
  if (extraction?.adapter_id === 'android-developers-jetpack-release') return true;
  return [
    section.source_candidate_url,
    candidate?.url,
    candidate?.article_url,
    candidate?.source_candidate_url,
    ...ensureArray(section.sources).map(source => source?.url),
    ...candidateUrls(candidate || {})
  ].some(cameraXReleaseUrl);
}

function articleText(section = {}) {
  const articleSections = normalizeArticleSections(section);
  return [
    section.category,
    section.headline,
    section.what_changed,
    section.confirmed_facts,
    section.evidence_summary,
    section.specificity_checks,
    section.source_verification_notes,
    section.camera_hal_checks,
    section.action_items,
    articleSections.verified_facts,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.action_items,
    articleSections.team_share_points,
    section.sources
  ].map(text).join(' ');
}

function fieldBuilderWarningsFor(section = {}, candidate = {}) {
  return [
    ...ensureArray(section.field_builder_warnings),
    ...ensureArray(candidate?.field_builder_warnings)
  ].map(text);
}

function hasRawCameraXTableArtifact(section = {}) {
  return /Maven Group versions?|View the Camera Library|Close\b|camera-[a-z0-9-]+\s+(?:-|\d+\.\d+\S*)\s+(?:-|\d+\.\d+\S*)/i
    .test(articleText(section));
}

function hasGenericCameraXFallbackText(section = {}) {
  const value = text(section.what_changed || section.evidence_summary || section.headline);
  return /^CameraX(?:\s*\/\s*androidx\.camera)?\s+(?:update|updates|updated|release|released|업데이트|릴리스)(?:입니다|입니다\.|\.?)?$/i
    .test(value);
}

function cameraXSourceExtractionViolations(section = {}, candidate = {}) {
  if (!isCameraXReleaseArticle(section, candidate)) return [];
  const extraction = sourceExtractionFor(section, candidate);
  const quality = extractionQualityFor(section, candidate) || {};
  const hints = derivedHintsFor(section, candidate) || {};
  const violations = [];
  if (quality.used_fallback === true) violations.push('source_extraction.used_fallback=true');
  if (quality.main_article_allowed === false) violations.push('source_extraction.main_article_allowed=false');
  if (fieldBuilderWarningsFor(section, candidate).includes('behavior_fallback_from_metadata')) {
    violations.push('behavior_fallback_from_metadata');
  }
  if (hasRawCameraXTableArtifact(section)) violations.push('raw CameraX artifact table remains in article text');
  if (!extraction || !hasSourceExtractionBullet(extraction)) {
    violations.push('source_extraction.release.sections has no concrete release-note bullet');
  }
  if (hasGenericCameraXFallbackText(section)) violations.push('generic CameraX fallback text used as main article body');
  // HAL-boundary discussion and validation-checklist depth are editorial-quality concerns
  // (is this useful to a Camera HAL SW engineer?) judged by the fact-checker LLM, not source
  // extraction integrity — so they are no longer deterministic publish blockers.
  return [...new Set(violations)];
}

function boundedDeduct(state, category, points, reason, location = '', options = {}) {
  if (points <= 0) return;
  const blocking = options.blocking !== false;
  state.deductions.push({
    category,
    points,
    reason,
    location,
    blocking,
    severity: options.severity || (blocking ? 'hard' : 'soft'),
    reason_code: options.reason_code || '',
    dedupe_key: options.dedupe_key || ''
  });
}

function linkedEvidenceArticleFields(section) {
  const articleSections = normalizeArticleSections(section || {});
  return [
    section?.headline,
    section?.what_changed,
    articleSections.background_context,
    articleSections.hal_driver_impact,
    articleSections.team_share_points,
    section?.evidence_summary,
    section?.confirmed_facts,
    section?.source_verification_notes,
    section?.action_items
  ];
}

function linkedEvidenceArticleText(section) {
  return linkedEvidenceArticleFields(section).map(text).join(' ');
}

// text()와 같은 순서로 필드·배열 항목을 낱개 문자열로 편다. 필드 경계는 문장 경계이므로, 1차 변경
// 상태 구절을 지우는 판정은 조각마다 한다.
function textLeaves(value) {
  if (Array.isArray(value)) return value.flatMap(textLeaves);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textLeaves);
  return [String(value || '').trim()];
}

function linkedEvidenceEvidenceText(section) {
  return [
    section?.evidence_summary,
    section?.confirmed_facts,
    section?.source_verification_notes
  ].map(text).join(' ');
}

function linkedEvidenceNotesText(section) {
  return text(section?.source_verification_notes);
}

// 같은 문장 안에 linked evidence 주어(IssueTracker·GitHub·CVE 등)가 있으면, 앞이든 뒤든 그 문장의
// MERGED는 1차 변경의 상태가 아니라 linked evidence에 대한 주장일 수 있으므로 지우지 않는다.
// 예: 'Linked evidence b/42 — Gerrit change 123 MERGED.', 'Gerrit change 123 MERGED로 CVE-… 반영.'
// 문장 경계는 공백·끝이 뒤따르는 마침표·물음표·느낌표와 줄바꿈이다. v1.2나 URL 안의 마침표는
// 경계가 아니다.
const LINKED_EVIDENCE_SUBJECT = /\b(?:IssueTracker|Issue Tracker|GitHub|mailing list|CVE|linked evidence)\b/i;
const SENTENCE_END = /[.!?](?=\s|$)|\n/g;

function unterminatedLastSentence(text) {
  if (!text || /[.!?]\s*$/.test(text)) return '';
  const boundaries = [...text.matchAll(SENTENCE_END)];
  return boundaries.length ? text.slice(boundaries.at(-1).index + 1) : text;
}

// 기자가 1차 변경의 병합 상태를 옮겨 적은 구간인지 사실 대조로 판정한다. 이전에는 허용 문구를 나열해
// 시각 한 칸만 더 써도 차단했다(2026-10-26 #1357, 2026-11-16 기사 5건 중 4건 거짓 차단). 이제 같은
// 문장에서 'Gerrit change N'(N은 1차 변경 번호)부터 처음 나오는 MERGED까지를 구간으로 잡고, 구간 안의
// 모든 ASCII 낱말이 공식 metadata에서 나온 사실이거나 고정 허용어일 때만 그 구간을 지운다. 구간 밖의
// 기술 식별자(기기명·quirk 이름 등)는 상관없다. 한국어는 조사·브랜치·병합·상태·변경만 허용하고, 문자는 ASCII 낱말 문자·공백·한글·괄호·쉼표만 허용한다. 구간 안에 다른 번호·
// 브랜치·날짜·시각이나 b/42 같은 낱말이 있으면 지우지 않고, 구간 뒤에 'and verified'가 이어지면 치환어에
// 남은 'Gerrit' 때문에 기존 확정 주장 정규식이 계속 잡는다.
const GERRIT_STATE_WORD = /[A-Za-z0-9/._=:-]+/g;
const GERRIT_STATE_FIXED_WORDS = new Set(['gerrit', 'change', 'merged', 'status=merged', 'status', 'utc']);
const GERRIT_STATE_SPAN_LIMIT = 120;
// 구간에 허용하는 문자: ASCII 낱말 문자, 공백, 한글 음절, 괄호·쉼표. 한자·가나·전각 문자·이모지 등은
// 낱말 검사를 비켜 가므로 이 목록 밖의 문자가 하나라도 있으면 치환하지 않는다(fail-closed).
const GERRIT_STATE_SPAN_CHARS = /^[A-Za-z0-9/._=:\s가-힣(),-]+$/;
// 구간 안의 한국어도 제한한다. 확정 주장 정규식은 영어만 보므로 '해결하고' 같은 한국어 낱말이 끼면 막을 수 없다.
const GERRIT_STATE_KOREAN_WORD = /^(?:(?:브랜치|병합|상태|변경)(?:은|는|이|가|에|의|로|으로)?|은|는|이|가|에|의|로|으로)$/;

// submitted는 'YYYY-MM-DD HH:MM:SS[.fff]' 문자열이어야 한다. 아니면 null(치환하지 않음 = 차단 유지).
function gerritSubmittedParts(metadata) {
  const match = typeof metadata?.submitted === 'string' &&
    metadata.submitted.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/);
  return match ? { date: match[1], time: match[2] } : null;
}

function isGerritMergedSpan(span, changeId, metadata, { date, time }) {
  const clock = time.split('.')[0];
  const allowed = new Set([changeId, metadata.project, metadata.branch, date, clock, clock.slice(0, 5)]);
  if (!GERRIT_STATE_SPAN_CHARS.test(span)) return false;
  const koreanAllowed = (span.match(/[가-힣]+/g) || []).every(word => GERRIT_STATE_KOREAN_WORD.test(word));
  return koreanAllowed && (span.match(GERRIT_STATE_WORD) || [])
    .map(word => word.replace(/^[.:=-]+|[.:=-]+$/g, '')).filter(Boolean)
    .every(word => allowed.has(word) || GERRIT_STATE_FIXED_WORDS.has(word.toLowerCase()) ||
      // 소수 초는 metadata 시각의 앞부분과 정확히 같을 때만 허용한다('12:00:00.000'은 허용, '12:00:00.5'는 거부).
      (/^\d{2}:\d{2}:\d{2}\.\d+$/.test(word) && time.startsWith(word)));
}

// 'Gerrit change N' 출현 위치마다 독립적으로 구간(첫 MERGED까지)을 잡아 판정한다. 앞 구간이 거부되면
// 그 안에 있는 뒤쪽 'Gerrit change N … MERGED'도 다음 출현 위치로서 따로 판정한다. 치환된 구간은 건너뛴다.
function neutralizeGerritMergedSentence(sentence, changeId, metadata, parts) {
  const startPattern = new RegExp(`Gerrit\\s+(?:change|변경)\\s+${changeId}(?!\\d)`, 'gi');
  const tailPattern = new RegExp(`[^]{0,${GERRIT_STATE_SPAN_LIMIT}}?(?:status=)?MERGED`, 'iy');
  let result = '';
  let copied = 0;
  for (let found = startPattern.exec(sentence); found; found = startPattern.exec(sentence)) {
    tailPattern.lastIndex = found.index + found[0].length;
    if (!tailPattern.test(sentence)) continue;
    const end = tailPattern.lastIndex;
    if (!isGerritMergedSpan(sentence.slice(found.index, end), changeId, metadata, parts)) continue;
    result += sentence.slice(copied, found.index) + 'Gerrit primary source state';
    copied = end;
    startPattern.lastIndex = end;
  }
  return result + sentence.slice(copied);
}

// 문장 단위로 구간을 찾는다. 같은 문장에 linked evidence 주어(IssueTracker·GitHub·CVE 등)가 있으면, 앞이든
// 뒤든 그 문장의 MERGED는 linked evidence에 대한 주장일 수 있어 지우지 않는다. lead는 앞 필드가 문장부호
// 없이 끝난 경우(제목·'Linked evidence b/42 상태:' 같은 라벨)의 마지막 문장으로, 첫 문장과 같은 문장으로 본다.
function neutralizeGerritMergedState(articleText, changeId, metadata, lead = '') {
  const parts = gerritSubmittedParts(metadata);
  if (!parts) return articleText;
  let result = '';
  let start = 0;
  for (const boundary of [...articleText.matchAll(SENTENCE_END), { index: articleText.length }]) {
    const sentence = articleText.slice(start, boundary.index);
    const context = start === 0 ? `${lead} ${sentence}`: sentence;
    result += LINKED_EVIDENCE_SUBJECT.test(context)
      ? sentence
      : neutralizeGerritMergedSentence(sentence, changeId, metadata, parts);
    result += articleText.slice(boundary.index, boundary.index + 1);
    start = boundary.index + 1;
  }
  return result;
}

// 소스 리더가 지원하는 Gerrit 호스트(android-review·chromium-review)의 변경 번호. 그 밖의 URL이면 ''.
function primaryGerritChangeId(url) {
  try { return gerritTarget(String(url || ''))?.number || ''; } catch { return ''; }
}

// The source reader splits one long Gerrit revision into numbered parts. Accept split
// labels only if every part of that same primary revision is present exactly once.
function labeledPrimaryDocuments(documents, sourceLabels, evidenceLabels) {
  if (sourceLabels.length !== 1 || !evidenceLabels.length) return [];
  const url = sourceLabels[0].replace(/^Source URL:\s*/i, '').trim();
  const ids = evidenceLabels.map(label => label.replace(/^Evidence ID:\s*/i, '').trim());
  const found = ids.map(id => documents.find(doc => doc.url === url && doc.evidence_id === id));
  if (found.some(doc => !doc)) return [];
  if (found.length === 1) return (found[0].parts || 1) === 1 ? found : [];
  const revision = found[0].revision;
  const parts = found.map(doc => doc.part);
  if (!revision || !found.every(doc => doc.revision === revision && doc.parts === found.length &&
    Number.isInteger(doc.part) && doc.part >= 1 && doc.part <= found.length) ||
    new Set(parts).size !== found.length) return [];
  return found;
}

function hasUnresolvedConfirmationClaim(section, candidate) {
  const documents = candidate?.article_source_reading?.status === 'read'
    ? ensureArray(candidate.article_source_reading.documents).filter(doc =>
      doc.url === candidate.url && doc.evidence_id && doc.text && doc.truncated === false)
    : [];
  // A fetched primary patch is independent of unresolved links extracted from
  // that patch. The evidence id binds the note to that exact fetched document;
  // any explicit URL must agree too. A blanket confirmation remains blocked.
    const verificationNotes = ensureArray(section?.source_verification_notes).map(text);
    // The schema permits URL, evidence id and reading status on separate lines.
    // Only explicit single-value labels provide shared primary-document context;
    // other prose must still establish its own scope and is checked below.
    const sourceLabels = verificationNotes.filter(note => /^Source URL:\s*https?:\/\/\S+\s*$/i.test(note));
    const evidenceLabels = verificationNotes.filter(note => /^Evidence ID:\s*source-body:[a-zA-Z0-9_-]+\s*$/i.test(note));
    const labeledDocuments = labeledPrimaryDocuments(documents, sourceLabels, evidenceLabels);
    const notes = verificationNotes.filter(note => {
    const value = text(note);
    const urls = value.match(/https?:\/\/[^\s<>"')]+/g) || [];
    const evidenceIds = value.match(/source-body:[a-zA-Z0-9_-]+/g) || [];
      // A document whose diff was omitted cannot back a note that says the diff was read.
      const readsOmittedDiff = /\bdiff\b/i.test(value) &&
        documents.some(doc => doc.diff_omitted && (labeledDocuments.includes(doc) || doc.evidence_id === evidenceIds[0]));
      const primaryOnly = !readsOmittedDiff && /primary source|원문|\bfrom\b|\bpatch details\b|\bcommit message\b/i.test(value) &&
      !/linked|모든|전체|\ball\b|\bevery\b|\bentire\b/i.test(value);
      if (primaryOnly && labeledDocuments.length && evidenceIds.length === 0 && urls.length === 0) return false;
    return !(primaryOnly && evidenceIds.length === 1 && urls.length <= 1 && documents.some(doc =>
      evidenceIds[0] === doc.evidence_id &&
      (urls.length === 0 || urls[0].replace(/[.,;]+$/, '') === doc.url)));
  });
  // 조각마다 지운다. 마침표 없이 끝난 상태 구절 바로 다음 필드에 linked evidence 한계 노트가 오면,
  // 이어 붙인 글에서는 그 노트의 주어가 같은 문장으로 보여 정상 구절까지 차단된다.
  const leaves = linkedEvidenceArticleFields({ ...section, source_verification_notes: notes }).flatMap(textLeaves).filter(Boolean);
  let pieces = leaves;
  // A primary change's fetched status is not the status of its linked bugs.
  // Recognize only metadata-backed renderings of that state; leave other
  // assertions (including neighbouring confirmations) visible to the existing
  // blocker.
  for (const document of documents) {
    const match = document.text.match(/^Official Gerrit metadata \(UTC timestamps\):\s*\n(\{[\s\S]*?\n\})\s*\n\n(?:Complete revision patch|Revision commit message)/);
    if (!match) continue;
    let metadata;
    try { metadata = JSON.parse(match[1]); } catch { continue; }
    const changeId = primaryGerritChangeId(candidate.url);
    if (!changeId || String(metadata.change_number) !== changeId || metadata.status !== 'MERGED' ||
      !metadata.project || !metadata.branch || !gerritSubmittedParts(metadata)) continue;
    pieces = pieces.map((piece, index) =>
      neutralizeGerritMergedState(piece, changeId, metadata, unterminatedLastSentence(leaves[index - 1])));
  }
  return LINKED_EVIDENCE_CONFIRMED_DETAIL_CLAIM.test(pieces.join(' '));
}

function linkedEvidenceDiagnostics(candidate = {}) {
  const hasSummary = Object.prototype.hasOwnProperty.call(candidate, 'linked_evidence_summary') ||
    Object.prototype.hasOwnProperty.call(candidate, 'linkedEvidenceSummary');
  const hasImpact = Object.prototype.hasOwnProperty.call(candidate, 'impact_classification') ||
    Object.prototype.hasOwnProperty.call(candidate, 'impactClassification');
  if (!hasSummary && !hasImpact) {
    return {
      present: false,
      malformed: false,
      hasLinkedEvidence: false,
      hasUnresolvedEvidence: false,
      summary: null,
      impact: null
    };
  }

  const summary = candidate.linked_evidence_summary || candidate.linkedEvidenceSummary;
  const impact = candidate.impact_classification || candidate.impactClassification;
  const summaryIsObject = !hasSummary || (summary && typeof summary === 'object' && !Array.isArray(summary));
  const impactIsObject = !hasImpact || (impact && typeof impact === 'object' && !Array.isArray(impact));
  let malformed = hasSummary !== hasImpact || !summaryIsObject || !impactIsObject;
  const totalCount = summaryIsObject ? Number(summary?.total_count) : 0;
  if (hasSummary && !Number.isFinite(totalCount)) malformed = true;
  if (Number.isFinite(totalCount) && totalCount > 0 && !impactIsObject) malformed = true;

  const byFetchStatus = summaryIsObject && summary?.by_fetch_status && typeof summary.by_fetch_status === 'object'
    ? summary.by_fetch_status
    : {};
  const hasUnresolvedEvidence = summaryIsObject && (
    summary?.has_unresolved_evidence === true ||
    LINKED_EVIDENCE_UNRESOLVED_STATUSES.some(status => Number(byFetchStatus[status] || 0) > 0)
  );
  return {
    present: true,
    malformed,
    hasLinkedEvidence: Number.isFinite(totalCount) && totalCount > 0,
    hasUnresolvedEvidence,
    summary: summaryIsObject ? summary : null,
    impact: impactIsObject ? impact : null
  };
}

function addLinkedEvidenceQualityDeductions(state, section, candidate, location) {
  const diagnostics = linkedEvidenceDiagnostics(candidate);
  if (!diagnostics.present) return;

  if (diagnostics.malformed) {
    boundedDeduct(
      state,
      'linked-evidence-malformed',
      2,
      'Bound candidate has malformed linked evidence diagnostics; treat linked evidence as diagnostic-only.',
      location,
      { blocking: false }
    );
  }
  if (!diagnostics.hasLinkedEvidence || !diagnostics.impact) return;

  const articleText = linkedEvidenceArticleText(section);
  const evidenceText = linkedEvidenceEvidenceText(section);
  const notesText = linkedEvidenceNotesText(section);
  const impactType = text(diagnostics.impact.impact_type);
  const recommendedArticleType = text(diagnostics.impact.recommended_article_type);
  const runtimeClaim = LINKED_EVIDENCE_RUNTIME_CLAIM.test(articleText);
  const explicitRuntimeEvidence = LINKED_EVIDENCE_RUNTIME_TERMS.test(evidenceText);
  const overclaimReasons = [];

  if (diagnostics.hasUnresolvedEvidence && hasUnresolvedConfirmationClaim(section, candidate)) {
    overclaimReasons.push('Article describes unresolved linked evidence as confirmed detail.');
  }
  if (impactType === IMPACT_TYPES.BUILD_DEPENDENCY_FIX && runtimeClaim) {
    overclaimReasons.push('Article frames build_dependency_fix linked evidence as HAL runtime or camera pipeline behavior change.');
  }
  if (impactType === IMPACT_TYPES.TEST_ONLY_CHANGE && runtimeClaim) {
    overclaimReasons.push('Article frames test_only_change linked evidence as product or runtime behavior change.');
  }
  if (impactType === IMPACT_TYPES.DOCUMENTATION_ONLY && runtimeClaim) {
    overclaimReasons.push('Article frames documentation_only linked evidence as implementation or runtime change.');
  }
  if (recommendedArticleType === RECOMMENDED_ARTICLE_TYPES.WATCH && !explicitRuntimeEvidence) {
    overclaimReasons.push('Article promotes watch-only linked evidence to main framing without explicit runtime or pipeline evidence.');
  }
  if (
    (diagnostics.impact.hal_runtime_impact !== true && diagnostics.impact.camera_pipeline_impact !== true) &&
    LINKED_EVIDENCE_HIGH_IMPACT_CLAIM.test(articleText) &&
    !explicitRuntimeEvidence
  ) {
    overclaimReasons.push('Article claims high HAL/runtime impact without explicit stream, buffer, metadata, request/result, ImageCapture, VideoCapture, Surface, or CameraPipe evidence.');
  }

  for (const reason of overclaimReasons) {
    boundedDeduct(state, 'linked-evidence-overclaim', 8, reason, location);
  }

  if (diagnostics.hasUnresolvedEvidence && !LINKED_EVIDENCE_LIMITATION_NOTE.test(notesText)) {
    boundedDeduct(
      state,
      'linked-evidence-limitation',
      2,
      'Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.',
      location,
      { blocking: false }
    );
  }
}

function addClaimValidationDeductions(state, validation, location, seenKeys) {
  const claimIssues = [
    ...ensureArray(validation.issues).map(item => ({
      ...item,
      claim_id: '',
      category: claimIssueCategory(item.reason_code)
    })),
    ...ensureArray(validation.claim_results).flatMap(claim =>
      ensureArray(claim.issues).map(item => ({
        ...item,
        claim_id: claim.claim_id,
        category: claimIssueCategory(item.reason_code)
      }))
    )
  ];
  for (const item of claimIssues) {
    const dedupeKey = [
      validation.article_index,
      item.claim_id || 'article',
      item.reason_code || item.message
    ].join(':');
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    boundedDeduct(
      state,
      item.category,
      item.blocking === false ? 1 : 8,
      item.message || item.reason_code || 'Claim validation issue.',
      location,
      {
        blocking: item.blocking !== false,
        severity: item.severity || (item.blocking === false ? 'soft' : 'hard'),
        reason_code: item.reason_code,
        dedupe_key: dedupeKey
      }
    );
  }
}

function isValidSourceUrl(value) {
  const raw = text(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function blockingDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => deduction?.blocking !== false);
}

function softDeductions(deductions) {
  return ensureArray(deductions).filter(deduction => deduction?.blocking === false);
}

function requiredFieldDeductions(section, sectionContract, location) {
  const out = [];
  for (const field of ['headline', 'evidence_summary']) {
    if (!text(section[field])) {
      out.push({ category: 'required-fields', points: 3, reason: `Missing required article field: ${field}.`, location });
    }
  }
  // camera_hal_checks는 editor MAIN 프롬프트가 지시하지 않는 레거시 별칭(editor-section-builders가
  // action_items로 병합)이라 모든 main draft가 빈 배열로 들어와 100% 하드 페일하던 게이트-프롬프트
  // 드리프트였다. actionability는 action_items로 별도 강제되므로 required-list에서 제외한다(게이트
  // 약화가 아니라 정렬). action_items가 actionability의 canonical 소스다.
  for (const field of ['specificity_checks', 'source_verification_notes', 'sources']) {
    if (ensureArray(section[field]).length === 0) {
      out.push({ category: 'required-fields', points: 4, reason: `Missing required article list: ${field}.`, location });
    }
  }
  for (const missingKey of sectionContract.missing_keys) {
    out.push({
      category: 'article-section-contract',
      points: missingKey === 'hal_driver_impact' ? 4 : 3,
      reason: `Missing normalized article section: ${missingKey}.`,
      location,
      options: { blocking: false }
    });
  }
  return out;
}

function fieldHygieneDeductions(section, articleSections, guardrailImpactClass, location) {
  return findFieldHygieneIssues({
    ...section,
    confirmed_facts: articleSections.verified_facts,
    guardrail_impact_class: guardrailImpactClass
  }).map(issue => ({
    category: 'field-hygiene',
    points: issue.blocking === false ? 2 : 8,
    reason: issue.reason,
    location,
    options: issue.blocking === false ? { blocking: false, severity: issue.severity || 'soft' } : {}
  }));
}

function sourceBindingDeductions(section, binding, scope, location) {
  const out = [];
  for (const source of ensureArray(section.sources)) {
    if (!isValidSourceUrl(source?.url)) {
      out.push({ category: 'source-integrity', points: 8, reason: `Missing or invalid source URL: ${source?.url || 'empty'}.`, location });
    }
  }
  if (binding.status !== 'bound') {
    out.push({
      category: 'source-integrity',
      points: 8,
      reason: binding.status === 'ambiguous'
        ? binding.reason
        : binding.status === 'evidence_mismatch'
          ? binding.reason
          : 'Main article source URL does not bind to reporter/shortlist candidate metadata.',
      location
    });
    return out;
  }
  const violation = candidateSelectionViolation(binding.candidate);
  if (violation) {
    out.push({ category: 'source-integrity', points: 8, reason: `Main article source maps to ineligible reporter/shortlist candidate: ${violation}.`, location });
  }
  if (scope?.publishable_scope !== true) {
    out.push({ category: 'source-integrity', points: 8, reason: 'Bound source candidate lacks publishable relevance_bucket and scope score metadata.', location });
  }
  return out;
}

function cameraXDeductions(section, binding, location) {
  const violations = cameraXSourceExtractionViolations(section, binding.status === 'bound' ? binding.candidate : null);
  if (violations.length === 0) return [];
  return [{ category: 'source-integrity', points: 8, reason: `CameraX source extraction failure: ${violations.join('; ')}.`, location }];
}

// 위반 위치를 사람이 읽을 수 있게 덧붙인다. 블록 주소가 있으면 그것이 곧 repair
// 모델이 쓸 가상 포인터의 인덱스다.
function storyBodyIssueAddress(issue) {
  if (Number.isInteger(issue.blockIndex)) return ` at body block ${issue.blockIndex}`;
  if (Number.isInteger(issue.line)) return ` at body line ${issue.line}`;
  return '';
}

// forbidden_construct는 하위 구문마다 고치는 법이 다르다(#1172). repair 모델에게 구문 이름이
// 전달되는 통로는 이 사유 문자열뿐이라 여기에 싣는다. reason_code는 repair 정책의 분류 키라
// 그대로 두고, dedupe_key도 바꾸지 않는다.
function storyBodyIssueConstruct(issue) {
  return issue.construct ? ` (${issue.construct})` : '';
}

// Story Contract v2 본문 검사 감점(#849, 설계 4.6절).
//
// 판정 오라클은 validatePublicArticle 하나다. 여기서 lint를 다시 구현하면 발행 직전
// validate-public-newsletter와 판정이 두 벌이 되어 한쪽만 통과하는 기사가 생긴다.
// 그중 텍스트 수리가 가능한 issue만 감점으로 옮기고 구조 실패는 그대로 둔다. 구조
// 실패는 editor 계약 검증이 이미 draft 단계에서 막는다.
//
// reason_code를 반드시 싣는다. deductionRepairPolicy는 reason_code로 먼저 분류하고,
// 그것이 비어 있으면 category와 reason 텍스트를 정규식으로 훑는다. 그 폴백 경로에서는
// body_markdown_duplicate_block이 중복 출처 분기에 걸려 replace-section으로 오분류된다.
//
// 섹션은 얕은 복사본으로 넘긴다. validatePublicArticle은 정규화 결과를 인자 섹션에
// 다시 써 넣는데, 품질 리포트는 과거 아티팩트를 재계산할 때도 도는 경로라 여기서
// 원본을 건드리면 발행된 본문이 조용히 바뀐다.
function storyBodyDeductions(section, articleIndex, issue, location) {
  return validatePublicArticle({ ...section }, articleIndex, { issue })
    .filter(isRepairableStoryBodyIssue)
    .map(item => ({
      category: 'story-body',
      points: 8,
      reason: `Story Contract v2 body check failed: ${item.type}${storyBodyIssueConstruct(item)}${storyBodyIssueAddress(item)}.`,
      location,
      options: {
        reason_code: item.type,
        dedupe_key: [articleIndex, item.type, item.blockIndex ?? item.line ?? item.key].join(':')
      }
    }));
}

function imageFallbackDeductions(section, location) {
  if (section.resolvedImage?.usedFallback !== true) return [];
  return [{ category: 'image-fallback', points: 1, reason: 'Article image uses a local fallback visual.', location, options: { blocking: false } }];
}

function applyDeductionDescriptors(state, descriptors) {
  let sourceIntegrity = 0;
  for (const descriptor of ensureArray(descriptors)) {
    boundedDeduct(state, descriptor.category, descriptor.points, descriptor.reason, descriptor.location, descriptor.options || {});
    if (descriptor.category === 'source-integrity') sourceIntegrity += 1;
  }
  return sourceIntegrity;
}

module.exports = {
  candidateSelectionViolation,
  sourceExtractionFor,
  derivedHintsFor,
  extractionQualityFor,
  sourceExtractionItems,
  hasSourceExtractionBullet,
  cameraXReleaseUrl,
  isCameraXReleaseArticle,
  articleText,
  fieldBuilderWarningsFor,
  hasRawCameraXTableArtifact,
  hasGenericCameraXFallbackText,
  cameraXSourceExtractionViolations,
  boundedDeduct,
  linkedEvidenceArticleText,
  linkedEvidenceEvidenceText,
  linkedEvidenceNotesText,
  linkedEvidenceDiagnostics,
  addLinkedEvidenceQualityDeductions,
  addClaimValidationDeductions,
  isValidSourceUrl,
  blockingDeductions,
  softDeductions,
  requiredFieldDeductions,
  fieldHygieneDeductions,
  sourceBindingDeductions,
  cameraXDeductions,
  imageFallbackDeductions,
  storyBodyDeductions,
  applyDeductionDescriptors
};
