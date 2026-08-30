const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildArticleCapsule,
  buildArticleCapsuleReport,
  capsuleInputForCandidates,
  capsuleInputFromReport,
  compactSelectionContext
} = require('../../../select/article-capsules');
const {
  stableSourceExtractionItemId
} = require('../../../quality/claim-source-binding');

function candidate(overrides = {}) {
  return {
    title: 'Camera HAL metadata update improves Android Camera validation',
    url: 'https://example.com/camera-hal-metadata?utm=1',
    source: 'Android Developers',
    published_date: '2026-05-01T00:00:00Z',
    summary: 'Camera HAL metadata behavior changed for Android Camera validation. '.repeat(20),
    version_or_release: 'Camera HAL test pack 2026.05',
    api_or_component: 'Camera HAL metadata',
    behavior_change: 'Metadata validation now catches request/result mismatch for stream combinations.',
    evidence_notes: ['Official dated release note with API/component and behavior evidence.'],
    score_breakdown: {
      total: 91,
      camera_hal_directness: 5,
      evidence_specificity: 5,
      freshness_score: 3,
      practical_actionability: 4,
      source_reliability: 5,
      optional_ai_cpp_bonus: 0
    },
    deterministic_score: 91,
    final_selected: true,
    selected_for_editor: true,
    selection_slot: 'camera-platform',
    finalSelectionEligibility: 'main',
    isWatchPage: false,
    hasDatedEvidence: true,
    source_gap_risk: false,
    source_quality_required: true,
    source_quality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_release_note_anchor',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Source policy allows this candidate with concrete source evidence.',
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'versioned_release_row',
      source_quality_notes: []
    },
    main_article_score_eligible: true,
    imageCandidates: [
      {
        url: 'https://example.com/image.png',
        sourceUrl: 'https://example.com/article',
        articleUrl: 'https://example.com/article',
        licenseStatus: 'unknown',
        attribution: 'Android Developers',
        validationStatus: 'ok'
      }
    ],
    ...overrides
  };
}

test('article capsule keeps compact PR4 fields and score breakdown', () => {
  const capsule = buildArticleCapsule(candidate());

  assert.equal(capsule.title, 'Camera HAL metadata update improves Android Camera validation');
  assert.equal(capsule.topic_type, 'camera-hal');
  assert.equal(capsule.component, 'Camera HAL metadata');
  assert.equal(capsule.risk.source_gap, false);
  assert.equal(capsule.risk.no_dated_evidence, false);
  assert.equal(capsule.score.total, 91);
  assert.equal(capsule.score.camera_hal_directness, 5);
  assert.equal(capsule.source_quality.source_url_quality, 'official_release_note_anchor');
  assert.equal(capsule.main_article_readiness.source_ready, true);
  assert.equal(capsule.main_article_readiness.selection_input_ready, true);
  assert.equal(capsule.main_article_readiness.selection_ready, true);
  assert.equal(capsule.main_article_readiness.selection_input_ready, capsule.main_article_readiness.selection_ready);
  assert.deepEqual(capsule.source_quality_field_drift, []);
  assert.equal(capsule.requires_conditional_evidence, false);
  assert.equal(capsule.conditional_evidence_type, '');
  assert.equal(capsule.selection.final_selected, true);
  assert.deepEqual(capsule.related_context_candidates, []);
  assert.equal(capsule.source_fact_bundle.source_url, 'https://example.com/camera-hal-metadata?utm=1');
  assert.deepEqual(capsule.source_fact_bundle.facts, []);
  assert.ok(capsule.evidence.length > 0);
  // allowed_claim_evidence가 결정론 검증기와 같은 텍스트 조각을 전부 싣게 되면서 이 fixture의
  // capsule이 1163 -> 1254 토큰으로 늘었다. fixture는 evidence 필드를 실제 후보보다 많이 채워 둔
  // 편이라 증가폭이 크게 잡히며, 2026-08-03 실제 후보 capsule은 오히려 1545 -> 1516으로 줄었다.
  //
  // 이 1300은 **이 fixture의 회귀 잠금**이지 발행 예산 상한이 아니다. 실제 후보는 이 값을 일상적으로
  // 넘고(커밋된 주간 산출물 52건 중 46건이 1300 초과, 최대 5867) 그것이 발행을 막지 않는다. 실제
  // 후보 capsule이 커졌다는 이유로 이 숫자를 올리거나 내리지 마라.
  assert.ok(capsule.estimated_tokens <= 1300);
  assert.equal(Object.hasOwn(capsule, 'impact_claim_level'), false);
});

// 릴리스 후보는 behavior_change/version_or_release/api_or_component가 전부 후보 자신을 되뇌는
// 문장이다. 이 셋이 evidence를 다 채우면 본문에서 온 문장은 구조적으로 한 칸도 들어가지 못한다.
// 2026-08-24호의 유일한 main 기사가 이 경로로 나가, 실제 변경(imx296 embedded data revert)을
// 본문에서 한 번도 언급하지 못한 채 발행됐다.
//
// 후보는 evidence_note, seed fact, summary_cache를 함께 들고 오는 것이 정상이다(reporter 프롬프트가
// evidence_notes를 요구한다). 본문 자리를 그 보조 근거 **뒤에** 두면 노트 하나만 있어도 같은 실패가
// 그대로 재현되므로, 여기서는 보조 근거를 다 채운 프로덕션 형태로 잠근다. 잠그는 것은 "본문에서 온
// 문장이 최소 한 칸 들어간다"이지 특정 배치가 아니다 — 순서를 고정하면 이슈가 결함이라고 부른
// 배치를 계약으로 굳히게 된다.
test('article capsule keeps one evidence slot for the release body', () => {
  const releaseCandidate = {
    title: 'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817',
    source: 'Raspberry Pi libcamera Releases',
    version_or_release: 'v0.7.2+rpt20260817',
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).',
    summary_cache: { summary: 'Cached release tag page text.' },
    compact_evidence: { primary_facts: ['Seed fact about the release tag.'] }
  };

  const fromSummary = buildArticleCapsule(candidate({
    ...releaseCandidate,
    summary: 'Revert "ipa: rpi: imx296: Enable embedded data" Right now embedded data with the imx296 cannot be negotiated with the CFE.'
  }));
  assert.ok(
    fromSummary.evidence.some(line => /imx296/.test(line)),
    '보조 근거가 있어도 summary 본문이 최소 한 칸 들어가야 한다'
  );

  const fromReleaseBullet = buildArticleCapsule(candidate({
    ...releaseCandidate,
    summary: 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).',
    source_extraction: {
      release: {
        version: 'v0.7.2+rpt20260817',
        sections: [{
          category: 'fixes',
          heading: 'Changes',
          items: [{ text: 'Revert imx296 embedded data stream enablement.' }]
        }]
      }
    }
  }));
  assert.ok(
    fromReleaseBullet.evidence.some(line => /imx296/.test(line)),
    '추출된 릴리스 불릿도 같은 본문 칸을 쓴다'
  );
});

// 본문 없이 태그만 올린 릴리스는 수집기가 summary와 behavior_change에 같은 문장을 넣는다
// (raspberrypi-libcamera-releases.js의 `releaseBodyText(block) || releaseSentence`). 라벨만 다른
// 완전 중복을 프롬프트에 두 줄 실으면 이슈가 지적한 자기참조 되뇌기를 한 줄 더 늘리는 셈이다.
test('article capsule does not repeat one sentence under two evidence labels', () => {
  const releaseSentence = 'Released v0.7.2+rpt20260817 (Raspberry Pi downstream libcamera).';
  const capsule = buildArticleCapsule(candidate({
    title: 'Raspberry Pi libcamera Releases - v0.7.2+rpt20260817',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2%2Brpt20260817',
    source: 'Raspberry Pi libcamera Releases',
    version_or_release: 'v0.7.2+rpt20260817',
    api_or_component: 'libcamera / V4L2 camera pipeline',
    behavior_change: releaseSentence,
    summary: releaseSentence
  }));

  assert.equal(
    capsule.evidence.filter(line => line.endsWith(releaseSentence)).length,
    1,
    '같은 문장이 라벨만 바꿔 두 번 들어가면 안 된다'
  );
});

test('article capsule preserves image provenance (sourceKind, contentType) for the gate', () => {
  const capsule = buildArticleCapsule(candidate({
    imageCandidates: [
      {
        url: 'https://cdn.example.com/og-image.png',
        sourceUrl: 'https://example.com/article',
        articleUrl: 'https://example.com/article',
        sourceKind: 'og',
        contentType: 'image/png',
        licenseStatus: 'unknown',
        attribution: 'Android Developers',
        validationStatus: 'ok'
      }
    ]
  }));

  const [image] = capsule.imageCandidates;
  assert.equal(image.sourceKind, 'og');
  assert.equal(image.contentType, 'image/png');
});

test('article capsule strips legacy impact fields before LLM writer input', () => {
  const capsule = buildArticleCapsule(candidate({
    impact_claim_level: 'direct_hal_change',
    impactClaimLevel: 'camera_stack_direct',
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      hal_boundary: 'direct HAL change'
    }
  }));

  assert.equal(Object.hasOwn(capsule, 'impact_claim_level'), false);
  assert.equal(capsule.derived_editorial_hints.relevance_bucket_hint, 'direct_aosp_camera');
});

test('article capsule carries related context labels without making them facts', () => {
  const capsule = buildArticleCapsule(candidate({
    title: 'Android native tooling representative',
    url: 'https://example.com/android-tooling-main',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    article_group_key: 'android_native_tooling_workflow',
    tooling_workflow_type: 'native_tooling_workflow',
    related_context_candidates: [{
      title: 'Android CLI Now Stable 1.0',
      url: 'https://example.com/android-cli',
      relevance_bucket: 'cpp_ai_tooling_fallback',
      finalSelectionEligibility: 'short',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      source_gap_risk: false,
      context_usage_allowed: true,
      article_group_key: 'android_native_tooling_workflow'
    }, {
      title: '17 Things parent roundup',
      url: 'https://example.com/roundup',
      context_role: 'parent_roundup_context_only',
      context_usage_allowed: false,
      article_group_key: 'android_native_tooling_workflow'
    }]
  }));

  assert.equal(capsule.article_group_key, 'android_native_tooling_workflow');
  assert.equal(capsule.tooling_workflow_type, 'native_tooling_workflow');
  assert.equal(capsule.related_context_candidates.length, 2);
  assert.equal(capsule.related_context_candidates[0].context_usage_label, 'allowed_supporting_context');
  assert.equal(capsule.blocked_context_candidates.length, 1);
  assert.equal(capsule.blocked_context_candidates[0].context_usage_label, 'parent_roundup_context_only');
});

test('article capsule preserves camelCase canonical sourceQuality without drifting to unknown', () => {
  const input = candidate({
    source_quality: undefined,
    source_role: undefined,
    source_url_quality: undefined,
    source_quality_status: undefined,
    main_article_source_allowed: undefined,
    sourceQuality: {
      source_role: 'official_release_source',
      source_url_quality: 'official_dated_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Official dated source.',
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: false,
      conditional_evidence_type: '',
      evidence_granularity: 'candidate_item',
      source_quality_notes: []
    }
  });
  const capsule = buildArticleCapsule(input);

  assert.equal(capsule.source_quality.source_url_quality, 'official_dated_release');
  assert.equal(capsule.source_url_quality, 'official_dated_release');
  assert.equal(capsule.source_quality_status, 'allowed');
  assert.equal(capsule.source_quality_reason, 'Official dated source.');
  assert.deepEqual(capsule.source_quality_field_drift, []);
});

test('article capsule keeps blocked source quality blockers in compact writer input', () => {
  const capsule = buildArticleCapsule(candidate({
    source_quality: {
      source_role: 'tech_media_lead_source',
      source_url_quality: 'tech_media_lead_requires_cross_check',
      source_quality_status: 'blocked',
      main_article_source_allowed: false,
      main_article_source_allowed_reason: 'Source requires primary confirmation before main promotion.',
      main_article_source_blockers: ['cross_check_required_but_missing'],
      cross_check_status: 'required_missing',
      requires_cross_check: true,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'primary_confirmation',
      evidence_granularity: 'article_with_primary_confirmation',
      source_quality_notes: ['Must be confirmed by a primary source.']
    }
  }));

  assert.equal(capsule.source_quality.source_role, 'tech_media_lead_source');
  assert.equal(capsule.source_quality.source_url_quality, 'tech_media_lead_requires_cross_check');
  assert.equal(capsule.source_quality.source_quality_status, 'blocked');
  assert.equal(capsule.source_quality.main_article_source_allowed, false);
  assert.deepEqual(capsule.source_quality.main_article_source_blockers, ['cross_check_required_but_missing']);
  assert.equal(capsule.source_quality.requires_cross_check, true);
  assert.equal(capsule.source_quality.requires_conditional_evidence, true);
  assert.equal(capsule.source_quality.conditional_evidence_type, 'primary_confirmation');
  assert.equal(capsule.cross_check_status, 'required_missing');
  assert.equal(capsule.evidence_granularity, 'article_with_primary_confirmation');
  assert.equal(capsule.main_article_readiness.source_ready, false);
  assert.equal(capsule.main_article_readiness.ready, false);
  assert.ok(capsule.main_article_readiness.blockers.includes('main_article_source_allowed_false'));
  assert.ok(capsule.main_article_readiness.blockers.includes('cross_check_required_but_missing'));
  assert.ok(capsule.do_not_claim.some(item => /primary confirmation/.test(item)));
});

test('article capsule preserves conditional evidence requirements for allowed conditional sources', () => {
  const capsule = buildArticleCapsule(candidate({
    source_quality: {
      source_role: 'project_release_source',
      source_url_quality: 'project_release',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Project release evidence is allowed with native HAL workflow evidence.',
      main_article_source_blockers: [],
      cross_check_status: 'not_required',
      requires_cross_check: false,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'project_release_evidence',
      evidence_granularity: 'project_release_note',
      source_quality_notes: ['Allowed only with project release evidence.']
    }
  }));

  assert.equal(capsule.source_quality.source_url_quality, 'project_release');
  assert.equal(capsule.source_quality.source_quality_status, 'allowed');
  assert.equal(capsule.source_quality.main_article_source_allowed, true);
  assert.equal(capsule.source_quality.requires_conditional_evidence, true);
  assert.equal(capsule.source_quality.conditional_evidence_type, 'project_release_evidence');
  assert.equal(capsule.requires_conditional_evidence, true);
  assert.equal(capsule.conditional_evidence_type, 'project_release_evidence');
  assert.equal(capsule.main_article_readiness.source_ready, true);
  assert.equal(capsule.main_article_readiness.blockers.includes('main_article_source_allowed_false'), false);
  assert.equal(capsule.main_article_readiness.blockers.includes('unknown_source_quality'), false);
});

test('article capsule keeps cross-check-required sources distinct from official sources', () => {
  const capsule = buildArticleCapsule(candidate({
    source_quality: {
      source_role: 'tech_media_lead_source',
      source_url_quality: 'tech_media_lead_requires_cross_check',
      source_quality_status: 'allowed',
      main_article_source_allowed: true,
      main_article_source_allowed_reason: 'Primary confirmation satisfied.',
      main_article_source_blockers: [],
      cross_check_status: 'required_satisfied',
      requires_cross_check: true,
      requires_conditional_evidence: true,
      conditional_evidence_type: 'primary_confirmation',
      evidence_granularity: 'article_with_primary_confirmation',
      source_quality_notes: []
    },
    primary_confirmation: true
  }));

  assert.equal(capsule.source_quality.source_role, 'tech_media_lead_source');
  assert.equal(capsule.source_quality.source_url_quality, 'tech_media_lead_requires_cross_check');
  assert.equal(capsule.source_quality.requires_cross_check, true);
  assert.equal(capsule.source_quality.requires_conditional_evidence, true);
  assert.equal(capsule.cross_check_status, 'required_satisfied');
  assert.equal(capsule.evidence_granularity, 'article_with_primary_confirmation');
  assert.notEqual(capsule.source_quality.source_role, 'official_release_source');
  assert.notEqual(capsule.source_quality.source_url_quality, 'official_release_note_anchor');
  assert.equal(capsule.source_fact_bundle.source_url, 'https://example.com/camera-hal-metadata?utm=1');
  assert.equal(capsule.main_article_readiness.source_ready, true);
});

test('article capsule carries compact seed evidence by id instead of full evidence pack', () => {
  const capsule = buildArticleCapsule(candidate({
    seed_ids: ['seed-camerax'],
    evidence_pack_ids: ['seed-camerax-pack'],
    primary_evidence_ids: ['seed-camerax-primary-01'],
    linked_evidence_ids: ['seed-camerax-linked-01'],
    source_extraction_ref: 'seed-evidence-pack.json#/packs/0',
    compact_evidence: {
      primary_facts: ['CameraX 1.6.1 fixes a compile error when using CameraX 1.6.0.'],
      linked_context: ['Linked Android Developers page confirms the same release context.'],
      do_not_claim: ['Keyword hints are discovery hints only.'],
      evidence_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#1.6.1']
    }
  }));

  assert.deepEqual(capsule.seed_evidence.evidence_pack_ids, ['seed-camerax-pack']);
  assert.deepEqual(capsule.seed_evidence.primary_evidence_ids, ['seed-camerax-primary-01']);
  assert.deepEqual(capsule.seed_evidence.linked_evidence_ids, ['seed-camerax-linked-01']);
  assert.equal(capsule.seed_evidence.source_extraction_ref, 'seed-evidence-pack.json#/packs/0');
  assert.deepEqual(capsule.seed_evidence.compact_evidence.primary_facts, [
    'CameraX 1.6.1 fixes a compile error when using CameraX 1.6.0.'
  ]);
  assert.equal(capsule.seed_evidence.packs, undefined);
  assert.equal(capsule.seed_evidence.primary_evidence, undefined);
  assert.equal(capsule.do_not_claim.includes('Keyword hints are discovery hints only.'), true);
});

test('article capsule exposes allowed claim evidence from validator helper', () => {
  const blockText = 'Jetpack Compose includes CameraX for correct camera previews across any window size.';
  const capsule = buildArticleCapsule(candidate({
    source_candidate_hash: 'adaptive-hash',
    primary_evidence_ids: [],
    linked_evidence_ids: [],
    evidence_ids: [],
    evidence_pack_ids: ['provenance-pack'],
    source_extraction: {
      evidence_blocks: [{
        heading: 'Adaptive apps with CameraX',
        text: blockText,
        links: [{ url: 'https://developer.android.com/media/camera/camerax' }]
      }]
    }
  }));

  const ids = capsule.allowed_claim_evidence.map(item => item.evidence_id);
  assert.ok(ids.includes(stableSourceExtractionItemId(
    { source_candidate_hash: 'adaptive-hash' },
    'evidence_blocks',
    blockText
  )));
  assert.ok(ids.includes('candidate:adaptive-hash:source-summary'));
  assert.equal(ids.includes('provenance-pack'), false);
  assert.ok(capsule.allowed_claim_evidence.every(item =>
    item.evidence_id &&
    item.kind &&
    Array.isArray(item.source_urls) &&
    typeof item.text === 'string'
  ));
});

// 2026-08-03(W32) 회귀: allowed_claim_evidence가 texts[0] 하나만 노출해 editor/fact-checker가
// 날짜·컴포넌트·behavior_change를 보지 못했고, 결정론 검증기는 그 조각들까지 보고 판정하는 비대칭
// 때문에 정당한 기사 5건에 must_fix 31건이 붙었다. prompt 텍스트가 검증기와 같은 조각을 담아야 한다.
test('allowed_claim_evidence exposes every evidence fragment the deterministic validator uses', () => {
  const capsule = buildArticleCapsule(candidate({
    summary: 'Sensor driver adds a V4L2 subdev.',
    behavior_change: 'Sensor driver adds a V4L2 subdev.',
    version_or_release: 'v6 (patch series)',
    published_date: '2026-08-01T12:56:38Z',
    api_or_component: 'camss',
    evidence_notes: []
  }));
  const summaryEvidence = capsule.allowed_claim_evidence
    .find(item => item.evidence_id.endsWith(':source-summary'));

  assert.ok(summaryEvidence);
  assert.match(summaryEvidence.text, /Sensor driver adds a V4L2 subdev\./);
  assert.match(summaryEvidence.text, /v6 \(patch series\)/);
  assert.match(summaryEvidence.text, /2026-08-01T12:56:38Z/);
  assert.match(summaryEvidence.text, /camss$/);
  // behavior_change가 summary와 같은 문장이면 한 번만 싣는다.
  assert.equal(summaryEvidence.text.match(/Sensor driver adds a V4L2 subdev\./g).length, 1);
});

// 후보 캡슐은 기사가 쓰이기 전 단계라 actionability를 알 수 없다. hal-signal-quality의 기사 채점
// 결과(항상 none/weak)를 캡슐에 실으면 editor/fact-checker가 "메인으로 뽑힌 기사인데 actionability가
// 없다"는 모순된 전제를 받는다(W32 source gap 원인).
test('article capsule omits article-graded HAL signal verdicts', () => {
  const capsule = buildArticleCapsule(candidate());

  assert.equal(Object.hasOwn(capsule, 'actionability_level'), false);
  assert.equal(Object.hasOwn(capsule, 'effective_actionability_level'), false);
  assert.equal(Object.hasOwn(capsule, 'signal_quality_status'), false);
  assert.equal(capsule.main_article_readiness.hal_signal_ready, true);
  assert.equal(capsule.main_article_readiness.blockers.includes('hal_signal:actionability_none'), false);
  assert.equal(capsule.main_article_readiness.ready, true);
});

test('article capsule report separates shortlist and selected capsule inputs', () => {
  const selected = candidate({ title: 'Camera HAL selected', url: 'https://example.com/selected' });
  const nonSelected = candidate({
    title: 'Android Camera non-selected',
    url: 'https://example.com/non-selected',
    final_selected: false,
    selected_for_editor: false,
    reserve_candidate: true,
    selection_slot: 'reserve'
  });
  const report = buildArticleCapsuleReport('2026-05-03', {
    date: '2026-05-03',
    shortlisted_candidates: [selected, nonSelected],
    selected_articles: [selected],
    reserve_candidates: [nonSelected]
  });

  assert.equal(report.shortlisted_capsule_count, 2);
  assert.equal(report.selected_capsule_count, 1);
  assert.equal(report.reserve_capsule_count, 1);
  assert.equal(capsuleInputFromReport(report, 'shortlisted').candidates.length, 2);
  assert.equal(capsuleInputFromReport(report, 'selected').candidates.length, 1);
  assert.equal(capsuleInputFromReport(report, 'reserve').candidates.length, 1);
  assert.equal(capsuleInputForCandidates('2026-05-03', [selected], report).candidates[0].url, selected.url);
});

test('article capsule report enriches selected article with same-source child facts', () => {
  const selected = candidate({
    title: 'Build native Android apps in Google AI Studio',
    url: 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    article_group_key: 'android_native_tooling_workflow',
    behavior_change: 'Google AI Studio can build entire Android apps from a prompt.'
  });
  const child = candidate({
    title: 'Start building today - Build native Android apps in Google AI Studio',
    url: 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today',
    parent_url: selected.url,
    parent_title: selected.title,
    relevance_bucket: 'cpp_ai_tooling_fallback',
    article_group_key: 'android_native_tooling_workflow',
    source_extraction: {
      evidence_blocks: [{
        source_text: 'Hardware-enabled experiences can use the Camera, GPS/Location, Accelerometer and Bluetooth using native Android APIs.'
      }]
    }
  });
  const report = buildArticleCapsuleReport('2026-05-03', {
    date: '2026-05-03',
    shortlisted_candidates: [selected, child],
    selected_articles: [selected],
    reserve_candidates: []
  });

  const selectedCapsule = capsuleInputFromReport(report, 'selected').candidates[0];
  assert.ok(selectedCapsule.source_fact_bundle.facts.some(fact => /Accelerometer and Bluetooth/.test(fact.text)));
  assert.ok(selectedCapsule.source_fact_bundle.supporting_source_urls.includes(child.url));
});

test('compact selection context omits full candidate arrays', () => {
  const context = compactSelectionContext({
    date: '2026-05-03',
    input_candidate_count: 20,
    eligible_candidate_count: 12,
    selected_article_count: 4,
    deterministic_selected_count: 4,
    reserve_candidate_count: 1,
    shortlist_cap: 12,
    publish_ready: true,
    selection_policy: { shortlist_target_range: '8-12 candidates before Gemini reporter/editor prompts.' },
    selected_articles: [candidate()],
    primary_selected_articles: [candidate()],
    reserve_candidates: [candidate({ title: 'Reserve SoC platform signal', url: 'https://example.com/reserve' })],
    shortlisted_candidates: [candidate({ summary: 'large source text'.repeat(100) })],
    excluded_candidates: [candidate({ title: 'Excluded', source_gap_risk: true })]
  });

  assert.equal(context.input_candidate_count, 20);
  assert.equal(context.selected_articles.length, 1);
  assert.equal(context.reserve_candidates.length, 1);
  assert.equal(context.shortlisted_candidates, undefined);
  assert.equal(context.excluded_candidates, undefined);
});

// Task 6의 dated-article resolver가 release/minor_line_context와 분리해 워크플로 서술을
// source_extraction.workflow.sections에 담는다. compactSourceExtraction이 이 branch를
// 통과시키지 않으면 캡슐 단계에서 유실된다.
test('the workflow branch survives capsule compaction', () => {
  const candidate = {
    source_extraction: {
      workflow: {
        sections: [
          {
            category: 'ci',
            heading: 'CI triage',
            items: [{ text: 'Claude gathers evidence from GitHub, Grafana and PagerDuty before a human approval gate.' }]
          }
        ]
      }
    }
  };
  const capsule = buildArticleCapsule(candidate, []);
  assert.equal(capsule.source_extraction.workflow.sections.length, 1);
  assert.match(capsule.source_extraction.workflow.sections[0].items[0].text, /human approval/i);
});

test('caps how many workflow sections reach the capsule', () => {
  const sections = Array.from({ length: 8 }, (unused, index) => ({
    category: 'ci', heading: `Section ${index}`, items: [{ text: 'x'.repeat(400) }]
  }));
  const capsule = buildArticleCapsule({ source_extraction: { workflow: { sections } } }, []);
  assert.equal(capsule.source_extraction.workflow.sections.length, 2);
});

test('article capsule prompt input omits linked evidence diagnostics fields', () => {
  const report = buildArticleCapsuleReport('2026-05-03', {
    date: '2026-05-03',
    shortlisted_candidates: [candidate({
      linked_evidence_summary: { total_count: 1 },
      impact_classification: { impact_type: 'runtime_behavior_change' },
      linked_evidence: [{ raw_excerpt: 'full evidence payload' }],
      raw_excerpt: 'raw payload',
      resolved: { title: 'resolved payload' }
    })],
    selected_articles: [],
    reserve_candidates: []
  });
  const promptInput = capsuleInputFromReport(report, 'shortlisted');
  const serialized = JSON.stringify(promptInput);

  assert.equal(serialized.includes('linked_evidence_summary'), false);
  assert.equal(serialized.includes('impact_classification'), false);
  assert.equal(serialized.includes('linked_evidence'), false);
  assert.equal(serialized.includes('raw_excerpt'), false);
  assert.equal(serialized.includes('resolved'), false);
});
