const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMainArticleSignalChecks,
  buildHalSignalQualitySummary,
  countActionabilityUpgradeSignals,
  countConcreteActionSignals,
  inferActionabilityLevel,
  inferEffectiveActionabilityLevel,
  inferHalImpactAxes,
  normalizeHalSignalCapsule,
  normalizeHalSignalFields
} = require('../../../scripts/newsroom/common/hal-signal-quality');

function article(overrides = {}) {
  return {
    headline: 'CameraX release gives HAL teams a validation target',
    fixture_meta: {
      provenance: 'synthetic',
      purpose: 'HAL signal quality regression fixture',
      must_not_be_used_as_golden_public_artifact: true
    },
    relevance_bucket: 'android_platform_camera_adjacent',
    evidence_summary: 'CameraX 1.5.0 was released on 2026-05-01.',
    article_sections: {
      verified_facts: ['CameraX 1.5.0 release date: 2026-05-01.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'Validate stream, buffer, metadata, CTS, VTS, and Camera ITS behavior.',
      action_items: [
        'Within 2 weeks, assign a camera owner to run Camera ITS.',
        'Measure preview latency, frame drop, and metadata consistency.'
      ],
      team_share_points: 'Use this as a compatibility validation trigger.'
    },
    hal_signal_capsule: {
      why_now: 'The release gives a dated validation trigger.',
      reader_owners: ['camera_hal_owner', 'camera_test_owner'],
      check_within_2_weeks: 'Run Camera ITS and metadata checks within 2 weeks.',
      impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
      do_not_overstate: ['Do not claim direct HAL API changes.']
    },
    ...overrides
  };
}

test('infers HAL axes and concrete actionability from article-level evidence', () => {
  const value = article();

  assert.deepEqual(inferHalImpactAxes(value).includes('stream_buffer_metadata'), true);
  assert.ok(countConcreteActionSignals(value) >= 2);
  assert.notEqual(inferActionabilityLevel(value), 'generic_review');
});

test('normalizes capsule completeness without synthesizing missing content', () => {
  const complete = normalizeHalSignalCapsule(article());
  const missing = normalizeHalSignalCapsule(article({ hal_signal_capsule: undefined }));

  assert.equal(complete.complete, true);
  assert.equal(missing.present, false);
  assert.equal(missing.complete, false);
  assert.ok(missing.missing_keys.includes('why_now'));
});

test('generic review with weak signals is a main article hard blocker', () => {
  const normalized = normalizeHalSignalFields(article({
    headline: 'Generic release',
    relevance_bucket: 'generic_tech_watchlist',
    actionability_level: 'generic_review',
    evidence_summary: 'Generic release.',
    article_sections: {
      verified_facts: ['Generic release exists.'],
      background_context: 'Generic developer productivity update.',
      hal_driver_impact: 'Review later.',
      action_items: ['Review later.'],
      team_share_points: 'No concrete camera workflow.'
    },
    hal_signal_capsule: {
      why_now: 'Generic release.',
      reader_owners: ['unknown'],
      check_within_2_weeks: 'Review later.',
      impact_axes: ['reference_only'],
      do_not_overstate: ['Do not promote.']
    }
  }));

  assert.equal(normalized.actionability_level, 'generic_review');
  assert.ok(normalized.hal_signal_hard_blockers.includes('missing_hal_impact_axis'));
  assert.ok(normalized.hal_signal_hard_blockers.includes('generic_review_actionability'));
});

test('explicit generic review preserves original actionability and records effective upgrade', () => {
  const value = article({
    actionability_level: 'generic_review',
    article_sections: {
      verified_facts: ['CameraX 1.5.0 release date: 2026-05-01.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'Validate stream, buffer, metadata, and Camera ITS behavior.',
      action_items: [
        'Within 2 weeks, assign a camera owner to run Camera ITS.',
        'Measure preview latency and metadata consistency.'
      ],
      team_share_points: 'Use this as a compatibility validation trigger.'
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(inferActionabilityLevel(value), 'generic_review');
  assert.equal(inferEffectiveActionabilityLevel(value), 'concrete_check');
  assert.ok(countActionabilityUpgradeSignals(value) >= 2);
  assert.equal(normalized.actionability_level, 'generic_review');
  assert.equal(normalized.effective_actionability_level, 'concrete_check');
  assert.match(normalized.actionability_upgrade_reason, /concrete/);
  assert.equal(normalized.hal_signal_hard_blockers.includes('generic_review_actionability'), false);
});

test('explicit generic review does not upgrade from timeframe-only wording', () => {
  const value = article({
    headline: 'Generic device release',
    evidence_summary: 'Generic device release.',
    actionability_level: 'generic_review',
    article_sections: {
      verified_facts: ['Generic device release exists.'],
      background_context: 'Generic device platform release. Do not infer Camera HAL impact.',
      hal_driver_impact: 'Review within 2 weeks only if matching evidence appears.',
      action_items: ['Review within 2 weeks.'],
      team_share_points: 'No concrete verification target is present.'
    },
    hal_signal_capsule: {
      why_now: 'Generic release. Review within 2 weeks.',
      reader_owners: ['unknown'],
      check_within_2_weeks: 'Review within 2 weeks.',
      impact_axes: ['reference_only'],
      do_not_overstate: ['Do not promote.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(countActionabilityUpgradeSignals(value), 0);
  assert.equal(normalized.actionability_level, 'generic_review');
  assert.equal(normalized.effective_actionability_level, 'generic_review');
  assert.equal(normalized.actionability_upgrade_reason, '');
  assert.ok(normalized.hal_signal_hard_blockers.includes('generic_review_actionability'));
});

test('generic review does not upgrade from keyword soup outside concrete action', () => {
  const value = article({
    headline: 'Generic platform note',
    actionability_level: 'generic_review',
    article_sections: {
      verified_facts: ['A platform article mentions camera owner, stream, buffer, and metadata.'],
      background_context: 'These words appear in background only.',
      hal_driver_impact: 'Review later.',
      action_items: ['Review later.'],
      team_share_points: 'No concrete test, log, metric, or API check is specified.'
    },
    hal_signal_capsule: {
      why_now: 'General platform note.',
      reader_owners: ['camera_hal_owner'],
      check_within_2_weeks: 'Review later.',
      impact_axes: ['stream_buffer_metadata'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(countActionabilityUpgradeSignals(value), 0);
  assert.equal(normalized.actionability_level, 'generic_review');
  assert.equal(normalized.effective_actionability_level, 'generic_review');
  assert.ok(normalized.hal_signal_hard_blockers.includes('generic_review_actionability'));
});

test('fallback promotion requires both allowed flag and promotion reason', () => {
  const normalized = normalizeHalSignalFields(article({
    headline: 'Native tooling fallback with denied promotion',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    fallback_promotion_allowed: false,
    fallback_promotion_reason: 'Native tooling is useful but not enough for main promotion.',
    article_sections: {
      verified_facts: ['Native tooling release date: 2026-05-01.'],
      background_context: 'Native tooling may help camera debugging.',
      hal_driver_impact: 'Use sanitizer logs for Camera HAL stream and buffer debugging.',
      action_items: ['Within 2 weeks, assign a HAL owner to inspect sanitizer logs.'],
      team_share_points: 'Useful only as a fallback signal.'
    }
  }));

  assert.ok(normalized.hal_signal_hard_blockers.includes('fallback_promotion_missing_reason'));
});

test('SoC platform signal requires explicit camera pipeline link for promotion', () => {
  const value = article({
    headline: 'Mobile SoC thermal update',
    relevance_bucket: 'soc_platform_signal',
    soc_signal_source_allowed: true,
    camera_pipeline_link: '',
    fallback_promotion_allowed: true,
    fallback_promotion_reason: 'Thermal/power signal may affect sustained camera usage.',
    article_sections: {
      verified_facts: ['Mobile SoC update mentions thermal and memory behavior.'],
      background_context: 'Camera workloads may be affected by platform resources.',
      hal_driver_impact: 'Review camera thermal behavior.',
      action_items: ['Assign camera owner to review thermal logs.'],
      team_share_points: 'Potential platform signal.'
    }
  });
  const normalized = normalizeHalSignalFields(value);
  const check = buildMainArticleSignalChecks([value])[0];

  assert.equal(normalized.soc_signal_source_allowed, true);
  assert.ok(normalized.hal_signal_hard_blockers.includes('soc_platform_missing_camera_pipeline_link'));
  assert.ok(check.hard_blocker_reason_codes.includes('soc_camera_pipeline_link_missing'));
});

test('explicit unknown signal quality status is preserved', () => {
  const normalized = normalizeHalSignalFields(article({
    signal_quality_status: 'unknown'
  }));

  assert.equal(normalized.signal_quality_status, 'unknown');
});

test('source title is not used as a URL fallback', () => {
  const check = buildMainArticleSignalChecks([article({
    sources: [{ title: 'Not a URL' }]
  })])[0];

  assert.equal(check.url, '');
});

test('summary counts capsule coverage and hard blockers', () => {
  const summary = buildHalSignalQualitySummary([
    article(),
    article({
      headline: 'Weak watchlist',
      relevance_bucket: 'generic_tech_watchlist',
      actionability_level: 'none',
      hal_signal_capsule: undefined,
      article_sections: {
        verified_facts: ['Generic release.'],
        background_context: 'Generic.',
        hal_driver_impact: 'No Camera HAL impact is identified.',
        action_items: [],
        team_share_points: 'Do not promote.'
      }
    })
  ]);

  assert.equal(summary.main_article_count, 2);
  assert.equal(summary.article_count_with_hal_signal_capsule, 1);
  assert.equal(summary.article_count_without_hal_signal_capsule, 1);
  assert.equal(summary.generic_signal_hard_blocker_count, 1);
});
