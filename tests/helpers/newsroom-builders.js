function candidate(overrides = {}) {
  const title = overrides.title || 'CameraX 1.5 release improves Android Camera compatibility';
  const urlTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    title,
    source: overrides.source || 'Android Developers',
    url: overrides.url || `https://example.com/${urlTitle}`,
    published_date: overrides.published_date || '2026-05-01T00:00:00Z',
    summary: overrides.summary || 'CameraX release changes Android Camera behavior and compatibility validation.',
    reliability: overrides.reliability || 'official',
    finalSelectionEligibility: overrides.finalSelectionEligibility || 'main',
    isWatchPage: overrides.isWatchPage || false,
    hasDatedEvidence: overrides.hasDatedEvidence !== undefined ? overrides.hasDatedEvidence : true,
    source_gap_risk: overrides.source_gap_risk || false,
    main_eligible: overrides.main_eligible !== undefined ? overrides.main_eligible : true,
    briefing_only: overrides.briefing_only || false,
    reference_only: overrides.reference_only || false,
    evidence_score: overrides.evidence_score !== undefined ? overrides.evidence_score : 6,
    camera_hal_relevance_score: overrides.camera_hal_relevance_score !== undefined ? overrides.camera_hal_relevance_score : 100,
    api_or_component: overrides.api_or_component || 'CameraX',
    behavior_change: overrides.behavior_change || 'Release updates CameraX compatibility behavior.',
    ...overrides
  };
}

function retrySection(headline, url) {
  return {
    category: headline,
    headline,
    what_changed: `${headline} changed on 2026-05-01.`,
    confirmed_facts: [`${headline} was published on 2026-05-01.`],
    evidence_summary: `Version/release: ${headline}; release date: 2026-05-01; API/component: Camera HAL.`,
    specificity_checks: ['Release date: 2026-05-01', 'API/component: Camera HAL'],
    source_verification_notes: ['Synthetic official source for targeted retry tests.'],
    background: `${headline} is relevant to AOSP Camera validation context.`,
    why_it_matters: `${headline} gives HAL teams a review target.`,
    camera_hal_perspective: `${headline} should be checked through stream, buffer, metadata, Camera ITS, latency, and frame-drop validation.`,
    camera_hal_checks: ['Run Camera ITS and inspect stream/metadata logs.'],
    action_items: [
      'Assign a HAL owner to inspect Camera ITS logs within 2 weeks.',
      'Measure preview latency, frame drop, and metadata consistency on a representative device.'
    ],
    team_summary: `${headline} should be shared as a HAL validation input.`,
    article_sections: {
      verified_facts: [`${headline} was published on 2026-05-01.`],
      background_context: `${headline} is relevant to AOSP Camera validation context.`,
      hal_driver_impact: `${headline} should be checked through stream, buffer, metadata, Camera ITS, latency, and frame-drop validation.`,
      action_items: [
        'Assign a HAL owner to inspect Camera ITS logs within 2 weeks.',
        'Measure preview latency, frame drop, and metadata consistency on a representative device.'
      ],
      team_share_points: `${headline} should be shared as a HAL validation input.`
    },
    is_ai_related: false,
    article_type: 'camera-hal',
    imageCandidates: [],
    selectedImage: '',
    imageSource: '',
    imageAttribution: '',
    imageAlt: '',
    imageLicenseStatus: 'none',
    imageUsageDecisionReason: 'No image needed for synthetic retry tests.',
    sources: [{ title: headline, url }]
  };
}

function reserveReporterCandidate(overrides = {}) {
  return {
    title: overrides.title || 'Camera HAL reserve candidate',
    url: overrides.url || 'https://example.com/reserve',
    source: overrides.source || 'Example Source',
    published_date: overrides.published_date || '2026-05-05',
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    evidence_score: 6,
    camera_hal_relevance_score: 4,
    android_camera_relevance_score: 3,
    practical_actionability_score: 3,
    relevance_bucket: 'direct_aosp_camera',
    editorial_priority: 1,
    deterministic_score: 90,
    final_selected: false,
    selected_for_editor: false,
    reserve_candidate: true,
    ...overrides
  };
}

module.exports = {
  candidate,
  reserveReporterCandidate,
  retrySection
};
