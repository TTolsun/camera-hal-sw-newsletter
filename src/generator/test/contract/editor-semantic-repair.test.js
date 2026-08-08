'use strict';

const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../../editor/editor-output-contract');
const {
  section,
  editor,
  normalizeSection,
  reporterForClaimTests,
  tempNewsroomDir,
  readJson,
  buildGroupCoverageFixture
} = require('../../../shared/test/helpers/editor-builders');

const DATE = '2026-05-08';

test('semantic repair deterministically restores missing article_sections from section fields', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({
    sections: [
      section(1, { article_sections: undefined }),
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic article_sections repair.');
    }
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].article_sections, {
    verified_facts: ['Fact 1'],
    background_context: 'Evidence 1 Headline 1 was selected from dated source evidence for Camera HAL readers. The practical interpretation for Headline 1 stays limited to stream and metadata validation.',
    hal_driver_impact: 'HAL perspective 1',
    action_items: ['Action 1', 'HAL check 1'],
    team_share_points: 'HAL perspective 1',
    do_not_claim: ['Do not overstate direct HAL impact.']
  });
  assert.equal(require('fs').existsSync(path.join(newsroomDir, 'editor-invalid-attempt-1.json')), true);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-1.json'));
  assert.equal(errorArtifact.field, 'sections.article_sections');
});

test('semantic repair deterministically restores legacy sections and HAL Signal Capsule without LLM repair', async () => {
  const newsroomDir = tempNewsroomDir();
  const firstSection = section(1, {
    article_sections: undefined,
    hal_signal_capsule: undefined,
    action_items: ['Run Camera ITS and stream metadata checks for Headline 1 within 2 weeks.'],
    sources: [{
      title: 'Source 1',
      url: 'https://example.com/source-1',
      date: '2026-05-07'
    }]
  });
  const publicArticle = JSON.parse(JSON.stringify(firstSection.public_article));
  const sources = JSON.parse(JSON.stringify(firstSection.sources));
  const draft = editor({
    sections: [
      firstSection,
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic schema repair.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].public_article, publicArticle);
  assert.deepEqual(result.editor.sections[0].sources, sources);
  assert.deepEqual(result.editor.sections[0].hal_signal_capsule, {
    why_now: 'Source date 2026-05-07 provides the dated context for this HAL validation signal.',
    reader_owners: ['camera_hal_owner', 'camera_test_owner'],
    check_within_2_weeks: 'Run Camera ITS and stream metadata checks for Headline 1 within 2 weeks.',
    impact_axes: ['framework_hal_contract', 'stream_buffer_metadata'],
    do_not_overstate: ['Do not overstate direct HAL impact.']
  });
});

test('semantic repair preserves complete HAL Signal Capsule during deterministic article section repair', async () => {
  const capsule = {
    why_now: 'Custom dated HAL signal is already present.',
    reader_owners: ['camera_driver_owner'],
    check_within_2_weeks: 'Keep the existing driver validation task.',
    impact_axes: ['driver_image_pipeline'],
    do_not_overstate: ['Preserve this existing caution.']
  };
  const draft = editor({
    sections: [
      section(1, {
        article_sections: undefined,
        hal_signal_capsule: capsule
      }),
      section(2),
      section(3)
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed when complete capsule exists.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  assert.deepEqual(result.editor.sections[0].hal_signal_capsule, capsule);
});

test('semantic repair falls back to LLM repair with deterministic reason code for missing semantic fields', async () => {
  const draft = editor({
    sections: [
      section(1, {
        article_sections: undefined,
        public_article: {
          ...section(1).public_article,
          camera_hal_takeaway: '',
          editorial_story: { editor_take: 'Source 범위 안에서만 확인합니다.' }
        }
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, undefined);
  assert.deepEqual(validationError.deterministic_repair_failure_reason_codes, ['missing_hal_driver_impact']);
});

test('semantic repair does not create why_now from generation date alone', async () => {
  const draft = editor({
    sections: [
      section(1, {
        hal_signal_capsule: undefined,
        sources: [{
          title: 'Source 1',
          url: 'https://example.com/source-1'
        }]
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('missing_why_now_context'));
});

test('semantic repair records unknown axis and owner mapping failures before LLM fallback', async () => {
  const draft = editor({
    sections: [
      section(1, {
        hal_signal_capsule: undefined,
        hal_impact_axes: ['future_camera_lane'],
        reader_owners: [],
        relevance_bucket: '',
        sources: [{
          title: 'Source 1',
          url: 'https://example.com/source-1',
          date: '2026-05-07'
        }]
      }),
      section(2),
      section(3)
    ]
  });
  let validationError;

  await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    normalizeSection,
    repairFn: async payload => {
      validationError = payload.validationError;
      return editor();
    }
  });

  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('unknown_impact_axis'));
  assert.ok(validationError.deterministic_repair_failure_reason_codes.includes('missing_reader_owner_mapping'));
});

test('excessive briefing items are repaired and initial diagnostics are written', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });
  let repairCalled = false;

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    repairFn: async ({ invalidEditor, validationError }) => {
      repairCalled = true;
      assert.equal(validationError.details.field, 'briefing');
      return { ...invalidEditor, briefing: ['one', 'two', 'three'] };
    }
  });

  assert.equal(repairCalled, true);
  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.deepEqual(result.editor.briefing, ['one', 'two', 'three']);
  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-attempt-1.json')).briefing.length, 4);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-1.json'));
  assert.equal(errorArtifact.details.actualCount, 4);
  assert.match(errorArtifact.message, /got 4/);
});

test('missing briefing items are repaired with clear diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two'] });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 2,
    stage: 'editor attempt 2/2',
    newsroomDir,
    normalizeSection,
    repairFn: async ({ invalidEditor }) => ({
      ...invalidEditor,
      briefing: ['one', 'two', 'three']
    })
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-attempt-2.json'));
  assert.equal(errorArtifact.details.expectedCount, 3);
  assert.equal(errorArtifact.details.actualCount, 2);
});

test('non-array briefing reports the actual type clearly', () => {
  const draft = editor({ briefing: 'one' });

  assert.throws(
    () => validateEditorOutputContract(draft, DATE, { normalizeSection }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'briefing');
      assert.equal(error.details.actualType, 'string');
      assert.match(error.message, /got non-array string/);
      return true;
    }
  );
});

test('repair preserves sections and sources', async () => {
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    attempt: 1,
    stage: 'editor attempt 1/1',
    normalizeSection,
    repairFn: async ({ invalidEditor }) => ({
      ...invalidEditor,
      briefing: ['one', 'two', 'three']
    })
  });

  assert.deepEqual(
    result.editor.sections.map(item => item.sources),
    draft.sections.map(item => item.sources)
  );
});

test('repair that changes sections or sources fatally fails and writes repair diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 3,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two', 'three'],
        sections: [
          {
            ...invalidEditor.sections[0],
            sources: [{ title: 'Changed source', url: 'https://example.com/changed' }],
            public_article: {
              ...invalidEditor.sections[0].public_article,
              source_links: [{ title: 'Changed source', url: 'https://example.com/changed', source_role: 'primary' }]
            }
          },
          ...invalidEditor.sections.slice(1)
        ]
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.repair_patch');
      assert.equal(error.details.reason, 'repair_patch_contract_violation');
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-repair-attempt-3.json')).sections[0].sources[0].url, 'https://example.com/changed');
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-repair-attempt-3.json'));
  assert.equal(errorArtifact.details.field, 'sections.repair_patch');
  assert.equal(errorArtifact.repairAttempted, true);
  assert.equal(errorArtifact.repairSucceeded, false);
});

test('repair that drops a selected section fatally fails (#482 2026-06-03 count-drift shape)', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });
  const selectedCount = draft.sections.length;
  assert.ok(selectedCount >= 2, 'fixture must have at least two selected sections');

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 5,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two', 'three'],
        // The 2026-06-03 failure: repair silently changed the stable identity
        // set by emitting fewer sections than were selected.
        sections: invalidEditor.sections.slice(0, selectedCount - 1)
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.repair_patch');
      assert.equal(error.details.reason, 'repair_patch_contract_violation');
      assert.ok(error.details.violations.some(violation => violation.reason === 'section_count_changed'));
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );
});

test('repair output with invalid briefing writes repair diagnostics', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ briefing: ['one', 'two', 'three', 'four'] });

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 4,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async ({ invalidEditor }) => ({
        ...invalidEditor,
        briefing: ['one', 'two']
      })
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'briefing');
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(readJson(path.join(newsroomDir, 'editor-invalid-repair-attempt-4.json')).briefing.length, 2);
  const errorArtifact = readJson(path.join(newsroomDir, 'editor-validation-error-repair-attempt-4.json'));
  assert.equal(errorArtifact.details.actualCount, 2);
});

test('DEEP repair that drops a selected group fails re-validation and reports failure', async () => {
  // 회귀 방지: DEEP 모드에서 repair 콜백이 선택된 그룹 하나(group-b)를 떨어뜨린
  // 1개 섹션 에디터를 반환하면, repair 재검증의 selected group coverage 게이트가
  // 이를 잡아내어 repair 성공으로 보고하지 않아야 한다.
  const newsroomDir = tempNewsroomDir();
  const { editor: groupDroppedEditor, reporter } = buildGroupCoverageFixture();
  // 초기 value는 repairable한 briefing 실패를 일으켜 repair 경로로 진입시킨다.
  const invalidValue = JSON.parse(JSON.stringify(groupDroppedEditor));
  invalidValue.briefing = ['one', 'two', 'three', 'four'];
  let repairCalled = false;

  await assert.rejects(
    repairEditorOutputContract({
      value: invalidValue,
      date: '2026-05-31',
      reporter,
      attempt: 1,
      stage: 'editor attempt 1/2',
      newsroomDir,
      normalizeSection,
      publishMode: 'DEEP',
      // repair 콜백은 briefing은 고쳤지만 여전히 group-b를 떨어뜨린 1섹션 에디터를 반환한다.
      repairFn: async () => {
        repairCalled = true;
        return JSON.parse(JSON.stringify(groupDroppedEditor));
      }
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.match(error.message, /selected group coverage/);
      assert.equal(error.repairAttempted, true);
      assert.equal(error.repairSucceeded, false);
      return true;
    }
  );

  assert.equal(repairCalled, true);
});

test('unrepairable section-count semantic failures are not repaired', async () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor({ sections: [] });
  let repairCalled = false;

  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      attempt: 5,
      stage: 'editor attempt 1/1',
      newsroomDir,
      normalizeSection,
      repairFn: async () => {
        repairCalled = true;
        return editor();
      }
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections');
      assert.equal(error.repairAttempted, false);
      return true;
    }
  );

  assert.equal(repairCalled, false);
  assert.equal(readJson(path.join(newsroomDir, 'editor-validation-error-attempt-5.json')).details.field, 'sections');
});

// #660: editor가 대표 사실만 claim으로 쓰고 부수 verified_fact의 claim을 빠뜨리는 부분 미커버
// (claims는 있는데 일부 fact가 missing_matching_fact_claim)가 4/6주 LLM semantic repair를
// 발동시키던 지배 트리거다. claims가 이미 있는 섹션도 미커버 fact만 결정론 backfill로 채운다.
test('semantic repair deterministically backfills fact claims for uncovered verified facts in sections with existing claims', async () => {
  const newsroomDir = tempNewsroomDir();
  const uncoveredFact = '센서 출력 데이터 전송은 별도의 직렬 인터페이스를 통해 이루어집니다.';
  const existingClaim = {
    claim_id: 'claim-1',
    text: 'Fact 1',
    claim_type: 'fact',
    evidence_ids: ['evidence-1'],
    source_urls: ['https://example.com/source-1'],
    impact_level: 'app_api_or_framework_adjacent',
    overclaim_risk: 'low'
  };
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1', uncoveredFact],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: [existingClaim]
      })
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    reporter: reporterForClaimTests(),
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    strictClaims: true,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic partial-coverage backfill.');
    }
  });

  assert.equal(result.repairAttempted, true);
  assert.equal(result.repairSucceeded, true);
  assert.equal(result.deterministicRepair, true);
  const claims = result.editor.sections[0].claims;
  assert.equal(claims.length, 2);
  assert.deepEqual(claims[0], existingClaim);
  assert.equal(claims[1].text, uncoveredFact);
  assert.equal(claims[1].claim_type, 'fact');
  assert.deepEqual(claims[1].evidence_ids, ['evidence-1']);
  assert.notEqual(claims[1].claim_id, existingClaim.claim_id);
});

test('partial-coverage backfill generates non-colliding claim ids next to editor-authored ids', async () => {
  const newsroomDir = tempNewsroomDir();
  const uncoveredFact = '센서 출력 데이터 전송은 별도의 직렬 인터페이스를 통해 이루어집니다.';
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1', uncoveredFact],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: [{
          claim_id: 'article-1-fact-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['evidence-1'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
    ]
  });

  const result = await repairEditorOutputContract({
    value: draft,
    date: DATE,
    reporter: reporterForClaimTests(),
    attempt: 1,
    stage: 'editor attempt 1/2',
    newsroomDir,
    normalizeSection,
    strictClaims: true,
    repairFn: async () => {
      throw new Error('LLM repair should not be needed for deterministic partial-coverage backfill.');
    }
  });

  assert.equal(result.deterministicRepair, true);
  const claimIds = result.editor.sections[0].claims.map(claim => claim.claim_id);
  assert.equal(new Set(claimIds).size, claimIds.length);
});

test('partial-coverage backfill fails closed to LLM repair when the uncovered fact cannot bind evidence', async () => {
  const newsroomDir = tempNewsroomDir();
  // protected token(v9.87.6)이 evidence 텍스트에 없어 strict 오라클이 바인딩을 거부한다.
  const unbindableFact = '이 드라이버는 v9.87.6 릴리스에서 확인되었습니다.';
  const draft = editor({
    sections: [
      section(1, {
        article_sections: {
          verified_facts: ['Fact 1', unbindableFact],
          background_context: 'Background 1',
          hal_driver_impact: 'HAL perspective 1',
          action_items: ['Action 1'],
          team_share_points: 'Summary 1'
        },
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['evidence-1'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
    ]
  });

  let repairPayload = null;
  await assert.rejects(
    repairEditorOutputContract({
      value: draft,
      date: DATE,
      reporter: reporterForClaimTests(),
      attempt: 1,
      stage: 'editor attempt 1/2',
      newsroomDir,
      normalizeSection,
      strictClaims: true,
      repairFn: async payload => {
        repairPayload = payload;
        throw new Error('stop after recording the fallback payload');
      }
    }),
    error => error instanceof EditorSemanticValidationError
  );

  assert.ok(repairPayload, 'LLM repair fallback should run when deterministic backfill cannot bind');
  assert.deepEqual(
    repairPayload.validationError.deterministic_repair_failure_reason_codes,
    ['unbindable_verified_fact']
  );
});
