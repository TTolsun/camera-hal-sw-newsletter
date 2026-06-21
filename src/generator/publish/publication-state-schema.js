// 발행 상태(publication state) 분류와 상태별 출력 정책의 단일 진실원.
//
// 여기 있는 함수는 모두 순수 로직이다 — 파일시스템에 접근하지 않는다.
// 소비자(public-state-reconciliation 등)가 디스크 구조·retention 같은
// 사실을 먼저 해석한 뒤 인자로 넘겨준다. 발행 상태가 무엇이고, 그 상태가
// 어떤 출력(홈페이지 노출/index 동작/artifact 정책/편집자 검토 필요/archive
// 동기화)을 의미하는지는 오직 이 모듈에서 정의한다.

const PUBLIC_STATES = Object.freeze({
  PUBLISH_READY: 'PUBLISH_READY',
  REVIEW_ONLY_PUBLIC_CREATED: 'REVIEW_ONLY_PUBLIC_CREATED',
  DIAGNOSTICS_ONLY: 'DIAGNOSTICS_ONLY',
  DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC: 'DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC'
});

const RUN_MODES = Object.freeze({
  PUBLISH_READY: 'publish_ready',
  REVIEW_ONLY_PUBLIC: 'review_only_public',
  DIAGNOSTICS_ONLY: 'diagnostics_only',
  DIAGNOSTICS_ONLY_RETAINED_PUBLIC: 'diagnostics_only_retained_public'
});

const PUBLIC_ARTIFACT_POLICIES = Object.freeze({
  LATEST_PUBLIC_READY: 'latest_public_ready',
  LATEST_REVIEW_PUBLICATION_READY: 'latest_review_publication_ready',
  REVIEW_PUBLICATION_INVALID_PUBLIC_STRUCTURE: 'review_publication_invalid_public_structure',
  HIDE_EXISTING_PUBLIC_ARTIFACT_AFTER_LATEST_DIAGNOSTICS_ONLY:
    'hide_existing_public_artifact_after_latest_diagnostics_only',
  RETAIN_EXISTING_EDITOR_APPROVED_PUBLIC: 'retain_existing_editor_approved_public',
  INVALID_RETENTION_IGNORED: 'invalid_retention_ignored'
});

const RECONCILIATION_ACTIONS = Object.freeze({
  NONE_LATEST_PUBLIC_READY: 'none_latest_public_ready',
  UPSERTED_LATEST_PUBLIC_ENTRY: 'upserted_latest_public_entry',
  REMOVED_NEWSLETTERS_INDEX_ENTRY: 'removed_newsletters_index_entry',
  RETAINED_EXISTING_PUBLIC_WITH_METADATA: 'retained_existing_public_with_metadata',
  INVALID_RETENTION_IGNORED_AND_REMOVED_INDEX_ENTRY:
    'invalid_retention_ignored_and_removed_index_entry'
});

const PUBLIC_ARTIFACT_SOURCES = Object.freeze({
  LATEST_RUN: 'latest_run',
  PREVIOUS_RUN: 'previous_run',
  NONE: 'none'
});

const DIAGNOSTICS_STATUSES = new Set([
  'NEEDS_FIX',
  'QUALITY_NEEDS_FIX',
  'UNDERFILLED_NEEDS_FIX',
  'FAILED_REPAIR_REVIEWABLE',
  'FAILED_RAW_ARTIFACT_VALIDATION'
]);

function isTrue(value) {
  return value === true || value === 'true';
}

// 분류된 발행 상태별로 고정된 속성을 한 곳에 모은 선언 테이블.
// runMode·requiresEditorReview·archiveSync는 상태만으로 결정된다.
// (DIAGNOSTICS_ONLY의 홈페이지 노출/정책/action은 retention·구조에 따라
//  달라지므로 resolvePublicStateFields에서 추가로 가린다.)
const STATE_DEFINITIONS = Object.freeze({
  [PUBLIC_STATES.PUBLISH_READY]: Object.freeze({
    runMode: RUN_MODES.PUBLISH_READY,
    requiresEditorReview: false,
    archiveSync: true
  }),
  [PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED]: Object.freeze({
    runMode: RUN_MODES.REVIEW_ONLY_PUBLIC,
    requiresEditorReview: true,
    archiveSync: true
  }),
  [PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC]: Object.freeze({
    runMode: RUN_MODES.DIAGNOSTICS_ONLY_RETAINED_PUBLIC,
    requiresEditorReview: false,
    archiveSync: false
  }),
  [PUBLIC_STATES.DIAGNOSTICS_ONLY]: Object.freeze({
    runMode: RUN_MODES.DIAGNOSTICS_ONLY,
    requiresEditorReview: true,
    archiveSync: false
  })
});

// 분류된 발행 상태가 reconcile에서 산출해도 되는 출력 조합의 화이트리스트.
// resolvePublicStateFields의 각 분기가 내놓는 (홈페이지 노출, artifact policy,
// reconciliation action)이 여기서 벗어나면 분류와 출력 정책이 어긋난 것(드리프트)
// 이다. STATE_DEFINITIONS가 "상태→고정 속성"을 모은다면, 이 표는 "상태→허용 출력
// 전이"를 모은다. 상태를 디스크/홈페이지에 반영하기 전에 이 계약으로 검증한다.
const STATE_OUTPUT_CONTRACT = Object.freeze({
  [PUBLIC_STATES.PUBLISH_READY]: Object.freeze({
    homepageVisible: true,
    publicArtifactPolicies: Object.freeze([PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY]),
    actions: Object.freeze([RECONCILIATION_ACTIONS.NONE_LATEST_PUBLIC_READY])
  }),
  [PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED]: Object.freeze({
    homepageVisible: true,
    publicArtifactPolicies: Object.freeze([PUBLIC_ARTIFACT_POLICIES.LATEST_REVIEW_PUBLICATION_READY]),
    actions: Object.freeze([RECONCILIATION_ACTIONS.UPSERTED_LATEST_PUBLIC_ENTRY])
  }),
  [PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC]: Object.freeze({
    homepageVisible: true,
    publicArtifactPolicies: Object.freeze([PUBLIC_ARTIFACT_POLICIES.RETAIN_EXISTING_EDITOR_APPROVED_PUBLIC]),
    actions: Object.freeze([RECONCILIATION_ACTIONS.RETAINED_EXISTING_PUBLIC_WITH_METADATA])
  }),
  [PUBLIC_STATES.DIAGNOSTICS_ONLY]: Object.freeze({
    homepageVisible: false,
    publicArtifactPolicies: Object.freeze([
      PUBLIC_ARTIFACT_POLICIES.INVALID_RETENTION_IGNORED,
      PUBLIC_ARTIFACT_POLICIES.REVIEW_PUBLICATION_INVALID_PUBLIC_STRUCTURE,
      PUBLIC_ARTIFACT_POLICIES.HIDE_EXISTING_PUBLIC_ARTIFACT_AFTER_LATEST_DIAGNOSTICS_ONLY
    ]),
    actions: Object.freeze([
      RECONCILIATION_ACTIONS.INVALID_RETENTION_IGNORED_AND_REMOVED_INDEX_ENTRY,
      RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY
    ])
  })
});

class PublicationStateContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicationStateContractError';
  }
}

function stateDefinition(publicState) {
  return STATE_DEFINITIONS[publicState] || STATE_DEFINITIONS[PUBLIC_STATES.DIAGNOSTICS_ONLY];
}

function runModeForPublicState(publicState) {
  return stateDefinition(publicState).runMode;
}

function requiresEditorReview(publicState) {
  return stateDefinition(publicState).requiresEditorReview;
}

function archiveSyncEnabled(publicState) {
  return stateDefinition(publicState).archiveSync;
}

function latestDiagnosticsOnly(status = {}) {
  if (isTrue(status.diagnostics_only)) return true;
  return !isTrue(status.public_newsletter_ready) &&
    !isTrue(status.final_publish_ready) &&
    !isTrue(status.review_publication_ready) &&
    DIAGNOSTICS_STATUSES.has(String(status.status || status.generation_status || ''));
}

// 순수 분류. 호출자가 publicStructure·retention 사실을 해석해 넘긴다.
function classifyPublicState({ status = {}, publicStructure = {}, retention = {} } = {}) {
  if (isTrue(status.final_publish_ready) && isTrue(status.public_newsletter_ready) && publicStructure.ok) {
    return PUBLIC_STATES.PUBLISH_READY;
  }
  if (
    !isTrue(status.final_publish_ready) &&
    isTrue(status.review_publication_ready) &&
    isTrue(status.public_newsletter_ready) &&
    publicStructure.ok
  ) {
    return PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED;
  }
  if (latestDiagnosticsOnly(status) && retention.valid && publicStructure.ok) {
    return PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC;
  }
  return PUBLIC_STATES.DIAGNOSTICS_ONLY;
}

// 분류된 상태와 컨텍스트(retention·구조)로 reconcile이 소비할 출력 필드를
// 결정한다. PUBLISH_READY/REVIEW_ONLY/RETAINED 3개는 상태만으로 고정되고,
// 나머지(DIAGNOSTICS_ONLY)는 retention 무효 / review 구조 깨짐 / 일반 숨김
// 3가지로 갈린다.
function resolvePublicStateFields({
  publicState,
  status = {},
  retention = {},
  publicStructure = {},
  existingPublicArtifactDetected
} = {}) {
  if (publicState === PUBLIC_STATES.PUBLISH_READY) {
    return {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_PUBLIC_READY,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.LATEST_RUN,
      action: RECONCILIATION_ACTIONS.NONE_LATEST_PUBLIC_READY,
      reason: 'latest run is final publish-ready and public structure is valid'
    };
  }
  if (publicState === PUBLIC_STATES.REVIEW_ONLY_PUBLIC_CREATED) {
    return {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.LATEST_REVIEW_PUBLICATION_READY,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.LATEST_RUN,
      action: RECONCILIATION_ACTIONS.UPSERTED_LATEST_PUBLIC_ENTRY,
      reason: 'latest run created a structurally valid review-only public issue'
    };
  }
  if (publicState === PUBLIC_STATES.DIAGNOSTICS_ONLY_BUT_KEEP_EXISTING_PUBLIC) {
    return {
      effectiveHomepageVisible: true,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.RETAIN_EXISTING_EDITOR_APPROVED_PUBLIC,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.PREVIOUS_RUN,
      action: RECONCILIATION_ACTIONS.RETAINED_EXISTING_PUBLIC_WITH_METADATA,
      reason: 'valid public-retention.json allows previous public issue to remain visible'
    };
  }
  if (retention.exists && !retention.valid) {
    return {
      effectiveHomepageVisible: false,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.INVALID_RETENTION_IGNORED,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.NONE,
      action: RECONCILIATION_ACTIONS.INVALID_RETENTION_IGNORED_AND_REMOVED_INDEX_ENTRY,
      reason: `invalid public-retention.json ignored: ${retention.error || 'unknown retention error'}`
    };
  }
  if (isTrue(status.review_publication_ready) && !publicStructure.ok) {
    return {
      effectiveHomepageVisible: false,
      publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.REVIEW_PUBLICATION_INVALID_PUBLIC_STRUCTURE,
      publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.NONE,
      action: RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY,
      reason: `review_publication_ready was true but public structure was invalid: ${(publicStructure.errors || []).join('; ') || 'unknown'}`
    };
  }
  return {
    effectiveHomepageVisible: false,
    publicArtifactPolicy: PUBLIC_ARTIFACT_POLICIES.HIDE_EXISTING_PUBLIC_ARTIFACT_AFTER_LATEST_DIAGNOSTICS_ONLY,
    publicArtifactSource: PUBLIC_ARTIFACT_SOURCES.NONE,
    action: RECONCILIATION_ACTIONS.REMOVED_NEWSLETTERS_INDEX_ENTRY,
    reason: existingPublicArtifactDetected
      ? 'latest diagnostics-only run is not public-ready and no valid retention metadata exists'
      : 'latest diagnostics-only run has no effective public artifacts'
  };
}

// 분류된 상태와 그 상태로 산출된 출력 필드가 STATE_OUTPUT_CONTRACT를 만족하는지
// 검증한다. 상태를 디스크/홈페이지에 반영하기 직전 호출해, 분류 로직과 출력 로직이
// 어긋난 채로 잘못된 발행/숨김 결정이 나가는 것을 fail-closed로 막는다.
// 현재 resolvePublicStateFields의 모든 분기는 이 계약을 만족하므로 평시엔 발동하지
// 않고, 미래에 한쪽만 바뀌어 드리프트가 생길 때만 throw한다.
function assertPublicStateOutput({ publicState, effectiveHomepageVisible, publicArtifactPolicy, action } = {}) {
  const contract = STATE_OUTPUT_CONTRACT[publicState];
  if (!contract) {
    throw new PublicationStateContractError(
      `Unknown publication state has no output contract: ${String(publicState)}`
    );
  }
  if (effectiveHomepageVisible !== contract.homepageVisible) {
    throw new PublicationStateContractError(
      `Publication state ${publicState} requires effectiveHomepageVisible=${contract.homepageVisible} but resolved ${effectiveHomepageVisible}`
    );
  }
  if (!contract.publicArtifactPolicies.includes(publicArtifactPolicy)) {
    throw new PublicationStateContractError(
      `Publication state ${publicState} resolved an out-of-contract artifact policy: ${String(publicArtifactPolicy)}`
    );
  }
  if (!contract.actions.includes(action)) {
    throw new PublicationStateContractError(
      `Publication state ${publicState} resolved an out-of-contract reconciliation action: ${String(action)}`
    );
  }
  return true;
}

// 스키마 자기검증: PUBLIC_STATES의 모든 상태가 STATE_DEFINITIONS와
// STATE_OUTPUT_CONTRACT 항목을 갖추고, run mode가 알려진 RUN_MODE인지 확인한다.
// 새 상태를 추가하면서 정의/계약을 빠뜨리면 여기서 잡는다.
function assertPublicationStateSchemaComplete() {
  for (const state of Object.values(PUBLIC_STATES)) {
    if (!STATE_DEFINITIONS[state]) {
      throw new PublicationStateContractError(`Missing STATE_DEFINITIONS entry for ${state}`);
    }
    if (!STATE_OUTPUT_CONTRACT[state]) {
      throw new PublicationStateContractError(`Missing STATE_OUTPUT_CONTRACT entry for ${state}`);
    }
    if (!Object.values(RUN_MODES).includes(STATE_DEFINITIONS[state].runMode)) {
      throw new PublicationStateContractError(
        `STATE_DEFINITIONS[${state}].runMode is not a known RUN_MODE: ${String(STATE_DEFINITIONS[state].runMode)}`
      );
    }
  }
  return true;
}

module.exports = {
  PUBLIC_STATES,
  RUN_MODES,
  PUBLIC_ARTIFACT_POLICIES,
  PUBLIC_ARTIFACT_SOURCES,
  RECONCILIATION_ACTIONS,
  DIAGNOSTICS_STATUSES,
  STATE_DEFINITIONS,
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
};
