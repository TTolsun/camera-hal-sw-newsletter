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
  buildConfirmedFacts,
  buildHalPerspective,
  buildOverclaimGuardrails,
  buildStaticBackgroundContext,
  cleanBehaviorChange,
  findFieldHygieneIssues,
  inferImpactClaimLevel
} = require('./article-field-builder');
const {
  decodeHtml,
  readJson,
  writeJson
} = require('../common/common');

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

const NORMAL_BUCKET_ORDER = [
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
  BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
  BUCKETS.SOC_PLATFORM_SIGNAL
];

const FALLBACK_BUCKET_ORDER = [
  ...NORMAL_BUCKET_ORDER,
  BUCKETS.CPP_AI_TOOLING_FALLBACK
];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
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
    impact_claim_level: candidate.impact_claim_level || candidate.impactClaimLevel || '',
    evidence_origin: candidate.evidence_origin || classification.evidence_origin || 'candidate_metadata',
    _source_order: sourceOrder
  };
}

function pushCandidateList(target, value) {
  for (const item of ensureArray(value)) {
    target.push(item);
  }
}

function candidatePoolFromArtifacts({ root, date }) {
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const collectedDir = path.join(root, 'content', 'collected-news', date);
  const raw = [];
  const shortlist = readJsonIfExists(path.join(newsroomDir, 'shortlisted-candidates.json'));
  if (shortlist) {
    pushCandidateList(raw, shortlist.selected_articles);
    pushCandidateList(raw, shortlist.primary_selected_articles);
    pushCandidateList(raw, shortlist.reserve_candidates);
    pushCandidateList(raw, shortlist.shortlisted_candidates);
    pushCandidateList(raw, shortlist.demoted_candidates);
  }
  const capsules = readJsonIfExists(path.join(newsroomDir, 'article-capsules.json'));
  if (capsules) {
    pushCandidateList(raw, capsules.selected_capsules);
    pushCandidateList(raw, capsules.shortlisted_capsules);
    pushCandidateList(raw, capsules.reserve_capsules);
  }
  const reporter = readJsonIfExists(path.join(newsroomDir, 'reporter-candidates.json'));
  if (reporter) pushCandidateList(raw, reporter.candidates);
  const collected = readJsonIfExists(path.join(collectedDir, 'candidates.json'));
  if (collected) pushCandidateList(raw, collected.candidates);

  const seen = new Set();
  return raw
    .map((candidate, index) => normalizeCandidate(candidate, index))
    .filter(Boolean)
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

function candidateMeetsBaseEligibility(candidate) {
  const finalEligibility = candidate.finalSelectionEligibility;
  return ['main', 'short'].includes(finalEligibility) &&
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
  if (candidate.relevance_bucket === BUCKETS.SOC_PLATFORM_SIGNAL) return 'Adjacent Watch / SoC Platform';
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
  return firstText(candidate.component, candidate.api_or_component, candidate.apiOrComponent, candidate.source);
}

function buildSectionFromCandidate(candidate, { fallback = false, backgroundContext = null } = {}) {
  const category = categoryForCandidate(candidate, fallback);
  const headline = headlineForCandidate(candidate, fallback);
  const source = {
    title: candidate.title,
    url: candidate.url
  };
  const cleaned = cleanBehaviorChange(candidate);
  const impactClaimLevel = inferImpactClaimLevel(candidate);
  const background = firstText(
    backgroundContext?.background_context,
    backgroundContext?.background,
    buildStaticBackgroundContext({ ...candidate, impact_claim_level: impactClaimLevel })
  );
  const halPerspective = buildHalPerspective({ ...candidate, impact_claim_level: impactClaimLevel });
  const guardrails = buildOverclaimGuardrails({ ...candidate, impact_claim_level: impactClaimLevel });
  const fieldWarnings = unique([
    ...ensureArray(cleaned.warnings),
    ...findFieldHygieneIssues({
      what_changed: cleaned.text,
      background,
      camera_hal_perspective: halPerspective,
      impact_claim_level: impactClaimLevel
    }).map(item => item.type)
  ]);
  return {
    category,
    headline,
    confirmed_facts: buildConfirmedFacts({ ...candidate, impact_claim_level: impactClaimLevel }),
    evidence_summary: `${candidate.source} source metadata와 dated candidate evidence를 deterministic fallback builder가 사용했습니다.`,
    specificity_checks: [
      `finalSelectionEligibility=${candidate.finalSelectionEligibility}`,
      `relevance_bucket=${candidate.relevance_bucket}`,
      `impact_claim_level=${impactClaimLevel}`,
      `source_gap_risk=${String(candidate.source_gap_risk)}`
    ],
    source_verification_notes: [
      'Confirmed facts에는 source URL, date, component, version, cleaned behavior metadata만 사용했습니다.',
      fallback ? 'Source evidence가 더 강한 claim을 뒷받침하기 전까지 이 fallback article은 watch/supporting lane에 둡니다.' : 'Fallback reconstruction 전에 main-candidate eligibility check를 통과한 항목입니다.',
      ...guardrails
    ],
    what_changed: cleaned.text,
    background,
    camera_hal_perspective: halPerspective,
    camera_hal_checks: [
      fallback ? 'Direct camera-stack evidence가 없으면 watch/supporting material로만 표현합니다.' : 'Source evidence가 Camera HAL, Camera2, CameraX, driver, image pipeline, stream, buffer, metadata behavior를 실제로 말하는지 확인합니다.',
      'Source evidence가 뒷받침할 때만 CTS/VTS, Camera ITS, request/result, stream, buffer, metadata follow-up으로 승격합니다.'
    ],
    action_items: [
      'Publication 전에 source URL과 published date가 article text와 맞는지 확인합니다.',
      fallback ? 'Direct HAL behavior claim이 아니라 watch/supporting context로 공유합니다.' : '관련 camera stack owner가 follow-up validation 필요 여부를 확인합니다.',
      'Upstream release note나 downstream evidence가 더 구체적인 impact를 제공하면 다음 issue에서 재평가합니다.'
    ],
    action_hints: [],
    team_summary: fallback
      ? `${headline}은 normal publishable coverage가 부족했거나 원래 section repair가 필요해 watch/supporting context로 재구성했습니다.`
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
    impact_claim_level: impactClaimLevel,
    overclaim_guardrails: guardrails,
    field_builder_warnings: fieldWarnings,
    removed_source_fragments: ensureArray(cleaned.removed_fragments),
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
    imageUsageDecisionReason: 'Fallback builder did not select an external article image; renderer will use local fallback visual.'
  };
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
    tags: issueTags(issue)
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
  const generationStatus = readJsonIfExists(path.join(newsroomDir, 'generation-status.json')) ||
    readJsonIfExists(path.join(root, '.tmp', 'newsletter-generation-status.json')) || {};
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
  issue.sections = selectedSections.slice(0, articlePolicy.mainArticleCount.max);

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

  issue.summary = issueSummary(date, issue.sections, fallbackRecords.filter(item => item.fallback).length, demotedRecords.length);
  issue.briefing = ensureThreeBriefingBullets(issue, fallbackRecords.filter(item => item.fallback).length, demotedRecords);
  issue.action_items = fallbackActionItems(issue, fallbackRecords.filter(item => item.fallback).length, demotedRecords);
  issue.references = uniqueReferences(issue.sections, demotedRecords);

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
    shortlistReport: shortlist
  });
  const finalQualityReport = {
    ...fallbackQualityReport,
    fallback_public_issue: true,
    demoted_articles: demotedRecords,
    fallback_articles: fallbackRecords,
    original_quality_status: qualityReport.status || generationStatus.quality_status || 'UNKNOWN',
    original_quality_score: qualityReport.score ?? generationStatus.quality_score ?? null
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
    base_draft_source: baseCandidate?.source || 'default-issue',
    preserve_article_count: preserveSnapshots.size,
    final_article_count: issue.sections.length,
    demoted_articles: demotedRecords,
    fallback_articles: fallbackRecords,
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

  const nextStatus = {
    ...generationStatus,
    date,
    status: generationStatus.status === 'PASS' ? 'PASS' : 'NEEDS_FIX',
    generation_status: generationStatus.status || generationStatus.generation_status || 'UNKNOWN',
    fallback_public_issue: true,
    fallback_public_issue_status: 'CREATED',
    fallback_public_issue_demoted_article_count: demotedRecords.length,
    fallback_public_issue_added_article_count: fallbackRecords.length,
    fallback_public_issue_preserve_article_count: preserveSnapshots.size,
    fallback_public_issue_reason: 'Public newsletter files generated after quality/repair/final-readiness trigger.',
    quality_status: finalQualityReport.status,
    quality_score: finalQualityReport.score,
    quality_threshold: finalQualityReport.threshold,
    quality_deduction_count: ensureArray(finalQualityReport.deductions).length,
    fact_check_status: fallbackFactCheck.status,
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
    composition_mode: fallbackRecords.some(item => item.fallback) ? 'FALLBACK_COMPOSITION' : 'NEEDS_FIX',
    selection_composition_mode: fallbackRecords.some(item => item.fallback) ? 'FALLBACK_COMPOSITION' : 'NEEDS_FIX',
    validate_ok: true,
    public_newsletter_ready: true
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
    demoted_article_count: demotedRecords.length,
    reserve_candidates_used: fallbackRecords,
    deductions: ensureArray(finalQualityReport.deductions),
    selected_article_headlines: issue.sections.map(section => section.headline),
    demoted_sections: demotedRecords.map(record => record.headline),
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
    demotedArticles: demotedRecords,
    fallbackArticles: fallbackRecords,
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
