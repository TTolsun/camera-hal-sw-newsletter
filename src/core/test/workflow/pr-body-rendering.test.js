'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsroomPrBody,
  renderCandidateTraceability
} = require('../../../../scripts/build-newsroom-pr-body');
const {
  buildRawCandidatePrBody
} = require('../../../../scripts/build-raw-candidate-pr-body');
const {
  FAILED_LLM_CREDENTIALS,
  renderReport: renderSourceDiscoveryReport
} = require('../../../discovery/gemini-source-discovery-boundary');
const {
  renderEditorPrSummary
} = require('../../common/editor-pr-summary');
const {
  articlePolicy,
  qualityGatePolicy,
  publishGateCriteriaText
} = require('../../common/newsletter-policy');
const {
  validatePrBodyText,
  extractSections
} = require('../../../../scripts/validate-pr-body');
const {
  REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS,
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
} = require('../../../../scripts/resolve-reviewable-artifacts');
const {
  tempRoot: fsTempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');
const {
  assertTextInOrder,
  extractMarkdownSection
} = require('../helpers/workflow-yaml');
const {
  writeCandidateShortageReviewableArtifacts,
  writeEditorialReviewableArtifacts,
  writeFailedRepairReviewableArtifacts,
  writeMinimalEvidencePackSummary,
  writeMinimalPublishArtifacts,
  writePublicNewsletterArtifacts
} = require('../helpers/workflow-fixtures');

function traceCandidate(overrides = {}) {
  return {
    title: overrides.title || 'libcamera v0.7.1',
    url: overrides.url || 'https://example.com/libcamera-0.7.1',
    article_url: overrides.article_url || overrides.url || 'https://example.com/libcamera-0.7.1',
    source_name: overrides.source_name || 'libcamera',
    published_date: overrides.published_date || '2026-05-10',
    relevance_bucket: overrides.relevance_bucket || 'camera_driver_image_pipeline',
    deterministic_score: overrides.deterministic_score ?? 95,
    finalSelectionEligibility: overrides.finalSelectionEligibility || 'main',
    main_eligible: overrides.main_eligible ?? true,
    hasDatedEvidence: overrides.hasDatedEvidence ?? true,
    source_gap_risk: overrides.source_gap_risk ?? false,
    selection_exclusion_reason: overrides.selection_exclusion_reason || '공식 release evidence와 camera pipeline 영향이 확인되었습니다.',
    ...overrides
  };
}

function traceStatus(overrides = {}) {
  return {
    status: 'NEEDS_FIX',
    fact_check_status: 'NEEDS_FIX',
    must_fix_count: 1,
    source_gap_count: 1,
    quality_status: 'NEEDS_FIX',
    quality_score: 72,
    quality_threshold: qualityGatePolicy.threshold,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false,
    review_gate_passed: true,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0,
    validate_outcome: 'failure',
    consistency_errors: [],
    ...overrides
  };
}

test('editor PR summary renderer keeps stable top-level sections and escapes table cells', () => {
  const body = renderEditorPrSummary({
    stage: 'manual_source_collect',
    verdict: {
      label: '검토 | 필요',
      action: '',
      firstLook: '후보 table을 먼저 확인하세요.'
    },
    handoff: {
      nextStep: 'run_02',
      label: '02 진행 가능',
      reason: 'RAW artifact가 있습니다.'
    },
    summaryRows: [
      ['생성 단계', 'RAW 후보 수집'],
      ['pipe', 'Camera|HAL'],
      ['empty', '']
    ],
    checklistItems: ['source gap 여부'],
    resultRows: [
      ['후보 수', 2, '충분']
    ]
  });

  assertTextInOrder(body, [
    '## 최종 판단',
    '## 이번 PR 요약',
    '## 반드시 확인할 항목',
    '## 주요 결과',
    '## 상세 report'
  ]);
  assert.match(body, /검토 \\| 필요/);
  assert.match(body, /Camera\\\|HAL/);
  assert.match(body, /\| empty \| 알 수 없음 \|/);
  assert.match(body, /편집장 액션: 산출물과 검증 결과를 확인하세요\./);
  assert.match(body, /아래 항목은 상세 판단용 요약과 artifact pointer입니다/);
  assert.doesNotMatch(body, /<details>/);
});

test('RAW candidate PR body puts editor-facing summary before detailed compatibility report', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-16';
  const dir = path.join(root, 'content', 'collected-news', date);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'manual-candidates.json'), {
    candidates: [
      {
        title: 'CameraX release',
        reliability: 'official',
        relevance_bucket: 'direct_aosp_camera',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera'
      },
      {
        title: 'Generic AI tooling',
        reliability: 'official',
        relevance_bucket: 'generic_tech_watchlist',
        finalSelectionEligibility: 'watchlist',
        url: 'https://example.com/ai'
      }
    ]
  });
  writeJson(path.join(dir, 'raw-candidate-manifest.json'), {
    source_count: 2,
    collection_intent_status: '',
    seed_url_count: 0,
    keyword_hint_count: 0
  });

  const body = buildRawCandidatePrBody({ root, date });

  assertTextInOrder(body, [
    '## 최종 판단',
    '## 이번 PR 요약',
    '## 반드시 확인할 항목',
    '## 주요 결과',
    '## 상세 report',
    'source change event report'
  ]);
  assert.match(body, /next_step: run_02/);
  assert.match(body, /direct Camera\/HAL 후보 \| 1 \| 있음/);
  assert.match(body, /private\/internal URL fetch 없음/);
  assert.ok(body.indexOf('private/internal URL fetch 없음') < body.indexOf('## 상세 report'));
  assert.doesNotMatch(body, /<details>/);
  assert.doesNotMatch(body, /Priority Override \/ Legacy Compatibility/);
});

test('source discovery PR report normalizes top rejected reasons and handoff states', () => {
  const date = '2026-05-16';
  const passThrough = renderSourceDiscoveryReport({
    date,
    status: 'PASS',
    disabledPassThrough: true,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode: 'disabled_pass_through',
    discoveryStats: {
      manual_candidate_count: 1,
      gemini_candidate_count: 0,
      gemini_new_unique_url_count: 0,
      gemini_publishable_candidate_count: 0,
      gemini_manual_duplicate_url_count: 0,
      merged_candidate_count: 1
    },
    mergedCandidateRelPath: `content/collected-news/${date}/merged-candidates.json`
  });
  assert.match(passThrough, /next_step: strengthen_candidates/);
  assert.match(passThrough, /03 진행 가능하나 후보 보강 권장/);

  const seedPublishable = renderSourceDiscoveryReport({
    date,
    status: 'PASS',
    disabledPassThrough: true,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode: 'seed_evidence_expansion',
    discoveryStats: {
      manual_candidate_count: 1,
      gemini_candidate_count: 0,
      gemini_new_unique_url_count: 0,
      gemini_publishable_candidate_count: 0,
      gemini_manual_duplicate_url_count: 0,
      seed_candidate_count: 1,
      seed_new_unique_url_count: 1,
      seed_publishable_candidate_count: 1,
      merged_candidate_count: 2
    },
    mergedCandidateRelPath: `content/collected-news/${date}/merged-candidates.json`
  });
  assert.match(seedPublishable, /next_step: run_03/);
  assert.match(seedPublishable, /Seed evidence expansion에서 publishable 후보가 확인되었습니다/);
  assert.match(seedPublishable, /\| seed publishable 후보 \| 1 \| 있음 \|/);

  const parserWarning = renderSourceDiscoveryReport({
    date,
    status: 'PASS',
    disabledPassThrough: false,
    llmUsed: true,
    geminiCandidateCount: 2,
    mergeMode: 'gemini_source_discovery',
    discoveryStats: {
      manual_candidate_count: 40,
      gemini_candidate_count: 2,
      gemini_new_unique_url_count: 0,
      gemini_publishable_candidate_count: 0,
      gemini_manual_duplicate_url_count: 2,
      merged_candidate_count: 42
    },
    mergedCandidateRelPath: `content/collected-news/${date}/merged-candidates.json`,
    sourceDiscoveryFeedbackReport: {
      status: 'WARNING',
      parser_gap_count: 1,
      gemini_parser_failure_count: 2
    },
    rejectedProposals: [
      { rejected_reason: 'discovered_not_extractable', url: 'https://example.com/a' },
      { rejected_reason: 'domain_not_allowed', url: 'https://example.com/b' }
    ]
  });
  const parserWarningTop = parserWarning.slice(0, parserWarning.indexOf('## 상세 report'));
  assert.match(parserWarningTop, /rejected: parser_gap/);
  assert.match(parserWarningTop, /rejected: taxonomy_gap/);
  assert.doesNotMatch(parserWarningTop, /discovered_not_extractable/);
  assert.doesNotMatch(parserWarning, /discovered_not_extractable/);

  const credentialFailure = renderSourceDiscoveryReport({
    date,
    status: FAILED_LLM_CREDENTIALS,
    disabledPassThrough: false,
    llmUsed: false,
    geminiCandidateCount: 0,
    mergeMode: 'gemini_source_discovery',
    discoveryStats: null
  });
  assert.match(credentialFailure, /next_step: blocked/);
  assert.match(credentialFailure, /rejected: credential_failure/);
});

test('newsroom PR body treats FAILED_REPAIR_REVIEWABLE as needs-fix review flow', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    status: {
      quality_status: 'NEEDS_FIX',
      quality_score: 79,
      final_publish_ready: false,
      rendered_main_article_count: articlePolicy.mainArticleCount.min,
      selected_article_count: articlePolicy.mainArticleCount.min,
      final_selected_article_count: articlePolicy.mainArticleCount.min,
      primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
      supporting_main_article_count: articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired,
      forbidden_main_article_count: 0,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    },
    quality: {
      status: 'NEEDS_FIX',
      score: 79,
      threshold: qualityGatePolicy.threshold
    }
  });
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
  });

  assert.match(body, /^## Diagnostics-only Status$/m);
  assert.match(body, /diagnostics_only: true/);
  assert.match(body, /public_newsletter_ready: false/);
  assert.match(body, /homepage_visible_after_merge: false/);
  assert.match(body, /This PR is not publish-ready/);
  assert.match(body, /^## Public Newsletter Readiness$/m);
  assert.match(body, /^## Failure Diagnostics$/m);
  assert.match(body, /전체 상태: NEEDS_FIX/);
  assert.match(body, /생성 실행 상태: FAILED_REPAIR_REVIEWABLE/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /권장 조치:/);
  assert.doesNotMatch(body, /최종 발행 조건이 모두 통과했습니다/);
  const validation = validatePrBodyText(body, { date });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
});

test('newsroom PR body and validator accept candidate shortage review-only handoff without LLM artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-11';
  writeCandidateShortageReviewableArtifacts(root, date);
  const changedArtifacts = REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
    .map(file => `content/newsroom/${date}/${file}`);

  const fallbackBody = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts
  });

  assert.match(fallbackBody, /^## Candidate Pool Preflight$/m);
  assert.match(fallbackBody, /LLM editor generation was skipped because candidate pool was insufficient\./);
  assert.match(fallbackBody, /candidate_shortage: true/);
  assert.match(fallbackBody, /candidate_pool_preflight_passed: false/);
  assert.match(fallbackBody, /preflight_source: selection-report\.json/);
  assert.match(fallbackBody, /preflight_consistency: ok/);
  assert.match(fallbackBody, /failure_kind=candidate_shortage_reviewable/);
  assert.match(fallbackBody, /publishable_candidate_count: 0/);
  assert.match(fallbackBody, /required_publishable_candidate_count: 1/);
  assert.match(fallbackBody, /reserve_candidate_count: 0/);
  assert.match(fallbackBody, /publishable_candidate_shortage/);
  assert.match(fallbackBody, /Source\/parser hints \(preliminary\):/);
  assert.match(fallbackBody, /OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR \/ android-developers-jetpack-release/);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'quality-report.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json')), false);
  const fallbackValidation = validatePrBodyText(fallbackBody, { date });
  assert.equal(fallbackValidation.ok, true, fallbackValidation.errors.join('\n'));

  const mismatchBody = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts,
    status: {
      candidate_pool_preflight_passed: true,
      failure_kind: 'candidate_shortage_reviewable'
    }
  });
  const bodyPath = path.join(root, '.tmp', 'newsroom-pr-body.md');
  writeText(bodyPath, mismatchBody);
  const mismatchCandidatePoolSection = extractMarkdownSection(mismatchBody, 'Candidate Pool Preflight');

  assert.match(mismatchCandidatePoolSection, /candidate_pool_preflight_passed: false/);
  assert.match(mismatchCandidatePoolSection, /preflight_source: selection-report\.json/);
  assert.match(mismatchCandidatePoolSection, /preflight_consistency: mismatch/);
  assert.equal(validatePrBodyText(mismatchBody, { date }).ok, true);

  writeJson(path.join(root, 'content', 'newsroom', date, 'source-effectiveness-report.json'), {
    sources: [{
      source_id: 'android-developers-jetpack-release',
      recommendation: 'KEEP_AND_FIX_PARSER',
      reasons: ['rich source effectiveness parser repair recommendation'],
      eligible_count: 0
    }]
  });
  const richBody = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts
  });
  const richCandidatePoolSection = extractMarkdownSection(richBody, 'Candidate Pool Preflight');

  assert.match(richCandidatePoolSection, /Source\/parser hints:/);
  assert.doesNotMatch(richCandidatePoolSection, /Source\/parser hints \(preliminary\):/);
  assert.match(richCandidatePoolSection, /KEEP_AND_FIX_PARSER \/ android-developers-jetpack-release: rich source effectiveness parser repair recommendation/);
  assert.doesNotMatch(richCandidatePoolSection, /collected CameraX rows but no eligible source_extraction item/);
});

test('newsroom PR body renders generated artifacts in review inventory order', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-12';
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const status = traceStatus({
    status: 'PASS',
    seed_used: true,
    public_artifact_ready: true,
    public_newsletter_ready: true,
    review_publication_ready: true,
    final_publish_ready: false,
    artifact_final_publish_ready: false,
    publish_gate_passed: false,
    fact_check_status: 'PASS',
    quality_status: 'PASS',
    quality_score: 91,
    must_fix_count: 0,
    source_gap_count: 0
  });
  const files = [
    ['00-review-guide.md', '# Review Guide\n'],
    ['editor-in-chief-brief.md', '# Editor Brief\n'],
    ['seed-evidence-pack.md', '# Seed Evidence\n'],
    ['seed-merge-report.md', '# Seed Merge\n'],
    ['fact-check-report.md', '# Fact Check\n'],
    ['quality-report.md', '# Quality\n'],
    ['hal-signal-quality-report.md', '# HAL\n']
  ];
  for (const [filename, content] of files) {
    writeText(path.join(newsroomDir, filename), content);
  }
  writeJson(path.join(newsroomDir, 'seed-evidence-pack.json'), { schema_version: 1 });
  writePublicNewsletterArtifacts(root, date);

  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'success',
    status,
    changedArtifacts: [
      ...files.map(([filename]) => `content/newsroom/${date}/${filename}`),
      `content/newsroom/${date}/seed-evidence-pack.json`,
      `newsletters/${date}/newsletter.md`,
      `newsletters/${date}/index.html`,
      'data/newsletters.json'
    ]
  });
  const generated = extractMarkdownSection(body, '생성 산출물');

  assertTextInOrder(generated, [
    '### 필수 확인',
    `content/newsroom/${date}/00-review-guide.md`,
    `content/newsroom/${date}/editor-in-chief-brief.md`,
    `content/newsroom/${date}/seed-evidence-pack.md`,
    `content/newsroom/${date}/seed-merge-report.md`,
    '### 최종 기사 / 공개 출력',
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`,
    '### 사실성 / 품질 / HAL 게이트',
    `content/newsroom/${date}/fact-check-report.md`,
    `content/newsroom/${date}/quality-report.md`,
    `content/newsroom/${date}/hal-signal-quality-report.md`,
    '### 디버그 근거',
    `heavy files (debug_heavy/transient_attempt)`,
    `retained_heavy_artifacts`
  ]);
  const validation = validatePrBodyText(body, { date });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
});

test('newsroom PR body marks editorial reviewable handoff as editor-approved public publication', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);
  const changedArtifacts = [
    `content/newsroom/${date}/editor-draft.json`,
    `content/newsroom/${date}/fact-check-report.json`,
    `content/newsroom/${date}/quality-report.json`,
    `content/newsroom/${date}/generation-status.json`,
    `newsletters/${date}/newsletter.md`,
    `newsletters/${date}/index.html`,
    'data/newsletters.json'
  ];

  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'skipped',
    changedArtifacts
  });

  assert.match(body, /편집장 검토 경고:/);
  assert.match(body, /public newsletter files는 생성되었습니다/);
  assert.match(body, /failure_kind=editorial_reviewable/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /validate_ok=false/);
  assert.match(body, /editor_review_required=true/);
  assert.match(body, /review_publication_ready: true/);
  assert.match(body, /diagnostics_only: false/);
  assert.match(body, /homepage_visible_after_merge: true/);
  assert.match(body, /\| 편집자 승인 발행 가능 여부 \| 가능 \|/);
  assert.match(body, /\| Merge 후 홈페이지 표시 여부 \| 표시됨 \|/);
  assert.match(body, /\| publish-ready label \| 붙이지 않음 \|/);
  assert.match(body, new RegExp(`newsletters/${date}/newsletter\\.md`));
  assert.match(body, new RegExp(`newsletters/${date}/index\\.html`));
  assert.match(body, /data\/newsletters\.json/);
  assert.doesNotMatch(body, /not generated|not updated|생성하지 않은 public 산출물/);
  const sections = extractSections(body);
  const generatedArtifactsSection = [...sections.values()]
    .find(section => section.includes(`newsletters/${date}/newsletter.md`)) || '';
  assert.match(generatedArtifactsSection, new RegExp(`newsletters/${date}/newsletter\\.md`));
  assert.match(generatedArtifactsSection, new RegExp(`newsletters/${date}/index\\.html`));
  assert.match(generatedArtifactsSection, /data\/newsletters\.json/);
  const bodyValidation = validatePrBodyText(body);
  assert.equal(bodyValidation.ok, true, JSON.stringify(bodyValidation, null, 2));

  const missingNotice = body.replace(/^.*public newsletter files는 생성되었습니다.*\n/gm, '');
  const result = validatePrBodyText(missingNotice);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /public newsletter files were generated/);

  const notGeneratedPublicArtifact = body.replace(
    `- newsletters/${date}/newsletter.md`,
    `- newsletters/${date}/newsletter.md - not generated`
  );
  const notGeneratedResult = validatePrBodyText(notGeneratedPublicArtifact, { date });
  assert.equal(notGeneratedResult.ok, false);
  assert.match(notGeneratedResult.errors.join('\n'), /must not describe public newsletter files as not generated/);
});

test('newsroom PR body renders editor article decision summary with pipeline state', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date, {
    selection_summary: {
      selected_main_article_count: 3,
      supporting_bucket_count: 2
    },
    selected_main_articles: [
      {
        title: 'libcamera v0.7.1 release',
        url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000001.html',
        source: 'libcamera Release Announcements',
        source_tier: 'high',
        source_reliability: 'project-official',
        relevance_bucket: 'camera_driver_image_pipeline',
        source_gap_risk: false,
        has_dated_evidence: true,
        hal_impact_axes: ['driver', 'image pipeline'],
        selection_reason: 'libcamera release with V4L2 and image pipeline evidence'
      },
      {
        title: 'GCC 16.1 released',
        url: 'https://isocpp.org/blog/2026/04/gcc-16.1',
        source: 'ISO C++ Blog',
        source_tier: 'high',
        relevance_bucket: 'cpp_ai_tooling_fallback',
        source_gap_risk: false,
        has_dated_evidence: true,
        selection_reason: 'native C++ toolchain fallback for HAL build workflow'
      },
      {
        title: 'CameraX release row missing extraction',
        url: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.6.1',
        source: 'Android Developers Latest Updates',
        source_tier: 'high',
        source_role: 'official',
        relevance_bucket: 'android_platform_camera_adjacent',
        source_gap_risk: true,
        has_dated_evidence: true,
        selection_reason: 'CameraX release-note candidate has no concrete source_extraction bullet'
      }
    ],
    reserve_candidates: [
      {
        title: 'Glaze 7.2 C++ reflection',
        url: 'https://isocpp.org/blog/2026/04/glaze-7.2',
        source: 'ISO C++ Blog',
        source_tier: 'high',
        relevance_bucket: 'cpp_ai_tooling_fallback',
        source_gap_risk: false,
        has_dated_evidence: true,
        selection_reason: 'C++ serialization watch item'
      }
    ],
    excluded_candidates_top: [
      {
        title: 'Generic AI camera update',
        url: 'https://example.com/generic-ai-camera',
        source: 'Example Tech',
        relevance_bucket: 'generic_tech_watchlist',
        exclusion_reason: 'generic AI noise'
      }
    ]
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const summary = extractMarkdownSection(body, '편집자 기사 판단 요약');
  const verdict = extractMarkdownSection(body, '편집자 결론');

  assert.match(body, /^## 편집자 기사 판단 요약$/m);
  assert.match(body, /^## 편집자 결론$/m);
  assert.match(body, /^## 판단 라벨 의미$/m);
  assert.match(summary, /\| 순위 \| 기사 \| 편집 판단 \| Pipeline 상태 \| Bucket \| 왜 중요한가 \| 위험 \/ 과장 방지 \|/);
  assert.match(summary, /libcamera v0\.7\.1 release/);
  assert.match(summary, /메인\(Main\)/);
  assert.match(summary, /GCC 16\.1 released/);
  assert.match(summary, /보조\(Supporting\)/);
  assert.match(summary, /Glaze 7\.2 C\+\+ reflection/);
  assert.match(summary, /짧은 소식\(Short\)/);
  assert.match(summary, /CameraX release row missing extraction/);
  assert.match(summary, /보류\(Hold\)/);
  assert.match(summary, /자동 선택\(final_selected\)/);
  assert.match(summary, /parser\/source 보류/);
  assert.doesNotMatch(summary, /점수|score/i);
  assert.match(verdict, /발행 권고: 자동 발행 금지 \/ Review-only/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body only promotes soc platform signal with explicit camera pipeline evidence', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date, {
    selected_main_articles: [
      {
        title: 'SoC ISP thermal camera pipeline update',
        url: 'https://example.com/soc-camera-isp-thermal',
        source: 'SoC Vendor Notes',
        source_tier: 'medium',
        relevance_bucket: 'soc_platform_signal',
        source_gap_risk: false,
        has_dated_evidence: true,
        hal_impact_axes: ['camera', 'image pipeline', 'thermal', 'resource'],
        selection_reason: 'ISP thermal throttling can affect camera image pipeline performance'
      },
      {
        title: 'Generic SoC performance update',
        url: 'https://example.com/soc-generic-performance',
        source: 'SoC Vendor Notes',
        source_tier: 'medium',
        relevance_bucket: 'soc_platform_signal',
        source_gap_risk: false,
        has_dated_evidence: true,
        hal_impact_axes: ['resource'],
        selection_reason: 'General CPU benchmark update'
      }
    ],
    excluded_candidates_top: []
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const summary = extractMarkdownSection(body, '편집자 기사 판단 요약');

  assert.match(summary, /SoC ISP thermal camera pipeline update[\s\S]*메인\(Main\)/);
  assert.match(summary, /Generic SoC performance update[\s\S]*관찰\(Watch\)|Generic SoC performance update[\s\S]*보조\(Supporting\)/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body handles missing evidence pack with shortlist fallback', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  const finalCandidate = traceCandidate({
    title: 'Fallback libcamera release',
    url: 'https://example.com/fallback-libcamera',
    relevance_bucket: 'camera_driver_image_pipeline',
    final_selected: true,
    primary_selected: true,
    source_gap_risk: false
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [finalCandidate],
    reserve_candidates: []
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const summary = extractMarkdownSection(body, '편집자 기사 판단 요약');

  assert.match(summary, /Fallback libcamera release/);
  assert.match(summary, /메인\(Main\)/);
  assert.match(summary, /source: shortlisted-candidates\.json/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body reports editorial summary truncation explicitly', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  const selected = Array.from({ length: 10 }, (_, index) => ({
    title: `Camera pipeline candidate ${String(index + 1).padStart(2, '0')}`,
    url: `https://example.com/camera-pipeline-${index + 1}`,
    source: 'Example Camera Source',
    source_tier: 'high',
    relevance_bucket: 'camera_driver_image_pipeline',
    source_gap_risk: false,
    has_dated_evidence: true,
    hal_impact_axes: ['driver', 'image pipeline'],
    selection_reason: 'camera image pipeline source evidence'
  }));
  writeMinimalEvidencePackSummary(root, date, {
    selected_main_articles: selected,
    reserve_candidates: [],
    excluded_candidates_top: []
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const verdict = extractMarkdownSection(body, '편집자 결론');

  assert.match(verdict, /표시된 후보: 8개 \/ 전체 후보: 10개/);
  assert.match(verdict, /생략된 후보: 2개, 전체 후보는 `후보 기사 추적` 또는 관련 JSON artifact에서 확인하세요\./);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body loads reporter fallback object array and selected candidate shapes as report-only', () => {
  const cases = [
    {
      name: 'object candidates',
      value: {
        candidates: [traceCandidate({
          title: 'Object root reporter candidate',
          url: 'https://example.com/reporter-object',
          relevance_bucket: 'camera_driver_image_pipeline'
        })]
      },
      title: 'Object root reporter candidate'
    },
    {
      name: 'array root',
      value: [traceCandidate({
        title: 'Array root reporter candidate',
        url: 'https://example.com/reporter-array',
        relevance_bucket: 'camera_driver_image_pipeline'
      })],
      title: 'Array root reporter candidate'
    },
    {
      name: 'selected_candidates',
      value: {
        selected_candidates: [traceCandidate({
          title: 'Snake selected reporter candidate',
          url: 'https://example.com/reporter-selected-snake',
          relevance_bucket: 'camera_driver_image_pipeline',
          final_selected: true
        })]
      },
      title: 'Snake selected reporter candidate'
    },
    {
      name: 'selectedCandidates',
      value: {
        selectedCandidates: [traceCandidate({
          title: 'Camel selected reporter candidate',
          url: 'https://example.com/reporter-selected-camel',
          relevance_bucket: 'camera_driver_image_pipeline',
          final_selected: true
        })]
      },
      title: 'Camel selected reporter candidate'
    }
  ];

  for (const item of cases) {
    const root = fsTempRoot('newsroom-pr-body-');
    const date = '2026-05-10';
    writeJson(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), item.value);

    const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
    const summary = extractMarkdownSection(body, '편집자 기사 판단 요약');

    assert.match(summary, new RegExp(item.title), item.name);
    assert.match(summary, /source: reporter-candidates\.json/, item.name);
    assert.match(summary, /report-only/, item.name);
    assert.match(summary, new RegExp(`${item.title}[\\s\\S]*관찰\\(Watch\\)`), item.name);
    assert.doesNotMatch(summary, /자동 선택\(final_selected\)/, item.name);
    assert.equal(validatePrBodyText(body, { date }).ok, true, item.name);
  }
});

test('newsroom PR body keeps editorial summary section order by publication state', () => {
  const reviewRoot = fsTempRoot('newsroom-pr-body-');
  const reviewDate = '2026-05-10';
  writeMinimalEvidencePackSummary(reviewRoot, reviewDate);
  writeEditorialReviewableArtifacts(reviewRoot, reviewDate);
  writePublicNewsletterArtifacts(reviewRoot, reviewDate);
  const reviewBody = buildNewsroomPrBody({
    root: reviewRoot,
    date: reviewDate,
    validateOutcome: 'failure',
    status: traceStatus({ review_publication_ready: true, final_publish_ready: false }),
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${reviewDate}/${file}`)
      .concat([
        `newsletters/${reviewDate}/newsletter.md`,
        `newsletters/${reviewDate}/index.html`,
        'data/newsletters.json'
      ])
  });

  assertTextInOrder(reviewBody, [
    '## 최종 판단',
    '## 상세 report',
    '## 발행 상태 요약',
    '## 편집자 기사 판단 요약',
    '## 생성 상태'
  ]);
  const reviewTop = reviewBody.slice(0, reviewBody.indexOf('## 상세 report'));
  assert.match(reviewTop, /편집장 승인 시 공개 가능\(단, publish-ready 아님\)/);
  assert.match(reviewTop, /final_publish_ready \| false/);
  assert.match(reviewTop, /review_publication_ready \| true/);
  assert.match(reviewTop, /publish-ready label 금지/);
  assert.match(reviewTop, /merge 시 홈페이지 표시 가능/);
  assert.doesNotMatch(reviewTop, /AI 자동 발행 가능/);

  const publishRoot = fsTempRoot('newsroom-pr-body-');
  const publishDate = '2026-05-11';
  writeMinimalEvidencePackSummary(publishRoot, publishDate);
  const publishBody = buildNewsroomPrBody({
    root: publishRoot,
    date: publishDate,
    validateOutcome: 'success',
    status: traceStatus({
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'PASS',
      quality_score: 90,
      selection_publish_ready: true,
      final_publish_ready: true,
      publish_gate_passed: true,
      review_gate_passed: true,
      validate_ok: true
    })
  });

  assertTextInOrder(publishBody, [
    '## 최종 판단',
    '## 상세 report',
    '## 편집자 기사 판단 요약',
    '## 발행 상태 요약',
    '## 생성 상태'
  ]);
  const publishTop = publishBody.slice(0, publishBody.indexOf('## 상세 report'));
  assert.match(publishTop, /AI 자동 발행 가능/);
  assert.match(publishTop, /final_publish_ready \| true/);
  assert.doesNotMatch(publishTop, /publish-ready label 금지/);
});

test('diagnostics-only PR body keeps status first and shows insufficient evidence notice', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
  });

  assert.ok(body.indexOf('## 최종 판단') < body.indexOf('## Diagnostics-only Status'));
  assert.ok(body.indexOf('## Diagnostics-only Status') < body.indexOf('## 편집자 기사 판단 요약'));
  assert.ok(body.indexOf('## 편집자 기사 판단 요약') < body.indexOf('## 생성 상태'));
  const top = body.slice(0, body.indexOf('## 상세 report'));
  assert.match(top, /진단 전용/);
  assert.match(top, /diagnostics_only \| true/);
  assert.match(top, /public_newsletter_ready \| false/);
  assert.match(top, /merge해도 홈페이지에 표시되지 않습니다/);
  assert.doesNotMatch(top, /public newsletter files는 생성되었습니다/);
  assert.match(body, /편집자 기사 판단 요약을 생성할 충분한 evidence가 없습니다\./);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body top summary counts final hard blockers beyond must-fix and source gap', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const qualityBody = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'success',
    status: traceStatus({
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'NEEDS_FIX',
      fact_check_status: 'PASS',
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0,
      validate_outcome: 'success',
      publish_gate_passed: true
    })
  });
  const qualityResults = extractMarkdownSection(qualityBody, '주요 결과');
  assert.match(qualityResults, /\| hard blocker \| 1 \| quality_status=NEEDS_FIX \|/);

  const staleBody = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'success',
    status: traceStatus({
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'PASS',
      fact_check_status: 'PASS',
      stale_claim_status: 'NEEDS_FIX',
      stale_claim_hard_failure_count: 1,
      validate_outcome: 'success',
      publish_gate_passed: true
    })
  });
  const staleResults = extractMarkdownSection(staleBody, '주요 결과');
  assert.match(staleResults, /\| hard blocker \| 1 \| stale claim hard failure 1건 \|/);

  const validationBody = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    status: traceStatus({
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'PASS',
      fact_check_status: 'PASS',
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0,
      validate_outcome: 'failure',
      publish_gate_passed: true
    })
  });
  const validationResults = extractMarkdownSection(validationBody, '주요 결과');
  assert.match(validationResults, /\| hard blocker \| 1 \| validate_outcome=failure \|/);
});

test('newsroom PR body omits detailed Evidence Pack summary sections', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';

  writeJson(path.join(root, 'content', 'newsroom', date, 'evidence-pack-summary.json'), {
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
    selection_summary: {
      raw_candidate_count: 14,
      eligible_candidate_count: 3,
      selected_main_article_count: 2,
      reserve_candidate_count: 1,
      excluded_candidate_count: 11,
      primary_camera_stack_count: 1,
      supporting_bucket_count: 1,
      fallback_window_used: null,
      fallback_window_consulted: true,
      fallback_window_reason: 'primary window selected 1 article(s), below min 3',
      fallback_candidates_promoted_count: 2,
      fallback_bucket_used: true
    },
    claim_validation_summary: {
      status: 'partial',
      bound_claims: 2,
      total_claims: 3,
      overclaim_risk: 'medium',
      available_article_count: 1,
      not_available_article_count: 1
    },
    hal_impact_summary: {
      axes: ['camera_pipeline', 'metadata'],
      article_count_with_axes: 1,
      article_count_without_axes: 0
    },
    selected_main_articles: [
      {
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
          total_claims: 3,
          overclaim_risk: 'medium'
        },
        selection_reason: 'Camera pipeline behavior change with dated release evidence'
      }
    ],
    reserve_candidates: [],
    excluded_candidates_top: [
      {
        candidate_id: 'excluded-1',
        title: 'Generic AI camera update',
        url: 'https://example.com/generic-ai-camera',
        source: 'Example Tech',
        relevance_bucket: 'generic_tech_watchlist',
        exclusion_reason: 'generic topic without HAL impact axis'
      }
    ],
    excluded_candidates_truncated: true,
    failure_diagnostics: {
      quality_hard_failures: ['source-integrity'],
      fact_check_must_fix: [{ location: 'CameraX', problem: 'needs source binding' }],
      repair_failures: ['section_count_drift'],
      candidate_shortage_hints: ['primary camera stack shortage'],
      source_gap_warnings: ['source gap on selected-1'],
      missing_artifacts: ['content/newsroom/2026-05-10/fact-check-report.json'],
      invalid_artifacts: [{ path: 'content/newsroom/2026-05-10/quality-report.json', error: 'Unexpected token' }]
    },
    warnings: []
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.doesNotMatch(body, /^## Evidence Pack 요약$/m);
  assert.doesNotMatch(body, /^## Claim \/ HAL Impact 요약$/m);
  assert.doesNotMatch(body, /^## 선택된 Main Article 근거$/m);
  assert.doesNotMatch(body, /^## 제외 후보 근거$/m);
  assert.doesNotMatch(body, /^## Needs-fix \/ Review-only 진단$/m);
  assert.doesNotMatch(body, /^## 사람 검토 체크리스트$/m);
  assert.match(body, /^## 후보 기사 추적$/m);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body omits Evidence Pack fallback diagnostics defaults', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.doesNotMatch(body, /^## Evidence Pack 요약$/m);
  assert.doesNotMatch(body, /Fallback window consulted: unknown/);
  assert.doesNotMatch(body, /Fallback window reason: none/);
  assert.doesNotMatch(body, /Fallback promoted candidates: unknown/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body omits Seed Evidence usage detail when seed artifacts exist', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);
  writeJson(path.join(root, 'content', 'collected-news', date, 'seed-evidence-pack.json'), {
    schema_version: 1,
    report_type: 'seed_evidence_pack',
    newsletter_date: date,
    packs: [{
      evidence_pack_id: 'seed-camerax-pack',
      primary_evidence: [{ evidence_id: 'seed-camerax-primary-01' }]
    }]
  });
  writeJson(path.join(root, 'content', 'collected-news', date, 'merged-candidates.json'), {
    schema_version: 5,
    date,
    newsletter_date: date,
    candidates: [{
      title: 'CameraX 1.6.1 seed evidence',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
      origin: 'seed_url_evidence',
      evidence_pack_ids: ['seed-camerax-pack'],
      primary_evidence_ids: ['seed-camerax-primary-01'],
      source_extraction_ref: 'seed-evidence-pack.json#/packs/0',
      compact_evidence: {
        primary_facts: ['CameraX 1.6.1 fixes a compile error.']
      }
    }]
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.doesNotMatch(body, /^## Seed Evidence Usage Summary$/m);
  assert.doesNotMatch(body, /seed-camerax-pack/);
  assert.doesNotMatch(body, /seed-camerax-primary-01/);
  assert.doesNotMatch(body, /Stage 3 seed re-crawl: prohibited/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body omits HAL signal quality detail when report exists', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'hal-signal-quality-report.json'), {
    schema_version: 1,
    report_type: 'hal_signal_quality',
    date,
    status: 'NEEDS_FIX',
    quality_status: 'NEEDS_FIX',
    inputs: {
      unavailable_optional: ['source_quality_report']
    },
    input_completeness: 'partial',
    hal_signal_quality_summary: {
      main_article_count: 1,
      strong_signal_count: 0,
      usable_signal_count: 1,
      weak_signal_count: 0,
      watchlist_only_count: 0,
      blocked_source_gap_count: 0,
      article_count_with_hal_signal_capsule: 1,
      article_count_without_hal_signal_capsule: 0,
      generic_signal_hard_blocker_count: 1,
      hal_signal_hard_blocker_count: 1
    },
    main_article_signal_checks: [{
      index: 1,
      title: 'CameraX release gives HAL teams a validation target',
      signal_quality_status: 'usable_signal',
      actionability_level: 'generic_review',
      effective_actionability_level: 'concrete_check',
      hal_impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
      hal_signal_capsule_complete: true,
      hard_blockers: ['fallback_promotion_missing_reason'],
      hard_blocker_reason_codes: ['fallback_promotion_not_allowed']
    }]
  });

  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    status: traceStatus({
      final_publish_ready: false,
      publish_gate_reason_codes: ['quality_status_needs_fix']
    })
  });

  assert.doesNotMatch(body, /^## HAL Signal Quality Summary$/m);
  assert.doesNotMatch(body, /input_completeness: partial/);
  assert.doesNotMatch(body, /HAL signal hard blocker count: 1/);
  assert.doesNotMatch(body, /fallback_promotion_not_allowed/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body truncates long HAL hard blocker affected article lists', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'hal-signal-quality-report.json'), {
    schema_version: 1,
    report_type: 'hal_signal_quality',
    date,
    status: 'NEEDS_FIX',
    quality_status: 'NEEDS_FIX',
    input_completeness: 'complete',
    inputs: {
      unavailable_optional: []
    },
    hal_signal_quality_summary: {
      main_article_count: 6,
      hal_signal_hard_blocker_count: 6
    },
    main_article_signal_checks: Array.from({ length: 6 }, (_, index) => ({
      index: index + 1,
      title: `Blocked HAL article ${index + 1}`,
      signal_quality_status: 'weak_signal',
      actionability_level: 'generic_review',
      effective_actionability_level: 'generic_review',
      hal_impact_axes: ['stream_buffer_metadata'],
      hal_signal_capsule_complete: true,
      hard_blocker_reason_codes: ['hal_generic_review_actionability']
    }))
  });

  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    status: traceStatus({ final_publish_ready: false })
  });

  assert.doesNotMatch(body, /Affected main articles:/);
  assert.doesNotMatch(body, /Affected main articles: .*Blocked HAL article 6/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body keeps Evidence Pack fallback when summary artifact is missing', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.doesNotMatch(body, /^## Evidence Pack 요약$/m);
  assert.doesNotMatch(body, /Evidence Pack summary: unavailable/);
  assert.doesNotMatch(body, new RegExp(`content/newsroom/${date}/evidence-pack-summary\\.json not found`));
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body renders Korean candidate traceability report', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  const finalCandidate = traceCandidate({
    title: 'libcamera v0.7.1 released',
    url: 'https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000001.html',
    final_selected: true,
    primary_selected: true,
    selected_for_editor: true
  });
  const reserveCandidate = traceCandidate({
    title: 'Glaze 7.2 C++ reflection',
    url: 'https://isocpp.org/blog/2026/05/glaze-7.2',
    source_name: 'ISO C++ Blog',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    deterministic_score: 82,
    finalSelectionEligibility: 'short',
    reserve_candidate: true,
    selection_exclusion_reason: '최종 기사와 source cluster가 겹쳐 reserve로 유지합니다.'
  });
  const excludedCandidate = traceCandidate({
    title: 'Generic Android UI update',
    url: 'https://example.com/generic-android-ui',
    source_name: 'Android Developers Blog',
    relevance_bucket: 'generic_tech_watchlist',
    deterministic_score: 22,
    final_selected: false,
    selected_for_editor: false,
    main_eligible: false,
    finalSelectionEligibility: 'watchlist',
    source_gap_risk: true,
    final_exclusion_reasons: ['generic_ai_noise', 'main_eligible=false']
  });
  const reportOnlyCandidate = traceCandidate({
    title: 'Report only HAL evidence',
    url: 'https://example.com/report-only-hal',
    source_name: 'Example Source',
    relevance_bucket: 'android_platform_camera_adjacent',
    deterministic_score: 55
  });

  writeJson(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), {
    date,
    candidates: [finalCandidate, reserveCandidate, excludedCandidate]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [finalCandidate],
    reserve_candidates: [reserveCandidate],
    excluded_candidates: [excludedCandidate]
  });
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), {
    candidates: [finalCandidate, reserveCandidate, excludedCandidate, reportOnlyCandidate]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
    status: 'NEEDS_FIX',
    deductions: [
      {
        category: 'claim-source-binding',
        points: 8,
        reason: 'Claim references unresolved evidence_id.',
        reason_code: 'unknown_evidence_id',
        location: reportOnlyCandidate.title,
        blocking: true
      }
    ],
    article_results: [
      {
        index: 1,
        headline: finalCandidate.title,
        status: 'FAIL',
        sources: [{ url: finalCandidate.url }],
        hard_fail_reasons: ['source-integrity']
      },
      {
        index: 2,
        headline: reportOnlyCandidate.title,
        status: 'FAIL',
        sources: [{ url: reportOnlyCandidate.url }],
        hard_fail_reasons: ['scope-relevance']
      }
    ]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'NEEDS_FIX',
    must_fix: [
      {
        location: reserveCandidate.title,
        problem: 'reserve 후보에도 fact-check 확인이 필요합니다.',
        source_url: reserveCandidate.url
      }
    ],
    source_gaps: [
      'section="Unmatched article"; url=https://example.com/unmatched-source-gap; action=replace-or-demote'
    ],
    source_gap_count: 1
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'event-bundles.json'), {
    schema_version: 1,
    date,
    summary: {
      total_count: 1
    },
    event_bundles: [{
      event_id: 'event_abcdef123456',
      primary_candidate_id: 'candidate_libcamera',
      event_key: 'source:libcamera-release-announcements:release:libcamera v0.7.1',
      event_type: 'release_note',
      primary_url: finalCandidate.url,
      evidence_urls: ['https://lists.libcamera.org/pipermail/libcamera-devel/2026-May/000002.html'],
      dedupe_reason: 'source_id + release.version',
      release: {
        version: 'libcamera v0.7.1',
        date: '2026-05-10'
      },
      component: 'libcamera / V4L2 camera pipeline',
      impact_axes: ['runtime_behavior_change'],
      confidence: 'high',
      warnings: []
    }]
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const finalSection = body.slice(body.indexOf('### 최종 선택 기사'), body.indexOf('### Reserve 후보'));

  assert.match(body, /^## 후보 기사 추적$/m);
  assert.match(body, /^### 한눈에 보는 후보 판단$/m);
  assert.match(body, /\| # \| Candidate ID \| 상태 \| 원문 기사 \| 출처\/날짜 \| Bucket \| 점수 \| 판단 사유 \|/);
  assert.match(body, /libcamera v0\.7\.1 released/);
  assert.match(finalSection, /final_selected/);
  assert.doesNotMatch(finalSection, /quality_fail/);
  assert.match(body, /Glaze 7\.2 C\+\+ reflection/);
  assert.match(body, /\| 1 \| `cand_\d{3}` \| reserve \|/);
  assert.match(body, /Report only HAL evidence/);
  assert.match(body, /quality_fail/);
  assert.match(body, /quality-report\.json/);
  assert.match(body, /unknown_evidence_id: Claim references unresolved evidence_id\./);
  assert.match(body, /fact-check-report\.json/);
  assert.match(body, /hard_fail/);
  assert.match(body, /must_fix/);
  assert.match(body, /^### Event Bundle 추적$/m);
  assert.match(body, /event_abcdef123456/);
  assert.match(body, /source_id \+ release\.version/);
  assert.match(body, /event-bundles\.json/);
  assert.match(body, /unmatched 품질\/팩트체크 연결 항목: 1/);
  assert.match(body, /\|\s*\d+\s*\| unmatched \| Unmatched article \| fact-check-report\.json \| source_gap \|/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body candidate traceability tolerates missing and malformed artifacts', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeText(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), '{ invalid json');
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: { title: 'not an array' },
    reserve_candidates: 'not an array'
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.match(body, /후보 기사 artifact를 찾을 수 없어 추적 섹션을 생성하지 못했습니다\./);
  assert.match(body, /읽기\/형식 요약:/);
  assert.match(body, /reporter-candidates\.json: JSON을 읽을 수 없습니다/);
  assert.match(body, /shortlisted-candidates\.json: selected_articles 필드가 배열이 아닙니다/);
  assert.match(body, new RegExp(`content/newsroom/${date}/reporter-candidates\\.json`));
  assert.match(body, new RegExp(`content/collected-news/${date}/candidates\\.json`));
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body separates quality score threshold and result in Korean status text', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const selectedBelowMinimum = configuredMinimum - 1;
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 90,
      quality_threshold: qualityGatePolicy.threshold,
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      review_gate_passed: true,
      publish_gate_passed: false,
      min_final_articles: configuredMinimum,
      absolute_min_reviewable_articles: articlePolicy.primaryCameraStack.minRequired,
      min_non_fallback_publish_ready_articles: configuredMinimum,
      composition_mode: 'NEEDS_FIX',
      selection_composition_mode: 'NEEDS_FIX',
      editor_review_required: true,
      deterministic_selected_count: 5,
      rendered_main_article_count: selectedBelowMinimum,
      reserve_candidate_count: 2,
      direct_aosp_camera_count: 0,
      camera_driver_image_pipeline_count: 1,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: 1,
      cpp_ai_tooling_fallback_count: 0,
      generic_tech_watchlist_count: 0,
      primary_camera_stack_topic_count: 1,
      supporting_main_article_count: selectedBelowMinimum,
      forbidden_main_article_count: 0,
      composition_reason: 'Deterministic selection needs editor review before publishing.',
      underfilled: true,
      selected_article_count: selectedBelowMinimum,
      final_selected_article_count: selectedBelowMinimum,
      input_candidate_count: 20,
      eligible_candidate_count: selectedBelowMinimum,
      final_exclusion_reason_summary: [
        { reason: 'missing dated evidence', count: 7 }
      ],
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 1,
      stale_claim_hard_failure_count: 0,
      source_gap_count: 0
    }
  });

  assert.match(body, /^## 생성 상태$/m);
  assert.equal((body.match(/^## 생성 상태$/gm) || []).length, 1);
  assert.doesNotMatch(body, /^## Generation Status$/m);
  assert.match(body, /품질 점수: 90/);
  assert.match(body, new RegExp(`품질 기준: ${qualityGatePolicy.threshold}`));
  assert.match(body, /품질 상태: NEEDS_FIX/);
  assert.match(body, /must_fix 요약: must_fix_count=0; source_gap_count=0/);
  assert.match(body, /Stale claim 상태: PASS/);
  assert.match(body, /Stale claim 요약: removed=1; hard_failures=0/);
  assert.match(body, /권장 조치:/);
  assert.doesNotMatch(body, /## 기사 구성 요약/);
  assert.doesNotMatch(body, /## Composition Summary/);
  assert.match(body, /composition_mode: NEEDS_FIX/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /검토 게이트: true \(review_gate_passed: true\)/);
  assert.match(body, /최종 발행 가능 여부: false \(final_publish_ready: false\)/);
  assert.match(body, new RegExp(`정책상 발행 조건: false \\(publish_gate_passed: false; ${publishGateCriteriaText().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
  assert.doesNotMatch(body, /발행 게이트:/);
  assert.match(body, /상태 일관성 오류: 없음 \(consistency_errors: none\)/);
  assert.match(body, /editor_review_required: true/);
  assert.match(body, /review_gate_passed: true/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /direct_aosp_camera count: 0/);
  assert.match(body, /deterministic_selected_count: 5/);
  assert.match(body, new RegExp(`rendered_main_article_count: ${selectedBelowMinimum}`));
  assert.match(body, /reserve_candidate_count: 2/);
  assert.match(body, /부족한 후보 경로: true/);
  assert.match(body, new RegExp(`선택된 발행 가능 article 수는 ${selectedBelowMinimum}개입니다\\. 최소 기준은 ${configuredMinimum}개입니다\\.`));
  assert.doesNotMatch(body, new RegExp(`90/${qualityGatePolicy.threshold}`));
});

test('newsroom PR body marks fallback composition explicitly', () => {
  const configuredSelectedCount = Math.min(
    articlePolicy.mainArticleCount.max,
    articlePolicy.mainArticleCount.min + articlePolicy.primaryCameraStack.minRequired
  );
  const configuredSupportingCount = configuredSelectedCount - articlePolicy.primaryCameraStack.minRequired;
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'PASS',
      quality_score: 91,
      quality_threshold: qualityGatePolicy.threshold,
      publish_ready: true,
      selection_publish_ready: true,
      final_publish_ready: true,
      review_gate_passed: true,
      publish_gate_passed: true,
      min_final_articles: articlePolicy.mainArticleCount.min,
      absolute_min_reviewable_articles: articlePolicy.primaryCameraStack.minRequired,
      min_non_fallback_publish_ready_articles: articlePolicy.mainArticleCount.min,
      editor_review_required: false,
      underfilled: false,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION',
      direct_aosp_camera_count: 0,
      camera_driver_image_pipeline_count: 0,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: configuredSupportingCount,
      cpp_ai_tooling_fallback_count: 0,
      generic_tech_watchlist_count: 0,
      primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
      supporting_main_article_count: configuredSupportingCount,
      forbidden_main_article_count: 0,
      composition_reason: 'Primary AOSP Camera/driver/platform-adjacent candidates were below the normal target.',
      deterministic_selected_count: configuredSelectedCount,
      rendered_main_article_count: configuredSelectedCount,
      reserve_candidate_count: 5,
      selected_article_count: configuredSelectedCount,
      final_selected_article_count: configuredSelectedCount,
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 0,
      stale_claim_hard_failure_count: 0
    }
  });

  assert.match(body, /composition_mode: FALLBACK_COMPOSITION/);
  assert.match(body, new RegExp(`soc_platform_signal count: ${configuredSupportingCount}`));
  assert.match(body, /cpp_ai_tooling_fallback count: 0/);
  assert.match(body, /Fallback composition:/);
  assert.match(body, /정책상 public-ready로 허용됩니다/);
  assert.match(body, /editor_review_required: false/);
});

test('newsroom PR body explains review-only fallback when publish gate is blocked', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      quality_status: 'PASS',
      quality_score: 91,
      quality_threshold: qualityGatePolicy.threshold,
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      review_gate_passed: true,
      publish_gate_passed: false,
      min_final_articles: configuredMinimum,
      absolute_min_reviewable_articles: articlePolicy.primaryCameraStack.minRequired,
      min_non_fallback_publish_ready_articles: configuredMinimum,
      editor_review_required: true,
      underfilled: false,
      composition_mode: 'NEEDS_FIX',
      selection_composition_mode: 'FALLBACK_COMPOSITION',
      direct_aosp_camera_count: 0,
      camera_driver_image_pipeline_count: 0,
      android_platform_camera_adjacent_count: 0,
      soc_platform_signal_count: 0,
      cpp_ai_tooling_fallback_count: configuredMinimum,
      generic_tech_watchlist_count: 0,
      primary_camera_stack_topic_count: 0,
      supporting_main_article_count: configuredMinimum,
      forbidden_main_article_count: 0,
      non_fallback_reviewable_article_count: 0,
      composition_reason: 'Review Gate passed, but Publish Gate requires configured Primary Camera Stack coverage.',
      deterministic_selected_count: configuredMinimum,
      rendered_main_article_count: configuredMinimum,
      reserve_candidate_count: 5,
      selected_article_count: configuredMinimum,
      final_selected_article_count: configuredMinimum,
      stale_claim_status: 'PASS',
      stale_claim_removed_count: 0,
      stale_claim_hard_failure_count: 0
    }
  });

  assert.match(body, /권장 조치: 검토용 PR로만 사용하세요\. 후보 선택 발행 조건을 만족하기 전에는 최종 발행으로 보지 않습니다\./);
  assert.match(body, /composition_mode: NEEDS_FIX/);
  assert.match(body, /selection_composition_mode: FALLBACK_COMPOSITION/);
  assert.match(body, /후보 선택 발행 조건이 막혀 있으면 최종 발행 가능 상태가 아닙니다/);
});

test('newsroom PR body keeps one Korean generation status heading', () => {
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 80,
      quality_threshold: qualityGatePolicy.threshold,
      selection_publish_ready: false,
      final_publish_ready: false,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    }
  });

  assert.equal((body.match(/^## 생성 상태$/gm) || []).length, 1);
  assert.doesNotMatch(body, /^## Generation Status$/m);
});

test('newsroom PR body strips stale editor brief gate sections', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeText(path.join(root, 'content', 'newsroom', date, 'editor-in-chief-brief.md'), [
    '# Brief',
    '',
    '## 이번 주 핵심 메시지',
    '',
    '핵심 메시지입니다.',
    '',
    '## 품질 게이트',
    '',
    '- 오래된 PASS 문구',
    '',
    '## Stale Claim Gate',
    '',
    '- old stale status',
    '',
    '## 권장 판단',
    '',
    'REQUEST_CHANGES'
  ].join('\n'));
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    status: {
      status: 'QUALITY_NEEDS_FIX',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'NEEDS_FIX',
      quality_score: 80,
      quality_threshold: qualityGatePolicy.threshold,
      selection_publish_ready: false,
      final_publish_ready: false,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    }
  });

  assert.doesNotMatch(body, /^## 이번 주 핵심 메시지$/m);
  assert.doesNotMatch(body, /핵심 메시지입니다/);
  assert.doesNotMatch(body, /^## 권장 판단$/m);
  assert.doesNotMatch(body, /^## 품질 게이트$/m);
  assert.doesNotMatch(body, /^## Stale Claim Gate$/m);
  assert.doesNotMatch(body, /오래된 PASS 문구/);
});

test('newsroom PR body omits editor-approved publication policy detail section', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure' });
  const result = validatePrBodyText(body);

  assert.equal(result.ok, true);
  assert.doesNotMatch(body, /^## 편집자 승인 발행 정책$/m);
});

test('newsroom PR body omits article structure contract detail when editor draft exists', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    quality: {
      article_results: [{
        index: 1,
        headline: 'CameraX release',
        section_contract: {
          complete: true,
          missing_keys: []
        }
      }]
    }
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), {
    date,
    title: `Camera HAL / SW Newsletter - ${date}`,
    summary: 'Summary',
    briefing: ['one', 'two', 'three'],
    sections: [{
      category: 'Android Camera',
      headline: 'CameraX release',
      article_sections: {
        verified_facts: ['CameraX release fact'],
        background_context: 'CameraX background',
        hal_driver_impact: 'HAL stream impact',
        action_items: ['Run Camera ITS'],
        team_share_points: 'Share in camera triage'
      },
      sources: [{ title: 'Source', url: 'https://example.com/source' }]
    }],
    action_items: [],
    references: []
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });

  assert.doesNotMatch(body, /^## Article Structure Contract$/m);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body primary headings are Korean', () => {
  const body = buildNewsroomPrBody({
    date: '2026-05-03',
    validateOutcome: 'success',
    status: {
      status: 'PASS',
      fact_check_status: 'PASS',
      must_fix_count: 0,
      source_gap_count: 0,
      quality_status: 'PASS',
      quality_score: 90,
      quality_threshold: qualityGatePolicy.threshold,
      selection_publish_ready: true,
      final_publish_ready: true,
      publish_gate_passed: true,
      review_gate_passed: true,
      stale_claim_status: 'PASS',
      stale_claim_hard_failure_count: 0
    }
  });

  for (const heading of ['최종 판단', '이번 PR 요약', '반드시 확인할 항목', '주요 결과', '상세 report', '생성 상태', '후보 기사 추적', '생성 산출물']) {
    assert.match(body, new RegExp(`^## ${heading}$`, 'm'));
  }
  for (const heading of ['Generation Status', 'Composition Summary', 'Editor Action Guidance', 'Generated Artifacts', '기사 구성 요약', '최종 후보 선택 상태', '편집자 조치 가이드']) {
    assert.doesNotMatch(body, new RegExp(`^## ${heading}$`, 'm'));
  }
});

test('candidate trace table does not produce broken Markdown links when title contains square brackets', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-30';
  const bracketedCandidate = {
    title: '[PATCH 1/6] dt-bindings: media: Add bindings for qcom,glymur-camss',
    url: 'https://lore.kernel.org/linux-media/20260530-qcom-glymur-camss-v1-1-abc123@kernel.org/',
    source: 'lore.kernel.org',
    published_date: '2026-05-30',
    finalSelectionEligibility: 'main',
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    reference_only: false,
    relevance_bucket: 'camera_driver_image_pipeline'
  };
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [],
    primary_selected_articles: [],
    shortlisted_candidates: [],
    reserve_candidates: [],
    excluded_candidates: [bracketedCandidate]
  });
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), {
    candidates: [bracketedCandidate]
  });

  const traceSection = renderCandidateTraceability(root, date);

  // validator regex: `[^\]\n]+` forbids `]` in link text — ensure no broken row slips through
  const brokenLinkRows = traceSection
    .split(/\r?\n/)
    .filter(line => line.trim().startsWith('|') && line.includes('](') && !/\[[^\]\n]+\]\(<[^>\n]+>\)/.test(line) && !/\[[^\]\n]+\]\([^)>\n]+\)/.test(line));
  assert.deepEqual(brokenLinkRows, [], `broken link rows found:\n${brokenLinkRows.join('\n')}`);
  assert.doesNotMatch(traceSection, /\[\[PATCH/);
});
