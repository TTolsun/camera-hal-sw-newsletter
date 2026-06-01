const {
  CLAIM_TYPES,
  CLAIM_IMPACT_LEVELS,
  OVERCLAIM_RISKS
} = require('../validate/claim-source-binding');

const string = { type: 'STRING' };
const number = { type: 'NUMBER' };
const stringArray = { type: 'ARRAY', items: string };
const briefingArray = { type: 'ARRAY', items: string, minItems: 3, maxItems: 3 };
const enumString = values => ({ type: 'STRING', enum: [...values] });
const source = {
  type: 'OBJECT',
  properties: {
    title: string,
    url: string
  },
  required: ['title', 'url']
};

const publicSourceLink = {
  type: 'OBJECT',
  properties: {
    title: string,
    url: string,
    publisher: string,
    source_role: string,
    checked_at: string
  },
  required: ['title', 'url']
};

const editorialStory = {
  type: 'OBJECT',
  properties: {
    reader_scenario: string,
    what_happened: string,
    why_it_matters: string,
    field_scenario: string,
    not_to_overclaim: string,
    editor_take: string
  },
  required: [
    'reader_scenario',
    'what_happened',
    'why_it_matters',
    'field_scenario',
    'not_to_overclaim',
    'editor_take'
  ]
};

const decisionMetadata = {
  type: 'OBJECT',
  properties: {
    impact: string,
    scope: stringArray,
    action: stringArray,
    overclaim_risk: string
  }
};

const publicArticle = {
  type: 'OBJECT',
  properties: {
    story_contract_version: number,
    source_subtitle: string,
    headline: string,
    lead: string,
    body_paragraphs: stringArray,
    camera_hal_takeaway: string,
    reader_checkpoints: stringArray,
    editorial_story: editorialStory,
    decision_metadata: decisionMetadata,
    source_links: {
      type: 'ARRAY',
      items: publicSourceLink
    }
  },
  required: [
    'headline',
    'source_subtitle',
    'lead',
    'body_paragraphs',
    'camera_hal_takeaway',
    'reader_checkpoints',
    'story_contract_version',
    'editorial_story',
    'source_links'
  ]
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
    team_share_points: string,
    known_limitations: stringArray,
    watch_items: stringArray,
    do_not_claim: stringArray
  },
  required: [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ],
  additionalProperties: false
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

const claimBinding = {
  type: 'OBJECT',
  properties: {
    claim_id: string,
    text: string,
    claim_type: enumString(CLAIM_TYPES),
    evidence_ids: stringArray,
    source_urls: stringArray,
    impact_level: enumString(CLAIM_IMPACT_LEVELS),
    overclaim_risk: enumString(OVERCLAIM_RISKS)
  },
  required: [
    'claim_id',
    'text',
    'claim_type',
    'evidence_ids',
    'source_urls',
    'impact_level',
    'overclaim_risk'
  ]
};

const actionabilityUpgradeEvidence = {
  type: 'OBJECT',
  properties: {
    source_url: string,
    evidence_id: string,
    matched_signal: string,
    verification_target: string,
    upgrade_from: string,
    upgrade_to: string
  }
};

const sourceQuality = {
  type: 'OBJECT',
  properties: {
    source_role: string,
    source_url_quality: string,
    source_quality_status: string,
    main_article_source_allowed: { type: 'BOOLEAN' },
    main_article_source_allowed_reason: string,
    main_article_source_blockers: stringArray,
    cross_check_status: string,
    requires_cross_check: { type: 'BOOLEAN' },
    requires_conditional_evidence: { type: 'BOOLEAN' },
    conditional_evidence_type: string,
    evidence_granularity: string,
    source_quality_notes: stringArray
  }
};

const reporterCandidate = {
  type: 'OBJECT',
  properties: {
    candidate_id: string,
    title: string,
    source: string,
    url: string,
    version_or_release: string,
    api_or_component: string,
    behavior_change: string,
    evidence_notes: stringArray,
    cross_check_status: string,
    relevance_reason: string,
    impact_areas: stringArray,
    do_not_overstate: stringArray
  },
  required: [
    'candidate_id',
    'title',
    'source',
    'url',
    'version_or_release',
    'api_or_component',
    'behavior_change',
    'evidence_notes',
    'cross_check_status',
    'relevance_reason',
    'impact_areas',
    'do_not_overstate'
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
    public_article: publicArticle,
    article_sections: articleSections,
    hal_signal_capsule: halSignalCapsule,
    claims: {
      type: 'ARRAY',
      items: claimBinding
    },
    hal_impact_axes: stringArray,
    reader_owners: stringArray,
    actionability_level: string,
    effective_actionability_level: string,
    actionability_upgrade_reason: string,
    actionability_upgrade_evidence: actionabilityUpgradeEvidence,
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
    article_group_key: string,
    tooling_workflow_type: string,
    source_quality: sourceQuality,
    source_quality_reason: string,
    source_role: string,
    source_url_quality: string,
    source_quality_status: string,
    main_article_source_allowed: { type: 'BOOLEAN' },
    main_article_source_allowed_reason: string,
    main_article_source_blockers: stringArray,
    relevance_bucket: string,
    editorial_priority: { type: 'NUMBER' },
    counts_as_primary_camera_topic: { type: 'BOOLEAN' },
    counts_as_driver_topic: { type: 'BOOLEAN' },
    counts_as_soc_topic: { type: 'BOOLEAN' },
    counts_as_fallback_topic: { type: 'BOOLEAN' },
    evidence_origin: string,
    source_hint: string,
    article_tier: string,
    topic_area: string,
    camera_output_relevance: { type: 'NUMBER' },
    newsletter_relevance: { type: 'NUMBER' },
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
    'public_article',
    'article_sections',
    'claims',
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
    public_contract_version: string,
    generation_contract_version: number,
    title: string,
    summary: string,
    briefing: briefingArray,
    sections: {
      type: 'ARRAY',
      items: section
    },
    action_items: stringArray,
    explicitly_demoted_groups: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          article_group_key: string,
          demotion_reason: string,
          reason_code: string
        },
        required: ['article_group_key', 'demotion_reason']
      }
    },
    hard_blocked_groups: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          article_group_key: string,
          hard_block_reason: string,
          reason_code: string
        },
        required: ['article_group_key', 'hard_block_reason']
      }
    },
    references: {
      type: 'ARRAY',
      items: source
    }
  },
  required: ['date', 'public_contract_version', 'generation_contract_version', 'title', 'summary', 'briefing', 'sections', 'action_items', 'references']
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

const publicArticleJudgeIssue = {
  type: 'OBJECT',
  properties: {
    section_index: number,
    field: string,
    severity: string,
    reason: string,
    suggested_fix: string
  },
  required: ['section_index', 'field', 'severity', 'reason']
};

const publicArticleJudgeSection = {
  type: 'OBJECT',
  properties: {
    section_index: number,
    headline: string,
    public_article_pass: { type: 'BOOLEAN' },
    reader_checkpoints_pass: { type: 'BOOLEAN' },
    source_boundary_pass: { type: 'BOOLEAN' },
    public_prose_pass: { type: 'BOOLEAN' },
    issues: {
      type: 'ARRAY',
      items: publicArticleJudgeIssue
    }
  },
  required: [
    'section_index',
    'headline',
    'public_article_pass',
    'reader_checkpoints_pass',
    'source_boundary_pass',
    'public_prose_pass',
    'issues'
  ]
};

const publicArticleJudgeSchema = {
  type: 'OBJECT',
  properties: {
    date: string,
    overall_pass: { type: 'BOOLEAN' },
    sections: {
      type: 'ARRAY',
      items: publicArticleJudgeSection
    }
  },
  required: ['date', 'overall_pass', 'sections']
};

const backgroundContextItem = {
  type: 'OBJECT',
  properties: {
    title: string,
    url: string,
    source_candidate_hash: string,
    relevance_bucket: string,
    background_context: string,
    background_basis: string,
    background_confidence: string,
    background_warnings: stringArray
  },
  required: [
    'title',
    'url',
    'source_candidate_hash',
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
  publicArticleJudgeSchema,
  backgroundContextSchema
};
