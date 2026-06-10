const { spawn } = require('node:child_process');
const {
  candidate: buildCandidate,
  retrySection
} = require('./newsroom-builders');

function runNodeAsync(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      encoding: 'utf8',
      ...options
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('close', status => {
      resolve({ status, stdout, stderr });
    });
  });
}

function onePublishableSupportingCandidate(date) {
  const url = 'https://example.com/snapdragon-isp-camera-thermal';
  const evidenceText = [
    'Snapdragon ISP camera thermal note 1.0 was published on 2026-05-11.',
    'The note changes sustained camera preview frame latency behavior for ISP/NPU workloads.',
    'Camera HAL readers should compare stream buffer metadata, Camera ITS logs, preview latency, and frame-drop metrics.'
  ].join(' ');
  return buildCandidate({
    title: 'Snapdragon ISP camera thermal note',
    source: 'Example Platform Source',
    url,
    published_date: `${date}T00:00:00Z`,
    summary: 'Snapdragon ISP camera thermal behavior changes sustained preview latency and buffer pressure validation.',
    collectionMode: 'release_note_item',
    isArticleCandidate: true,
    isWatchPage: false,
    hasDatedEvidence: true,
    evidenceLevel: 'dated_release',
    source_kind: 'official_release_note',
    finalSelectionEligibility: 'main',
    main_eligible: true,
    briefing_only: false,
    reference_only: false,
    evidence_score: 6,
    version_or_release: 'Snapdragon ISP camera thermal note 1.0',
    api_or_component: 'Snapdragon ISP camera thermal path',
    behavior_change: 'Sustained camera preview frame latency behavior changed for ISP/NPU workloads.',
    evidence_notes: [evidenceText],
    cross_check_status: 'official-source',
    editorial_priority: 5,
    relevance_bucket: 'soc_platform_signal',
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 5,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: false,
    counts_as_soc_topic: true,
    counts_as_fallback_topic: false,
    evidence_origin: 'source_extraction',
    source_hint: 'official-source',
    camera_hal_relevance_score: 2,
    android_camera_relevance_score: 3,
    practical_actionability_score: 5,
    source_reliability_score: 5,
    freshness_score: 3,
    ai_required_slot_fit_score: 0,
    cpp_fallback_value_score: 0,
    relevance_reason: 'Camera workload thermal behavior affects preview latency, buffer queues, and Camera ITS checks.',
    impact_areas: ['preview latency', 'buffer pressure', 'Camera ITS validation'],
    hal_impact_axes: ['performance_latency_thermal', 'stream_buffer_metadata'],
    reader_owners: ['camera_hal_owner', 'camera_test_owner'],
    actionability_level: 'owner_metric_log',
    effective_actionability_level: 'owner_metric_log',
    actionability_upgrade_reason: '',
    signal_quality_status: 'strong_signal',
    do_not_overstate: ['Do not claim source-proven platform API changes from the SoC note alone.'],
    fallback_promotion_allowed: true,
    fallback_promotion_reason: 'SoC camera thermal signal includes concrete camera workload validation checks.',
    fallback_guard_notes: ['Keep interpretation tied to preview latency, stream buffer metadata, and Camera ITS validation.'],
    soc_signal_type: 'isp_thermal_camera_workload',
    soc_signal_source_allowed: true,
    camera_pipeline_link: 'Camera preview frame latency, buffer queue pressure, stream metadata, and Camera ITS validation are affected by sustained ISP/NPU thermal behavior.',
    source_extraction: {
      release: {
        version: 'Snapdragon ISP camera thermal note 1.0',
        date,
        component: 'Snapdragon ISP camera thermal path',
        sections: [{
          heading: 'Camera workload thermal behavior',
          items: [{
            evidence_id: 'evidence-1',
            text: evidenceText,
            url
          }]
        }]
      }
    },
    compact_evidence: {
      primary_facts: [evidenceText],
      evidence_urls: [url],
      do_not_claim: ['Do not claim source-proven platform API changes from the SoC note alone.']
    },
    imageCandidates: []
  });
}

function onePublishableSupportingEditorDraft(date, candidate) {
  const section = retrySection(candidate.title, candidate.url);
  const evidenceText = candidate.source_extraction.release.sections[0].items[0].text;
  return {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'A single source-backed SoC camera workload signal is ready for Camera HAL validation planning.',
    briefing: [
      'Snapdragon ISP camera thermal behavior needs preview latency review.',
      'The selected source has dated evidence and source binding.',
      'Reserve candidates are not required for this one-article policy path.'
    ],
    sections: [{
      ...section,
      category: 'SoC Platform Signal',
      headline: candidate.title,
      what_changed: 'Snapdragon ISP camera thermal note 1.0 changed sustained camera preview frame latency behavior for ISP/NPU workloads.',
      confirmed_facts: [
        'Snapdragon ISP camera thermal note 1.0 was published on 2026-05-11.',
        'The note changes sustained camera preview frame latency behavior for ISP/NPU workloads.'
      ],
      evidence_summary: evidenceText,
      specificity_checks: [
        'Release date: 2026-05-11',
        'API/component: Snapdragon ISP camera thermal path',
        'Behavior change: sustained camera preview frame latency'
      ],
      source_verification_notes: ['Example Platform Source is treated as the official source in this mock workflow test.'],
      camera_hal_checks: [
        'Compare Camera ITS logs before and after the SoC thermal note.',
        'Measure preview latency, frame drops, and buffer queue pressure on one representative device class.'
      ],
      action_items: [
        'Within 2 weeks, assign a Camera HAL owner to compare Camera ITS logs for the ISP/NPU thermal path.',
        'Measure preview latency, frame-drop, stream buffer metadata, and buffer queue pressure on a representative device.'
      ],
      article_sections: {
        verified_facts: [
          'Snapdragon ISP camera thermal note 1.0 was published on 2026-05-11.',
          'The note changes sustained camera preview frame latency behavior for ISP/NPU workloads.'
        ],
        background_context: 'Sustained ISP/NPU thermal behavior can affect preview latency, frame drops, and buffer queue pressure in camera workloads.',
        hal_driver_impact: 'Compare preview latency, stream buffer metadata, Camera ITS logs, and frame-drop metrics on a representative thermal workload.',
        action_items: [
          'Within 2 weeks, assign a Camera HAL owner to compare Camera ITS logs for the ISP/NPU thermal path.',
          'Measure preview latency, frame-drop, stream buffer metadata, and buffer queue pressure on a representative device.'
        ],
        team_share_points: 'Share this as a bounded SoC camera workload signal, not as a source-proven platform API change.',
        do_not_claim: ['Do not claim source-proven platform API changes from the SoC note alone.']
      },
      public_article: {
        headline: candidate.title,
        lead: 'Snapdragon ISP thermal behavior gives Camera HAL teams a dated signal for preview latency and buffer-pressure checks.',
        body_paragraphs: [
          'Snapdragon ISP camera thermal note 1.0 was published on 2026-05-11 and describes sustained camera preview frame latency behavior for ISP/NPU workloads.',
          'For Camera HAL readers, the useful follow-up is to compare Camera ITS logs, stream buffer metadata, preview latency, frame drops, and buffer queue pressure on representative devices.'
        ],
        camera_hal_takeaway: 'Treat the note as a bounded SoC camera workload validation trigger, not as proof of a source-proven platform API change.',
        reader_checkpoints: [
          'Within 2 weeks, assign a Camera HAL owner to compare Camera ITS logs for the ISP/NPU thermal path.',
          'Measure preview latency, frame-drop, stream buffer metadata, and buffer queue pressure on a representative device.'
        ],
        source_links: [{
          title: candidate.source,
          url: candidate.url,
          source_role: 'primary'
        }]
      },
      claims: [{
        claim_id: 'claim-1',
        text: `${evidenceText} Snapdragon ISP camera thermal note 1.0 was published on 2026-05-11. The note changes sustained camera preview frame latency behavior for ISP/NPU workloads.`,
        claim_type: 'fact',
        evidence_ids: ['evidence-1'],
        source_urls: [candidate.url],
        impact_level: 'soc_resource_contention',
        overclaim_risk: 'low'
      }],
      hal_impact_axes: ['performance_latency_thermal', 'stream_buffer_metadata'],
      reader_owners: ['camera_hal_owner', 'camera_test_owner'],
      actionability_level: 'owner_metric_log',
      effective_actionability_level: 'owner_metric_log',
      actionability_upgrade_reason: '',
      signal_quality_status: 'strong_signal',
      do_not_overstate: ['Do not claim source-proven platform API changes from the SoC note alone.'],
      fallback_promotion_allowed: true,
      fallback_promotion_reason: 'SoC camera thermal signal includes concrete camera workload validation checks.',
      fallback_guard_notes: ['Keep interpretation tied to preview latency, stream buffer metadata, and Camera ITS validation.'],
      soc_signal_type: 'isp_thermal_camera_workload',
      soc_signal_source_allowed: true,
      camera_pipeline_link: candidate.camera_pipeline_link,
      relevance_bucket: 'soc_platform_signal',
      counts_as_primary_camera_topic: false,
      counts_as_soc_topic: true,
      counts_as_fallback_topic: false,
      evidence_origin: 'source_extraction',
      source_hint: 'official-source'
    }],
    action_items: [
      'Assign Camera HAL owner for the ISP/NPU thermal validation follow-up.'
    ],
    references: [{
      title: candidate.source,
      url: candidate.url
    }]
  };
}

module.exports = {
  onePublishableSupportingCandidate,
  onePublishableSupportingEditorDraft,
  runNodeAsync
};
