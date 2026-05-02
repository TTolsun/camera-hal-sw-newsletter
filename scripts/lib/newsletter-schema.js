const string = { type: 'STRING' };
const stringArray = { type: 'ARRAY', items: string };
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
    camera_hal_relevance_score: { type: 'NUMBER' },
    android_camera_relevance_score: { type: 'NUMBER' },
    practical_actionability_score: { type: 'NUMBER' },
    source_reliability_score: { type: 'NUMBER' },
    freshness_score: { type: 'NUMBER' },
    ai_required_slot_fit_score: { type: 'NUMBER' },
    cpp_fallback_value_score: { type: 'NUMBER' },
    relevance_reason: string,
    impact_areas: stringArray,
    imageCandidates: {
      type: 'ARRAY',
      items: imageCandidate
    },
    selected: { type: 'BOOLEAN' }
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
    background: string,
    why_it_matters: string,
    camera_hal_perspective: string,
    camera_hal_checks: stringArray,
    action_hints: stringArray,
    action_items: stringArray,
    team_summary: string,
    is_ai_related: { type: 'BOOLEAN' },
    article_type: string,
    imageCandidates: {
      type: 'ARRAY',
      items: imageCandidate
    },
    selectedImage: string,
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
    briefing: stringArray,
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

module.exports = {
  reporterSchema,
  editorSchema,
  factCheckSchema
};
