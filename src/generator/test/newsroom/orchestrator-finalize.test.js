const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 main() 내부 attempt-loop 종료 후 finalize 블록(runtime-demoted shortlist 반영 +
// stale-claim scrub/산출물 + thin-week salvage)을 입력→동작으로 고정한다. 이 모듈의 책임은
// orchestration(loop local을 읽어 editor/factCheck/qualityReport/shortlistReport를 다시 묶고
// staleScrub을 이후 main()으로 넘김)이며, 엄격한 editor 계약 검증·품질 점수 계산 자체는
// 각각 editor-output-contract / newsletter-quality 테스트가 따로 검증한다. 무거운 협력자인
// validateEditor는 require.cache로 passthrough stub을 끼워, 결정론적으로 threading과
// 산출물 기록 계약만 고정한다(엄격한 claim binding fixture에 의존하지 않기 위함).

const EDITOR_VALIDATION_MODULE = '../../publish/orchestrator-editor-validation';
const FINALIZE_MODULE = '../../publish/orchestrator-finalize';

function withStubbedEditorValidation(run) {
  const validationKey = require.resolve(EDITOR_VALIDATION_MODULE);
  const finalizeKey = require.resolve(FINALIZE_MODULE);
  const realValidation = require.cache[validationKey];
  const validateEditorCalls = [];
  // validateEditor를 passthrough stub으로 교체: 받은 editor를 그대로 돌려주고 호출을 기록한다.
  require.cache[validationKey] = {
    id: validationKey,
    filename: validationKey,
    loaded: true,
    exports: {
      validateEditor: (value, date, reporter, options) => {
        validateEditorCalls.push({ value, date, reporter, options });
        return value;
      }
    }
  };
  delete require.cache[finalizeKey];
  try {
    const { finalizeDraftAfterAttempts } = require(FINALIZE_MODULE);
    return run(finalizeDraftAfterAttempts, validateEditorCalls);
  } finally {
    delete require.cache[finalizeKey];
    if (realValidation) {
      require.cache[validationKey] = realValidation;
    } else {
      delete require.cache[validationKey];
    }
    // finalize를 실제 validateEditor로 다시 로드해 다른 테스트에 stub이 새지 않게 한다.
    delete require.cache[require.resolve(FINALIZE_MODULE)];
  }
}

// scrubStaleClaims / buildNewsletterQualityReport / salvagePublishableSubset가 받아들이는
// 최소 editor: 섹션 하나에 sources 한 개. 깨끗한 PASS factCheck라 stale 제거·salvage가 없다.
function baseEditor() {
  return {
    date: '2026-05-08',
    sections: [
      {
        category: 'Android Camera',
        headline: 'CameraX release A',
        public_article: { headline: 'CameraX release A' },
        sources: [{ title: 'Source', url: 'https://example.com/a' }]
      }
    ]
  };
}

function passFactCheck() {
  return {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: [{ section_index: 0, publishable: true, reason: 'Useful to a Camera HAL SW engineer.' }]
  };
}

function baseArgs(newsroomDir, overrides = {}) {
  return {
    date: '2026-05-08',
    editor: baseEditor(),
    factCheck: passFactCheck(),
    qualityReport: null,
    reporter: { candidates: [] },
    shortlistReport: { selected_articles: [] },
    newsroomDir,
    seedEvidencePack: null,
    excludedSections: [],
    attemptedSections: [],
    ...overrides
  };
}

test('finalize는 threaded local을 반환하고 stale-claim 산출물을 기록한다', () => {
  withStubbedEditorValidation((finalizeDraftAfterAttempts, validateEditorCalls) => {
    const newsroomDir = tempRoot('finalize-');
    const out = finalizeDraftAfterAttempts(baseArgs(newsroomDir));

    // 이후 main()에서 쓰이는 5개 local이 모두 반환된다.
    assert.deepEqual(
      Object.keys(out).sort(),
      ['editor', 'factCheck', 'qualityReport', 'shortlistReport', 'staleScrub']
    );
    // qualityReport는 buildNewsletterQualityReport가 새로 만든 상태다.
    assert.equal(typeof out.qualityReport.status, 'string');
    // staleScrub.report는 main()의 generation-status/editor-chief brief에서 쓰이므로 반드시 반환된다.
    assert.ok(out.staleScrub && out.staleScrub.report);
    assert.equal(typeof out.staleScrub.report.status, 'string');
    // editor는 stale scrub을 거친(여기선 stub passthrough) 값이다.
    assert.equal(out.editor.sections.length, 1);

    // stale-claim 산출물 두 개가 newsroomDir에 기록된다.
    const staleJson = path.join(newsroomDir, 'stale-claim-report.json');
    const staleMd = path.join(newsroomDir, 'stale-claim-report.md');
    assert.ok(fs.existsSync(staleJson));
    assert.ok(fs.existsSync(staleMd));
    assert.deepEqual(JSON.parse(fs.readFileSync(staleJson, 'utf8')), out.staleScrub.report);

    // validateEditor는 strictClaims+requireStoryContract로 호출된다(첫 호출 = stale scrub editor).
    assert.ok(validateEditorCalls.length >= 1);
    assert.equal(validateEditorCalls[0].options.strictClaims, true);
    assert.equal(validateEditorCalls[0].options.requireStoryContract, true);
  });
});

test('runtime-demoted candidate가 없으면 shortlist를 다시 쓰지 않는다', () => {
  withStubbedEditorValidation((finalizeDraftAfterAttempts) => {
    const newsroomDir = tempRoot('finalize-');
    const out = finalizeDraftAfterAttempts(baseArgs(newsroomDir));
    // excludedSections가 비어 runtime-demoted가 없으므로 shortlist 재기록을 건너뛴다.
    assert.ok(!fs.existsSync(path.join(newsroomDir, 'shortlisted-candidates.json')));
    // shortlistReport는 입력 그대로 통과한다.
    assert.deepEqual(out.shortlistReport.selected_articles, []);
  });
});

test('runtime-demoted candidate가 있으면 shortlist를 재계산하고 다시 쓴다', () => {
  withStubbedEditorValidation((finalizeDraftAfterAttempts) => {
    const newsroomDir = tempRoot('finalize-');
    // excludedSections의 source url을 reporter candidate와 매칭해 runtime-demoted로 잡히게 한다.
    const demotedUrl = 'https://example.com/demoted';
    const args = baseArgs(newsroomDir, {
      reporter: {
        candidates: [{
          title: 'Demoted source',
          url: demotedUrl,
          source_candidate_hash: 'hash-demoted',
          relevance_bucket: 'direct_aosp_camera'
        }]
      },
      excludedSections: [{
        headline: 'Demoted article',
        sources: [{ title: 'Demoted source', url: demotedUrl }]
      }]
    });
    const out = finalizeDraftAfterAttempts(args);
    // runtime-demoted가 잡히면 shortlist를 재기록한다.
    assert.ok(fs.existsSync(path.join(newsroomDir, 'shortlisted-candidates.json')));
    assert.ok(Array.isArray(out.shortlistReport.demoted_candidates));
    assert.ok(out.shortlistReport.demoted_candidate_count >= 1);
  });
});

// #837: normalizeShortlistReport는 selected_articles를 primary_selected_articles(결정론 앵커)에서
// 다시 투영한다. runtime-demoted가 잡혀 여기서 재정규화가 돌면 재조정으로 좁혀진 main 집합이
// 결정론 집합으로 되감겨, 배열은 되감긴 값인데 카운트는 재조정 값이라는 자기모순이 생긴다.
test('finalize 재정규화가 재조정된 main 집합을 되감지 않는다 (#837)', () => {
  withStubbedEditorValidation((finalizeDraftAfterAttempts) => {
    const newsroomDir = tempRoot('finalize-');
    const demotedUrl = 'https://example.com/demoted';
    const article = (url) => ({
      url,
      url_hash: url,
      title: url,
      article_group_key: `group:${url}`,
      relevance_bucket: 'direct_aosp_camera'
    });
    // 결정론 앵커는 3건, 재조정된 현재 main 집합은 2건인 상태.
    const deterministic = [article('a'), article('b'), article('c')];
    const reconciled = deterministic.slice(0, 2);

    const out = finalizeDraftAfterAttempts(baseArgs(newsroomDir, {
      shortlistReport: {
        selected_articles: reconciled,
        primary_selected_articles: deterministic,
        shortlisted_candidates: deterministic,
        selected_article_count: reconciled.length,
        selected_group_count: reconciled.length,
        selected_representative_group_keys: reconciled.map(item => item.article_group_key),
        deterministic_selected_count: deterministic.length
      },
      reporter: {
        candidates: [{
          title: 'Demoted source',
          url: demotedUrl,
          source_candidate_hash: 'hash-demoted',
          relevance_bucket: 'direct_aosp_camera'
        }]
      },
      excludedSections: [{
        headline: 'Demoted article',
        sources: [{ title: 'Demoted source', url: demotedUrl }]
      }]
    }));

    assert.equal(out.shortlistReport.demoted_candidate_count, 1, '재정규화 경로를 실제로 탔는지 확인');
    assert.equal(
      out.shortlistReport.selected_articles.length,
      out.shortlistReport.selected_article_count,
      '배열과 카운트가 어긋나면 안 된다'
    );
    assert.equal(out.shortlistReport.selected_articles.length, 2, '재조정된 main 집합이 유지된다');
    assert.equal(out.shortlistReport.primary_selected_articles.length, 3, '결정론 앵커는 보존된다');
  });
});

// #869: stale-claim 산출물 기록을 salvage 뒤로 미루면, 그 사이 구간이 예외를 던질 때 스크럽
// 진단이 하나도 남지 않는다. 기록은 예외를 던질 수 있는 구간보다 앞에 있어야 한다.
test('스크럽 산출물은 뒤 단계가 예외를 던져도 남는다', () => {
  const postprocessKey = require.resolve('../../publish/fact-check-postprocess');
  const actualPostprocess = require('../../publish/fact-check-postprocess');
  const realPostprocess = require.cache[postprocessKey];
  require.cache[postprocessKey] = {
    id: postprocessKey,
    filename: postprocessKey,
    loaded: true,
    exports: {
      ...actualPostprocess,
      sanitizeClaimEvidenceIds: () => {
        throw new Error('sanitize failed');
      }
    }
  };
  try {
    withStubbedEditorValidation((finalizeDraftAfterAttempts) => {
      const newsroomDir = tempRoot('finalize-');
      assert.throws(() => finalizeDraftAfterAttempts(baseArgs(newsroomDir)), /sanitize failed/);
      assert.ok(fs.existsSync(path.join(newsroomDir, 'stale-claim-report.json')));
      assert.ok(fs.existsSync(path.join(newsroomDir, 'stale-claim-report.md')));
    });
  } finally {
    if (realPostprocess) {
      require.cache[postprocessKey] = realPostprocess;
    } else {
      delete require.cache[postprocessKey];
    }
  }
});

// #869: salvage가 적용되면 발행되는 텍스트는 salvage 안쪽 재스크럽이 만든 것이다. 산출물과
// 반환되는 staleScrub.report가 그 재스크럽 report여야, 발행본을 설명하는 진단이
// generation-status와 editor-chief brief로 간다. salvage 앞에서 쓴 report가 그대로 남으면
// 이미 지워진 기사를 가리키는 진단이 발행본을 설명하게 된다.
const QUALITY_MODULE = '../../quality/newsletter-quality';

function salvagedStaleClaimReport() {
  return {
    schema_version: 1,
    date: '2026-05-08',
    status: 'PASS',
    removed_sections: [{ index: 2, headline: 'Dropped by salvage', source_urls: [], source_titles: [] }],
    dropped_selected_groups: [],
    restored_to_keep_minimum: [],
    final_section_sources: [],
    stale_claim_items_removed: [{
      field: 'briefing',
      text: 'salvage 재스크럽이 지운 문장이다.',
      stale_claims: ['imx576'],
      unsupported_release_claims: [],
      action: 'removed-sentence'
    }],
    unsupported_release_claims_removed: [],
    unused_references_removed: [],
    retained_release_claims: [],
    hard_failures: []
  };
}

// validateEditor를 "표식을 붙여 돌려주는" stub으로 바꾼다. 그래야 반환된 staleScrub.editor가
// 검증 전 salvage.editor인지 검증을 통과한 값인지 구분된다.
function withStubbedSalvage(salvageResult, run) {
  const validationKey = require.resolve(EDITOR_VALIDATION_MODULE);
  const qualityKey = require.resolve(QUALITY_MODULE);
  const finalizeKey = require.resolve(FINALIZE_MODULE);
  const realValidation = require.cache[validationKey];
  const realQuality = require.cache[qualityKey];
  const actualQuality = require(QUALITY_MODULE);
  const salvageCalls = [];
  require.cache[validationKey] = {
    id: validationKey,
    filename: validationKey,
    loaded: true,
    exports: { validateEditor: value => ({ ...value, validated: true }) }
  };
  require.cache[qualityKey] = {
    id: qualityKey,
    filename: qualityKey,
    loaded: true,
    exports: {
      ...actualQuality,
      buildNewsletterQualityReport: () => ({ status: 'NEEDS_FIX', deductions: [] }),
      salvagePublishableSubset: (...args) => {
        salvageCalls.push(args);
        return salvageResult;
      }
    }
  };
  delete require.cache[finalizeKey];
  try {
    const { finalizeDraftAfterAttempts } = require(FINALIZE_MODULE);
    return run(finalizeDraftAfterAttempts, salvageCalls);
  } finally {
    delete require.cache[finalizeKey];
    if (realValidation) require.cache[validationKey] = realValidation; else delete require.cache[validationKey];
    if (realQuality) require.cache[qualityKey] = realQuality; else delete require.cache[qualityKey];
    delete require.cache[require.resolve(FINALIZE_MODULE)];
  }
}

test('#869: salvage가 적용되면 산출물과 staleScrub이 salvage의 재스크럽 report를 쓴다', () => {
  const staleClaimReport = salvagedStaleClaimReport();
  const salvage = {
    editor: { ...baseEditor(), salvaged: true },
    factCheck: passFactCheck(),
    qualityReport: { status: 'PASS', deductions: [] },
    staleClaimReport,
    dropped_section_count: 1,
    kept_section_count: 1
  };

  withStubbedSalvage(salvage, (finalizeDraftAfterAttempts, salvageCalls) => {
    const newsroomDir = tempRoot('finalize-salvage-');
    const out = finalizeDraftAfterAttempts(baseArgs(newsroomDir));

    assert.equal(salvageCalls.length, 1, 'salvage 경로를 실제로 탔는지 확인');

    // 산출물이 salvage의 report로 덮어써졌다.
    const written = JSON.parse(fs.readFileSync(path.join(newsroomDir, 'stale-claim-report.json'), 'utf8'));
    assert.deepEqual(written, staleClaimReport);
    assert.match(
      fs.readFileSync(path.join(newsroomDir, 'stale-claim-report.md'), 'utf8'),
      /salvage 재스크럽이 지운 문장이다./
    );

    // main()으로 돌아가는 report도 같은 값이다.
    assert.deepEqual(out.staleScrub.report, staleClaimReport);
    // staleScrub.editor는 검증을 통과한 값이다. 검증 전 salvage.editor를 실으면 안 된다.
    assert.equal(out.staleScrub.editor.validated, true);
    assert.equal(out.staleScrub.editor.salvaged, true);
    assert.equal(out.editor.salvaged, true);
    assert.equal(out.qualityReport.status, 'PASS');
  });
});
