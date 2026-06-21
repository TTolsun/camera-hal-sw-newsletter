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

module.exports = {
  PUBLIC_STATES,
  RUN_MODES,
  PUBLIC_ARTIFACT_POLICIES,
  PUBLIC_ARTIFACT_SOURCES,
  RECONCILIATION_ACTIONS,
  DIAGNOSTICS_STATUSES,
  STATE_DEFINITIONS,
  isTrue,
  latestDiagnosticsOnly,
  classifyPublicState,
  resolvePublicStateFields,
  runModeForPublicState,
  requiresEditorReview,
  archiveSyncEnabled
};
