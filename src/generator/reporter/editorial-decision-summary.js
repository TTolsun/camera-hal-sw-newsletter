const EDITORIAL_DECISION_HEADINGS = {
  summary: '편집자 기사 판단 요약',
  verdict: '편집자 결론',
  legend: '판단 라벨 의미'
};

const EDITORIAL_DECISION_TABLE_COLUMNS = [
  '순위',
  '기사',
  '편집 판단',
  'Pipeline 상태',
  'Bucket',
  '왜 중요한가',
  '위험 / 과장 방지'
];

const EDITORIAL_DECISION_LABELS = new Set([
  '메인(Main)',
  '보조(Supporting)',
  '짧은 소식(Short)',
  '관찰(Watch)',
  '보류(Hold)',
  '제외(Exclude)'
]);

const PIPELINE_STATUS_LABELS = {
  final_selected: '자동 선택(final_selected)',
  primary_selected: '자동 선택(primary_selected)',
  reserve: 'reserve',
  excluded: 'excluded',
  not_main_eligible: 'excluded',
  briefing_only: 'excluded',
  reference_only: 'excluded',
  quality_fail: 'report-only',
  factcheck_fail: 'report-only',
  demoted: 'excluded',
  rejected: 'excluded',
  merged: 'merged',
  hold: 'parser/source 보류',
  report_only: 'report-only',
  unknown: 'report-only'
};

const CAMERA_BUCKETS = new Set([
  'direct_aosp_camera',
  'camera_driver_image_pipeline',
  'android'
]);

const SUPPORTING_BUCKETS = new Set([
  'android_multimedia_camera_output',
  'soc_platform_signal',
  'cpp_ai_tooling_fallback'
]);

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return [value];
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function joinedEvidenceText(candidate = {}) {
  return [
    candidate.title,
    candidate.source,
    candidate.sourceName,
    candidate.bucket,
    candidate.reason,
    candidate.reasonCode,
    candidate.selectionReason,
    candidate.exclusionReason,
    ...ensureArray(candidate.reasons),
    ...ensureArray(candidate.keyEvidence),
    ...ensureArray(candidate.halImpactAxes)
  ].filter(Boolean).join(' ');
}

function hasArticleSourceUrl(candidate = {}) {
  return Boolean(candidate.url || candidate.sourceUrl);
}

function hasSourceIdentity(candidate = {}) {
  return Boolean(candidate.url || candidate.sourceUrl || candidate.sourceId);
}

function isOfficialOrHighSource(candidate = {}) {
  const text = normalizeText([
    candidate.sourceTier,
    candidate.sourceRole,
    candidate.sourceReliability,
    candidate.source,
    candidate.sourceName
  ].filter(Boolean).join(' '));
  return /\b(high|official|project-official|official_release_note|primary)\b/.test(text);
}

function hasParserOrSourceGapReason(candidate = {}) {
  const text = normalizeText(joinedEvidenceText(candidate));
  return /parser|source[_ -]?extraction|source.?gap|missing.*(?:source|date|dated)|no concrete|row parser|needs parser|보완/.test(text);
}

function hasGenericOrReferenceExclusion(candidate = {}) {
  const text = normalizeText(joinedEvidenceText(candidate));
  return candidate.bucket === 'generic_tech_watchlist' ||
    candidate.referenceOnly === true ||
    candidate.hasDatedEvidence === false ||
    /generic.*(?:ai|tech)|noise|reference[_ -]?only|watchlist|missing dated evidence|no dated evidence/.test(text);
}

function hasSocCameraPipelineEvidence(candidate = {}) {
  if (candidate.bucket !== 'soc_platform_signal' || candidate.sourceGapRisk === true || !hasArticleSourceUrl(candidate)) {
    return false;
  }
  const axesText = normalizeText(ensureArray(candidate.halImpactAxes).join(' '));
  const reasonText = normalizeText(joinedEvidenceText(candidate));
  const hasImpactAxis = /driver|image|stream|buffer|performance|thermal|resource|isp|pipeline|camera|latency/.test(axesText);
  const hasReasonEvidence = /camera|image|isp|pipeline|buffer|stream/.test(reasonText);
  return hasImpactAxis && hasReasonEvidence;
}

function pipelineStatusLabel(status) {
  return PIPELINE_STATUS_LABELS[status] || PIPELINE_STATUS_LABELS.unknown;
}

function classifyEditorialDecision(candidate = {}) {
  const status = candidate.status || 'unknown';
  const bucket = candidate.bucket || candidate.relevance_bucket || 'unknown';
  const sourceGapRisk = candidate.sourceGapRisk === true || candidate.source_gap_risk === true;
  const hasArticleUrl = hasArticleSourceUrl(candidate);
  const hasSource = hasSourceIdentity(candidate);
  const officialCameraHold =
    isOfficialOrHighSource(candidate) &&
    CAMERA_BUCKETS.has(bucket) &&
    hasParserOrSourceGapReason(candidate) &&
    hasSource;

  if (sourceGapRisk && officialCameraHold) {
    return { decision: 'Hold', label: '보류(Hold)', pipelineStatus: 'hold', pipelineLabel: pipelineStatusLabel('hold') };
  }
  if (sourceGapRisk) {
    return { decision: 'Exclude', label: '제외(Exclude)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (officialCameraHold) {
    return { decision: 'Hold', label: '보류(Hold)', pipelineStatus: 'hold', pipelineLabel: pipelineStatusLabel('hold') };
  }
  if (!hasArticleUrl || hasGenericOrReferenceExclusion({ ...candidate, bucket })) {
    return { decision: 'Exclude', label: '제외(Exclude)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (['final_selected', 'primary_selected'].includes(status) && CAMERA_BUCKETS.has(bucket)) {
    return { decision: 'Main', label: '메인(Main)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (['final_selected', 'primary_selected'].includes(status) && hasSocCameraPipelineEvidence({ ...candidate, bucket })) {
    return { decision: 'Main', label: '메인(Main)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (['final_selected', 'primary_selected'].includes(status) && SUPPORTING_BUCKETS.has(bucket)) {
    return { decision: 'Supporting', label: '보조(Supporting)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (status === 'report_only' && hasArticleUrl && CAMERA_BUCKETS.has(bucket)) {
    return { decision: 'Watch', label: '관찰(Watch)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (status === 'reserve') {
    return SUPPORTING_BUCKETS.has(bucket)
      ? { decision: 'Short', label: '짧은 소식(Short)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) }
      : { decision: 'Watch', label: '관찰(Watch)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  if (SUPPORTING_BUCKETS.has(bucket)) {
    return { decision: 'Watch', label: '관찰(Watch)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
  }
  return { decision: 'Exclude', label: '제외(Exclude)', pipelineStatus: status, pipelineLabel: pipelineStatusLabel(status) };
}

function buildDecisionReasonKo(candidate = {}, classification = classifyEditorialDecision(candidate)) {
  const bucket = candidate.bucket || candidate.relevance_bucket || 'unknown';
  if (classification.decision === 'Main' && bucket === 'soc_platform_signal') {
    return 'SoC/platform 신호가 camera/image pipeline 영향 근거와 함께 제시되어 메인 검토 가치가 있습니다.';
  }
  if (classification.decision === 'Main') {
    return 'Camera, driver, image pipeline 직접성이 있는 후보입니다.';
  }
  if (classification.decision === 'Supporting') {
    return 'HAL 개발 workflow에는 유용하지만 Camera 직접성은 보조 수준입니다.';
  }
  if (classification.decision === 'Short') {
    return '짧게 언급할 수 있으나 main article로는 우선순위가 낮습니다.';
  }
  if (classification.decision === 'Watch') {
    return '참고 가치가 있지만 본문 승격은 편집자 재검토가 필요합니다.';
  }
  if (classification.decision === 'Hold') {
    return '공식 또는 high-priority camera source지만 parser/source extraction 보완 후 재검토해야 합니다.';
  }
  return 'source gap, generic noise, reference-only 또는 dated evidence 부족으로 제외 대상입니다.';
}

function buildDecisionGuardrailKo(candidate = {}, classification = classifyEditorialDecision(candidate)) {
  const bucket = candidate.bucket || candidate.relevance_bucket || 'unknown';
  if (candidate.sourceGapRisk === true || candidate.source_gap_risk === true) {
    return 'source gap이 남아 있으므로 자동 선택 여부와 무관하게 main으로 보지 않습니다.';
  }
  if (classification.decision === 'Main' && bucket === 'soc_platform_signal') {
    return 'source가 말하지 않은 HAL runtime/API/driver 변경으로 과장하지 않습니다.';
  }
  if (classification.decision === 'Main') {
    return 'Android HAL contract 직접 변경은 source가 명시한 범위로만 설명합니다.';
  }
  if (classification.decision === 'Supporting' || classification.decision === 'Short') {
    return 'Camera-specific runtime impact로 승격하지 않습니다.';
  }
  if (classification.decision === 'Hold') {
    return 'parser/source 보완 전에는 source gap article을 main으로 승격하지 않습니다.';
  }
  return '본문 승격 없이 diagnostics 또는 watch context로만 봅니다.';
}

module.exports = {
  EDITORIAL_DECISION_HEADINGS,
  EDITORIAL_DECISION_LABELS,
  EDITORIAL_DECISION_TABLE_COLUMNS,
  PIPELINE_STATUS_LABELS,
  buildDecisionGuardrailKo,
  buildDecisionReasonKo,
  classifyEditorialDecision,
  pipelineStatusLabel
};
