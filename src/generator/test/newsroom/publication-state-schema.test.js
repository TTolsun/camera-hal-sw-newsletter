const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PUBLIC_STATES,
  RUN_MODES,
  PUBLIC_ARTIFACT_POLICIES,
  PUBLIC_ARTIFACT_SOURCES,
  RECONCILIATION_ACTIONS,
  DIAGNOSTICS_STATUSES,
  STATE_OUTPUT_CONTRACT,
  PublicationStateContractError,
  isTrue,
  latestDiagnosticsOnly,
  classifyPublicState,
  resolvePublicStateFields,
  assertPublicStateOutput,
  assertPublicationStateSchemaComplete,
  runModeForPublicState,
  requiresEditorReview,
  archiveSyncEnabled
} = require('../../publish/publication-state-schema');

const OK_STRUCTURE = { ok: true, errors: [] };
const BROKEN_STRUCTURE = { ok: false, errors: ['index.html missing'] };
const VALID_RETENTION = { exists: true, valid: true, error: '' };
const INVALID_RETENTION = { exists: true, valid: false, error: 'public-retention.json missing approved_at' };
const NO_RETENTION = { exists: false, valid: false, error: '' };

// 1. classifyPublicState — PUBLISH_READY
test('classifyPublicState: final_publish_ready + public_newsletter_ready + structure.ok -> PUBLISH_READY', () => {
  assert.equal(
    classifyPublicState({
      status: { final_publish_ready: true, public_newsletter_ready: true },
      publicStructure: OK_STRUCTURE,
      retention: NO_RETENTION
    }),
    PUBLIC_STATES.PUBLISH_READY
  );
});

// 2. classifyPublicState — REVIEW_ONLY
test('classifyPublicState: review flags + structure.ok -> REVIEW_ONLY_PUBLIC_CREATED', () => {
  assert.equal(
    classifyPublicState({
      status: { final_publish_ready: false, review_publication_ready: true, public_newsletter_ready: true },
      publicStructure: OK_STRUCTURE,
      retention: NO_RETENTION
    }),
    PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED
  );
});

// 3. classifyPublicState — DIAGNOSTICS_ONLY_BUT_KEEP (retention 보존)
test('classifyPublicState: diagnostics + valid retention + structure.ok -> DIAGNOSTICS_ONLY_BUT_KEEP', () => {
  assert.equal(
    classifyPublicState({
      status: { status: 'UNDERFILLED_NEEDS_FIX', final_publish_ready: false, public_newsletter_ready: false, review_publication_ready: false },
      publicStructure: OK_STRUCTURE,
      retention: VALID_RETENTION
    }),
    PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC
  );
});

// 4. classifyPublicState — DIAGNOSTICS_ONLY (fail-closed 기본값)
test('classifyPublicState: nothing ready -> DIAGNOSTICS_ONLY (fail-closed)', () => {
  assert.equal(
    classifyPublicState({
      status: { status: 'NEEDS_FIX', final_publish_ready: false, public_newsletter_ready: false, review_publication_ready: false },
      publicStructure: OK_STRUCTURE,
      retention: NO_RETENTION
    }),
    PUBLIC_STATES.DIAGNOSTICS_ONLY
  );
});

// 5. REVIEW 예외 무효화 회귀: 구조가 깨지면 review 플래그가 있어도 REVIEW가 아님 (발행차단 재현)
test('classifyPublicState: review flags but structure broken -> DIAGNOSTICS_ONLY (review invalidation)', () => {
  assert.equal(
    classifyPublicState({
      status: { final_publish_ready: false, review_publication_ready: true, public_newsletter_ready: true },
      publicStructure: BROKEN_STRUCTURE,
      retention: NO_RETENTION
    }),
    PUBLIC_STATES.DIAGNOSTICS_ONLY
  );
  // 그리고 필드 해석은 review-구조-깨짐 전용 정책으로 간다
  const fields = resolvePublicStateFields({
    publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY,
    status: { review_publication_ready: true },
    publicStructure: BROKEN_STRUCTURE,
    retention: NO_RETENTION
  });
  assert.equal(fields.publicArtifactPolicy, PUBLIC_ARTIFACT_POLICIES.REVIEW_PUBLICATION_INVALID_PUBLIC_STRUCTURE);
  assert.equal(fields.effectiveHomepageVisible, false);
  assert.match(fields.reason, /review_publication_ready was true but public structure was invalid/);
});

// 6. isTrue 직렬화 동등성: 문자열 'true'와 boolean true가 동일하게 분류됨
test('isTrue + classifyPublicState: string "true" classifies same as boolean true', () => {
  assert.equal(isTrue('true'), true);
  assert.equal(isTrue(true), true);
  assert.equal(isTrue('false'), false);
  assert.equal(isTrue(false), false);
  assert.equal(isTrue(undefined), false);
  assert.equal(
    classifyPublicState({
      status: { final_publish_ready: 'true', public_newsletter_ready: 'true' },
      publicStructure: OK_STRUCTURE,
      retention: NO_RETENTION
    }),
    PUBLIC_STATES.PUBLISH_READY
  );
});

// 7. resolvePublicStateFields — 각 상태별 정확한 정책/action/source/노출/reason
test('resolvePublicStateFields: PUBLISH_READY golden fields', () => {
  assert.deepEqual(
    resolvePublicStateFields({ publicState: PUBLIC_STATES.PUBLISH_READY, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE }),
    {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.LATEST_RUN,
      action: RECONCILIATION_ACTIONS.NONE_LATEST_PUBLIC_READY,
      reason: 'latest run is final publish-ready and public structure is valid'
    }
  );
});

test('resolvePublicStateFields: REVIEW_ONLY golden fields', () => {
  const fields = resolvePublicStateFields({ publicState: PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE });
  assert.equal(fields.effectiveHomepageVisible, true);
  assert.equal(fields.publicArtifactPolicy, PUBLIC_ARTIFACT_POLICIES.LATEST_REVIEW_PUBLICATION_READY);
  assert.equal(fields.publicArtifactSource, PUBLIC_ARTIFACT_SOURCES.LATEST_RUN);
  assert.equal(fields.action, RECONCILIATION_ACTIONS.UPSERTED_LATEST_PUBLIC_ENTRY);
});

test('resolvePublicStateFields: RETAINED golden fields (previous_run source)', () => {
  const fields = resolvePublicStateFields({ publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC, status: {}, retention: VALID_RETENTION, publicStructure: OK_STRUCTURE });
  assert.equal(fields.effectiveHomepageVisible, true);
  assert.equal(fields.publicArtifactPolicy, PUBLIC_ARTIFACT_POLICIES.RETAIN_EXISTING_EDITOR_APPROVED_PUBLIC);
  assert.equal(fields.publicArtifactSource, PUBLIC_ARTIFACT_SOURCES.PREVIOUS_RUN);
  assert.equal(fields.action, RECONCILIATION_ACTIONS.RETAINED_EXISTING_PUBLIC_WITH_METADATA);
});

// 8. retention 무효 fallthrough
test('resolvePublicStateFields: DIAGNOSTICS_ONLY with invalid retention -> INVALID_RETENTION_IGNORED', () => {
  const fields = resolvePublicStateFields({
    publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY,
    status: {},
    retention: INVALID_RETENTION,
    publicStructure: OK_STRUCTURE
  });
  assert.equal(fields.effectiveHomepageVisible, false);
  assert.equal(fields.publicArtifactPolicy, PUBLIC_ARTIFACT_POLICIES.INVALID_RETENTION_IGNORED);
  assert.equal(fields.action, RECONCILIATION_ACTIONS.INVALID_RETENTION_IGNORED_AND_REMOVED_INDEX_ENTRY);
  assert.match(fields.reason, /invalid public-retention\.json ignored/);
});

// 8b. 일반 숨김 (existingPublicArtifactDetected 분기 메시지)
test('resolvePublicStateFields: plain DIAGNOSTICS_ONLY hide reason depends on existing artifact', () => {
  const withExisting = resolvePublicStateFields({
    publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE, existingPublicArtifactDetected: true
  });
  assert.equal(withExisting.publicArtifactPolicy, PUBLIC_ARTIFACT_POLICIES.HIDE_EXISTING_PUBLIC_ARTIFACT_AFTER_LATEST_DIAGNOSTICS_ONLY);
  assert.match(withExisting.reason, /not public-ready and no valid retention metadata exists/);

  const withoutExisting = resolvePublicStateFields({
    publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE, existingPublicArtifactDetected: false
  });
  assert.match(withoutExisting.reason, /has no effective public artifacts/);
});

// 9. runModeForPublicState 매핑
test('runModeForPublicState: maps every public state', () => {
  assert.equal(runModeForPublicState(PUBLIC_STATES.PUBLISH_READY), RUN_MODES.PUBLISH_READY);
  assert.equal(runModeForPublicState(PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED), RUN_MODES.REVIEW_ONLY_PUBLIC);
  assert.equal(runModeForPublicState(PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC), RUN_MODES.DIAGNOSTICS_ONLY_RETAINED_PUBLIC);
  assert.equal(runModeForPublicState(PUBLIC_STATES.DIAGNOSTICS_ONLY), RUN_MODES.DIAGNOSTICS_ONLY);
  assert.equal(runModeForPublicState('UNKNOWN_STATE'), RUN_MODES.DIAGNOSTICS_ONLY);
});

// 10. 1급으로 승격된 필드: requiresEditorReview / archiveSyncEnabled
test('requiresEditorReview: first-class per-state field', () => {
  assert.equal(requiresEditorReview(PUBLIC_STATES.PUBLISH_READY), false);
  assert.equal(requiresEditorReview(PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED), true);
  assert.equal(requiresEditorReview(PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC), false);
  assert.equal(requiresEditorReview(PUBLIC_STATES.DIAGNOSTICS_ONLY), true);
});

test('archiveSyncEnabled: only PUBLISH_READY and REVIEW_ONLY sync archive (current behavior)', () => {
  assert.equal(archiveSyncEnabled(PUBLIC_STATES.PUBLISH_READY), true);
  assert.equal(archiveSyncEnabled(PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED), true);
  assert.equal(archiveSyncEnabled(PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC), false);
  assert.equal(archiveSyncEnabled(PUBLIC_STATES.DIAGNOSTICS_ONLY), false);
});

// 11. latestDiagnosticsOnly: diagnostics_only 단락 + DIAGNOSTICS_STATUSES 멤버십 AND 조건
test('latestDiagnosticsOnly: diagnostics_only=true short-circuits', () => {
  assert.equal(latestDiagnosticsOnly({ diagnostics_only: true }), true);
  assert.equal(latestDiagnosticsOnly({ diagnostics_only: 'true' }), true);
});

test('latestDiagnosticsOnly: requires DIAGNOSTICS_STATUSES membership when no ready flags', () => {
  for (const status of DIAGNOSTICS_STATUSES) {
    assert.equal(latestDiagnosticsOnly({ status }), true, `expected diagnostics for status=${status}`);
  }
  // ready 플래그가 하나라도 true면 diagnostics 아님
  assert.equal(latestDiagnosticsOnly({ status: 'NEEDS_FIX', public_newsletter_ready: true }), false);
  // DIAGNOSTICS_STATUSES 밖이면 diagnostics 아님
  assert.equal(latestDiagnosticsOnly({ status: 'PASS' }), false);
  // generation_status 폴백도 인식
  assert.equal(latestDiagnosticsOnly({ generation_status: 'QUALITY_NEEDS_FIX' }), true);
});

// 12. 출력 계약 자기검증: 4개 상태 모두 정의/계약/run mode 완비 (#650)
test('assertPublicationStateSchemaComplete: current schema is complete', () => {
  assert.equal(assertPublicationStateSchemaComplete(), true);
  // 모든 PUBLIC_STATES가 출력 계약을 가진다
  for (const state of Object.values(PUBLIC_STATES)) {
    assert.ok(STATE_OUTPUT_CONTRACT[state], `missing output contract for ${state}`);
  }
});

// 13. 특성화: resolvePublicStateFields의 모든 분기 출력이 출력 계약을 만족한다.
// (이 케이스들이 통과한다는 것은 계약 추가가 현재 동작을 바꾸지 않는다는 증명이다.)
test('assertPublicStateOutput: every resolve branch satisfies the output contract', () => {
  const cases = [
    resolvePublicStateFields({ publicState: PUBLIC_STATES.PUBLISH_READY, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE }),
    resolvePublicStateFields({ publicState: PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE }),
    resolvePublicStateFields({ publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC, status: {}, retention: VALID_RETENTION, publicStructure: OK_STRUCTURE })
  ].map((fields, index) => ({
    publicState: [
      PUBLIC_STATES.PUBLISH_READY,
      PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED,
      PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC
    ][index],
    fields
  }));
  // DIAGNOSTICS_ONLY의 세 분기(retention 무효 / review 구조 깨짐 / 일반 숨김)
  const diagnosticsBranches = [
    resolvePublicStateFields({ publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY, status: {}, retention: INVALID_RETENTION, publicStructure: OK_STRUCTURE }),
    resolvePublicStateFields({ publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY, status: { review_publication_ready: true }, retention: NO_RETENTION, publicStructure: BROKEN_STRUCTURE }),
    resolvePublicStateFields({ publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY, status: {}, retention: NO_RETENTION, publicStructure: OK_STRUCTURE, existingPublicArtifactDetected: true })
  ].map(fields => ({ publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY, fields }));

  for (const { publicState, fields } of cases.concat(diagnosticsBranches)) {
    assert.equal(
      assertPublicStateOutput({
        publicState,
        effectiveHomepageVisible: fields.effectiveHomepageVisible,
        publicArtifactPolicy: fields.publicArtifactPolicy,
        action: fields.action
      }),
      true,
      `expected ${publicState} output to satisfy the contract`
    );
  }
});

// 14. 드리프트 차단: 계약을 벗어난 출력은 PublicationStateContractError로 throw
test('assertPublicStateOutput: out-of-contract output throws (drift guard)', () => {
  // PUBLISH_READY인데 홈페이지 비노출 -> 위반
  assert.throws(
    () => assertPublicStateOutput({
      publicState: PUBLIC_STATES.PUBLISH_READY,
      effectiveHomepageVisible: false,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      action: RECONCILIATION_ACTIONS.NONE_LATEST_PUBLIC_READY
    }),
    PublicationStateContractError
  );
  // PUBLISH_READY인데 diagnostics 숨김 action -> 위반
  assert.throws(
    () => assertPublicStateOutput({
      publicState: PUBLIC_STATES.PUBLISH_READY,
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      action: RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY
    }),
    PublicationStateContractError
  );
  // DIAGNOSTICS_ONLY인데 publish-ready policy -> 위반
  assert.throws(
    () => assertPublicStateOutput({
      publicState: PUBLIC_STATES.DIAGNOSTICS_ONLY,
      effectiveHomepageVisible: false,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      action: RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY
    }),
    PublicationStateContractError
  );
  // 알 수 없는 상태 -> 위반
  assert.throws(
    () => assertPublicStateOutput({
      publicState: 'SOMETHING_NEW',
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      action: RECONCILIATION_ACTIONS.NONE_LATEST_PUBLIC_READY
    }),
    PublicationStateContractError
  );
});
