const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 main() 내부의 결정론적 발행 가부 결정 + generation-status 기록 블록(render/headline
// 기록 직후, terminal recovery routing 직전)을 입력→동작으로 고정한다. 이 모듈의 책임은
// generationStatus 분류 → editorial-reviewable 판정 → reviewable이 아니면 공개 산출물 기록 +
// npm validate 실행 → finalPublishReady/files 계산 → generation-status.json 기록이다.
// 순수 분류(classifyGenerationStatus)는 실제 모듈을 그대로 쓰고, 부수효과를 내는 무거운 협력자
// (runValidate / 공개 산출물 writer / weekly writer / status builder / generation-status writer)는
// require.cache로 stub을 끼워 결정론적으로 control-flow와 반환 계약만 고정한다.

const DECISION_MODULE = '../../publish/orchestrator-publish-decision';
const VALIDATE_RUNNER = '../../publish/orchestrator-validate-runner';
const TERMINAL_CONTRACTS = '../../publish/orchestrator-terminal-contracts';
const STATUS_BUILDERS = '../../publish/orchestrator-status-builders';
const ARTIFACT_WRITERS = '../../publish/orchestrator-artifact-writers';
const RECOVERY_WRITERS = '../../publish/orchestrator-recovery-writers';
const WEEKLY_OUTPUT = '../../render/weekly-newsletter-output';

function stubModule(key, exports) {
  const resolved = require.resolve(key);
  const prev = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  return { resolved, prev };
}

// 무거운 협력자를 모두 stub으로 교체하고 호출 기록을 모아 control-flow를 고정한다.
function withStubbedCollaborators(run) {
  const decisionKey = require.resolve(DECISION_MODULE);
  const calls = {
    runValidate: 0,
    updateNewsletterData: [],
    persistHeadlineStateArtifacts: [],
    writeGenerationStatus: [],
    writeSelectionDiagnosticsArtifact: 0,
    weekly: 0,
    // #870: weekly writer에 넘어간 병합 검증 클로저. 이 배선은 writer를 stub으로 갈아끼우면
    // 보이지 않으므로 클로저 자체를 붙잡아 직접 호출해 확인한다.
    weeklyValidateMerged: null,
    selectionStatusExtraOptions: []
  };
  const stubs = [
    stubModule(VALIDATE_RUNNER, {
      // 비reviewable 경로에서만 호출되어야 한다. 호출 횟수로 그 분기를 검증한다.
      runValidate: () => {
        calls.runValidate += 1;
        return { ok: true, text: 'stub validate ok' };
      }
    }),
    stubModule(TERMINAL_CONTRACTS, {
      updateNewsletterData: (date, editor) => { calls.updateNewsletterData.push({ date, editor }); },
      // exposureCoverage 없이 반환해 shortlist 재기록 분기를 건너뛴다.
      persistHeadlineStateArtifacts: (args) => {
        calls.persistHeadlineStateArtifacts.push(args);
        return { files: ['articles/state/article-exposure-history.json'], exposureCoverage: null };
      }
    }),
    stubModule(STATUS_BUILDERS, {
      // 받은 status/extra를 그대로 담아 반환해, 어떤 값이 흘러갔는지 검증할 수 있게 한다.
      buildGenerationStatus: ({ date, status, extra }) => ({ date, status, ...extra }),
      editorSemanticStatusExtra: () => ({}),
      // #837: 어떤 coverage 입력이 status로 흘러가는지 검증할 수 있게 options를 붙잡는다.
      selectionStatusExtra: (report, options) => {
        calls.selectionStatusExtraOptions.push(options);
        return {};
      }
    }),
    stubModule(ARTIFACT_WRITERS, {
      writeGenerationStatus: (artifact) => { calls.writeGenerationStatus.push(artifact); }
    }),
    stubModule(RECOVERY_WRITERS, {
      writeSelectionDiagnosticsArtifact: () => { calls.writeSelectionDiagnosticsArtifact += 1; }
    }),
    stubModule(WEEKLY_OUTPUT, {
      writeWeeklyNewsletterArtifacts: async (args) => {
        calls.weekly += 1;
        calls.weeklyValidateMerged = args.validateMerged;
        return { files: ['articles/newsletters/weekly/x/index.html'], mergeWarnings: [], mergeDecisions: [], weeklyKey: 'wk' };
      }
    })
  ];
  delete require.cache[decisionKey];
  try {
    const { decidePublishReadinessAndWriteStatus } = require(DECISION_MODULE);
    return run(decidePublishReadinessAndWriteStatus, calls);
  } finally {
    delete require.cache[decisionKey];
    for (const { resolved, prev } of stubs) {
      if (prev) {
        require.cache[resolved] = prev;
      } else {
        delete require.cache[resolved];
      }
    }
    // 실제 협력자로 다시 로드해 다른 테스트에 stub이 새지 않게 한다.
    delete require.cache[decisionKey];
  }
}

function passEditor() {
  return {
    sections: [
      { category: 'Android Camera', headline: 'A', sources: [{ url: 'https://example.com/a' }] },
      { category: 'Camera HAL', headline: 'B', sources: [{ url: 'https://example.com/b' }] }
    ]
  };
}

function passQualityReport() {
  return { status: 'PASS', score: 95, threshold: 60, deductions: [] };
}

function baseRetryHistory() {
  return [{
    locked_article_headlines: [],
    regenerated_sections: [],
    failed_sections: [],
    skipped_repair_sections: [],
    rejected_duplicate_headlines: []
  }];
}

function baseStaleScrub() {
  return { report: { status: 'CLEAN' } };
}

function baseArgs(newsroomDir, newsletterDir, overrides = {}) {
  return {
    date: '2026-05-08',
    editor: passEditor(),
    factCheck: { status: 'PASS', must_fix: [], source_gap_count: 0 },
    qualityReport: passQualityReport(),
    shortlistReport: {
      underfilled: false,
      publish_ready: true,
      composition_mode: 'normal',
      editor_review_required: false
    },
    retryHistory: baseRetryHistory(),
    staleScrub: baseStaleScrub(),
    newsroomDir,
    newsletterDir,
    newsletterMarkdown: '# stub markdown',
    newsletterHtmlContent: '<html>stub</html>',
    mustFixCount: 0,
    todoFound: false,
    emptySourceSections: [],
    baseFiles: ['articles/content/newsroom/2026-05-08/shortlisted-candidates.json'],
    ...overrides
  };
}

test('비reviewable PASS 입력: 공개 산출물을 쓰고 validate를 돌리며 publish-ready로 status를 기록한다', async () => {
  await withStubbedCollaborators(async (decide, calls) => {
    const newsroomDir = tempRoot('publish-decision-newsroom-');
    const newsletterDir = tempRoot('publish-decision-newsletter-');
    const out = await decide(baseArgs(newsroomDir, newsletterDir));

    // 발행 가부 결정 결과.
    assert.equal(out.generationStatus, 'PASS');
    assert.equal(out.editorialReviewable, false);
    assert.equal(out.shouldWritePublicArtifacts, true);
    assert.equal(out.failureKind, '');

    // 공개 산출물(newsletter.md/index.html)이 디스크에 기록된다.
    assert.ok(fs.existsSync(path.join(newsletterDir, 'newsletter.md')));
    assert.ok(fs.existsSync(path.join(newsletterDir, 'index.html')));
    assert.equal(fs.readFileSync(path.join(newsletterDir, 'newsletter.md'), 'utf8'), '# stub markdown');

    // 공개 경로에서만 호출되는 협력자가 실제로 호출된다.
    assert.equal(calls.updateNewsletterData.length, 1);
    assert.equal(calls.persistHeadlineStateArtifacts.length, 1);
    assert.equal(calls.weekly, 1);

    // 비reviewable이므로 runValidate가 실제로 실행되고 그 결과가 흐른다.
    assert.equal(calls.runValidate, 1);
    assert.equal(out.validateResult.ok, true);

    // 강한 PASS이므로 finalPublishReady가 true로 status extra에 흐른다.
    assert.equal(out.generationStatusArtifact.publish_gate_passed ?? out.generationStatusArtifact.public_output_expected, true);

    // files에 공개 산출물 상대경로가 들어간다.
    assert.ok(out.files.includes('articles/newsletters/2026-05-08/newsletter.md'));
    assert.ok(out.files.includes('articles/newsletters/2026-05-08/index.html'));
    assert.ok(out.files.includes('articles/data/newsletters.json'));

    // generation-status가 정확히 한 번 기록된다.
    assert.equal(calls.writeGenerationStatus.length, 1);
    assert.equal(out.generationStatusArtifact.status, 'PASS');
  });
});

test('reviewable(NEEDS_FIX) 입력: 공개 산출물을 쓰지 않고 validate를 건너뛴다', async () => {
  await withStubbedCollaborators(async (decide, calls) => {
    const newsroomDir = tempRoot('publish-decision-newsroom-');
    const newsletterDir = tempRoot('publish-decision-newsletter-');
    const out = await decide(baseArgs(newsroomDir, newsletterDir, {
      factCheck: { status: 'NEEDS_FIX', must_fix: [{ id: 'x' }], source_gap_count: 0 },
      mustFixCount: 1
    }));

    // 발행 가부 결정 결과.
    assert.equal(out.generationStatus, 'NEEDS_FIX');
    assert.equal(out.editorialReviewable, true);
    assert.equal(out.shouldWritePublicArtifacts, false);
    assert.equal(out.failureKind, 'editorial_reviewable');

    // 공개 산출물이 기록되지 않는다.
    assert.ok(!fs.existsSync(path.join(newsletterDir, 'newsletter.md')));
    assert.ok(!fs.existsSync(path.join(newsletterDir, 'index.html')));
    assert.equal(calls.updateNewsletterData.length, 0);
    assert.equal(calls.weekly, 0);

    // reviewable이라 runValidate를 건너뛰고 skip 사유가 담긴다.
    assert.equal(calls.runValidate, 0);
    assert.equal(out.validateResult.ok, false);
    assert.match(out.validateResult.text, /skipped public validation/);

    // files는 공개 산출물 없이 baseFiles만 담는다.
    assert.deepEqual(out.files, ['articles/content/newsroom/2026-05-08/shortlisted-candidates.json']);

    // generation-status는 여전히 한 번 기록된다(reviewable diagnostics 경로).
    assert.equal(calls.writeGenerationStatus.length, 1);
    assert.equal(out.generationStatusArtifact.status, 'NEEDS_FIX');
  });
});

// #837: editor가 기록한 hard block이 status coverage 입력으로 실제 전달되는지 잠근다.
// 이 배선이 없으면 salvage/구조적 demote로 빠진 그룹이 "설명 없는 손실"로 보여
// 정상 발행에도 group_coverage_ok=false가 찍힌다.
test('editor가 기록한 hard block을 status coverage 입력으로 넘긴다', async () => {
  await withStubbedCollaborators(async (decide, calls) => {
    const newsroomDir = tempRoot('publish-decision-newsroom-');
    const newsletterDir = tempRoot('publish-decision-newsletter-');
    await decide(baseArgs(newsroomDir, newsletterDir, {
      editor: {
        ...baseArgs(newsroomDir, newsletterDir).editor,
        hard_blocked_groups: [{
          article_group_key: 'group:dropped',
          hard_block_reason: 'thin-week salvage dropped unpublishable article',
          reason_code: 'quality_hard_blocker'
        }]
      }
    }));

    assert.equal(calls.selectionStatusExtraOptions.length, 1);
    const options = calls.selectionStatusExtraOptions[0];
    assert.deepEqual(
      options.hardBlockedGroups.map(item => item.article_group_key),
      ['group:dropped']
    );
  });
});

// #870: weekly 병합 검증기에 (1) 병합 전 원본과 (2) 오늘 editor draft의 계약 마커가 실제로
// 전달되는지 잠근다. weekly writer는 stub이라 이 배선은 다른 어떤 테스트에도 잡히지 않는다.
// 원본이 없으면 지어낸 출처를 가려낼 수 없고, 마커가 없으면 story 계약 기사가 항상
// mismatch로 떨어져 병합 채택 경로가 통째로 닫힌다.
test('weekly 병합 검증기에 병합 전 원본과 이슈 계약 마커를 넘긴다', async () => {
  await withStubbedCollaborators(async (decide, calls) => {
    const newsroomDir = tempRoot('publish-decision-newsroom-');
    const newsletterDir = tempRoot('publish-decision-newsletter-');
    await decide(baseArgs(newsroomDir, newsletterDir, {
      editor: {
        ...baseArgs(newsroomDir, newsletterDir).editor,
        public_contract_version: 'story-v1',
        generation_contract_version: 1
      }
    }));

    assert.equal(typeof calls.weeklyValidateMerged, 'function');
    const originArticle = {
      headline: 'A',
      sources: [{ title: 'A', url: 'https://example.com/a' }]
    };
    const mergedArticle = {
      headline: 'A merged',
      sources: [{ title: 'A', url: 'https://example.com/a' }],
      public_article: {
        headline: 'A merged',
        lead: '병합된 기사의 도입 문단입니다. 이번 주 카메라 드라이버 변경을 한 줄로 정리했습니다.',
        body_paragraphs: [
          '첫 문단은 드라이버가 무엇을 바꾸는지 설명합니다. 상위 파이프라인이 버퍼를 준비하는 방식에 이어집니다.',
          '두 번째 문단은 확인할 지점을 정리합니다. 스트림을 길게 돌려 프레임 드롭을 봅니다.'
        ],
        camera_hal_takeaway: '드라이버가 선언한 포맷이 실제 스트림에서 유지되는지 확인해야 합니다.',
        reader_checkpoints: ['MIPI CSI-2 레인 수를 바꿔가며 전송이 끊기지 않는지 확인한다.'],
        source_links: [{ title: 'A', url: 'https://example.com/a' }]
      }
    };

    // 원본이 넘어오지 않으면 이 판정 자체가 불가능하다.
    const fabricated = calls.weeklyValidateMerged(mergedArticle, {
      existing: { headline: 'other', sources: [{ title: 'other', url: 'https://example.com/other' }] },
      incoming: { headline: 'other2', sources: [{ title: 'other2', url: 'https://example.com/other2' }] }
    });
    assert.equal(fabricated.ok, false);
    assert.ok(fabricated.issues.some(issue => issue.type === 'merged_article_source_not_in_origin'));

    // 마커가 넘어오지 않으면 story 계약 마커가 없는 이 기사는 mismatch로 잡히지 않는다.
    const markerChecked = calls.weeklyValidateMerged(mergedArticle, {
      existing: originArticle,
      incoming: originArticle
    });
    assert.equal(markerChecked.ok, false);
    assert.ok(markerChecked.issues.some(issue => issue.type === 'story_contract_version_mismatch'));
  });
});
