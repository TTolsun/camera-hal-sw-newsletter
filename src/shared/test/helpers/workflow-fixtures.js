const fs = require('node:fs');
const path = require('node:path');

const {
  LEDGER_PATH: AUDIT_LEDGER_PATH
} = require('../../common/audit-paths');
const {
  articlePolicy,
  candidatePoolPreflightPolicy,
  qualityGatePolicy
} = require('../../common/newsletter-policy');
const {
  buildHtml,
  buildMarkdown
} = require('../../../generator/render/newsletter-renderer');
const { writeJson, writeText } = require('./fs');

function cameraXRegressionExtraction(title, url) {
  if (!/developer\.android\.com\/jetpack\/androidx\/releases\/camera/i.test(url)) return {};
  const bullet = `${title} has a concrete CameraX release-note behavior item for Android camera compatibility validation.`;
  const sourceExtraction = {
    adapter_id: 'android-developers-jetpack-release',
    source_type: 'release_note',
    source: {
      name: 'CameraX Release Notes',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera'
    },
    release: {
      version: title,
      date: '2026-05-06',
      component: 'CameraX / androidx.camera',
      sections: [{
        category: 'bug_fixes',
        heading: 'Bug Fixes',
        items: [{
          text: bullet,
          source_text: bullet,
          links: [],
          issue_ids: [],
          artifact_names: ['androidx.camera:camera-core']
        }]
      }]
    },
    minor_line_context: null,
    extraction_quality: {
      has_concrete_behavior_change: true,
      used_fallback: false,
      raw_table_used_as_body: false,
      main_article_allowed: true,
      warnings: []
    }
  };
  return {
    summary: bullet,
    behavior_change: bullet,
    source_extraction: sourceExtraction,
    extraction_quality: sourceExtraction.extraction_quality,
    derived_editorial_hints: {
      relevance_bucket_hint: 'direct_aosp_camera',
      hal_boundary: 'framework_adjacent_not_direct_hal_contract',
      validation_targets: ['Camera2 interop regression validation', 'Camera ITS smoke validation'],
      device_specific_notes: [],
      do_not_claim: ['Do not claim direct Camera HAL API changes.'],
      main_article_allowed_hint: true,
      warnings: []
    }
  };
}

function regressionCandidate({ title, url, bucket, fallback = false }) {
  return {
    title,
    url,
    source: title.includes('libcamera') ? 'libcamera' : title.includes('Glaze') ? 'ISO C++ Blog' : 'Android Developers',
    published_date: '2026-05-06',
    version_or_release: title,
    component: title.includes('libcamera') ? 'SoftISP' : title.includes('Glaze') ? 'C++ reflection serialization' : 'CameraX',
    summary: `${title} has dated source evidence for camera newsletter review.`,
    finalSelectionEligibility: fallback ? 'short' : 'main',
    source_gap_risk: false,
    main_eligible: true,
    hasDatedEvidence: true,
    reference_only: false,
    briefing_only: false,
    relevance_bucket: bucket,
    source_candidate_hash: `${bucket}-${title}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    editorial_priority: fallback ? 5 : 2,
    aosp_camera_directness: bucket === 'android_platform_camera_adjacent' ? 2 : 0,
    driver_stack_relevance: bucket === 'camera_driver_image_pipeline' ? 3 : 0,
    multimedia_camera_output_relevance: bucket === 'android_multimedia_camera_output' ? 3 : 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: fallback ? 3 : 0,
    counts_as_primary_camera_topic: bucket !== 'cpp_ai_tooling_fallback',
    counts_as_driver_topic: bucket === 'camera_driver_image_pipeline',
    counts_as_soc_topic: false,
    counts_as_fallback_topic: fallback,
    evidence_origin: 'fixture',
    ...cameraXRegressionExtraction(title, url)
  };
}

function regressionSection(item, overrides = {}) {
  const value = {
    category: item.relevance_bucket === 'camera_driver_image_pipeline' ? 'Camera Driver / Image Pipeline' : 'Android Platform / CameraX',
    headline: item.title,
    what_changed: item.summary,
    evidence_summary: `${item.title} uses dated source evidence.`,
    confirmed_facts: [`${item.title} was published on ${item.published_date}.`, `component=${item.component}`],
    specificity_checks: ['dated evidence present', `bucket=${item.relevance_bucket}`],
    source_verification_notes: ['Source URL is bound to candidate metadata.'],
    camera_hal_checks: ['Check stream configuration.', 'Check metadata compatibility.'],
    action_items: ['Run Camera ITS smoke tests.', 'Check stream/buffer compatibility.'],
    source_candidate_hash: item.source_candidate_hash,
    source_candidate_url: item.url,
    relevance_bucket: item.relevance_bucket,
    editorial_priority: item.editorial_priority,
    aosp_camera_directness: item.aosp_camera_directness,
    driver_stack_relevance: item.driver_stack_relevance,
    multimedia_camera_output_relevance: item.multimedia_camera_output_relevance,
    soc_platform_relevance: item.soc_platform_relevance,
    native_tooling_relevance: item.native_tooling_relevance,
    counts_as_primary_camera_topic: item.counts_as_primary_camera_topic,
    counts_as_driver_topic: item.counts_as_driver_topic,
    counts_as_soc_topic: item.counts_as_soc_topic,
    counts_as_fallback_topic: item.counts_as_fallback_topic,
    evidence_origin: item.evidence_origin,
    source_extraction: item.source_extraction || null,
    derived_editorial_hints: item.derived_editorial_hints || null,
    extraction_quality: item.extraction_quality || item.source_extraction?.extraction_quality || null,
    sources: [{ title: item.title, url: item.url }],
    ...overrides
  };
  const halDriverImpact = 'Camera HAL team checks stream, buffer, metadata, CTS/VTS, and Camera ITS impact before follow-up work.';
  if (!Object.prototype.hasOwnProperty.call(overrides, 'article_sections')) {
    value.article_sections = {
      verified_facts: value.confirmed_facts,
      background_context: item.relevance_bucket === 'camera_driver_image_pipeline'
        ? 'Driver and image pipeline changes are reviewed as camera-stack integration signals.'
        : 'CameraX and Android camera framework changes are reviewed as compatibility and validation signals above the HAL boundary.',
      hal_driver_impact: halDriverImpact,
      action_items: value.action_items,
      team_share_points: `${item.title} should be reviewed by camera owners.`
    };
  }
  if (!Object.prototype.hasOwnProperty.call(overrides, 'public_article')) {
    value.public_article = {
      headline: value.headline,
      lead: `${value.headline}는 Camera HAL 독자에게 출처 기반 검증 신호를 제공합니다.`,
      body_paragraphs: [
        `${value.headline}는 날짜가 있는 출처 근거를 바탕으로 선택된 항목입니다.`,
        '실무 해석은 stream, buffer, metadata, Camera ITS, latency, frame-drop 검증 범위로 제한합니다.'
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

function scopeCountForCandidate(candidate, overrides = {}) {
  return {
    source_candidate_url: candidate.url,
    source_candidate_hash: candidate.source_candidate_hash,
    relevance_bucket: candidate.relevance_bucket,
    binding_status: 'bound',
    publishable_scope: true,
    counts_as_primary_camera_topic: candidate.counts_as_primary_camera_topic,
    counts_as_driver_topic: candidate.counts_as_driver_topic,
    counts_as_soc_topic: candidate.counts_as_soc_topic,
    counts_as_fallback_topic: candidate.counts_as_fallback_topic,
    ...overrides
  };
}

function candidateShortageSummary(overrides = {}) {
  return {
    publishable_candidate_count: 0,
    required_publishable_candidate_count: candidatePoolPreflightPolicy.publishableCandidateMin,
    reserve_candidate_count: 0,
    required_reserve_candidate_count: candidatePoolPreflightPolicy.reserveMin,
    primary_camera_stack_candidate_count: 0,
    required_primary_camera_stack_candidate_count: candidatePoolPreflightPolicy.primaryCameraStackCandidateMin,
    camera_stack_candidate_count: 0,
    required_camera_stack_candidate_count: candidatePoolPreflightPolicy.cameraStackCandidateMin,
    direct_camera_or_driver_candidate_count: 0,
    camera_adjacent_candidate_count: 0,
    supporting_candidate_count: 0,
    selected_article_count: 0,
    selected_primary_camera_stack_count: 0,
    ...overrides
  };
}

function writeArchiveSyncSurface(root) {
  writeJson(path.join(root, 'articles', 'content', 'audit', 'historical-archive-status.json'), []);
  writeText(path.join(root, AUDIT_LEDGER_PATH), [
    '# Historical Newsletter Provenance Ledger',
    '',
    '## Ledger',
    '',
    '| Date | Original generation mode | Known quality issues | Rewrite allowed | Rewrite status | Archive status | Public visibility | Cleanup context |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ''
  ].join('\n'));
}

function writeHalSignalQualityReviewArtifacts(root, date, overrides = {}) {
  const report = {
    schema_version: 1,
    report_type: 'hal_signal_quality',
    date,
    status: overrides.status || 'NEEDS_FIX',
    input_completeness: overrides.inputCompleteness || 'complete',
    input_statuses: {
      shortlisted_candidates: 'loaded',
      editor_draft: 'loaded',
      quality_report: 'loaded',
      source_effectiveness_report: 'loaded',
      source_quality_report: 'loaded',
      evidence_pack_summary: 'loaded',
      merged_candidate_manifest: 'loaded',
      ...(overrides.input_statuses || {})
    },
    inputs: {
      missing_required: [],
      unavailable_optional: [],
      ...(overrides.inputs || {})
    },
    quality_status: overrides.qualityStatus || 'NEEDS_FIX',
    hal_signal_quality_summary: {
      main_article_count: 0,
      article_count_with_hal_signal_capsule: 0,
      article_count_without_hal_signal_capsule: 0,
      generic_signal_hard_blocker_count: 0,
      hal_signal_hard_blocker_count: 0,
      ...(overrides.hal_signal_quality_summary || {})
    },
    main_article_signal_checks: overrides.main_article_signal_checks || []
  };
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'hal-signal-quality-report.json'), report);
  writeText(path.join(root, 'articles', 'content', 'newsroom', date, 'hal-signal-quality-report.md'), `# HAL Signal Quality Report - ${date}\n`);
  return report;
}

function writeMinimalPublishArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'PASS',
    selection_publish_ready: true,
    final_publish_ready: overrides.finalPublishReady ?? false,
    publish_gate_passed: true,
    review_gate_passed: true,
    quality_status: 'PASS',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    fact_check_status: 'PASS',
    must_fix_count: 0,
    source_gap_count: 0,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0,
    composition_mode: 'NORMAL',
    selected_article_count: articlePolicy.mainArticleCount.min,
    final_selected_article_count: articlePolicy.mainArticleCount.min,
    ...(overrides.status || {})
  };
  const quality = {
    status: 'PASS',
    score: 90,
    threshold: qualityGatePolicy.threshold,
    deductions: [],
    ...(overrides.quality || {})
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    ...(overrides.factCheck || {})
  };
  const staleClaim = {
    status: 'PASS',
    hard_failures: [],
    stale_claim_items_removed: [],
    unsupported_release_claims_removed: [],
    unused_references_removed: [],
    ...(overrides.staleClaim || {})
  };
  const shortlist = {
    publish_ready: true,
    publish_gate_passed: true,
    review_gate_passed: true,
    composition_mode: 'NORMAL',
    selection_composition_mode: 'NORMAL',
    selected_article_count: articlePolicy.mainArticleCount.min,
    composition_summary: {
      selected_article_count: articlePolicy.mainArticleCount.min,
      primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
      supporting_main_article_count: articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired,
      forbidden_main_article_count: 0,
      non_fallback_reviewable_article_count: articlePolicy.mainArticleCount.min
    },
    ...(overrides.shortlist || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'stale-claim-report.json'), staleClaim);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), shortlist);

  return { status, quality, factCheck, staleClaim, shortlist };
}

function writePublicNewsletterArtifacts(root, date, overrides = {}) {
  const issue = overrides.issue || {
    date,
    title: overrides.title || `Camera HAL / SW Newsletter - ${date}`,
    summary: overrides.summary || '공개 뉴스레터 요약입니다.',
    briefing: ['첫 번째 요약입니다.', '두 번째 요약입니다.', '세 번째 요약입니다.'],
    sections: [
      {
        category: 'Android Camera',
        headline: 'CameraX release note',
        what_changed: 'CameraX release note changed a camera component.',
        evidence_summary: 'Android Developers dated release note is used as source evidence.',
        confirmed_facts: ['CameraX release note exists.', 'The source link is dated.'],
        specificity_checks: ['version=1.0.0', 'component=CameraX'],
        source_verification_notes: ['Source URL is official.'],
        camera_hal_checks: ['Check stream configuration.', 'Check metadata compatibility.'],
        action_items: ['Run Camera ITS smoke tests.', 'Check stream/buffer compatibility.'],
        article_sections: {
          verified_facts: ['CameraX release note exists.', 'The source link is dated.'],
          background_context: 'CameraX is part of the Android camera application layer.',
          hal_driver_impact: 'Camera HAL team checks stream, buffer, metadata, CTS/VTS, and Camera ITS impact before follow-up work.',
          action_items: ['Run Camera ITS smoke tests.', 'Check stream/buffer compatibility.'],
          team_share_points: 'Camera team should review compatibility impact.'
        },
        public_article: {
          headline: 'CameraX release note',
          lead: 'CameraX release note는 Camera HAL 독자에게 날짜가 있는 app-framework 호환성 확인 신호를 제공합니다.',
          body_paragraphs: [
            '이 fixture release note는 renderer와 readiness 테스트에서 공식 Android camera 근거로 취급됩니다.',
            '공개 해석 범위는 CameraX 호환성, Camera ITS smoke test, stream configuration, metadata 확인으로 제한합니다.'
          ],
          camera_hal_takeaway: '이 항목은 app-framework 검증 트리거로만 다루고, 직접 Camera HAL API 변경 근거로 보지 않습니다.',
          reader_checkpoints: ['Camera ITS smoke test를 실행합니다.', 'stream/buffer 호환성을 확인합니다.'],
          source_links: [{
            title: 'Android Developers Camera',
            url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.0.0',
            source_role: 'primary'
          }]
        },
        sources: [
          {
            title: 'Android Developers Camera',
            url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.0.0'
          }
        ]
      }
    ],
    action_items: ['Run Camera ITS smoke tests.'],
    references: [
      {
        title: 'Android Developers Camera',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.0.0'
      }
    ]
  };
  writeText(path.join(root, 'articles', 'newsletters', date, 'newsletter.md'), overrides.markdown || buildMarkdown(issue));
  writeText(path.join(root, 'articles', 'newsletters', date, 'index.html'), overrides.html || buildHtml(issue));
  writeText(path.join(root, 'index.html'), overrides.rootIndex || [
    '<!doctype html><html><body>',
    '<div id="featured-card"></div>',
    '<div id="latest-grid"></div>',
    '<script>',
    "async function loadNewsletters() { await fetch('data/newsletters.json'); const latest = {}; const archive = []; }",
    'loadNewsletters();',
    '</script></body></html>'
  ].join('\n'));
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [
    {
      date,
      title: overrides.title || `Camera HAL / SW Newsletter - ${date}`,
      summary: overrides.summary || '공개 뉴스레터 요약입니다.',
      html: `newsletters/${date}/index.html`,
      md: `newsletters/${date}/newsletter.md`,
      tags: ['Camera HAL']
    }
  ]);
  writeWeeklyNewsletterIndex(root);
}

// 발행된 저장소에는 인덱스가 둘 다 있다. daily는 품질 재계산이 읽고, weekly는 홈·아카이브가
// fetch한다. 구조 검증이 둘 다 스캔하므로 daily만 쓰는 fixture는 실제 저장소 모양이 아니다.
// 이 fixture들은 daily 호를 모델링하므로 weekly 인덱스는 엔트리 없이 존재만 한다.
function writeWeeklyNewsletterIndex(root) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), []);
}

function writeNewsletterIndex(root, items) {
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), items.map(item => ({
    date: item.date,
    title: item.title || `Camera HAL / SW Newsletter - ${item.date}`,
    summary: item.summary || 'Public issue summary',
    html: `newsletters/${item.date}/index.html`,
    md: `newsletters/${item.date}/newsletter.md`,
    tags: ['Camera HAL']
  })));
  writeWeeklyNewsletterIndex(root);
}

function writeRootIndexContract(root) {
  writeText(path.join(root, 'index.html'), [
    '<!doctype html><html><body>',
    '<div id="featured-card"></div>',
    '<div id="latest-grid"></div>',
    '<script>',
    "async function loadNewsletters() { const latest = {}; const archive = []; await fetch('data/newsletters.json'); }",
    'loadNewsletters();',
    '</script></body></html>'
  ].join('\n'));
}

function writePr39LikeRegressionFixture(root, date = '2026-05-09') {
  writeRootIndexContract(root);
  const libcamera = regressionCandidate({
    title: 'libcamera v0.7.1',
    url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
    bucket: 'camera_driver_image_pipeline'
  });
  const camerax = regressionCandidate({
    title: 'CameraX 1.4.0-alpha07',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07',
    bucket: 'android_platform_camera_adjacent'
  });
  const gcc = regressionCandidate({
    title: 'GCC 16.1',
    url: 'https://isocpp.org/blog/2026/04/gcc-16.1',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const glaze = regressionCandidate({
    title: 'Glaze 7.2 C++26 Reflection',
    url: 'https://isocpp.org/blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const editor = {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'PR #39 regression fixture.',
    briefing: ['libcamera update.', 'CameraX update.', 'GCC 16.1 tooling item.'],
    sections: [
      regressionSection(libcamera),
      regressionSection(camerax),
      regressionSection(gcc, {
        category: 'C++ / Tooling',
        headline: 'GCC 16.1',
        article_sections: {
          verified_facts: ['GCC 16.1 was published.'],
          background_context: 'GCC 16.1 is a C++ toolchain release reviewed as native tooling context.',
          hal_driver_impact: 'GCC 16.1 is presented as a direct HAL toolchain change.',
          action_items: ['Start GCC 16.1 migration.'],
          team_share_points: 'GCC 16.1 should be reviewed by native tooling owners.'
        }
      })
    ],
    action_items: ['Run libcamera tests.', 'Run CameraX tests.', 'Start GCC 16.1 migration.'],
    references: []
  };
  const quality = {
    date,
    score: 82,
    threshold: qualityGatePolicy.threshold,
    status: 'NEEDS_FIX',
    deductions: [
      { category: 'source-integrity', points: 8, reason: 'Shared watch/release-note URL requires matching evidence.', location: 'GCC 16.1', blocking: true },
      { category: 'scope-relevance', points: 8, reason: 'Main article lacks article-level Camera HAL relevance.', location: 'GCC 16.1', blocking: true }
    ],
    article_results: [
      { index: 1, headline: libcamera.title, status: 'PASS', repair_action: 'preserve', hard_fail_reasons: [] },
      { index: 2, headline: camerax.title, status: 'PASS', repair_action: 'preserve', hard_fail_reasons: [] },
      {
        index: 3,
        headline: 'GCC 16.1',
        status: 'FAIL',
        repair_action: 'replace-or-demote',
        hard_fail_reasons: ['source-integrity', 'scope-relevance'],
        scope_count: { publishable_scope: false }
      }
    ]
  };
  const factCheck = { status: 'PASS', must_fix: [], source_gaps: [], source_gap_count: 0, final_comment: 'PASS' };
  const status = {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    failure_reason: 'section_count_drift',
    final_publish_ready: false,
    editor_review_required: true,
    quality_status: 'NEEDS_FIX',
    quality_score: 82,
    quality_threshold: qualityGatePolicy.threshold,
    rendered_main_article_count: 3,
    min_final_articles: articlePolicy.mainArticleCount.min
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), editor);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeHalSignalQualityReviewArtifacts(root, date, {
    qualityStatus: quality.status,
    status: 'NEEDS_FIX'
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'repair-failure.json'), { message: 'section_count_drift' });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'reporter-candidates.json'), { date, candidates: [libcamera, camerax, gcc, glaze] });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [libcamera, camerax, gcc],
    reserve_candidates: [glaze],
    composition_summary: {}
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'article-capsules.json'), { selected_capsules: [libcamera, camerax, gcc], reserve_capsules: [glaze] });
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'candidates.json'), { candidates: [libcamera, camerax, gcc, glaze] });
  return { date, editor };
}

function writeRun25590436113LikeFallbackFixture(root, options = {}) {
  const date = options.date || '2026-05-09';
  const includeSafeAnchors = options.includeSafeAnchors !== false;
  writeRootIndexContract(root);
  const camerax14 = regressionCandidate({
    title: 'CameraX 1.4.0-alpha07',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07',
    bucket: 'android_platform_camera_adjacent'
  });
  const camerax16 = regressionCandidate({
    title: 'CameraX 1.6.1',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    bucket: 'android_platform_camera_adjacent'
  });
  const camerax13 = regressionCandidate({
    title: 'CameraX 1.3.0-beta02',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02',
    bucket: 'android_platform_camera_adjacent'
  });
  const libcamera = regressionCandidate({
    title: 'libcamera v0.7.1',
    url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html',
    bucket: 'camera_driver_image_pipeline'
  });
  const gcc = regressionCandidate({
    title: 'GCC 16.1',
    url: 'https://isocpp.org/blog/2026/04/gcc-16.1',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const cameraxAnchorless = regressionCandidate({
    title: 'CameraX release notes overview',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    bucket: 'android_platform_camera_adjacent'
  });
  const safeCandidates = includeSafeAnchors ? [camerax16, camerax13] : [];
  const candidates = [camerax14, libcamera, gcc, cameraxAnchorless, ...safeCandidates];
  const editor = {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'Run 25590436113 fallback regression fixture.',
    briefing: ['CameraX wording needs repair.', 'libcamera has a source gap.', 'GCC fallback is not publishable.'],
    sections: [
      regressionSection(camerax14, {
        article_sections: {
          verified_facts: ['CameraX 1.4 release note exists.'],
          background_context: 'CameraX and Android camera framework changes are reviewed as compatibility signals above the HAL boundary.',
          hal_driver_impact: 'Speculative CameraX HAL wording that must be rebuilt from the bound candidate.',
          action_items: ['Repair CameraX wording.'],
          team_share_points: 'CameraX 1.4 should be reviewed by camera owners.'
        }
      }),
      regressionSection(libcamera),
      regressionSection(gcc, {
        category: 'C++ / Tooling',
        headline: 'GCC 16.1',
        article_sections: {
          verified_facts: ['GCC 16.1 was published.'],
          background_context: 'GCC 16.1 is a C++ toolchain release reviewed as native tooling context.',
          hal_driver_impact: 'GCC 16.1 is presented as a direct HAL toolchain change.',
          action_items: ['Start GCC migration.'],
          team_share_points: 'GCC 16.1 should be reviewed by native tooling owners.'
        }
      })
    ],
    action_items: ['Repair CameraX wording.', 'Investigate libcamera source gap.', 'Start GCC migration.'],
    references: []
  };
  const quality = {
    date,
    score: 56,
    threshold: qualityGatePolicy.threshold,
    status: 'NEEDS_FIX',
    deductions: [
      { category: 'source-integrity', points: 15, reason: 'Fact checker returned 14 must_fix item(s).', blocking: true },
      { category: 'source-integrity', points: 3, reason: 'Fact checker reported 1 source gap(s).', blocking: true }
    ],
    article_results: [
      {
        index: 1,
        headline: camerax14.title,
        status: 'FAIL',
        repair_action: 'repair-section',
        hard_fail_reasons: ['Fact-check must_fix item mentions this section.'],
        scope_count: scopeCountForCandidate(camerax14)
      },
      {
        index: 2,
        headline: libcamera.title,
        status: 'FAIL',
        repair_action: 'replace-or-demote',
        hard_fail_reasons: [
          'Fact-check must_fix item mentions this section.',
          'Source gap or ineligible source evidence mentions this section.'
        ],
        scope_count: scopeCountForCandidate(libcamera)
      },
      {
        index: 3,
        headline: 'GCC 16.1',
        status: 'FAIL',
        repair_action: 'replace-or-demote',
        hard_fail_reasons: [
          'Shared watch/release-note URL requires matching version_or_release or published_date evidence.',
          'Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.'
        ],
        scope_count: scopeCountForCandidate(gcc, {
          publishable_scope: false
        })
      }
    ]
  };
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [
      { location: 'sections[0].what_changed', problem: 'CameraX wording is too generic.', source_url: camerax14.url }
    ],
    source_gaps: [
      `Reporter eligibility violation; section="${libcamera.title}"; url=${libcamera.url}; action=replace-or-demote`
    ],
    source_gap_count: 1,
    final_comment: 'Run 25590436113 shape.'
  };
  const status = {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    failure_stage: 'editor repair attempt 1/2',
    failure_reason: 'Targeted repair changed main article count outside completion/replacement mode.',
    final_publish_ready: false,
    artifact_final_publish_ready: false,
    publish_gate_passed: false,
    review_gate_passed: true,
    editor_review_required: true,
    fact_check_status: 'NEEDS_FIX',
    must_fix_count: 14,
    source_gap_count: 1,
    quality_status: 'NEEDS_FIX',
    quality_score: 56,
    quality_threshold: qualityGatePolicy.threshold,
    rendered_main_article_count: 3,
    selected_article_count: 5,
    min_final_articles: articlePolicy.mainArticleCount.min
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), editor);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft-attempt-1.json'), editor);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeHalSignalQualityReviewArtifacts(root, date, {
    qualityStatus: quality.status,
    status: 'NEEDS_FIX'
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'Targeted repair changed main article count outside completion/replacement mode.',
    details: { reason: 'section_count_drift' }
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'reporter-candidates.json'), { date, candidates });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: candidates,
    reserve_candidates: safeCandidates,
    composition_summary: {}
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'article-capsules.json'), {
    selected_capsules: candidates,
    reserve_capsules: safeCandidates
  });
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'candidates.json'), { candidates });
  return { date, camerax14, camerax16, camerax13, libcamera, gcc };
}

function writeEditorialReviewableArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'NEEDS_FIX',
    failure_kind: 'editorial_reviewable',
    final_publish_ready: false,
    validate_ok: false,
    editor_review_required: true,
    fact_check_status: 'NEEDS_FIX',
    must_fix_count: 1,
    quality_status: 'NEEDS_FIX',
    quality_score: 82,
    quality_threshold: qualityGatePolicy.threshold,
    publish_gate_passed: false,
    review_gate_passed: true,
    ...(overrides.status || {})
  };
  const editor = {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'Review-only draft',
    briefing: ['one', 'two', 'three'],
    sections: [],
    references: [],
    ...(overrides.editor || {})
  };
  const factCheck = {
    status: 'NEEDS_FIX',
    must_fix: [{ issue: 'editorial fact-check remains' }],
    source_gaps: [],
    source_gap_count: 0,
    ...(overrides.factCheck || {})
  };
  const quality = {
    status: 'NEEDS_FIX',
    score: 82,
    threshold: qualityGatePolicy.threshold,
    deductions: [{ category: 'source-integrity', points: 15, reason: 'Fact checker returned 1 must_fix item(s).' }],
    ...(overrides.quality || {})
  };
  const generationStatus = {
    ...status,
    ...(overrides.generationStatus || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (overrides.writeEditor !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), editor);
  }
  if (overrides.writeFactCheck !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  }
  if (overrides.writeQuality !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), quality);
  }
  if (overrides.writeHalSignalQuality !== false) {
    writeHalSignalQualityReviewArtifacts(root, date, {
      qualityStatus: quality.status,
      status: quality.status === 'PASS' ? 'PASS' : 'NEEDS_FIX'
    });
  }
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
  }

  return { status, editor, factCheck, quality, generationStatus };
}

function writeFailedRepairReviewableArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    publish_ready: true,
    selection_publish_ready: true,
    final_publish_ready: true,
    publish_gate_passed: true,
    review_gate_passed: false,
    quality_status: 'PASS',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    fact_check_status: 'PASS',
    must_fix_count: 0,
    source_gap_count: 0,
    composition_mode: 'NORMAL',
    ...(overrides.status || {})
  };
  const editor = {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'Fallback draft',
    briefing: ['one', 'two', 'three'],
    sections: [],
    references: [],
    ...(overrides.editor || {})
  };
  const quality = {
    status: 'PASS',
    score: 90,
    threshold: qualityGatePolicy.threshold,
    deductions: [],
    ...(overrides.quality || {})
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    ...(overrides.factCheck || {})
  };
  const repairFailure = {
    name: 'EditorSemanticValidationError',
    message: 'Fallback repair failure',
    ...(overrides.repairFailure || {})
  };
  const generationStatus = {
    ...status,
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false,
    composition_mode: 'NEEDS_FIX',
    ...(overrides.generationStatus || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (overrides.writeEditor !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json'), editor);
  }
  if (overrides.writeQuality !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), quality);
  }
  if (overrides.writeFactCheck !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  }
  if (overrides.writeHalSignalQuality !== false) {
    writeHalSignalQualityReviewArtifacts(root, date, {
      qualityStatus: quality.status,
      status: quality.status === 'PASS' ? 'PASS' : 'NEEDS_FIX'
    });
  }
  if (overrides.writeRepairFailure !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'repair-failure.json'), repairFailure);
  }
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
  }

  return { status, editor, quality, factCheck, repairFailure, generationStatus };
}

function writeFailedRawArtifactValidationArtifacts(root, date, overrides = {}) {
  const status = {
    date,
    status: 'FAILED_RAW_ARTIFACT_VALIDATION',
    final_publish_ready: false,
    publish_gate_passed: false,
    raw_artifact_validation_error: {
      field: 'merged_candidate_manifest',
      value: 'articles/content/newsroom/' + date + '/gemini-usage-report.json'
    },
    ...(overrides.status || {})
  };
  const generationStatus = {
    ...status,
    ...(overrides.generationStatus || {})
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
  }

  return { status, generationStatus };
}

function writeCandidateShortageReviewableArtifacts(root, date, overrides = {}) {
  const summary = candidateShortageSummary(overrides.summary || {});
  const shortageReasonCodes = overrides.shortageReasonCodes || [
    'publishable_candidate_shortage'
  ];
  const sourceParserHints = overrides.sourceParserHints || [{
    code: 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR',
    source_id: 'android-developers-jetpack-release',
    reason: 'collected CameraX rows but no eligible source_extraction item'
  }];
  const direct = regressionCandidate({
    title: 'libcamera v0.7.1',
    url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000001.html',
    bucket: 'camera_driver_image_pipeline'
  });
  const supportA = regressionCandidate({
    title: 'GCC 16.1',
    url: 'https://isocpp.org/blog/2026/05/gcc-16.1',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const supportB = regressionCandidate({
    title: 'Glaze 7.2 C++ reflection',
    url: 'https://isocpp.org/blog/2026/05/glaze-7.2',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const selected = overrides.selected || [];
  const failureReason = shortageReasonCodes.join('; ');
  const status = {
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    failure_kind: 'candidate_shortage_reviewable',
    failure_stage: 'candidate_pool_preflight',
    failure_reason: failureReason,
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    artifact_final_publish_ready: false,
    publish_gate_passed: false,
    review_gate_passed: true,
    editor_review_required: true,
    quality_status: 'UNKNOWN',
    quality_score: null,
    quality_threshold: qualityGatePolicy.threshold,
    fact_check_status: 'UNKNOWN',
    must_fix_count: 0,
    source_gap_count: 0,
    stale_claim_status: 'UNKNOWN',
    stale_claim_hard_failure_count: 0,
    composition_mode: 'NEEDS_FIX',
    selection_composition_mode: 'NEEDS_FIX',
    candidate_pool_preflight_passed: false,
    candidate_shortage_reviewable: true,
    candidate_shortage_summary: summary,
    shortage_reason_codes: shortageReasonCodes,
    source_parser_hints: sourceParserHints,
    selected_article_count: summary.selected_article_count,
    reserve_candidate_count: summary.reserve_candidate_count,
    input_candidate_count: selected.length,
    eligible_candidate_count: summary.publishable_candidate_count,
    selection_errors: [],
    selection_warnings: ['Candidate pool preflight failed before LLM generation.'],
    selection_shortage_hints: sourceParserHints.map(hint => hint.reason),
    ...(overrides.status || {})
  };
  const shortlist = {
    date,
    publish_ready: false,
    review_gate_passed: true,
    publish_gate_passed: false,
    candidate_pool_preflight_passed: false,
    candidate_shortage_reviewable: true,
    candidate_shortage_summary: summary,
    shortage_reason_codes: shortageReasonCodes,
    source_parser_hints: sourceParserHints,
    selected_articles: selected,
    primary_selected_articles: selected,
    shortlisted_candidates: selected,
    reserve_candidates: [],
    excluded_candidates: [],
    selection_errors: [],
    selection_warnings: ['Candidate pool preflight failed before LLM generation.'],
    selection_shortage_hints: sourceParserHints.map(hint => hint.reason),
    composition_summary: {
      selected_article_count: summary.selected_article_count,
      primary_camera_stack_topic_count: summary.primary_camera_stack_candidate_count,
      supporting_main_article_count: summary.supporting_candidate_count,
      forbidden_main_article_count: 0
    }
  };
  const selectionReport = {
    schema_version: 1,
    date,
    status: 'UNDERFILLED_NEEDS_FIX',
    failure_stage: 'candidate_pool_preflight',
    failure_reason: failureReason,
    candidate_pool_preflight_passed: false,
    candidate_shortage_reviewable: true,
    candidate_shortage_summary: summary,
    shortage_reason_codes: shortageReasonCodes,
    source_parser_hints: sourceParserHints,
    selection_errors: [],
    selection_warnings: shortlist.selection_warnings,
    selection_shortage_hints: shortlist.selection_shortage_hints,
    gate_summary: {
      review_gate_passed: true,
      publish_gate_passed: false
    },
    counts: {
      input_candidate_count: selected.length,
      eligible_candidate_count: summary.publishable_candidate_count,
      selected_article_count: summary.selected_article_count,
      reserve_candidate_count: summary.reserve_candidate_count
    },
    composition_summary: shortlist.composition_summary
  };
  const diagnosticsMd = [
    '# Selection Diagnostics',
    '',
    '## Candidate Pool Preflight',
    '',
    '- candidate_shortage: true',
    `- shortage_reason_codes: ${shortageReasonCodes.join(', ')}`,
    `- publishable_candidate_count: ${summary.publishable_candidate_count}`,
    `- reserve_candidate_count: ${summary.reserve_candidate_count}`,
    `- camera_stack_candidate_count: ${summary.camera_stack_candidate_count}`,
    '',
    '## Source Parser Hints',
    '',
    ...sourceParserHints.map(hint => `- ${hint.code}: ${hint.source_id} - ${hint.reason}`)
  ].join('\n');

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), status);
  }
  if (overrides.writeShortlist !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), shortlist);
  }
  if (overrides.writeSelectionReport !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-report.json'), selectionReport);
  }
  if (overrides.writeSelectionDiagnostics !== false) {
    writeText(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-diagnostics.md'), `${diagnosticsMd}\n`);
  }
  if (overrides.writeArticleCapsules !== false) {
    writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'article-capsules.json'), {
      selected_capsules: selected,
      reserve_capsules: []
    });
  }
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'candidates.json'), {
    candidates: [
      ...selected,
      {
        source_id: 'android-developers-jetpack-release',
        source_name: 'Android Developers Jetpack Release',
        sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera',
        title: 'CameraX rolling release page',
        published_date: '',
        finalSelectionEligibility: 'watchlist',
        hasDatedEvidence: false,
        main_eligible: false,
        source_gap_risk: true,
        reference_only: true,
        briefing_only: true,
        selection_exclusion_reason: 'Parser did not extract a dated release row from the official source.'
      }
    ]
  });

  return { status, shortlist, selectionReport, summary, sourceParserHints, shortageReasonCodes, selected };
}

function writeFallbackOnlyReviewableArtifacts(root, date) {
  writeRootIndexContract(root);
  const fallbackA = regressionCandidate({
    title: 'GCC 16.1',
    url: 'https://isocpp.org/blog/2026/05/gcc-16.1',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const fallbackB = regressionCandidate({
    title: 'Glaze 7.2 C++ reflection',
    url: 'https://isocpp.org/blog/2026/05/glaze-7.2',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const fallbackC = regressionCandidate({
    title: 'LLVM native sanitizer workflow',
    url: 'https://isocpp.org/blog/2026/05/llvm-native-sanitizer-workflow',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const rejectedCamera = {
    ...regressionCandidate({
      title: 'CameraX rolling release page',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera',
      bucket: 'direct_aosp_camera'
    }),
    published_date: '',
    finalSelectionEligibility: 'watchlist',
    hasDatedEvidence: false,
    main_eligible: false,
    source_gap_risk: true,
    reference_only: true,
    briefing_only: true,
    selection_exclusion_reason: 'Parser did not extract a dated release row from the official source.'
  };
  const selected = [fallbackA, fallbackB, fallbackC];
  const summary = candidateShortageSummary({
    primary_camera_stack_candidate_count: 0,
    camera_stack_candidate_count: 0,
    direct_camera_or_driver_candidate_count: 0,
    supporting_candidate_count: selected.length,
    selected_primary_camera_stack_count: 0
  });
  writeCandidateShortageReviewableArtifacts(root, date, {
    summary,
    status: {
      input_candidate_count: selected.length + 1,
      selected_article_count: selected.length
    }
  });
  const newsroom = path.join(root, 'articles', 'content', 'newsroom', date);
  const collected = path.join(root, 'articles', 'content', 'collected-news', date);
  const shortlist = JSON.parse(fs.readFileSync(path.join(newsroom, 'shortlisted-candidates.json'), 'utf8'));
  shortlist.selected_articles = selected;
  shortlist.primary_selected_articles = selected;
  shortlist.shortlisted_candidates = selected;
  shortlist.composition_summary = {
    ...shortlist.composition_summary,
    selected_article_count: selected.length,
    primary_camera_stack_topic_count: 0,
    supporting_main_article_count: selected.length
  };
  writeJson(path.join(newsroom, 'shortlisted-candidates.json'), shortlist);
  writeJson(path.join(newsroom, 'article-capsules.json'), {
    selected_capsules: selected,
    reserve_capsules: []
  });
  writeJson(path.join(newsroom, 'reporter-candidates.json'), {
    date,
    candidates: [...selected, rejectedCamera]
  });
  writeJson(path.join(collected, 'candidates.json'), {
    candidates: [...selected, rejectedCamera]
  });
  return { selected, rejectedCamera };
}

function writeMinimalEvidencePackSummary(root, date, overrides = {}) {
  const {
    selection_summary: selectionSummaryOverrides = {},
    failure_diagnostics: failureDiagnosticsOverrides = {},
    ...restOverrides
  } = overrides;
  const selectionSummary = {
    raw_candidate_count: 3,
    eligible_candidate_count: 2,
    selected_main_article_count: 1,
    reserve_candidate_count: 1,
    excluded_candidate_count: 1,
    primary_camera_stack_count: 1,
    supporting_bucket_count: 1,
    fallback_window_used: null,
    fallback_window_consulted: null,
    fallback_window_reason: '',
    fallback_candidates_promoted_count: null,
    fallback_bucket_used: false,
    ...selectionSummaryOverrides
  };
  const failureDiagnostics = {
    quality_hard_failures: ['source-integrity'],
    fact_check_must_fix: [],
    repair_failures: [],
    candidate_shortage_hints: [],
    source_gap_warnings: [],
    missing_artifacts: [],
    invalid_artifacts: [],
    ...failureDiagnosticsOverrides
  };
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'evidence-pack-summary.json'), {
    schema_version: 1,
    date,
    generated_at: '2026-05-14T00:00:00.000Z',
    inputs: {
      required: [],
      optional: [],
      missing: [],
      used: []
    },
    publish_status: {
      status: 'needs-fix',
      run_mode: 'daily_draft',
      fact_check_status: 'NEEDS_FIX',
      final_publish_ready: false,
      public_newsletter_ready: false,
      review_pr_ready: true
    },
    selection_summary: selectionSummary,
    claim_validation_summary: {
      status: 'available',
      bound_claims: 2,
      total_claims: 2,
      overclaim_risk: 'low',
      available_article_count: 1,
      not_available_article_count: 0
    },
    hal_impact_summary: {
      axes: ['camera_pipeline', 'metadata'],
      article_count_with_axes: 1,
      article_count_without_axes: 0
    },
    selected_main_articles: [{
      candidate_id: 'selected-1',
      title: 'CameraX 1.6.0 alpha release',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.6.0-alpha01',
      source: 'Android Developers',
      source_tier: 'official_release_note',
      source_role: 'primary',
      source_url_quality: 'article_url',
      freshness_window: 'current',
      relevance_bucket: 'android_platform_camera_adjacent',
      hal_impact_axes: ['camera_pipeline', 'metadata'],
      claim_validation: {
        status: 'available',
        bound_claims: 2,
        total_claims: 2,
        overclaim_risk: 'low'
      },
      selection_reason: 'Camera pipeline behavior change with dated release evidence'
    }],
    reserve_candidates: [],
    excluded_candidates_top: [{
      candidate_id: 'excluded-1',
      title: 'Generic AI camera update',
      url: 'https://example.com/generic-ai-camera',
      source: 'Example Tech',
      relevance_bucket: 'generic_tech_watchlist',
      exclusion_reason: 'generic topic without HAL impact axis'
    }],
    excluded_candidates_truncated: false,
    failure_diagnostics: failureDiagnostics,
    warnings: [],
    ...restOverrides
  });
}

module.exports = {
  candidateShortageSummary,
  regressionCandidate,
  regressionSection,
  scopeCountForCandidate,
  writeArchiveSyncSurface,
  writeCandidateShortageReviewableArtifacts,
  writeEditorialReviewableArtifacts,
  writeFailedRawArtifactValidationArtifacts,
  writeFailedRepairReviewableArtifacts,
  writeFallbackOnlyReviewableArtifacts,
  writeHalSignalQualityReviewArtifacts,
  writeMinimalEvidencePackSummary,
  writeMinimalPublishArtifacts,
  writeNewsletterIndex,
  writePr39LikeRegressionFixture,
  writePublicNewsletterArtifacts,
  writeRootIndexContract,
  writeRun25590436113LikeFallbackFixture
};
