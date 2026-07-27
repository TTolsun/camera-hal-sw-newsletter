'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');

const {
  buildNewsroomPrBody
} = require('../../../generator/publish/build-newsroom-pr-body');
const {
  articlePolicy,
  headlinePolicy,
  qualityGatePolicy
} = require('../../common/newsletter-policy');
const {
  REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS,
  REQUIRED_EDITORIAL_REVIEWABLE_ARTIFACTS,
  REQUIRED_FAILED_REPAIR_REVIEWABLE_ARTIFACTS,
  requiredPublicFiles
} = require('../../../generator/publish/resolve-reviewable-artifacts');
const {
  ensurePublicNewsletterArtifacts
} = require('../../../generator/publish/ensure-public-newsletter-artifacts');
const {
  main: annotatePublicationQualityMain,
  resolveTargetItems
} = require('../../../generator/publish/annotate-publication-quality');
const {
  tempRoot: fsTempRoot,
  writeJson,
  writeText
} = require('../helpers/fs');
const {
  retrySection
} = require('../helpers/newsroom-builders');
const {
  writeArchiveSyncSurface,
  writeCandidateShortageReviewableArtifacts,
  writeEditorialReviewableArtifacts,
  writeFailedRepairReviewableArtifacts,
  writeMinimalPublishArtifacts,
  writeNewsletterIndex,
  writePublicNewsletterArtifacts,
  writeRootIndexContract
} = require('../helpers/workflow-fixtures');
const {
  onePublishableSupportingCandidate,
  onePublishableSupportingEditorDraft,
  runNodeAsync
} = require('../helpers/workflow-process');

test('candidate shortage generator exits before LLM calls when credentials are empty', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-11';
  const rawDir = path.join(root, '.tmp', 'gemini-raw');
  writeJson(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), {
    schemaVersion: 2,
    sources: []
  });
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'candidates.json'), {
    date,
    candidates: []
  });

  const result = spawnSync(process.execPath, [
    path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'gemini-newsroom-newsletter.js')
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
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
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

test.skip('Workflow 03 enters LLM generation with one publishable candidate and zero reserve candidates', async () => {
  // Skipped: used LLM_PROVIDER=internal for mock HTTP injection. Re-enable when openapi provider is implemented.
  const root = fsTempRoot('newsroom-pr-body-');
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
        } else if (required.includes('overall_pass') && required.includes('sections')) {
          json = {
            date,
            overall_pass: true,
            sections: editorDraft.sections.map((section, index) => ({
              section_index: index + 1,
              headline: section.headline,
              public_article_pass: true,
              reader_checkpoints_pass: true,
              source_boundary_pass: true,
              public_prose_pass: true,
              issues: []
            }))
          };
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
  writeJson(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), {
    schemaVersion: 2,
    sources: []
  });
  writeJson(path.join(root, 'articles', 'data', 'newsletters.json'), [{
    date,
    title: editorDraft.title,
    summary: editorDraft.summary,
    html: `newsletters/${date}/index.html`,
    md: `newsletters/${date}/newsletter.md`,
    tags: ['SoC Platform Signal']
  }]);
  writeText(path.join(root, 'articles', 'assets', 'images', 'fallback', 'android.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#3ddc84"/></svg>\n');
  writeJson(path.join(root, 'articles', 'content', 'collected-news', date, 'candidates.json'), {
    date,
    candidates: [selectedCandidate]
  });

  let result;
  try {
    result = await runNodeAsync([
      path.join(__dirname, '..', '..', '..', '..', 'src', 'generator', 'publish', 'gemini-newsroom-newsletter.js')
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
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  const generationStatus = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'generation-status.json'), 'utf8'));
  const qualityReport = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'quality-report.json'), 'utf8'));

  assert.equal(result.status, 0, combinedOutput);
  assert.equal(llmRequests.some(item => item.required.includes('candidates')), true);
  assert.equal(llmRequests.some(item => item.required.includes('title') && item.required.includes('sections')), true);
  assert.equal(llmRequests.some(item => item.required.includes('overall_pass') && item.required.includes('sections')), true);
  assert.equal(llmRequests.some(item => item.required.includes('status') && item.required.includes('must_fix')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'reporter-candidates.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'editor-draft.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'editor-public-article-judge-attempt-1.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'fact-check-report.json')), true);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'quality-report.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date, 'newsletter.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'data', 'newsletters.json')), true);
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

test('ensure CLI keeps zero-candidate shortage diagnostics-only without editor draft', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-11';
  writeRootIndexContract(root);
  writeCandidateShortageReviewableArtifacts(root, date);

  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json')), false);

  assert.throws(
    () => ensurePublicNewsletterArtifacts({ root, date }),
    /missing required public file: articles\/newsletters\/2026-05-11\/newsletter\.md/
  );
  const status = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));

  assert.equal(status.failure_kind, 'candidate_shortage_reviewable');
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date, 'newsletter.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date, 'index.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'data', 'newsletters.json')), false);
});

test('ensure CLI preserves failed repair Gemini draft without synthesizing public prose', () => {
  const root = fsTempRoot('newsroom-pr-body-');
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
    .map(file => `articles/content/newsroom/${date}/${file}`);
  const editorPath = path.join(root, 'articles', 'content', 'newsroom', date, 'editor-draft.json');
  const editorBefore = fs.readFileSync(editorPath, 'utf8');

  const result = ensurePublicNewsletterArtifacts({ root, date, changedArtifacts });
  assert.equal(result.outputs.public_newsletter_ready, 'false');
  assert.equal(result.outputs.review_pr_ready, 'true');
  assert.equal(result.outputs.diagnostics_only, 'true');
  assert.equal(fs.readFileSync(editorPath, 'utf8'), editorBefore);
});

test('ensure CLI persists homepage headline artifacts for review-publication public files', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-23';
  writeArchiveSyncSurface(root);
  writePublicNewsletterArtifacts(root, date);
  const status = {
    date,
    status: 'NEEDS_FIX',
    failure_kind: 'editorial_reviewable',
    final_publish_ready: false,
    public_newsletter_ready: true,
    review_publication_ready: true,
    diagnostics_only: false,
    homepage_visible_after_merge: true,
    publication_mode: 'review_only',
    homepage_visibility: 'normal',
    fact_check_status: 'PASS',
    must_fix_count: 0,
    source_gap_count: 0,
    quality_status: 'PASS',
    quality_score: 100,
    quality_threshold: qualityGatePolicy.threshold,
    rendered_main_article_count: 2,
    selected_article_count: 2,
    min_final_articles: articlePolicy.mainArticleCount.min
  };
  const currentHeadline = {
    article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.0.0',
    title: 'CameraX 1.6.1 업데이트',
    summary: 'CameraX 1.6.1 release note를 Camera HAL 관점에서 확인합니다.',
    source_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.0.0',
    newsletter_date: date,
    newsletter_url: `newsletters/${date}/index.html`,
    selected_at: date,
    base_score: 92,
    current_score: 92,
    last_scored_at: date,
    date_evidence: {
      date,
      date_field: 'published_date',
      evidence_level: 'dated_release',
      publish_ready_date_evidence: true
    },
    quality_flags: {
      source_gap_risk: false,
      fact_check_must_fix_unresolved: false,
      stale_claim_hard_failure: false,
      blocked_source: false
    },
    score_breakdown: {},
    snapshot: {
      category: 'direct_aosp_camera',
      source_name: 'Android Developers'
    }
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    headline_decision: {
      reason: 'seeded_from_current_issue'
    },
    headline_latest_inclusion: {
      included: true,
      mode: 'injected_from_headline_snapshot'
    },
    homepage_headline_state: {
      schemaVersion: 1,
      updated_at: `${date}T00:00:00+09:00`,
      current_headline: currentHeadline,
      headline_history: [],
      policy: {
        decay_model: headlinePolicy.decayModel,
        decay_rate_per_day: headlinePolicy.decayRatePerDay,
        replacement_margin: headlinePolicy.replacementMargin,
        minimum_headline_score: headlinePolicy.minimumHeadlineScore
      }
    }
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-report.json'), {
    headline_decision: {
      reason: 'seeded_from_current_issue'
    }
  });

  const result = ensurePublicNewsletterArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  });
  const headlineState = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'homepage-headline.json'), 'utf8'));
  const exposureHistory = JSON.parse(fs.readFileSync(path.join(root, 'state', 'article-exposure-history.json'), 'utf8'));
  const selectionReport = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-report.json'), 'utf8'));
  const shortlist = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), 'utf8'));
  const headlineExposure = exposureHistory.articles
    .find(item => item.article_identity_key === currentHeadline.article_identity_key);

  assert.equal(headlineState.current_headline.article_identity_key, currentHeadline.article_identity_key);
  assert.equal(headlineState.current_headline.newsletter_article_url, `newsletters/${date}/index.html#article-camerax-release-note`);
  assert.ok(headlineExposure);
  assert.equal(headlineExposure.exposure_count, 1);
  assert.deepEqual(headlineExposure.exposure_types, ['homepage_headline']);
  assert.equal(shortlist.homepage_headline_state.current_headline.article_identity_key, currentHeadline.article_identity_key);
  assert.equal(selectionReport.headline_public_render_reconciliation, undefined);
  assert.equal(selectionReport.article_exposure_coverage.mode, 'forward_only');
  assert.match(result.outputs.reconciled_changed_artifacts, /articles\/data\/homepage-headline\.json/);
  assert.match(result.outputs.reconciled_changed_artifacts, /state\/article-exposure-history\.json/);
});

test('ensure CLI persists a rendered public article when selected headline is not rendered', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-23';
  writeArchiveSyncSurface(root);
  const renderedUrl = 'https://goo.gle/AdaptiveApps_IO26';
  const renderedTitle = 'Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트';
  const renderedSummary = 'Google은 여러 화면 크기와 CameraX preview 대응을 함께 언급했습니다.';
  const renderedImage = 'https://example.com/android-developers-headline.png';
  const renderedImageAlt = 'Android Developers headline image';
  writePublicNewsletterArtifacts(root, date, {
    issue: {
      date,
      title: `Camera HAL / SW Newsletter - ${date}`,
      summary: '공개 뉴스레터 요약입니다.',
      briefing: ['첫 번째 요약입니다.', '두 번째 요약입니다.', '세 번째 요약입니다.'],
      sections: [
        {
          category: 'Android Camera',
          headline: renderedTitle,
          selectedImage: renderedImage,
          imageAlt: renderedImageAlt,
          what_changed: renderedSummary,
          evidence_summary: renderedSummary,
          confirmed_facts: [renderedSummary],
          specificity_checks: ['component=CameraX'],
          source_verification_notes: ['Source URL is official.'],
          camera_hal_checks: ['Check preview stream behavior.'],
          action_items: ['Check CameraX preview compatibility.'],
          article_sections: {
            verified_facts: [renderedSummary],
            background_context: 'CameraX preview 확인 범위를 설명합니다.',
            hal_driver_impact: 'Camera HAL 팀은 preview stream, rotation, buffer path를 회귀 확인합니다.',
            action_items: ['Check CameraX preview compatibility.'],
            team_share_points: 'Camera preview compatibility를 확인합니다.'
          },
          public_article: {
            headline: renderedTitle,
            lead: renderedSummary,
            body_paragraphs: [
              '이 항목은 adaptive app 문맥에서 CameraX preview 동작을 확인하는 app-framework 계층의 신호입니다.',
              'HAL 독자는 preview stream, rotation, buffer path 확인처럼 앱에서 관찰 가능한 검증 범위로 해석합니다.'
            ],
            camera_hal_takeaway: 'Camera HAL runtime 변경 근거가 아니라 CameraX preview compatibility 확인 신호로 다룹니다.',
            reader_checkpoints: ['CameraX preview compatibility를 확인합니다.', 'preview stream과 rotation 동작을 비교합니다.'],
            source_links: [{
              title: 'Android Developers Blog',
              url: renderedUrl,
              source_role: 'primary'
            }]
          },
          sources: [
            {
              title: 'Android Developers Blog',
              url: renderedUrl
            }
          ]
        }
      ],
      action_items: ['Check CameraX preview compatibility.'],
      references: [
        {
          title: 'Android Developers Blog',
          url: renderedUrl
        }
      ]
    }
  });
  const status = {
    date,
    status: 'NEEDS_FIX',
    failure_kind: 'editorial_reviewable',
    final_publish_ready: false,
    public_newsletter_ready: true,
    review_publication_ready: true,
    diagnostics_only: false,
    homepage_visible_after_merge: true,
    publication_mode: 'review_only',
    homepage_visibility: 'normal',
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
  const selectedHeadline = {
    article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    title: 'CameraX Release Notes - CameraX 1.6.1',
    summary: 'Fixed a CameraX compilation error.',
    source_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1',
    newsletter_date: date,
    newsletter_url: `newsletters/${date}/index.html`,
    selected_at: date,
    base_score: 100,
    current_score: 100,
    last_scored_at: date,
    date_evidence: {
      date,
      date_field: 'published_date',
      evidence_level: 'dated_release',
      publish_ready_date_evidence: true
    },
    quality_flags: {
      source_gap_risk: false,
      fact_check_must_fix_unresolved: false,
      stale_claim_hard_failure: false,
      blocked_source: false
    },
    score_breakdown: {},
    snapshot: {
      category: 'direct_aosp_camera',
      source_name: 'Android Developers'
    }
  };
  const renderedCandidate = {
    article_identity_key: `url:${renderedUrl}`,
    title: 'Building seamless Android experiences across devices with Jetpack Compose',
    summary: 'CameraX preview is mentioned for adaptive app validation.',
    source_url: renderedUrl,
    published_date: date,
    hasDatedEvidence: true,
    finalSelectionEligibility: 'main',
    main_article_score_eligible: true,
    score_filter_reasons: [],
    relevance_bucket: 'android_platform_camera_adjacent',
    source: 'Android Developers Blog'
  };

  writeJson(path.join(root, '.tmp', 'newsletter-generation-status.json'), status);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), status);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
    selected_articles: [renderedCandidate],
    headline_decision: {
      reason: 'seeded_from_current_issue'
    },
    homepage_headline_state: {
      schemaVersion: 1,
      updated_at: `${date}T00:00:00+09:00`,
      current_headline: selectedHeadline,
      headline_history: [],
      policy: {
        decay_model: headlinePolicy.decayModel,
        decay_rate_per_day: headlinePolicy.decayRatePerDay,
        replacement_margin: headlinePolicy.replacementMargin,
        minimum_headline_score: headlinePolicy.minimumHeadlineScore
      }
    }
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-report.json'), {
    headline_decision: {
      reason: 'seeded_from_current_issue'
    }
  });
  writeText(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-diagnostics.md'), [
    'Homepage Headline:',
    '- decision: seeded_from_current_issue',
    `- replacement_headline_key: ${selectedHeadline.article_identity_key}`,
    '- runtime_decayed_score: 100'
  ].join('\n'));

  ensurePublicNewsletterArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  });
  const headlineState = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'homepage-headline.json'), 'utf8'));
  const selectionReport = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-report.json'), 'utf8'));
  const shortlist = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), 'utf8'));
  const diagnosticsMarkdown = fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'selection-diagnostics.md'), 'utf8');

  assert.equal(headlineState.current_headline.article_identity_key, `url:${renderedUrl}`);
  assert.equal(headlineState.current_headline.title, renderedTitle);
  assert.equal(headlineState.current_headline.summary, renderedSummary);
  assert.equal(headlineState.current_headline.source_url, renderedUrl);
  assert.equal(headlineState.current_headline.newsletter_article_url, `newsletters/${date}/index.html#article-jetpack-compose-camerax-preview`);
  assert.equal(headlineState.current_headline.image_url, renderedImage);
  assert.equal(headlineState.current_headline.image_alt, renderedImageAlt);
  assert.deepEqual(selectionReport.headline_public_render_reconciliation, {
    applied: true,
    previous_headline_key: selectedHeadline.article_identity_key,
    rendered_headline_key: `url:${renderedUrl}`,
    reason: 'selected_headline_not_rendered_in_public_issue'
  });
  assert.equal(selectionReport.headline_decision.public_render_reconciled, true);
  assert.equal(selectionReport.headline_decision.public_rendered_headline_key, `url:${renderedUrl}`);
  assert.equal(shortlist.headline_public_render_reconciliation.rendered_headline_key, `url:${renderedUrl}`);
  assert.equal(shortlist.homepage_headline_state.current_headline.article_identity_key, `url:${renderedUrl}`);
  assert.match(diagnosticsMarkdown, /public_render_reconciled: true/);
  assert.match(diagnosticsMarkdown, /public_rendered_headline_key: url:https:\/\/goo\.gle\/AdaptiveApps_IO26/);
  const body = buildNewsroomPrBody({ root, date, validateOutcome: 'success' });
  assert.doesNotMatch(body, /public_render_reconciled: true/);
  assert.doesNotMatch(body, /public_rendered_headline_key: url:https:\/\/goo\.gle\/AdaptiveApps_IO26/);
  assert.doesNotMatch(body, /public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue/);
});

test('ensure CLI reconciles diagnostics-only state into status files and hides stale public index', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-18';
  writeCandidateShortageReviewableArtifacts(root, date);
  writePublicNewsletterArtifacts(root, date);

  const result = ensurePublicNewsletterArtifacts({
    root,
    date,
    noBuild: true,
    changedArtifacts: REQUIRED_CANDIDATE_SHORTAGE_REVIEWABLE_ARTIFACTS
      .map(file => `articles/content/newsroom/${date}/${file}`)
  });

  const newsletters = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'data', 'newsletters.json'), 'utf8'));
  const canonicalStatus = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  const tmpStatus = JSON.parse(fs.readFileSync(path.join(root, '.tmp', 'newsletter-generation-status.json'), 'utf8'));

  assert.equal(newsletters.some(item => item.date === date), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'newsletters', date, 'newsletter.md')), true);
  assert.deepEqual(canonicalStatus, tmpStatus);
  assert.equal(canonicalStatus.effective_homepage_visible, false);
  assert.equal(canonicalStatus.public_artifact_policy, 'hide_existing_public_artifact_after_latest_diagnostics_only');
  assert.equal(result.outputs.effective_homepage_visible, 'false');
  assert.equal(result.outputs.public_artifact_source, 'none');
  assert.match(result.outputs.reconciled_changed_artifacts, /articles\/data\/newsletters\.json/);
  assert.match(result.outputs.reconciled_changed_artifacts, new RegExp(`articles/content/newsroom/${date}/generation-status\\.json`));
});

test('ensure CLI records invalid review publication structure as non-visible', () => {
  const root = fsTempRoot('newsroom-pr-body-');
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
      .map(file => `articles/content/newsroom/${date}/${file}`)
  });

  const status = JSON.parse(fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), 'utf8'));
  assert.equal(result.outputs.public_newsletter_ready, 'false');
  assert.equal(result.outputs.effective_homepage_visible, 'false');
  assert.equal(result.outputs.public_artifact_policy, 'review_publication_invalid_public_structure');
  assert.equal(status.review_publication_ready, true);
  assert.equal(status.public_newsletter_ready, false);
  assert.equal(status.public_artifact_policy, 'review_publication_invalid_public_structure');
});

test('ensure CLI skips fallback when public artifacts are already valid', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-10';
  writeMinimalPublishArtifacts(root, date, {
    finalPublishReady: true,
    status: {
      final_publish_ready: true,
      validate_ok: true
    }
  });
  writePublicNewsletterArtifacts(root, date);
  writeArchiveSyncSurface(root);

  const result = ensurePublicNewsletterArtifacts({
    root,
    date,
    changedArtifacts: requiredPublicFiles(date)
  });
  assert.equal(result.outputs.public_newsletter_ready, 'true');
  assert.equal(result.outputs.public_newsletter_reason, 'ready');
});

test('ensure CLI reports missing public artifacts instead of building fallback', () => {
  const root = fsTempRoot('newsroom-pr-body-');
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
    /missing required public file: articles\/newsletters\/2026-05-10\/newsletter\.md/
  );
});

test('ensure CLI keeps a hard-fail editorial draft reviewable when the best-effort HAL signal report is missing', () => {
  // #503: score >= threshold but a publish-blocking hard fail remains -> QUALITY_NEEDS_FIX editorial review.
  // hal-signal-quality-report.* is best-effort (generated by the review package writer, with a
  // continue-on-error workflow backfill step), so a missing HAL signal report must not collapse
  // the run into a job-failing throw and lose the diagnostics PR.
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-06-04';
  writeEditorialReviewableArtifacts(root, date, {
    writeHalSignalQuality: false,
    status: { status: 'QUALITY_NEEDS_FIX', quality_status: 'NEEDS_FIX', quality_score: 78 },
    generationStatus: { status: 'QUALITY_NEEDS_FIX', quality_status: 'NEEDS_FIX', quality_score: 78 },
    quality: { status: 'NEEDS_FIX', score: 78 }
  });

  const changedArtifacts = ['editor-draft.json', 'fact-check-report.json', 'quality-report.json', 'generation-status.json']
    .map(file => `articles/content/newsroom/${date}/${file}`);

  const result = ensurePublicNewsletterArtifacts({ root, date, noBuild: true, changedArtifacts });

  assert.equal(result.outputs.public_newsletter_ready, 'false');
  assert.equal(result.outputs.review_pr_ready, 'true');
  assert.equal(result.outputs.diagnostics_only, 'true');
});

test('publication quality annotation reports quality and fact-check issues without failing', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writePublicNewsletterArtifacts(root, date);
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), {
    status: 'NEEDS_FIX',
    score: qualityGatePolicy.threshold - 5,
    threshold: qualityGatePolicy.threshold,
    deductions: [{ reason: 'weak camera relevance' }]
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'fact-check-report.json'), {
    status: 'NEEDS_FIX',
    must_fix: [{ issue: 'unresolved source claim' }],
    source_gaps: [{ issue: 'missing article-level evidence' }],
    source_gap_count: 1
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'generation-status.json'), {
    final_publish_ready: false,
    publish_gate_passed: false,
    stale_claim_status: 'PASS',
    stale_claim_hard_failure_count: 0
  });
  writeJson(path.join(root, 'articles', 'content', 'newsroom', date, 'shortlisted-candidates.json'), {
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
  assert.match(stdout, /::error file=articles\/content\/newsroom\/2026-05-08\/quality-report\.json,title=Quality status not PASS::/);
  assert.match(stdout, /::warning file=articles\/content\/newsroom\/2026-05-08\/quality-report\.json,title=Quality score below threshold::/);
  assert.match(stdout, /::error file=articles\/content\/newsroom\/2026-05-08\/fact-check-report\.json,title=Fact-check must_fix items remain::/);
  assert.match(stdout, /::error file=articles\/content\/newsroom\/2026-05-08\/generation-status\.json,title=AI publish readiness is false::/);
  assert.match(stdout, /Publication quality annotation completed/);
});

test('publication quality annotation fails only for CLI or system errors', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  const date = '2026-05-08';
  writePublicNewsletterArtifacts(root, date);
  writeText(path.join(root, 'articles', 'content', 'newsroom', date, 'quality-report.json'), '{ invalid json');

  let stdout = '';
  let stderr = '';
  const code = annotatePublicationQualityMain(['--date', date], {
    root,
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: chunk => { stderr += chunk; } }
  });

  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /Invalid JSON in articles\/content\/newsroom\/2026-05-08\/quality-report\.json/);
});

test('publication quality annotation latest mode targets latest only without changed public issue dates', () => {
  const root = fsTempRoot('newsroom-pr-body-');
  writeNewsletterIndex(root, [
    { date: '2026-05-07' },
    { date: '2026-05-08' }
  ]);

  const targets = resolveTargetItems(root, { dates: [], all: false, latest: true, targetDates: new Set() });

  assert.deepEqual(targets.map(item => item.date), ['2026-05-08']);
});

test('publication quality annotation changed public issue date wins over latest fallback permission', () => {
  const root = fsTempRoot('newsroom-pr-body-');
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
  const root = fsTempRoot('newsroom-pr-body-');
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
      assert.match(error.message, /No articles\/data\/newsletters\.json entry found for detected target date\(s\)/);
      assert.match(error.message, /2026-05-09/);
      assert.match(error.message, /2026-05-10/);
      assert.doesNotMatch(error.message, /2026-05-07/);
      return true;
    }
  );
});

test('publication quality annotation fails without explicit target or changed public issue date', () => {
  const root = fsTempRoot('newsroom-pr-body-');
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
  const root = fsTempRoot('newsroom-pr-body-');
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
  const root = fsTempRoot('newsroom-pr-body-');
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
  const root = fsTempRoot('newsroom-pr-body-');
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
    root: fsTempRoot('newsroom-pr-body-'),
    stdout: { write: chunk => { stdout += chunk; } },
    stderr: { write: () => {} }
  });

  assert.equal(code, 0);
  assert.match(stdout, /Usage: node src\/generator\/publish\/annotate-publication-quality\.js \[--date YYYY-MM-DD\] \[--all\] \[--latest\]/);
  assert.match(stdout, /--date YYYY-MM-DD inspects only that public issue/);
  assert.match(stdout, /--all inspects every historical public issue/);
  assert.match(stdout, /Changed public issue dates inspect matching public issue dates, even when --latest is present/);
  assert.match(stdout, /--latest permits fallback to the latest public issue only when no changed public issue date is detected/);
  assert.match(stdout, /no explicit target and no changed public issue date, the command fails/);
});
