const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  buildHtml,
  buildFactCheckMarkdown,
  buildMarkdown,
  issueTags,
  ensureArray
} = require('../render/newsletter-renderer');
const {
  imageReasonTextKo
} = require('../render/newsletter-image-audit-labels.ko');
const {
  selectImageForSectionFromMetadata
} = require('../metrics/newsletter-image-audit');
const {
  buildQualityReportMarkdown,
  buildNewsletterQualityReport
} = require('../validate/newsletter-quality');
const {
  validateRenderedIssueStructure
} = require('../validate/rendered-issue-structure');
const {
  BUCKETS,
  BUCKET_PRIORITY,
  classifyAospCameraStackCandidate
} = require('../common/aosp-camera-scope');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../common/newsletter-policy');
const {
  completeHalSignalCapsuleFromExistingFields,
  normalizeHalSignalFields
} = require('../common/hal-signal-quality');
const {
  buildConfirmedFacts,
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange,
  findFieldHygieneIssues,
  inferGuardrailImpactClass
} = require('./article-field-builder');
const {
  decodeHtml,
  readJson,
  writeJson
} = require('../common/common');
const {
  seedEvidencePackPath
} = require('../common/artifact-paths');
const {
  applyPublicationDecision,
  fallbackEditionNoticeLines,
  fallbackIssueTags,
  publicationDecisionForSections
} = require('../common/publication-mode');
const {
  deriveDecisionMetadata
} = require('../common/public-article-contract');
const {
  buildArticleSourceFactBundle
} = require('./source-fact-bundle');

const REQUIRED_PRESERVE_FIELDS = [
  'headline',
  'category',
  'confirmed_facts',
  'camera_hal_perspective',
  'action_items',
  'source_candidate_hash'
];

const PUBLIC_FILES = [
  'newsletters/${date}/newsletter.md',
  'newsletters/${date}/index.html',
  'data/newsletters.json'
];

const REVIEW_PUBLICATION_READY_REASON =
  '자동 발행 기준은 통과하지 못했지만 fallback public issue builder가 편집자 검토용 public newsletter 파일을 생성했습니다.';
const EDITOR_REVIEW_REASON =
  'AI 자동 발행 기준을 통과하지 못했으므로 merge 발행 전에 편집자 검토가 필요합니다.';

const NORMAL_BUCKET_ORDER = [
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
  BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
  BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT,
  BUCKETS.SOC_PLATFORM_SIGNAL
];

const FALLBACK_BUCKET_ORDER = [
  ...NORMAL_BUCKET_ORDER,
  BUCKETS.CPP_AI_TOOLING_FALLBACK
];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

const ACTIONABILITY_RANK = Object.freeze({
  none: 0,
  generic_review: 1,
  concrete_check: 2,
  measurable_test: 3,
  owner_metric_log: 4
});

function strongerActionability(left, right) {
  const leftText = text(left);
  const rightText = text(right);
  return (ACTIONABILITY_RANK[rightText] ?? -1) > (ACTIONABILITY_RANK[leftText] ?? -1)
    ? rightText
    : leftText || rightText;
}

function completeHalSignalSection(section = {}, candidate = {}) {
  const combined = {
    ...candidate,
    ...section,
    relevance_bucket: section.relevance_bucket || candidate.relevance_bucket
  };
  const halSignal = normalizeHalSignalFields(combined);
  const bucket = text(combined.relevance_bucket);
  const fallbackBucket = ['cpp_ai_tooling_fallback', 'generic_tech_watchlist', 'soc_platform_signal'].includes(bucket);
  const fallbackPromotionReason = section.fallback_promotion_reason ||
    halSignal.fallback_promotion_reason ||
    (fallbackBucket && halSignal.fallback_promotion_allowed === true
      ? 'Fallback builder는 이 항목을 Camera HAL 검증 연결이 명시된 보조 main article로만 승격했습니다.'
      : '');
  const actionItems = ensureArray(section.article_sections?.action_items).length > 0
    ? ensureArray(section.article_sections.action_items)
    : ensureArray(section.action_items);
  const capsuleCompletion = completeHalSignalCapsuleFromExistingFields({
    ...combined,
    article_sections: {
      ...(combined.article_sections || {}),
      action_items: actionItems
    }
  }, {
    mode: 'fallback_public_issue'
  });
  if (!capsuleCompletion.complete) {
    throw new Error(`Fallback public issue produced incomplete hal_signal_capsule: ${capsuleCompletion.reason_codes.join(', ') || 'unknown'}`);
  }
  const hal_signal_capsule = capsuleCompletion.capsule;
  return {
    ...section,
    hal_impact_axes: ensureArray(section.hal_impact_axes).length > 0 ? section.hal_impact_axes : halSignal.hal_impact_axes,
    reader_owners: ensureArray(section.reader_owners).length > 0 ? section.reader_owners : halSignal.reader_owners,
    actionability_level: strongerActionability(section.actionability_level, halSignal.actionability_level),
    effective_actionability_level: strongerActionability(section.effective_actionability_level, halSignal.effective_actionability_level),
    actionability_upgrade_reason: section.actionability_upgrade_reason || halSignal.actionability_upgrade_reason,
    actionability_upgrade_evidence: section.actionability_upgrade_evidence || halSignal.actionability_upgrade_evidence,
    signal_quality_status: section.signal_quality_status || halSignal.signal_quality_status,
    do_not_overstate: ensureArray(section.do_not_overstate).length > 0 ? section.do_not_overstate : halSignal.do_not_overstate,
    fallback_promotion_allowed: typeof section.fallback_promotion_allowed === 'boolean'
      ? section.fallback_promotion_allowed
      : halSignal.fallback_promotion_allowed,
    fallback_promotion_reason: fallbackPromotionReason,
    fallback_guard_notes: ensureArray(section.fallback_guard_notes).length > 0 ? section.fallback_guard_notes : halSignal.fallback_guard_notes,
    soc_signal_type: section.soc_signal_type || halSignal.soc_signal_type,
    soc_signal_source_allowed: typeof section.soc_signal_source_allowed === 'boolean'
      ? section.soc_signal_source_allowed
      : halSignal.soc_signal_source_allowed,
    camera_pipeline_link: section.camera_pipeline_link || halSignal.camera_pipeline_link,
    hal_signal_capsule
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function reviewableFailureKindForFallbackStatus(status = {}) {
  if (status.failure_kind) return status.failure_kind;
  if (
    status.editor_semantic_validation ||
    status.fact_check_status === 'NEEDS_FIX' ||
    status.quality_status === 'NEEDS_FIX' ||
    status.status === 'NEEDS_FIX' ||
    status.status === 'QUALITY_NEEDS_FIX'
  ) {
    return 'editorial_reviewable';
  }
  return undefined;
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function applyDeterministicImageSelection(section) {
  const selection = selectImageForSectionFromMetadata(section);
  const selected = selection.selectedCandidate;
  if (!selected) {
    const reasonCode = selection.reasonCode || (ensureArray(section.imageCandidates).length === 0 ? 'no_candidate' : 'missing_candidate_metadata');
    section.imageSelection = {
      reasonCode,
      reasonText: imageReasonTextKo(reasonCode),
      sourceUrl: '',
      attribution: '',
      licenseStatus: '',
      validationStatus: '',
      validationSource: 'candidate_metadata',
      candidateUrl: '',
      exclusionEvidence: selection.candidateEvidence
    };
    section.imageUsageDecisionReason = imageReasonTextKo(reasonCode);
    return section;
  }
  section.selectedImage = selected.url;
  section.imageSource = selected.sourceUrl;
  section.imageAttribution = selected.attribution;
  section.imageAlt = String(selected.alt || section.public_article?.headline || section.headline || 'Article image').trim();
  section.imageLicenseStatus = selected.licenseStatus;
  section.imageUsageDecisionReason = imageReasonTextKo('selected');
  section.imageSelection = {
    reasonCode: 'selected',
    reasonText: imageReasonTextKo('selected'),
    sourceUrl: selected.sourceUrl,
    attribution: selected.attribution,
    licenseStatus: selected.licenseStatus,
    validationStatus: selected.validationStatus,
    validationSource: selected.validationSource,
    candidateUrl: selected.url,
    exclusionEvidence: selection.candidateEvidence.filter(item => item.valid === false)
  };
  section.resolvedImage = {
    url: selected.url,
    src: selected.url,
    originalUrl: '',
    originalSrc: '',
    usedFallback: false,
    reason: 'selected image candidate'
  };
  return section;
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    const keepHash = parsed.hostname === 'developer.android.com' && parsed.pathname.includes('/releases/camera');
    if (!keepHash) parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return raw.replace(/\/$/, '');
  }
}

function normalizedHash(value) {
  const url = normalizeUrl(value);
  return url ? crypto.createHash('sha256').update(url).digest('hex') : '';
}

function backgroundContextEntries(report = {}) {
  return [
    ...ensureArray(report.background_contexts),
    ...ensureArray(report.articles),
    ...ensureArray(report.items),
    ...ensureArray(report.contexts)
  ].filter(item => item && typeof item === 'object');
}

function buildBackgroundContextIndex(report = {}) {
  const byHash = new Map();
  const byUrl = new Map();
  for (const entry of backgroundContextEntries(report)) {
    const hash = firstText(entry.source_candidate_hash, entry.url_hash, entry.normalized_url_hash);
    if (hash && !byHash.has(hash)) byHash.set(hash, entry);
    const urls = [
      entry.url,
      entry.source_candidate_url,
      entry.article_url,
      ...ensureArray(entry.sources).map(source => source?.url)
    ].map(normalizeUrl).filter(Boolean);
    for (const url of urls) {
      if (!byUrl.has(url)) byUrl.set(url, entry);
    }
  }
  return { byHash, byUrl };
}

function backgroundContextForCandidate(index, candidate = {}) {
  const hash = firstText(candidate.source_candidate_hash, candidate.url_hash, candidate.normalized_url_hash);
  if (hash && index.byHash.has(hash)) return index.byHash.get(hash);
  const url = normalizeUrl(candidate.url || candidate.source_candidate_url || candidate.article_url);
  return url ? index.byUrl.get(url) || null : null;
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function firstText(...values) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return '';
}

function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of ensureArray(values).map(text).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function factCheckMustFixCount(factCheck = {}, generationStatus = {}) {
  const explicit = numeric(factCheck.must_fix_count ?? generationStatus.must_fix_count);
  if (explicit !== null) return explicit;
  return ensureArray(factCheck.must_fix).length;
}

function factCheckSourceGapCount(factCheck = {}, generationStatus = {}) {
  const explicit = numeric(factCheck.source_gap_count ?? generationStatus.source_gap_count);
  if (explicit !== null) return explicit;
  return ensureArray(factCheck.source_gaps).length;
}

function originalFactCheckDiagnostics(factCheck = {}, generationStatus = {}, qualityReport = {}) {
  const originalStatus = firstText(
    factCheck.original_fact_check_status,
    generationStatus.original_fact_check_status,
    qualityReport.original_fact_check_status,
    factCheck.status,
    generationStatus.fact_check_status,
    'UNKNOWN'
  );
  const originalMustFixCount = numeric(
    factCheck.original_must_fix_count ??
    generationStatus.original_must_fix_count ??
    qualityReport.original_must_fix_count
  );
  const originalSourceGapCount = numeric(
    factCheck.original_source_gap_count ??
    generationStatus.original_source_gap_count ??
    qualityReport.original_source_gap_count
  );
  return {
    original_fact_check_status: originalStatus,
    original_must_fix_count: originalMustFixCount ?? factCheckMustFixCount(factCheck, generationStatus),
    original_source_gap_count: originalSourceGapCount ?? factCheckSourceGapCount(factCheck, generationStatus)
  };
}

function normalizedTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(left, right) {
  const leftTokens = new Set(normalizedTitle(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizedTitle(right).split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function sectionUrls(section) {
  return ensureArray(section?.sources).map(source => normalizeUrl(source?.url)).filter(Boolean);
}

function sourceBaseKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch (_) {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function androidCameraReleaseNoteIdentity(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (
      parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname.includes('/jetpack/androidx/releases/camera') &&
      parsed.hash
    ) {
      parsed.protocol = parsed.protocol.toLowerCase();
      parsed.hostname = parsed.hostname.toLowerCase();
      parsed.search = '';
      return parsed.toString().replace(/\/$/, '');
    }
  } catch (_) {
    return '';
  }
  return '';
}

function sectionBaseUrls(section) {
  return ensureArray(section?.sources).map(source => sourceBaseKey(source?.url)).filter(Boolean);
}

function candidateUrl(candidate) {
  return firstText(candidate.url, candidate.article_url, candidate.articleUrl, candidate.source_candidate_url);
}

function candidateTitle(candidate) {
  return decodeHtml(firstText(candidate.title, candidate.headline, candidate.name, candidate.version_or_release, candidate.versionOrRelease));
}

function sourceTitle(candidate) {
  return decodeHtml(firstText(candidate.source, candidate.source_name, candidate.sourceTitle, candidate.source_title, 'Source'));
}

function candidatePublishedDate(candidate) {
  return firstText(candidate.published_date, candidate.publishedDate, candidate.date, candidate.updated_at);
}

function candidateScore(candidate) {
  const score = candidate.deterministic_score ?? candidate.score?.total ?? candidate.total_score ?? candidate.score;
  const numeric = Number(score);
  return Number.isFinite(numeric) ? numeric : 0;
}

function booleanField(candidate, field, fallback = false) {
  if (typeof candidate[field] === 'boolean') return candidate[field];
  if (typeof candidate.eligibility?.[field] === 'boolean') return candidate.eligibility[field];
  return fallback;
}

function candidateFinalSelectionEligibility(candidate) {
  return firstText(
    candidate.finalSelectionEligibility,
    candidate.eligibility?.finalSelectionEligibility,
    candidate.risk?.final_selection_eligibility
  );
}

function candidateBucket(candidate) {
  const classification = classifyAospCameraStackCandidate(candidate);
  return firstText(candidate.relevance_bucket, candidate.relevanceBucket, classification.relevance_bucket);
}

function hasDatedEvidence(candidate) {
  if (typeof candidate.hasDatedEvidence === 'boolean') return candidate.hasDatedEvidence;
  if (typeof candidate.eligibility?.hasDatedEvidence === 'boolean') return candidate.eligibility.hasDatedEvidence;
  if (typeof candidate.risk?.no_dated_evidence === 'boolean') return !candidate.risk.no_dated_evidence;
  return Boolean(candidatePublishedDate(candidate) || candidate.version_or_release || candidate.versionOrRelease);
}

function sourceGapRisk(candidate) {
  if (typeof candidate.source_gap_risk === 'boolean') return candidate.source_gap_risk;
  if (typeof candidate.eligibility?.source_gap_risk === 'boolean') return candidate.eligibility.source_gap_risk;
  if (typeof candidate.risk?.source_gap === 'boolean') return candidate.risk.source_gap;
  return false;
}

function mainEligible(candidate) {
  if (typeof candidate.main_eligible === 'boolean') return candidate.main_eligible;
  if (typeof candidate.eligibility?.main_eligible === 'boolean') return candidate.eligibility.main_eligible;
  return true;
}

function normalizeCandidate(candidate, sourceOrder) {
  if (!candidate || typeof candidate !== 'object') return null;
  const url = candidateUrl(candidate);
  const title = candidateTitle(candidate);
  if (!url || !title) return null;
  const classification = classifyAospCameraStackCandidate(candidate);
  const bucket = candidateBucket(candidate);
  const hash = firstText(candidate.source_candidate_hash, candidate.url_hash, candidate.normalized_url_hash, normalizedHash(url));
  return {
    ...candidate,
    url,
    title,
    source: sourceTitle(candidate),
    published_date: candidatePublishedDate(candidate),
    relevance_bucket: bucket,
    source_candidate_url: firstText(candidate.source_candidate_url, url),
    source_candidate_hash: hash,
    finalSelectionEligibility: candidateFinalSelectionEligibility(candidate),
    main_eligible: mainEligible(candidate),
    source_gap_risk: sourceGapRisk(candidate),
    hasDatedEvidence: hasDatedEvidence(candidate),
    reference_only: booleanField(candidate, 'reference_only', false),
    briefing_only: booleanField(candidate, 'briefing_only', false),
    score_total: candidateScore(candidate),
    editorial_priority: candidate.editorial_priority ?? classification.editorial_priority ?? BUCKET_PRIORITY[bucket] ?? 99,
    aosp_camera_directness: candidate.aosp_camera_directness ?? classification.aosp_camera_directness ?? 0,
    driver_stack_relevance: candidate.driver_stack_relevance ?? classification.driver_stack_relevance ?? 0,
    soc_platform_relevance: candidate.soc_platform_relevance ?? classification.soc_platform_relevance ?? 0,
    native_tooling_relevance: candidate.native_tooling_relevance ?? classification.native_tooling_relevance ?? 0,
    counts_as_primary_camera_topic: candidate.counts_as_primary_camera_topic ?? classification.counts_as_primary_camera_topic ?? false,
    counts_as_driver_topic: candidate.counts_as_driver_topic ?? classification.counts_as_driver_topic ?? false,
    counts_as_soc_topic: candidate.counts_as_soc_topic ?? classification.counts_as_soc_topic ?? false,
    counts_as_fallback_topic: candidate.counts_as_fallback_topic ?? classification.counts_as_fallback_topic ?? false,
    evidence_origin: candidate.evidence_origin || classification.evidence_origin || 'candidate_metadata',
    _artifact_role: candidate._artifact_role || '',
    _source_order: sourceOrder
  };
}

function pushCandidateList(target, value, artifactRole = '') {
  for (const item of ensureArray(value)) {
    target.push({
      ...item,
      _artifact_role: item?._artifact_role || artifactRole
    });
  }
}

function candidatePoolFromArtifacts({ root, date }) {
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const collectedDir = path.join(root, 'content', 'collected-news', date);
  const raw = [];
  const shortlist = readJsonIfExists(path.join(newsroomDir, 'shortlisted-candidates.json'));
  if (shortlist) {
    pushCandidateList(raw, shortlist.selected_articles, 'selected');
    pushCandidateList(raw, shortlist.primary_selected_articles, 'selected');
    pushCandidateList(raw, shortlist.reserve_candidates, 'reserve');
    pushCandidateList(raw, shortlist.shortlisted_candidates, 'shortlisted');
    pushCandidateList(raw, shortlist.demoted_candidates, 'demoted');
  }
  const capsules = readJsonIfExists(path.join(newsroomDir, 'article-capsules.json'));
  if (capsules) {
    pushCandidateList(raw, capsules.selected_capsules, 'selected');
    pushCandidateList(raw, capsules.shortlisted_capsules, 'shortlisted');
    pushCandidateList(raw, capsules.reserve_capsules, 'reserve');
  }
  const reporter = readJsonIfExists(path.join(newsroomDir, 'reporter-candidates.json'));
  if (reporter) pushCandidateList(raw, reporter.candidates, 'reporter');
  const collected = readJsonIfExists(path.join(collectedDir, 'candidates.json'));
  if (collected) pushCandidateList(raw, collected.candidates, 'collected');

  const normalized = raw
    .map((candidate, index) => normalizeCandidate(candidate, index))
    .filter(Boolean);
  const enriched = normalized.map(candidate => ({
    ...candidate,
    source_fact_bundle: buildArticleSourceFactBundle(candidate, normalized)
  }));
  const seen = new Set();
  return enriched
    .filter(candidate => {
      const key = normalizeUrl(candidate.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sectionDuplicateReason(candidate, sections) {
  const url = normalizeUrl(candidate.url);
  const baseUrl = sourceBaseKey(candidate.url);
  const releaseIdentity = androidCameraReleaseNoteIdentity(candidate.url);
  const title = candidate.title;
  for (const section of ensureArray(sections)) {
    if (sectionUrls(section).includes(url)) return 'duplicate_url';
    if (baseUrl) {
      for (const source of ensureArray(section?.sources)) {
        if (sourceBaseKey(source?.url) !== baseUrl) continue;
        const sectionReleaseIdentity = androidCameraReleaseNoteIdentity(source?.url);
        if (releaseIdentity && sectionReleaseIdentity && releaseIdentity !== sectionReleaseIdentity) {
          continue;
        }
        return 'duplicate_base_url';
      }
    }
    if (normalizedTitle(section.headline) && normalizedTitle(section.headline) === normalizedTitle(title)) {
      return 'duplicate_title';
    }
    if (titleSimilarity(section.headline, title) >= 0.82) return 'near_duplicate_title';
  }
  return '';
}

function cameraReleasePageCandidate(candidate = {}) {
  const raw = text(candidate.url || candidate.source_candidate_url);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase() === 'developer.android.com' &&
      parsed.pathname === '/jetpack/androidx/releases/camera';
  } catch {
    return /developer\.android\.com\/jetpack\/androidx\/releases\/camera/i.test(raw);
  }
}

function sourceExtractionItems(candidate = {}) {
  return [
    ...(Array.isArray(candidate?.source_extraction?.release?.sections) ? candidate.source_extraction.release.sections : []),
    ...(Array.isArray(candidate?.source_extraction?.minor_line_context?.sections) ? candidate.source_extraction.minor_line_context.sections : [])
  ].flatMap(section => ensureArray(section?.items));
}

function hasSourceExtractionBullet(candidate = {}) {
  return sourceExtractionItems(candidate).some(item => text(item?.text || item?.source_text));
}

function hasGenericCameraXFallbackMetadata(candidate = {}) {
  const value = text(candidate.behavior_change || candidate.behaviorChange || candidate.what_changed || candidate.summary);
  return /^CameraX(?:\s*\/\s*androidx\.camera)?\s+(?:update|updates|updated|release|released)(?:\.)?$/i.test(value) ||
    /Maven Group versions?|View the Camera Library|This library was last updated on:/i.test(value);
}

function cameraReleaseExtractionViolation(candidate = {}) {
  if (!cameraReleasePageCandidate(candidate)) return '';
  const quality = candidate.extraction_quality || candidate.source_extraction?.extraction_quality || {};
  if (quality.used_fallback === true) return 'source_extraction.used_fallback=true';
  if (quality.main_article_allowed === false) return 'source_extraction.main_article_allowed=false';
  if (!hasSourceExtractionBullet(candidate) && hasGenericCameraXFallbackMetadata(candidate)) {
    return 'CameraX release-note candidate has no concrete source_extraction bullet';
  }
  if (candidate.source_extraction && !hasSourceExtractionBullet(candidate)) {
    return 'source_extraction.release.sections has no concrete bullet';
  }
  return '';
}

function candidateMeetsBaseEligibility(candidate) {
  const finalEligibility = candidate.finalSelectionEligibility;
  return !cameraReleaseExtractionViolation(candidate) &&
    ['main', 'short'].includes(finalEligibility) &&
    candidate.source_gap_risk !== true &&
    candidate.main_eligible === true &&
    candidate.hasDatedEvidence === true &&
    candidate.reference_only !== true &&
    candidate.briefing_only !== true;
}

function candidateAllowed(candidate, { allowFallback = false } = {}) {
  if (!candidateMeetsBaseEligibility(candidate)) return false;
  const bucket = candidate.relevance_bucket;
  if (allowFallback) return FALLBACK_BUCKET_ORDER.includes(bucket);
  return NORMAL_BUCKET_ORDER.includes(bucket);
}

function candidateBaseEligibilityFailure(candidate) {
  const reasons = [];
  if (!['main', 'short'].includes(candidate.finalSelectionEligibility)) {
    reasons.push(`finalSelectionEligibility=${candidate.finalSelectionEligibility || 'missing'}`);
  }
  if (candidate.source_gap_risk === true) reasons.push('source_gap_risk=true');
  if (candidate.main_eligible !== true) reasons.push(`main_eligible=${String(candidate.main_eligible)}`);
  if (candidate.hasDatedEvidence !== true) reasons.push(`hasDatedEvidence=${String(candidate.hasDatedEvidence)}`);
  if (candidate.reference_only === true) reasons.push('reference_only=true');
  if (candidate.briefing_only === true) reasons.push('briefing_only=true');
  const extractionViolation = cameraReleaseExtractionViolation(candidate);
  if (extractionViolation) reasons.push(extractionViolation);
  return reasons.join('; ');
}

function candidateRejectionReason(candidate, sections, demotedSections, { allowFallback = false } = {}) {
  const baseEligibilityFailure = candidateBaseEligibilityFailure(candidate);
  if (baseEligibilityFailure) return baseEligibilityFailure;
  const order = allowFallback ? FALLBACK_BUCKET_ORDER : NORMAL_BUCKET_ORDER;
  if (!order.includes(candidate.relevance_bucket)) {
    return `relevance_bucket=${candidate.relevance_bucket || 'missing'} not allowed`;
  }
  const duplicateReason = sectionForCandidateAlreadyExists(candidate, sections, demotedSections);
  if (duplicateReason) return duplicateReason;
  return '';
}

function sortCandidates(candidates, { allowFallback = false } = {}) {
  const order = allowFallback ? FALLBACK_BUCKET_ORDER : NORMAL_BUCKET_ORDER;
  return [...candidates].sort((left, right) => {
    const leftBucket = order.indexOf(left.relevance_bucket);
    const rightBucket = order.indexOf(right.relevance_bucket);
    return (leftBucket === -1 ? 99 : leftBucket) - (rightBucket === -1 ? 99 : rightBucket) ||
      (left.finalSelectionEligibility === 'main' ? 0 : 1) - (right.finalSelectionEligibility === 'main' ? 0 : 1) ||
      right.score_total - left.score_total ||
      left._source_order - right._source_order ||
      left.title.localeCompare(right.title);
  });
}

function categoryForCandidate(candidate, fallback = false) {
  if (candidate.relevance_bucket === BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE) return 'Camera Driver / Image Pipeline';
  if (candidate.relevance_bucket === BUCKETS.DIRECT_AOSP_CAMERA) return 'AOSP Camera / Android Camera';
  if (candidate.relevance_bucket === BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT) return fallback ? 'Adjacent Watch / Android Camera' : 'Android Platform / CameraX';
  if (candidate.relevance_bucket === BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT) return fallback ? 'Adjacent Watch / Camera Output' : 'Camera Output / Multimedia Supporting';
  if (candidate.relevance_bucket === BUCKETS.SOC_PLATFORM_SIGNAL) return 'Adjacent Watch / SoC Platform';
  if (
    candidate.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK &&
    isSelectedNativeToolingCandidate(candidate)
  ) {
    return 'Android Native Tooling';
  }
  if (candidate.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) return 'Tooling Watch / Fallback';
  return fallback ? 'Adjacent Watch / Fallback' : 'Camera Platform Watch';
}

function headlineForCandidate(candidate, fallback = false) {
  const title = candidate.title;
  if (fallback || candidate.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK) {
    return `${categoryForCandidate(candidate, true)}: ${title}`;
  }
  if (/^(\d+\.)+\d+/.test(title) && /CameraX|androidx\.camera/i.test(text(candidate))) {
    return `CameraX ${title} 업데이트: Android Camera 호환성 관찰`;
  }
  return title;
}

function behaviorText(candidate) {
  return firstText(
    candidate.what_changed,
    candidate.behavior_change,
    candidate.behaviorChange,
    candidate.summary,
    candidate.reason,
    `${candidate.title} published by ${candidate.source}.`
  );
}

function componentText(candidate) {
  const body = [
    candidate.title,
    candidate.summary,
    candidate.behavior_change,
    candidate.url
  ].map(text).join(' ');
  if (/\bGlaze\b/i.test(body)) return 'Glaze / C++ serialization / C++26 reflection';
  if (/\bGCC\b/i.test(body)) return 'GCC';
  return firstText(candidate.source_extraction?.release?.component, candidate.component, candidate.api_or_component, candidate.apiOrComponent, candidate.source);
}

function sourceBehaviorSpecificityScore(value) {
  const body = text(value);
  if (!body) return Number.NEGATIVE_INFINITY;
  let score = 0;
  if (/ListenableFuture|Cannot access class/i.test(body)) score += 30;
  if (/\b(?:fix(?:ed|es)?|bug|error|compil(?:e|ation|er)?|crash|regression|support(?:ed)?|deprecat(?:e|ed|ion)|remove(?:d)?|add(?:ed)?|change(?:d)?|improv(?:e|ed)|vulnerability|CVE)\b|오류|컴파일|빌드|수정|개선/i.test(body)) {
    score += 8;
  }
  if (/"[^"]{4,}"|'[^']{4,}'|`[^`]{4,}`|androidx\.camera:[\w.-]+|[A-Z][A-Za-z0-9_]*(?:Future|Capture|Preview|Request|Result|Exception|Error)\b/.test(body)) {
    score += 6;
  }
  if (/\b(?:[A-Z][A-Za-z0-9_]*\.){1,}[A-Z][A-Za-z0-9_]*\b|\bI[0-9a-f]{6,}\b|#[0-9]{3,}|\b[0-9]+(?:\.[0-9]+){1,}\b/i.test(body)) {
    score += 2;
  }
  if (body.length >= 50) score += 2;
  if (body.length >= 120) score += 1;
  if (/^\s*(?:CameraX|androidx\.camera|Android|libcamera|GCC|Glaze)(?:\s*\/\s*[\w. -]+)?\s+(?:update|updates?|release notes?|release-note changes?|변경점|업데이트)\.?\s*$/i.test(body)) {
    score -= 20;
  } else if (/\b(?:update|updates?|release notes?|release-note changes?)\b|변경점|업데이트/i.test(body)) {
    score -= 3;
  }
  return score;
}

function sourceBehaviorText(candidate, section = {}) {
  const releaseItems = ensureArray(candidate?.source_extraction?.release?.sections)
    .flatMap(section => ensureArray(section?.items))
    .map(item => item?.source_text || item?.text)
    .filter(Boolean);
  const candidates = [
    section.what_changed,
    candidate.behavior_change,
    candidate.behaviorChange,
    candidate.summary,
    ...releaseItems,
    candidate.title
  ]
    .map((value, index) => ({
      value: text(value),
      index,
      score: sourceBehaviorSpecificityScore(value)
    }))
    .filter(item => item.value);
  if (candidates.length === 0) return '';
  const best = [...candidates].sort((left, right) =>
    right.score - left.score || left.index - right.index
  )[0];
  const first = candidates[0];
  if (first.index < best.index && first.score >= best.score - 2) return first.value;
  return best.value;
}

function releaseVersionText(candidate, fallback = '') {
  return firstText(
    candidate?.source_extraction?.release?.version,
    candidate.version_or_release,
    candidate.versionOrRelease,
    fallback
  );
}

function cameraXCandidateText(candidate, section = {}) {
  return [
    candidate.title,
    section.headline,
    candidate.url,
    candidate.summary,
    candidate.behavior_change,
    candidate.api_or_component,
    candidate.component,
    candidate?.source_extraction?.release?.component
  ].map(text).join(' ');
}

function isCameraXCandidate(candidate, section = {}) {
  return /CameraX|androidx\.camera/i.test(cameraXCandidateText(candidate, section));
}

function isListenableFutureCompileFix(value) {
  const body = text(value);
  return /ListenableFuture/i.test(body) && /compil|Cannot access class|빌드|컴파일/i.test(body);
}

function compactCameraXHeadline(candidate, section = {}) {
  if (!isCameraXCandidate(candidate, section)) return '';
  const version = releaseVersionText(candidate, text(candidate.title || section.headline)).replace(/^CameraX\s+/i, '');
  const behavior = sourceBehaviorText(candidate, section);
  const prefix = version ? `CameraX ${version}` : 'CameraX release note';
  if (isListenableFutureCompileFix(behavior)) {
    return `${prefix}: ListenableFuture 컴파일 오류 수정`;
  }
  if (/compil|빌드|compile|dependency|Gradle/i.test(behavior)) {
    return `${prefix}: 앱 빌드/의존성 수정 확인`;
  }
  if (/preview|capture|ImageCapture|VideoCapture|Preview/i.test(behavior)) {
    return `${prefix}: preview/capture 동작 변경 확인`;
  }
  return `${prefix}: release-note 변경점 확인`;
}

function normalizeHeadlineOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== 'object') return {};
  if (Array.isArray(overrides)) {
    return Object.fromEntries(overrides
      .map(item => [text(item.key || item.source_candidate_hash || item.source_url || item.url), text(item.headline)])
      .filter(([key, value]) => key && value));
  }
  return Object.fromEntries(Object.entries(overrides)
    .map(([key, value]) => [text(key), text(value?.headline || value)])
    .filter(([key, value]) => key && value));
}

function headlineOverrideForSection(section = {}, candidate = {}, overrides = {}) {
  const sources = ensureArray(section.sources);
  const keys = [
    section.source_candidate_hash,
    candidate.source_candidate_hash,
    section.source_candidate_url,
    candidate.url,
    candidate.source_url,
    sources[0]?.url,
    normalizeUrl(section.source_candidate_url),
    normalizeUrl(candidate.url),
    normalizeUrl(sources[0]?.url)
  ].map(text).filter(Boolean);
  for (const key of keys) {
    if (overrides[key]) return overrides[key];
  }
  return '';
}

function publicHeadlineForCandidate(candidate, headline, options = {}) {
  const override = text(options.headlineOverride);
  if (override) return override;
  const title = text(candidate.title || headline);
  if (/Building seamless Android experiences across devices/i.test(title)) {
    return 'Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트';
  }
  if (/Start building today|Google AI Studio/i.test(title)) {
    return 'Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인';
  }
  if (/\bGlaze\b/i.test(title)) return 'Glaze 7.2: C++26 Reflection 기반 직렬화 지원 확대';
  if (/\bGCC\s+16\.1\b/i.test(title)) return 'GCC 16.1 릴리스: C++20 기본값 전환과 C++26 기능 확장';
  if (/libcamera/i.test(title)) return 'libcamera v0.7.1 릴리스: SoftISP와 센서 모드 설정 업데이트';
  const cameraXHeadline = compactCameraXHeadline(candidate, { headline });
  if (cameraXHeadline) return cameraXHeadline;
  return title.replace(/^Tooling Watch \/ Fallback:\s*/i, '').replace(/\bFallback\b/gi, 'Watch').trim();
}

function longEnglishSourceText(value) {
  return /\b(?:[A-Za-z][A-Za-z0-9+/#.-]*[\s,;:()/-]+){14,}[A-Za-z][A-Za-z0-9+/#.-]*\b/.test(text(value));
}

function sourceFactTexts(candidate = {}, section = {}) {
  const bundle = candidate.source_fact_bundle || section.source_fact_bundle || buildArticleSourceFactBundle(candidate, [section]);
  const fromBundle = ensureArray(bundle?.facts).map(fact => text(fact?.text || fact));
  return unique([
    ...fromBundle,
    section.what_changed,
    candidate.behavior_change,
    candidate.behaviorChange,
    candidate.summary,
    ...ensureArray(candidate?.source_extraction?.evidence_blocks).map(block => text(block?.source_text || block?.text)),
    ...sourceExtractionItems(candidate).map(item => text(item?.source_text || item?.text))
  ])
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(value => value.length >= 20)
    .filter(value => !/source URL|published date|deterministic fallback|quality gate|fallback builder/i.test(value))
    .slice(0, 10);
}

const GENERIC_TERM_STOPWORDS = new Set([
  'Starting',
  'Today',
  'Build',
  'Start',
  'Android',
  'Android apps',
  'Android APIs',
  'APIs',
  'Android developers',
  'Personal',
  'Hardware',
  'Hardware-enabled',
  'AI-powered',
  'Official',
  'Source',
  'Posted',
  'Android Developers',
  'Google'
]);

function normalizeSourceTerm(value) {
  const term = text(value)
    .replace(/^the\s+/i, '')
    .replace(/^(?:for|to|with|using)\s+/i, '')
    .replace(/\s+using\b.*$/i, '')
    .replace(/\s+with\b.*$/i, '')
    .replace(/\s+integrations?$/i, '')
    .replace(/\s+support$/i, '')
    .replace(/[.;:]+$/g, '')
    .trim();
  if (!term || term.length < 3 || GENERIC_TERM_STOPWORDS.has(term)) return '';
  if (/^prompt$/i.test(term)) return '프롬프트 기반 생성';
  if (/^native Android(?: apps?)?$/i.test(term)) return 'native Android 앱';
  if (/^Camera$/i.test(term)) return 'Camera API';
  return term;
}

function technicalTermsFromText(value) {
  const body = text(value);
  const matches = [
    ...body.matchAll(/\bnative Android(?: apps?)?\b/gi),
    ...body.matchAll(/\b[A-Z][A-Za-z0-9+/#-]*(?:\s+[A-Z][A-Za-z0-9+/#-]*){0,3}\b/g),
    ...body.matchAll(/\b[A-Za-z]+[A-Z][A-Za-z0-9+/#-]*\b/g),
    ...body.matchAll(/\b[A-Z]{2,}(?:\/[A-Z][A-Za-z0-9+-]+)?\b/g),
    ...body.matchAll(/\b[a-z]+(?:-[a-z]+){1,3}\b/g)
  ];
  return matches.map(match => normalizeSourceTerm(match[0])).filter(Boolean);
}

function enumeratedTermsFromText(value) {
  const output = [];
  const body = text(value);
  const patterns = [
    /\b(?:include|includes|including|such as|can use|feature|features|support(?:s|ed)?|from just a)\s+([^.;]+)/gi,
    /(?:포함|지원|사용|예시로)\s*([^.;。]+)/g
  ];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) {
      const raw = text(match[1]).replace(/\busing\b.*$/i, '');
      for (const part of raw.split(/\s*,\s*|\s+and\s+|\s+or\s+|,\s*그리고\s*|그리고\s*/i)) {
        const term = normalizeSourceTerm(part);
        if (term) output.push(term);
      }
    }
  }
  return output;
}

function sourceTermsFromFacts(facts = []) {
  return unique(ensureArray(facts).flatMap(fact => [
    ...enumeratedTermsFromText(fact),
    ...technicalTermsFromText(fact)
  ])).slice(0, 12);
}

function koreanFactPhrase(value) {
  const fact = text(value);
  if (!fact) return '';
  if (/[가-힣]/.test(fact)) return fact.replace(/\.$/, '');
  const terms = sourceTermsFromFacts([fact]);
  if (terms.length > 0) return `${terms.slice(0, 5).join(', ')} 관련 내용`;
  const quoted = fact
    .replace(/^Posted by\b[^.]{0,180}\bStarting today\b/i, 'Starting today')
    .replace(/\s+/g, ' ')
    .trim();
  if (quoted.length <= 120 && !longEnglishSourceText(quoted)) return quoted.replace(/\.$/, '');
  return '';
}

function sourceFactBodyParagraphs(candidate = {}, section = {}, component = '') {
  const facts = sourceFactTexts(candidate, section);
  const terms = sourceTermsFromFacts(facts);
  if (facts.length < 2 && terms.length < 3) return [];

  const source = firstText(candidate.source, candidate.publisher, ensureArray(section.sources)[0]?.title, '공개 출처');
  const title = text(candidate.title || section.headline || component);
  const date = firstText(candidate.published_date, candidate.publishedAt, section.published_date);
  const datePhrase = date ? `${date}에 ` : '';
  const primaryFact = koreanFactPhrase(facts[0]) || `${component || title} 관련 업데이트`;
  const componentPhrase = component || firstText(candidate.api_or_component, candidate.component, section.category, title);
  const termChunks = [];
  for (let index = 0; index < terms.length; index += 6) {
    termChunks.push(terms.slice(index, index + 6));
  }
  const paragraphs = [
    `${source}는 ${datePhrase}${title} 내용을 공개했습니다. 원문에서 확인되는 핵심은 ${primaryFact}입니다.`
  ];

  if (termChunks[0]?.length > 0) {
    paragraphs.push(`원문은 ${termChunks[0].join(', ')}를 주요 구성 요소로 다룹니다. 이는 ${componentPhrase}의 지원 범위, 적용 예시, 개발 흐름을 이해하기 위한 정보입니다.`);
  }
  if (termChunks[1]?.length > 0) {
    paragraphs.push(`추가로 확인되는 항목은 ${termChunks[1].join(', ')}입니다. 이런 세부 내용은 독자가 원문 발표의 실제 범위를 파악하는 데 도움이 됩니다.`);
  }

  const remainingFact = facts.slice(1).map(koreanFactPhrase).find(value =>
    value && !paragraphs.some(paragraph => paragraph.includes(value))
  );
  if (remainingFact && paragraphs.length < 4) {
    paragraphs.push(`원문 세부 내용으로는 ${remainingFact}도 확인됩니다. 이 내용은 후속 검토에서 출처 범위를 확인할 때 기준점으로 사용할 수 있습니다.`);
  }

  return paragraphs
    .filter(Boolean)
    .filter(paragraph => !longEnglishSourceText(paragraph))
    .slice(0, 4);
}

function publicChangeSummary(candidate, section, component) {
  const title = text(candidate.title || section.headline);
  const change = text(sourceBehaviorText(candidate, section));
  if (/Building seamless Android experiences across devices/i.test(title) || /Jetpack Compose is the definitive engine/i.test(change)) {
    return 'Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.';
  }
  if (/Start building today|Google AI Studio/i.test(title) || /Hardware-enabled experiences/i.test(change)) {
    return 'Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android API 접근을 예로 들며 hardware-enabled app 구성을 설명했습니다.';
  }
  if (/libcamera/i.test(title)) {
    return 'libcamera v0.7.1은 SoftISP debayering, image pipeline throughput, pipeline handler camera support, sensor mode configuration 관련 업데이트를 포함합니다.';
  }
  if (isCameraXCandidate(candidate, section)) {
    const version = releaseVersionText(candidate, title);
    if (isListenableFutureCompileFix(change)) {
      return `${version}은 CameraX 1.6.0 사용 시 발생하던 "Cannot access class ListenableFuture" 컴파일 오류를 수정한 패치입니다.`;
    }
    return change;
  }
  if (longEnglishSourceText(change)) {
    return `${component || title} 관련 공개 출처가 공식 업데이트를 공지했습니다. 원문 세부 문장은 출처 링크에서 확인하고, 여기서는 Camera HAL / Driver / Native tooling 관점의 확인 범위만 요약합니다.`;
  }
  return change;
}

function publicLeadText(candidate, section, headline) {
  const component = componentText(candidate);
  const summary = publicChangeSummary(candidate, section, component);
  if (summary && !longEnglishSourceText(summary)) return summary;
  return `${headline}은 공개 출처가 확인한 범위 안에서 Camera HAL / Driver / Native tooling 독자가 참고할 만한 동향으로 정리했습니다.`;
}

function publicBodyParagraphs(candidate, section, component) {
  const title = text(candidate.title || section.headline);
  const change = publicChangeSummary(candidate, section, component);
  const factParagraphs = sourceFactBodyParagraphs(candidate, section, component);
  if (factParagraphs.length >= 3) return factParagraphs;
  if (/Building seamless Android experiences across devices/i.test(title) || /Jetpack Compose is the definitive engine/i.test(change)) {
    return [
      'Google Android Developers Blog는 여러 기기와 화면 크기에서 Jetpack Compose를 중심으로 Android UX를 맞추는 흐름을 설명하면서, window size에 맞는 camera preview를 위해 CameraX를 함께 언급했습니다.',
      '이 내용은 HAL API 변경 고지가 아니라 app/framework layer validation signal입니다. Camera HAL / Driver 팀은 preview aspect ratio, rotation, stream configuration, Surface 연결에서 회귀 테스트 범위를 잡는 참고로 쓰면 됩니다.'
    ];
  }
  if (/Start building today|Google AI Studio/i.test(title) || /Hardware-enabled experiences/i.test(change)) {
    return [
      'Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android APIs를 사용할 수 있다는 점을 예로 듭니다.',
      'Camera HAL runtime 변경 근거는 아니지만, AI Studio로 만든 sample이나 prototype이 실제 Camera API를 호출할 수 있으므로 preview/capture path, permission, device feature 의존성을 검토할 때 참고할 만합니다.'
    ];
  }
  if (/\bGlaze\b/i.test(title)) {
    return [
      'Glaze 7.2는 C++26 Reflection 기반 serialization 지원을 병합했고 YAML, CBOR, MessagePack, TOML 같은 format 지원도 함께 확장했습니다.',
      'Camera HAL runtime과 직접 연결되는 변화는 아닙니다. 다만 camera pipeline 설정, 실험 로그, tuning parameter, test artifact를 JSON/YAML/CBOR 형태로 다루는 내부 도구를 설계할 때 참고할 수 있는 native serialization 동향입니다.'
    ];
  }
  if (/\bGCC\s+16\.1\b/i.test(title)) {
    return [
      'GCC 16.1은 C++20 기본 표준 전환과 C++26 reflection/contracts 관련 기능 확장을 포함합니다.',
      'Camera HAL production build가 Clang 중심이라면 즉시 영향은 제한적입니다. 다만 host tool, 실험용 native utility, static analysis 환경에서 GCC를 병행 사용하는 팀이라면 build option이나 warning profile 변화는 확인할 만합니다.'
    ];
  }
  if (/libcamera/i.test(title)) {
    return [
      'libcamera v0.7.1이 공개되었습니다. 이번 릴리스에는 SoftISP debayering, image pipeline throughput, pipeline handler camera support, sensor mode configuration 관련 업데이트가 포함되었습니다.',
      'Android Camera HAL API 변경으로 직접 해석할 근거는 없습니다. 다만 V4L2 기반 camera pipeline, sensor mode 선택, format negotiation, frame timing 검증 관점에서는 참고할 만한 upstream signal입니다.'
    ];
  }
  if (isCameraXCandidate(candidate, section)) {
    const behavior = sourceBehaviorText(candidate, section);
    if (isListenableFutureCompileFix(behavior)) {
      return [
        `${releaseVersionText(candidate, title)}은 CameraX 1.6.0 사용 시 발생하던 "Cannot access class ListenableFuture" 컴파일 오류를 수정한 release note입니다. ListenableFuture는 CameraX와 Android app/API 코드에서 비동기 작업 결과를 전달할 때 쓰이는 future 타입이므로, 이번 항목은 preview/capture 동작 변경보다 앱 빌드와 의존성 접근 문제에 가깝습니다.`,
        'AOSP Camera HAL에는 직접 영향이 확인되지 않았습니다. CameraX 1.6.0을 쓰는 앱, sample, validation tool이 있다면 CameraX 1.6.1을 빌드 안정성 패치로 보고 Gradle dependency와 compile smoke test를 확인하는 것이 적절합니다.'
      ];
    }
    return [
      change,
      '이 CameraX release note는 app/framework 계층의 변경점으로 먼저 해석합니다. AOSP Camera HAL, vendor driver, metadata contract, stream/buffer runtime 영향은 source가 직접 말한 범위나 별도 검증 결과가 있을 때만 후속 항목으로 분리합니다.'
    ];
  }
  return [
    change,
    '이 항목은 공개 출처가 말한 범위 안에서 Camera HAL / Driver / Native tooling 독자가 참고할 수 있는 실무 맥락으로만 해석합니다.'
  ];
}

function publicCheckpointsForCandidate(candidate, section) {
  const title = text(candidate.title || section.headline);
  const behavior = sourceBehaviorText(candidate, section);
  const component = componentText(candidate) || 'Camera API/component';
  const bucket = text(candidate.relevance_bucket || section.relevance_bucket);
  if (/Building seamless Android experiences across devices/i.test(title)) {
    return [
      'CameraX preview가 다양한 화면 크기에서 aspect ratio와 rotation을 유지하는지 app/framework 레벨에서 확인합니다.',
      '이 소스는 HAL API 변경을 직접 언급하지 않으므로, HAL/driver 변경 신호가 아니라 preview layout 회귀 가능성으로만 해석합니다.'
    ];
  }
  if (/Start building today|Google AI Studio/i.test(title)) {
    return [
      'AI Studio가 만든 샘플 앱이 Camera API를 호출할 수 있으므로, prototype 단계에서 Camera 권한과 CameraX/Camera2 사용 방식을 확인합니다.',
      '이 소스는 HAL/driver 변경을 직접 언급하지 않으므로 vendor camera pipeline 영향으로 확대 해석하지 않습니다.'
    ];
  }
  if (/\bGlaze\b/i.test(title)) {
    return [
      'Glaze 적용 여부는 Camera HAL production path가 아니라 JSON/YAML/CBOR 로그 변환 도구 범위에서만 확인합니다.',
      'camera pipeline 설정이나 tuning parameter serialization 도구를 새로 만들 때 Glaze format 지원을 비교합니다.',
      'C++26 reflection은 production HAL runtime behavior 변경 근거로 확대 해석하지 않습니다.'
    ];
  }
  if (/\bGCC\s+16\.1\b/i.test(title)) {
    return [
      'Camera HAL 본체가 아니라 host/native tooling build log와 warning profile 범위에서만 참고합니다.',
      'GCC 기반 보조 도구가 있다면 C++20 default 전환 영향을 확인합니다.',
      'production HAL runtime behavior 변화로 해석하지 않습니다.'
    ];
  }
  if (/libcamera/i.test(title)) {
    return [
      'sensor mode selection 관련 내부 이슈와 연결 가능한지 확인합니다.',
      'frame timing / format negotiation regression test 필요 여부를 검토합니다.',
      'downstream Android HAL 영향은 별도 evidence가 있을 때만 판단합니다.'
    ];
  }
  if (isCameraXCandidate(candidate, section) && isListenableFutureCompileFix(behavior)) {
    return [
      'CameraX 1.6.0을 쓰는 앱, sample, validation tool이 있다면 1.6.1 적용 후 Gradle compile smoke test를 확인합니다.',
      '이 release note는 AOSP Camera HAL/runtime 변경을 직접 말하지 않으므로 preview/capture 동작 회귀나 vendor pipeline 영향과 분리해서 다룹니다.'
    ];
  }
  if (/android_platform_camera_adjacent|android_camera_api|android_camera|multimedia/i.test(bucket)) {
    return [
      'CameraX preview가 다양한 화면 크기에서 aspect ratio와 rotation을 유지하는지 app/framework 레벨에서 확인합니다.',
      '이 소스는 HAL API 변경을 직접 언급하지 않으므로, HAL/driver 변경 신호가 아니라 preview layout 회귀 가능성으로만 해석합니다.'
    ];
  }
  if (/cpp_ai_tooling|tooling/i.test(bucket)) {
    return [
      'native tooling이나 prototype 코드가 Camera API를 호출한다면, Camera 권한과 CameraX/Camera2 사용 방식만 확인합니다.',
      '이 소스는 production HAL runtime 변경을 직접 언급하지 않으므로 vendor camera pipeline 영향으로 확대 해석하지 않습니다.'
    ];
  }
  if (/direct|camera_driver|image_pipeline|direct_aosp_camera|camera_stack/i.test(bucket)) {
    return [
      `${component}가 request/result, stream configuration, buffer lifecycle 중 어떤 HAL 계약과 연결되는지 source 근거 안에서 확인합니다.`,
      'source가 직접 뒷받침하지 않는 driver branch, vendor tag, pipeline 변경 주장은 분리합니다.'
    ];
  }
  return [
    `${component}와 직접 연결된 공개 출처의 Camera API나 component 변화만 확인합니다.`,
    'HAL/driver 변경 근거가 없으면 request/result나 vendor tag 변화로 해석하지 않습니다.'
  ];
}

function publicTakeawayForCandidate(candidate, section, component) {
  const bucket = text(candidate.relevance_bucket || section.relevance_bucket);
  const impact = inferGuardrailImpactClass(candidate);
  const title = text(candidate.title || section.headline || component);
  const behavior = sourceBehaviorText(candidate, section);
  if (/direct|camera_stack/i.test(impact) || /direct|driver|image_pipeline/i.test(bucket)) {
    if (isCameraXCandidate(candidate, section) && isListenableFutureCompileFix(behavior)) {
      return 'AOSP Camera HAL에는 직접 영향이 확인되지 않았습니다. 이 항목은 CameraX 1.6.0 채택 앱이나 샘플, 검증 도구의 빌드 안정성 패치로 보는 것이 안전합니다. HAL/driver 영향은 별도 source evidence가 있을 때만 판단합니다.';
    }
    if (isCameraXCandidate(candidate, section)) {
      return '이 항목은 CameraX release note의 source-confirmed 변경점을 app/framework 계층에서 먼저 확인하는 항목입니다. HAL/driver 영향은 release note나 별도 검증이 직접 뒷받침할 때만 확장합니다.';
    }
    return `${title}은 공개 출처가 직접 말한 ${component || 'camera stack'} 변화 범위 안에서 HAL request/result, stream, buffer, metadata validation 영향을 확인할 후보입니다.`;
  }
  if (/Building seamless Android experiences across devices/i.test(title)) {
    return '이 소식은 HAL API 변경이 아니라, 다양한 화면 크기에서 CameraX preview가 어떻게 보이는지 확인하라는 app/framework 계층의 참고 신호입니다. HAL/driver 변경으로 해석하지 말고 preview aspect ratio, rotation, crop 동작의 앱 호환성만 확인하면 됩니다.';
  }
  if (/Start building today|Google AI Studio/i.test(title)) {
    return '이 소식은 Google AI Studio가 native Android 앱 prototype에서 Camera 같은 Android API를 사용할 수 있음을 보여주는 tooling 동향입니다. Camera HAL runtime 변경 근거는 아니며, 샘플 앱이 Camera 권한과 CameraX/Camera2 호출을 어떻게 구성하는지 참고하는 수준으로 제한해야 합니다.';
  }
  if (isCameraXCandidate(candidate, section) && isListenableFutureCompileFix(behavior)) {
    return 'AOSP Camera HAL에는 직접 영향이 확인되지 않았습니다. 이 항목은 CameraX 1.6.0 채택 앱이나 샘플, 검증 도구의 빌드 안정성 패치로 보는 것이 안전합니다. HAL/driver 영향은 별도 source evidence가 있을 때만 판단합니다.';
  }
  if (isCameraXCandidate(candidate, section)) {
    return '이 항목은 CameraX release note의 source-confirmed 변경점을 app/framework 계층에서 먼저 확인하는 항목입니다. HAL/driver 영향은 release note나 별도 검증이 직접 뒷받침할 때만 확장합니다.';
  }
  if (/android_platform|android_camera|multimedia|CameraX|Camera2/i.test(bucket)) {
    return '이 소식은 HAL API 변경이 아니라 app/framework 계층의 참고 신호입니다. HAL/driver 변경으로 해석하지 말고 CameraX/Camera2 preview와 capture path의 앱 호환성만 확인하면 됩니다.';
  }
  if (/soc_platform/i.test(bucket)) {
    return `${title}은 SoC/platform signal입니다. vendor BSP, ISP, driver branch, device matrix 영향은 별도 source evidence가 있을 때만 확인합니다.`;
  }
  if (/cpp_ai_tooling|tooling/i.test(bucket) || /tooling/i.test(impact)) {
    return '이 소식은 native tooling workflow 참고 항목입니다. production HAL runtime behavior 변경 근거는 아니며, prototype이 Camera API를 호출할 때 권한 선언과 CameraX/Camera2 사용 방식을 확인하는 수준으로 제한합니다.';
  }
  return `${title}은 공개 출처 범위 안의 watch signal입니다. HAL/driver 변경으로 확대 해석하지 않고 release note와 compatibility 확인 범위로 제한합니다.`;
}

function sourceSubtitleForCandidate(candidate, section) {
  return [
    firstText(candidate.source, candidate.publisher, ensureArray(section.sources)[0]?.title),
    firstText(candidate.version_or_release, candidate.versionOrRelease, candidate.published_date)
  ].filter(Boolean).join(' · ') || firstText(ensureArray(section.sources)[0]?.title, candidate.title, section.category);
}

function readerScenarioForCandidate(candidate, section, headline) {
  const title = text(candidate.title || headline);
  const behavior = sourceBehaviorText(candidate, section);
  if (/libcamera/i.test(title)) {
    return 'sensor mode 선택이나 frame timing 회귀를 조사할 때 upstream libcamera 변경점을 함께 확인합니다.';
  }
  if (/GCC|Glaze|AI Studio/i.test(title)) {
    return 'Camera HAL 본체가 아니라 host/native tooling이나 prototype 코드 검토 과정에서 build, logging, Camera API 사용 범위를 확인합니다.';
  }
  if (isCameraXCandidate(candidate, section) && isListenableFutureCompileFix(behavior)) {
    return 'CameraX 1.6.0을 채택한 앱, sample, validation tool에서 컴파일 오류가 재현되는지 triage할 때 확인합니다.';
  }
  if (/Compose|CameraX|Android/i.test(title)) {
    return '앱/framework 변경이 preview/capture 검증 범위에 들어오는지 triage할 때 확인합니다.';
  }
  return `${headline}을 Camera HAL / Driver / Native tooling 리뷰 범위에 넣을지 판단할 때 확인합니다.`;
}

function editorialStoryForCandidate(candidate, section, headline, component) {
  const change = publicChangeSummary(candidate, section, component);
  return {
    reader_scenario: readerScenarioForCandidate(candidate, section, headline),
    what_happened: change,
    why_it_matters: publicTakeawayForCandidate(candidate, section, component),
    field_scenario: publicCheckpointsForCandidate(candidate, section).join(' '),
    not_to_overclaim: ensureArray(section.do_not_overstate || section.hal_signal_capsule?.do_not_overstate).join(' ') ||
      'source가 직접 말하지 않는 HAL runtime, driver branch, vendor tag, pipeline 영향으로 확대하지 않습니다.',
    editor_take: `${headline}은 source 범위 안에서만 실무 확인 항목으로 다루는 것이 안전합니다.`
  };
}

function buildPublicArticle(section, candidate = {}, options = {}) {
  const component = componentText(candidate);
  const headline = publicHeadlineForCandidate(candidate, section.headline, {
    headlineOverride: options.headlineOverride
  });
  return {
    story_contract_version: 1,
    headline,
    source_subtitle: sourceSubtitleForCandidate(candidate, section),
    lead: publicLeadText(candidate, section, headline),
    body_paragraphs: publicBodyParagraphs(candidate, section, component),
    camera_hal_takeaway: publicTakeawayForCandidate(candidate, section, component),
    reader_checkpoints: publicCheckpointsForCandidate(candidate, section),
    editorial_story: editorialStoryForCandidate(candidate, section, headline, component),
    decision_metadata: deriveDecisionMetadata(section, {
      public_contract_version: 'story-v1',
      generation_contract_version: 1,
      publication_mode: 'fallback_public'
    }),
    source_links: ensureArray(section.sources).map(source => ({
      title: text(source.title || candidate.title || headline),
      url: text(source.url || candidate.url),
      publisher: text(candidate.source || candidate.publisher || ''),
      source_role: 'primary'
    })).filter(source => source.title && /^https?:\/\//i.test(source.url))
  };
}

function buildSectionFromCandidate(candidate, { fallback = false, backgroundContext = null } = {}) {
  const category = categoryForCandidate(candidate, fallback);
  const headline = headlineForCandidate(candidate, fallback);
  const source = {
    title: candidate.title,
    url: candidate.url
  };
  const cleaned = cleanBehaviorChange(candidate);
  const guardrailImpactClass = inferGuardrailImpactClass(candidate);
  const background = firstText(
    backgroundContext?.background_context,
    backgroundContext?.background,
    buildStaticBackgroundContext({ ...candidate, guardrail_impact_class: guardrailImpactClass })
  );
  const halPerspective = buildHalPerspective({ ...candidate, guardrail_impact_class: guardrailImpactClass });
  const guardrails = buildOverclaimGuardrails({ ...candidate, guardrail_impact_class: guardrailImpactClass });
  const fieldWarnings = unique([
    ...ensureArray(cleaned.warnings),
    ...findFieldHygieneIssues({
      what_changed: cleaned.text,
      background,
      camera_hal_perspective: halPerspective,
      guardrail_impact_class: guardrailImpactClass
    }).map(item => item.type)
  ]);
  const section = {
    category,
    headline,
    confirmed_facts: buildConfirmedFacts(candidate),
    evidence_summary: `${candidate.source} source metadata와 날짜가 확인된 candidate evidence를 deterministic fallback builder가 사용했습니다.`,
    specificity_checks: [
      `finalSelectionEligibility=${candidate.finalSelectionEligibility}`,
      `relevance_bucket=${candidate.relevance_bucket}`,
      `source_gap_risk=${String(candidate.source_gap_risk)}`
    ],
    source_verification_notes: [
      '확인한 사실에는 source URL, date, component, version, 정제된 behavior metadata만 사용했습니다.',
      fallback ? 'Source evidence가 더 강한 claim을 뒷받침하기 전까지 이 fallback article은 watch/supporting lane에 둡니다.' : 'Fallback reconstruction 전에 main-candidate eligibility check를 통과한 항목입니다.',
      ...guardrails
    ],
    what_changed: cleaned.text,
    background,
    camera_hal_perspective: halPerspective,
    camera_hal_checks: [
      fallback ? '직접 camera-stack evidence가 없으면 watch/supporting material로만 표현합니다.' : 'Source evidence가 Camera HAL, Camera2, CameraX, driver, image pipeline, stream, buffer, metadata behavior를 실제로 말하는지 확인합니다.',
      'Source evidence가 뒷받침할 때만 CTS/VTS, Camera ITS, request/result, stream, buffer, metadata follow-up으로 승격합니다.'
    ],
    action_items: [
      '발행 전에 source URL과 published date가 article text와 맞는지 확인합니다.',
      fallback ? '직접 HAL behavior claim이 아니라 watch/supporting context로 공유합니다.' : '관련 camera stack owner가 follow-up validation 필요 여부를 확인합니다.',
      'Upstream release note나 downstream evidence가 더 구체적인 impact를 제공하면 다음 issue에서 재평가합니다.'
    ],
    action_hints: [],
    team_summary: fallback
      ? `${headline}은 정상 발행 범위가 부족했거나 원래 section repair가 필요해 watch/supporting context로 재구성했습니다.`
      : `${headline}은 deterministic reconstruction 이후 public issue에 남길 수 있는 source-bound camera-stack metadata를 갖춘 항목입니다.`,
    why_it_matters: halPerspective,
    is_ai_related: /\b(?:AI|LLM|agent|NPU|on-device|inference|model)\b/i.test([
      candidate.title,
      candidate.summary,
      candidate.behavior_change,
      candidate.component,
      candidate.api_or_component,
      candidate.relevance_reason
    ].map(text).join(' ')),
    article_type: candidate.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK ? 'tooling-watch' : 'camera-hal',
    overclaim_guardrails: guardrails,
    field_builder_warnings: fieldWarnings,
    removed_source_fragments: ensureArray(cleaned.removed_fragments),
    source_extraction: candidate.source_extraction || null,
    source_fact_bundle: candidate.source_fact_bundle || buildArticleSourceFactBundle(candidate, [candidate]),
    derived_editorial_hints: candidate.derived_editorial_hints || null,
    extraction_quality: candidate.extraction_quality || candidate.source_extraction?.extraction_quality || null,
    background_basis: backgroundContext
      ? firstText(backgroundContext.background_basis, 'background-context.json')
      : 'article-field-builder deterministic static background',
    source_candidate_url: candidate.source_candidate_url || candidate.url,
    source_candidate_hash: candidate.source_candidate_hash || normalizedHash(candidate.url),
    relevance_bucket: candidate.relevance_bucket,
    editorial_priority: candidate.editorial_priority,
    aosp_camera_directness: candidate.aosp_camera_directness,
    driver_stack_relevance: candidate.driver_stack_relevance,
    soc_platform_relevance: candidate.soc_platform_relevance,
    native_tooling_relevance: candidate.native_tooling_relevance,
    counts_as_primary_camera_topic: Boolean(candidate.counts_as_primary_camera_topic),
    counts_as_driver_topic: Boolean(candidate.counts_as_driver_topic),
    counts_as_soc_topic: Boolean(candidate.counts_as_soc_topic),
    counts_as_fallback_topic: Boolean(candidate.counts_as_fallback_topic),
    evidence_origin: candidate.evidence_origin || 'candidate_metadata',
    source_hint: candidate.source_hint || '',
    sources: [source],
    imageCandidates: ensureArray(candidate.imageCandidates),
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: 'Fallback builder가 외부 기사 이미지를 선택하지 않았으므로 renderer는 local fallback visual을 사용합니다.'
  };
  section.article_sections = {
    verified_facts: section.confirmed_facts,
    background_context: section.background,
    hal_driver_impact: section.camera_hal_perspective,
    action_items: section.action_items,
    team_share_points: section.team_summary
  };
  section.public_article = buildPublicArticle(section, candidate);
  applyDeterministicImageSelection(section);
  return completeHalSignalSection(section, candidate);
}
function hardFailureArticleIndexes(qualityReport, factCheck) {
  const indexes = new Set();
  for (const result of ensureArray(qualityReport?.article_results)) {
    if (fallbackArticleAction(result, factCheck) === 'replace-or-demote') {
      indexes.add(Number(result.index) - 1);
    }
  }
  return indexes;
}

function preservedArticleIndexes(qualityReport) {
  const indexes = new Set();
  for (const result of ensureArray(qualityReport?.article_results)) {
    if (result.status === 'PASS' && result.repair_action === 'preserve') {
      indexes.add(Number(result.index) - 1);
    }
  }
  return indexes;
}

function sourceUrlsForPreserveCheck(section) {
  return sectionUrls(section);
}

function preserveSnapshot(section) {
  const snapshot = {};
  for (const field of REQUIRED_PRESERVE_FIELDS) {
    snapshot[field] = cloneJson(section?.[field]);
  }
  snapshot.source_urls = sourceUrlsForPreserveCheck(section);
  return snapshot;
}

function assertPreservedFields(before, after, label) {
  for (const field of REQUIRED_PRESERVE_FIELDS) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after?.[field])) {
      throw new Error(`Fallback builder changed PASS/preserve article field ${field}: ${label}`);
    }
  }
  if (JSON.stringify(before.source_urls) !== JSON.stringify(sourceUrlsForPreserveCheck(after))) {
    throw new Error(`Fallback builder changed PASS/preserve article source URL: ${label}`);
  }
}

function sectionForCandidateAlreadyExists(candidate, sections, demotedSections) {
  return sectionDuplicateReason(candidate, sections) || sectionDuplicateReason(candidate, demotedSections);
}

function sourceGapMentionsResult(result, factCheck) {
  const labels = ensureArray(factCheck?.source_gaps).map(text).join('\n');
  if (!labels) return false;
  const needles = [
    result?.headline,
    result?.scope_count?.source_candidate_url,
    ...ensureArray(result?.sources).flatMap(source => [source?.title, source?.url])
  ].filter(Boolean);
  return needles.some(needle => labels.includes(needle) || labels.includes(normalizeUrl(needle)));
}

function fallbackArticleAction(result = {}, factCheck = {}) {
  const repairAction = String(result.repair_action || '');
  const status = String(result.status || '');
  const hardReasons = ensureArray(result.hard_fail_reasons).join(' ');
  const scope = result.scope_count || {};
  const bucket = scope.relevance_bucket || result.relevance_bucket || '';
  if (status === 'PASS' && repairAction === 'preserve') return 'preserve';
  if (scope.publishable_scope === false) return 'replace-or-demote';
  if (repairAction === 'replace-or-demote') return 'replace-or-demote';
  if (/source-integrity|source gap|scope-relevance|hal-relevance/i.test(hardReasons)) return 'replace-or-demote';
  if (sourceGapMentionsResult(result, factCheck)) return 'replace-or-demote';
  if (bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK || scope.counts_as_fallback_topic === true) {
    return 'demote-to-watch';
  }
  if (status === 'FAIL' || repairAction === 'repair-section') return 'rebuild-from-bound-candidate';
  return 'preserve';
}

function findCandidateForSection(candidates, section, qualityItem = {}) {
  const hashes = [
    section?.source_candidate_hash,
    qualityItem?.source_candidate_hash,
    qualityItem?.scope_count?.source_candidate_hash
  ].filter(Boolean);
  const urls = [
    section?.source_candidate_url,
    qualityItem?.source_candidate_url,
    qualityItem?.scope_count?.source_candidate_url,
    ...ensureArray(section?.sources).map(source => source?.url),
    ...ensureArray(qualityItem?.sources).map(source => source?.url)
  ].map(normalizeUrl).filter(Boolean);

  return candidates.find(candidate => hashes.includes(candidate.source_candidate_hash)) ||
    candidates.find(candidate => urls.includes(normalizeUrl(candidate.url)));
}

function recordRejectedCandidate(target, candidate, reason, allowFallback) {
  target.push({
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    relevance_bucket: candidate.relevance_bucket,
    allow_fallback: Boolean(allowFallback),
    reason
  });
}

function selectCandidate(candidates, sections, demotedSections, { allowFallback = false, rejectedCandidates = null } = {}) {
  const sorted = sortCandidates(candidates, { allowFallback });
  for (const candidate of sorted) {
    const rejectionReason = candidateRejectionReason(candidate, sections, demotedSections, { allowFallback });
    if (rejectionReason) {
      if (rejectedCandidates) recordRejectedCandidate(rejectedCandidates, candidate, rejectionReason, allowFallback);
      continue;
    }
    return candidate;
  }
  return null;
}

function isSelectedNativeToolingCandidate(candidate = {}) {
  const role = text(candidate._artifact_role);
  if (role !== 'selected') return false;
  if (candidate.relevance_bucket !== BUCKETS.CPP_AI_TOOLING_FALLBACK) return false;
  return text(candidate.tooling_workflow_type) === 'native_tooling_workflow' ||
    text(candidate.toolingWorkflowType) === 'native_tooling_workflow' ||
    text(candidate.article_group_key || candidate.articleGroupKey) === 'android_native_tooling_workflow';
}

function supportingSectionCount(sections = []) {
  return ensureArray(sections)
    .filter(section => articlePolicy.supportingMainBuckets.includes(text(section.relevance_bucket)))
    .length;
}

function appendSelectedNativeToolingSections({
  candidates = [],
  selectedSections = [],
  demotedRecords = [],
  fallbackRecords = [],
  rejectedCandidates = [],
  backgroundContextIndex = new Map()
} = {}) {
  const output = selectedSections;
  const maxSupporting = Number(articlePolicy.publishReadyComposition?.supportingMainMaxAllowed ?? 0);
  if (maxSupporting <= 0) return output;
  for (const candidate of sortCandidates(candidates.filter(isSelectedNativeToolingCandidate), { allowFallback: true })) {
    if (output.length >= articlePolicy.mainArticleCount.max) break;
    if (supportingSectionCount(output) >= maxSupporting) break;
    const rejectionReason = candidateRejectionReason(candidate, output, demotedRecords, { allowFallback: true });
    if (rejectionReason) {
      recordRejectedCandidate(rejectedCandidates, candidate, rejectionReason, true);
      continue;
    }
    const section = buildSectionFromCandidate(candidate, {
      fallback: false,
      backgroundContext: backgroundContextForCandidate(backgroundContextIndex, candidate)
    });
    output.push(section);
    fallbackRecords.push({
      headline: section.headline,
      category: section.category,
      url: candidate.url,
      source: candidate.source,
      relevance_bucket: candidate.relevance_bucket,
      action: 'selected-native-tooling-supporting',
      fallback: false,
      reason: 'selected source-ready native tooling supporting article'
    });
  }
  return output;
}

function writeFallbackDiagnostics(newsroomDir, payload) {
  writeJson(path.join(newsroomDir, 'fallback-public-issue-diagnostics.json'), payload);
}

function updateNewsletterData(root, date, issue) {
  const dataPath = path.join(root, 'data', 'newsletters.json');
  const current = fs.existsSync(dataPath) ? readJson(dataPath) : [];
  const entry = {
    date,
    title: issue.title,
    summary: issue.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: issueTags(issue),
    publication_mode: issue.publication_mode || 'review_only',
    homepage_visibility: issue.homepage_visibility || 'normal',
    fallback_only: issue.fallback_only === true,
    camera_anchor_count: Number.isFinite(Number(issue.camera_anchor_count)) ? Number(issue.camera_anchor_count) : 0,
    ...(issue.homepage_badge ? { homepage_badge: issue.homepage_badge } : {})
  };
  const next = ensureArray(current)
    .filter(item => item?.date !== date)
    .concat(entry)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
  writeJson(dataPath, next);
}

function baseDraftCandidates(root, date) {
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const candidates = [];
  const editor = readJsonIfExists(path.join(newsroomDir, 'editor-draft.json'));
  if (editor && ensureArray(editor.sections).length > 0) candidates.push({ source: 'editor-draft.json', draft: editor });
  const repairFiles = fs.existsSync(newsroomDir)
    ? fs.readdirSync(newsroomDir)
      .filter(name => /^editor-repair-attempt-\d+\.json$/.test(name))
      .sort()
      .reverse()
    : [];
  for (const file of repairFiles) {
    const draft = readJsonIfExists(path.join(newsroomDir, file));
    if (draft && ensureArray(draft.sections).length > 0) candidates.push({ source: file, draft });
  }
  for (const file of ['editor-draft-attempt-1.json', 'editor-draft-attempt-2.json']) {
    const draft = readJsonIfExists(path.join(newsroomDir, file));
    if (draft && ensureArray(draft.sections).length > 0) candidates.push({ source: file, draft });
  }
  return candidates;
}

function defaultIssue(date) {
  return {
    date,
    public_contract_version: 'story-v1',
    generation_contract_version: 1,
    title: `AOSP Camera / Driver / SoC Platform 뉴스레터 - ${date}`,
    summary: '이번 호는 deterministic fallback public issue builder가 공식 source 기반 후보만 사용해 구성했습니다.',
    briefing: [
      '공식 source 기반 후보를 우선 검토했습니다.',
      'hard failure article은 main article에서 제거하거나 watch 성격으로 강등했습니다.',
      'fallback article은 HAL 직접 변경이 아니라 관찰 항목으로 표시했습니다.'
    ],
    sections: [],
    action_items: [
      '편집장은 fallback article 표현이 HAL 직접 변경으로 과장되지 않았는지 확인합니다.',
      'source URL과 published date가 기사 본문과 일치하는지 확인합니다.',
      '후속 release note가 나오면 다음 호에서 재평가합니다.'
    ],
    references: []
  };
}

function issueSummary(date, sections, fallbackCount, demotedCount) {
  const topics = sections.slice(0, 3).map(section => section.headline || section.category).filter(Boolean).join(', ');
  const fallbackText = fallbackCount > 0
    ? ` 정상 후보가 부족한 영역은 ${fallbackCount}개의 Fallback/Watch 기사로 채웠고 HAL 직접 변경으로 표현하지 않았습니다.`
    : '';
  const demotedText = demotedCount > 0
    ? ` hard failure article ${demotedCount}개는 main article에서 제거하거나 강등했습니다.`
    : '';
  return `이번 ${date}호는 ${topics || '공식 camera source 후보'}를 중심으로 구성했습니다.${fallbackText}${demotedText}`;
}

function publicIssueSummary(date, sections) {
  const topics = sections
    .slice(0, 3)
    .map(section => section.public_article?.headline || section.headline || section.category)
    .filter(Boolean)
    .join(', ');
  if (!topics) {
    return `이번 ${date}호는 Camera HAL / Driver / Native tooling 독자가 확인할 만한 공개 camera source 소식을 정리했습니다.`;
  }
  return `이번 ${date}호는 Camera HAL / Driver / Native tooling 독자가 확인할 만한 세 가지 항목을 정리했습니다: ${topics}.`;
}

function publicBriefingBullets(sections) {
  const bullets = sections
    .slice(0, 3)
    .map(section => section.public_article?.lead || `${section.public_article?.headline || section.headline || section.category} 관련 소식을 확인했습니다.`)
    .filter(Boolean);
  while (bullets.length < 3) {
    bullets.push('직접 HAL 변경 근거가 없는 항목은 참고 동향으로만 공유합니다.');
  }
  return bullets.slice(0, 3);
}

function ensureThreeBriefingBullets(issue, fallbackCount, demotedRecords) {
  const bullets = ensureArray(issue.briefing)
    .filter(Boolean)
    .filter(item => !mentionsDemotedRecord(item, demotedRecords));
  while (bullets.length < 3) {
    if (bullets.length === 0) bullets.push('공식 source 기반 camera 후보를 우선 유지했습니다.');
    else if (bullets.length === 1) bullets.push('hard failure article은 main article에서 제거하거나 강등했습니다.');
    else bullets.push(fallbackCount > 0 ? '부족한 article slot은 Fallback/Watch 표현으로 채웠습니다.' : '편집장은 source와 article 표현을 최종 확인합니다.');
  }
  return bullets.slice(0, 3);
}

function uniqueReferences(sections, demotedRecords) {
  const references = [];
  const seen = new Set();
  for (const source of [
    ...sections.flatMap(section => ensureArray(section.sources)),
    ...demotedRecords.flatMap(record => ensureArray(record.sources))
  ]) {
    const url = normalizeUrl(source?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    references.push({ title: source.title || source.url, url: source.url });
  }
  return references;
}

function demotedNeedles(record) {
  const values = [
    record?.headline,
    record?.title,
    ...ensureArray(record?.sources).flatMap(source => [source?.title, source?.url])
  ];
  return values
    .map(normalizedTitle)
    .filter(Boolean)
    .flatMap(value => {
      const tokens = value.split(' ').filter(Boolean);
      return [
        value,
        tokens.slice(0, 3).join(' '),
        tokens.slice(0, 2).join(' ')
      ].filter(item => item.length >= 5);
    });
}

function mentionsDemotedRecord(value, demotedRecords) {
  const normalized = normalizedTitle(value);
  if (!normalized) return false;
  return ensureArray(demotedRecords).some(record =>
    demotedNeedles(record).some(needle => normalized.includes(needle))
  );
}

function fallbackActionItems(issue, fallbackCount, demotedRecords) {
  const items = ensureArray(issue.action_items)
    .filter(item => !mentionsDemotedRecord(item, demotedRecords))
    .filter(item => !(fallbackCount > 0 && /C\+\+26|reflection|Clang|LLVM|ASan|UBSan|toolchain|camera_metadata_t/i.test(String(item))));
  if (fallbackCount > 0 && !items.some(item => /Fallback|Watch|관찰/.test(String(item)))) {
    items.push('Fallback/Watch article은 HAL 직접 변경 claim 없이 관찰 항목으로 유지하고 후속 upstream evidence가 나올 때 재평가합니다.');
  }
  if (items.length > 0) return items;
  return [
    'Fallback/Watch article이 HAL 직접 변경처럼 표현되지 않았는지 확인합니다.',
    '각 source URL과 published date가 article evidence와 일치하는지 확인합니다.',
    fallbackCount > 0
      ? 'Fallback article은 관찰 항목으로 유지하고 후속 upstream evidence가 나올 때 재평가합니다.'
      : '후속 upstream evidence가 나오면 다음 호에서 재평가합니다.'
  ];
}

function buildFallbackPublicIssue(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date;
  if (!date) throw new Error('Fallback public issue builder requires date.');
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const newsletterDir = path.join(root, 'newsletters', date);
  fs.mkdirSync(newsroomDir, { recursive: true });
  fs.mkdirSync(newsletterDir, { recursive: true });

  const qualityReport = options.qualityReport || readJsonIfExists(path.join(newsroomDir, 'quality-report.json')) || {};
  const factCheck = options.factCheck || readJsonIfExists(path.join(newsroomDir, 'fact-check-report.json')) || {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: 'Fallback public issue builder created a structurally publishable editor-review issue.'
  };
  const reporter = readJsonIfExists(path.join(newsroomDir, 'reporter-candidates.json')) || { date, candidates: [] };
  const shortlist = readJsonIfExists(path.join(newsroomDir, 'shortlisted-candidates.json')) || {};
  const backgroundContextReport = options.backgroundContextReport ||
    readJsonIfExists(path.join(newsroomDir, 'background-context.json')) || {};
  const backgroundContextIndex = buildBackgroundContextIndex(backgroundContextReport);
  const publicArticleHeadlineOverrides = normalizeHeadlineOverrides(
    options.publicArticleHeadlineOverrides || options.headlineOverrides
  );
  const headlineGeneration = options.publicArticleHeadlineGeneration || null;
  const generationStatus = readJsonIfExists(path.join(newsroomDir, 'generation-status.json')) ||
    readJsonIfExists(path.join(root, '.tmp', 'newsletter-generation-status.json')) || {};
  const originalFactCheck = originalFactCheckDiagnostics(factCheck, generationStatus, qualityReport);
  const baseCandidate = options.baseDraft
    ? { source: options.baseDraftSource || 'options.baseDraft', draft: options.baseDraft }
    : baseDraftCandidates(root, date)[0];
  const base = baseCandidate?.draft || defaultIssue(date);
  const issue = {
    ...defaultIssue(date),
    ...cloneJson(base),
    date,
    sections: ensureArray(base.sections).map(cloneJson)
  };
  issue.public_contract_version = 'story-v1';
  issue.generation_contract_version = 1;

  const candidates = candidatePoolFromArtifacts({ root, date });
  const preserveIndexes = preservedArticleIndexes(qualityReport);
  const preserveSnapshots = new Map();
  for (const index of preserveIndexes) {
    if (issue.sections[index]) {
      preserveSnapshots.set(index, preserveSnapshot(issue.sections[index]));
    }
  }
  const demotedRecords = [];
  const preservedSections = [];
  const fallbackRecords = [];
  const rejectedCandidates = [];
  const priorDemotedRecords = ensureArray(qualityReport.demoted_articles);
  const priorFallbackRecords = ensureArray(qualityReport.fallback_articles);
  for (const [index, section] of issue.sections.entries()) {
    const qualityItem = ensureArray(qualityReport.article_results).find(item => Number(item.index) - 1 === index) || {};
    const action = fallbackArticleAction(qualityItem, factCheck);
    if (action === 'replace-or-demote') {
      demotedRecords.push({
        headline: section.headline || qualityItem.headline || `article ${index + 1}`,
        category: section.category || qualityItem.category || '',
        action,
        reason: ensureArray(qualityItem.hard_fail_reasons).join('; ') || qualityItem.repair_action || 'hard failure article',
        sources: ensureArray(section.sources)
      });
      continue;
    }
    if (action === 'rebuild-from-bound-candidate' || action === 'demote-to-watch') {
      const candidate = findCandidateForSection(candidates, section, qualityItem);
      const fallback = action === 'demote-to-watch' || candidate?.relevance_bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK;
      const rejectionReason = candidate
        ? candidateRejectionReason(candidate, preservedSections, demotedRecords, { allowFallback: fallback })
        : 'bound_candidate_not_found';
      if (!candidate || rejectionReason) {
        demotedRecords.push({
          headline: section.headline || qualityItem.headline || `article ${index + 1}`,
          category: section.category || qualityItem.category || '',
          action: 'replace-or-demote',
          original_action: action,
          reason: rejectionReason || 'bound candidate could not be reused safely',
          sources: ensureArray(section.sources)
        });
        if (candidate) recordRejectedCandidate(rejectedCandidates, candidate, rejectionReason, fallback);
        continue;
      }
      const rebuiltSection = buildSectionFromCandidate(candidate, {
        fallback,
        backgroundContext: backgroundContextForCandidate(backgroundContextIndex, candidate)
      });
      preservedSections.push(rebuiltSection);
      fallbackRecords.push({
        headline: rebuiltSection.headline,
        category: rebuiltSection.category,
        url: candidate.url,
        source: candidate.source,
        relevance_bucket: candidate.relevance_bucket,
        action,
        fallback,
        reason: action
      });
      continue;
    }
    preservedSections.push(section);
  }
  if (preservedSections.length < preserveSnapshots.size) {
    throw new Error('Fallback builder removed a PASS/preserve article.');
  }

  const selectedSections = [...preservedSections];
  while (selectedSections.length < articlePolicy.mainArticleCount.min) {
    let candidate = selectCandidate(candidates, selectedSections, demotedRecords, {
      allowFallback: false,
      rejectedCandidates
    });
    let fallback = false;
    if (!candidate) {
      candidate = selectCandidate(candidates, selectedSections, demotedRecords, {
        allowFallback: true,
        rejectedCandidates
      });
      fallback = true;
    }
    if (!candidate) {
      const message = `Fallback builder could not fill minimum main article count ${articlePolicy.mainArticleCount.min}; only ${selectedSections.length} article(s) available.`;
      writeFallbackDiagnostics(newsroomDir, {
        date,
        generated_at: new Date().toISOString(),
        status: 'FAILED',
        failure_reason: message,
        fallback_public_issue_status: 'FAILED',
        ...originalFactCheck,
        fallback_public_issue_removed_blockers: demotedRecords.length > 0,
        fallback_public_issue_removed_article_count: demotedRecords.length,
        base_draft_source: baseCandidate?.source || 'default-issue',
        preserve_article_count: preserveSnapshots.size,
        final_article_count: selectedSections.length,
        demoted_articles: demotedRecords,
        fallback_articles: fallbackRecords,
        rejected_candidates: rejectedCandidates
      });
      throw new Error(message);
    }
    const section = buildSectionFromCandidate(candidate, {
      fallback,
      backgroundContext: backgroundContextForCandidate(backgroundContextIndex, candidate)
    });
    selectedSections.push(section);
    fallbackRecords.push({
      headline: section.headline,
      category: section.category,
      url: candidate.url,
      source: candidate.source,
      relevance_bucket: candidate.relevance_bucket,
      action: fallback ? 'demote-to-watch' : 'rebuild-from-bound-candidate',
      fallback,
      reason: fallback ? 'minimum article count fallback fill' : 'hard failure replacement'
    });
  }
  appendSelectedNativeToolingSections({
    candidates,
    selectedSections,
    demotedRecords,
    fallbackRecords,
    rejectedCandidates,
    backgroundContextIndex
  });
  issue.sections = selectedSections
    .slice(0, articlePolicy.mainArticleCount.max)
    .map(section => {
      const candidate = findCandidateForSection(candidates, section, {}) || {};
      const completed = completeHalSignalSection(section, candidate);
      completed.public_article = buildPublicArticle(completed, candidate, {
        headlineOverride: headlineOverrideForSection(completed, candidate, publicArticleHeadlineOverrides)
      });
      return completed;
    });
  const reportedDemotedRecords = demotedRecords.length > 0 ? demotedRecords : priorDemotedRecords;
  const reportedFallbackRecords = fallbackRecords.length > 0 ? fallbackRecords : priorFallbackRecords;
  const reportedRemovedArticleCount = demotedRecords.length > 0
    ? demotedRecords.length
    : numeric(
      qualityReport.fallback_public_issue_removed_article_count ??
      generationStatus.fallback_public_issue_removed_article_count
    ) ?? reportedDemotedRecords.length;
  const reportedRemovedBlockers = demotedRecords.length > 0 ||
    qualityReport.fallback_public_issue_removed_blockers === true ||
    qualityReport.fallback_public_issue_removed_blockers === 'true' ||
    generationStatus.fallback_public_issue_removed_blockers === true ||
    generationStatus.fallback_public_issue_removed_blockers === 'true' ||
    reportedRemovedArticleCount > 0;
  const reportedFallbackCount = fallbackRecords.length > 0
    ? fallbackRecords.filter(item => item.fallback).length
    : reportedFallbackRecords.filter(item => item.fallback).length;

  for (const [index, snapshot] of preserveSnapshots.entries()) {
    const beforeSection = base.sections[index];
    const afterSection = issue.sections.find(section =>
      section.source_candidate_hash &&
      section.source_candidate_hash === beforeSection?.source_candidate_hash
    ) || issue.sections.find(section =>
      sectionUrls(section).some(url => sectionUrls(beforeSection).includes(url))
    );
    assertPreservedFields(snapshot, afterSection, beforeSection?.headline || `article ${index + 1}`);
  }

  const publicationDecision = publicationDecisionForSections(issue.sections, {
    publicNewsletterReady: true,
    finalPublishReady: false,
    reviewPublicationReady: true
  });
  applyPublicationDecision(issue, publicationDecision);
  const basePublicSummary = publicIssueSummary(date, issue.sections);
  issue.summary = publicationDecision.fallback_only
    ? `Tooling Watch Edition: C++ / Tooling Watch - ${basePublicSummary}`
    : basePublicSummary;
  issue.review_publication_ready = true;
  issue.publication_notice = publicationDecision.fallback_only
    ? fallbackEditionNoticeLines()
    : [
    '검토 발행본입니다.',
    '각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.'
      ];
  if (publicationDecision.fallback_only) {
    issue.tags = fallbackIssueTags(issue.tags);
  }
  issue.briefing = publicBriefingBullets(issue.sections);
  issue.action_items = fallbackActionItems(issue, reportedFallbackCount, reportedDemotedRecords);
  issue.references = uniqueReferences(issue.sections, reportedDemotedRecords);

  const fallbackFactCheck = {
    ...factCheck,
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: 'Fallback public issue builder removed or demoted hard failure articles before writing public files.'
  };
  const fallbackQualityReport = buildNewsletterQualityReport(date, issue, reporter, fallbackFactCheck, {
    threshold: qualityReport.threshold || qualityGatePolicy.threshold,
    shortlistReport: shortlist,
    seedEvidencePack: readJsonIfExists(seedEvidencePackPath(root, date)) || null
  });
  const finalQualityReport = {
    ...fallbackQualityReport,
    fallback_public_issue: true,
    fallback_public_issue_reason: REVIEW_PUBLICATION_READY_REASON,
    review_publication_ready_reason: REVIEW_PUBLICATION_READY_REASON,
    editor_review_reason: EDITOR_REVIEW_REASON,
    publication_mode: publicationDecision.publication_mode,
    homepage_visibility: publicationDecision.homepage_visibility,
    normal_public_ready: publicationDecision.normal_public_ready,
    automatic_publish_ready: publicationDecision.automatic_publish_ready,
    public_artifact_ready: publicationDecision.public_artifact_ready,
    fallback_public_ready: publicationDecision.fallback_public_ready,
    fallback_only: publicationDecision.fallback_only,
    camera_anchor_count: publicationDecision.camera_anchor_count,
    homepage_badge: publicationDecision.homepage_badge,
    content_quality_score: fallbackQualityReport.score,
    camera_relevance_score: publicationDecision.camera_anchor_count > 0 ? fallbackQualityReport.score : 0,
    publication_mode_decision: publicationDecision.fallback_only
      ? 'fallback_public: no final public camera anchor remained; publish as clearly labeled Tooling Watch Edition.'
      : 'review_only: public files exist for editor-approved publication, but automatic normal publish gate remains closed.',
    ...originalFactCheck,
    fallback_public_issue_removed_blockers: reportedRemovedBlockers,
    fallback_public_issue_removed_article_count: reportedRemovedArticleCount,
    demoted_articles: reportedDemotedRecords,
    fallback_articles: reportedFallbackRecords,
    original_quality_status: qualityReport.status || generationStatus.quality_status || 'UNKNOWN',
    original_quality_score: qualityReport.score ?? generationStatus.quality_score ?? null,
    fallback_public_headline_generation: headlineGeneration || {
      source: Object.keys(publicArticleHeadlineOverrides).length > 0 ? 'provided_override' : 'deterministic',
      override_count: Object.keys(publicArticleHeadlineOverrides).length
    }
  };

  writeJson(path.join(newsroomDir, 'editor-draft.json'), issue);
  writeText(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(issue));
  writeJson(path.join(newsroomDir, 'fact-check-report.json'), fallbackFactCheck);
  writeText(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, fallbackFactCheck));
  writeJson(path.join(newsroomDir, 'quality-report.json'), finalQualityReport);
  writeText(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(finalQualityReport));
  writeJson(path.join(newsroomDir, 'fallback-public-issue.json'), {
    date,
    generated_at: new Date().toISOString(),
    fallback_public_issue_status: 'CREATED',
    fallback_public_issue_reason: REVIEW_PUBLICATION_READY_REASON,
    review_publication_ready_reason: REVIEW_PUBLICATION_READY_REASON,
    editor_review_reason: EDITOR_REVIEW_REASON,
    publication_mode: publicationDecision.publication_mode,
    homepage_visibility: publicationDecision.homepage_visibility,
    normal_public_ready: publicationDecision.normal_public_ready,
    automatic_publish_ready: publicationDecision.automatic_publish_ready,
    public_artifact_ready: publicationDecision.public_artifact_ready,
    fallback_public_ready: publicationDecision.fallback_public_ready,
    fallback_only: publicationDecision.fallback_only,
    camera_anchor_count: publicationDecision.camera_anchor_count,
    homepage_badge: publicationDecision.homepage_badge,
    ...originalFactCheck,
    fallback_public_issue_removed_blockers: reportedRemovedBlockers,
    fallback_public_issue_removed_article_count: reportedRemovedArticleCount,
    base_draft_source: baseCandidate?.source || 'default-issue',
    preserve_article_count: preserveSnapshots.size,
    final_article_count: issue.sections.length,
    headline_generation: headlineGeneration || {
      source: Object.keys(publicArticleHeadlineOverrides).length > 0 ? 'provided_override' : 'deterministic',
      override_count: Object.keys(publicArticleHeadlineOverrides).length
    },
    demoted_articles: reportedDemotedRecords,
    fallback_articles: reportedFallbackRecords,
    rejected_candidates: rejectedCandidates
  });

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);
  writeText(path.join(newsletterDir, 'newsletter.md'), markdown);
  writeText(path.join(newsletterDir, 'index.html'), html);
  updateNewsletterData(root, date, issue);

  const structural = validateRenderedIssueStructure({
    date,
    editor: issue,
    markdown,
    html,
    root
  });
  if (!structural.ok) {
    writeJson(path.join(newsroomDir, 'fallback-public-issue-structural-errors.json'), {
      errors: structural.errors
    });
    throw new Error(`Fallback public issue structural validation failed:\n${structural.text}`);
  }

  const reviewableFailureKind = reviewableFailureKindForFallbackStatus(generationStatus);
  const nextStatus = {
    ...generationStatus,
    date,
    status: generationStatus.status === 'PASS' ? 'PASS' : 'NEEDS_FIX',
    generation_status: generationStatus.status || generationStatus.generation_status || 'UNKNOWN',
    ...(reviewableFailureKind ? { failure_kind: reviewableFailureKind } : {}),
    fallback_public_issue: true,
    fallback_public_issue_status: 'CREATED',
    fallback_public_issue_demoted_article_count: reportedRemovedArticleCount,
    fallback_public_issue_removed_blockers: reportedRemovedBlockers,
    fallback_public_issue_removed_article_count: reportedRemovedArticleCount,
    fallback_public_issue_added_article_count: reportedFallbackRecords.length,
    fallback_public_issue_preserve_article_count: preserveSnapshots.size,
    fallback_public_issue_reason: REVIEW_PUBLICATION_READY_REASON,
    review_publication_ready_reason: REVIEW_PUBLICATION_READY_REASON,
    editor_review_reason: EDITOR_REVIEW_REASON,
    publication_mode: publicationDecision.publication_mode,
    homepage_visibility: publicationDecision.homepage_visibility,
    normal_public_ready: publicationDecision.normal_public_ready,
    automatic_publish_ready: publicationDecision.automatic_publish_ready,
    public_artifact_ready: publicationDecision.public_artifact_ready,
    fallback_public_ready: publicationDecision.fallback_public_ready,
    fallback_only: publicationDecision.fallback_only,
    camera_anchor_count: publicationDecision.camera_anchor_count,
    homepage_badge: publicationDecision.homepage_badge,
    content_quality_score: finalQualityReport.content_quality_score,
    camera_relevance_score: finalQualityReport.camera_relevance_score,
    publication_mode_decision: finalQualityReport.publication_mode_decision,
    quality_status: finalQualityReport.status,
    quality_score: finalQualityReport.score,
    quality_threshold: finalQualityReport.threshold,
    quality_deduction_count: ensureArray(finalQualityReport.deductions).length,
    fact_check_status: fallbackFactCheck.status,
    ...originalFactCheck,
    must_fix_count: 0,
    source_gap_count: 0,
    rendered_main_article_count: issue.sections.length,
    selected_article_count: issue.sections.length,
    final_selected_article_count: issue.sections.length,
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    artifact_final_publish_ready: false,
    review_gate_passed: true,
    publish_gate_passed: false,
    editor_review_required: true,
    composition_mode: reportedFallbackRecords.some(item => item.fallback) ? 'FALLBACK_COMPOSITION' : 'NEEDS_FIX',
    selection_composition_mode: reportedFallbackRecords.some(item => item.fallback) ? 'FALLBACK_COMPOSITION' : 'NEEDS_FIX',
    validate_ok: true,
    public_newsletter_ready: true,
    review_publication_ready: true,
    diagnostics_only: false,
    homepage_visible_after_merge: true
  };
  writeJson(path.join(newsroomDir, 'generation-status.json'), nextStatus);
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), nextStatus);

  const retryHistoryPath = path.join(newsroomDir, 'retry-history.json');
  const retryHistory = ensureArray(readJsonIfExists(retryHistoryPath))
    .filter(item => item?.model !== 'deterministic-fallback-public-issue');
  retryHistory.push({
    attempt: ensureArray(retryHistory).length + 1,
    model: 'deterministic-fallback-public-issue',
    score: finalQualityReport.score,
    threshold: finalQualityReport.threshold,
    status: 'PUBLIC_ISSUE_CREATED',
    rendered_main_article_count: issue.sections.length,
    demoted_article_count: reportedRemovedArticleCount,
    reserve_candidates_used: reportedFallbackRecords,
    deductions: ensureArray(finalQualityReport.deductions),
    selected_article_headlines: issue.sections.map(section => section.headline),
    demoted_sections: reportedDemotedRecords.map(record => record.headline),
    repair_actions: ['fallback-public-issue-builder']
  });
  writeJson(retryHistoryPath, retryHistory);
  writeText(
    path.join(newsroomDir, 'retry-history.md'),
    [
      `# Retry History - ${date}`,
      '',
      ...retryHistory.map(item => [
        `## Attempt ${item.attempt || 'n/a'}: ${item.status || 'UNKNOWN'}`,
        '',
        `- model: ${item.model || 'unknown'}`,
        `- score: ${item.score ?? 'n/a'}`,
        `- threshold: ${item.threshold ?? 'n/a'}`,
        `- rendered_main_article_count: ${item.rendered_main_article_count ?? 'n/a'}`,
        `- demoted_article_count: ${item.demoted_article_count ?? 0}`,
        `- selected_article_headlines: ${ensureArray(item.selected_article_headlines).join('; ') || 'none'}`,
        `- demoted_sections: ${ensureArray(item.demoted_sections).join('; ') || 'none'}`,
        `- repair_actions: ${ensureArray(item.repair_actions).join('; ') || 'none'}`
      ].join('\n'))
    ].join('\n\n')
  );

  return {
    date,
    issue,
    markdown,
    html,
    publicFiles: PUBLIC_FILES.map(file => file.replaceAll('${date}', date)),
    demotedArticles: reportedDemotedRecords,
    fallbackArticles: reportedFallbackRecords,
    qualityReport: finalQualityReport,
    factCheck: fallbackFactCheck,
    status: nextStatus
  };
}

function publicFilePaths(date) {
  return PUBLIC_FILES.map(file => file.replaceAll('${date}', date));
}

module.exports = {
  REQUIRED_PRESERVE_FIELDS,
  buildFallbackPublicIssue,
  candidateRejectionReason,
  candidatePoolFromArtifacts,
  fallbackArticleAction,
  hardFailureArticleIndexes,
  publicFilePaths,
  sectionDuplicateReason
};
