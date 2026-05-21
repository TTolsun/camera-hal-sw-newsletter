const DIAGNOSIS_LABELS_KO = Object.freeze({
  actual_news_shortage: '실제 뉴스 부족',
  parser_extraction_failure: '파서 추출 실패',
  source_gap_risk: '소스 풀 부족 위험',
  taxonomy_missing: '분류 체계 누락',
  fallback_only_composition: 'Fallback 기사만 남음',
  duplicate_or_noop_source_discovery: 'Source discovery 중복 또는 무효'
});

const RECOMMENDED_ACTION_LABELS_KO = Object.freeze({
  KEEP_AND_FIX_PARSER: '소스 유지, 파서 수정',
  DOWNGRADE_GENERIC_SOURCE: '일반 소스로 강등',
  ADD_MULTIMEDIA_BUCKET: 'Multimedia bucket 추가',
  REVIEW_SOURCE_GAP: '소스 풀 보강 검토',
  REPAIR_SOURCE_DISCOVERY_DUPLICATES: 'Source discovery 중복 제거/수리',
  NO_ACTION_THIN_WEEK: '기사 부족 주간으로 판단, 조치 없음',
  KEEP_AND_MONITOR: '유지하고 추적'
});

module.exports = {
  DIAGNOSIS_LABELS_KO,
  RECOMMENDED_ACTION_LABELS_KO
};
