// 이 파일의 editorSchema를 늘릴 때는 `npm run check:editor-schema-acceptance`로 실측하세요.
// Gemini의 constrained decoding은 스키마 상태 수가 많으면 호출 자체를 거부하는데, 그 한계는
// 공표된 수치가 없어 코드를 읽어 예측할 수 없습니다.

const {
  CLAIM_TYPES,
  CLAIM_IMPACT_LEVELS,
  OVERCLAIM_RISKS
} = require('../quality/claim-source-binding');

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

// editor responseSchema의 section은 LLM이 실제로 작성하는 필드만 담는다.
// selection/reporter capsule이 채우는 메타데이터(source_candidate_*, counts_as_*,
// relevance_bucket, editorial_priority, evidence_origin, source_hint, tooling_workflow_type,
// article_group_key)와 image resolver가 덮어쓰는 originalImage/resolvedImage, 그리고
// section 레벨에서 아무도 채우지 않던 source_quality·fallback_promotion·
// main_article_source_allowed·signal_quality_status·soc_signal_source_allowed 계열은 제외한다.
// 코드가 editor 출력 객체에 이 값들을 그대로 채우므로 출력은 보존되며, optional 필드가 줄어
// Gemini constrained-decoding의 "too many states" 상태 폭발이 사라진다(작은 fallback 모델
// gemini-2.5-flash / flash-lite 도 editor schema를 수용 — 실측 확인).
//
// 그 뒤 같은 목적으로 뺀 것이 더 있는데, 빼도 되는 이유가 위와 달라 나눠 적는다.
//
// (a) 코드 파생값으로 대체되는 것 — `public_article.decision_metadata`. 모델이 채워도
//     normalizeDecisionMetadata가 그 값을 버리고 deriveDecisionMetadata 결과로 덮는다
//     (public-article-contract.js). 값 자체는 종전대로 artifact에 남는다.
// (b) 아무도 읽지 않는 것 — actionability_upgrade_evidence, article_tier, topic_area,
//     camera_output_relevance, newsletter_relevance. 채우는 코드도 소비자도 없어서
//     스키마에서 빼면 그대로 사라진다. (a)와 달리 출력에 남지 않는다.
//
// 주의: actionability_upgrade_evidence는 editor 출력에서만 사라진다. 입력 capsule을 만드는
// hal-signal-quality.js·article-capsules.js의 생산 경로는 그대로 살아 있어야 한다.
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
    do_not_overstate: stringArray,
    soc_signal_type: string,
    camera_pipeline_link: string,
    camera_hal_checks: stringArray,
    action_hints: stringArray,
    action_items: stringArray,
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
    'public_article',
    'article_sections',
    'hal_signal_capsule',
    'claims',
    'camera_hal_checks',
    'action_hints',
    'action_items',
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

// #482: article-preserving repair patch. A repair-section fix returns only
// field-level replacements, never a full section rewrite, so the model cannot
// change which articles exist. `value` is intentionally STRING-only: every
// patchable leaf is a string or an element of a stringArray, so a string covers
// all of them while blocking an object/array that could smuggle in identity
// fields (sources, candidate_id, coverage_type, ...).
const editorRepairPatch = {
  type: 'OBJECT',
  properties: {
    section_index: number,
    section_key: string,
    op: enumString(['replace']),
    path: string,
    value: string
  },
  required: ['op', 'path', 'value']
};

const editorRepairPatchSchema = {
  type: 'OBJECT',
  properties: {
    patches: {
      type: 'ARRAY',
      items: editorRepairPatch
    }
  },
  required: ['patches']
};

// Per-article editorial-quality verdict. The criterion is NOT "is this a Camera HAL
// topic" but "how useful is this article to a Camera HAL SW engineer" — a C++, AI, or
// Linux article qualifies if it helps that engineer's work. The deterministic gate reads
// `publishable` as a boolean; `reason` is for the review artifact.
// `confidence` (#654) is the fact-checker's own self-assessment of how sure the verdict is
// (high/medium/low). It is surfaced to the human reviewer so a low-confidence block is
// visible; it is NOT a deterministic gate and does not change what publishes. It stays
// optional so the model is not forced and pre-#654 artifacts remain schema-valid.
const articleQualityVerdict = {
  type: 'OBJECT',
  properties: {
    section_index: number,
    headline: string,
    publishable: { type: 'BOOLEAN' },
    confidence: string,
    reason: string
  },
  required: ['section_index', 'publishable', 'reason']
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
    article_quality: {
      type: 'ARRAY',
      items: articleQualityVerdict
    },
    final_comment: string
  },
  required: ['status', 'must_fix', 'recommended_fixes', 'source_gaps', 'source_gap_count', 'article_quality', 'final_comment']
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

// #700: LLM editorial assessment & planning 단계가 selected article capsule마다 생성하는 내부
// editorial plan. coverage_decision/impact_level은 LLM 편집 추론용 internal scaffolding이며 public
// article에 라벨로 render하지 않는다. title/url/source_candidate_hash는 capsule과 매칭하기 위한
// echo-only 식별자다.
const editorialPlanItem = {
  type: 'OBJECT',
  properties: {
    title: string,
    url: string,
    source_candidate_hash: string,
    coverage_decision: string,
    impact_level: string,
    direct_hal_impact: { type: 'BOOLEAN' },
    target_description: string,
    editorial_angle: string,
    why_it_matters: string,
    reader_takeaway: string,
    misunderstanding_risks: stringArray,
    source_limitations: stringArray
  },
  required: [
    'title',
    'url',
    'source_candidate_hash',
    'coverage_decision',
    'impact_level',
    'direct_hal_impact',
    'target_description',
    'editorial_angle',
    'why_it_matters',
    'reader_takeaway'
  ]
};

const editorialPlanSchema = {
  type: 'OBJECT',
  properties: {
    date: string,
    editorial_plans: {
      type: 'ARRAY',
      items: editorialPlanItem
    }
  },
  required: ['date', 'editorial_plans']
};

module.exports = {
  reporterSchema,
  editorSchema,
  // weekly 중복 병합(#870)도 같은 public_article을 요구한다. 모양을 따로 적으면 계약이
  // 갈라지므로 이 정의를 그대로 쓴다.
  publicArticleSchema: publicArticle,
  editorCompletionSchema,
  editorRepairPatchSchema,
  factCheckSchema,
  publicArticleJudgeSchema,
  backgroundContextSchema,
  editorialPlanSchema
};
