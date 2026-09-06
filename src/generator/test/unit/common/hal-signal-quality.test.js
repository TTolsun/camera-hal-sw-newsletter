const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMainArticleSignalChecks,
  buildHalSignalQualitySummary,
  completeHalSignalCapsuleFromExistingFields,
  countActionabilityUpgradeSignals,
  countConcreteActionSignals,
  inferActionabilityLevel,
  inferEffectiveActionabilityLevel,
  inferHalImpactAxes,
  normalizeHalSignalCapsule,
  normalizeHalSignalFields
} = require('../../../reporter/hal-signal-quality');

function article(overrides = {}) {
  return {
    headline: 'CameraX release gives HAL teams a validation target',
    url: 'https://example.com/camerax-release',
    evidence_id: 'evidence-camerax-release',
    fixture_meta: {
      provenance: 'synthetic',
      purpose: 'HAL signal quality regression fixture',
      must_not_be_used_as_golden_public_artifact: true
    },
    relevance_bucket: 'android',
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
  const stringGuardrail = normalizeHalSignalCapsule(article({
    hal_signal_capsule: {
      why_now: 'Dated source.',
      reader_owners: ['camera_hal_owner'],
      check_within_2_weeks: 'Run Camera ITS.',
      impact_axes: ['framework_hal_contract'],
      do_not_overstate: 'Do not claim direct HAL API changes.'
    }
  }));

  assert.equal(complete.complete, true);
  assert.equal(missing.present, false);
  assert.equal(missing.complete, false);
  assert.ok(missing.missing_keys.includes('why_now'));
  assert.deepEqual(stringGuardrail.capsule.do_not_overstate, ['Do not claim direct HAL API changes.']);
});

test('completes HAL Signal Capsule from existing fields in fallback mode', () => {
  const result = completeHalSignalCapsuleFromExistingFields(article({
    hal_signal_capsule: undefined
  }), {
    mode: 'fallback_completion'
  });

  assert.equal(result.complete, true);
  assert.equal(result.capsule.check_within_2_weeks, 'Within 2 weeks, assign a camera owner to run Camera ITS.');
  assert.ok(result.capsule.impact_axes.includes('camerax_app_compatibility'));
  assert.deepEqual(result.reason_codes, []);
});

test('strict editor HAL Signal Capsule repair uses only dated source context and existing action items', () => {
  const result = completeHalSignalCapsuleFromExistingFields(article({
    hal_signal_capsule: undefined,
    evidence_summary: 'No date in the evidence text.',
    fallback_guard_notes: ['Do not copy fallback guard notes into strict repair.'],
    sources: [{
      title: 'Source',
      url: 'https://example.com/source',
      date: '2026-05-02'
    }]
  }), {
    mode: 'editor_deterministic_repair'
  });

  assert.equal(result.complete, true);
  assert.equal(result.capsule.why_now, 'Source date 2026-05-02 provides the dated context for this HAL validation signal.');
  assert.equal(result.capsule.check_within_2_weeks, 'Within 2 weeks, assign a camera owner to run Camera ITS.');
  assert.deepEqual(result.capsule.do_not_overstate, [
    '출처 근거를 넘어 기기 적용, HAL API 변경, 양산 영향으로 확대 해석하지 않는다.'
  ]);
});

test('strict editor HAL Signal Capsule repair rejects generic action item fallback', () => {
  const result = completeHalSignalCapsuleFromExistingFields(article({
    hal_signal_capsule: undefined,
    article_sections: {
      verified_facts: ['CameraX 1.5.0 release date: 2026-05-01.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'Review the source only when concrete HAL evidence appears.',
      action_items: ['Review this topic.'],
      team_share_points: 'No concrete two-week verification target is present.'
    },
    sources: [{
      title: 'Source',
      url: 'https://example.com/source',
      date: '2026-05-02'
    }]
  }), {
    mode: 'editor_deterministic_repair'
  });

  assert.equal(result.complete, false);
  assert.ok(result.reason_codes.includes('missing_concrete_two_week_check'));
});

test('strict editor HAL Signal Capsule repair prefers structured source dates over prose dates', () => {
  const result = completeHalSignalCapsuleFromExistingFields(article({
    hal_signal_capsule: undefined,
    evidence_summary: 'Team should review follow-up work by 2026-05-30.',
    source_verification_notes: 'Source note mentions a later review date of 2026-05-31.',
    sources: [{
      title: 'Source',
      url: 'https://example.com/source',
      published_date: '2026-05-02'
    }]
  }), {
    mode: 'editor_deterministic_repair'
  });

  assert.equal(result.complete, true);
  assert.equal(result.capsule.why_now, 'Source date 2026-05-02 provides the dated context for this HAL validation signal.');
});

test('strict editor HAL Signal Capsule repair does not use generation date as why_now', () => {
  const result = completeHalSignalCapsuleFromExistingFields(article({
    hal_signal_capsule: undefined,
    evidence_summary: 'Review follow-up by 2026-05-30, but this is not source publication context.',
    date: '2026-05-08',
    sources: [{
      title: 'Source',
      url: 'https://example.com/source'
    }]
  }), {
    mode: 'editor_deterministic_repair'
  });

  assert.equal(result.complete, false);
  assert.ok(result.reason_codes.includes('missing_why_now_context'));
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
  assert.equal(inferEffectiveActionabilityLevel(value), 'owner_metric_log');
  assert.ok(countActionabilityUpgradeSignals(value) >= 2);
  assert.equal(normalized.actionability_level, 'generic_review');
  assert.equal(normalized.effective_actionability_level, 'owner_metric_log');
  assert.match(normalized.actionability_upgrade_reason, /source-bound/);
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

test('explicit none does not upgrade from CameraX mention without verification target', () => {
  const value = article({
    url: 'https://example.com/camerax-productivity',
    evidence_id: 'evidence-camerax-productivity',
    headline: 'CameraX improves developer productivity',
    actionability_level: 'none',
    article_sections: {
      verified_facts: ['The article mentions CameraX developer productivity.'],
      background_context: 'CameraX improves developer productivity.',
      hal_driver_impact: 'Review when concrete camera workflow evidence appears.',
      action_items: [],
      team_share_points: 'No observable verification target is present.'
    },
    hal_signal_capsule: {
      why_now: 'The source is dated.',
      reader_owners: ['camera_framework_owner'],
      check_within_2_weeks: '',
      impact_axes: ['camerax_app_compatibility'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(normalized.effective_actionability_level, 'none');
  assert.equal(normalized.actionability_upgrade_reason, '');
});

test('source URL with generic action wording does not upgrade actionability', () => {
  const value = article({
    url: 'https://example.com/generic-source',
    evidence_id: '',
    actionability_level: 'none',
    article_sections: {
      verified_facts: ['A dated source exists.'],
      background_context: 'The source is relevant background context.',
      hal_driver_impact: 'Review the source when planning future camera work.',
      action_items: ['Review the source later.'],
      team_share_points: 'No observable validation target is present.'
    },
    hal_signal_capsule: {
      why_now: 'The source is dated.',
      reader_owners: ['camera_framework_owner'],
      check_within_2_weeks: 'Review the source later.',
      impact_axes: ['camerax_app_compatibility'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(normalized.effective_actionability_level, 'none');
  assert.equal(normalized.actionability_upgrade_reason, '');
});

test('negated test requirements do not upgrade actionability', () => {
  const value = article({
    url: 'https://example.com/no-test-required',
    evidence_id: 'evidence-no-test-required',
    actionability_level: 'none',
    article_sections: {
      verified_facts: ['A dated source says no CTS/VTS test required for this change.'],
      background_context: 'CameraX is mentioned as background.',
      hal_driver_impact: 'No CTS/VTS test required; track only if a later camera-specific note appears.',
      action_items: ['No CTS/VTS test required for this source.'],
      team_share_points: 'Do not turn negated testing language into an action item.'
    },
    hal_signal_capsule: {
      why_now: 'The source is dated.',
      reader_owners: ['camera_framework_owner'],
      check_within_2_weeks: 'No CTS/VTS test required for this source.',
      impact_axes: ['camerax_app_compatibility'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(normalized.effective_actionability_level, 'none');
  assert.equal(normalized.actionability_upgrade_reason, '');
});

test('article-level evidence id without observable action target does not upgrade', () => {
  const value = article({
    url: '',
    evidence_id: 'evidence-background-only',
    actionability_level: 'none',
    article_sections: {
      verified_facts: ['A dated source mentions CameraX.'],
      background_context: 'CameraX appears in article background only.',
      hal_driver_impact: 'Review when concrete stream, log, metric, or API evidence appears.',
      action_items: ['Keep this as background context.'],
      team_share_points: 'No observable validation target is present.'
    },
    hal_signal_capsule: {
      why_now: 'The source is dated.',
      reader_owners: ['camera_framework_owner'],
      check_within_2_weeks: 'Keep this as background context.',
      impact_axes: ['camerax_app_compatibility'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(normalized.effective_actionability_level, 'none');
  assert.equal(normalized.actionability_upgrade_reason, '');
});

test('single weak trace keyword is capped below measurable test', () => {
  const value = article({
    url: 'https://example.com/perfetto-only',
    evidence_id: 'evidence-perfetto-only',
    actionability_level: 'none',
    article_sections: {
      verified_facts: ['A dated source mentions a trace workflow.'],
      background_context: 'Camera teams may review the trace workflow.',
      hal_driver_impact: 'Check Perfetto trace output for CameraX preview behavior.',
      action_items: ['Check Perfetto trace output for CameraX preview behavior.'],
      team_share_points: 'Trace review only.'
    },
    hal_signal_capsule: {
      why_now: 'The source gives a trace review trigger.',
      reader_owners: ['camera_framework_owner'],
      check_within_2_weeks: 'Check Perfetto trace output for CameraX preview behavior.',
      impact_axes: ['camerax_app_compatibility'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(normalized.effective_actionability_level, 'concrete_check');
  assert.notEqual(normalized.effective_actionability_level, 'measurable_test');
  assert.equal(normalized.actionability_upgrade_evidence.upgrade_to, 'concrete_check');
});

test('source-bound observable action upgrades explicit none', () => {
  const value = article({
    url: 'https://example.com/camerax-frame-metrics',
    evidence_id: 'evidence-camerax-frame-metrics',
    actionability_level: 'none',
    article_sections: {
      verified_facts: ['A dated source gives a CameraX stream validation trigger.'],
      background_context: 'CameraX sits above camera2.',
      hal_driver_impact: 'Check CameraX stream behavior with adb logs and compare frame timing metrics within two weeks.',
      action_items: ['Check CameraX stream behavior with adb logs and compare frame timing metrics within two weeks.'],
      team_share_points: 'Use it for app-compat validation.'
    },
    hal_signal_capsule: {
      why_now: 'The source gives a dated validation trigger.',
      reader_owners: ['camera_framework_owner'],
      check_within_2_weeks: 'Check CameraX stream behavior with adb logs and compare frame timing metrics within two weeks.',
      impact_axes: ['camerax_app_compatibility'],
      do_not_overstate: ['Do not claim direct HAL behavior changes.']
    }
  });
  const normalized = normalizeHalSignalFields(value);

  assert.equal(normalized.actionability_level, 'none');
  assert.equal(normalized.effective_actionability_level, 'measurable_test');
  assert.equal(normalized.actionability_upgrade_evidence.source_url, 'https://example.com/camerax-frame-metrics');
  assert.equal(normalized.actionability_upgrade_evidence.evidence_id, 'evidence-camerax-frame-metrics');
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

test('multimedia camera-output bucket gets supporting axis without fallback promotion blocker', () => {
  const value = article({
    headline: 'Android APV camera output update',
    relevance_bucket: 'android_multimedia_camera_output',
    evidence_summary: 'Android introduces Advanced Professional Video for camera capture output.',
    hal_signal_capsule: undefined,
    article_sections: {
      verified_facts: ['APV was announced for Android camera output.'],
      background_context: 'APV is camera output / multimedia supporting context.',
      hal_driver_impact: 'Review captured video output assumptions without claiming direct HAL API changes.',
      action_items: ['Check app-facing video output validation notes.'],
      team_share_points: 'Supporting camera output signal.'
    }
  });
  const normalized = normalizeHalSignalFields(value);
  const summary = buildHalSignalQualitySummary([value]);
  const axes = inferHalImpactAxes(value);

  assert.ok(axes.includes('stream_buffer_metadata'));
  assert.equal(axes.includes('framework_hal_contract'), false);
  assert.equal(normalized.hal_signal_hard_blockers.includes('fallback_promotion_missing_reason'), false);
  assert.equal(summary.android_multimedia_camera_output_count, 1);
  assert.equal(summary.fallback_main_article_count, 0);
});

test('explicit unknown signal quality status is preserved', () => {
  const normalized = normalizeHalSignalFields(article({
    signal_quality_status: 'unknown'
  }));

  assert.equal(normalized.signal_quality_status, 'unknown');
});

test('source title is not used as a URL fallback', () => {
  const check = buildMainArticleSignalChecks([article({
    url: '',
    evidence_id: '',
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
