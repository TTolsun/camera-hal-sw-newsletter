const {
  ensureArray
} = require('./publish-status');
const {
  renderEditorPrSummary
} = require('../../shared/common/editor-pr-summary');
const {
  valueOrUnknown,
  booleanText
} = require('./pr-body-format');

function numericStatusValue(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function finalNewsletterHardBlockers(status = {}) {
  const blockers = [];
  const mustFixCount = numericStatusValue(status.must_fix_count);
  const sourceGapCount = numericStatusValue(status.source_gap_count);
  const staleHardFailureCount = numericStatusValue(status.stale_claim_hard_failure_count);

  if (mustFixCount > 0) blockers.push(`fact-check must_fix ${mustFixCount}건`);
  if (sourceGapCount > 0) blockers.push(`source gap ${sourceGapCount}건`);
  if (status.quality_status && status.quality_status !== 'PASS') {
    blockers.push(`quality_status=${status.quality_status}`);
  }
  if (status.fact_check_status && status.fact_check_status !== 'PASS') {
    blockers.push(`fact_check_status=${status.fact_check_status}`);
  }
  if (status.stale_claim_status === 'NEEDS_FIX' || staleHardFailureCount > 0) {
    blockers.push(`stale claim hard failure ${staleHardFailureCount}건`);
  }
  if (status.validate_outcome && status.validate_outcome !== 'success') {
    blockers.push(`validate_outcome=${status.validate_outcome}`);
  }
  if (status.image_audit_gate_passed === false) {
    blockers.push(`image_audit_outcome=${valueOrUnknown(status.image_audit_outcome)}`);
  }
  if (ensureArray(status.consistency_errors).length > 0) {
    blockers.push(`consistency_errors ${ensureArray(status.consistency_errors).length}건`);
  }
  if (status.publish_gate_passed === false) {
    blockers.push('publish_gate_passed=false');
  }
  if (status.repair_failure_kind) {
    blockers.push(`repair_failure_kind=${status.repair_failure_kind}`);
  }
  return blockers;
}

// 이미지 계보 감사 실패는 라벨(publish-ready 차단)과 머지 경로(validate:images) 양쪽에서 이미
// 강제된다. 본문도 같은 사실을 말해야 편집장이 읽는 면과 라벨이 어긋나지 않는다(#896).
function imageAuditDemoted(status = {}) {
  return status.image_audit_gate_passed === false;
}

function imageAuditDemotionReason(status = {}) {
  return `이미지 계보 감사 결과가 ${valueOrUnknown(status.image_audit_outcome)}이므로 final_publish_ready를 강등했습니다. 머지 경로의 validate:images도 같은 조건을 차단합니다. publish-ready label 금지.`;
}

function finalNewsletterHandoff(status = {}, handoff = null) {
  if (handoff?.diagnosticsOnly) {
    return {
      nextStep: 'blocked',
      label: '진단 전용',
      reason: 'diagnostics_only=true이고 public_newsletter_ready=false입니다. merge해도 홈페이지에 표시되지 않습니다.'
    };
  }
  if (imageAuditDemoted(status)) {
    return {
      nextStep: 'rerun_required',
      label: '이미지 계보 감사 실패로 강등',
      reason: imageAuditDemotionReason(status)
    };
  }
  if (status.final_publish_ready === true && status.validate_outcome === 'success') {
    return {
      nextStep: 'run_03',
      label: 'AI 자동 발행 가능',
      reason: 'final_publish_ready=true, publish_gate_passed=true, validate_outcome=success입니다.'
    };
  }
  if (handoff?.reviewPublicationReady) {
    return {
      nextStep: 'strengthen_candidates',
      label: '편집장 승인 시 공개 가능(단, publish-ready 아님)',
      reason: 'review_publication_ready=true이고 public_newsletter_ready=true이지만 final_publish_ready=false입니다.'
    };
  }
  return {
    nextStep: 'rerun_required',
    label: '수정 필요/실패',
    reason: 'hard blocker, validation, fact-check, quality 상태를 확인해야 합니다.'
  };
}

function finalNewsletterVerdict(status = {}, handoff = null) {
  if (handoff?.diagnosticsOnly) {
    return {
      label: '진단 전용',
      action: 'merge하지 말고 failure diagnostics와 repair artifact를 확인하세요.',
      firstLook: 'public_newsletter_ready=false입니다. merge해도 홈페이지에 표시되지 않습니다.'
    };
  }
  if (imageAuditDemoted(status)) {
    return {
      label: '이미지 계보 감사 실패로 강등',
      action: 'image-audit-report.json의 발행 차단 항목을 고친 뒤 다시 실행하세요. AI 자동 발행 기준을 통과한 PR이 아니므로 publish-ready label 금지.',
      firstLook: imageAuditDemotionReason(status)
    };
  }
  if (status.final_publish_ready === true && status.validate_outcome === 'success') {
    return {
      label: 'AI 자동 발행 가능',
      action: '최종 편집 검토 후 merge할 수 있습니다.',
      firstLook: 'final_publish_ready=true이며 quality/fact-check/validation gate가 통과했습니다.'
    };
  }
  if (handoff?.reviewPublicationReady) {
    return {
      label: '편집장 승인 시 공개 가능(단, publish-ready 아님)',
      action: '편집장 승인 시 공개 가능하지만, AI 자동 발행 기준을 통과한 publish-ready PR은 아닙니다. publish-ready label 금지.',
      firstLook: 'merge 시 홈페이지 표시 가능 여부와 review-only 사유를 먼저 확인하세요.'
    };
  }
  return {
    label: '수정 필요/실패',
    action: 'quality/fact-check/source gap/stale claim 문제를 해결한 뒤 재실행하거나 수동 수정하세요.',
    firstLook: 'hard blocker, warning, failure_reason을 먼저 확인하세요.'
  };
}

function renderFinalNewsletterEditorSummary(status = {}, handoff = null, date = '') {
  const finalHandoff = finalNewsletterHandoff(status, handoff);
  const verdict = finalNewsletterVerdict(status, handoff);
  const hardBlockers = finalNewsletterHardBlockers(status);
  const hardBlockerSummary = hardBlockers.length === 0
    ? '없음'
    : hardBlockers.slice(0, 3).join('; ');
  const publishReadyLabelChecklist = status.final_publish_ready === true
    ? { label: 'publish-ready label 적용 여부 확인', checked: true }
    : { label: 'publish-ready label 금지 여부 확인', checked: true };
  return renderEditorPrSummary({
    stage: 'final_newsletter',
    verdict,
    handoff: finalHandoff,
    summaryRows: [
      ['생성 단계', '최종 뉴스레터 생성'],
      ['기준 날짜', date || 'unknown'],
      ['publication_mode', handoff?.publicationMode || 'unknown'],
      ['homepage_visibility', handoff?.homepageVisibility || 'unknown'],
      ['public_newsletter_ready', booleanText(handoff?.publicNewsletterReady)],
      ['homepage_visible_after_merge', booleanText(handoff?.homepageVisibleAfterMerge)]
    ],
    checklistItems: [
      { label: 'source gap 여부 확인', checked: Number(status.source_gap_count || 0) === 0 },
      { label: 'hard blocker 여부 확인', checked: status.quality_status === 'PASS' && status.fact_check_status === 'PASS' },
      { label: 'HAL 관련성과 과장 claim 확인', checked: false },
      publishReadyLabelChecklist,
      { label: '편집장 수동 판단 필요 항목 확인', checked: false }
    ],
    resultRows: [
      ['final_publish_ready', booleanText(status.final_publish_ready), status.final_publish_ready === true ? 'AI 자동 발행 가능' : 'AI 자동 발행 기준 미충족'],
      ['review_publication_ready', booleanText(handoff?.reviewPublicationReady), handoff?.reviewPublicationReady ? '편집장 승인 시 공개 가능' : '아님'],
      ['diagnostics_only', booleanText(handoff?.diagnosticsOnly), handoff?.diagnosticsOnly ? 'merge해도 홈페이지 미노출' : '아님'],
      ['publish_gate_passed', booleanText(status.publish_gate_passed), status.publish_gate_passed === true ? '통과' : '미통과'],
      ['quality score', valueOrUnknown(status.quality_score), `기준 ${valueOrUnknown(status.quality_threshold)}; ${status.quality_status || 'unknown'}`],
      ['hard blocker', hardBlockers.length, hardBlockerSummary],
      ['warning', valueOrUnknown(status.quality_deduction_count ?? 0), Number(status.quality_deduction_count || 0) > 0 ? '확인 필요' : '없음']
    ]
  });
}

function renderPublicationDecisionSummary(status, handoff) {
  if (!handoff) return '';
  const autoPublish = status.final_publish_ready === true ? '통과' : '실패';
  const reviewPublication = handoff.reviewPublicationReady ? '가능' : '불가능';
  const publicFiles = handoff.publicNewsletterReady ? '있음' : '없음';
  const homepage = handoff.homepageVisibleAfterMerge ? '표시됨' : '표시되지 않음';
  const publishReadyLabel = status.final_publish_ready === true ? '붙임' : '붙이지 않음';
  return [
    '## 발행 상태 요약',
    '',
    '| 항목 | 판단 |',
    '| --- | --- |',
    `| 자동 발행 기준 | ${autoPublish} |`,
    `| 편집자 승인 발행 가능 여부 | ${reviewPublication} |`,
    `| Public newsletter files | ${publicFiles} |`,
    `| Merge 후 홈페이지 표시 여부 | ${homepage} |`,
    `| publish-ready label | ${publishReadyLabel} |`,
    '',
    `- image_audit_outcome: ${valueOrUnknown(status.image_audit_outcome)}`,
    `- review_publication_ready: ${booleanText(handoff.reviewPublicationReady)}`,
    `- diagnostics_only: ${booleanText(handoff.diagnosticsOnly)}`,
    `- homepage_visible_after_merge: ${booleanText(handoff.homepageVisibleAfterMerge)}`,
    `- publication_mode: ${valueOrUnknown(handoff.publicationMode)}`,
    `- homepage_visibility: ${valueOrUnknown(handoff.homepageVisibility)}`,
    `- fallback_only: ${booleanText(handoff.fallbackOnly)}`,
    `- camera_anchor_count: ${valueOrUnknown(handoff.cameraAnchorCount)}`,
    `- fallback_public_ready: ${booleanText(handoff.fallbackPublicReady)}`,
    ''
  ].join('\n');
}

module.exports = {
  numericStatusValue,
  imageAuditDemoted,
  finalNewsletterHardBlockers,
  finalNewsletterHandoff,
  finalNewsletterVerdict,
  renderFinalNewsletterEditorSummary,
  renderPublicationDecisionSummary
};
