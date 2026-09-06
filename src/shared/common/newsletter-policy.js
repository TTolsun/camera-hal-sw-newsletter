const { ensureArray } = require('./value-coercion');
const fs = require('fs');
const path = require('path');
const {
  BUCKETS,
  ANDROID_SUPPORTING
} = require('../domain/aosp-camera-scope');

const POLICY_REL_PATH = path.join('src', 'shared', 'config', 'newsletter-policy.json');
const POLICY_BLOCK_BEGIN = '<!-- NEWSLETTER_POLICY:BEGIN -->';
const POLICY_BLOCK_END = '<!-- NEWSLETTER_POLICY:END -->';
const REQUIRED_HARD_FAIL_CONDITIONS = Object.freeze([
  'source-less main article',
  'source candidate binding failure',
  'missing dated evidence',
  'source_gap_risk',
  'fact-check must_fix',
  'duplicate source URL',
  'stale claim hard failure',
  'undated watch/reference page promoted to main article',
  'CameraX source extraction failure',
  'blocked source quality',
  'source quality drift'
]);
const DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS = Object.freeze([
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE
]);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const policyPath = path.join(repoRoot, POLICY_REL_PATH);

function unique(values) {
  return [...new Set(ensureArray(values))];
}

function readPolicyConfig(filePath = policyPath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function knownBuckets() {
  // android_supporting 은 relevance_bucket 값이 아니라 구성 판정용 실효 버킷이다.
  // android 로 합쳐진 뒤에도 멀티미디어 출력·SoC 신호의 보조 등급(호당 1건 제한)을
  // 정책 파일로 표현하려면 여기서 알려진 값이어야 한다.
  return [...Object.values(BUCKETS), ANDROID_SUPPORTING];
}

function validateInteger(value, field, errors, { min = 0 } = {}) {
  if (!Number.isInteger(value) || value < min) {
    errors.push(`${field} must be an integer >= ${min}.`);
  }
}

function validateBucketList(value, field, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${field} must be a non-empty array.`);
    return [];
  }
  const allowed = new Set(knownBuckets());
  const buckets = [];
  for (const bucket of value) {
    if (typeof bucket !== 'string' || !bucket.trim()) {
      errors.push(`${field} contains an empty or non-string bucket.`);
      continue;
    }
    if (!allowed.has(bucket)) {
      errors.push(`${field} contains unknown bucket: ${bucket}.`);
    }
    buckets.push(bucket);
  }
  const duplicates = buckets.filter((bucket, index) => buckets.indexOf(bucket) !== index);
  for (const bucket of unique(duplicates)) {
    errors.push(`${field} contains duplicate bucket: ${bucket}.`);
  }
  return buckets;
}

// 선정 창(freshness_window)의 시간 anchor는 실행일이 아니라 직전 완결 coverage 주(coverage-
// week.js)다. coverage 주 자체가 ISO 주(7일) 고정이라 primarySelectionDays는 실제 분류에
// 쓰이지 않는다(하위 호환 위해 스키마·보고서에는 그대로 남아 echo된다) — primary 판정은 항상
// "coverage 주 안(0~6일)"이다. fallbackSelectionDays/referenceContextDays만
// classifyCoverageWindow(coverage-week.js)의 fallback/reference 경계로 실제로 전달돼 분류에
// 반영된다. 이 값들을 바꾸면 fallback/reference 경계가 실제로 좁아지거나 넓어진다.
function validateSelectionWindowPolicy(value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('selectionWindowPolicy must be an object.');
    return;
  }
  validateInteger(value.primarySelectionDays, 'selectionWindowPolicy.primarySelectionDays', errors, { min: 1 });
  validateInteger(value.fallbackSelectionDays, 'selectionWindowPolicy.fallbackSelectionDays', errors, { min: 1 });
  validateInteger(value.referenceContextDays, 'selectionWindowPolicy.referenceContextDays', errors, { min: 1 });
  if (
    Number.isInteger(value.primarySelectionDays) &&
    Number.isInteger(value.fallbackSelectionDays) &&
    value.fallbackSelectionDays < value.primarySelectionDays
  ) {
    errors.push('selectionWindowPolicy.fallbackSelectionDays must be >= selectionWindowPolicy.primarySelectionDays.');
  }
  if (
    Number.isInteger(value.fallbackSelectionDays) &&
    Number.isInteger(value.referenceContextDays) &&
    value.referenceContextDays < value.fallbackSelectionDays
  ) {
    errors.push('selectionWindowPolicy.referenceContextDays must be >= selectionWindowPolicy.fallbackSelectionDays.');
  }
}

const KNOWN_CATCH_UP_ACTIVATION_MODES = Object.freeze(['fill_open_slots']);

function validateCatchUpPolicy(value, config, errors) {
  if (value === undefined) return; // optional; normalized to a default when absent
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('catchUpPolicy must be an object.');
    return;
  }
  if (typeof value.enabled !== 'boolean') {
    errors.push('catchUpPolicy.enabled must be a boolean.');
  }
  const mainMin = config?.articlePolicy?.mainArticleCount?.min;
  const mainMax = config?.articlePolicy?.mainArticleCount?.max;
  validateInteger(value.maxCatchUpArticles, 'catchUpPolicy.maxCatchUpArticles', errors, { min: 1 });
  if (Number.isInteger(value.maxCatchUpArticles) && Number.isInteger(mainMax) && value.maxCatchUpArticles > mainMax) {
    errors.push('catchUpPolicy.maxCatchUpArticles cannot exceed articlePolicy.mainArticleCount.max.');
  }
  if (value.maxReleaseClassArticles !== undefined) {
    validateInteger(value.maxReleaseClassArticles, 'catchUpPolicy.maxReleaseClassArticles', errors, { min: 0 });
    if (Number.isInteger(value.maxReleaseClassArticles) && Number.isInteger(mainMax) && value.maxReleaseClassArticles > mainMax) {
      errors.push('catchUpPolicy.maxReleaseClassArticles cannot exceed articlePolicy.mainArticleCount.max.');
    }
  }
  validateInteger(value.targetMainArticles, 'catchUpPolicy.targetMainArticles', errors, { min: 1 });
  if (Number.isInteger(value.targetMainArticles) && Number.isInteger(mainMin) && value.targetMainArticles < mainMin) {
    errors.push('catchUpPolicy.targetMainArticles must be >= articlePolicy.mainArticleCount.min.');
  }
  if (Number.isInteger(value.targetMainArticles) && Number.isInteger(mainMax) && value.targetMainArticles > mainMax) {
    errors.push('catchUpPolicy.targetMainArticles cannot exceed articlePolicy.mainArticleCount.max.');
  }
  const fallbackDays = config?.selectionWindowPolicy?.fallbackSelectionDays;
  const referenceDays = config?.selectionWindowPolicy?.referenceContextDays;
  validateInteger(value.maxAgeDays, 'catchUpPolicy.maxAgeDays', errors, { min: 1 });
  if (Number.isInteger(value.maxAgeDays) && Number.isInteger(fallbackDays) && value.maxAgeDays < fallbackDays) {
    errors.push('catchUpPolicy.maxAgeDays must be >= selectionWindowPolicy.fallbackSelectionDays.');
  }
  if (Number.isInteger(value.maxAgeDays) && Number.isInteger(referenceDays) && value.maxAgeDays > referenceDays) {
    errors.push('catchUpPolicy.maxAgeDays must be <= selectionWindowPolicy.referenceContextDays.');
  }
  validateBucketList(value.eligibleBuckets, 'catchUpPolicy.eligibleBuckets', errors);
  if (!KNOWN_CATCH_UP_ACTIVATION_MODES.includes(value.activationMode)) {
    errors.push(`catchUpPolicy.activationMode must be one of: ${KNOWN_CATCH_UP_ACTIVATION_MODES.join(', ')}.`);
  }
}

function validateHeadlinePolicy(value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('headlinePolicy must be an object.');
    return;
  }
  if (value.decayModel !== 'linear') {
    errors.push('headlinePolicy.decayModel must be one of: linear.');
  }
  validateInteger(value.decayRatePerDay, 'headlinePolicy.decayRatePerDay', errors, { min: 0 });
  validateInteger(value.replacementMargin, 'headlinePolicy.replacementMargin', errors, { min: 0 });
  validateInteger(value.minimumHeadlineScore, 'headlinePolicy.minimumHeadlineScore', errors, { min: 0 });
  validateInteger(value.historyMaxEntries, 'headlinePolicy.historyMaxEntries', errors, { min: 1 });
  if (typeof value.latestInclusionRequired !== 'boolean') {
    errors.push('headlinePolicy.latestInclusionRequired must be a boolean.');
  }
}

function validatePublishReadyCompositionPolicy(value, article, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('articlePolicy.publishReadyComposition must be an object.');
    return;
  }
  validateInteger(
    value.primaryCameraStackMinRequired,
    'articlePolicy.publishReadyComposition.primaryCameraStackMinRequired',
    errors,
    { min: 0 }
  );
  validateInteger(
    value.directAospCameraOrDriverMinRequired,
    'articlePolicy.publishReadyComposition.directAospCameraOrDriverMinRequired',
    errors,
    { min: 0 }
  );
  validateInteger(
    value.supportingMainMaxAllowed,
    'articlePolicy.publishReadyComposition.supportingMainMaxAllowed',
    errors,
    { min: 0 }
  );

  const max = article.mainArticleCount || {};
  if (
    Number.isInteger(value.primaryCameraStackMinRequired) &&
    Number.isInteger(max.max) &&
    value.primaryCameraStackMinRequired > max.max
  ) {
    errors.push('articlePolicy.publishReadyComposition.primaryCameraStackMinRequired cannot exceed articlePolicy.mainArticleCount.max.');
  }
  if (
    Number.isInteger(value.directAospCameraOrDriverMinRequired) &&
    Number.isInteger(value.primaryCameraStackMinRequired) &&
    value.directAospCameraOrDriverMinRequired > value.primaryCameraStackMinRequired
  ) {
    errors.push('articlePolicy.publishReadyComposition.directAospCameraOrDriverMinRequired cannot exceed articlePolicy.publishReadyComposition.primaryCameraStackMinRequired.');
  }
  if (
    Number.isInteger(value.supportingMainMaxAllowed) &&
    Number.isInteger(max.max) &&
    value.supportingMainMaxAllowed > max.max
  ) {
    errors.push('articlePolicy.publishReadyComposition.supportingMainMaxAllowed cannot exceed articlePolicy.mainArticleCount.max.');
  }
}

function validateNewsletterPolicyConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['Newsletter Policy config must be a JSON object.'] };
  }
  validateInteger(config.schemaVersion, 'schemaVersion', errors, { min: 1 });
  const article = config.articlePolicy || {};
  const preflight = config.candidatePoolPreflight || {};
  const quality = config.qualityGatePolicy || {};
  const count = article.mainArticleCount || {};
  validateInteger(count.min, 'articlePolicy.mainArticleCount.min', errors, { min: 1 });
  validateInteger(count.max, 'articlePolicy.mainArticleCount.max', errors, { min: 1 });
  if (Number.isInteger(count.min) && Number.isInteger(count.max) && count.max < count.min) {
    errors.push('articlePolicy.mainArticleCount.max must be >= min.');
  }
  const primary = article.primaryCameraStack || {};
  validateInteger(primary.minRequired, 'articlePolicy.primaryCameraStack.minRequired', errors, { min: 0 });
  validatePublishReadyCompositionPolicy(article.publishReadyComposition, article, errors);
  const primaryBuckets = validateBucketList(primary.buckets, 'articlePolicy.primaryCameraStack.buckets', errors);
  const supportingBuckets = validateBucketList(article.supportingMainBuckets, 'articlePolicy.supportingMainBuckets', errors);
  const forbiddenBuckets = validateBucketList(article.forbiddenMainBuckets, 'articlePolicy.forbiddenMainBuckets', errors);
  const primarySet = new Set(primaryBuckets);
  const supportingSet = new Set(supportingBuckets);
  const forbiddenSet = new Set(forbiddenBuckets);
  for (const bucket of primarySet) {
    if (supportingSet.has(bucket)) errors.push(`Bucket cannot be both primary and supporting: ${bucket}.`);
    if (forbiddenSet.has(bucket)) errors.push(`Bucket cannot be both primary and forbidden: ${bucket}.`);
  }
  for (const bucket of supportingSet) {
    if (forbiddenSet.has(bucket)) errors.push(`Bucket cannot be both supporting and forbidden: ${bucket}.`);
  }
  if (Number.isInteger(primary.minRequired) && Number.isInteger(count.max) && primary.minRequired > count.max) {
    errors.push('articlePolicy.primaryCameraStack.minRequired cannot exceed articlePolicy.mainArticleCount.max.');
  }
  validateInteger(preflight.reserveMin, 'candidatePoolPreflight.reserveMin', errors, { min: 0 });
  validateInteger(preflight.publishableCandidateMin, 'candidatePoolPreflight.publishableCandidateMin', errors, { min: 1 });
  validateInteger(preflight.primaryCameraStackCandidateMin, 'candidatePoolPreflight.primaryCameraStackCandidateMin', errors, { min: 0 });
  validateInteger(preflight.cameraStackCandidateMin, 'candidatePoolPreflight.cameraStackCandidateMin', errors, { min: 0 });
  validateSelectionWindowPolicy(config.selectionWindowPolicy, errors);
  validateSelectionScoringPolicy(config.selectionScoringPolicy, errors);
  validateCatchUpPolicy(config.catchUpPolicy, config, errors);
  validateWeeklyArticlePolicy(config.weeklyArticlePolicy, errors);
  validateDeepDivePolicy(config.deepDivePolicy, errors);
  validateSourceEligibilityPolicy(config.sourceEligibilityPolicy, errors);
  validateHeadlinePolicy(config.headlinePolicy, errors);
  if (config.publishModePolicy !== undefined) {
    validatePublishModePolicy(config.publishModePolicy, errors);
  }
  if (
    Number.isInteger(preflight.publishableCandidateMin) &&
    Number.isInteger(count.min) &&
    preflight.publishableCandidateMin < count.min
  ) {
    errors.push('candidatePoolPreflight.publishableCandidateMin must be >= articlePolicy.mainArticleCount.min.');
  }
  if (
    Number.isInteger(preflight.publishableCandidateMin) &&
    Number.isInteger(count.min) &&
    Number.isInteger(preflight.reserveMin) &&
    preflight.publishableCandidateMin < count.min + preflight.reserveMin
  ) {
    errors.push('candidatePoolPreflight.publishableCandidateMin must be >= articlePolicy.mainArticleCount.min + candidatePoolPreflight.reserveMin.');
  }
  if (
    Number.isInteger(preflight.cameraStackCandidateMin) &&
    Number.isInteger(preflight.publishableCandidateMin) &&
    preflight.cameraStackCandidateMin > preflight.publishableCandidateMin
  ) {
    errors.push('candidatePoolPreflight.cameraStackCandidateMin must be <= candidatePoolPreflight.publishableCandidateMin.');
  }
  const threshold = quality.threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    errors.push('qualityGatePolicy.threshold must be a number between 0 and 100.');
  }
  const hardFailConditions = ensureArray(quality.hardFailConditions);
  if (hardFailConditions.length === 0 || hardFailConditions.some(item => typeof item !== 'string' || !item.trim())) {
    errors.push('qualityGatePolicy.hardFailConditions must contain non-empty strings.');
  }
  for (const condition of REQUIRED_HARD_FAIL_CONDITIONS) {
    if (!hardFailConditions.includes(condition)) {
      errors.push(`qualityGatePolicy.hardFailConditions must include required hard fail condition: ${condition}.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function normalizePublishModePolicy(raw) {
  if (!raw || typeof raw !== 'object') {
    return { contextMinSignals: 1 };
  }
  return {
    contextMinSignals: Number.isInteger(raw.contextMinSignals) && raw.contextMinSignals >= 1
      ? raw.contextMinSignals
      : 1
  };
}

function normalizeCatchUpPolicy(raw) {
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, maxCatchUpArticles: 2, maxReleaseClassArticles: 0, maxAgeDays: 90, targetMainArticles: 3, eligibleBuckets: [], activationMode: 'fill_open_slots' };
  }
  return {
    enabled: raw.enabled === true,
    maxCatchUpArticles: Number.isInteger(raw.maxCatchUpArticles) ? raw.maxCatchUpArticles : 2,
    // release-class 레인(#825)의 호당 상한. 0이면 레인이 꺼진다(키 부재 시 기본 off).
    maxReleaseClassArticles: Number.isInteger(raw.maxReleaseClassArticles) ? raw.maxReleaseClassArticles : 0,
    maxAgeDays: Number.isInteger(raw.maxAgeDays) ? raw.maxAgeDays : 90,
    targetMainArticles: Number.isInteger(raw.targetMainArticles) ? raw.targetMainArticles : 3,
    eligibleBuckets: unique(ensureArray(raw.eligibleBuckets)),
    activationMode: 'fill_open_slots'
  };
}

function validatePublishModePolicy(value, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('publishModePolicy must be an object.');
    return;
  }
  if (!Number.isInteger(value.contextMinSignals) || value.contextMinSignals < 1) {
    errors.push('publishModePolicy.contextMinSignals must be an integer >= 1.');
  }
}

const DEFAULT_WEEKLY_ARTICLE_POLICY = {
  dailyNewArticleLimit: 3,
  weeklyArticleLimit: 10,
  weeklyOverflowPolicy: 'rank_then_drop'
};
const KNOWN_WEEKLY_OVERFLOW_POLICIES = ['rank_then_drop'];

function normalizeWeeklyArticlePolicy(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const overflow = String(source.weeklyOverflowPolicy || DEFAULT_WEEKLY_ARTICLE_POLICY.weeklyOverflowPolicy);
  return {
    dailyNewArticleLimit: Number.isInteger(source.dailyNewArticleLimit)
      ? source.dailyNewArticleLimit
      : DEFAULT_WEEKLY_ARTICLE_POLICY.dailyNewArticleLimit,
    weeklyArticleLimit: Number.isInteger(source.weeklyArticleLimit)
      ? source.weeklyArticleLimit
      : DEFAULT_WEEKLY_ARTICLE_POLICY.weeklyArticleLimit,
    weeklyOverflowPolicy: KNOWN_WEEKLY_OVERFLOW_POLICIES.includes(overflow)
      ? overflow
      : DEFAULT_WEEKLY_ARTICLE_POLICY.weeklyOverflowPolicy
  };
}

function validateWeeklyArticlePolicy(value, errors) {
  if (value === undefined) return; // optional; normalized to a default when absent
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('weeklyArticlePolicy must be an object.');
    return;
  }
  validateInteger(value.dailyNewArticleLimit, 'weeklyArticlePolicy.dailyNewArticleLimit', errors, { min: 1 });
  validateInteger(value.weeklyArticleLimit, 'weeklyArticlePolicy.weeklyArticleLimit', errors, { min: 1 });
  if (Number.isInteger(value.dailyNewArticleLimit) &&
    Number.isInteger(value.weeklyArticleLimit) &&
    value.dailyNewArticleLimit > value.weeklyArticleLimit) {
    errors.push('weeklyArticlePolicy.dailyNewArticleLimit cannot exceed weeklyArticleLimit.');
  }
  if (!KNOWN_WEEKLY_OVERFLOW_POLICIES.includes(String(value.weeklyOverflowPolicy))) {
    errors.push(`weeklyArticlePolicy.weeklyOverflowPolicy must be one of: ${KNOWN_WEEKLY_OVERFLOW_POLICIES.join(', ')}.`);
  }
}

const DEFAULT_SELECTION_SCORING_POLICY = {
  mainArticleScoreThreshold: 42
};

function normalizeSelectionScoringPolicy(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    mainArticleScoreThreshold: Number.isFinite(source.mainArticleScoreThreshold)
      ? source.mainArticleScoreThreshold
      : DEFAULT_SELECTION_SCORING_POLICY.mainArticleScoreThreshold
  };
}

function validateSelectionScoringPolicy(value, errors) {
  if (value === undefined) return; // optional; normalized to a default when absent
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('selectionScoringPolicy must be an object.');
    return;
  }
  const threshold = value.mainArticleScoreThreshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
    errors.push('selectionScoringPolicy.mainArticleScoreThreshold must be a number >= 0.');
  }
}

// 심층(deep-dive) 발동 임계값. 이 값이 정본이고, weekly-deep-dive.js와 생성 문서 블록이 모두
// 여기서 읽는다. 코드에 숫자를 다시 적으면 check:policy-docs가 drift를 볼 수 없다.
// 0은 "direct_aosp_camera가 한 건도 없는 주에만 발동"이라는 유효한 설정이므로 허용한다.
const DEFAULT_DEEP_DIVE_POLICY = {
  directAospCameraMaxForActivation: 1
};

function normalizeDeepDivePolicy(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    directAospCameraMaxForActivation: Number.isInteger(source.directAospCameraMaxForActivation)
      ? source.directAospCameraMaxForActivation
      : DEFAULT_DEEP_DIVE_POLICY.directAospCameraMaxForActivation
  };
}

function validateDeepDivePolicy(value, errors) {
  if (value === undefined) return; // optional; normalized to a default when absent
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('deepDivePolicy must be an object.');
    return;
  }
  validateInteger(value.directAospCameraMaxForActivation, 'deepDivePolicy.directAospCameraMaxForActivation', errors, { min: 0 });
}

const DEFAULT_MAILING_LIST_PATCH_MAIN_ARTICLE = {
  enabled: false,
  sourceRole: 'project_mailing_list_source',
  evidenceStrengthMin: 0.5,
  technicalDepthMin: 0.5
};

function normalizeSourceEligibilityPolicy(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const patch = source.mailingListPatchMainArticle && typeof source.mailingListPatchMainArticle === 'object'
    ? source.mailingListPatchMainArticle
    : {};
  const def = DEFAULT_MAILING_LIST_PATCH_MAIN_ARTICLE;
  return {
    mailingListPatchMainArticle: {
      enabled: patch.enabled === true,
      sourceRole: typeof patch.sourceRole === 'string' && patch.sourceRole ? patch.sourceRole : def.sourceRole,
      evidenceStrengthMin: Number.isFinite(patch.evidenceStrengthMin) ? patch.evidenceStrengthMin : def.evidenceStrengthMin,
      technicalDepthMin: Number.isFinite(patch.technicalDepthMin) ? patch.technicalDepthMin : def.technicalDepthMin
    }
  };
}

function validateSourceEligibilityPolicy(value, errors) {
  if (value === undefined) return; // optional; normalized to a default when absent
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('sourceEligibilityPolicy must be an object.');
    return;
  }
  const patch = value.mailingListPatchMainArticle;
  if (patch === undefined) return;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    errors.push('sourceEligibilityPolicy.mailingListPatchMainArticle must be an object.');
    return;
  }
  for (const field of ['evidenceStrengthMin', 'technicalDepthMin']) {
    const score = patch[field];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
      errors.push(`sourceEligibilityPolicy.mailingListPatchMainArticle.${field} must be a number between 0 and 1.`);
    }
  }
  if (patch.sourceRole !== undefined && (typeof patch.sourceRole !== 'string' || !patch.sourceRole.trim())) {
    errors.push('sourceEligibilityPolicy.mailingListPatchMainArticle.sourceRole must be a non-empty string.');
  }
}

function normalizeNewsletterPolicyConfig(config) {
  const article = config.articlePolicy;
  const preflight = config.candidatePoolPreflight;
  const selectionWindow = config.selectionWindowPolicy;
  const headline = config.headlinePolicy;
  const quality = config.qualityGatePolicy;
  return deepFreeze({
    schemaVersion: config.schemaVersion,
    name: config.name || 'Newsletter Policy',
    publishModePolicy: normalizePublishModePolicy(config.publishModePolicy),
    articlePolicy: {
      mainArticleCount: {
        min: article.mainArticleCount.min,
        max: article.mainArticleCount.max
      },
      primaryCameraStack: {
        minRequired: article.primaryCameraStack.minRequired,
        buckets: unique(article.primaryCameraStack.buckets)
      },
      publishReadyComposition: {
        primaryCameraStackMinRequired: article.publishReadyComposition.primaryCameraStackMinRequired,
        directAospCameraOrDriverMinRequired: article.publishReadyComposition.directAospCameraOrDriverMinRequired,
        supportingMainMaxAllowed: article.publishReadyComposition.supportingMainMaxAllowed
      },
      supportingMainBuckets: unique(article.supportingMainBuckets),
      forbiddenMainBuckets: unique(article.forbiddenMainBuckets)
    },
    candidatePoolPreflight: {
      reserveMin: preflight.reserveMin,
      publishableCandidateMin: preflight.publishableCandidateMin,
      primaryCameraStackCandidateMin: preflight.primaryCameraStackCandidateMin,
      cameraStackCandidateMin: preflight.cameraStackCandidateMin
    },
    selectionWindowPolicy: {
      primarySelectionDays: selectionWindow.primarySelectionDays,
      fallbackSelectionDays: selectionWindow.fallbackSelectionDays,
      referenceContextDays: selectionWindow.referenceContextDays
    },
    selectionScoringPolicy: normalizeSelectionScoringPolicy(config.selectionScoringPolicy),
    catchUpPolicy: normalizeCatchUpPolicy(config.catchUpPolicy),
    weeklyArticlePolicy: normalizeWeeklyArticlePolicy(config.weeklyArticlePolicy),
    headlinePolicy: {
      decayModel: headline.decayModel,
      decayRatePerDay: headline.decayRatePerDay,
      replacementMargin: headline.replacementMargin,
      minimumHeadlineScore: headline.minimumHeadlineScore,
      latestInclusionRequired: headline.latestInclusionRequired,
      historyMaxEntries: headline.historyMaxEntries
    },
    qualityGatePolicy: {
      threshold: quality.threshold,
      hardFailConditions: [...quality.hardFailConditions]
    },
    deepDivePolicy: normalizeDeepDivePolicy(config.deepDivePolicy),
    sourceEligibilityPolicy: normalizeSourceEligibilityPolicy(config.sourceEligibilityPolicy)
  });
}

function loadNewsletterPolicy(filePath = policyPath) {
  const config = readPolicyConfig(filePath);
  const validation = validateNewsletterPolicyConfig(config);
  if (!validation.ok) {
    const displayPath = path.relative(repoRoot, filePath).replace(/\\/g, '/') || filePath;
    throw new Error(`Invalid Newsletter Policy config at ${displayPath}:\n- ${validation.errors.join('\n- ')}`);
  }
  return normalizeNewsletterPolicyConfig(config);
}

let defaultPolicyCache = null;

function getDefaultNewsletterPolicy() {
  if (!defaultPolicyCache) {
    defaultPolicyCache = loadNewsletterPolicy(policyPath);
  }
  return defaultPolicyCache;
}

function getArticlePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.articlePolicy;
}

function getPublishReadyCompositionPolicy(policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).publishReadyComposition;
}

function getQualityGatePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.qualityGatePolicy;
}

function getSourceEligibilityPolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.sourceEligibilityPolicy;
}

function getMailingListPatchMainArticlePolicy(policy = getDefaultNewsletterPolicy()) {
  return getSourceEligibilityPolicy(policy).mailingListPatchMainArticle;
}

function getCandidatePoolPreflightPolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.candidatePoolPreflight;
}

function getSelectionWindowPolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.selectionWindowPolicy;
}

function getSelectionScoringPolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.selectionScoringPolicy;
}

function getCatchUpPolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.catchUpPolicy;
}

function getWeeklyArticlePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.weeklyArticlePolicy;
}

function getHeadlinePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.headlinePolicy;
}

function getDeepDivePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.deepDivePolicy;
}

function getPublishModePolicy(policy = getDefaultNewsletterPolicy()) {
  return policy.publishModePolicy;
}

function bucketValue(bucket) {
  return String(bucket || '').trim();
}

function isPrimaryCameraStackBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).primaryCameraStack.buckets.includes(bucketValue(bucket));
}

function isSupportingMainBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).supportingMainBuckets.includes(bucketValue(bucket));
}

function isForbiddenMainBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return getArticlePolicy(policy).forbiddenMainBuckets.includes(bucketValue(bucket));
}

function isMainArticleAllowedBucket(bucket, policy = getDefaultNewsletterPolicy()) {
  return isPrimaryCameraStackBucket(bucket, policy) || isSupportingMainBucket(bucket, policy);
}

function articleCountRangeText(policy = getDefaultNewsletterPolicy()) {
  const articlePolicy = getArticlePolicy(policy);
  const { min, max } = articlePolicy.mainArticleCount;
  return `${min}-${max}`;
}

function minimumText(value) {
  return value === 0 ? 'disabled' : String(value);
}

function publishGateCriteriaText(policy = getDefaultNewsletterPolicy()) {
  const articlePolicy = getArticlePolicy(policy);
  const publishPolicy = getPublishReadyCompositionPolicy(policy);
  const qualityGatePolicy = getQualityGatePolicy(policy);
  return [
    `main articles: ${articleCountRangeText(policy)}`,
    `review gate primary camera stack articles: ${minimumText(articlePolicy.primaryCameraStack.minRequired)}`,
    `Publish-ready gate primary camera stack articles: ${minimumText(publishPolicy.primaryCameraStackMinRequired)}`,
    `Publish-ready gate direct AOSP Camera or driver/image pipeline articles: ${minimumText(publishPolicy.directAospCameraOrDriverMinRequired)}`,
    `Publish-ready gate supporting main articles max: ${publishPolicy.supportingMainMaxAllowed}`,
    `forbidden main buckets: ${articlePolicy.forbiddenMainBuckets.join(', ') || 'none'}`,
    `quality threshold: ${qualityGatePolicy.threshold}`
  ].join('; ');
}

function selectionWindowPolicyText(policy = getDefaultNewsletterPolicy()) {
  const selectionWindow = getSelectionWindowPolicy(policy);
  return [
    `primary=${selectionWindow.primarySelectionDays}d`,
    `fallback=${selectionWindow.fallbackSelectionDays}d`,
    `reference=${selectionWindow.referenceContextDays}d`
  ].join('; ');
}

function renderNewsletterPolicyBlock(policy = getDefaultNewsletterPolicy()) {
  const articlePolicy = getArticlePolicy(policy);
  const publishPolicy = getPublishReadyCompositionPolicy(policy);
  const selectionWindowPolicy = getSelectionWindowPolicy(policy);
  const headlinePolicy = getHeadlinePolicy(policy);
  const qualityGatePolicy = getQualityGatePolicy(policy);
  const catchUpPolicy = getCatchUpPolicy(policy);
  const deepDivePolicy = getDeepDivePolicy(policy);
  const oneArticlePolicyEnabled = articlePolicy.mainArticleCount.min === 1;
  const reserveRequirementText = policy.candidatePoolPreflight.reserveMin === 0
    ? '예비 후보는 진단용으로만 사용'
    : `예비 후보 최소 ${policy.candidatePoolPreflight.reserveMin}개`;
  return [
    POLICY_BLOCK_BEGIN,
    '<!-- This block is generated. Update src/shared/config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->',
    '',
    '### 뉴스레터 정책 (Newsletter Policy)',
    '',
    `- 정본 출처(source of truth): \`${POLICY_REL_PATH.replace(/\\/g, '/')}\``,
    `- 주요 기사 수: ${articleCountRangeText(policy)}`,
    ...(oneArticlePolicyEnabled
      ? [
          // 이 문장은 최소 기사 수가 1이라는 뜻이지 상한이 1이라는 뜻이 아니다. 예전 표현("주요 기사
          // 하나만 담을 수 있습니다")은 상한으로 읽혀서, EDITORIAL_POLICY.md를 정본으로 받는 editor가
          // 2026-08-03 실행에서 선정된 5개 그룹 중 4개를 reason_code=one_article_policy로 강등했다
          // (그런 reason code는 계약에 없어 editor semantic validation 실패 -> 발행 차단).
          `- 단일 기사 정책(one-article policy): 완전히 발행 가능한 주요 기사가 하나뿐이어도 공개 발행할 수 있습니다. 기사 수 상한은 위의 주요 기사 수(${articleCountRangeText(policy)})를 그대로 따릅니다.`,
          '- 기사 수만으로 단일 기사 호가 품질 저하 또는 검토 전용으로 분류되지는 않습니다. 단, 하드 품질 게이트는 그대로 적용됩니다.',
          '- 보조 전용 정책(supporting-only policy): 보조 주요 버킷 기사 하나도 모든 하드 게이트를 통과하면 공개 가능 상태가 될 수 있습니다.'
        ]
      : []),
    `- 검토 게이트(review gate) Primary Camera Stack 기사: ${articlePolicy.primaryCameraStack.minRequired === 0 ? '단일 기사 정책으로 비활성화됨' : `최소 ${articlePolicy.primaryCameraStack.minRequired}개`}`,
    `- 발행 가능(publish-ready) Primary Camera Stack 기사: ${publishPolicy.primaryCameraStackMinRequired === 0 ? '단일 기사 정책으로 비활성화됨' : `최소 ${publishPolicy.primaryCameraStackMinRequired}개`}`,
    `- 발행 가능(publish-ready) direct AOSP Camera 또는 driver/image pipeline 기사: ${publishPolicy.directAospCameraOrDriverMinRequired === 0 ? '단일 기사 정책으로 비활성화됨' : `최소 ${publishPolicy.directAospCameraOrDriverMinRequired}개`} (${DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS.map(bucket => `\`${bucket}\``).join(', ')} 버킷 대상)`,
    `- 발행 가능(publish-ready) 보조 주요 기사: 보조 주요 버킷 전체에서 최대 ${publishPolicy.supportingMainMaxAllowed}개`,
    `- Primary Camera Stack 버킷: ${articlePolicy.primaryCameraStack.buckets.map(bucket => `\`${bucket}\``).join(', ')}`,
    `- 보조 주요 버킷: ${articlePolicy.supportingMainBuckets.map(bucket => `\`${bucket}\``).join(', ')}`,
    `- 금지 주요 버킷: ${articlePolicy.forbiddenMainBuckets.map(bucket => `\`${bucket}\``).join(', ')}; 후보 수만으로 이 버킷을 주요 기사로 승격하지 않습니다`,
    `- 후보 풀 사전점검(candidate pool preflight): 발행 가능 후보 최소 ${policy.candidatePoolPreflight.publishableCandidateMin}개; ${reserveRequirementText}; camera stack 후보 최소 ${policy.candidatePoolPreflight.cameraStackCandidateMin}개`,
    `- 선정 기간(selection windows): primary ${selectionWindowPolicy.primarySelectionDays}일; fallback ${selectionWindowPolicy.fallbackSelectionDays}일; reference ${selectionWindowPolicy.referenceContextDays}일`,
    '- 선정 기간 적용(selection window enforcement): 주요 선정은 강제 적용되며, fallback 기간 후보는 primary 기간 선정이 부족할 때에만 승격됩니다.',
    catchUpPolicy.enabled
      ? `- 지난 소식(Catch-up) 레인: 신규 선정이 ${catchUpPolicy.targetMainArticles}개 미만이면, 비어 있는 주요 슬롯을 ${catchUpPolicy.eligibleBuckets.map(bucket => `\`${bucket}\``).join(', ')} 버킷에서 최대 ${catchUpPolicy.maxAgeDays}일 이내의 미게재 릴리스로 채웁니다. 호당 최대 ${catchUpPolicy.maxCatchUpArticles}개이며 각각 한 번씩만 게재하고, 신규 콘텐츠를 밀어내지 않습니다.`
      : '- 지난 소식(Catch-up) 레인: 비활성화됨.',
    ...(catchUpPolicy.enabled && catchUpPolicy.maxReleaseClassArticles > 0
      ? [`- 릴리스 캐치업(release-class) 레인: 릴리스 채널(collectionModeHint \`release-note-watch\`) 소스의 미게재 릴리스는, 신규 선정이 목표를 채운 주에도 주요 기사 최대치 아래 여유 슬롯을 호당 최대 ${catchUpPolicy.maxReleaseClassArticles}개까지 쓸 수 있습니다. 같은 품질 하한·중복·게재 이력 검사를 그대로 통과해야 하며, 신규 콘텐츠를 밀어내지 않습니다.`]
      : []),
    // 이 블록은 EDITORIAL_POLICY.md로 생성돼 문서 전문이 editor·fact-check·judge·repair prompt에
    // 그대로 들어간다. 렌더된 블록에서 이 줄은 direct_aosp_camera 버킷 수에 붙은 유일한 숫자다
    // (실제 구성 하한 세 줄은 전부 "단일 기사 정책으로 비활성화됨"으로 렌더된다). 그래서 문장이
    // 조금이라도 상한처럼 읽히면 editor가 그 버킷 기사를 스스로 강등한다 — 2026-08-03 회귀와 같은
    // 계열이다. 발동 조건은 발행이 끝난 뒤 보는 사후 판정이므로 편집 지시가 아님을 문장 안에서
    // 못박고, 기사 수·버킷 구성에 아무 상한도 걸지 않는다는 사실을 함께 적는다.
    `- 심층(deep-dive) 발동 조건(파이프라인 내부 판정 — 편집 지시가 아닙니다): 위클리 발행이 모두 끝난 뒤, 그 주 최종 기사 중 \`direct_aosp_camera\` 버킷 수가 ${deepDivePolicy.directAospCameraMaxForActivation} 이하이면 심층 주제 큐에서 주제 하나를 고릅니다. 이 숫자는 기사 수 상한도, 버킷 구성 제한도 아닙니다 — 기사 수와 버킷 구성은 위의 주요 기사 수와 발행 가능 구성 규칙만 따릅니다. 1단계는 shadow라 결과는 report로만 남고 뉴스레터에는 실리지 않으므로, 편집 단계에서는 이 항목을 고려하지 마세요.`,
    `- 홈페이지 헤드라인 정책(homepage headline policy): ${headlinePolicy.decayModel} decay; 일별 감쇠 ${headlinePolicy.decayRatePerDay} point(s)/day; 교체 마진(replacement margin) ${headlinePolicy.replacementMargin}; 최소 헤드라인 점수(minimum headline score) ${headlinePolicy.minimumHeadlineScore}; 최신호 포함 필수(latest inclusion required) ${headlinePolicy.latestInclusionRequired}; 이력 최대(history max) ${headlinePolicy.historyMaxEntries}`,
    '- 발행 게이트(publish gate): PASS는 source gap이 없고, fact-check must_fix가 없으며, 차단성 감점(blocking deduction)이 없고, 모든 기사가 fact-checker에 의해 발행 가능으로 표시되어야 합니다. 수치 기반 품질 임계값은 없습니다.',
    '- 편집 품질(editorial quality): fact-checker(LLM)가 각 기사를 Camera HAL SW 엔지니어에게 유용한지 기준으로 판정합니다(주제 무관 — C++, AI, Linux 기사라도 해당 엔지니어에게 도움이 되면 자격이 있습니다). 주제/깊이 휴리스틱은 결정론적 발행 게이트로 사용하지 않습니다.',
    `- 하드 실패 조건은 계속 차단됩니다(hard fail conditions remain blocking): ${qualityGatePolicy.hardFailConditions.join('; ')}`,
    '',
    POLICY_BLOCK_END
  ].join('\n');
}

function markerPositions(text, marker) {
  const positions = [];
  let start = 0;
  while (start < text.length) {
    const index = text.indexOf(marker, start);
    if (index === -1) break;
    positions.push(index);
    start = index + marker.length;
  }
  return positions;
}

function analyzeNewsletterPolicyBlock(text, policy = getDefaultNewsletterPolicy()) {
  const beginPositions = markerPositions(text, POLICY_BLOCK_BEGIN);
  const endPositions = markerPositions(text, POLICY_BLOCK_END);
  const errors = [];
  if (beginPositions.length === 0) errors.push(`missing BEGIN marker ${POLICY_BLOCK_BEGIN}`);
  if (endPositions.length === 0) errors.push(`missing END marker ${POLICY_BLOCK_END}`);
  if (beginPositions.length > 1) errors.push(`duplicate BEGIN marker ${POLICY_BLOCK_BEGIN}`);
  if (endPositions.length > 1) errors.push(`duplicate END marker ${POLICY_BLOCK_END}`);
  if (beginPositions.length === 1 && endPositions.length === 1 && beginPositions[0] > endPositions[0]) {
    errors.push('marker order error: BEGIN marker must appear before END marker');
  }

  const expectedBlock = renderNewsletterPolicyBlock(policy);
  let actualBlock = '';
  if (errors.length === 0) {
    actualBlock = text.slice(beginPositions[0], endPositions[0] + POLICY_BLOCK_END.length);
    if (actualBlock !== expectedBlock) {
      errors.push('generated Newsletter Policy block drift');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    expectedBlock,
    actualBlock,
    beginCount: beginPositions.length,
    endCount: endPositions.length
  };
}

function replaceNewsletterPolicyBlock(text, { policy = getDefaultNewsletterPolicy() } = {}) {
  const beginPositions = markerPositions(text, POLICY_BLOCK_BEGIN);
  const endPositions = markerPositions(text, POLICY_BLOCK_END);
  const block = renderNewsletterPolicyBlock(policy);
  if (beginPositions.length === 0 && endPositions.length === 0) {
    return `${text.replace(/\s*$/, '')}\n\n${block}\n`;
  }

  const structuralErrors = analyzeNewsletterPolicyBlock(text, policy)
    .errors
    .filter(error => error !== 'generated Newsletter Policy block drift');
  if (structuralErrors.length > 0) {
    throw new Error(structuralErrors.join('; '));
  }

  return `${text.slice(0, beginPositions[0])}${block}${text.slice(endPositions[0] + POLICY_BLOCK_END.length)}`;
}

module.exports = {
  POLICY_BLOCK_BEGIN,
  POLICY_BLOCK_END,
  POLICY_REL_PATH,
  REQUIRED_HARD_FAIL_CONDITIONS,
  get articlePolicy() {
    return getArticlePolicy();
  },
  get qualityGatePolicy() {
    return getQualityGatePolicy();
  },
  get sourceEligibilityPolicy() {
    return getSourceEligibilityPolicy();
  },
  get mailingListPatchMainArticlePolicy() {
    return getMailingListPatchMainArticlePolicy();
  },
  get candidatePoolPreflightPolicy() {
    return getCandidatePoolPreflightPolicy();
  },
  get publishReadyCompositionPolicy() {
    return getPublishReadyCompositionPolicy();
  },
  get selectionWindowPolicy() {
    return getSelectionWindowPolicy();
  },
  get selectionScoringPolicy() {
    return getSelectionScoringPolicy();
  },
  get catchUpPolicy() {
    return getCatchUpPolicy();
  },
  get weeklyArticlePolicy() {
    return getWeeklyArticlePolicy();
  },
  get headlinePolicy() {
    return getHeadlinePolicy();
  },
  get deepDivePolicy() {
    return getDeepDivePolicy();
  },
  // Legacy compatibility exports only. New code should prefer articlePolicy and qualityGatePolicy.
  get MIN_MAIN_ARTICLES() {
    return getArticlePolicy().mainArticleCount.min;
  },
  get MAX_MAIN_ARTICLES() {
    return getArticlePolicy().mainArticleCount.max;
  },
  get QUALITY_THRESHOLD() {
    return getQualityGatePolicy().threshold;
  },
  analyzeNewsletterPolicyBlock,
  articleCountRangeText,
  getCandidatePoolPreflightPolicy,
  getCatchUpPolicy,
  getDeepDivePolicy,
  getPublishModePolicy,
  getDefaultNewsletterPolicy,
  getHeadlinePolicy,
  getMailingListPatchMainArticlePolicy,
  getPublishReadyCompositionPolicy,
  getSelectionScoringPolicy,
  getSelectionWindowPolicy,
  getSourceEligibilityPolicy,
  getWeeklyArticlePolicy,
  isForbiddenMainBucket,
  isMainArticleAllowedBucket,
  isPrimaryCameraStackBucket,
  isSupportingMainBucket,
  loadNewsletterPolicy,
  normalizeNewsletterPolicyConfig,
  publishGateCriteriaText,
  readPolicyConfig,
  renderNewsletterPolicyBlock,
  replaceNewsletterPolicyBlock,
  selectionWindowPolicyText,
  validateHeadlinePolicy,
  validateNewsletterPolicyConfig
};
