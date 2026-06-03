'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport
} = require('../../scripts/newsroom/validate/newsletter-quality');
const {
  qualityGatePolicy
} = require('../../scripts/newsroom/common/newsletter-policy');
const {
  reportFor,
  scopedCandidate,
  section,
  validSections,
  reporterCandidatesFor
} = require('../helpers/quality-builders');

function linkedEvidenceSummary(overrides = {}) {
  return {
    schema_version: 1,
    total_count: 1,
    by_type: { github_pull_request: 1 },
    by_fetch_status: { resolved: 1 },
    impact_type_counts: {},
    warning_count: 0,
    has_resolved_evidence: true,
    has_unresolved_evidence: false,
    top_identifiers: ['PR #123'],
    ...overrides
  };
}

function impactClassification(overrides = {}) {
  return {
    impact_type: 'runtime_behavior_change',
    hal_runtime_impact: true,
    camera_pipeline_impact: true,
    recommended_article_type: 'main',
    confidence: 0.75,
    reason: 'Synthetic linked evidence impact.',
    warnings: [],
    ...overrides
  };
}

function linkedEvidenceCandidate(url, bucket = 'direct_aosp_camera', overrides = {}) {
  return scopedCandidate(url, bucket, {
    linked_evidence_summary: linkedEvidenceSummary(),
    impact_classification: impactClassification(),
    ...overrides
  });
}

function storyQualityReport({
  headline = 'CameraX 1.5.0 gives HAL teams a preview regression target',
  sourceTitle = 'CameraX 1.5.0 release notes',
  briefing = [
    'CameraX update gives Camera HAL teams a preview regression check target.',
    'The source change affects HAL-facing stream metadata review scope, so compare logs.',
    'Keep the action to Watch and Test because the source does not prove HAL runtime changes.'
  ]
} = {}) {
  const slug = headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'default';
  const url = `https://example.com/story-source-${slug}`;
  const target = section({ headline, url });
  target.public_article = {
    ...target.public_article,
    story_contract_version: 1,
    headline
  };
  const rest = validSections().slice(1);
  return buildNewsletterQualityReport(
    '2026-05-03',
    {
      public_contract_version: 'story-v1',
      generation_contract_version: 1,
      briefing,
      sections: [target, ...rest]
    },
    {
      candidates: [
        scopedCandidate(url, 'android_platform_camera_adjacent', { title: sourceTitle }),
        ...reporterCandidatesFor(rest)
      ]
    },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 }
  );
}

test('reddit-only main article is blocked by source quality gate', () => {
  const sections = [
    section({ headline: 'Reddit-only camera HAL article', url: 'https://www.reddit.com/r/androiddev/comments/abc/camera_hal/' }),
    ...validSections().slice(1)
  ];
  const redditSourceQuality = {
    source_role: 'community_lead_source',
    source_url_quality: 'community_lead_requires_cross_check',
    source_quality_status: 'blocked',
    main_article_source_allowed: false,
    main_article_source_allowed_reason: 'Community-signal source is a discovery sensor and cannot be a primary main-article source.',
    main_article_source_blockers: ['candidate_only_without_primary_confirmation', 'cross_check_required_but_missing', 'community_signal_primary_source_disallowed'],
    cross_check_status: 'required_missing',
    requires_cross_check: true,
    evidence_granularity: 'article_with_primary_confirmation',
    source_quality_notes: []
  };
  const report = reportFor(sections, [
    scopedCandidate('https://www.reddit.com/r/androiddev/comments/abc/camera_hal/', 'direct_aosp_camera', {
      source_quality_required: true,
      source_id: 'reddit-androiddev-camera',
      community_signal: true,
      community_signal_source: 'reddit',
      source_quality: redditSourceQuality,
      sourceRole: 'community_lead_source',
      source_role: 'community_lead_source',
      sourceUrlQuality: 'community_lead_requires_cross_check',
      source_url_quality: 'community_lead_requires_cross_check',
      sourceQualityStatus: 'blocked',
      source_quality_status: 'blocked',
      mainArticleSourceAllowed: false,
      main_article_source_allowed: false,
      mainArticleSourceAllowedReason: 'Community-signal source is a discovery sensor and cannot be a primary main-article source.',
      main_article_source_allowed_reason: 'Community-signal source is a discovery sensor and cannot be a primary main-article source.',
      mainArticleSourceBlockers: ['candidate_only_without_primary_confirmation', 'cross_check_required_but_missing', 'community_signal_primary_source_disallowed'],
      main_article_source_blockers: ['candidate_only_without_primary_confirmation', 'cross_check_required_but_missing', 'community_signal_primary_source_disallowed'],
      crossCheckStatus: 'required_missing',
      cross_check_status: 'required_missing',
      requiresCrossCheck: true,
      requires_cross_check: true,
      evidenceGranularity: 'article_with_primary_confirmation',
      evidence_granularity: 'article_with_primary_confirmation',
      sourceQualityNotes: [],
      source_quality_notes: []
    }),
    ...reporterCandidatesFor(validSections()).slice(1)
  ]);

  assert.equal(report.score >= qualityGatePolicy.threshold, true);
  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item =>
    item.blocking === true &&
    item.reason.includes('main_article_source_allowed=false')
  ));
});

test('quality gate leaves direct HAL prose validity to LLM and editor judgment', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1';
  const cameraXSection = section({
    headline: 'CameraX direct HAL overclaim',
    url,
    what_changed: 'CameraX 1.6.1 was released on 2026-05-06 with a concrete release note.',
    confirmed_facts: ['CameraX 1.6.1 release note.'],
    evidence_summary: 'Version: CameraX 1.6.1; release date: 2026-05-06; API/component: CameraX / androidx.camera; behavior change: Fixed ListenableFuture compile error.',
    specificity_checks: ['Version: CameraX 1.6.1', 'Release date: 2026-05-06'],
    background: 'CameraX sits above camera2 and is framework-adjacent, not direct HAL contract evidence.',
    camera_hal_perspective: 'This changes direct Camera HAL API behavior.',
    camera_hal_checks: ['Run Camera ITS metadata validation.'],
    action_items: ['Run Camera ITS metadata validation.'],
    team_summary: 'Watch CameraX compatibility.',
    article_sections: {
      verified_facts: ['CameraX 1.6.1 release note.'],
      background_context: 'CameraX sits above camera2 and is not direct HAL contract evidence.',
      hal_driver_impact: 'This changes direct Camera HAL API behavior.',
      action_items: ['Run Camera ITS metadata validation.'],
      team_share_points: 'Watch CameraX compatibility.'
    },
    derived_editorial_hints: {
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      validation_targets: ['Camera ITS metadata validation']
    }
  });
  const candidate = scopedCandidate(url, 'android_platform_camera_adjacent', {
    title: 'CameraX Release Notes - CameraX 1.6.1',
    published_date: '2026-05-06',
    version_or_release: 'CameraX 1.6.1',
    api_or_component: 'CameraX / androidx.camera',
    behavior_change: 'Fixed ListenableFuture compile error.',
    derived_editorial_hints: {
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      validation_targets: ['Camera ITS metadata validation'],
      do_not_claim: ['Do not claim direct Camera HAL API changes.']
    },
    source_extraction: {
      adapter_id: 'android-developers-jetpack-release',
      source_type: 'release_note',
      release: {
        version: 'CameraX 1.6.1',
        date: '2026-05-06',
        component: 'CameraX / androidx.camera',
        sections: [{
          category: 'bug_fixes',
          heading: 'Bug Fixes',
          items: [{ text: 'Fixed ListenableFuture compile error.' }]
        }]
      },
      extraction_quality: {
        used_fallback: false,
        main_article_allowed: true
      }
    },
    extraction_quality: {
      used_fallback: false,
      main_article_allowed: true
    }
  });

  const report = reportFor(
    [cameraXSection, ...validSections().slice(1)],
    [candidate, ...reporterCandidatesFor(validSections()).slice(1)]
  );

  assert.equal(report.deductions.some(item =>
    item.category === 'source-integrity' &&
    item.reason.includes('direct HAL contract/API claim lacks direct source evidence')
  ), false);
});

test('quality gate allows product/version-only source title mentions in story briefing', () => {
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07';
  const storySection = section({
    headline: 'CameraX 1.4.0-alpha07 업데이트: preview/capture 호환성 확인',
    url
  });
  storySection.public_article = {
    ...storySection.public_article,
    story_contract_version: 1,
    headline: storySection.headline,
    source_subtitle: 'Android Developers · CameraX',
    editorial_story: {
      reader_scenario: '앱/framework 변경이 preview/capture 검증 범위에 들어오는지 triage하는 상황을 가정합니다.',
      what_happened: 'CameraX release note는 app/framework 계층의 preview/capture 호환성 검증 신호로 다룹니다.',
      why_it_matters: 'HAL 직접 변경이 아니라 app/framework 호환성 확인 범위로 제한합니다.',
      field_scenario: 'CameraX preview와 capture path를 regression check 후보로 확인합니다.',
      not_to_overclaim: 'HAL runtime 변경으로 확대하지 않습니다.',
      editor_take: 'source 범위 안에서만 실무 확인 항목으로 다룹니다.'
    },
    decision_metadata: {
      impact: 'Medium',
      scope: ['Framework'],
      action: ['Watch', 'Test'],
      overclaim_risk: 'Medium'
    }
  };
  const rest = validSections().slice(1);
  const report = buildNewsletterQualityReport(
    '2026-05-03',
    {
      public_contract_version: 'story-v1',
      generation_contract_version: 1,
      briefing: [
        'CameraX 1.4.0-alpha07은 preview/capture 호환성 검증 범위만 확인합니다.',
        '직접 HAL 변경 근거가 없는 항목은 참고 동향으로만 공유합니다.',
        '편집자는 source와 article 표현을 최종 확인합니다.'
      ],
      sections: [storySection, ...rest]
    },
    {
      candidates: [
        scopedCandidate(url, 'android_platform_camera_adjacent', {
          title: 'CameraX 1.4.0-alpha07'
        }),
        ...reporterCandidatesFor(rest)
      ]
    },
    { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0 }
  );

  assert.equal(report.deductions.some(item => item.reason === 'Briefing bullet includes a raw source title phrase.'), false);
  assert.equal(report.deductions.some(item => item.reason === 'Public headline exactly copies the source title.'), false);
});

test('quality gate rejects exact and punctuation-only story headline source title copies', () => {
  const exact = storyQualityReport({
    headline: 'CameraX 1.5.0 released for Android camera',
    sourceTitle: 'CameraX 1.5.0 released for Android camera'
  });
  const punctuationOnly = storyQualityReport({
    headline: 'CameraX 1.5.0 released for Android camera!',
    sourceTitle: 'CameraX 1.5.0 released for Android camera'
  });

  for (const report of [exact, punctuationOnly]) {
    assert.equal(report.status, 'NEEDS_FIX');
    assert.ok(report.deductions.some(item =>
      item.category === 'editorial-story' &&
      item.blocking === true &&
      item.reason === 'Public headline exactly copies the source title.'
    ));
  }
});

test('quality gate distinguishes product/version title overlap from source title copy', () => {
  const productOnly = storyQualityReport({
    headline: 'CameraX 1.5.0 preview regression check',
    sourceTitle: 'CameraX 1.5.0 released'
  });
  const shortNearCopy = storyQualityReport({
    headline: 'Driver sensor pipeline update',
    sourceTitle: 'Driver sensor pipeline'
  });

  assert.equal(productOnly.deductions.some(item =>
    /Public headline/.test(item.reason)
  ), false);
  assert.ok(shortNearCopy.deductions.some(item =>
    item.category === 'editorial-story' &&
    item.blocking === false &&
    item.reason === 'Short public headline is very close to the source title.'
  ));
  assert.equal(shortNearCopy.deductions.some(item =>
    item.blocking === true &&
    /Public headline/.test(item.reason)
  ), false);
});

test('quality gate fails high source-title token overlap and warns on moderate overlap', () => {
  const highOverlap = storyQualityReport({
    headline: 'HAL stream buffer metadata latency regression checklist review',
    sourceTitle: 'HAL stream buffer metadata latency regression checklist release'
  });
  const moderateOverlap = storyQualityReport({
    headline: 'HAL stream buffer metadata latency review note',
    sourceTitle: 'HAL stream buffer metadata latency regression checklist'
  });

  assert.ok(highOverlap.deductions.some(item =>
    item.category === 'editorial-story' &&
    item.blocking === true &&
    item.reason === 'Public headline is too similar to the source title after product/version discounting.'
  ));
  assert.ok(moderateOverlap.deductions.some(item =>
    item.category === 'editorial-story' &&
    item.blocking === false &&
    item.reason === 'Public headline is close to the source title and should be rewritten with reader-facing framing.'
  ));
});

test('quality gate flags briefing source copy and raw English release prose', () => {
  const rawSourceTitle = storyQualityReport({
    sourceTitle: 'Android CameraX stream buffer regression checklist',
    briefing: [
      'Android CameraX stream buffer regression checklist',
      'The source change affects HAL-facing stream metadata review scope, so compare logs.',
      'Keep the action to Watch and Test because the source does not prove HAL runtime changes.'
    ]
  });
  const englishReleaseProse = storyQualityReport({
    sourceTitle: 'CameraX 1.5.0',
    briefing: [
      'CameraX 1.5.0 has been released with support for preview checks.',
      'The source change affects HAL-facing stream metadata review scope, so compare logs.',
      'Keep the action to Watch and Test because the source does not prove HAL runtime changes.'
    ]
  });

  assert.ok(rawSourceTitle.deductions.some(item =>
    item.category === 'editorial-story' &&
    item.blocking === true &&
    item.reason === 'Briefing bullet includes a raw source title phrase.'
  ));
  assert.ok(englishReleaseProse.deductions.some(item =>
    item.category === 'editorial-story' &&
    item.blocking === false &&
    item.reason === 'Briefing bullet uses raw English release prose instead of Korean editorial framing.'
  ));
});

test('quality gate fails ambiguous duplicate normalized URL binding', () => {
  const sharedUrl = 'https://example.com/ambiguous';
  const ambiguous = section({
    headline: 'Ambiguous shared changelog item',
    url: sharedUrl,
    evidence_summary: 'Version: ambiguous; release date: 2026-05-01; API/component: CameraX; behavior change: compatibility validation.'
  });
  const report = reportFor([
    ambiguous,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ], [
    scopedCandidate(sharedUrl, 'direct_aosp_camera', { title: 'Alpha shared item' }),
    scopedCandidate(sharedUrl, 'direct_aosp_camera', { title: 'Beta shared item' }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ]);
  const result = report.article_results.find(item => item.headline === ambiguous.headline);

  assert.equal(result.status, 'FAIL');
  assert.ok(result.hard_fail_reasons.some(reason => reason.includes('Ambiguous source candidate match')));
});

test('quality gate fails shared release-note URL without matching date or version evidence', () => {
  const sharedUrl = 'https://example.com/release-notes';
  const releaseNote = section({
    headline: 'Release note article without matching item evidence',
    url: sharedUrl,
    evidence_summary: 'Version: CameraX 1.0; release date: 2026-05-01; API/component: CameraX; behavior change: stream validation.',
    specificity_checks: ['Version: CameraX 1.0', 'Release date: 2026-05-01']
  });
  const report = reportFor([
    releaseNote,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ], [
    scopedCandidate(sharedUrl, 'direct_aosp_camera', {
      title: 'CameraX 2.0 release notes',
      collectionMode: 'release-note-item',
      version_or_release: 'CameraX 2.0',
      published_date: '2026-05-02'
    }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ], { adjacentContentPublishing: false });
  const result = report.article_results.find(item => item.headline === releaseNote.headline);

  assert.equal(result.status, 'FAIL');
  assert.ok(result.hard_fail_reasons.some(reason => reason.includes('Shared watch/release-note URL requires matching')));
});

test('adjacent-content publishing relaxes shared release-note URL to a soft note', () => {
  const sharedUrl = 'https://example.com/release-notes';
  const releaseNote = section({
    headline: 'Release note article without matching item evidence',
    url: sharedUrl,
    evidence_summary: 'Version: CameraX 1.0; release date: 2026-05-01; API/component: CameraX; behavior change: stream validation.',
    specificity_checks: ['Version: CameraX 1.0', 'Release date: 2026-05-01']
  });
  const report = reportFor([
    releaseNote,
    section({ headline: 'CameraX release B', url: 'https://example.com/b' }),
    section({ headline: 'AOSP Camera change C', url: 'https://example.com/c' }),
    section({ headline: 'Camera HAL metadata update D', url: 'https://example.com/d' })
  ], [
    scopedCandidate(sharedUrl, 'direct_aosp_camera', {
      title: 'CameraX 2.0 release notes',
      collectionMode: 'release-note-item',
      version_or_release: 'CameraX 2.0',
      published_date: '2026-05-02'
    }),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/c', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/d', 'direct_aosp_camera')
  ], { adjacentContentPublishing: true });
  const relaxed = report.deductions.find(item =>
    item.adjacent_relaxed && /Shared watch\/release-note URL requires matching/.test(item.reason));
  assert.ok(relaxed, 'shared-URL deduction should be relaxed');
  assert.equal(relaxed.blocking, false);
  assert.ok(relaxed.points <= 2);
});

test('quality gate fails duplicate source URLs across main sections', () => {
  const sections = [
    section({ headline: 'CameraX release A', url: 'https://example.com/same' }),
    section({ headline: 'CameraX release B', url: 'https://example.com/same' }),
    section({ headline: 'AOSP Camera change', url: 'https://example.com/aosp' }),
    section({ headline: 'AI camera workflow', url: 'https://example.com/ai', is_ai_related: true, article_type: 'ai', what_changed: 'AI camera workflow changed on 2026-05-01 for Camera HAL stream testing.' })
  ];
  const report = reportFor(sections, [
    scopedCandidate('https://example.com/same', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/aosp', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/ai', 'direct_aosp_camera')
  ]);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.reason.includes('Duplicate source URL')));
  assert.ok(report.article_results.some(item =>
    item.status === 'FAIL' &&
    item.hard_fail_reasons.some(reason => reason.includes('Duplicate source URL'))
  ));
});
