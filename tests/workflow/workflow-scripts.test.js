const assert = require('node:assert/strict');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsroomPrBody
} = require('../../scripts/build-newsroom-pr-body');
const {
  buildGenerationStatusOutputs,
  readStatus,
  renderGithubOutputs
} = require('../../scripts/write-generation-status-output');
const {
  articlePolicy,
  candidatePoolPreflightPolicy,
  headlinePolicy,
  publishReadyCompositionPolicy,
  qualityGatePolicy,
  selectionWindowPolicy,
  publishGateCriteriaText,
  validateNewsletterPolicyConfig
} = require('../../scripts/lib/newsletter-policy');
const {
  resolvePublishStatus
} = require('../../scripts/newsroom/common/publish-status');
const {
  extractSections,
  extractStatusSection,
  validatePrBodyFile,
  validatePrBodyText
} = require('../../scripts/validate-pr-body');
const {
  buildPublishStatusOutputs
} = require('../../scripts/write-publish-status-output');
const {
  buildReviewableArtifactOutputs,
  REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS,
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  requiredPublicFiles,
  resolveReviewableArtifacts
} = require('../../scripts/resolve-reviewable-artifacts');
const {
  buildFallbackPublicIssue,
  sectionDuplicateReason
} = require('../../scripts/newsroom/generate/fallback-public-issue');
const {
  ensurePublicNewsletterArtifacts,
  writeFallbackFailureDiagnostics
} = require('../../scripts/ensure-public-newsletter-artifacts');
const {
  main: annotatePublicationQualityMain,
  resolveTargetItems
} = require('../../scripts/annotate-publication-quality');
const {
  renderEditorPublicationPolicyMarkdown
} = require('../../scripts/newsroom/common/editor-publication-policy');
const {
  buildHtml,
  buildMarkdown,
  issueTags
} = require('../../scripts/newsroom/render/newsletter-renderer');
const {
  publicationDecisionForSections
} = require('../../scripts/newsroom/common/publication-mode');
const {
  candidate: buildCandidate,
  retrySection
} = require('../helpers/newsroom-builders');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'hal-signal-quality-report.json'), report);
  writeText(path.join(root, 'content', 'newsroom', date, 'hal-signal-quality-report.md'), `# HAL Signal Quality Report - ${date}\n`);
  return report;
}

function assertTextInOrder(text, labels) {
  let previous = -1;
  for (const label of labels) {
    const current = text.indexOf(label);
    assert.notEqual(current, -1, `${label} must exist`);
    assert.ok(current > previous, `${label} must appear after previous marker`);
    previous = current;
  }
}

function workflowStep(text, name) {
  const marker = `- name: ${name}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${name} step must exist`);
  const next = text.indexOf('\n      - name:', start + marker.length);
  return text.slice(start, next === -1 ? undefined : next);
}

function workflowRunCommands(text, scriptName) {
  const commands = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const inlineCommand = match[2].trim();
    if (!/^[|>]/.test(inlineCommand)) {
      if (inlineCommand.includes(scriptName)) commands.push(inlineCommand);
      continue;
    }

    const block = [];
    for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const nextIndent = line.match(/^(\s*)/)[1].length;
      if (line.trim() && nextIndent <= indent) break;
      block.push(line.trim());
      index = lineIndex;
    }
    const command = block.join('\n');
    if (command.includes(scriptName)) commands.push(command);
  }
  return commands;
}

function extractMarkdownSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${heading} section must exist`);
  const next = text.indexOf('\n## ', start + marker.length);
  return text.slice(start, next === -1 ? undefined : next);
}

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'newsroom-pr-body-'));
}

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
    impact_claim_level: 'soc_resource_contention',
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
    title: `Camera HAL SW Newsletter - ${date}`,
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
      background: 'Sustained ISP/NPU thermal behavior can affect preview latency, frame drops, and buffer queue pressure in camera workloads.',
      why_it_matters: 'Owners get a measurable follow-up path for stream, buffer, metadata, and Camera ITS validation.',
      camera_hal_perspective: 'Compare preview latency, stream buffer metadata, Camera ITS logs, and frame-drop metrics on a representative thermal workload.',
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
      impact_claim_level: 'soc_resource_contention',
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeJson(path.join(root, 'content', 'newsroom', date, 'stale-claim-report.json'), staleClaim);
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), shortlist);

  return { status, quality, factCheck, staleClaim, shortlist };
}

function writePublicNewsletterArtifacts(root, date, overrides = {}) {
  const issue = overrides.issue || {
    date,
    title: overrides.title || `Camera HAL SW 뉴스레터 - ${date}`,
    summary: overrides.summary || '공개 뉴스레터 요약입니다.',
    briefing: ['첫 번째 요약입니다.', '두 번째 요약입니다.', '세 번째 요약입니다.'],
    sections: [
      {
        category: 'Android Camera',
        headline: 'CameraX release note',
        what_changed: 'CameraX release note changed a camera component.',
        evidence_summary: 'Android Developers dated release note is used as source evidence.',
        background: 'CameraX is part of the Android camera application layer.',
        camera_hal_perspective: 'Camera HAL team checks stream, buffer, metadata, CTS/VTS, and Camera ITS impact before follow-up work.',
        team_summary: 'Camera team should review compatibility impact.',
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
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), overrides.markdown || buildMarkdown(issue));
  writeText(path.join(root, 'newsletters', date, 'index.html'), overrides.html || buildHtml(issue));
  writeText(path.join(root, 'index.html'), overrides.rootIndex || [
    '<!doctype html><html><body>',
    '<div id="latest-card"></div>',
    '<div id="archive-list"></div>',
    '<script>',
    "async function loadNewsletters() { await fetch('data/newsletters.json'); const latest = {}; const archive = []; }",
    'loadNewsletters();',
    '</script></body></html>'
  ].join('\n'));
  writeJson(path.join(root, 'data', 'newsletters.json'), [
    {
      date,
      title: overrides.title || `Camera HAL SW 뉴스레터 - ${date}`,
      summary: overrides.summary || '공개 뉴스레터 요약입니다.',
      html: `newsletters/${date}/index.html`,
      md: `newsletters/${date}/newsletter.md`,
      tags: ['Camera HAL']
    }
  ]);
}

function writeNewsletterIndex(root, items) {
  writeJson(path.join(root, 'data', 'newsletters.json'), items.map(item => ({
    date: item.date,
    title: item.title || `Camera HAL SW Newsletter - ${item.date}`,
    summary: item.summary || 'Public issue summary',
    html: `newsletters/${item.date}/index.html`,
    md: `newsletters/${item.date}/newsletter.md`,
    tags: ['Camera HAL']
  })));
}

function writeRootIndexContract(root) {
  writeText(path.join(root, 'index.html'), [
    '<!doctype html><html><body>',
    '<div id="latest-card"></div>',
    '<div id="archive-list"></div>',
    '<script>',
    "async function loadNewsletters() { const latest = {}; const archive = []; await fetch('data/newsletters.json'); }",
    'loadNewsletters();',
    '</script></body></html>'
  ].join('\n'));
}

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
      impact_claim_level_hint: 'android_framework_adjacent',
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
    impact_claim_level: fallback
      ? 'tooling_supporting'
      : bucket === 'camera_driver_image_pipeline'
        ? 'camera_stack_direct'
        : 'android_framework_adjacent',
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
    background: item.relevance_bucket === 'camera_driver_image_pipeline'
      ? 'Driver and image pipeline changes are reviewed as camera-stack integration signals.'
      : 'CameraX and Android camera framework changes are reviewed as compatibility and validation signals above the HAL boundary.',
    camera_hal_perspective: 'Camera HAL team checks stream, buffer, metadata, CTS/VTS, and Camera ITS impact before follow-up work.',
    team_summary: `${item.title} should be reviewed by camera owners.`,
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
    impact_claim_level: item.impact_claim_level,
    evidence_origin: item.evidence_origin,
    source_extraction: item.source_extraction || null,
    derived_editorial_hints: item.derived_editorial_hints || null,
    extraction_quality: item.extraction_quality || item.source_extraction?.extraction_quality || null,
    sources: [{ title: item.title, url: item.url }],
    ...overrides
  };
  if (!Object.prototype.hasOwnProperty.call(overrides, 'article_sections')) {
    value.article_sections = {
      verified_facts: value.confirmed_facts,
      background_context: value.background,
      hal_driver_impact: value.camera_hal_perspective,
      action_items: value.action_items,
      team_share_points: value.team_summary
    };
  }
  if (!Object.prototype.hasOwnProperty.call(overrides, 'public_article')) {
    value.public_article = {
      headline: value.headline,
      lead: `${value.headline} gives Camera HAL readers a source-backed validation signal.`,
      body_paragraphs: [
        `${value.headline} was selected from dated source evidence for Camera HAL readers.`,
        'The practical interpretation stays limited to stream, buffer, metadata, Camera ITS, latency, and frame-drop validation.'
      ],
      camera_hal_takeaway: value.camera_hal_perspective,
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
    title: `Camera HAL SW 뉴스레터 - ${date}`,
    summary: 'PR #39 regression fixture.',
    briefing: ['libcamera update.', 'CameraX update.', 'GCC 16.1 tooling item.'],
    sections: [
      regressionSection(libcamera),
      regressionSection(camerax),
      regressionSection(gcc, {
        category: 'C++ / Tooling',
        headline: 'GCC 16.1',
        camera_hal_perspective: 'GCC 16.1 is presented as a direct HAL toolchain change.'
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeHalSignalQualityReviewArtifacts(root, date, {
    qualityStatus: quality.status,
    status: 'NEEDS_FIX'
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), { message: 'section_count_drift' });
  writeJson(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), { date, candidates: [libcamera, camerax, gcc, glaze] });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [libcamera, camerax, gcc],
    reserve_candidates: [glaze],
    composition_summary: {}
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'article-capsules.json'), { selected_capsules: [libcamera, camerax, gcc], reserve_capsules: [glaze] });
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), { candidates: [libcamera, camerax, gcc, glaze] });
  return { date, editor };
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
    title: `Camera HAL SW Newsletter - ${date}`,
    summary: 'Run 25590436113 fallback regression fixture.',
    briefing: ['CameraX wording needs repair.', 'libcamera has a source gap.', 'GCC fallback is not publishable.'],
    sections: [
      regressionSection(camerax14, {
        camera_hal_perspective: 'Speculative CameraX HAL wording that must be rebuilt from the bound candidate.'
      }),
      regressionSection(libcamera),
      regressionSection(gcc, {
        category: 'C++ / Tooling',
        headline: 'GCC 16.1',
        camera_hal_perspective: 'GCC 16.1 is presented as a direct HAL toolchain change.'
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft-attempt-1.json'), editor);
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  writeHalSignalQualityReviewArtifacts(root, date, {
    qualityStatus: quality.status,
    status: 'NEEDS_FIX'
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'Targeted repair changed main article count outside completion/replacement mode.',
    details: { reason: 'section_count_drift' }
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), { date, candidates });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: candidates,
    reserve_candidates: safeCandidates,
    composition_summary: {}
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'article-capsules.json'), {
    selected_capsules: candidates,
    reserve_capsules: safeCandidates
  });
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), { candidates });
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
    title: `Camera HAL SW Newsletter - ${date}`,
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
    writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  }
  if (overrides.writeFactCheck !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  }
  if (overrides.writeQuality !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  }
  if (overrides.writeHalSignalQuality !== false) {
    writeHalSignalQualityReviewArtifacts(root, date, {
      qualityStatus: quality.status,
      status: quality.status === 'PASS' ? 'PASS' : 'NEEDS_FIX'
    });
  }
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
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
    title: `Camera HAL SW Newsletter - ${date}`,
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
    writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  }
  if (overrides.writeQuality !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), quality);
  }
  if (overrides.writeFactCheck !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), factCheck);
  }
  if (overrides.writeHalSignalQuality !== false) {
    writeHalSignalQualityReviewArtifacts(root, date, {
      qualityStatus: quality.status,
      status: quality.status === 'PASS' ? 'PASS' : 'NEEDS_FIX'
    });
  }
  if (overrides.writeRepairFailure !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), repairFailure);
  }
  if (overrides.writeGenerationStatus !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), generationStatus);
  }

  return { status, editor, quality, factCheck, repairFailure, generationStatus };
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
    writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), status);
  }
  if (overrides.writeShortlist !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), shortlist);
  }
  if (overrides.writeSelectionReport !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'selection-report.json'), selectionReport);
  }
  if (overrides.writeSelectionDiagnostics !== false) {
    writeText(path.join(root, 'content', 'newsroom', date, 'selection-diagnostics.md'), `${diagnosticsMd}\n`);
  }
  if (overrides.writeArticleCapsules !== false) {
    writeJson(path.join(root, 'content', 'newsroom', date, 'article-capsules.json'), {
      selected_capsules: selected,
      reserve_capsules: []
    });
  }
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), {
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
  const newsroom = path.join(root, 'content', 'newsroom', date);
  const collected = path.join(root, 'content', 'collected-news', date);
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

test('generation status output falls back when status JSON is missing', () => {
  const status = readStatus('__missing__/newsletter-generation-status.json');
  const outputs = buildGenerationStatusOutputs(status);

  assert.equal(outputs.status, 'UNKNOWN');
  assert.equal(outputs.must_fix_count, '0');
  assert.equal(outputs.quality_status, 'UNKNOWN');
  assert.equal(outputs.quality_score, 'n/a');
  assert.equal(outputs.quality_threshold, 'n/a');
  assert.equal(outputs.publish_ready, 'false');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.review_gate_passed, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
});

test('newsletter policy validates candidate pool preflight thresholds', () => {
  const invalid = {
    schemaVersion: 1,
    name: 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: { min: 3, max: 5 },
      primaryCameraStack: {
        minRequired: 1,
        buckets: articlePolicy.primaryCameraStack.buckets
      },
      publishReadyComposition: publishReadyCompositionPolicy,
      supportingMainBuckets: articlePolicy.supportingMainBuckets,
      forbiddenMainBuckets: articlePolicy.forbiddenMainBuckets
    },
    candidatePoolPreflight: {
      reserveMin: 2,
      publishableCandidateMin: 4,
      primaryCameraStackCandidateMin: 1,
      cameraStackCandidateMin: 5
    },
    selectionWindowPolicy,
    headlinePolicy,
    qualityGatePolicy: {
      threshold: qualityGatePolicy.threshold,
      hardFailConditions: qualityGatePolicy.hardFailConditions
    }
  };

  const result = validateNewsletterPolicyConfig(invalid);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('candidatePoolPreflight.publishableCandidateMin must be >= articlePolicy.mainArticleCount.min + candidatePoolPreflight.reserveMin.'));
  assert.ok(result.errors.includes('candidatePoolPreflight.cameraStackCandidateMin must be <= candidatePoolPreflight.publishableCandidateMin.'));
});

test('newsletter policy validates selection window contract without enforcing selection behavior', () => {
  const base = {
    schemaVersion: 1,
    name: 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: { min: 3, max: 5 },
      primaryCameraStack: {
        minRequired: 1,
        buckets: articlePolicy.primaryCameraStack.buckets
      },
      publishReadyComposition: publishReadyCompositionPolicy,
      supportingMainBuckets: articlePolicy.supportingMainBuckets,
      forbiddenMainBuckets: articlePolicy.forbiddenMainBuckets
    },
    candidatePoolPreflight: {
      reserveMin: 2,
      publishableCandidateMin: 5,
      primaryCameraStackCandidateMin: 1,
      cameraStackCandidateMin: 2
    },
    selectionWindowPolicy: {
      primarySelectionDays: 7,
      fallbackSelectionDays: 21,
      referenceContextDays: 90
    },
    headlinePolicy,
    qualityGatePolicy: {
      threshold: qualityGatePolicy.threshold,
      hardFailConditions: qualityGatePolicy.hardFailConditions
    }
  };
  const withWindow = selectionWindow => ({
    ...base,
    selectionWindowPolicy: selectionWindow
  });

  assert.equal(validateNewsletterPolicyConfig(base).ok, true);
  assert.equal(validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 7,
    referenceContextDays: 90
  })).ok, true);
  assert.equal(validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 21,
    referenceContextDays: 21
  })).ok, true);
  assert.equal(validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 7,
    referenceContextDays: 7
  })).ok, true);

  const invalid = validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 22,
    fallbackSelectionDays: 21,
    referenceContextDays: 90
  }));
  const invalidReference = validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 7,
    fallbackSelectionDays: 91,
    referenceContextDays: 90
  }));
  const invalidValues = validateNewsletterPolicyConfig(withWindow({
    primarySelectionDays: 0,
    fallbackSelectionDays: 1.5,
    referenceContextDays: '90'
  }));

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes('selectionWindowPolicy.fallbackSelectionDays must be >= selectionWindowPolicy.primarySelectionDays.'));
  assert.equal(invalidReference.ok, false);
  assert.ok(invalidReference.errors.includes('selectionWindowPolicy.referenceContextDays must be >= selectionWindowPolicy.fallbackSelectionDays.'));
  assert.equal(invalidValues.ok, false);
  assert.ok(invalidValues.errors.includes('selectionWindowPolicy.primarySelectionDays must be an integer >= 1.'));
  assert.ok(invalidValues.errors.includes('selectionWindowPolicy.fallbackSelectionDays must be an integer >= 1.'));
  assert.ok(invalidValues.errors.includes('selectionWindowPolicy.referenceContextDays must be an integer >= 1.'));
});

test('newsletter policy validates publish-ready composition contract separately from review gate', () => {
  const base = {
    schemaVersion: 1,
    name: 'Newsletter Policy',
    articlePolicy: {
      mainArticleCount: { min: 3, max: 5 },
      primaryCameraStack: {
        minRequired: 1,
        buckets: articlePolicy.primaryCameraStack.buckets
      },
      publishReadyComposition: {
        primaryCameraStackMinRequired: 2,
        directAospCameraOrDriverMinRequired: 1,
        supportingMainMaxAllowed: 1
      },
      supportingMainBuckets: articlePolicy.supportingMainBuckets,
      forbiddenMainBuckets: articlePolicy.forbiddenMainBuckets
    },
    candidatePoolPreflight: {
      reserveMin: 2,
      publishableCandidateMin: 5,
      primaryCameraStackCandidateMin: 1,
      cameraStackCandidateMin: 2
    },
    selectionWindowPolicy,
    headlinePolicy,
    qualityGatePolicy: {
      threshold: qualityGatePolicy.threshold,
      hardFailConditions: qualityGatePolicy.hardFailConditions
    }
  };
  const withPublishReady = publishReadyComposition => ({
    ...base,
    articlePolicy: {
      ...base.articlePolicy,
      publishReadyComposition
    }
  });

  assert.equal(validateNewsletterPolicyConfig(base).ok, true);

  const invalidValues = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 1.5,
    directAospCameraOrDriverMinRequired: '1',
    supportingMainMaxAllowed: -1
  }));
  const invalidPrimaryMax = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 6,
    directAospCameraOrDriverMinRequired: 1,
    supportingMainMaxAllowed: 1
  }));
  const invalidDirect = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 2,
    directAospCameraOrDriverMinRequired: 3,
    supportingMainMaxAllowed: 1
  }));
  const invalidSupporting = validateNewsletterPolicyConfig(withPublishReady({
    primaryCameraStackMinRequired: 2,
    directAospCameraOrDriverMinRequired: 1,
    supportingMainMaxAllowed: 6
  }));

  assert.equal(invalidValues.ok, false);
  assert.ok(invalidValues.errors.includes('articlePolicy.publishReadyComposition.primaryCameraStackMinRequired must be an integer >= 0.'));
  assert.ok(invalidValues.errors.includes('articlePolicy.publishReadyComposition.directAospCameraOrDriverMinRequired must be an integer >= 0.'));
  assert.ok(invalidValues.errors.includes('articlePolicy.publishReadyComposition.supportingMainMaxAllowed must be an integer >= 0.'));
  assert.equal(invalidPrimaryMax.ok, false);
  assert.ok(invalidPrimaryMax.errors.includes('articlePolicy.publishReadyComposition.primaryCameraStackMinRequired cannot exceed articlePolicy.mainArticleCount.max.'));
  assert.equal(invalidDirect.ok, false);
  assert.ok(invalidDirect.errors.includes('articlePolicy.publishReadyComposition.directAospCameraOrDriverMinRequired cannot exceed articlePolicy.publishReadyComposition.primaryCameraStackMinRequired.'));
  assert.equal(invalidSupporting.ok, false);
  assert.ok(invalidSupporting.errors.includes('articlePolicy.publishReadyComposition.supportingMainMaxAllowed cannot exceed articlePolicy.mainArticleCount.max.'));
});

test('generation status output includes multiline selection diagnostics', () => {
  const configuredMinimum = articlePolicy.mainArticleCount.min;
  const requiredPrimary = articlePolicy.primaryCameraStack.minRequired;
  const outputs = buildGenerationStatusOutputs({
    status: 'QUALITY_NEEDS_FIX',
    must_fix_count: 0,
    quality_status: 'NEEDS_FIX',
    quality_score: 90,
    quality_threshold: qualityGatePolicy.threshold,
    publish_ready: false,
    final_publish_ready: false,
    review_gate_passed: true,
    publish_gate_passed: false,
    min_final_articles: configuredMinimum,
    absolute_min_reviewable_articles: requiredPrimary,
    min_non_fallback_publish_ready_articles: configuredMinimum,
    composition_mode: 'NEEDS_FIX',
    editor_review_required: true,
    underfilled: true,
    deterministic_selected_count: 5,
    rendered_main_article_count: configuredMinimum,
    reserve_candidate_count: 4,
    stale_claim_status: 'PASS',
    stale_claim_removed_count: 2,
    stale_claim_hard_failure_count: 0,
    selected_article_count: configuredMinimum,
    final_selected_article_count: configuredMinimum,
    primary_camera_stack_topic_count: 0,
    supporting_main_article_count: configuredMinimum,
    forbidden_main_article_count: 0,
    non_fallback_reviewable_article_count: 1,
    eligible_non_fallback_reviewable_article_count: 1,
    selection_warnings: ['Newsletter Policy review path'],
    selection_shortage_hints: ['Add at least one Primary Camera Stack candidate before publishing.'],
    final_exclusion_reason_summary: [
      { reason: 'missing dated evidence', count: 4 },
      { reason: 'source_gap_risk=true', count: 2 }
    ]
  });
  const rendered = renderGithubOutputs(outputs);

  assert.equal(outputs.final_selected_article_count_for_gate, String(configuredMinimum));
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
  assert.equal(outputs.editor_review_required, 'true');
  assert.equal(outputs.deterministic_selected_count, '5');
  assert.equal(outputs.rendered_main_article_count, String(configuredMinimum));
  assert.equal(outputs.reserve_candidate_count, '4');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_removed_count, '2');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
  assert.equal(outputs.non_fallback_reviewable_article_count, '1');
  assert.equal(outputs.eligible_non_fallback_reviewable_article_count, '1');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.min_final_articles, String(configuredMinimum));
  assert.equal(outputs.absolute_min_reviewable_articles, String(requiredPrimary));
  assert.equal(outputs.min_non_fallback_publish_ready_articles, String(configuredMinimum));
  assert.equal(outputs.primary_camera_stack_topic_count, '0');
  assert.equal(outputs.supporting_main_article_count, String(configuredMinimum));
  assert.equal(outputs.forbidden_main_article_count, '0');
  assert.match(rendered, /candidate_selection_diagnostics<<EOF/);
  assert.match(rendered, /missing dated evidence \(4\)/);
  assert.match(rendered, /selection_warnings=Newsletter Policy review path/);
  assert.match(rendered, /selection_shortage_hints=Add at least one Primary Camera Stack candidate before publishing\./);
});

test('FAILED_REPAIR_REVIEWABLE status is reviewable but never publish-ready', () => {
  const outputs = buildGenerationStatusOutputs({
    status: 'FAILED_REPAIR_REVIEWABLE',
    quality_status: 'NEEDS_FIX',
    quality_score: 79,
    quality_threshold: qualityGatePolicy.threshold,
    publish_ready: true,
    selection_publish_ready: true,
    final_publish_ready: true,
    review_gate_passed: true,
    publish_gate_passed: true,
    composition_mode: 'NORMAL',
    editor_review_required: false,
    rendered_main_article_count: articlePolicy.mainArticleCount.min,
    selected_article_count: articlePolicy.mainArticleCount.min,
    final_selected_article_count: articlePolicy.mainArticleCount.min,
    primary_camera_stack_topic_count: articlePolicy.primaryCameraStack.minRequired,
    supporting_main_article_count: articlePolicy.mainArticleCount.min - articlePolicy.primaryCameraStack.minRequired,
    forbidden_main_article_count: 0
  });

  assert.equal(outputs.status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(outputs.publish_ready, 'false');
  assert.equal(outputs.selection_publish_ready, 'false');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.editor_review_required, 'true');
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
});

test('newsroom PR body treats FAILED_REPAIR_REVIEWABLE as needs-fix review flow', () => {
  const root = tempRoot();
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
  const root = tempRoot();
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
  assert.equal(validatePrBodyFile(bodyPath, { root, date, validateOutcome: 'failure' }).ok, true);

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

test('candidate shortage generator exits before LLM calls when credentials are empty', () => {
  const root = tempRoot();
  const date = '2026-05-11';
  const rawDir = path.join(root, '.tmp', 'gemini-raw');
  writeJson(path.join(root, 'data', 'news-sources.json'), {
    schemaVersion: 2,
    sources: []
  });
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), {
    date,
    candidates: []
  });

  const result = spawnSync(process.execPath, [
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js')
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NEWSLETTER_DATE: date,
      GEMINI_API_KEY: '',
      INTERNAL_LLM_API_KEY: '',
      INTERNAL_LLM_ENDPOINT: '',
      LLM_RAW_OUTPUT_DIR: rawDir
    }
  });
  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const generationStatus = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'generation-status.json'), 'utf8'));
  const rawFiles = fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : [];

  assert.equal(result.status, 0, combinedOutput);
  assert.doesNotMatch(combinedOutput, /API key|missing credential|LLM provider|provider configuration/i);
  assert.equal(rawFiles.length, 0);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'editor-draft.json')), false);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'quality-report.json')), false);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'fact-check-report.json')), false);
  assert.equal(generationStatus.status, 'UNDERFILLED_NEEDS_FIX');
  assert.equal(generationStatus.failure_kind, 'candidate_shortage_reviewable');
});

test('Workflow 03 enters LLM generation with one publishable candidate and zero reserve candidates', async () => {
  const root = tempRoot();
  const date = '2026-05-11';
  const rawDir = path.join(root, '.tmp', 'gemini-raw');
  const selectedCandidate = onePublishableSupportingCandidate(date);
  const editorDraft = onePublishableSupportingEditorDraft(date, selectedCandidate);
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    recommended_fixes: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: 'Mock fact-check passed for one publishable supporting main article.'
  };
  const llmRequests = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const required = payload.response_schema?.required || [];
        llmRequests.push({
          model: payload.model,
          required
        });
        let json;
        if (required.includes('candidates')) {
          json = { date, candidates: [selectedCandidate] };
        } else if (required.includes('title') && required.includes('sections')) {
          json = editorDraft;
        } else if (required.includes('status') && required.includes('must_fix')) {
          json = factCheck;
        } else if (required.length === 1 && required[0] === 'sections') {
          json = { sections: editorDraft.sections };
        } else {
          response.writeHead(500, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: `Unexpected schema: ${required.join(',')}` }));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          json,
          usage: {
            prompt_tokens: 10,
            completion_tokens: 10,
            total_tokens: 20
          }
        }));
      } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error.message }));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/llm`;

  writeJson(path.join(root, 'package.json'), {
    private: true,
    scripts: {
      'validate:site': 'node -e "process.exit(0)"',
      'validate:images': 'node -e "process.exit(0)"'
    }
  });
  writeJson(path.join(root, 'data', 'news-sources.json'), {
    schemaVersion: 2,
    sources: []
  });
  writeJson(path.join(root, 'data', 'newsletters.json'), [{
    date,
    title: editorDraft.title,
    summary: editorDraft.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['SoC Platform Signal']
  }]);
  writeText(path.join(root, 'assets', 'images', 'fallback', 'android.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#3ddc84"/></svg>\n');
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), {
    date,
    candidates: [selectedCandidate]
  });

  let result;
  try {
    result = await runNodeAsync([
      path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js')
    ], {
      cwd: root,
      env: {
        ...process.env,
        NEWSLETTER_DATE: date,
        LLM_PROVIDER: 'internal',
        LLM_MODEL: 'mock-internal',
        LLM_FALLBACK_MODELS: '',
        INTERNAL_LLM_API_KEY: 'test-key',
        INTERNAL_LLM_ENDPOINT: endpoint,
        NEWSROOM_BACKGROUND_CONTEXT_STAGE: 'static',
        NEWSROOM_MAX_QUALITY_RETRIES: '0',
        GEMINI_MAX_RETRIES: '0',
        LLM_RAW_OUTPUT_DIR: rawDir
      }
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  const combinedOutput = `${result.stdout || ''}\n${result.stderr || ''}`;
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const generationStatus = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'generation-status.json'), 'utf8'));
  const qualityReport = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'quality-report.json'), 'utf8'));

  assert.equal(result.status, 0, combinedOutput);
  assert.equal(llmRequests.some(item => item.required.includes('candidates')), true);
  assert.equal(llmRequests.some(item => item.required.includes('title') && item.required.includes('sections')), true);
  assert.equal(llmRequests.some(item => item.required.includes('status') && item.required.includes('must_fix')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'reporter-candidates.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'editor-draft.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'fact-check-report.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'quality-report.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'data', 'newsletters.json')), true);
  assert.equal(generationStatus.status, 'PASS');
  assert.equal(generationStatus.publish_ready, true);
  assert.equal(generationStatus.final_publish_ready, true);
  assert.equal(generationStatus.publish_gate_passed, true);
  assert.equal(generationStatus.editor_review_required, false);
  assert.equal(generationStatus.candidate_shortage_reviewable, false);
  assert.equal(generationStatus.candidate_pool_preflight_passed, true);
  assert.equal(generationStatus.reserve_candidate_count, 0);
  assert.equal(generationStatus.candidate_shortage_summary.required_reserve_candidate_count, 0);
  assert.deepEqual(generationStatus.shortage_reason_codes, []);
  assert.equal(generationStatus.composition_mode, 'FALLBACK_COMPOSITION');
  assert.equal(qualityReport.status, 'PASS');
  assert.equal(qualityReport.metrics.article_count, 1);
});

test('newsroom PR body marks editorial reviewable handoff as editor-approved public publication', () => {
  const root = tempRoot();
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

test('validate-pr-body handles non-string input without throwing', () => {
  for (const input of [null, undefined, 42]) {
    const result = validatePrBodyText(input);
    assert.equal(result.ok, false, String(input));
    assert.match(result.errors.join('\n'), /must contain exactly one/);
    assert.match(result.errors.join('\n'), /missing/);
  }

  assert.equal(extractSections(null).size, 0);
  assert.equal(extractSections(undefined).size, 0);
  assert.equal(extractSections(42).size, 0);
  assert.equal(extractStatusSection(null), '');
  assert.equal(extractStatusSection(42), '');
});

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
    fallback_builder_failures: [],
    candidate_shortage_hints: [],
    source_gap_warnings: [],
    missing_artifacts: [],
    invalid_artifacts: [],
    ...failureDiagnosticsOverrides
  };
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

test('newsroom PR body renders editor article decision summary with pipeline state', () => {
  const root = tempRoot();
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
  const root = tempRoot();
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
  const root = tempRoot();
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
  const root = tempRoot();
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
  assert.match(verdict, /생략된 후보: 2개, 전체 후보는 `후보 기사 추적`과 `Evidence Pack 요약`을 확인하세요\./);
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
    const root = tempRoot();
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
  const reviewRoot = tempRoot();
  const reviewDate = '2026-05-10';
  writeMinimalEvidencePackSummary(reviewRoot, reviewDate);
  const reviewBody = buildNewsroomPrBody({
    root: reviewRoot,
    date: reviewDate,
    validateOutcome: 'failure',
    status: traceStatus({ review_publication_ready: true, final_publish_ready: false })
  });

  assertTextInOrder(reviewBody, [
    '## 발행 상태 요약',
    '## 편집자 기사 판단 요약',
    '## 생성 상태'
  ]);

  const publishRoot = tempRoot();
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
    '## 편집자 기사 판단 요약',
    '## 발행 상태 요약',
    '## 생성 상태'
  ]);
});

test('diagnostics-only PR body keeps status first and shows insufficient evidence notice', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
  });

  assert.ok(body.indexOf('## Diagnostics-only Status') < body.indexOf('## 편집자 기사 판단 요약'));
  assert.ok(body.indexOf('## 편집자 기사 판단 요약') < body.indexOf('## 생성 상태'));
  assert.match(body, /편집자 기사 판단 요약을 생성할 충분한 evidence가 없습니다\./);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('validate-pr-body treats editorial decision summary as optional but complete when present', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const withoutSummary = body.replace(/^## 편집자 기사 판단 요약[\s\S]*?(?=^## 생성 상태$)/m, '');
  const missingVerdict = body.replace(/^## 편집자 결론[\s\S]*?(?=^## 판단 라벨 의미$)/m, '');
  const missingLegend = body.replace(/^## 판단 라벨 의미[\s\S]*?(?=^## 생성 상태$)/m, '');
  const badLabel = body.replace('메인(Main)', '최고기사(Best)');
  const missingPipelineColumn = body.replace(' | Pipeline 상태 |', ' | ');

  assert.equal(validatePrBodyText(withoutSummary, { date }).ok, true);

  const missingVerdictResult = validatePrBodyText(missingVerdict, { date });
  assert.equal(missingVerdictResult.ok, false);
  assert.match(missingVerdictResult.errors.join('\n'), /편집자 결론/);

  const missingLegendResult = validatePrBodyText(missingLegend, { date });
  assert.equal(missingLegendResult.ok, false);
  assert.match(missingLegendResult.errors.join('\n'), /판단 라벨 의미/);

  const badLabelResult = validatePrBodyText(badLabel, { date });
  assert.equal(badLabelResult.ok, false);
  assert.match(badLabelResult.errors.join('\n'), /unknown decision label/);

  const missingPipelineResult = validatePrBodyText(missingPipelineColumn, { date });
  assert.equal(missingPipelineResult.ok, false);
  assert.match(missingPipelineResult.errors.join('\n'), /Pipeline 상태/);
});

test('newsroom PR body renders Evidence Pack summary sections', () => {
  const root = tempRoot();
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
      fallback_builder_failures: [],
      candidate_shortage_hints: ['primary camera stack shortage'],
      source_gap_warnings: ['source gap on selected-1'],
      missing_artifacts: ['content/newsroom/2026-05-10/fact-check-report.json'],
      invalid_artifacts: [{ path: 'content/newsroom/2026-05-10/quality-report.json', error: 'Unexpected token' }]
    },
    warnings: []
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.match(body, /^## Evidence Pack 요약$/m);
  assert.match(body, /^## Claim \/ HAL Impact 요약$/m);
  assert.match(body, /^## 선택된 Main Article 근거$/m);
  assert.match(body, /^## 제외 후보 근거$/m);
  assert.match(body, /^## Needs-fix \/ Review-only 진단$/m);
  assert.match(body, /^## 사람 검토 체크리스트$/m);
  assert.match(body, /Raw candidates: 14/);
  assert.match(body, /Fallback window consulted: true/);
  assert.match(body, /Fallback window reason: primary window selected 1 article\(s\), below min 3/);
  assert.match(body, /Fallback promoted candidates: 2/);
  assert.match(body, /Fallback bucket used: true/);
  assert.match(body, /Claim validation status: partial/);
  assert.match(body, /Claim coverage: bound_claims=2; total_claims=3/);
  assert.match(body, /Overclaim risk: medium/);
  assert.match(body, /HAL impact axes: camera_pipeline; metadata/);
  assert.match(body, /status=available; bound=2; total=3/);
  assert.match(body, /CameraX 1\.6\.0 alpha release/);
  assert.match(body, /official_release_note/);
  assert.match(body, /primary/);
  assert.match(body, /article_url/);
  assert.match(body, /android_platform_camera_adjacent/);
  assert.match(body, /current/);
  assert.match(body, /Generic AI camera update/);
  assert.match(body, /generic topic without HAL impact axis/);
  assert.match(body, /More excluded candidates are available in `content\/newsroom\/2026-05-10\/evidence-pack-summary\.json`/);
  assert.match(body, /Quality hard failures: source-integrity/);
  assert.match(body, /Fact-check must-fix: needs source binding/);
  assert.match(body, /Invalid artifacts: Unexpected token/);
  assert.match(body, /^## 후보 기사 추적$/m);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body renders Evidence Pack fallback diagnostics defaults', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.match(body, /Fallback window consulted: unknown/);
  assert.match(body, /Fallback window reason: none/);
  assert.match(body, /Fallback promoted candidates: unknown/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body renders Seed Evidence usage summary when seed artifacts exist', () => {
  const root = tempRoot();
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

  assert.match(body, /^## Seed Evidence Usage Summary$/m);
  assert.match(body, /seed-evidence-pack: `content\/collected-news\/2026-05-10\/seed-evidence-pack\.json`/);
  assert.match(body, /seed-camerax-pack/);
  assert.match(body, /seed-camerax-primary-01/);
  assert.match(body, /Stage 3 seed re-crawl: prohibited/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body renders HAL signal quality summary when report exists', () => {
  const root = tempRoot();
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

  assert.match(body, /^## HAL Signal Quality Summary$/m);
  assert.match(body, /status: NEEDS_FIX/);
  assert.match(body, /input_completeness: partial/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /publish_gate_reason_codes: quality_status_needs_fix/);
  assert.match(body, /article_count_with_hal_signal_capsule: 1/);
  assert.match(body, /HAL signal hard blocker count: 1/);
  assert.match(body, /fallback_promotion_not_allowed/);
  assert.match(body, /source_quality_report/);
  assert.match(body, /CameraX release gives HAL teams a validation target/);
  assert.match(body, /generic_review/);
  assert.match(body, /concrete_check/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body truncates long HAL hard blocker affected article lists', () => {
  const root = tempRoot();
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

  assert.match(body, /Affected main articles: Blocked HAL article 1; Blocked HAL article 2; Blocked HAL article 3; Blocked HAL article 4; Blocked HAL article 5; \.\.\. \+1 more/);
  assert.doesNotMatch(body, /Affected main articles: .*Blocked HAL article 6/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('newsroom PR body keeps Evidence Pack fallback when summary artifact is missing', () => {
  const root = tempRoot();
  const date = '2026-05-10';

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });

  assert.match(body, /^## Evidence Pack 요약$/m);
  assert.match(body, /Evidence Pack summary: unavailable/);
  assert.match(body, new RegExp(`content/newsroom/${date}/evidence-pack-summary\\.json not found`));
  assert.equal(validatePrBodyText(body, { date }).ok, true);
});

test('validate-pr-body checks Evidence Pack fallback diagnostic rows', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const brokenBody = body.replace('- Fallback promoted candidates: unknown\n', '');
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack summary is missing "Fallback promoted candidates" row/);
});

test('validate-pr-body checks Evidence Pack table columns when section is present', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const brokenBody = body.replace(
    '| # | Title | Source | URL | Source tier | Source role | URL quality | Bucket | Freshness | Reason |',
    '| # | Title | Source | Source tier | Source role | URL quality | Bucket | Freshness | Reason |'
  );
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack selected article table is missing required columns: URL/);
});

test('validate-pr-body checks Evidence Pack claim and HAL impact summary columns', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const brokenBody = body.replace(
    '| Article | HAL axes | Claim validation | Overclaim risk |',
    '| Article | HAL axes | Claim validation |'
  );
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack claim\/HAL table is missing required columns: Overclaim risk/);
});

test('validate-pr-body checks Evidence Pack diagnostics for needs-fix bodies', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date, {
    failure_diagnostics: {
      quality_hard_failures: ['source-integrity'],
      fact_check_must_fix: ['needs source binding'],
      repair_failures: [],
      fallback_builder_failures: [],
      candidate_shortage_hints: [],
      source_gap_warnings: [],
      missing_artifacts: [],
      invalid_artifacts: []
    }
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const brokenBody = body
    .replace('- Quality hard failures: source-integrity', '- Quality hard failures: none')
    .replace('- Fact-check must-fix: needs source binding', '- Fact-check must-fix: none');
  const result = validatePrBodyText(brokenBody, { date });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Evidence Pack diagnostics must include at least one actionable diagnostic/);
});

test('validate-pr-body keeps compatibility when Evidence Pack section is absent', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalEvidencePackSummary(root, date);

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const legacyBody = body.replace(/^## Evidence Pack 요약[\s\S]*?(?=^## 후보 기사 추적$)/m, '');

  assert.doesNotMatch(legacyBody, /^## Evidence Pack 요약$/m);
  assert.equal(validatePrBodyText(legacyBody, { date }).ok, true);
});

test('newsroom PR body renders Korean candidate traceability report', () => {
  const root = tempRoot();
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
  writeJson(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), {
    demoted_articles: [
      {
        headline: 'GCC 16.1',
        reason: 'HAL 연결 근거가 약해 demote합니다.',
        sources: [{ title: 'ISO C++ Blog', url: 'https://isocpp.org/blog/2026/05/gcc-16.1' }]
      }
    ],
    rejected_candidates: [
      {
        title: 'Generic AI camera post',
        url: 'https://example.com/generic-ai-camera',
        source: 'Tech Blog',
        relevance_bucket: 'generic_tech_watchlist',
        reason: 'generic AI noise'
      }
    ],
    merged_articles: [
      {
        headline: 'CameraX alpha release',
        source_urls: ['https://developer.android.com/jetpack/androidx/releases/camera#alpha'],
        reason: 'same source cluster'
      }
    ]
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
  assert.match(body, /GCC 16\.1/);
  assert.match(body, /demoted/);
  assert.match(body, /Generic AI camera post/);
  assert.match(body, /rejected/);
  assert.match(body, /CameraX alpha release/);
  assert.match(body, /merged/);
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

test('newsroom PR body candidate traceability applies fallback status overrides safely', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  const longUrl = 'https://example.com/releases/camera-hal-driver-update-(very-long-segment)-with-query?param=alpha|beta gamma<delta>&tail=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const sanitizedLongUrl = 'https://example.com/releases/camera-hal-driver-update-(very-long-segment)-with-query?param=alpha%7Cbeta%20gamma%3Cdelta%3E&tail=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const finalCandidate = traceCandidate({
    title: 'Final camera HAL release',
    url: longUrl,
    article_url: longUrl,
    final_selected: true,
    primary_selected: true,
    selected_for_editor: true
  });
  const primaryDemoted = traceCandidate({
    title: 'Primary HAL weak evidence',
    url: 'https://example.com/primary-hal-weak-evidence',
    article_url: 'https://example.com/primary-hal-weak-evidence',
    source_name: 'HAL Review',
    primary_selected: true,
    selected_for_editor: true,
    selection_exclusion_reason: 'reporter initially selected this candidate'
  });
  const reserveRejected = traceCandidate({
    title: 'Reserve HAL follow-up',
    url: 'https://example.com/reserve-hal-follow-up',
    article_url: 'https://example.com/reserve-hal-follow-up',
    source_name: 'Reserve Review',
    reserve_candidate: true,
    selection_exclusion_reason: 'reserve candidate before fallback review'
  });
  const excludedMerged = traceCandidate({
    title: 'Excluded duplicate CameraX note',
    url: 'https://example.com/excluded-duplicate-camerax',
    article_url: 'https://example.com/excluded-duplicate-camerax',
    source_name: 'CameraX Notes',
    main_eligible: false,
    finalSelectionEligibility: 'exclude',
    final_exclusion_reasons: ['duplicate source before fallback']
  });

  writeJson(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), {
    date,
    candidates: [finalCandidate, primaryDemoted, reserveRejected, excludedMerged]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [finalCandidate],
    primary_selected_articles: [primaryDemoted],
    reserve_candidates: [reserveRejected],
    excluded_candidates: [excludedMerged]
  });
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), {
    candidates: [finalCandidate, primaryDemoted, reserveRejected, excludedMerged]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), {
    demoted_articles: [
      {
        headline: primaryDemoted.title,
        reason: 'fallback demoted after source gap review',
        sources: [{ title: primaryDemoted.source_name, url: primaryDemoted.url }]
      }
    ],
    rejected_candidates: [
      {
        title: finalCandidate.title,
        url: finalCandidate.url,
        source: finalCandidate.source_name,
        reason: 'fallback attempted final override'
      },
      {
        title: reserveRejected.title,
        url: reserveRejected.url,
        source: reserveRejected.source_name,
        reason: 'fallback rejected duplicate_url after repair'
      }
    ],
    merged_articles: [
      {
        headline: excludedMerged.title,
        source_urls: [excludedMerged.url],
        reason: 'same source cluster merged into final article'
      }
    ]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
    status: 'NEEDS_FIX',
    deductions: [],
    article_results: [
      {
        index: 1,
        headline: primaryDemoted.title,
        status: 'FAIL',
        sources: [{ url: primaryDemoted.url }],
        hard_fail_reasons: ['source-integrity']
      }
    ]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0
  });

  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure', status: traceStatus() });
  const finalSection = body.slice(body.indexOf('### 최종 선택 기사'), body.indexOf('### Reserve 후보'));
  const reserveSection = body.slice(body.indexOf('### Reserve 후보'), body.indexOf('### 제외/강등/거절된 주요 후보'));
  const notableSection = body.slice(body.indexOf('### 제외/강등/거절된 주요 후보'), body.indexOf('### 품질/팩트체크 연결'));

  assert.ok(body.includes(`[Final camera HAL release](<${sanitizedLongUrl}>)`));
  assert.match(finalSection, /Final camera HAL release/);
  assert.match(finalSection, /final_selected/);
  assert.doesNotMatch(finalSection, /\|\s*\d+\s*\|\s*`cand_\d{3}`\s*\|\s*rejected\s*\|/);
  assert.doesNotMatch(reserveSection, /Reserve HAL follow-up/);
  assert.match(notableSection, /\| # \| Candidate ID \| 상태 \| 원문 기사 \| 출처\/날짜 \| Bucket \| 점수 \| 사유 코드 \| 설명 \|/);
  assert.match(notableSection, /Primary HAL weak evidence/);
  assert.match(notableSection, /\|\s*\d+\s*\|\s*`cand_\d{3}`\s*\|\s*demoted\s*\|[^\n]*Primary HAL weak evidence/);
  assert.match(notableSection, /fallback demoted after source gap review/);
  assert.match(notableSection, /source_gap/);
  assert.match(notableSection, /Reserve HAL follow-up/);
  assert.match(notableSection, /\|\s*\d+\s*\|\s*`cand_\d{3}`\s*\|\s*rejected\s*\|[^\n]*Reserve HAL follow-up/);
  assert.match(notableSection, /fallback rejected duplicate_url after repair/);
  assert.match(notableSection, /duplicate_source/);
  assert.match(notableSection, /Excluded duplicate CameraX note/);
  assert.match(notableSection, /\|\s*\d+\s*\|\s*`cand_\d{3}`\s*\|\s*merged\s*\|[^\n]*Excluded duplicate CameraX note/);
  assert.match(notableSection, /merged_into_selected_article/);
  assert.doesNotMatch(notableSection, /\|\s*\d+\s*\|\s*`cand_\d{3}`\s*\|\s*quality_fail\s*\|[^\n]*Primary HAL weak evidence/);
  assert.equal(validatePrBodyText(body, { date }).ok, true);

  const bodyWithBrokenLinkOutsideTrace = `${body}\n## 추가 메모\n\n| 설명 |\n| --- |\n| [깨진 링크](https://example.com |\n`;
  assert.equal(validatePrBodyText(bodyWithBrokenLinkOutsideTrace, { date }).ok, true);
});

test('newsroom PR body candidate traceability tolerates missing and malformed artifacts', () => {
  const root = tempRoot();
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

test('reviewable artifact resolver does not accept tmp status alone', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    final_publish_ready: false
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  const resolved = resolveReviewableArtifacts({ root });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(resolved.date, date);
  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical=none/);
});

test('reviewable artifact resolver requires changed artifacts even when canonical artifacts exist', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'NEEDS_FIX',
    final_publish_ready: false
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), {
    date,
    sections: []
  });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical=editor-draft\.json/);
  assert.match(outputs.reviewable_artifact_reason, /changed=none/);
});

test('reviewable artifact resolver rejects stale base artifacts without repo-visible changes', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.reviewable_artifact_reason, /changed=none/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=none/);
});

test('reviewable artifact resolver accepts editorial reviewable handoff without public artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'false');
  assert.equal(outputs.publish_candidate_ready, 'false');
  assert.equal(outputs.changed_artifact_count, String(REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.length));
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=editorial_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /editorial_reject=none/);
});

test('reviewable artifact resolver requires HAL signal report for editorial handoff', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, { writeHalSignalQuality: false });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.match(outputs.reviewable_artifact_reason, /missing_editorial_required=.*hal-signal-quality-report\.json/);
  assert.match(outputs.reviewable_artifact_reason, /missing_editorial_required=.*hal-signal-quality-report\.md/);
});

test('reviewable artifact resolver accepts editorial reviewable public and data writes when structurally ready', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
      .concat([
        `newsletters/${date}/newsletter.md`,
        `newsletters/${date}/index.html`,
        'data/newsletters.json'
      ])
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'true');
  assert.equal(outputs.has_required_public_newsletter_files, 'true');
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.has_publish_candidate, 'true');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'false');
  assert.equal(outputs.diagnostics_only, 'false');
  assert.equal(outputs.review_publication_ready, 'true');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
  assert.equal(outputs.publish_candidate_ready, 'true');
  assert.match(outputs.reviewable_artifact_reason, /public_newsletter_ready=true/);
  assert.doesNotMatch(outputs.public_newsletter_reason, /quality|final_publish_ready|repair|shortage/);
});

test('reviewable artifact resolver accepts string booleans for review publication readiness', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, {
    status: {
      final_publish_ready: 'false',
      review_gate_passed: 'true',
      editor_review_required: 'true'
    }
  });
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
      .concat([
        `newsletters/${date}/newsletter.md`,
        `newsletters/${date}/index.html`,
        'data/newsletters.json'
      ])
  }));

  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.review_publication_ready, 'true');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
});

test('reviewable artifact resolver rejects editorial reviewable invalid canonical artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-09';
  writeEditorialReviewableArtifacts(root, date, {
    generationStatus: {
      failure_kind: 'wrong_kind'
    }
  });

  let outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_failure_kind=wrong_kind/);

  writeText(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), '{ invalid json');
  outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /canonical_generation_status=invalid/);
  assert.match(outputs.reviewable_artifact_reason, /invalid_editorial_required=/);

  const missingRoot = tempRoot();
  writeEditorialReviewableArtifacts(missingRoot, date, { writeQuality: false });
  outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root: missingRoot,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /missing_editorial_required=quality-report\.json/);
});

test('reviewable artifact resolver accepts candidate shortage reviewable handoff without LLM artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-11';
  writeCandidateShortageReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'false');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'false');
  assert.equal(outputs.publish_candidate_ready, 'false');
  assert.equal(outputs.changed_artifact_count, String(REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS.length));
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=candidate_shortage_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /candidate_shortage_reject=none/);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'quality-report.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json')), false);
});

test('ensure CLI keeps zero-candidate shortage diagnostics-only without editor draft', () => {
  const root = tempRoot();
  const date = '2026-05-11';
  writeRootIndexContract(root);
  writeCandidateShortageReviewableArtifacts(root, date);

  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json')), false);

  assert.throws(
    () => ensurePublicNewsletterArtifacts({ root, date }),
    /Fallback builder could not fill minimum main article count 1; only 0 article\(s\) available\./
  );
  const status = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  const diagnostics = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue-diagnostics.json'), 'utf8'));

  assert.equal(status.failure_kind, 'candidate_shortage_reviewable');
  assert.equal(diagnostics.status, 'FAILED');
  assert.match(diagnostics.failure_reason, /only 0 article\(s\) available/);
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'data', 'newsletters.json')), false);
});

test('fallback builder publishes fallback-only issue as disclosed fallback_public edition', () => {
  const root = tempRoot();
  const date = '2026-05-12';
  const { rejectedCamera } = writeFallbackOnlyReviewableArtifacts(root, date);

  const result = buildFallbackPublicIssue({ root, date });
  const status = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  const quality = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), 'utf8'));
  const newsletterData = JSON.parse(fs.readFileSync(path.join(root, 'data', 'newsletters.json'), 'utf8'))[0];
  const markdown = fs.readFileSync(path.join(root, 'newsletters', date, 'newsletter.md'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'newsletters', date, 'index.html'), 'utf8');
  const finalEditor = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), 'utf8'));

  assert.equal(rejectedCamera.relevance_bucket, 'direct_aosp_camera');
  assert.equal(finalEditor.sections.every(section => section.relevance_bucket === 'cpp_ai_tooling_fallback'), true);
  assert.equal(status.publication_mode, 'fallback_public');
  assert.equal(status.homepage_visibility, 'visible_with_fallback_badge');
  assert.equal(status.normal_public_ready, false);
  assert.equal(status.automatic_publish_ready, false);
  assert.equal(status.public_artifact_ready, true);
  assert.equal(status.fallback_public_ready, true);
  assert.equal(status.fallback_only, true);
  assert.equal(status.camera_anchor_count, 0);
  assert.equal(status.homepage_badge, 'Tooling Watch Edition');
  assert.equal(status.public_newsletter_ready, true);
  assert.equal(status.final_publish_ready, false);
  assert.equal(status.publish_gate_passed, false);
  assert.equal(status.review_publication_ready, true);
  assert.equal(status.homepage_visible_after_merge, true);
  assert.equal(quality.publication_mode, 'fallback_public');
  assert.equal(quality.content_quality_score, quality.score);
  assert.equal(quality.camera_relevance_score, 0);
  assert.match(quality.publication_mode_decision, /fallback_public/);
  assert.equal(newsletterData.publication_mode, 'fallback_public');
  assert.equal(newsletterData.homepage_visibility, 'visible_with_fallback_badge');
  assert.equal(newsletterData.homepage_badge, 'Tooling Watch Edition');
  assert.equal(newsletterData.camera_anchor_count, 0);
  assert.deepEqual(newsletterData.tags, ['Tooling Watch Edition', 'Tooling Watch']);
  assert.match(markdown, /Tooling Watch Edition: C\+\+ \/ Tooling Watch/);
  assert.match(html, /class="publication-notice"/);
  assert.match(html, /Tooling Watch Edition: C\+\+ \/ Tooling Watch/);
  assert.equal(result.publicFiles.includes(`newsletters/${date}/newsletter.md`), true);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  }));
  assert.equal(outputs.publication_mode, 'fallback_public');
  assert.equal(outputs.homepage_visibility, 'visible_with_fallback_badge');
  assert.equal(outputs.fallback_only, 'true');
  assert.equal(outputs.camera_anchor_count, '0');
  assert.equal(outputs.homepage_badge, 'Tooling Watch Edition');

  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'skipped',
    changedArtifacts: requiredPublicFiles(date)
  });
  assert.match(body, /publication_mode: fallback_public/);
  assert.match(body, /homepage_visibility: visible_with_fallback_badge/);
  assert.match(body, /fallback_only: true/);
  assert.match(body, /camera_anchor_count: 0/);
  assert.match(body, /fallback_public_ready: true/);
  assert.match(body, /homepage_badge: Tooling Watch Edition/);
  assert.match(body, /hard block policy에서 downgrade policy로/);
  const bodyValidation = validatePrBodyText(body);
  assert.equal(bodyValidation.ok, true, JSON.stringify(bodyValidation, null, 2));

  const hiddenFallbackStatus = body.replace(/fallback_only: true/g, 'fallback_only: false');
  const validation = validatePrBodyText(hiddenFallbackStatus);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /fallback public PR body must include fallback_only=true/);
});

test('publication mode uses final bound candidate bucket over stale section bucket', () => {
  const decision = publicationDecisionForSections([{
    relevance_bucket: 'android_platform_camera_adjacent',
    bound_candidate: {
      relevance_bucket: 'cpp_ai_tooling_fallback'
    },
    public_article: {
      headline: 'C++ tooling fallback'
    }
  }], {
    publicNewsletterReady: true,
    finalPublishReady: false
  });

  assert.equal(decision.camera_anchor_count, 0);
  assert.equal(decision.fallback_only, true);
  assert.equal(decision.publication_mode, 'fallback_public');
  assert.equal(decision.homepage_visibility, 'visible_with_fallback_badge');
});

test('publication mode treats no-anchor public-quality technical sections as fallback_public', () => {
  const decision = publicationDecisionForSections([{
    relevance_bucket: 'soc_platform_signal',
    public_article: {
      headline: 'Technical platform watch'
    }
  }], {
    publicNewsletterReady: true,
    finalPublishReady: false
  });

  assert.equal(decision.camera_anchor_count, 0);
  assert.equal(decision.fallback_section_count, 0);
  assert.equal(decision.fallback_only, true);
  assert.equal(decision.publication_mode, 'fallback_public');
  assert.equal(decision.homepage_visibility, 'visible_with_fallback_badge');
});

test('fallback issue tags remove Camera HAL when camera_anchor_count is string zero', () => {
  assert.deepEqual(
    issueTags({
      publication_mode: 'fallback_public',
      camera_anchor_count: '0',
      tags: ['Camera HAL', 'Android']
    }),
    ['Tooling Watch Edition', 'Tooling Watch', 'Android']
  );
});

test('reviewable artifact resolver reports fallback_public contract conflicts', () => {
  const root = tempRoot();
  const date = '2026-05-15';
  writePublicNewsletterArtifacts(root, date);
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'NEEDS_FIX',
    final_publish_ready: false,
    review_gate_passed: true,
    editor_review_required: true,
    publication_mode: 'fallback_public',
    homepage_visibility: 'visible_with_fallback_badge',
    fallback_only: false,
    camera_anchor_count: 1,
    fallback_public_ready: true
  });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  }));

  assert.notEqual(outputs.publication_contract_error_count, '0');
  assert.match(outputs.publication_contract_errors, /fallback_only=true/);
  assert.match(outputs.publication_contract_errors, /camera_anchor_count=0/);
  assert.match(outputs.reviewable_artifact_reason, /publication_contract_errors=/);
});

test('review-only public issue keeps review publication notice', () => {
  const date = '2026-05-13';
  const candidate = regressionCandidate({
    title: 'CameraX validation release',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#review-only',
    bucket: 'android_platform_camera_adjacent'
  });
  const issue = {
    date,
    title: `Camera HAL SW 뉴스레터 - ${date}`,
    summary: '검토 발행본입니다.',
    briefing: ['Camera anchor가 남아 있습니다.', '공개 source 범위 안에서 해석합니다.', 'Camera HAL 직접 변경으로 과장하지 않습니다.'],
    publication_mode: 'review_only',
    review_publication_ready: true,
    fallback_only: false,
    camera_anchor_count: 1,
    tags: ['Camera HAL', 'Android'],
    sections: [regressionSection(candidate)],
    references: [{
      title: 'Android Developers Camera',
      url: candidate.url
    }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(markdown, /검토 발행본/);
  assert.match(html, /class="publication-notice"/);
  assert.match(html, /검토 발행본/);
  const markdownNotice = markdown.match(/(?:^> .*(?:\n|$))+/m)?.[0] || '';
  const htmlNotice = html.match(/<div class="publication-notice"[\s\S]*?<\/div>/)?.[0] || '';
  assert.doesNotMatch(`${markdownNotice}\n${htmlNotice}`, /Review-only|quality gate|guardrail|fallback|자동 정상 발행|편집자 확인 후 merge|merge해야/);
});

test('fallback public issue uses tooling perspective label', () => {
  const date = '2026-05-14';
  const candidate = regressionCandidate({
    title: 'LLVM native sanitizer workflow',
    url: 'https://isocpp.org/blog/2026/05/llvm-native-sanitizer-workflow',
    bucket: 'cpp_ai_tooling_fallback',
    fallback: true
  });
  const issue = {
    date,
    title: `Tooling Watch Edition: C++ / Tooling Watch - ${date}`,
    summary: 'Tooling Watch Edition issue',
    briefing: ['Tooling watch item입니다.', 'Camera anchor는 없습니다.', '편집자 검토가 필요합니다.'],
    publication_mode: 'fallback_public',
    fallback_only: true,
    camera_anchor_count: 0,
    tags: ['Tooling Watch Edition', 'Tooling Watch'],
    sections: [regressionSection(candidate)],
    references: [{
      title: 'ISO C++',
      url: candidate.url
    }]
  };

  const markdown = buildMarkdown(issue);
  const html = buildHtml(issue);

  assert.match(markdown, /\*\*Android Native \/ Tooling 관점\*\*/);
  assert.match(html, /Android Native \/ Tooling 관점/);
  assert.doesNotMatch(markdown, /\*\*Camera HAL \/ Driver 관점\*\*/);
});

test('reviewable artifact resolver rejects candidate shortage when deterministic artifact is missing', () => {
  const root = tempRoot();
  const date = '2026-05-11';
  writeCandidateShortageReviewableArtifacts(root, date, { writeArticleCapsules: false });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
      .filter(file => file !== 'article-capsules.json')
      .map(file => `content/newsroom/${date}/${file}`)
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=candidate_shortage_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /missing_candidate_shortage_required=article-capsules\.json/);
});

test('reviewable artifact resolver rejects failed repair with repair-failure only', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED_REPAIR_REVIEWABLE',
    publish_ready: false,
    selection_publish_ready: false,
    final_publish_ready: false,
    publish_gate_passed: false
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'Editor output must contain 3-5 sections; got 2.'
  });

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: [`content/newsroom/${date}/repair-failure.json`]
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.date, date);
  assert.equal(outputs.branch, `newsletter/${date}`);
  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.match(outputs.reviewable_artifact_reason, /status=FAILED_REPAIR_REVIEWABLE/);
  assert.match(outputs.reviewable_artifact_reason, /repair-failure\.json/);
  assert.match(outputs.reviewable_artifact_reason, /missing_required=/);
  for (const required of REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.filter(file => file !== 'repair-failure.json')) {
    assert.match(outputs.reviewable_artifact_reason, new RegExp(required.replace('.', '\\.')));
  }
});

test('reviewable artifact resolver rejects complete failed repair when only tmp state changed', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: []
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
  assert.equal(outputs.changed_artifact_count, '0');
  assert.match(outputs.reviewable_artifact_reason, /changed=none/);
});

test('reviewable artifact resolver accepts complete changed failed repair artifact set', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), '# draft\n');

  const resolved = resolveReviewableArtifacts({
    root,
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.map(file => `content/newsroom/${date}/${file}`)
      .concat(`newsletters/${date}/newsletter.md`)
  });
  const outputs = buildReviewableArtifactOutputs(resolved);

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'false');
  assert.equal(outputs.publish_candidate_ready, 'false');
  assert.equal(outputs.changed_artifact_count, String(REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS.length + 1));
  assert.match(outputs.reviewable_artifact_reason, /missing_required=none/);
});

test('reviewable artifact resolver treats legacy quality failures as public-ready when public files are valid', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'QUALITY_NEEDS_FIX',
    final_publish_ready: false
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), {
    date,
    sections: []
  });
  writePublicNewsletterArtifacts(root, date);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: [
      `content/newsroom/${date}/editor-draft.json`,
      `newsletters/${date}/newsletter.md`,
      `newsletters/${date}/index.html`,
      'data/newsletters.json'
    ]
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'true');
  assert.equal(outputs.has_public_artifacts, 'true');
  assert.equal(outputs.has_required_public_newsletter_files, 'true');
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.has_ai_publish_ready, 'false');
  assert.equal(outputs.has_publish_candidate, 'true');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.review_only, 'false');
  assert.equal(outputs.diagnostics_only, 'false');
  assert.equal(outputs.review_publication_ready, 'false');
  assert.equal(outputs.homepage_visible_after_merge, 'true');
  assert.equal(outputs.publish_candidate_ready, 'true');
  assert.match(outputs.reviewable_artifact_reason, /public_newsletter_ready=true/);
  assert.doesNotMatch(outputs.public_newsletter_reason, /quality|final_publish_ready|repair|shortage/);
});

test('reviewable artifact resolver does not treat FAILED status as a publish candidate', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'FAILED'
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'repair-failure.json'), {
    message: 'terminal failure'
  });
  writeText(path.join(root, 'newsletters', date, 'newsletter.md'), '# stale draft\n');

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    changedArtifacts: [
      `content/newsroom/${date}/repair-failure.json`,
      `newsletters/${date}/newsletter.md`
    ]
  }));

  assert.equal(outputs.has_reviewable_artifacts, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.equal(outputs.review_pr_ready, 'false');
  assert.equal(outputs.review_only, 'false');
});

test('fallback builder recovers PR #39 shape with public files and preserve-first articles', () => {
  const root = tempRoot();
  const { date, editor } = writePr39LikeRegressionFixture(root);
  const preserveSnapshots = editor.sections.slice(0, 2).map(section => ({
    headline: section.headline,
    category: section.category,
    confirmed_facts: section.confirmed_facts,
    camera_hal_perspective: section.camera_hal_perspective,
    action_items: section.action_items,
    source_candidate_hash: section.source_candidate_hash,
    sourceUrl: section.sources[0].url
  }));

  const result = buildFallbackPublicIssue({ root, date });
  const finalEditor = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), 'utf8'));
  const quality = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), 'utf8'));
  const fallbackReport = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), 'utf8'));
  const publicMarkdown = fs.readFileSync(path.join(root, 'newsletters', date, 'newsletter.md'), 'utf8');
  const publicHtml = fs.readFileSync(path.join(root, 'newsletters', date, 'index.html'), 'utf8');

  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'data', 'newsletters.json')), true);
  assert.equal(finalEditor.sections.length, preserveSnapshots.length);
  assert.equal(finalEditor.sections.some(section => section.headline === 'GCC 16.1'), false);
  assert.equal(finalEditor.sections.some(section => /Glaze 7\.2/.test(section.headline)), false);
  assert.doesNotMatch(publicMarkdown, /Glaze 7\.2 C\+\+26 Reflection/);
  assert.doesNotMatch(
    `${publicMarkdown}\n${publicHtml}`,
    /HAL Signal Capsule|why_now|impact_axes|do_not_overstate|Review-only|quality gate|deterministic reconstruction|source-bound|Publication 전에|Direct HAL behavior claim/
  );
  assert.equal(quality.status, 'PASS');
  assert.equal(result.status.publication_mode, 'review_only');
  assert.equal(result.status.fallback_only, false);
  assert.equal(result.status.camera_anchor_count, 2);
  assert.equal(result.status.fallback_public_ready, false);
  assert.equal(fallbackReport.demoted_articles[0].headline, 'GCC 16.1');
  assert.equal(result.publicFiles.includes(`newsletters/${date}/newsletter.md`), true);

  for (const snapshot of preserveSnapshots) {
    const section = finalEditor.sections.find(item => item.source_candidate_hash === snapshot.source_candidate_hash);
    assert.ok(section, `${snapshot.headline} must be preserved`);
    assert.deepEqual(section.headline, snapshot.headline);
    assert.deepEqual(section.category, snapshot.category);
    assert.deepEqual(section.confirmed_facts, snapshot.confirmed_facts);
    assert.deepEqual(section.camera_hal_perspective, snapshot.camera_hal_perspective);
    assert.deepEqual(section.action_items, snapshot.action_items);
    assert.deepEqual(section.sources[0].url, snapshot.sourceUrl);
  }

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  }));
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.publication_mode, 'review_only');
  assert.equal(outputs.fallback_only, 'false');
  assert.equal(outputs.camera_anchor_count, '2');
  assert.equal(outputs.has_publish_candidate, 'true');
  assert.equal(outputs.public_newsletter_reason, 'ready');
});

test('fallback builder preserves original fact-check blocker diagnostics after rebuilding public issue', () => {
  const root = tempRoot();
  const { date } = writePr39LikeRegressionFixture(root);
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'NEEDS_FIX',
    must_fix: [{
      location: 'GCC 16.1',
      problem: 'Original article overstated Camera HAL impact.',
      suggestion: 'Remove or demote the article.',
      source_url: 'https://isocpp.org/blog/2026/04/gcc-16.1'
    }],
    source_gaps: ['GCC 16.1 lacks Camera HAL source support.'],
    source_gap_count: 1,
    final_comment: 'Original public issue was not safe.'
  });

  buildFallbackPublicIssue({ root, date });

  const fallbackReport = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), 'utf8'));
  const status = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  const quality = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), 'utf8'));
  const factCheck = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), 'utf8'));

  assert.equal(factCheck.status, 'PASS');
  for (const artifact of [fallbackReport, status, quality]) {
    assert.equal(artifact.original_fact_check_status, 'NEEDS_FIX');
    assert.equal(artifact.original_must_fix_count, 1);
    assert.equal(artifact.original_source_gap_count, 1);
    assert.equal(artifact.fallback_public_issue_removed_blockers, true);
    assert.equal(artifact.fallback_public_issue_removed_article_count > 0, true);
    assert.equal(
      artifact.review_publication_ready_reason,
      '자동 발행 기준은 통과하지 못했지만 fallback public issue builder가 편집자 검토용 public newsletter 파일을 생성했습니다.'
    );
    assert.equal(
      artifact.editor_review_reason,
      'AI 자동 발행 기준을 통과하지 못했으므로 merge 발행 전에 편집자 검토가 필요합니다.'
    );
  }
});

test('fallback builder keeps editorial reviewable failure kind for unchanged public handoff', () => {
  const root = tempRoot();
  const { date } = writePr39LikeRegressionFixture(root);
  const statusPath = path.join(root, 'content', 'newsroom', date, 'generation-status.json');
  const tmpStatusPath = path.join(root, '.tmp', 'newsletter-generation-status.json');
  const status = {
    ...JSON.parse(fs.readFileSync(statusPath, 'utf8')),
    status: 'NEEDS_FIX',
    editor_semantic_validation: {
      name: 'EditorSemanticValidationError',
      field: 'sections.claims',
      message: 'Editor output failed claim binding validation.'
    }
  };
  writeJson(statusPath, status);
  writeJson(tmpStatusPath, status);

  buildFallbackPublicIssue({ root, date });

  const nextStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  assert.equal(nextStatus.failure_kind, 'editorial_reviewable');

  const changedArtifacts = REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
    .map(file => `content/newsroom/${date}/${file}`)
    .concat(`content/newsroom/${date}/fallback-public-issue.json`);
  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts
  }));

  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.review_pr_ready, 'true');
  assert.equal(outputs.diagnostics_only, 'true');
  assert.match(outputs.reviewable_artifact_reason, /failure_kind=editorial_reviewable/);
  assert.match(outputs.reviewable_artifact_reason, /editorial_reject=none/);
});

test('fallback duplicate detection treats AndroidX Camera release anchors as release identity', () => {
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
  const anchorless = regressionCandidate({
    title: 'CameraX release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    bucket: 'android_platform_camera_adjacent'
  });
  const camerax14Localized = regressionCandidate({
    title: 'CameraX 1.4.0-alpha07 localized',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera?hl=vi#1.4.0-alpha07',
    bucket: 'android_platform_camera_adjacent'
  });

  assert.equal(sectionDuplicateReason(camerax16, [regressionSection(camerax14)]), '');
  assert.equal(sectionDuplicateReason(camerax14, [regressionSection(camerax14)]), 'duplicate_url');
  assert.equal(sectionDuplicateReason(camerax14Localized, [regressionSection(camerax14)]), 'duplicate_base_url');
  assert.equal(sectionDuplicateReason(anchorless, [regressionSection(camerax14)]), 'duplicate_base_url');
  assert.equal(sectionDuplicateReason(anchorless, [regressionSection(anchorless)]), 'duplicate_url');
});

test('fallback builder recovers run 25590436113 shape with source-bound anchor candidates', () => {
  const root = tempRoot();
  const { date, camerax14, camerax16, camerax13, libcamera, gcc } = writeRun25590436113LikeFallbackFixture(root);
  writeJson(path.join(root, 'content', 'newsroom', date, 'background-context.json'), {
    schema_version: 1,
    date,
    background_contexts: [{
      source_candidate_hash: camerax13.source_candidate_hash,
      background_context: 'API supplied context wins over static fallback for CameraX validation background.',
      background_basis: 'supplied capsule and model knowledge',
      background_confidence: 'medium',
      background_warnings: []
    }]
  });

  const result = buildFallbackPublicIssue({ root, date });
  const finalEditor = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), 'utf8'));
  const fallbackReport = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), 'utf8'));
  const status = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));

  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'data', 'newsletters.json')), true);
  assert.equal(finalEditor.sections.length, articlePolicy.mainArticleCount.min);
  assert.deepEqual(
    finalEditor.sections.map(section => section.source_candidate_hash),
    [camerax14.source_candidate_hash]
  );
  for (const section of finalEditor.sections) {
    assert.notEqual(section.background, section.what_changed);
    assert.equal(section.impact_claim_level, 'android_framework_adjacent');
  }
  assert.equal(finalEditor.sections.some(section => section.source_candidate_hash === camerax13.source_candidate_hash), false);
  assert.equal(finalEditor.sections.some(section => section.source_candidate_hash === libcamera.source_candidate_hash), false);
  assert.equal(finalEditor.sections.some(section => section.source_candidate_hash === gcc.source_candidate_hash), false);
  assert.equal(fallbackReport.fallback_articles[0].action, 'rebuild-from-bound-candidate');
  assert.equal(fallbackReport.demoted_articles.some(item => item.headline === libcamera.title && item.action === 'replace-or-demote'), true);
  assert.equal(fallbackReport.demoted_articles.some(item => item.headline === 'GCC 16.1' && item.action === 'replace-or-demote'), true);
  assert.equal(status.final_publish_ready, false);
  assert.equal(status.artifact_final_publish_ready, false);
  assert.equal(status.publish_gate_passed, false);
  assert.equal(result.publicFiles.includes(`newsletters/${date}/newsletter.md`), true);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  }));
  assert.equal(outputs.public_newsletter_ready, 'true');
});

test('fallback builder writes public files when one safe article is available', () => {
  const root = tempRoot();
  const { date } = writeRun25590436113LikeFallbackFixture(root, { includeSafeAnchors: false });

  const result = buildFallbackPublicIssue({ root, date });
  const finalEditor = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), 'utf8'));
  const publicMarkdown = fs.readFileSync(path.join(root, 'newsletters', date, 'newsletter.md'), 'utf8');
  const publicHtml = fs.readFileSync(path.join(root, 'newsletters', date, 'index.html'), 'utf8');

  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'data', 'newsletters.json')), true);
  assert.equal(finalEditor.sections.length, articlePolicy.mainArticleCount.min);
  assert.match(publicMarkdown, /CameraX 1\.4\.0-alpha07/);
  assert.match(publicHtml, /CameraX 1\.4\.0-alpha07/);
  assert.equal(result.status.public_newsletter_ready, true);
});

test('fallback builder includes selected native tooling supporting article after one safe main article', () => {
  const root = tempRoot();
  const date = '2026-05-22';
  writeRootIndexContract(root);
  const compose = regressionCandidate({
    title: 'Building seamless Android experiences across devices with Jetpack Compose',
    url: 'https://goo.gle/AdaptiveApps_IO26',
    bucket: 'android_platform_camera_adjacent'
  });
  const aiStudio = {
    ...regressionCandidate({
      title: 'Build native Android apps in Google AI Studio',
      url: 'https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html',
      bucket: 'cpp_ai_tooling_fallback',
      fallback: true
    }),
    source: 'Android Developers Blog',
    component: 'Google AI Studio',
    tooling_workflow_type: 'native_tooling_workflow',
    article_group_key: 'android_native_tooling_workflow',
    native_tooling_relevance: 4,
    impact_claim_level: 'tooling_supporting',
    summary: 'Google AI Studio added native Android app generation workflow support for Android developers.'
  };
  const editor = {
    date,
    title: `Camera HAL SW Newsletter - ${date}`,
    summary: 'Workflow 3 fallback should keep source-ready supporting tooling.',
    briefing: ['Compose CameraX item.', 'AI Studio tooling item.', 'Review-only public issue.'],
    sections: [regressionSection(compose)],
    action_items: ['Review Compose CameraX behavior.'],
    references: []
  };
  const status = {
    date,
    status: 'NEEDS_FIX',
    generation_status: 'FAILED',
    failure_stage: 'editor attempt 1/2',
    failure_reason: 'Editor output failed article section contract validation.',
    final_publish_ready: false,
    artifact_final_publish_ready: false,
    publish_gate_passed: false,
    review_gate_passed: true,
    editor_review_required: true,
    fact_check_status: 'PASS',
    must_fix_count: 0,
    source_gap_count: 0,
    quality_status: 'PASS',
    quality_score: 100,
    quality_threshold: qualityGatePolicy.threshold,
    rendered_main_article_count: 1,
    selected_article_count: 2,
    min_final_articles: articlePolicy.mainArticleCount.min
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), editor);
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
    date,
    score: 100,
    threshold: qualityGatePolicy.threshold,
    status: 'PASS',
    deductions: [],
    article_results: [{
      index: 1,
      headline: compose.title,
      status: 'PASS',
      repair_action: 'preserve',
      hard_fail_reasons: [],
      scope_count: scopeCountForCandidate(compose)
    }]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    final_comment: 'PASS'
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'), {
    date,
    candidates: [compose, aiStudio]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [compose, aiStudio],
    reserve_candidates: [],
    composition_summary: {
      supporting_main_article_count: 1
    }
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'article-capsules.json'), {
    selected_capsules: [compose, aiStudio],
    reserve_capsules: []
  });

  const result = buildFallbackPublicIssue({ root, date });
  const finalEditor = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), 'utf8'));
  const publicMarkdown = fs.readFileSync(path.join(root, 'newsletters', date, 'newsletter.md'), 'utf8');
  const fallbackReport = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json'), 'utf8'));

  assert.equal(finalEditor.sections.length, 2);
  assert.equal(
    finalEditor.sections.some(section => section.headline.includes(aiStudio.title)),
    true,
    finalEditor.sections.map(section => section.headline).join(' | ')
  );
  assert.match(publicMarkdown, /Build native Android apps in Google AI Studio/);
  assert.equal(fallbackReport.fallback_articles.some(item => item.action === 'selected-native-tooling-supporting'), true);
  assert.equal(result.status.public_newsletter_ready, true);

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  }));
  assert.equal(outputs.public_newsletter_ready, 'true');
  assert.equal(outputs.diagnostics_only, 'false');
});

test('fallback failure diagnostics overwrites stale failure reason on rerun', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  const diagnosticsPath = path.join(root, 'content', 'newsroom', date, 'fallback-public-issue-diagnostics.json');
  const oldGeneratedAt = '2026-05-08T00:00:00.000Z';
  writeJson(diagnosticsPath, {
    date,
    generated_at: oldGeneratedAt,
    status: 'FAILED',
    failure_stage: 'stale_stage',
    failure_reason: 'old failure',
    fallback_public_issue_failed: true,
    demoted_articles: [{ headline: 'Old demoted article' }],
    top_rejected_reasons: [{ reason: 'old_reason', count: 2 }],
    written_by: 'ensure-public-newsletter-artifacts'
  });

  const relPath = writeFallbackFailureDiagnostics({
    root,
    date,
    error: new Error('new failure'),
    status: {
      generation_status: 'FAILED_REPAIR_REVIEWABLE',
      status: 'NEEDS_FIX'
    }
  });
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));

  assert.equal(relPath, `content/newsroom/${date}/fallback-public-issue-diagnostics.json`);
  assert.equal(diagnostics.status, 'FAILED');
  assert.equal(diagnostics.failure_stage, 'fallback_public_issue_builder');
  assert.equal(diagnostics.failure_reason, 'new failure');
  assert.equal(diagnostics.previous_failure_reason, 'old failure');
  assert.notEqual(diagnostics.generated_at, oldGeneratedAt);
  assert.equal(diagnostics.source_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.deepEqual(diagnostics.demoted_articles, [{ headline: 'Old demoted article' }]);
  assert.deepEqual(diagnostics.top_rejected_reasons, [{ reason: 'old_reason', count: 2 }]);
});

test('ensure CLI preserves failed repair Gemini draft instead of building fallback public issue', () => {
  const root = tempRoot();
  const date = '2026-05-21';
  const draftSection = retrySection(
    'Jetpack Compose adaptive CameraX preview background',
    'https://example.com/compose-camerax-preview'
  );
  writeFailedRepairReviewableArtifacts(root, date, {
    status: {
      final_publish_ready: false,
      publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      failure_reason: 'section_count_drift',
      repair_failure_kind: 'section_count_drift',
      quality_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    generationStatus: {
      final_publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      failure_stage: 'editor repair attempt 1/2',
      failure_reason: 'section_count_drift',
      repair_failure_kind: 'section_count_drift',
      quality_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    editor: {
      summary: 'Preserve this Gemini draft for editor repair.',
      sections: [draftSection]
    },
    quality: {
      status: 'NEEDS_FIX',
      score: 82,
      deductions: [{ category: 'source-integrity', points: 3, reason: 'Repair required.', blocking: false }]
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ location: 'sections[0].claims[0].evidence_ids', problem: 'Repair evidence ids.' }],
      source_gaps: [],
      source_gap_count: 0
    },
    repairFailure: {
      code: 'section_count_drift',
      message: 'Repair returned zero sections; preserve last known valid draft.'
    }
  });
  const changedArtifacts = REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
    .map(file => `content/newsroom/${date}/${file}`);
  const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
  const editorBefore = fs.readFileSync(editorPath, 'utf8');

  const result = ensurePublicNewsletterArtifacts({ root, date, changedArtifacts });

  assert.equal(result.fallbackExecuted, false);
  assert.equal(result.fallbackSkipped, true);
  assert.equal(result.outputs.fallback_public_issue_executed, 'false');
  assert.equal(result.outputs.fallback_public_issue_skipped, 'true');
  assert.equal(result.outputs.fallback_public_issue_skip_reason, 'preserve_reviewable_gemini_draft_after_failed_repair');
  assert.equal(result.outputs.public_newsletter_ready, 'false');
  assert.equal(result.outputs.review_pr_ready, 'true');
  assert.equal(result.outputs.diagnostics_only, 'true');
  assert.equal(fs.existsSync(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue.json')), false);
  assert.equal(fs.readFileSync(editorPath, 'utf8'), editorBefore);
});

test('ensure CLI treats one safe fallback article as review-publication ready for non-repair quality triggers', () => {
  const root = tempRoot();
  const { date } = writeRun25590436113LikeFallbackFixture(root, { includeSafeAnchors: false });
  const qualityTriggerStatus = {
    date,
    status: 'QUALITY_NEEDS_FIX',
    final_publish_ready: false,
    publish_gate_passed: false,
    review_gate_passed: true,
    editor_review_required: true,
    quality_status: 'NEEDS_FIX',
    quality_score: 56,
    quality_threshold: qualityGatePolicy.threshold,
    rendered_main_article_count: 3,
    min_final_articles: articlePolicy.mainArticleCount.min
  };
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), qualityTriggerStatus);
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), qualityTriggerStatus);
  const changedArtifacts = REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
    .map(file => `content/newsroom/${date}/${file}`)
    .concat(requiredPublicFiles(date));

  const result = ensurePublicNewsletterArtifacts({ root, date, changedArtifacts });
  const resolvedOutputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts
  }));

  assert.equal(result.fallbackExecuted, true);
  assert.equal(result.outputs.fallback_public_issue_executed, 'true');
  assert.equal(result.outputs.fallback_public_issue_failed, 'false');
  assert.equal(result.outputs.fallback_public_issue_error, 'none');
  assert.equal(result.outputs.public_newsletter_ready, 'true');
  assert.equal(result.outputs.review_pr_ready, 'true');
  assert.equal(result.outputs.review_only, 'false');
  assert.equal(result.outputs.diagnostics_only, 'false');
  assert.equal(result.outputs.review_publication_ready, 'true');
  assert.equal(result.outputs.homepage_visible_after_merge, 'true');
  assert.equal(result.outputs.publication_mode, 'review_only');
  assert.equal(result.outputs.homepage_visibility, 'normal');
  assert.equal(result.outputs.publish_candidate_ready, 'true');
  assert.equal(result.outputs.review_pr_ready, resolvedOutputs.review_pr_ready);
  assert.equal(result.outputs.review_only, resolvedOutputs.review_only);
  assert.equal(result.outputs.diagnostics_only, resolvedOutputs.diagnostics_only);
  assert.equal(result.outputs.review_publication_ready, resolvedOutputs.review_publication_ready);
  assert.equal(result.outputs.homepage_visible_after_merge, resolvedOutputs.homepage_visible_after_merge);
  assert.equal(result.outputs.public_newsletter_ready, resolvedOutputs.public_newsletter_ready);
});

test('ensure CLI reconciles diagnostics-only state into status files and hides stale public index', () => {
  const root = tempRoot();
  const date = '2026-05-18';
  writeCandidateShortageReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);

  const result = ensurePublicNewsletterArtifacts({
    root,
    date,
    noBuild: true,
    changedArtifacts: REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
  });

  const newsletters = JSON.parse(fs.readFileSync(path.join(root, 'data', 'newsletters.json'), 'utf8'));
  const canonicalStatus = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  const tmpStatus = JSON.parse(fs.readFileSync(path.join(root, '.tmp', 'newsletter-generation-status.json'), 'utf8'));

  assert.equal(newsletters.some(item => item.date === date), false);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), true);
  assert.deepEqual(canonicalStatus, tmpStatus);
  assert.equal(canonicalStatus.effective_homepage_visible, false);
  assert.equal(canonicalStatus.public_artifact_policy, 'hide_existing_public_artifact_after_latest_diagnostics_only');
  assert.equal(result.outputs.effective_homepage_visible, 'false');
  assert.equal(result.outputs.public_artifact_source, 'none');
  assert.match(result.outputs.reconciled_changed_artifacts, /data\/newsletters\.json/);
  assert.match(result.outputs.reconciled_changed_artifacts, new RegExp(`content/newsroom/${date}/generation-status\\.json`));
});

test('ensure CLI records invalid review publication structure as non-visible', () => {
  const root = tempRoot();
  const date = '2026-05-18';
  writeEditorialReviewableArtifacts(root, date, {
    status: {
      public_newsletter_ready: true,
      review_publication_ready: true
    },
    generationStatus: {
      public_newsletter_ready: true,
      review_publication_ready: true
    }
  });

  const result = ensurePublicNewsletterArtifacts({
    root,
    date,
    noBuild: true,
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${date}/${file}`)
  });

  const status = JSON.parse(fs.readFileSync(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  assert.equal(result.outputs.public_newsletter_ready, 'false');
  assert.equal(result.outputs.effective_homepage_visible, 'false');
  assert.equal(result.outputs.public_artifact_policy, 'review_publication_invalid_public_structure');
  assert.equal(status.review_publication_ready, true);
  assert.equal(status.public_newsletter_ready, false);
  assert.equal(status.public_artifact_policy, 'review_publication_invalid_public_structure');
});

test('ensure CLI runs fallback builder for quality and repair triggers, then recomputes readiness', () => {
  const root = tempRoot();
  const { date } = writePr39LikeRegressionFixture(root);

  const result = ensurePublicNewsletterArtifacts({ root, date });

  assert.equal(result.fallbackExecuted, true);
  assert.equal(result.outputs.public_newsletter_ready, 'true');
  assert.equal(result.outputs.review_publication_ready, 'true');
  assert.equal(result.outputs.diagnostics_only, 'false');
  assert.equal(result.outputs.homepage_visible_after_merge, 'true');
  assert.equal(result.outputs.fallback_public_issue_executed, 'true');
  assert.match(result.outputs.fallback_public_issue_trigger_reason, /quality_status=NEEDS_FIX/);
  assert.match(result.outputs.fallback_public_issue_trigger_reason, /section_count_drift/);
  assert.doesNotMatch(result.outputs.public_newsletter_reason, /quality|final_publish_ready|repair|shortage|section_count_drift/);
});

test('public newsletter readiness requires every public file in changed artifacts', () => {
  const root = tempRoot();
  const { date } = writePr39LikeRegressionFixture(root);
  buildFallbackPublicIssue({ root, date });

  const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
    root,
    date,
    changedArtifacts: [
      `newsletters/${date}/newsletter.md`,
      'data/newsletters.json'
    ]
  }));

  assert.equal(outputs.has_required_public_newsletter_files, 'true');
  assert.equal(outputs.public_newsletter_ready, 'false');
  assert.equal(outputs.has_publish_candidate, 'false');
  assert.match(outputs.public_newsletter_reason, /required public files not changed/);
});

test('public newsletter readiness requires valid data/newsletters.json entry for public files', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writePublicNewsletterArtifacts(root, date);

  for (const [label, newsletters, expectedReason] of [
    ['missing date entry', [], /data\/newsletters\.json missing date entry/],
    ['path mismatch', [{
      date,
      title: 'Camera HAL SW Newsletter',
      summary: 'Path mismatch fixture',
      html: `newsletters/${date}/wrong-index.html`,
      md: `newsletters/${date}/wrong-newsletter.md`,
      tags: ['Camera HAL']
    }], /data\/newsletters\.json html path mismatch|data\/newsletters\.json md path mismatch/]
  ]) {
    writeJson(path.join(root, 'data', 'newsletters.json'), newsletters);

    const outputs = buildReviewableArtifactOutputs(resolveReviewableArtifacts({
      root,
      date,
      changedArtifacts: requiredPublicFiles(date)
    }));

    assert.equal(outputs.has_required_public_newsletter_files, 'false', label);
    assert.equal(outputs.public_newsletter_ready, 'false', label);
    assert.equal(outputs.has_publish_candidate, 'false', label);
    assert.match(outputs.public_newsletter_reason, expectedReason, label);
  }
});

test('ensure CLI skips fallback when public artifacts are already valid', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      final_publish_ready: true,
      validate_ok: true
    }
  });
  writePublicNewsletterArtifacts(root, date);

  const result = ensurePublicNewsletterArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  });

  assert.equal(result.fallbackExecuted, false);
  assert.equal(result.outputs.public_newsletter_ready, 'true');
  assert.equal(result.outputs.fallback_public_issue_executed, 'false');
  assert.equal(result.outputs.fallback_public_issue_trigger_reason, 'none');
  assert.equal(result.outputs.public_newsletter_reason, 'ready');
});

test('root wrapper CLIs expose review handoff outputs', () => {
  const repoRoot = path.join(__dirname, '..', '..');
  const date = '2026-05-10';
  const resolveRoot = tempRoot();
  execFileSync('git', ['init'], { cwd: resolveRoot, stdio: 'ignore' });
  writeFailedRepairReviewableArtifacts(resolveRoot, date);

  const resolveOutput = execFileSync(
    process.execPath,
    [path.join(repoRoot, 'scripts', 'resolve-reviewable-artifacts.js')],
    { cwd: resolveRoot, encoding: 'utf8' }
  );

  assert.match(resolveOutput, /review_pr_ready=true/);
  assert.match(resolveOutput, /review_only=true/);
  assert.match(resolveOutput, /diagnostics_only=true/);
  assert.match(resolveOutput, /review_publication_ready=false/);
  assert.match(resolveOutput, /homepage_visible_after_merge=false/);
  assert.match(resolveOutput, /publish_candidate_ready=false/);
  assert.match(resolveOutput, /changed_artifact_count=\d+/);

  const ensureRoot = tempRoot();
  execFileSync('git', ['init'], { cwd: ensureRoot, stdio: 'ignore' });
  writeMinimalPublishArtifacts(ensureRoot, date, {
    finalPublishReady: true,
    status: {
      final_publish_ready: true,
      validate_ok: true
    }
  });
  writePublicNewsletterArtifacts(ensureRoot, date);

  const ensureOutput = execFileSync(
    process.execPath,
    [
      path.join(repoRoot, 'scripts', 'ensure-public-newsletter-artifacts.js'),
      '--date',
      date,
      '--no-build'
    ],
    { cwd: ensureRoot, encoding: 'utf8' }
  );

  assert.match(ensureOutput, /review_pr_ready=true/);
  assert.match(ensureOutput, /review_only=false/);
  assert.match(ensureOutput, /diagnostics_only=false/);
  assert.match(ensureOutput, /review_publication_ready=false/);
  assert.match(ensureOutput, /homepage_visible_after_merge=true/);
  assert.match(ensureOutput, /publish_candidate_ready=true/);
  assert.match(ensureOutput, /changed_artifact_count=\d+/);
});

test('ensure CLI throws when fallback is required but candidate artifacts are missing', () => {
  const root = tempRoot();
  const date = '2026-05-10';
  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), {
    date,
    status: 'QUALITY_NEEDS_FIX',
    final_publish_ready: false,
    quality_status: 'NEEDS_FIX'
  });
  writeText(path.join(root, '.tmp', 'newsletter-date.txt'), date);

  assert.throws(
    () => ensurePublicNewsletterArtifacts({ root, date }),
    /Cannot build fallback public issue for 2026-05-10: no newsroom or collected candidate artifacts are available\./
  );
});

test('fallback builder records structural diagnostics when public issue validation fails', () => {
  const root = tempRoot();
  const { date } = writePr39LikeRegressionFixture(root);
  const editorPath = path.join(root, 'content', 'newsroom', date, 'editor-draft.json');
  const editor = JSON.parse(fs.readFileSync(editorPath, 'utf8'));
  editor.sections[0].selectedImage = 'assets/images/fallback/missing.png';
  editor.sections[0].resolvedImage = {
    usedFallback: true,
    url: 'assets/images/fallback/missing.png'
  };
  writeJson(editorPath, editor);

  assert.throws(
    () => buildFallbackPublicIssue({ root, date }),
    /Fallback public issue structural validation failed/
  );

  const diagnosticsPath = path.join(root, 'content', 'newsroom', date, 'fallback-public-issue-structural-errors.json');
  assert.equal(fs.existsSync(diagnosticsPath), true);
  const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));
  assert.ok(Array.isArray(diagnostics.errors));
  assert.match(diagnostics.errors.join('\n'), /selectedImage fallback file is missing|article image fallback file is missing/);
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
  assert.match(body, /## 기사 구성 요약/);
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
  const root = tempRoot();
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

  assert.match(body, /^## 이번 주 핵심 메시지$/m);
  assert.match(body, /핵심 메시지입니다/);
  assert.match(body, /^## 권장 판단$/m);
  assert.doesNotMatch(body, /^## 품질 게이트$/m);
  assert.doesNotMatch(body, /^## Stale Claim Gate$/m);
  assert.doesNotMatch(body, /오래된 PASS 문구/);
});

test('publish status resolver blocks final publish when fact-check needs fix', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'source gap remains' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_status, 'PASS');
  assert.equal(resolved.status.fact_check_status, 'NEEDS_FIX');
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.fact_check_status_pass, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.must_fix_count_zero, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when quality hard fail remains above threshold', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  const highScore = qualityGatePolicy.threshold + 5;
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      quality_status: 'NEEDS_FIX',
      quality_score: highScore
    },
    quality: {
      status: 'NEEDS_FIX',
      score: highScore,
      deductions: [
        {
          category: 'source-integrity',
          points: 8,
          reason: 'Main article source maps to ineligible reporter/shortlist candidate: source_gap_risk=true.',
          blocking: true
        }
      ]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.quality_status, 'NEEDS_FIX');
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.quality_status_pass, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.quality_score_meets_threshold, true);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when source_gap remains above threshold', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      source_gap_count: 1
    },
    factCheck: {
      status: 'PASS',
      must_fix: [],
      source_gaps: [{ issue: 'missing article-level source evidence' }],
      source_gap_count: 1
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.fact_check_status, 'PASS');
  assert.equal(resolved.status.source_gap_count, 1);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.source_gap_count_zero, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when stale claim hard failure remains above threshold', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      stale_claim_status: 'NEEDS_FIX',
      stale_claim_hard_failure_count: 1
    },
    staleClaim: {
      status: 'NEEDS_FIX',
      hard_failures: [{ reason: 'removed-section-claim-remains' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.stale_claim_status, 'NEEDS_FIX');
  assert.equal(resolved.status.stale_claim_hard_failure_count, 1);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.stale_claim_status_not_needs_fix, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.stale_claim_hard_failure_count_zero, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver blocks PUBLISH_READY when article count policy gate is not publish-ready above threshold', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      selection_publish_ready: false,
      publish_ready: false,
      publish_gate_passed: false,
      selected_article_count: articlePolicy.mainArticleCount.min - 1,
      final_selected_article_count: articlePolicy.mainArticleCount.min - 1
    },
    shortlist: {
      publish_ready: false,
      publish_gate_passed: false,
      composition_mode: 'NEEDS_FIX',
      selected_article_count: articlePolicy.mainArticleCount.min - 1
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.quality_score >= qualityGatePolicy.threshold, true);
  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.selection_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver keeps site validation failure out of consistency errors', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, true);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.validation_passed, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
  assert.equal(resolved.status.artifact_final_publish_ready_conditions.validate_outcome_success, undefined);
  assert.equal(resolved.status.final_publish_ready_conditions.validate_outcome_success, false);
});

test('publish status resolver ignores status final mismatch caused only by validation failure', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: false,
    status: {
      validate_ok: false
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });

  assert.equal(resolved.status.artifact_final_publish_ready, true);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
});

test('publish status resolver records consistency error when status final flag is stale', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /status\.final_publish_ready=true but artifact_final_publish_ready=false/);
});

test('publish status resolver treats FAILED_REPAIR_REVIEWABLE artifacts as reviewable but not publish-ready', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'NEEDS_FIX');
  assert.equal(resolved.status.review_gate_passed, true);
  assert.equal(resolved.status.publish_gate_passed, false);
  assert.equal(resolved.status.publish_ready, false);
  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.composition_mode, 'NEEDS_FIX');
  assert.equal(resolved.status.consistency_errors.length, 0);
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.publish_gate_passed, 'false');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.composition_mode, 'NEEDS_FIX');
});

test('publish status resolver does not promote FAILED_REPAIR_REVIEWABLE without canonical artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    writeEditor: false
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'FAILED');
  assert.equal(resolved.status.review_gate_passed, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /Missing reviewable repair artifact: content\/newsroom\/2026-05-08\/editor-draft\.json/);
});

test('publish status resolver does not promote FAILED_REPAIR_REVIEWABLE with invalid canonical artifacts', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date);
  writeText(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'), '{ invalid json');

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.generation_status, 'FAILED_REPAIR_REVIEWABLE');
  assert.equal(resolved.status.status, 'FAILED');
  assert.equal(resolved.status.review_gate_passed, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.match(resolved.status.consistency_errors.join('\n'), /Could not read content\/newsroom\/2026-05-08\/editor-draft\.json/);
});

test('validate-pr-body fails when consistency errors are present', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      fact_check_status: 'NEEDS_FIX',
      must_fix_count: 1
    },
    factCheck: {
      status: 'NEEDS_FIX',
      must_fix: [{ issue: 'unresolved must_fix' }]
    }
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });
  const result = validatePrBodyText(body);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /consistency_errors/);
});

test('validate-pr-body allows review PR when final publish is false without consistency errors', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure' });
  const filePath = path.join(root, '.tmp', 'newsroom-pr-body.md');
  writeText(filePath, body);

  const result = validatePrBodyFile(filePath, {
    root,
    date,
    validateOutcome: 'failure'
  });

  assert.equal(result.ok, true);
});

test('publish status resolver preserves reviewable-but-not-publish-ready reason diagnostics', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  const reasonSummary = [
    {
      code: 'publish_ready_primary_camera_stack_shortage',
      actual: articlePolicy.primaryCameraStack.minRequired,
      required: publishReadyCompositionPolicy.primaryCameraStackMinRequired
    }
  ];
  writeMinimalPublishArtifacts(root, date, {
    status: {
      selection_publish_ready: false,
      publish_gate_passed: false,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION'
    },
    shortlist: {
      publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary,
      composition_mode: 'FALLBACK_COMPOSITION',
      selection_composition_mode: 'FALLBACK_COMPOSITION'
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });

  assert.equal(resolved.status.selection_publish_ready, false);
  assert.equal(resolved.status.artifact_final_publish_ready, false);
  assert.equal(resolved.status.final_publish_ready, false);
  assert.equal(resolved.status.review_gate_passed, true);
  assert.equal(resolved.status.publish_gate_passed, false);
  assert.deepEqual(resolved.status.consistency_errors, []);
  assert.deepEqual(resolved.status.publish_gate_reason_codes, ['publish_ready_primary_camera_stack_shortage']);
  assert.deepEqual(resolved.status.publish_gate_reason_summary, reasonSummary);
  assert.equal(outputs.publish_gate_reason_codes, 'publish_ready_primary_camera_stack_shortage');
  assert.equal(
    outputs.publish_gate_reason_summary,
    `publish_ready_primary_camera_stack_shortage actual=${articlePolicy.primaryCameraStack.minRequired} required=${publishReadyCompositionPolicy.primaryCameraStackMinRequired}`
  );
  assert.match(body, /review_gate_passed: true/);
  assert.match(body, /publish_gate_passed: false/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /publish_ready_primary_camera_stack_shortage/);
  assert.match(body, new RegExp(`actual=${articlePolicy.primaryCameraStack.minRequired} required=${publishReadyCompositionPolicy.primaryCameraStackMinRequired}`));
});

test('publish status and PR body render direct driver and supporting publish gate reasons', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  const reasonSummary = [
    {
      code: 'publish_ready_direct_camera_or_driver_shortage',
      actual: 0,
      required: publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired
    },
    {
      code: 'publish_ready_supporting_main_over_limit',
      actual: publishReadyCompositionPolicy.supportingMainMaxAllowed + 1,
      required: publishReadyCompositionPolicy.supportingMainMaxAllowed
    }
  ];
  writeMinimalPublishArtifacts(root, date, {
    status: {
      selection_publish_ready: false,
      publish_gate_passed: false,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary
    },
    shortlist: {
      publish_ready: false,
      publish_gate_passed: false,
      review_gate_passed: true,
      publish_gate_reason_codes: reasonSummary.map(item => item.code),
      publish_gate_reason_summary: reasonSummary
    }
  });

  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'success' });
  const outputs = buildPublishStatusOutputs(resolved);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });

  assert.equal(
    outputs.publish_gate_reason_codes,
    'publish_ready_direct_camera_or_driver_shortage; publish_ready_supporting_main_over_limit'
  );
  assert.match(
    outputs.publish_gate_reason_summary,
    new RegExp(`publish_ready_direct_camera_or_driver_shortage actual=0 required=${publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired}`)
  );
  assert.match(
    outputs.publish_gate_reason_summary,
    new RegExp(`publish_ready_supporting_main_over_limit actual=${publishReadyCompositionPolicy.supportingMainMaxAllowed + 1} required=${publishReadyCompositionPolicy.supportingMainMaxAllowed}`)
  );
  assert.match(body, /publish_ready_direct_camera_or_driver_shortage/);
  assert.match(body, /publish_ready_supporting_main_over_limit/);
  assert.match(body, /publish_gate_reason_codes: publish_ready_direct_camera_or_driver_shortage; publish_ready_supporting_main_over_limit/);
  assert.match(body, new RegExp(`publish_ready_direct_camera_or_driver_shortage actual=0 required=${publishReadyCompositionPolicy.directAospCameraOrDriverMinRequired}`));
  assert.match(body, new RegExp(`publish_ready_supporting_main_over_limit actual=${publishReadyCompositionPolicy.supportingMainMaxAllowed + 1} required=${publishReadyCompositionPolicy.supportingMainMaxAllowed}`));
});

test('validate-pr-body accepts diagnostics-only wording and rejects misleading publish-ready wording', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeFailedRepairReviewableArtifacts(root, date, {
    status: {
      status: 'NEEDS_FIX',
      failure_kind: 'editorial_reviewable',
      failure_stage: 'editor repair attempt 1/2',
      failure_reason: 'section_count_drift',
      publish_ready: false,
      selection_publish_ready: false,
      final_publish_ready: false,
      publish_gate_passed: false,
      quality_status: 'NEEDS_FIX',
      quality_score: 79,
      public_newsletter_ready: true,
      review_publication_ready: true,
      homepage_visible_after_merge: true
    },
    generationStatus: {
      status: 'NEEDS_FIX',
      failure_kind: 'editorial_reviewable',
      failure_stage: 'editor repair attempt 1/2',
      failure_reason: 'section_count_drift',
      quality_status: 'NEEDS_FIX',
      quality_score: 79,
      public_newsletter_ready: true,
      review_publication_ready: true,
      homepage_visible_after_merge: true
    },
    repairFailure: {
      code: 'section_count_drift',
      message: 'section_count_drift: targeted repair shrank 3 sections to 2.'
    },
    quality: {
      status: 'NEEDS_FIX',
      score: 79
    }
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fallback-public-issue-diagnostics.json'), {
    status: 'FAILED',
    failure_stage: 'fallback_public_issue_builder',
    failure_reason: 'Fallback builder could not fill minimum main article count 3; only 1 article(s) available.',
    fallback_public_issue_failed: true,
    preserve_article_count: 1,
    final_article_count: 1,
    minimum_required_count: 3,
    demoted_articles: [],
    top_rejected_reasons: [{ reason: 'duplicate_url', count: 2 }],
    written_by: 'ensure-public-newsletter-artifacts'
  });
  const changedArtifacts = REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
    .map(file => `content/newsroom/${date}/${file}`)
    .concat(`content/newsroom/${date}/fallback-public-issue-diagnostics.json`);
  const body = buildNewsroomPrBody({
    root,
    date,
    validateOutcome: 'failure',
    changedArtifacts
  });

  assert.match(body, /diagnostics_only: true/);
  assert.match(body, /public_newsletter_ready: false/);
  assert.match(body, /homepage_visible_after_merge: false/);
  assert.match(body, /final_publish_ready: false/);
  assert.match(body, /section_count_drift/);
  assert.match(body, /Fallback builder could not fill minimum main article count 3/);
  const validation = validatePrBodyText(body, { date });
  assert.equal(validation.ok, true, validation.errors.join('\n'));

  const bodyWithNegativeHardFailure = `${body}\n- Quality hard failures: Main article has actionability_level=none and cannot be publish-ready.\n`;
  const negativeHardFailureValidation = validatePrBodyText(bodyWithNegativeHardFailure, { date });
  assert.equal(
    negativeHardFailureValidation.ok,
    true,
    negativeHardFailureValidation.errors.join('\n')
  );

  const allowedNegative = body.replace(
    'This PR is not publish-ready.',
    'publish-ready label must not be applied.'
  );
  const allowedNegativeValidation = validatePrBodyText(allowedNegative, { date });
  assert.equal(allowedNegativeValidation.ok, true, allowedNegativeValidation.errors.join('\n'));

  for (const misleading of [
    'This PR is publish-ready.',
    'Ready to publish.',
    'Final publish ready: true.',
    'public newsletter generated successfully.'
  ]) {
    const result = validatePrBodyText(body.replace('This PR is not publish-ready.', misleading), { date });
    assert.equal(result.ok, false, misleading);
    assert.match(result.errors.join('\n'), /misleading publish-ready wording/);
  }
});

test('validate-pr-body ignores policy definitions when detecting concrete publication state', () => {
  const reviewRoot = tempRoot();
  const reviewDate = '2026-05-09';
  writeEditorialReviewableArtifacts(reviewRoot, reviewDate);
  writePublicNewsletterArtifacts(reviewRoot, reviewDate);
  const reviewBody = buildNewsroomPrBody({
    root: reviewRoot,
    date: reviewDate,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${reviewDate}/${file}`)
      .concat([
        `newsletters/${reviewDate}/newsletter.md`,
        `newsletters/${reviewDate}/index.html`,
        'data/newsletters.json'
      ])
  });

  assert.match(reviewBody, /`diagnostics_only=true`/);
  assert.match(reviewBody, /review_publication_ready: true/);
  const reviewValidation = validatePrBodyText(reviewBody, { date: reviewDate });
  assert.equal(reviewValidation.ok, true, reviewValidation.errors.join('\n'));

  const diagnosticsRoot = tempRoot();
  const diagnosticsDate = '2026-05-08';
  writeFailedRepairReviewableArtifacts(diagnosticsRoot, diagnosticsDate);
  const diagnosticsBody = buildNewsroomPrBody({
    root: diagnosticsRoot,
    date: diagnosticsDate,
    validateOutcome: 'failure',
    changedArtifacts: REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS
      .map(file => `content/newsroom/${diagnosticsDate}/${file}`)
  });

  assert.match(diagnosticsBody, /`review_publication_ready=true`/);
  assert.match(diagnosticsBody, /diagnostics_only: true/);
  const diagnosticsValidation = validatePrBodyText(diagnosticsBody, { date: diagnosticsDate });
  assert.equal(diagnosticsValidation.ok, true, diagnosticsValidation.errors.join('\n'));
});

test('newsroom PR body includes editor-approved publication policy in Korean', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'failure' });
  const result = validatePrBodyText(body);

  assert.equal(result.ok, true);
  assert.equal(
    extractMarkdownSection(body, '편집자 승인 발행 정책').trimEnd(),
    renderEditorPublicationPolicyMarkdown().trimEnd()
  );
});

test('newsroom PR body includes article structure contract summary when editor draft exists', () => {
  const root = tempRoot();
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
    title: `Camera HAL SW Newsletter - ${date}`,
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
  const section = extractMarkdownSection(body, 'Article Structure Contract');

  assert.match(section, /\| # \| Article \| 5-section \| Fact boundary \| HAL impact axis \| Actionability \| Limitations \|/);
  assert.match(section, /CameraX release/);
  assert.match(section, /pass/);
});

test('publish status output renders final and artifact readiness fields', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true
  });
  const resolved = resolvePublishStatus({ root, date, validateOutcome: 'failure' });
  const outputs = buildPublishStatusOutputs(resolved);

  assert.equal(outputs.artifact_final_publish_ready, 'true');
  assert.equal(outputs.final_publish_ready, 'false');
  assert.equal(outputs.has_ai_publish_ready, 'false');
  assert.equal(outputs.selection_publish_ready, 'true');
  assert.equal(outputs.publish_gate_passed, 'true');
  assert.equal(outputs.review_gate_passed, 'true');
  assert.equal(outputs.validate_outcome, 'failure');
  assert.equal(outputs.quality_status, 'PASS');
  assert.equal(outputs.fact_check_status, 'PASS');
  assert.equal(outputs.must_fix_count, '0');
  assert.equal(outputs.source_gap_count, '0');
  assert.equal(outputs.stale_claim_status, 'PASS');
  assert.equal(outputs.stale_claim_hard_failure_count, '0');
  assert.equal(outputs.consistency_error_count, '0');
  assert.equal(outputs.consistency_errors, 'none');
  assert.equal(outputs.composition_mode, 'NORMAL');
  assert.equal(outputs.selection_composition_mode, 'NORMAL');
});

test('publication quality annotation reports quality and fact-check issues without failing', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writePublicNewsletterArtifacts(root, date);
  writeJson(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), {
    status: 'NEEDS_FIX',
    score: qualityGatePolicy.threshold - 5,
    threshold: qualityGatePolicy.threshold,
    deductions: [{ reason: 'weak camera relevance' }]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'NEEDS_FIX',
    must_fix: [{ issue: 'unresolved source claim' }],
    source_gaps: [{ issue: 'missing article-level evidence' }],
    source_gap_count: 1
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'generation-status.json'), {
    final_publish_ready: false,
    publish_gate_passed: false,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    publish_gate_passed: false
  });

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', date], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.match(stdout, /::error file=content\/newsroom\/2026-05-08\/quality-report\.json,title=Quality status not PASS::/);
  assert.match(stdout, /::warning file=content\/newsroom\/2026-05-08\/quality-report\.json,title=Quality score below threshold::/);
  assert.match(stdout, /::error file=content\/newsroom\/2026-05-08\/fact-check-report\.json,title=Fact-check must_fix items remain::/);
  assert.match(stdout, /::error file=content\/newsroom\/2026-05-08\/generation-status\.json,title=AI publish readiness is false::/);
  assert.match(stdout, /Publication quality annotation completed/);
});

test('publication quality annotation fails only for CLI or system errors', () => {
  const root = tempRoot();
  const date = '2026-05-08';
  writePublicNewsletterArtifacts(root, date);
  writeText(path.join(root, 'content', 'newsroom', date, 'quality-report.json'), '{ invalid json');

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', date], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /Invalid JSON in content\/newsroom\/2026-05-08\/quality-report\.json/);
});

test('publication quality annotation latest mode targets latest only without changed public issue dates', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, { dates: [], all: false, latest: true, targetDates: new Set() });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-08']);
});

test('publication quality annotation changed public issue date wins over latest fallback permission', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, {
    dates: [],
    all: false,
    latest: true,
    targetDates: new Set(['2026-05-07'])
  });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-07']);
});

test('publication quality annotation rejects missing detected target dates even with latest fallback permission', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  assert.throws(
    () => resolveTargetItems(root, {
      dates: [],
      all: false,
      latest: true,
      targetDates: new Set(['2026-05-07', '2026-05-09', '2026-05-10'])
    }),
    error => {
      assert.match(error.message, /No data\/newsletters\.json entry found for detected target date\(s\)/);
      assert.match(error.message, /2026-05-09/);
      assert.match(error.message, /2026-05-10/);
      assert.doesNotMatch(error.message, /2026-05-07/);
      return true;
    }
  );
});

test('publication quality annotation fails without explicit target or changed public issue date', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  assert.throws(
    () => resolveTargetItems(root, { dates: [], all: false, latest: false, targetDates: new Set() }),
    /No target public issue date detected/
  );
});

test('publication quality annotation CLI fails without target fallback permission', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain([], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /No target public issue date detected/);
});

test('publication quality annotation rejects conflicting explicit targets', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-08' }
  ]);

  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', '2026-05-08', '--latest'], {
    root,
    stdout: { write: () => {} },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.match(stderr, /--latest cannot be combined with --date/);
});

test('publication quality annotation all mode includes historical public issues', () => {
  const root = tempRoot();
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, { dates: [], all: true });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-07', '2026-05-08']);
});

test('publication quality annotation help documents target policy', () => {
  let stdout = '';
  const code = annotatePublicationQualityMain(['--help'], {
    root: tempRoot(),
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: () => {} }
  });

  assert.equal(code, 0);
  assert.match(stdout, /Usage: node scripts\/annotate-publication-quality\.js \[--date YYYY-MM-DD\] \[--all\] \[--latest\]/);
  assert.match(stdout, /--date YYYY-MM-DD inspects only that public issue/);
  assert.match(stdout, /--all inspects every historical public issue/);
  assert.match(stdout, /Changed public issue dates inspect matching public issue dates, even when --latest is present/);
  assert.match(stdout, /--latest permits fallback to the latest public issue only when no changed public issue date is detected/);
  assert.match(stdout, /no explicit target and no changed public issue date, the command fails/);
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

  for (const heading of ['생성 상태', '기사 구성 요약', '최종 후보 선택 상태', '편집자 조치 가이드', '생성 산출물']) {
    assert.match(body, new RegExp(`^## ${heading}$`, 'm'));
  }
  for (const heading of ['Generation Status', 'Composition Summary', 'Editor Action Guidance', 'Generated Artifacts']) {
    assert.doesNotMatch(body, new RegExp(`^## ${heading}$`, 'm'));
  }
});

test('final newsroom workflow separates review PR success from publish-ready gate', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', '03-newsroom-final-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const validatePolicyStep = workflowStep(workflow, 'Validate newsletter policy');
  const checkPolicyDocsStep = workflowStep(workflow, 'Check policy docs');
  const doctorStep = workflowStep(workflow, 'Doctor runtime config');
  const preflightStep = workflowStep(workflow, 'Run unit and regression tests');
  const generateStep = workflowStep(workflow, 'Generate newsletter with approved candidate artifact');
  const ensurePublicStep = workflowStep(workflow, 'Ensure public newsletter artifacts');
  const resolveMetaStep = workflowStep(workflow, 'Resolve newsletter metadata');
  const validateGeneratedSiteStep = workflowStep(workflow, 'Validate generated site');
  const resolveFinalStatusStep = workflowStep(workflow, 'Resolve final publish status');
  const sourceEffectivenessStep = workflowStep(workflow, 'Generate source effectiveness report');
  const sourceQualityDiagnosisStep = workflowStep(workflow, 'Generate source quality diagnosis');
  const evidencePackStep = workflowStep(workflow, 'Generate evidence pack summary');
  const halSignalQualityStep = workflowStep(workflow, 'Generate HAL signal quality report');
  const imageAuditStep = workflowStep(workflow, 'Audit newsletter image lineage');
  const snapshotStep = workflowStep(workflow, 'Snapshot newsroom debug artifacts');
  const preparePrBodyStep = workflowStep(workflow, 'Prepare pull request body');
  const ensureLabelsStep = workflowStep(workflow, 'Ensure labels');
  const createPrStep = workflowStep(workflow, 'Create final newsletter pull request');
  const addLabelsStepIndex = workflow.indexOf('- name: Add pull request labels');

  assert.notEqual(addLabelsStepIndex, -1);
  assertTextInOrder(workflow, [
    '- name: Apply manual LLM overrides',
    '- name: Doctor runtime config',
    '- name: Validate newsletter policy',
    '- name: Check policy docs',
    '- name: Run unit and regression tests'
  ]);
  assertTextInOrder(workflow, [
    '- name: Generate newsletter with approved candidate artifact',
    '- name: Ensure public newsletter artifacts',
    '- name: Resolve newsletter metadata',
    '- name: Resolve final publish status',
    '- name: Prepare pull request body',
    '- name: Create final newsletter pull request'
  ]);
  assertTextInOrder(workflow, [
    '- name: Generate source effectiveness report',
    '- name: Generate source quality diagnosis',
    '- name: Generate evidence pack summary',
    '- name: Generate HAL signal quality report',
    '- name: Audit newsletter image lineage',
    '- name: Snapshot newsroom debug artifacts'
  ]);
  assert.match(workflow, /llm_provider:/);
  assert.match(workflow, /llm_model:/);
  assert.match(workflow, /llm_fallback_models:/);
  assert.match(workflow, /allow_pro:\s*[\s\S]*?default: "false"/);
  assert.match(workflow, /llm_model:\s*[\s\S]*?default: ""/);
  assert.match(workflow, /LLM_PROVIDER=\$\{INPUT_LLM_PROVIDER\}/);
  assert.match(workflow, /LLM_MODEL=\$\{INPUT_LLM_MODEL\}/);
  assert.match(workflow, /LLM_FALLBACK_MODELS=\$\{INPUT_LLM_FALLBACK_MODELS\}/);
  assert.match(workflow, /Workflow inputs must be single-line values\./);
  assert.match(workflow, /NEWSROOM_ALLOW_PRO_ON_MANUAL: \$\{\{ github\.event\.inputs\.allow_pro \|\| 'false' \}\}/);
  assert.match(workflow, /NEWSROOM_REPORTER_MODEL: \$\{\{ vars\.NEWSROOM_REPORTER_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_EDITOR_MODEL: \$\{\{ vars\.NEWSROOM_EDITOR_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_FACTCHECK_MODEL: \$\{\{ vars\.NEWSROOM_FACTCHECK_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_REPAIR_MODEL: \$\{\{ vars\.NEWSROOM_REPAIR_MODEL \|\| '' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MODE: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MODE \|\| 'extract_only' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_CANDIDATE \|\| '8' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_LINKS_PER_RUN \|\| '40' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_TIMEOUT_MS \|\| '5000' \}\}/);
  assert.match(workflow, /NEWSROOM_LINKED_EVIDENCE_MAX_BYTES: \$\{\{ vars\.NEWSROOM_LINKED_EVIDENCE_MAX_BYTES \|\| '200000' \}\}/);
  assert.doesNotMatch(workflow, /LLM_FALLBACK_MODELS=gemini-2\.5-flash-lite,gemini-2\.5-pro/);
  assert.doesNotMatch(workflow, /\[ "\$\{INPUT_LLM_PROVIDER\}" = "gemini" \]/);
  assert.match(workflow, /INTERNAL_LLM_API_KEY: \$\{\{ secrets\.INTERNAL_LLM_API_KEY \}\}/);
  assert.match(workflow, /INTERNAL_LLM_ENDPOINT: \$\{\{ vars\.INTERNAL_LLM_ENDPOINT \}\}/);
  assert.doesNotMatch(doctorStep, /--no-llm-credentials/);
  assert.doesNotMatch(workflow, /vars\.LLM_PROVIDER/);
  assert.doesNotMatch(workflow, /vars\.LLM_MODEL/);
  assert.doesNotMatch(workflow, /vars\.LLM_FALLBACK_MODELS/);
  assert.doesNotMatch(workflow, /GEMINI_MODEL: \$\{\{ vars\.GEMINI_MODEL/);
  assert.doesNotMatch(workflow, /GEMINI_FALLBACK_MODELS: \$\{\{ vars\.GEMINI_FALLBACK_MODELS/);
  assert.match(validatePolicyStep, /^\s*run: npm run validate:policy$/m);
  assert.doesNotMatch(validatePolicyStep, /continue-on-error:\s*true/);
  assert.match(checkPolicyDocsStep, /^\s*run: npm run check:policy-docs$/m);
  assert.doesNotMatch(checkPolicyDocsStep, /continue-on-error:\s*true/);
  assert.match(preflightStep, /^\s*run: npm run test$/m);
  assert.doesNotMatch(preflightStep, /continue-on-error:\s*true/);
  assert.match(workflow, /uses: actions\/cache\/restore@v4/);
  assert.match(workflow, /key: news-summary-\$\{\{ runner\.os \}\}-/);
  assert.match(workflow, /uses: actions\/cache\/save@v4/);
  assert.match(workflow, /if: always\(\) && steps\.summary-cache\.outputs\.exists == 'true'/);
  const workflowDocs = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'newsroom-workflow.md'), 'utf8');
  assert.doesNotMatch(workflowDocs, /^LLM_MODEL=$/m);
  assert.match(generateStep, /continue-on-error:\s*true/);
  assert.match(ensurePublicStep, /node scripts\/ensure-public-newsletter-artifacts\.js/);
  assert.match(resolveMetaStep, /node scripts\/resolve-reviewable-artifacts\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(validateGeneratedSiteStep, /if: steps\.meta\.outputs\.public_newsletter_ready == 'true'/);
  assert.match(workflow, /newsletter/);
  assert.match(workflow, /aosp-camera/);
  assert.match(workflow, /editor-review/);
  assert.match(workflow, /needs-fix/);
  assert.match(workflow, /fallback-composition/);
  assert.match(workflow, /thin-week/);
  assert.match(workflow, /publish-ready/);
  assert.match(workflow, /review-only/);
  assert.match(workflow, /review-only-publication/);
  assert.match(workflow, /diagnostics-only/);
  assert.match(workflow, /failed-repair-reviewable/);
  assert.match(workflow, /const stateLabels = \[/);
  assert.match(workflow, /'review-only'/);
  assert.match(workflow, /'review-only-publication'/);
  assert.match(workflow, /'diagnostics-only'/);
  assert.match(workflow, /'failed-repair-reviewable'/);
  assert.match(workflow, /github\.rest\.issues\.removeLabel/);
  assert.match(workflow, /- name: Resolve final publish status/);
  assert.match(workflow, /id: final-publish-status/);
  assert.match(workflow, /node scripts\/write-publish-status-output\.js >> "\$GITHUB_OUTPUT"/);
  assert.match(resolveFinalStatusStep, /if: steps\.meta\.outputs\.public_newsletter_ready == 'true'/);
  assert.match(resolveFinalStatusStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  assert.match(sourceEffectivenessStep, /if: always\(\) && steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(sourceEffectivenessStep, /continue-on-error:\s*true/);
  assert.match(sourceQualityDiagnosisStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.match(sourceQualityDiagnosisStep, /continue-on-error:\s*true/);
  assert.match(sourceQualityDiagnosisStep, /npm run report:source-quality-diagnosis -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(evidencePackStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.match(evidencePackStep, /continue-on-error:\s*true/);
  assert.match(evidencePackStep, /npm run report:evidence-pack -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(halSignalQualityStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.match(halSignalQualityStep, /continue-on-error:\s*true/);
  assert.match(halSignalQualityStep, /npm run report:hal-signal-quality -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(imageAuditStep, /if: always\(\) && steps\.meta\.outputs\.date != ''/);
  assert.doesNotMatch(imageAuditStep, /continue-on-error:\s*true/);
  assert.match(imageAuditStep, /steps\.meta\.outputs\.public_newsletter_ready/);
  assert.match(
    imageAuditStep,
    /npm run newsroom:audit-images -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}" --fail-on-publish-blocking/
  );
  assert.match(
    imageAuditStep,
    /npm run newsroom:audit-images -- --date "\$\{\{ steps\.meta\.outputs\.date \}\}"\s*$/m
  );
  assert.match(snapshotStep, /copy_tree_if_present "content\/source-events\/\$\{DATE\}"/);
  assert.match(snapshotStep, /copy_tree_if_present "content\/newsroom\/\$\{DATE\}"/);
  assert.match(snapshotStep, /copy_tree_if_present "data\/source-snapshots"/);
  assert.match(snapshotStep, /copy_if_present "newsletters\/\$\{DATE\}\/newsletter\.md"/);
  assert.match(snapshotStep, /copy_if_present "newsletters\/\$\{DATE\}\/index\.html"/);
  assert.match(snapshotStep, /copy_if_present "data\/homepage-headline\.json"/);
  assert.match(snapshotStep, /copy_if_present "data\/article-exposure-history\.json"/);
  assert.match(preparePrBodyStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(ensureLabelsStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(createPrStep, /if: steps\.meta\.outputs\.review_pr_ready == 'true'/);
  assert.match(createPrStep, /base: main/);
  assert.match(preparePrBodyStep, /VALIDATE_OUTCOME: \$\{\{ steps\.validate\.outcome \|\| 'skipped' \}\}/);
  assert.match(preparePrBodyStep, /HOMEPAGE_HEADLINE_FIGMA_URL: https:\/\/www\.figma\.com\/design\/EWJMa8vjfZLjdn9a7s3Kzs/);
  assert.match(workflow, /node scripts\/build-newsroom-pr-body\.js > \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /node scripts\/validate-pr-body\.js \.tmp\/newsroom-pr-body\.md --date "\$\{\{ steps\.meta\.outputs\.date \}\}"/);
  assert.match(workflow, /cat \.tmp\/newsroom-pr-body\.md/);
  assert.match(workflow, /const hasAiPublishReady = '\$\{\{ steps\.final-publish-status\.outputs\.has_ai_publish_ready \}\}' === 'true';/);
  assert.match(workflow, /const diagnosticsOnly = '\$\{\{ steps\.meta\.outputs\.diagnostics_only \}\}' === 'true';/);
  assert.match(workflow, /const reviewPublicationReady = '\$\{\{ steps\.meta\.outputs\.review_publication_ready \}\}' === 'true';/);
  assert.match(workflow, /const compositionMode = '\$\{\{ steps\.final-publish-status\.outputs\.composition_mode \}\}';/);
  assert.doesNotMatch(workflow, /steps\.meta\.outputs\.has_publish_candidate/);
  assert.doesNotMatch(workflow, /if: steps\.meta\.outputs\.has_reviewable_artifacts == 'true'/);
  assert.doesNotMatch(workflow.slice(addLabelsStepIndex), /steps\.generation-status\.outputs\.final_publish_ready/);
  assert.doesNotMatch(workflow.slice(addLabelsStepIndex), /validationPassed/);
  assert.match(workflow, /compositionMode === 'FALLBACK_COMPOSITION' && !hasAiPublishReady/);
  assert.match(workflow, /compositionMode === 'THIN_WEEK_REVIEW'/);
  assert.match(workflow, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'review-only-publication'\)/);
  assert.match(workflow, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'diagnostics-only'\)/);
  assert.doesNotMatch(workflow, /labels\.push\([^)]*review-only-publication[^)]*diagnostics-only/);
  assert.match(workflow, /Fail if no reviewable PR can be created/);
  assert.match(workflow, /steps\.meta\.outputs\.review_pr_ready != 'true'/);
  assert.doesNotMatch(workflow, /final_publish_ready != 'true'/);
  assert.doesNotMatch(
    workflow,
    new RegExp(`fromJSON\\(steps\\.generation-status\\.outputs\\.final_selected_article_count_for_gate\\) < ${articlePolicy.mainArticleCount.min}`)
  );
});

test('final newsroom workflow labels review publication and diagnostics-only mutually exclusively', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', '03-newsroom-final-pr.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const labelStep = workflowStep(workflow, 'Add pull request labels');
  const reviewPublicationStart = labelStep.indexOf('} else if (reviewPublicationReady) {');
  const diagnosticsStart = labelStep.indexOf('} else if (diagnosticsOnly) {');
  const fallbackStart = labelStep.indexOf('} else {', diagnosticsStart);

  assert.notEqual(reviewPublicationStart, -1);
  assert.notEqual(diagnosticsStart, -1);
  assert.notEqual(fallbackStart, -1);
  assert.match(labelStep, /const stateLabels = \[[^\n]*'review-only-publication'[^\n]*'diagnostics-only'[^\n]*\]/);

  const reviewPublicationBranch = labelStep.slice(reviewPublicationStart, diagnosticsStart);
  const diagnosticsBranch = labelStep.slice(diagnosticsStart, fallbackStart);

  assert.match(reviewPublicationBranch, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'review-only-publication'\)/);
  assert.doesNotMatch(reviewPublicationBranch, /diagnostics-only/);
  assert.match(diagnosticsBranch, /labels\.push\('needs-fix', 'editor-review', 'review-only', 'diagnostics-only'\)/);
  assert.doesNotMatch(diagnosticsBranch, /review-only-publication/);
  assert.match(labelStep, /compositionMode === 'FALLBACK_COMPOSITION' && !hasAiPublishReady/);
});

test('split newsroom workflows preserve #88 stage boundaries', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsroom-manual-source-collect-pr.yml'), 'utf8');
  const stage2 = fs.readFileSync(path.join(workflowDir, '02-newsroom-gemini-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, '03-newsroom-final-pr.yml'), 'utf8');
  const stage2RunStep = workflowStep(stage2, 'Run disabled pass-through or Gemini source discovery');
  const stage2PrepareBodyStep = workflowStep(stage2, 'Prepare source discovery pull request body');
  const stage2CreatePrStep = workflowStep(stage2, 'Create source discovery pull request');
  const stage2UploadStep = workflowStep(stage2, 'Upload source discovery debug artifacts');
  const rawPrBodyBuilder = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'build-raw-candidate-pr-body.js'),
    'utf8'
  );

  assert.match(stage1, /^name: Newsroom 01 - Manual Source Collection PR/m);
  assert.match(stage2, /^name: Newsroom 02 - Gemini Source Discovery PR/m);
  assert.match(stage3, /^name: Newsroom 03 - Gemini Final Newsletter PR/m);

  assert.match(stage1, /workflow_dispatch:/);
  assert.match(stage1, /collection_intent_path:/);
  assert.match(stage1, /NEWSROOM_COLLECTION_INTENT_PATH: \$\{\{ github\.event\.inputs\.collection_intent_path \}\}/);
  assert.match(stage1, /^\s*schedule:/m);
  assert.match(stage1, /cron: "0 0 \* \* \*"/);
  assert.match(stage1, /run: npm run doctor:config -- --no-llm-credentials/);
  assert.match(stage1, /run: npm run collect/);
  assert.doesNotMatch(stage1, /npm run generate/);
  assert.doesNotMatch(stage1, /GEMINI_API_KEY/);
  assert.doesNotMatch(stage1, /INTERNAL_LLM_API_KEY/);
  assert.match(stage1, /branch=newsroom-raw\/\$\{DATE\}/);
  assert.match(stage1, /manual-candidates\.json/);
  assert.match(stage1, /collection-intent\.json/);
  assert.match(stage1, /raw-candidate-manifest\.json/);
  assert.match(stage1, /content\/source-events\/\$\{\{ steps\.raw-meta\.outputs\.date \}\}\/source-change-events\.json/);
  assert.match(stage1, /content\/source-events\/\$\{\{ steps\.raw-meta\.outputs\.date \}\}\/source-change-events\.md/);
  assert.match(stage1, /data\/source-snapshots\/\*\*/);

  assert.match(stage2, /NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY/);
  assert.doesNotMatch(stage2, /Preflight LLM credentials for enabled source discovery/);
  assert.doesNotMatch(stage2, /--preflight-only/);
  assert.doesNotMatch(stage2, /npm run doctor:config/);
  assert.ok(stage2.indexOf('- name: Run disabled pass-through or Gemini source discovery') <
    stage2.indexOf('- name: Prepare source discovery pull request body'));
  assert.ok(stage2.indexOf('- name: Prepare source discovery pull request body') <
    stage2.indexOf('- name: Upload source discovery debug artifacts'));
  assert.ok(stage2.indexOf('- name: Upload source discovery debug artifacts') <
    stage2.indexOf('- name: Create source discovery pull request'));
  assert.doesNotMatch(stage2CreatePrStep, /if:\s*always\(\)/);
  assert.match(stage2PrepareBodyStep, /gemini-source-discovery-report\.md/);
  assert.match(stage2UploadStep, /if:\s*always\(\)/);
  assert.match(stage2UploadStep, /uses:\s*actions\/upload-artifact@v4/);
  assert.match(stage2UploadStep, /if-no-files-found:\s*warn/);
  assert.match(stage2UploadStep, /merged-candidate-manifest\.json/);
  assert.match(stage2UploadStep, /gemini-source-discovery-report\.md/);
  assert.match(stage2UploadStep, /seed-candidates\.json/);
  assert.match(stage2UploadStep, /seed-evidence-pack\.json/);
  assert.match(stage2UploadStep, /seed-fetch-report\.json/);
  assert.match(stage2UploadStep, /seed-merge-report\.md/);
  assert.match(stage2, /node scripts\/gemini-source-discovery-boundary\.js --date/);
  assert.doesNotMatch(stage2RunStep, /--preflight-only/);
  assert.match(stage2, /gemini-source-discovery-report\.md/);
  assert.match(stage2, /gemini-source-proposals\.json/);
  assert.match(stage2, /gemini-source-proposal-validation-report\.json/);
  assert.match(stage2, /gemini-usage-report\.json/);
  assert.match(stage2, /source-quality-report\.json/);
  assert.match(stage2, /source-clusters\.json/);
  assert.match(stage2, /evidence-validation-report\.json/);
  assert.match(stage2UploadStep, /source-discovery-feedback-report\.json/);
  assert.match(stage2UploadStep, /source-discovery-feedback-report\.md/);
  assert.match(stage2, /gemini-candidates\.json/);
  assert.match(stage2, /merged-candidates\.json/);
  assert.match(stage2, /merged-candidate-manifest\.json/);

  assert.match(stage3, /NEWSROOM_CANDIDATE_INPUT_MODE: artifact/);
  assert.match(stage3, /NEWSROOM_CANDIDATE_INPUT_PATH: \$\{\{ github\.event\.inputs\.candidate_input_path \}\}/);
  assert.match(stage3, /manual-candidates\.json or merged-candidates\.json/);
  assert.match(stage3, /run: npm run generate/);
  assert.doesNotMatch(stage3, /--no-llm-credentials/);
  assert.doesNotMatch(stage3, /npm run collect/);
  assert.match(stage3, /branch: newsroom-final\/\$\{\{ steps\.meta\.outputs\.date \}\}/);
  assert.match(stage3, /base: main/);
  assert.match(stage3, /manual-candidates\.json/);
  assert.match(stage3, /merged-candidates\.json/);
  assert.match(stage3, /collection-intent\.json/);
  assert.match(stage3, /seed-candidates\.json/);
  assert.match(stage3, /seed-evidence-pack\.json/);
  assert.doesNotMatch(rawPrBodyBuilder, /source_gap_risk_count/);
  assert.match(rawPrBodyBuilder, /Priority Override \/ Legacy Compatibility/);
});

test('schedule cutover leaves only the RAW workflow on the daily newsroom schedule', () => {
  const workflowDir = path.join(__dirname, '..', '..', '.github', 'workflows');
  const legacyWeeklyFile = ['01', 'weekly', 'newsroom', 'pr.yml'].join('-');
  const legacyWeeklyPath = path.join(workflowDir, legacyWeeklyFile);
  const stage1 = fs.readFileSync(path.join(workflowDir, '01-newsroom-manual-source-collect-pr.yml'), 'utf8');
  const stage2 = fs.readFileSync(path.join(workflowDir, '02-newsroom-gemini-source-discovery-pr.yml'), 'utf8');
  const stage3 = fs.readFileSync(path.join(workflowDir, '03-newsroom-final-pr.yml'), 'utf8');
  const scheduledWorkflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith('.yml'))
    .filter((file) => fs.readFileSync(path.join(workflowDir, file), 'utf8').includes('cron: "0 0 * * *"'));

  assert.equal(fs.existsSync(legacyWeeklyPath), false);
  assert.deepEqual(scheduledWorkflowFiles, ['01-newsroom-manual-source-collect-pr.yml']);
  assert.match(stage1, /^\s*schedule:/m);
  assert.match(stage1, /cron: "0 0 \* \* \*"/);
  assert.doesNotMatch(stage2, /^\s*schedule:/m);
  assert.doesNotMatch(stage3, /^\s*schedule:/m);
  assert.doesNotMatch(stage3, /npm run collect/);
});

test('generation path guards public artifacts for editorial reviewable failures', () => {
  const generatorPath = path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js');
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const renderedMarkdownIndex = generator.indexOf('const newsletterMarkdown = buildMarkdown(editor);');
  const structuralGuardIndex = generator.indexOf('assertTerminalPublicationContracts({', renderedMarkdownIndex);
  const generationStatusIndex = generator.indexOf("let generationStatus = 'PASS';");
  const factCheckNeedsFixIndex = generator.indexOf("factCheck.status === 'NEEDS_FIX' && mustFixCount > 0", generationStatusIndex);
  const qualityNeedsFixIndex = generator.indexOf("qualityReport.status !== 'PASS'", generationStatusIndex);
  const editorialReviewableIndex = generator.indexOf(
    'const editorialReviewable = isEditorialReviewableStatus(generationStatus);',
    qualityNeedsFixIndex
  );
  const shouldWriteIndex = generator.indexOf('const shouldWritePublicArtifacts = !editorialReviewable;', editorialReviewableIndex);
  const writeGuardIndex = generator.indexOf('if (shouldWritePublicArtifacts) {', shouldWriteIndex);
  const markdownWriteIndex = generator.indexOf("fs.writeFileSync(newsletterMd, newsletterMarkdown, 'utf8');", writeGuardIndex);
  const htmlWriteIndex = generator.indexOf("fs.writeFileSync(newsletterHtml, newsletterHtmlContent, 'utf8');", writeGuardIndex);
  const dataWriteIndex = generator.indexOf('updateNewsletterData(date, editor);', writeGuardIndex);
  const validateResultIndex = generator.indexOf('const validateResult = editorialReviewable', dataWriteIndex);
  const finalPublishReadyIndex = generator.indexOf('const finalPublishReady =', validateResultIndex);

  assert.notEqual(generationStatusIndex, -1);
  assert.notEqual(renderedMarkdownIndex, -1);
  assert.notEqual(structuralGuardIndex, -1);
  assert.notEqual(factCheckNeedsFixIndex, -1);
  assert.notEqual(qualityNeedsFixIndex, -1);
  assert.notEqual(editorialReviewableIndex, -1);
  assert.notEqual(shouldWriteIndex, -1);
  assert.notEqual(writeGuardIndex, -1);
  assert.notEqual(markdownWriteIndex, -1);
  assert.notEqual(htmlWriteIndex, -1);
  assert.notEqual(dataWriteIndex, -1);
  assert.notEqual(validateResultIndex, -1);
  assert.notEqual(finalPublishReadyIndex, -1);
  assert.ok(renderedMarkdownIndex < structuralGuardIndex);
  assert.ok(structuralGuardIndex < generationStatusIndex);
  assert.ok(generationStatusIndex < factCheckNeedsFixIndex);
  assert.ok(factCheckNeedsFixIndex < qualityNeedsFixIndex);
  assert.ok(qualityNeedsFixIndex < editorialReviewableIndex);
  assert.ok(editorialReviewableIndex < shouldWriteIndex);
  assert.ok(shouldWriteIndex < writeGuardIndex);
  assert.ok(writeGuardIndex < markdownWriteIndex);
  assert.ok(markdownWriteIndex < htmlWriteIndex);
  assert.ok(htmlWriteIndex < dataWriteIndex);
  assert.ok(dataWriteIndex < validateResultIndex);
  assert.ok(validateResultIndex < finalPublishReadyIndex);
});

test('generation path passes runtime selection window policy into shortlist report', () => {
  const generatorPath = path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js');
  const generator = fs.readFileSync(generatorPath, 'utf8');
  const runtimeConfigIndex = generator.indexOf('const runtimeConfig = readRuntimeConfig(process.env);');
  const shortlistIndex = generator.indexOf('let shortlistReport = buildShortlistReport(date, candidates, {');
  const selectionWindowPolicyIndex = generator.indexOf(
    'selectionWindowPolicy: runtimeConfig.selectionWindowPolicy',
    shortlistIndex
  );

  assert.notEqual(runtimeConfigIndex, -1);
  assert.notEqual(shortlistIndex, -1);
  assert.notEqual(selectionWindowPolicyIndex, -1);
  assert.ok(runtimeConfigIndex < shortlistIndex);
  assert.ok(shortlistIndex < selectionWindowPolicyIndex);
});

test('validate-site uses shared rendered issue structural validator', () => {
  const validateSitePath = path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'validate-site.js');
  const validateSite = fs.readFileSync(validateSitePath, 'utf8');

  assert.match(validateSite, /validateRenderedIssueStructure/);
  assert.match(validateSite, /rendered-issue-structure/);
});

test('site validation workflow keeps structural checks blocking and quality annotations non-blocking', () => {
  const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', 'validate-site.yml');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const structuralStep = workflowStep(workflow, 'Validate structural publication artifacts');
  const annotationStep = workflowStep(workflow, 'Annotate publication quality and fact-check status');

  assert.match(workflow, /^name: Validate Site and Images$/m);
  assert.match(workflow, /^  push:\n    branches: \["main"\]$/m);
  assert.match(workflow, /^  pull_request:\n    branches: \["main"\]$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assertTextInOrder(workflow, [
    '- name: Run unit and regression tests',
    '- name: Validate structural publication artifacts',
    '- name: Annotate publication quality and fact-check status'
  ]);
  assert.match(workflowStep(workflow, 'Run unit and regression tests'), /^\s*run: npm run test$/m);
  assertTextInOrder(structuralStep, [
    'npm run check:encoding',
    'npm run validate:policy'
  ]);
  assert.match(structuralStep, /npm run check:encoding/);
  assert.match(structuralStep, /npm run validate:policy/);
  assert.match(structuralStep, /npm run check:policy-docs/);
  assert.match(structuralStep, /npm run validate:config/);
  assert.match(structuralStep, /npm run validate:site/);
  assert.match(structuralStep, /npm run validate:images/);
  assert.match(structuralStep, /npm run validate:localization/);
  assert.doesNotMatch(structuralStep, /npm run validate:quality/);
  assert.doesNotMatch(structuralStep, /^\s*npm run validate$/m);
  assert.doesNotMatch(structuralStep, /continue-on-error:\s*true/);
  assert.match(annotationStep, /if: always\(\)/);
  assert.match(annotationStep, /continue-on-error:\s*true/);
  assert.match(annotationStep, /run: node scripts\/annotate-publication-quality\.js --latest/);
  const annotationCommands = workflowRunCommands(workflow, 'scripts/annotate-publication-quality.js');
  assert.ok(annotationCommands.length > 0, 'annotate-publication-quality.js must be invoked');
  for (const command of annotationCommands) {
    assert.match(command, /\bnode\s+scripts\/annotate-publication-quality\.js\b[^\n]*\s--latest\b/);
  }
});
