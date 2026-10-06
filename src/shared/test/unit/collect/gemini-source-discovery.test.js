const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectionIntentPath,
  manualCandidatesPath,
  mergedCandidateManifestPath,
  mergedCandidatesPath,
  seedCandidatesPath,
  seedEvidencePackPath
} = require('../../../common/artifact-paths');
const {
  validateCandidateArtifact,
  writeManualCandidateArtifacts,
  writeMergedCandidateArtifacts
} = require('../../../common/candidate-artifacts');
const {
  FAILED_LLM_CREDENTIALS,
  SEED_ONLY_LLM_CREDENTIALS_MISSING,
  mergeNotYetEligibleByUrl,
  run: runSourceDiscoveryBoundary,
  splitMergeStageNotYetEligible
} = require('../../../../discovery/gemini-source-discovery-boundary');
const {
  calculateSourceQuality
} = require('../../../../discovery/score-source-candidates');
const {
  sourceDiscoveryCandidateStats
} = require('../../../common/candidate-artifacts');

function registry() {
  return {
    sources: [
      {
        id: 'android',
        name: 'Android Developers',
        sourceUrl: 'https://developer.android.com/',
        category: 'android',
        reliability: 'official',
        linkedEvidencePolicy: {
          enabled: true,
          allowedDomains: ['developer.android.com']
        }
      },
      {
        id: 'camerax-release-notes',
        name: 'CameraX Release Notes',
        sourceUrl: 'https://developer.android.com/jetpack/androidx/releases/camera',
        category: 'camera-api',
        priority: 'high',
        reliability: 'official',
        enabled: true,
        candidateOnly: false,
        requiresCrossCheck: false,
        collectionModeHint: 'release-note-watch',
        evidenceGranularityHint: 'versioned_release_row',
        linkedEvidencePolicy: {
          enabled: true,
          allowedDomains: ['developer.android.com']
        }
      }
    ]
  };
}

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-source-discovery-'));
  fs.mkdirSync(path.join(root, 'src', 'shared', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'shared', 'data', 'news-sources.json'), JSON.stringify({
    schemaVersion: 2,
    sources: registry().sources
  }, null, 2), 'utf8');
  return root;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function candidatePayload(date = '2026-05-16') {
  return {
    schema_version: 5,
    date,
    newsletter_date: date,
    generated_at: '2026-05-16T00:00:00.000Z',
    candidates: [{
      title: 'Manual CameraX release',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera#manual',
      source_id: 'camerax-release-notes',
      source: 'CameraX Release Notes',
      reliability: 'official',
      finalSelectionEligibility: 'short',
      final_selection_eligibility: 'short',
      main_eligible: true
    }],
    failures: []
  };
}

// #1186: 제안 단계(LLM이 URL을 제안하고 승격하는 경로)를 제거했다. 남은 LLM 호출은 linked evidence
// 선택 하나뿐이고, 제안 산출물은 새로 쓰지 않는다. llm_used는 그대로 true라서 Stage 3 strict
// 검증이 manifest의 필수 report 항목을 요구한다 — 제안 report를 쓰지 않으면서 그 항목이 남아
// 있으면 그 주 발행이 terminal failure로 끝난다. 그래서 manifest 검증까지 함께 잠근다.
test('enabled boundary makes only the linked evidence LLM call and writes no proposal artifacts', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = {
    ...candidatePayload(date),
    coverage: {
      coverage_week_key: '2026-W19',
      coverage_start_date: '2026-05-04',
      coverage_end_date: '2026-05-10',
      coverage_end_exclusive_at: '2026-05-11T00:00:00.000Z'
    },
    not_yet_eligible: [],
    carry_forward_status: 'not_applicable'
  };
  payload.candidates[0].outgoing_links = [{
    url: 'https://github.com/androidx/androidx/releases/tag/camera-1.6.1',
    text: 'CameraX 1.6.1 release',
    source_field: 'rss.body',
    extraction_method: 'html_anchor'
  }];
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const prompts = [];
  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true',
      GEMINI_API_KEY: 'test-key',
      GEMINI_RETRY_DELAYS_MS: '0'
    },
    callLlmJsonBudgetedImpl: async (_stage, _system, prompt, _schema, options = {}) => {
      prompts.push(prompt);
      options.budget.mergeDiagnostics({
        model_usage: {
          'source_discovery#0': {
            stage_key: 'source_discovery#0',
            stage_id: 'source_discovery',
            quality_attempt: 0,
            label: 'sourceDiscovery',
            parent_run_key: null,
            models: { fake: { requests: 1, successes: 1 } }
          }
        },
        cost_report: { calls: [{ stage_key: 'source_discovery#0', stage_id: 'source_discovery', model: 'fake' }] }
      });
      return {
        selections: [{
          url: 'https://github.com/androidx/androidx/releases/tag/camera-1.6.1',
          is_newsworthy: true,
          reason: 'CameraX release'
        }]
      };
    },
    fetchImpl: async () => ({ ok: false, status: 404, text: async () => '' })
  });

  assert.equal(result.status, 'PASS');
  assert.equal(prompts.length, 1, '제안 호출이 남아 있으면 LLM 호출이 2회가 된다');
  assert.match(prompts[0], /linked evidence URL/);

  const collectedDir = path.join(root, 'articles', 'content', 'collected-news', date);
  const newsroomDir = path.join(root, 'articles', 'content', 'newsroom', date);
  assert.equal(fs.existsSync(path.join(collectedDir, 'gemini-candidates.json')), false);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'gemini-source-proposals.json')), false);
  assert.equal(fs.existsSync(path.join(newsroomDir, 'gemini-source-proposal-validation-report.json')), false);
  assert.equal(result.gemini_candidate_artifact, undefined);
  assert.equal(result.gemini_source_proposals, undefined);
  assert.equal(result.proposal_validation_report, undefined);

  const merged = readJson(mergedCandidatesPath(root, date));
  assert.deepEqual(merged.candidates.map(item => item.origin || 'manual'), ['manual', 'gemini_linked_discovery']);

  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.llm_used, true);
  assert.equal(manifest.merge_mode, 'gemini_source_discovery');
  assert.equal(manifest.derived_candidate_count, 1);
  for (const field of [
    'proposal_validation_report',
    'gemini_candidate_artifact',
    'gemini_candidate_artifact_hash',
    'gemini_candidate_count',
    'gemini_new_unique_url_count',
    'gemini_publishable_candidate_count'
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(manifest, field), false, `${field}는 더 이상 manifest에 없어야 한다`);
  }
  const usage = readJson(path.join(newsroomDir, 'gemini-usage-report.json'));
  assert.equal(usage.calls.length, 1);

  const validated = validateCandidateArtifact({
    root,
    date,
    candidatePath: mergedCandidatesPath(root, date),
    manifestPath: mergedCandidateManifestPath(root, date),
    requireManifest: true,
    validationMode: 'strict',
    expectedManifestType: 'merged_candidate',
    expectedLlmUsed: 'any'
  });
  assert.equal(validated.validation_status, 'validated');
});

test('enabled boundary writes seed-only artifacts when Gemini credentials are missing after approved seed expansion', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  writeJson(collectionIntentPath(root, date), {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: [{
      seed_id: 'seed-camerax',
      url: 'https://developer.android.com/jetpack/androidx/releases/camera',
      expected_topic: 'CameraX release notes'
    }],
    keyword_hints: []
  });
  writeManualCandidateArtifacts({
    root,
    date,
    payload: candidatePayload(date),
    sourceCount: 1
  });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
    },
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => '' },
      text: async () => '<html><head><title>CameraX 1.6.1 release notes</title><meta name="datePublished" content="2026-05-15"></head><body>2026-05-15 CameraX 1.6.1 fixes Android camera stream validation.</body></html>'
    })
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.status_detail, SEED_ONLY_LLM_CREDENTIALS_MISSING);
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), true);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), true);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'collected-news', date, 'gemini-candidates.json')), false);
  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.status, 'PASS');
  assert.equal(manifest.status_detail, SEED_ONLY_LLM_CREDENTIALS_MISSING);
  assert.equal(manifest.merge_mode, 'seed_evidence_expansion');
  assert.equal(manifest.llm_used, false);
  assert.equal(manifest.seed_used, true);
  const report = fs.readFileSync(path.join(root, 'articles', 'content', 'newsroom', date, 'gemini-source-discovery-report.md'), 'utf8');
  assert.match(report, /\| status_detail \| SEED_ONLY_LLM_CREDENTIALS_MISSING \|/);
  assert.match(report, /Gemini credentials가 없어 Gemini discovery는 건너뛰었습니다/);
});

test('merge-stage overflow promotes carry_forward_status to overflow even when stage 1 was under the cap', async () => {
  const root = tempRoot();
  const date = '2026-04-25';
  const coverage = {
    coverage_week_key: '2026-W17',
    coverage_start_date: '2026-04-20',
    coverage_end_date: '2026-04-26',
    coverage_end_exclusive_at: '2026-04-27T00:00:00.000Z'
  };
  const payload = candidatePayload(date);
  payload.coverage = coverage;
  // Stage 1 finished healthy and under the not-yet-eligible cap (60) -- the merge stage is the
  // only place this run overflows, so a regression that forgets to re-derive
  // carry_forward_status after the merge-stage cap would leave this 'loaded' value in place.
  payload.not_yet_eligible = Array.from({ length: 58 }, (_, index) => ({
    title: `Stage 1 not-yet-eligible ${index}`,
    url: `https://developer.android.com/stage1-notyet-${index}`,
    publishedAt: '2099-02-01',
    published_date: '2099-02-01'
  }));
  payload.not_yet_eligible_overflow = false;
  payload.carry_forward_status = 'loaded';

  // stage 1은 상한(60)보다 2건 모자란 58건을 넘겼고(overflow=false), 병합 단계가 seed 근거 확장으로
  // coverage 이후 날짜의 seed 후보를 4건 새로 더한다. 62건이 상한을 넘기는 곳은 병합 단계뿐이다.
  const seedUrls = Array.from(
    { length: 4 },
    (_, index) => `https://developer.android.com/notyet-eligible-seed-${index}`
  );
  writeJson(collectionIntentPath(root, date), {
    schema_version: 1,
    newsletter_date: date,
    seed_urls: seedUrls.map((url, index) => ({
      seed_id: `seed-${index}`,
      url,
      expected_topic: 'CameraX release notes'
    })),
    keyword_hints: []
  });
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });

  const result = await runSourceDiscoveryBoundary({
    root,
    date,
    env: {
      NEWSLETTER_DATE: date,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true',
      GEMINI_API_KEY: 'test-key'
    },
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: fetchFutureDatedSeedPage
  });

  assert.equal(result.status, 'PASS');
  const merged = readJson(mergedCandidatesPath(root, date));
  assert.equal(merged.not_yet_eligible_overflow, true);
  assert.equal(merged.carry_forward_status, 'overflow');
  const manifest = readJson(mergedCandidateManifestPath(root, date));
  assert.equal(manifest.not_yet_eligible_overflow, true);
  assert.equal(manifest.carry_forward_status, 'overflow');
});

test('enabled boundary without seed keeps missing credential path strictly no-mutation', async () => {
  const root = tempRoot();
  const date = '2026-05-16';
  const payload = candidatePayload(date);
  writeManualCandidateArtifacts({ root, date, payload, sourceCount: 1 });
  writeMergedCandidateArtifacts({ root, date, payload });
  const beforeMerged = fs.readFileSync(mergedCandidatesPath(root, date), 'utf8');
  const beforeManifest = fs.readFileSync(mergedCandidateManifestPath(root, date), 'utf8');

  await assert.rejects(
    () => runSourceDiscoveryBoundary({
      root,
      date,
      env: {
        NEWSLETTER_DATE: date,
        NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
      }
    }),
    error => error.status === FAILED_LLM_CREDENTIALS
  );

  assert.equal(fs.readFileSync(mergedCandidatesPath(root, date), 'utf8'), beforeMerged);
  assert.equal(fs.readFileSync(mergedCandidateManifestPath(root, date), 'utf8'), beforeManifest);
  assert.equal(fs.existsSync(seedCandidatesPath(root, date)), false);
  assert.equal(fs.existsSync(seedEvidencePackPath(root, date)), false);
  assert.equal(fs.existsSync(path.join(root, 'articles', 'content', 'newsroom', date, 'gemini-source-discovery-report.md')), false);
  assert.equal(fs.existsSync(manualCandidatesPath(root, date)), true);
});

test('source gap risk has bucket precedence over high numeric source quality', () => {
  const item = calculateSourceQuality({
    id: 'source-gap',
    title: 'Official CameraX release note',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera',
    reliability: 'official',
    relevanceScore: 100,
    cameraHalRelevanceScore: 100,
    published_date: '2026-05-15',
    summary: 'CameraX stream buffer metadata release note.',
    source_gap_risk: true
  }, {
    newsletterDate: '2026-05-16'
  });

  assert.equal(item.source_quality_bucket, 'blocked_candidate');
});

test('source discovery stats count manual and merged URLs without any Gemini proposal fields', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' }
    ],
    mergedCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' },
      { url: 'https://example.com/a' },
      { url: 'https://example.com/c' },
      { url: 'https://example.com/c' }
    ]
  });

  // 제안 단계(#1186)와 함께 gemini_* 통계를 모두 없앴다. 키 집합을 통째로 고정한다.
  assert.deepEqual(stats, {
    manual_candidate_count: 2,
    manual_unique_url_count: 2,
    merged_candidate_count: 5,
    merged_unique_url_count: 3
  });
});

test('source discovery stats separate seed evidence records', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { url: 'https://example.com/a' }
    ],
    seedCandidates: [
      {
        url: 'https://example.com/a',
        origin: 'seed_url_evidence',
        finalSelectionEligibility: 'short',
        source_gap_risk: false,
        main_eligible: true,
        primary_evidence_ids: ['seed-a-primary-01']
      },
      {
        url: 'https://example.com/b',
        origin: 'seed_url_evidence',
        finalSelectionEligibility: 'watchlist',
        source_gap_risk: true,
        main_eligible: false
      }
    ],
    mergedCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://example.com/b' }
    ]
  });

  assert.equal(stats.seed_candidate_count, 2);
  assert.equal(stats.seed_unique_url_count, 2);
  assert.equal(stats.seed_new_unique_url_count, 1);
  assert.equal(stats.seed_enriched_duplicate_count, 1);
  assert.equal(stats.seed_publishable_candidate_count, 1);
  assert.equal(stats.seed_primary_evidence_count, 1);
});

test('source discovery stats report linked evidence derived candidates only when status is provided', () => {
  const base = sourceDiscoveryCandidateStats({
    manualCandidates: [{ url: 'https://example.com/a' }],
    mergedCandidates: [{ url: 'https://example.com/a' }]
  });
  assert.equal(Object.prototype.hasOwnProperty.call(base, 'linked_discovery_status'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(base, 'derived_candidate_count'), false);

  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [{ url: 'https://example.com/a' }],
    derivedCandidates: [
      {
        url: 'https://developer.android.com/jetpack/androidx/releases/camera',
        origin: 'gemini_linked_discovery',
        finalSelectionEligibility: 'short',
        source_gap_risk: false,
        main_eligible: true
      },
      {
        url: 'https://example.com/a',
        origin: 'gemini_linked_discovery',
        finalSelectionEligibility: 'watchlist',
        source_gap_risk: true,
        main_eligible: false
      }
    ],
    mergedCandidates: [
      { url: 'https://example.com/a' },
      { url: 'https://developer.android.com/jetpack/androidx/releases/camera' }
    ],
    linkedDiscoveryStatus: 'FOUND_DERIVED_CANDIDATES'
  });

  assert.equal(stats.linked_discovery_status, 'FOUND_DERIVED_CANDIDATES');
  assert.equal(stats.derived_candidate_count, 2);
  assert.equal(stats.derived_unique_url_count, 2);
  assert.equal(stats.derived_new_unique_url_count, 1);
  assert.equal(stats.derived_publishable_candidate_count, 1);
});

test('source discovery stats use URL aliases for manual, seed and derived candidates', () => {
  const stats = sourceDiscoveryCandidateStats({
    manualCandidates: [
      { source_candidate_url: 'https://example.com/a' }
    ],
    seedCandidates: [
      {
        articleUrl: 'https://example.com/a',
        origin: 'seed_url_evidence',
        finalSelectionEligibility: 'main',
        source_gap_risk: false,
        main_eligible: true
      },
      {
        normalized_url: 'https://example.com/b',
        origin: 'seed_url_evidence',
        final_selection_eligibility: 'short',
        source_gap_risk: false,
        main_eligible: true
      },
      {
        // URL이 없는 후보는 publishable로 세지 않는다.
        origin: 'seed_url_evidence',
        finalSelectionEligibility: 'main',
        source_gap_risk: false,
        main_eligible: true
      }
    ],
    mergedCandidates: [
      { source_candidate_url: 'https://example.com/a' },
      { normalized_url: 'https://example.com/b' }
    ]
  });

  assert.equal(stats.manual_candidate_count, 1);
  assert.equal(stats.manual_unique_url_count, 1);
  assert.equal(stats.seed_candidate_count, 3);
  assert.equal(stats.seed_unique_url_count, 2);
  assert.equal(stats.seed_new_unique_url_count, 1);
  assert.equal(stats.seed_enriched_duplicate_count, 1);
  assert.equal(stats.seed_publishable_candidate_count, 2);
  assert.equal(stats.merged_candidate_count, 2);
  assert.equal(stats.merged_unique_url_count, 2);
});

test('merge-stage not-yet-eligible split keeps manual-origin candidates regardless of date', () => {
  const coverage = {
    coverage_week_key: '2026-W17',
    coverage_start_date: '2026-04-20',
    coverage_end_date: '2026-04-26',
    coverage_end_exclusive_at: '2026-04-27T00:00:00.000Z'
  };
  const manualFutureDated = {
    url: 'https://example.com/manual-future',
    title: 'Manual candidate published after coverage end',
    publishedAt: '2026-05-01'
    // origin is absent, as stage 1 manual/carry candidates carry no discovery origin tag.
  };
  const linkedPastDated = {
    url: 'https://example.com/linked-past',
    title: 'Linked discovery candidate published inside the coverage window',
    origin: 'gemini_linked_discovery',
    publishedAt: '2026-04-22'
  };
  const linkedFutureDated = {
    url: 'https://example.com/linked-future',
    title: 'Linked discovery candidate published after coverage end',
    origin: 'gemini_linked_discovery',
    publishedAt: '2026-05-01'
  };
  // 제안 단계(#1186)가 만들던 옛 origin이다. 병합 단계가 새로 만드는 후보가 아니므로 날짜와 무관하게
  // 거르지 않는다 — carry-forward로 들어온 옛 후보는 stage 1이 이미 경계를 적용했다.
  const legacyProposalFutureDated = {
    url: 'https://example.com/legacy-proposal-future',
    title: 'Legacy proposal-stage candidate carried forward',
    origin: 'gemini_discovery',
    publishedAt: '2026-05-01'
  };
  const seedFutureDated = {
    url: 'https://example.com/seed-future',
    title: 'Seed evidence candidate published after coverage end',
    origin: 'seed_url_evidence',
    publishedAt: '2026-05-02'
  };
  const linkedUndated = {
    url: 'https://example.com/linked-undated',
    title: 'Linked discovery candidate with no extracted date',
    origin: 'gemini_linked_discovery'
    // gemini_linked_discovery 후보는 날짜가 없는 채로 만들어질 수 있다 — classifyCoverageWindow가
    // 'unknown'을 돌려주므로 not_yet_eligible로 걸러지지 않는다(안전한 기본값).
  };

  const { eligible, notYetEligible } = splitMergeStageNotYetEligible(
    [manualFutureDated, linkedPastDated, linkedFutureDated, seedFutureDated, linkedUndated, legacyProposalFutureDated],
    coverage
  );

  assert.deepEqual(notYetEligible, [linkedFutureDated, seedFutureDated]);
  assert.deepEqual(eligible, [manualFutureDated, linkedPastDated, linkedUndated, legacyProposalFutureDated]);
});

test('merge-stage not-yet-eligible split skips filtering entirely without a coverage object', () => {
  const candidates = [
    { url: 'https://example.com/a', origin: 'seed_url_evidence', publishedAt: '2099-01-01' }
  ];
  assert.deepEqual(splitMergeStageNotYetEligible(candidates, null), {
    eligible: candidates,
    notYetEligible: []
  });
});

test('not-yet-eligible URL merge dedupes stage 1 and merge-stage lists, preferring the stage 1 entry', () => {
  const stage1List = [
    { url: 'https://example.com/shared', title: 'Stage 1 version' },
    { url: 'https://example.com/only-stage-1', title: 'Only in stage 1' }
  ];
  const mergeStageList = [
    { url: 'https://example.com/shared', title: 'Merge stage version' },
    { url: 'https://example.com/only-merge-stage', title: 'Only in merge stage' }
  ];

  const merged = mergeNotYetEligibleByUrl(stage1List, mergeStageList);

  assert.deepEqual(merged.map(item => item.url), [
    'https://example.com/shared',
    'https://example.com/only-stage-1',
    'https://example.com/only-merge-stage'
  ]);
  const shared = merged.find(item => item.url === 'https://example.com/shared');
  assert.equal(shared.title, 'Stage 1 version');
});

// #938: seed-only(credential 실패)·discovery 비활성 경로는 selection 파이프라인을 타지 않고
// 병합 후보를 그대로 다음 단계로 넘긴다. 두 경로가 coverage 경계 [E, U)를 적용하지 않으면
// 이번 주보다 최신인 seed_url_evidence 후보가 not_yet_eligible에 못 들어가 carry-forward
// 원천에서 빠지고, degraded 실행에서 이슈 간 유실된다. 아래 두 테스트는 각 경로를 따로 잠근다.
const DEGRADED_COVERAGE_DATE = '2026-04-25';
const DEGRADED_COVERAGE = {
  coverage_week_key: '2026-W17',
  coverage_start_date: '2026-04-20',
  coverage_end_date: '2026-04-26',
  coverage_end_exclusive_at: '2026-04-27T00:00:00.000Z'
};
const DEGRADED_SEED_URL = 'https://developer.android.com/jetpack/androidx/releases/camera';
const DEGRADED_MANUAL_URL = 'https://developer.android.com/jetpack/androidx/releases/camera#manual';

function degradedCoveragePayload() {
  return {
    schema_version: 5,
    date: DEGRADED_COVERAGE_DATE,
    newsletter_date: DEGRADED_COVERAGE_DATE,
    generated_at: '2026-04-25T00:00:00.000Z',
    coverage: DEGRADED_COVERAGE,
    not_yet_eligible: [],
    not_yet_eligible_overflow: false,
    carry_forward_status: 'loaded',
    candidates: [{
      title: 'Manual candidate inside the coverage window',
      url: DEGRADED_MANUAL_URL,
      source_id: 'camerax-release-notes',
      source: 'CameraX Release Notes',
      reliability: 'official',
      publishedAt: '2026-04-22',
      published_date: '2026-04-22',
      finalSelectionEligibility: 'short',
      final_selection_eligibility: 'short',
      main_eligible: true
    }],
    failures: []
  };
}

// seed URL 원문은 coverage_end_date 이후 날짜라, seed 확장이 만드는 seed_url_evidence 후보는
// not_yet_eligible이어야 한다.
async function fetchFutureDatedSeedPage(url) {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: () => '' },
    text: async () => '<html><head><title>Future CameraX release</title>'
      + '<meta name="datePublished" content="2099-01-01"></head>'
      + '<body>2099-01-01 CameraX release dated after this coverage week.</body></html>'
  };
}

function prepareDegradedRoot() {
  const root = tempRoot();
  writeJson(collectionIntentPath(root, DEGRADED_COVERAGE_DATE), {
    schema_version: 1,
    newsletter_date: DEGRADED_COVERAGE_DATE,
    seed_urls: [{
      seed_id: 'seed-camerax',
      url: DEGRADED_SEED_URL,
      expected_topic: 'CameraX release notes'
    }],
    keyword_hints: []
  });
  writeManualCandidateArtifacts({
    root,
    date: DEGRADED_COVERAGE_DATE,
    payload: degradedCoveragePayload(),
    sourceCount: 1
  });
  return root;
}

function assertSeedCandidateCarriedForward(root) {
  const merged = readJson(mergedCandidatesPath(root, DEGRADED_COVERAGE_DATE));
  assert.deepEqual(
    (merged.candidates || []).map(item => item.url),
    [DEGRADED_MANUAL_URL],
    'coverage 경계 밖 seed_url_evidence 후보가 candidates에 남아 있으면 안 된다'
  );
  assert.deepEqual(
    (merged.not_yet_eligible || []).map(item => item.url),
    [DEGRADED_SEED_URL],
    'coverage 경계 밖 seed_url_evidence 후보는 not_yet_eligible로 넘어가야 한다'
  );
}

test('seed-only credential-failure path moves future-dated seed candidates to not_yet_eligible', async () => {
  const root = prepareDegradedRoot();

  const result = await runSourceDiscoveryBoundary({
    root,
    date: DEGRADED_COVERAGE_DATE,
    env: {
      NEWSLETTER_DATE: DEGRADED_COVERAGE_DATE,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
    },
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: fetchFutureDatedSeedPage
  });

  assert.equal(result.status, 'PASS');
  assert.equal(result.status_detail, SEED_ONLY_LLM_CREDENTIALS_MISSING);
  assertSeedCandidateCarriedForward(root);
});

// stage 1이 이미 상한을 넘겨 항목을 잘라낸 뒤라면, 병합 단계 합산이 상한 이내로 떨어져도
// 그 유실 사실은 사라지지 않는다. overflow는 단조 유지되어야 한다.
test('merge stage keeps a stage 1 not_yet_eligible overflow flag even when the combined list fits the cap', async () => {
  const root = tempRoot();
  const payload = degradedCoveragePayload();
  payload.not_yet_eligible = Array.from({ length: 5 }, (unused, index) => ({
    title: `Stage 1 not-yet-eligible ${index}`,
    url: `https://developer.android.com/stage1-notyet-${index}`,
    publishedAt: '2099-02-01',
    published_date: '2099-02-01'
  }));
  payload.not_yet_eligible_overflow = true;
  payload.carry_forward_status = 'overflow';
  writeJson(collectionIntentPath(root, DEGRADED_COVERAGE_DATE), {
    schema_version: 1,
    newsletter_date: DEGRADED_COVERAGE_DATE,
    seed_urls: [{
      seed_id: 'seed-camerax',
      url: DEGRADED_SEED_URL,
      expected_topic: 'CameraX release notes'
    }],
    keyword_hints: []
  });
  writeManualCandidateArtifacts({ root, date: DEGRADED_COVERAGE_DATE, payload, sourceCount: 1 });

  await runSourceDiscoveryBoundary({
    root,
    date: DEGRADED_COVERAGE_DATE,
    env: {
      NEWSLETTER_DATE: DEGRADED_COVERAGE_DATE,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'true'
    },
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: fetchFutureDatedSeedPage
  });

  const merged = readJson(mergedCandidatesPath(root, DEGRADED_COVERAGE_DATE));
  // 합산 6건은 상한(60) 안이라 이번 cap 자체는 overflow가 아니다.
  assert.equal(merged.not_yet_eligible.length, 6);
  assert.equal(
    merged.not_yet_eligible_overflow,
    true,
    'stage 1이 이미 잘라낸 사실을 병합 단계가 false로 덮으면 안 된다'
  );
});

test('disabled pass-through path moves future-dated seed candidates to not_yet_eligible', async () => {
  const root = prepareDegradedRoot();

  const result = await runSourceDiscoveryBoundary({
    root,
    date: DEGRADED_COVERAGE_DATE,
    env: {
      NEWSLETTER_DATE: DEGRADED_COVERAGE_DATE,
      NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY: 'false'
    },
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: fetchFutureDatedSeedPage
  });

  assert.equal(result.status, 'PASS');
  assertSeedCandidateCarriedForward(root);
});

test('collector hands at most 50 final candidates to the later stages', () => {
  const { MAX_FINAL_CANDIDATES } = require('../../../cli/collect-news-candidates');
  assert.equal(MAX_FINAL_CANDIDATES, 50);
});
