const { buildNewsletterQualityReport } = require('../../../../scripts/newsroom/validate/newsletter-quality');
const { articlePolicy } = require('../../common/newsletter-policy');

function source(url, title = 'Source') {
  return { title, url };
}

function section(overrides = {}) {
  const title = overrides.headline || 'CameraX 1.5 release gives HAL teams a compatibility target';
  const value = {
    category: 'Android Camera',
    fixture_meta: {
      provenance: 'synthetic',
      purpose: 'newsletter quality contract fixture',
      must_not_be_used_as_golden_public_artifact: true
    },
    headline: title,
    what_changed: 'CameraX 1.5.0 was released on 2026-05-01 with Android Camera compatibility behavior.',
    confirmed_facts: ['CameraX 1.5.0 release date: 2026-05-01.'],
    evidence_summary: 'Version: CameraX 1.5.0; release date: 2026-05-01; API/component: CameraX; behavior change: compatibility validation target.',
    specificity_checks: ['Version: CameraX 1.5.0', 'Release date: 2026-05-01'],
    source_verification_notes: ['Official source, dated release evidence.'],
    camera_hal_checks: ['Run Camera ITS focused scenes on CameraX-backed capture paths.'],
    action_items: [
      'Within 2 weeks, assign a camera owner to compare Camera ITS logs before and after CameraX 1.5.0.',
      'Measure preview/capture latency and frame drop metrics on at least one legacy and one flagship device.'
    ],
    is_ai_related: false,
    article_type: 'camera-hal',
    hal_impact_axes: ['framework_hal_contract', 'stream_buffer_metadata', 'camerax_app_compatibility'],
    reader_owners: ['camera_hal_owner', 'camera_framework_owner', 'camera_test_owner'],
    actionability_level: 'owner_metric_log',
    effective_actionability_level: 'owner_metric_log',
    actionability_upgrade_reason: '',
    signal_quality_status: 'strong_signal',
    do_not_overstate: ['Do not claim a direct Camera HAL API change unless the source says so.'],
    fallback_promotion_allowed: true,
    fallback_promotion_reason: 'Primary Camera Stack candidate with dated source evidence.',
    fallback_guard_notes: ['Keep CameraX claims framework-adjacent unless source evidence says direct HAL.'],
    soc_signal_type: '',
    soc_signal_source_allowed: true,
    camera_pipeline_link: 'CameraX compatibility maps to camera2 stream and metadata validation.',
    hal_signal_capsule: {
      why_now: 'CameraX 1.5.0 gives HAL teams a dated compatibility validation trigger.',
      reader_owners: ['camera_hal_owner', 'camera_framework_owner', 'camera_test_owner'],
      check_within_2_weeks: 'Assign a camera owner to compare Camera ITS logs, preview latency, and metadata consistency within 2 weeks.',
      impact_axes: ['framework_hal_contract', 'stream_buffer_metadata', 'camerax_app_compatibility'],
      do_not_overstate: ['Do not claim a direct Camera HAL API change unless the source says so.']
    },
    sources: [source(overrides.url || 'https://example.com/camerax')],
    ...overrides
  };
  const halDriverImpact = 'Validate request/result metadata, stream combinations, Camera ITS scenes, latency, frame drop, thermal, and buffer behavior on representative devices.';
  if (!Object.prototype.hasOwnProperty.call(overrides, 'article_sections')) {
    value.article_sections = {
      verified_facts: value.confirmed_facts,
      background_context: 'CameraX sits above camera2 and exposes compatibility regressions that can map back to Camera HAL stream and metadata behavior.',
      hal_driver_impact: halDriverImpact,
      action_items: value.action_items,
      team_share_points: 'Use CameraX 1.5.0 as a concrete compatibility validation trigger.'
    };
  }
  if (!Object.prototype.hasOwnProperty.call(overrides, 'public_article')) {
    value.public_article = {
      headline: value.headline,
      lead: `${value.headline} gives Camera HAL teams a source-backed validation signal.`,
      body_paragraphs: [
        `${value.headline} was selected from dated source evidence for Camera HAL readers.`,
        'The practical interpretation stays limited to stream, buffer, metadata, Camera ITS, latency, and frame-drop validation.'
      ],
      camera_hal_takeaway: halDriverImpact,
      reader_checkpoints: value.action_items,
      source_links: value.sources.map(source => ({
        title: source.title,
        url: source.url,
        source_role: 'primary'
      }))
    };
  }
  return value;
}

function reporterCandidate(url, overrides = {}) {
  return {
    title: 'Reporter candidate',
    url,
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    reference_only: false,
    selected: true,
    camera_hal_relevance_score: 5,
    android_camera_relevance_score: 5,
    practical_actionability_score: 5,
    ...overrides
  };
}

function scopedCandidate(url, bucket, overrides = {}) {
  const bucketDefaults = {
    direct_aosp_camera: {
      editorial_priority: 1,
      aosp_camera_directness: 5,
      counts_as_primary_camera_topic: true
    },
    camera_driver_image_pipeline: {
      editorial_priority: 2,
      driver_stack_relevance: 5,
      counts_as_driver_topic: true
    },
    android_platform_camera_adjacent: {
      editorial_priority: 3,
      aosp_camera_directness: 2,
      counts_as_primary_camera_topic: true
    },
    android_multimedia_camera_output: {
      editorial_priority: 4,
      multimedia_camera_output_relevance: 5
    },
    soc_platform_signal: {
      editorial_priority: 5,
      soc_platform_relevance: 5,
      counts_as_soc_topic: true
    },
    cpp_ai_tooling_fallback: {
      editorial_priority: 6,
      native_tooling_relevance: 5,
      counts_as_fallback_topic: true
    },
    generic_tech_watchlist: {
      editorial_priority: 7
    }
  };
  return reporterCandidate(url, {
    relevance_bucket: bucket,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false,
    evidence_origin: 'candidate_metadata',
    ...bucketDefaults[bucket],
    ...overrides
  });
}

function reportFor(sections, reporterCandidates, options = {}) {
  return buildNewsletterQualityReport(
    '2026-05-03',
    {
      briefing: ['one', 'two', 'three'],
      sections
    },
    { candidates: reporterCandidates },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 },
    options
  );
}

function validSections(count = articlePolicy.mainArticleCount.min) {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'AOSP Camera change B', url: 'https://example.com/b' }),
    section({ headline: 'Android Camera API change C', url: 'https://example.com/c' }),
    section({
      headline: 'AI camera workflow D',
      url: 'https://example.com/ai',
      is_ai_related: true,
      article_type: 'ai',
      what_changed: 'AI camera workflow changed on 2026-05-01 for Camera HAL stream testing.',
      evidence_summary: 'Version: AI workflow 1.0; release date: 2026-05-01; API/component: Android Camera frame pipeline; behavior change: camera frame inference validation.',
      specificity_checks: ['Version: AI workflow 1.0', 'Release date: 2026-05-01']
    })
  ];
  return sections.slice(0, count);
}

function reporterCandidatesFor(sections) {
  return sections.map(item => scopedCandidate(item.sources[0].url, 'direct_aosp_camera'));
}

module.exports = {
  reporterCandidate,
  reporterCandidatesFor,
  reportFor,
  scopedCandidate,
  section,
  source,
  validSections
};
