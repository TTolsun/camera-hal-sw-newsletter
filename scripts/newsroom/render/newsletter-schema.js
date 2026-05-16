const string = { type: 'STRING' };
const stringArray = { type: 'ARRAY', items: string };
const briefingArray = { type: 'ARRAY', items: string, minItems: 3, maxItems: 3 };
const source = {
  type: 'OBJECT',
  properties: {
    title: string,
    url: string
  },
  required: ['title', 'url']
};

const imageCandidate = {
  type: 'OBJECT',
  properties: {
    url: string,
    sourceUrl: string,
    articleUrl: string,
    sourceKind: string,
    width: { type: 'NUMBER' },
    height: { type: 'NUMBER' },
    alt: string,
    contentType: string,
    licenseStatus: string,
    attribution: string,
    validationStatus: string
  },
  required: ['url', 'sourceUrl', 'articleUrl', 'sourceKind', 'licenseStatus', 'attribution', 'validationStatus']
};

const resolvedImage = {
  type: 'OBJECT',
  properties: {
    url: string,
    src: string,
    originalUrl: string,
    originalSrc: string,
    usedFallback: { type: 'BOOLEAN' },
    reason: string
  }
};

const articleSections = {
  type: 'OBJECT',
  properties: {
    verified_facts: stringArray,
    background_context: string,
    hal_driver_impact: string,
    action_items: stringArray,
    team_share_points: string
  },
  required: [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]
};

const halSignalCapsule = {
  type: 'OBJECT',
  properties: {
    why_now: string,
    reader_owners: stringArray,
    check_within_2_weeks: string,
    impact_axes: stringArray,
    do_not_overstate: stringArray
  },
  required: [
    'why_now',
    'reader_owners',
    'check_within_2_weeks',
    'impact_axes',
    'do_not_overstate'
  ]
};

const reporterCandidate = {
  type: 'OBJECT',
  properties: {
    title: string,
    source: string,
    published_date: string,
    url: string,
    summary: string,
    version_or_release: string,
    api_or_component: string,
    behavior_change: string,
    collectionMode: string,
    isArticleCandidate: { type: 'BOOLEAN' },
    isWatchPage: { type: 'BOOLEAN' },
    hasDatedEvidence: { type: 'BOOLEAN' },
    evidenceLevel: string,
    finalSelectionEligibility: string,
    source_kind: string,
    source_gap_risk: { type: 'BOOLEAN' },
    main_eligible: { type: 'BOOLEAN' },
    briefing_only: { type: 'BOOLEAN' },
    reference_only: { type: 'BOOLEAN' },
    evidence_score: { type: 'NUMBER' },
    evidence_notes: stringArray,
    cross_check_status: string,
    editorial_priority: { type: 'NUMBER' },
    relevance_bucket: string,
    aosp_camera_directness: { type: 'NUMBER' },
    driver_stack_relevance: { type: 'NUMBER' },
    soc_platform_relevance: { type: 'NUMBER' },
    native_tooling_relevance: { type: 'NUMBER' },
    counts_as_primary_camera_topic: { type: 'BOOLEAN' },
    counts_as_driver_topic: { type: 'BOOLEAN' },
    counts_as_soc_topic: { type: 'BOOLEAN' },
    counts_as_fallback_topic: { type: 'BOOLEAN' },
    impact_claim_level: string,
    evidence_origin: string,
    source_hint: string,
    camera_hal_relevance_score: { type: 'NUMBER' },
    android_camera_relevance_score: { type: 'NUMBER' },
    practical_actionability_score: { type: 'NUMBER' },
    source_reliability_score: { type: 'NUMBER' },
    freshness_score: { type: 'NUMBER' },
    ai_required_slot_fit_score: { type: 'NUMBER' },
    cpp_fallback_value_score: { type: 'NUMBER' },
    relevance_reason: string,
    impact_areas: stringArray,
    hal_impact_axes: stringArray,
    reader_owners: stringArray,
    actionability_level: string,
    effective_actionability_level: string,
    actionability_upgrade_reason: string,
    signal_quality_status: string,
    do_not_overstate: stringArray,
    fallback_promotion_allowed: { type: 'BOOLEAN' },
    fallback_promotion_reason: string,
    fallback_guard_notes: stringArray,
    soc_signal_type: string,
    soc_signal_source_allowed: { type: 'BOOLEAN' },
    camera_pipeline_link: string,
    imageCandidates: {
      type: 'ARRAY',
      items: imageCandidate
    },
    selected: { type: 'BOOLEAN' },
    final_selected: { type: 'BOOLEAN' },
    selected_for_editor: { type: 'BOOLEAN' },
    primary_selected: { type: 'BOOLEAN' },
    reserve_candidate: { type: 'BOOLEAN' },
    selection_slot: string
  },
  required: [
    'title',
    'source',
    'published_date',
    'url',
    'summary',
    'version_or_release',
    'api_or_component',
    'behavior_change',
    'collectionMode',
    'isArticleCandidate',
    'isWatchPage',
    'hasDatedEvidence',
    'evidenceLevel',
    'finalSelectionEligibility',
    'source_kind',
    'source_gap_risk',
    'main_eligible',
    'briefing_only',
    'reference_only',
    'evidence_score',
    'evidence_notes',
    'cross_check_status',
    'editorial_priority',
    'relevance_bucket',
    'aosp_camera_directness',
    'driver_stack_relevance',
    'soc_platform_relevance',
    'native_tooling_relevance',
    'counts_as_primary_camera_topic',
    'counts_as_driver_topic',
    'counts_as_soc_topic',
    'counts_as_fallback_topic',
    'evidence_origin',
    'source_hint',
    'camera_hal_relevance_score',
    'android_camera_relevance_score',
    'practical_actionability_score',
    'source_reliability_score',
    'freshness_score',
    'ai_required_slot_fit_score',
    'cpp_fallback_value_score',
    'relevance_reason',
    'impact_areas',
    'imageCandidates',
    'selected'
  ]
};

const section = {
  type: 'OBJECT',
  properties: {
    category: string,
    headline: string,
    what_changed: string,
    confirmed_facts: stringArray,
    evidence_summary: string,
    specificity_checks: stringArray,
    source_verification_notes: stringArray,
    article_sections: articleSections,
    hal_signal_capsule: halSignalCapsule,
    hal_impact_axes: stringArray,
    reader_owners: stringArray,
    actionability_level: string,
    effective_actionability_level: string,
    actionability_upgrade_reason: string,
    signal_quality_status: string,
    do_not_overstate: stringArray,
    fallback_promotion_allowed: { type: 'BOOLEAN' },
    fallback_promotion_reason: string,
    fallback_guard_notes: stringArray,
    soc_signal_type: string,
    soc_signal_source_allowed: { type: 'BOOLEAN' },
    camera_pipeline_link: string,
    background: string,
    why_it_matters: string,
    camera_hal_perspective: string,
    camera_hal_checks: stringArray,
    action_hints: stringArray,
    action_items: stringArray,
    team_summary: string,
    is_ai_related: { type: 'BOOLEAN' },
    article_type: string,
    source_candidate_url: string,
    source_candidate_hash: string,
    relevance_bucket: string,
    editorial_priority: { type: 'NUMBER' },
    counts_as_primary_camera_topic: { type: 'BOOLEAN' },
    counts_as_driver_topic: { type: 'BOOLEAN' },
    counts_as_soc_topic: { type: 'BOOLEAN' },
    counts_as_fallback_topic: { type: 'BOOLEAN' },
    impact_claim_level: string,
    evidence_origin: string,
    source_hint: string,
    imageCandidates: {
      type: 'ARRAY',
      items: imageCandidate
    },
    selectedImage: string,
    originalImage: string,
    resolvedImage,
    imageSource: string,
    imageAttribution: string,
    imageAlt: string,
    imageLicenseStatus: string,
    imageUsageDecisionReason: string,
    sources: {
      type: 'ARRAY',
      items: source
    }
  },
  required: [
    'category',
    'headline',
    'what_changed',
    'confirmed_facts',
    'evidence_summary',
    'specificity_checks',
    'source_verification_notes',
    'background',
    'why_it_matters',
    'camera_hal_perspective',
    'camera_hal_checks',
    'action_hints',
    'action_items',
    'team_summary',
    'is_ai_related',
    'article_type',
    'imageCandidates',
    'selectedImage',
    'imageSource',
    'imageAttribution',
    'imageAlt',
    'imageLicenseStatus',
    'imageUsageDecisionReason',
    'sources'
  ]
};

const mustFix = {
  type: 'OBJECT',
  properties: {
    location: string,
    problem: string,
    suggestion: string,
    source_url: string
  },
  required: ['location', 'problem', 'suggestion', 'source_url']
};

const reporterSchema = {
  type: 'OBJECT',
  properties: {
    date: string,
    candidates: {
      type: 'ARRAY',
      items: reporterCandidate
    }
  },
  required: ['date', 'candidates']
};

const editorSchema = {
  type: 'OBJECT',
  properties: {
    date: string,
    title: string,
    summary: string,
    briefing: briefingArray,
    sections: {
      type: 'ARRAY',
      items: section
    },
    action_items: stringArray,
    references: {
      type: 'ARRAY',
      items: source
    }
  },
  required: ['date', 'title', 'summary', 'briefing', 'sections', 'action_items', 'references']
};

const editorCompletionSchema = {
  type: 'OBJECT',
  properties: {
    sections: {
      type: 'ARRAY',
      items: section
    }
  },
  required: ['sections']
};

const factCheckSchema = {
  type: 'OBJECT',
  properties: {
    status: string,
    must_fix: {
      type: 'ARRAY',
      items: mustFix
    },
    recommended_fixes: stringArray,
    source_gaps: stringArray,
    source_gap_count: { type: 'NUMBER' },
    final_comment: string
  },
  required: ['status', 'must_fix', 'recommended_fixes', 'source_gaps', 'source_gap_count', 'final_comment']
};

const backgroundContextItem = {
  type: 'OBJECT',
  properties: {
    title: string,
    url: string,
    source_candidate_hash: string,
    relevance_bucket: string,
    impact_claim_level: string,
    background_context: string,
    background_basis: string,
    background_confidence: string,
    background_warnings: stringArray
  },
  required: [
    'title',
    'url',
    'source_candidate_hash',
    'impact_claim_level',
    'background_context',
    'background_basis',
    'background_confidence',
    'background_warnings'
  ]
};

const backgroundContextSchema = {
  type: 'OBJECT',
  properties: {
    date: string,
    background_contexts: {
      type: 'ARRAY',
      items: backgroundContextItem
    }
  },
  required: ['date', 'background_contexts']
};

module.exports = {
  reporterSchema,
  editorSchema,
  editorCompletionSchema,
  factCheckSchema,
  backgroundContextSchema
};
