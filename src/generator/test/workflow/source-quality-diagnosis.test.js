const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsroomPrBody
} = require('../../publish/build-newsroom-pr-body');
const {
  buildSourceQualityDiagnosisReport,
  renderSourceQualityDiagnosisMarkdown,
  writeSourceQualityDiagnosisArtifacts
} = require('../../render/source-quality-diagnosis');
const {
  tempRoot,
  writeJson
} = require('../../../core/test/helpers/fs');

const date = '2026-05-20';

function cameraCandidate(overrides = {}) {
  return {
    source_id: 'android-developers-jetpack-release',
    source_name: 'Android Developers CameraX',
    sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#camera-1.4.2',
    title: 'CameraX 1.4.2 release',
    published_date: '2026-05-20',
    finalSelectionEligibility: 'main',
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    reference_only: false,
    relevance_bucket: 'direct_aosp_camera',
    ...overrides
  };
}

function candidates(count = 46) {
  const items = [cameraCandidate()];
  for (let index = 1; index < count; index += 1) {
    items.push(cameraCandidate({
      url: `https://developer.android.com/jetpack/androidx/releases/camera#watch-${index}`,
      title: `CameraX rolling page ${index}`,
      published_date: '',
      finalSelectionEligibility: 'watchlist',
      hasDatedEvidence: false,
      main_eligible: false,
      source_gap_risk: true,
      reference_only: true,
      selection_exclusion_reason: 'Parser did not extract a dated release row from the official source.'
    }));
  }
  return items;
}

function diagnosisInputs(overrides = {}) {
  return {
    date,
    candidateInput: {
      relPath: `content/collected-news/${date}/merged-candidates.json`
    },
    candidatePayload: {
      date,
      candidates: candidates()
    },
    shortlistReport: {
      candidate_shortage_reviewable: true,
      candidate_shortage_summary: {
        publishable_candidate_count: 1,
        required_publishable_candidate_count: 5,
        primary_camera_stack_candidate_count: 0
      },
      gate_summary: {
        android_multimedia_camera_output_count: 0,
        non_fallback_reviewable_article_count: 1,
        min_non_fallback_publish_ready_articles: 3,
        cpp_ai_tooling_fallback_count: 2
      }
    },
    selectionReport: {
      candidate_shortage_reviewable: true,
      candidate_shortage_summary: {
        publishable_candidate_count: 1,
        required_publishable_candidate_count: 5,
        primary_camera_stack_candidate_count: 0
      },
      gate_summary: {
        android_multimedia_camera_output_count: 0,
        non_fallback_reviewable_article_count: 1,
        min_non_fallback_publish_ready_articles: 3,
        cpp_ai_tooling_fallback_count: 2
      }
    },
    generationStatus: {
      status: 'UNDERFILLED_NEEDS_FIX',
      failure_kind: 'candidate_shortage_reviewable',
      composition_mode: 'FALLBACK_COMPOSITION',
      input_candidate_count: 46,
      eligible_candidate_count: 1
    },
    sourceEffectivenessReport: {
      summary: {
        collected_count: 46,
        eligible_count: 1,
        source_gap_count: 0,
        duplicate_count: 6,
        unknown_source_quality_count: 1,
        source_quality_field_drift_count: 1
      },
      sources: [
        {
          source_id: 'android-developers-jetpack-release',
          source_name: 'Android Developers CameraX',
          reliability: 'official',
          priority: 'high',
          collected_count: 12,
          eligible_count: 0,
          parser_repair_reason_count: 1,
          duplicate_count: 0,
          recommendation: 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR',
          reasons: ['CameraX parser repair recommendation found'],
          top_exclusion_reasons: [
            { reason: 'Parser did not extract a dated release row from the official source.', count: 12 }
          ]
        },
        {
          source_id: 'generic-ai-firehose',
          source_name: 'Generic AI Firehose',
          reliability: 'media',
          priority: 'low',
          collected_count: 20,
          eligible_count: 0,
          duplicate_count: 6,
          recommendation: 'DOWNGRADE_TO_CANDIDATE_ONLY',
          reasons: ['Generic source produced no eligible camera candidates.'],
          top_exclusion_reasons: [
            { reason: 'Generic AI item without HAL connection.', count: 20 }
          ]
        }
      ]
    },
    sourceDiscoveryFeedbackReport: {
      parser_gap_count: 1,
      duplicate_discovery_gap_count: 1,
      gemini_parser_failure_count: 1
    },
    mergedCandidateManifest: {
      gemini_candidate_count: 6,
      gemini_new_unique_url_count: 0,
      gemini_publishable_candidate_count: 0,
      gemini_manual_duplicate_url_count: 6
    },
    ...overrides
  };
}

test('source quality diagnosis separates parser, taxonomy, fallback, and discovery causes', () => {
  const report = buildSourceQualityDiagnosisReport(diagnosisInputs());

  assert.equal(report.raw_candidate_count, 46);
  assert.equal(report.eligible_candidate_count, 1);
  assert.equal(report.diagnosis.parser_extraction_failure, true);
  assert.equal(report.diagnosis.taxonomy_missing, true);
  assert.equal(report.diagnosis.fallback_only_composition, true);
  assert.equal(report.diagnosis.duplicate_or_noop_source_discovery, true);
  assert.equal(report.diagnosis.source_gap_risk, true);
  assert.equal(report.diagnosis.actual_news_shortage, false);
  assert.ok(report.diagnosis_reasons.parser_extraction_failure.length >= 1);
  assert.equal(report.diagnosis_reasons.parser_extraction_failure[0].source_artifact.includes('source-effectiveness-report.json'), true);
  assert.ok(report.warnings.some(warning => warning.type === 'contract_drift'));
  assert.ok(report.warnings.some(warning => warning.type === 'unknown_source_quality'));
  assert.equal(report.recommended_issues.some(issue => issue.action === 'NO_ACTION_THIN_WEEK'), false);
});

test('source quality diagnosis normalizes fallback composition mode values', () => {
  const report = buildSourceQualityDiagnosisReport(diagnosisInputs({
    generationStatus: {
      status: 'UNDERFILLED_NEEDS_FIX',
      failure_kind: 'candidate_shortage_reviewable',
      composition_mode: 'fallback-only',
      input_candidate_count: 46,
      eligible_candidate_count: 1
    }
  }));

  assert.equal(report.diagnosis.fallback_only_composition, true);
  assert.match(report.diagnosis_reasons.fallback_only_composition[0].reason, /fallback-only/);
});

test('source quality diagnosis does not infer actual news shortage without source effectiveness evidence', () => {
  const shortageSummary = {
    publishable_candidate_count: 1,
    required_publishable_candidate_count: 5,
    primary_camera_stack_candidate_count: 1
  };
  const report = buildSourceQualityDiagnosisReport(diagnosisInputs({
    candidatePayload: {
      date,
      candidates: [cameraCandidate()]
    },
    shortlistReport: {
      candidate_shortage_reviewable: true,
      candidate_shortage_summary: shortageSummary,
      gate_summary: {
        android_multimedia_camera_output_count: 1,
        non_fallback_reviewable_article_count: 1,
        min_non_fallback_publish_ready_articles: 3,
        cpp_ai_tooling_fallback_count: 0
      }
    },
    selectionReport: {
      candidate_shortage_reviewable: true,
      candidate_shortage_summary: shortageSummary,
      gate_summary: {
        android_multimedia_camera_output_count: 1,
        non_fallback_reviewable_article_count: 1,
        min_non_fallback_publish_ready_articles: 3,
        cpp_ai_tooling_fallback_count: 0
      }
    },
    generationStatus: {
      status: 'UNDERFILLED_NEEDS_FIX',
      failure_kind: 'candidate_shortage_reviewable',
      input_candidate_count: 1,
      eligible_candidate_count: 1
    },
    sourceEffectivenessReport: {},
    sourceDiscoveryFeedbackReport: {},
    mergedCandidateManifest: {}
  }));

  assert.equal(report.diagnosis.actual_news_shortage, false);
  assert.match(report.diagnosis_reasons.actual_news_shortage[0].reason, /source-effectiveness source evidence is unavailable/);
  assert.equal(report.recommended_issues.some(issue => issue.action === 'NO_ACTION_THIN_WEEK'), false);
});

test('source quality diagnosis markdown renders Korean labels and recommended actions', () => {
  const report = buildSourceQualityDiagnosisReport(diagnosisInputs());
  const markdown = renderSourceQualityDiagnosisMarkdown(report);

  assert.match(markdown, /# 소스 품질 진단 리포트/);
  assert.match(markdown, /파서 추출 실패/);
  assert.match(markdown, /`parser_extraction_failure`/);
  assert.match(markdown, /소스 유지, 파서 수정/);
  assert.match(markdown, /`KEEP_AND_FIX_PARSER`/);
  assert.match(markdown, /Source discovery 중복 또는 무효/);
});

test('source quality diagnosis writer produces partial report when optional artifacts are missing', () => {
  const root = tempRoot('source-quality-diagnosis-');
  writeJson(path.join(root, 'content', 'collected-news', date, 'merged-candidates.json'), {
    date,
    candidates: [cameraCandidate()]
  });
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [cameraCandidate()],
    candidate_shortage_reviewable: false
  });

  const result = writeSourceQualityDiagnosisArtifacts({ root, date });

  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(fs.existsSync(result.markdownPath), true);
  assert.equal(result.report.input_refs.candidate_input, `content/collected-news/${date}/merged-candidates.json`);
  assert.ok(result.report.warnings.some(warning => warning.type === 'missing_optional_artifact'));
});

test('source quality diagnosis writer produces partial report when shortlist is missing', () => {
  const root = tempRoot('source-quality-no-shortlist-');
  writeJson(path.join(root, 'content', 'collected-news', date, 'merged-candidates.json'), {
    date,
    candidates: [cameraCandidate()]
  });

  const result = writeSourceQualityDiagnosisArtifacts({ root, date });

  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(fs.existsSync(result.markdownPath), true);
  assert.equal(result.report.raw_candidate_count, 1);
  assert.equal(result.report.eligible_candidate_count, null);
  assert.equal(result.report.evidence_completeness.shortlisted_candidates, false);
  assert.ok(result.report.warnings.some(warning => warning.type === 'missing_preferred_artifact' && /shortlisted-candidates/.test(warning.source_artifact)));
  assert.ok(result.report.warnings.some(warning => warning.type === 'partial_diagnosis'));
  assert.match(result.markdown, /알 수 없음/);
});

test('source quality diagnosis writer produces partial report when candidate input JSON is invalid', () => {
  const root = tempRoot('source-quality-invalid-candidate-');
  const candidatePath = path.join(root, 'content', 'collected-news', date, 'merged-candidates.json');
  fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
  fs.writeFileSync(candidatePath, '{ invalid json', 'utf8');
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [cameraCandidate()]
  });

  const result = writeSourceQualityDiagnosisArtifacts({ root, date });

  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(fs.existsSync(result.markdownPath), true);
  assert.equal(result.report.input_refs.candidate_input, `content/collected-news/${date}/merged-candidates.json`);
  assert.equal(result.report.evidence_completeness.candidate_input, false);
  assert.equal(result.report.raw_candidate_count, null);
  assert.ok(result.report.warnings.some(warning =>
    warning.type === 'invalid_preferred_artifact' &&
    warning.source_artifact === `content/collected-news/${date}/merged-candidates.json`
  ));
  assert.ok(result.report.warnings.some(warning => warning.type === 'partial_diagnosis'));
});

test('newsroom PR body omits source quality diagnosis detail and keeps artifact-only review path', () => {
  const root = tempRoot('source-quality-pr-body-');
  const report = buildSourceQualityDiagnosisReport(diagnosisInputs());
  writeJson(path.join(root, 'content', 'newsroom', date, 'source-quality-diagnosis.json'), report);

  const body = buildNewsroomPrBody({
    publishStatus: {
      root,
      date,
      status: {
        status: 'UNDERFILLED_NEEDS_FIX',
        final_publish_ready: false,
        publish_gate_passed: false,
        review_gate_passed: true,
        failure_kind: 'candidate_shortage_reviewable',
        composition_mode: 'FALLBACK_COMPOSITION',
        selection_shortage_hints: []
      }
    }
  });

  assert.doesNotMatch(body, /## 소스 품질 진단 \/ Source Quality Diagnosis/);
  assert.doesNotMatch(body, /파서 추출 실패/);
  assert.doesNotMatch(body, /소스 유지, 파서 수정/);

  const missingBody = buildNewsroomPrBody({
    publishStatus: {
      root: tempRoot('source-quality-pr-body-missing-'),
      date,
      status: {
        status: 'UNDERFILLED_NEEDS_FIX',
        final_publish_ready: false,
        publish_gate_passed: false,
        review_gate_passed: true
      }
    }
  });

  assert.doesNotMatch(missingBody, /## 소스 품질 진단 \/ Source Quality Diagnosis/);
  assert.doesNotMatch(missingBody, /Status: generation failed or unavailable/);
  assert.doesNotMatch(missingBody, /publish\/readiness gates are unaffected/);
});
