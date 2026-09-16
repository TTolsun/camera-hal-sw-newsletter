const {
  candidateFactId,
  candidateTitle,
  candidateUrl,
  canonicalDocumentUrl,
  finalSelectionEligible,
  text
} = require('../shared/collect/source-intelligence-utils');
const { ensureArray } = require('../shared/common/value-coercion');
const { buildFact } = require('./extract-source-facts');

// 같은 문서의 키. fragment는 HTTP 요청에 실리지 않으므로 fragment만 다른 두 URL은 같은 본문을
// 받는다. 정의는 근거 출처 매칭이 이미 쓰는 canonicalDocumentUrl(fragment·후행 슬래시·android
// 문서의 hl 제거)을 재사용한다 — 그 밖의 query string은 남으므로 다른 문서로 본다.
function sourceDocumentKey(url) {
  return canonicalDocumentUrl(url);
}

// 클러스터 형제(같은 문서, fragment만 다른 후보)는 fetch 대상에서 빠진다 — 대표 하나만 받으면
// 되기 때문이다(selectEvidenceFetchTargetGroups). 그런데 fact 조회는 후보 id 단위라 형제는
// 자기 fact가 없어 not_checked에 머물렀고, #1108 게이트 뒤로는 그것이 곧 영구 main 불가였다
// (실측 2026-09-14: CameraX 릴리스 페이지의 #1.7.0-alpha03이 대표라 #1.6.2는 not_checked,
// release-class pool 1 → 0, #1136). 대표가 실제로 받은 본문을 형제의 fact로 삼는다. 검증이
// 보는 것은 "그 문서를 받았고 본문이 비어 있지 않았는가"라 같은 문서면 결과가 같다.
// 실패·빈 본문도 그대로 물려받는다(대표가 못 받은 문서는 형제도 못 받은 것이다). 그 상태
// (fetch_failed_review_required)는 not_checked가 아니라 #1108 게이트를 통과한다 — 대표와 같다.
// 원문 fetch가 실제로 일어난 fact만 물려준다 — metadata_only fact를 물려주면 대표의 summary가
// 형제의 근거 본문으로 둔갑한다.
function factsByDocument(sourceFacts = {}) {
  const byDocument = new Map();
  for (const fact of sourceFacts.sources || []) {
    if (fact.source_fetch_used !== true) continue;
    const key = sourceDocumentKey(fact.url);
    if (key && !byDocument.has(key)) byDocument.set(key, fact);
  }
  return byDocument;
}

function inheritedFact(candidate, byDocument) {
  const documentFact = byDocument.get(sourceDocumentKey(candidateUrl(candidate)));
  if (!documentFact) return null;
  const fetchedText = ensureArray(documentFact.claims).map(claim => text(claim?.evidence_text)).find(Boolean) || '';
  return {
    ...buildFact(candidate, {
      fetchedText,
      metadataFallback: false,
      sourceFetchUsed: true,
      sourceFetchStatus: documentFact.source_fetch_status,
      sourceFetchError: documentFact.source_fetch_error,
      validationMode: documentFact.validation_mode
    }),
    inherited_from_candidate_id: candidateFactId(documentFact)
  };
}

function validateOne(candidate = {}, facts = {}, capDroppedIds = new Set(), byDocument = new Map()) {
  const id = candidateFactId(candidate);
  const fact = facts[id] || inheritedFact(candidate, byDocument) || {};
  const claims = Array.isArray(fact.claims) ? fact.claims : [];
  const supportedClaims = claims.filter(claim => text(claim.evidence_text));
  const unsupportedClaims = claims.filter(claim => !text(claim.evidence_text));
  const unsupportedCount = unsupportedClaims.length;
  const sourceFetchUsed = fact.source_fetch_used === true;
  const sourceFetchStatus = fact.source_fetch_status || 'skipped';
  const sourceFetchError = fact.source_fetch_error || '';
  const validationMode = fact.validation_mode || (candidate.source_gap_risk === true ? 'metadata_only' : 'skipped');
  // 본문이 비어 온 응답(empty)도 원문을 못 받은 것으로 센다. 근거 본문이 없다는 사실은 같은데
  // 실패와 다르게 다루면 한쪽만 발행이 막힌다.
  const fetchFailed = sourceFetchUsed && (sourceFetchStatus === 'failed' || sourceFetchStatus === 'empty');
  const metadataCanSupportClaim = validationMode === 'metadata_only';
  const hasSupportedCoreClaim = supportedClaims.length > 0 ||
    (metadataCanSupportClaim && Boolean(text(candidate.summary || candidate.behavior_change)));
  let finalSelectionBlocked = false;
  let editorReviewRequired = false;
  let status = validationMode === 'skipped' ? 'not_checked' : 'pass';
  const reasons = [];

  if (candidate.source_gap_risk === true) {
    finalSelectionBlocked = true;
    status = 'blocked';
    reasons.push('source_gap_risk=true');
  }
  if (candidate.stale_claim_risk === 'high' && candidate.editor_approved_exception !== true) {
    finalSelectionBlocked = true;
    status = 'blocked';
    reasons.push('stale_claim_risk=high');
  }
  if (fetchFailed && candidate.source_gap_risk !== true) {
    editorReviewRequired = true;
    status = status === 'blocked' ? status : 'fetch_failed_review_required';
    reasons.push('source_fetch_failed');
  } else if (unsupportedCount > 0 && !hasSupportedCoreClaim) {
    finalSelectionBlocked = true;
    status = 'blocked';
    reasons.push('unsupported_claims_without_supported_core_claim');
  } else if (unsupportedCount > 0) {
    editorReviewRequired = true;
    status = status === 'blocked' ? status : 'editor_review_required';
    reasons.push('unsupported_claims_excluded');
  }

  // 근거 수집 cap에 밀려 원문을 못 받은 후보를 표시한다. 자격이 없어 대상이 아니었던 후보와
  // status가 똑같이 not_checked라 리포트만으로는 구분되지 않았다.
  //
  // reasons에는 넣지 않는다. 그 배열의 항목은 지금까지 전부 finalSelectionBlocked 또는
  // editorReviewRequired를 함께 세우는 게이트 사유여서, 비차단 항목을 섞으면
  // "reasons가 비어있지 않다 = 발행 위험"으로 읽던 쪽에 잡음이 된다.
  //
  // 진단 전용이다. finalSelectionBlocked도 status도 바꾸지 않는다.
  const capDropped = capDroppedIds.has(id);

  return {
    candidate_id: id,
    url: candidateUrl(candidate),
    evidence_fetch_cap_dropped: capDropped,
    title: candidateTitle(candidate),
    deep_checked: sourceFetchUsed && sourceFetchStatus === 'success',
    source_fetch_used: sourceFetchUsed,
    source_fetch_status: sourceFetchStatus,
    source_fetch_error: sourceFetchError,
    validation_mode: validationMode,
    // 자기 id로 받은 원문이 아니라 같은 문서의 대표에게서 물려받은 경우 그 대표의 id.
    evidence_inherited_from_candidate_id: fact.inherited_from_candidate_id || '',
    unsupported_claims: unsupportedCount,
    supported_claims: supportedClaims.length,
    final_selection_blocked: finalSelectionBlocked,
    editor_review_required: editorReviewRequired,
    unsupported_claims_excluded: unsupportedCount > 0 && hasSupportedCoreClaim,
    evidence_validation_status: status,
    reasons
  };
}

function validateCandidateEvidence(candidates = [], sourceFacts = {}, options = {}) {
  const factMap = {};
  for (const fact of sourceFacts.sources || []) {
    const id = candidateFactId(fact);
    factMap[id] = fact;
  }
  const capDroppedIds = new Set(ensureArray(options.capDroppedCandidates).map(candidateFactId));
  const byDocument = factsByDocument(sourceFacts);
  const checked = candidates
    .map(candidate => validateOne(candidate, factMap, capDroppedIds, byDocument));
  const byId = new Map(checked.map(item => [item.candidate_id, item]));
  const annotatedCandidates = candidates.map(candidate => {
    const id = candidateFactId(candidate);
    const item = byId.get(id);
    if (!item) {
      return {
        ...candidate,
        final_selection_blocked: candidate.final_selection_blocked === true,
        editor_review_required: candidate.editor_review_required === true,
        unsupported_claims_excluded: candidate.unsupported_claims_excluded === true,
        evidence_validation_status: candidate.evidence_validation_status || 'not_checked'
      };
    }
    return {
      ...candidate,
      final_selection_blocked: item.final_selection_blocked,
      editor_review_required: item.editor_review_required,
      unsupported_claims_excluded: item.unsupported_claims_excluded,
      evidence_validation_status: item.evidence_validation_status
    };
  });

  return {
    report: {
      schema_version: 1,
      report_type: 'evidence_validation',
      newsletter_date: options.newsletterDate || '',
      candidates: checked,
      counts: checked.reduce((counts, item) => {
        counts[item.evidence_validation_status] = (counts[item.evidence_validation_status] || 0) + 1;
        return counts;
      }, {}),
      // counts는 status 히스토그램이라 합계가 후보 수와 같아야 한다. cap 계수는 그 분포와
      // 직교하므로(같은 후보가 not_checked이면서 cap에 밀린 것일 수 있다) 따로 둔다.
      //
      // 두 수를 함께 남기는 이유: dropped에는 자격 없는 클러스터 대표가 많이 섞인다. 그건
      // 정상이다(발행 대상이 아니니 안 봐도 된다). 이 리포트가 답해야 하는 질문은
      // "발행될 수 있었는데 근거를 못 받은 후보가 있는가"이고 그건 dropped_publishable이다.
      //
      // 두 수 모두 candidates에서 센다. 한쪽만 options.capDroppedCandidates에서 세면
      // 그 배열에 candidates 밖 항목이 섞였을 때 두 수가 조용히 어긋난다.
      evidence_fetch_cap: {
        dropped: checked.filter(item => item.evidence_fetch_cap_dropped).length,
        dropped_publishable: candidates
          .filter(candidate => capDroppedIds.has(candidateFactId(candidate)) && finalSelectionEligible(candidate))
          .length
      }
    },
    annotatedCandidates
  };
}

module.exports = {
  validateCandidateEvidence,
  validateOne
};
