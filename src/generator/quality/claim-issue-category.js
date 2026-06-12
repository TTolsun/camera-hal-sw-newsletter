'use strict';

// reason code -> claim 이슈 카테고리 매핑 레지스트리.
// 새 claim 규칙을 추가할 때 분기 함수를 고치는 대신 이 테이블에만 항목을 더한다(OCP).
// 매핑되지 않은 reason code는 기본값 'claim-binding'으로 분류한다.
const CLAIM_ISSUE_CATEGORY_BY_REASON_CODE = {
  // claim-contract: 필수 claim 필드/식별자 계약 위반
  missing_claims: 'claim-contract',
  missing_claim_id: 'claim-contract',
  empty_claim_text: 'claim-contract',
  invalid_claim_type: 'claim-contract',
  invalid_overclaim_risk: 'claim-contract',
  missing_source_urls: 'claim-contract',
  missing_fact_evidence_ids: 'claim-contract',
  duplicate_claim_id: 'claim-contract',
  missing_fact_claim: 'claim-contract',

  // claim-impact-level: impact level 값 오류
  invalid_impact_level: 'claim-impact-level',

  // claim-source-binding: source URL / seed evidence pack 바인딩 불일치
  source_url_mismatch: 'claim-source-binding',
  evidence_source_url_mismatch: 'claim-source-binding',
  source_url_fragment_mismatch: 'claim-source-binding',
  seed_evidence_pack_unmatched: 'claim-source-binding',
  seed_evidence_pack_ambiguous: 'claim-source-binding',
  seed_evidence_pack_url_only_shared_page_rejected: 'claim-source-binding',
  seed_evidence_pack_url_fallback_rejected: 'claim-source-binding',
  seed_evidence_pack_title_fallback_rejected: 'claim-source-binding',
  seed_evidence_pack_ref_out_of_range: 'claim-source-binding',
  seed_evidence_pack_ref_metadata_mismatch: 'claim-source-binding',

  // claim-coverage: 대응하는 fact claim 누락
  missing_matching_fact_claim: 'claim-coverage',

  // claim-overclaim: 직접 근거 없는 과장/금지 표현
  direct_hal_claim_without_direct_evidence: 'claim-overclaim',
  do_not_claim_violation: 'claim-overclaim',
  do_not_overstate_violation: 'claim-overclaim',

  // claim-evidence: 인용한 evidence id가 실제 근거를 뒷받침하지 못함
  unknown_evidence_id: 'claim-evidence',
  keyword_hint_is_not_evidence: 'claim-evidence',
  gemini_proposal_is_not_evidence: 'claim-evidence',
  provenance_id_without_item_evidence: 'claim-evidence',
  blocked_or_failed_evidence_id: 'claim-evidence',
  derived_evidence_mapping: 'claim-evidence',
  fact_claim_not_supported_by_evidence_text: 'claim-evidence',
  runtime_claim_without_runtime_evidence: 'claim-evidence',
  stream_buffer_metadata_without_stream_buffer_metadata_evidence: 'claim-evidence'
};

function claimIssueCategory(reasonCode = '') {
  return CLAIM_ISSUE_CATEGORY_BY_REASON_CODE[reasonCode] || 'claim-binding';
}

module.exports = { CLAIM_ISSUE_CATEGORY_BY_REASON_CODE, claimIssueCategory };
