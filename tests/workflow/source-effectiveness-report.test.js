const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildSourceEffectivenessReport,
  renderSourceEffectivenessMarkdown,
  writeSourceEffectivenessArtifacts
} = require('../../scripts/newsroom/metrics/source-effectiveness-report');
const {
  tempRoot,
  writeJson
} = require('../../src/core/test/helpers/fs');

const fixture = require('../../src/core/test/fixtures/source-effectiveness/basic-source-effectiveness.json');

function buildReport(overrides = {}) {
  return buildSourceEffectivenessReport({
    date: fixture.date,
    sourceRegistry: fixture.sourceRegistry,
    collectedCandidates: fixture.collectedCandidates,
    shortlistReport: fixture.shortlistReport,
    reporterCandidates: fixture.reporterCandidates,
    editorDraft: fixture.editorDraft,
    factCheckReport: fixture.factCheckReport,
    qualityReport: fixture.qualityReport,
    ...overrides
  });
}

function source(report, id) {
  return report.sources.find(item => item.source_id === id);
}

function sourceQuality(overrides = {}) {
  return {
    source_role: 'official_release_source',
    source_url_quality: 'official_dated_release',
    source_quality_status: 'allowed',
    main_article_source_allowed: true,
    main_article_source_allowed_reason: 'Source policy allows this candidate with concrete source evidence.',
    main_article_source_blockers: [],
    cross_check_status: 'not_required',
    requires_cross_check: false,
    requires_conditional_evidence: false,
    conditional_evidence_type: '',
    evidence_granularity: 'article',
    source_quality_notes: [],
    ...overrides
  };
}

test('selected and rendered source gets high score and KEEP recommendation', () => {
  const report = buildReport();
  const effective = source(report, 'effective-camera');

  assert.equal(effective.recommendation, 'KEEP');
  assert.equal(effective.collected_count, 1);
  assert.equal(effective.eligible_count, 1);
  assert.equal(effective.selected_count, 1);
  assert.equal(effective.rendered_main_count, 1);
  assert.ok(effective.effectiveness_score >= 80);
  assert.equal(effective.duplicate_within_source_count, 1);
  assert.equal(effective.duplicate_across_sources_count, 1);
});

test('official source with collected candidates but zero eligible needs parser repair', () => {
  const report = buildReport();
  const official = source(report, 'official-broken');

  assert.equal(official.collected_count, 1);
  assert.equal(official.eligible_count, 0);
  assert.equal(official.camera_relevant_raw_count, 1);
  assert.equal(official.parser_repair_reason_count, 1);
  assert.equal(official.recommendation, 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR');
});

test('official source is not marked parser repair from collected count alone', () => {
  const report = buildReport({
    collectedCandidates: {
      candidates: fixture.collectedCandidates.candidates.map(candidate => {
        if (candidate.source_name !== 'Official Broken Parser') return candidate;
        return {
          ...candidate,
          title: 'Official camera overview page',
          summary: 'CameraX overview page without a dated release row in this window.',
          relevance_bucket: 'android_platform_camera_adjacent',
          selection_exclusion_reason: 'No camera-relevant release item was found in the collection window.'
        };
      })
    }
  });
  const official = source(report, 'official-broken');

  assert.equal(official.collected_count, 1);
  assert.equal(official.eligible_count, 0);
  assert.equal(official.camera_relevant_raw_count, 1);
  assert.equal(official.parser_repair_reason_count, 0);
  assert.notEqual(official.recommendation, 'OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR');
  assert.equal(official.recommendation, 'KEEP_AND_FIX_PARSER');
});

test('generic source with many collected and zero eligible is downgrade candidate', () => {
  const report = buildReport();
  const generic = source(report, 'generic-ai-firehose');

  assert.equal(generic.collected_count, 3);
  assert.equal(generic.eligible_count, 0);
  assert.equal(generic.generic_noise_count, 3);
  assert.equal(generic.recommendation, 'DOWNGRADE_TO_CANDIDATE_ONLY');
});

test('source gap heavy non-generic source is review source or parser', () => {
  const report = buildReport();
  const gapHeavy = source(report, 'gap-heavy');

  assert.equal(gapHeavy.source_gap_count, 3);
  assert.equal(gapHeavy.recommendation, 'REVIEW_SOURCE_OR_PARSER');
  assert.ok(gapHeavy.top_exclusion_reasons.some(item => item.reason === 'source_gap_risk=true'));
});

test('snake_case has_dated_evidence false excludes otherwise eligible candidates', () => {
  const report = buildReport({
    collectedCandidates: {
      candidates: [
        ...fixture.collectedCandidates.candidates,
        {
          source_id: 'effective-camera',
          source_name: 'Effective Camera Source',
          sourceUrl: 'https://camera.example.com/',
          url: 'https://camera.example.com/articles/snake-case-undated',
          title: 'Snake case undated camera item',
          published_date: '2026-05-05',
          finalSelectionEligibility: 'main',
          has_dated_evidence: false,
          main_eligible: true,
          source_gap_risk: false,
          reference_only: false,
          briefing_only: false
        }
      ]
    }
  });
  const effective = source(report, 'effective-camera');

  assert.equal(effective.collected_count, 2);
  assert.equal(effective.eligible_count, 1);
  assert.ok(effective.top_exclusion_reasons.some(item => item.reason === 'hasDatedEvidence=false'));
});

test('rendered section URL matches normalized candidate URL', () => {
  const report = buildReport();
  const effective = source(report, 'effective-camera');

  assert.equal(effective.rendered_main_count, 1);
  assert.deepEqual(effective.sample_selected_urls, [
    'https://camera.example.com/articles/camera-hal-release?utm=collector',
    'https://camera.example.com/articles/camera-hal-release?utm=selected'
  ]);
});

test('fact-check source gap URL is mapped back to the collected source', () => {
  const report = buildReport({
    collectedCandidates: {
      candidates: fixture.collectedCandidates.candidates.filter(candidate => candidate.title !== 'Cross-source duplicate')
    },
    factCheckReport: {
      status: 'NEEDS_FIX',
      must_fix: [],
      source_gaps: [{
        source_url: 'https://camera.example.com/articles/camera-hal-release?from=fact-check',
        problem: 'Rendered article source has a source gap.'
      }],
      source_gap_count: 1
    }
  });
  const effective = source(report, 'effective-camera');

  assert.equal(effective.source_gap_count, 1);
  assert.ok(effective.top_exclusion_reasons.some(item => item.reason === 'Rendered article source has a source gap.'));
});

test('source quality coverage separates selected main from main-eligible pool', () => {
  const selected = {
    source_id: 'effective-camera',
    source_name: 'Effective Camera Source',
    sourceUrl: 'https://camera.example.com/',
    url: 'https://camera.example.com/articles/selected',
    title: 'Selected Camera HAL release',
    published_date: '2026-05-05',
    finalSelectionEligibility: 'main',
    hasDatedEvidence: true,
    main_eligible: true,
    source_gap_risk: false,
    reference_only: false,
    briefing_only: false,
    source_quality: sourceQuality()
  };
  const eligibleOnly = {
    ...selected,
    url: 'https://camera.example.com/articles/eligible-only',
    title: 'Eligible-only Camera HAL release',
    source_quality: sourceQuality()
  };
  const report = buildReport({
    collectedCandidates: {
      candidates: [selected, eligibleOnly]
    },
    shortlistReport: {
      ...fixture.shortlistReport,
      primary_selected_articles: [{
        ...selected,
        final_selected: true,
        primary_selected: true,
        selected_for_editor: true
      }]
    },
    editorDraft: {
      sections: [{
        headline: selected.title,
        source_candidate_url: selected.url,
        sources: [{ title: selected.title, url: selected.url }]
      }]
    }
  });

  assert.deepEqual(report.summary.selected_main_source_quality_coverage, {
    selected_main_count: 1,
    with_source_quality_count: 1
  });
  assert.deepEqual(report.summary.main_eligible_source_quality_coverage, {
    main_eligible_candidate_count: 2,
    with_source_quality_count: 2
  });
});

test('reddit community signal candidates are counted per source', () => {
  const report = buildReport();
  const reddit = source(report, 'reddit-android-dev');

  assert.equal(reddit.collected_count, 2);
  assert.equal(reddit.community_signal_count, 2);
  assert.equal(reddit.reddit_candidate_count, 2);
  assert.equal(reddit.reddit_cross_checked_count, 1);
  assert.equal(reddit.reddit_only_blocked_count, 1);
});

test('community signal counts roll up into the summary', () => {
  const report = buildReport();

  assert.equal(report.summary.community_signal_count, 2);
  assert.equal(report.summary.reddit_candidate_count, 2);
  assert.equal(report.summary.reddit_cross_checked_count, 1);
  assert.equal(report.summary.reddit_only_blocked_count, 1);
});

test('markdown renders a Community signals section', () => {
  const markdown = renderSourceEffectivenessMarkdown(buildReport());

  assert.match(markdown, /## Community signals/);
  assert.match(markdown, /- Community-signal candidates: 2/);
  assert.match(markdown, /- Reddit candidates: 2/);
  assert.match(markdown, /- Reddit cross-checked: 1/);
  assert.match(markdown, /- Reddit-only blocked \(no primary confirmation\): 1/);
  assert.match(markdown, /\| reddit-android-dev \| 2 \| 2 \| 1 \| 1 \|/);
});

test('source effectiveness report builds for candidate shortage review-only without public newsletter files', () => {
  const root = tempRoot('source-effectiveness-');
  const date = fixture.date;

  writeJson(path.join(root, 'data', 'news-sources.json'), fixture.sourceRegistry);
  writeJson(path.join(root, 'content', 'collected-news', date, 'candidates.json'), fixture.collectedCandidates);
  writeJson(path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'), fixture.shortlistReport);

  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'newsletter.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'newsletters', date, 'index.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'data', 'newsletters.json')), false);

  const result = writeSourceEffectivenessArtifacts({ root, date });
  assert.equal(fs.existsSync(result.jsonPath), true);
  assert.equal(fs.existsSync(result.markdownPath), true);
  assert.deepEqual(result.report.inputs.optional_artifacts, {
    reporter_candidates: null,
    editor_draft: null,
    fact_check_report: null,
    quality_report: null
  });
  assert.ok(result.report.warnings.some(warning => warning.includes('reporter-candidates.json')));
  assert.ok(result.report.warnings.some(warning => warning.includes('editor-draft.json')));
});

test('JSON and Markdown report output is deterministic', () => {
  const first = buildReport();
  const second = buildReport();
  const firstJson = JSON.stringify(first, null, 2);
  const secondJson = JSON.stringify(second, null, 2);
  const firstMarkdown = renderSourceEffectivenessMarkdown(first);
  const secondMarkdown = renderSourceEffectivenessMarkdown(second);
  const syntheticCollectedCount = first.sources
    .filter(item => item.synthetic)
    .reduce((sum, item) => sum + item.collected_count, 0);

  assert.equal(firstJson, secondJson);
  assert.equal(firstMarkdown, secondMarkdown);
  assert.equal(first.summary.unregistered_candidate_count, syntheticCollectedCount);
  assert.equal(first.summary.unregistered_candidate_count, 1);
  assert.ok(first.summary.source_quality_status_summary.unknown >= 1);
  assert.ok(first.summary.legacy_source_quality_warning_count >= 1);
  assert.deepEqual(first.inputs.optional_artifacts, {
    reporter_candidates: 'content/newsroom/2026-05-06/reporter-candidates.json',
    editor_draft: 'content/newsroom/2026-05-06/editor-draft.json',
    fact_check_report: 'content/newsroom/2026-05-06/fact-check-report.json',
    quality_report: 'content/newsroom/2026-05-06/quality-report.json'
  });
  assert.match(firstMarkdown, /- Unregistered candidates: 1/);
  assert.match(firstMarkdown, /## Source Quality Summary/);
  assert.match(firstMarkdown, /source_quality_status/);
  assert.ok(firstMarkdown.indexOf('| effective-camera | KEEP |') < firstMarkdown.indexOf('| official-broken | OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR |'));
  assert.ok(first.warnings.some(warning => warning.includes('synthetic-unknown-camera-blog')));
});
